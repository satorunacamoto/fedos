/**
 * Trust — canonical byte serialization for `FedosTrustCapabilityGrantPayload`.
 *
 * Follows `../envelope/fedos_trust_canonical_bytes.ts`'s own established
 * per-domain convention: a fixed-field-order, hand-written string builder —
 * never a generic `JSON.stringify(wholeObject)`. `permissions` (an array)
 * is serialized element-by-element, each element itself bounded and
 * escaped via `JSON.stringify` on that single string leaf value only.
 */

import { FEDOS_TRUST_MAX_FIELD_STRING_LENGTH, FEDOS_TRUST_MAX_SCOPES } from "../fedos_trust_limits.js";
import type {
  FedosTrustCapabilityDelegationPolicy,
  FedosTrustCapabilityGrantPayload,
} from "./fedos_trust_capability_grant_types.js";

const DELEGATION_POLICIES: ReadonlySet<FedosTrustCapabilityDelegationPolicy> = new Set([
  "none",
  "subject-may-delegate",
]);

function requiredStringLiteral(fieldName: string, value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new RangeError(`fedos trust capability grant: "${fieldName}" must be a non-empty string`);
  }
  if (value.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    throw new RangeError(`fedos trust capability grant: "${fieldName}" exceeds max length`);
  }
  return JSON.stringify(value);
}

function optionalStringLiteral(fieldName: string, value: string | undefined): string {
  if (value === undefined) return "null";
  return requiredStringLiteral(fieldName, value);
}

function delegationPolicyLiteral(value: FedosTrustCapabilityDelegationPolicy): string {
  if (!DELEGATION_POLICIES.has(value)) {
    throw new RangeError(`fedos trust capability grant: unknown delegationPolicy ${JSON.stringify(value)}`);
  }
  return JSON.stringify(value);
}

function permissionsArrayLiteral(permissions: readonly string[]): string {
  if (!Array.isArray(permissions)) {
    throw new RangeError("fedos trust capability grant: permissions must be an array");
  }
  if (permissions.length > FEDOS_TRUST_MAX_SCOPES) {
    throw new RangeError(
      `fedos trust capability grant: permissions exceeds max count (${permissions.length} > ${FEDOS_TRUST_MAX_SCOPES})`,
    );
  }
  const elements = permissions.map((permission, index) =>
    requiredStringLiteral(`permissions[${index}]`, permission),
  );
  return `[${elements.join(",")}]`;
}

/**
 * Builds the canonical, fixed-order payload string. This is the
 * `canonicalPayload` argument every caller passes to
 * `signFedosTrustEnvelopeV1`/`verifyFedosTrustEnvelopeV1`.
 */
export function canonicalizeFedosTrustCapabilityGrantPayloadV1(
  payload: FedosTrustCapabilityGrantPayload,
): string {
  const parts: readonly string[] = [
    `"subjectPublicKeyHex":${requiredStringLiteral("subjectPublicKeyHex", payload.subjectPublicKeyHex)}`,
    `"resource":${requiredStringLiteral("resource", payload.resource)}`,
    `"permissions":${permissionsArrayLiteral(payload.permissions)}`,
    `"delegationPolicy":${delegationPolicyLiteral(payload.delegationPolicy)}`,
    `"nonce":${optionalStringLiteral("nonce", payload.nonce)}`,
  ];
  return `{${parts.join(",")}}`;
}
