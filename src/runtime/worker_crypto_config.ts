/**
 * Stage 273 — Worker Crypto Config (fixed, no env).
 *
 * A single, fixed configuration pair gating whether `src/runtime/worker_crypto_bridge.ts`
 * (Stage 275) may ever resolve anything other than the safe placeholder
 * provider — the Worker-side counterpart of
 * `src/runtime/runtime_crypto_config.ts` (Stage 258/267). `workerCryptoEnabled`
 * is `false` — a HARD-CODED constant, not a selection.
 *
 * This is a DELIBERATELY SEPARATE config from `RuntimeCryptoConfig` — Worker's
 * own opt-in decision is its own knob, never sharing state with (or being
 * flipped by) Runtime's. Neither config reads the other.
 *
 * Stage 283 makes `workerCryptoProvider` READ the SAME `FEDOS_CRYPTO_PROVIDER`
 * env var Runtime reads (`src/runtime/runtime_crypto_config.ts`, Stage 282)
 * — via `src/runtime/crypto_provider_env.ts`'s (Stage 281) shared
 * `parseFedosCryptoProviderEnv`, so both sides interpret it identically.
 * `getWorkerCryptoConfig` now accepts an OPTIONAL `FedosCryptoProviderEnvLike`.
 *
 * HARD GUARDRAILS:
 *   - This file reads NO `process.env` anywhere — only the OPTIONAL,
 *     explicitly-passed `env` parameter's own `FEDOS_CRYPTO_PROVIDER`
 *     field, via `parseFedosCryptoProviderEnv`.
 *   - Omitting `env` (or passing one without `FEDOS_CRYPTO_PROVIDER` set)
 *     resolves `workerCryptoProvider` to `"placeholder"`.
 *   - `workerCryptoEnabled` is `false` in this stage, permanently —
 *     UNAFFECTED by `env` of any kind. Flipping it is a future, separate,
 *     explicitly-reviewed stage's own decision — not a runtime toggle, not
 *     an env var, not a build flag.
 */

import type { FedosCryptoProviderEnvLike, FedosCryptoProviderName } from "./crypto_provider_env.js";
import { parseFedosCryptoProviderEnv } from "./crypto_provider_env.js";

/** The only provider names `WorkerCryptoConfig.workerCryptoProvider` may hold. */
export type WorkerCryptoProviderName = FedosCryptoProviderName;

/** Every valid `WorkerCryptoProviderName`, for validation/documentation helpers. */
export const WORKER_CRYPTO_PROVIDER_NAMES: readonly WorkerCryptoProviderName[] = [
  "placeholder",
  "fedos",
];

/** The Worker crypto boundary's configuration shape. */
export interface WorkerCryptoConfig {
  /**
   * Whether Worker may ever resolve a non-placeholder `RuntimeCryptoProvider`.
   * Fixed `false` in this stage — see this module's own doc comment above.
   */
  readonly workerCryptoEnabled: boolean;
  /**
   * Which provider NAME would be used if `workerCryptoEnabled` were ever
   * `true` — read from `FEDOS_CRYPTO_PROVIDER` (Stage 283). Defaults to
   * `"placeholder"` when unset/unrecognized.
   */
  readonly workerCryptoProvider: WorkerCryptoProviderName;
}

/**
 * The fixed, no-env-supplied Worker crypto config — `workerCryptoProvider`
 * here is `"placeholder"` only because no `env` was ever passed to compute
 * it. Kept for callers that want a constant rather than calling
 * `getWorkerCryptoConfig()` with no argument (the two are equivalent).
 */
export const WORKER_CRYPTO_CONFIG: WorkerCryptoConfig = Object.freeze({
  workerCryptoEnabled: false,
  workerCryptoProvider: "placeholder",
});

/**
 * Read the Worker crypto config. `workerCryptoEnabled` is always `false`,
 * regardless of `env`. `workerCryptoProvider` is
 * `parseFedosCryptoProviderEnv(env?.FEDOS_CRYPTO_PROVIDER)` — `"placeholder"`
 * when `env` is omitted or lacks a recognized value. Reads NO
 * `process.env` — only the explicitly-passed `env` parameter, if any.
 */
export function getWorkerCryptoConfig(
  env?: FedosCryptoProviderEnvLike,
): WorkerCryptoConfig {
  return Object.freeze({
    workerCryptoEnabled: false,
    workerCryptoProvider: parseFedosCryptoProviderEnv(env?.FEDOS_CRYPTO_PROVIDER),
  });
}
