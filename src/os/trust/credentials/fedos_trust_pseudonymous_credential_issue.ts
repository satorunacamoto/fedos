/**
 * Trust — build + sign a `fedos.credential.v1` PseudonymousIdentityCredential
 * envelope.
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
import { canonicalizeFedosTrustPseudonymousCredentialPayloadV1 } from "./fedos_trust_pseudonymous_credential_canonical.js";
import type { FedosTrustPseudonymousCredentialPayload } from "./fedos_trust_pseudonymous_credential_types.js";

export interface IssueFedosTrustPseudonymousCredentialV1Params {
  /** Opaque issuer identifier — see `../envelope/fedos_trust_envelope_types.ts`'s
   * `issuer` field doc. `"self"` is a valid, ordinary issuer id for a
   * subject self-signing their own credential (arc brief §17). */
  readonly issuer: string;
  /** Identifies which of `issuer`'s keys `keypair` corresponds to under the
   * verifier's `FedosTrustPolicy`. */
  readonly keyId: string;
  readonly subject?: string;
  readonly audience?: string;
  /** Unix seconds. Omit for a non-expiring credential. */
  readonly expiresAt?: number;
  readonly nonce?: string;
  readonly payload: FedosTrustPseudonymousCredentialPayload;
  readonly keypair: FedosTrustSigningKeypair;
  readonly clock?: FedosTrustClock;
}

/**
 * Builds and signs a `fedos.credential.v1` envelope. Does not itself verify
 * `keypair.publicKeyHex` matches `payload.subjectPublicKeyHex` — an issuer is
 * free to certify a subject key different from its own signing key (that is
 * the entire point of an issuer-signed credential, as opposed to a
 * self-signed one where a caller would naturally set both to the same key).
 */
export function issueFedosTrustPseudonymousCredentialV1(
  params: IssueFedosTrustPseudonymousCredentialV1Params,
): FedosTrustSignedEnvelope<FedosTrustPseudonymousCredentialPayload> {
  const clock = params.clock ?? defaultFedosTrustClock;
  const canonicalPayload = canonicalizeFedosTrustPseudonymousCredentialPayloadV1(params.payload);

  const unsigned: FedosTrustUnsignedEnvelope<FedosTrustPseudonymousCredentialPayload> = {
    version: FEDOS_TRUST_ENVELOPE_VERSION_1,
    type: "fedos.credential.v1",
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
