/**
 * FedOS Peer Device Discovery Arc — nonce and device-identifier generators.
 * Mirrors `../ratchet/peer_capability/fedos_ratchet_peer_capability_nonce.ts`
 * exactly for the nonce (16 bytes / 128 bits CSPRNG, hex-encoded), plus a
 * SEPARATE generator for `deviceId` — closing the privacy gap Agent X
 * flagged (`docs/reviews/fedos-peer-device-discovery-current/04_THREAT_MODEL_AND_PRIVACY.md`
 * §2.3 item 1): `peer_capability`'s own `deviceRef` fields are unconstrained,
 * 512-char free-form strings, opaque only by caller convention. This
 * protocol's `deviceId` is instead codec-ENFORCED to be exactly this fixed,
 * random, 32-hex-char shape — never a human-meaningful label, never a
 * hostname/model string — so the codec itself, not caller discipline,
 * prevents fingerprint-shaped identifiers from ever validating.
 */
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";

export function generateFedosPeerDeviceAnnouncementNonce(): string {
  return bytesToHex(randomBytes(16));
}

export const FEDOS_PEER_DEVICE_ANNOUNCEMENT_NONCE_HEX_PATTERN = /^[0-9a-f]{32}$/;

export function isWellFormedFedosPeerDeviceAnnouncementNonce(value: unknown): value is string {
  return typeof value === "string" && FEDOS_PEER_DEVICE_ANNOUNCEMENT_NONCE_HEX_PATTERN.test(value);
}

/**
 * A fresh, protocol-scoped device identifier — independent randomness from
 * the nonce generator above (a distinct call, never derived from a nonce).
 * Callers should generate this ONCE per physical device and durably store
 * it locally (alongside the local device's own protocol-level state) so it
 * remains STABLE across every announcement this device ever issues and
 * across restarts — a NEW `deviceId` looks like a genuinely different
 * device to every peer (see `07_MULTI_DEVICE_AND_CONFLICT_MODEL.md`).
 */
export function generateFedosPeerDeviceAnnouncementDeviceId(): string {
  return bytesToHex(randomBytes(16));
}

export const FEDOS_PEER_DEVICE_ANNOUNCEMENT_DEVICE_ID_HEX_PATTERN = /^[0-9a-f]{32}$/;

/** Codec-enforced shape check — the structural gate that makes opacity a codec guarantee, not a caller convention (Agent X §2.3 item 1). */
export function isWellFormedFedosPeerDeviceAnnouncementDeviceId(value: unknown): value is string {
  return typeof value === "string" && FEDOS_PEER_DEVICE_ANNOUNCEMENT_DEVICE_ID_HEX_PATTERN.test(value);
}
