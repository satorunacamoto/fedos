/**
 * Stage 658 — FedOS Runtime initializeCrypto Wiring Plan (pure data,
 * fixed value only).
 *
 * `docs/runtime_initialize_crypto_wiring_plan.md` (Stage 657) is the
 * LAST layer before any real connection could ever be attempted: even
 * IF exposure were someday approved
 * (`docs/runtime_initialize_crypto_exposure_review.md`, Stage 649), a
 * Runtime connection and a Worker connection are two SEPARATE
 * decisions, and this Plan records whether each is currently
 * permitted — independently of each other, and independently of the
 * Review's own `approved` flag. THIS file is the real, fixed-value
 * implementation of that design's collapsed answer:
 * `createInitializeCryptoWiringPlan()` always resolves `{ state:
 * "PlanningOnly", runtimeWiringAllowed: false, workerWiringAllowed:
 * false, reason: "RuntimeWiringPlanPending" }` — it never references
 * the generated JS glue and has NO side effects.
 *
 * Stage 659 wires
 * `src/runtime/fedos_initialize_crypto_exposure_review.ts`'s
 * `createInitializeCryptoExposureReview()` to CALL
 * `createInitializeCryptoWiringPlan()` — the result is DISCARDED, and
 * `createInitializeCryptoExposureReview()`'s own return value stays
 * UNCHANGED (`exposed: false`, `approved: false`). That is one
 * caller of this file; neither `create_runtime.ts` nor
 * `src/worker.ts` references it, directly or indirectly, and NEITHER
 * FILE IS MODIFIED BY THIS STAGE.
 *
 * Stage 667 extends `createInitializeCryptoWiringPlan()` DOWNWARD
 * only: it now calls `createInitializeCryptoPublicApi()`
 * (`fedos_initialize_crypto_public_api.ts`, Stage 666) — then
 * DISCARDS the result and returns its OWN, unchanged `{ state:
 * "PlanningOnly", runtimeWiringAllowed: false, workerWiringAllowed:
 * false, reason: "RuntimeWiringPlanPending" }` answer. This mirrors
 * the SAME "reach one link deeper, keep your own answer" pattern
 * Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635/643/651
 * already established eighteen times over in this WASM arc.
 *
 * HARD GUARDRAILS:
 *   - `createInitializeCryptoWiringPlan()` is PURE, synchronous,
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
 *     `fedos_wasm_loader.ts` — this file only plans whether wiring
 *     would currently be permitted; it does not perform any wiring.
 *   - `createInitializeCryptoWiringPlan()` ALWAYS resolves
 *     `runtimeWiringAllowed: false`/`workerWiringAllowed: false` in
 *     this stage — `true` exists only as a RESERVED possibility for a
 *     future, separate, explicitly-reviewed stage; nothing in this
 *     file can ever produce it.
 *   - `state` is fixed `"PlanningOnly"` — this file only ever records
 *     the Plan's fixed, not-yet-wireable design; it never wires
 *     Runtime or Worker to anything.
 *   - No `SecretHandle`, `ConversationKey`, `MessageKey`, or
 *     `Nip44WirePayload` type or value is imported, referenced, or
 *     constructed anywhere in this file.
 */

import { createInitializeCryptoPublicApi } from "./fedos_initialize_crypto_public_api.js";

/**
 * The Runtime initializeCrypto Wiring Plan's own coarse state.
 * `"PlanningOnly"` is the ONLY value this stage's implementation ever
 * produces; `"Wired"` is RESERVED, unreachable from this file.
 */
export type FedosInitializeCryptoWiringPlanState = "PlanningOnly" | "Wired";

/**
 * Every reason `createInitializeCryptoWiringPlan()` can name.
 * `"RuntimeWiringPlanPending"` is the ONLY value this stage's
 * implementation ever produces. `"Allowed"` is RESERVED for a future,
 * separate, explicitly-reviewed stage; nothing in this file can ever
 * produce it.
 */
export type FedosInitializeCryptoWiringPlanReason = "RuntimeWiringPlanPending" | "Allowed";

/** The result of a `createInitializeCryptoWiringPlan()` call. No module bytes or secret material of any kind. */
export interface FedosInitializeCryptoWiringPlan {
  readonly state: FedosInitializeCryptoWiringPlanState;
  readonly runtimeWiringAllowed: boolean;
  readonly workerWiringAllowed: boolean;
  readonly reason: FedosInitializeCryptoWiringPlanReason;
}

/**
 * Evaluate the Runtime initializeCrypto Wiring Plan
 * (`docs/runtime_initialize_crypto_wiring_plan.md`) — whether a
 * Runtime connection is currently permitted, whether a Worker
 * connection is currently permitted, and why neither is. Always
 * resolves `{ state: "PlanningOnly", runtimeWiringAllowed: false,
 * workerWiringAllowed: false, reason: "RuntimeWiringPlanPending" }` in
 * this stage. Pure; never throws; takes no argument, reads no
 * `process.env`/filesystem/`import.meta`. Never references the
 * generated JS glue, and never writes `import()` of any kind.
 */
export function createInitializeCryptoWiringPlan(): FedosInitializeCryptoWiringPlan {
  reachInitializeCryptoPublicApi(); // result discarded -- the generated JS glue is never imported
  return {
    state: "PlanningOnly",
    runtimeWiringAllowed: false,
    workerWiringAllowed: false,
    reason: "RuntimeWiringPlanPending",
  };
}

/**
 * PRIVATE (module-scoped) — calls `createInitializeCryptoPublicApi()`.
 * The result is discarded; it is never passed to
 * `WebAssembly.instantiate`/`compile`, `initSync`/the default init
 * export, `packages/fedos-core-rust`, Runtime, or Worker. The
 * Runtime initializeCrypto Public API itself never references the
 * generated JS glue or writes `import()` of any kind either.
 */
function reachInitializeCryptoPublicApi(): void {
  createInitializeCryptoPublicApi();
}

/**
 * Pure, standalone: the Plan's own fixed coarse state — usable by
 * diagnostics WITHOUT calling `createInitializeCryptoWiringPlan()`.
 * Fixed `"PlanningOnly"`.
 */
export function initializeCryptoWiringPlanState(): FedosInitializeCryptoWiringPlanState {
  return "PlanningOnly";
}

/**
 * Pure, standalone: whether a Runtime connection is currently
 * permitted — the same answer as
 * `createInitializeCryptoWiringPlan().runtimeWiringAllowed`. Fixed
 * `false` — no parameter or override anywhere can flip it.
 */
export function initializeCryptoRuntimeWiringAllowed(): boolean {
  return false;
}

/**
 * Pure, standalone: whether a Worker connection is currently
 * permitted — the same answer as
 * `createInitializeCryptoWiringPlan().workerWiringAllowed`. Fixed
 * `false` — no parameter or override anywhere can flip it.
 */
export function initializeCryptoWorkerWiringAllowed(): boolean {
  return false;
}

/**
 * Pure, standalone: WHY neither wiring is currently permitted — the
 * same answer as `createInitializeCryptoWiringPlan().reason`. Fixed
 * `"RuntimeWiringPlanPending"`.
 */
export function initializeCryptoWiringPlanReason(): FedosInitializeCryptoWiringPlanReason {
  return "RuntimeWiringPlanPending";
}
