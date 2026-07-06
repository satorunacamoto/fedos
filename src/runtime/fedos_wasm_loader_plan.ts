/**
 * Stage 502 — FedOS WASM Loader Plan (pure data, fixed-value only).
 *
 * `docs/runtime_wasm_loader_planning.md` (Stage 501) separates "when
 * may the generated JS glue ever load" into five ordered phases:
 * Loader Creation (already real, `fedos_wasm_loader.ts`, Stage 489),
 * Import Permission, Initialization Permission, Runtime Attach, and
 * Worker Attach. THIS file names the LAST FOUR of those phases as
 * four independent, pure operations — `planImport()`/
 * `planInitialize()`/`planRuntimeAttach()`/`planWorkerAttach()` —
 * each one PLANNED, never executed, and each one fixed
 * `"BlockedByPolicy"`.
 *
 * Stage 503 wires `src/runtime/fedos_wasm_loader.ts` to CONSTRUCT a
 * `FedosWasmLoaderPlan` and call it — the result is DISCARDED, and
 * `FedosWasmLoader`'s own return values are UNCHANGED. That is the
 * ONLY caller of this file anywhere in this repository; neither
 * `create_runtime.ts` nor `src/worker.ts` references it, directly or
 * indirectly.
 *
 * Stage 511 extends `planImport()` DOWNWARD only: it now calls
 * `evaluateWasmLoaderImportPolicy()` (`fedos_wasm_loader_import_policy.ts`,
 * Stage 510) — then DISCARDS the result and returns its OWN,
 * unchanged `"BlockedByPolicy"` answer. This mirrors
 * `fedos_wasm_loader.ts`'s own Stage 503 precedent of reaching one
 * link deeper while changing nothing about its own return value.
 *
 * HARD GUARDRAILS:
 *   - Every function/method in this file is PURE, synchronous, and
 *     returns a hand-fixed constant. None ever inspects
 *     `packages/fedos-core-rust/pkg/`, `import.meta`, the filesystem,
 *     or any environment variable.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/`fetch`/
 *     `initSync`/default-init reference of any kind.
 *   - NO `child_process`/filesystem/`process.env` reference.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`
 *     — `planRuntimeAttach()`/`planWorkerAttach()` NAME the phase,
 *     they never perform it.
 *   - `planImport()`/`planInitialize()`/`planRuntimeAttach()`/
 *     `planWorkerAttach()` ALWAYS resolve `"BlockedByPolicy"` in this
 *     stage — `"Allowed"` exists in `FedosWasmLoaderPlanDecisionState`
 *     only as a RESERVED label for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever
 *     produce it.
 *   - `loaderPlanState()`/`status().state` is fixed `"PlanningOnly"`
 *     — this file only ever plans an operation, never performs one.
 *   - `loaderImportAllowed()`/`loaderInitializationAllowed()` are
 *     fixed `false` — no parameter or override anywhere can flip
 *     them.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { evaluateWasmLoaderImportPolicy } from "./fedos_wasm_loader_import_policy.js";

/**
 * The Loader Plan's own coarse mode. `"PlanningOnly"` is the ONLY
 * value this stage's implementation ever produces; `"Active"` is
 * RESERVED, unreachable from this file — mirrors
 * `FedosWasmLoaderMode` (`fedos_wasm_loader.ts`, Stage 489) at the
 * plan level.
 */
export type FedosWasmLoaderPlanState = "PlanningOnly" | "Active";

/** A non-sensitive snapshot of the Loader Plan. `reason` is human-readable and non-sensitive. */
export interface FedosWasmLoaderPlanStatus {
  readonly state: FedosWasmLoaderPlanState;
  readonly reason: string;
}

/**
 * The outcome of `FedosWasmLoaderPlan.planImport()`/`planInitialize()`/
 * `planRuntimeAttach()`/`planWorkerAttach()`. `"BlockedByPolicy"` is
 * the ONLY value this stage's implementation ever produces;
 * `"Allowed"` is RESERVED.
 */
export type FedosWasmLoaderPlanDecisionState = "BlockedByPolicy" | "Allowed";

/** Which of the four phases (Stage 501, phases #2–#5) a `FedosWasmLoaderPlanDecision` describes. */
export type FedosWasmLoaderPlanOperation = "import" | "initialize" | "runtimeAttach" | "workerAttach";

/** The result of a `FedosWasmLoaderPlan` plan call. No module bytes, handle, or secret material of any kind. */
export interface FedosWasmLoaderPlanDecision {
  readonly operation: FedosWasmLoaderPlanOperation;
  readonly state: FedosWasmLoaderPlanDecisionState;
  readonly reason: string;
}

/**
 * The standalone, pure WASM Loader Plan. Names phases #2–#5 of
 * `docs/runtime_wasm_loader_planning.md` — never imports the
 * generated JS glue, never references Runtime/Worker.
 * `FedosWasmLoaderPlanSkeleton` is the one implementation this stage
 * provides.
 */
export interface FedosWasmLoaderPlan {
  status(): FedosWasmLoaderPlanStatus;
  planImport(): FedosWasmLoaderPlanDecision;
  planInitialize(): FedosWasmLoaderPlanDecision;
  planRuntimeAttach(): FedosWasmLoaderPlanDecision;
  planWorkerAttach(): FedosWasmLoaderPlanDecision;
}

/**
 * The placeholder `FedosWasmLoaderPlan` — always reports
 * `"PlanningOnly"`, and every planned operation always resolves
 * `"BlockedByPolicy"`. Constructing an instance does nothing: no
 * file read, no module imported, no WASM instantiated.
 */
export class FedosWasmLoaderPlanSkeleton implements FedosWasmLoaderPlan {
  constructor() {
    // Does nothing: no file read, no module imported, no WASM instantiated.
  }

  status(): FedosWasmLoaderPlanStatus {
    return {
      state: "PlanningOnly",
      reason: "FedOS WASM loader plan is a fixed planning record, not a real load/attach",
    };
  }

  planImport(): FedosWasmLoaderPlanDecision {
    this.#reachImportPolicy(); // result discarded -- the generated JS glue is never imported
    return this.#blocked("import");
  }

  planInitialize(): FedosWasmLoaderPlanDecision {
    return this.#blocked("initialize");
  }

  planRuntimeAttach(): FedosWasmLoaderPlanDecision {
    return this.#blocked("runtimeAttach");
  }

  planWorkerAttach(): FedosWasmLoaderPlanDecision {
    return this.#blocked("workerAttach");
  }

  /**
   * PRIVATE — calls `evaluateWasmLoaderImportPolicy()`. The result is
   * discarded; it is never passed to `WebAssembly.instantiate`/
   * `compile`, `initSync`/the default init export,
   * `packages/fedos-core-rust`, Runtime, or Worker.
   */
  #reachImportPolicy(): void {
    evaluateWasmLoaderImportPolicy();
  }

  #blocked(operation: FedosWasmLoaderPlanOperation): FedosWasmLoaderPlanDecision {
    return {
      operation,
      state: "BlockedByPolicy",
      reason: `FedOS WASM loader plan does not perform ${operation} in this stage: fail-closed policy blocks every planned phase`,
    };
  }
}

/**
 * Build a `FedosWasmLoaderPlan`. `FedosWasmLoader`'s own placeholder
 * (Stage 503) is the ONLY caller of this function in this repository
 * — plus this codebase's own test suite. Pure; never throws.
 */
export function createFedosWasmLoaderPlan(): FedosWasmLoaderPlan {
  return new FedosWasmLoaderPlanSkeleton();
}

/**
 * Pure, standalone: phase #2 (Import Permission) — usable by
 * diagnostics WITHOUT constructing a `FedosWasmLoaderPlan` instance.
 * Fixed `"BlockedByPolicy"`.
 */
export function planImport(): FedosWasmLoaderPlanDecision {
  return new FedosWasmLoaderPlanSkeleton().planImport();
}

/**
 * Pure, standalone: phase #3 (Initialization Permission). Fixed
 * `"BlockedByPolicy"`.
 */
export function planInitialize(): FedosWasmLoaderPlanDecision {
  return new FedosWasmLoaderPlanSkeleton().planInitialize();
}

/**
 * Pure, standalone: phase #4 (Runtime Attach). Fixed
 * `"BlockedByPolicy"`.
 */
export function planRuntimeAttach(): FedosWasmLoaderPlanDecision {
  return new FedosWasmLoaderPlanSkeleton().planRuntimeAttach();
}

/**
 * Pure, standalone: phase #5 (Worker Attach). Fixed
 * `"BlockedByPolicy"`.
 */
export function planWorkerAttach(): FedosWasmLoaderPlanDecision {
  return new FedosWasmLoaderPlanSkeleton().planWorkerAttach();
}

/**
 * Pure, standalone: the Loader Plan's own fixed coarse mode — usable
 * by diagnostics WITHOUT constructing an instance. Fixed
 * `"PlanningOnly"`.
 */
export function loaderPlanState(): FedosWasmLoaderPlanState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether phase #2 (Import Permission) is
 * currently granted. Fixed `false` — no parameter or override
 * anywhere can flip it.
 */
export function loaderImportAllowed(): boolean {
  return false;
}

/**
 * Pure, standalone: whether phase #3 (Initialization Permission) is
 * currently granted. Fixed `false`.
 */
export function loaderInitializationAllowed(): boolean {
  return false;
}
