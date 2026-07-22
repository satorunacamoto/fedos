/**
 * Secure Runtime Alpha 5721–5800 — the default peer-capability nonce
 * generator. Mirrors `../fedos_direct_ratchet_session_reset_nonce.ts`
 * exactly: 16 bytes (128 bits) of the same reviewed CSPRNG, hex-encoded.
 * Shared by both the Advertisement and the Lifecycle Notification schemas
 * (each embeds its own record-kind string in its signed content, so a
 * nonce collision across the two record types cannot be confused for a
 * replay of the other).
 */
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";

export function generateFedosRatchetPeerCapabilityNonce(): string {
  return bytesToHex(randomBytes(16));
}

export const FEDOS_RATCHET_PEER_CAPABILITY_NONCE_HEX_PATTERN = /^[0-9a-f]{32}$/;

export function isWellFormedFedosRatchetPeerCapabilityNonce(value: unknown): value is string {
  return typeof value === "string" && FEDOS_RATCHET_PEER_CAPABILITY_NONCE_HEX_PATTERN.test(value);
}
