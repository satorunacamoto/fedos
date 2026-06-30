/**
 * Pure NIP-01 event helpers: structural validation and id computation.
 *
 * Signature verification (schnorr/secp256k1) is intentionally NOT implemented
 * here. Stage 1 is read-only ingest; we verify the event *id* (a sha256 of the
 * canonical serialization) but treat signature checking as a later, swappable
 * adapter so we don't pull a crypto dependency in prematurely.
 */

import type { EventCore, NostrEvent } from "./types.js";
import { constantTimeHexEqual, type Sha256Hex } from "./crypto.js";

const HEX_64 = /^[0-9a-f]{64}$/;
const HEX_128 = /^[0-9a-f]{128}$/;

/** A single problem found while validating an unknown value. */
export interface StructureIssue {
  readonly field: string;
  readonly reason: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringArrayArray(v: unknown): v is string[][] {
  return (
    Array.isArray(v) &&
    v.every(
      (tag) => Array.isArray(tag) && tag.every((t) => typeof t === "string"),
    )
  );
}

/**
 * Validates that an unknown value has the shape of a NIP-01 event.
 * Returns an empty array when valid; otherwise a list of issues.
 * This is purely structural — it does NOT check the id hash or signature.
 */
export function validateEventStructure(value: unknown): StructureIssue[] {
  const issues: StructureIssue[] = [];
  if (!isRecord(value)) {
    return [{ field: "<root>", reason: "not an object" }];
  }

  const { id, pubkey, created_at, kind, tags, content, sig } = value;

  if (typeof id !== "string" || !HEX_64.test(id)) {
    issues.push({ field: "id", reason: "expected 64-char lowercase hex" });
  }
  if (typeof pubkey !== "string" || !HEX_64.test(pubkey)) {
    issues.push({ field: "pubkey", reason: "expected 64-char lowercase hex" });
  }
  if (typeof created_at !== "number" || !Number.isInteger(created_at) || created_at < 0) {
    issues.push({ field: "created_at", reason: "expected non-negative integer" });
  }
  if (typeof kind !== "number" || !Number.isInteger(kind) || kind < 0) {
    issues.push({ field: "kind", reason: "expected non-negative integer" });
  }
  if (!isStringArrayArray(tags)) {
    issues.push({ field: "tags", reason: "expected array of string arrays" });
  }
  if (typeof content !== "string") {
    issues.push({ field: "content", reason: "expected string" });
  }
  if (typeof sig !== "string" || !HEX_128.test(sig)) {
    issues.push({ field: "sig", reason: "expected 128-char lowercase hex" });
  }

  return issues;
}

/** Type guard: structurally a NIP-01 event (no hash/sig verification). */
export function isNostrEvent(value: unknown): value is NostrEvent {
  return validateEventStructure(value).length === 0;
}

/**
 * Canonical NIP-01 serialization used as the sha256 pre-image for the id:
 *   [0, pubkey, created_at, kind, tags, content]
 *
 * `JSON.stringify` produces the compact, no-whitespace form NIP-01 requires.
 * Its escaping of \n \" \\ \r \t \b \f and control chars as \uXXXX matches the
 * spec for the common cases. (Edge cases around exotic escaping can be
 * hardened in Stage 8 if we ever compute ids for outbound events.)
 */
export function serializeForId(event: EventCore): string {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

/** Computes the NIP-01 event id using an injected hasher. */
export async function computeEventId(
  event: EventCore,
  sha256hex: Sha256Hex,
): Promise<string> {
  return sha256hex(serializeForId(event));
}

/**
 * Verifies that `event.id` matches the sha256 of its canonical serialization.
 * This proves the id is self-consistent; it does NOT prove authorship —
 * that requires signature verification (a later adapter).
 */
export async function verifyEventId(
  event: NostrEvent,
  sha256hex: Sha256Hex,
): Promise<boolean> {
  const computed = await computeEventId(event, sha256hex);
  return constantTimeHexEqual(computed, event.id);
}
