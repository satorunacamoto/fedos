/**
 * Trust — canonical byte serialization for `FedosSubscriptionEntitlement`.
 *
 * Follows `../envelope/fedos_trust_canonical_bytes.ts`'s own established
 * per-domain convention (itself following this repository's OWN established
 * per-record convention, see
 * `src/os/messenger/conversations/deletion_request/fedos_deletion_request_canonical_bytes.ts`):
 * a fixed-field-order, hand-written string builder — never a generic
 * `JSON.stringify(wholeObject)`.
 */

import { FEDOS_TRUST_MAX_FIELD_STRING_LENGTH, FEDOS_TRUST_MAX_SCOPES } from "../fedos_trust_limits.js";
import type { FedosSubscriptionEntitlement } from "./fedos_trust_subscription_entitlement_types.js";

function requiredStringLiteral(fieldName: string, value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`fedos subscription entitlement: "${fieldName}" must be a non-empty string`);
  }
  if (value.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    throw new RangeError(`fedos subscription entitlement: "${fieldName}" exceeds max length`);
  }
  return JSON.stringify(value);
}

function integerLiteral(fieldName: string, value: number): string {
  if (!Number.isInteger(value)) {
    throw new RangeError(`fedos subscription entitlement: "${fieldName}" must be an integer`);
  }
  return String(value);
}

function scopesArrayLiteral(scopes: readonly string[]): string {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new RangeError('fedos subscription entitlement: "scopes" must be a non-empty array');
  }
  if (scopes.length > FEDOS_TRUST_MAX_SCOPES) {
    throw new RangeError(`fedos subscription entitlement: "scopes" exceeds max count (${FEDOS_TRUST_MAX_SCOPES})`);
  }
  const literals = scopes.map((scope, index) => requiredStringLiteral(`scopes[${index}]`, scope));
  return `[${literals.join(",")}]`;
}

/**
 * Builds the canonical, fixed-order payload string. This is the
 * `canonicalPayload` argument every caller passes to
 * `signFedosTrustEnvelopeV1`/`verifyFedosTrustEnvelopeV1`.
 */
export function canonicalizeFedosSubscriptionEntitlementV1(payload: FedosSubscriptionEntitlement): string {
  const parts: readonly string[] = [
    `"subjectPublicKeyHex":${requiredStringLiteral("subjectPublicKeyHex", payload.subjectPublicKeyHex)}`,
    `"issuerKeyId":${requiredStringLiteral("issuerKeyId", payload.issuerKeyId)}`,
    `"planId":${requiredStringLiteral("planId", payload.planId)}`,
    `"scopes":${scopesArrayLiteral(payload.scopes)}`,
    `"validFrom":${integerLiteral("validFrom", payload.validFrom)}`,
    `"validUntil":${integerLiteral("validUntil", payload.validUntil)}`,
    `"serial":${requiredStringLiteral("serial", payload.serial)}`,
    `"formatVersion":${integerLiteral("formatVersion", payload.formatVersion)}`,
  ];
  return `{${parts.join(",")}}`;
}
