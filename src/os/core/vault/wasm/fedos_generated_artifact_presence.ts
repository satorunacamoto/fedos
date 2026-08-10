/**
 * Stage 538 — FedOS Generated Artifact Presence Policy (pure data,
 * fixed value only).
 *
 * `docs/runtime_generated_artifact_presence_policy.md` (Stage 537) is
 * the LAST safety layer immediately before a static import could ever
 * be written: it fixes what "the generated JS glue/`.wasm` exist" and
 * "the generated JS glue/`.wasm` may be imported" would need to mean,
 * and states plainly that presence and usage permission are separate
 * concepts — confirming a file exists on disk never, by itself,
 * grants permission to import it. THIS file is the real, fixed-value
 * implementation of that policy: `createGeneratedArtifactPresence()`
 * always resolves `{ state: "PlanningOnly", present: false, reason:
 * "ArtifactNotGeneratedForRuntime" }` — it never inspects the
 * filesystem to confirm the artifact's actual presence or absence.
 *
 * Stage 539 wires `src/runtime/fedos_wasm_static_import_readiness.ts`'s
 * `createStaticImportReadiness()` to CALL
 * `createGeneratedArtifactPresence()` — the result is DISCARDED, and
 * `createStaticImportReadiness()`'s own return value stays UNCHANGED
 * (`{ readinessState: "PlanningOnly", ready: false, reason:
 * "RuntimeNotReady" }`). That is one caller of this file; neither
 * `create_runtime.ts` nor `src/worker.ts` references it, directly or
 * indirectly.
 *
 * Stage 547 extends `createGeneratedArtifactPresence()` DOWNWARD only:
 * it now calls `createStaticImportActivationReview()`
 * (`fedos_static_import_activation_review.ts`, Stage 546) — then
 * DISCARDS the result and returns its OWN, unchanged `{ state:
 * "PlanningOnly", present: false, reason:
 * "ArtifactNotGeneratedForRuntime" }` answer. This mirrors the SAME
 * "reach one link deeper, keep your own answer" pattern
 * Stage 503/511/519/527/535/539 already established six times over in
 * this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createGeneratedArtifactPresence()` is PURE, synchronous, takes
 *     no argument, and returns a hand-fixed constant. It NEVER
 *     inspects `packages/fedos-core-rust/pkg/`, `import.meta`, the
 *     filesystem, or any environment variable.
 *   - NO `fs`/`node:fs`/`path`/`node:path`/`existsSync`/`statSync`/
 *     glob API of any kind — presence is NEVER determined by a live
 *     filesystem check (see `docs/runtime_generated_artifact_presence_policy.md`
 *     §2 for why).
 *   - NO `import`/`import()`/`require()` of `fedos_core_rust.js`/
 *     `fedos_core_rust_bg.wasm`, or any other generated artifact.
 *   - NO `WebAssembly.instantiate`/`WebAssembly.compile`/
 *     `WebAssembly.instantiateStreaming`/`fetch`/`initSync`/
 *     default-init reference of any kind.
 *   - NO `child_process`/`process.env` reference.
 *   - NO reference to `create_runtime.ts`/`AppRuntime`/`src/worker.ts`.
 *   - `createGeneratedArtifactPresence()` ALWAYS resolves `present:
 *     false` in this stage — `true` exists only as a RESERVED
 *     possibility for a future, separate, explicitly-reviewed stage;
 *     nothing in this file can ever produce it.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     a policy answer, never performs a live presence check.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createStaticImportActivationReview } from "./fedos_static_import_activation_review.js";

/**
 * The Generated Artifact Presence Policy's own coarse state.
 * `"PlanningOnly"` is the ONLY value this stage's implementation ever
 * produces; `"Checked"` is RESERVED, unreachable from this file.
 */
export type FedosGeneratedArtifactPresenceState = "PlanningOnly" | "Checked";

/**
 * Every reason `createGeneratedArtifactPresence()` can name.
 * `"ArtifactNotGeneratedForRuntime"` is the ONLY value this stage's
 * implementation ever produces (per
 * `docs/runtime_generated_artifact_presence_policy.md`'s conditions,
 * all currently unconfirmed or insufficient alone). `"Present"` is
 * RESERVED for a future, separate, explicitly-reviewed stage; nothing
 * in this file can ever produce it.
 */
export type FedosGeneratedArtifactPresenceReason = "ArtifactNotGeneratedForRuntime" | "Present";

/** The result of a `createGeneratedArtifactPresence()` call. No module bytes or secret material of any kind. */
export interface FedosGeneratedArtifactPresence {
  readonly state: FedosGeneratedArtifactPresenceState;
  readonly present: boolean;
  readonly reason: FedosGeneratedArtifactPresenceReason;
}

/**
 * Evaluate whether the generated JS glue/`.wasm` named by
 * `docs/runtime_wasm_static_import_plan.md` are present and usable for
 * Runtime, and why (not). Always resolves `{ state: "PlanningOnly",
 * present: false, reason: "ArtifactNotGeneratedForRuntime" }` in this
 * stage. Pure; never throws; takes no argument, reads no
 * `process.env`/filesystem/`import.meta`. Never touches the generated
 * JS glue in any way.
 */
export function createGeneratedArtifactPresence(): FedosGeneratedArtifactPresence {
  reachStaticImportActivationReview(); // result discarded -- the generated JS glue is never imported
  return {
    state: "PlanningOnly",
    present: false,
    reason: "ArtifactNotGeneratedForRuntime",
  };
}

/**
 * PRIVATE (module-scoped) — calls
 * `createStaticImportActivationReview()`. The result is discarded; it
 * is never passed to `WebAssembly.instantiate`/`compile`, `initSync`/
 * the default init export, `packages/fedos-core-rust`, Runtime, or
 * Worker. The Activation Review itself never references the generated
 * JS glue either.
 */
function reachStaticImportActivationReview(): void {
  createStaticImportActivationReview();
}

/**
 * Pure, standalone: the policy's own fixed coarse state — usable by
 * diagnostics WITHOUT calling `createGeneratedArtifactPresence()`.
 * Fixed `"PlanningOnly"`.
 */
export function artifactPresenceState(): FedosGeneratedArtifactPresenceState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether the generated artifact is currently
 * present-and-usable for Runtime — the same answer as
 * `createGeneratedArtifactPresence().present`. Fixed `false` — no
 * parameter or override anywhere can flip it.
 */
export function artifactPresent(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY the generated artifact is not currently
 * present-and-usable — the same answer as
 * `createGeneratedArtifactPresence().reason`. Fixed
 * `"ArtifactNotGeneratedForRuntime"`.
 */
export function artifactPresenceReason(): FedosGeneratedArtifactPresenceReason {
  return "ArtifactNotGeneratedForRuntime";
}
