/**
 * Stage 8 — real NIP-01 signature verification (BIP-340 Schnorr over secp256k1).
 *
 * Implements `SignatureVerifier` using @noble/curves + @noble/hashes. This is a
 * SEPARATE concern from `verifyEventId`: here we recompute the id from the event
 * body AND check that `sig` is a valid Schnorr signature of that id under the
 * author's x-only `pubkey`. Verification only proves the event is authentic and
 * untampered — it is not a claim that the content is true or safe.
 *
 * This module verifies only; it never signs. No private keys are involved.
 */

import { schnorr } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { serializeForId } from "./event.js";
import type { NostrEvent } from "./types.js";
import type { SignatureVerifier } from "./signature.js";

const LOWER_HEX = /^[0-9a-f]+$/;

/** True if `value` is exactly `length` bytes of lowercase hex. */
export function isValidHex(value: string, length: number): boolean {
  return (
    typeof value === "string" &&
    value.length === length * 2 &&
    LOWER_HEX.test(value)
  );
}

/**
 * Verifies a Nostr event's Schnorr signature.
 *
 * Steps: validate hex shapes → recompute id = sha256(serializeForId(event)) and
 * require it to equal `event.id` → check schnorr.verify(sig, id, pubkey).
 * Never throws: any malformed input or internal error resolves to `false`.
 */
export const NobleSignatureVerifier: SignatureVerifier = {
  async verify(event: NostrEvent): Promise<boolean> {
    try {
      // id and pubkey are 32 bytes; a Schnorr signature is 64 bytes.
      if (!isValidHex(event.id, 32)) return false;
      if (!isValidHex(event.pubkey, 32)) return false;
      if (!isValidHex(event.sig, 64)) return false;

      const digest = sha256(new TextEncoder().encode(serializeForId(event)));
      if (bytesToHex(digest) !== event.id) return false;

      // noble v2 takes Uint8Array; `digest` is the 32-byte message (== id).
      return schnorr.verify(hexToBytes(event.sig), digest, hexToBytes(event.pubkey));
    } catch {
      return false;
    }
  },
};
