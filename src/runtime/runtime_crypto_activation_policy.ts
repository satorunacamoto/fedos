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
 * HARD GUARDRAILS:
 *   - `evaluateRuntimeCryptoActivation` NEVER returns `{ allowed: true,
 *     reason: "Allowed" }` in this stage — `FEDOS_PROVIDER_IMPLEMENTED`
 *     below is a fixed, `pub(crate)`-style PRIVATE constant, permanently
 *     `false`, with NO parameter or override letting any caller (test or
 *     production) flip it. `"Allowed"`/`"FutureFeature"` exist in
 *     `ActivationReason` only as RESERVED labels for a future,
 *     separate, explicitly-reviewed stage — mirroring
 *     `RuntimeCryptoDiagnosticsState`'s own `"Enabled"` precedent
 *     (`src/runtime/runtime_crypto_diagnostics.ts`).
 *   - Reads NO `process.env`/`RuntimeEnv` — takes an already-resolved
 *     `RuntimeCryptoConfig`-shaped value as its only input.
 *   - Never calls a `RuntimeCryptoProvider` method, never constructs one,
 *     never references `packages/fedos-core-rust`.
 *   - Priority order (first match wins), exactly:
 *     1. `!runtimeCryptoEnabled` → `"DisabledByConfig"` (checked BEFORE
 *        the provider name at all — an unselected provider under a
 *        disabled gate is still reported as "disabled", not "not
 *        selected").
 *     2. `runtimeCryptoProvider !== "fedos"` → `"ProviderNotSelected"`.
 *     3. Otherwise (`runtimeCryptoEnabled` true AND provider `"fedos"`) →
 *        `"ProviderUnavailable"`, because `FEDOS_PROVIDER_IMPLEMENTED` is
 *        fixed `false` — no real `FedosRuntimeCryptoProvider`
 *        implementation exists yet (`src/runtime/fedos_runtime_crypto_provider.ts`
 *        still resolves `encrypt`/`decrypt` to `"Unsupported"`
 *        unconditionally).
 */

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
 * resolved `RuntimeCryptoConfig` to an `ActivationDecision`.
 * `evaluateRuntimeCryptoActivation` is the one implementation this stage
 * provides.
 */
export type ActivationPolicy = (config: RuntimeCryptoConfig) => ActivationDecision;

/**
 * Fixed, PRIVATE, permanently-`false` constant: whether a real
 * `FedosRuntimeCryptoProvider` implementation exists. No parameter or
 * override anywhere in this module can flip it — flipping it is a future,
 * separate, explicitly-reviewed stage's own decision, made only once
 * `src/runtime/fedos_runtime_crypto_provider.ts` actually calls through to
 * a real core.
 */
const FEDOS_PROVIDER_IMPLEMENTED = false;

/**
 * Evaluate whether Runtime may activate a real FedOS-backed
 * `RuntimeCryptoProvider` right now, and why (not). See this module's own
 * doc comment above for the exact priority order. Pure; never throws;
 * never mutates `config`.
 */
export const evaluateRuntimeCryptoActivation: ActivationPolicy = (
  config: RuntimeCryptoConfig,
): ActivationDecision => {
  if (!config.runtimeCryptoEnabled) {
    return { allowed: false, reason: "DisabledByConfig" };
  }
  if (config.runtimeCryptoProvider !== "fedos") {
    return { allowed: false, reason: "ProviderNotSelected" };
  }
  if (!FEDOS_PROVIDER_IMPLEMENTED) {
    return { allowed: false, reason: "ProviderUnavailable" };
  }
  // Unreachable in this stage: FEDOS_PROVIDER_IMPLEMENTED is permanently
  // false above. Kept for documentation of the eventual shape a future
  // stage would complete.
  return { allowed: true, reason: "Allowed" };
};
