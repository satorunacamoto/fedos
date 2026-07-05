/**
 * Stage 258 — Runtime Crypto Config (fixed, no env).
 *
 * A single, fixed configuration value gating whether `src/runtime/runtime_crypto_bridge.ts`
 * (Stage 259) may ever resolve anything other than the safe placeholder
 * provider. `runtimeCryptoEnabled` is `false` — a HARD-CODED constant, not a
 * selection.
 *
 * HARD GUARDRAILS:
 *   - This file reads NO `RuntimeEnv` field, NO `process.env`, and no other
 *     external input of any kind — `getRuntimeCryptoConfig()` takes no
 *     parameter and its return value never varies.
 *   - `runtimeCryptoEnabled` is `false` in this stage, permanently. Flipping
 *     it is a future, separate, explicitly-reviewed stage's own decision —
 *     not a runtime toggle, not an env var, not a build flag.
 */

/** The Runtime crypto boundary's fixed configuration shape. */
export interface RuntimeCryptoConfig {
  /**
   * Whether Runtime may ever resolve a non-placeholder `RuntimeCryptoProvider`.
   * Fixed `false` in this stage — see this module's own doc comment above.
   */
  readonly runtimeCryptoEnabled: boolean;
}

/**
 * The ONLY runtime crypto config this stage produces. Frozen so accidental
 * mutation by a caller cannot flip the flag at runtime.
 */
export const RUNTIME_CRYPTO_CONFIG: RuntimeCryptoConfig = Object.freeze({
  runtimeCryptoEnabled: false,
});

/**
 * Read the fixed Runtime crypto config. Takes no parameter, reads no
 * environment variable, and always returns the same frozen object.
 */
export function getRuntimeCryptoConfig(): RuntimeCryptoConfig {
  return RUNTIME_CRYPTO_CONFIG;
}
