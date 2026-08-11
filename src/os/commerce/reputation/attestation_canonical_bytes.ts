/**
 * Reputation / Persona Epoch — REAL canonical byte serialization (Wave B,
 * Agent R closure pass).
 *
 * Follows the exact same fixed-field-order, hand-written string builder
 * convention `src/os/trust/envelope/fedos_trust_canonical_bytes.ts` and
 * `receipt/receipt_types.ts` already use in this repository — never generic
 * `JSON.stringify(wholeObject)` (insertion order is not a cryptographic
 * guarantee across engines/versions/future refactors). This file is the
 * "each domain owns its own payload canonicalizer" implementation
 * `attestation_types.ts`'s header pointed at, plus a canonicalizer for
 * `ReputationLocalSignedEnvelopeShape<TPayload>` itself (the local mirror of
 * `FedosTrustSignedEnvelope`, same field set).
 */

import type {
  ReputationAttestationPayload,
  ReputationLocalSignedEnvelopeShape,
  TradeCompletionAttestationPayload,
} from "./attestation_types.js";

const MAX_FIELD_STRING_LENGTH = 512;
/** Mirrors `FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH` — restated locally
 * per this directory's own established "no cross-domain import" discipline. */
const MAX_CANONICAL_LENGTH = 16_384;

function requiredStringLiteral(fieldName: string, value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`reputation canonical bytes: "${fieldName}" must be a non-empty string`);
  }
  if (value.length > MAX_FIELD_STRING_LENGTH) {
    throw new RangeError(`reputation canonical bytes: "${fieldName}" exceeds max length`);
  }
  return JSON.stringify(value);
}

function optionalStringLiteral(fieldName: string, value: string | undefined): string {
  if (value === undefined) return "null";
  return requiredStringLiteral(fieldName, value);
}

function integerLiteral(fieldName: string, value: number): string {
  if (!Number.isInteger(value)) {
    throw new RangeError(`reputation canonical bytes: "${fieldName}" must be an integer`);
  }
  return String(value);
}

function optionalIntegerLiteral(fieldName: string, value: number | undefined): string {
  if (value === undefined) return "null";
  return integerLiteral(fieldName, value);
}

function stringArrayLiteral(fieldName: string, values: readonly string[]): string {
  if (!Array.isArray(values)) {
    throw new RangeError(`reputation canonical bytes: "${fieldName}" must be an array`);
  }
  return `[${values.map((value) => requiredStringLiteral(fieldName, value)).join(",")}]`;
}

/** Canonicalizes a `TradeCompletionAttestationPayload` in fixed field order. */
export function canonicalizeTradeCompletionAttestationPayload(payload: TradeCompletionAttestationPayload): string {
  const parts: readonly string[] = [
    `"attestorEpochKeyPublicHex":${requiredStringLiteral("attestorEpochKeyPublicHex", payload.attestorEpochKeyPublicHex)}`,
    `"subjectEpochId":${requiredStringLiteral("subjectEpochId", payload.subjectEpochId)}`,
    `"tradeRefDigestHex":${requiredStringLiteral("tradeRefDigestHex", payload.tradeRefDigestHex)}`,
    `"category":${requiredStringLiteral("category", payload.category)}`,
    `"outcome":${requiredStringLiteral("outcome", payload.outcome)}`,
    `"completedAt":${integerLiteral("completedAt", payload.completedAt)}`,
    `"formatVersion":${integerLiteral("formatVersion", payload.formatVersion)}`,
  ];
  return `{${parts.join(",")}}`;
}

/** Canonicalizes a `ReputationAttestationPayload` in fixed field order. */
export function canonicalizeReputationAttestationPayload(payload: ReputationAttestationPayload): string {
  const parts: readonly string[] = [
    `"subjectEpochId":${requiredStringLiteral("subjectEpochId", payload.subjectEpochId)}`,
    `"subjectEpochKeyPublicHex":${requiredStringLiteral("subjectEpochKeyPublicHex", payload.subjectEpochKeyPublicHex)}`,
    `"verifiedTradeCount":${integerLiteral("verifiedTradeCount", payload.verifiedTradeCount)}`,
    `"attestationRefs":${stringArrayLiteral("attestationRefs", payload.attestationRefs)}`,
    `"asOf":${integerLiteral("asOf", payload.asOf)}`,
    `"formatVersion":${integerLiteral("formatVersion", payload.formatVersion)}`,
  ];
  return `{${parts.join(",")}}`;
}

/**
 * Canonicalizes a `ReputationLocalSignedEnvelopeShape<TPayload>`'s METADATA
 * fields plus a caller-supplied already-canonical payload string — mirrors
 * `canonicalizeFedosTrustEnvelopeV1`'s exact field order and "embedded
 * verbatim, not re-escaped" discipline.
 */
export function canonicalizeReputationEnvelope<TPayload>(
  envelope: Omit<ReputationLocalSignedEnvelopeShape<TPayload>, "signature">,
  canonicalPayload: string,
): string {
  if (typeof canonicalPayload !== "string" || canonicalPayload.length === 0) {
    throw new RangeError("reputation canonical bytes: canonicalPayload must be a non-empty string");
  }
  const parts: readonly string[] = [
    `"version":${integerLiteral("version", envelope.version)}`,
    `"type":${requiredStringLiteral("type", envelope.type)}`,
    `"issuer":${requiredStringLiteral("issuer", envelope.issuer)}`,
    `"subject":${optionalStringLiteral("subject", envelope.subject)}`,
    `"audience":${optionalStringLiteral("audience", envelope.audience)}`,
    `"issuedAt":${integerLiteral("issuedAt", envelope.issuedAt)}`,
    `"expiresAt":${optionalIntegerLiteral("expiresAt", envelope.expiresAt)}`,
    `"nonce":${optionalStringLiteral("nonce", envelope.nonce)}`,
    `"payload":${canonicalPayload}`,
    `"signatureAlgorithm":${requiredStringLiteral("signatureAlgorithm", envelope.signatureAlgorithm)}`,
    `"keyId":${requiredStringLiteral("keyId", envelope.keyId)}`,
  ];
  const canonical = `{${parts.join(",")}}`;
  if (canonical.length > MAX_CANONICAL_LENGTH) {
    throw new RangeError(
      `reputation canonical bytes: canonical form exceeds max length (${canonical.length} > ${MAX_CANONICAL_LENGTH})`,
    );
  }
  return canonical;
}

export function canonicalBytesForReputationEnvelope<TPayload>(
  envelope: Omit<ReputationLocalSignedEnvelopeShape<TPayload>, "signature">,
  canonicalPayload: string,
): Uint8Array {
  return new TextEncoder().encode(canonicalizeReputationEnvelope(envelope, canonicalPayload));
}
