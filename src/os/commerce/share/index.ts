/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) —
 * public barrel for `os/commerce/share`. Scoped to this directory only
 * (not the top-level `os/commerce` barrel, `../index.ts`), mirroring
 * `../receipt/index.ts`'s own convention.
 */

export {
  type CommerceShareProofKind,
  type ProductShareProofPayload,
  type StoreShareProofPayload,
  isWellFormedProductShareProofPayload,
  isWellFormedStoreShareProofPayload,
  canonicalizeProductShareProofPayloadV1,
  canonicalizeStoreShareProofPayloadV1,
} from "./share_types.js";

export {
  type SignedCommerceShareProofEnvelope,
  type CommerceShareSigningKeys,
  type IssueCommerceShareProofOptions,
  type CommerceShareVerifyStatus,
  type CommerceShareVerifyResult,
  issueSignedProductShareProof,
  issueSignedStoreShareProof,
  buildSelfAssertedShareTrustPolicy,
  verifySelfAssertedProductShareProof,
  verifySelfAssertedStoreShareProof,
  encodeCommerceShareProofToQrText,
  decodeCommerceShareProofFromQrText,
} from "./commerce_trust_share_adapter.js";
