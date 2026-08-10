/**
 * Trust — canonical byte serialization for `FedosTrustPseudonymousCredentialPayload`.
 *
 * Follows `../envelope/fedos_trust_canonical_bytes.ts`'s own established
 * per-domain convention (itself following this repository's OWN
 * established per-record convention, see
 * `src/os/messenger/conversations/deletion_request/fedos_deletion_request_canonical_bytes.ts`):
 * a fixed-field-order, hand-written string builder — never a generic
 * `JSON.stringify(wholeObject)`.
 */

import { FEDOS_TRUST_MAX_FIELD_STRING_LENGTH } from "../fedos_trust_limits.js";
import type { FedosTrustPseudonymousCredentialPayload } from "./fedos_trust_pseudonymous_credential_types.js";

function requiredStringLiteral(fieldName: string, value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`fedos trust pseudonymous credential: "${fieldName}" must be a non-empty string`);
  }
  if (value.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    throw new RangeError(`fedos trust pseudonymous credential: "${fieldName}" exceeds max length`);
  }
  return JSON.stringify(value);
}

function optionalStringLiteral(fieldName: string, value: string | undefined): string {
  if (value === undefined) return "null";
  return requiredStringLiteral(fieldName, value);
}

/**
 * Builds the canonical, fixed-order payload string. This is the
 * `canonicalPayload` argument every caller passes to
 * `signFedosTrustEnvelopeV1`/`verifyFedosTrustEnvelopeV1`.
 */
export function canonicalizeFedosTrustPseudonymousCredentialPayloadV1(
  payload: FedosTrustPseudonymousCredentialPayload,
): string {
  const parts: readonly string[] = [
    `"subjectPublicKeyHex":${requiredStringLiteral("subjectPublicKeyHex", payload.subjectPublicKeyHex)}`,
    `"label":${requiredStringLiteral("label", payload.label)}`,
    `"issuerStatement":${optionalStringLiteral("issuerStatement", payload.issuerStatement)}`,
  ];
  return `{${parts.join(",")}}`;
}
