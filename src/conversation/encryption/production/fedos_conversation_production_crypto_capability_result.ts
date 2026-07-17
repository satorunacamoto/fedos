/**
 * Secure Runtime Alpha 1263 ("Runtime Crypto Capability Result") — Phase A
 * of the Alpha 1261–1320 Production Conversation Crypto Runtime Activation
 * Arc.
 *
 * A closed, coarse, stable outcome vocabulary for
 * `assembleFedosConversationProductionCryptoGraph()`
 * (`./fedos_conversation_production_crypto_authority_factory.ts`, Alpha
 * 1273) — mirrors every other closed-vocabulary result type in this
 * codebase (`FedosConversationDirectActivationResult`, etc.). No raw
 * `FedosWasmLoaderDecision`/execution-record field, no provider message,
 * no stack trace ever reaches an application-facing caller through this
 * type — see this file's own `#mapConstructReason()` sibling in the
 * factory for the one place a loader-internal reason is translated into
 * one of these nine outcomes.
 */

export type FedosConversationProductionCryptoCapabilityOutcome =
  | "available"
  | "artifact-missing"
  | "artifact-incompatible"
  | "seed-unavailable"
  | "seed-restore-failed"
  | "identity-unavailable"
  | "unsupported-runtime"
  | "disabled"
  | "failed";

export const FEDOS_CONVERSATION_PRODUCTION_CRYPTO_CAPABILITY_OUTCOMES: readonly FedosConversationProductionCryptoCapabilityOutcome[] =
  [
    "available",
    "artifact-missing",
    "artifact-incompatible",
    "seed-unavailable",
    "seed-restore-failed",
    "identity-unavailable",
    "unsupported-runtime",
    "disabled",
    "failed",
  ];
