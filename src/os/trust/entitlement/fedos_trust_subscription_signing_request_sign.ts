/**
 * Trust — subject self-signs a `SubscriptionSigningRequest`.
 *
 * Reuses the shared envelope canonicalize+sign primitives directly (see
 * `../envelope/index.js`) rather than inventing a parallel signing path —
 * see `fedos_trust_subscription_signing_request_types.ts`'s header for why
 * this is a `FedosTrustSignedEnvelope<SubscriptionSigningRequest>` under a
 * dedicated `"fedos.subscription-request.v1"` domain rather than
 * `fedos.possession.v1`.
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
import { canonicalizeFedosTrustSubscriptionSigningRequestV1 } from "./fedos_trust_subscription_signing_request_canonical.js";
import type { SubscriptionSigningRequest } from "./fedos_trust_subscription_signing_request_types.js";

/**
 * Signs `payload` as a `fedos.subscription-request.v1` envelope using
 * `subjectKeypair`. `payload.subjectPublicKeyHex` MUST already equal
 * `subjectKeypair.publicKeyHex` — this is a self-attestation, never a
 * request signed on someone else's behalf, so `issuer`, `subject`, and
 * `keyId` are all set to the subject's own public key hex by construction.
 */
export function signFedosTrustSubscriptionSigningRequest(
  payload: SubscriptionSigningRequest,
  subjectKeypair: FedosTrustSigningKeypair,
  clock: FedosTrustClock = defaultFedosTrustClock,
): FedosTrustSignedEnvelope<SubscriptionSigningRequest> {
  if (payload.subjectPublicKeyHex !== subjectKeypair.publicKeyHex) {
    throw new RangeError(
      "fedos subscription signing request: payload.subjectPublicKeyHex must equal the signing keypair's own public key",
    );
  }

  const canonicalPayload = canonicalizeFedosTrustSubscriptionSigningRequestV1(payload);
  const unsigned: FedosTrustUnsignedEnvelope<SubscriptionSigningRequest> = {
    version: FEDOS_TRUST_ENVELOPE_VERSION_1,
    type: "fedos.subscription-request.v1",
    issuer: payload.subjectPublicKeyHex,
    subject: payload.subjectPublicKeyHex,
    issuedAt: clock(),
    payload,
    signatureAlgorithm: FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
    keyId: payload.subjectPublicKeyHex,
  };
  return signFedosTrustEnvelopeV1(unsigned, canonicalPayload, subjectKeypair);
}
