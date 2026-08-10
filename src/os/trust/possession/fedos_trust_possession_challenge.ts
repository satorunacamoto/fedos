/**
 * Trust — Proof of Possession challenge.
 *
 * A verifier calls `createFedosTrustPossessionChallenge()` locally and hands
 * the result to a subject (out of band — QR, deep link, direct call; this
 * module does no transport). The subject signs it back as a
 * `fedos.possession.v1` `FedosTrustSignedEnvelope` (see
 * `fedos_trust_possession_response.ts`), and the verifier checks the
 * response against the SAME challenge object it created (see
 * `fedos_trust_possession_verify.ts`).
 *
 * The nonce is REQUIRED for this domain (never optional, unlike the generic
 * envelope's own `nonce` field) — proof of possession without a fresh,
 * per-challenge nonce is not proof of anything but a still-valid old
 * signature. Generated via `@noble/hashes/utils.js`'s `randomBytes()`, this
 * repository's own established CSPRNG convention for id/nonce generation
 * (see `src/os/messenger/device/crypto/fedos_device_signing_keypair.ts`'s
 * header) — never `Math.random()`.
 */

import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import { FEDOS_TRUST_MAX_FIELD_STRING_LENGTH } from "../fedos_trust_limits.js";
import type { FedosTrustClock } from "../envelope/index.js";

/** Domain-separation literal, matching `FedosTrustEnvelopeType`'s
 * `"fedos.possession.v1"` — kept as its own narrow literal type here (rather
 * than importing `FedosTrustEnvelopeType`) since a challenge is not itself
 * an envelope. */
export const FEDOS_TRUST_POSSESSION_CHALLENGE_TYPE_V1 = "fedos.possession.v1" as const;

/** An unsigned, locally-created challenge — "envelope-shaped" in that it
 * carries the same `type`/`audience`/`nonce`/`issuedAt`/`expiresAt` fields a
 * `fedos.possession.v1` envelope will carry, but it is never itself signed
 * or transmitted as a `FedosTrustSignedEnvelope`. */
export interface FedosTrustPossessionChallenge {
  readonly type: typeof FEDOS_TRUST_POSSESSION_CHALLENGE_TYPE_V1;
  /** Who/what this proof is being produced for — e.g. a verifier's own
   * identifier, a session id, a resource URI. Compared byte-for-byte against
   * the response envelope's `audience` at verify time. */
  readonly audience: string;
  /** Hex-encoded random nonce — the replay-defense anchor. */
  readonly nonce: string;
  /** Unix seconds — when this challenge was created. */
  readonly issuedAt: number;
  /** Unix seconds — this challenge (and any response to it) is no longer
   * valid after this instant. */
  readonly expiresAt: number;
}

/**
 * Creates a fresh possession challenge. `ttlSeconds` must be a positive
 * integer — there is no "non-expiring challenge" (a possession challenge
 * that never expires defeats its own freshness purpose).
 */
export function createFedosTrustPossessionChallenge(
  audience: string,
  clock: FedosTrustClock,
  ttlSeconds: number,
): FedosTrustPossessionChallenge {
  if (typeof audience !== "string" || audience.length === 0) {
    throw new RangeError("fedos trust possession challenge: audience must be a non-empty string");
  }
  if (audience.length > FEDOS_TRUST_MAX_FIELD_STRING_LENGTH) {
    throw new RangeError("fedos trust possession challenge: audience exceeds max length");
  }
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError("fedos trust possession challenge: ttlSeconds must be a positive integer");
  }
  const issuedAt = clock();
  return {
    type: FEDOS_TRUST_POSSESSION_CHALLENGE_TYPE_V1,
    audience,
    nonce: bytesToHex(randomBytes(32)),
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
  };
}
