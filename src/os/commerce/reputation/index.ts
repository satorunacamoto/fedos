/**
 * Reputation / Persona Epoch — public barrel for `os/commerce/reputation`.
 * Scoped to this directory only (mirrors `../order/index.ts`) — NOT the
 * top-level `os/commerce` barrel (`../index.ts`), which is reserved for the
 * coordinator's own composition work.
 */

export {
  PERSONA_EPOCH_DEFAULT_CLOCK_SKEW_TOLERANCE_SECONDS,
  isPersonaEpochCurrentlyValid,
  isWellFormedPersonaEpoch,
  isWellFormedPersonaEpochId,
  isWellFormedPersonaEpochKeyPublicHex,
  type PersonaEpoch,
} from "./persona_epoch.js";

export {
  isWellFormedReputationAttestationPayload,
  isWellFormedTradeCompletionAttestationPayload,
  type ReputationAttestationPayload,
  type ReputationLocalSignedEnvelopeShape,
  type TradeCompletionAttestationPayload,
  type TradeCompletionCategory,
  type TradeCompletionOutcome,
} from "./attestation_types.js";

export {
  isWellFormedCommerceTrustIssuanceRequest,
  NoopCommerceTrustIssuancePort,
  type CommerceTrustIssuancePort,
  type CommerceTrustIssuanceRequest,
  type CommerceTrustIssuanceResult,
} from "./trust_issuance_port.js";

export {
  buildEpochCarryOverStatementPayload,
  isWellFormedEpochCarryOverStatementPayload,
  EPOCH_CARRY_OVER_LINKABILITY_WARNING,
  type EpochCarryOverStatementPayload,
  type EpochCarryOverThresholdClaim,
} from "./carry_over.js";

export {
  bucketVerifiedTradeCount,
  isPersonaBoardDisclosureLayer,
  projectPersonaRecordToDisclosureLayer,
  type PersonaBoardAuthorizedView,
  type PersonaBoardDisclosureLayer,
  type PersonaBoardInternalRecord,
  type PersonaBoardPublicView,
  type PersonaBoardView,
} from "./disclosure_layers.js";

export {
  PersonaEpochSigningKeypair,
  PERSONA_EPOCH_KEY_COMPROMISE_NOTE,
  verifyPersonaEpochSignatureOverBytes,
  verifyPersonaEpochSignatureOverDigest,
} from "./persona_epoch_signing_keypair.js";

export {
  computeTradeRefDigestHex,
  generateTradeRefSaltHex,
  isWellFormedTradeRefSaltHex,
  verifyTradeRefDigest,
} from "./trade_ref_digest.js";

export {
  REPUTATION_ATTESTATION_ENVELOPE_TYPE,
  TRADE_COMPLETION_ATTESTATION_ENVELOPE_TYPE,
  computeAttestationRef,
  signReputationAttestation,
  signTradeCompletionAttestation,
  verifyReputationAttestationEnvelope,
  verifyTradeCompletionAttestationEnvelope,
  type AttestationVerifyResult,
  type ReputationAttestationEnvelope,
  type TradeCompletionAttestationEnvelope,
} from "./attestation_sign_verify.js";

export {
  LocalPersonaEpochRegistry,
  createPersonaEpoch,
  generatePersonaEpochId,
  rolloverPersonaEpoch,
  signEpochCarryOverStatement,
  verifyEpochCarryOverStatementEnvelope,
  type CreatePersonaEpochResult,
  type EpochCarryOverEnvelope,
  type RolloverPersonaEpochResult,
} from "./persona_epoch_registry.js";
// Commerce Durability arc (Agent D) -- durable, restart-surviving sibling
// of `LocalPersonaEpochRegistry`, backed by an append-only NDJSON log
// file. Insert-only, same as the in-memory registry.
export { DurablePersonaEpochRegistry } from "./persistence/durable_persona_epoch_registry.js";

export { LocalTradeCompletionAttestationStore } from "./trade_completion_attestation_store.js";
// Commerce Durability arc (Agent D) -- durable, restart-surviving sibling
// of `LocalTradeCompletionAttestationStore`. Its replay-time dedupe-key
// hydration is what makes "the same completed trade cannot re-issue a
// second attestation" survive a restart.
export { DurableTradeCompletionAttestationStore } from "./persistence/durable_trade_completion_attestation_store.js";

// FedOS Commerce FINAL P1 Closure (Agent K1) -- durable, sealed-at-rest
// custody for the Persona Epoch signing keypair itself (closes the OTHER
// half of the restart-durability gap `DurablePersonaEpochRegistry` above
// does not cover -- that registry persists the `PersonaEpoch` domain
// object, this persists the actual signing key material, sealed).
export {
  COMMERCE_PERSONA_EPOCH_SIGNING_KEY_PURPOSE,
  DurableSealedSigningKeyStore,
  resolvePersonaEpochSigningKeypair,
  sealNextGenerationPersonaEpochSigningKeypair,
  type PersonaEpochSigningKeySealingAuthorityLike,
  type PersonaEpochSigningKeyResolveResult,
} from "./persistence/durable_persona_epoch_signing_key_store.js";

export {
  buildReputationAttestationSummary,
  issueTradeCompletionAttestation,
  type BuildReputationAttestationSummaryResult,
  type IssueTradeCompletionAttestationRequest,
  type IssueTradeCompletionAttestationResult,
  type ReputationIssuanceDeps,
  type ReputationIssuanceRejectionCode,
} from "./reputation_issuance.js";

export {
  buildPersonaBoardInternalRecordAndVerification,
  queryPersonaBoardView,
  type PersonaBoardQueryResult,
  type PersonaBoardVerificationState,
} from "./persona_board_query.js";

export { PersonaBoardController, type PersonaBoardControllerDeps } from "./ui/persona_board_controller.js";
