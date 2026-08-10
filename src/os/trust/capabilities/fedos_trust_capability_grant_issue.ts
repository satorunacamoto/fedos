/**
 * Trust — build + sign a `fedos.capability.v1` CapabilityGrant envelope.
 */

import {
  FEDOS_TRUST_ENVELOPE_VERSION_1,
  FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
  defaultFedosTrustClock,
  signFedosTrustEnvelopeV1,
  type FedosTrustClock,
  type FedosTrustSignedEnvelope,
  type FedosTrustSigningKeypair,
  type FedosTrustUnsignedEnvelope,
} from "../envelope/index.js";
import { canonicalizeFedosTrustCapabilityGrantPayloadV1 } from "./fedos_trust_capability_grant_canonical.js";
import type { FedosTrustCapabilityGrantPayload } from "./fedos_trust_capability_grant_types.js";

export interface IssueFedosTrustCapabilityGrantV1Params {
  readonly issuer: string;
  readonly keyId: string;
  readonly subject?: string;
  readonly audience?: string;
  /** Unix seconds. Omit for a non-expiring grant. */
  readonly expiresAt?: number;
  readonly nonce?: string;
  readonly payload: FedosTrustCapabilityGrantPayload;
  readonly keypair: FedosTrustSigningKeypair;
  readonly clock?: FedosTrustClock;
}

export function issueFedosTrustCapabilityGrantV1(
  params: IssueFedosTrustCapabilityGrantV1Params,
): FedosTrustSignedEnvelope<FedosTrustCapabilityGrantPayload> {
  const clock = params.clock ?? defaultFedosTrustClock;
  const canonicalPayload = canonicalizeFedosTrustCapabilityGrantPayloadV1(params.payload);

  const unsigned: FedosTrustUnsignedEnvelope<FedosTrustCapabilityGrantPayload> = {
    version: FEDOS_TRUST_ENVELOPE_VERSION_1,
    type: "fedos.capability.v1",
    issuer: params.issuer,
    subject: params.subject,
    audience: params.audience,
    issuedAt: clock(),
    expiresAt: params.expiresAt,
    nonce: params.nonce,
    payload: params.payload,
    signatureAlgorithm: FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
    keyId: params.keyId,
  };

  return signFedosTrustEnvelopeV1(unsigned, canonicalPayload, params.keypair);
}
