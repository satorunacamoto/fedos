/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent G) — REAL sign/verify for `MediaAccessGrantEnvelope`
 * (`./media_access_grant_types.ts`).
 *
 * Domain-separated envelope `type` literal
 * (`fedos.commerce.media-access-grant.v1`), per
 * `../reputation/attestation_types.ts`'s own header instruction to "never
 * repurpose an existing Trust `type` literal for a new purpose" — this is
 * a NEW literal, scoped to this local envelope mirror only.
 *
 * SIGNING KEY REUSE DECISION: this file signs with, and verifies against,
 * `PersonaEpochSigningKeypair` (`../reputation/persona_epoch_signing_keypair.js`)
 * — the SAME class the Reputation subsystem already uses, imported
 * directly rather than re-declared a fourth time. That class's own header
 * explains why THREE independent domains (Messenger Device identity, Trust
 * envelope signing, Commerce reputation/Persona) each duplicated a ~20-line
 * fresh-secp256k1-keypair class rather than share one: avoiding a
 * CROSS-domain import (messenger/trust/commerce). Reusing it a SECOND time
 * WITHIN `src/os/commerce` (this file lives in
 * `src/os/commerce/media_grant/`, the class in
 * `src/os/commerce/reputation/`) is not that situation — it is ordinary,
 * encouraged within-domain reuse of an already-reviewed, already-tested
 * primitive (plain `@noble/curves` Schnorr generate/sign/verify over
 * `sha256(bytes)`, nothing persona/reputation-specific about the operation
 * itself). A merchant's "media grant signing key" is, cryptographically,
 * exactly the same shape of thing as a "persona epoch signing key": a
 * fresh, non-Master-Seed-derived secp256k1 keypair whose ONLY job is to
 * make a specific class of Commerce-domain signed statement checkable.
 * Declaring a fourth near-identical class here would be pure duplication,
 * not domain isolation — `os/commerce` importing `os/commerce` is not a
 * boundary the architecture guard (`test/architecture_boundary_commerce.test.ts`)
 * restricts in any way (confirmed by direct inspection before writing this
 * file: only `conversation/board/desktop/device/nostr/os-messenger` targets
 * are forbidden).
 *
 * WHO IS THE "issuer": unlike `TradeCompletionAttestationPayload` (any
 * counterparty may attest a trade with their OWN Persona Epoch key,
 * independent of real identity), a `MediaAccessGrant`'s signer is NOT free
 * — `./media_access_grant_policy.ts`'s `evaluateMediaAccessGrant()`
 * additionally requires `envelope.keyId === order.sellerPubkey`, i.e. the
 * grant must be signed by the exact same real pubkey that owns the
 * qualifying Order's seller side. This file itself does not know about
 * `Order` at all (kept a pure sign/verify layer, matching
 * `attestation_sign_verify.ts`'s own scope) — that check lives in the
 * policy layer, one level up.
 */

import {
  isWellFormedMediaAccessGrantPayload,
  type MediaAccessGrantEnvelope,
  type MediaAccessGrantPayload,
} from "./media_access_grant_types.js";
import { canonicalizeMediaAccessGrantPayload } from "./media_access_grant_canonical_bytes.js";
import {
  canonicalBytesForReputationEnvelope,
  canonicalizeReputationEnvelope,
} from "../reputation/attestation_canonical_bytes.js";
import {
  PersonaEpochSigningKeypair,
  verifyPersonaEpochSignatureOverBytes,
} from "../reputation/persona_epoch_signing_keypair.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export const MEDIA_ACCESS_GRANT_ENVELOPE_VERSION_1 = 1 as const;
export const MEDIA_ACCESS_GRANT_ENVELOPE_TYPE = "fedos.commerce.media-access-grant.v1" as const;
const SIGNATURE_ALGORITHM = "schnorr-secp256k1" as const;

/** The merchant's own media-grant signing keypair — see this file's own header for why `PersonaEpochSigningKeypair` is reused directly rather than re-declared. */
export type MediaAccessGrantSigningKeypair = PersonaEpochSigningKeypair;

export interface SignMediaAccessGrantMeta {
  readonly issuer: string;
  readonly subject?: string;
  readonly audience?: string;
  readonly issuedAt: number;
  readonly expiresAt?: number;
  readonly nonce?: string;
}

/**
 * Signs a `MediaAccessGrantPayload` into a `MediaAccessGrantEnvelope`,
 * using `keypair` as BOTH the envelope's `keyId` and the payload's own
 * `issuerPubkey` (they MUST match — same redundancy-is-checked discipline
 * as `signTradeCompletionAttestation`). Throws `RangeError` on a malformed
 * payload or a `keyId`/`issuerPubkey` mismatch — an internal-construction
 * contract, not a boundary parser (mirrors every `sign*` function's
 * fail-fast discipline elsewhere in this Commerce domain).
 */
export function signMediaAccessGrant(
  payload: MediaAccessGrantPayload,
  keypair: MediaAccessGrantSigningKeypair,
  meta: SignMediaAccessGrantMeta,
): MediaAccessGrantEnvelope {
  if (!isWellFormedMediaAccessGrantPayload(payload)) {
    throw new RangeError("media access grant sign: malformed MediaAccessGrantPayload");
  }
  if (payload.issuerPubkey !== keypair.publicKeyHex) {
    throw new RangeError("media access grant sign: payload.issuerPubkey must match the signing keypair's own public key");
  }
  const unsigned = {
    version: MEDIA_ACCESS_GRANT_ENVELOPE_VERSION_1,
    type: MEDIA_ACCESS_GRANT_ENVELOPE_TYPE,
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
  const canonicalPayload = canonicalizeMediaAccessGrantPayload(payload);
  const bytes = canonicalBytesForReputationEnvelope(unsigned, canonicalPayload);
  const signature = bytesToHex(keypair.signBytes(bytes));
  return { ...unsigned, signature };
}

export type MediaAccessGrantVerifyStatus =
  | "VALID"
  | "MALFORMED_ENVELOPE"
  | "MALFORMED_PAYLOAD"
  | "WRONG_TYPE"
  | "KEY_ID_MISMATCH"
  | "SIGNATURE_INVALID";

export type MediaAccessGrantVerifyResult =
  | { readonly status: "VALID"; readonly payload: MediaAccessGrantPayload; readonly signerPublicKeyHex: string }
  | { readonly status: Exclude<MediaAccessGrantVerifyStatus, "VALID">; readonly detail?: string };

function isWellFormedEnvelopeShape(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== MEDIA_ACCESS_GRANT_ENVELOPE_VERSION_1) return false;
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
 * Verifies a `MediaAccessGrantEnvelope`. Checks, in fixed order (never
 * throws, fails closed):
 *   1. Structural envelope well-formedness.
 *   2. `type` is exactly `MEDIA_ACCESS_GRANT_ENVELOPE_TYPE` (domain
 *      separation, not just documentation).
 *   3. `payload` is a well-formed `MediaAccessGrantPayload`
 *      (`isWellFormedMediaAccessGrantPayload`, which itself rejects any
 *      unlisted key).
 *   4. `envelope.keyId === payload.issuerPubkey` — the concrete
 *      enforcement of `media_access_grant_types.ts`'s own note that
 *      `issuerPubkey` is documentation-for-humans only; a mismatch means
 *      someone tried to make the payload CLAIM a different signer than the
 *      one who actually signed.
 *   5. The Schnorr signature itself verifies against `keyId` over the exact
 *      canonical bytes recomputed from `payload` — this is what makes ANY
 *      tamper to ANY payload field (`mediaId`, `buyerPubkey`, `orderId`,
 *      `revoked`, `validUntil`, ...) detectable, and what makes a
 *      different-keypair forgery fail even if it claims the right `keyId`.
 *
 * Does NOT check `Order`/`Product`/`ProductMedia` binding, expiry,
 * revocation, or WHO is allowed to be this grant's signer relative to a
 * real Order's `sellerPubkey` — those are business-policy checks, layered
 * on top by `./media_access_grant_policy.ts`'s `evaluateMediaAccessGrant()`,
 * which calls this function as its own first, mandatory step.
 */
export function verifyMediaAccessGrantEnvelope(envelope: unknown): MediaAccessGrantVerifyResult {
  if (!isWellFormedEnvelopeShape(envelope)) return { status: "MALFORMED_ENVELOPE" };
  const candidate = envelope as Record<string, unknown>;
  if (candidate.type !== MEDIA_ACCESS_GRANT_ENVELOPE_TYPE) {
    return { status: "WRONG_TYPE", detail: String(candidate.type) };
  }
  if (!isWellFormedMediaAccessGrantPayload(candidate.payload)) {
    return { status: "MALFORMED_PAYLOAD" };
  }
  const payload = candidate.payload;
  if (candidate.keyId !== payload.issuerPubkey) {
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
    bytes = canonicalBytesForReputationEnvelope(unsigned, canonicalizeMediaAccessGrantPayload(payload));
  } catch {
    return { status: "MALFORMED_ENVELOPE" };
  }
  const signatureOk = verifyPersonaEpochSignatureOverBytes(candidate.keyId as string, bytes, candidate.signature as string);
  if (!signatureOk) return { status: "SIGNATURE_INVALID" };
  return { status: "VALID", payload, signerPublicKeyHex: candidate.keyId as string };
}

// Re-exported so callers of this file need not separately reach into
// `../reputation/attestation_canonical_bytes.js` just to confirm this
// module really does reuse the generic envelope canonicalizer (used by
// this file's own test suite to assert byte-for-byte reuse, not a
// reimplementation).
export { canonicalizeReputationEnvelope };
