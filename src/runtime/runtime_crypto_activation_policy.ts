/**
 * Stage 289 — Runtime Crypto Activation Policy.
 *
 * A PURE decision function answering "may Runtime ever resolve a real,
 * non-placeholder `RuntimeCryptoProvider` RIGHT NOW?" — separate from (and
 * evaluated ON TOP OF) `src/runtime/runtime_crypto_bridge.ts`'s own
 * two-flag gate. Where the bridge only ever asks "which NAME to resolve",
 * this policy answers "WHY is a real activation not (yet) allowed" — a
 * single, auditable place a human reviewer or diagnostics display can read
 * the reason from, rather than re-deriving it from the config/bridge
 * source ad hoc.
 *
 * Stage 297 adds the DUAL-LOCK model's second lock: `env?.FEDOS_CRYPTO_ENABLED`
 * (`src/runtime/crypto_provider_env.ts`'s `parseFedosCryptoEnabledEnv`,
 * Stage 297) is now ALSO consulted — the gate is considered "enabled" if
 * EITHER `config.runtimeCryptoEnabled` (still permanently `false`, Stage
 * 258, unchanged) OR the env lock parses to `"explicit-dev-only"`. This
 * is the ONLY thing Stage 297 changes here: `runtime_crypto_bridge.ts`
 * itself is NOT touched, so a real `FedosRuntimeCryptoProvider` still
 * never gets resolved by anything in this repository regardless of this
 * policy's own answer — see `docs/runtime_crypto_activation_policy.md`
 * §2 for why `effectiveProvider` (the diagnostics field mirroring the
 * BRIDGE's gate) and `activationReason` (this policy's own gate) can
 * legitimately diverge.
 *
 * HARD GUARDRAILS:
 *   - `evaluateRuntimeCryptoActivation` NEVER returns `{ allowed: true,
 *     reason: "Allowed" }` in this stage — this policy's own "is a real
 *     implementation present" check now READS
 *     `fedos_runtime_crypto_provider.ts`'s (Stage 305)
 *     `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` directly (Stage 308), rather
 *     than keeping its own, second, redundant `false` literal — ONE
 *     source of truth, still permanently `false`, with NO parameter or
 *     override anywhere letting any caller (test or production) flip it.
 *     `"Allowed"`/`"FutureFeature"` exist in `ActivationReason` only as
 *     RESERVED labels for a future, separate, explicitly-reviewed stage
 *     — mirroring `RuntimeCryptoDiagnosticsState`'s own `"Enabled"`
 *     precedent (`src/runtime/runtime_crypto_diagnostics.ts`). This
 *     holds REGARDLESS of `FEDOS_CRYPTO_ENABLED`/`FEDOS_CRYPTO_PROVIDER`
 *     — even `provider === "fedos"` AND `enabled === "explicit-dev-only"`
 *     simultaneously still resolves to `"ProviderUnavailable"`, never
 *     `"Allowed"`.
 *   - Reads NO `process.env`/`RuntimeEnv` — takes an already-resolved
 *     `RuntimeCryptoConfig`-shaped value plus an OPTIONAL, already-resolved
 *     `FedosCryptoProviderEnvLike` as its only inputs.
 *   - Never calls a `RuntimeCryptoProvider` method, never constructs one,
 *     never references `packages/fedos-core-rust`.
 *   - Priority order (first match wins), exactly:
 *     1. `!(runtimeCryptoEnabled || envLockEnabled)` → `"DisabledByConfig"`
 *        (checked BEFORE the provider name at all — an unselected
 *        provider under a disabled gate is still reported as "disabled",
 *        not "not selected").
 *     2. `runtimeCryptoProvider !== "fedos"` → `"ProviderNotSelected"`.
 *     3. Otherwise (both locks open AND provider `"fedos"`) →
 *        `"ProviderUnavailable"`, because
 *        `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` is fixed `false` — no real
 *        `FedosRuntimeCryptoProvider` implementation exists yet
 *        (`src/runtime/fedos_runtime_crypto_provider.ts` still resolves
 *        `encrypt`/`decrypt` to `"Unsupported"` unconditionally).
 *
 * Stage 308 note on "shared implementation" scope: importing the ONE
 * `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` constant (a fact about a SINGLE
 * shared `FedosRuntimeCryptoProvider` class, already registered under
 * `"fedos"` in BOTH the Runtime and Worker registries since Stage
 * 265/274) is NOT the same thing as sharing the ACTIVATION POLICY itself
 * — `ActivationReason`/`ActivationDecision`/`ActivationPolicy`/
 * `evaluateRuntimeCryptoActivation` remain defined here, independently
 * from `worker_crypto_activation_policy.ts`'s own copies, exactly as
 * before.
 */

import type { FedosCryptoProviderEnvLike } from "./crypto_provider_env.js";
import { parseFedosCryptoEnabledEnv } from "./crypto_provider_env.js";
import { FEDOS_RUNTIME_PROVIDER_IMPLEMENTED } from "./fedos_runtime_crypto_provider.js";
import type { RuntimeCryptoConfig } from "./runtime_crypto_config.js";

/**
 * Every reason `evaluateRuntimeCryptoActivation` can name. `"FutureFeature"`
 * and `"Allowed"` are RESERVED — neither is ever produced by this stage's
 * implementation; see this module's own doc comment above.
 */
export type ActivationReason =
  | "DisabledByConfig" // runtimeCryptoEnabled is false
  | "ProviderNotSelected" // runtimeCryptoProvider is not "fedos"
  | "ProviderUnavailable" // enabled + "fedos" selected, but no real implementation exists yet
  | "FutureFeature" // RESERVED — never produced in this stage
  | "Allowed"; // RESERVED — never produced in this stage

/** The result of an activation-policy evaluation. `allowed` is always `false` in this stage. */
export interface ActivationDecision {
  readonly allowed: boolean;
  readonly reason: ActivationReason;
}

/**
 * The shape of a Runtime crypto activation policy: a pure function from a
 * resolved `RuntimeCryptoConfig` (plus an OPTIONAL, already-resolved
 * `FedosCryptoProviderEnvLike` for the Lock #2 env var) to an
 * `ActivationDecision`. `evaluateRuntimeCryptoActivation` is the one
 * implementation this stage provides.
 */
export type ActivationPolicy = (
  config: RuntimeCryptoConfig,
  env?: FedosCryptoProviderEnvLike,
) => ActivationDecision;

/**
 * Evaluate whether Runtime may activate a real FedOS-backed
 * `RuntimeCryptoProvider` right now, and why (not). See this module's own
 * doc comment above for the exact priority order, including the Stage
 * 297 dual-lock combination (`config.runtimeCryptoEnabled` OR
 * `env?.FEDOS_CRYPTO_ENABLED === "explicit-dev-only"`). Pure; never
 * throws; never mutates `config`/`env`.
 */
export const evaluateRuntimeCryptoActivation: ActivationPolicy = (
  config: RuntimeCryptoConfig,
  env?: FedosCryptoProviderEnvLike,
): ActivationDecision => {
  const envLockEnabled = parseFedosCryptoEnabledEnv(env?.FEDOS_CRYPTO_ENABLED) === "explicit-dev-only";
  const enabled = config.runtimeCryptoEnabled || envLockEnabled;
  if (!enabled) {
    return { allowed: false, reason: "DisabledByConfig" };
  }
  if (config.runtimeCryptoProvider !== "fedos") {
    return { allowed: false, reason: "ProviderNotSelected" };
  }
  if (!FEDOS_RUNTIME_PROVIDER_IMPLEMENTED) {
    return { allowed: false, reason: "ProviderUnavailable" };
  }
  // Unreachable in this stage: FEDOS_RUNTIME_PROVIDER_IMPLEMENTED is
  // permanently false above, regardless of both locks being open. Kept
  // for documentation of the eventual shape a future stage would
  // complete.
  return { allowed: true, reason: "Allowed" };
};
