/**
 * Stage 526 — FedOS WASM Static Import Safety Review (pure data, fixed
 * value only).
 *
 * `docs/runtime_wasm_static_import_safety_review.md` (Stage 525) is a
 * dedicated SAFETY REVIEW of what would break, and why, if the static
 * `import` statement `docs/runtime_wasm_static_import_plan.md` (Stage
 * 517) names were ever written: the generated JS glue is a gitignored,
 * never-committed build artifact (`packages/fedos-core-rust/.gitignore`,
 * Stage 451), so a static import of it would break every environment
 * that has not just run `npm run build:wasm` locally. THIS file is the
 * real, fixed-value implementation of that review:
 * `reviewStaticImport()` always resolves `{ approved: false, reason:
 * "GeneratedArtifactNotCommitted" }` — it never inspects the
 * filesystem to confirm the artifact's actual presence or absence.
 *
 * Stage 527 wires `src/runtime/fedos_wasm_static_import_plan.ts`'s
 * `planStaticImport()` to CALL `reviewStaticImport()` — the result is
 * DISCARDED, and `planStaticImport()`'s own return value stays
 * UNCHANGED (`"BlockedByPolicy"`). That is one caller of this file;
 * neither `create_runtime.ts` nor `src/worker.ts` references it,
 * directly or indirectly.
 *
 * Stage 535 extends `reviewStaticImport()` DOWNWARD only: it now calls
 * `createStaticImportReadiness()` (`fedos_wasm_static_import_readiness.ts`,
 * Stage 534) — then DISCARDS the result and returns its OWN, unchanged
 * `{ approved: false, reason: "GeneratedArtifactNotCommitted" }`
 * answer. This mirrors the SAME "reach one link deeper, keep your own
 * answer" pattern Stage 503/511/519/527 already established four times
 * over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `reviewStaticImport()` is PURE, synchronous, takes no argument,
 *     and returns a hand-fixed constant. It NEVER inspects
 *     `packages/fedos-core-rust/pkg/`, `import.meta`, the filesystem,
 *     or any environment variable.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/
 *     `WebAssembly.instantiateStreaming`/`fetch`/`initSync`/
 *     default-init reference of any kind.
 *   - NO `child_process`/filesystem/`process.env` reference.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`.
 *   - `reviewStaticImport()` ALWAYS resolves `approved: false` in this
 *     stage — `true` exists only as a RESERVED possibility for a
 *     future, separate, explicitly-reviewed stage; nothing in this
 *     file can ever produce it.
 *   - `reviewState()` is fixed `"ReviewedAndBlocked"` — this file only
 *     ever reviews the plan, never performs the import it reviews.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createStaticImportReadiness } from "./fedos_wasm_static_import_readiness.js";

/**
 * The Static Import Safety Review's own coarse state. `"ReviewedAndBlocked"`
 * is the ONLY value this stage's implementation ever produces; `"Approved"`
 * is RESERVED, unreachable from this file.
 */
export type FedosWasmStaticImportReviewState = "ReviewedAndBlocked" | "Approved";

/**
 * Every reason `reviewStaticImport()` can name. `"GeneratedArtifactNotCommitted"`
 * is the ONLY value this stage's implementation ever produces (per
 * `docs/runtime_wasm_static_import_safety_review.md` §2/§3). `"Approved"`
 * is RESERVED for a future, separate, explicitly-reviewed stage; nothing
 * in this file can ever produce it.
 */
export type FedosWasmStaticImportReviewReason = "GeneratedArtifactNotCommitted" | "Approved";

/** The result of a `reviewStaticImport()` call. No module bytes or secret material of any kind. */
export interface FedosWasmStaticImportReviewDecision {
  readonly approved: boolean;
  readonly reason: FedosWasmStaticImportReviewReason;
}

/**
 * Evaluate whether the static import named by
 * `docs/runtime_wasm_static_import_plan.md` may ever be written right
 * now, and why (not). Always resolves `{ approved: false, reason:
 * "GeneratedArtifactNotCommitted" }` in this stage. Pure; never
 * throws; takes no argument, reads no `process.env`/filesystem/
 * `import.meta`.
 */
export function reviewStaticImport(): FedosWasmStaticImportReviewDecision {
  reachStaticImportReadiness(); // result discarded -- the generated JS glue is never imported
  return {
    approved: false,
    reason: "GeneratedArtifactNotCommitted",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createStaticImportReadiness()`. The
 * result is discarded; it is never passed to `WebAssembly.instantiate`/
 * `compile`, `initSync`/the default init export, `packages/fedos-core-rust`,
 * Runtime, or Worker. The Readiness record itself never imports
 * anything either.
 */
function reachStaticImportReadiness(): void {
  createStaticImportReadiness();
}

/**
 * Pure, standalone: the Safety Review's own fixed coarse state —
 * usable by diagnostics WITHOUT calling `reviewStaticImport()`. Fixed
 * `"ReviewedAndBlocked"`.
 */
export function staticImportReviewState(): FedosWasmStaticImportReviewState {
  return "ReviewedAndBlocked";
}

/**
 * Pure, standalone: whether the static import is currently approved —
 * the same answer as `reviewStaticImport().approved`. Fixed `false` —
 * no parameter or override anywhere can flip it.
 */
export function staticImportReviewApproved(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY the static import is not currently approved —
 * the same answer as `reviewStaticImport().reason`. Fixed
 * `"GeneratedArtifactNotCommitted"`.
 */
export function staticImportReviewReason(): FedosWasmStaticImportReviewReason {
  return "GeneratedArtifactNotCommitted";
}
