/**
 * Stage 290 — Worker Crypto Activation Policy.
 *
 * The Worker-side counterpart of
 * `src/runtime/runtime_crypto_activation_policy.ts` (Stage 289) —
 * DELIBERATELY a SEPARATE, independently-written implementation, not a
 * shared/generic factoring of the Runtime one. `ActivationReason`/
 * `ActivationDecision`/`ActivationPolicy` are each redefined here rather
 * than imported, and `evaluateWorkerCryptoActivation` never imports
 * anything from `runtime_crypto_activation_policy.ts` — mirroring
 * `docs/runtime_worker_activation_boundary.md`'s own "separate knob per
 * boundary, never shared state" discipline already applied to
 * `RuntimeCryptoConfig`/`WorkerCryptoConfig` and the two registries.
 *
 * HARD GUARDRAILS:
 *   - `evaluateWorkerCryptoActivation` NEVER returns `{ allowed: true,
 *     reason: "Allowed" }` in this stage — `FEDOS_PROVIDER_IMPLEMENTED`
 *     below is a fixed, PRIVATE constant, permanently `false`, with NO
 *     parameter or override letting any caller flip it.
 *     `"Allowed"`/`"FutureFeature"` are RESERVED labels only.
 *   - Reads NO `process.env`/`RuntimeEnv` — takes an already-resolved
 *     `WorkerCryptoConfig`-shaped value as its only input.
 *   - Never calls a `RuntimeCryptoProvider` method, never constructs one,
 *     never references `packages/fedos-core-rust`.
 *   - Priority order (first match wins), exactly the same shape as the
 *     Runtime policy (independently implemented, not shared):
 *     1. `!workerCryptoEnabled` → `"DisabledByConfig"`.
 *     2. `workerCryptoProvider !== "fedos"` → `"ProviderNotSelected"`.
 *     3. Otherwise → `"ProviderUnavailable"`, because
 *        `FEDOS_PROVIDER_IMPLEMENTED` is fixed `false`.
 */

import type { WorkerCryptoConfig } from "./worker_crypto_config.js";

/**
 * Every reason `evaluateWorkerCryptoActivation` can name. `"FutureFeature"`
 * and `"Allowed"` are RESERVED — neither is ever produced by this stage's
 * implementation; see this module's own doc comment above.
 */
export type ActivationReason =
  | "DisabledByConfig" // workerCryptoEnabled is false
  | "ProviderNotSelected" // workerCryptoProvider is not "fedos"
  | "ProviderUnavailable" // enabled + "fedos" selected, but no real implementation exists yet
  | "FutureFeature" // RESERVED — never produced in this stage
  | "Allowed"; // RESERVED — never produced in this stage

/** The result of a Worker activation-policy evaluation. `allowed` is always `false` in this stage. */
export interface ActivationDecision {
  readonly allowed: boolean;
  readonly reason: ActivationReason;
}

/**
 * The shape of a Worker crypto activation policy: a pure function from a
 * resolved `WorkerCryptoConfig` to an `ActivationDecision`.
 * `evaluateWorkerCryptoActivation` is the one implementation this stage
 * provides.
 */
export type ActivationPolicy = (config: WorkerCryptoConfig) => ActivationDecision;

/**
 * Fixed, PRIVATE, permanently-`false` constant: whether a real
 * `FedosRuntimeCryptoProvider` implementation exists. No parameter or
 * override anywhere in this module can flip it.
 */
const FEDOS_PROVIDER_IMPLEMENTED = false;

/**
 * Evaluate whether Worker may activate a real FedOS-backed
 * `RuntimeCryptoProvider` right now, and why (not). See this module's own
 * doc comment above for the exact priority order. Pure; never throws;
 * never mutates `config`.
 */
export const evaluateWorkerCryptoActivation: ActivationPolicy = (
  config: WorkerCryptoConfig,
): ActivationDecision => {
  if (!config.workerCryptoEnabled) {
    return { allowed: false, reason: "DisabledByConfig" };
  }
  if (config.workerCryptoProvider !== "fedos") {
    return { allowed: false, reason: "ProviderNotSelected" };
  }
  if (!FEDOS_PROVIDER_IMPLEMENTED) {
    return { allowed: false, reason: "ProviderUnavailable" };
  }
  // Unreachable in this stage: FEDOS_PROVIDER_IMPLEMENTED is permanently
  // false above.
  return { allowed: true, reason: "Allowed" };
};
