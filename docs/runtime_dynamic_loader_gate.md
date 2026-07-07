# FedOS Dynamic Loader Gate — Stage 569

**Status: this document records real code's current state — no
dynamic `import()` is implemented by this stage, no import (static or
dynamic) happens as a side effect of anything here, and both remain
PROHIBITED. Runtime/Worker connection and `WebAssembly.instantiate`
remain PROHIBITED as well.**

`docs/runtime_build_time_loader_strategy.md` (Stage 561) designated
Option C — a dynamic loader with an explicit dev-only gate — as the
future candidate loading strategy, without implementing it. THIS
document is that GATE: it fixes the minimum conditions a future,
separate, explicitly-reviewed stage would need to satisfy before a
dynamic `import()` of the generated JS glue could ever be written and
executed. Naming the gate is not opening it — every condition below
is, and remains, UNMET.

## 1. The eight minimum conditions, all currently unmet

| # | Condition | Question it answers | State today |
|---|---|---|---|
| 1 | **Build-Time Loader Strategy complete** | Has the loader strategy decision (Stage 562) been finalized as something other than a placeholder? | ❌ NO — `createBuildTimeLoaderStrategy()` fixed `"DynamicLoaderPlanned"`, itself only a plan |
| 2 | **Generated Artifact Distribution policy finalized** | Is `docs/runtime_generated_artifact_distribution_policy.md`'s Option B choice the SETTLED answer, not subject to change mid-gate? | ❌ NO — recorded as current policy, not yet exercised through a real load |
| 3 | **Static Import Review complete** | Has `docs/runtime_wasm_static_import_safety_review.md`'s Safety Review ever resolved `approved: true`? | ❌ NO — fixed `approved: false` (Stage 526) |
| 4 | **Runtime Activation Review complete** | Has `docs/runtime_static_import_activation_review.md`'s Activation Review ever resolved `approved: true`? | ❌ NO — fixed `approved: false` (Stage 546) |
| 5 | **Runtime dev-only** | Would any dynamic loader activation be gated to a dev-only, non-default, explicit flag — never default-on, never Worker-reachable? | ❌ NOT YET DEFINED — no such flag exists in this repository |
| 6 | **Fail Closed maintained** | Does every link in this chain still deny by default? | ✅ YES — every placeholder in this arc still returns a fixed denial |
| 7 | **Generated JS Glue unmodified** | Is the generated JS glue/`.wasm` pair used exactly as `wasm-bindgen` produces it, with no hand-edits? | ✅ YES, BY CONSTRUCTION — nothing in this repository edits generated output; `docs/runtime_wasm_js_glue_contract.md` (Stage 481) records it as directly observed, unmodified |
| 8 | **Worker out of scope** | Does Worker (`src/worker.ts`) stay OUT of any dynamic loader activation? | ✅ BY DESIGN — a dynamic loader gate, if ever opened, is Runtime-side ONLY; Worker approval is never sought here |

**Every condition must hold simultaneously before the Dynamic Loader
Gate could ever open.** Today, #1, #2, #3, #4, and #5 are each
independently sufficient to keep the gate closed — #6, #7, and #8
already hold, by construction, but that alone changes nothing.

## 2. What "the gate" means

This gate is a NAMED DECISION POINT, not a mechanism. Nothing in this
repository currently implements a dynamic `import()`, a dev-only flag,
or any runtime code path that would consult this gate's answer before
acting — `src/runtime/fedos_dynamic_loader_gate.ts` (Stage 570) only
ever RECORDS the gate's fixed, closed state
(`{ gateState: "PlanningOnly", dynamicLoaderAllowed: false, reason:
"DynamicLoaderGatePending" }`). Opening the gate — writing the actual
dynamic `import()`, the dev-only flag, and the code that consults
both — is explicitly left to a future, separate, explicitly-reviewed
stage that would need to satisfy ALL eight conditions above first.

## 3. What this stage does NOT do

- Does **not** write a dynamic `import()` of any kind, anywhere in
  this repository's source.
- Does **not** write the static `import` statement named by
  `docs/runtime_wasm_static_import_plan.md`.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this — no Runtime connection of any kind
  exists yet, even a dev-only one.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_build_time_loader_strategy.md` (Stage 561) — the
  Option C designation this gate's conditions would need to satisfy
  before that candidate could ever be implemented.
- `docs/runtime_wasm_static_import_safety_review.md` (Stage 525) —
  the Safety Review, condition #3 above.
- `docs/runtime_static_import_activation_review.md` (Stage 545) — the
  Activation Review, condition #4 above.
- `docs/runtime_wasm_js_glue_contract.md` (Stage 481) — the direct
  observation that the generated JS glue is unmodified, condition #7
  above.
- `src/runtime/fedos_dynamic_loader_gate.ts` (Stage 570–571) — the
  real, fixed-value implementation of this gate and its wiring from
  `fedos_build_time_loader_strategy.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 573) —
  the diagram naming Dynamic Loader Gate's position between Build-Time
  Loader Strategy and Generated JS Glue, and confirming no Runtime
  connection exists yet.
