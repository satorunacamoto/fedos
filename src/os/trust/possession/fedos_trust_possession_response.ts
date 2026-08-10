/**
 * Trust — sign a Proof of Possession response.
 *
 * The response payload is deliberately empty: everything that needs to be
 * proven (which challenge, for which audience, with which nonce, valid
 * until when) already lives in the generic envelope's own
 * `type`/`audience`/`nonce`/`expiresAt` fields (see
 * `../envelope/fedos_trust_envelope_types.ts`), which is exactly why those
 * fields exist on the shared envelope shape rather than being reinvented
 * per-domain. Domain separation itself comes from `type:
 * "fedos.possession.v1"` being a signed field of the canonical envelope
 * bytes.
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
import type { FedosTrustPossessionChallenge } from "./fedos_trust_possession_challenge.js";

/** Always an empty object — see this file's header for why. Kept as a named
 * type (rather than inlined `Record<string, never>` at every call site) so
 * `fedos_trust_possession_verify.ts` can reference the same shape. */
export type FedosTrustPossessionResponsePayload = Record<string, never>;

/** The canonical bytes of the (always-empty) possession response payload.
 * Exported so `fedos_trust_possession_verify.ts` computes the exact same
 * bytes the signer computed — never re-derives its own notion of "empty".
 * Rejects a payload carrying ANY key: an envelope whose `payload` has been
 * tampered to smuggle extra fields must fail canonicalization (and
 * therefore fail as `invalid-payload-shape` at verify time) rather than
 * silently canonicalizing to `"{}"` and letting the smuggled data ride along
 * unverified. */
export function canonicalizeFedosTrustPossessionResponsePayloadV1(
  payload: FedosTrustPossessionResponsePayload,
): string {
  if (typeof payload !== "object" || payload === null || Object.keys(payload).length > 0) {
    throw new RangeError("fedos trust possession response: payload must be an empty object");
  }
  return "{}";
}

export interface CreateFedosTrustPossessionResponseV1Params {
  readonly challenge: FedosTrustPossessionChallenge;
  /** Identifies which of the subject's own keys `keypair` corresponds to
   * under a verifier's `FedosTrustPolicy` — a proof-of-possession response
   * is self-issued (`issuer`/`subject` are both set to
   * `keypair.publicKeyHex`), so a verifier's policy must trust
   * `(keypair.publicKeyHex, keyId)` directly. */
  readonly keyId: string;
  readonly keypair: FedosTrustSigningKeypair;
  readonly clock?: FedosTrustClock;
}

/**
 * Signs `challenge` into a full `fedos.possession.v1` envelope. Sets
 * `issuer`/`subject` to `keypair.publicKeyHex` (proof of possession is
 * inherently self-issued — there is no separate third-party issuer),
 * `nonce`/`audience` to the challenge's own (so a verifier can compare
 * without decoding the payload), and `expiresAt` to the challenge's own
 * expiry (a response is never valid past the challenge that produced it).
 */
export function createFedosTrustPossessionResponseV1(
  params: CreateFedosTrustPossessionResponseV1Params,
): FedosTrustSignedEnvelope<FedosTrustPossessionResponsePayload> {
  const clock = params.clock ?? defaultFedosTrustClock;
  const payload: FedosTrustPossessionResponsePayload = {};
  const canonicalPayload = canonicalizeFedosTrustPossessionResponsePayloadV1(payload);

  const unsigned: FedosTrustUnsignedEnvelope<FedosTrustPossessionResponsePayload> = {
    version: FEDOS_TRUST_ENVELOPE_VERSION_1,
    type: "fedos.possession.v1",
    issuer: params.keypair.publicKeyHex,
    subject: params.keypair.publicKeyHex,
    audience: params.challenge.audience,
    issuedAt: clock(),
    expiresAt: params.challenge.expiresAt,
    nonce: params.challenge.nonce,
    payload,
    signatureAlgorithm: FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
    keyId: params.keyId,
  };

  return signFedosTrustEnvelopeV1(unsigned, canonicalPayload, params.keypair);
}
