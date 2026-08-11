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
 * Stage 737 (Prototype Phase 004) extended `createCryptoLoaderBackend()`
 * DOWNWARD only: it called `createWasmBackend()` (`fedos_wasm_backend.ts`,
 * Stage 730) directly — DISCARDING that result too, and returning its
 * OWN, byte-for-byte unchanged answer.
 *
 * Stage 753 (Prototype Phase 005) REPLACES that direct wire: this file
 * now calls `createCryptoBackendInterface()`
 * (`fedos_crypto_backend_interface.ts`, Stage 746) INSTEAD OF calling
 * `createWasmBackend()` directly — the result is DISCARDED, and this
 * function's own return value stays UNCHANGED (`state: "PlanningOnly"`,
 * `backendKind: "WasmPlanned"`, `backendReady: false`, `reason:
 * "BackendAbstractionPending"`). `fedos_crypto_backend_interface.ts`
 * itself reaches WASM Backend Planning one link further down, so
 * `fedos_wasm_backend.ts`'s own fixed answer is still reached — just no
 * longer directly from this file. This is the ONLY caller of
 * `fedos_crypto_backend_interface.ts` anywhere in this repository —
 * per `docs/runtime_crypto_backend_interface.md`, ONLY the Backend
 * Abstraction may reach the Backend Interface; Runtime, Worker, and
 * the Facade never do, directly or indirectly.
 *
 * This file is a TERMINUS for the Facade's OWN reach, not another
 * "reach one link deeper" step for the Facade: per
 * `docs/runtime_crypto_loader_backend_abstraction.md` §1, the
 * Facade-facing diagram ends `Backend Abstraction -> STOP` from the
 * Facade's point of view, even though this file itself now reaches
 * one further link (the Backend Interface) internally. This file does
 * NOT call the real WASM Loader (`fedos_wasm_loader.ts`), the
 * generated JS glue, or Rust in any way — that remains a future,
 * separate, explicitly-reviewed stage's decision.
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
 *     call the real WASM Loader.
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

import { createCryptoBackendInterface } from "./fedos_crypto_backend_interface.js";
import type { FedosCryptoLoaderBackendKind } from "./fedos_crypto_loader_backend_kind.js";

// Nostr Consolidation Plan, Step 5 / architecture cycle detector baseline
// reduction — `FedosCryptoLoaderBackendKind` now lives in the dedicated
// `./fedos_crypto_loader_backend_kind.ts` (see that file's own header for
// why); re-exported here, unchanged in shape, so this file's own existing
// consumer (`runtime_crypto_diagnostics.ts`) needed zero call-site changes.
export type { FedosCryptoLoaderBackendKind };

/**
 * The Backend Abstraction's own coarse state. `"PlanningOnly"` is the
 * ONLY value this stage's implementation ever produces; `"Active"` is
 * RESERVED, unreachable from this file.
 */
export type FedosCryptoLoaderBackendState = "PlanningOnly" | "Active";

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
 * of any kind. Reaches ONE further link (the Backend Interface,
 * `fedos_crypto_backend_interface.ts`, Stage 753) and discards its
 * result — this function's OWN return value stays byte-for-byte
 * unchanged.
 */
export function createCryptoLoaderBackend(): FedosCryptoLoaderBackend {
  reachCryptoBackendInterface(); // result discarded -- Backend Interface reaches WASM Backend Planning internally
  return {
    state: "PlanningOnly",
    backendKind: "WasmPlanned",
    backendReady: false,
    reason: "BackendAbstractionPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createCryptoBackendInterface()`
 * (`fedos_crypto_backend_interface.ts`, Stage 746). The result is
 * discarded; it is never passed to `WebAssembly.instantiate`/
 * `compile`, `initSync`/the default init export,
 * `packages/fedos-core-rust`, Runtime, or Worker. The Backend
 * Interface itself never references the generated JS glue or the
 * real WASM Loader, and writes no `import()` of any kind either — it
 * is a TERMINUS for the Abstraction's own reach (see this module's
 * top-of-file doc comment).
 */
function reachCryptoBackendInterface(): void {
  createCryptoBackendInterface();
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
