/**
 * Stage 634 — FedOS initializeCrypto API Contract (pure data, fixed
 * value only).
 *
 * `docs/runtime_initialize_crypto_api_contract.md` (Stage 633) fixes
 * the API SURFACE of `FedosCryptoLoaderFacade.initializeCrypto()`
 * (`fedos_crypto_loader_facade.ts`, Stage 594) itself — whether it is
 * currently CALLABLE, and whether it has ever actually run — kept
 * separate from `FedosProviderInitFacadeContract.contractReady`
 * (Stage 626), which only answers whether the two sides agree on a
 * SHAPE. THIS file is the real, fixed-value implementation of that
 * design's collapsed answer: `createInitializeCryptoApiContract()`
 * always resolves `{ state: "PlanningOnly", callable: false,
 * initialized: false, reason: "InitializeCryptoApiPending" }` — it
 * never references the generated JS glue and has NO side effects.
 *
 * Stage 635 wires
 * `src/runtime/fedos_provider_init_facade_contract.ts`'s
 * `createProviderInitFacadeContract()` to CALL
 * `createInitializeCryptoApiContract()` — the result is DISCARDED,
 * and `createProviderInitFacadeContract()`'s own return value stays
 * UNCHANGED (`contractReady: false`). That is one caller of this
 * file; neither `create_runtime.ts` nor `src/worker.ts` references
 * it, directly or indirectly.
 *
 * Stage 643 extends `createInitializeCryptoApiContract()` DOWNWARD
 * only: it now calls `createCryptoInitializationResult()`
 * (`fedos_crypto_initialization_result.ts`, Stage 642) — then
 * DISCARDS the result and returns its OWN, unchanged `{ state:
 * "PlanningOnly", callable: false, initialized: false, reason:
 * "InitializeCryptoApiPending" }` answer. This mirrors the SAME
 * "reach one link deeper, keep your own answer" pattern
 * Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627
 * already established sixteen times over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createInitializeCryptoApiContract()` is PURE, synchronous,
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
 *     `fedos_crypto_provider_facade_boundary.ts`/`fedos_wasm_loader.ts`
 *     — this file only records whether a call is currently permitted;
 *     it never performs one, and never routes through the Facade or
 *     Boundary directly.
 *   - `createInitializeCryptoApiContract()` ALWAYS resolves
 *     `callable: false`/`initialized: false` in this stage — `true`
 *     exists only as a RESERVED possibility for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever
 *     produce it.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     the API Contract's fixed, not-yet-callable design; it never
 *     makes `initializeCrypto()` callable or calls it.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createCryptoInitializationResult } from "./fedos_crypto_initialization_result.js";

/**
 * The initializeCrypto API Contract's own coarse readiness state.
 * `"PlanningOnly"` is the ONLY value this stage's implementation ever
 * produces; `"Callable"` is RESERVED, unreachable from this file.
 */
export type FedosInitializeCryptoApiContractState = "PlanningOnly" | "Callable";

/**
 * Every reason `createInitializeCryptoApiContract()` can name.
 * `"InitializeCryptoApiPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosInitializeCryptoApiContractReason = "InitializeCryptoApiPending" | "Allowed";

/** The result of a `createInitializeCryptoApiContract()` call. No module bytes or secret material of any kind. */
export interface FedosInitializeCryptoApiContract {
  readonly state: FedosInitializeCryptoApiContractState;
  readonly callable: boolean;
  readonly initialized: boolean;
  readonly reason: FedosInitializeCryptoApiContractReason;
}

/**
 * Evaluate the initializeCrypto API Contract
 * (`docs/runtime_initialize_crypto_api_contract.md`) — whether
 * `initializeCrypto()` is currently callable, whether it has ever
 * actually run, and why (not). Always resolves `{ state:
 * "PlanningOnly", callable: false, initialized: false, reason:
 * "InitializeCryptoApiPending" }` in this stage. Pure; never throws;
 * takes no argument, reads no `process.env`/filesystem/`import.meta`.
 * Never references the generated JS glue, and never writes
 * `import()` of any kind.
 */
export function createInitializeCryptoApiContract(): FedosInitializeCryptoApiContract {
  reachCryptoInitializationResult(); // result discarded -- the generated JS glue is never imported
  return {
    state: "PlanningOnly",
    callable: false,
    initialized: false,
    reason: "InitializeCryptoApiPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createCryptoInitializationResult()`.
 * The result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The Crypto
 * Initialization Result Contract itself never references the
 * generated JS glue or writes `import()` of any kind either.
 */
function reachCryptoInitializationResult(): void {
  createCryptoInitializationResult();
}

/**
 * Pure, standalone: the API Contract's own fixed coarse readiness
 * state — usable by diagnostics WITHOUT calling
 * `createInitializeCryptoApiContract()`. Fixed `"PlanningOnly"`.
 */
export function initializeCryptoApiState(): FedosInitializeCryptoApiContractState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether `initializeCrypto()` is currently
 * callable at all — the same answer as
 * `createInitializeCryptoApiContract().callable`. Fixed `false` — no
 * parameter or override anywhere can flip it.
 */
export function initializeCryptoCallable(): boolean {
  return false;
}

/**
 * Pure, standalone: whether `initializeCrypto()` has ever actually
 * been called and completed — the same answer as
 * `createInitializeCryptoApiContract().initialized`. Fixed `false` —
 * no parameter or override anywhere can flip it.
 */
export function initializeCryptoInitialized(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY `initializeCrypto()` is not currently
 * callable — the same answer as
 * `createInitializeCryptoApiContract().reason`. Fixed
 * `"InitializeCryptoApiPending"`.
 */
export function initializeCryptoReason(): FedosInitializeCryptoApiContractReason {
  return "InitializeCryptoApiPending";
}
