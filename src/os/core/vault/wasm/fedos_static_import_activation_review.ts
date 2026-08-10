/**
 * Stage 546 — FedOS Static Import Activation Review (pure data, fixed
 * value only).
 *
 * `docs/runtime_static_import_activation_review.md` (Stage 545) is the
 * FINAL GATE immediately before real static import could ever be
 * permitted — one level below the Generated Artifact Presence Policy
 * (`fedos_generated_artifact_presence.ts`, Stage 538), gathering every
 * prior gate's answer (Safety Review, Readiness, Artifact Presence,
 * Generated JS Glue built, Runtime-side review, Fail Closed, crypto
 * API unexposed) into a single, named ACTIVATION decision. THIS file
 * is the real, fixed-value implementation of that review:
 * `createStaticImportActivationReview()` always resolves `{ state:
 * "PlanningOnly", approved: false, reason:
 * "RuntimeActivationReviewPending" }` — it never references the
 * generated JS glue in any way.
 *
 * Stage 547 wires `src/runtime/fedos_generated_artifact_presence.ts`'s
 * `createGeneratedArtifactPresence()` to CALL
 * `createStaticImportActivationReview()` — the result is DISCARDED,
 * and `createGeneratedArtifactPresence()`'s own return value stays
 * UNCHANGED (`{ state: "PlanningOnly", present: false, reason:
 * "ArtifactNotGeneratedForRuntime" }`). That is one caller of this
 * file; neither `create_runtime.ts` nor `src/worker.ts` references it,
 * directly or indirectly.
 *
 * Stage 555 extends `createStaticImportActivationReview()` DOWNWARD
 * only: it now calls `createGeneratedArtifactDistribution()`
 * (`fedos_generated_artifact_distribution.ts`, Stage 554) — then
 * DISCARDS the result and returns its OWN, unchanged `{ state:
 * "PlanningOnly", approved: false, reason:
 * "RuntimeActivationReviewPending" }` answer. This mirrors the SAME
 * "reach one link deeper, keep your own answer" pattern
 * Stage 503/511/519/527/535/539/547 already established seven times
 * over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createStaticImportActivationReview()` is PURE, synchronous,
 *     takes no argument, and returns a hand-fixed constant. It NEVER
 *     inspects `packages/fedos-core-rust/pkg/`, `import.meta`, the
 *     filesystem, or any environment variable.
 *   - NO `fs`/`node:fs`/`path`/`node:path`/`existsSync`/`statSync`/
 *     glob API of any kind.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact —
 *     the generated JS glue is never referenced by this file at all.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/
 *     `WebAssembly.instantiateStreaming`/`fetch`/`initSync`/
 *     default-init reference of any kind.
 *   - NO `child_process`/`process.env` reference.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`.
 *   - `createStaticImportActivationReview()` ALWAYS resolves
 *     `approved: false` in this stage — `true` exists only as a
 *     RESERVED possibility for a future, separate, explicitly-reviewed
 *     stage; nothing in this file can ever produce it.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     a review answer, never performs the activation it reviews.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createGeneratedArtifactDistribution } from "./fedos_generated_artifact_distribution.js";

/**
 * The Static Import Activation Review's own coarse state.
 * `"PlanningOnly"` is the ONLY value this stage's implementation ever
 * produces; `"Reviewed"` is RESERVED, unreachable from this file.
 */
export type FedosStaticImportActivationState = "PlanningOnly" | "Reviewed";

/**
 * Every reason `createStaticImportActivationReview()` can name.
 * `"RuntimeActivationReviewPending"` is the ONLY value this stage's
 * implementation ever produces (per
 * `docs/runtime_static_import_activation_review.md`'s seven
 * conditions, all currently unmet or insufficient alone). `"Approved"`
 * is RESERVED for a future, separate, explicitly-reviewed stage;
 * nothing in this file can ever produce it.
 */
export type FedosStaticImportActivationReason = "RuntimeActivationReviewPending" | "Approved";

/** The result of a `createStaticImportActivationReview()` call. No module bytes or secret material of any kind. */
export interface FedosStaticImportActivationReview {
  readonly state: FedosStaticImportActivationState;
  readonly approved: boolean;
  readonly reason: FedosStaticImportActivationReason;
}

/**
 * Evaluate whether the static import named by
 * `docs/runtime_wasm_static_import_plan.md` is currently activated for
 * real use, and why (not). Always resolves `{ state: "PlanningOnly",
 * approved: false, reason: "RuntimeActivationReviewPending" }` in this
 * stage. Pure; never throws; takes no argument, reads no
 * `process.env`/filesystem/`import.meta`. Never references the
 * generated JS glue in any way.
 */
export function createStaticImportActivationReview(): FedosStaticImportActivationReview {
  reachGeneratedArtifactDistribution(); // result discarded -- the generated JS glue is never imported
  return {
    state: "PlanningOnly",
    approved: false,
    reason: "RuntimeActivationReviewPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls
 * `createGeneratedArtifactDistribution()`. The result is discarded; it
 * is never passed to `WebAssembly.instantiate`/`compile`, `initSync`/
 * the default init export, `packages/fedos-core-rust`, Runtime, or
 * Worker. The Distribution Policy itself never references the
 * generated JS glue either.
 */
function reachGeneratedArtifactDistribution(): void {
  createGeneratedArtifactDistribution();
}

/**
 * Pure, standalone: the review's own fixed coarse state — usable by
 * diagnostics WITHOUT calling `createStaticImportActivationReview()`.
 * Fixed `"PlanningOnly"`.
 */
export function staticImportActivationState(): FedosStaticImportActivationState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether static import activation is currently
 * approved — the same answer as
 * `createStaticImportActivationReview().approved`. Fixed `false` — no
 * parameter or override anywhere can flip it.
 */
export function staticImportActivationApproved(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY static import activation is not currently
 * approved — the same answer as
 * `createStaticImportActivationReview().reason`. Fixed
 * `"RuntimeActivationReviewPending"`.
 */
export function staticImportActivationReason(): FedosStaticImportActivationReason {
  return "RuntimeActivationReviewPending";
}
