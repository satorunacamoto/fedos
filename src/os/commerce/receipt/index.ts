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
  issueSignedTradeReceiptProof,
  issueSignedDeliveryReceiptProof,
  verifySignedTradeReceiptProof,
  verifySignedDeliveryReceiptProof,
  encodeCommerceReceiptProofToQrText,
  decodeCommerceReceiptProofFromQrText,
} from "./commerce_trust_receipt_adapter.js";
