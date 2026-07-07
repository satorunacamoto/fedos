/**
 * Stage 610 — FedOS Crypto Provider Initialization Request Planning
 * (pure data, fixed value only).
 *
 * `docs/runtime_crypto_provider_initialization_request.md` (Stage
 * 609) is PROVIDER-SIDE PLANNING for a request a future
 * `FedosRuntimeCryptoProvider` implementation would eventually hand
 * to the Provider/Facade Boundary — never issued, never sent, never
 * routed anywhere by this stage's code. THIS file is the real,
 * fixed-value implementation of that design's collapsed answer:
 * `createCryptoProviderInitializationRequest()` always resolves `{
 * state: "PlanningOnly", requested: false, allowed: false, reason:
 * "ProviderInitializationRequestPending" }` — it never references the
 * generated JS glue and has NO side effects.
 *
 * Stage 611 wires
 * `src/runtime/fedos_crypto_provider_facade_boundary.ts`'s
 * `createCryptoProviderFacadeBoundary()` to CALL
 * `createCryptoProviderInitializationRequest()` — the result is
 * DISCARDED, and `createCryptoProviderFacadeBoundary()`'s own return
 * value stays UNCHANGED (`providerConnected: false`). That is one
 * caller of this file; neither `create_runtime.ts` nor
 * `src/worker.ts` references it, directly or indirectly.
 *
 * Stage 619 extends `createCryptoProviderInitializationRequest()`
 * DOWNWARD only: it now calls
 * `createProviderInitializationApproval()`
 * (`fedos_provider_initialization_approval.ts`, Stage 618) — then
 * DISCARDS the result and returns its OWN, unchanged `{ state:
 * "PlanningOnly", requested: false, allowed: false, reason:
 * "ProviderInitializationRequestPending" }` answer. This mirrors the
 * SAME "reach one link deeper, keep your own answer" pattern
 * Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603
 * already established fourteen times over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createCryptoProviderInitializationRequest()` is PURE,
 *     synchronous, takes no argument, and returns a hand-fixed
 *     constant. It NEVER inspects `packages/fedos-core-rust/pkg/`,
 *     `import.meta`, the filesystem, build mode, or any environment
 *     variable. NO SIDE EFFECTS of any kind.
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
 *     `RuntimeCryptoProvider`/`fedos_crypto_loader_facade.ts` — this
 *     file only plans the SHAPE of a future request; it does not
 *     construct, issue, or route one.
 *   - `createCryptoProviderInitializationRequest()` ALWAYS resolves
 *     `requested: false`/`allowed: false` in this stage — `true`
 *     exists only as a RESERVED possibility for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever
 *     produce it.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     the request's fixed, not-yet-issued design; it never issues a
 *     request or connects Provider to the Boundary.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createProviderInitializationApproval } from "./fedos_provider_initialization_approval.js";

/**
 * The Provider Initialization Request's own coarse planning state.
 * `"PlanningOnly"` is the ONLY value this stage's implementation ever
 * produces; `"Requested"` is RESERVED, unreachable from this file.
 */
export type FedosCryptoProviderInitializationRequestState = "PlanningOnly" | "Requested";

/**
 * Every reason `createCryptoProviderInitializationRequest()` can name.
 * `"ProviderInitializationRequestPending"` is the ONLY value this
 * stage's implementation ever produces. `"Allowed"` is RESERVED for a
 * future, separate, explicitly-reviewed stage; nothing in this file
 * can ever produce it.
 */
export type FedosCryptoProviderInitializationRequestReason =
  | "ProviderInitializationRequestPending"
  | "Allowed";

/** The result of a `createCryptoProviderInitializationRequest()` call. No module bytes or secret material of any kind. */
export interface FedosCryptoProviderInitializationRequest {
  readonly state: FedosCryptoProviderInitializationRequestState;
  readonly requested: boolean;
  readonly allowed: boolean;
  readonly reason: FedosCryptoProviderInitializationRequestReason;
}

/**
 * Evaluate the Provider Initialization Request planning design
 * (`docs/runtime_crypto_provider_initialization_request.md`) — whether
 * a Provider has ever actually issued such a request, whether the
 * Boundary would currently accept one, and why (not). Always resolves
 * `{ state: "PlanningOnly", requested: false, allowed: false, reason:
 * "ProviderInitializationRequestPending" }` in this stage. Pure;
 * never throws; takes no argument, reads no `process.env`/
 * filesystem/`import.meta`. Never references the generated JS glue,
 * and never writes `import()` of any kind.
 */
export function createCryptoProviderInitializationRequest(): FedosCryptoProviderInitializationRequest {
  reachProviderInitializationApproval(); // result discarded -- the generated JS glue is never imported
  return {
    state: "PlanningOnly",
    requested: false,
    allowed: false,
    reason: "ProviderInitializationRequestPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createProviderInitializationApproval()`.
 * The result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The
 * Provider Initialization Approval itself never references the
 * generated JS glue or writes `import()` of any kind either.
 */
function reachProviderInitializationApproval(): void {
  createProviderInitializationApproval();
}

/**
 * Pure, standalone: the request's own fixed coarse planning state —
 * usable by diagnostics WITHOUT calling
 * `createCryptoProviderInitializationRequest()`. Fixed
 * `"PlanningOnly"`.
 */
export function providerInitializationRequestState(): FedosCryptoProviderInitializationRequestState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether a Provider has ever actually issued such
 * a request — the same answer as
 * `createCryptoProviderInitializationRequest().requested`. Fixed
 * `false` — no parameter or override anywhere can flip it.
 */
export function providerInitializationRequested(): boolean {
  return false;
}

/**
 * Pure, standalone: whether the Boundary would currently accept such
 * a request if one were issued — the same answer as
 * `createCryptoProviderInitializationRequest().allowed`. Fixed
 * `false` — no parameter or override anywhere can flip it.
 */
export function providerInitializationAllowed(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY a request is not currently allowed — the same
 * answer as `createCryptoProviderInitializationRequest().reason`.
 * Fixed `"ProviderInitializationRequestPending"`.
 */
export function providerInitializationReason(): FedosCryptoProviderInitializationRequestReason {
  return "ProviderInitializationRequestPending";
}
