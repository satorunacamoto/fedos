/**
 * FedOS Commerce End-to-End Completion arc, Wave B (Agent T) — Commerce->Trust
 * receipt issuance/verification adapter (original arc brief §21–22, closing
 * `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md` Gap #8/#13).
 *
 * THE ONE FILE this wave adds under `src/os/commerce/` that imports
 * `src/os/trust/**` directly — every other file in `./receipt/` (in
 * particular `receipt_types.ts`) is pure domain logic with zero Trust
 * imports. This is the exact seam Agent R's Wave A design
 * (`../reputation/trust_issuance_port.ts`'s header) named as "the ONE new
 * adapter file" the coordinator would want, one wave later.
 *
 * RE-VERIFIED BOUNDARY FINDING (do not take Agent R's finding on faith —
 * re-read both tests yourself before relying on this file compiling/passing):
 * `test/architecture_boundary_commerce.test.ts`'s `FORBIDDEN_PREFIXES` lists
 * `conversation/board/desktop/device/nostr/messenger` only — `src/os/trust`
 * is NOT forbidden, so this file's relative imports below do not trip that
 * test. `test/architecture_boundary_trust.test.ts`'s
 * `FORBIDDEN_RELATIVE_PREFIXES` (the OTHER direction) includes
 * `"src/os/commerce/"`, which blocks a file INSIDE `src/os/trust` from
 * importing `os/commerce` — this file lives under `os/commerce` and imports
 * `os/trust`, the opposite direction, so it does not trip that test either.
 * Both boundary tests were re-read in full for this file and pass unmodified.
 *
 * WHY `contracts/` (ContractArtifactProof) AND NOT A NEW ENVELOPE TYPE
 * ----------------------------------------------------------------------
 * `FedosTrustEnvelopeType` (`src/os/trust/envelope/fedos_trust_envelope_types.ts`)
 * is a CLOSED string union with no `"fedos.commerce.*"` member, and this
 * wave's territory does not include touching `src/os/trust/**` to add one
 * (that file is explicitly read-only/out of scope). Rather than reusing an
 * existing envelope `type` literal for a new purpose — the exact ambiguity
 * this repo's own protocol-design discipline forbids (never repurpose a
 * signed envelope's domain-separation field, see
 * `fedos_trust_envelope_types.ts`'s own header) — this adapter reuses
 * `contracts/` (`fedos.contract-artifact.v1`), Trust's own general-purpose
 * "sign an already-computed local artifact" domain. `receipt_types.ts`'s
 * ENTIRE payload (including `paymentEvidenceRef`/`deliveryConfirmationRef`)
 * is carried inside `ContractArtifactProof.metadata` — a flat, sorted-key,
 * SIGNED bag (`fedos_trust_contract_artifact_proof_canonical.ts` includes
 * `metadata` in the canonicalized, signed bytes) — so the full receipt
 * content is cryptographically bound into the envelope, not just a bare
 * digest sitting beside it. `artifactDigestHex` is an ADDITIONAL,
 * self-consistency digest of the receipt payload's own canonical form
 * (`receipt_types.ts`'s canonicalizers) — belt-and-suspenders on top of the
 * signature, which already protects `metadata` on its own.
 *
 * As `contracts/`'s own header documents (arc brief §25, §28), a valid
 * signature here means ONLY "issuer/subject signed this specific receipt
 * content" — never that a trade was fair, that `paymentEvidenceRef` names a
 * genuinely settled payment, or that `deliveryConfirmationRef` names a real
 * delivery. This adapter changes nothing about that meaning.
 */

import {
  computeFedosTrustArtifactDigestHexSha256,
  issueFedosTrustContractArtifactProof,
  verifyFedosTrustContractArtifactProof,
  encodeFedosTrustEnvelopeToQrText,
  decodeFedosTrustEnvelopeFromQrText,
  type FedosTrustContractArtifactProofPayload,
  type FedosTrustContractArtifactProofMetadata,
  type FedosTrustContractArtifactProofVerifyResult,
  type FedosTrustSignedEnvelope,
  type FedosTrustSigningKeypair,
  type FedosTrustPolicy,
  type FedosTrustVerifyOptions,
  type FedosTrustQrDecodeError,
} from "../../trust/index.js";

import {
  canonicalizeTradeReceiptProofPayloadV1,
  canonicalizeDeliveryReceiptProofPayloadV1,
  isWellFormedTradeReceiptProofPayload,
  isWellFormedDeliveryReceiptProofPayload,
  type TradeReceiptProofPayload,
  type DeliveryReceiptProofPayload,
} from "./receipt_types.js";
import {
  evaluateCommerceReceiptTruthfulness,
  type OpaqueDigitalContentDeliveryInvariantResult,
  type CommerceReceiptTruthfulnessDecision,
} from "./commerce_receipt_truthfulness_gate.js";

/** The signed envelope type every function in this file produces/consumes —
 * always `fedos.contract-artifact.v1` under the hood; see this file's header. */
export type SignedCommerceReceiptProofEnvelope = FedosTrustSignedEnvelope<FedosTrustContractArtifactProofPayload>;

export interface CommerceReceiptSigningKeys {
  readonly keypair: FedosTrustSigningKeypair;
  /** Opaque issuer identifier — matches `FedosTrustSignedEnvelope.issuer`;
   * the verifier's own `FedosTrustPolicy` decides whether to trust it. */
  readonly issuer: string;
  /** Defaults to `keypair.publicKeyHex`, exactly like
   * `issueFedosTrustContractArtifactProof`'s own default. Callers should
   * only override this when modeling key rotation. */
  readonly keyId?: string;
}

export interface IssueCommerceReceiptProofOptions {
  /** Unix seconds. */
  readonly issuedAt: number;
  /** Unix seconds. Envelope-level freshness expiry (distinct from any
   * payload-level window — this receipt type has none; see
   * `receipt_types.ts`'s header). Omit for no expiry. */
  readonly expiresAt?: number;
  /** Conventionally the receiving party's opaque identifier (e.g. the
   * buyer's ref) — informational; verification does not require it. */
  readonly subject?: string;
  readonly audience?: string;
  readonly nonce?: string;
}

function tradeReceiptPayloadToMetadata(payload: TradeReceiptProofPayload): FedosTrustContractArtifactProofMetadata {
  return {
    kind: payload.kind,
    orderId: payload.orderId,
    productRef: payload.productRef,
    buyerRef: payload.buyerRef,
    sellerRef: payload.sellerRef,
    paymentEvidenceRef: payload.paymentEvidenceRef ?? null,
    completedAt: payload.completedAt,
    formatVersion: payload.formatVersion,
  };
}

function deliveryReceiptPayloadToMetadata(payload: DeliveryReceiptProofPayload): FedosTrustContractArtifactProofMetadata {
  return {
    kind: payload.kind,
    orderId: payload.orderId,
    productRef: payload.productRef,
    buyerRef: payload.buyerRef,
    sellerRef: payload.sellerRef,
    paymentEvidenceRef: payload.paymentEvidenceRef ?? null,
    deliveryConfirmationRef: payload.deliveryConfirmationRef,
    completedAt: payload.completedAt,
    formatVersion: payload.formatVersion,
  };
}

/** Converts a signed envelope's `metadata` bag back into a plain candidate
 * record for `isWellFormed*ReceiptProofPayload` to validate — omitting any
 * key whose metadata value is `null`, matching the pure domain type's own
 * "field absent when not applicable" convention (`receipt_types.ts`'s
 * `paymentEvidenceRef?: string`, never `paymentEvidenceRef: string | null`). */
function metadataToCandidateRecord(metadata: FedosTrustContractArtifactProofMetadata | undefined): Record<string, unknown> {
  if (metadata === undefined) return {};
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null) continue;
    record[key] = value;
  }
  return record;
}

function buildEnvelopeInput(keys: CommerceReceiptSigningKeys, options: IssueCommerceReceiptProofOptions) {
  return {
    issuer: keys.issuer,
    subject: options.subject,
    audience: options.audience,
    issuedAt: options.issuedAt,
    expiresAt: options.expiresAt,
    nonce: options.nonce,
    keypair: keys.keypair,
    keyId: keys.keyId,
  };
}

/**
 * Signs a `TradeReceiptProofPayload` into a `SignedCommerceReceiptProofEnvelope`.
 * Reuses `signFedosTrustEnvelopeV1` (via `issueFedosTrustContractArtifactProof`)
 * for all cryptography — this function invents no signing logic of its own.
 * Throws `RangeError` on a malformed payload (mirrors every Trust `issue*`
 * function's own fail-fast-on-malformed-input discipline).
 */
export function issueSignedTradeReceiptProof(
  payload: TradeReceiptProofPayload,
  keys: CommerceReceiptSigningKeys,
  options: IssueCommerceReceiptProofOptions,
): SignedCommerceReceiptProofEnvelope {
  if (!isWellFormedTradeReceiptProofPayload(payload)) {
    throw new RangeError("commerce trust receipt adapter: malformed TradeReceiptProofPayload");
  }
  const canonical = canonicalizeTradeReceiptProofPayloadV1(payload);
  const artifactDigestHex = computeFedosTrustArtifactDigestHexSha256(new TextEncoder().encode(canonical));
  const metadata = tradeReceiptPayloadToMetadata(payload);
  return issueFedosTrustContractArtifactProof({ artifactDigestHex, metadata }, buildEnvelopeInput(keys, options));
}

/** Same discipline as `issueSignedTradeReceiptProof`, for `DeliveryReceiptProofPayload`. */
export function issueSignedDeliveryReceiptProof(
  payload: DeliveryReceiptProofPayload,
  keys: CommerceReceiptSigningKeys,
  options: IssueCommerceReceiptProofOptions,
): SignedCommerceReceiptProofEnvelope {
  if (!isWellFormedDeliveryReceiptProofPayload(payload)) {
    throw new RangeError("commerce trust receipt adapter: malformed DeliveryReceiptProofPayload");
  }
  const canonical = canonicalizeDeliveryReceiptProofPayloadV1(payload);
  const artifactDigestHex = computeFedosTrustArtifactDigestHexSha256(new TextEncoder().encode(canonical));
  const metadata = deliveryReceiptPayloadToMetadata(payload);
  return issueFedosTrustContractArtifactProof({ artifactDigestHex, metadata }, buildEnvelopeInput(keys, options));
}

/**
 * Commerce Product-Media Sync + Truthful Completion mega-arc (Agent C) —
 * result of a GUARDED issuance attempt: either a genuinely issued envelope,
 * or the exact `CommerceReceiptTruthfulnessDecision` denial that stopped it
 * (never a thrown error, never a bare signed envelope for an untruthful
 * claim).
 */
export type GuardedCommerceReceiptIssuanceResult =
  | { readonly issued: true; readonly envelope: SignedCommerceReceiptProofEnvelope }
  | { readonly issued: false; readonly decision: Exclude<CommerceReceiptTruthfulnessDecision, { readonly permitted: true }> };

/**
 * Truthfulness-GUARDED sibling of `issueSignedTradeReceiptProof()` — same
 * signing, but ONLY after `evaluateCommerceReceiptTruthfulness()`
 * (`./commerce_receipt_truthfulness_gate.js`) independently confirms
 * `orderStatus === "completed"`. This is the function a real composition
 * root SHOULD call instead of the bare signer whenever it already has the
 * real Order status in hand (see that gate's own header for why the bare
 * signer intentionally does not do this check itself).
 */
export function issueSignedTradeReceiptProofIfTruthful(
  payload: TradeReceiptProofPayload,
  orderStatus: string,
  keys: CommerceReceiptSigningKeys,
  options: IssueCommerceReceiptProofOptions,
): GuardedCommerceReceiptIssuanceResult {
  const decision = evaluateCommerceReceiptTruthfulness({ kind: "trade_completion", orderStatus });
  if (!decision.permitted) return { issued: false, decision };
  return { issued: true, envelope: issueSignedTradeReceiptProof(payload, keys, options) };
}

/**
 * Truthfulness-GUARDED sibling of `issueSignedDeliveryReceiptProof()`. In
 * addition to `orderStatus === "completed"`, REQUIRES the caller's own
 * freshly-computed `digitalContentDeliveryInvariant` result to be
 * `satisfied: true` before ever signing a `"delivery_confirmation"` claim —
 * see `commerce_receipt_truthfulness_gate.ts`'s own header for exactly what
 * this closes (arc requirement 3: a receipt must never claim delivery on
 * evidence that only proves order-completed or seller-claimed fulfillment).
 */
export function issueSignedDeliveryReceiptProofIfTruthful(
  payload: DeliveryReceiptProofPayload,
  orderStatus: string,
  digitalContentDeliveryInvariant: OpaqueDigitalContentDeliveryInvariantResult,
  keys: CommerceReceiptSigningKeys,
  options: IssueCommerceReceiptProofOptions,
): GuardedCommerceReceiptIssuanceResult {
  const decision = evaluateCommerceReceiptTruthfulness({ kind: "delivery_confirmation", orderStatus, digitalContentDeliveryInvariant });
  if (!decision.permitted) return { issued: false, decision };
  return { issued: true, envelope: issueSignedDeliveryReceiptProof(payload, keys, options) };
}

/** Every status this module's verify functions can return. `"VALID"` plus
 * every `FedosTrustVerifyFailureReason` the underlying envelope verifier can
 * produce (expired, signature-invalid, unknown-issuer-key, ...), plus two
 * receipt-domain-specific failures. Never a bare boolean (arc brief §14/§25
 * pattern, followed by every other Trust-adjacent verify function in this
 * codebase). */
export type CommerceReceiptVerifyStatus =
  | FedosTrustContractArtifactProofVerifyResult["artifactSignature"]
  | "INVALID_PAYLOAD_SHAPE"
  | "DIGEST_MISMATCH";

export type CommerceReceiptVerifyResult<TPayload> =
  | { readonly status: "VALID"; readonly resolvedPublicKeyHex: string; readonly payload: TPayload }
  | { readonly status: Exclude<CommerceReceiptVerifyStatus, "VALID">; readonly detail?: string };

/**
 * Verifies a `SignedCommerceReceiptProofEnvelope` against a verifier-chosen
 * `FedosTrustPolicy` and reconstructs+validates the `TradeReceiptProofPayload`
 * carried in its `metadata`. Never throws. Checks, in order:
 *   1. The envelope's own Trust-level signature/issuer-trust/expiry
 *      (`verifyFedosTrustContractArtifactProof` — real Schnorr verification,
 *      no new crypto).
 *   2. That `metadata` reconstructs into a well-formed `TradeReceiptProofPayload`
 *      (`"INVALID_PAYLOAD_SHAPE"` otherwise).
 *   3. That the payload's own canonical digest matches the signed
 *      `artifactDigestHex` (`"DIGEST_MISMATCH"` otherwise) — a
 *      self-consistency check on top of what the signature already
 *      guarantees (the signature alone already protects `metadata` from any
 *      tamper, since `metadata` is itself part of the signed canonical
 *      bytes; this step additionally catches an issuer who signed an
 *      internally-INCONSISTENT digest/metadata pair).
 */
export function verifySignedTradeReceiptProof(
  envelope: SignedCommerceReceiptProofEnvelope,
  trustPolicy: FedosTrustPolicy,
  options: FedosTrustVerifyOptions = {},
): CommerceReceiptVerifyResult<TradeReceiptProofPayload> {
  const artifactResult = verifyFedosTrustContractArtifactProof(envelope, trustPolicy, options);
  if (artifactResult.artifactSignature !== "VALID") {
    return { status: artifactResult.artifactSignature };
  }
  const candidate = metadataToCandidateRecord(envelope.payload.metadata);
  if (!isWellFormedTradeReceiptProofPayload(candidate)) {
    return { status: "INVALID_PAYLOAD_SHAPE" };
  }
  const recomputedDigest = computeFedosTrustArtifactDigestHexSha256(
    new TextEncoder().encode(canonicalizeTradeReceiptProofPayloadV1(candidate)),
  );
  if (recomputedDigest !== envelope.payload.artifactDigestHex) {
    return { status: "DIGEST_MISMATCH", detail: "signed metadata does not match the signed artifactDigestHex" };
  }
  return {
    status: "VALID",
    resolvedPublicKeyHex: artifactResult.resolvedPublicKeyHex as string,
    payload: candidate,
  };
}

/** Same discipline as `verifySignedTradeReceiptProof`, for `DeliveryReceiptProofPayload`. */
export function verifySignedDeliveryReceiptProof(
  envelope: SignedCommerceReceiptProofEnvelope,
  trustPolicy: FedosTrustPolicy,
  options: FedosTrustVerifyOptions = {},
): CommerceReceiptVerifyResult<DeliveryReceiptProofPayload> {
  const artifactResult = verifyFedosTrustContractArtifactProof(envelope, trustPolicy, options);
  if (artifactResult.artifactSignature !== "VALID") {
    return { status: artifactResult.artifactSignature };
  }
  const candidate = metadataToCandidateRecord(envelope.payload.metadata);
  if (!isWellFormedDeliveryReceiptProofPayload(candidate)) {
    return { status: "INVALID_PAYLOAD_SHAPE" };
  }
  const recomputedDigest = computeFedosTrustArtifactDigestHexSha256(
    new TextEncoder().encode(canonicalizeDeliveryReceiptProofPayloadV1(candidate)),
  );
  if (recomputedDigest !== envelope.payload.artifactDigestHex) {
    return { status: "DIGEST_MISMATCH", detail: "signed metadata does not match the signed artifactDigestHex" };
  }
  return {
    status: "VALID",
    resolvedPublicKeyHex: artifactResult.resolvedPublicKeyHex as string,
    payload: candidate,
  };
}

/**
 * Encodes an already-signed receipt envelope as QR text — a thin, typed
 * pass-through to `encodeFedosTrustEnvelopeToQrText` (`src/os/trust/qr/`).
 * This function invents no new QR/transport logic; see that module's own
 * header for the "QR is transport, never a security primitive" contract.
 */
export function encodeCommerceReceiptProofToQrText(envelope: SignedCommerceReceiptProofEnvelope): string {
  return encodeFedosTrustEnvelopeToQrText(envelope);
}

/**
 * Decodes QR text back into a `SignedCommerceReceiptProofEnvelope` — a thin,
 * typed pass-through to `decodeFedosTrustEnvelopeFromQrText`. Structural
 * validation ONLY (fails closed on malformed/oversized/truncated input);
 * exactly like the underlying Trust codec, this function does NOT
 * cryptographically re-verify anything — callers MUST call
 * `verifySignedTradeReceiptProof`/`verifySignedDeliveryReceiptProof`
 * afterward before trusting the result for anything.
 */
export function decodeCommerceReceiptProofFromQrText(
  text: string,
): SignedCommerceReceiptProofEnvelope | FedosTrustQrDecodeError {
  return decodeFedosTrustEnvelopeFromQrText(text) as SignedCommerceReceiptProofEnvelope | FedosTrustQrDecodeError;
}
