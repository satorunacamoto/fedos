/**
 * Stage 642 — FedOS Crypto Initialization Result Contract (pure data,
 * fixed value only).
 *
 * `docs/runtime_crypto_initialization_result.md` (Stage 641) is the
 * TERMINUS of the Provider-side Planning arc begun at
 * `docs/runtime_crypto_provider_initialization_request.md` (Stage
 * 609): what a completed `initializeCrypto()` call would actually
 * REPORT back — success/failure, and which backend (if any)
 * ultimately served the request — kept separate from
 * `FedosInitializeCryptoApiContract.initialized` (Stage 634), which
 * only answers whether a call has ever completed, not whether it
 * succeeded. THIS file is the real, fixed-value implementation of
 * that design's collapsed answer: `createCryptoInitializationResult()`
 * always resolves `{ state: "PlanningOnly", success: false, backend:
 * "None", reason: "InitializationResultPending" }` — it never
 * references the generated JS glue and has NO side effects.
 *
 * Stage 643 wires
 * `src/runtime/fedos_initialize_crypto_api_contract.ts`'s
 * `createInitializeCryptoApiContract()` to CALL
 * `createCryptoInitializationResult()` — the result is DISCARDED, and
 * `createInitializeCryptoApiContract()`'s own return value stays
 * UNCHANGED (`callable: false`, `initialized: false`). That is the
 * ONLY caller of this file anywhere in this repository; neither
 * `create_runtime.ts` nor `src/worker.ts` references it, directly or
 * indirectly.
 *
 * HARD GUARDRAILS:
 *   - `createCryptoInitializationResult()` is PURE, synchronous,
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
 *     `fedos_wasm_loader.ts` — this file only plans what a completed
 *     call would report; it does not run, complete, or route one.
 *   - `createCryptoInitializationResult()` ALWAYS resolves `success:
 *     false` and `backend: "None"` in this stage — `true`/`"Wasm"`
 *     exist only as RESERVED possibilities for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever
 *     produce them.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     the Result Contract's fixed, not-yet-completed design; it never
 *     runs or completes an initialization.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

/**
 * The Crypto Initialization Result Contract's own coarse completion
 * state. `"PlanningOnly"` is the ONLY value this stage's
 * implementation ever produces; `"Completed"` is RESERVED,
 * unreachable from this file.
 */
export type FedosCryptoInitializationResultState = "PlanningOnly" | "Completed";

/**
 * Which backend (if any) ultimately served a completed request.
 * `"None"` is the ONLY value this stage's implementation ever
 * produces — mirroring `FedosCryptoLoaderFacade.backend`'s own
 * `"WasmPlanned"` DESIGNATION without claiming any backend has ever
 * actually served a real call. `"Wasm"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosCryptoInitializationResultBackend = "None" | "Wasm";

/**
 * Every reason `createCryptoInitializationResult()` can name.
 * `"InitializationResultPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosCryptoInitializationResultReason = "InitializationResultPending" | "Allowed";

/** The result of a `createCryptoInitializationResult()` call. No module bytes or secret material of any kind. */
export interface FedosCryptoInitializationResult {
  readonly state: FedosCryptoInitializationResultState;
  readonly success: boolean;
  readonly backend: FedosCryptoInitializationResultBackend;
  readonly reason: FedosCryptoInitializationResultReason;
}

/**
 * Evaluate the Crypto Initialization Result Contract
 * (`docs/runtime_crypto_initialization_result.md`) — whether
 * initialization has ever actually succeeded, which backend (if any)
 * served it, and why no result is currently available. Always
 * resolves `{ state: "PlanningOnly", success: false, backend: "None",
 * reason: "InitializationResultPending" }` in this stage. Pure; never
 * throws; takes no argument, reads no `process.env`/filesystem/
 * `import.meta`. Never references the generated JS glue, and never
 * writes `import()` of any kind.
 */
export function createCryptoInitializationResult(): FedosCryptoInitializationResult {
  return {
    state: "PlanningOnly",
    success: false,
    backend: "None",
    reason: "InitializationResultPending",
  };
}

/**
 * Pure, standalone: the Result Contract's own fixed coarse completion
 * state — usable by diagnostics WITHOUT calling
 * `createCryptoInitializationResult()`. Fixed `"PlanningOnly"`.
 */
export function cryptoInitializationResultState(): FedosCryptoInitializationResultState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether initialization has ever actually
 * succeeded — the same answer as
 * `createCryptoInitializationResult().success`. Fixed `false` — no
 * parameter or override anywhere can flip it.
 */
export function cryptoInitializationSuccess(): boolean {
  return false;
}

/**
 * Pure, standalone: which backend (if any) ultimately served a
 * completed request — the same answer as
 * `createCryptoInitializationResult().backend`. Fixed `"None"`.
 */
export function cryptoInitializationBackend(): FedosCryptoInitializationResultBackend {
  return "None";
}

/**
 * Pure, standalone: WHY no result is currently available — the same
 * answer as `createCryptoInitializationResult().reason`. Fixed
 * `"InitializationResultPending"`.
 */
export function cryptoInitializationResultReason(): FedosCryptoInitializationResultReason {
  return "InitializationResultPending";
}
