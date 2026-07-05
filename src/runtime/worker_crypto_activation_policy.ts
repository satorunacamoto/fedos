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
 * `RuntimeCryptoConfig`/`WorkerCryptoConfig` and the two registries. The
 * ENV PARSER itself (`src/runtime/crypto_provider_env.ts`) is the ONE
 * thing intentionally shared between Runtime and Worker (same as Stage
 * 281 already established for `FEDOS_CRYPTO_PROVIDER`) — so both sides
 * interpret `FEDOS_CRYPTO_ENABLED` identically; only the POLICY
 * (priority order, types, function) stays independent.
 *
 * Stage 297 adds the DUAL-LOCK model's second lock: `env?.FEDOS_CRYPTO_ENABLED`
 * is now ALSO consulted — the gate is "enabled" if EITHER
 * `config.workerCryptoEnabled` (still permanently `false`, unchanged) OR
 * the env lock parses to `"explicit-dev-only"`. `worker_crypto_bridge.ts`
 * itself is NOT touched, so a real `FedosRuntimeCryptoProvider` still
 * never gets resolved regardless of this policy's own answer.
 *
 * Stage 308 makes this policy's "is a real implementation present"
 * check READ `fedos_runtime_crypto_provider.ts`'s (Stage 305)
 * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` directly — the SAME single
 * source of truth the Runtime policy now reads too (both describe the
 * ONE shared `FedosRuntimeCryptoProvider` class, already registered
 * under `"fedos"` in BOTH registries since Stage 265/274). This is NOT
 * "sharing the activation policy" — `ActivationReason`/
 * `ActivationDecision`/`ActivationPolicy`/`evaluateWorkerCryptoActivation`
 * remain independently defined here, exactly as before.
 *
 * HARD GUARDRAILS:
 *   - `evaluateWorkerCryptoActivation` NEVER returns `{ allowed: true,
 *     reason: "Allowed" }` in this stage — `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`
 *     is fixed `false`, with NO parameter or override letting any caller
 *     flip it. `"Allowed"`/`"FutureFeature"` are RESERVED labels only.
 *     This holds REGARDLESS of `FEDOS_CRYPTO_ENABLED`/`FEDOS_CRYPTO_PROVIDER`.
 *   - Reads NO `process.env`/`RuntimeEnv` — takes an already-resolved
 *     `WorkerCryptoConfig` plus an OPTIONAL, already-resolved
 *     `FedosCryptoProviderEnvLike` as its only inputs.
 *   - Never calls a `RuntimeCryptoProvider` method, never constructs one,
 *     never references `packages/fedos-core-rust`.
 *   - Priority order (first match wins), exactly the same shape as the
 *     Runtime policy (independently implemented, not shared):
 *     1. `!(workerCryptoEnabled || envLockEnabled)` → `"DisabledByConfig"`.
 *     2. `workerCryptoProvider !== "fedos"` → `"ProviderNotSelected"`.
 *     3. Otherwise → `"ProviderUnavailable"`, because
 *        `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` is fixed `false`.
 */

import type { FedosCryptoProviderEnvLike } from "./crypto_provider_env.js";
import { parseFedosCryptoEnabledEnv } from "./crypto_provider_env.js";
import { FEDOS_RUNTIME_PROVIDER_IMPLEMENTED } from "./fedos_runtime_crypto_provider.js";
import type { WorkerCryptoConfig } from "./worker_crypto_config.js";

/**
 * Every reason `evaluateWorkerCryptoActivation` can name. `"FutureFeature"`
 * and `"Allowed"` are RESERVED — neither is ever produced by this stage's
 * implementation; see this module's own doc comment above.
 */
export type ActivationReason =
  | "DisabledByConfig" // neither workerCryptoEnabled nor the FEDOS_CRYPTO_ENABLED lock is open
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
 * resolved `WorkerCryptoConfig` (plus an OPTIONAL, already-resolved
 * `FedosCryptoProviderEnvLike` for the Lock #2 env var) to an
 * `ActivationDecision`. `evaluateWorkerCryptoActivation` is the one
 * implementation this stage provides.
 */
export type ActivationPolicy = (
  config: WorkerCryptoConfig,
  env?: FedosCryptoProviderEnvLike,
) => ActivationDecision;

/**
 * Evaluate whether Worker may activate a real FedOS-backed
 * `RuntimeCryptoProvider` right now, and why (not). See this module's own
 * doc comment above for the exact priority order, including the Stage
 * 297 dual-lock combination. Pure; never throws; never mutates
 * `config`/`env`.
 */
export const evaluateWorkerCryptoActivation: ActivationPolicy = (
  config: WorkerCryptoConfig,
  env?: FedosCryptoProviderEnvLike,
): ActivationDecision => {
  const envLockEnabled = parseFedosCryptoEnabledEnv(env?.FEDOS_CRYPTO_ENABLED) === "explicit-dev-only";
  const enabled = config.workerCryptoEnabled || envLockEnabled;
  if (!enabled) {
    return { allowed: false, reason: "DisabledByConfig" };
  }
  if (config.workerCryptoProvider !== "fedos") {
    return { allowed: false, reason: "ProviderNotSelected" };
  }
  if (!FEDOS_RUNTIME_PROVIDER_IMPLEMENTED) {
    return { allowed: false, reason: "ProviderUnavailable" };
  }
  // Unreachable in this stage: FEDOS_RUNTIME_PROVIDER_IMPLEMENTED is
  // permanently false above, regardless of both locks being open.
  return { allowed: true, reason: "Allowed" };
};
