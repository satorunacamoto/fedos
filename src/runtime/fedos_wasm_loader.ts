/**
 * Stage 489–492 — FedOS WASM Loader Skeleton (standalone, unwired,
 * fixed-value only).
 *
 * `docs/runtime_wasm_js_glue_contract.md` (Stage 481) recorded, by
 * direct observation, what the real, locally-generated `wasm-bindgen`
 * JS glue actually exports. `src/runtime/fedos_wasm_loader_contract.ts`
 * (Stage 482) named a fixed CONTRACT SHAPE — a `status()`-only read.
 * THIS file is the next, separate link: a LOADER SKELETON that also
 * names the three OPERATIONS a real loader would eventually perform
 * (`planLoad`/`planInitialize`/`planUnload`) — each one PLANNED, never
 * executed, and each one blocked by a named POLICY
 * (`docs/runtime_wasm_loader.md`, Stage 493) rather than only by "not
 * implemented yet". This file does NOT load, import, or execute
 * anything — it names a shape a future, separate, explicitly-reviewed
 * loader stage could implement against, the same "plan/observation
 * label, never a real action" discipline every other file in this
 * WASM arc already uses.
 *
 * "Unwired" means: NO other module in this repository imports this
 * file. `create_runtime.ts`/`src/worker.ts` do not reference it,
 * neither does `fedos_wasm_loader_contract.ts`/`fedos_wasm_artifact.ts`/
 * `fedos_wasm_boundary.ts`. Only `runtime_crypto_diagnostics.ts`/
 * `worker_crypto_diagnostics.ts` (Stage 495) read its pure, standalone
 * functions for DISPLAY, and this codebase's own test suite exercises
 * it directly — the same "export for testability, wire nowhere"
 * precedent every prior link in this chain follows.
 *
 * Stage 503 extends `planLoad()` DOWNWARD only: it now builds a
 * `FedosWasmLoaderPlan` (`fedos_wasm_loader_plan.ts`, Stage 502) and
 * calls its `planImport()` — then DISCARDS the result and returns its
 * OWN, unchanged `"BlockedByPolicy"` answer. This does NOT change
 * "unwired" above (still no reference to `fedos_wasm_loader_contract.ts`/
 * `fedos_wasm_artifact.ts`/`fedos_wasm_boundary.ts`/`create_runtime.ts`/
 * `src/worker.ts`, and neither does `fedos_wasm_loader_plan.ts` itself)
 * — it only wires this file to the NEW, separate plan file directly
 * below it, mirroring `fedos_wasm_boundary.ts`'s own precedent
 * (`#reachWasmArtifact()`) of reaching one link deeper while changing
 * nothing about its own return value.
 *
 * HARD GUARDRAILS:
 *   - Every function/method in this file is PURE, synchronous, and
 *     returns a hand-fixed constant. None ever inspects
 *     `packages/fedos-core-rust/pkg/`, `import.meta`, the filesystem,
 *     or any environment variable.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/`fetch`
 *     reference of any kind.
 *   - NO `child_process`/filesystem/`process.env` reference.
 *   - `planLoad()`/`planInitialize()`/`planUnload()` ALWAYS resolve
 *     `"BlockedByPolicy"` in this stage — `"Allowed"` exists in
 *     `FedosWasmLoaderDecisionState` only as a RESERVED label for a
 *     future, separate, explicitly-reviewed stage; nothing in this
 *     file can ever produce it.
 *   - `loaderState()` is fixed `"NotLoaded"` — no loader has ever run,
 *     and this file cannot make one run.
 *   - `loaderMode()` is fixed `"PlanningOnly"` — this stage only ever
 *     PLANS an operation, never performs one.
 *   - `loaderPolicy()` is fixed `"FailClosed"` — every planned
 *     operation is denied by policy, not merely "not implemented".
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createFedosWasmLoaderPlan } from "./fedos_wasm_loader_plan.js";

/**
 * The loader's own coarse state. `"NotLoaded"` is the ONLY value this
 * stage's implementation ever produces; `"Loaded"` is RESERVED for a
 * future, separate, explicitly-reviewed stage that actually calls the
 * generated JS glue's `initSync`/default export — nothing in this
 * file can ever produce it.
 */
export type FedosWasmLoaderState = "NotLoaded" | "Loaded";

/**
 * Whether this loader is only PLANNING operations or actually
 * performing them. `"PlanningOnly"` is the ONLY value this stage's
 * implementation ever produces; `"Active"` is RESERVED, unreachable
 * from this file.
 */
export type FedosWasmLoaderMode = "PlanningOnly" | "Active";

/**
 * The fail-safety posture this loader enforces. `"FailClosed"` is the
 * ONLY value this stage's implementation ever produces — every
 * planned operation is denied by policy. `"FailOpen"` is RESERVED,
 * unreachable from this file, and would be a dangerous default this
 * codebase never adopts.
 */
export type FedosWasmLoaderPolicy = "FailClosed" | "FailOpen";

/** A non-sensitive snapshot of the loader skeleton. `reason` is human-readable and non-sensitive. */
export interface FedosWasmLoaderStatus {
  readonly state: FedosWasmLoaderState;
  readonly mode: FedosWasmLoaderMode;
  readonly policy: FedosWasmLoaderPolicy;
  readonly reason: string;
}

/**
 * The outcome of `FedosWasmLoader.planLoad()`/`planInitialize()`/
 * `planUnload()`. `"BlockedByPolicy"` is the ONLY value this stage's
 * implementation ever produces; `"Allowed"` is RESERVED.
 */
export type FedosWasmLoaderDecisionState = "BlockedByPolicy" | "Allowed";

/** Which operation a `FedosWasmLoaderDecision` describes. */
export type FedosWasmLoaderOperation = "load" | "initialize" | "unload";

/** The result of a `FedosWasmLoader.planLoad()`/`planInitialize()`/`planUnload()` call. No module bytes, handle, or secret material of any kind. */
export interface FedosWasmLoaderDecision {
  readonly operation: FedosWasmLoaderOperation;
  readonly state: FedosWasmLoaderDecisionState;
  readonly policy: FedosWasmLoaderPolicy;
  readonly reason: string;
}

/**
 * The standalone, unwired WASM Loader Skeleton. Names the three
 * operations a real loader would eventually perform — never loads,
 * imports, or executes the generated JS glue. `FedosWasmLoaderSkeleton`
 * is the one implementation this stage provides.
 */
export interface FedosWasmLoader {
  status(): FedosWasmLoaderStatus;
  planLoad(): FedosWasmLoaderDecision;
  planInitialize(): FedosWasmLoaderDecision;
  planUnload(): FedosWasmLoaderDecision;
}

/**
 * The placeholder `FedosWasmLoader` — always reports `"NotLoaded"`/
 * `"PlanningOnly"`/`"FailClosed"`, and every planned operation always
 * resolves `"BlockedByPolicy"`. Constructing an instance does
 * nothing: no file read, no module imported, no WASM instantiated.
 */
export class FedosWasmLoaderSkeleton implements FedosWasmLoader {
  constructor() {
    // Does nothing: no file read, no module imported, no WASM instantiated.
  }

  status(): FedosWasmLoaderStatus {
    return {
      state: "NotLoaded",
      mode: "PlanningOnly",
      policy: "FailClosed",
      reason: "FedOS WASM loader skeleton is a fixed planning record, not a real loader",
    };
  }

  planLoad(): FedosWasmLoaderDecision {
    this.#reachLoaderPlan(); // result discarded -- no import/initialize/attach ever happens
    return this.#blocked("load");
  }

  planInitialize(): FedosWasmLoaderDecision {
    return this.#blocked("initialize");
  }

  planUnload(): FedosWasmLoaderDecision {
    return this.#blocked("unload");
  }

  /**
   * PRIVATE — builds a `FedosWasmLoaderPlan` and calls its
   * `planImport()`. The result is discarded; it is never passed to
   * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
   * export, `packages/fedos-core-rust`, Runtime, or Worker. The
   * Loader Plan itself never imports anything either.
   */
  #reachLoaderPlan(): void {
    const plan = createFedosWasmLoaderPlan();
    plan.planImport();
  }

  #blocked(operation: FedosWasmLoaderOperation): FedosWasmLoaderDecision {
    return {
      operation,
      state: "BlockedByPolicy",
      policy: "FailClosed",
      reason: `FedOS WASM loader skeleton does not perform ${operation} in this stage: fail-closed policy blocks every planned operation`,
    };
  }
}

/**
 * Build a `FedosWasmLoader`. No other module in this repository
 * calls this function yet — it exists for direct construction by
 * this codebase's own test suite and for the pure, standalone
 * functions below. Pure; never throws.
 */
export function createFedosWasmLoader(): FedosWasmLoader {
  return new FedosWasmLoaderSkeleton();
}

/**
 * Pure, standalone: the loader's own fixed state — usable by
 * diagnostics WITHOUT constructing a `FedosWasmLoader` instance.
 * Fixed `"NotLoaded"`.
 */
export function loaderState(): FedosWasmLoaderState {
  return "NotLoaded";
}

/**
 * Pure, standalone: the loader's own fixed mode. Fixed
 * `"PlanningOnly"` — this stage only ever plans an operation, never
 * performs one.
 */
export function loaderMode(): FedosWasmLoaderMode {
  return "PlanningOnly";
}

/**
 * Pure, standalone: the loader's own fixed fail-safety policy. Fixed
 * `"FailClosed"` — every planned operation is denied by policy.
 */
export function loaderPolicy(): FedosWasmLoaderPolicy {
  return "FailClosed";
}
