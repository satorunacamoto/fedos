/**
 * Stage 674 — FedOS Runtime initializeCrypto Invocation Contract
 * (pure data, fixed value only).
 *
 * `docs/runtime_initialize_crypto_invocation_contract.md` (Stage 673)
 * is the LAST layer in this arc: even IF `initializeCrypto()` were
 * someday visible and callable as a public `AppRuntime` member
 * (`FedosInitializeCryptoPublicApi`, Stage 666), an actual INVOCATION
 * — a real caller actually invoking it — is a further, separate
 * event. THIS file is the real, fixed-value implementation of that
 * design's collapsed answer: `createInitializeCryptoInvocationContract()`
 * always resolves `{ state: "PlanningOnly", invocationAllowed: false,
 * completed: false, reason: "InvocationContractPending" }` — it never
 * references the generated JS glue and has NO side effects.
 *
 * Stage 675 wires
 * `src/runtime/fedos_initialize_crypto_public_api.ts`'s
 * `createInitializeCryptoPublicApi()` to CALL
 * `createInitializeCryptoInvocationContract()` — the result is
 * DISCARDED, and `createInitializeCryptoPublicApi()`'s own return
 * value stays UNCHANGED (`apiVisible: false`, `callable: false`).
 * That is the ONLY caller of this file anywhere in this repository;
 * neither `create_runtime.ts` nor `src/worker.ts` references it,
 * directly or indirectly, and NEITHER FILE IS MODIFIED BY THIS STAGE.
 *
 * HARD GUARDRAILS:
 *   - `createInitializeCryptoInvocationContract()` is PURE,
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
 *     — no Runtime or Worker connection of any kind exists yet, and
 *     neither file is modified by this stage.
 *   - NO reference to `FedosRuntimeCryptoProvider`/
 *     `RuntimeCryptoProvider`/`fedos_crypto_loader_facade.ts`/
 *     `fedos_wasm_loader.ts` — this file only plans whether an
 *     invocation would currently be permitted; it does not invoke
 *     anything.
 *   - `createInitializeCryptoInvocationContract()` ALWAYS resolves
 *     `invocationAllowed: false`/`completed: false` in this stage —
 *     `true` exists only as a RESERVED possibility for a future,
 *     separate, explicitly-reviewed stage; nothing in this file can
 *     ever produce it.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     the Contract's fixed, not-yet-invokable design; it never
 *     invokes `initializeCrypto()` or anything else.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

/**
 * The Runtime initializeCrypto Invocation Contract's own coarse
 * state. `"PlanningOnly"` is the ONLY value this stage's
 * implementation ever produces; `"Invoked"` is RESERVED, unreachable
 * from this file.
 */
export type FedosInitializeCryptoInvocationContractState = "PlanningOnly" | "Invoked";

/**
 * Every reason `createInitializeCryptoInvocationContract()` can name.
 * `"InvocationContractPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosInitializeCryptoInvocationContractReason = "InvocationContractPending" | "Allowed";

/** The result of a `createInitializeCryptoInvocationContract()` call. No module bytes or secret material of any kind. */
export interface FedosInitializeCryptoInvocationContract {
  readonly state: FedosInitializeCryptoInvocationContractState;
  readonly invocationAllowed: boolean;
  readonly completed: boolean;
  readonly reason: FedosInitializeCryptoInvocationContractReason;
}

/**
 * Evaluate the Runtime initializeCrypto Invocation Contract
 * (`docs/runtime_initialize_crypto_invocation_contract.md`) — whether
 * an actual invocation is currently permitted, whether one has ever
 * actually completed, and why (not). Always resolves `{ state:
 * "PlanningOnly", invocationAllowed: false, completed: false, reason:
 * "InvocationContractPending" }` in this stage. Pure; never throws;
 * takes no argument, reads no `process.env`/filesystem/`import.meta`.
 * Never references the generated JS glue, and never writes
 * `import()` of any kind.
 */
export function createInitializeCryptoInvocationContract(): FedosInitializeCryptoInvocationContract {
  return {
    state: "PlanningOnly",
    invocationAllowed: false,
    completed: false,
    reason: "InvocationContractPending",
  };
}

/**
 * Pure, standalone: the Contract's own fixed coarse state — usable by
 * diagnostics WITHOUT calling
 * `createInitializeCryptoInvocationContract()`. Fixed `"PlanningOnly"`.
 */
export function initializeCryptoInvocationState(): FedosInitializeCryptoInvocationContractState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether an actual invocation is currently
 * permitted — the same answer as
 * `createInitializeCryptoInvocationContract().invocationAllowed`.
 * Fixed `false` — no parameter or override anywhere can flip it.
 */
export function initializeCryptoInvocationAllowed(): boolean {
  return false;
}

/**
 * Pure, standalone: whether an invocation has ever actually completed
 * — the same answer as
 * `createInitializeCryptoInvocationContract().completed`. Fixed
 * `false` — no parameter or override anywhere can flip it.
 */
export function initializeCryptoInvocationCompleted(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY an invocation is not currently allowed — the
 * same answer as
 * `createInitializeCryptoInvocationContract().reason`. Fixed
 * `"InvocationContractPending"`.
 */
export function initializeCryptoInvocationReason(): FedosInitializeCryptoInvocationContractReason {
  return "InvocationContractPending";
}
