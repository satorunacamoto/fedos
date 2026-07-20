/**
 * Secure Runtime Alpha 3481–3560 ("Encrypted Device-to-Device Local
 * Transfer") — the canonical Transfer Challenge.
 *
 * Mirrors `../binding_challenge/fedos_device_binding_challenge.ts`'s own
 * "one canonical, versioned, domain-bound payload both signatures cover"
 * design exactly, applied to a Transfer between two ALREADY-trusted
 * Devices of the SAME account rather than to registration itself. Minted
 * by the RESPONDER (the device receiving the transfer) once it has seen a
 * `FedosDeviceTransferInvitationV1` (`./fedos_device_transfer_invitation.ts`)
 * — `initiatorDevicePublicKeyHex` is looked up ONCE, live, from the
 * Registry at mint time and embedded directly in the challenge (the SAME
 * "self-contained, no further registry dependency for the signer" design
 * `FedosDeviceBindingChallengeV1.devicePublicKeyHex` already uses), and is
 * independently RE-VERIFIED against the LIVE Registry again at Approval
 * time (`fedos_device_transfer_coordinator.ts`) — never trusted as a
 * frozen snapshot beyond that point.
 *
 * `domain` is a fixed constant, distinct from
 * `FEDOS_DEVICE_BINDING_DOMAIN_V1` — a Transfer Challenge can never be
 * confused with, or replayed as, a Device Binding Challenge, even though
 * both are signed with the same `FedosDeviceSigningKeypair` machinery.
 */

import { randomBytes as nobleRandomBytes, bytesToHex } from "@noble/hashes/utils.js";

export const FEDOS_DEVICE_TRANSFER_DOMAIN_V1 = "fedos:device-transfer:v1";

const NOSTR_PUBLIC_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;
const NONCE_HEX_PATTERN = /^[0-9a-f]{32,64}$/;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/;

export interface FedosDeviceTransferChallengeV1 {
  readonly schemaVersion: 1;
  /** Fixed domain separator — MUST equal `FEDOS_DEVICE_TRANSFER_DOMAIN_V1`. */
  readonly domain: string;
  readonly sessionId: string;
  readonly initiatorDeviceId: string;
  /** The initiator Device's public key, looked up live from the Registry at mint time — 64-char lowercase hex. */
  readonly initiatorDevicePublicKeyHex: string;
  /** Unix seconds. */
  readonly issuedAt: number;
  /** Unix seconds; MUST be strictly greater than `issuedAt`. */
  readonly expiresAt: number;
  /** Unique per challenge. 32-64 lowercase hex chars. */
  readonly nonce: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Structural + field-shape validation only — does NOT check signatures, expiry, or the LIVE Registry. Fails closed; never throws. */
export function isWellFormedFedosDeviceTransferChallengeV1(candidate: unknown): candidate is FedosDeviceTransferChallengeV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length !== 8) return false;
  if (value.schemaVersion !== 1) return false;
  if (value.domain !== FEDOS_DEVICE_TRANSFER_DOMAIN_V1) return false;
  if (!isNonEmptyString(value.sessionId) || !SESSION_ID_PATTERN.test(value.sessionId)) return false;
  if (!isNonEmptyString(value.initiatorDeviceId) || !DEVICE_ID_PATTERN.test(value.initiatorDeviceId)) return false;
  if (typeof value.initiatorDevicePublicKeyHex !== "string" || !NOSTR_PUBLIC_KEY_HEX_PATTERN.test(value.initiatorDevicePublicKeyHex)) return false;
  if (!isValidUnixSeconds(value.issuedAt)) return false;
  if (!isValidUnixSeconds(value.expiresAt) || (value.expiresAt as number) <= (value.issuedAt as number)) return false;
  if (typeof value.nonce !== "string" || !NONCE_HEX_PATTERN.test(value.nonce)) return false;
  return true;
}

/** Deterministic, unambiguous canonical serialization — the exact preimage both the Proof and the Approval hash. A fixed-order array tuple, mirroring `serializeFedosDeviceBindingChallengeV1`'s own convention. */
export function serializeFedosDeviceTransferChallengeV1(challenge: FedosDeviceTransferChallengeV1): string {
  return JSON.stringify([
    challenge.domain,
    challenge.schemaVersion,
    challenge.sessionId,
    challenge.initiatorDeviceId,
    challenge.initiatorDevicePublicKeyHex,
    challenge.issuedAt,
    challenge.expiresAt,
    challenge.nonce,
  ]);
}

export function isFedosDeviceTransferChallengeExpired(challenge: FedosDeviceTransferChallengeV1, now: number): boolean {
  return now > challenge.expiresAt;
}

/** Mints a fresh, opaque nonce suitable for `FedosDeviceTransferChallengeV1.nonce`. Mirrors `FedosDeviceBindingChallengeNonceGenerator`'s own pure-interface shape. */
export interface FedosDeviceTransferChallengeNonceGenerator {
  generateNonce(): string;
}

/** The default generator: 16 bytes (128 bits) of `@noble/hashes/utils.js`'s own `randomBytes()`, hex-encoded — the SAME margin `FedosSecureRandomDeviceBindingChallengeNonceGenerator` already uses. */
export class FedosSecureRandomDeviceTransferChallengeNonceGenerator implements FedosDeviceTransferChallengeNonceGenerator {
  generateNonce(): string {
    return bytesToHex(nobleRandomBytes(16));
  }
}
