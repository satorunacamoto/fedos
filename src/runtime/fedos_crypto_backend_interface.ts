/**
 * Stage 746 — FedOS Crypto Backend Interface (pure data, fixed value
 * only).
 *
 * `docs/runtime_crypto_backend_interface.md` (Stage 745) names the
 * seam directly below the Crypto Loader Backend Abstraction
 * (`fedos_crypto_loader_backend.ts`, Stage 714) and directly above the
 * WASM Backend Planning layer (`fedos_wasm_backend.ts`, Stage 730) — a
 * common, backend-agnostic CONTRACT that would let the Abstraction
 * eventually talk to WASM, Native, or Python backend candidates
 * through the SAME shape, instead of ever branching on which
 * candidate is currently designated. THIS file is the real,
 * fixed-value implementation of that design's collapsed answer:
 * `createCryptoBackendInterface()` always resolves `{ state:
 * "PlanningOnly", backendSelected: "WasmPlanned", backendActivated:
 * false, interfaceReady: false, reason: "BackendInterfacePending" }`
 * — it never references the generated JS glue, the real WASM Loader,
 * or Rust, and has NO side effects.
 *
 * Stage 753 wires `src/runtime/fedos_crypto_loader_backend.ts`'s
 * `createCryptoLoaderBackend()` to CALL
 * `createCryptoBackendInterface()` INSTEAD OF calling
 * `createWasmBackend()` directly (replacing the Stage 737 direct
 * wire) — the result is DISCARDED, and
 * `createCryptoLoaderBackend()`'s own return value stays UNCHANGED
 * (`state: "PlanningOnly"`, `backendKind: "WasmPlanned"`,
 * `backendReady: false`, `reason: "BackendAbstractionPending"`). That
 * is the ONLY caller of this file anywhere in this repository; neither
 * `create_runtime.ts` nor `src/worker.ts` references it, directly or
 * indirectly, and NEITHER FILE IS MODIFIED BY THIS STAGE.
 *
 * This file itself now reaches ONE further link — `createWasmBackend()`
 * (`fedos_wasm_backend.ts`, Stage 730) — DISCARDING that result too,
 * and returning its OWN, byte-for-byte fixed answer. This is the
 * SAME "reach one link deeper, keep your own answer" pattern this
 * repository's WASM arc has used since Stage 503, just relocated one
 * level: `fedos_wasm_backend.ts`'s ONLY caller is now this file, no
 * longer `fedos_crypto_loader_backend.ts` directly. `fedos_wasm_backend.ts`
 * itself is UNMODIFIED by this stage and its own fixed return value is
 * unchanged.
 *
 * This file is a TERMINUS for the Backend Abstraction's OWN reach, not
 * another "reach one link deeper" step for the Abstraction: per
 * `docs/runtime_crypto_backend_interface.md` §1, the
 * Abstraction-facing diagram ends `Backend Interface -> STOP` from
 * the Abstraction's point of view, even though this file itself now
 * reaches one further link (WASM Backend Planning) internally. This
 * file does NOT call the real WASM Loader (`fedos_wasm_loader.ts`),
 * the generated JS glue, or Rust in any way — that remains a future,
 * separate, explicitly-reviewed stage's decision.
 *
 * Stage 764 (Prototype Phase 006) adds a SECOND, separate reach: this
 * file now ALSO calls `createCryptoBackendResolver()`
 * (`fedos_crypto_backend_resolver.ts`, Stage 763) — DISCARDING that
 * result too, and returning its OWN, byte-for-byte unchanged answer.
 * This mirrors the SAME "a second, separate reach" pattern
 * `fedos_crypto_loader_facade.ts` already established for
 * `reachProviderFacadeBoundary()`/`reachCryptoLoaderBackend()` (Stage
 * 594/721) — the pre-existing reach into `fedos_wasm_backend.ts` is
 * NOT replaced or removed; both reaches now exist side by side. This
 * is the ONLY caller of `fedos_crypto_backend_resolver.ts` anywhere in
 * this repository — per `docs/runtime_crypto_backend_resolver.md`,
 * ONLY the Backend Interface may reach the Backend Resolver; Runtime,
 * Worker, the Facade, and the Backend Abstraction never do, directly
 * or indirectly.
 *
 * HARD GUARDRAILS:
 *   - `createCryptoBackendInterface()` is PURE, synchronous, takes no
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
 *     `fedos_wasm_loader_contract.ts` — the real WASM Loader remains
 *     unreachable from this Interface.
 *   - This file NEVER creates, selects, or activates a real backend of
 *     any kind — `backendSelected` is a fixed echo, not a live
 *     selection; `backendActivated` ALWAYS resolves `false`.
 *   - `state` is fixed `"PlanningOnly"` and `interfaceReady` is fixed
 *     `false` — this file only ever records this Interface's fixed,
 *     not-yet-ready design; it never activates a backend or attaches
 *     a loader of any kind.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import type { FedosCryptoLoaderBackendKind } from "./fedos_crypto_loader_backend.js";
import { createWasmBackend } from "./fedos_wasm_backend.js";
import { createCryptoBackendResolver } from "./fedos_crypto_backend_resolver.js";

/**
 * The Backend Interface's own coarse state. `"PlanningOnly"` is the
 * ONLY value this stage's implementation ever produces; `"Active"` is
 * RESERVED, unreachable from this file.
 */
export type FedosCryptoBackendInterfaceState = "PlanningOnly" | "Active";

/**
 * Every reason `createCryptoBackendInterface()` can name.
 * `"BackendInterfacePending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosCryptoBackendInterfaceReason = "BackendInterfacePending" | "Allowed";

/** The result of a `createCryptoBackendInterface()` call. No module bytes or secret material of any kind. */
export interface FedosCryptoBackendInterface {
  readonly state: FedosCryptoBackendInterfaceState;
  readonly backendSelected: FedosCryptoLoaderBackendKind;
  readonly backendActivated: boolean;
  readonly interfaceReady: boolean;
  readonly reason: FedosCryptoBackendInterfaceReason;
}

/**
 * Evaluate the Crypto Backend Interface
 * (`docs/runtime_crypto_backend_interface.md`) — its own coarse
 * state, which backend candidate it currently talks to, whether any
 * backend has ever been activated through it, and whether the
 * Interface itself is ready to route a real call. Always resolves
 * `{ state: "PlanningOnly", backendSelected: "WasmPlanned",
 * backendActivated: false, interfaceReady: false, reason:
 * "BackendInterfacePending" }` in this stage. Pure; never throws;
 * takes no argument, reads no `process.env`/filesystem/`import.meta`.
 * Never references the generated JS glue or the real WASM Loader, and
 * never writes `import()` of any kind. Reaches TWO independent leaves
 * — WASM Backend Planning (`fedos_wasm_backend.ts`, Stage 746) and
 * the Backend Resolver (`fedos_crypto_backend_resolver.ts`, Stage
 * 764) — and discards both results; this function's OWN return value
 * stays byte-for-byte unchanged.
 */
export function createCryptoBackendInterface(): FedosCryptoBackendInterface {
  reachWasmBackend(); // result discarded -- WASM Backend Planning is a STOP, no real WASM Loader/Rust call
  reachCryptoBackendResolver(); // result discarded -- Backend Resolver is a STOP, no real WASM Loader/Rust call
  return {
    state: "PlanningOnly",
    backendSelected: "WasmPlanned",
    backendActivated: false,
    interfaceReady: false,
    reason: "BackendInterfacePending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createWasmBackend()`
 * (`fedos_wasm_backend.ts`, Stage 730). The result is discarded; it
 * is never passed to `WebAssembly.instantiate`/`compile`, `initSync`/
 * the default init export, `packages/fedos-core-rust`, Runtime, or
 * Worker. WASM Backend Planning itself never references the
 * generated JS glue, the real WASM Loader, or writes `import()` of
 * any kind either — it is a TERMINUS for this stage.
 */
function reachWasmBackend(): void {
  createWasmBackend();
}

/**
 * PRIVATE (module-scoped) — calls `createCryptoBackendResolver()`
 * (`fedos_crypto_backend_resolver.ts`, Stage 763). The result is
 * discarded; it is never passed to `WebAssembly.instantiate`/
 * `compile`, `initSync`/the default init export,
 * `packages/fedos-core-rust`, Runtime, or Worker. The Backend Resolver
 * itself never references the generated JS glue, the real WASM
 * Loader, or writes `import()` of any kind either — it is a TERMINUS
 * for this stage, independent of the `reachWasmBackend()` leaf above.
 */
function reachCryptoBackendResolver(): void {
  createCryptoBackendResolver();
}

/**
 * Pure, standalone: the Backend Interface's own fixed coarse state —
 * usable by diagnostics WITHOUT calling `createCryptoBackendInterface()`.
 * Fixed `"PlanningOnly"`.
 */
export function cryptoBackendInterfaceState(): FedosCryptoBackendInterfaceState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: which backend candidate this Interface currently
 * talks to — the same answer as
 * `createCryptoBackendInterface().backendSelected`. Fixed
 * `"WasmPlanned"`.
 */
export function cryptoBackendSelected(): FedosCryptoLoaderBackendKind {
  return "WasmPlanned";
}

/**
 * Pure, standalone: whether any backend has ever actually been
 * activated through this Interface — the same answer as
 * `createCryptoBackendInterface().backendActivated`. Fixed `false` —
 * no parameter or override anywhere can flip it.
 */
export function cryptoBackendActivated(): boolean {
  return false;
}

/**
 * Pure, standalone: whether the Interface itself is ready to route a
 * real call — the same answer as
 * `createCryptoBackendInterface().interfaceReady`. Fixed `false` — no
 * parameter or override anywhere can flip it.
 */
export function cryptoBackendInterfaceReady(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY the Interface is not ready — the same answer
 * as `createCryptoBackendInterface().reason`. Fixed
 * `"BackendInterfacePending"`.
 */
export function cryptoBackendInterfaceReason(): FedosCryptoBackendInterfaceReason {
  return "BackendInterfacePending";
}
