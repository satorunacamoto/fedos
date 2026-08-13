/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) — durable,
 * append-only BUYER-side storage for an already-obtained, already
 * digest-verified `MediaAccessGrant` release. Mirrors
 * `../media_access_grant_persistence.ts`'s own NDJSON-backend discipline
 * exactly (independent log file, insert-only, deterministic replay,
 * fail-closed on corruption, no compaction/delete/rewrite) — this arc's own
 * mandate item 6 ("Content access must survive a real restart... no
 * transient renderer-only state") is what this file exists to satisfy: once
 * `unwrapMediaAccessGrantRelease()` has produced plaintext bytes AND this
 * process has independently recomputed and matched
 * `PrivateMediaReleaseReleasedPayload.contentDigest` against them (never
 * stored before that check passes — see
 * `../media_access_grant_release_channel_policy.ts`'s own header for why a
 * corrupt/tampered release must never look like a successful one), the
 * buyer's own process durably records the plaintext HERE, so a restart
 * reads it back from disk rather than re-requesting it (though re-requesting
 * would also be safe — the release is idempotent per `(orderId, mediaId,
 * buyerPubkey)`, see below).
 *
 * WHY STORE THE DECRYPTED PLAINTEXT AT REST, UNENCRYPTED BY THIS FILE: once
 * a release genuinely reaches this buyer's own device through the
 * grant-gated channel, the buyer legitimately owns that plaintext copy —
 * exactly like a normal digital purchase download. Re-encrypting it with a
 * FedOS-internal key here would not add any real protection this arc's own
 * threat model cares about (full-disk/OS-level protection is a different
 * layer's responsibility, same posture already implicit in
 * `../../catalog/local_product_media_repository.ts`'s own in-memory,
 * unencrypted `Map`), and this arc's own crypto guardrail explicitly forbids
 * inventing any new encryption primitive to do it "properly" — see this
 * arc's own mandate preamble.
 *
 * DEDUP / IMMUTABILITY KEY: `(orderId, mediaId, buyerPubkey)`. Unlike
 * `MediaAccessGrantEnvelope` (which legitimately has many versions over
 * time), the underlying released CONTENT for one order/media/buyer triple
 * never has a reason to change — a second `putRelease()` call for the same
 * triple with byte-identical content is `"already-present"`; with DIFFERENT
 * content it is `"conflict"` (never silently overwritten — the caller
 * should treat that as a signal something upstream is wrong, e.g. the
 * seller re-issued different bytes under the same grant).
 */

import { readFileSync, appendFileSync } from "node:fs";

function isEnoent(err: unknown): boolean {
  return err !== null && typeof err === "object" && "code" in err && (err as { code?: unknown }).code === "ENOENT";
}

function readLogFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8") as string;
  } catch (err) {
    if (isEnoent(err)) return "";
    throw err;
  }
}

/** Bound on the base64-encoded content field — generous over the underlying `MAX_MEDIA_ACCESS_GRANT_RELEASE_PAYLOAD_BYTES = 65_536` plaintext cap (`../media_access_grant_key_release.ts`); base64 of that many bytes is ~87_382 chars, so this leaves real headroom without ever being a silent-truncation risk. */
export const MAX_MEDIA_RELEASE_CONTENT_CACHE_BASE64_CHARS = 100_000;

export interface MediaReleaseContentRecord {
  readonly orderId: string;
  readonly mediaId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly grantVersion: number;
  readonly contentType: string;
  /** SHA-256 hex digest the caller has ALREADY verified matches `contentBase64`'s decoded bytes — this file trusts, but does not itself recompute, that check (mirrors `AppendOnlyMediaAccessGrantPersistence`'s own "storage, not authority" scope). */
  readonly contentDigest: string;
  readonly contentBase64: string;
  readonly obtainedAt: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStructurallyWellFormedRecord(value: unknown): value is MediaReleaseContentRecord {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!isNonEmptyString(c.orderId)) return false;
  if (!isNonEmptyString(c.mediaId)) return false;
  if (!isNonEmptyString(c.buyerPubkey)) return false;
  if (!isNonEmptyString(c.sellerPubkey)) return false;
  if (typeof c.grantVersion !== "number" || !Number.isInteger(c.grantVersion) || c.grantVersion <= 0) return false;
  if (!isNonEmptyString(c.contentType)) return false;
  if (typeof c.contentDigest !== "string" || !/^[0-9a-f]{64}$/.test(c.contentDigest)) return false;
  if (typeof c.contentBase64 !== "string" || c.contentBase64.length === 0 || c.contentBase64.length > MAX_MEDIA_RELEASE_CONTENT_CACHE_BASE64_CHARS) {
    return false;
  }
  if (typeof c.obtainedAt !== "number" || !Number.isInteger(c.obtainedAt) || c.obtainedAt < 0) return false;
  return true;
}

function recordStorageKey(record: Pick<MediaReleaseContentRecord, "orderId" | "mediaId" | "buyerPubkey">): string {
  return JSON.stringify([record.orderId, record.mediaId, record.buyerPubkey]);
}

function recordsAreEqual(a: MediaReleaseContentRecord, b: MediaReleaseContentRecord): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * PRIVATE — replays the append log into a deduplicated map, in original
 * append order. A parse failure, an off-schema line, or two DIFFERENT
 * records claiming the identical `(orderId, mediaId, buyerPubkey)` key
 * throws unconditionally — fail-closed on corruption, exactly like every
 * sibling append-only backend in this codebase.
 */
function replayLog(filePath: string): MediaReleaseContentRecord[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, MediaReleaseContentRecord>();
  const order: string[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (!isStructurallyWellFormedRecord(parsedJson)) {
      throw new Error("DurableMediaReleaseContentCache: corrupt or schema-invalid record found in log file.");
    }
    const key = recordStorageKey(parsedJson);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsedJson);
      order.push(key);
    } else if (!recordsAreEqual(existing, parsedJson)) {
      throw new Error(`DurableMediaReleaseContentCache: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return order.map((key) => byKey.get(key) as MediaReleaseContentRecord);
}

export type MediaReleaseContentCacheWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface MediaReleaseContentCache {
  putRelease(record: MediaReleaseContentRecord): MediaReleaseContentCacheWriteResult;
  getRelease(orderId: string, mediaId: string, buyerPubkey: string): MediaReleaseContentRecord | undefined;
  hasRelease(orderId: string, mediaId: string, buyerPubkey: string): boolean;
}

export class DurableMediaReleaseContentCache implements MediaReleaseContentCache {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  putRelease(record: MediaReleaseContentRecord): MediaReleaseContentCacheWriteResult {
    if (!isStructurallyWellFormedRecord(record)) return "failed";
    const key = recordStorageKey(record);
    const existing = replayLog(this.#filePath).find((r) => recordStorageKey(r) === key);
    if (existing !== undefined) {
      return recordsAreEqual(existing, record) ? "already-present" : "conflict";
    }
    try {
      appendFileSync(this.#filePath, JSON.stringify(record) + "\n", "utf8");
    } catch {
      return "failed";
    }
    return "inserted";
  }

  getRelease(orderId: string, mediaId: string, buyerPubkey: string): MediaReleaseContentRecord | undefined {
    const key = recordStorageKey({ orderId, mediaId, buyerPubkey });
    return replayLog(this.#filePath).find((r) => recordStorageKey(r) === key);
  }

  hasRelease(orderId: string, mediaId: string, buyerPubkey: string): boolean {
    return this.getRelease(orderId, mediaId, buyerPubkey) !== undefined;
  }
}
