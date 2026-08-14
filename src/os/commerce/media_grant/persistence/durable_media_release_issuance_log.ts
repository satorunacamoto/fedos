/**
 * FedOS Commerce CROSS-PROCESS COMPLETION SYNC + BUYER RESTART CONTENT
 * RE-ACCESS + TRUTHFUL REPUTATION FINAL CLOSURE mega-arc (Coordinator) --
 * durable, append-only SELLER-side record of "I (the seller) genuinely
 * built and sent a real, verified release for this (orderId, mediaId,
 * buyerPubkey) triple." Closes Finding 1 of
 * `docs/commerce/SELLER-SIDE-COMPLETION-SYNC-INVARIANT-GAP.md`: the
 * seller's own inbound-order-sync completion re-check
 * (`applyInboundPrivateOrderSyncNonFatal()`,
 * `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`)
 * was consulting `DurableMediaReleaseContentCache` -- the BUYER's own
 * durable record of content IT decrypted and verified
 * (`./durable_media_release_content_cache.ts`) -- which a seller's own
 * process structurally can never have an entry in (a seller does not
 * receive/decrypt a release for its own product; only a buyer does). This
 * file gives the SELLER an analogous, but independently-owned and
 * independently-verified, durable predicate to check on ITS OWN process,
 * mirroring `./durable_media_release_content_cache.ts`'s own NDJSON-backend
 * discipline (independent log file, insert-only, deterministic replay,
 * fail-closed on corruption, no compaction/delete/rewrite) and its own
 * `(orderId, mediaId, buyerPubkey)` dedup/immutability key exactly.
 *
 * WHY A NEW FILE RATHER THAN JUST TRUSTING THE INBOUND SYNC: an
 * alternative fix considered and REJECTED (Coordinator security review,
 * same arc) was to simply skip the delivery-invariant re-check entirely
 * for a non-buyer receiver of an inbound "completed" sync, trusting the
 * buyer's own already-signature-verified sync event to the same degree
 * every other inbound sync claim already is. Rejected because a
 * compromised/modified BUYER CLIENT (using the buyer's own genuine private
 * key) could publish a signed "completed" event without ever having run
 * its own local delivery-invariant check first -- the sender-identity
 * check alone cannot catch this, since the signature genuinely is the
 * real buyer's. Blindly trusting the sync for non-buyer receivers would
 * therefore have reopened exactly the false-positive-completion hole
 * `evaluateDigitalContentDeliveryInvariantForOrderCompletion()`'s own
 * header already documents closing. This file instead gives the seller
 * genuinely NEW, LOCAL, independently-verified evidence -- no new
 * cross-party trust claim, no new protocol message, nothing durable is
 * requested from or granted to the counterparty.
 *
 * TRUST BASIS: a record is written ONLY once
 * `buildOutboundPrivateMediaReleaseResponse()`
 * (`../../events/commerce_private_media_release_apply.ts`) has already
 * returned `outcome: "released"` for this exact triple -- meaning, by that
 * point, the seller's own process has ALREADY independently verified (that
 * function's own header, steps 1-4): sender/order/media authorization, a
 * real ALLOW from `evaluateMediaAccessGrant()`, a content-identity/checksum
 * match between the actually-stored ciphertext and this product's own
 * declared `ProductMedia.checksum`, a genuine decryption of the stored
 * ciphertext, and a genuine re-wrap (`wrapMediaAccessGrantRelease()`) of
 * the released bytes for this exact buyer. This file records ONLY the fact
 * that the seller's OWN process produced that verified outcome -- it is
 * not, and must never be treated as, evidence that the buyer actually
 * received or decrypted anything (only the buyer's own
 * `DurableMediaReleaseContentCache` entry proves that; the two predicates
 * are deliberately never merged -- see `hasIssuedRelease()`'s own comment
 * below and `applyInboundPrivateOrderSyncNonFatal()`'s own comment for how
 * both are now used together, role-aware, at that one call site).
 *
 * NEVER stores content plaintext or ciphertext -- only the digest and
 * identifying metadata, matching `AppendOnlyMediaAccessGrantPersistence`'s
 * own "storage, not authority, and no bytes" scope. This file's own
 * durable record is itself likewise "storage, not authority" -- it is
 * consulted only as ONE input to
 * `evaluateDigitalContentDeliveryInvariantForOrderCompletion()`, never
 * treated as a completion decision by itself.
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

export interface MediaReleaseIssuanceRecord {
  readonly orderId: string;
  readonly mediaId: string;
  readonly buyerPubkey: string;
  readonly sellerPubkey: string;
  readonly grantVersion: number;
  /** SHA-256 hex digest of the exact bytes this seller's process genuinely released -- the same value `buildOutboundPrivateMediaReleaseResponse()` computes via `computeCommerceMediaContentHash()` immediately before wrapping. Never the content itself. */
  readonly contentDigest: string;
  readonly issuedAt: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isStructurallyWellFormedRecord(value: unknown): value is MediaReleaseIssuanceRecord {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!isNonEmptyString(c.orderId)) return false;
  if (!isNonEmptyString(c.mediaId)) return false;
  if (!isNonEmptyString(c.buyerPubkey)) return false;
  if (!isNonEmptyString(c.sellerPubkey)) return false;
  if (typeof c.grantVersion !== "number" || !Number.isInteger(c.grantVersion) || c.grantVersion <= 0) return false;
  if (typeof c.contentDigest !== "string" || !/^[0-9a-f]{64}$/.test(c.contentDigest)) return false;
  if (typeof c.issuedAt !== "number" || !Number.isInteger(c.issuedAt) || c.issuedAt < 0) return false;
  return true;
}

function recordStorageKey(record: Pick<MediaReleaseIssuanceRecord, "orderId" | "mediaId" | "buyerPubkey">): string {
  return JSON.stringify([record.orderId, record.mediaId, record.buyerPubkey]);
}

function recordsAreEqual(a: MediaReleaseIssuanceRecord, b: MediaReleaseIssuanceRecord): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * PRIVATE -- replays the append log into a deduplicated map, in original
 * append order. A parse failure, an off-schema line, or two DIFFERENT
 * records claiming the identical `(orderId, mediaId, buyerPubkey)` key
 * throws unconditionally -- fail-closed on corruption, exactly like every
 * sibling append-only backend in this codebase.
 */
function replayLog(filePath: string): MediaReleaseIssuanceRecord[] {
  const contents = readLogFile(filePath);
  const byKey = new Map<string, MediaReleaseIssuanceRecord>();
  const order: string[] = [];
  for (const rawLine of contents.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parsedJson = JSON.parse(line);
    if (!isStructurallyWellFormedRecord(parsedJson)) {
      throw new Error("DurableMediaReleaseIssuanceLog: corrupt or schema-invalid record found in log file.");
    }
    const key = recordStorageKey(parsedJson);
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, parsedJson);
      order.push(key);
    } else if (!recordsAreEqual(existing, parsedJson)) {
      throw new Error(`DurableMediaReleaseIssuanceLog: conflicting duplicate records for key "${key}" found in log file.`);
    }
  }
  return order.map((key) => byKey.get(key) as MediaReleaseIssuanceRecord);
}

export type MediaReleaseIssuanceLogWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface MediaReleaseIssuanceLog {
  recordIssuance(record: MediaReleaseIssuanceRecord): MediaReleaseIssuanceLogWriteResult;
  /** Role-aware evidence predicate for the SELLER's own process only -- see this file's own header for exactly what a `true` result does and does not prove. */
  hasIssuedRelease(orderId: string, mediaId: string, buyerPubkey: string): boolean;
}

export class DurableMediaReleaseIssuanceLog implements MediaReleaseIssuanceLog {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  recordIssuance(record: MediaReleaseIssuanceRecord): MediaReleaseIssuanceLogWriteResult {
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

  hasIssuedRelease(orderId: string, mediaId: string, buyerPubkey: string): boolean {
    const key = recordStorageKey({ orderId, mediaId, buyerPubkey });
    return replayLog(this.#filePath).some((r) => recordStorageKey(r) === key);
  }
}
