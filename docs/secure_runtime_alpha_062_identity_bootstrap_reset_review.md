# Secure Runtime Alpha 062 — Identity Bootstrap Reset Review

**Status: this is a REVIEW / DESIGN DECISION document only. No
implementation file changes anywhere in this repository. It records a
decision that this Stage's own conclusion (§9) is that NO future Stage
needs to act on it — the recommendation is "add nothing," not "a later
Stage should build X."**

## 1. Why now

Alpha 058–061 built a complete, self-contained Bootstrap boundary on
`FedosRuntimeIdentity`: `bootstrapIdentity()` (058), `isBootstrapped()`
(060), and idempotency after success (061). Every one of those Stages
deliberately deferred the same question without answering it — Alpha
061 §6 rejected an explicit `reset()` as "speculative scope beyond the
literal ask," noting only that "constructing a NEW
`FedosRuntimeIdentity` already gives any caller a fresh, never-
bootstrapped instance whenever it actually wants one." This Stage
answers that deferred question directly: **should Bootstrap state ever
be resettable**, and if identity needs to change during a process's own
lifetime, how should that actually happen. This is a pure review, in
the same family as Alpha 056 and Alpha 059 — it decides, it does not
build.

## 2. Current state, recorded precisely

```
FedosRuntimeIdentity (src/runtime/fedos_runtime_identity.ts)
  #registry: FedosIdentityRegistry     — set once, in the constructor
  #service:  FedosIdentityService      — set once, in the constructor
  #resolver: FedosIdentityResolver     — set once, in the constructor
  #bootstrapped: boolean = false       — flips to true, ONCE, on first
                                          successful bootstrapIdentity()

  bootstrapIdentity(): idempotent after success (Alpha 061); retries
                        for real after a failure (Alpha 060/061)
  isBootstrapped():    synchronous read of #bootstrapped, never throws
  describeIdentity()/findIdentity()/listIdentities(): pure pass-throughs
```

Confirmed via a fresh repository search performed for this Stage:

- No method named `reset`, `resetIdentityBootstrap`, `shutdown`,
  `clear`, `dispose`, or `close` exists anywhere in
  `fedos_runtime_identity.ts`, `fedos_identity_registry.ts`,
  `fedos_identity_service.ts`, or `fedos_identity_resolver.ts`.
- All three fields the constructor assigns (`#registry`/`#service`/
  `#resolver`) are declared `readonly` — reassigning any of them after
  construction is a TypeScript compile error today, not merely an
  unwritten convention.
- `FedosIdentityRegistry` (`src/identity/fedos_identity_registry.ts`)
  exposes exactly four methods — `register()`, `find()`, `list()`, and
  a PER-RECORD `remove(id: string): boolean` (present since Alpha 041,
  unrelated to Bootstrap and never used by `FedosRuntimeIdentity`
  today). No BULK `clear()` that empties the entire store exists —
  Option C below evaluates adding one, not the pre-existing single-id
  `remove()`.
- `create_runtime.ts` (Alpha 051, unchanged since Alpha 057) constructs
  exactly ONE `FedosRuntimeIdentity` per `createRuntime()` call, held as
  a private, function-scoped constant, never returned, never attached to
  `AppRuntime`. No Runtime API method of any kind reaches it from
  outside.
- No Desktop application shell, Worker logout route, or CLI exists
  anywhere in this repository (same finding Alpha 059 §2 already made,
  reconfirmed unchanged for this Stage).
- `src/worker.ts`'s own `fetch()` handler still calls `createRuntime(env)`
  once per incoming HTTP request (unchanged since Alpha 056/059), so a
  fresh `FedosRuntimeIdentity` — Bootstrap state included — is already
  constructed and discarded on every single Worker request, independent
  of anything this Stage decides.
- No `shutdown()`, `dispose()`, or lifecycle-teardown hook of any kind
  exists on `AppRuntime` (`src/runtime/types.ts`) or on any object
  `createRuntime()` returns.

## 3. The five candidate options

- **Option A** — add `resetIdentityBootstrap(): void` to
  `FedosRuntimeIdentity`, clearing `#bootstrapped` back to `false` (and,
  necessarily, deciding what happens to `#registry`'s own already-
  registered records).
- **Option B** — regenerate `FedosRuntimeIdentity` only: a caller that
  needs a fresh Bootstrap simply constructs a new instance
  (`new FedosRuntimeIdentity()`) and discards the old one; no reset
  method is added anywhere.
- **Option C** — add `Registry.clear(): void` to `FedosIdentityRegistry`
  directly, letting a caller empty the store without touching
  `#bootstrapped` at all.
- **Option D** — Bootstrap state is permanently fixed: once
  `#bootstrapped` becomes `true` for a given instance, nothing —
  internal or external — ever changes it back, for that instance's
  entire lifetime.
- **Option E** — introduce `shutdown(): void` (or `Promise<void>`) on
  `FedosRuntimeIdentity`, a general teardown hook that would, among
  other things, reset Bootstrap state as one of its effects.

## 4. Comparison

| Criterion | A: `resetIdentityBootstrap()` | B: regenerate `FedosRuntimeIdentity` | C: `Registry.clear()` | D: permanently fixed | E: `shutdown()` |
|---|---|---|---|---|---|
| Desktop再接続 (Desktop reconnect) | Would let a long-running Desktop process reuse ONE instance across a disconnect/reconnect cycle — but nothing in this repository defines what "reconnect" means yet (no Desktop shell exists), so the method's own contract would be guessing at a future requirement | Clean — Desktop startup already constructs its own `FedosRuntimeIdentity` once (Alpha 059 §8); a reconnect is just another startup-shaped moment, served by the SAME code path with no new method | Would clear Registry contents but leave `#bootstrapped` at `true`, an internally inconsistent state (`isBootstrapped()` claims success while the store it populated is empty) | Fits naturally IF a reconnect is modeled as "construct a new instance" (which Option D does not forbid) — but as a bare rule, gives a reconnecting Desktop no in-place path at all | Same guessing problem as A — "reconnect" behavior would be defined by an undesigned teardown hook, not a real requirement |
| ログアウト (Logout) | Same shape as reconnect — a caller could call `resetIdentityBootstrap()` on logout, but Registry cleanup timing relative to the reset is undefined by this Option alone | Clean — logout is exactly "this identity is no longer valid," and constructing a new, never-bootstrapped instance for whatever comes next (anonymous state, a different account) is a direct, obvious mapping | Clears the store correctly for logout's own purpose, but again strands `#bootstrapped` at `true` unless a second call is also made — two calls where one instance-swap would do | Consistent with the SAME "new instance on logout" pattern as B, since Option D never forbids constructing a new instance — only forbids mutating an existing one | Logout could be one of several `shutdown()` effects, but bundling it with whatever ELSE `shutdown()` does (Worker teardown? Storage flush?) couples an Identity-only concern to an undesigned general-purpose hook |
| Identity切替 (Identity switching) | Reset then re-bootstrap on the SAME instance still shares `#registry`/`#service`/`#resolver` with the OLD identity's own already-registered records unless Option C is layered on top — Option A alone does not guarantee a clean switch | **Directly solves it** — a new `FedosRuntimeIdentity` gets its own brand-new `#registry`/`#service`/`#resolver` (Alpha 050's own constructor, unchanged), so the old identity's Registry contents cannot leak into the new one BY CONSTRUCTION, not by caller discipline | Solves the Registry-leak half of switching, but `#bootstrapped`/`#service`/`#resolver` remain the OLD instance's own objects, still wired to the same Provider — a partial switch, not a clean one | Forces switching to mean "new instance" (same as B) since no in-place path exists — consistent, but only by ELIMINATING Option A/C/E as alternatives, not by adding anything itself | Could theoretically tear down and rebuild internal state, but `shutdown()`'s natural reading is "stop, permanently" (see Runtime shutdown row below), not "prepare to swap identities and keep running" |
| Registry整合性 (Registry consistency) | **Weak** — resetting `#bootstrapped` alone leaves stale records from the PRIOR identity sitting in `#registry`, silently rewritten by `describeIdentity()`'s own next successful call, with a window where `isBootstrapped() === false` but `#registry` still holds old data | **Strong** — a new instance's `#registry` starts empty by construction (`new FedosIdentityRegistry()` in the constructor, Alpha 050), giving Registry state and Bootstrap state the SAME lifetime automatically, with no possibility of drift between them | **Strong for the Registry itself**, but now Registry state and `#bootstrapped` have DIFFERENT lifetimes on the same instance — the exact drift Option B avoids by construction | **Strong**, structurally identical to B's own guarantee, since Option D's only path to a "reset" is a new instance | Depends entirely on `shutdown()`'s own undesigned internals — cannot be assessed without first designing what `shutdown()` actually does to `#registry` |
| Idempotency (Alpha 061 interaction) | **Directly conflicts** — Alpha 061's own guard, `if (this.#bootstrapped) { return; }`, exists specifically so repeat `bootstrapIdentity()` calls after success are safe no-ops; a reset method's ENTIRE PURPOSE is to defeat that guard on demand, reintroducing the exact repeat-Provider-read/repeat-Registry-write cost Alpha 061 was built to eliminate | **Fully compatible** — idempotency is a per-instance guarantee; a NEW instance has its OWN, independent `#bootstrapped = false`, never touching the guard on any instance that still exists. Alpha 061's guarantee ("safe to call any number of times after success, at zero additional cost") stays true, unconditionally, for every instance's own entire lifetime | Partially conflicts — `#bootstrapped` itself stays `true` and the guard still fires, but the Registry it guards is now silently empty, so the guard's own SAFETY property ("no second write needed because the data is already there") becomes false while the FIELD still claims `true` | **Fully compatible**, same reasoning as B — no mechanism exists to defeat the guard on any given instance, ever | Depends on `shutdown()`'s own undesigned semantics — could defeat idempotency exactly like A, or not, depending on a design that does not exist yet |
| Fail Closed | A reset method adds a NEW way to reach `#bootstrapped === false` — not just "never attempted" or "attempt failed" (Alpha 060 §current design) but also "was true, deliberately reset" — a third state `isBootstrapped()`'s own boolean cannot distinguish, weakening the Fail-Closed guarantee's own precision | **Unaffected** — Alpha 060's two-state guarantee (`false` means "not attempted OR failed") stays exactly as designed, per instance; a caller checking a NEW instance's `isBootstrapped()` gets the same well-understood `false` starting state every previous Stage already tested | Same weakening as A — `isBootstrapped() === true` while the Registry is empty is a Fail-Closed violation in spirit, even though the boolean itself does not change | **Unaffected**, same as B | Unaffected only if `shutdown()` is designed to never touch `#bootstrapped` on a live instance — undetermined |
| Runtime純粋性 (Runtime purity) | `FedosRuntimeIdentity` gains a mutation method that exists ONLY to undo its own prior success — a capability `create_runtime.ts`'s own Construct-Only design (Alpha 057) never needed and never asked for | **Fully preserved** — `createRuntime()` remains untouched (this Stage's own mandate forbids touching it regardless), and "identity switching = new instance" requires no change to how `FedosRuntimeIdentity` is constructed today | Adds a mutation method to `FedosIdentityRegistry` (Alpha 041) — a class Alpha 059 §2 already confirmed exposes no `clear()`/`delete()`/`remove()` today, and whose own design has never needed one | **Fully preserved** — the strongest possible purity guarantee: an instance's own Bootstrap outcome, once true, is a permanent fact about that instance for its entire lifetime | Adds a general teardown concept to a class whose header comment (Alpha 058–061) explicitly enumerates every method it has and explicitly forbids scope creep — `shutdown()` is the definition of scope creep here |
| Protocol非依存 (Protocol independence) | Unaffected by any Option — none of the five touches `FedosIdentityProvider`/`FedosNostrPublicIdentitySource` | Unaffected | Unaffected | Unaffected | Unaffected |
| Storage影響 (Storage impact) | None today — `#registry` is in-memory only or forwarding to a live description, not persisted; no Option here reads or writes any of the two Storage backends (`MemoryStorageBackend`/`WindowsDpapiStorageBackend`) | None | None | None | A general `shutdown()` is exactly the kind of method a FUTURE Stage would be tempted to also make flush Storage — this Stage explicitly does not authorize that, and Option E's own vagueness is itself the risk |
| Worker | Per-request `createRuntime()` (Alpha 056/059, unchanged) already discards each `FedosRuntimeIdentity` at the end of every request — a reset method would never be reached in the Worker's own current request lifecycle, making Option A dead code in the ONE deployment shape this repository actually ships today | Already exactly how Worker behaves TODAY, with zero new code — every request already gets a fresh instance; Option B does not change Worker, it DESCRIBES Worker's existing shape as the general pattern | Same dead-code problem as A in the Worker's own current lifecycle | Fits Worker's own existing behavior perfectly, with zero new code, same as B | Same dead-code problem as A/C in Worker's own current per-request lifecycle |
| CLI | No CLI exists (Alpha 059 §2, unchanged); a future CLI's own single-process-per-invocation shape would need a reset method only if ONE process were expected to bootstrap multiple identities in sequence — a requirement not established anywhere in this repository's own docs | A future CLI invoked once per identity operation gets the same "new instance" pattern for free, with no CLI-specific method needed | Same unestablished-requirement problem as A | Fits a future CLI's own single-shot shape directly | Same unestablished-requirement problem as A |
| テスト容易性 (Testability) | Every reset path needs its OWN tests for what happens to `#registry` at reset time, in addition to the existing Bootstrap/Idempotency test surface — net NEW test surface with no corresponding new requirement driving it | **Simplest** — "construct a new instance" is already exactly how all 45 of Alpha 061's own tests, and every other Stage's tests, already get a fresh `FedosRuntimeIdentity` (`new FedosRuntimeIdentity()`), with zero new API to test | Needs its own tests for the Registry/`#bootstrapped` inconsistency window this Option itself introduces | **Simplest test surface of all** — "state never goes backward" is a single, permanent invariant, trivially asserted once and never re-checked per code path | Cannot be tested meaningfully until designed — same problem as every other undesigned-scope row |
| メモリ管理 (Memory management) | No memory-management benefit — a reset does not free `#registry`/`#service`/`#resolver`, it only clears `#bootstrapped`, so the same three objects stay allocated regardless | A discarded instance (and its `#registry`/`#service`/`#resolver`) becomes eligible for garbage collection the moment nothing references it — ordinary JS/TS GC handles this with NO explicit cleanup code needed anywhere in this repository | Actually frees Registry ENTRIES (the `record`s inside `#store`), which A/D do not — but the instance itself, and its Service/Resolver, stay allocated regardless | No cleanup at all by design — but nothing in this repository's own current deployment shapes (per-request Worker, hypothetical single-process Desktop/CLI) holds a `FedosRuntimeIdentity` long enough for this to matter today | Would be the only Option to explicitly document GC-relevant teardown — but JS/TS objects do not need an explicit `dispose()` to be collected, unlike a file handle or socket; a `shutdown()` here has no real resource to release |
| 責務 (Responsibility) | Puts "should Bootstrap state ever go backward" INSIDE `FedosRuntimeIdentity` itself, as a method any caller can invoke for any reason — the class decides less, not more, about when this happens | Keeps "when does identity change" as the CALLER'S OWN responsibility (Desktop/CLI/Worker/test), exactly matching Alpha 059 §6's own already-adopted principle that the calling process, not the Runtime, owns Bootstrap timing | Splits responsibility awkwardly across two classes (`FedosRuntimeIdentity` for `#bootstrapped`, `FedosIdentityRegistry` for its own contents), with no single object owning the combined, consistent state | Puts responsibility ENTIRELY on the caller in the strongest possible way — the class does not even offer a footgun; a caller that wants a fresh state has exactly one path, `new FedosRuntimeIdentity()`, matching Alpha 061 §6's own already-stated reasoning verbatim | Puts responsibility for an UNDEFINED set of effects inside the class, the opposite direction of Alpha 059 §6's own already-adopted "caller owns timing" principle |
| 将来Provider (Future Provider) | A future real Nostr/network Provider makes reset MORE expensive to get right, not less — a reset that does not also invalidate cached Provider-level state (once a Provider grows any caching) would silently reuse stale data alongside a "reset" Bootstrap flag | **Scales cleanly** — a new instance also gets a freshly-resolved Provider reference (`resolveFedosIdentityProvider() ?? new NoopFedosIdentityProvider()`, evaluated fresh in the constructor, Alpha 050 unchanged), so switching identity naturally picks up whatever the shared Provider singleton currently resolves to, with no separate Provider-reset step required | Registry clearing does not touch the Provider at all — a future Provider-level cache would need its OWN separate reset mechanism regardless of this Option | Simplicity extends to the future: a permanently-fixed instance combined with "new instance for a new Provider state" needs no additional reset design work later, ever | Undesigned — cannot be assessed against a Provider that does not yet exist |

## 5. Answers to the confirmation questions

**Should `FedosRuntimeIdentity` ever be resettable in place?** No.
Every row in §4 that evaluates Option A or Option C surfaces the SAME
underlying defect: an in-place reset can clear `#bootstrapped` (or the
Registry) without also giving the instance a coherent, all-fields-
consistent fresh start, because `#service`/`#resolver`/the Provider
reference the constructor already wired stay exactly as they were.
Getting a reset genuinely right would mean re-running the ENTIRE
constructor body in place — at which point it is not a "reset" method
at all, it is `new FedosRuntimeIdentity()` wearing a different name.

**Does Alpha 061's idempotency guarantee survive this Decision?**
Yes, and more precisely than before this Stage. Alpha 061 guarantees
"safe to call `bootstrapIdentity()` any number of times after success,
at zero additional cost" for a GIVEN instance. This Stage adds the
missing other half: that guarantee is SCOPED to one instance's own
lifetime, and Identity switching is achieved by moving to a new
instance, never by defeating the guarantee on the old one. The two
Decisions compose without tension — Alpha 061 is about repeat calls on
the SAME identity; Alpha 062 is about what to do for a DIFFERENT one.

**Does this foreclose Desktop reconnect / logout?** No. Both map
cleanly onto Option B, per the first two rows of §4 — a reconnecting or
logging-out Desktop process constructs a new `FedosRuntimeIdentity` for
whatever comes next (the same identity again, a different one, or an
anonymous state), exactly as Alpha 059 already designated Desktop
startup as the Bootstrap Authority for the FIRST instance. No new
capability needs to exist on the class itself for a caller to do this
today — `new FedosRuntimeIdentity()` is already public, already tested
(all 45 of Alpha 061's own tests use it), and already sufficient.

**Is Option D ("permanently fixed") the same as Option B, or
different?** Related but not identical. Option D is a STATEMENT about
one instance ("its own Bootstrap outcome never changes"); Option B is
a STATEMENT about how switching identity actually happens ("construct
a new instance"). This Stage adopts both together — D describes the
invariant this repository already has today (no code path anywhere
mutates `#bootstrapped` back to `false` once `true`, confirmed by
reading `bootstrapIdentity()`'s own current five statements — the
guard, the await, and the assignment — with no other assignment to
`#bootstrapped` anywhere in the file), and B describes the pattern that
makes living with that invariant workable for Identity switching.

## 6. Decision

**Option B (regenerate `FedosRuntimeIdentity` only) is adopted,
together with Option D (Bootstrap state stays permanently fixed for a
given instance) as its supporting invariant. No Reset API is added —
Option A (`resetIdentityBootstrap()`) and Option C (`Registry.clear()`)
are explicitly rejected, and Option E (`shutdown()`) is explicitly
rejected.**

`FedosRuntimeIdentity` is treated, from this Decision forward, as a
**short-lived object**: one instance corresponds to exactly one
Bootstrap attempt's worth of identity state, for exactly as long as
whatever constructed it chooses to keep it. Option A is rejected
because every row of §4 it appears in shows the same defect — it
defeats Alpha 061's own idempotency guarantee on demand while leaving
`#service`/`#resolver`/the resolved Provider reference untouched,
producing a partially-reset, internally inconsistent instance rather
than a genuinely fresh one. Option C is rejected for the same root
reason, scoped one level lower — it can empty the Registry but leaves
`#bootstrapped` claiming success against now-empty data, and adds a
mutation method (`Registry.clear()`) to `FedosIdentityRegistry`, a
class whose own three-method surface (Alpha 041) has never needed one.
Option E is rejected as premature and unscoped — no resource this
class owns needs explicit release (§4 メモリ管理 row: ordinary garbage
collection already reclaims a discarded instance's own `#registry`/
`#service`/`#resolver`), and bundling an undesigned general-purpose
teardown hook with this Stage's own narrow question would answer a
question nobody asked while leaving the actual question open.

## 7. Identity switching, stated precisely

Identity switching is achieved by constructing a new
`FedosRuntimeIdentity` and discarding the old one — never by mutating
an existing instance's Bootstrap state. `new FedosRuntimeIdentity()`
already gives a caller everything a "switch" needs, by construction
(Alpha 050, unchanged by this Stage): a brand-new, empty
`FedosIdentityRegistry`; a `FedosIdentityService` wired to a freshly-
resolved Provider reference; a `FedosIdentityResolver` reading the new,
empty Registry; and `#bootstrapped` starting at `false`. No code
change is required anywhere in this repository to make this pattern
available — it is the same pattern every existing test in this arc
already uses to get a fresh instance, and the same pattern Alpha 059
§8 already assumed Desktop startup would use to construct its own
single, long-lived instance in the first place.

## 8. What this Stage does NOT do

- Does **not** modify `src/runtime/create_runtime.ts`.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`.
- Does **not** modify `src/runtime/types.ts`.
- Does **not** modify `src/worker.ts`.
- Does **not** modify any `src/identity/*` file — no `Registry.clear()`,
  no `reset()`, no `shutdown()` added to any Provider, Registry, or
  Resolver.
- Does **not** modify any Storage file.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** add any Public Runtime API field.
- Does **not** wire Desktop, a CLI, or any other caller into
  `bootstrapIdentity()` — Alpha 059's own designated Authority remains
  unimplemented, unaffected by this Stage.
- Implements **no** `resetIdentityBootstrap()`, no `Registry.clear()`,
  and no `shutdown()` of any kind — this Stage is a Decision record
  only, and its own Decision is that none of the three should exist.

## 9. Recommendation for future Stages

**No future Stage needs to add a Reset API.** Unlike Alpha 056 (which
named Alpha 057 as its own follow-up) and Alpha 059 (which named a
documentation annotation as its own minimal follow-up), this Stage's
own recommendation is "add nothing" — the capability Identity switching
needs (`new FedosRuntimeIdentity()`) already exists, is already public,
and is already exercised by every test in this arc. Should a genuinely
new requirement emerge later — for example, a Registry that grows
expensive enough to construct that per-switch reconstruction becomes
undesirable — that would be its own new Decision, backed by its own new
evidence, not a reason to revisit this one preemptively.

## 10. Summary

This Stage's own net effect on `src/` is ZERO — no file is modified.
It formally compares five candidate approaches to Bootstrap Reset
across fifteen mandated criteria (Desktop reconnect, logout, Identity
switching, Registry consistency, Idempotency, Fail Closed, Runtime
purity, Protocol independence, Storage impact, Worker, CLI,
testability, memory management, responsibility, and future Provider
fit), and adopts Option B (regenerate `FedosRuntimeIdentity`) together
with Option D (Bootstrap state permanently fixed per instance) —
rejecting an explicit `resetIdentityBootstrap()` (Option A) and
`Registry.clear()` (Option C) as producing internally inconsistent,
partially-reset state, and rejecting a general `shutdown()` (Option E)
as unscoped and unnecessary given ordinary garbage collection already
reclaims a discarded instance. `FedosRuntimeIdentity` is confirmed to
be, and is to remain, a short-lived object: Identity switching is
achieved by constructing a new instance, a pattern already available,
already public, and already used throughout this arc's own test suite
today, requiring no new code anywhere in this repository.

## 11. See also

- `docs/secure_runtime_alpha_056_identity_bootstrap_semantics_review.md`
- `docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md`
- `docs/secure_runtime_alpha_059_identity_bootstrap_authority_review.md`
- `docs/secure_runtime_alpha_060_identity_bootstrap_status.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
