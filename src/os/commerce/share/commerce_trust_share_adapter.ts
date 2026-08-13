/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) —
 * Commerce->Trust Share Proof issuance/verification adapter (arc mandate
 * item 3: signed Product/Store share artifact).
 *
 * Mirrors `../receipt/commerce_trust_receipt_adapter.ts` file-for-file:
 * the ONE file under `../share/` that imports `src/os/trust/**` directly;
 * `share_types.ts` stays pure domain logic with zero Trust imports, exactly
 * like `../receipt/receipt_types.ts` does for receipts.
 *
 * WHY `contracts/` (ContractArtifactProof) AND NOT A NEW ENVELOPE TYPE —
 * SAME REASONING AS THE RECEIPT ADAPTER, RE-VERIFIED FOR THIS FILE
 * ----------------------------------------------------------------------
 * `FedosTrustEnvelopeType` (`src/os/trust/envelope/fedos_trust_envelope_types.ts`)
 * is a CLOSED string union; that file's own header says adding a new
 * domain member is "additive and safe", but `../receipt/commerce_trust_receipt_adapter.ts`'s
 * own header deliberately chose NOT to do that (`src/os/trust/**` treated as
 * read-only/out of scope for that wave) and instead reused `contracts/`
 * (`fedos.contract-artifact.v1`), Trust's own general-purpose "sign an
 * already-computed local artifact" domain. This file follows that SAME
 * established precedent for the SAME reason — a share proof is exactly
 * another "already-computed local artifact" the issuer signs, and reusing
 * the receipt adapter's own proven seam keeps this change additive-only
 * inside `os/commerce`, zero touches to `os/trust`. `ProductShareProofPayload`/
 * `StoreShareProofPayload`'s full field set (see `share_types.ts`) is
 * carried inside `ContractArtifactProof.metadata` — a flat, sorted-key,
 * SIGNED bag — so the full share content is cryptographically bound into
 * the envelope, not just a bare digest sitting beside it. `artifactDigestHex`
 * is an ADDITIONAL, belt-and-suspenders self-consistency digest, same as
 * the receipt adapter's own discipline.
 *
 * THE TWO-LAYER TRUST MODEL THIS ADAPTER IMPLEMENTS — READ BEFORE CALLING
 * `verifySelfAssertedProductShareProof`/`verifySelfAssertedStoreShareProof`
 * ----------------------------------------------------------------------
 * A share artifact is handed to a buyer who, by construction, has NEVER
 * met the seller before (arc mandate: "an independently-created real buyer
 * profile has no working path to find a real seller"). This means a
 * verifier CANNOT be handed a pre-populated `FedosTrustPolicy` the normal
 * way every other Trust consumer in this codebase uses (one that already
 * names the issuer's real key) — there is no such prior relationship to
 * draw one from. This adapter therefore uses a documented, narrow
 * SELF-ASSERTING policy: the envelope's own `keyId` field is trusted AS
 * the public key it claims to be, for THIS VERIFICATION ONLY
 * (`buildSelfAssertedShareTrustPolicy` below) — the exact same "a
 * subscriber self-signing their own credentials, 'self' is just another
 * issuer id" pattern `src/os/trust/policy/fedos_trust_policy_types.ts`'s
 * own header already documents and sanctions, applied here to a first-contact
 * discovery artifact instead of a subscription credential.
 *
 * THIS PROVES EXACTLY ONE THING: the artifact was signed by whoever
 * genuinely controls the secret key matching the claimed `keyId` at
 * issuance time — i.e. the artifact is INTERNALLY SELF-CONSISTENT and was
 * NOT corrupted/bit-flipped/forged-without-any-matching-key in transit
 * (catches "tampered product", "wrong signature", and a QR/paste
 * corruption identically to `../receipt/commerce_trust_receipt_adapter.ts`'s
 * own tamper cases — see `test/commerce_trust_share_adapter.test.ts`).
 *
 * THIS DOES **NOT** PROVE: that the claimed `sellerPubkey` inside the
 * payload is genuinely who published `productId`/owns the store — issuer
 * key K (whatever `keyId` happens to be) is NOT required to have any
 * relationship to `sellerPubkey` at all; an attacker running their own
 * independent process can self-issue a perfectly "valid" (self-consistent)
 * share artifact that DISHONESTLY claims someone else's real
 * `sellerPubkey`/`productId`. Establishing THAT fact is the job of the
 * ALREADY-EXISTING, already-hardened `CommerceNostrProductReadModel`
 * (`../events/commerce_nostr_event_read_model.ts`) fed by the real,
 * signature-verifying `verifyAndBuildInboundCommerceNostrEnvelope` bridge
 * (`../catalog/adapters/nostr/commerce_inbound_event_bridge.ts`) — a
 * caller (the Electron main process composition root) MUST independently
 * query the user's OWN configured Relay(s) for `productId`/`sellerPubkey`
 * and cross-check the resolved `creatorPubkeyHex` against this artifact's
 * claimed `sellerPubkey` BEFORE ever presenting the artifact's contents as
 * anything more than an "unconfirmed preview" — see
 * `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`'s
 * own `handleCommerceShareOpen()` for that exact two-step flow. This file
 * performs NO such cross-check itself (it has zero dependency on the
 * catalog/events/Nostr layers, matching `../receipt/`'s own
 * territory-isolation discipline) — it only ever answers "is this artifact
 * internally self-consistent", never "is this artifact's claim true".
 */

import {
  computeFedosTrustArtifactDigestHexSha256,
  issueFedosTrustContractArtifactProof,
  verifyFedosTrustContractArtifactProof,
  encodeFedosTrustEnvelopeToQrText,
  decodeFedosTrustEnvelopeFromQrText,
  createSingleIssuerFedosTrustPolicy,
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
  canonicalizeProductShareProofPayloadV1,
  canonicalizeStoreShareProofPayloadV1,
  isWellFormedProductShareProofPayload,
  isWellFormedStoreShareProofPayload,
  type ProductShareProofPayload,
  type StoreShareProofPayload,
} from "./share_types.js";

/** The signed envelope type every function in this file produces/consumes —
 * always `fedos.contract-artifact.v1` under the hood; see this file's header. */
export type SignedCommerceShareProofEnvelope = FedosTrustSignedEnvelope<FedosTrustContractArtifactProofPayload>;

export interface CommerceShareSigningKeys {
  readonly keypair: FedosTrustSigningKeypair;
  /** Opaque issuer identifier — matches `FedosTrustSignedEnvelope.issuer`.
   * See this file's header: a VERIFIER never needs to have pre-registered
   * this value (unlike every other Trust consumer in this codebase) — the
   * self-asserted policy below trusts whatever `keyId` the envelope itself
   * carries, for this one verification. */
  readonly issuer: string;
  /** Defaults to `keypair.publicKeyHex` — see this file's header on why
   * this MUST stay the self-describing default for a share artifact
   * (never overridden to a value that is NOT the actual signing public
   * key, or self-assertion verification can never succeed). */
  readonly keyId?: string;
}

export interface IssueCommerceShareProofOptions {
  /** Unix seconds. */
  readonly issuedAt: number;
  /** Unix seconds. Envelope-level freshness expiry — a share artifact
   * SHOULD normally carry one (unlike a receipt, which has none by
   * design): an old share link naming a price/title that may have since
   * changed is exactly the kind of stale claim an expiry bounds. Omit for
   * no expiry (callers that intentionally want a durable/no-expiry link). */
  readonly expiresAt?: number;
  readonly subject?: string;
  readonly audience?: string;
  readonly nonce?: string;
}

function productSharePayloadToMetadata(payload: ProductShareProofPayload): FedosTrustContractArtifactProofMetadata {
  return {
    kind: payload.kind,
    productId: payload.productId,
    title: payload.title,
    priceCents: payload.priceCents,
    currency: payload.currency,
    sellerPubkey: payload.sellerPubkey,
    issuedAt: payload.issuedAt,
    formatVersion: payload.formatVersion,
  };
}

function storeSharePayloadToMetadata(payload: StoreShareProofPayload): FedosTrustContractArtifactProofMetadata {
  return {
    kind: payload.kind,
    sellerPubkey: payload.sellerPubkey,
    storeLabel: payload.storeLabel,
    issuedAt: payload.issuedAt,
    formatVersion: payload.formatVersion,
  };
}

function metadataToCandidateRecord(metadata: FedosTrustContractArtifactProofMetadata | undefined): Record<string, unknown> {
  if (metadata === undefined) return {};
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null) continue;
    record[key] = value;
  }
  return record;
}

function buildEnvelopeInput(keys: CommerceShareSigningKeys, options: IssueCommerceShareProofOptions) {
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
 * Signs a `ProductShareProofPayload` into a `SignedCommerceShareProofEnvelope`.
 * Reuses `signFedosTrustEnvelopeV1` (via `issueFedosTrustContractArtifactProof`)
 * for all cryptography — invents no signing logic of its own. Throws
 * `RangeError` on a malformed payload (mirrors every Trust `issue*`
 * function's own fail-fast-on-malformed-input discipline).
 */
export function issueSignedProductShareProof(
  payload: ProductShareProofPayload,
  keys: CommerceShareSigningKeys,
  options: IssueCommerceShareProofOptions,
): SignedCommerceShareProofEnvelope {
  if (!isWellFormedProductShareProofPayload(payload)) {
    throw new RangeError("commerce trust share adapter: malformed ProductShareProofPayload");
  }
  const canonical = canonicalizeProductShareProofPayloadV1(payload);
  const artifactDigestHex = computeFedosTrustArtifactDigestHexSha256(new TextEncoder().encode(canonical));
  const metadata = productSharePayloadToMetadata(payload);
  return issueFedosTrustContractArtifactProof({ artifactDigestHex, metadata }, buildEnvelopeInput(keys, options));
}

/** Same discipline as `issueSignedProductShareProof`, for `StoreShareProofPayload`. */
export function issueSignedStoreShareProof(
  payload: StoreShareProofPayload,
  keys: CommerceShareSigningKeys,
  options: IssueCommerceShareProofOptions,
): SignedCommerceShareProofEnvelope {
  if (!isWellFormedStoreShareProofPayload(payload)) {
    throw new RangeError("commerce trust share adapter: malformed StoreShareProofPayload");
  }
  const canonical = canonicalizeStoreShareProofPayloadV1(payload);
  const artifactDigestHex = computeFedosTrustArtifactDigestHexSha256(new TextEncoder().encode(canonical));
  const metadata = storeSharePayloadToMetadata(payload);
  return issueFedosTrustContractArtifactProof({ artifactDigestHex, metadata }, buildEnvelopeInput(keys, options));
}

/** Every status this module's verify functions can return. `"VALID"` plus
 * every `FedosTrustVerifyFailureReason`, plus two share-domain-specific
 * failures — same shape discipline as `CommerceReceiptVerifyStatus`. */
export type CommerceShareVerifyStatus =
  | FedosTrustContractArtifactProofVerifyResult["artifactSignature"]
  | "INVALID_PAYLOAD_SHAPE"
  | "DIGEST_MISMATCH";

export type CommerceShareVerifyResult<TPayload> =
  | { readonly status: "VALID"; readonly resolvedPublicKeyHex: string; readonly payload: TPayload }
  | { readonly status: Exclude<CommerceShareVerifyStatus, "VALID">; readonly detail?: string };

/**
 * Builds a `FedosTrustPolicy` that trusts ONLY whatever `(issuer, keyId)`
 * the supplied envelope itself claims, resolving `keyId` AS the public key
 * hex to verify against — see this file's header for the exact, narrow
 * meaning of a "VALID" result under this policy (self-consistency, never
 * seller-identity proof). Never inspects payload contents; a pure,
 * structural function of the envelope's own metadata fields.
 */
export function buildSelfAssertedShareTrustPolicy(envelope: SignedCommerceShareProofEnvelope): FedosTrustPolicy {
  return createSingleIssuerFedosTrustPolicy({
    issuerId: envelope.issuer,
    keys: [{ keyId: envelope.keyId, publicKeyHex: envelope.keyId }],
  });
}

/**
 * Verifies a `SignedCommerceShareProofEnvelope` under the SELF-ASSERTED
 * policy (`buildSelfAssertedShareTrustPolicy`) and reconstructs+validates
 * the `ProductShareProofPayload` carried in its `metadata`. Never throws.
 * See this file's header for what a `"VALID"` result here does and does
 * NOT prove — callers MUST still independently cross-check
 * `payload.sellerPubkey`/`payload.productId` against a real, network-verified
 * record before trusting the artifact's contents for anything beyond an
 * unconfirmed preview.
 */
export function verifySelfAssertedProductShareProof(
  envelope: SignedCommerceShareProofEnvelope,
  options: FedosTrustVerifyOptions = {},
): CommerceShareVerifyResult<ProductShareProofPayload> {
  const trustPolicy = buildSelfAssertedShareTrustPolicy(envelope);
  const artifactResult = verifyFedosTrustContractArtifactProof(envelope, trustPolicy, options);
  if (artifactResult.artifactSignature !== "VALID") {
    return { status: artifactResult.artifactSignature };
  }
  const candidate = metadataToCandidateRecord(envelope.payload.metadata);
  if (!isWellFormedProductShareProofPayload(candidate)) {
    return { status: "INVALID_PAYLOAD_SHAPE" };
  }
  const recomputedDigest = computeFedosTrustArtifactDigestHexSha256(
    new TextEncoder().encode(canonicalizeProductShareProofPayloadV1(candidate)),
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

/** Same discipline as `verifySelfAssertedProductShareProof`, for `StoreShareProofPayload`. */
export function verifySelfAssertedStoreShareProof(
  envelope: SignedCommerceShareProofEnvelope,
  options: FedosTrustVerifyOptions = {},
): CommerceShareVerifyResult<StoreShareProofPayload> {
  const trustPolicy = buildSelfAssertedShareTrustPolicy(envelope);
  const artifactResult = verifyFedosTrustContractArtifactProof(envelope, trustPolicy, options);
  if (artifactResult.artifactSignature !== "VALID") {
    return { status: artifactResult.artifactSignature };
  }
  const candidate = metadataToCandidateRecord(envelope.payload.metadata);
  if (!isWellFormedStoreShareProofPayload(candidate)) {
    return { status: "INVALID_PAYLOAD_SHAPE" };
  }
  const recomputedDigest = computeFedosTrustArtifactDigestHexSha256(
    new TextEncoder().encode(canonicalizeStoreShareProofPayloadV1(candidate)),
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
 * Encodes an already-signed share envelope as QR/compact text — a thin,
 * typed pass-through to `encodeFedosTrustEnvelopeToQrText` (`src/os/trust/qr/`).
 * Invents no new QR/transport logic; same "QR is transport, never a
 * security primitive" contract as `../receipt/`'s own codec passthrough.
 */
export function encodeCommerceShareProofToQrText(envelope: SignedCommerceShareProofEnvelope): string {
  return encodeFedosTrustEnvelopeToQrText(envelope);
}

/**
 * Decodes QR/compact text back into a `SignedCommerceShareProofEnvelope`.
 * Structural validation ONLY (fails closed on malformed/oversized/truncated
 * input); does NOT cryptographically verify anything — callers MUST call
 * `verifySelfAssertedProductShareProof`/`verifySelfAssertedStoreShareProof`
 * afterward (and then the caller's own independent network cross-check)
 * before trusting the result for anything. This is the literal embodiment
 * of the arc mandate's "never trust the link/QR content itself" — decode
 * alone produces an untrusted candidate object, nothing more.
 */
export function decodeCommerceShareProofFromQrText(
  text: string,
): SignedCommerceShareProofEnvelope | FedosTrustQrDecodeError {
  return decodeFedosTrustEnvelopeFromQrText(text) as SignedCommerceShareProofEnvelope | FedosTrustQrDecodeError;
}
