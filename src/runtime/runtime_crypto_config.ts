/**
 * Stage 258 — Runtime Crypto Config (fixed, no env).
 *
 * A single, fixed configuration value gating whether `src/runtime/runtime_crypto_bridge.ts`
 * (Stage 259) may ever resolve anything other than the safe placeholder
 * provider. `runtimeCryptoEnabled` is `false` — a HARD-CODED constant, not a
 * selection.
 *
 * Stage 267 adds `runtimeCryptoProvider`, an explicit opt-in NAME choosing
 * WHICH provider would be used if `runtimeCryptoEnabled` were ever `true` —
 * `"placeholder"` (the fixed default) or `"fedos"`
 * (`src/runtime/fedos_runtime_crypto_provider.ts`, Stage 265/266, itself
 * still encrypt/decrypt-`Unsupported`). This is a SEPARATE knob from
 * `runtimeCryptoEnabled`: even setting `runtimeCryptoProvider: "fedos"`
 * changes nothing while `runtimeCryptoEnabled` stays `false` — see
 * `src/runtime/runtime_crypto_bridge.ts` (Stage 268) for the combined check.
 *
 * HARD GUARDRAILS:
 *   - This file reads NO `RuntimeEnv` field, NO `process.env`, and no other
 *     external input of any kind — `getRuntimeCryptoConfig()` takes no
 *     parameter and its return value never varies.
 *   - `runtimeCryptoEnabled` is `false` in this stage, permanently. Flipping
 *     it is a future, separate, explicitly-reviewed stage's own decision —
 *     not a runtime toggle, not an env var, not a build flag.
 *   - `runtimeCryptoProvider` is fixed at `"placeholder"` in this stage,
 *     permanently — this file contains no logic that could ever set it to
 *     `"fedos"`.
 */

/** The only provider names `RuntimeCryptoConfig.runtimeCryptoProvider` may hold. */
export type RuntimeCryptoProviderName = "placeholder" | "fedos";

/** Every valid `RuntimeCryptoProviderName`, for validation/documentation helpers. */
export const RUNTIME_CRYPTO_PROVIDER_NAMES: readonly RuntimeCryptoProviderName[] = [
  "placeholder",
  "fedos",
];

/** The Runtime crypto boundary's fixed configuration shape. */
export interface RuntimeCryptoConfig {
  /**
   * Whether Runtime may ever resolve a non-placeholder `RuntimeCryptoProvider`.
   * Fixed `false` in this stage — see this module's own doc comment above.
   */
  readonly runtimeCryptoEnabled: boolean;
  /**
   * Which provider NAME would be used if `runtimeCryptoEnabled` were ever
   * `true`. Fixed `"placeholder"` in this stage, permanently — see this
   * module's own doc comment above.
   */
  readonly runtimeCryptoProvider: RuntimeCryptoProviderName;
}

/**
 * The ONLY runtime crypto config this stage produces. Frozen so accidental
 * mutation by a caller cannot flip either field at runtime.
 */
export const RUNTIME_CRYPTO_CONFIG: RuntimeCryptoConfig = Object.freeze({
  runtimeCryptoEnabled: false,
  runtimeCryptoProvider: "placeholder",
});

/**
 * Read the fixed Runtime crypto config. Takes no parameter, reads no
 * environment variable, and always returns the same frozen object.
 */
export function getRuntimeCryptoConfig(): RuntimeCryptoConfig {
  return RUNTIME_CRYPTO_CONFIG;
}
