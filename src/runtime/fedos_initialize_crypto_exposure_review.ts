/**
 * Stage 650 — FedOS Runtime initializeCrypto Exposure Review (pure
 * data, fixed value only).
 *
 * `docs/runtime_initialize_crypto_exposure_review.md` (Stage 649) is
 * the FIRST layer in this arc that looks OUTWARD, toward Runtime,
 * rather than downward into the parked chain: whether
 * `initializeCrypto()` is currently exposed on `AppRuntime` in any
 * way, and whether that exposure has ever been reviewed and approved
 * — both independent of `FedosCryptoInitializationResult` (Stage
 * 642), which only answers what a completed call would report back.
 * THIS file is the real, fixed-value implementation of that design's
 * collapsed answer: `createInitializeCryptoExposureReview()` always
 * resolves `{ state: "PlanningOnly", exposed: false, approved: false,
 * reason: "RuntimeExposureReviewPending" }` — it never references the
 * generated JS glue and has NO side effects.
 *
 * Stage 651 wires
 * `src/runtime/fedos_crypto_initialization_result.ts`'s
 * `createCryptoInitializationResult()` to CALL
 * `createInitializeCryptoExposureReview()` — the result is DISCARDED,
 * and `createCryptoInitializationResult()`'s own return value stays
 * UNCHANGED (`success: false`, `backend: "None"`). That is one
 * caller of this file; neither `create_runtime.ts` nor
 * `src/worker.ts` references it, directly or indirectly, and NEITHER
 * FILE IS MODIFIED BY THIS STAGE.
 *
 * Stage 659 extends `createInitializeCryptoExposureReview()` DOWNWARD
 * only: it now calls `createInitializeCryptoWiringPlan()`
 * (`fedos_initialize_crypto_wiring_plan.ts`, Stage 658) — then
 * DISCARDS the result and returns its OWN, unchanged `{ state:
 * "PlanningOnly", exposed: false, approved: false, reason:
 * "RuntimeExposureReviewPending" }` answer. This mirrors the SAME
 * "reach one link deeper, keep your own answer" pattern
 * Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635/643
 * already established eighteen times over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createInitializeCryptoExposureReview()` is PURE, synchronous,
 *     takes no argument, and returns a hand-fixed constant. It NEVER
 *     inspects `packages/fedos-core-rust/pkg/`, `import.meta`, the
 *     filesystem, build mode, or any environment variable. NO SIDE
 *     EFFECTS of any kind.
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
 *   - NO reference to `FedosRuntimeCryptoProvider`/
 *     `RuntimeCryptoProvider`/`fedos_crypto_loader_facade.ts`/
 *     `fedos_wasm_loader.ts` — this file only records whether
 *     exposure has been reviewed; it does not expose
 *     `initializeCrypto()` anywhere.
 *   - `createInitializeCryptoExposureReview()` ALWAYS resolves
 *     `exposed: false`/`approved: false` in this stage — `true`
 *     exists only as a RESERVED possibility for a future, separate,
 *     explicitly-reviewed stage; nothing in this file can ever
 *     produce it.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     the Review's fixed, denied state; it never grants approval or
 *     exposes anything.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createInitializeCryptoWiringPlan } from "./fedos_initialize_crypto_wiring_plan.js";

/**
 * The Runtime initializeCrypto Exposure Review's own coarse state.
 * `"PlanningOnly"` is the ONLY value this stage's implementation ever
 * produces; `"Reviewed"` is RESERVED, unreachable from this file.
 */
export type FedosInitializeCryptoExposureReviewState = "PlanningOnly" | "Reviewed";

/**
 * Every reason `createInitializeCryptoExposureReview()` can name.
 * `"RuntimeExposureReviewPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosInitializeCryptoExposureReviewReason = "RuntimeExposureReviewPending" | "Allowed";

/** The result of a `createInitializeCryptoExposureReview()` call. No module bytes or secret material of any kind. */
export interface FedosInitializeCryptoExposureReview {
  readonly state: FedosInitializeCryptoExposureReviewState;
  readonly exposed: boolean;
  readonly approved: boolean;
  readonly reason: FedosInitializeCryptoExposureReviewReason;
}

/**
 * Evaluate the Runtime initializeCrypto Exposure Review
 * (`docs/runtime_initialize_crypto_exposure_review.md`) — whether
 * `initializeCrypto()` is currently exposed on `AppRuntime` in any
 * way, whether that exposure has ever been reviewed and approved, and
 * why (not). Always resolves `{ state: "PlanningOnly", exposed:
 * false, approved: false, reason: "RuntimeExposureReviewPending" }`
 * in this stage. Pure; never throws; takes no argument, reads no
 * `process.env`/filesystem/`import.meta`. Never references the
 * generated JS glue, and never writes `import()` of any kind.
 */
export function createInitializeCryptoExposureReview(): FedosInitializeCryptoExposureReview {
  reachInitializeCryptoWiringPlan(); // result discarded -- the generated JS glue is never imported
  return {
    state: "PlanningOnly",
    exposed: false,
    approved: false,
    reason: "RuntimeExposureReviewPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createInitializeCryptoWiringPlan()`.
 * The result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The
 * Runtime initializeCrypto Wiring Plan itself never references the
 * generated JS glue or writes `import()` of any kind either.
 */
function reachInitializeCryptoWiringPlan(): void {
  createInitializeCryptoWiringPlan();
}

/**
 * Pure, standalone: the Review's own fixed coarse state — usable by
 * diagnostics WITHOUT calling
 * `createInitializeCryptoExposureReview()`. Fixed `"PlanningOnly"`.
 */
export function initializeCryptoExposureState(): FedosInitializeCryptoExposureReviewState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether `initializeCrypto()` is currently exposed
 * on `AppRuntime` in any way — the same answer as
 * `createInitializeCryptoExposureReview().exposed`. Fixed `false` —
 * no parameter or override anywhere can flip it.
 */
export function initializeCryptoExposed(): boolean {
  return false;
}

/**
 * Pure, standalone: whether exposing `initializeCrypto()` has ever
 * been reviewed and approved — the same answer as
 * `createInitializeCryptoExposureReview().approved`. Fixed `false` —
 * no parameter or override anywhere can flip it.
 */
export function initializeCryptoExposureApproved(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY `initializeCrypto()` is not currently exposed
 * — the same answer as
 * `createInitializeCryptoExposureReview().reason`. Fixed
 * `"RuntimeExposureReviewPending"`.
 */
export function initializeCryptoExposureReason(): FedosInitializeCryptoExposureReviewReason {
  return "RuntimeExposureReviewPending";
}
