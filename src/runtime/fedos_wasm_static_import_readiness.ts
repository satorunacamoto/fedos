/**
 * Stage 534 — FedOS WASM Static Import Readiness (pure data, fixed
 * value only).
 *
 * `docs/runtime_wasm_static_import_readiness.md` (Stage 533) names the
 * EIGHT conditions that would ALL need to hold, simultaneously, before
 * the static import named by `docs/runtime_wasm_static_import_plan.md`
 * (Stage 517) could ever actually run — even assuming a future stage
 * someday satisfied the Safety Review (`fedos_wasm_static_import_review.ts`,
 * Stage 526). THIS file is the real, fixed-value implementation of
 * that readiness record: `createStaticImportReadiness()` always
 * resolves `{ readinessState: "PlanningOnly", ready: false, reason:
 * "RuntimeNotReady" }` — it never inspects the generated JS glue, the
 * filesystem, or any environment variable.
 *
 * Stage 535 wires `src/runtime/fedos_wasm_static_import_review.ts`'s
 * `reviewStaticImport()` to CALL `createStaticImportReadiness()` — the
 * result is DISCARDED, and `reviewStaticImport()`'s own return value
 * stays UNCHANGED (`{ approved: false, reason:
 * "GeneratedArtifactNotCommitted" }`). That is the ONLY caller of this
 * file anywhere in this repository; neither `create_runtime.ts` nor
 * `src/worker.ts` references it, directly or indirectly.
 *
 * HARD GUARDRAILS:
 *   - `createStaticImportReadiness()` is PURE, synchronous, takes no
 *     argument, and returns a hand-fixed constant. It NEVER inspects
 *     `packages/fedos-core-rust/pkg/`, `import.meta`, the filesystem,
 *     or any environment variable.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/
 *     `WebAssembly.instantiateStreaming`/`fetch`/`initSync`/
 *     default-init reference of any kind.
 *   - NO `child_process`/filesystem/`process.env` reference.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`.
 *   - `createStaticImportReadiness()` ALWAYS resolves `ready: false` in
 *     this stage — `true` exists only as a RESERVED possibility for a
 *     future, separate, explicitly-reviewed stage; nothing in this
 *     file can ever produce it.
 *   - `readinessState` is fixed `"PlanningOnly"` — this file only ever
 *     plans/records readiness, never performs the import it evaluates.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

/**
 * The Static Import Readiness record's own coarse state.
 * `"PlanningOnly"` is the ONLY value this stage's implementation ever
 * produces; `"Ready"` is RESERVED, unreachable from this file.
 */
export type FedosWasmStaticImportReadinessState = "PlanningOnly" | "Ready";

/**
 * Every reason `createStaticImportReadiness()` can name.
 * `"RuntimeNotReady"` is the ONLY value this stage's implementation
 * ever produces (per `docs/runtime_wasm_static_import_readiness.md`
 * §1's eight conditions, all currently unmet or insufficient alone).
 * `"Ready"` is RESERVED for a future, separate, explicitly-reviewed
 * stage; nothing in this file can ever produce it.
 */
export type FedosWasmStaticImportReadinessReason = "RuntimeNotReady" | "Ready";

/** The result of a `createStaticImportReadiness()` call. No module bytes or secret material of any kind. */
export interface FedosWasmStaticImportReadiness {
  readonly readinessState: FedosWasmStaticImportReadinessState;
  readonly ready: boolean;
  readonly reason: FedosWasmStaticImportReadinessReason;
}

/**
 * Evaluate whether the static import named by
 * `docs/runtime_wasm_static_import_plan.md` is ready to ever run, and
 * why (not). Always resolves `{ readinessState: "PlanningOnly", ready:
 * false, reason: "RuntimeNotReady" }` in this stage. Pure; never
 * throws; takes no argument, reads no `process.env`/filesystem/
 * `import.meta`. Never touches the generated JS glue in any way.
 */
export function createStaticImportReadiness(): FedosWasmStaticImportReadiness {
  return {
    readinessState: "PlanningOnly",
    ready: false,
    reason: "RuntimeNotReady",
  };
}

/**
 * Pure, standalone: the readiness record's own fixed coarse state —
 * usable by diagnostics WITHOUT calling `createStaticImportReadiness()`.
 * Fixed `"PlanningOnly"`.
 */
export function staticImportReadinessState(): FedosWasmStaticImportReadinessState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether the static import is currently ready to
 * run — the same answer as `createStaticImportReadiness().ready`.
 * Fixed `false` — no parameter or override anywhere can flip it.
 */
export function staticImportReady(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY the static import is not currently ready —
 * the same answer as `createStaticImportReadiness().reason`. Fixed
 * `"RuntimeNotReady"`.
 */
export function staticImportReadinessReason(): FedosWasmStaticImportReadinessReason {
  return "RuntimeNotReady";
}
