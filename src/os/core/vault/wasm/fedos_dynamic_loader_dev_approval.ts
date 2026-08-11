/**
 * Stage 578 — FedOS Dynamic Loader Dev Approval (pure data, fixed
 * value only).
 *
 * `docs/runtime_dynamic_loader_dev_approval.md` (Stage 577) fixes
 * EIGHT minimum dev-only conditions a future, separate,
 * explicitly-reviewed stage would need to satisfy before a dynamic
 * `import()` of the generated JS glue could ever be ACTIVATED — Dynamic
 * Loader Gate passed, dev build only, disabled in production builds,
 * Runtime Review complete, Generated JS Glue verified, Fail Closed
 * maintained, prohibited in Worker, prohibited in production deploy.
 * THIS file is the real, fixed-value implementation of that approval:
 * `createDynamicLoaderDevApproval()` always resolves `{
 * approvalState: "PlanningOnly", approved: false, reason:
 * "DevApprovalPending" }` — it never references the generated JS glue
 * and has NO side effects.
 *
 * Stage 579 wires `src/runtime/fedos_dynamic_loader_gate.ts`'s
 * `createDynamicLoaderGate()` to CALL
 * `createDynamicLoaderDevApproval()` — the result is DISCARDED, and
 * `createDynamicLoaderGate()`'s own return value stays UNCHANGED
 * (`dynamicLoaderAllowed: false`). That is one caller of this file;
 * neither `create_runtime.ts` nor `src/worker.ts` references it,
 * directly or indirectly.
 *
 * Stage 587 extends `createDynamicLoaderDevApproval()` DOWNWARD only:
 * it now calls `createExplicitCryptoInitialization()`
 * (`fedos_explicit_crypto_initialization.ts`, Stage 586) — then
 * DISCARDS the result and returns its OWN, unchanged `{
 * approvalState: "PlanningOnly", approved: false, reason:
 * "DevApprovalPending" }` answer. This mirrors the SAME "reach one
 * link deeper, keep your own answer" pattern
 * Stage 503/511/519/527/535/539/547/555/563/571/579 already
 * established eleven times over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createDynamicLoaderDevApproval()` is PURE, synchronous, takes
 *     no argument, and returns a hand-fixed constant. It NEVER
 *     inspects `packages/fedos-core-rust/pkg/`, `import.meta`, the
 *     filesystem, build mode, or any environment variable. NO SIDE
 *     EFFECTS of any kind.
 *   - NO `fs`/`node:fs`/`path`/`node:path`/`existsSync`/`statSync`/
 *     glob API of any kind.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact —
 *     the generated JS glue is never referenced by this file at all,
 *     and NO `import()` of any kind (static or dynamic) is written
 *     here.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/
 *     `WebAssembly.instantiateStreaming`/`fetch`/`initSync`/
 *     default-init reference of any kind.
 *   - NO `child_process`/`process.env` reference — no build-mode/
 *     dev-only flag is defined or consulted anywhere in this file.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`
 *     — no Runtime or Worker connection of any kind exists yet, not
 *     even a dev-only one.
 *   - `createDynamicLoaderDevApproval()` ALWAYS resolves `approved:
 *     false` in this stage — `true` exists only as a RESERVED
 *     possibility for a future, separate, explicitly-reviewed stage;
 *     nothing in this file can ever produce it.
 *   - `approvalState` is fixed `"PlanningOnly"` — this file only ever
 *     records the approval's fixed, denied state; it never grants the
 *     approval or implements a loader, dynamic or otherwise.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createExplicitCryptoInitialization } from "./fedos_explicit_crypto_initialization.js";

/**
 * The Dynamic Loader Dev Approval's own coarse state. `"PlanningOnly"`
 * is the ONLY value this stage's implementation ever produces;
 * `"Granted"` is RESERVED, unreachable from this file.
 */
export type FedosDynamicLoaderDevApprovalState = "PlanningOnly" | "Granted";

/**
 * Every reason `createDynamicLoaderDevApproval()` can name.
 * `"DevApprovalPending"` is the ONLY value this stage's implementation
 * ever produces (per `docs/runtime_dynamic_loader_dev_approval.md`'s
 * eight conditions, all currently unmet or insufficient alone).
 * `"Allowed"` is RESERVED for a future, separate, explicitly-reviewed
 * stage; nothing in this file can ever produce it.
 */
export type FedosDynamicLoaderDevApprovalReason = "DevApprovalPending" | "Allowed";

/** The result of a `createDynamicLoaderDevApproval()` call. No module bytes or secret material of any kind. */
export interface FedosDynamicLoaderDevApproval {
  readonly approvalState: FedosDynamicLoaderDevApprovalState;
  readonly approved: boolean;
  readonly reason: FedosDynamicLoaderDevApprovalReason;
}

/**
 * Evaluate whether the dev-only Dynamic Loader Dev Approval
 * (`docs/runtime_dynamic_loader_dev_approval.md`) is currently
 * granted, and why (not). Always resolves `{ approvalState:
 * "PlanningOnly", approved: false, reason: "DevApprovalPending" }` in
 * this stage. Pure; never throws; takes no argument, reads no
 * `process.env`/filesystem/`import.meta`. Never references the
 * generated JS glue, and never writes `import()` of any kind.
 */
export function createDynamicLoaderDevApproval(): FedosDynamicLoaderDevApproval {
  reachExplicitCryptoInitialization(); // result discarded -- the generated JS glue is never imported
  return {
    approvalState: "PlanningOnly",
    approved: false,
    reason: "DevApprovalPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createExplicitCryptoInitialization()`.
 * The result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The
 * Explicit Crypto Initialization design itself never references the
 * generated JS glue or writes `import()` of any kind either.
 */
function reachExplicitCryptoInitialization(): void {
  createExplicitCryptoInitialization();
}

/**
 * Pure, standalone: the approval's own fixed coarse state — usable by
 * diagnostics WITHOUT calling `createDynamicLoaderDevApproval()`.
 * Fixed `"PlanningOnly"`.
 */
export function dynamicLoaderDevApprovalState(): FedosDynamicLoaderDevApprovalState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether the dev-only dynamic loader is currently
 * approved — the same answer as
 * `createDynamicLoaderDevApproval().approved`. Fixed `false` — no
 * parameter or override anywhere can flip it.
 */
export function dynamicLoaderDevApproved(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY the dev-only dynamic loader is not currently
 * approved — the same answer as
 * `createDynamicLoaderDevApproval().reason`. Fixed
 * `"DevApprovalPending"`.
 */
export function dynamicLoaderDevReason(): FedosDynamicLoaderDevApprovalReason {
  return "DevApprovalPending";
}
