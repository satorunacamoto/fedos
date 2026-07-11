# Secure Runtime Alpha 061 — Identity Bootstrap Idempotency

## 1. Why now

Alpha 058 added `bootstrapIdentity()`, Alpha 060 added `isBootstrapped()`
— together they can report "has Bootstrap ever succeeded," but nothing
in this repository yet specifies what happens if `bootstrapIdentity()`
is called a SECOND time on the same instance. Before Alpha 059's own
designated Authority (a Desktop shell) ever exists to call this method
even once, this Stage decides — and implements — the formal repeat-call
specification, so that decision is settled before any real caller could
possibly call it more than once (e.g., a Desktop shell re-checking
identity on every window focus, or calling it defensively before every
identity-dependent operation).

## 2. The exact change

One guard statement is added as `bootstrapIdentity()`'s own new FIRST
statement:

```ts
async bootstrapIdentity(): Promise<void> {
  if (this.#bootstrapped) {
    return;
  }
  await this.#service.describeIdentity();
  this.#bootstrapped = true;
}
```

The two pre-existing statements — `await this.#service.describeIdentity();`
and `this.#bootstrapped = true;` — are untouched, in the same order,
unmodified. `describeIdentity()`, `findIdentity()`, `listIdentities()`,
and `isBootstrapped()` are untouched. No other file is modified.

## 3. Idempotent specification

`bootstrapIdentity()` is idempotent AFTER its first successful
completion: calling it any number of additional times on the SAME
instance has no additional effect and performs no additional work.
Concretely:

- **Second, third, … call after a success**: `this.#bootstrapped` is
  already `true`, so the guard returns immediately — `describeIdentity()`
  is NOT called again, the injected `FedosIdentityProvider` is NOT read
  again, and `FedosIdentityRegistry.register()` is NOT attempted again.
- **A repeat call following a FAILED attempt**: `this.#bootstrapped` is
  still `false` (Alpha 060's own Fail-Closed guarantee — the assignment
  sits after the `await`, never reached on a rejection), so the guard
  does NOT trigger — the call proceeds exactly as a first attempt would,
  retrying `describeIdentity()` for real.

## 4. Requirements confirmed

- **`describeIdentity()` is not called twice** after a successful
  Bootstrap — the guard returns before reaching that line on every
  subsequent call.
- **The Registry is not registered into twice** — `FedosIdentityService.describeIdentity()`
  (Alpha 042, unmodified) is the only code path that ever calls
  `FedosIdentityRegistry.register()`, and it is not reached a second
  time once `#bootstrapped` is `true`.
- **The Provider is not read twice** — the injected
  `FedosIdentityProvider` is read only inside `FedosIdentityService.describeIdentity()`
  (unmodified), which the guard prevents from being reached again.

All three requirements reduce to the same fact: the guard sits BEFORE
the only line that reaches the Service, Provider, or Registry, so
"not called/read/registered twice" is a direct, structural consequence
of the guard's own position — not a separate mechanism that could
drift out of sync with it.

## 5. Failure behavior — no permanent lock-out

A rejection from `describeIdentity()` still propagates unmodified to
`bootstrapIdentity()`'s own caller (Alpha 058, unchanged). Because the
`this.#bootstrapped = true;` assignment sits strictly AFTER the
`await`, a rejection means that line is never reached, so
`this.#bootstrapped` remains `false`. The guard added by this Stage
only ever short-circuits when `this.#bootstrapped` is `true` — so a
failed attempt leaves the NEXT `bootstrapIdentity()` call completely
unguarded, and it retries `describeIdentity()` for real, exactly as a
first call would. There is no field, flag, or counter anywhere in this
file that ever prevents a retry after a failure — this Stage
deliberately does not add one.

## 6. Option comparison

- **Option A — run every time (no idempotency).** Every
  `bootstrapIdentity()` call re-reads the Provider and re-attempts
  Registry registration, regardless of prior success. Rejected: a
  Desktop shell calling this defensively (e.g., before every
  identity-dependent screen) would repeat real Provider/Network/Storage
  work indefinitely once a real Source exists — the same class of
  "repeated construction-time work" risk Alpha 056/057 already
  identified and fixed once for Worker's own per-request `createRuntime()`
  call, reintroduced here at the per-call level instead.
- **Option B (adopted) — idempotent, first-success-only.** Exactly the
  literal specification this Stage was asked to implement: one guard
  statement, checked first, short-circuiting every call after the
  first success. Matches this class's own existing "thin, minimal
  delegation" character (Alpha 058 §6) more closely than any
  alternative — one `if`, no new field, no new type.
- **Option C — retry only on failure (a variant already equivalent to
  B).** Describes the SAME observable behavior Option B already
  produces: repeat calls after success are no-ops (nothing to retry);
  repeat calls after failure retry (since `#bootstrapped` is `false`).
  Considered as a separate option in this Stage's own brief, but not
  actually distinguishable from Option B once `#bootstrapped`'s own
  Alpha 060 semantics (true only on success) are taken as fixed — so
  this Stage did not implement it as a second mechanism; Option B's own
  single guard already IS "retry only on failure."
- **Option D — construct a fresh Registry on every Bootstrap attempt.**
  Rejected: `FedosIdentityRegistry` is constructed exactly once, in the
  constructor, and shared identically by the Service (writer) and
  Resolver (reader) for the entire lifetime of a `FedosRuntimeIdentity`
  instance (Alpha 050-052's own correctness requirement — a Resolver
  backed by a different Registry than the one the Service writes to
  would silently never see anything the Service registers). Rebuilding
  the Registry per Bootstrap attempt would silently discard whatever a
  prior successful Bootstrap had already registered, directly
  contradicting `isBootstrapped() === true`'s own claim that Bootstrap
  already succeeded.
- **Option E — add an explicit `reset()` method.** Rejected for this
  Stage: no caller anywhere in this repository needs to un-bootstrap an
  instance (Alpha 059 named a single long-running Desktop process, not
  a short-lived one that needs to reinitialize identity mid-session),
  and adding one would be new, speculative surface beyond the literal
  "call twice" specification this Stage was asked to settle. Nothing
  forecloses a future Stage adding `reset()` if a real caller ever
  needs one — today, constructing a NEW `FedosRuntimeIdentity` already
  gives any caller a fresh, never-bootstrapped instance whenever it
  actually wants one.

## 7. Comparison table (16 criteria)

| Criterion | A: run every time | B: idempotent (adopted) | C: retry-only-on-failure | D: fresh Registry per attempt | E: explicit `reset()` |
|---|---|---|---|---|---|
| Repeat-call cost | Full re-run every call | Zero cost after first success | Same observable cost as B | Full re-run every call, plus data loss | Zero cost unless `reset()` called |
| Provider reads | One per call, unbounded | Exactly one, ever (post-success) | Same as B | One per call | One per successful cycle |
| Registry writes | Unbounded, duplicate risk | At most one successful registration | Same as B | Unbounded, PLUS prior data discarded | One per cycle |
| Failure retry | Always retries (trivially) | Retries automatically (guard untouched on failure) | Same as B | Always retries | Retries after `reset()` only |
| Permanent lock-out risk | None | None (§5) | None | None | Possible if `reset()` never called by a confused caller |
| API surface added | None | One `if` statement | None (same as B) | None | One new public method |
| Registry consistency | Weak — repeat writes | Strong — single authoritative registration | Same as B | Broken — later attempts erase earlier state | Strong between resets, reset on demand |
| Desktop fit | Poor — a shell re-checking identity casually repeats real work | Good — safe to call defensively, as often as convenient | Same as B | Poor | Neutral — depends on caller discipline around `reset()` |
| Worker fit | Poor (same reasoning Alpha 056/057 already established) | Neutral — Worker remains unwired regardless (Alpha 059) | Same as B | Poor | Neutral |
| Testability | Simple to state, expensive to exercise realistically | Simple — call twice, assert single underlying call | Same as B | Simple to break (data loss is easy to demonstrate) | Requires testing `reset()`'s own edge cases too |
| Protocol independence | Unaffected | Unaffected | Unaffected | Unaffected | Unaffected |
| Storage impact | Repeated (future) Storage reads once a real Source exists | Single (future) Storage read | Same as B | Repeated, plus stale Registry state | Bounded by caller's own `reset()` discipline |
| Network impact | Repeated (future) Network calls once a real Source exists | Single (future) Network call | Same as B | Repeated | Bounded by caller's own `reset()` discipline |
| Fail Closed | N/A — no status concept assumed | Preserved — failure still leaves `isBootstrapped() === false` (Alpha 060) | Same as B | Preserved, but Registry state is now untrustworthy regardless | Preserved between resets |
| Observability | Unaffected — same rejection-propagation shape (Alpha 058) | Unaffected — same rejection-propagation shape | Same as B | Unaffected | Unaffected, plus a new success/failure history for `reset()` itself to reason about |
| Complexity added | None | Minimal — one guard, no new state | None beyond B | None beyond A, but a correctness bug (data loss) | A new method, a new caller-discipline requirement |
| Matches this Stage's own literal specification | No | **Yes — exactly the requested `if (#bootstrapped) { return; }`** | Describes B's own behavior, not a distinct mechanism | No | No — adds scope beyond what was asked |

## 8. What this Stage does NOT do

- Does **not** modify `create_runtime.ts` or `AppRuntime` (`types.ts`).
- Does **not** modify `src/worker.ts`.
- Does **not** modify any Runtime API (`AppRuntime`'s own field set is
  unaffected; `bootstrapIdentity()`/`isBootstrapped()` remain reachable
  only by directly constructing a `FedosRuntimeIdentity`).
- Does **not** modify `FedosIdentityResolver`, `FedosIdentityRegistry`,
  or `FedosIdentityProvider`/any Provider implementation.
- Does **not** modify any Storage file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** wire Desktop, Worker, or any other Authority — Alpha
  059's own Decision remains unimplemented by this Stage.
- Does **not** add a `reset()` method, a fresh-Registry-per-attempt
  behavior, or any state beyond the single pre-existing
  `#bootstrapped` field.

## 9. Summary

This Stage's own net effect on `src/` is exactly one guard statement,
`if (this.#bootstrapped) { return; }`, added as `bootstrapIdentity()`'s
own new first statement. A successful Bootstrap makes every later call
on the same instance a synchronous no-op — no repeat `describeIdentity()`
call, no repeat Provider read, no repeat Registry registration attempt.
A failed Bootstrap leaves the guard inactive, so the very next call
retries for real — no permanent lock-out exists. Option B (idempotent,
first-success-only) was adopted over running every time (repeats real
work indefinitely), a fresh-Registry-per-attempt (silently discards
prior successful state), and an explicit `reset()` (speculative scope
beyond what any known caller needs today).

## 10. See also

- `docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md`
- `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`
- `docs/secure_runtime_alpha_060_identity_bootstrap_status.md`
