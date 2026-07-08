# FedOS internal execution contract (Stage 356, updated Stage 389/397/405/484)

**Status: this document records real code's current state.** It names
the required preconditions for real FedOS Rust crypto execution to
ever happen, in the order the internal chain actually evaluates them,
and states which links exist today and which remain disconnected.

## The contract

Real Rust crypto execution requires ALL of the following, in order:

| # | Link | Exists today? | File |
|---|---|---|---|
| 1 | Dual Lock (`FEDOS_CRYPTO_PROVIDER`/`FEDOS_CRYPTO_ENABLED`) | ✅ Yes | `docs/runtime_crypto_activation_policy.md` |
| 2 | Provider (`FedosRuntimeCryptoProvider`) | ✅ Yes | `src/runtime/fedos_runtime_crypto_provider.ts` |
| 3 | Opaque API (`FedosOpaqueApi`) | ✅ Yes | `src/runtime/fedos_opaque_api.ts` |
| 4 | Rust Boundary (`FedosRustBoundary`) | ✅ Yes | `src/runtime/fedos_rust_boundary.ts` |
| 5 | Rust API (`FedosRustApi`) | ✅ Yes | `src/runtime/fedos_rust_api.ts` |
| 6 | Execution Review (`FedosRustExecutionReview`) | ✅ Yes | `src/runtime/fedos_rust_execution_review.ts` |
| 7 | Internal Rust Call (`FedosInternalRustCall`) | ✅ Yes (PLANNED ONLY) | `src/runtime/fedos_internal_rust_call.ts` |
| 8 | Rust Invocation Adapter (`FedosRustInvocationAdapter`) | ✅ Yes | `src/runtime/fedos_rust_invocation_adapter.ts` |
| 9 | Execution Backend (`FedosExecutionBackend`) | ✅ Yes (NOT CONNECTED) | `src/runtime/fedos_execution_backend.ts` |
| 10 | WASM Backend (`FedosWasmBoundary`, formerly "WASM Boundary") | ✅ Yes (NOT LOADED) | `src/runtime/fedos_wasm_boundary.ts` |
| 11 | WASM Artifact (`FedosWasmArtifact`) | ✅ Yes (NOT BUILT) | `src/runtime/fedos_wasm_artifact.ts` |
| 12 | Rust Crypto (`packages/fedos-core-rust`'s `fedos_encrypt`/`fedos_decrypt`) | ❌ **Disconnected** | Not called from any file in links 1–11 |

**Only the first eleven links exist. Rust Crypto remains disconnected.**
There is no function, import, or code path anywhere in this repository
connecting link 11 to link 12. `docs/runtime_execution_backend.md`
(Stage 401) formally re-frames WebAssembly (link 10) as the FIRST
Execution Backend (link 9) CANDIDATE — not the only one design allows
— while `docs/runtime_rust_boundary_decision.md` (Stage 385) remains
the record of why WASM was chosen as the sole official MVP candidate.
No `.wasm` module is generated or built (link 11), loaded (link 10),
or selected/connected (link 9) by any stage so far.

## What "exists" means for each link

Links 1–11 each satisfy the SAME three properties:

1. **Typed and tested** — every link has its own `FedosXxxStatus`/
   `FedosXxxDecision` types, a placeholder implementation, and a
   dedicated guard test suite (`test/runtime_fedos_*.test.ts`).
2. **Wired to the next link** — each link's placeholder implementation
   constructs the NEXT link, routes to it, and discards its result,
   ALWAYS returning its own unchanged, fixed denial. (Link 11 is the
   exception at the FAR end: it has no further internal link to
   construct — it is the formally-decided terminus before link 12.)
3. **Never invokes anything beyond the chain** — no link imports
   `packages/fedos-core-rust`, calls `WebAssembly.instantiate`/
   `WebAssembly.compile`, runs `cargo build --target wasm32-*`/
   `wasm-bindgen`/`wasm-pack`, or uses FFI/a Native Addon/a Native or
   Mobile toolchain of any kind; `AppRuntime`/`create_runtime.ts` and
   `src/worker.ts` import NONE of these files.

Link 12 satisfies NONE of these from the TypeScript side — it is a REAL,
independently-tested Rust `pub fn` pair
(`packages/fedos-core-rust/src/lib.rs`), but nothing in
`src/runtime/` calls it.

## Why the contract stops here

Each of links 1–11 is a STRUCTURAL precondition — the shape exists. Link
12 additionally requires THREE separate PERMISSIONS
(`docs/runtime_fedos_execution_approval_checklist.md` items 6–8):
execution review approval, Runtime activation approval, and Worker
activation approval — PLUS the actual selection of a real Execution
Backend candidate (WASM, Native, Mobile, or otherwise) and the
generation, building, and loading of whatever artifact that candidate
requires, which no stage so far has done. None of these can be
granted by adding more structure to links 1–11 — each is its own,
future, explicitly-reviewed stage's decision.

## Still true after this stage

- No Rust crypto execution, no WASM build, no WASM load, no FFI, no
  Native Addon, no Native/Mobile backend of any kind, anywhere in the
  chain.
- No Runtime activation, no Worker activation.
- `encrypt()`/`decrypt()` STILL always resolve `"Unsupported"`.
- `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
  STILL never return `"Allowed"`.
- `FedosInternalRustCall` is planned only, never executed
  (`fedosInternalRustCallExecuted()` fixed `false`).
- `FedosExecutionBackend` has never selected or connected to a real
  backend (`fedosExecutionBackendImplemented()` fixed `false`).
- `FedosWasmBoundary` has never loaded a WASM module
  (`fedosWasmLoaded()` fixed `false`).
- `FedosWasmArtifact` has never built a WASM artifact
  (`fedosWasmArtifactBuilt()` fixed `false`).

## Update — Stage 481–484: Generated JS Glue / Generated `.wasm` are now REAL, still unconnected

Stage 465–480 made link 11 (`FedosWasmArtifact`) and its dependents
genuinely reachable-in-substance for the first time: a real `.wasm` +
`wasm-bindgen` JS glue pair now exists on disk whenever `npm run
build:wasm` is run (`docs/runtime_wasm_artifact_observation.md` §10).
This update splits link 11's single row into a finer-grained diagram
— the CALL direction, top-down from link 9 to Rust, complementing
`docs/runtime_wasm_build_contract.md`'s BUILD direction (bottom-up,
Rust source to Runtime):

```
ExecutionBackend                     <-- link 9, REAL placeholder, fixed "Planning"/"NotConnected"
     |
     v
FedosWasmBoundary                    <-- link 10, REAL placeholder, fixed "BlockedByImplementation"
     |
     v
FedosWasmArtifact                    <-- link 11, REAL placeholder, fixed "BlockedByImplementation";
     |                                   generationState fixed "NotGenerated" (Stage 452) even though
     |                                   a real artifact now exists on disk -- never a filesystem check
     v
FedosWasmLoaderContract              <-- REAL placeholder (src/runtime/fedos_wasm_loader_contract.ts,
     |                                   Stage 482), fixed "NotLoaded"/"StaticPlanning" -- deliberately
     |                                   NOT wired to FedosWasmArtifact (see below)
     v
Generated JS Glue                    <-- REAL FILE, observed (packages/fedos-core-rust/pkg/fedos_core_rust.js,
     |                                   docs/runtime_wasm_js_glue_contract.md, Stage 481) -- never imported
     v
Generated .wasm                      <-- REAL FILE, observed (fedos_core_rust_bg.wasm) -- never instantiated
     |
     v
Rust                                 <-- REAL, compiled, 27 pub fn, none `#[wasm_bindgen]`-annotated
```

`FedosWasmLoaderContract` is deliberately NOT wired to
`FedosWasmArtifact` even at the plan/observation level — unlike every
adjacent pair above it, which Stages 361–402 progressively wired
(each still fixed to a permanent denial). No `fedos_wasm_artifact.ts`
function calls `wasmLoaderState()`/`loaderImportMode()`/
`loaderInitialized()`, and `fedos_wasm_loader_contract.ts` references
nothing above it in this diagram. Only
`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
483) read its standalone functions, the same diagnostics-only
treatment `fedos_wasm_toolchain.ts` already receives. This keeps
Stage 481–488 scoped to OBSERVATION and CONTRACT NAMING only — how a
real loader would eventually attach to link 11 is left to a future,
separate, explicitly-reviewed stage.

**Link 12 (Rust Crypto) remains disconnected, unchanged by this
update.** Nothing above calls `WebAssembly.instantiate`/
`WebAssembly.compile`/`initSync`/the JS glue's default export;
`create_runtime.ts`/`src/worker.ts` import none of the boxes in this
diagram; no generated file is edited or committed; no Rust `pub fn`
is added or `#[wasm_bindgen]`-annotated (still 27); `"Allowed"`
remains unreachable from either activation policy.

## Update — Stage 489–494: Loader Skeleton, STOP

Stage 489–492 adds `src/runtime/fedos_wasm_loader.ts` — a LOADER
SKELETON, separate from Stage 482's `FedosWasmLoaderContract`. Where
the Contract only ever reports a `status()`, the Skeleton also names
the three OPERATIONS a real loader would eventually perform
(`planLoad()`/`planInitialize()`/`planUnload()`) — each one PLANNED,
never executed, and each one denied by a named POLICY
(`docs/runtime_wasm_loader.md`, Stage 493), not merely "not
implemented yet":

```
Generated JS Glue                    <-- REAL FILE, observed (Stage 481), never imported by this Skeleton
     |
     v
FedosWasmLoader ("Loader Skeleton")  <-- REAL placeholder (src/runtime/fedos_wasm_loader.ts, Stage 489-492),
     |                                   fixed state "NotLoaded" / mode "PlanningOnly" / policy "FailClosed";
     |                                   planLoad/planInitialize/planUnload ALL fixed "BlockedByPolicy" --
     |                                   deliberately NOT wired to Generated JS Glue, FedosWasmLoaderContract,
     |                                   or anything above it in this diagram
     v
STOP                                 <-- no further link exists from this Skeleton; Runtime/Worker connection,
                                          WebAssembly.instantiate/compile, and import() all remain PROHIBITED
```

This is a DELIBERATELY SHORT, separate diagram — it does not extend
or replace the CALL-direction diagram above (which continues past
Generated JS Glue to Generated `.wasm` and Rust via
`FedosWasmLoaderContract`). The Loader Skeleton stops immediately
after Generated JS Glue because this stage's ONLY purpose is naming
the loader's own operations and policy, never reaching further up or
down the existing chain. `runtime_crypto_diagnostics.ts`/
`worker_crypto_diagnostics.ts` (Stage 495) read `loaderState()`/
`loaderMode()`/`loaderPolicy()` for DISPLAY only — the same
diagnostics-only treatment every other leaf in this arc receives.

**Still true after this update**: no Runtime/Worker connection of any
kind; `WebAssembly.instantiate`/`compile` never invoked; no `fetch`/
dynamic `import()`; no generated file edited or committed;
`encrypt`/`decrypt` unchanged; `"Allowed"`/`"Loaded"`/`"Active"`/
`"FailOpen"` never reached; Rust public API unchanged (27 `pub fn`).

## Update — Stage 501–505: Loader Plan, revised diagram

Stage 501 (`docs/runtime_wasm_loader_planning.md`) separates "when may
the generated JS glue ever load" into FIVE ordered phases: Loader
Creation (already real), Import Permission, Initialization
Permission, Runtime Attach, Worker Attach. Stage 502 adds
`src/runtime/fedos_wasm_loader_plan.ts` — a pure, fixed-value LOADER
PLAN naming the last four of those phases as
`planImport()`/`planInitialize()`/`planRuntimeAttach()`/
`planWorkerAttach()`, each fixed `"BlockedByPolicy"`. Stage 503 wires
`FedosWasmLoader.planLoad()` (`fedos_wasm_loader.ts`) to CONSTRUCT a
`FedosWasmLoaderPlan` and call its `planImport()` — the result is
DISCARDED and `planLoad()`'s own return value is UNCHANGED, the same
"reach one link deeper, keep your own answer" pattern
`fedos_wasm_boundary.ts` already established for `FedosWasmArtifact`.

This revises the Stage 489–494 diagram — Loader Plan now sits between
Loader Skeleton and Generated JS Glue, and Execution Backend is named
at the top purely for POSITIONAL context (it is NOT wired to Loader
Skeleton in code — that arrow is conceptual only, exactly like every
other "where this box eventually sits in the bigger picture" framing
in this document):

```
ExecutionBackend                     <-- link 9, REAL placeholder, fixed "Planning"/"NotConnected"
     :                                   (POSITIONAL ONLY below this line -- ExecutionBackend does NOT
     :                                   construct or call FedosWasmLoader; no code wire exists here)
     v
FedosWasmLoader ("Loader Skeleton")  <-- REAL placeholder (src/runtime/fedos_wasm_loader.ts, Stage 489-492),
     |                                   fixed state "NotLoaded" / mode "PlanningOnly" / policy "FailClosed"
     v
FedosWasmLoaderPlan ("Loader Plan")  <-- REAL placeholder (src/runtime/fedos_wasm_loader_plan.ts, Stage 502),
     |                                   REAL wiring: planLoad() constructs one and calls planImport(),
     |                                   discards the result (Stage 503); planImport/planInitialize/
     |                                   planRuntimeAttach/planWorkerAttach ALL fixed "BlockedByPolicy"
     v
Generated JS Glue                    <-- REAL FILE, observed (Stage 481) -- NOT imported by the Loader Plan;
     |                                   the arrow above is positional (Stage 501's phase table), not a
     |                                   real import
     v
STOP                                 <-- no further link exists; Runtime/Worker connection,
                                          WebAssembly.instantiate/compile, initSync/default init, and
                                          import() all remain PROHIBITED
```

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
504) read `loaderPlanState()`/`loaderImportAllowed()`/
`loaderInitializationAllowed()` for DISPLAY only — `"PlanningOnly"`/
`false`/`false`, matching every other leaf in this arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_wasm_loader.ts` nor `fedos_wasm_loader_plan.ts`);
`WebAssembly.instantiate`/`compile` never invoked; `initSync`/the
generated JS glue's default export never called; no `fetch`/dynamic
`import()`; no generated file edited or committed; `encrypt`/`decrypt`
unchanged; `"Allowed"`/`"Loaded"`/`"Active"`/`"FailOpen"` never
reached; Rust public API unchanged (27 `pub fn`).

## Update — Stage 509–513: Import Policy, revised diagram

Stage 509 (`docs/runtime_wasm_loader_import_policy.md`) fixes SIX
minimum conditions phase #2 ("Import Permission") itself requires:
Loader Plan import allowed, generated artifact present, artifact
untracked/gitignored, Runtime dev-only approval, no Worker approval,
Execution Review approval. Stage 510 adds
`src/runtime/fedos_wasm_loader_import_policy.ts` — a pure decision
function, `evaluateWasmLoaderImportPolicy()`, mirroring
`runtime_crypto_activation_policy.ts`'s own
`ActivationPolicy`/`ActivationDecision`/`ActivationReason` shape one
level down this WASM arc, ALWAYS resolving
`{ allowed: false, reason: "BlockedByPolicy" }`. Stage 511 wires
`FedosWasmLoaderPlan.planImport()` (`fedos_wasm_loader_plan.ts`) to
CALL this function — the result is DISCARDED and `planImport()`'s own
return value is UNCHANGED, the same "reach one link deeper, keep your
own answer" pattern Stage 503 already established one link up.

This revises the Stage 501–505 diagram — Import Policy now sits
between Loader Plan and Generated JS Glue:

```
FedosWasmLoaderPlan ("Loader Plan")     <-- REAL placeholder (src/runtime/fedos_wasm_loader_plan.ts, Stage 502),
     |                                      REAL wiring: planImport() calls evaluateWasmLoaderImportPolicy(),
     |                                      discards the result (Stage 511)
     v
FedosWasmLoaderImportPolicy             <-- REAL, pure decision function (src/runtime/fedos_wasm_loader_import_policy.ts,
("Import Policy")                            Stage 510), fixed { allowed: false, reason: "BlockedByPolicy" };
     |                                      state fixed "Blocked"
     v
Generated JS Glue                       <-- REAL FILE, observed (Stage 481) -- NOT imported by the Import Policy;
     |                                      the arrow above is positional (Stage 509's condition table), not a
     |                                      real import
     v
STOP                                    <-- no further link exists; Runtime/Worker connection,
                                             WebAssembly.instantiate/compile, initSync/default init, and
                                             import() all remain PROHIBITED
```

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
512) read `wasmLoaderImportPolicyState()`/`evaluateWasmLoaderImportPolicy()`
for DISPLAY only — `"Blocked"`/`false`/`"BlockedByPolicy"`, matching
every other leaf in this arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_wasm_loader_plan.ts` nor `fedos_wasm_loader_import_policy.ts`);
`WebAssembly.instantiate`/`compile` never invoked; `initSync`/the
generated JS glue's default export never called; no `fetch`/dynamic
`import()`; no generated file edited or committed; `encrypt`/`decrypt`
unchanged; `"Allowed"`/`"Loaded"`/`"Active"`/`"FailOpen"` never
reached; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/
`package.json` dependency added.

## Update — Stage 517–521: Static Import Plan, revised diagram

Stage 517 (`docs/runtime_wasm_static_import_plan.md`) names the EXACT
static `import` statement a future, separate, explicitly-reviewed
stage would eventually write — target
`packages/fedos-core-rust/pkg/fedos_core_rust.js`, expecting the two
exports Stage 481 directly observed (`initSync` named,
`default`/`__wbg_init` default) — without ever writing that
statement. Stage 518 adds `src/runtime/fedos_wasm_static_import_plan.ts`
— a pure, fixed-value STATIC IMPORT PLAN naming
`planStaticImport()`, fixed `"BlockedByPolicy"`, plus the target path
recorded as a plain, non-resolved string constant
(`FEDOS_WASM_STATIC_IMPORT_TARGET`). Stage 519 wires
`evaluateWasmLoaderImportPolicy()` (`fedos_wasm_loader_import_policy.ts`)
to CONSTRUCT a `FedosWasmStaticImportPlan` and call its
`planStaticImport()` — the result is DISCARDED and
`evaluateWasmLoaderImportPolicy()`'s own return value is UNCHANGED,
the SAME "reach one link deeper, keep your own answer" pattern
Stage 503/511 already established twice over.

This revises the Stage 509–513 diagram — Static Import Plan now sits
between Import Policy and Generated JS Glue:

```
FedosWasmLoaderImportPolicy                <-- REAL, pure decision function (src/runtime/fedos_wasm_loader_import_policy.ts,
("Import Policy")                               Stage 510), REAL wiring: evaluateWasmLoaderImportPolicy() calls
     |                                          FedosWasmStaticImportPlan.planStaticImport(), discards the result
     |                                          (Stage 519)
     v
FedosWasmStaticImportPlan                  <-- REAL placeholder (src/runtime/fedos_wasm_static_import_plan.ts,
("Static Import Plan")                          Stage 518), fixed state "PlanningOnly", planStaticImport() fixed
     |                                          "BlockedByPolicy"; target recorded as a plain string constant,
     |                                          never resolved/imported/required
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported by the Static
     |                                          Import Plan; the arrow above is positional (Stage 517's target/
     |                                          export table), not a real import
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, initSync/default init, and
                                                 import() all remain PROHIBITED
```

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
520) read `staticImportPlanState()`/`staticImportTarget()`/
`staticImportAllowed()` for DISPLAY only — `"PlanningOnly"`/
`"packages/fedos-core-rust/pkg/fedos_core_rust.js"`/`false`, matching
every other leaf in this arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_wasm_loader_import_policy.ts` nor
`fedos_wasm_static_import_plan.ts`); `WebAssembly.instantiate`/
`compile` never invoked; `initSync`/the generated JS glue's default
export never called; no `fetch`/dynamic `import()`; no generated file
edited or committed; `encrypt`/`decrypt` unchanged; `"Allowed"`/
`"Loaded"`/`"Active"`/`"FailOpen"` never reached; Rust public API
unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency
added.

## Update — Stage 525–529: Static Import Safety Review, revised diagram

Stage 525 (`docs/runtime_wasm_static_import_safety_review.md`) is a
dedicated SAFETY REVIEW of what would break, and why, if the static
`import` statement named by Stage 517 were ever written: the generated
JS glue is a gitignored, never-committed build artifact
(`packages/fedos-core-rust/.gitignore`, Stage 451), so a static import
of it would break every environment that has not just run `npm run
build:wasm` locally. Stage 526 adds
`src/runtime/fedos_wasm_static_import_review.ts` — a pure, fixed-value
STATIC IMPORT SAFETY REVIEW naming `reviewStaticImport()`, fixed
`{ approved: false, reason: "GeneratedArtifactNotCommitted" }`. Stage
527 wires `FedosWasmStaticImportPlanSkeleton.planStaticImport()`
(`fedos_wasm_static_import_plan.ts`) to CALL `reviewStaticImport()` —
the result is DISCARDED and `planStaticImport()`'s own return value is
UNCHANGED, the SAME "reach one link deeper, keep your own answer"
pattern Stage 503/511/519 already established three times over.

This revises the Stage 517–521 diagram — Static Import Safety Review
now sits between Static Import Plan and Generated JS Glue:

```
FedosWasmStaticImportPlan                  <-- REAL placeholder (src/runtime/fedos_wasm_static_import_plan.ts,
("Static Import Plan")                          Stage 518), REAL wiring: planStaticImport() calls
     |                                          reviewStaticImport(), discards the result (Stage 527)
     v
FedosWasmStaticImportReview                <-- REAL, pure decision function (src/runtime/fedos_wasm_static_import_review.ts,
("Static Import Review")                        Stage 526), fixed { approved: false, reason:
     |                                          "GeneratedArtifactNotCommitted" }; state fixed "ReviewedAndBlocked"
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported by the Static
     |                                          Import Review; the arrow above is positional (Stage 525's risk/
     |                                          policy analysis), not a real import
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, initSync/default init, and
                                                 import() all remain PROHIBITED
```

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
528) read `staticImportReviewState()`/`staticImportReviewApproved()`/
`staticImportReviewReason()` for DISPLAY only — `"ReviewedAndBlocked"`/
`false`/`"GeneratedArtifactNotCommitted"`, matching every other leaf
in this arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_wasm_static_import_plan.ts` nor
`fedos_wasm_static_import_review.ts`); `WebAssembly.instantiate`/
`compile` never invoked; `initSync`/the generated JS glue's default
export never called; no `fetch`/dynamic `import()`; no generated file
edited or committed; `encrypt`/`decrypt` unchanged; `"Allowed"`/
`"Approved"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; Rust
public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json`
dependency added.

## Update — Stage 533–536: Static Import Readiness, revised diagram

Stage 533 (`docs/runtime_wasm_static_import_readiness.md`) names EIGHT
conditions that would ALL need to hold, simultaneously, before the
static import named by Stage 517 could ever actually run — even
assuming a future stage someday satisfied the Safety Review (Stage
526). Stage 534 adds `src/runtime/fedos_wasm_static_import_readiness.ts`
— a pure, fixed-value STATIC IMPORT READINESS record naming
`createStaticImportReadiness()`, fixed `{ readinessState:
"PlanningOnly", ready: false, reason: "RuntimeNotReady" }`. Stage 535
wires `reviewStaticImport()` (`fedos_wasm_static_import_review.ts`) to
CALL `createStaticImportReadiness()` — the result is DISCARDED and
`reviewStaticImport()`'s own return value is UNCHANGED, the SAME
"reach one link deeper, keep your own answer" pattern
Stage 503/511/519/527 already established four times over.

This revises the Stage 525–529 diagram — Static Import Readiness now
sits between Static Import Review and Generated JS Glue:

```
FedosWasmStaticImportReview                <-- REAL, pure decision function (src/runtime/fedos_wasm_static_import_review.ts,
("Static Import Review")                        Stage 526), REAL wiring: reviewStaticImport() calls
     |                                          createStaticImportReadiness(), discards the result (Stage 535)
     v
FedosWasmStaticImportReadiness             <-- REAL, pure decision function (src/runtime/fedos_wasm_static_import_readiness.ts,
("Static Import Readiness")                     Stage 534), fixed { readinessState: "PlanningOnly", ready: false,
     |                                          reason: "RuntimeNotReady" }
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported by the Static
     |                                          Import Readiness; the arrow above is positional (Stage 533's
     |                                          eight-condition table), not a real import
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, initSync/default init, and
                                                 import() all remain PROHIBITED
```

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
536) read `staticImportReadinessState()`/`staticImportReady()`/
`staticImportReadinessReason()` for DISPLAY only —
`"PlanningOnly"`/`false`/`"RuntimeNotReady"`, matching every other leaf
in this arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_wasm_static_import_review.ts` nor
`fedos_wasm_static_import_readiness.ts`); `WebAssembly.instantiate`/
`compile` never invoked; `initSync`/the generated JS glue's default
export never called; no `fetch`/dynamic `import()`; no generated file
edited or committed; `encrypt`/`decrypt` unchanged; `"Allowed"`/
`"Approved"`/`"Ready"`/`"Loaded"`/`"Active"`/`"FailOpen"` never
reached; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/
`package.json` dependency added.

## Update — Stage 537–541: Generated Artifact Presence Policy, revised diagram

Stage 537 (`docs/runtime_generated_artifact_presence_policy.md`) is
the LAST safety layer immediately before a static import could ever be
written: it fixes what "the generated JS glue/`.wasm` exist" and "the
generated JS glue/`.wasm` may be imported" would need to mean, and
states plainly that presence and usage permission are separate
concepts. Stage 538 adds `src/runtime/fedos_generated_artifact_presence.ts`
— a pure, fixed-value GENERATED ARTIFACT PRESENCE POLICY naming
`createGeneratedArtifactPresence()`, fixed `{ state: "PlanningOnly",
present: false, reason: "ArtifactNotGeneratedForRuntime" }` — using no
`fs`/`path`/`existsSync`/`statSync`/glob API of any kind to determine
that answer. Stage 539 wires `createStaticImportReadiness()`
(`fedos_wasm_static_import_readiness.ts`) to CALL
`createGeneratedArtifactPresence()` — the result is DISCARDED and
`createStaticImportReadiness()`'s own return value is UNCHANGED, the
SAME "reach one link deeper, keep your own answer" pattern
Stage 503/511/519/527/535 already established five times over.

This revises the Stage 533–536 diagram — Generated Artifact Presence
now sits between Static Import Readiness and Generated JS Glue:

```
FedosWasmStaticImportReadiness             <-- REAL, pure decision function (src/runtime/fedos_wasm_static_import_readiness.ts,
("Static Import Readiness")                     Stage 534), REAL wiring: createStaticImportReadiness() calls
     |                                          createGeneratedArtifactPresence(), discards the result (Stage 539)
     v
FedosGeneratedArtifactPresence              <-- REAL, pure decision function (src/runtime/fedos_generated_artifact_presence.ts,
("Generated Artifact Presence")                 Stage 538), fixed { state: "PlanningOnly", present: false, reason:
     |                                          "ArtifactNotGeneratedForRuntime" } -- NEVER a live filesystem check
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported by the Presence
     |                                          Policy; the arrow above is positional (Stage 537's condition table),
     |                                          not a real import
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, initSync/default init, and
                                                 import() all remain PROHIBITED
```

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
540) read `artifactPresenceState()`/`artifactPresent()`/
`artifactPresenceReason()` for DISPLAY only —
`"PlanningOnly"`/`false`/`"ArtifactNotGeneratedForRuntime"`, matching
every other leaf in this arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_wasm_static_import_readiness.ts` nor
`fedos_generated_artifact_presence.ts`); `WebAssembly.instantiate`/
`compile` never invoked; `initSync`/the generated JS glue's default
export never called; no `fetch`/dynamic `import()`; no `fs`/`path`/
`existsSync`/`statSync`/glob-based presence check; no generated file
edited or committed; `encrypt`/`decrypt` unchanged; `"Allowed"`/
`"Approved"`/`"Ready"`/`"Present"`/`"Loaded"`/`"Active"`/`"FailOpen"`
never reached; Rust public API unchanged (27 `pub fn`); no
`Cargo.toml`/`package.json` dependency added.

## Update — Stage 545–549: Static Import Activation Review, revised diagram

Stage 545 (`docs/runtime_static_import_activation_review.md`) is the
FINAL GATE immediately before real static import could ever be
permitted — one level below the Generated Artifact Presence Policy,
gathering every prior gate's answer (Safety Review, Readiness,
Artifact Presence, Generated JS Glue built, Runtime-side review, Fail
Closed, crypto API unexposed) into a single, named ACTIVATION
decision. Stage 546 adds
`src/runtime/fedos_static_import_activation_review.ts` — a pure,
fixed-value STATIC IMPORT ACTIVATION REVIEW naming
`createStaticImportActivationReview()`, fixed `{ state:
"PlanningOnly", approved: false, reason:
"RuntimeActivationReviewPending" }` — never referencing the generated
JS glue in any way. Stage 547 wires `createGeneratedArtifactPresence()`
(`fedos_generated_artifact_presence.ts`) to CALL
`createStaticImportActivationReview()` — the result is DISCARDED and
`createGeneratedArtifactPresence()`'s own return value is UNCHANGED,
the SAME "reach one link deeper, keep your own answer" pattern
Stage 503/511/519/527/535/539 already established six times over.

This revises the Stage 537–541 diagram — Static Import Activation
Review now sits between Generated Artifact Presence and Generated JS
Glue:

```
FedosGeneratedArtifactPresence              <-- REAL, pure decision function (src/runtime/fedos_generated_artifact_presence.ts,
("Generated Artifact Presence")                 Stage 538), REAL wiring: createGeneratedArtifactPresence() calls
     |                                          createStaticImportActivationReview(), discards the result (Stage 547)
     v
FedosStaticImportActivationReview           <-- REAL, pure decision function (src/runtime/fedos_static_import_activation_review.ts,
("Static Import Activation Review")             Stage 546), fixed { state: "PlanningOnly", approved: false, reason:
     |                                          "RuntimeActivationReviewPending" } -- NEVER references the generated JS glue
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported by the Activation
     |                                          Review; the arrow above is positional (Stage 545's seven-condition
     |                                          table), not a real import
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, initSync/default init, and
                                                 import() all remain PROHIBITED
```

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
548) read `staticImportActivationState()`/
`staticImportActivationApproved()`/`staticImportActivationReason()`
for DISPLAY only —
`"PlanningOnly"`/`false`/`"RuntimeActivationReviewPending"`, matching
every other leaf in this arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_generated_artifact_presence.ts` nor
`fedos_static_import_activation_review.ts`); `WebAssembly.instantiate`/
`compile` never invoked; `initSync`/the generated JS glue's default
export never called; no `fetch`/dynamic `import()`; no `fs`/`path`/
`existsSync`/`statSync`/glob-based presence check; no generated file
edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-59
unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/
`"Reviewed"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; Rust
public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json`
dependency added.

## Update — Stage 553–557: Generated Artifact Distribution Policy, revised diagram

Stage 553 (`docs/runtime_generated_artifact_distribution_policy.md`)
fixes a standing PROJECT POLICY the arc above left open: whether the
generated `.wasm`/JS glue pair should ever be committed to version
control (Option A) or produced fresh at build time on every machine
that needs it (Option B). This repository adopts Option B — `/pkg/`
stays gitignored (Stage 451/69), and a fresh clone requires `npm run
build:wasm` before the generated artifact exists at all. Stage 554
adds `src/runtime/fedos_generated_artifact_distribution.ts` — a pure,
fixed-value DISTRIBUTION POLICY naming
`createGeneratedArtifactDistribution()`, fixed `{ distributionMode:
"BuildTimeGenerated", artifactCommitted: false, staticImportSafe:
false, reason: "GeneratedArtifactNotCommitted" }`. Stage 555 wires
`createStaticImportActivationReview()`
(`fedos_static_import_activation_review.ts`) to CALL
`createGeneratedArtifactDistribution()` — the result is DISCARDED and
`createStaticImportActivationReview()`'s own return value is
UNCHANGED, the SAME "reach one link deeper, keep your own answer"
pattern Stage 503/511/519/527/535/539/547 already established seven
times over.

This revises the Stage 545–549 diagram — Generated Artifact
Distribution Policy now sits between Static Import Activation Review
and Generated JS Glue:

```
FedosStaticImportActivationReview           <-- REAL, pure decision function (src/runtime/fedos_static_import_activation_review.ts,
("Static Import Activation Review")             Stage 546), REAL wiring: createStaticImportActivationReview() calls
     |                                          createGeneratedArtifactDistribution(), discards the result (Stage 555)
     v
FedosGeneratedArtifactDistribution           <-- REAL, pure decision function (src/runtime/fedos_generated_artifact_distribution.ts,
("Generated Artifact Distribution Policy")       Stage 554), fixed { distributionMode: "BuildTimeGenerated",
     |                                          artifactCommitted: false, staticImportSafe: false, reason:
     |                                          "GeneratedArtifactNotCommitted" } -- NEVER references the generated JS glue
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported by the Distribution
     |                                          Policy; the arrow above is positional (Stage 553's Option A/B
     |                                          comparison), not a real import
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, initSync/default init, and
                                                 import() all remain PROHIBITED
```

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
556) read `generatedArtifactDistributionMode()`/
`generatedArtifactCommitted()`/`staticImportSafe()` for DISPLAY only —
`"BuildTimeGenerated"`/`false`/`false`, matching every other leaf in
this arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_static_import_activation_review.ts` nor
`fedos_generated_artifact_distribution.ts`); `WebAssembly.instantiate`/
`compile` never invoked; `initSync`/the generated JS glue's default
export never called; no `fetch`/dynamic `import()`; no generated file
edited or committed; `packages/fedos-core-rust/.gitignore`'s `/pkg/`
rule unchanged; `encrypt`/`decrypt` unchanged; `"Allowed"`/
`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/
`"Loaded"`/`"Active"`/`"FailOpen"` never reached; Rust public API
unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency
added.

## Update — Stage 561–565: Build-Time Loader Strategy, revised diagram

Stage 561 (`docs/runtime_build_time_loader_strategy.md`) draws the
direct consequence of the Distribution Policy's Option B choice
(never commit the generated artifact) for how the generated JS
glue/`.wasm` could ever be LOADED: no loader may assume the artifact
is present, and static import is unsafe. It names THREE candidate
future loading strategies — (A) require a prebuild step, (B) an
optional no-op loader, (C) a dynamic loader with an explicit dev-only
gate — and designates Option C as the future candidate WITHOUT
implementing it. Stage 562 adds
`src/runtime/fedos_build_time_loader_strategy.ts` — a pure,
fixed-value STRATEGY DECISION naming
`createBuildTimeLoaderStrategy()`, fixed `{ strategy:
"DynamicLoaderPlanned", requiresPrebuild: true, staticImportAllowed:
false, dynamicImportAllowed: false, runtimeAttachAllowed: false }` —
writing no dynamic `import()` of any kind, despite naming one as the
future candidate. Stage 563 wires
`createGeneratedArtifactDistribution()`
(`fedos_generated_artifact_distribution.ts`) to CALL
`createBuildTimeLoaderStrategy()` — the result is DISCARDED and
`createGeneratedArtifactDistribution()`'s own return value is
UNCHANGED, the SAME "reach one link deeper, keep your own answer"
pattern Stage 503/511/519/527/535/539/547/555 already established
eight times over.

This revises the Stage 553–557 diagram — Build-Time Loader Strategy
now sits between Generated Artifact Distribution Policy and Generated
JS Glue:

```
FedosGeneratedArtifactDistribution           <-- REAL, pure decision function (src/runtime/fedos_generated_artifact_distribution.ts,
("Generated Artifact Distribution Policy")       Stage 554), REAL wiring: createGeneratedArtifactDistribution() calls
     |                                          createBuildTimeLoaderStrategy(), discards the result (Stage 563)
     v
FedosBuildTimeLoaderStrategy                 <-- REAL, pure decision function (src/runtime/fedos_build_time_loader_strategy.ts,
("Build-Time Loader Strategy")                   Stage 562), fixed { strategy: "DynamicLoaderPlanned", requiresPrebuild: true,
     |                                          staticImportAllowed: false, dynamicImportAllowed: false,
     |                                          runtimeAttachAllowed: false } -- NEVER writes a dynamic import() or
     |                                          references the generated JS glue
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic)
     |                                          by the Loader Strategy; the arrow above is positional (Stage 561's
     |                                          three-option comparison), not a real import
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
564) read `buildTimeLoaderStrategy()`/
`buildTimeLoaderRequiresPrebuild()`/
`buildTimeLoaderRuntimeAttachAllowed()` for DISPLAY only —
`"DynamicLoaderPlanned"`/`true`/`false`, matching every other leaf in
this arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_generated_artifact_distribution.ts` nor
`fedos_build_time_loader_strategy.ts`); `WebAssembly.instantiate`/
`compile` never invoked; no static `import` and no dynamic `import()`
of the generated JS glue anywhere in this repository; no generated
file edited or committed; `encrypt`/`decrypt` unchanged; `"Allowed"`/
`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/
`"PrebuildRequired"`/`"OptionalLoader"`/`"Loaded"`/`"Active"`/
`"FailOpen"` never reached; Rust public API unchanged (27 `pub fn`);
no `Cargo.toml`/`package.json` dependency added.

## Update — Stage 569–573: Dynamic Loader Gate, revised diagram

Stage 569 (`docs/runtime_dynamic_loader_gate.md`) fixes EIGHT minimum
conditions a future, separate, explicitly-reviewed stage would need to
satisfy before a dynamic `import()` of the generated JS glue could
ever be written and executed — Build-Time Loader Strategy complete,
Generated Artifact Distribution policy finalized, Static Import Review
complete, Runtime Activation Review complete, Runtime dev-only gating,
Fail Closed maintained, Generated JS Glue unmodified, Worker out of
scope. Stage 570 adds `src/runtime/fedos_dynamic_loader_gate.ts` — a
pure, fixed-value GATE naming `createDynamicLoaderGate()`, fixed `{
gateState: "PlanningOnly", dynamicLoaderAllowed: false, reason:
"DynamicLoaderGatePending" }` — with NO side effects and NO dynamic
`import()` written anywhere in this file, even though the gate itself
concerns a future dynamic loader. Stage 571 wires
`createBuildTimeLoaderStrategy()`
(`fedos_build_time_loader_strategy.ts`) to CALL
`createDynamicLoaderGate()` — the result is DISCARDED and
`createBuildTimeLoaderStrategy()`'s own return value is UNCHANGED
(`strategy: "DynamicLoaderPlanned"`), the SAME "reach one link deeper,
keep your own answer" pattern
Stage 503/511/519/527/535/539/547/555/563 already established nine
times over.

This revises the Stage 561–565 diagram — Dynamic Loader Gate now sits
between Build-Time Loader Strategy and Generated JS Glue:

```
FedosBuildTimeLoaderStrategy                 <-- REAL, pure decision function (src/runtime/fedos_build_time_loader_strategy.ts,
("Build-Time Loader Strategy")                   Stage 562), REAL wiring: createBuildTimeLoaderStrategy() calls
     |                                          createDynamicLoaderGate(), discards the result (Stage 571)
     v
FedosDynamicLoaderGate                       <-- REAL, pure decision function (src/runtime/fedos_dynamic_loader_gate.ts,
("Dynamic Loader Gate")                          Stage 570), fixed { gateState: "PlanningOnly", dynamicLoaderAllowed:
     |                                          false, reason: "DynamicLoaderGatePending" } -- NO side effects, NO
     |                                          dynamic import() written, NEVER references the generated JS glue
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic)
     |                                          by the Dynamic Loader Gate; the arrow above is positional (Stage
     |                                          569's eight-condition table), not a real import
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

**No Runtime connection of any kind exists yet — not even a dev-only
one.** `docs/runtime_dynamic_loader_gate.md` §1 condition #5 ("Runtime
dev-only") is itself UNMET: no dev-only flag, environment variable, or
code path anywhere in this repository consults
`fedos_dynamic_loader_gate.ts`'s answer, and `create_runtime.ts` does
not reference this file, directly or indirectly. Opening the gate is
explicitly left to a future, separate, explicitly-reviewed stage.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
572) read `dynamicLoaderGateState()`/`dynamicLoaderAllowed()`/
`dynamicLoaderGateReason()` for DISPLAY only —
`"PlanningOnly"`/`false`/`"DynamicLoaderGatePending"`, matching every
other leaf in this arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_build_time_loader_strategy.ts` nor
`fedos_dynamic_loader_gate.ts`); `WebAssembly.instantiate`/`compile`
never invoked; no static `import` and no dynamic `import()` of the
generated JS glue anywhere in this repository; no generated file
edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-59
unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/
`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/
`"Open"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; Rust public
API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency
added.

## Update — Stage 577–581: Dynamic Loader Dev Approval, revised diagram

Stage 577 (`docs/runtime_dynamic_loader_dev_approval.md`) fixes EIGHT
minimum DEV-ONLY conditions a future, separate, explicitly-reviewed
stage would need to satisfy before a dynamic `import()` of the
generated JS glue could ever be ACTIVATED — Dynamic Loader Gate
passed, dev build only, disabled in production builds, Runtime Review
complete, Generated JS Glue verified, Fail Closed maintained,
prohibited in Worker, prohibited in production deploy. This is a
SEPARATE, narrower question than the Gate's own "may a dynamic
`import()` ever be written at all" — this approval asks "under what
conditions may it ever be ACTIVATED, on a given machine, in a given
build." Stage 578 adds `src/runtime/fedos_dynamic_loader_dev_approval.ts`
— a pure, fixed-value APPROVAL naming
`createDynamicLoaderDevApproval()`, fixed `{ approvalState:
"PlanningOnly", approved: false, reason: "DevApprovalPending" }` —
with NO side effects and NO `import()` of any kind (static or dynamic)
written anywhere in this file. Stage 579 wires
`createDynamicLoaderGate()` (`fedos_dynamic_loader_gate.ts`) to CALL
`createDynamicLoaderDevApproval()` — the result is DISCARDED and
`createDynamicLoaderGate()`'s own return value is UNCHANGED
(`dynamicLoaderAllowed: false`), the SAME "reach one link deeper, keep
your own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571 already established ten
times over.

This revises the Stage 569–573 diagram — Dynamic Loader Dev Approval
now sits between Dynamic Loader Gate and Generated JS Glue:

```
FedosDynamicLoaderGate                       <-- REAL, pure decision function (src/runtime/fedos_dynamic_loader_gate.ts,
("Dynamic Loader Gate")                          Stage 570), REAL wiring: createDynamicLoaderGate() calls
     |                                          createDynamicLoaderDevApproval(), discards the result (Stage 579)
     v
FedosDynamicLoaderDevApproval                <-- REAL, pure decision function (src/runtime/fedos_dynamic_loader_dev_approval.ts,
("Dynamic Loader Dev Approval")                  Stage 578), fixed { approvalState: "PlanningOnly", approved: false,
     |                                          reason: "DevApprovalPending" } -- NO side effects, NO import() of any
     |                                          kind written, NEVER references the generated JS glue
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic)
     |                                          by the Dev Approval; the arrow above is positional (Stage 577's
     |                                          eight-condition table), not a real import
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

**Runtime connection does not exist. Worker connection does not
exist.** Neither `create_runtime.ts` nor `src/worker.ts` references
`fedos_dynamic_loader_dev_approval.ts`, directly or indirectly, and no
dev-only flag, environment variable, or code path anywhere in this
repository consults this approval's answer.
`docs/runtime_dynamic_loader_dev_approval.md` §1 conditions #2/#3/#7/#8
(dev build only, disabled in production, prohibited in Worker,
prohibited in production deploy) remain unimplemented as MECHANISMS —
only the DECISION that they must all hold is recorded here.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
580) read `dynamicLoaderDevApprovalState()`/
`dynamicLoaderDevApproved()`/`dynamicLoaderDevReason()` for DISPLAY
only — `"PlanningOnly"`/`false`/`"DevApprovalPending"`, matching every
other leaf in this arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_dynamic_loader_gate.ts` nor
`fedos_dynamic_loader_dev_approval.ts`); `WebAssembly.instantiate`/
`compile` never invoked; no static `import` and no dynamic `import()`
of the generated JS glue anywhere in this repository; no generated
file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-59
unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/
`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/
`"Open"`/`"Granted"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached;
Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/
`package.json` dependency added.

## Update — Stage 585–589: Explicit Crypto Initialization, revised diagram

Stage 585 (`docs/runtime_explicit_crypto_initialization.md`) fixes SIX
permanent rules for WHEN the generated JS glue/WASM may ever be
loaded, one level closer to Runtime's own call surface than the Dev
Approval's "under what conditions may activation ever happen": no
auto-load at startup, no implicit load on `encrypt`/`decrypt`, only a
future `initCrypto()`-style explicit call may ever load anything,
Runtime never knows WASM/JS Glue directly, everything routes through
Loader/Backend, Worker out of scope. Stage 586 adds
`src/runtime/fedos_explicit_crypto_initialization.ts` — a pure,
fixed-value DESIGN RECORD naming `createExplicitCryptoInitialization()`,
fixed `{ mode: "ExplicitInitialization", initializationAllowed: false,
initialized: false, reason: "InitializationApprovalPending" }` — with
NO side effects and NO `import()` of any kind (static or dynamic)
written anywhere in this file. Stage 587 wires
`createDynamicLoaderDevApproval()`
(`fedos_dynamic_loader_dev_approval.ts`) to CALL
`createExplicitCryptoInitialization()` — the result is DISCARDED and
`createDynamicLoaderDevApproval()`'s own return value is UNCHANGED
(`approved: false`), the SAME "reach one link deeper, keep your own
answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579 already established
eleven times over.

This revises the Stage 577–581 diagram — Explicit Crypto Initialization
now sits between Dynamic Loader Dev Approval and Generated JS Glue,
with a purely POSITIONAL "Dynamic Import" box named beneath it (the
exact `import()` call a future dynamic loader would eventually write,
per `docs/runtime_build_time_loader_strategy.md`'s Option C — still
never written anywhere in this repository):

```
FedosDynamicLoaderDevApproval                <-- REAL, pure decision function (src/runtime/fedos_dynamic_loader_dev_approval.ts,
("Dynamic Loader Dev Approval")                   Stage 578), REAL wiring: createDynamicLoaderDevApproval() calls
     |                                          createExplicitCryptoInitialization(), discards the result (Stage 587)
     v
FedosExplicitCryptoInitialization             <-- REAL, pure decision function (src/runtime/fedos_explicit_crypto_initialization.ts,
("Explicit Crypto Initialization")                Stage 586), fixed { mode: "ExplicitInitialization", initializationAllowed:
     |                                          false, initialized: false, reason: "InitializationApprovalPending" } --
     |                                          NO side effects, NO import() of any kind written, NEVER references the
     |                                          generated JS glue
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual, naming what a
     :  future, separate, explicitly-reviewed stage would eventually write, never a real wire)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

**Runtime connection does not exist. Worker connection does not
exist.** Neither `create_runtime.ts` nor `src/worker.ts` references
`fedos_explicit_crypto_initialization.ts`, directly or indirectly, and
no dev-only flag, environment variable, or code path anywhere in this
repository consults this design record's answer.
`docs/runtime_explicit_crypto_initialization.md` §1 rule #3 (only a
future explicit `initCrypto()`-style call may ever load anything)
remains unimplemented as a MECHANISM — only the DECISION that it must
hold is recorded here.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
588) read `cryptoInitializationMode()`/`cryptoInitializationAllowed()`/
`cryptoInitialized()`/`cryptoInitializationReason()` for DISPLAY only —
`"ExplicitInitialization"`/`false`/`false`/
`"InitializationApprovalPending"`, matching every other leaf in this
arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_dynamic_loader_dev_approval.ts` nor
`fedos_explicit_crypto_initialization.ts`); `WebAssembly.instantiate`/
`compile` never invoked; no static `import` and no dynamic `import()`
of the generated JS glue anywhere in this repository; no generated
file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-59
unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/
`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/
`"Open"`/`"Granted"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached;
Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/
`package.json` dependency added.

## Update — Stage 593–597: Crypto Loader Facade, revised diagram, target architecture named

Stage 593 (`docs/runtime_crypto_loader_facade.md`) is DESIGN ONLY — it
names a single, narrow seam Runtime/Provider code would eventually
call through, without implementing a real load of any kind. It fixes
the TARGET architecture (distinct from, and higher-level than, the
parked Dynamic-Loader arc below):

```
Crypto Runtime
        │
        ▼
Crypto Provider
        │
        ▼
Crypto Loader Facade
        │
        ▼
WASM Loader
        │
        ▼
Rust
```

**This target diagram is CONCEPTUAL — most of its arrows are NOT real
code wires today.** `Crypto Runtime`/`Crypto Provider` name
`create_runtime.ts`'s `AppRuntime.crypto`/`RuntimeCryptoProvider`
positionally — that existing wiring is real, but it terminates at
`PlaceholderRuntimeCryptoProvider`, and NEITHER `AppRuntime` NOR any
`RuntimeCryptoProvider` implementation imports or calls
`fedos_crypto_loader_facade.ts`. `WASM Loader` names
`fedos_wasm_loader.ts` positionally — the Facade does not import or
call it either. The ONE real wire this stage adds is BELOW the Facade
box in this diagram's own arc, not across it: Stage 594 adds
`src/runtime/fedos_crypto_loader_facade.ts` — a pure, fixed-value
FACADE naming `createCryptoLoaderFacade()`, fixed `{ state:
"PlanningOnly", initialized: false, backend: "WasmPlanned", reason:
"FacadeInitializationPending" }`, and `initializeCrypto()`, fixed `{
allowed: false, reason: "FacadeInitializationPending" }` — with NO
side effects and NO `import()` of any kind (static or dynamic)
written anywhere in this file. Stage 595 wired
`createExplicitCryptoInitialization()`
(`fedos_explicit_crypto_initialization.ts`) to CALL
`createCryptoLoaderFacade()` — the result was DISCARDED and
`createExplicitCryptoInitialization()`'s own return value stayed
UNCHANGED (`initializationAllowed: false`), the SAME "reach one link
deeper, keep your own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579/587 already
established twelve times over — AT THE TIME. **Stage 793 (Prototype
Phase 008) REMOVES this Stage 595 reach** — see that stage's own
update further below for why: connecting `fedos_wasm_backend.ts` to
the real `FedosWasmLoader` made this reach close a call-graph cycle
back through `fedos_dynamic_loader_dev_approval.ts` to
`fedos_explicit_crypto_initialization.ts`. `createExplicitCryptoInitialization()`
is now a TERMINUS; its own return value remains unchanged.

This revised the Stage 585–589 diagram from Stage 595 through Stage
792 — Crypto Loader Facade sat between Explicit Crypto Initialization
and the (still purely positional) Dynamic Import box; AS OF STAGE 793
THIS ARROW NO LONGER EXISTS IN CODE (kept below for historical record
only):

```
FedosExplicitCryptoInitialization             <-- REAL, pure decision function (src/runtime/fedos_explicit_crypto_initialization.ts,
("Explicit Crypto Initialization")                 Stage 586); Stage 595-792 REAL wiring: createExplicitCryptoInitialization()
     |                                          called createCryptoLoaderFacade(), discarding the result -- REMOVED at Stage 793
     v                                          (see that stage's update) to prevent a call-graph cycle; this file is now a TERMINUS
FedosCryptoLoaderFacade                    <-- REAL, pure decision function (src/runtime/fedos_crypto_loader_facade.ts,
("Crypto Loader Facade")                       Stage 594), fixed { state: "PlanningOnly", initialized: false, backend:
     |                                          "WasmPlanned", reason: "FacadeInitializationPending" }; initializeCrypto()
     |                                          fixed { allowed: false, reason: "FacadeInitializationPending" } -- NO side
     |                                          effects, NO import() of any kind written, NEVER references the WASM Loader,
     |                                          the generated JS glue, or Rust
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual, naming what a
     :  future, separate, explicitly-reviewed stage would eventually write, never a real wire)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

**Runtime connection does not exist. Worker connection does not
exist.** Neither `create_runtime.ts` nor `src/worker.ts` references
`fedos_crypto_loader_facade.ts`, directly or indirectly, and no
`RuntimeCryptoProvider` implementation calls
`createCryptoLoaderFacade()`/`initializeCrypto()`.
`docs/runtime_crypto_loader_facade.md` §2 responsibilities #1/#2
("Runtime sees only the Facade"/"Provider sees only the Facade")
remain unimplemented as MECHANISMS — the target-architecture diagram
above names the destination without rewiring `AppRuntime.crypto` to
reach it. Per the user's own Stage 597 instruction, the target diagram
STOPS at `Rust` and deliberately does NOT extend to `Dynamic
Import`/`Generated JS Glue` — those boxes belong only to the SEPARATE,
lower-level parked-chain diagram immediately above, not to the target
architecture itself.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
596) read `cryptoLoaderFacadeState()`/`cryptoLoaderFacadeBackend()`/
`cryptoLoaderFacadeInitialized()`/`cryptoLoaderFacadeReason()` for
DISPLAY only — `"PlanningOnly"`/`"WasmPlanned"`/`false`/
`"FacadeInitializationPending"`, matching every other leaf in this
arc.

**Still true after this update**: no Runtime/Worker connection of any
kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_explicit_crypto_initialization.ts` nor
`fedos_crypto_loader_facade.ts`); `WebAssembly.instantiate`/`compile`
never invoked; no static `import` and no dynamic `import()` of the
generated JS glue anywhere in this repository; no generated file
edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-59
unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/
`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/
`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Loaded"`/`"FailOpen"`
never reached; Rust public API unchanged (27 `pub fn`); no
`Cargo.toml`/`package.json` dependency added.

## Update — Stage 601–605: Crypto Provider / Facade Boundary, revised diagram

Stage 601 (`docs/runtime_crypto_provider_facade_boundary.md`) fixes a
dedicated BOUNDARY object sitting exactly at the Facade's own seam —
recording whether the Provider side (`providerConnected`) and the
Facade side (`facadeConnected`) have ever actually been connected to
one another, kept deliberately separate from
`FedosCryptoLoaderFacade`'s own `state`/`initialized` so the two
questions ("does a Provider know how to reach the Facade" vs. "is the
Facade itself ready") can be reasoned about independently. Stage 602
adds `src/runtime/fedos_crypto_provider_facade_boundary.ts` — a pure,
fixed-value BOUNDARY naming `createCryptoProviderFacadeBoundary()`,
fixed `{ state: "PlanningOnly", providerConnected: false,
facadeConnected: false, reason: "ProviderFacadeConnectionPending" }`
— with NO side effects and NO `import()` of any kind (static or
dynamic) written anywhere in this file. Stage 603 wires
`createCryptoLoaderFacade()` (`fedos_crypto_loader_facade.ts`) to CALL
`createCryptoProviderFacadeBoundary()` — the result is DISCARDED and
`createCryptoLoaderFacade()`'s own return value is UNCHANGED
(`initialized: false`), the SAME "reach one link deeper, keep your
own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579/587/595 already
established thirteen times over.

This revises the Stage 593–597 diagram — Provider/Facade Boundary now
sits between Crypto Loader Facade and the still-positional Dynamic
Import box:

```
FedosCryptoLoaderFacade                    <-- REAL, pure decision function (src/runtime/fedos_crypto_loader_facade.ts,
("Crypto Loader Facade")                       Stage 594), REAL wiring: createCryptoLoaderFacade() calls
     |                                          createCryptoProviderFacadeBoundary(), discards the result (Stage 603)
     v
FedosCryptoProviderFacadeBoundary          <-- REAL, pure decision function (src/runtime/fedos_crypto_provider_facade_boundary.ts,
("Provider/Facade Boundary")                   Stage 602), fixed { state: "PlanningOnly", providerConnected: false,
     |                                          facadeConnected: false, reason: "ProviderFacadeConnectionPending" } -- NO
     |                                          side effects, NO import() of any kind written, NEVER references the
     |                                          generated JS glue
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

**Runtime connection does not exist. Worker connection does not
exist.** Neither `create_runtime.ts` nor `src/worker.ts` references
`fedos_crypto_provider_facade_boundary.ts`, directly or indirectly, and
no `RuntimeCryptoProvider` implementation calls
`createCryptoProviderFacadeBoundary()`.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
604) read `providerFacadeBoundaryState()`/`providerFacadeConnected()`/
`providerFacadeReason()` for DISPLAY only —
`"PlanningOnly"`/`false`/`"ProviderFacadeConnectionPending"`, matching
every other leaf in this arc.

## Update — Stage 609–613: Provider Initialization Request Planning, revised diagram, target architecture extended

Stage 609 (`docs/runtime_crypto_provider_initialization_request.md`)
is PROVIDER-SIDE PLANNING one level ABOVE the Boundary: what a future
Provider implementation would actually HAND to the Boundary once
connected. It fixes the extended TARGET architecture:

```
Crypto Provider
        │
        ▼
Provider Initialization Request
        │
        ▼
Provider/Facade Boundary
        │
        ▼
Crypto Loader Facade
        │
        ▼
STOP
```

**This target diagram is CONCEPTUAL, exactly like the Stage 593
target diagram it extends — and per the user's own Stage 613
instruction, it deliberately STOPS at Crypto Loader Facade, without
extending further to WASM Loader/Rust/Dynamic Import/Generated JS
Glue.** No Provider implementation constructs or issues a request
today, and the Boundary does not accept one. The ONE real wire this
stage adds runs the OPPOSITE direction, deeper into the already-parked
chain (mirroring Stage 593/601's own pattern exactly): Stage 610 adds
`src/runtime/fedos_crypto_provider_initialization_request.ts` — a
pure, fixed-value REQUEST PLAN naming
`createCryptoProviderInitializationRequest()`, fixed `{ state:
"PlanningOnly", requested: false, allowed: false, reason:
"ProviderInitializationRequestPending" }` — with NO side effects and
NO `import()` of any kind (static or dynamic) written anywhere in this
file. Stage 611 wires `createCryptoProviderFacadeBoundary()`
(`fedos_crypto_provider_facade_boundary.ts`) to CALL
`createCryptoProviderInitializationRequest()` — the result is
DISCARDED and `createCryptoProviderFacadeBoundary()`'s own return
value is UNCHANGED (`providerConnected: false`), the SAME "reach one
link deeper, keep your own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603 already
established fourteen times over.

This revises the Stage 601–605 diagram — Provider Initialization
Request now sits between Provider/Facade Boundary and the
still-positional Dynamic Import box (NOTE: this is the PARKED
IMPLEMENTATION CHAIN's position, one level BELOW the Boundary —
DISTINCT from the target architecture diagram above, where the
request sits one level ABOVE the Boundary; the two diagrams show the
SAME four real files from two different, deliberately separate
vantage points, and neither is a claim about the other's arrow
direction):

```
FedosCryptoProviderFacadeBoundary          <-- REAL, pure decision function (src/runtime/fedos_crypto_provider_facade_boundary.ts,
("Provider/Facade Boundary")                   Stage 602), REAL wiring: createCryptoProviderFacadeBoundary() calls
     |                                          createCryptoProviderInitializationRequest(), discards the result (Stage 611)
     v
FedosCryptoProviderInitializationRequest   <-- REAL, pure decision function (src/runtime/fedos_crypto_provider_initialization_request.ts,
("Provider Initialization Request")            Stage 610), fixed { state: "PlanningOnly", requested: false, allowed: false,
     |                                          reason: "ProviderInitializationRequestPending" } -- NO side effects, NO
     |                                          import() of any kind written, NEVER references the generated JS glue
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

**Runtime connection does not exist. Worker connection does not
exist.** Neither `create_runtime.ts` nor `src/worker.ts` references
`fedos_crypto_provider_initialization_request.ts`, directly or
indirectly, and no `RuntimeCryptoProvider` implementation constructs
or issues a request.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
612) read `providerInitializationRequestState()`/
`providerInitializationRequested()`/`providerInitializationAllowed()`/
`providerInitializationReason()` for DISPLAY only —
`"PlanningOnly"`/`false`/`false`/
`"ProviderInitializationRequestPending"`, matching every other leaf in
this arc.

**Still true after Stage 601–613**: no Runtime/Worker connection of
any kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_crypto_loader_facade.ts`, `fedos_crypto_provider_facade_boundary.ts`,
nor `fedos_crypto_provider_initialization_request.ts`); no
`RuntimeCryptoProvider` implementation connects to the Facade or
issues a request; `WebAssembly.instantiate`/`compile` never invoked;
no static `import` and no dynamic `import()` of the generated JS glue
anywhere in this repository; no generated file edited or committed;
`encrypt`/`decrypt` unchanged; NIP-17/NIP-59 unimplemented;
`"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/
`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/
`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/
`"Loaded"`/`"FailOpen"` never reached; Rust public API unchanged (27
`pub fn`); no `Cargo.toml`/`package.json` dependency added.

## Update — Stage 617–621: Provider Initialization Approval, revised diagram

Stage 617 (`docs/runtime_provider_initialization_approval.md`) fixes a
dedicated APPROVAL step one level deeper than
`FedosCryptoProviderInitializationRequest.allowed` (Stage 610):
whether a SPECIFIC, already-issued request has actually been reviewed
and approved, distinct from whether the Boundary would structurally
accept one. Stage 618 adds
`src/runtime/fedos_provider_initialization_approval.ts` — a pure,
fixed-value APPROVAL naming
`createProviderInitializationApproval()`, fixed `{ state:
"PlanningOnly", approved: false, reason:
"ProviderInitializationApprovalPending" }` — with NO side effects and
NO `import()` of any kind (static or dynamic) written anywhere in this
file. Stage 619 wires `createCryptoProviderInitializationRequest()`
(`fedos_crypto_provider_initialization_request.ts`) to CALL
`createProviderInitializationApproval()` — the result is DISCARDED
and `createCryptoProviderInitializationRequest()`'s own return value
is UNCHANGED (`requested: false`, `allowed: false`), the SAME "reach
one link deeper, keep your own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611
already established fourteen times over.

This revises the Stage 609–613 diagram — Provider Initialization
Approval now sits between Provider Initialization Request and the
still-positional Dynamic Import box:

```
FedosCryptoProviderInitializationRequest   <-- REAL, pure decision function (src/runtime/fedos_crypto_provider_initialization_request.ts,
("Provider Initialization Request")            Stage 610), REAL wiring: createCryptoProviderInitializationRequest() calls
     |                                          createProviderInitializationApproval(), discards the result (Stage 619)
     v
FedosProviderInitializationApproval        <-- REAL, pure decision function (src/runtime/fedos_provider_initialization_approval.ts,
("Provider Initialization Approval")           Stage 618), fixed { state: "PlanningOnly", approved: false, reason:
     |                                          "ProviderInitializationApprovalPending" } -- NO side effects, NO import()
     |                                          of any kind written, NEVER references the generated JS glue
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

**Runtime connection does not exist. Worker connection does not
exist.** Neither `create_runtime.ts` nor `src/worker.ts` references
`fedos_provider_initialization_approval.ts`, directly or indirectly,
and no `RuntimeCryptoProvider` implementation approves a request.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
620) read `providerInitializationApprovalState()`/
`providerInitializationApproved()`/
`providerInitializationApprovalReason()` for DISPLAY only —
`"PlanningOnly"`/`false`/`"ProviderInitializationApprovalPending"`,
matching every other leaf in this arc.

## Update — Stage 625–630: Provider Init Facade Contract, revised diagram, full target architecture named

Stage 625 (`docs/runtime_provider_init_facade_contract.md`) fixes the
LAST layer before the already-real Provider/Facade Boundary
(`fedos_crypto_provider_facade_boundary.ts`, Stage 602): whether the
Provider side and the Facade side currently agree on a shared
call/return shape for `initializeCrypto()` — distinct from whether a
request has been approved. Stage 626 adds
`src/runtime/fedos_provider_init_facade_contract.ts` — a pure,
fixed-value CONTRACT naming `createProviderInitFacadeContract()`,
fixed `{ state: "PlanningOnly", contractReady: false, reason:
"ProviderInitFacadeContractPending" }` — with NO side effects and NO
`import()` of any kind (static or dynamic) written anywhere in this
file. Stage 627 wires `createProviderInitializationApproval()`
(`fedos_provider_initialization_approval.ts`) to CALL
`createProviderInitFacadeContract()` — the result is DISCARDED and
`createProviderInitializationApproval()`'s own return value is
UNCHANGED (`approved: false`), the SAME "reach one link deeper, keep
your own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619
already established fifteen times over.

This revises the Stage 617–621 diagram — Provider Init Facade
Contract now sits between Provider Initialization Approval and the
still-positional Dynamic Import box:

```
FedosProviderInitializationApproval        <-- REAL, pure decision function (src/runtime/fedos_provider_initialization_approval.ts,
("Provider Initialization Approval")           Stage 618), REAL wiring: createProviderInitializationApproval() calls
     |                                          createProviderInitFacadeContract(), discards the result (Stage 627)
     v
FedosProviderInitFacadeContract            <-- REAL, pure decision function (src/runtime/fedos_provider_init_facade_contract.ts,
("Provider Init Facade Contract")              Stage 626), fixed { state: "PlanningOnly", contractReady: false, reason:
     |                                          "ProviderInitFacadeContractPending" } -- NO side effects, NO import() of
     |                                          any kind written, NEVER references the generated JS glue
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

This update also extends the Stage 609 target-architecture diagram to
its FULL form, per Stage 625's own instruction — every real file added
across Stage 593–627, named in the order a future Provider would
eventually traverse them, still stopping at Crypto Loader Facade
without reaching WASM Loader/Rust/Dynamic Import/Generated JS Glue:

```
Crypto Provider
        │
        ▼
Provider Initialization Request
        │
        ▼
Provider Initialization Approval
        │
        ▼
Provider Init Facade Contract
        │
        ▼
Provider / Facade Boundary
        │
        ▼
Crypto Loader Facade
        │
        ▼
STOP
```

**This target diagram is CONCEPTUAL, exactly like the Stage 593/609
target diagrams it extends.** Every box in it names a REAL,
independently-tested file — `fedos_crypto_provider_initialization_request.ts`
(Stage 610), `fedos_provider_initialization_approval.ts` (Stage 618),
`fedos_provider_init_facade_contract.ts` (Stage 626),
`fedos_crypto_provider_facade_boundary.ts` (Stage 602),
`fedos_crypto_loader_facade.ts` (Stage 594) — but the ARROWS are
conceptual: no Provider implementation constructs a request, no
Approval ever grants one, no Contract is ever agreed, and the Boundary
never actually receives anything from a Provider. The real code wires
in this repository run the OPPOSITE direction, deeper into the parked
implementation chain shown in the diagram immediately above (Facade ->
Boundary -> Request -> Approval -> Contract -> Dynamic Import ->
Generated JS Glue -> STOP), each one reaching one link further and
discarding the result.

**Runtime connection does not exist. Worker connection does not
exist.** Neither `create_runtime.ts` nor `src/worker.ts` references
`fedos_provider_init_facade_contract.ts`, directly or indirectly, and
no `RuntimeCryptoProvider` implementation establishes a contract with
the Facade.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
628) read `providerInitFacadeContractState()`/
`providerInitFacadeContractReady()`/`providerInitFacadeContractReason()`
for DISPLAY only —
`"PlanningOnly"`/`false`/`"ProviderInitFacadeContractPending"`,
matching every other leaf in this arc.

**Still true after Stage 617–630**: no Runtime/Worker connection of
any kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_provider_initialization_approval.ts` nor
`fedos_provider_init_facade_contract.ts`); no `RuntimeCryptoProvider`
implementation approves a request or establishes a contract;
`WebAssembly.instantiate`/`compile` never invoked; no static `import`
and no dynamic `import()` of the generated JS glue anywhere in this
repository; no generated file edited or committed; `encrypt`/`decrypt`
unchanged; NIP-17/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/
`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/
`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/
`"Connected"`/`"Requested"`/`"Loaded"`/`"FailOpen"` never reached; Rust
public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json`
dependency added.

## Update — Stage 633–637: initializeCrypto API Contract, revised diagram

Stage 633 (`docs/runtime_initialize_crypto_api_contract.md`) fixes
whether `FedosCryptoLoaderFacade.initializeCrypto()` (Stage 594)
itself is currently CALLABLE, and whether it has ever actually run —
kept separate from `FedosProviderInitFacadeContract.contractReady`
(Stage 626), which only answers whether the two sides agree on a
SHAPE. Stage 634 adds
`src/runtime/fedos_initialize_crypto_api_contract.ts` — a pure,
fixed-value API CONTRACT naming
`createInitializeCryptoApiContract()`, fixed `{ state: "PlanningOnly",
callable: false, initialized: false, reason:
"InitializeCryptoApiPending" }` — with NO side effects and NO
`import()` of any kind (static or dynamic) written anywhere in this
file. Stage 635 wires `createProviderInitFacadeContract()`
(`fedos_provider_init_facade_contract.ts`) to CALL
`createInitializeCryptoApiContract()` — the result is DISCARDED and
`createProviderInitFacadeContract()`'s own return value is UNCHANGED
(`contractReady: false`), the SAME "reach one link deeper, keep your
own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627
already established sixteen times over.

This revises the Stage 625–630 diagram — initializeCrypto API
Contract now sits between Provider Init Facade Contract and the
still-positional Dynamic Import box:

```
FedosProviderInitFacadeContract            <-- REAL, pure decision function (src/runtime/fedos_provider_init_facade_contract.ts,
("Provider Init Facade Contract")              Stage 626), REAL wiring: createProviderInitFacadeContract() calls
     |                                          createInitializeCryptoApiContract(), discards the result (Stage 635)
     v
FedosInitializeCryptoApiContract           <-- REAL, pure decision function (src/runtime/fedos_initialize_crypto_api_contract.ts,
("initializeCrypto API Contract")              Stage 634), fixed { state: "PlanningOnly", callable: false, initialized:
     |                                          false, reason: "InitializeCryptoApiPending" } -- NO side effects, NO
     |                                          import() of any kind written, NEVER references the generated JS glue
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

**Runtime connection does not exist. Worker connection does not
exist.** Neither `create_runtime.ts` nor `src/worker.ts` references
`fedos_initialize_crypto_api_contract.ts`, directly or indirectly, and
`FedosCryptoLoaderFacade.initializeCrypto()` is never actually called
by anything in this file.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
636) read `initializeCryptoApiState()`/`initializeCryptoCallable()`/
`initializeCryptoInitialized()`/`initializeCryptoReason()` for DISPLAY
only — `"PlanningOnly"`/`false`/`false`/
`"InitializeCryptoApiPending"`, matching every other leaf in this
arc.

## Update — Stage 641–645: Crypto Initialization Result Contract, revised diagram, full target architecture extended

Stage 641 (`docs/runtime_crypto_initialization_result.md`) is the
TERMINUS of the Provider-side Planning arc begun at
`docs/runtime_crypto_provider_initialization_request.md` (Stage 609):
what a completed `initializeCrypto()` call would actually REPORT
back — success/failure, and which backend (if any) ultimately served
the request — kept separate from
`FedosInitializeCryptoApiContract.initialized` (Stage 634), which only
answers whether a call has ever completed, not whether it succeeded.
Stage 642 adds `src/runtime/fedos_crypto_initialization_result.ts` —
a pure, fixed-value RESULT CONTRACT naming
`createCryptoInitializationResult()`, fixed `{ state: "PlanningOnly",
success: false, backend: "None", reason:
"InitializationResultPending" }` — with NO side effects and NO
`import()` of any kind (static or dynamic) written anywhere in this
file. Stage 643 wires `createInitializeCryptoApiContract()`
(`fedos_initialize_crypto_api_contract.ts`) to CALL
`createCryptoInitializationResult()` — the result is DISCARDED and
`createInitializeCryptoApiContract()`'s own return value is UNCHANGED
(`callable: false`, `initialized: false`), the SAME "reach one link
deeper, keep your own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635
already established seventeen times over.

This revises the Stage 633–637 diagram — Crypto Initialization
Result Contract now sits between initializeCrypto API Contract and
the still-positional Dynamic Import box:

```
FedosInitializeCryptoApiContract           <-- REAL, pure decision function (src/runtime/fedos_initialize_crypto_api_contract.ts,
("initializeCrypto API Contract")              Stage 634), REAL wiring: createInitializeCryptoApiContract() calls
     |                                          createCryptoInitializationResult(), discards the result (Stage 643)
     v
FedosCryptoInitializationResult            <-- REAL, pure decision function (src/runtime/fedos_crypto_initialization_result.ts,
("Crypto Initialization Result Contract")      Stage 642), fixed { state: "PlanningOnly", success: false, backend: "None",
     |                                          reason: "InitializationResultPending" } -- NO side effects, NO import()
     |                                          of any kind written, NEVER references the generated JS glue
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

This update also extends the Stage 625 full target-architecture
diagram by TWO more boxes — every real file added across Stage
593–643, still stopping at this Result Contract without reaching WASM
Loader/Rust/Dynamic Import/Generated JS Glue:

```
Crypto Provider
        │
        ▼
Provider Initialization Request
        │
        ▼
Provider Initialization Approval
        │
        ▼
Provider Init Facade Contract
        │
        ▼
Provider / Facade Boundary
        │
        ▼
Crypto Loader Facade
        │
        ▼
InitializeCrypto API Contract
        │
        ▼
Crypto Initialization Result Contract
        │
        ▼
STOP
```

**This target diagram is CONCEPTUAL, exactly like the Stage 593/609/625
target diagrams it extends.** Every box in it names a REAL,
independently-tested file, but the ARROWS remain conceptual for the
Provider/Request/Approval/Contract/Boundary/Facade segment — see the
Stage 625 update above for that segment's exact real-vs-positional
breakdown. `initializeCrypto()` and `createCryptoInitializationResult()`
are the first two boxes in this diagram whose REAL code wiring runs in
the SAME direction as the diagram itself (API Contract -> Result
Contract), because they are the deepest links the parked
implementation chain has reached so far, not because the earlier
Provider-side segment's direction has changed.

**Runtime connection does not exist. Worker connection does not
exist.** Neither `create_runtime.ts` nor `src/worker.ts` references
`fedos_crypto_initialization_result.ts`, directly or indirectly, and
no initialization of any kind is ever run or completed by this file.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
644) read `cryptoInitializationResultState()`/
`cryptoInitializationSuccess()`/`cryptoInitializationBackend()`/
`cryptoInitializationResultReason()` for DISPLAY only —
`"PlanningOnly"`/`false`/`"None"`/`"InitializationResultPending"`,
matching every other leaf in this arc.

**Still true after Stage 633–645**: no Runtime/Worker connection of
any kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_initialize_crypto_api_contract.ts` nor
`fedos_crypto_initialization_result.ts`); no `RuntimeCryptoProvider`
implementation calls `initializeCrypto()` or produces a result;
`WebAssembly.instantiate`/`compile` never invoked; no static `import`
and no dynamic `import()` of the generated JS glue anywhere in this
repository; no generated file edited or committed; `encrypt`/`decrypt`
unchanged; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/
`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/
`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/
`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/`"Callable"`/
`"Completed"`/`"Wasm"`/`"Loaded"`/`"FailOpen"` never reached; Rust
public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json`
dependency added.

## Update — Stage 649–653: Runtime initializeCrypto Exposure Review, revised diagram

Stage 649 (`docs/runtime_initialize_crypto_exposure_review.md`) is the
FIRST layer in this arc that looks OUTWARD, toward Runtime, rather
than downward into the parked chain: whether `initializeCrypto()` is
currently exposed on `AppRuntime` in any way, and whether that
exposure has ever been reviewed and approved. Stage 650 adds
`src/runtime/fedos_initialize_crypto_exposure_review.ts` — a pure,
fixed-value REVIEW naming `createInitializeCryptoExposureReview()`,
fixed `{ state: "PlanningOnly", exposed: false, approved: false,
reason: "RuntimeExposureReviewPending" }` — with NO side effects and
NO `import()` of any kind (static or dynamic) written anywhere in this
file. Stage 651 wires `createCryptoInitializationResult()`
(`fedos_crypto_initialization_result.ts`) to CALL
`createInitializeCryptoExposureReview()` — the result is DISCARDED
and `createCryptoInitializationResult()`'s own return value is
UNCHANGED (`success: false`, `backend: "None"`), the SAME "reach one
link deeper, keep your own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635/643
already established seventeen times over.

This revises the Stage 641–645 diagram — Runtime initializeCrypto
Exposure Review now sits between Crypto Initialization Result
Contract and the still-positional Dynamic Import box:

```
FedosCryptoInitializationResult            <-- REAL, pure decision function (src/runtime/fedos_crypto_initialization_result.ts,
("Crypto Initialization Result Contract")      Stage 642), REAL wiring: createCryptoInitializationResult() calls
     |                                          createInitializeCryptoExposureReview(), discards the result (Stage 651)
     v
FedosInitializeCryptoExposureReview        <-- REAL, pure decision function (src/runtime/fedos_initialize_crypto_exposure_review.ts,
("Runtime initializeCrypto Exposure            Stage 650), fixed { state: "PlanningOnly", exposed: false, approved: false,
Review")                                       reason: "RuntimeExposureReviewPending" } -- NO side effects, NO import() of
     |                                          any kind written, NEVER references the generated JS glue
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

**Runtime connection does not exist. Worker connection does not
exist. `create_runtime.ts`/`src/worker.ts` are NOT modified by this
stage.** Neither file references
`fedos_initialize_crypto_exposure_review.ts`, directly or indirectly,
and `initializeCrypto()` is not exposed on `AppRuntime` in any way.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
652) read `initializeCryptoExposureState()`/`initializeCryptoExposed()`/
`initializeCryptoExposureApproved()`/`initializeCryptoExposureReason()`
for DISPLAY only — `"PlanningOnly"`/`false`/`false`/
`"RuntimeExposureReviewPending"`, matching every other leaf in this
arc.

## Update — Stage 657–661: Runtime initializeCrypto Wiring Plan, revised diagram, full target architecture named per Stage 649 instruction

Stage 657 (`docs/runtime_initialize_crypto_wiring_plan.md`) is the LAST
layer before any real connection could ever be attempted: even IF
exposure were someday approved, a Runtime connection and a Worker
connection are two SEPARATE decisions, evaluated independently. Stage
658 adds `src/runtime/fedos_initialize_crypto_wiring_plan.ts` — a
pure, fixed-value PLAN naming `createInitializeCryptoWiringPlan()`,
fixed `{ state: "PlanningOnly", runtimeWiringAllowed: false,
workerWiringAllowed: false, reason: "RuntimeWiringPlanPending" }` —
with NO side effects and NO `import()` of any kind (static or
dynamic) written anywhere in this file. Stage 659 wires
`createInitializeCryptoExposureReview()`
(`fedos_initialize_crypto_exposure_review.ts`) to CALL
`createInitializeCryptoWiringPlan()` — the result is DISCARDED and
`createInitializeCryptoExposureReview()`'s own return value is
UNCHANGED (`exposed: false`, `approved: false`), the SAME "reach one
link deeper, keep your own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635/643/651
already established eighteen times over.

This revises the Stage 649–653 diagram — Runtime initializeCrypto
Wiring Plan now sits between Runtime initializeCrypto Exposure Review
and the still-positional Dynamic Import box:

```
FedosInitializeCryptoExposureReview        <-- REAL, pure decision function (src/runtime/fedos_initialize_crypto_exposure_review.ts,
("Runtime initializeCrypto Exposure            Stage 650), REAL wiring: createInitializeCryptoExposureReview() calls
Review")                                       createInitializeCryptoWiringPlan(), discards the result (Stage 659)
     |
     v
FedosInitializeCryptoWiringPlan            <-- REAL, pure decision function (src/runtime/fedos_initialize_crypto_wiring_plan.ts,
("Runtime initializeCrypto Wiring Plan")       Stage 658), fixed { state: "PlanningOnly", runtimeWiringAllowed: false,
     |                                          workerWiringAllowed: false, reason: "RuntimeWiringPlanPending" } -- NO
     |                                          side effects, NO import() of any kind written, NEVER references the
     |                                          generated JS glue
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

Per the user's own Stage 649 instruction, this update also names the
FULL target-architecture diagram, from `Runtime` (Crypto Provider)
through this Wiring Plan's own `STOP`, in a single picture — including
`Explicit Crypto Initialization`, which no earlier target diagram in
this arc (Stage 593/609/625/641) named explicitly, even though its
real file (`fedos_explicit_crypto_initialization.ts`, Stage 586) has
existed since Stage 585–592:

```
Crypto Provider
        │
        ▼
Provider Initialization Request
        │
        ▼
Provider Initialization Approval
        │
        ▼
Provider Init Facade Contract
        │
        ▼
Provider / Facade Boundary
        │
        ▼
Crypto Loader Facade
        │
        ▼
Explicit Crypto Initialization
        │
        ▼
InitializeCrypto API Contract
        │
        ▼
Crypto Initialization Result Contract
        │
        ▼
Runtime initializeCrypto Exposure Review
        │
        ▼
Runtime initializeCrypto Wiring Plan
        │
        ▼
STOP
```

**This target diagram is CONCEPTUAL, exactly like the Stage 593/609/625/641
target diagrams it extends — every box names a REAL, independently-
tested file, but the ARROWS are conceptual for the Provider/Request/
Approval/Contract/Boundary/Facade segment (see the Stage 625 update
above for that segment's exact real-vs-positional breakdown).**

**Historical note, corrected at Stage 793 (Prototype Phase 008).**
From Stage 595 until Stage 793, `createExplicitCryptoInitialization()`
(Stage 587) additionally called `createCryptoLoaderFacade()` (Stage
595) — i.e. Explicit Crypto Initialization sat structurally ABOVE
Crypto Loader Facade in the real call graph, calling INTO it, not
below it as this target diagram's top-to-bottom reading might suggest.
That reach was harmless for exactly as long as nothing upstream of the
Facade ever called back down into `fedos_dynamic_loader_dev_approval.ts`'s
own chain. Stage 793 ended that isolation: `fedos_wasm_backend.ts` now
reaches `FedosWasmLoader.planLoad()`, whose own internal chain reaches
all the way down to `fedos_explicit_crypto_initialization.ts` — so the
Stage 595 reach into the Facade would now close a cycle (Facade →
Backend → Interface → WASM Backend → WASM Loader → … → Explicit Crypto
Initialization → Facade → …), causing unbounded recursion. Stage 793
REMOVES the Stage 595 reach: `createExplicitCryptoInitialization()` is
now a TERMINUS, calling nothing further, matching this target
diagram's own depiction all along (the Stage 595 reach into the Facade
was never shown in this diagram to begin with). Its own return value
is UNCHANGED.

**Runtime connection does not exist. Worker connection does not
exist. `create_runtime.ts`/`src/worker.ts` are NOT modified by this
stage.** Neither file references
`fedos_initialize_crypto_wiring_plan.ts`, directly or indirectly, and
no wiring of any kind — Runtime or Worker — is ever performed by this
file.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
660) read `initializeCryptoWiringPlanState()`/
`initializeCryptoRuntimeWiringAllowed()`/
`initializeCryptoWorkerWiringAllowed()`/
`initializeCryptoWiringPlanReason()` for DISPLAY only —
`"PlanningOnly"`/`false`/`false`/`"RuntimeWiringPlanPending"`,
matching every other leaf in this arc.

**Still true after Stage 649–661**: no Runtime/Worker connection of
any kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_initialize_crypto_exposure_review.ts` nor
`fedos_initialize_crypto_wiring_plan.ts`, and NEITHER FILE IS MODIFIED
BY THIS STAGE); `initializeCrypto()` is not exposed on `AppRuntime` in
any way; `WebAssembly.instantiate`/`compile` never invoked; no static
`import` and no dynamic `import()` of the generated JS glue anywhere
in this repository; no generated file edited or committed;
`encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59 unimplemented;
`"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/
`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/
`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/
`"Callable"`/`"Completed"`/`"Wasm"`/`"Exposed"`/`"Reviewed"`/`"Wired"`/
`"Loaded"`/`"FailOpen"` never reached; Rust public API unchanged (27
`pub fn`); no `Cargo.toml`/`package.json` dependency added.

## Update — Stage 665–669: Runtime initializeCrypto Public API, revised diagram

Stage 665 (`docs/runtime_initialize_crypto_public_api.md`) fixes the
SHAPE of what Runtime would actually expose to its own callers — a
public API surface, not the internal Facade/Boundary/Contract
machinery — whether `initializeCrypto()` is currently VISIBLE as a
public member on `AppRuntime`, and whether that member is CALLABLE.
Stage 666 adds `src/runtime/fedos_initialize_crypto_public_api.ts` —
a pure, fixed-value PUBLIC API DESIGN naming
`createInitializeCryptoPublicApi()`, fixed `{ state: "PlanningOnly",
apiVisible: false, callable: false, reason: "PublicApiPending" }` —
with NO side effects and NO `import()` of any kind (static or
dynamic) written anywhere in this file. Its own `callable` field is
DISTINCT from `FedosInitializeCryptoApiContract.callable` (Stage
634) — the earlier field answers whether the INTERNAL Facade-level
`initializeCrypto()` is callable; this one answers whether the
PUBLIC-FACING `AppRuntime` member is callable — see the doc's own §1.
Stage 667 wires `createInitializeCryptoWiringPlan()`
(`fedos_initialize_crypto_wiring_plan.ts`) to CALL
`createInitializeCryptoPublicApi()` — the result is DISCARDED and
`createInitializeCryptoWiringPlan()`'s own return value is UNCHANGED
(`runtimeWiringAllowed: false`, `workerWiringAllowed: false`), the
SAME "reach one link deeper, keep your own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635/643/651/659
already established nineteen times over.

This revises the Stage 657–661 diagram — Runtime initializeCrypto
Public API now sits between Runtime initializeCrypto Wiring Plan and
the still-positional Dynamic Import box:

```
FedosInitializeCryptoWiringPlan            <-- REAL, pure decision function (src/runtime/fedos_initialize_crypto_wiring_plan.ts,
("Runtime initializeCrypto Wiring Plan")       Stage 658), REAL wiring: createInitializeCryptoWiringPlan() calls
     |                                          createInitializeCryptoPublicApi(), discards the result (Stage 667)
     v
FedosInitializeCryptoPublicApi             <-- REAL, pure decision function (src/runtime/fedos_initialize_crypto_public_api.ts,
("Runtime initializeCrypto Public API")        Stage 666), fixed { state: "PlanningOnly", apiVisible: false, callable: false,
     |                                          reason: "PublicApiPending" } -- NO side effects, NO import() of any kind
     |                                          written, NEVER references the generated JS glue
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

**Runtime connection does not exist. Worker connection does not
exist. `create_runtime.ts`/`src/worker.ts` are NOT modified by this
stage.** Neither file references
`fedos_initialize_crypto_public_api.ts`, directly or indirectly, and
`initializeCrypto()` is not added as a member of `AppRuntime` — no
field, method, or property is added to `create_runtime.ts`.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
668) read `initializeCryptoPublicApiState()`/`initializeCryptoApiVisible()`/
`initializeCryptoPublicApiCallable()`/`initializeCryptoPublicApiReason()`
for DISPLAY only — `"PlanningOnly"`/`false`/`false`/
`"PublicApiPending"`, matching every other leaf in this arc.
`initializeCryptoPublicApiCallable` is DELIBERATELY named differently
from the pre-existing `initializeCryptoCallable` (Stage 636) to avoid
colliding with it in the flat diagnostics namespace — the two fields
answer different questions and are never conflated.

## Update — Stage 673–677: Runtime initializeCrypto Invocation Contract, revised diagram, full target architecture extended

Stage 673 (`docs/runtime_initialize_crypto_invocation_contract.md`) is
the LAST layer in this arc: even IF `initializeCrypto()` were someday
visible and callable as a public member, an actual INVOCATION — a real
caller actually invoking it — is a further, separate, EVENT-level
question, distinct from the STRUCTURAL question of callability. Stage
674 adds `src/runtime/fedos_initialize_crypto_invocation_contract.ts`
— a pure, fixed-value INVOCATION CONTRACT naming
`createInitializeCryptoInvocationContract()`, fixed `{ state:
"PlanningOnly", invocationAllowed: false, completed: false, reason:
"InvocationContractPending" }` — with NO side effects and NO
`import()` of any kind (static or dynamic) written anywhere in this
file. Stage 675 wires `createInitializeCryptoPublicApi()`
(`fedos_initialize_crypto_public_api.ts`) to CALL
`createInitializeCryptoInvocationContract()` — the result is
DISCARDED and `createInitializeCryptoPublicApi()`'s own return value
is UNCHANGED (`apiVisible: false`, `callable: false`), the SAME
"reach one link deeper, keep your own answer" pattern
Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635/643/651/659/667
already established twenty times over.

This revises the Stage 665–669 diagram — Runtime initializeCrypto
Invocation Contract now sits between Runtime initializeCrypto Public
API and the still-positional Dynamic Import box:

```
FedosInitializeCryptoPublicApi             <-- REAL, pure decision function (src/runtime/fedos_initialize_crypto_public_api.ts,
("Runtime initializeCrypto Public API")        Stage 666), REAL wiring: createInitializeCryptoPublicApi() calls
     |                                          createInitializeCryptoInvocationContract(), discards the result (Stage 675)
     v
FedosInitializeCryptoInvocationContract    <-- REAL, pure decision function (src/runtime/fedos_initialize_crypto_invocation_contract.ts,
("Runtime initializeCrypto Invocation          Stage 674), fixed { state: "PlanningOnly", invocationAllowed: false, completed:
Contract")                                     false, reason: "InvocationContractPending" } -- NO side effects, NO import()
     |                                          of any kind written, NEVER references the generated JS glue
     :
     : (POSITIONAL ONLY below this line -- no code implements or calls this box; the arrow is conceptual)
     v
Dynamic Import                             <-- CONCEPTUAL ONLY -- the dynamic import() a future dynamic loader would
     |                                          eventually write (Stage 561's Option C); NOT implemented, NOT written,
     |                                          anywhere in this repository
     v
Generated JS Glue                          <-- REAL FILE, observed (Stage 481) -- NOT imported (static OR dynamic) by
     |                                          anything in this chain
     v
STOP                                       <-- no further link exists; Runtime/Worker connection,
                                                 WebAssembly.instantiate/compile, static AND dynamic import()
                                                 all remain PROHIBITED
```

This update also extends the Stage 657 full target-architecture
diagram by two more boxes, exactly as requested — from `Runtime`
through this Invocation Contract's own `STOP`:

```
Crypto Provider
        │
        ▼
Provider Initialization Request
        │
        ▼
Provider Initialization Approval
        │
        ▼
Provider Init Facade Contract
        │
        ▼
Provider / Facade Boundary
        │
        ▼
Crypto Loader Facade
        │
        ▼
Explicit Crypto Initialization
        │
        ▼
InitializeCrypto API Contract
        │
        ▼
Crypto Initialization Result Contract
        │
        ▼
Runtime initializeCrypto Exposure Review
        │
        ▼
Runtime initializeCrypto Wiring Plan
        │
        ▼
Runtime initializeCrypto Public API
        │
        ▼
Runtime initializeCrypto Invocation Contract
        │
        ▼
STOP
```

**This target diagram is CONCEPTUAL, exactly like the Stage 593/609/625/641/657
target diagrams it extends — every box names a REAL, independently-
tested file, but the ARROWS remain conceptual for the
Provider/Request/Approval/Contract/Boundary/Facade/Explicit-Init
segment (see the Stage 657 update for that segment's exact
real-vs-positional breakdown).** `Runtime initializeCrypto Public
API`/`Runtime initializeCrypto Invocation Contract` are the THIRD and
FOURTH boxes in this diagram whose REAL code wiring runs in the SAME
direction as the diagram itself (continuing from `InitializeCrypto
API Contract`/`Crypto Initialization Result Contract`/`Runtime
initializeCrypto Exposure Review`/`Runtime initializeCrypto Wiring
Plan`), because they are the deepest links the parked implementation
chain has reached so far — not because the earlier segment's
direction has changed.

**Runtime connection does not exist. Worker connection does not
exist. `create_runtime.ts`/`src/worker.ts` are NOT modified by this
stage.** Neither file references
`fedos_initialize_crypto_invocation_contract.ts`, directly or
indirectly, and no invocation of any kind is ever attempted or
completed by this file.

`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
676) read `initializeCryptoInvocationState()`/
`initializeCryptoInvocationAllowed()`/`initializeCryptoInvocationCompleted()`/
`initializeCryptoInvocationReason()` for DISPLAY only —
`"PlanningOnly"`/`false`/`false`/`"InvocationContractPending"`,
matching every other leaf in this arc.

**Still true after Stage 665–677**: no Runtime/Worker connection of
any kind (`create_runtime.ts`/`src/worker.ts` reference neither
`fedos_initialize_crypto_public_api.ts` nor
`fedos_initialize_crypto_invocation_contract.ts`, and NEITHER FILE IS
MODIFIED BY THIS STAGE); `initializeCrypto()` is not exposed on, or
invoked from, `AppRuntime` in any way; `WebAssembly.instantiate`/
`compile` never invoked; no static `import` and no dynamic `import()`
of the generated JS glue anywhere in this repository; no generated
file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/
NIP-44/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/
`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/
`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/
`"Connected"`/`"Requested"`/`"Callable"`/`"Completed"`/`"Wasm"`/
`"Exposed"`/`"Wired"`/`"Visible"`/`"Invoked"`/`"Loaded"`/`"FailOpen"`
never reached; Rust public API unchanged (27 `pub fn`); no
`Cargo.toml`/`package.json` dependency added.

## Update — Stage 689–728: Prototype Phases 001–003, REAL Runtime wiring reaches the Crypto Loader Backend Abstraction

Every diagram above this section describes the `fedos_*.ts`
`PlanningOnly` chain's own internal target architecture — real,
independently-tested files connected by conceptual (mostly
not-yet-wired) arrows, with `create_runtime.ts`/`src/worker.ts`
explicitly unmodified throughout. Stage 689–728 is different in kind:
it is the first arc where `AppRuntime` itself gains a REAL, callable
member, and that member's REAL implementation reaches two links into
the pre-existing chain above.

```
Runtime (AppRuntime)                       <-- REAL member added Stage 690/691 (src/runtime/types.ts,
     |                                          src/runtime/create_runtime.ts) -- AppRuntime.initializeCrypto
     v                                          did not exist before Stage 691
initializeCrypto()                         <-- REAL, callable, fixed { allowed: false, initialized: false,
     |                                          reason: "PrototypeDisabled" } (createRuntimeInitializeCryptoResult,
     |                                          Stage 691) -- no Rust/WASM/Loader/generated-JS-glue call, no
     |                                          import() of any kind
     v
Crypto Loader Facade                       <-- REAL wiring: createRuntimeInitializeCryptoResult() calls
("fedos_crypto_loader_facade.ts",              createCryptoLoaderFacade() and DISCARDS the result (Stage 697) --
Stage 594, UNMODIFIED by Stage 697)            Runtime's own return value stays byte-for-byte unchanged
     |
     v
Crypto Loader Backend Abstraction          <-- REAL wiring: createCryptoLoaderFacade() ALSO calls
("fedos_crypto_loader_backend.ts",             createCryptoLoaderBackend() and DISCARDS the result (Stage 721) --
Stage 714)                                     fixed { state: "PlanningOnly", backendKind: "WasmPlanned",
     |                                          backendReady: false, reason: "BackendAbstractionPending" };
     |                                          the Facade's own return value stays byte-for-byte unchanged
     v
STOP                                       <-- no further link exists; the WASM Loader, the generated JS
                                                 glue, WebAssembly.instantiate/compile, initSync, the default
                                                 init export, and static/dynamic import() of any kind ALL
                                                 remain PROHIBITED and unreachable from this chain
```

**Every arrow above IS a real function call**, unlike the conceptual
target-architecture diagrams elsewhere in this document — this is the
one place in the entire `fedos_*.ts` arc where Runtime's OWN code
(`create_runtime.ts`) actually calls into the Planning chain, and the
Facade actually reaches one link further into the new Backend
Abstraction. Both the Facade and the Backend Abstraction discard
whatever they receive; nothing downstream ever changes what
`AppRuntime.initializeCrypto()` returns.

**Worker is explicitly OUT OF SCOPE for this entire arc.**
`src/worker.ts` is NOT modified by Stage 689–728, references neither
`initializeCrypto`, `fedos_crypto_loader_facade.ts`, nor
`fedos_crypto_loader_backend.ts`, directly or indirectly, and
`worker_crypto_diagnostics.ts` carries none of the new diagnostics
fields this arc adds — see
`docs/runtime_initialize_crypto_first_wiring_plan.md` §2, which named
Worker out of scope for the first wiring, a decision this arc has not
revisited.

**ONLY the Facade may call the Backend Abstraction.**
`createCryptoLoaderBackend()`'s only caller anywhere in this
repository is `fedos_crypto_loader_facade.ts`'s
`createCryptoLoaderFacade()` — `create_runtime.ts` never references
`fedos_crypto_loader_backend.ts` directly, and Runtime never learns
`backendKind`/`backendReady` in any way. This mirrors the SAME
Runtime-sees-only-the-Facade discipline `docs/runtime_crypto_loader_facade.md`
§2 already established for the WASM Loader and Rust.

**Division of responsibility, per
`docs/runtime_crypto_loader_backend_abstraction.md` §3**: Rust
(`packages/fedos-core-rust`) is responsible for cryptography, keys,
signatures, and safety boundaries only, and still does not know about
"backends" or JavaScript at all. Runtime never knows backend detail —
`"WasmPlanned"`/`"NativePlanned"`/`"PythonPlanned"` are never visible
past the Facade. The Facade stays a thin entry point for backend
selection: it asks the question and discards the answer.

`runtime_crypto_diagnostics.ts` (Stage 692/698/725) reads
`runtimeInitializeCryptoPrototypeExposed`/`...Allowed`/`...Reason`,
`runtimePrototypeFacadeReached`/`...Connected`/`...Reason`, and
`cryptoLoaderBackendState`/`...Kind`/`...Ready`/`...Reason` for
DISPLAY only — `worker_crypto_diagnostics.ts` is untouched by all
three additions.

**Still true throughout Stage 689–728**: `src/worker.ts` UNMODIFIED
and never references `initializeCrypto`,
`fedos_crypto_loader_facade.ts`, or `fedos_crypto_loader_backend.ts`;
`fedos_crypto_loader_facade.ts` UNMODIFIED in its own fixed return
values (`initialized: false`, `backend: "WasmPlanned"`); no
`WebAssembly.instantiate`/`compile`/`instantiateStreaming`/`initSync`/
default-init reference of any kind; no static `import` and no dynamic
`import()` of the generated JS glue anywhere in this repository; no
generated file edited or committed; `encrypt`/`decrypt` unchanged, in
Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/
`"Active"`/`"Ready"` never reached anywhere in this new chain; Rust
public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json`
dependency added.

## Update — Stage 729–744: Prototype Phase 004, REAL Backend Abstraction wiring reaches the WASM Backend Planning layer

Stage 689–728 (the update immediately above) ended with the Backend
Abstraction as the deepest REAL link Runtime's own wiring reaches.
Stage 729–744 extends that chain ONE FURTHER link — not from Runtime's
side, but from the Backend Abstraction's own side, mirroring the SAME
"reach one link deeper, keep your own answer" pattern this document's
Facade-and-below Planning chain has used since Stage 503.

```
Crypto Loader Backend Abstraction          <-- REAL, unchanged from Stage 689-728 (fixed { state: "PlanningOnly",
("fedos_crypto_loader_backend.ts",             backendKind: "WasmPlanned", backendReady: false, reason:
Stage 714)                                     "BackendAbstractionPending" })
     |
     v
WASM Backend Planning                      <-- REAL wiring: createCryptoLoaderBackend() ALSO calls
("fedos_wasm_backend.ts", Stage 730)           createWasmBackend() and DISCARDS the result (Stage 737) -- fixed
     |                                          { state: "PlanningOnly", backendReady: false, loaderAttached: false,
     |                                          loaderKind: "WasmLoaderPlanned", reason:
     |                                          "WasmBackendPlanningPending" }; the Backend Abstraction's own
     |                                          return value stays byte-for-byte unchanged
     v
STOP                                       <-- no further link exists; the real WASM Loader, the generated JS
                                                 glue, WebAssembly.instantiate/compile, initSync, the default
                                                 init export, and static/dynamic import() of any kind ALL
                                                 remain PROHIBITED and unreachable from this chain
```

**Every arrow above IS a real function call**, exactly like the Stage
689–728 diagram it extends. The Backend Abstraction's OWN return value
is UNCHANGED — reaching WASM Backend Planning and discarding its
answer does not alter `backendKind`/`backendReady`/`reason` in any
way, so the Facade's own return value and Runtime's own
`initializeCrypto()` return value are UNAFFECTED, transitively.

**Worker remains explicitly OUT OF SCOPE.** `src/worker.ts` is NOT
modified by Stage 729–744, references neither `initializeCrypto`,
`fedos_crypto_loader_facade.ts`, `fedos_crypto_loader_backend.ts`, nor
`fedos_wasm_backend.ts`, directly or indirectly, and
`worker_crypto_diagnostics.ts` carries none of this arc's new
diagnostics fields.

**ONLY the Backend Abstraction may call WASM Backend Planning.**
`createWasmBackend()`'s only caller anywhere in this repository is
`fedos_crypto_loader_backend.ts`'s `createCryptoLoaderBackend()` —
neither `create_runtime.ts`, `src/worker.ts`, nor
`fedos_crypto_loader_facade.ts` references `fedos_wasm_backend.ts`
directly, and Runtime never learns `loaderAttached`/`loaderKind` in
any way. This mirrors the SAME Runtime-sees-only-the-Facade /
Facade-sees-only-the-Backend-Abstraction discipline
`docs/runtime_crypto_loader_backend_abstraction.md` §3 already
established one link up.

**Division of responsibility, per
`docs/runtime_wasm_backend_planning.md` §3**: Rust
(`packages/fedos-core-rust`) is still responsible for cryptography,
keys, signatures, and safety boundaries only, and still does not know
about "backends," "loaders," or JavaScript at all. Runtime never
learns backend or loader detail — `loaderAttached`/`loaderKind` are
never visible past the Backend Abstraction.

`runtime_crypto_diagnostics.ts` (Stage 741) reads
`wasmBackendState`/`wasmBackendReady`/`wasmBackendLoaderAttached`/
`wasmBackendLoaderKind`/`wasmBackendReason` for DISPLAY only —
`worker_crypto_diagnostics.ts` is untouched by this addition.

**Still true throughout Stage 729–744**: `src/worker.ts` UNMODIFIED
and never references `initializeCrypto`,
`fedos_crypto_loader_facade.ts`, `fedos_crypto_loader_backend.ts`, or
`fedos_wasm_backend.ts`; `fedos_crypto_loader_backend.ts` UNMODIFIED in
its own fixed return value (`state: "PlanningOnly"`, `backendKind:
"WasmPlanned"`, `backendReady: false`, `reason:
"BackendAbstractionPending"`); no `WebAssembly.instantiate`/`compile`/
`instantiateStreaming`/`initSync`/default-init reference of any kind;
no static `import` and no dynamic `import()` of the generated JS glue
anywhere in this repository; no generated file edited or committed;
`encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/
NIP-59 unimplemented; `"Allowed"`/`"Active"`/`"Ready"` never reached
anywhere in this new chain; Rust public API unchanged (27 `pub fn`); no
`Cargo.toml`/`package.json` dependency added.

## Update — Stage 745–760: Prototype Phase 005, REAL Backend Abstraction wiring reaches the Backend Interface

**Positioning context.** `docs/fedos_runtime_positioning.md` fixes,
one level above this entire chain, what "FedOS" names in this
repository at all: a desktop-first Secure Runtime Platform running on
top of an existing OS (not a Tails/Whonix-style OS replacement), with
Rust owning cryptography/keys/signatures/safety only and TypeScript/
Python handling runtime glue and experimentation/EMSR/Ontology work
respectively. Mobile, Worker, and production activation remain
explicitly out of scope — this update does not change that, only
restates it in one place. The Backend Interface below is this
positioning's concrete echo: ONE shape for
`"WasmPlanned"`/`"NativePlanned"`/`"PythonPlanned"` candidates so
Runtime and the Backend Abstraction never branch on which is behind
it.

Stage 729–744 (the update immediately above) ended with WASM Backend
Planning as the deepest REAL link this arc reaches, wired directly
from the Backend Abstraction. Stage 745–760 INSERTS a new seam BETWEEN
those two links — the Backend Interface — replacing the Stage 737
direct wire, not extending past WASM Backend Planning.

```
Crypto Loader Backend Abstraction          <-- REAL, unchanged from Stage 689-744 (fixed { state: "PlanningOnly",
("fedos_crypto_loader_backend.ts",             backendKind: "WasmPlanned", backendReady: false, reason:
Stage 714)                                     "BackendAbstractionPending" })
     |
     v
Backend Interface                          <-- REAL wiring: createCryptoLoaderBackend() now calls
("fedos_crypto_backend_interface.ts",          createCryptoBackendInterface() INSTEAD OF calling createWasmBackend()
Stage 746)                                     directly (Stage 753) -- fixed { state: "PlanningOnly",
     |                                          backendSelected: "WasmPlanned", backendActivated: false,
     |                                          interfaceReady: false, reason: "BackendInterfacePending" }; the
     |                                          Backend Abstraction's own return value stays byte-for-byte unchanged
     v
WASM Backend Planning                      <-- REAL wiring: createCryptoBackendInterface() ALSO calls
("fedos_wasm_backend.ts", Stage 730,            createWasmBackend() and DISCARDS the result (Stage 746) -- fixed
UNMODIFIED by this stage)                       { state: "PlanningOnly", backendReady: false, loaderAttached: false,
     |                                          loaderKind: "WasmLoaderPlanned", reason:
     |                                          "WasmBackendPlanningPending" }, UNCHANGED from Stage 729-744, just
     |                                          reached one link further down; the Backend Interface's own return
     |                                          value stays byte-for-byte unchanged
     v
STOP                                       <-- no further link exists; the real WASM Loader, the generated JS
                                                 glue, WebAssembly.instantiate/compile, initSync, the default
                                                 init export, and static/dynamic import() of any kind ALL
                                                 remain PROHIBITED and unreachable from this chain
```

**Every arrow above IS a real function call**, exactly like the Stage
689–744 diagrams it extends. `fedos_wasm_backend.ts` itself is
UNMODIFIED by this stage — only WHICH file calls `createWasmBackend()`
changed (`fedos_crypto_backend_interface.ts` now, not
`fedos_crypto_loader_backend.ts` directly). The Backend Abstraction's
OWN return value, the Facade's own return value, and Runtime's own
`initializeCrypto()` return value are all UNAFFECTED, transitively.

**Worker remains explicitly OUT OF SCOPE.** `src/worker.ts` is NOT
modified by Stage 745–760, references neither `initializeCrypto`,
`fedos_crypto_loader_facade.ts`, `fedos_crypto_loader_backend.ts`,
`fedos_crypto_backend_interface.ts`, nor `fedos_wasm_backend.ts`,
directly or indirectly, and `worker_crypto_diagnostics.ts` carries none
of this arc's new diagnostics fields.

**ONLY the Backend Abstraction may call the Backend Interface, and
ONLY the Backend Interface may call WASM Backend Planning.**
`createCryptoBackendInterface()`'s only caller anywhere in this
repository is `fedos_crypto_loader_backend.ts`'s
`createCryptoLoaderBackend()`; `createWasmBackend()`'s only caller is
now `fedos_crypto_backend_interface.ts`'s
`createCryptoBackendInterface()` — neither `create_runtime.ts`,
`src/worker.ts`, nor `fedos_crypto_loader_facade.ts` references either
file directly, and Runtime never learns interface or loader detail in
any way. This mirrors the SAME layered discipline
`docs/runtime_crypto_backend_interface.md` §3 already established one
link up.

**Division of responsibility, per
`docs/runtime_crypto_backend_interface.md` §3**: Rust
(`packages/fedos-core-rust`) is still responsible for cryptography,
keys, signatures, and safety boundaries only. Runtime never learns
backend, interface, or loader detail — `backendSelected`/
`backendActivated`/`interfaceReady` are never visible past the Backend
Abstraction.

`runtime_crypto_diagnostics.ts` (Stage 757) reads
`cryptoBackendInterfaceState`/`cryptoBackendInterfaceReady`/
`cryptoBackendSelected`/`cryptoBackendActivated`/
`cryptoBackendInterfaceReason` for DISPLAY only —
`worker_crypto_diagnostics.ts` is untouched by this addition.

**Still true throughout Stage 745–760**: `src/worker.ts` UNMODIFIED
and never references `initializeCrypto`,
`fedos_crypto_loader_facade.ts`, `fedos_crypto_loader_backend.ts`,
`fedos_crypto_backend_interface.ts`, or `fedos_wasm_backend.ts`;
`fedos_crypto_loader_backend.ts` UNMODIFIED in its own fixed return
value (`state: "PlanningOnly"`, `backendKind: "WasmPlanned"`,
`backendReady: false`, `reason: "BackendAbstractionPending"`);
`fedos_wasm_backend.ts` UNMODIFIED in its own fixed return value
(`state: "PlanningOnly"`, `backendReady: false`, `loaderAttached:
false`, `loaderKind: "WasmLoaderPlanned"`, `reason:
"WasmBackendPlanningPending"`); no `WebAssembly.instantiate`/
`compile`/`instantiateStreaming`/`initSync`/default-init reference of
any kind; no static `import` and no dynamic `import()` of the
generated JS glue anywhere in this repository; no generated file
edited or committed; `encrypt`/`decrypt` unchanged, in Rust or
TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/`"Active"`/
`"Ready"` never reached anywhere in this new chain; Rust public API
unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency
added.

## Update — Stage 762–776: Prototype Phase 006, REAL Backend Interface wiring reaches the Backend Resolver

Stage 745–760 (the update immediately above) ended with the Backend
Interface reaching WASM Backend Planning as its one real leaf. Stage
762–776 gives the Interface a SECOND, separate leaf — the Backend
Resolver — alongside that pre-existing reach, not replacing it.

```
Backend Interface                          <-- REAL, unchanged from Stage 745-760 (fixed { state: "PlanningOnly",
("fedos_crypto_backend_interface.ts",          backendSelected: "WasmPlanned", backendActivated: false,
Stage 746)                                     interfaceReady: false, reason: "BackendInterfacePending" })
     |
     ├──────────────────────────────┐
     v                              v
WASM Backend Planning          Backend Resolver             <-- REAL wiring: createCryptoBackendInterface() now
("fedos_wasm_backend.ts",      ("fedos_crypto_backend_          calls createCryptoBackendResolver() as a SECOND,
Stage 730, UNCHANGED)          resolver.ts", Stage 763)          separate reach (Stage 764) -- fixed { state:
     |                              |                            "PlanningOnly", selectedBackend: "WasmPlanned",
     |                              |                            backendResolved: false, backendAvailable: false,
     |                              |                            reason: "BackendResolutionPending" }; the
     |                              |                            Interface's own return value stays byte-for-byte
     |                              |                            unchanged
     v                              v
    STOP                           STOP                      <-- no further link exists from either leaf; the real
                                                                   WASM Loader, the generated JS glue,
                                                                   WebAssembly.instantiate/compile, initSync, the
                                                                   default init export, and static/dynamic import()
                                                                   of any kind ALL remain PROHIBITED and
                                                                   unreachable from this chain
```

**Every arrow above IS a real function call**, exactly like the Stage
689–760 diagrams it extends. This is the FIRST branching point in the
Prototype Phase arc — `createCryptoBackendInterface()` now calls TWO
independent leaves and discards BOTH results, mirroring the SAME
"a second, separate reach" pattern `fedos_crypto_loader_facade.ts`
already established for `reachProviderFacadeBoundary()`/
`reachCryptoLoaderBackend()` (Stage 594/721). Neither leaf calls the
other; `fedos_wasm_backend.ts` is UNMODIFIED by this stage. The
Interface's OWN return value, the Backend Abstraction's own return
value, the Facade's own return value, and Runtime's own
`initializeCrypto()` return value are all UNAFFECTED, transitively.

**Worker remains explicitly OUT OF SCOPE.** `src/worker.ts` is NOT
modified by Stage 762–776, references neither `initializeCrypto`,
`fedos_crypto_loader_facade.ts`, `fedos_crypto_loader_backend.ts`,
`fedos_crypto_backend_interface.ts`, `fedos_wasm_backend.ts`, nor
`fedos_crypto_backend_resolver.ts`, directly or indirectly, and
`worker_crypto_diagnostics.ts` carries none of this arc's new
diagnostics fields.

**ONLY the Backend Interface may call the Backend Resolver.**
`createCryptoBackendResolver()`'s only caller anywhere in this
repository is `fedos_crypto_backend_interface.ts`'s
`createCryptoBackendInterface()` — neither `create_runtime.ts`,
`src/worker.ts`, `fedos_crypto_loader_facade.ts`, nor
`fedos_crypto_loader_backend.ts` references it directly, and Runtime
never learns resolver detail in any way. This mirrors the SAME layered
discipline `docs/runtime_crypto_backend_resolver.md` §3 already
established one link up.

**Division of responsibility, per
`docs/runtime_crypto_backend_resolver.md` §3**: Rust
(`packages/fedos-core-rust`) is still responsible for cryptography,
keys, signatures, and safety boundaries only. Runtime never learns
backend, interface, or resolver detail — `selectedBackend`/
`backendResolved`/`backendAvailable` are never visible past the
Backend Interface.

`runtime_crypto_diagnostics.ts` (Stage 774) reads
`cryptoBackendResolverState`/`cryptoBackendResolverSelected`/
`cryptoBackendResolved`/`cryptoBackendAvailable`/
`cryptoBackendResolverReason` for DISPLAY only —
`worker_crypto_diagnostics.ts` is untouched by this addition.

**Still true throughout Stage 762–776**: `src/worker.ts` UNMODIFIED
and never references `initializeCrypto`,
`fedos_crypto_loader_facade.ts`, `fedos_crypto_loader_backend.ts`,
`fedos_crypto_backend_interface.ts`, `fedos_wasm_backend.ts`, or
`fedos_crypto_backend_resolver.ts`; `fedos_crypto_backend_interface.ts`
UNMODIFIED in its own fixed return value (`state: "PlanningOnly"`,
`backendSelected: "WasmPlanned"`, `backendActivated: false`,
`interfaceReady: false`, `reason: "BackendInterfacePending"`);
`fedos_wasm_backend.ts` UNMODIFIED in its own fixed return value; no
`WebAssembly.instantiate`/`compile`/`instantiateStreaming`/`initSync`/
default-init reference of any kind; no static `import` and no dynamic
`import()` of the generated JS glue anywhere in this repository; no
generated file edited or committed; `encrypt`/`decrypt` unchanged, in
Rust or TypeScript; NIP-17/NIP-44/NIP-59, Double Ratchet, and Triple
Ratchet unimplemented; `"Allowed"`/`"Active"`/`"Resolved"`/
`"Available"` never reached anywhere in this new chain; Rust public
API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency
added.

## Update — Stage 793–808: Prototype Phase 008, REAL WASM Backend Planning wiring reaches the FedosWasmLoader Skeleton

Stage 762–776 (the update immediately above) ended with the Backend
Resolver and WASM Backend Planning as the two leaves the Backend
Interface reaches. Stage 793–808 extends WASM Backend Planning's OWN
leaf one link further — the FIRST time any code in this repository
reaches `fedos_wasm_loader.ts`'s `FedosWasmLoader` Skeleton, previously
"unwired" since Stage 489.

```
WASM Backend Planning                      <-- REAL, unchanged from Stage 729-792 (fixed { state: "PlanningOnly",
("fedos_wasm_backend.ts", Stage 730)           backendReady: false, loaderAttached: false, loaderKind:
     |                                          "WasmLoaderPlanned", reason: "WasmBackendPlanningPending" })
     v
FedosWasmLoader.planLoad()                 <-- REAL wiring: createWasmBackend() now constructs a FedosWasmLoader
("fedos_wasm_loader.ts", Stage 489-492,         and calls planLoad() (Stage 793) -- result DISCARDED; the previously
reached for the first time Stage 793)          "unwired" file (no caller besides tests since Stage 489) now has its
     |                                          first real caller
     v
BlockedByPolicy                            <-- fixed answer ({ operation: "load", state: "BlockedByPolicy",
     |                                          policy: "FailClosed", reason: "..." }); planLoad() itself only
     |                                          reaches its own internal Loader Plan (fedos_wasm_loader_plan.ts),
     |                                          never further -- UNCHANGED by this stage
     v
STOP                                       <-- no further link exists; the generated JS glue,
                                                 WebAssembly.instantiate/compile, initSync, the default init
                                                 export, and static/dynamic import() of any kind ALL remain
                                                 PROHIBITED and unreachable from this chain
```

**Critical fix required for this stage: a pre-existing call-graph
cycle.** `planLoad()`'s OWN internal chain (`fedos_wasm_loader_plan.ts`
→ `fedos_wasm_loader_import_policy.ts` → … → nine more files, per
`docs/runtime_architecture_simplification_review.md` "Chain 3")
terminates at `fedos_dynamic_loader_dev_approval.ts` calling
`fedos_explicit_crypto_initialization.ts`'s
`createExplicitCryptoInitialization()` — which, since Stage 595, ALSO
called `createCryptoLoaderFacade()` (see the Stage 593–597 update
above). Before Stage 793, that Stage 595 reach was harmless because
nothing upstream of the Facade ever called back down into Chain 3.
Once `fedos_wasm_backend.ts` (reachable FROM the Facade, via Backend
Abstraction and Backend Interface) also reaches INTO Chain 3 via
`planLoad()`, that Stage 595 reach would close a cycle — Facade →
Backend → Interface → WASM Backend → WASM Loader → … → Explicit Crypto
Initialization → Facade → … — causing unbounded recursion and a stack
overflow on every call to `createCryptoLoaderFacade()` (including
every call to `AppRuntime.initializeCrypto()`). **Stage 793 REMOVES
the Stage 595 reach**: `fedos_explicit_crypto_initialization.ts` no
longer imports or calls `fedos_crypto_loader_facade.ts` — it is now a
TERMINUS, exactly as `docs/runtime_internal_execution_contract.md`'s
own Stage 585–589 target diagram always depicted it (that diagram
never showed the Stage 595 reach to begin with). Its own return value
(`{ mode: "ExplicitInitialization", initializationAllowed: false,
initialized: false, reason: "InitializationApprovalPending" }`) is
UNCHANGED.

**Every arrow above IS a real function call**, exactly like the Stage
689–776 diagrams it extends. `createWasmBackend()`'s OWN return value
is UNCHANGED — reaching the real Loader and discarding its answer does
not alter `backendReady`/`loaderAttached`/`loaderKind`/`reason` in any
way, so the Backend Interface's own return value, the Backend
Abstraction's own return value, the Facade's own return value, and
Runtime's own `initializeCrypto()` return value are all UNAFFECTED,
transitively.

**Worker remains explicitly OUT OF SCOPE.** `src/worker.ts` is NOT
modified by Stage 793–808, references neither `initializeCrypto`,
`fedos_crypto_loader_facade.ts`, `fedos_crypto_loader_backend.ts`,
`fedos_crypto_backend_interface.ts`, `fedos_wasm_backend.ts`, nor
`fedos_wasm_loader.ts`, directly or indirectly, and
`worker_crypto_diagnostics.ts` carries none of this stage's new
diagnostics fields.

**ONLY WASM Backend Planning may call `FedosWasmLoader.planLoad()`.**
`createFedosWasmLoader()`'s only real (non-test) caller anywhere in
this repository is `fedos_wasm_backend.ts`'s `createWasmBackend()` —
neither `create_runtime.ts`, `src/worker.ts`,
`fedos_crypto_loader_facade.ts`, `fedos_crypto_loader_backend.ts`, nor
`fedos_crypto_backend_interface.ts` references it directly, and
Runtime never learns the Loader's own decision in any way.

**The Loader itself is unchanged in behavior.** `fedos_wasm_loader.ts`'s
own fixed answers (`loaderState()` = `"NotLoaded"`, `loaderMode()` =
`"PlanningOnly"`, `loaderPolicy()` = `"FailClosed"`, `planLoad()` =
`"BlockedByPolicy"`) are byte-for-byte identical to every stage since
489 — only WHO calls it changed, never what it returns.

`runtime_crypto_diagnostics.ts` (Stage 793) reads
`wasmBackendLoaderReached`/`wasmBackendLoaderLoaded`/
`wasmBackendLoaderDecision` for DISPLAY only —
`worker_crypto_diagnostics.ts` is untouched by this addition.

**Still true throughout Stage 793–808**: `src/worker.ts` UNMODIFIED
and never references `initializeCrypto`,
`fedos_crypto_loader_facade.ts`, `fedos_crypto_loader_backend.ts`,
`fedos_crypto_backend_interface.ts`, `fedos_wasm_backend.ts`, or
`fedos_wasm_loader.ts`; `fedos_wasm_backend.ts`'s own fixed return
value UNCHANGED (`state: "PlanningOnly"`, `backendReady: false`,
`loaderAttached: false`, `loaderKind: "WasmLoaderPlanned"`, `reason:
"WasmBackendPlanningPending"`); `fedos_wasm_loader.ts`'s own fixed
answers UNCHANGED; `fedos_explicit_crypto_initialization.ts` no longer
references `fedos_crypto_loader_facade.ts` (the Stage 595 reach
removed, see above) and its own fixed return value is UNCHANGED; no
call-graph cycle exists anywhere in this repository — calling
`createCryptoLoaderFacade()`, `createRuntime().initializeCrypto()`, or
any function in this chain terminates normally; no
`WebAssembly.instantiate`/`compile`/`instantiateStreaming`/`initSync`/
default-init reference of any kind; no static `import` and no dynamic
`import()` of the generated JS glue anywhere in this repository; no
generated file edited or committed; `encrypt`/`decrypt` unchanged, in
Rust or TypeScript; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple
Ratchet, and onion routing unimplemented; `"Allowed"`/`"Active"`/
`"Loaded"` never reached anywhere in this new chain; Rust public API
unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency
added.

## Update — Stage 825–840: Prototype Phase 011, `planLoad()` reaches `policy()` — a read, not an obedience

Stage 817 (not previously diagrammed here) added `FedosWasmLoader.policy()`
— a fixed `{ allowed: false, decision: "BlockedByPolicy", reason:
"PrototypePolicy" }` reader, independent of `planLoad()`/`planningState()`/
`status()`. Stage 825 makes `planLoad()` itself reach `policy()` — the
SAME "reach one link deeper, discard the result" pattern this whole
document already diagrams everywhere else — WITHOUT moving the `STOP`
below `BlockedByPolicy` from where the Stage 793 diagram above already
placed it:

```
FedosWasmLoader.planLoad()                 <-- REAL, unchanged since Stage 793: still constructs a
("fedos_wasm_loader.ts", Stage 489-492)         FedosWasmLoaderPlan and calls planImport() (Stage 503),
     |                                          result discarded
     +--> FedosWasmLoaderPlan.planImport()      <-- unchanged since Stage 503, result discarded, reaches no
     |    ("fedos_wasm_loader_plan.ts")             further file
     |
     +--> FedosWasmLoader.policy()               <-- NEW Stage 825 reach: planLoad() now ALSO calls
     |    ("fedos_wasm_loader.ts", Stage 817)         this.policy() exactly once via #reachLoaderPolicy() --
     |                                                result ({ allowed: false, decision: "BlockedByPolicy",
     |                                                reason: "PrototypePolicy" }) DISCARDED in full, never
     |                                                merged into planLoad()'s own return object, never
     |                                                branched on
     v
BlockedByPolicy                            <-- planLoad()'s OWN fixed answer, byte-for-byte UNCHANGED:
     |                                          { operation: "load", state: "BlockedByPolicy", policy:
     |                                          "FailClosed", reason: "..." }
     v
STOP                                       <-- SAME position as the Stage 793 diagram above -- not moved by
                                                 this stage; the generated JS glue, WebAssembly.instantiate/
                                                 compile, initSync, the default init export, and static/
                                                 dynamic import() of any kind ALL remain PROHIBITED and
                                                 unreachable from this chain
```

**This is a READ, not an obedience.** `planLoad()` now structurally
calls `policy()`, but its own return value, its own decision, and
whether it "proceeds" are completely unaffected by what `policy()`
says — `planLoad()` was already fixed at `"BlockedByPolicy"` before
this stage and stays fixed at `"BlockedByPolicy"` after it, for the
same fail-closed reason as always, not because `policy()` told it to
stop. `policy()` itself is unchanged and still does not call
`planLoad()`/`planningState()`/`status()` — so the new reach is
one-directional (`planLoad() -> policy()` only), and no cycle exists.
`planInitialize()`/`planUnload()`/`planningState()`/`status()` do NOT
call `policy()` and are untouched by this stage.

**Nothing past the Loader is touched.** `createWasmBackend()`
(`fedos_wasm_backend.ts`), the Backend Interface, the Backend
Abstraction, the Facade, and `AppRuntime.initializeCrypto()` all still
call `planLoad()` exactly as they did before Stage 825 and discard its
answer exactly as before — none of them, and none of `create_runtime.ts`/
`src/worker.ts`, references `policy()` directly or indirectly.

`src/runtime/runtime_crypto_diagnostics.ts` (Stage 825) reads
`loaderPlanReachedPolicy` (fixed `true`) for DISPLAY only —
`worker_crypto_diagnostics.ts` is untouched by this addition.

**Still true throughout Stage 825–840**: `src/worker.ts` UNMODIFIED and
never references `policy()`, `planLoad()`, or `initializeCrypto`;
`fedos_wasm_backend.ts`/Backend Interface/Backend Abstraction/Facade/
Runtime return values all UNCHANGED; no call-graph cycle exists
anywhere in this repository; no `WebAssembly.instantiate`/`compile`/
`instantiateStreaming`/`initSync`/default-init reference of any kind;
no static `import` and no dynamic `import()` of the generated JS glue
anywhere in this repository; no generated file edited or committed;
`encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/
NIP-59, Double Ratchet, Triple Ratchet, and onion routing
unimplemented; `"Allowed"` never reached anywhere in this chain; Rust
public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json`
dependency added.

## See also

- `src/runtime/fedos_wasm_loader.ts` (Stage 489–492, reached for real
  Stage 793) — the Loader Skeleton `fedos_wasm_backend.ts` now calls
  `planLoad()` on, unchanged in its own fixed behavior.
- `src/runtime/fedos_explicit_crypto_initialization.ts` (Stage 586,
  Facade reach REMOVED Stage 793) — the file whose Stage 595 reach
  into `fedos_crypto_loader_facade.ts` had to be removed to prevent
  the call-graph cycle Stage 793 would otherwise have closed; its own
  fixed return value is unchanged.
- `docs/runtime_wasm_backend_planning.md` (updated Stage 806) — the
  planning layer's own doc, recording the Loader connection in its §6.
- `docs/runtime_crypto_backend_resolver.md` (Stage 762) — the pure
  leaf this arc's REAL wiring now adds as a second, separate reach
  below the Backend Interface, answering ONLY "which backend is
  planned".
- `src/runtime/fedos_crypto_backend_resolver.ts` (Stage 763) — the
  Backend Resolver's real, fixed-value implementation, and its wiring
  from `fedos_crypto_backend_interface.ts` (Stage 764).
- `docs/fedos_runtime_positioning.md` — the repository-wide scope
  statement above this entire chain: Secure Runtime Platform,
  desktop-first, not an OS replacement, Rust owns crypto only.
- `docs/runtime_crypto_backend_interface.md` (Stage 745) — the common,
  backend-agnostic contract this arc's REAL wiring now inserts between
  the Backend Abstraction and WASM Backend Planning.
- `src/runtime/fedos_crypto_backend_interface.ts` (Stage 746) — the
  Backend Interface's real, fixed-value implementation, its wiring
  from `fedos_crypto_loader_backend.ts` (Stage 753), and its own reach
  into `fedos_wasm_backend.ts`.
- `docs/runtime_wasm_backend_planning.md` (Stage 729) — the thin
  planning seam directly below the Backend Abstraction this arc's REAL
  wiring now reaches, naming the loader-attachment fields a real WASM
  backend would eventually need.
- `src/runtime/fedos_wasm_backend.ts` (Stage 730) — the WASM Backend
  Planning layer's real, fixed-value implementation and its wiring
  from `fedos_crypto_loader_backend.ts` (Stage 737).
- `docs/runtime_crypto_loader_backend_abstraction.md` (Stage 713) —
  the thin, swappable seam directly below the Facade this arc's REAL
  wiring now reaches, and the three named (unconnected) backend
  candidates.
- `src/runtime/fedos_crypto_loader_backend.ts` (Stage 714) — the
  Backend Abstraction's real, fixed-value implementation and its
  wiring from `fedos_crypto_loader_facade.ts` (Stage 721).
- `docs/runtime_initialize_crypto_prototype.md` (Stage 689) — the
  start of Prototype Phase 001, where `AppRuntime.initializeCrypto()`
  first became a real, callable member.
- `docs/runtime_initialize_crypto_invocation_contract.md` (Stage 673)
  — the terminus of this Public API arc, and the full extended
  target-architecture diagram.
- `src/runtime/fedos_initialize_crypto_invocation_contract.ts` (Stage
  674–675) — the Invocation Contract's real, fixed-value
  implementation and its wiring from
  `fedos_initialize_crypto_public_api.ts`.
- `docs/runtime_initialize_crypto_public_api.md` (Stage 665) — the
  public-surface visibility/callability layer one level above the
  Invocation Contract.
- `src/runtime/fedos_initialize_crypto_public_api.ts` (Stage 666–667)
  — the Public API's real, fixed-value implementation and its wiring
  from `fedos_initialize_crypto_wiring_plan.ts`.
- `docs/runtime_initialize_crypto_wiring_plan.md` (Stage 657) — the
  last layer before any real connection, and the full extended
  target-architecture diagram naming `Explicit Crypto Initialization`.
- `src/runtime/fedos_initialize_crypto_wiring_plan.ts` (Stage
  658–659) — the Plan's real, fixed-value implementation and its
  wiring from `fedos_initialize_crypto_exposure_review.ts`.
- `docs/runtime_initialize_crypto_exposure_review.md` (Stage 649) —
  the first Runtime-facing layer, one level above the Wiring Plan.
- `src/runtime/fedos_initialize_crypto_exposure_review.ts` (Stage
  650–651) — the Review's real, fixed-value implementation and its
  wiring from `fedos_crypto_initialization_result.ts`.
- `docs/runtime_crypto_initialization_result.md` (Stage 641) — the
  terminus of the Provider-side Planning arc, and the full extended
  target-architecture diagram.
- `src/runtime/fedos_crypto_initialization_result.ts` (Stage 642–643)
  — the Result Contract's real, fixed-value implementation and its
  wiring from `fedos_initialize_crypto_api_contract.ts`.
- `docs/runtime_initialize_crypto_api_contract.md` (Stage 633) — the
  callability layer one level above the Result Contract.
- `src/runtime/fedos_initialize_crypto_api_contract.ts` (Stage
  634–635) — the API Contract's real, fixed-value implementation and
  its wiring from `fedos_provider_init_facade_contract.ts`.
- `docs/runtime_provider_init_facade_contract.md` (Stage 625) — the
  last layer before the Boundary, and the full target-architecture
  diagram.
- `src/runtime/fedos_provider_init_facade_contract.ts` (Stage
  626–627) — the Contract's real, fixed-value implementation and its
  wiring from `fedos_provider_initialization_approval.ts`.
- `docs/runtime_provider_initialization_approval.md` (Stage 617) — the
  approval step one level above the Contract.
- `src/runtime/fedos_provider_initialization_approval.ts` (Stage
  618–619) — the Approval's real, fixed-value implementation and its
  wiring from `fedos_crypto_provider_initialization_request.ts`.
- `docs/runtime_crypto_provider_initialization_request.md` (Stage
  609) — provider-side planning for a request one level above the
  Boundary in the target architecture.
- `src/runtime/fedos_crypto_provider_initialization_request.ts`
  (Stage 610–611) — the request plan's real, fixed-value
  implementation and its wiring from
  `fedos_crypto_provider_facade_boundary.ts`.
- `docs/runtime_crypto_provider_facade_boundary.md` (Stage 601) — the
  seam recording whether Provider and Facade have ever been
  connected.
- `src/runtime/fedos_crypto_provider_facade_boundary.ts` (Stage
  602–603) — the Boundary's real, fixed-value implementation and its
  wiring from `fedos_crypto_loader_facade.ts`.
- `docs/runtime_crypto_loader_facade.md` (Stage 593) — the target
  architecture (Crypto Runtime -> Crypto Provider -> Crypto Loader
  Facade -> WASM Loader -> Rust) and the Facade's six responsibilities.
- `src/runtime/fedos_crypto_loader_facade.ts` (Stage 594–595) — the
  Facade's real, fixed-value implementation and its wiring from
  `fedos_explicit_crypto_initialization.ts`.
- `docs/runtime_explicit_crypto_initialization.md` (Stage 585) — the
  six permanent rules for WHEN the generated JS glue/WASM may ever be
  loaded, all currently unimplemented as mechanisms.
- `src/runtime/fedos_explicit_crypto_initialization.ts` (Stage
  586–587) — the design record's real, fixed-value implementation and
  its wiring from `fedos_dynamic_loader_dev_approval.ts`.
- `docs/runtime_dynamic_loader_dev_approval.md` (Stage 577) — the
  eight dev-only conditions a future dynamic loader activation would
  need to satisfy, all currently unmet.
- `src/runtime/fedos_dynamic_loader_dev_approval.ts` (Stage 578–579) —
  the approval's real, fixed-value implementation and its wiring from
  `fedos_dynamic_loader_gate.ts`.
- `docs/runtime_dynamic_loader_gate.md` (Stage 569) — the eight
  minimum conditions a future dynamic loader implementation would need
  to satisfy, all currently unmet.
- `src/runtime/fedos_dynamic_loader_gate.ts` (Stage 570–571) — the
  gate's real, fixed-value implementation and its wiring from
  `fedos_build_time_loader_strategy.ts`.
- `docs/runtime_build_time_loader_strategy.md` (Stage 561) — the
  three candidate future loading strategies, and why Option C (dynamic
  loader with an explicit dev-only gate) is designated but not
  implemented.
- `src/runtime/fedos_build_time_loader_strategy.ts` (Stage 562–563) —
  the Loader Strategy's real, fixed-value implementation and its
  wiring from `fedos_generated_artifact_distribution.ts`.
- `docs/runtime_generated_artifact_distribution_policy.md` (Stage 553)
  — the standing Option A vs. Option B distribution policy, and why
  this repository adopts Option B (build-time generation only).
- `src/runtime/fedos_generated_artifact_distribution.ts` (Stage
  554–555) — the Distribution Policy's real, fixed-value
  implementation and its wiring from
  `fedos_static_import_activation_review.ts`.
- `docs/runtime_static_import_activation_review.md` (Stage 545) — the
  final gate before real static import, gathering every prior gate's
  answer into one named activation decision.
- `src/runtime/fedos_static_import_activation_review.ts` (Stage
  546–547) — the Activation Review's real, fixed-value implementation
  and its wiring from `fedos_generated_artifact_presence.ts`.
- `docs/runtime_generated_artifact_presence_policy.md` (Stage 537) —
  the last safety layer before a static import, fixing what "present"
  and "usable" would need to mean, and why they differ.
- `src/runtime/fedos_generated_artifact_presence.ts` (Stage 538–539) —
  the Presence Policy's real, fixed-value implementation and its
  wiring from `fedos_wasm_static_import_readiness.ts`.
- `docs/runtime_wasm_static_import_readiness.md` (Stage 533) — the
  eight-condition readiness checklist required after Safety Review
  passes, all currently unmet or insufficient alone.
- `src/runtime/fedos_wasm_static_import_readiness.ts` (Stage 534–535)
  — the readiness record's real, fixed-value implementation and its
  wiring from `fedos_wasm_static_import_review.ts`.
- `docs/runtime_wasm_static_import_safety_review.md` (Stage 525) — the
  safety review of what would break if the static import were written
  today, and why the generated artifact can never be committed as a
  workaround.
- `src/runtime/fedos_wasm_static_import_review.ts` (Stage 526–527) —
  the Safety Review's real, fixed-value implementation and its wiring
  from `FedosWasmStaticImportPlanSkeleton.planStaticImport()`.
- `docs/runtime_wasm_static_import_plan.md` (Stage 517) — the exact
  static import target and expected exports.
- `src/runtime/fedos_wasm_static_import_plan.ts` (Stage 518–519) —
  the Static Import Plan's real, fixed-value implementation and its
  wiring from `evaluateWasmLoaderImportPolicy()`.
- `docs/runtime_wasm_loader_import_policy.md` (Stage 509) — the
  six-condition import policy: Loader Plan import allowed, generated
  artifact present, artifact untracked/gitignored, Runtime dev-only
  approval, no Worker approval, Execution Review approval.
- `src/runtime/fedos_wasm_loader_import_policy.ts` (Stage 510–511) —
  the Import Policy's real, fixed-value implementation and its wiring
  from `FedosWasmLoaderPlan.planImport()`.
- `docs/runtime_wasm_loader_planning.md` (Stage 501) — the five-phase
  ordering: Loader Creation, Import Permission, Initialization
  Permission, Runtime Attach, Worker Attach.
- `src/runtime/fedos_wasm_loader_plan.ts` (Stage 502–503) — the Loader
  Plan's real, fixed-value implementation and its wiring from
  `FedosWasmLoader.planLoad()`.
- `docs/runtime_wasm_loader.md` (Stage 493) — the Loader Skeleton's
  own policy document: `NotLoaded`/`PlanningOnly`/`FailClosed`.
- `src/runtime/fedos_wasm_loader.ts` (Stage 489–492) — the Loader
  Skeleton's real, fixed-value implementation.
- `docs/runtime_internal_rust_call.md` (Stage 353–360) — the
  specification for what link 12 would eventually need, without
  implementing it.
- `docs/runtime_execution_backend.md` (Stage 401–408) — link 9's own
  model and wiring, and the formal re-framing of WASM (link 10) as the
  first Execution Backend candidate rather than the only one.
- `docs/runtime_rust_boundary_decision.md` (Stage 385) — the original
  decision that WASM is the sole official MVP candidate.
- `docs/runtime_wasm_boundary.md` (Stage 386–390) — link 10's own model
  and wiring (now reached through link 9, unchanged file otherwise).
- `docs/runtime_wasm_artifact.md` (Stage 393–400) — link 11's own
  model and wiring, plus the planning-only build pipeline it belongs
  to.
- `docs/runtime_fedos_execution_approval_checklist.md` (Stage 348) —
  the eight-item approval checklist this contract's "why it stops
  here" section references.
- `docs/runtime_wasm_build_contract.md` (Stage 418, updated 427, 434,
  445) — the BUILD-direction diagram this update's CALL-direction
  diagram complements.
- `docs/runtime_wasm_js_glue_contract.md` (Stage 481) — the direct
  observation behind the "Generated JS Glue" box in this update's
  diagram.
- `src/runtime/fedos_wasm_loader_contract.ts` (Stage 482) — the
  `FedosWasmLoaderContract` box's real, fixed-value implementation.
- `docs/runtime_wasm_artifact_observation.md` §10 (Stage 476) — the
  first successful generation run that makes the "Generated JS Glue"/
  "Generated .wasm" boxes real files rather than a hypothetical.
