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
 * Stage 793 (Prototype Phase 008) extends `createWasmBackend()`
 * DOWNWARD only: it now calls `createFedosWasmLoader()`
 * (`fedos_wasm_loader.ts`, Stage 489–492) and its `planLoad()` — the
 * FIRST time anything in this repository ever reaches the real,
 * previously-"unwired" `FedosWasmLoader` Skeleton. `planLoad()`
 * resolves `{ operation: "load", state: "BlockedByPolicy", policy:
 * "FailClosed", reason: "..." }` — that result is DISCARDED, and
 * `createWasmBackend()`'s own return value stays UNCHANGED
 * (`state: "PlanningOnly"`, `backendReady: false`, `loaderAttached:
 * false`, `loaderKind: "WasmLoaderPlanned"`, `reason:
 * "WasmBackendPlanningPending"`). This is the ONLY caller of
 * `fedos_wasm_loader.ts` anywhere in this repository besides this
 * codebase's own test suite — `fedos_wasm_loader_plan.ts`/
 * `fedos_wasm_loader_contract.ts`/`create_runtime.ts`/`src/worker.ts`
 * still do NOT reference it, directly or indirectly, and NONE of
 * those files is modified by this stage.
 *
 * This file remains a TERMINUS for the Backend Interface's OWN reach:
 * per `docs/runtime_wasm_backend_planning.md` §1, the diagram still
 * ends `WASM Backend Planning -> STOP` from the Interface's point of
 * view, even though this file itself now reaches one further link
 * (the real `FedosWasmLoader`, still only PLANNING, never loading)
 * internally. This file does NOT call the generated JS glue,
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, or Rust in any way — the Loader's own `planLoad()` stops at
 * `"BlockedByPolicy"`, and reaching further (the generated JS glue,
 * Rust) remains a future, separate, explicitly-reviewed stage's
 * decision.
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
 *   - NO reference to `fedos_wasm_loader_plan.ts`/
 *     `fedos_wasm_loader_contract.ts` — only `fedos_wasm_loader.ts`
 *     itself is reached (Stage 793), and only its `planLoad()`; this
 *     file does not import or call either of those two other files
 *     directly.
 *   - NO reference to `fedos_crypto_loader_backend.ts`/
 *     `fedos_crypto_backend_interface.ts` — this file is called BY the
 *     Backend Interface, never the reverse.
 *   - NO reference to the generated JS glue, `WebAssembly.instantiate`/
 *     `compile`/`instantiateStreaming`, `initSync`/the default init
 *     export, or Rust — `FedosWasmLoader.planLoad()` stops at
 *     `"BlockedByPolicy"` and this file never reaches past it.
 *   - `createWasmBackend()` ALWAYS resolves `backendReady: false` and
 *     `loaderAttached: false` in this stage — `true` exists only as a
 *     RESERVED possibility for a future, separate, explicitly-reviewed
 *     stage; nothing in this file can ever produce either, even though
 *     the real Loader is now reached.
 *   - `state` is fixed `"PlanningOnly"` and `loaderKind` is fixed
 *     `"WasmLoaderPlanned"` — this file only ever records this
 *     planning layer's fixed, not-yet-active design; it never
 *     activates a backend or attaches a loader of any kind.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import type { FedosWasmLoaderDecisionState } from "./fedos_wasm_loader.js";
import { createFedosWasmLoader } from "./fedos_wasm_loader.js";

/**
 * The WASM Backend Planning layer's own coarse state. `"PlanningOnly"`
 * is the ONLY value this stage's implementation ever produces;
 * `"Active"` is RESERVED, unreachable from this file.
 */
export type FedosWasmBackendState = "PlanningOnly" | "Active";

/**
 * The loader kind this backend currently plans to attach.
 * `"WasmLoaderPlanned"` is the ONLY value `createWasmBackend()` ever
 * produces in this stage — the SAME `fedos_wasm_loader.ts` Loader
 * Skeleton this file now actually reaches (Stage 793) via
 * `reachWasmLoader()`, though `loaderKind` itself remains a fixed
 * label, never a live read of the Loader's own state. `"WasmLoaderActive"`
 * names a future, real, ATTACHED loader; nothing in this file can ever
 * produce it — reaching `planLoad()` and having it resolve
 * `"BlockedByPolicy"` is not attachment.
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
 * never writes `import()` of any kind. Reaches ONE further link (the
 * real `FedosWasmLoader`, `fedos_wasm_loader.ts`, Stage 793) and
 * discards its result — this function's OWN return value stays
 * byte-for-byte unchanged. Never references the generated JS glue,
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, or Rust.
 */
export function createWasmBackend(): FedosWasmBackend {
  reachWasmLoader(); // result discarded -- FedosWasmLoader.planLoad() stops at "BlockedByPolicy"
  return {
    state: "PlanningOnly",
    backendReady: false,
    loaderAttached: false,
    loaderKind: "WasmLoaderPlanned",
    reason: "WasmBackendPlanningPending",
  };
}

/**
 * PRIVATE (module-scoped) — constructs a `FedosWasmLoader`
 * (`fedos_wasm_loader.ts`, Stage 489–492) and calls its `planLoad()`.
 * The result (`{ operation: "load", state: "BlockedByPolicy", policy:
 * "FailClosed", reason: "..." }`) is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The Loader
 * itself never imports the generated JS glue or executes Rust either —
 * `planLoad()` only reaches its own internal Loader Plan
 * (`fedos_wasm_loader_plan.ts`), never further.
 */
function reachWasmLoader(): void {
  const loader = createFedosWasmLoader();
  loader.planLoad();
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

/**
 * Pure, standalone: whether `createWasmBackend()` has actually reached
 * the real `FedosWasmLoader` (Stage 793) — fixed `true`, since
 * `reachWasmLoader()` is unconditionally called every time. This is a
 * STRUCTURAL fact (the code path exists and runs), NOT a claim that
 * any module is loaded — see `wasmBackendLoaderLoaded()` below.
 */
export function wasmBackendLoaderReached(): boolean {
  return true;
}

/**
 * Pure, standalone: whether the real WASM Loader has ever actually
 * loaded anything — fixed `false`. `planLoad()` only PLANS the
 * operation and resolves `"BlockedByPolicy"`; no module is ever
 * imported, fetched, or instantiated.
 */
export function wasmBackendLoaderLoaded(): boolean {
  return false;
}

/**
 * Pure, standalone: the real `FedosWasmLoader.planLoad()`'s own
 * decision state — the same answer that call resolves to, echoed here
 * for diagnostics WITHOUT calling `createWasmBackend()`. Fixed
 * `"BlockedByPolicy"` — `"Allowed"` is RESERVED for a future, separate,
 * explicitly-reviewed stage; nothing in this file can ever produce it.
 */
export function wasmBackendLoaderDecision(): FedosWasmLoaderDecisionState {
  return "BlockedByPolicy";
}
