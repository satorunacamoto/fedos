/**
 * Stage 763 — FedOS Crypto Backend Resolver (pure data, fixed value
 * only).
 *
 * `docs/runtime_crypto_backend_resolver.md` (Stage 762) names the
 * seam directly below the Crypto Backend Interface
 * (`fedos_crypto_backend_interface.ts`, Stage 746) that answers ONE
 * narrow question only: which backend does this repository currently
 * plan to use — kept deliberately separate from "is that backend
 * ready to load" (the Interface's own `interfaceReady`/WASM Backend
 * Planning's own `backendReady`/`loaderAttached`). THIS file is the
 * real, fixed-value implementation of that design's collapsed answer:
 * `createCryptoBackendResolver()` always resolves `{ state:
 * "PlanningOnly", selectedBackend: "WasmPlanned", backendResolved:
 * false, backendAvailable: false, reason:
 * "BackendResolutionPending" }` — it never references the generated
 * JS glue, the real WASM Loader, or Rust, and has NO side effects.
 *
 * Stage 764 wires `src/runtime/fedos_crypto_backend_interface.ts`'s
 * `createCryptoBackendInterface()` to CALL
 * `createCryptoBackendResolver()` as a SECOND, separate reach —
 * alongside its pre-existing reach into `createWasmBackend()` (Stage
 * 746), NOT replacing it. The result is DISCARDED, and
 * `createCryptoBackendInterface()`'s own return value stays UNCHANGED
 * (`state: "PlanningOnly"`, `backendSelected: "WasmPlanned"`,
 * `backendActivated: false`, `interfaceReady: false`, `reason:
 * "BackendInterfacePending"`). That is the ONLY caller of this file
 * anywhere in this repository; neither `create_runtime.ts` nor
 * `src/worker.ts` references it, directly or indirectly, and NEITHER
 * FILE IS MODIFIED BY THIS STAGE.
 *
 * This file is a TERMINUS: per `docs/runtime_crypto_backend_resolver.md`
 * §1, the diagram ends `Backend Resolver -> STOP`. This file does NOT
 * call the real WASM Loader (`fedos_wasm_loader.ts`), the generated JS
 * glue, `fedos_wasm_backend.ts`, or Rust in any way — that remains a
 * future, separate, explicitly-reviewed stage's decision.
 *
 * HARD GUARDRAILS:
 *   - `createCryptoBackendResolver()` is PURE, synchronous, takes no
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
 *     `fedos_wasm_loader_contract.ts`/`fedos_wasm_backend.ts` — the
 *     real WASM Loader and WASM Backend Planning remain unreachable
 *     from this Resolver; this file is a TERMINUS, not another "reach
 *     one link deeper" step.
 *   - NO reference to `fedos_crypto_backend_interface.ts` — this file
 *     is called BY the Interface, never the reverse.
 *   - This file NEVER creates, resolves, or makes available a real
 *     backend of any kind — `selectedBackend` is a fixed echo, not a
 *     live resolution; `backendResolved`/`backendAvailable` ALWAYS
 *     resolve `false`.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     this Resolver's fixed, not-yet-resolved design; it never
 *     activates a backend or resolves anything for real.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file. No NIP-17/NIP-44/NIP-59,
 *     Double Ratchet, or Triple Ratchet reference of any kind.
 */

import type { FedosCryptoLoaderBackendKind } from "./fedos_crypto_loader_backend.js";

/**
 * The Backend Resolver's own coarse state. `"PlanningOnly"` is the
 * ONLY value this stage's implementation ever produces; `"Active"` is
 * RESERVED, unreachable from this file.
 */
export type FedosCryptoBackendResolverState = "PlanningOnly" | "Active";

/**
 * Every reason `createCryptoBackendResolver()` can name.
 * `"BackendResolutionPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosCryptoBackendResolverReason = "BackendResolutionPending" | "Allowed";

/** The result of a `createCryptoBackendResolver()` call. No module bytes or secret material of any kind. */
export interface FedosCryptoBackendResolver {
  readonly state: FedosCryptoBackendResolverState;
  readonly selectedBackend: FedosCryptoLoaderBackendKind;
  readonly backendResolved: boolean;
  readonly backendAvailable: boolean;
  readonly reason: FedosCryptoBackendResolverReason;
}

/**
 * Evaluate the Crypto Backend Resolver
 * (`docs/runtime_crypto_backend_resolver.md`) — its own coarse state,
 * which backend this repository currently plans to use, whether that
 * resolution has ever actually completed, and whether the resolved
 * backend is actually available. Always resolves `{ state:
 * "PlanningOnly", selectedBackend: "WasmPlanned", backendResolved:
 * false, backendAvailable: false, reason:
 * "BackendResolutionPending" }` in this stage. Pure; never throws;
 * takes no argument, reads no `process.env`/filesystem/`import.meta`.
 * Never references the generated JS glue or the real WASM Loader, and
 * never writes `import()` of any kind. Calls nothing further — this
 * file is a TERMINUS (see this module's own top-of-file doc comment).
 */
export function createCryptoBackendResolver(): FedosCryptoBackendResolver {
  return {
    state: "PlanningOnly",
    selectedBackend: "WasmPlanned",
    backendResolved: false,
    backendAvailable: false,
    reason: "BackendResolutionPending",
  };
}

/**
 * Pure, standalone: the Backend Resolver's own fixed coarse state —
 * usable by diagnostics WITHOUT calling `createCryptoBackendResolver()`.
 * Fixed `"PlanningOnly"`.
 */
export function cryptoBackendResolverState(): FedosCryptoBackendResolverState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: which backend this repository currently plans to
 * use — the same answer as
 * `createCryptoBackendResolver().selectedBackend`. Fixed
 * `"WasmPlanned"`.
 */
export function cryptoBackendResolverSelected(): FedosCryptoLoaderBackendKind {
  return "WasmPlanned";
}

/**
 * Pure, standalone: whether resolution has ever actually completed —
 * the same answer as `createCryptoBackendResolver().backendResolved`.
 * Fixed `false` — no parameter or override anywhere can flip it.
 */
export function cryptoBackendResolved(): boolean {
  return false;
}

/**
 * Pure, standalone: whether the resolved backend is actually
 * available to load right now — the same answer as
 * `createCryptoBackendResolver().backendAvailable`. Fixed `false` —
 * no parameter or override anywhere can flip it.
 */
export function cryptoBackendAvailable(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY resolution/availability is not settled — the
 * same answer as `createCryptoBackendResolver().reason`. Fixed
 * `"BackendResolutionPending"`.
 */
export function cryptoBackendResolverReason(): FedosCryptoBackendResolverReason {
  return "BackendResolutionPending";
}
