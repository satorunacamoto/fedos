/**
 * Stage 626 — FedOS Provider Init Facade Contract (pure data, fixed
 * value only).
 *
 * `docs/runtime_provider_init_facade_contract.md` (Stage 625) is the
 * LAST layer before the already-real Provider/Facade Boundary
 * (`fedos_crypto_provider_facade_boundary.ts`, Stage 602): whether the
 * Provider side and the Facade side currently agree on a shared
 * call/return shape for `initializeCrypto()` — distinct from whether a
 * request has been approved (`docs/runtime_provider_initialization_approval.md`,
 * Stage 617). THIS file is the real, fixed-value implementation of
 * that design's collapsed answer: `createProviderInitFacadeContract()`
 * always resolves `{ state: "PlanningOnly", contractReady: false,
 * reason: "ProviderInitFacadeContractPending" }` — it never
 * references the generated JS glue and has NO side effects.
 *
 * Stage 627 wires
 * `src/runtime/fedos_provider_initialization_approval.ts`'s
 * `createProviderInitializationApproval()` to CALL
 * `createProviderInitFacadeContract()` — the result is DISCARDED, and
 * `createProviderInitializationApproval()`'s own return value stays
 * UNCHANGED (`approved: false`). That is the ONLY caller of this file
 * anywhere in this repository; neither `create_runtime.ts` nor
 * `src/worker.ts` references it, directly or indirectly.
 *
 * HARD GUARDRAILS:
 *   - `createProviderInitFacadeContract()` is PURE, synchronous,
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
 *     plans whether a shared shape exists; it does not define,
 *     enforce, or connect one.
 *   - `createProviderInitFacadeContract()` ALWAYS resolves
 *     `contractReady: false` in this stage — `true` exists only as a
 *     RESERVED possibility for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever
 *     produce it.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     the Contract's fixed, not-yet-ready design; it never
 *     establishes a contract or connects Provider to the Boundary.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

/**
 * The Provider Init Facade Contract's own coarse readiness state.
 * `"PlanningOnly"` is the ONLY value this stage's implementation ever
 * produces; `"Ready"` is RESERVED, unreachable from this file.
 */
export type FedosProviderInitFacadeContractState = "PlanningOnly" | "Ready";

/**
 * Every reason `createProviderInitFacadeContract()` can name.
 * `"ProviderInitFacadeContractPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosProviderInitFacadeContractReason = "ProviderInitFacadeContractPending" | "Allowed";

/** The result of a `createProviderInitFacadeContract()` call. No module bytes or secret material of any kind. */
export interface FedosProviderInitFacadeContract {
  readonly state: FedosProviderInitFacadeContractState;
  readonly contractReady: boolean;
  readonly reason: FedosProviderInitFacadeContractReason;
}

/**
 * Evaluate the Provider Init Facade Contract
 * (`docs/runtime_provider_init_facade_contract.md`) — whether the
 * Provider side and the Facade side currently agree on a shared
 * call/return shape, and why (not). Always resolves `{ state:
 * "PlanningOnly", contractReady: false, reason:
 * "ProviderInitFacadeContractPending" }` in this stage. Pure; never
 * throws; takes no argument, reads no `process.env`/filesystem/
 * `import.meta`. Never references the generated JS glue, and never
 * writes `import()` of any kind.
 */
export function createProviderInitFacadeContract(): FedosProviderInitFacadeContract {
  return {
    state: "PlanningOnly",
    contractReady: false,
    reason: "ProviderInitFacadeContractPending",
  };
}

/**
 * Pure, standalone: the Contract's own fixed coarse readiness state —
 * usable by diagnostics WITHOUT calling
 * `createProviderInitFacadeContract()`. Fixed `"PlanningOnly"`.
 */
export function providerInitFacadeContractState(): FedosProviderInitFacadeContractState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether the Provider side and the Facade side
 * currently agree on a shared call/return shape — the same answer as
 * `createProviderInitFacadeContract().contractReady`. Fixed `false` —
 * no parameter or override anywhere can flip it.
 */
export function providerInitFacadeContractReady(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY the contract is not currently ready — the
 * same answer as `createProviderInitFacadeContract().reason`. Fixed
 * `"ProviderInitFacadeContractPending"`.
 */
export function providerInitFacadeContractReason(): FedosProviderInitFacadeContractReason {
  return "ProviderInitFacadeContractPending";
}
