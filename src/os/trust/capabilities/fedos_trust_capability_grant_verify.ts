/**
 * Trust — verify a `fedos.capability.v1` CapabilityGrant envelope.
 *
 * Layers payload-shape validation on top of the generic envelope verifier
 * (arc brief §14 pattern) and domain-separates via `expectedType`.
 */

import {
  isWellFormedFedosTrustPublicKeyHex,
  verifyFedosTrustEnvelopeV1,
  type FedosTrustClock,
  type FedosTrustSignedEnvelope,
  type FedosTrustVerifyFailureReason,
} from "../envelope/index.js";
import type { FedosTrustPolicy } from "../policy/index.js";
import { FEDOS_TRUST_MAX_FIELD_STRING_LENGTH, FEDOS_TRUST_MAX_SCOPES } from "../fedos_trust_limits.js";
import { canonicalizeFedosTrustCapabilityGrantPayloadV1 } from "./fedos_trust_capability_grant_canonical.js";
import type {
  FedosTrustCapabilityDelegationPolicy,
  FedosTrustCapabilityGrantPayload,
} from "./fedos_trust_capability_grant_types.js";

const DELEGATION_POLICIES: ReadonlySet<string> = new Set<FedosTrustCapabilityDelegationPolicy>([
  "none",
  "subject-may-delegate",
]);

export type FedosTrustCapabilityGrantVerifyFailureReason = FedosTrustVerifyFailureReason | "invalid-payload-shape";

export type FedosTrustCapabilityGrantVerifyResult =
  | {
      readonly ok: true;
      readonly resolvedPublicKeyHex: string;
      readonly payload: FedosTrustCapabilityGrantPayload;
    }
  | {
      readonly ok: false;
      readonly reason: FedosTrustCapabilityGrantVerifyFailureReason;
      readonly detail?: string;
    };

/** Fails closed to `false`; never throws. */
function isWellFormedFedosTrustCapabilityGrantPayload(
  payload: unknown,
): payload is FedosTrustCapabilityGrantPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const candidate = payload as Record<string, unknown>;
  if (!isWellFormedFedosTrustPublicKeyHex(candidate.subjectPublicKeyHex)) return false;
  if (typeof candidate.resource !== "string" || candidate.resource.length === 0) return false;
  if (candidate.resource.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) return false;
  if (!Array.isArray(candidate.permissions)) return false;
  if (candidate.permissions.length > FEDOS_TRUST_MAX_SCOPES) return false;
  for (const permission of candidate.permissions) {
    if (typeof permission !== "string" || permission.length === 0) return false;
    if (permission.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) return false;
  }
  if (typeof candidate.delegationPolicy !== "string" || !DELEGATION_POLICIES.has(candidate.delegationPolicy)) {
    return false;
  }
  if (candidate.nonce !== undefined) {
    if (typeof candidate.nonce !== "string") return false;
    if (candidate.nonce.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) return false;
  }
  return true;
}

export function verifyFedosTrustCapabilityGrantV1(
  envelope: FedosTrustSignedEnvelope<FedosTrustCapabilityGrantPayload>,
  trustPolicy: FedosTrustPolicy,
  options: { readonly clock?: FedosTrustClock } = {},
): FedosTrustCapabilityGrantVerifyResult {
  if (!isWellFormedFedosTrustCapabilityGrantPayload(envelope.payload)) {
    return { ok: false, reason: "invalid-payload-shape", detail: "payload" };
  }

  let canonicalPayload: string;
  try {
    canonicalPayload = canonicalizeFedosTrustCapabilityGrantPayloadV1(envelope.payload);
  } catch (error) {
    return { ok: false, reason: "invalid-payload-shape", detail: String(error) };
  }

  const result = verifyFedosTrustEnvelopeV1(envelope, canonicalPayload, trustPolicy, {
    expectedType: "fedos.capability.v1",
    clock: options.clock,
  });
  if (!result.ok) return result;

  return { ok: true, resolvedPublicKeyHex: result.resolvedPublicKeyHex, payload: envelope.payload };
}
