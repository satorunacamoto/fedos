/**
 * Stage 730 — FedOS WASM Backend Planning Layer (pure data, fixed
 * value only).
 *
 * `docs/runtime_wasm_backend_planning.md` (Stage 729) names the seam
 * directly below the Crypto Loader Backend Abstraction
 * (`fedos_crypto_loader_backend.ts`, Stage 714) that lets the
 * Abstraction's own designated `"WasmPlanned"` candidate describe its
 * own readiness and loader-attachment state — without the
 * Abstraction, the Facade, the Provider, or Runtime ever reasoning
 * about a real WASM Loader directly. THIS file is the real,
 * fixed-value implementation of that design's collapsed answer:
 * `createWasmBackend()` always resolves `{ state: "PlanningOnly",
 * backendReady: false, loaderAttached: false, loaderKind:
 * "WasmLoaderPlanned", reason: "WasmBackendPlanningPending" }` — it
 * never references the generated JS glue, the real WASM Loader, or
 * Rust, and has NO side effects.
 *
 * Stage 737 wires `src/runtime/fedos_crypto_loader_backend.ts`'s
 * `createCryptoLoaderBackend()` to CALL `createWasmBackend()` — the
 * result is DISCARDED, and `createCryptoLoaderBackend()`'s own return
 * value stays UNCHANGED (`state: "PlanningOnly"`, `backendKind:
 * "WasmPlanned"`, `backendReady: false`, `reason:
 * "BackendAbstractionPending"`). That is the ONLY caller of this file
 * anywhere in this repository; neither `create_runtime.ts` nor
 * `src/worker.ts` references it, directly or indirectly, and NEITHER
 * FILE IS MODIFIED BY THIS STAGE.
 *
 * This file is a TERMINUS for this stage, not another "reach one link
 * deeper" step: per `docs/runtime_wasm_backend_planning.md` §1, the
 * diagram ends `WASM Backend Planning -> STOP`. This file does NOT
 * call the real WASM Loader (`fedos_wasm_loader.ts`), the generated JS
 * glue, or Rust in any way — that remains a future, separate,
 * explicitly-reviewed stage's decision.
 *
 * HARD GUARDRAILS:
 *   - `createWasmBackend()` is PURE, synchronous, takes no argument,
 *     and returns a hand-fixed constant. It NEVER inspects
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
 *     `fedos_wasm_loader_contract.ts` — this file names a planned
 *     loader kind positionally only; it does not import or call the
 *     real WASM Loader.
 *   - NO reference to `fedos_crypto_loader_backend.ts` — this file is
 *     called BY the Backend Abstraction, never the reverse.
 *   - `createWasmBackend()` ALWAYS resolves `backendReady: false` and
 *     `loaderAttached: false` in this stage — `true` exists only as a
 *     RESERVED possibility for a future, separate, explicitly-reviewed
 *     stage; nothing in this file can ever produce either.
 *   - `state` is fixed `"PlanningOnly"` and `loaderKind` is fixed
 *     `"WasmLoaderPlanned"` — this file only ever records this
 *     planning layer's fixed, not-yet-active design; it never
 *     activates a backend or attaches a loader of any kind.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

/**
 * The WASM Backend Planning layer's own coarse state. `"PlanningOnly"`
 * is the ONLY value this stage's implementation ever produces;
 * `"Active"` is RESERVED, unreachable from this file.
 */
export type FedosWasmBackendState = "PlanningOnly" | "Active";

/**
 * The loader kind this backend currently plans to attach.
 * `"WasmLoaderPlanned"` is the ONLY value `createWasmBackend()` ever
 * produces in this stage — positionally the same `fedos_wasm_loader.ts`
 * Loader Skeleton named elsewhere in this arc, but NOT imported,
 * referenced, or called by this file. `"WasmLoaderActive"` names a
 * future, real, attached loader; nothing in this file can ever
 * produce it.
 */
export type FedosWasmBackendLoaderKind = "WasmLoaderPlanned" | "WasmLoaderActive";

/**
 * Every reason `createWasmBackend()` can name.
 * `"WasmBackendPlanningPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosWasmBackendReason = "WasmBackendPlanningPending" | "Allowed";

/** The result of a `createWasmBackend()` call. No module bytes or secret material of any kind. */
export interface FedosWasmBackend {
  readonly state: FedosWasmBackendState;
  readonly backendReady: boolean;
  readonly loaderAttached: boolean;
  readonly loaderKind: FedosWasmBackendLoaderKind;
  readonly reason: FedosWasmBackendReason;
}

/**
 * Evaluate the WASM Backend Planning layer
 * (`docs/runtime_wasm_backend_planning.md`) — its own coarse state,
 * whether a real WASM backend is ready, whether a loader has ever
 * been attached, and which loader kind it currently plans to attach.
 * Always resolves `{ state: "PlanningOnly", backendReady: false,
 * loaderAttached: false, loaderKind: "WasmLoaderPlanned", reason:
 * "WasmBackendPlanningPending" }` in this stage. Pure; never throws;
 * takes no argument, reads no `process.env`/filesystem/`import.meta`.
 * Never references the generated JS glue or the real WASM Loader, and
 * never writes `import()` of any kind. Calls nothing further — this
 * file is a TERMINUS for this stage (see this module's own
 * top-of-file doc comment).
 */
export function createWasmBackend(): FedosWasmBackend {
  return {
    state: "PlanningOnly",
    backendReady: false,
    loaderAttached: false,
    loaderKind: "WasmLoaderPlanned",
    reason: "WasmBackendPlanningPending",
  };
}

/**
 * Pure, standalone: the WASM Backend Planning layer's own fixed
 * coarse state — usable by diagnostics WITHOUT calling
 * `createWasmBackend()`. Fixed `"PlanningOnly"`.
 */
export function wasmBackendState(): FedosWasmBackendState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether a real WASM backend is ready — the same
 * answer as `createWasmBackend().backendReady`. Fixed `false` — no
 * parameter or override anywhere can flip it.
 */
export function wasmBackendReady(): boolean {
  return false;
}

/**
 * Pure, standalone: whether a real WASM Loader has ever actually been
 * attached — the same answer as `createWasmBackend().loaderAttached`.
 * Fixed `false` — no parameter or override anywhere can flip it.
 */
export function wasmBackendLoaderAttached(): boolean {
  return false;
}

/**
 * Pure, standalone: the loader kind this backend currently plans to
 * attach — the same answer as `createWasmBackend().loaderKind`. Fixed
 * `"WasmLoaderPlanned"`.
 */
export function wasmBackendLoaderKind(): FedosWasmBackendLoaderKind {
  return "WasmLoaderPlanned";
}

/**
 * Pure, standalone: WHY the WASM backend is not ready — the same
 * answer as `createWasmBackend().reason`. Fixed
 * `"WasmBackendPlanningPending"`.
 */
export function wasmBackendReason(): FedosWasmBackendReason {
  return "WasmBackendPlanningPending";
}
