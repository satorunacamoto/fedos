/**
 * Stage 554 — FedOS Generated Artifact Distribution Policy (pure data,
 * fixed value only).
 *
 * `docs/runtime_generated_artifact_distribution_policy.md` (Stage 553)
 * fixes a standing PROJECT POLICY: whether the generated `.wasm`/JS
 * glue pair (`packages/fedos-core-rust/pkg/`) should ever be committed
 * to version control (Option A) or produced fresh at build time on
 * every machine that needs it (Option B) — this repository adopts
 * Option B, unchanged by this stage, matching the existing
 * `/target/`/`/build/`/`Cargo.lock`/`*.wasm`/`*.rlib` gitignore
 * discipline (`packages/fedos-core-rust/.gitignore`, Stage 451/69).
 * THIS file is the real, fixed-value implementation of that policy:
 * `createGeneratedArtifactDistribution()` always resolves `{
 * distributionMode: "BuildTimeGenerated", artifactCommitted: false,
 * staticImportSafe: false, reason: "GeneratedArtifactNotCommitted" }`
 * — it never inspects the filesystem or git state to confirm this.
 *
 * Stage 555 wires
 * `src/runtime/fedos_static_import_activation_review.ts`'s
 * `createStaticImportActivationReview()` to CALL
 * `createGeneratedArtifactDistribution()` — the result is DISCARDED,
 * and `createStaticImportActivationReview()`'s own return value stays
 * UNCHANGED (`{ state: "PlanningOnly", approved: false, reason:
 * "RuntimeActivationReviewPending" }`). That is the ONLY caller of
 * this file anywhere in this repository; neither `create_runtime.ts`
 * nor `src/worker.ts` references it, directly or indirectly.
 *
 * HARD GUARDRAILS:
 *   - `createGeneratedArtifactDistribution()` is PURE, synchronous,
 *     takes no argument, and returns a hand-fixed constant. It NEVER
 *     inspects `packages/fedos-core-rust/pkg/`, `import.meta`, the
 *     filesystem, git state, or any environment variable.
 *   - NO `fs`/`node:fs`/`path`/`node:path`/`existsSync`/`statSync`/
 *     glob API of any kind.
 *   - NO `child_process`/`git`/shell invocation of any kind.
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact —
 *     the generated JS glue is never referenced by this file at all.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/
 *     `WebAssembly.instantiateStreaming`/`fetch`/`initSync`/
 *     default-init reference of any kind.
 *   - NO `process.env` reference.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`.
 *   - `createGeneratedArtifactDistribution()` ALWAYS resolves
 *     `staticImportSafe: false`/`artifactCommitted: false` in this
 *     stage — `true` exists only as a RESERVED possibility for a
 *     future, separate, explicitly-reviewed stage; nothing in this
 *     file can ever produce it.
 *   - `distributionMode` is fixed `"BuildTimeGenerated"` — this file
 *     only ever records the standing policy choice, never generates,
 *     commits, or checks for the generated artifact.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

/**
 * The Generated Artifact Distribution Policy's own coarse mode.
 * `"BuildTimeGenerated"` (Option B) is the ONLY value this stage's
 * implementation ever produces; `"Committed"` (Option A) is RESERVED,
 * unreachable from this file.
 */
export type FedosGeneratedArtifactDistributionMode = "BuildTimeGenerated" | "Committed";

/**
 * Every reason `createGeneratedArtifactDistribution()` can name.
 * `"GeneratedArtifactNotCommitted"` is the ONLY value this stage's
 * implementation ever produces (per
 * `docs/runtime_generated_artifact_distribution_policy.md`'s Option B
 * choice). `"Approved"` is RESERVED for a future, separate,
 * explicitly-reviewed stage; nothing in this file can ever produce it.
 */
export type FedosGeneratedArtifactDistributionReason = "GeneratedArtifactNotCommitted" | "Approved";

/** The result of a `createGeneratedArtifactDistribution()` call. No module bytes or secret material of any kind. */
export interface FedosGeneratedArtifactDistribution {
  readonly distributionMode: FedosGeneratedArtifactDistributionMode;
  readonly artifactCommitted: boolean;
  readonly staticImportSafe: boolean;
  readonly reason: FedosGeneratedArtifactDistributionReason;
}

/**
 * Report this repository's standing Generated Artifact Distribution
 * Policy — how `packages/fedos-core-rust/pkg/` is distributed, and
 * whether that choice makes a static import currently safe. Always
 * resolves `{ distributionMode: "BuildTimeGenerated",
 * artifactCommitted: false, staticImportSafe: false, reason:
 * "GeneratedArtifactNotCommitted" }` in this stage. Pure; never
 * throws; takes no argument, reads no `process.env`/filesystem/git
 * state/`import.meta`. Never references the generated JS glue in any
 * way.
 */
export function createGeneratedArtifactDistribution(): FedosGeneratedArtifactDistribution {
  return {
    distributionMode: "BuildTimeGenerated",
    artifactCommitted: false,
    staticImportSafe: false,
    reason: "GeneratedArtifactNotCommitted",
  };
}

/**
 * Pure, standalone: the policy's own fixed distribution mode — usable
 * by diagnostics WITHOUT calling
 * `createGeneratedArtifactDistribution()`. Fixed
 * `"BuildTimeGenerated"`.
 */
export function generatedArtifactDistributionMode(): FedosGeneratedArtifactDistributionMode {
  return "BuildTimeGenerated";
}

/**
 * Pure, standalone: whether the generated artifact is committed to
 * version control — the same answer as
 * `createGeneratedArtifactDistribution().artifactCommitted`. Fixed
 * `false` — no parameter or override anywhere can flip it.
 */
export function generatedArtifactCommitted(): boolean {
  return false;
}

/**
 * Pure, standalone: whether a static import is currently safe given
 * this distribution policy — the same answer as
 * `createGeneratedArtifactDistribution().staticImportSafe`. Fixed
 * `false`.
 */
export function staticImportSafe(): boolean {
  return false;
}
