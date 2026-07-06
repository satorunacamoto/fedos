/**
 * Stage 518 — FedOS WASM Static Import Plan (pure data, fixed value
 * only).
 *
 * `docs/runtime_wasm_static_import_plan.md` (Stage 517) names the
 * EXACT static `import` statement a future, separate,
 * explicitly-reviewed stage would eventually write —
 * `packages/fedos-core-rust/pkg/fedos_core_rust.js`, expecting the
 * two exports `docs/runtime_wasm_js_glue_contract.md` (Stage 481)
 * directly observed (`initSync` named, `default`/`__wbg_init`
 * default) — without ever writing that statement. THIS file is the
 * real, fixed-value implementation of that plan:
 * `planStaticImport()` always resolves `"BlockedByPolicy"`; the
 * target path is recorded as a plain, non-resolved STRING LABEL,
 * never `import()`-ed, `require()`-ed, or read from the filesystem to
 * confirm it exists.
 *
 * Stage 519 wires `src/runtime/fedos_wasm_loader_import_policy.ts`'s
 * `evaluateWasmLoaderImportPolicy()` to CONSTRUCT a
 * `FedosWasmStaticImportPlan` and call it — the result is DISCARDED,
 * and `evaluateWasmLoaderImportPolicy()`'s own return value stays
 * UNCHANGED (`{ allowed: false, reason: "BlockedByPolicy" }`). That is
 * the ONLY caller of this file anywhere in this repository; neither
 * `create_runtime.ts` nor `src/worker.ts` references it, directly or
 * indirectly.
 *
 * HARD GUARDRAILS:
 *   - Every function/method in this file is PURE, synchronous, and
 *     returns a hand-fixed constant. None ever inspects
 *     `packages/fedos-core-rust/pkg/`, `import.meta`, the filesystem,
 *     or any environment variable — `FEDOS_WASM_STATIC_IMPORT_TARGET`
 *     is a plain string constant, never resolved against a real path.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/
 *     `WebAssembly.instantiateStreaming`/`fetch`/`initSync`/
 *     default-init reference of any kind.
 *   - NO `child_process`/filesystem/`process.env` reference.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`.
 *   - `planStaticImport()` ALWAYS resolves `"BlockedByPolicy"` in this
 *     stage — `"Allowed"` exists in `FedosWasmStaticImportDecisionState`
 *     only as a RESERVED label for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever
 *     produce it.
 *   - `status().state` is fixed `"PlanningOnly"` — this file only
 *     ever plans an import, never performs one.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

/**
 * The exact path a future static `import` would target — the SAME
 * file `docs/runtime_wasm_js_glue_contract.md` (Stage 481) directly
 * observed. A plain string LABEL: never passed to `import()`,
 * `require()`, `fetch`, or any filesystem API anywhere in this file.
 */
export const FEDOS_WASM_STATIC_IMPORT_TARGET = "packages/fedos-core-rust/pkg/fedos_core_rust.js";

/**
 * The Static Import Plan's own coarse mode. `"PlanningOnly"` is the
 * ONLY value this stage's implementation ever produces; `"Active"` is
 * RESERVED, unreachable from this file.
 */
export type FedosWasmStaticImportState = "PlanningOnly" | "Active";

/** A non-sensitive snapshot of the Static Import Plan. `reason` is human-readable and non-sensitive. */
export interface FedosWasmStaticImportStatus {
  readonly state: FedosWasmStaticImportState;
  readonly target: string;
  readonly reason: string;
}

/**
 * The outcome of `FedosWasmStaticImportPlan.planStaticImport()`.
 * `"BlockedByPolicy"` is the ONLY value this stage's implementation
 * ever produces; `"Allowed"` is RESERVED.
 */
export type FedosWasmStaticImportDecisionState = "BlockedByPolicy" | "Allowed";

/** The result of a `FedosWasmStaticImportPlan.planStaticImport()` call. No module bytes or secret material of any kind. */
export interface FedosWasmStaticImportDecision {
  readonly state: FedosWasmStaticImportDecisionState;
  readonly target: string;
  readonly reason: string;
}

/**
 * The standalone, pure WASM Static Import Plan. Names the exact
 * static `import` a future stage would write — never imports the
 * generated JS glue, never references Runtime/Worker.
 * `FedosWasmStaticImportPlanSkeleton` is the one implementation this
 * stage provides.
 */
export interface FedosWasmStaticImportPlan {
  status(): FedosWasmStaticImportStatus;
  planStaticImport(): FedosWasmStaticImportDecision;
}

/**
 * The placeholder `FedosWasmStaticImportPlan` — always reports
 * `"PlanningOnly"`, and `planStaticImport()` always resolves
 * `"BlockedByPolicy"`. Constructing an instance does nothing: no
 * file read, no module imported, no WASM instantiated.
 */
export class FedosWasmStaticImportPlanSkeleton implements FedosWasmStaticImportPlan {
  constructor() {
    // Does nothing: no file read, no module imported, no WASM instantiated.
  }

  status(): FedosWasmStaticImportStatus {
    return {
      state: "PlanningOnly",
      target: FEDOS_WASM_STATIC_IMPORT_TARGET,
      reason: "FedOS WASM static import plan is a fixed planning record, not a real import",
    };
  }

  planStaticImport(): FedosWasmStaticImportDecision {
    return {
      state: "BlockedByPolicy",
      target: FEDOS_WASM_STATIC_IMPORT_TARGET,
      reason: "FedOS WASM static import plan does not perform the import in this stage: fail-closed policy blocks it",
    };
  }
}

/**
 * Build a `FedosWasmStaticImportPlan`.
 * `fedos_wasm_loader_import_policy.ts`'s own `evaluateWasmLoaderImportPolicy()`
 * (Stage 519) is the ONLY caller of this function in this repository
 * — plus this codebase's own test suite. Pure; never throws.
 */
export function createFedosWasmStaticImportPlan(): FedosWasmStaticImportPlan {
  return new FedosWasmStaticImportPlanSkeleton();
}

/**
 * Pure, standalone: the planned static import decision — usable by
 * diagnostics WITHOUT constructing a `FedosWasmStaticImportPlan`
 * instance. Fixed `"BlockedByPolicy"`.
 */
export function planStaticImport(): FedosWasmStaticImportDecision {
  return new FedosWasmStaticImportPlanSkeleton().planStaticImport();
}

/**
 * Pure, standalone: the Static Import Plan's own fixed coarse mode.
 * Fixed `"PlanningOnly"`.
 */
export function staticImportPlanState(): FedosWasmStaticImportState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: the fixed import target path — the same string
 * as `FEDOS_WASM_STATIC_IMPORT_TARGET`, exposed as a function for
 * consistency with this arc's other diagnostics-facing accessors.
 */
export function staticImportTarget(): string {
  return FEDOS_WASM_STATIC_IMPORT_TARGET;
}

/**
 * Pure, standalone: whether the static import is currently allowed.
 * Fixed `false` — no parameter or override anywhere can flip it.
 */
export function staticImportAllowed(): boolean {
  return false;
}
