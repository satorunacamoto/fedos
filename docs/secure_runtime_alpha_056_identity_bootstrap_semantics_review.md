# Secure Runtime Alpha 056 — Identity Bootstrap Semantics Review

**Status: this is a REVIEW / DESIGN DECISION document only. No
implementation file changes anywhere in this repository. It records a
decision that a future, separately-reviewed Stage (Alpha 057, per this
document's own §8 recommendation) may act on.**

## 1. Why now

Alpha 050–052 connected the Identity Layer to the Runtime:
`FedosRuntimeIdentity` is constructed once per `createRuntime()` call,
held entirely internally. Alpha 053–055 made it callable, and added
the ONE real behavioral change of that arc — `createRuntime()` now
fires `runtimeIdentity.describeIdentity()` once, unawaited, discarding
the result:

```ts
const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity();
void runtimeIdentity.describeIdentity().catch(() => {});
```

Today this is inert — the default Source is `NullNostrPublicIdentitySource`,
so `describeIdentity()` always resolves `null`. But it is a real,
unconditional async call sitting inside a function this repository has
otherwise always treated as pure and synchronous. This Stage reviews
whether that shape is the right one to carry forward BEFORE a real
Source implementation (config read, Profile Cache, Desktop account
state, remote source, Nostr profile fetch) makes it consequential.

## 2. Current implementation, recorded precisely

`src/runtime/create_runtime.ts`'s own `createRuntime()`:

```ts
export function createRuntime(
  env?: RuntimeEnv,
  overrides: RuntimeOverrides = {},
): AppRuntime {
  const runtimeIdentity: FedosRuntimeIdentity = new FedosRuntimeIdentity();
  void runtimeIdentity.describeIdentity().catch(() => {});

  return { /* ...thirty AppRuntime fields... */ };
}
```

Traced end to end: `describeIdentity()` calls
`FedosIdentityService.describeIdentity()`, which reads the injected
`FedosIdentityProvider` (today `NostrIdentityProvider`, via
`resolveFedosIdentityProvider()`), which reads its injected
`FedosNostrPublicIdentitySource` (today `NullNostrPublicIdentitySource`,
via `resolveNostrPublicIdentitySource()`), which always resolves
`null`. On a non-`null` Descriptor, `FedosIdentityService` would call
`this.#registry.register(record)` — so a future non-Null Source would
make this fire-and-forget call a REAL, timing-unconstrained write into
the `FedosRuntimeIdentity`'s own internal `FedosIdentityRegistry`,
racing against whatever the rest of `createRuntime()`'s own synchronous
body does next.

## 3. Existing codebase precedent — is Identity the exception?

This Stage surveyed every other async operation reachable from
`createRuntime()`/`AppRuntime` to check whether an auto-fired,
unawaited, result-discarding call at construction time is an
established pattern here, or new.

| Surface | Sync/async contract at `createRuntime()` time | Auto-invoked during construction? |
|---|---|---|
| `initializeCrypto` (`createRuntimeInitializeCryptoResult`) | Field is a plain function reference; itself synchronous, fixed `{ allowed: false, initialized: false, reason: "PrototypeDisabled" }` | **No** — only invoked when a caller of `AppRuntime` calls `runtime.initializeCrypto()` |
| `runtimeCapabilities` | Field is an async function reference (`Promise<RuntimeCapabilities>`) | **No** — only invoked when a caller calls `runtime.runtimeCapabilities()` |
| `randomBytes`/`generateAeadKey`/`encrypt`/`decrypt`/`exportCiphertext`/`importCiphertext` | All async function references | **No** — every one is caller-invoked, never called from inside `createRuntime()` |
| `storeCiphertext`/`loadCiphertext`/`deleteCiphertext` | All async function references | **No** — same as above |
| `selectStorageBackend()` (`NoopStorageBackend`/`PlaceholderStorageBackend`) | Constructor bodies are synchronous no-ops (`// Does nothing: no backend, network, or file handle is opened.`) | **No lifecycle call of any kind** — `getStatus()`/`put()`/`get()` are only ever caller-invoked |
| `selectMeshKVClient()` (`MeshKVBrowserClient`) | Constructor is synchronous; the file's own comment states "No lifecycle call — constructing the adapter opens no MeshKV connection" | **No** |
| `reachCryptoLoaderFacade()` → `createCryptoLoaderFacade()` | Both fully **synchronous**, pure, fixed-value — no `Promise` exists at any point in this chain | N/A — not async at all, so it cannot exhibit fire-and-forget timing risk in the first place |
| `runtimeIdentity.describeIdentity()` (Alpha 055) | Async function, called and immediately discarded | **Yes — the only one** |

`grep`-ing `create_runtime.ts` for `void `/`.catch(` confirms exactly
ONE fire-and-forget expression exists in the entire file: the Alpha 055
Identity Bootstrap call. Every other async Public Runtime API this
repository has ever shipped is exposed as a **lazy, caller-invoked
function reference** on `AppRuntime` — `createRuntime()` itself never
calls any of them.

Separately, `docs/runtime_explicit_crypto_initialization.md` (Stage
585) fixed SIX permanent rules for the Crypto Loader chain, and Rule #1
reads verbatim:

> **No auto-load at startup** — Runtime startup (`create_runtime.ts`)
> never triggers a WASM/JS glue load as a side effect of construction,
> today or in any future stage this document governs.

That rule was written for a structurally different subsystem (crypto
loading), but the principle it encodes — construction-time side effects
are exactly the class of behavior this Runtime has deliberately
refused to allow, precisely so that timing stays caller-visible and
auditable — applies to the Identity Bootstrap call unchanged. Alpha 055
is the first and only place `create_runtime.ts` violates that same
principle for a different subsystem.

`src/worker.ts`'s own `fetch()` handler calls `createRuntime(env)`
**on every incoming HTTP request** (line 1244), not once at cold start.
This means the Identity Bootstrap call fires, and a fresh
`FedosRuntimeIdentity` (with a fresh, empty `FedosIdentityRegistry`) is
constructed and immediately discarded, **once per request** in the
Cloudflare Worker deployment shape — directly realizing the "重複
Bootstrap" (duplicate Bootstrap) risk named in this Stage's own review
brief, today at zero cost (Null Source), but at REAL and repeated cost
the moment any Source performs config/cache/network I/O.

**Conclusion: Identity Bootstrap is the sole exception.** Every other
construction-time operation in this Runtime is either synchronous and
side-effect-free, or asynchronous but strictly caller-invoked. No other
subsystem starts unawaited async work during `createRuntime()`.

## 4. Option comparison

The five options under review, named exactly as this Stage's own brief
posed them:

- **Option A** — status quo: `createRuntime()` keeps auto-firing
  `describeIdentity()` fire-and-forget, exactly as Alpha 055 shipped it.
- **Option B** — remove the automatic Bootstrap entirely:
  `FedosRuntimeIdentity` is constructed and held, unread; any caller
  that needs identity retrieval invokes `describeIdentity()` itself.
- **Option C** — add an explicit internal `bootstrapIdentity(): Promise<void>`
  method, but do NOT call it automatically from `createRuntime()`.
- **Option D** — separate Runtime construction from Identity Bootstrap
  completion via a new `createRuntimeAsync()`-shaped explicit async
  contract.
- **Option E** — keep the automatic fire-and-forget call, but also hold
  an internal `pending`/`completed`/`failed` Bootstrap state, without
  exposing it on any Public API.

| Criterion | A: status quo (auto fire-and-forget) | B: remove auto-Bootstrap | C: internal `bootstrapIdentity()`, not auto-called | D: `createRuntimeAsync()` | E: auto-fire + internal pending/completed/failed state |
|---|---|---|---|---|---|
| `createRuntime()` sync contract | Preserved today, but the ONLY function on this call path with a live, in-flight `Promise` the caller cannot observe or await | Fully preserved — matches every other selector in this file | Fully preserved — `bootstrapIdentity()` exists but nothing calls it from `createRuntime()` | **Broken** — every existing caller (`src/worker.ts`, every test, every other file) would need to `await` a `Promise<AppRuntime>` instead of a plain object | Preserved, but now `createRuntime()` also mutates a new piece of internal state as a side effect of construction |
| Implicit side effects | A live async call + Registry write race is started as a hidden side effect of construction | None — `FedosRuntimeIdentity` is pure assembly, exactly as Alpha 050 first shipped it | None from `createRuntime()`'s own perspective — the new method exists but stays inert until called | None once `await`ed, but the migration itself is a Public API break | The state machine itself is a new implicit side effect, even though the network/read work is unchanged |
| Call-order determinism | **Non-deterministic** — the Bootstrap `Promise` may settle before, after, or interleaved with any of `createRuntime()`'s own synchronous work, and with any caller code that runs immediately after `createRuntime()` returns | Deterministic — no Bootstrap Promise exists to race anything | Deterministic until the caller explicitly opts in and awaits it | Deterministic — Runtime is fully assembled, Bootstrap included, before the `Promise` resolves | Non-deterministic in the same way as A; only the caller's ABILITY TO OBSERVE the non-determinism changes |
| Registry registration timing | Unspecified relative to `createRuntime()`'s own return | N/A — no automatic registration attempt exists | Caller-controlled — happens exactly when `bootstrapIdentity()` is awaited | Guaranteed complete before `createRuntime()`'s `Promise` resolves | Unspecified in the same way as A; a `state` field reports it AFTER the fact but does not change WHEN it happens |
| Duplicate Bootstrap risk | **Real today** — confirmed once per Worker request (§3) | None — nothing fires automatically to duplicate | None — only fires when a caller explicitly calls it, as many or as few times as that caller chooses | None — one Bootstrap per `createRuntimeAsync()` call, same call frequency as A but now awaited | Same duplication frequency as A; the state field does not prevent or reduce duplicate work |
| Risk once Source does network I/O | **High** — an unawaited network call would begin on every `createRuntime()`, once per Worker request | None — no automatic network call exists until a future Stage explicitly wires one | Low — network I/O only begins when a caller opts in | Contained — but now EVERY caller of `createRuntime()`, including ones that never use Identity, pays the latency and failure surface of that network call before getting a Runtime at all | Same high risk as A; observability of a failure does not reduce its cost or its call frequency |
| Risk once Source reads Storage | Same shape of risk as network I/O — an implicit per-construction Storage read | None | Low — caller-gated | Contained, but with the same universal-cost problem as above | Same risk as A |
| Testability | Every test touching `createRuntime()` must account for a floating, unobservable `Promise` (this Stage's own companion test file works around it with `setTimeout` flushes) | Simplest — `createRuntime()` has no async tail to account for at all | Simple for `createRuntime()`; `bootstrapIdentity()` gets its own direct, focused tests | Every test touching `createRuntime()` must now `await` it — a mechanical but repository-wide rewrite | Same floating-`Promise` problem as A, plus new state-transition tests |
| Fail Closed | The `.catch(() => {})` prevents an unhandled rejection, which IS a correct Fail-Closed instinct for a call nobody can observe | N/A — no call to fail | The caller decides how to handle a rejection — Fail Closed is the caller's own choice, made explicitly | A rejection can propagate through `createRuntimeAsync()`'s own `Promise`, giving the caller a real choice to catch or fail closed | Same swallow-everything shape as A, now merely LABELED as `"failed"` internally |
| Error observability | **None** — `.catch(() => {})` is a true black hole; even the internal reason for failure is unrecoverable | N/A | Full — whatever calls `bootstrapIdentity()` receives the real rejection | Full — the caller's own `await`/`try`/`catch` sees the real rejection | Partial — a `"failed"` state is recorded, but WHY is still not exposed anywhere, and nothing outside this class can read the state (no Public API is added by this Stage's own mandate) |
| Cancellation | Impossible — a fired-and-forgotten `Promise` cannot be cancelled or awaited by anything | N/A — nothing is started to cancel | Naturally cancellable in the ordinary sense that the caller simply never calls it, or races it against its own timeout | Naturally bounded — the caller's own `await` IS the only place cancellation semantics would ever need to be added | Same as A — no more cancellable than the status quo |
| Runtime shutdown | No shutdown hook exists anywhere in this Runtime today; an in-flight Bootstrap `Promise` simply outlives whatever called `createRuntime()` | Nothing outlives anything | Same as B, until a caller starts one | Nothing to outlive — Bootstrap completes before `createRuntimeAsync()` resolves | Same dangling-Promise shape as A |
| Worker fit | **Confirmed problematic** — fires per-request (§3), with no way for the Worker's own `fetch()` handler to await or observe it | Clean — matches every other Worker-called selector, all synchronous or caller-lazy | Clean — Worker simply never calls `bootstrapIdentity()` unless a future Stage decides it should | Would require rewriting `src/worker.ts`'s own `fetch()` handler and its own call to `createRuntime(env)` — explicitly prohibited by this Stage's own scope, and a large blast radius for an unrelated subsystem | Same per-request duplication as A, Worker still cannot observe or await it |
| Production fit | Same shape of risk as Worker fit — Production is exactly the environment where a real Source and real Registry writes would matter most | Clean | Clean, gated behind an explicit call | Contained, but at the cost of a repository-wide signature change | Same as A |
| Desktop application startup fit | A Desktop shell has no way to know when (or whether) the Bootstrap settled, or to retry it, since the `Promise` was never returned to it | Clean — a Desktop shell decides for itself when identity matters (e.g., only once a user opens a profile view) | Clean — same as B, but with a named, discoverable internal entry point ready for a Desktop-facing wrapper to call later | Desktop shell would `await createRuntimeAsync()` once at launch — workable, but couples ALL Desktop startup latency to Identity Bootstrap even on a screen that never shows identity | Clean call-timing, same observability gap as A |
| Protocol independence | Unaffected by any Option — `FedosRuntimeIdentity`'s own Provider/Source abstraction already keeps this Runtime-layer decision protocol-neutral | Unaffected | Unaffected | Unaffected | Unaffected |

## 5. Answers to the eight review questions

1. **Should `createRuntime()` be a pure assembly function?** Yes — every
   other line of its own body already is (thirty `select*()` calls, all
   synchronous, all side-effect-free at construction time). The
   Identity Bootstrap call is the one exception to a rule this file has
   otherwise followed without deviation since Stage 21.

2. **Is it acceptable to start a fire-and-forget `Promise` during
   Runtime construction?** Not as a durable design commitment. It was
   acceptable as a narrowly-scoped Alpha 055 smoke test (proving the
   Identity Layer is reachable, nothing more — see
   `docs/secure_runtime_alpha_053_055_identity_runtime_internal_operations.md`
   §7/§8), but this Stage's own survey (§3) found no other subsystem in
   this Runtime that keeps that shape permanently, and one explicit
   prior design decision (`docs/runtime_explicit_crypto_initialization.md`
   Rule #1) that rules it out for a sibling subsystem for exactly this
   reason.

3. **Does `.catch(() => {})` confuse Fail Closed with missing
   Observability?** Yes. Fail Closed means a caller who CAN observe an
   outcome chooses the safe branch when it fails; `.catch(() => {})`
   here means NO ONE can observe the outcome at all — there is no
   caller in a position to choose anything, safe or not. Calling that
   "Fail Closed" overstates what is actually a total observability
   void. The instinct to prevent an unhandled rejection from crashing
   `createRuntime()` is correct; conflating that instinct with a
   security property is not.

4. **Does auto-executing `describeIdentity()` have value if nothing
   uses the result?** No independent value has been identified beyond
   what Alpha 055's own doc already claimed: a one-time reachability
   smoke test. That value was real but narrow, and does not by itself
   justify keeping the call wired into every future `createRuntime()`
   call, especially once each such call has a real cost (§3's Worker
   per-request finding).

5. **Does async Registry registration create a timing dependency for
   `findIdentity()`/`listIdentities()`?** Yes, structurally — nothing
   in `FedosRuntimeIdentity` or `create_runtime.ts` sequences the
   Bootstrap's own eventual `registry.register()` call (reached only on
   a non-`null` Descriptor) relative to any later `findIdentity()`/
   `listIdentities()` call a future caller might make against the SAME
   instance. Today this is unobservable (Null Source never registers
   anything), but it is a real, currently-latent race condition in the
   design, not merely a hypothetical one.

6. **Can this same design survive once Source stops being Null?** No,
   not without new risk — §3's "risk once Source does network I/O"/
   "risk once Source reads Storage" rows apply directly, and the
   Worker's per-request `createRuntime()` call (§3) turns "occasional
   background work" into "guaranteed per-request background work,"
   which is a materially different cost profile than what Alpha 055
   reviewed.

7. **Does this fit the "no Relay/Network connection at Runtime
   startup" policy?** Not durably. `NostrIdentityProvider`'s own
   Source today is `NullNostrPublicIdentitySource`, so no network call
   happens yet — but the whole POINT of the Provider/Source
   abstraction (Alpha 032/048/049) is that a future Source can be
   swapped in without touching the Provider. An auto-fired call at
   `createRuntime()` time would silently turn "Runtime startup opens no
   network connection" into "Runtime startup opens no network
   connection, UNLESS a Source happens to need one" the moment that
   swap happens — a policy erosion this Runtime's own design history
   (§3, Crypto Loader Rule #1) has consistently refused to accept
   elsewhere.

8. **Should the Desktop application control Identity retrieval
   timing?** Yes — a Desktop shell (or any other caller of
   `createRuntime()`) is the only party positioned to know WHEN
   identity information is actually needed (e.g., only when a profile
   view opens), and is the only party that can meaningfully react to a
   failure. An auto-fired call inside `createRuntime()` removes that
   control without offering anything the caller could not get more
   cheaply by calling `describeIdentity()` itself, on its own schedule.

## 6. Decision

**Option B is adopted: `createRuntime()` should construct
`FedosRuntimeIdentity` and do nothing further with it.** Identity
retrieval moves to a future, explicit API or Bootstrap boundary,
reviewed and scoped in its own separate Stage.

This matches this Stage's own first-candidate framing, and is backed
by concrete evidence rather than restating that framing: §3's file-wide
survey found the auto-fired call to be the ONLY fire-and-forget
expression among thirty-plus construction-time operations in
`create_runtime.ts`; §3 additionally found a directly-analogous prior
design decision (`docs/runtime_explicit_crypto_initialization.md` Rule
#1, "no auto-load at startup") that already rejected this exact shape
for a sibling subsystem; and §3 confirmed the Worker's own `fetch()`
handler calls `createRuntime(env)` once per request, turning the
"harmless smoke test" framing of Alpha 055 into "guaranteed, repeated,
unobservable background work" the moment a real Source exists.

Options C/D/E were not adopted for this Stage: C is a reasonable
longer-term shape (see §8) but is itself an implementation change this
Stage's own mandate prohibits; D would break `createRuntime()`'s
synchronous Public contract for every existing caller across this
repository, a far larger and riskier change than the problem being
solved requires; E preserves every downside identified in §4/§5 while
adding a new, equally out-of-scope implementation surface (internal
state) that still cannot be observed by any caller under this Stage's
own "no Public API addition" constraint.

## 7. What this Stage does NOT do

- Does **not** modify `src/runtime/create_runtime.ts`.
- Does **not** modify `src/runtime/fedos_runtime_identity.ts`.
- Does **not** modify any `src/identity/*` file (Source, Provider,
  Service, Registry, or Resolver).
- Does **not** modify `AppRuntime` (`types.ts`) or add any Public
  Runtime API.
- Does **not** modify `src/worker.ts`.
- Does **not** modify `packages/fedos-core-rust`, `Cargo.toml`, or
  `package.json`.
- Does **not** open any Network or Relay connection, and does not add
  any Authentication or Storage behavior.
- Implements **no** Bootstrap state model, no `bootstrapIdentity()`
  method, and no `createRuntimeAsync()` — those are, at most, what a
  FUTURE Stage may implement, per §8's own recommendation.

## 8. Alpha 057 recommendation — ONE minimal change only

**Remove the fire-and-forget `void runtimeIdentity.describeIdentity().catch(() => {});`
statement from `createRuntime()`, restoring the Alpha 051 shape:
`FedosRuntimeIdentity` is constructed and held, unread, exactly as it
was before Alpha 055 — i.e., implement Option B, and nothing else.**

This is deliberately the smallest change that fully resolves this
Stage's own Decision: it deletes one line and touches no other file,
requires no new type, no new method, and no new Public API. It leaves
`FedosRuntimeIdentity`'s own three methods (`describeIdentity()`/
`findIdentity()`/`listIdentities()`, Alpha 053/054) fully intact and
callable — only the AUTOMATIC call from `createRuntime()` is removed.
A future, separately-scoped Stage remains free to introduce Option C's
explicit `bootstrapIdentity()`-style boundary, if and when a real
caller (Worker route, Desktop shell, or a future Public Runtime API)
actually needs one — that decision is intentionally deferred, not
foreclosed, by recommending B now rather than C.

## 9. See also

- `docs/secure_runtime_alpha_050_052_identity_runtime_integration_arc.md`
- `docs/secure_runtime_alpha_053_055_identity_runtime_internal_operations.md`
- `docs/runtime_explicit_crypto_initialization.md`
- `docs/runtime_dynamic_loader_dev_approval.md`
- `docs/runtime_crypto_loader_facade.md`
