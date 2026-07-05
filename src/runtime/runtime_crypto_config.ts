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
 * `src/runtime/runtime_crypto_bridge.ts` (Stage 268/284) for the combined
 * check.
 *
 * Stage 282 makes `runtimeCryptoProvider` READ the `FEDOS_CRYPTO_PROVIDER`
 * env var — via `src/runtime/crypto_provider_env.ts`'s (Stage 281) shared
 * `parseFedosCryptoProviderEnv`, so Runtime and Worker
 * (`src/runtime/worker_crypto_config.ts`, Stage 283) interpret the SAME env
 * var identically. `getRuntimeCryptoConfig` now accepts an OPTIONAL
 * `FedosCryptoProviderEnvLike` — a real `RuntimeEnv`
 * (`src/runtime/types.ts`) satisfies this shape structurally, without that
 * interface needing any change, or callers may pass a bare
 * `{ FEDOS_CRYPTO_PROVIDER: "fedos" }` fixture directly.
 *
 * HARD GUARDRAILS:
 *   - This file reads NO `process.env` anywhere — only the OPTIONAL,
 *     explicitly-passed `env` parameter's own `FEDOS_CRYPTO_PROVIDER`
 *     field, via `parseFedosCryptoProviderEnv`.
 *   - Omitting `env` (or passing one without `FEDOS_CRYPTO_PROVIDER` set)
 *     resolves `runtimeCryptoProvider` to `"placeholder"` — the same
 *     default `parseFedosCryptoProviderEnv` itself falls back to.
 *   - `runtimeCryptoEnabled` is `false` in this stage, permanently —
 *     UNAFFECTED by `env` of any kind. Flipping it is a future, separate,
 *     explicitly-reviewed stage's own decision — not a runtime toggle, not
 *     an env var, not a build flag.
 */

import type { FedosCryptoProviderEnvLike, FedosCryptoProviderName } from "./crypto_provider_env.js";
import { parseFedosCryptoProviderEnv } from "./crypto_provider_env.js";

/** The only provider names `RuntimeCryptoConfig.runtimeCryptoProvider` may hold. */
export type RuntimeCryptoProviderName = FedosCryptoProviderName;

/** Every valid `RuntimeCryptoProviderName`, for validation/documentation helpers. */
export const RUNTIME_CRYPTO_PROVIDER_NAMES: readonly RuntimeCryptoProviderName[] = [
  "placeholder",
  "fedos",
];

/** The Runtime crypto boundary's configuration shape. */
export interface RuntimeCryptoConfig {
  /**
   * Whether Runtime may ever resolve a non-placeholder `RuntimeCryptoProvider`.
   * Fixed `false` in this stage — see this module's own doc comment above.
   */
  readonly runtimeCryptoEnabled: boolean;
  /**
   * Which provider NAME would be used if `runtimeCryptoEnabled` were ever
   * `true` — read from `FEDOS_CRYPTO_PROVIDER` (Stage 282). Defaults to
   * `"placeholder"` when unset/unrecognized.
   */
  readonly runtimeCryptoProvider: RuntimeCryptoProviderName;
}

/**
 * The fixed, no-env-supplied Runtime crypto config — `runtimeCryptoProvider`
 * here is `"placeholder"` only because no `env` was ever passed to compute
 * it, matching `parseFedosCryptoProviderEnv`'s own no-input default. Kept
 * for callers that want a constant rather than calling
 * `getRuntimeCryptoConfig()` with no argument (the two are equivalent).
 */
export const RUNTIME_CRYPTO_CONFIG: RuntimeCryptoConfig = Object.freeze({
  runtimeCryptoEnabled: false,
  runtimeCryptoProvider: "placeholder",
});

/**
 * Read the Runtime crypto config. `runtimeCryptoEnabled` is always `false`,
 * regardless of `env`. `runtimeCryptoProvider` is
 * `parseFedosCryptoProviderEnv(env?.FEDOS_CRYPTO_PROVIDER)` — `"placeholder"`
 * when `env` is omitted or lacks a recognized value. Reads NO
 * `process.env` — only the explicitly-passed `env` parameter, if any.
 */
export function getRuntimeCryptoConfig(
  env?: FedosCryptoProviderEnvLike,
): RuntimeCryptoConfig {
  return Object.freeze({
    runtimeCryptoEnabled: false,
    runtimeCryptoProvider: parseFedosCryptoProviderEnv(env?.FEDOS_CRYPTO_PROVIDER),
  });
}
