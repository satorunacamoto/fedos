# Secure Runtime Alpha 060 — Identity Bootstrap Status

## 1. Why now

Alpha 058 added `bootstrapIdentity(): Promise<void>` — callable, but
its own outcome is entirely invisible to anything outside the `Promise`
it returns. Alpha 059 decided WHO should eventually call it (Desktop
Application startup), without wiring anything. This Stage adds the
smallest possible observation surface on top of that: a way to ask "has
Bootstrap ever completed" without re-running it, without receiving the
Descriptor itself, and without any new execution path. It does not add
a second Authority, and it does not wire Desktop or any other caller —
that remains exactly as deferred as Alpha 059 left it.

## 2. The exact change

One private field and one public method are added to
`FedosRuntimeIdentity` (`src/runtime/fedos_runtime_identity.ts`):

```ts
#bootstrapped: boolean = false;

async bootstrapIdentity(): Promise<void> {
  await this.#service.describeIdentity();
  this.#bootstrapped = true;
}

isBootstrapped(): boolean {
  return this.#bootstrapped;
}
```

`describeIdentity()`, `findIdentity()`, and `listIdentities()` are
untouched. `bootstrapIdentity()`'s own pre-existing line,
`await this.#service.describeIdentity();`, is untouched — one line,
`this.#bootstrapped = true;`, is appended AFTER it. `isBootstrapped()`
is a new, fifth method: synchronous, reads only the private field,
performs no I/O, and cannot throw.

No other file is touched. `create_runtime.ts`, `types.ts`,
`src/worker.ts`, every `src/identity/*` file, and every Storage/Crypto/
Rust file remain byte-for-byte unchanged.

## 3. Status transition

```
new FedosRuntimeIdentity()
  → #bootstrapped = false
  → isBootstrapped() = false

bootstrapIdentity() called, describeIdentity() resolves (any value)
  → this.#bootstrapped = true   (reached only after the await)
  → isBootstrapped() = true

bootstrapIdentity() called, describeIdentity() throws/rejects
  → "this.#bootstrapped = true" line never reached
  → the rejection propagates to bootstrapIdentity()'s own caller,
    UNCHANGED from Alpha 058
  → isBootstrapped() = false
```

There is no path in this file that ever sets `#bootstrapped` back to
`false` once it becomes `true`, and no path that sets it `true` other
than a successful `bootstrapIdentity()` completion. A second,
independent `FedosRuntimeIdentity` instance has its own independent
`#bootstrapped` field — status is per-instance, matching every other
piece of state this class already holds (Registry included).

## 4. `false` → `true` condition, stated precisely

`#bootstrapped` becomes `true` under exactly ONE condition: a call to
`this.bootstrapIdentity()` on this same instance whose own internal
`await this.#service.describeIdentity()` resolves without throwing —
regardless of whether the resolved Descriptor is `null` or non-`null`.
`describeIdentity()` resolving `null` (the current, Null-Source-driven
behavior) still counts as Bootstrap having "completed successfully";
`isBootstrapped()` answers "did the sequence run to completion," not
"did it find an identity." No other method, and no code outside
`bootstrapIdentity()`'s own body, ever assigns to `#bootstrapped`.

## 5. Fail Closed

Both of the following report `false`, indistinguishably:

- **Bootstrap never attempted** — the field's own initial value.
- **Bootstrap attempted and failed** — `describeIdentity()` rejected,
  so the assignment after the `await` was never reached.

This is a deliberate design choice, not an oversight: a caller of
`isBootstrapped()` that treats `false` as "not yet safe to assume
identity is bootstrapped" behaves correctly whether the real reason is
"hasn't tried" or "tried and failed" — both cases warrant identical
caution. Distinguishing "never attempted" from "failed" would require
a THIRD state (see §7, Option B), which this Stage deliberately does
not add, keeping the field's own meaning to the single question this
Stage was asked to answer: "has Bootstrap ever succeeded, yes or no."
`bootstrapIdentity()`'s own rejection still propagates to its caller
unmodified (Alpha 058) — a caller that wants to know WHY Bootstrap
failed already has that information from the rejection itself, at the
moment it happens; `isBootstrapped()` is not a substitute for handling
that rejection, only a later, cheap re-check.

## 6. Why `describeIdentity()`/`findIdentity()`/`listIdentities()` are untouched

None of the three needs to know about Bootstrap status to do its own
job: `describeIdentity()` always performs a real read regardless of
prior Bootstrap calls; `findIdentity()`/`listIdentities()` always read
whatever the Registry currently holds, with or without a prior
Bootstrap. Adding a Bootstrap-status check to any of them would
introduce a NEW coupling this Stage has no evidence is needed and this
Stage's own mandate does not authorize — `isBootstrapped()` is an
independent, additive observation, not a gate on any pre-existing
method's own behavior.

## 7. Option comparison — representation of Bootstrap status

- **Option A (adopted) — `boolean`.** Answers exactly one question
  ("has Bootstrap ever succeeded") with the smallest possible type.
  Matches this Stage's own literal specification
  (`#bootstrapped: boolean`) precisely. Trivially Fail-Closed: the
  zero-value (`false`) IS the safe default, requiring no additional
  logic to keep failure and non-attempt indistinguishable-but-safe.
- **Option B — `enum`** (e.g. `"NotAttempted" | "Bootstrapped" |
  "Failed"`). Would let a caller distinguish "never tried" from
  "tried and failed" — genuinely more informative, but this Stage's
  own mandate asks for the MINIMUM observation surface, and a
  three-state enum invites a caller to treat `"Failed"` as somehow
  safer than `"NotAttempted"` (or vice versa) when, per §5, both
  warrant identical caution today. Rejected for this Stage as more
  surface than the stated goal requires; nothing forecloses a future
  Stage revisiting this if a real caller ever needs the distinction.
- **Option C — expose the `Promise` itself** (e.g. cache and return
  `bootstrapIdentity()`'s own in-flight/settled `Promise`). Rejected:
  this conflates "was Bootstrap requested" with "did it succeed," and
  reintroduces exactly the kind of unawaited-`Promise`-adjacent
  bookkeeping this arc spent Alpha 055–057 removing from
  `createRuntime()`'s own call site; a settled-or-not `Promise` is also
  a poor fit for repeated, cheap synchronous checks — `isBootstrapped()`
  is checked far more often than Bootstrap itself would ever run.
- **Option D — a timestamp** (e.g. `#bootstrappedAt: number | null`).
  Would additionally answer "when," which nothing in this Stage's own
  mandate, nor any known caller, has asked for. A timestamp also
  invites staleness reasoning ("is this bootstrap result too old to
  trust") that this class has no basis to answer today — that would be
  real, new behavior, not a status observation. Rejected as
  speculative.
- **Option E — a counter** (e.g. `#bootstrapAttempts: number`). Would
  answer "how many times," useful only if repeated Bootstrap attempts
  were expected or rate-limited — neither is true today (Alpha 059
  named a single long-running Desktop process as the sole future
  Authority, not a repeated-retry caller). Rejected as unneeded
  complexity for a single boolean question.

`boolean` is adopted because it is the smallest type that answers the
one question this Stage was asked to answer, is trivially Fail-Closed
by its own default value, and adds no interpretation burden a future
Stage would need to re-litigate.

## 8. What this Stage does NOT do

- Does **not** modify `create_runtime.ts`, `src/runtime/types.ts`, or
  `src/worker.ts`.
- Does **not** modify any `src/identity/*` file (Provider, Registry,
  Resolver, Descriptor, Record, Source, or either Resolver).
- Does **not** modify `describeIdentity()`, `findIdentity()`, or
  `listIdentities()` — all three remain byte-for-byte unchanged.
- Does **not** add any Public Runtime API — `isBootstrapped()` is
  reachable only by directly constructing a `FedosRuntimeIdentity`,
  which remains something only `create_runtime.ts` does.
- Does **not** call `bootstrapIdentity()` from anywhere, and does not
  wire Desktop, Worker, or any other caller — Alpha 059's own Decision
  remains unimplemented by this Stage.
- Does **not** modify any Storage or Crypto file, `packages/fedos-core-rust`,
  `Cargo.toml`, or `package.json`.
- Does **not** add a second Bootstrap Authority, a state enum, a
  timestamp, or a counter.

## 9. Summary

This Stage's own net effect on `src/` is one private field
(`#bootstrapped: boolean`, initial `false`), one new line inside
`bootstrapIdentity()` (`this.#bootstrapped = true;`, reached only after
a successful `await`), and one new synchronous, side-effect-free,
non-throwing method, `isBootstrapped(): boolean`. Bootstrap-not-yet-run
and Bootstrap-failed both report `false`, a deliberate Fail-Closed
choice; only a completed, non-throwing `bootstrapIdentity()` call ever
flips the field to `true`. No Authority is added, no Public Runtime API
is exposed, and `describeIdentity()`/`findIdentity()`/`listIdentities()`
remain exactly as they were.

## 10. See also

- `docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md`
- `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`
