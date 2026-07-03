/**
 * Stage 107 — pure policy for the storage backend boundary.
 *
 * All functions are pure: they inspect a `StoragePacket` and return a
 * decision, never mutate the input, perform I/O, or store/send anything.
 * Enforces the boundary's ONE hard content rule: a packet carries only
 * OPAQUE, non-sensitive labels — never a secret/key/seed/token/payment/
 * entitlement/dm/body/content/message value or key name, and its `idRef`
 * must be an opaque label, never a URL or file path (which would smuggle in
 * a real Google Drive location or similar).
 */

import type { StorageDecision, StoragePacket } from "./types.js";

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Deliberately the exact set this boundary must never carry: a secret,
 * key, seed, token, payment/entitlement reference, or any DM/message
 * body/content.
 */
const SENSITIVE_MARKERS: readonly string[] = [
  "secret",
  "key",
  "seed",
  "token",
  "payment",
  "entitlement",
  "dm",
  "body",
  "content",
  "message",
];

/** True if a metadata key names a sensitive field (matched with non-alphanumerics stripped). */
function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive content. */
export function isSensitiveStorageValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

/** True if any metadata entry looks like a secret/key/seed/token/payment/dm/body/content/message field. */
function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveStorageValue(value)) return true;
  }
  return false;
}

/**
 * True if a label looks like a URL or filesystem path rather than an opaque
 * backend-resolved reference (e.g. a Google Drive share link or a local
 * path) — this boundary never carries one.
 */
export function looksLikeUrlOrPath(ref: string): boolean {
  if (typeof ref !== "string" || ref.length === 0) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(ref)) return true; // e.g. "https://", "ftp://"
  if (ref.startsWith("/") || ref.startsWith("\\")) return true; // absolute *nix/UNC path
  if (/^[a-z]:[\\/]/i.test(ref)) return true; // e.g. "C:\..." / "C:/..."
  if (ref.includes("drive.google.com") || ref.includes("docs.google.com")) return true;
  return false;
}

function deny(reason: string): StorageDecision {
  return { allowed: false, state: "rejected", reason };
}

/**
 * Decide whether a packet may be handed to a (placeholder) backend. Denies
 * (never throws) when `idRef` looks like a URL/file path, or when any
 * metadata key/value looks sensitive. A clean packet is `accepted_placeholder`
 * — a PLACEHOLDER acceptance that still stores nothing.
 */
export function reviewStoragePacket(packet: StoragePacket): StorageDecision {
  if (packet.idRef !== undefined && looksLikeUrlOrPath(packet.idRef)) {
    return deny("idRef must be an opaque label, not a URL or file path");
  }
  if (hasSensitiveMetadata(packet.metadata)) {
    return deny("packet metadata contains a sensitive key or value");
  }
  return {
    allowed: true,
    state: "accepted_placeholder",
    reason: "packet carries only non-sensitive, opaque storage metadata",
  };
}
