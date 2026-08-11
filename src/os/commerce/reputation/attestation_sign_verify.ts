/**
 * Reputation / Persona Epoch — REAL sign/verify for both attestation
 * payload types (Wave B, Agent R closure pass).
 *
 * Domain-separated envelope `type` literals, per `attestation_types.ts`'s
 * header instruction to "never repurpose an existing Trust `type` literal
 * for a new purpose" — these two are NEW literals scoped to this local
 * envelope mirror only (they are not, and must never become, members of the
 * real `FedosTrustEnvelopeType` union without a deliberate, reviewed
 * decision to actually migrate this design onto `os/trust`'s envelope
 * machinery).
 */

import {
  isWellFormedReputationAttestationPayload,
  isWellFormedTradeCompletionAttestationPayload,
  type ReputationAttestationPayload,
  type ReputationLocalSignedEnvelopeShape,
  type TradeCompletionAttestationPayload,
} from "./attestation_types.js";
import {
  canonicalBytesForReputationEnvelope,
  canonicalizeReputationAttestationPayload,
  canonicalizeTradeCompletionAttestationPayload,
} from "./attestation_canonical_bytes.js";
import {
  PersonaEpochSigningKeypair,
  verifyPersonaEpochSignatureOverBytes,
} from "./persona_epoch_signing_keypair.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export const REPUTATION_ENVELOPE_VERSION_1 = 1 as const;
export const TRADE_COMPLETION_ATTESTATION_ENVELOPE_TYPE = "fedos.commerce.trade-completion.v1" as const;
export const REPUTATION_ATTESTATION_ENVELOPE_TYPE = "fedos.commerce.reputation-summary.v1" as const;
const SIGNATURE_ALGORITHM = "schnorr-secp256k1" as const;

export type TradeCompletionAttestationEnvelope = ReputationLocalSignedEnvelopeShape<TradeCompletionAttestationPayload>;
export type ReputationAttestationEnvelope = ReputationLocalSignedEnvelopeShape<ReputationAttestationPayload>;

export interface SignEnvelopeMeta {
  readonly issuer: string;
  readonly subject?: string;
  readonly audience?: string;
  readonly issuedAt: number;
  readonly expiresAt?: number;
  readonly nonce?: string;
}

/**
 * Signs a `TradeCompletionAttestationPayload` into a
 * `TradeCompletionAttestationEnvelope`, using `keypair` as BOTH the
 * envelope's `keyId` and the payload's own `attestorEpochKeyPublicHex`
 * (they MUST match — see this file's `verifyTradeCompletionAttestationEnvelope`
 * for why that redundancy is checked, not just documented). Throws
 * `RangeError` on a malformed payload or a `keyId`/`attestorEpochKeyPublicHex`
 * mismatch — this is an internal-construction contract, not a boundary
 * parser (mirrors every `issue*` function's fail-fast discipline elsewhere
 * in this repo).
 */
export function signTradeCompletionAttestation(
  payload: TradeCompletionAttestationPayload,
  keypair: PersonaEpochSigningKeypair,
  meta: SignEnvelopeMeta,
): TradeCompletionAttestationEnvelope {
  if (!isWellFormedTradeCompletionAttestationPayload(payload)) {
    throw new RangeError("reputation sign: malformed TradeCompletionAttestationPayload");
  }
  if (payload.attestorEpochKeyPublicHex !== keypair.publicKeyHex) {
    throw new RangeError(
      "reputation sign: payload.attestorEpochKeyPublicHex must match the signing keypair's own public key",
    );
  }
  const unsigned = {
    version: REPUTATION_ENVELOPE_VERSION_1,
    type: TRADE_COMPLETION_ATTESTATION_ENVELOPE_TYPE,
    issuer: meta.issuer,
    subject: meta.subject,
    audience: meta.audience,
    issuedAt: meta.issuedAt,
    expiresAt: meta.expiresAt,
    nonce: meta.nonce,
    payload,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    keyId: keypair.publicKeyHex,
  };
  const canonicalPayload = canonicalizeTradeCompletionAttestationPayload(payload);
  const bytes = canonicalBytesForReputationEnvelope(unsigned, canonicalPayload);
  const signature = bytesToHex(keypair.signBytes(bytes));
  return { ...unsigned, signature };
}

export type AttestationVerifyStatus =
  | "VALID"
  | "MALFORMED_ENVELOPE"
  | "MALFORMED_PAYLOAD"
  | "WRONG_TYPE"
  | "KEY_ID_MISMATCH"
  | "SIGNATURE_INVALID";

export type AttestationVerifyResult<TPayload> =
  | { readonly status: "VALID"; readonly payload: TPayload; readonly signerPublicKeyHex: string }
  | { readonly status: Exclude<AttestationVerifyStatus, "VALID">; readonly detail?: string };

function isWellFormedEnvelopeShape(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== REPUTATION_ENVELOPE_VERSION_1) return false;
  if (typeof candidate.type !== "string" || candidate.type.length === 0) return false;
  if (typeof candidate.issuer !== "string" || candidate.issuer.length === 0) return false;
  if (candidate.subject !== undefined && typeof candidate.subject !== "string") return false;
  if (candidate.audience !== undefined && typeof candidate.audience !== "string") return false;
  if (typeof candidate.issuedAt !== "number" || !Number.isInteger(candidate.issuedAt)) return false;
  if (candidate.expiresAt !== undefined && (typeof candidate.expiresAt !== "number" || !Number.isInteger(candidate.expiresAt))) {
    return false;
  }
  if (candidate.nonce !== undefined && typeof candidate.nonce !== "string") return false;
  if (typeof candidate.signatureAlgorithm !== "string" || candidate.signatureAlgorithm !== SIGNATURE_ALGORITHM) return false;
  if (typeof candidate.keyId !== "string" || candidate.keyId.length === 0) return false;
  if (typeof candidate.signature !== "string" || candidate.signature.length === 0) return false;
  return true;
}

/**
 * Verifies a `TradeCompletionAttestationEnvelope`. Checks, in fixed order
 * (never throws, fails closed):
 *   1. Structural envelope well-formedness.
 *   2. `type` is exactly `TRADE_COMPLETION_ATTESTATION_ENVELOPE_TYPE`
 *      (`"WRONG_TYPE"` otherwise — domain separation, not just documentation).
 *   3. `payload` is a well-formed `TradeCompletionAttestationPayload`
 *      (`isWellFormedTradeCompletionAttestationPayload`, which itself
 *      rejects any unlisted key — see `attestation_types.ts`).
 *   4. `envelope.keyId === payload.attestorEpochKeyPublicHex` — this is the
 *      concrete enforcement of `attestation_types.ts`'s own note that the
 *      payload's `attestorEpochKeyPublicHex` field is "documentation-for-humans,
 *      never an independent trust input — verification MUST treat the
 *      envelope's own `keyId` as authoritative"; a mismatch here means
 *      someone tried to make the payload CLAIM a different signer than the
 *      one who actually signed (`"KEY_ID_MISMATCH"`).
 *   5. The Schnorr signature itself verifies against `keyId` over the exact
 *      canonical bytes recomputed from `payload` — this is what makes ANY
 *      tamper to ANY payload field (including `tradeRefDigestHex` —
 *      "tampered trade reference") detectable: a changed field changes the
 *      canonical bytes, which changes what the signature must verify
 *      against, which fails (`"SIGNATURE_INVALID"`). A signature produced by
 *      a DIFFERENT keypair than the one named in `keyId` also fails here
 *      ("wrong signer").
 *
 * Deliberately does NOT check `PersonaEpoch` validity windows — signature
 * validity is independent of whether the signing epoch is still "current";
 * see `reputation_issuance.ts`'s header for why epoch-currency is enforced
 * only at ISSUANCE time, not at every later verification of an
 * already-issued attestation ("old epoch handled correctly").
 */
export function verifyTradeCompletionAttestationEnvelope(
  envelope: unknown,
): AttestationVerifyResult<TradeCompletionAttestationPayload> {
  if (!isWellFormedEnvelopeShape(envelope)) return { status: "MALFORMED_ENVELOPE" };
  const candidate = envelope as Record<string, unknown>;
  if (candidate.type !== TRADE_COMPLETION_ATTESTATION_ENVELOPE_TYPE) {
    return { status: "WRONG_TYPE", detail: String(candidate.type) };
  }
  if (!isWellFormedTradeCompletionAttestationPayload(candidate.payload)) {
    return { status: "MALFORMED_PAYLOAD" };
  }
  const payload = candidate.payload;
  if (candidate.keyId !== payload.attestorEpochKeyPublicHex) {
    return { status: "KEY_ID_MISMATCH" };
  }
  const unsigned = {
    version: candidate.version as 1,
    type: candidate.type as string,
    issuer: candidate.issuer as string,
    subject: candidate.subject as string | undefined,
    audience: candidate.audience as string | undefined,
    issuedAt: candidate.issuedAt as number,
    expiresAt: candidate.expiresAt as number | undefined,
    nonce: candidate.nonce as string | undefined,
    payload,
    signatureAlgorithm: candidate.signatureAlgorithm as string,
    keyId: candidate.keyId as string,
  };
  let bytes: Uint8Array;
  try {
    bytes = canonicalBytesForReputationEnvelope(unsigned, canonicalizeTradeCompletionAttestationPayload(payload));
  } catch {
    return { status: "MALFORMED_ENVELOPE" };
  }
  const signatureOk = verifyPersonaEpochSignatureOverBytes(candidate.keyId as string, bytes, candidate.signature as string);
  if (!signatureOk) return { status: "SIGNATURE_INVALID" };
  return { status: "VALID", payload, signerPublicKeyHex: candidate.keyId as string };
}

/**
 * Signs a `ReputationAttestationPayload` (a derived summary — see
 * `attestation_types.ts`'s header: "an aggregator... could be the subject
 * epoch itself, self-attesting its own accumulated count"). Same
 * discipline as `signTradeCompletionAttestation`.
 */
export function signReputationAttestation(
  payload: ReputationAttestationPayload,
  keypair: PersonaEpochSigningKeypair,
  meta: SignEnvelopeMeta,
): ReputationAttestationEnvelope {
  if (!isWellFormedReputationAttestationPayload(payload)) {
    throw new RangeError("reputation sign: malformed ReputationAttestationPayload");
  }
  const unsigned = {
    version: REPUTATION_ENVELOPE_VERSION_1,
    type: REPUTATION_ATTESTATION_ENVELOPE_TYPE,
    issuer: meta.issuer,
    subject: meta.subject,
    audience: meta.audience,
    issuedAt: meta.issuedAt,
    expiresAt: meta.expiresAt,
    nonce: meta.nonce,
    payload,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    keyId: keypair.publicKeyHex,
  };
  const canonicalPayload = canonicalizeReputationAttestationPayload(payload);
  const bytes = canonicalBytesForReputationEnvelope(unsigned, canonicalPayload);
  const signature = bytesToHex(keypair.signBytes(bytes));
  return { ...unsigned, signature };
}

/** Same verification discipline as `verifyTradeCompletionAttestationEnvelope`,
 * for a `ReputationAttestationEnvelope`. `keyId` is checked against
 * `payload.subjectEpochKeyPublicHex` (the self-attesting aggregator's own
 * key in this minimal design — see this file's header). */
export function verifyReputationAttestationEnvelope(
  envelope: unknown,
): AttestationVerifyResult<ReputationAttestationPayload> {
  if (!isWellFormedEnvelopeShape(envelope)) return { status: "MALFORMED_ENVELOPE" };
  const candidate = envelope as Record<string, unknown>;
  if (candidate.type !== REPUTATION_ATTESTATION_ENVELOPE_TYPE) {
    return { status: "WRONG_TYPE", detail: String(candidate.type) };
  }
  if (!isWellFormedReputationAttestationPayload(candidate.payload)) {
    return { status: "MALFORMED_PAYLOAD" };
  }
  const payload = candidate.payload;
  if (candidate.keyId !== payload.subjectEpochKeyPublicHex) {
    return { status: "KEY_ID_MISMATCH" };
  }
  const unsigned = {
    version: candidate.version as 1,
    type: candidate.type as string,
    issuer: candidate.issuer as string,
    subject: candidate.subject as string | undefined,
    audience: candidate.audience as string | undefined,
    issuedAt: candidate.issuedAt as number,
    expiresAt: candidate.expiresAt as number | undefined,
    nonce: candidate.nonce as string | undefined,
    payload,
    signatureAlgorithm: candidate.signatureAlgorithm as string,
    keyId: candidate.keyId as string,
  };
  let bytes: Uint8Array;
  try {
    bytes = canonicalBytesForReputationEnvelope(unsigned, canonicalizeReputationAttestationPayload(payload));
  } catch {
    return { status: "MALFORMED_ENVELOPE" };
  }
  const signatureOk = verifyPersonaEpochSignatureOverBytes(candidate.keyId as string, bytes, candidate.signature as string);
  if (!signatureOk) return { status: "SIGNATURE_INVALID" };
  return { status: "VALID", payload, signerPublicKeyHex: candidate.keyId as string };
}

/** Opaque, stable reference id for an already-signed envelope — what
 * `ReputationAttestationPayload.attestationRefs`
 * (`attestation_types.ts`) and `PersonaBoardInternalRecord.attestationRefs`
 * (`disclosure_layers.ts`) actually store: a digest of the envelope's own
 * signature, never the envelope's full contents. */
export function computeAttestationRef(envelope: { readonly signature: string }): string {
  return bytesToHex(sha256(new TextEncoder().encode(envelope.signature)));
}
