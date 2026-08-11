/**
 * Trust — canonical byte serialization for `FedosTrustSignedEnvelope`.
 *
 * Follows this repository's OWN established per-record canonicalization
 * convention (see e.g.
 * `src/os/messenger/conversations/deletion_request/fedos_deletion_request_canonical_bytes.ts`):
 * a fixed-field-order, hand-written string builder — NOT a generic
 * `JSON.stringify(wholeObject)` or a third-party JCS library. Object key
 * order in JS is insertion order for string keys, which is NOT a
 * cryptographic guarantee across engines/versions/future refactors;
 * hand-fixing the order here is what makes this deterministic forever.
 *
 * The envelope `payload` is deliberately NOT canonicalized generically here.
 * Each domain (`entitlement/`, `credentials/`, `possession/`,
 * `capabilities/`, `contracts/`) owns its own payload shape and must supply
 * its own `canonicalPayload` string, built the same fixed-order way. This
 * keeps every payload field's serialization an explicit, reviewed decision
 * instead of an accidental one (arc brief §7–8: "no ambiguous
 * interpretation").
 */

import {
  FEDOS_TRUST_ENVELOPE_VERSION_1,
  type FedosTrustUnsignedEnvelope,
} from "./fedos_trust_envelope_types.js";
import { FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH, FEDOS_TRUST_MAX_FIELD_STRING_LENGTH } from "../fedos_trust_limits.js";

function requiredStringLiteral(fieldName: string, value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`fedos trust envelope: "${fieldName}" must be a non-empty string`);
  }
  if (value.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    throw new RangeError(`fedos trust envelope: "${fieldName}" exceeds max length`);
  }
  return JSON.stringify(value);
}

function optionalStringLiteral(fieldName: string, value: string | undefined): string {
  if (value === undefined) return "null";
  return requiredStringLiteral(fieldName, value);
}

function integerLiteral(fieldName: string, value: number): string {
  if (!Number.isInteger(value)) {
    throw new RangeError(`fedos trust envelope: "${fieldName}" must be an integer`);
  }
  return String(value);
}

function optionalIntegerLiteral(fieldName: string, value: number | undefined): string {
  if (value === undefined) return "null";
  return integerLiteral(fieldName, value);
}

/**
 * Canonicalizes an unsigned envelope's METADATA fields plus a
 * caller-supplied already-canonical payload string into one fixed-order
 * JSON-like string. `canonicalPayload` MUST itself be valid JSON (an
 * object, array, or scalar) produced by that payload type's own
 * canonicalizer — it is embedded verbatim, not re-escaped.
 */
export function canonicalizeFedosTrustEnvelopeV1(
  envelope: FedosTrustUnsignedEnvelope,
  canonicalPayload: string,
): string {
  if (envelope.version !== FEDOS_TRUST_ENVELOPE_VERSION_1) {
    throw new RangeError(`fedos trust envelope: unsupported version ${JSON.stringify(envelope.version)}`);
  }
  if (typeof canonicalPayload !== "string" || canonicalPayload.length === 0) {
    throw new RangeError("fedos trust envelope: canonicalPayload must be a non-empty string");
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
  if (canonical.length > FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH) {
    throw new RangeError(
      `fedos trust envelope: canonical form exceeds max length (${canonical.length} > ${FEDOS_TRUST_MAX_CANONICAL_ENVELOPE_LENGTH})`,
    );
  }
  return canonical;
}

export function canonicalBytesForFedosTrustEnvelopeV1(
  envelope: FedosTrustUnsignedEnvelope,
  canonicalPayload: string,
): Uint8Array {
  return new TextEncoder().encode(canonicalizeFedosTrustEnvelopeV1(envelope, canonicalPayload));
}
