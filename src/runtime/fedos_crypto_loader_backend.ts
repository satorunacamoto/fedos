/**
 * Stage 714 — FedOS Crypto Loader Backend Abstraction (pure data,
 * fixed value only).
 *
 * `docs/runtime_crypto_loader_backend_abstraction.md` (Stage 713)
 * names the seam directly below the Crypto Loader Facade
 * (`fedos_crypto_loader_facade.ts`, Stage 594) that lets the Facade
 * stay a THIN entry point: the Facade decides "ask for crypto now",
 * the Backend Abstraction names WHICH loading strategy would
 * eventually serve that ask — WASM, a future native addon, or a
 * future Python analysis/experimentation layer — without the Facade,
 * Provider, or Runtime ever hard-coding one. THIS file is the real,
 * fixed-value implementation of that design's collapsed answer:
 * `createCryptoLoaderBackend()` always resolves `{ state:
 * "PlanningOnly", backendKind: "WasmPlanned", backendReady: false,
 * reason: "BackendAbstractionPending" }` — it never references the
 * generated JS glue and has NO side effects.
 *
 * Stage 721 wires `src/runtime/fedos_crypto_loader_facade.ts`'s
 * `createCryptoLoaderFacade()` to CALL `createCryptoLoaderBackend()`
 * — the result is DISCARDED, and `createCryptoLoaderFacade()`'s own
 * return value stays UNCHANGED (`initialized: false`, `backend:
 * "WasmPlanned"`). That is the ONLY caller of this file anywhere in
 * this repository; neither `create_runtime.ts` nor `src/worker.ts`
 * references it, directly or indirectly, and NEITHER FILE IS
 * MODIFIED BY THIS STAGE.
 *
 * This file is a TERMINUS for this stage, not another "reach one link
 * deeper" step: per `docs/runtime_crypto_loader_backend_abstraction.md`
 * §1, the diagram ends `Backend Abstraction -> STOP`. This file does
 * NOT call the WASM Loader (`fedos_wasm_loader.ts`), the generated JS
 * glue, or Rust in any way — that remains a future, separate,
 * explicitly-reviewed stage's decision.
 *
 * HARD GUARDRAILS:
 *   - `createCryptoLoaderBackend()` is PURE, synchronous, takes no
 *     argument, and returns a hand-fixed constant. It NEVER inspects
 *     `packages/fedos-core-rust/pkg/`, `import.meta`, the filesystem,
 *     build mode, or any environment variable. NO SIDE EFFECTS of any
 *     kind.
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
 *   - NO reference to `fedos_wasm_loader.ts`/`fedos_wasm_loader_plan.ts`/
 *     `fedos_wasm_loader_contract.ts` — this file names WASM as the
 *     FIRST backend candidate positionally only; it does not import or
 *     call the WASM Loader.
 *   - `createCryptoLoaderBackend()` ALWAYS resolves `backendReady:
 *     false` in this stage — `true` exists only as a RESERVED
 *     possibility for a future, separate, explicitly-reviewed stage;
 *     nothing in this file can ever produce it.
 *   - `state` is fixed `"PlanningOnly"` and `backendKind` is fixed
 *     `"WasmPlanned"` — this file only ever records the Backend
 *     Abstraction's fixed, not-yet-active design; it never activates
 *     any backend or implements a loader of any kind.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

/**
 * The Backend Abstraction's own coarse state. `"PlanningOnly"` is the
 * ONLY value this stage's implementation ever produces; `"Active"` is
 * RESERVED, unreachable from this file.
 */
export type FedosCryptoLoaderBackendState = "PlanningOnly" | "Active";

/**
 * Every backend candidate this Abstraction currently names.
 * `"WasmPlanned"` is the ONLY value `createCryptoLoaderBackend()`
 * ever produces in this stage — the first implementation candidate,
 * mirroring `fedos_execution_backend.ts`'s own WASM-first selection.
 * `"NativePlanned"` names a future native/desktop/mobile candidate;
 * `"PythonPlanned"` names a future experimentation/analysis-layer
 * candidate. None of the three is connected to anything — naming a
 * candidate here is a label of intent, not a working or reachable
 * backend.
 */
export type FedosCryptoLoaderBackendKind =
  | "WasmPlanned"
  | "NativePlanned"
  | "PythonPlanned";

/**
 * Every reason `createCryptoLoaderBackend()` can name.
 * `"BackendAbstractionPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosCryptoLoaderBackendReason = "BackendAbstractionPending" | "Allowed";

/** The result of a `createCryptoLoaderBackend()` call. No module bytes or secret material of any kind. */
export interface FedosCryptoLoaderBackend {
  readonly state: FedosCryptoLoaderBackendState;
  readonly backendKind: FedosCryptoLoaderBackendKind;
  readonly backendReady: boolean;
  readonly reason: FedosCryptoLoaderBackendReason;
}

/**
 * Evaluate the Crypto Loader Backend Abstraction
 * (`docs/runtime_crypto_loader_backend_abstraction.md`) — which
 * backend candidate is currently designated, whether it is ready, and
 * why (not). Always resolves `{ state: "PlanningOnly", backendKind:
 * "WasmPlanned", backendReady: false, reason:
 * "BackendAbstractionPending" }` in this stage. Pure; never throws;
 * takes no argument, reads no `process.env`/filesystem/`import.meta`.
 * Never references the generated JS glue, and never writes `import()`
 * of any kind. Calls nothing further — this file is a TERMINUS for
 * this stage (see this module's own top-of-file doc comment).
 */
export function createCryptoLoaderBackend(): FedosCryptoLoaderBackend {
  return {
    state: "PlanningOnly",
    backendKind: "WasmPlanned",
    backendReady: false,
    reason: "BackendAbstractionPending",
  };
}

/**
 * Pure, standalone: the Backend Abstraction's own fixed coarse state —
 * usable by diagnostics WITHOUT calling `createCryptoLoaderBackend()`.
 * Fixed `"PlanningOnly"`.
 */
export function cryptoLoaderBackendState(): FedosCryptoLoaderBackendState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: the currently designated backend candidate — the
 * same answer as `createCryptoLoaderBackend().backendKind`. Fixed
 * `"WasmPlanned"`.
 */
export function cryptoLoaderBackendKind(): FedosCryptoLoaderBackendKind {
  return "WasmPlanned";
}

/**
 * Pure, standalone: whether the designated backend is ready — the
 * same answer as `createCryptoLoaderBackend().backendReady`. Fixed
 * `false` — no parameter or override anywhere can flip it.
 */
export function cryptoLoaderBackendReady(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY the designated backend is not ready — the
 * same answer as `createCryptoLoaderBackend().reason`. Fixed
 * `"BackendAbstractionPending"`.
 */
export function cryptoLoaderBackendReason(): FedosCryptoLoaderBackendReason {
  return "BackendAbstractionPending";
}
