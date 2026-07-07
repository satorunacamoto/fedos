/**
 * Stage 618 — FedOS Provider Initialization Approval (pure data,
 * fixed value only).
 *
 * `docs/runtime_provider_initialization_approval.md` (Stage 617) fixes
 * a dedicated APPROVAL step, one level deeper than
 * `FedosCryptoProviderInitializationRequest.allowed` (Stage 610):
 * whether a SPECIFIC, already-issued request has actually been
 * reviewed and approved — distinct from whether the Boundary would
 * structurally accept one. THIS file is the real, fixed-value
 * implementation of that design's collapsed answer:
 * `createProviderInitializationApproval()` always resolves `{ state:
 * "PlanningOnly", approved: false, reason:
 * "ProviderInitializationApprovalPending" }` — it never references
 * the generated JS glue and has NO side effects.
 *
 * Stage 619 wires
 * `src/runtime/fedos_crypto_provider_initialization_request.ts`'s
 * `createCryptoProviderInitializationRequest()` to CALL
 * `createProviderInitializationApproval()` — the result is DISCARDED,
 * and `createCryptoProviderInitializationRequest()`'s own return
 * value stays UNCHANGED (`requested: false`, `allowed: false`). That
 * is one caller of this file; neither `create_runtime.ts` nor
 * `src/worker.ts` references it, directly or indirectly.
 *
 * Stage 627 extends `createProviderInitializationApproval()` DOWNWARD
 * only: it now calls `createProviderInitFacadeContract()`
 * (`fedos_provider_init_facade_contract.ts`, Stage 626) — then
 * DISCARDS the result and returns its OWN, unchanged `{ state:
 * "PlanningOnly", approved: false, reason:
 * "ProviderInitializationApprovalPending" }` answer. This mirrors the
 * SAME "reach one link deeper, keep your own answer" pattern
 * Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611
 * already established fifteen times over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createProviderInitializationApproval()` is PURE, synchronous,
 *     takes no argument, and returns a hand-fixed constant. It NEVER
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
 *     — no Runtime or Worker connection of any kind exists yet.
 *   - NO reference to `FedosRuntimeCryptoProvider`/
 *     `RuntimeCryptoProvider`/`fedos_crypto_loader_facade.ts`/
 *     `fedos_crypto_provider_facade_boundary.ts` — this file only
 *     records whether a request has been approved; it does not
 *     construct, issue, or route one, and does not connect Provider
 *     to Facade.
 *   - `createProviderInitializationApproval()` ALWAYS resolves
 *     `approved: false` in this stage — `true` exists only as a
 *     RESERVED possibility for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever
 *     produce it.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     the Approval's fixed, denied state; it never grants approval.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createProviderInitFacadeContract } from "./fedos_provider_init_facade_contract.js";

/**
 * The Provider Initialization Approval's own coarse review state.
 * `"PlanningOnly"` is the ONLY value this stage's implementation ever
 * produces; `"Approved"` is RESERVED, unreachable from this file.
 */
export type FedosProviderInitializationApprovalState = "PlanningOnly" | "Approved";

/**
 * Every reason `createProviderInitializationApproval()` can name.
 * `"ProviderInitializationApprovalPending"` is the ONLY value this
 * stage's implementation ever produces. `"Allowed"` is RESERVED for a
 * future, separate, explicitly-reviewed stage; nothing in this file
 * can ever produce it.
 */
export type FedosProviderInitializationApprovalReason =
  | "ProviderInitializationApprovalPending"
  | "Allowed";

/** The result of a `createProviderInitializationApproval()` call. No module bytes or secret material of any kind. */
export interface FedosProviderInitializationApproval {
  readonly state: FedosProviderInitializationApprovalState;
  readonly approved: boolean;
  readonly reason: FedosProviderInitializationApprovalReason;
}

/**
 * Evaluate the Provider Initialization Approval
 * (`docs/runtime_provider_initialization_approval.md`) — whether a
 * specific, already-issued request has actually been reviewed and
 * approved, and why (not). Always resolves `{ state: "PlanningOnly",
 * approved: false, reason: "ProviderInitializationApprovalPending" }`
 * in this stage. Pure; never throws; takes no argument, reads no
 * `process.env`/filesystem/`import.meta`. Never references the
 * generated JS glue, and never writes `import()` of any kind.
 */
export function createProviderInitializationApproval(): FedosProviderInitializationApproval {
  reachProviderInitFacadeContract(); // result discarded -- the generated JS glue is never imported
  return {
    state: "PlanningOnly",
    approved: false,
    reason: "ProviderInitializationApprovalPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createProviderInitFacadeContract()`.
 * The result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The
 * Provider Init Facade Contract itself never references the
 * generated JS glue or writes `import()` of any kind either.
 */
function reachProviderInitFacadeContract(): void {
  createProviderInitFacadeContract();
}

/**
 * Pure, standalone: the Approval's own fixed coarse review state —
 * usable by diagnostics WITHOUT calling
 * `createProviderInitializationApproval()`. Fixed `"PlanningOnly"`.
 */
export function providerInitializationApprovalState(): FedosProviderInitializationApprovalState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether a specific request has ever actually been
 * approved — the same answer as
 * `createProviderInitializationApproval().approved`. Fixed `false` —
 * no parameter or override anywhere can flip it.
 */
export function providerInitializationApproved(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY the request is not currently approved — the
 * same answer as `createProviderInitializationApproval().reason`.
 * Fixed `"ProviderInitializationApprovalPending"`.
 */
export function providerInitializationApprovalReason(): FedosProviderInitializationApprovalReason {
  return "ProviderInitializationApprovalPending";
}
