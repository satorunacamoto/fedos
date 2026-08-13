/**
 * FedOS Commerce End-to-End Completion arc, Wave B (Agent T) — public
 * barrel for `os/commerce/receipt`. Scoped to this directory only (not the
 * top-level `os/commerce` barrel, `../index.ts`, which is reserved for the
 * coordinator), mirroring `../order/index.ts`'s own convention.
 */

export {
  type CommerceReceiptProofKind,
  type TradeReceiptProofPayload,
  type DeliveryReceiptProofPayload,
  isWellFormedTradeReceiptProofPayload,
  isWellFormedDeliveryReceiptProofPayload,
  canonicalizeTradeReceiptProofPayloadV1,
  canonicalizeDeliveryReceiptProofPayloadV1,
} from "./receipt_types.js";

export {
  type SignedCommerceReceiptProofEnvelope,
  type CommerceReceiptSigningKeys,
  type IssueCommerceReceiptProofOptions,
  type CommerceReceiptVerifyStatus,
  type CommerceReceiptVerifyResult,
  type GuardedCommerceReceiptIssuanceResult,
  issueSignedTradeReceiptProof,
  issueSignedDeliveryReceiptProof,
  issueSignedTradeReceiptProofIfTruthful,
  issueSignedDeliveryReceiptProofIfTruthful,
  verifySignedTradeReceiptProof,
  verifySignedDeliveryReceiptProof,
  encodeCommerceReceiptProofToQrText,
  decodeCommerceReceiptProofFromQrText,
} from "./commerce_trust_receipt_adapter.js";

// Commerce Product-Media Sync + Truthful Completion mega-arc (Agent C) --
// the pure truthfulness gate the two `...IfTruthful` issuance functions
// above are built on. Barreled separately so a caller that already has its
// own guarded-issuance wrapper (or wants to surface the denial reason in
// its own UI copy) can consult the gate directly without going through
// signing at all.
export {
  evaluateCommerceReceiptTruthfulness,
  type CommerceReceiptTruthfulnessDenialReason,
  type CommerceReceiptTruthfulnessDecision,
  type OpaqueDigitalContentDeliveryInvariantResult,
} from "./commerce_receipt_truthfulness_gate.js";
