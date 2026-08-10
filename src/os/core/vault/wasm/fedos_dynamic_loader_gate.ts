/**
 * Stage 570 — FedOS Dynamic Loader Gate (pure data, fixed value only).
 *
 * `docs/runtime_dynamic_loader_gate.md` (Stage 569) fixes EIGHT
 * minimum conditions a future, separate, explicitly-reviewed stage
 * would need to satisfy before a dynamic `import()` of the generated
 * JS glue could ever be written and executed — Build-Time Loader
 * Strategy complete, Generated Artifact Distribution policy
 * finalized, Static Import Review complete, Runtime Activation Review
 * complete, Runtime dev-only gating, Fail Closed maintained, Generated
 * JS Glue unmodified, Worker out of scope. THIS file is the real,
 * fixed-value implementation of that gate: `createDynamicLoaderGate()`
 * always resolves `{ gateState: "PlanningOnly", dynamicLoaderAllowed:
 * false, reason: "DynamicLoaderGatePending" }` — it never writes a
 * dynamic `import()` and never references the generated JS glue.
 *
 * Stage 571 wires `src/runtime/fedos_build_time_loader_strategy.ts`'s
 * `createBuildTimeLoaderStrategy()` to CALL
 * `createDynamicLoaderGate()` — the result is DISCARDED, and
 * `createBuildTimeLoaderStrategy()`'s own return value stays UNCHANGED
 * (`strategy: "DynamicLoaderPlanned"`). That is one caller of this
 * file; neither `create_runtime.ts` nor `src/worker.ts` references it,
 * directly or indirectly.
 *
 * Stage 579 extends `createDynamicLoaderGate()` DOWNWARD only: it now
 * calls `createDynamicLoaderDevApproval()`
 * (`fedos_dynamic_loader_dev_approval.ts`, Stage 578) — then DISCARDS
 * the result and returns its OWN, unchanged `{ gateState:
 * "PlanningOnly", dynamicLoaderAllowed: false, reason:
 * "DynamicLoaderGatePending" }` answer. This mirrors the SAME "reach
 * one link deeper, keep your own answer" pattern
 * Stage 503/511/519/527/535/539/547/555/563/571 already established
 * ten times over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createDynamicLoaderGate()` is PURE, synchronous, takes no
 *     argument, and returns a hand-fixed constant. It NEVER inspects
 *     `packages/fedos-core-rust/pkg/`, `import.meta`, the filesystem,
 *     git state, or any environment variable. NO SIDE EFFECTS of any
 *     kind.
 *   - NO `fs`/`node:fs`/`path`/`node:path`/`existsSync`/`statSync`/
 *     glob API of any kind.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact —
 *     the generated JS glue is never referenced by this file at all,
 *     and NO dynamic `import()` of any kind is written here, even
 *     though this file names the gate a future dynamic loader would
 *     need to pass.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/
 *     `WebAssembly.instantiateStreaming`/`fetch`/`initSync`/
 *     default-init reference of any kind.
 *   - NO `child_process`/`process.env` reference.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`
 *     — no Runtime connection of any kind exists yet, not even a
 *     dev-only one.
 *   - `createDynamicLoaderGate()` ALWAYS resolves
 *     `dynamicLoaderAllowed: false` in this stage — `true` exists only
 *     as a RESERVED possibility for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever produce
 *     it.
 *   - `gateState` is fixed `"PlanningOnly"` — this file only ever
 *     records the gate's fixed, closed state; it never opens the gate
 *     or implements a loader, dynamic or otherwise.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createDynamicLoaderDevApproval } from "./fedos_dynamic_loader_dev_approval.js";

/**
 * The Dynamic Loader Gate's own coarse state. `"PlanningOnly"` is the
 * ONLY value this stage's implementation ever produces; `"Open"` is
 * RESERVED, unreachable from this file.
 */
export type FedosDynamicLoaderGateState = "PlanningOnly" | "Open";

/**
 * Every reason `createDynamicLoaderGate()` can name.
 * `"DynamicLoaderGatePending"` is the ONLY value this stage's
 * implementation ever produces (per `docs/runtime_dynamic_loader_gate.md`'s
 * eight conditions, all currently unmet or insufficient alone).
 * `"Allowed"` is RESERVED for a future, separate, explicitly-reviewed
 * stage; nothing in this file can ever produce it.
 */
export type FedosDynamicLoaderGateReason = "DynamicLoaderGatePending" | "Allowed";

/** The result of a `createDynamicLoaderGate()` call. No module bytes or secret material of any kind. */
export interface FedosDynamicLoaderGate {
  readonly gateState: FedosDynamicLoaderGateState;
  readonly dynamicLoaderAllowed: boolean;
  readonly reason: FedosDynamicLoaderGateReason;
}

/**
 * Evaluate whether the Dynamic Loader Gate
 * (`docs/runtime_dynamic_loader_gate.md`) is currently open, and why
 * (not). Always resolves `{ gateState: "PlanningOnly",
 * dynamicLoaderAllowed: false, reason: "DynamicLoaderGatePending" }`
 * in this stage. Pure; never throws; takes no argument, reads no
 * `process.env`/filesystem/`import.meta`. Never references the
 * generated JS glue, and never writes a dynamic `import()`.
 */
export function createDynamicLoaderGate(): FedosDynamicLoaderGate {
  reachDynamicLoaderDevApproval(); // result discarded -- the generated JS glue is never imported
  return {
    gateState: "PlanningOnly",
    dynamicLoaderAllowed: false,
    reason: "DynamicLoaderGatePending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createDynamicLoaderDevApproval()`.
 * The result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The Dev
 * Approval itself never references the generated JS glue or writes
 * `import()` of any kind either.
 */
function reachDynamicLoaderDevApproval(): void {
  createDynamicLoaderDevApproval();
}

/**
 * Pure, standalone: the gate's own fixed coarse state — usable by
 * diagnostics WITHOUT calling `createDynamicLoaderGate()`. Fixed
 * `"PlanningOnly"`.
 */
export function dynamicLoaderGateState(): FedosDynamicLoaderGateState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether a dynamic loader is currently allowed —
 * the same answer as `createDynamicLoaderGate().dynamicLoaderAllowed`.
 * Fixed `false` — no parameter or override anywhere can flip it.
 */
export function dynamicLoaderAllowed(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY a dynamic loader is not currently allowed —
 * the same answer as `createDynamicLoaderGate().reason`. Fixed
 * `"DynamicLoaderGatePending"`.
 */
export function dynamicLoaderGateReason(): FedosDynamicLoaderGateReason {
  return "DynamicLoaderGatePending";
}
