/**
 * Trust — canonical byte serialization for `SubscriptionSigningRequest`.
 *
 * Same fixed-field-order, hand-written string-builder convention as
 * `fedos_trust_subscription_entitlement_canonical.ts` — see that file's
 * header for the repository-wide precedent this follows.
 */

import { FEDOS_TRUST_MAX_FIELD_STRING_LENGTH, FEDOS_TRUST_MAX_SCOPES } from "../fedos_trust_limits.js";
import type { SubscriptionSigningRequest } from "./fedos_trust_subscription_signing_request_types.js";

function requiredStringLiteral(fieldName: string, value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`fedos subscription signing request: "${fieldName}" must be a non-empty string`);
  }
  if (value.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    throw new RangeError(`fedos subscription signing request: "${fieldName}" exceeds max length`);
  }
  return JSON.stringify(value);
}

function integerLiteral(fieldName: string, value: number): string {
  if (!Number.isInteger(value)) {
    throw new RangeError(`fedos subscription signing request: "${fieldName}" must be an integer`);
  }
  return String(value);
}

function scopesArrayLiteral(scopes: readonly string[]): string {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new RangeError('fedos subscription signing request: "requestedScopes" must be a non-empty array');
  }
  if (scopes.length > FEDOS_TRUST_MAX_SCOPES) {
    throw new RangeError(
      `fedos subscription signing request: "requestedScopes" exceeds max count (${FEDOS_TRUST_MAX_SCOPES})`,
    );
  }
  const literals = scopes.map((scope, index) => requiredStringLiteral(`requestedScopes[${index}]`, scope));
  return `[${literals.join(",")}]`;
}

/**
 * Builds the canonical, fixed-order payload string. This is the
 * `canonicalPayload` argument every caller passes to
 * `signFedosTrustEnvelopeV1`/`verifyFedosTrustEnvelopeV1`.
 */
export function canonicalizeFedosTrustSubscriptionSigningRequestV1(payload: SubscriptionSigningRequest): string {
  const parts: readonly string[] = [
    `"subjectPublicKeyHex":${requiredStringLiteral("subjectPublicKeyHex", payload.subjectPublicKeyHex)}`,
    `"requestedPlan":${requiredStringLiteral("requestedPlan", payload.requestedPlan)}`,
    `"requestedScopes":${scopesArrayLiteral(payload.requestedScopes)}`,
    `"requestNonce":${requiredStringLiteral("requestNonce", payload.requestNonce)}`,
    `"createdAt":${integerLiteral("createdAt", payload.createdAt)}`,
    `"formatVersion":${integerLiteral("formatVersion", payload.formatVersion)}`,
  ];
  return `{${parts.join(",")}}`;
}
