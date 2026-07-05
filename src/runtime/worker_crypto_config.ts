/**
 * Stage 273 — Worker Crypto Config (fixed, no env).
 *
 * A single, fixed configuration pair gating whether `src/runtime/worker_crypto_bridge.ts`
 * (Stage 275) may ever resolve anything other than the safe placeholder
 * provider — the Worker-side counterpart of
 * `src/runtime/runtime_crypto_config.ts` (Stage 258/267). `workerCryptoEnabled`
 * is `false` and `workerCryptoProvider` is `"placeholder"` — both HARD-CODED
 * constants, not a selection.
 *
 * This is a DELIBERATELY SEPARATE config from `RuntimeCryptoConfig` — Worker's
 * own opt-in decision is its own knob, never sharing state with (or being
 * flipped by) Runtime's. Neither config reads the other.
 *
 * HARD GUARDRAILS:
 *   - This file reads NO `RuntimeEnv` field, NO `process.env`, and no other
 *     external input of any kind — `getWorkerCryptoConfig()` takes no
 *     parameter and its return value never varies.
 *   - `workerCryptoEnabled` is `false` in this stage, permanently. Flipping
 *     it is a future, separate, explicitly-reviewed stage's own decision —
 *     not a runtime toggle, not an env var, not a build flag.
 *   - `workerCryptoProvider` is fixed at `"placeholder"` in this stage,
 *     permanently — this file contains no logic that could ever set it to
 *     `"fedos"`.
 */

/** The only provider names `WorkerCryptoConfig.workerCryptoProvider` may hold. */
export type WorkerCryptoProviderName = "placeholder" | "fedos";

/** Every valid `WorkerCryptoProviderName`, for validation/documentation helpers. */
export const WORKER_CRYPTO_PROVIDER_NAMES: readonly WorkerCryptoProviderName[] = [
  "placeholder",
  "fedos",
];

/** The Worker crypto boundary's fixed configuration shape. */
export interface WorkerCryptoConfig {
  /**
   * Whether Worker may ever resolve a non-placeholder `RuntimeCryptoProvider`.
   * Fixed `false` in this stage — see this module's own doc comment above.
   */
  readonly workerCryptoEnabled: boolean;
  /**
   * Which provider NAME would be used if `workerCryptoEnabled` were ever
   * `true`. Fixed `"placeholder"` in this stage, permanently — see this
   * module's own doc comment above.
   */
  readonly workerCryptoProvider: WorkerCryptoProviderName;
}

/**
 * The ONLY worker crypto config this stage produces. Frozen so accidental
 * mutation by a caller cannot flip either field at runtime.
 */
export const WORKER_CRYPTO_CONFIG: WorkerCryptoConfig = Object.freeze({
  workerCryptoEnabled: false,
  workerCryptoProvider: "placeholder",
});

/**
 * Read the fixed Worker crypto config. Takes no parameter, reads no
 * environment variable, and always returns the same frozen object.
 */
export function getWorkerCryptoConfig(): WorkerCryptoConfig {
  return WORKER_CRYPTO_CONFIG;
}
