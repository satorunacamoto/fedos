# FedOS WASM Loader Skeleton — Stage 489–493

**Status: this document records real code's current state — the
Loader Skeleton is, and remains, in a PROHIBITED state. It plans
three operations; it performs none of them.**

`docs/runtime_wasm_js_glue_contract.md` (Stage 481) observed what the
real, locally-generated `wasm-bindgen` JS glue exports.
`src/runtime/fedos_wasm_loader_contract.ts` (Stage 482) named a fixed
CONTRACT SHAPE — a `status()`-only read. `src/runtime/fedos_wasm_loader.ts`
(Stage 489–492, this document's subject) is the next, separate link:
a SKELETON that also names the three OPERATIONS a real loader would
eventually perform — `planLoad()`, `planInitialize()`, `planUnload()`
— each one PLANNED, never executed.

## 1. Three states this document names

| Concept | Field | Fixed value | Meaning |
|---|---|---|---|
| Loader state | `FedosWasmLoaderStatus.state` | `"NotLoaded"` | No WASM module has ever actually been loaded. `"Loaded"` is RESERVED — a future, separate, explicitly-reviewed stage's label, unreachable from this file. |
| Operating mode | `FedosWasmLoaderStatus.mode` | `"PlanningOnly"` | This loader only ever PLANS an operation (returns a decision describing what WOULD happen); it never performs one. `"Active"` is RESERVED, unreachable. |
| Fail-safety policy | `FedosWasmLoaderStatus.policy` | `"FailClosed"` | Every planned operation (`planLoad`/`planInitialize`/`planUnload`) is DENIED by policy — not merely "not implemented yet". `"FailOpen"` is RESERVED, unreachable, and would be a dangerous default this codebase never adopts. |

Every `planLoad()`/`planInitialize()`/`planUnload()` call resolves a
`FedosWasmLoaderDecision` with `state: "BlockedByPolicy"` — the ONLY
value `FedosWasmLoaderDecisionState` ever actually produces in this
stage. `"Allowed"` exists in the type only as a RESERVED label.

## 2. What this stage does NOT do

- Does not import, `require()`, or dynamically `import()`
  `fedos_core_rust.js`/`fedos_core_rust_bg.wasm`, or any other
  generated artifact.
- Does not call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`fetch`.
- Does not wire `FedosWasmLoader` to `FedosWasmLoaderContract`
  (Stage 482), `FedosWasmArtifact`, `FedosWasmBoundary`,
  `ExecutionBackend`, `create_runtime.ts`, or `src/worker.ts` —
  deliberately UNWIRED, the same discipline
  `fedos_wasm_loader_contract.ts` already established.
- Does not edit or commit any generated file under
  `packages/fedos-core-rust/pkg/`.
- Does not touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`), Runtime activation, or Worker activation.

## 3. Why "FailClosed" instead of just "not implemented"

Every earlier link in this WASM arc (`FedosWasmBoundary`,
`FedosWasmArtifact`, `FedosWasmLoaderContract`) denies by reporting a
state like `"BlockedByImplementation"`/`"NotLoaded"` — implying only
that the feature has not been built yet. `FedosWasmLoader` names the
denial as a POLICY instead: even once a real implementation exists,
`FailClosed` states the codebase's INTENT that loading stays denied
until a future, separate, explicitly-reviewed stage flips it — not an
accident of incomplete work. This mirrors the dual-lock discipline
`docs/runtime_crypto_activation_policy.md` already applies to Rust
crypto activation, applied here to the WASM loader specifically.

## See also

- `docs/runtime_wasm_js_glue_contract.md` (Stage 481) — the direct
  observation behind the generated JS glue this skeleton never
  imports.
- `src/runtime/fedos_wasm_loader_contract.ts` (Stage 482) — the prior,
  `status()`-only contract link; `src/runtime/fedos_wasm_loader.ts`
  (Stage 489–492) does not reference it.
- `docs/runtime_internal_execution_contract.md` (Stage 494) — the
  updated diagram naming the Loader Skeleton as a distinct box that
  stops immediately after Generated JS Glue.
- `docs/runtime_crypto_activation_policy.md` — the dual-lock
  discipline this document's `FailClosed` framing mirrors.
