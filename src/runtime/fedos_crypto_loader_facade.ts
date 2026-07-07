/**
 * Stage 594 — FedOS Crypto Loader Facade (pure data, fixed value
 * only).
 *
 * `docs/runtime_crypto_loader_facade.md` (Stage 593) names the
 * Facade's target position in the call graph — Crypto Runtime ->
 * Crypto Provider -> Crypto Loader Facade -> WASM Loader -> Rust —
 * and SIX responsibilities: Runtime sees only the Facade, Provider
 * sees only the Facade, WASM Loader is never known directly, Rust is
 * never known directly, the backend is swappable in the future, Fail
 * Closed is maintained. THIS file is the real, fixed-value
 * implementation of that design's collapsed answer:
 * `createCryptoLoaderFacade()` always resolves `{ state:
 * "PlanningOnly", initialized: false, backend: "WasmPlanned", reason:
 * "FacadeInitializationPending" }`, and `initializeCrypto()` always
 * resolves `{ allowed: false, reason: "FacadeInitializationPending" }`
 * — neither references the generated JS glue, and neither has any
 * side effect.
 *
 * Stage 595 wires
 * `src/runtime/fedos_explicit_crypto_initialization.ts`'s
 * `createExplicitCryptoInitialization()` to CALL
 * `createCryptoLoaderFacade()` — the result is DISCARDED, and
 * `createExplicitCryptoInitialization()`'s own return value stays
 * UNCHANGED (`initializationAllowed: false`). That is one caller of
 * this file; neither `create_runtime.ts` nor `src/worker.ts`
 * references it, directly or indirectly.
 *
 * Stage 603 extends `createCryptoLoaderFacade()` DOWNWARD only: it
 * now calls `createCryptoProviderFacadeBoundary()`
 * (`fedos_crypto_provider_facade_boundary.ts`, Stage 602) — then
 * DISCARDS the result and returns its OWN, unchanged `{ state:
 * "PlanningOnly", initialized: false, backend: "WasmPlanned", reason:
 * "FacadeInitializationPending" }` answer. This mirrors the SAME
 * "reach one link deeper, keep your own answer" pattern
 * Stage 503/511/519/527/535/539/547/555/563/571/579/587/595 already
 * established thirteen times over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createCryptoLoaderFacade()`/`initializeCrypto()` are PURE,
 *     synchronous, take no argument, and return hand-fixed constants.
 *     Neither inspects `packages/fedos-core-rust/pkg/`, `import.meta`,
 *     the filesystem, build mode, or any environment variable. NO SIDE
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
 *   - NO reference to `fedos_wasm_loader.ts`/`fedos_wasm_loader_plan.ts`
 *     — the Facade names the WASM Loader as its future target
 *     positionally only (`docs/runtime_crypto_loader_facade.md` §1);
 *     it does not import or call it.
 *   - `createCryptoLoaderFacade()` ALWAYS resolves `initialized: false`
 *     and `initializeCrypto()` ALWAYS resolves `allowed: false` in
 *     this stage — `true` exists only as a RESERVED possibility for a
 *     future, separate, explicitly-reviewed stage; nothing in this
 *     file can ever produce it.
 *   - `state` is fixed `"PlanningOnly"` and `backend` is fixed
 *     `"WasmPlanned"` — this file only ever records the Facade's
 *     fixed, not-yet-active design; it never activates the Facade or
 *     implements a loader of any kind.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createCryptoProviderFacadeBoundary } from "./fedos_crypto_provider_facade_boundary.js";

/**
 * The Crypto Loader Facade's own coarse state. `"PlanningOnly"` is the
 * ONLY value this stage's implementation ever produces; `"Active"` is
 * RESERVED, unreachable from this file.
 */
export type FedosCryptoLoaderFacadeState = "PlanningOnly" | "Active";

/**
 * The Facade's currently designated backend candidate.
 * `"WasmPlanned"` is the ONLY value this stage's implementation ever
 * produces — mirroring `fedos_execution_backend.ts`'s own WASM-first
 * candidate selection. `"WasmActive"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosCryptoLoaderFacadeBackend = "WasmPlanned" | "WasmActive";

/**
 * Every reason this file's functions can name.
 * `"FacadeInitializationPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosCryptoLoaderFacadeReason = "FacadeInitializationPending" | "Allowed";

/** The result of a `createCryptoLoaderFacade()` call. No module bytes or secret material of any kind. */
export interface FedosCryptoLoaderFacade {
  readonly state: FedosCryptoLoaderFacadeState;
  readonly initialized: boolean;
  readonly backend: FedosCryptoLoaderFacadeBackend;
  readonly reason: FedosCryptoLoaderFacadeReason;
}

/** The result of an `initializeCrypto()` call. No module bytes or secret material of any kind. */
export interface FedosCryptoLoaderFacadeInitializationDecision {
  readonly allowed: boolean;
  readonly reason: FedosCryptoLoaderFacadeReason;
}

/**
 * Evaluate the Crypto Loader Facade
 * (`docs/runtime_crypto_loader_facade.md`) — its own coarse state,
 * whether it has ever been initialized, and which backend it
 * currently designates. Always resolves `{ state: "PlanningOnly",
 * initialized: false, backend: "WasmPlanned", reason:
 * "FacadeInitializationPending" }` in this stage. Pure; never throws;
 * takes no argument, reads no `process.env`/filesystem/`import.meta`.
 * Never references the generated JS glue, and never writes `import()`
 * of any kind.
 */
export function createCryptoLoaderFacade(): FedosCryptoLoaderFacade {
  reachProviderFacadeBoundary(); // result discarded -- the generated JS glue is never imported
  return {
    state: "PlanningOnly",
    initialized: false,
    backend: "WasmPlanned",
    reason: "FacadeInitializationPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createCryptoProviderFacadeBoundary()`.
 * The result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The
 * Provider/Facade Boundary itself never references the generated JS
 * glue or writes `import()` of any kind either.
 */
function reachProviderFacadeBoundary(): void {
  createCryptoProviderFacadeBoundary();
}

/**
 * The Facade's own initialization entry point — the ONLY function a
 * future Provider would ever call to request a load. Always resolves
 * `{ allowed: false, reason: "FacadeInitializationPending" }` in this
 * stage. Pure; never throws; takes no argument; has NO side effect —
 * it does not call the WASM Loader, `WebAssembly.instantiate`, or
 * Rust, and never references the generated JS glue.
 */
export function initializeCrypto(): FedosCryptoLoaderFacadeInitializationDecision {
  return {
    allowed: false,
    reason: "FacadeInitializationPending",
  };
}

/**
 * Pure, standalone: the Facade's own fixed coarse state — usable by
 * diagnostics WITHOUT calling `createCryptoLoaderFacade()`. Fixed
 * `"PlanningOnly"`.
 */
export function cryptoLoaderFacadeState(): FedosCryptoLoaderFacadeState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: the Facade's currently designated backend
 * candidate — the same answer as
 * `createCryptoLoaderFacade().backend`. Fixed `"WasmPlanned"`.
 */
export function cryptoLoaderFacadeBackend(): FedosCryptoLoaderFacadeBackend {
  return "WasmPlanned";
}

/**
 * Pure, standalone: whether the Facade has ever actually been
 * initialized — the same answer as
 * `createCryptoLoaderFacade().initialized`. Fixed `false` — no
 * parameter or override anywhere can flip it.
 */
export function cryptoLoaderFacadeInitialized(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY the Facade has not yet been initialized — the
 * same answer as `createCryptoLoaderFacade().reason`. Fixed
 * `"FacadeInitializationPending"`.
 */
export function cryptoLoaderFacadeReason(): FedosCryptoLoaderFacadeReason {
  return "FacadeInitializationPending";
}
