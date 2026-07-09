# FedOS Public Runtime Completion Surface Review (Prototype EXECUTION Phase 014)

**Status: REVIEW ONLY. No code change of any kind — `src/runtime/`,
`src/worker.ts`, `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`,
and `package.json` are all byte-for-byte unchanged. This document
reviews what Prototype EXECUTION Phase 013 (Stage 994) established and
recommends how — or whether — the public `AppRuntime.initializeCrypto()`
surface should change to reflect it.**

## 1. Termination condition — current achievement

This arc's own stated Prototype termination condition:

> "Runtime reaches the Rust minimal API, and its return value reaches
> back to Runtime."

Read literally — a piece of code living in `src/runtime/` reaches
Rust's minimal (`version()`) API and receives its return value back —
**this condition is satisfied as of Stage 994 (Prototype EXECUTION
Phase 013)**:

- `attemptDevOnlyRuntimeRustIntegration()` (`fedos_runtime_prototype_execution.ts`)
  is Runtime-layer code.
- It drives the real chain — `planLoad()` → `attemptDevOnlyJsGlueImport()`
  → `attemptDevOnlyWasmInitialization()` → `attemptDevOnlyRustVersionCall()`
  — and receives `"fedos-core-rust/0.0.0"` back as its own return
  value.
- Verified against a real, freshly-built artifact (not a mock) during
  Phase 013's own implementation: `{ reachedRust: true, rustVersion:
  "fedos-core-rust/0.0.0" }`.
- Fail Closed held throughout — every one of the six upstream gate
  conditions (Generated Artifact Check, Development Runtime, Import
  Ready, JS Glue Import, JS Glue Module retention, WASM Initialization)
  still governs the chain; outside Development Runtime the same call
  resolves `{ reachedRust: false, rustVersion: null }`.

**Not satisfied, and not required by the literal wording above**: the
public `AppRuntime.initializeCrypto()` surface does not expose
`rustVersion` anywhere. Whether that is REQUIRED for "termination" is
exactly this Phase's own question — see §3 and §5.

## 2. Internal Runtime → Rust → Runtime loop — established?

**Yes.** The full loop is real, not planned or simulated:

```
Runtime (attemptDevOnlyRuntimeRustIntegration, fedos_runtime_prototype_execution.ts)
  -> FedosWasmLoader.planLoad()                         (sync, Stage 489/793)
  -> FedosWasmLoader.attemptDevOnlyJsGlueImport()        (real import(), Stage 945)
  -> FedosWasmLoader.attemptDevOnlyWasmInitialization()  (real initSync/default, Stage 969)
  -> FedosWasmLoader.attemptDevOnlyRustVersionCall()     (real module.version(), Stage 993)
  -> Rust #[wasm_bindgen] pub fn version() -> String     (Stage 986)
  -> back to Runtime as RuntimePrototypeExecutionState   (Stage 994)
```

Every arrow above is a REAL function call verified to execute (not a
discarded/`planLoad()`-style stub) at least once, against a real
`wasm-bindgen`-generated artifact, with the return value genuinely
propagating all the way back up to `src/runtime/`. This is the
substantive engineering achievement Phase 013 delivered; this review
does not need to re-verify it (Phase 013's own verification — real
`cargo build`/`npm run build:wasm`, a real end-to-end call, and 3828
passing tests — already did).

## 3. Should the public `initializeCrypto()` be part of the termination condition?

**Recommendation: No — not as a REQUIREMENT for calling the Prototype
"terminated."** Reasoning:

- The condition's own wording says "Runtime," not "the public Runtime
  API." `attemptDevOnlyRuntimeRustIntegration()` genuinely IS Runtime
  code; nothing in the original wording singles out
  `initializeCrypto()` specifically.
- Every phase since Stage 004 (Phase 004's own AskUserQuestion-confirmed
  design) has treated "a capability becomes reachable" and "a
  capability becomes safe to expose through the public contract" as
  TWO separate, separately-reviewed decisions — never one. Concrete
  precedents: retaining the JS glue module (Phase 006) came before
  initializing WASM with it (Phase 007); adding `version()` in Rust
  (Phase 010) came before calling it (Phase 012); reaching Rust from
  Runtime (Phase 013) is now separate from exposing that reach
  publicly (this Phase's own question). Requiring public exposure as
  part of "termination" would be the FIRST time this arc collapsed
  that two-step discipline into one, without its own dedicated review.
- `initializeCrypto()`'s return shape has been treated as a FIXED,
  test-pinned constant across all thirteen prior Phases specifically
  BECAUSE changing it has never been reviewed as safe. Making its
  exposure a hard requirement for "termination" would force that
  review to happen implicitly, under time pressure, rather than
  explicitly, on its own merits (see §4/§5).

Conclusion: the ORIGINAL termination condition is satisfied without
touching `initializeCrypto()`. Whether to ALSO expose `rustVersion`
publicly is a legitimate, valuable NEXT decision — but it is
additional scope, not a blocking requirement.

## 4. Options for exposing `version()` without breaking Fail Closed

| # | Option | Fail-Closed impact | Contract impact | Fit with this codebase's conventions |
|---|--------|--------------------|-------------------|----------------------------------------|
| A | Add a field to `initializeCrypto()`'s own return value | Directly threatens it — `allowed`/`initialized` could be misread as "crypto is ready" by any caller that doesn't read the field names carefully | BREAKS the pinned `{ allowed, initialized, reason }` shape every prior Phase (and every existing snapshot test) has treated as immutable; also forces `initializeCrypto()` to become async or to cache a side effect, both explicitly forbidden so far | Poor — reverses this arc's own repeated, explicit "return contract must not be broken" instruction |
| B | `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` only | None — diagnostics have always been documented as DISPLAY-only, never read by any `if` condition anywhere | No existing contract broken; but a LIVE string requires either making the (currently synchronous) diagnostics reader async, or caching a value from a prior async call as hidden state — the latter is a real, if small, purity violation | Good fit for a CAPABILITY FLAG (e.g. `rustVersionCallAvailable: boolean`, computed the same fixed-label way every other diagnostics field already is); poor fit for the LIVE string itself without further design work |
| C | New, separate, explicitly-named, ASYNC public function (NOT merged into `AppRuntime`) | None — a caller must opt in explicitly; nothing about `initializeCrypto()`'s own behavior changes | No existing contract touched — this is additive only | Best fit — `attemptDevOnlyRuntimeRustIntegration()` (Stage 994) IS already exactly this. The open question is only whether/how it should be additionally exposed via `AppRuntime`'s own assembled object |
| D | New `AppRuntime` field/service (e.g. `runtime.prototypeExecutionState`) | Low, if implemented as a lazily-invoked method, not eagerly-resolved data | No existing field touched, but `createRuntime()` is documented as a PURE, side-effect-free assembly (no socket, no fetch) — attaching a live async probe as "state" either requires eager evaluation (a real side effect during construction) or reduces to option C with extra plumbing | Fair — functionally redundant with C once C exists; also explicitly named "Runtime Service追加" in Phase 013's own prohibitions, so any move in this direction needs its own dedicated review |
| E | Do not expose publicly (status quo) | None — zero new surface | None | Matches this arc's own demonstrated bias: every "reachable but not obviously safe to expose further" moment so far has been left alone until a dedicated, later Phase explicitly reviewed it |

## 5. Recommendation

**Adopt Option C as already-sufficient, and explicitly defer Options B
(capability-flag diagnostics) and D (AppRuntime wiring) to a future,
separate, explicitly-reviewed Phase — reject Option A outright.**

Reasoning, in order of weight:

1. Option C already exists (`attemptDevOnlyRuntimeRustIntegration()`,
   Stage 994) and already satisfies the literal termination condition
   (§1/§2). No further code change is required to call the Prototype's
   original goal achieved.
2. Option A is rejected because it is the only option that requires
   breaking an existing, repeatedly-reaffirmed contract — every other
   option is strictly additive.
3. Option E (do nothing further) is a perfectly valid, zero-risk
   stopping point if no further public visibility is ever needed —
   this review does not force a choice between C/E, since C already
   exists whether or not anything further is built on it.
4. Options B and D are both reasonable FUTURE directions if a real
   caller (not just tests) ever needs to observe `rustVersion` — but
   each has its own open design question (async-vs-sync diagnostics;
   eager-vs-lazy `AppRuntime` state) that deserves its own dedicated
   review, exactly like every prior public-surface decision in this
   arc received.

**Practical framing**: declare the Prototype's original scoped goal —
"Runtime reaches Rust's minimal API, and its return value reaches back
to Runtime" — **achieved as of Stage 994**, without further code
change. Treat "expose `rustVersion` through a public, non-test-only
surface" as a SEPARATE, OPTIONAL, future workstream, not a completion
requirement.

## 6. Impact on Production and Worker

**None, confirmed by construction, not merely by inspection**:

- `create_runtime.ts` was NOT modified by Phase 013 and is not
  modified by this Phase — `createRuntime()`'s own assembled
  `AppRuntime` object carries no new field; `initializeCrypto` is
  still the exact same function reference
  (`createRuntimeInitializeCryptoResult`).
- `src/worker.ts` was NOT modified by Phase 013 and is not modified by
  this Phase — it references neither `fedos_runtime_prototype_execution.ts`
  nor `fedos_wasm_loader.ts`'s async methods, directly or indirectly.
- No Production code path calls `attemptDevOnlyRuntimeRustIntegration()`
  automatically — it is a standalone, explicitly-invoked function, the
  same category as `attemptDevOnlyRustVersionCall()` itself.
- Since this Phase makes no code change at all, these facts are
  unchanged from Phase 013's own already-verified state (3828/3828
  tests green, `git status --short` clean after Phase 013's commit).

## 7. Prototype-only code — future removal candidates (not actioned this Phase)

This is a forward-looking inventory, not a deletion plan — nothing
below is removed, deprecated, or modified by this Phase.

- **The seven `FedosWasmLoader*Plan` interfaces** (`ImportPlan`,
  `WebAssemblyPlan`, `RustApiCallPlan`, `JsGlueAccessPlan`,
  `GeneratedArtifactCheckPlan`, `DevOnlyGatePlan`, `LoadPlan`) were
  built BEFORE several of the real evaluations they originally
  anticipated (e.g. `FedosWasmLoaderImportPlan.shouldImport`, always
  `false`, now sits alongside the REAL `importReadiness().ready`).
  Once a real, non-Prototype integration exists, some of these
  fixed-`false` planning labels may become redundant with real state
  and could be consolidated.
- **The Prototype-labeled Fail-Closed reason enums**
  (`"PrototypeStillClosed"`, `"NotReady"`, `"NotInitialized"` across
  `FedosWasmLoaderImportExecution`/`WasmInitialization`/
  `RustVersionExecution`) name THIS arc's own scope explicitly; once
  "Prototype" graduates to a real, production-reviewed integration,
  this naming may be revisited (the underlying Fail-Closed BEHAVIOR
  should not be).
- **The one-narrow-doc-per-Stage convention** (dozens of
  `docs/runtime_wasm_*`/`docs/fedos_core_rust_*` files, each recording
  a single Stage's own narrow finding) has been valuable as an audit
  trail during this incremental arc, but once the WASM/Rust boundary
  stabilizes, several historical observation docs (e.g. the JS glue
  contract, artifact generation fix, and artifact observation docs)
  could reasonably be consolidated into fewer, canonical references.
- **`attemptDevOnlyRuntimeRustIntegration()`'s own default,
  unwired-into-`AppRuntime` shape** is itself Prototype scaffolding —
  if a real Production integration eventually forms, it may be
  superseded by whatever that real Runtime → Rust flow turns out to
  need (a different gate sequence, a cached/shared loader instance,
  etc.), rather than being extended in place.

None of the above is urgent or blocking; all of it depends on a real,
non-Prototype crypto integration actually beginning, which has not
been scheduled.

## 8. What this Phase does NOT do

- Does **not** change `src/runtime/` (including `create_runtime.ts`,
  `fedos_wasm_loader.ts`, `fedos_runtime_prototype_execution.ts`).
- Does **not** change `src/worker.ts`.
- Does **not** change `packages/fedos-core-rust/src/lib.rs`.
- Does **not** change `Cargo.toml`.
- Does **not** change `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts`/
  `worker_crypto_diagnostics.ts`.
- Does **not** implement any of Options A–D from §4 — all are recorded
  as reviewed alternatives, none is adopted in code this Phase.

## 9. See also

- `docs/runtime_prototype_execution_runtime_integration.md`
  (Prototype EXECUTION Phase 013) — §8 first posed the question this
  Phase resolves; the real Runtime → Rust → Runtime loop this Phase
  reviews the completion status of.
- `docs/runtime_wasm_loader_dev_only_rust_version_call_execution.md`
  (Prototype EXECUTION Phase 012) — the six-condition gate this
  Phase's §2 traces end-to-end.
- `docs/runtime_wasm_rust_export_readiness_review.md` (Prototype
  EXECUTION Phase 008) — the earlier "is `version()`-only sufficient
  for Prototype termination" question this Phase's §1/§5 extend with a
  concrete, now-real answer.
- `docs/runtime_initialize_crypto_prototype.md` (Stage 691) — the
  original `{ allowed: false, initialized: false, reason:
  "PrototypeDisabled" }` contract this Phase recommends keeping
  unchanged.
