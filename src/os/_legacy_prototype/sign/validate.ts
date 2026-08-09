/**
 * Stage 10 — validation of signer output.
 *
 * Structural checks only: confirm a value has the shape of a signed NIP-01 event
 * (well-formed id/pubkey/sig hex, etc.) and that its pubkey matches the signer.
 * This does NOT verify the Schnorr signature — that is the `SignatureVerifier`'s
 * job (Stage 8) and can be run separately on the returned event.
 */

import { isValidHex } from "../../messenger/adapters/nostr/protocol/noble_signature.js";
import type { SignedNostrEvent } from "./types.js";

function isHexOfBytes(value: unknown, byteLength: number): boolean {
  return typeof value === "string" && isValidHex(value, byteLength);
}

function isStringTagArray(value: unknown): value is string[][] {
  return (
    Array.isArray(value) &&
    value.every(
      (tag) => Array.isArray(tag) && tag.every((t) => typeof t === "string"),
    )
  );
}

/** Type guard: `value` structurally looks like a signed NIP-01 event. */
export function isSignedEventLike(value: unknown): value is SignedNostrEvent {
  if (value === null || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    isHexOfBytes(e["id"], 32) &&
    isHexOfBytes(e["pubkey"], 32) &&
    typeof e["created_at"] === "number" &&
    Number.isInteger(e["created_at"]) &&
    e["created_at"] >= 0 &&
    typeof e["kind"] === "number" &&
    Number.isInteger(e["kind"]) &&
    e["kind"] >= 0 &&
    isStringTagArray(e["tags"]) &&
    typeof e["content"] === "string" &&
    isHexOfBytes(e["sig"], 64)
  );
}

/** True if the event's author pubkey equals the expected signer pubkey. */
export function assertSignerPubkeyMatches(
  event: SignedNostrEvent,
  pubkey: string,
): boolean {
  return event.pubkey === pubkey;
}
