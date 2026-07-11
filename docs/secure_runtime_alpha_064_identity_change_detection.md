# Secure Runtime Alpha 064 — Identity Change Detection

## 1. Why now

Alpha 058–063 built a complete Bootstrap boundary: `bootstrapIdentity()`
(058), `isBootstrapped()` (060), idempotency (061), a settled
short-lived-object lifecycle (062), and `currentIdentity()` (063) to
read WHAT the last Bootstrap resolved. What is still missing is the
cheapest possible question a caller might ask before reaching for
`currentIdentity()` at all: **has anything changed since I last
checked?** A caller holding a stale `FedosIdentityDescriptor` (or `null`)
from an earlier read has no way to know, without comparing the whole
Descriptor by value, whether it is still current. This Stage adds the
smallest possible answer: a monotonic counter that moves exactly once,
from `0` to `1`, the moment Bootstrap succeeds for the first (and, per
Alpha 061's own idempotency guarantee, only) time on a given instance.

## 2. Current state, recorded precisely

```
FedosRuntimeIdentity (src/runtime/fedos_runtime_identity.ts), before this Stage
  #registry/#service/#resolver  — set once, in the constructor
  #bootstrapped: boolean = false
  #descriptor: FedosIdentityDescriptor | null = null

  bootstrapIdentity(): Promise<void>
    if (this.#bootstrapped) { return; }
    this.#descriptor = await this.#service.describeIdentity();
    this.#bootstrapped = true;

  isBootstrapped(): boolean          — reads #bootstrapped
  currentIdentity(): Descriptor|null — reads #descriptor
  describeIdentity()/findIdentity()/listIdentities(): pure pass-throughs
```

Confirmed via a fresh repository search performed for this Stage:

- No field named `version`, `identityVersion`, `generation`,
  `revision`, or `epoch` exists anywhere in `fedos_runtime_identity.ts`
  prior to this Stage.
- `bootstrapIdentity()`'s own guarded body is exactly two statements
  after the Alpha 061 guard: the descriptor-capturing `await`, then
  `this.#bootstrapped = true;`. Both are reached ONLY on a successful
  `describeIdentity()` resolution, and ONLY on the FIRST such call for
  a given instance (Alpha 061's own guard prevents a second real
  attempt once `#bootstrapped` is `true`).
- No caller anywhere in this repository invokes `bootstrapIdentity()`
  today (Alpha 059 §2, reconfirmed unchanged) — this Stage's own new
  counter is, like every method before it, reachable only by directly
  constructing a `FedosRuntimeIdentity`.

## 3. The five candidate options

- **Option A** — a plain `number` counter, incremented by exactly `1`
  on each successful `bootstrapIdentity()` completion.
- **Option B** — a timestamp (`Date.now()` or similar), recorded at the
  moment of successful completion.
- **Option C** — a randomly-generated UUID/opaque token, regenerated on
  each successful completion.
- **Option D** — a content hash of the resolved Descriptor (or `null`),
  recomputed on each successful completion.
- **Option E** — no stored marker at all: a caller compares the
  PREVIOUS and NEXT `FedosIdentityDescriptor` values it already holds,
  field by field, itself.

## 4. Comparison

| Criterion | A: number counter | B: timestamp | C: UUID/token | D: content hash | E: caller-side Descriptor comparison |
|---|---|---|---|---|---|
| 同期契約 (Sync contract) | Trivially synchronous — an integer field read | Synchronous — `Date.now()` is synchronous, but the READ is still just a number | Synchronous, if a synchronous UUID generator is used (`crypto.randomUUID()` is) | Synchronous IF the hash function chosen is synchronous — but hashing pulls in a real algorithm choice this task's own five-field `FedosIdentityDescriptor` does not need | N/A — no new method on this class at all; entirely the caller's own synchronous logic, outside this file |
| throw禁止 (never throws) | Trivially true — incrementing/reading a private `number` can never throw | True for `Date.now()` | True for `crypto.randomUUID()` in a Worker/Node/browser context this Runtime already targets | Depends on the hash implementation chosen — a WebCrypto `subtle.digest()` call would be ASYNC and could reject, directly violating "never throws"/"synchronous" together; a pure JS hash could avoid this but adds a dependency this file has never had | N/A |
| Monotonic / orderable | **Yes, trivially** — a `+= 1` can only ever increase; `newVersion > oldVersion` is a direct, correct "has this changed AND in which direction" comparison | Almost — `Date.now()` is monotonic in practice but NOT guaranteed strictly increasing across two calls in the same millisecond, and is vulnerable to system clock adjustment, a real risk this Runtime has no control over | **No** — a UUID has no ordering; a caller can detect "different" (`old !== new`) but never "which came first," the exact bit of information a Change Detection API's own name implies it should carry | No — a hash has no ordering either, same limitation as C | Depends entirely on caller-authored comparison logic, which this Option does not provide or standardize at all |
| Data shape | A plain `number` — the smallest possible representation of "has this happened N times yet" | A `number` (epoch millis) too, but semantically overloaded — a caller might mistakenly treat it as WHEN identity last changed (a claim this Runtime cannot make honestly, since Bootstrap timing itself is caller-controlled, per Alpha 059 §6) rather than merely THAT it changed | A `string`, needing string comparison/storage on the caller's own side for something conceptually as simple as a boolean-ish signal | A `string` (hex/base64), same caller-side storage cost as C, for a signal Option A already provides more cheaply | No new type at all — but pushes real comparison work (and the bug surface of writing it correctly) onto every caller instead of centralizing it once, here |
| Idempotency (Alpha 061 interaction) | **Directly reinforces it** — living INSIDE the same guarded branch as `#bootstrapped`/`#descriptor` means the counter can only ever move `0`→`1` per instance, a fact a caller can rely on structurally, not just by convention | Same structural guarantee as A (also inside the guard), but the VALUE itself carries no such guarantee — nothing stops two DIFFERENT instances from producing the same or even a smaller timestamp than an earlier one, depending on clock behavior | Same structural placement as A, but two different instances' UUIDs carry no relationship to each other or to call order at all | Same structural placement as A, but two Bootstrap successes that happen to resolve the SAME Descriptor value would produce the SAME hash — indistinguishable from "never changed," which is arguably correct for content-identity but wrong for THIS task's own literal ask ("Bootstrap成功なら++", unconditionally) | Entirely outside the guard's own protection — nothing prevents a caller from comparing state in a way that misses or double-counts a change, since no single, authoritative counter exists to compare against |
| Fail Closed | `0` un-Bootstrapped, unconditionally `+1` per real success, untouched on rejection — the exact same three-state shape (never-attempted / failed / succeeded-once) `isBootstrapped()`/`currentIdentity()` already established, extended by one integer instead of a new shape | Same shape achievable, but `0` has no natural "never happened" meaning for a timestamp the way it does for a counter — `0` (epoch) is a valid, real past date, an ambiguity a counter does not have | Same shape achievable with an `initial null` sentinel instead of `0` (UUIDs have no natural "zero" value), a type (`string \| null`) more complex than the mandated `number` | Same `null`-sentinel complication as C | No Fail-Closed guarantee of any kind is established by this Option — it is defined entirely by whatever the caller's own comparison code happens to do |
| Runtime純粋性 (Runtime purity) | A pure, synchronous integer increment — no I/O, no external entropy source, no Provider/Registry/Resolver touch, matching `isBootstrapped()`/`currentIdentity()`'s own already-established shape exactly | Reads the system clock — a real, if small, external dependency this Runtime has otherwise avoided inside `FedosRuntimeIdentity` entirely | Reads `crypto.getRandomValues()` internally — pulls a real entropy source into a class whose own header comment (Alpha 058–063) explicitly lists "NO Relay, event, signing, secret-key... reference of any kind," and random generation is adjacent territory this class has never needed before | Requires choosing and importing a hash algorithm — new surface area, however small, in a file whose own design has stayed at zero new imports since Alpha 050 | Adds nothing to this file at all, but "purity" is not really the axis this Option fails on — it fails on NOT SOLVING THE TASK, since the task asks for a method ON `FedosRuntimeIdentity` |
| Protocol非依存 (Protocol independence) | Unaffected — a plain integer carries no protocol semantics | Unaffected | Unaffected | Unaffected | Unaffected |
| Storage影響 (Storage impact) | None — an in-memory field, identical in kind to `#bootstrapped`/`#descriptor` | None | None | None | None — but also does not exist on this class |
| Descriptorがnullでも++ (Increments even when Descriptor is null) | **Satisfied directly** — the increment is placed after `this.#bootstrapped = true;`, itself unconditional on the Descriptor's own value (Alpha 060's own established shape: Bootstrap "succeeding" already means "the `await` resolved without throwing," independent of whether the resolved value is `null`) | Satisfiable the same way, timestamp recorded regardless of Descriptor value | Satisfiable the same way | **NOT naturally satisfied** — hashing `null` and hashing a real Descriptor produce two DIFFERENT, equally valid hashes, but two SEPARATE successful Bootstrap calls that both resolve `null` would (correctly, for a hash) produce the SAME value, which reads as "no change" — directly contradicting the task's own explicit "Descriptorがnullでも Bootstrap成功なら++" requirement, which asks for an unconditional signal, not a content-dependent one | Cannot satisfy this at all in the general case — comparing `null` to `null` is definitionally "no change" from a caller's own point of view, the opposite of what this Stage's own mandate asks for |
| テスト容易性 (Testability) | Simple — construct, bootstrap, read; exact value assertions (`toBe(0)`, `toBe(1)`) are trivial and deterministic across every test run | Needs either a fixed/mocked clock or a "greater than before" comparison instead of an exact-value assertion — strictly harder to write deterministic tests against | Needs a "different from before" comparison (no ordering to assert), and cannot assert a SPECIFIC expected value at all without mocking the UUID generator | Needs either mocking the hash function or asserting behavior only in terms of "same input → same output," more indirect than a plain integer | No new tests on this class are possible at all — whatever comparison logic exists would live and be tested elsewhere, outside this Stage's own scope |
| 責務 (Responsibility) | Keeps this class as the single, authoritative source of "how many times has MY OWN Bootstrap succeeded" — a narrow, precisely-answerable question | Conflates "did Bootstrap succeed" with "when," a question Alpha 059 §6 already assigned to the CALLER (which controls Bootstrap timing), not to this class | Conflates "did Bootstrap succeed" with "give me an opaque unique token for this occurrence," a heavier responsibility than the literal ask | Conflates "did Bootstrap succeed" with "what does the Descriptor's content look like," duplicating `currentIdentity()`'s own already-established responsibility (Alpha 063) instead of complementing it | Assigns the ENTIRE responsibility to the caller, the opposite of what "add a minimal API" (this Stage's own mandate) asks for |
| メモリ管理 (Memory management) | A single `number` primitive — the cheapest possible representation, no additional heap allocation beyond the field itself | A single `number` primitive, same cost as A | A `string`, allocated fresh on every successful Bootstrap (extra allocation A does not have) | A `string`, same extra-allocation cost as C, plus the cost of running the hash function itself | No new allocation on this class, but shifts an equivalent (or larger, if done naively by re-serializing the whole Descriptor) cost onto every caller instead |
| 将来Provider (Future Provider) | Scales cleanly — a future real Nostr/network Provider's own successful resolution still triggers exactly one `+1`, regardless of how expensive that resolution was to obtain | Scales the same way, but a future Provider with retry/backoff internals could make "time of successful completion" a less meaningful signal than "the Nth successful completion" | Scales the same way structurally, but still carries no ordering information a future caller might eventually want | Would need the hash to be recomputed identically for any future Descriptor shape a Provider might introduce (e.g. new optional fields) — a maintenance dependency A does not have | Would need EVERY future caller to independently keep this correct as `FedosIdentityDescriptor`'s own shape evolves, rather than centralizing the logic once |
| 何を意味するか (What "changed" means, precisely) | "Bootstrap succeeded on this instance" — a single, unambiguous, already-precedented meaning (matches `#bootstrapped`'s own semantics, just counted instead of booleaned) | "The wall-clock time Bootstrap last succeeded" — a DIFFERENT, weaker claim than "changed," since two Bootstrap calls resolving the IDENTICAL Descriptor would still produce two DIFFERENT timestamps, a false-positive "change" signal | "A fresh opaque marker exists" — carries no semantic content about WHY it changed at all | "The Descriptor's own content is/is-not identical to some prior hash" — the ONLY Option that actually encodes content-equality, but the task's own explicit spec (increment even on `null`, unconditionally) says content-equality is NOT what is being asked for here | Whatever the caller decides it means — no standardized meaning exists at the class level at all |

## 5. Fail Closed — the transition table

| State | `identityVersion()` returns |
|---|---|
| Never bootstrapped (fresh instance) | `0` — `#identityVersion` starts `0`, unreached by anything until a successful `bootstrapIdentity()` |
| `bootstrapIdentity()` is CURRENTLY in flight (its own `await` has not yet resolved) | `0` (or whatever it already was) — the increment statement has not executed yet |
| `bootstrapIdentity()` REJECTED (Provider threw), first-ever attempt | `0`, unchanged — the increment sits after the `await` and after `this.#bootstrapped = true;`, so a throw prevents both from ever executing |
| `bootstrapIdentity()` REJECTED after a prior SUCCESS | Cannot occur — Alpha 061's own guard makes a second real attempt on an already-`#bootstrapped` instance unreachable |
| `bootstrapIdentity()` succeeded (Descriptor `null` OR real) | `1` — incremented by exactly `1` from whatever it held before (always `0`, for the reason above), regardless of the resolved Descriptor's own value |
| Any repeat `bootstrapIdentity()` call after the first success | Still `1` — the Alpha 061 guard returns before the increment statement is ever reached again |

The exact code shape producing this table: `this.#identityVersion += 1;`
sits strictly AFTER `this.#bootstrapped = true;`, itself strictly after
the Alpha 061 guard and the descriptor-capturing `await`. A throw from
`describeIdentity()` prevents every statement after it — including this
one — from ever executing, so `#identityVersion` is Fail-Closed by the
same "the line that would change it never ran" mechanism already
established for `#bootstrapped` (Alpha 060) and `#descriptor` (Alpha
063), not by any `try`/`catch` this Stage adds.

## 6. Decision

**Option A (a plain `number` counter) is adopted.** Option B (timestamp)
is rejected because it conflates "did Bootstrap succeed" with "when,"
a question Alpha 059 §6 already assigned to the calling process, not to
this class, and because two Bootstrap successes resolving the IDENTICAL
Descriptor would still produce two DIFFERENT timestamps — a
false-positive "change" signal the task's own Change Detection framing
does not want. Option C (UUID) is rejected because it carries no
ordering information at all — a caller can tell "different" but never
"which came first" or "how many times," weaker than what a plain
counter already gives for free, and it pulls a real entropy source into
a class whose own header comment has explicitly excluded exactly that
kind of dependency since Alpha 058. Option D (content hash) is rejected
on a concrete correctness defect against this Stage's own literal
mandate: two successful Bootstrap calls that both resolve `null` would
hash identically, reading as "no change" — directly contradicting the
explicit requirement that a `null`-resolving Bootstrap success still
counts as a change (`Descriptorがnullでも Bootstrap成功なら++`). Option E
(caller-side comparison) is rejected because it does not add an API to
this class at all — it pushes the entire responsibility, and its bug
surface, onto every future caller instead of centralizing one correct
implementation once, here.

## 7. Confirmation checklist

- **`currentIdentity()` unchanged** — byte-for-byte identical to Alpha
  063: `return this.#descriptor;`, no new read, no new dependency on
  `#identityVersion`.
- **`bootstrapIdentity()` stays idempotent** — the Alpha 061 guard
  (`if (this.#bootstrapped) { return; }`) is untouched and remains the
  method's own first statement; `#identityVersion` is incremented in
  the SAME guarded branch as `#bootstrapped`/`#descriptor`, so a repeat
  call after success never re-touches any of the three.
- **`isBootstrapped()` unchanged** — byte-for-byte identical to Alpha
  060.
- **`findIdentity()`/`listIdentities()` unchanged** — byte-for-byte
  identical pass-throughs to `#resolver`.
- **Registry unchanged** — `FedosIdentityRegistry` (`register`/`find`/
  `list`/`remove`) receives no new caller and no new method.
- **Provider unchanged** — no new `FedosIdentityProvider`
  implementation, no new call site beyond the existing
  `this.#service.describeIdentity()` call this Stage does not modify
  in any way (only the statements AFTER its own `await` gain a new
  line).
- **Storage unchanged** — no Storage file touched; `#identityVersion`
  is in-memory only, identical in kind to `#bootstrapped`/`#descriptor`.
- **`create_runtime.ts` unchanged** — still Construct Only, calling
  none of `FedosRuntimeIdentity`'s now-seven methods.
- **`AppRuntime` unchanged** — no `identityVersion`/`version` field
  added to `types.ts`.
- **Worker unchanged** — `src/worker.ts` contains no reference to
  `identityVersion`, `FedosRuntimeIdentity`, or
  `fedos_runtime_identity.ts`.
- **Rust unchanged** — `packages/fedos-core-rust`, `Cargo.toml`
  untouched; this Stage is TypeScript-only.

## 8. What this Stage does NOT do

- Does **not** modify `src/runtime/create_runtime.ts`.
- Does **not** modify `src/runtime/types.ts`.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any `src/identity/*` file (Provider, Registry,
  Resolver, Service, Descriptor, or Record).
- Does **not** modify any Storage file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** add any Public Runtime API field.
- Does **not** wire Desktop, a CLI, or any other caller into
  `bootstrapIdentity()`/`identityVersion()` — Alpha 059's own
  designated Authority remains unimplemented, unaffected by this
  Stage.
- Does **not** add a timestamp, UUID, hash, or Descriptor-comparison
  facility of any kind — Options B/C/D/E are formally rejected, not
  merely deferred.

## 9. Summary

This Stage adds a private `#identityVersion: number` field (initial
`0`) and a seventh method, `identityVersion(): number`, to
`FedosRuntimeIdentity` — the ONLY `src/` file this Stage modifies.
`bootstrapIdentity()`'s own guarded body gains ONE new final statement,
`this.#identityVersion += 1;`, placed strictly after the pre-existing
`this.#bootstrapped = true;`; every other statement, and every other
method, is byte-for-byte unchanged. Formally compares five approaches
(counter, timestamp, UUID, content hash, caller-side comparison) across
fifteen mandated criteria, and adopts a plain incrementing counter as
the only Option that is simultaneously synchronous, never-throwing,
monotonic, and correct against the task's own literal requirement that
a `null`-resolving Bootstrap success still counts as a change. Because
the increment lives inside Alpha 061's own idempotency guard,
`identityVersion()` can only ever return `0` or `1` for a single
instance — observing a genuinely different identity means constructing
a new instance, exactly as Alpha 062 already established.

## 10. See also

- `docs/secure_runtime_alpha_060_identity_bootstrap_status.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md`
- `docs/secure_runtime_alpha_063_runtime_identity_descriptor_cache.md`
