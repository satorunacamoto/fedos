/**
 * Trust — verify a `fedos.subscription.v1` `FedosSubscriptionEntitlement`
 * envelope.
 *
 * Layers payload-shape + payload-specific checks on top of the generic
 * envelope verifier (arc brief §14 pattern — see
 * `../envelope/fedos_trust_envelope_verify.ts`'s own header), and produces a
 * discriminated `status` (§34) rather than a single boolean — a caller MUST
 * be able to distinguish `"EXPIRED"` from `"NOT_YET_VALID"` from an
 * envelope-level `"signature-invalid"`, etc. `"EXPIRED"`/`"NOT_YET_VALID"`
 * here (uppercase, entitlement-domain-specific) refer to the PAYLOAD's own
 * `validFrom`/`validUntil` window — distinct from the envelope-level
 * lowercase `"expired"`/`"not-yet-valid"` reasons `verifyFedosTrustEnvelopeV1`
 * can also return for the envelope's OWN `issuedAt`/`expiresAt` (see
 * `fedos_trust_subscription_entitlement_types.ts`'s header for why both
 * windows exist and are both checked).
 */

import {
  defaultFedosTrustClock,
  verifyFedosTrustEnvelopeV1,
  type FedosTrustClock,
  type FedosTrustSignedEnvelope,
  type FedosTrustVerifyFailureReason,
} from "../envelope/index.js";
import type { FedosTrustPolicy } from "../policy/index.js";
import { FEDOS_TRUST_CLOCK_SKEW_TOLERANCE_SECONDS } from "../fedos_trust_limits.js";
import { canonicalizeFedosSubscriptionEntitlementV1 } from "./fedos_trust_subscription_entitlement_canonical.js";
import {
  isWellFormedFedosSubscriptionEntitlement,
  type FedosSubscriptionEntitlement,
} from "./fedos_trust_subscription_entitlement_types.js";

export type FedosTrustSubscriptionEntitlementVerifyStatus =
  | "VALID"
  | "EXPIRED"
  | "NOT_YET_VALID"
  | "SCOPE_NOT_GRANTED"
  | "INVALID_PAYLOAD_SHAPE"
  | "KEY_ID_MISMATCH"
  | FedosTrustVerifyFailureReason;

export type FedosTrustSubscriptionEntitlementVerifyResult =
  | {
      readonly status: "VALID";
      readonly resolvedPublicKeyHex: string;
      readonly payload: FedosSubscriptionEntitlement;
    }
  | {
      readonly status: Exclude<FedosTrustSubscriptionEntitlementVerifyStatus, "VALID">;
      readonly detail?: string;
    };

export interface FedosTrustSubscriptionEntitlementVerifyOptions {
  readonly clock?: FedosTrustClock;
  /** If supplied, verification fails with `"SCOPE_NOT_GRANTED"` unless the
   * entitlement's own `scopes` includes EVERY scope listed here — the "wrong
   * scope requested vs granted" check (§14). Omit to skip this check
   * entirely (any valid, unexpired entitlement passes regardless of which
   * scopes it grants). */
  readonly requiredScopes?: readonly string[];
}

/** Never throws. */
export function verifyFedosSubscriptionEntitlement(
  envelope: FedosTrustSignedEnvelope,
  trustPolicy: FedosTrustPolicy,
  options: FedosTrustSubscriptionEntitlementVerifyOptions = {},
): FedosTrustSubscriptionEntitlementVerifyResult {
  if (!isWellFormedFedosSubscriptionEntitlement(envelope.payload)) {
    return { status: "INVALID_PAYLOAD_SHAPE" };
  }
  const payload = envelope.payload;

  let canonicalPayload: string;
  try {
    canonicalPayload = canonicalizeFedosSubscriptionEntitlementV1(payload);
  } catch (error) {
    return { status: "INVALID_PAYLOAD_SHAPE", detail: String(error) };
  }

  const envelopeResult = verifyFedosTrustEnvelopeV1(envelope, canonicalPayload, trustPolicy, {
    expectedType: "fedos.subscription.v1",
    clock: options.clock,
  });
  if (!envelopeResult.ok) {
    return { status: envelopeResult.reason, detail: envelopeResult.detail };
  }

  // Duplicate/conflicting fields (§14): the payload's own self-describing
  // `issuerKeyId` must agree with the envelope's authoritative `keyId` —
  // see `fedos_trust_subscription_entitlement_types.ts`'s field doc.
  if (payload.issuerKeyId !== envelope.keyId) {
    return { status: "KEY_ID_MISMATCH", detail: `${payload.issuerKeyId} !== ${envelope.keyId}` };
  }

  if (options.requiredScopes !== undefined) {
    for (const requiredScope of options.requiredScopes) {
      if (!payload.scopes.includes(requiredScope)) {
        return { status: "SCOPE_NOT_GRANTED", detail: requiredScope };
      }
    }
  }

  const clock = options.clock ?? defaultFedosTrustClock;
  const now = clock();
  if (payload.validFrom - now > FEDOS_TRUST_CLOCK_SKEW_TOLERANCE_SECONDS) {
    return { status: "NOT_YET_VALID", detail: "validFrom" };
  }
  if (now - payload.validUntil > FEDOS_TRUST_CLOCK_SKEW_TOLERANCE_SECONDS) {
    return { status: "EXPIRED", detail: "validUntil" };
  }

  return { status: "VALID", resolvedPublicKeyHex: envelopeResult.resolvedPublicKeyHex, payload };
}
