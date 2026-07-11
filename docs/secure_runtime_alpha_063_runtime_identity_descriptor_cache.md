# Secure Runtime Alpha 063 — Runtime Identity Descriptor Cache

## 1. Why now

Alpha 058–062 built a complete Bootstrap boundary — `bootstrapIdentity()`
(058), `isBootstrapped()` (060), idempotency (061), and a settled
"short-lived object, no reset API" lifecycle policy (062) — but every
one of those Stages deliberately DISCARDED the Descriptor
`describeIdentity()` resolved. A caller can learn THAT Bootstrap
succeeded (`isBootstrapped()`), but not WHAT it resolved, without
calling `describeIdentity()` a second time — a real Provider read
`bootstrapIdentity()` itself already paid for and threw away. This
Stage closes that gap with the smallest possible addition: hold the
LAST resolved Descriptor, and expose it synchronously.

## 2. Current state, recorded precisely

```
FedosRuntimeIdentity (src/runtime/fedos_runtime_identity.ts), before this Stage
  #registry: FedosIdentityRegistry     — set once, in the constructor
  #service:  FedosIdentityService      — set once, in the constructor
  #resolver: FedosIdentityResolver     — set once, in the constructor
  #bootstrapped: boolean = false       — flips to true, ONCE, on first
                                          successful bootstrapIdentity()

  bootstrapIdentity(): Promise<void>
    if (this.#bootstrapped) { return; }
    await this.#service.describeIdentity();   // <-- return value discarded
    this.#bootstrapped = true;

  isBootstrapped(): boolean               — reads #bootstrapped
  describeIdentity()/findIdentity()/listIdentities(): pure pass-throughs
```

Confirmed via a fresh repository search performed for this Stage:

- `bootstrapIdentity()`'s own `await this.#service.describeIdentity();`
  line does not assign its result to anything — the resolved Descriptor
  (or `null`) is computed and immediately discarded, every single time.
- No field named `descriptor`, `identity`, `current`, or `cache` exists
  anywhere in `fedos_runtime_identity.ts` prior to this Stage.
- `FedosIdentityDescriptor` (`src/identity/fedos_identity_descriptor.ts`,
  Alpha 028/045) is a plain interface with FIVE `readonly` fields
  (`id`/`provider`/`publicIdentifier`/`displayName?`/`avatar?`) — no
  method, no mutation path of any kind. A reference to one is
  inherently safe to hand out without cloning.
- `FedosIdentityService.describeIdentity()` (`src/identity/fedos_identity_service.ts`,
  Alpha 031/042/047) returns `Promise<FedosIdentityDescriptor | null>` —
  the EXACT type this Stage's own new field needs, with no adaptation.
- No caller anywhere in this repository invokes `bootstrapIdentity()`
  today (Alpha 059 §2, reconfirmed unchanged) — this Stage's own new
  cache is, like `isBootstrapped()` before it, reachable only by
  directly constructing a `FedosRuntimeIdentity`.

## 3. The five candidate options

- **Option A** — cache the last-resolved Descriptor in a private field,
  written only inside `bootstrapIdentity()`'s own successful path,
  read synchronously via a new `currentIdentity()` method.
- **Option B** — no cache: `currentIdentity()` (or an equivalent) calls
  `this.#service.describeIdentity()` fresh, every time it is invoked.
- **Option C** — read through the Registry: `currentIdentity()` calls
  `this.#registry.find(someId)` or `this.#registry.list()[0]`.
- **Option D** — read through the Resolver: `currentIdentity()` calls
  `this.#resolver.findIdentity(someId)` or `this.#resolver.listIdentities()[0]`.
- **Option E** — hold the in-flight `Promise<FedosIdentityDescriptor | null>`
  itself (from `bootstrapIdentity()`'s own call), and have
  `currentIdentity()` return or await that `Promise`.

## 4. Comparison

| Criterion | A: cache field | B: re-query Service every call | C: via Registry | D: via Resolver | E: hold the Promise |
|---|---|---|---|---|---|
| 同期契約 (Sync contract) | `currentIdentity()` is trivially synchronous — a field read, nothing more | Would force `currentIdentity()` to be `async`, returning `Promise<FedosIdentityDescriptor \| null>` — a materially different, harder-to-use contract than the task's own mandated `FedosIdentityDescriptor \| null` return type | Synchronous (`registry.find()`/`list()` are both sync) — but see Data shape row below | Synchronous, same as C | **Broken** — a `Promise` is not the mandated `FedosIdentityDescriptor \| null` return shape at all; `currentIdentity()` would need to be `async` or return a `Promise`, violating the task's own explicit synchronous requirement |
| throw禁止 (never throws) | Trivially true — reading a private field can never throw | **Violated in spirit** — re-calling `describeIdentity()` re-invokes the Provider chain, which CAN reject (the exact failure mode `bootstrapIdentity()` itself already has to handle); a synchronous wrapper would need to swallow or defer that rejection, contradicting "never throws" while still doing real work | True today (`find()`/`list()` never throw) but only accidentally — this Option doesn't own the guarantee, the Registry's own implementation does | Same accidental truth as C | The `Promise` itself can REJECT — awaiting it is exactly the same rejection-surfacing shape `bootstrapIdentity()` has, incompatible with a caller expecting a value, not a rejection, from a status read |
| clone禁止 (no clone) | Returns the held reference directly — the task's own explicit requirement, satisfied by construction (nothing here ever copies) | N/A — a fresh Service call returns a brand-new object each time, not a "clone" of anything cached, but also never the SAME reference twice, which is its own form of inconsistency | `registry.find()`/`list()` return the exact `FedosIdentityRecord` object stored in the `Map` — but a `FedosIdentityRecord`, NOT a `FedosIdentityDescriptor` (see Data shape row) | Same reference-return behavior as C, same type mismatch | Awaiting the SAME `Promise` twice yields the SAME resolved object (JS `Promise` semantics) — technically clone-free, but only for the ONE Descriptor captured at Bootstrap time, same value A caches, reached through a strictly worse contract |
| Data shape (Descriptor vs Record) | Exactly right — `#descriptor` is typed `FedosIdentityDescriptor \| null`, matching the mandated return type of `currentIdentity()` verbatim | Exactly right — `describeIdentity()` returns a `FedosIdentityDescriptor \| null` | **Wrong type** — `FedosIdentityRegistry`/`FedosIdentityResolver` traffic ONLY in `FedosIdentityRecord` (Alpha 040/041/043), a five-field type `FedosIdentityService` maps a Descriptor ONTO (Alpha 047) but which is not itself a Descriptor; returning a Record from a method typed `FedosIdentityDescriptor \| null` is a type error, not merely a style mismatch | Same wrong-type problem as C — `FedosIdentityResolver`'s own two methods (Alpha 043) return `FedosIdentityRecord \| null`/`readonly FedosIdentityRecord[]`, never a Descriptor | Exactly right — the `Promise` this Option holds is `bootstrapIdentity()`'s own internal `describeIdentity()` call, typed `Promise<FedosIdentityDescriptor \| null>` |
| 何かを要求するID (Requires an id to look up) | No — Bootstrap tracks exactly ONE identity per instance; no lookup key of any kind is needed | No | **Yes** — `registry.find(id)` needs an `id` `currentIdentity()`'s own zero-argument signature does not have; `registry.list()[0]` would work but silently assumes list order and "first" mean "the Bootstrap one," an assumption nothing in `FedosIdentityRegistry`'s own contract guarantees | Same problem as C, one layer up — `FedosIdentityResolver` was built for keyed lookup (Alpha 043 §"why Resolver"), not "the one current identity" | No |
| Idempotency (Alpha 061 interaction) | **Fully compatible** — `#descriptor` is written in the SAME guarded branch `#bootstrapped` already is; a repeat `bootstrapIdentity()` call after success hits the guard and returns before either field is touched, so `currentIdentity()`'s own value is stable across repeat calls, exactly like `isBootstrapped()` | Defeats the PURPOSE of a cache read alongside Alpha 061's guard — every `currentIdentity()` call would re-run Provider/Registry work regardless of how many times `bootstrapIdentity()` itself was (idempotently) called, reintroducing per-call cost Alpha 061 was built to eliminate for `bootstrapIdentity()` itself | N/A to Alpha 061's own guard directly, but inherits the wrong-type problem above regardless | Same as C | The captured `Promise` is created ONCE per successful Bootstrap (inside the guard), so re-awaiting it is idempotent in the same sense as A — but the type mismatch (Sync contract row) makes this moot |
| Fail Closed | `#descriptor` starts `null`; a rejected `describeIdentity()` call leaves it `null` (never-attempted) or whatever it already was (a later attempt after an earlier success can't happen — Alpha 061's guard prevents a second real attempt once `#bootstrapped` is `true`); `currentIdentity()` reporting `null` when nothing succeeded yet is the exact Fail-Closed shape `isBootstrapped()` already established | A rejected re-query would need to be caught SOMEWHERE to keep `currentIdentity()` "never throws," and the natural place (inside `currentIdentity()` itself) means synthesizing a `null` for a DIFFERENT reason than "no identity" — conflating "never asked" with "asked and it broke," the same confusion Alpha 056 §5 Q3 already named as a mistake for a different call | Registry lookups don't fail today, but this Option answers a question ("what's in the Registry for this id") different from the one asked ("what did the last Bootstrap resolve") | Same as C | Awaiting a rejected `Promise` throws — the opposite of "never throws," requiring EITHER a `.catch()` that masks the real failure or exposing throw behavior the mandate explicitly forbids |
| Runtime純粋性 (Runtime purity) | `currentIdentity()` is a pure, synchronous field read — no I/O, no Provider/Registry/Resolver touch of any kind, matching `isBootstrapped()`'s own already-established shape exactly | Reintroduces a Provider round-trip inside what is supposed to be a cheap status read — the same "hidden async cost behind a status check" shape Alpha 056 rejected for `createRuntime()` itself | Adds a Registry dependency to a method the task's own spec never asked to touch the Registry | Adds a Resolver dependency, same objection as C | Adds a dangling, potentially-rejected `Promise` as permanent instance state — a shape this Runtime has consistently avoided since Alpha 056/057 |
| Protocol非依存 (Protocol independence) | Unaffected — `#descriptor`'s own type (`FedosIdentityDescriptor`) is already protocol-neutral (Alpha 028) | Unaffected | Unaffected | Unaffected | Unaffected |
| Storage影響 (Storage impact) | None — an in-memory field, no different from `#bootstrapped` | None | None | None | None |
| Registry影響 (Registry impact) | **Zero** — Option A never calls a NEW Registry method; `#service`'s own EXISTING `describeIdentity()` call (unchanged since Alpha 058) is the only Registry writer, exactly as before this Stage | Zero new Registry calls, but re-running `describeIdentity()` re-runs the EXISTING `registry.register()` call too, on every `currentIdentity()` invocation — silent, repeated, redundant writes into a Registry Alpha 061 specifically stopped from happening after the first success | Adds a NEW read dependency (`find()`/`list()`) this method did not have before | Adds a NEW read dependency via the Resolver, one layer removed from C but the same new coupling | Zero new Registry calls beyond the original one captured inside the `Promise` |
| Worker | Per-request `createRuntime()` (unchanged) discards each `FedosRuntimeIdentity` — including its cache — at the end of every request, exactly as it already discards `#bootstrapped`; no NEW Worker-specific risk from caching one extra field | Same per-request discard, but ALSO reintroduces the Alpha 056-class risk of extra Provider/Registry work per call, now possibly multiple times per request if `currentIdentity()` were called more than once | Same discard shape, plus the type-mismatch problem | Same discard shape, plus the type-mismatch problem | Same discard shape, plus the broken-sync-contract problem |
| テスト容易性 (Testability) | Simple — construct, bootstrap, read; a `vi.spyOn` on `FedosIdentityService.prototype.describeIdentity` can assert it's called exactly once even across many `currentIdentity()` reads, mirroring Alpha 061's own established test pattern | Every `currentIdentity()` test would need its own Provider/Registry mock setup, and call-count assertions become "N `currentIdentity()` calls = N Provider calls," the opposite of what a cache is for | Needs Registry-shape (Record, not Descriptor) test fixtures, and its own `id`-selection tests | Same as C | Needs `Promise` rejection/resolution timing tests on top of everything else, the most test surface of all five Options |
| 責務 (Responsibility) | Keeps this class as the single owner of "what identity did MY OWN Bootstrap resolve" — a question specific to one `FedosRuntimeIdentity` instance, matching Alpha 062's own "short-lived object" framing directly | Makes every read re-delegate to the Service, diffusing "what is current" across however many times a caller happens to ask, rather than fixing it at the moment Bootstrap succeeded | Splits responsibility across `FedosRuntimeIdentity` (Bootstrap status) and `FedosIdentityRegistry` (stored Records) for what is conceptually ONE fact (my current identity) | Same split as C, via the Resolver instead | Makes the method's own contract depend on `Promise` internals a caller has no reason to know about, for a question ("what is my identity now") that has nothing to do with concurrency |
| 将来Provider (Future Provider) | Scales cleanly — a future real Nostr/network Provider's own Descriptor is cached exactly once per Bootstrap, at the SAME cost profile Alpha 061 already established for `bootstrapIdentity()` itself | Scales badly — every `currentIdentity()` call becomes a real network/Storage read once a real Provider exists, the exact per-call cost explosion Alpha 061 was built to prevent for `bootstrapIdentity()`, now reintroduced one method over | Unaffected by Provider changes directly, but inherits the type mismatch regardless of Provider shape | Same as C | Scales exactly as well as A for a SINGLE await, but the broken sync contract makes this moot for any future Provider too |

## 5. Fail Closed — the null transition table

| State | `currentIdentity()` returns |
|---|---|
| Never bootstrapped (fresh instance) | `null` — `#descriptor` starts `null`, unreached by anything until a successful `bootstrapIdentity()` |
| `bootstrapIdentity()` succeeded, `describeIdentity()` resolved `null` (today's default — Null Source) | `null` — `#descriptor` is assigned exactly what `describeIdentity()` returned, which was itself `null` |
| `bootstrapIdentity()` is CURRENTLY in flight (its own `await` has not yet resolved) | `null` (or whatever the LAST successful value was, if this is a same-instance repeat attempt after an earlier failure) — the assignment has not executed yet, so `#descriptor` is unchanged from before this call started |
| `bootstrapIdentity()` REJECTED (Provider threw) | `null` if this was the first-ever attempt (the field was never anything but `null`); UNCHANGED (whatever it already held) if this instance had a prior SUCCESSFUL Bootstrap — but that combination cannot actually occur, since Alpha 061's own guard makes a second real attempt unreachable once `#bootstrapped` is `true` |
| `bootstrapIdentity()` succeeded, `describeIdentity()` resolved a REAL Descriptor | That exact Descriptor object — the held reference, unmodified |

The exact code shape producing this table: `this.#descriptor = await
this.#service.describeIdentity();` sits strictly AFTER the Alpha 061
guard and strictly BEFORE `this.#bootstrapped = true;`. A throw from
`describeIdentity()` prevents this line from completing, so the
assignment simply never happens — `#descriptor` is Fail-Closed by the
same "the line that would change it never ran" mechanism Alpha 060 §"Fail
Closed" already established for `#bootstrapped`, not by any `try`/`catch`
this Stage adds.

## 6. Decision

**Option A (cache the last-resolved Descriptor in a private field) is
adopted.** Options C and D are rejected on a concrete type-level
defect, not merely a style preference: `FedosIdentityRegistry`/
`FedosIdentityResolver` traffic exclusively in `FedosIdentityRecord`
(Alpha 040/041/043), a DIFFERENT type from `FedosIdentityDescriptor`
this Stage's own mandated `currentIdentity(): FedosIdentityDescriptor | null`
signature requires — routing through either would need an id parameter
`currentIdentity()`'s own zero-argument mandate does not have, AND
would return the wrong type regardless. Option B is rejected because it
defeats Alpha 061's own idempotency guarantee one level up: it would
make every `currentIdentity()` call pay the full Provider/Registry cost
`bootstrapIdentity()`'s own guard was built specifically to avoid on
repeat calls, and cannot satisfy "never throws" without either
swallowing a real Provider rejection or exposing one — both explicitly
disallowed. Option E is rejected because a bare `Promise` is not the
mandated synchronous `FedosIdentityDescriptor | null` return shape at
all — it would force `currentIdentity()` to be `async` or leak
rejection behavior, violating the task's own explicit "throw禁止"
requirement more directly than any other Option.

## 7. Confirmation checklist

- **`isBootstrapped()` unchanged** — byte-for-byte identical to Alpha
  060: `return this.#bootstrapped;`, no new read, no new dependency.
- **`bootstrapIdentity()` stays idempotent** — the Alpha 061 guard
  (`if (this.#bootstrapped) { return; }`) is untouched and remains the
  method's own first statement; `#descriptor` is written in the SAME
  guarded branch as `#bootstrapped`, so a repeat call after success
  never re-touches either field.
- **`findIdentity()`/`listIdentities()` unchanged** — byte-for-byte
  identical pass-throughs to `#resolver`, no new dependency on
  `#descriptor` in either direction.
- **Registry unchanged** — `FedosIdentityRegistry` (`register`/`find`/
  `list`/`remove`) receives no new caller and no new method.
- **Provider unchanged** — no new `FedosIdentityProvider`
  implementation, no new call site beyond the existing
  `this.#service.describeIdentity()` this Stage merely captures the
  return value of.
- **Storage unchanged** — no Storage file touched; `#descriptor` is
  in-memory only, identical in kind to `#bootstrapped`.
- **`create_runtime.ts` unchanged** — still Construct Only, calling
  none of `FedosRuntimeIdentity`'s now-six methods.
- **`AppRuntime` unchanged** — no `identity`/`currentIdentity`/
  `descriptor` field added to `types.ts`.
- **Worker unchanged** — `src/worker.ts` contains no reference to
  `currentIdentity`, `FedosRuntimeIdentity`, or
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
  `bootstrapIdentity()`/`currentIdentity()` — Alpha 059's own
  designated Authority remains unimplemented, unaffected by this
  Stage.
- Does **not** clone, freeze, or otherwise transform the cached
  Descriptor — `currentIdentity()` returns the held reference exactly
  as `describeIdentity()` produced it.

## 9. Summary

This Stage adds a private `#descriptor: FedosIdentityDescriptor | null`
field (initial `null`) and a sixth method, `currentIdentity(): FedosIdentityDescriptor | null`,
to `FedosRuntimeIdentity` — the ONLY `src/` file this Stage modifies.
`bootstrapIdentity()`'s own pre-existing `describeIdentity()` call now
captures its return value into `#descriptor` instead of discarding it;
every other statement, and every other method, is byte-for-byte
unchanged. Formally compares five approaches (cache, re-query, Registry
lookup, Resolver lookup, holding the raw `Promise`) across fifteen
mandated criteria, and adopts caching (Option A) as the only Option
that is simultaneously synchronous, never-throwing, clone-free, and
type-correct against the mandated `FedosIdentityDescriptor | null`
signature. `currentIdentity()` is Fail-Closed by the same mechanism
`isBootstrapped()` already established: a rejected or not-yet-attempted
Bootstrap leaves `#descriptor` at `null`, with no `try`/`catch` of its
own required to produce that outcome.

## 10. See also

- `docs/secure_runtime_alpha_058_identity_bootstrap_boundary.md`
- `docs/secure_runtime_alpha_060_identity_bootstrap_status.md`
- `docs/secure_runtime_alpha_061_identity_bootstrap_idempotency.md`
- `docs/secure_runtime_alpha_062_identity_bootstrap_reset_review.md`
