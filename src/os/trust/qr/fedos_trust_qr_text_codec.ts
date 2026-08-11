/**
 * Trust — QR text codec.
 *
 * CRITICAL DESIGN CONSTRAINT (arc brief §19–22): the security primitive of
 * this whole capability is `FedosTrustSignedEnvelope` — signing and
 * verification live entirely in `../envelope/`. This file does NOT invent
 * any new signing/verification logic; it only losslessly encodes an
 * ALREADY-SIGNED envelope to/from a compact text string suitable for
 * embedding in a QR code, and decodes it back. A QR code is a transport
 * representation, never a security boundary of its own.
 *
 * Encoding: `"fedos:trust:v1:"` + base64url(`JSON.stringify(envelope)`).
 * Reusing plain `JSON.stringify` of the already-signed envelope object here
 * (rather than the hand-written fixed-order canonicalizer in
 * `../envelope/fedos_trust_canonical_bytes.ts`) is intentional and safe:
 * that canonicalizer exists so byte-for-byte determinism is guaranteed
 * across the process that SIGNS a payload, which is a correctness
 * requirement for a signature. This codec runs strictly AFTER signing — it
 * is transport encoding of a value that already carries its own signed
 * canonical form baked into `signature`, so any valid JSON serialization of
 * the same object round-trips it losslessly. Decoding never re-derives or
 * re-checks the signature itself; see the round-trip contract below.
 *
 * ROUND-TRIP CONTRACT: because payload shape varies per domain (entitlement,
 * credential, possession, capability, contract-artifact — each owns its own
 * canonicalizer), `decodeFedosTrustEnvelopeFromQrText` can only structurally
 * validate the envelope's shape (right fields, right primitive types,
 * well-formed signature hex, known-looking domain type). It CANNOT
 * cryptographically re-verify the envelope, because that requires the
 * caller's domain-specific `canonicalPayload` string and a `FedosTrustPolicy`
 * neither of which this generic codec has. Full re-verification is always
 * the CALLER's responsibility: decode here, then call
 * `verifyFedosTrustEnvelopeV1(decoded, theRightDomainCanonicalPayload,
 * trustPolicy)` from `../envelope/index.js` using the same domain-specific
 * canonicalizer the original signer used.
 *
 * Fails closed on malformed/oversized input (arc brief §56–57): length is
 * checked BEFORE any base64 decoding or JSON parsing, so a hostile
 * oversized QR payload is rejected in O(1) before any real parsing work
 * happens.
 */

import {
  FEDOS_TRUST_ENVELOPE_VERSION_1,
  type FedosTrustEnvelopeType,
  type FedosTrustSignedEnvelope,
} from "../envelope/fedos_trust_envelope_types.js";
import { isWellFormedFedosTrustSignatureHex } from "../envelope/fedos_trust_signing_keypair.js";
import {
  FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH,
  FEDOS_TRUST_MAX_FIELD_STRING_LENGTH,
} from "../fedos_trust_limits.js";

/** Domain prefix identifying this text as a FedOS Trust QR payload, and
 * pinning the codec version — a future `"fedos:trust:v2:"` can be introduced
 * additively without this decoder ever mis-reading it as v1. */
export const FEDOS_TRUST_QR_TEXT_PREFIX = "fedos:trust:v1:";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Loosely matches the shape of `FedosTrustEnvelopeType` (`"fedos.<domain>.v<N>"`)
 * without hardcoding/duplicating the exact literal union from
 * `../envelope/fedos_trust_envelope_types.ts` — new domain types can be
 * added there with zero changes needed here (arc brief §21: "extensible to
 * future types... with zero QR-protocol changes"). Precise domain
 * enforcement (matching one EXACT known literal) is the caller's job via
 * `verifyFedosTrustEnvelopeV1`'s `expectedType` option. */
const ENVELOPE_TYPE_SHAPE_PATTERN = /^fedos\.[a-z0-9-]+\.v[0-9]+$/;

/**
 * Encodes an already-signed envelope of ANY domain (`TPayload` is generic —
 * this codec never inspects `payload`'s internal shape) into a deterministic,
 * lossless QR text string.
 */
export function encodeFedosTrustEnvelopeToQrText<TPayload>(
  envelope: FedosTrustSignedEnvelope<TPayload>,
): string {
  const json = JSON.stringify(envelope);
  const encoded = Buffer.from(json, "utf8").toString("base64url");
  return `${FEDOS_TRUST_QR_TEXT_PREFIX}${encoded}`;
}

/** Generous upper bound on the raw QR TEXT itself (prefix + base64url),
 * checked before any decoding work. Derived from the canonical-envelope
 * length limit with base64's ~4/3 expansion and slack for `JSON.stringify`
 * producing a different (non-canonical) byte count than the hand-written
 * canonicalizer — always checked again, precisely, on the decoded string
 * below. */
const FEDOS_TRUST_QR_TEXT_MAX_LENGTH =
  FEDOS_TRUST_QR_TEXT_PREFIX.length + Math.ceil((FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH * 2 * 4) / 3);

export interface FedosTrustQrDecodeError {
  readonly error: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown, maxLength: number): boolean {
  return value === undefined || (typeof value === "string" && value.length <= maxLength);
}

/**
 * Structural-only validation of a parsed JSON value against the
 * `FedosTrustSignedEnvelope` shape: right fields present, right primitive
 * types, bounded string lengths, well-formed signature hex, envelope-version
 * pinned to the one this codec understands, and a type field that at least
 * LOOKS like a FedOS Trust domain type. Does NOT check cryptographic
 * validity, issuer trust, or expiry — see this file's header.
 */
function isStructurallyValidFedosTrustSignedEnvelope(value: unknown): value is FedosTrustSignedEnvelope {
  if (!isPlainObject(value)) return false;
  if (value.version !== FEDOS_TRUST_ENVELOPE_VERSION_1) return false;
  if (typeof value.type !== "string" || !ENVELOPE_TYPE_SHAPE_PATTERN.test(value.type)) return false;
  if (typeof value.issuer !== "string" || value.issuer.length === 0 || value.issuer.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    return false;
  }
  if (!isOptionalString(value.subject, FEDOS_TRUST_MAX_FIELD_STRING_LENGTH)) return false;
  if (!isOptionalString(value.audience, FEDOS_TRUST_MAX_FIELD_STRING_LENGTH)) return false;
  if (typeof value.issuedAt !== "number" || !Number.isInteger(value.issuedAt)) return false;
  if (value.expiresAt !== undefined && (typeof value.expiresAt !== "number" || !Number.isInteger(value.expiresAt))) {
    return false;
  }
  if (!isOptionalString(value.nonce, FEDOS_TRUST_MAX_FIELD_STRING_LENGTH)) return false;
  if (!("payload" in value) || value.payload === undefined) return false;
  if (typeof value.signatureAlgorithm !== "string" || value.signatureAlgorithm.length === 0 || value.signatureAlgorithm.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    return false;
  }
  if (typeof value.keyId !== "string" || value.keyId.length === 0 || value.keyId.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    return false;
  }
  if (!isWellFormedFedosTrustSignatureHex(value.signature)) return false;
  return true;
}

/**
 * Decodes a QR text string produced by `encodeFedosTrustEnvelopeToQrText`
 * back into a `FedosTrustSignedEnvelope`. Fails closed — never throws — on
 * any malformed, truncated, corrupted, or oversized input; returns
 * `{ error }` instead. Callers MUST still cryptographically re-verify the
 * result via `verifyFedosTrustEnvelopeV1` (see this file's header) before
 * trusting it for anything.
 */
export function decodeFedosTrustEnvelopeFromQrText(
  text: string,
): FedosTrustSignedEnvelope | FedosTrustQrDecodeError {
  if (typeof text !== "string" || text.length === 0) {
    return { error: "malformed-qr-text" };
  }
  // Bound work on hostile input BEFORE any base64 decoding or JSON parsing.
  if (text.length > FEDOS_TRUST_QR_TEXT_MAX_LENGTH) {
    return { error: "oversized-qr-text" };
  }
  if (!text.startsWith(FEDOS_TRUST_QR_TEXT_PREFIX)) {
    return { error: "unrecognized-qr-prefix" };
  }
  const encoded = text.slice(FEDOS_TRUST_QR_TEXT_PREFIX.length);
  if (encoded.length === 0 || !BASE64URL_PATTERN.test(encoded)) {
    return { error: "malformed-base64" };
  }

  let decodedJsonText: string;
  try {
    decodedJsonText = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return { error: "malformed-base64" };
  }
  // Precise, second bound: the DECODED canonical-ish text must not exceed
  // the same shared envelope length limit `../envelope/` itself enforces
  // (arc brief §57 "oversized payload") — checked BEFORE JSON.parse.
  if (decodedJsonText.length === 0 || decodedJsonText.length > FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH) {
    return { error: "oversized-envelope" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedJsonText);
  } catch {
    return { error: "malformed-json" };
  }

  if (!isStructurallyValidFedosTrustSignedEnvelope(parsed)) {
    return { error: "malformed-envelope-shape" };
  }
  return parsed;
}

/** Re-exported for callers that want to sanity-check a type string looks
 * like a FedOS Trust domain type without importing the full envelope union. */
export type { FedosTrustEnvelopeType };
