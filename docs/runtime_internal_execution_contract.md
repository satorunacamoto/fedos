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

## See also

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
