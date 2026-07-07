/**
 * Stage 602 — FedOS Crypto Provider / Facade Boundary (pure data,
 * fixed value only).
 *
 * `docs/runtime_crypto_provider_facade_boundary.md` (Stage 601) fixes
 * a dedicated BOUNDARY object recording whether the Provider side and
 * the Facade side have ever actually been connected — kept
 * deliberately separate from `FedosCryptoLoaderFacade`'s own
 * `state`/`initialized` so "Provider knows how to reach the Facade"
 * and "the Facade itself is ready" can be reasoned about
 * independently. THIS file is the real, fixed-value implementation of
 * that design's collapsed answer: `createCryptoProviderFacadeBoundary()`
 * always resolves `{ state: "PlanningOnly", providerConnected: false,
 * facadeConnected: false, reason: "ProviderFacadeConnectionPending" }`
 * — it never references the generated JS glue and has NO side
 * effects.
 *
 * Stage 603 wires `src/runtime/fedos_crypto_loader_facade.ts`'s
 * `createCryptoLoaderFacade()` to CALL
 * `createCryptoProviderFacadeBoundary()` — the result is DISCARDED,
 * and `createCryptoLoaderFacade()`'s own return value stays UNCHANGED
 * (`initialized: false`). That is the ONLY caller of this file
 * anywhere in this repository; neither `create_runtime.ts` nor
 * `src/worker.ts` references it, directly or indirectly.
 *
 * HARD GUARDRAILS:
 *   - `createCryptoProviderFacadeBoundary()` is PURE, synchronous,
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
 *     `RuntimeCryptoProvider`/`fedos_wasm_loader.ts` — this file
 *     records whether such a connection exists; it does not create
 *     one.
 *   - `createCryptoProviderFacadeBoundary()` ALWAYS resolves
 *     `providerConnected: false`/`facadeConnected: false` in this
 *     stage — `true` exists only as a RESERVED possibility for a
 *     future, separate, explicitly-reviewed stage; nothing in this
 *     file can ever produce it.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     the Boundary's fixed, not-yet-connected design; it never
 *     connects Provider to Facade.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createCryptoProviderInitializationRequest } from "./fedos_crypto_provider_initialization_request.js";

/**
 * The Provider/Facade Boundary's own coarse state. `"PlanningOnly"`
 * is the ONLY value this stage's implementation ever produces;
 * `"Connected"` is RESERVED, unreachable from this file.
 */
export type FedosCryptoProviderFacadeBoundaryState = "PlanningOnly" | "Connected";

/**
 * Every reason `createCryptoProviderFacadeBoundary()` can name.
 * `"ProviderFacadeConnectionPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosCryptoProviderFacadeBoundaryReason = "ProviderFacadeConnectionPending" | "Allowed";

/** The result of a `createCryptoProviderFacadeBoundary()` call. No module bytes or secret material of any kind. */
export interface FedosCryptoProviderFacadeBoundary {
  readonly state: FedosCryptoProviderFacadeBoundaryState;
  readonly providerConnected: boolean;
  readonly facadeConnected: boolean;
  readonly reason: FedosCryptoProviderFacadeBoundaryReason;
}

/**
 * Evaluate the Crypto Provider / Facade Boundary
 * (`docs/runtime_crypto_provider_facade_boundary.md`) — whether any
 * Provider implementation and the Facade have ever actually been
 * connected to one another, and why (not). Always resolves `{ state:
 * "PlanningOnly", providerConnected: false, facadeConnected: false,
 * reason: "ProviderFacadeConnectionPending" }` in this stage. Pure;
 * never throws; takes no argument, reads no `process.env`/
 * filesystem/`import.meta`. Never references the generated JS glue,
 * and never writes `import()` of any kind.
 */
export function createCryptoProviderFacadeBoundary(): FedosCryptoProviderFacadeBoundary {
  reachProviderInitializationRequest(); // result discarded -- the generated JS glue is never imported
  return {
    state: "PlanningOnly",
    providerConnected: false,
    facadeConnected: false,
    reason: "ProviderFacadeConnectionPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls
 * `createCryptoProviderInitializationRequest()`. The result is
 * discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The
 * Provider Initialization Request itself never references the
 * generated JS glue or writes `import()` of any kind either.
 */
function reachProviderInitializationRequest(): void {
  createCryptoProviderInitializationRequest();
}

/**
 * Pure, standalone: the Boundary's own fixed coarse state — usable by
 * diagnostics WITHOUT calling `createCryptoProviderFacadeBoundary()`.
 * Fixed `"PlanningOnly"`.
 */
export function providerFacadeBoundaryState(): FedosCryptoProviderFacadeBoundaryState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether the Provider side AND the Facade side are
 * both currently connected — the logical AND of
 * `createCryptoProviderFacadeBoundary().providerConnected` and
 * `.facadeConnected`. Fixed `false` — no parameter or override
 * anywhere can flip it.
 */
export function providerFacadeConnected(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY the Boundary is not yet fully connected — the
 * same answer as `createCryptoProviderFacadeBoundary().reason`. Fixed
 * `"ProviderFacadeConnectionPending"`.
 */
export function providerFacadeReason(): FedosCryptoProviderFacadeBoundaryReason {
  return "ProviderFacadeConnectionPending";
}
