/**
 * Trust — sign an unsigned envelope.
 */

import { bytesToHex } from "@noble/hashes/utils.js";
import { canonicalBytesForFedosTrustEnvelopeV1 } from "./fedos_trust_canonical_bytes.js";
import type { FedosTrustSignedEnvelope, FedosTrustUnsignedEnvelope } from "./fedos_trust_envelope_types.js";
import type { FedosTrustSigningKeypair } from "./fedos_trust_signing_keypair.js";

/**
 * Signs `unsigned` with `keypair`, using `canonicalPayload` (produced by the
 * caller's own domain-specific payload canonicalizer — see
 * `fedos_trust_canonical_bytes.ts`'s header) as the payload's byte
 * representation. `unsigned.keyId` should already equal
 * `keypair.publicKeyHex` (or a rotation-mapped identifier a verifier's
 * `FedosTrustPolicy` will resolve back to `keypair.publicKeyHex`) — this
 * function does not enforce that relationship itself, since a
 * caller-controlled `TrustPolicy` is exactly what makes key-id-to-key
 * mapping swappable (arc brief §54).
 */
export function signFedosTrustEnvelopeV1<TPayload>(
  unsigned: FedosTrustUnsignedEnvelope<TPayload>,
  canonicalPayload: string,
  keypair: FedosTrustSigningKeypair,
): FedosTrustSignedEnvelope<TPayload> {
  const bytes = canonicalBytesForFedosTrustEnvelopeV1(unsigned, canonicalPayload);
  const signature = bytesToHex(keypair.signBytes(bytes));
  return { ...unsigned, signature };
}
