import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DurableMediaReleaseIssuanceLog,
  type MediaReleaseIssuanceRecord,
} from "../src/os/commerce/media_grant/persistence/durable_media_release_issuance_log.js";

/**
 * CROSS-PROCESS COMPLETION SYNC + BUYER RESTART CONTENT RE-ACCESS +
 * TRUTHFUL REPUTATION FINAL CLOSURE mega-arc (Coordinator) -- the SELLER's
 * own, independently-verified counterpart to
 * `commerce_media_release_content_cache.test.ts`. Mirrors that file's own
 * restart-recovery/conflict/wrong-binding discipline exactly, proving this
 * fixes Finding 1
 * (`docs/commerce/SELLER-SIDE-COMPLETION-SYNC-INVARIANT-GAP.md`) at the
 * persistence layer: a fresh `DurableMediaReleaseIssuanceLog` instance
 * pointed at the SAME file (the cheapest honest simulation of a seller
 * process restart) reads back exactly what an earlier instance wrote.
 */

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});
function freshFile(): string {
  const d = mkdtempSync(join(tmpdir(), "fedos-media-release-issuance-"));
  dir = d;
  return join(d, "media_release_issuance.ndjson");
}

function record(overrides: Partial<MediaReleaseIssuanceRecord> = {}): MediaReleaseIssuanceRecord {
  return {
    orderId: "order-1",
    mediaId: "media-1",
    buyerPubkey: "b".repeat(64),
    sellerPubkey: "c".repeat(64),
    grantVersion: 1,
    contentDigest: "d".repeat(64),
    issuedAt: 1_700_000_000,
    ...overrides,
  };
}

describe("DurableMediaReleaseIssuanceLog", () => {
  it("recordIssuance then hasIssuedRelease is true for the exact triple", () => {
    const log = new DurableMediaReleaseIssuanceLog(freshFile());
    expect(log.recordIssuance(record())).toBe("inserted");
    expect(log.hasIssuedRelease("order-1", "media-1", "b".repeat(64))).toBe(true);
  });

  it("hasIssuedRelease is false for an unknown triple -- never a false positive", () => {
    const log = new DurableMediaReleaseIssuanceLog(freshFile());
    expect(log.hasIssuedRelease("order-x", "media-x", "b".repeat(64))).toBe(false);
  });

  it("RESTART SURVIVAL: a fresh instance over the SAME file sees an issuance recorded by an earlier instance -- the exact seller-process-restart scenario this file exists to prove", () => {
    const filePath = freshFile();
    const first = new DurableMediaReleaseIssuanceLog(filePath);
    expect(first.recordIssuance(record())).toBe("inserted");

    // Simulate a seller process restart: a brand-new instance, no shared in-memory state.
    const second = new DurableMediaReleaseIssuanceLog(filePath);
    expect(second.hasIssuedRelease("order-1", "media-1", "b".repeat(64))).toBe(true);
  });

  it("a byte-identical re-record of the same triple is 'already-present', never duplicated", () => {
    const log = new DurableMediaReleaseIssuanceLog(freshFile());
    expect(log.recordIssuance(record())).toBe("inserted");
    expect(log.recordIssuance(record())).toBe("already-present");
  });

  it("a DIFFERENT record reusing the same (orderId, mediaId, buyerPubkey) triple is a 'conflict', never silently overwritten", () => {
    const log = new DurableMediaReleaseIssuanceLog(freshFile());
    expect(log.recordIssuance(record())).toBe("inserted");
    const conflicting = record({ contentDigest: "e".repeat(64) });
    expect(log.recordIssuance(conflicting)).toBe("conflict");
    expect(log.hasIssuedRelease("order-1", "media-1", "b".repeat(64))).toBe(true);
  });

  it("WRONG-BINDING: different buyers/orders/media are independent keys -- never a cross-order/cross-buyer/cross-media false positive", () => {
    const log = new DurableMediaReleaseIssuanceLog(freshFile());
    expect(log.recordIssuance(record())).toBe("inserted");
    expect(log.hasIssuedRelease("order-2", "media-1", "b".repeat(64))).toBe(false);
    expect(log.hasIssuedRelease("order-1", "media-2", "b".repeat(64))).toBe(false);
    expect(log.hasIssuedRelease("order-1", "media-1", "f".repeat(64))).toBe(false);
    // Recording independent triples never collides.
    expect(log.recordIssuance(record({ buyerPubkey: "f".repeat(64) }))).toBe("inserted");
    expect(log.recordIssuance(record({ orderId: "order-2" }))).toBe("inserted");
    expect(log.recordIssuance(record({ mediaId: "media-2" }))).toBe("inserted");
    expect(log.hasIssuedRelease("order-1", "media-1", "b".repeat(64))).toBe(true);
    expect(log.hasIssuedRelease("order-1", "media-1", "f".repeat(64))).toBe(true);
    expect(log.hasIssuedRelease("order-2", "media-1", "b".repeat(64))).toBe(true);
    expect(log.hasIssuedRelease("order-1", "media-2", "b".repeat(64))).toBe(true);
  });

  it("recordIssuance fails closed ('failed') on a structurally malformed record, never appends it", () => {
    const log = new DurableMediaReleaseIssuanceLog(freshFile());
    const malformed = { ...record(), contentDigest: "not-a-real-digest" } as MediaReleaseIssuanceRecord;
    expect(log.recordIssuance(malformed)).toBe("failed");
    expect(log.hasIssuedRelease("order-1", "media-1", "b".repeat(64))).toBe(false);
  });

  it("a corrupt log line throws on read (fail-closed on corruption, mirrors DurableMediaReleaseContentCache)", () => {
    const filePath = freshFile();
    const log = new DurableMediaReleaseIssuanceLog(filePath);
    log.recordIssuance(record());
    appendFileSync(filePath, "not-json-at-all\n", "utf8");
    expect(() => log.hasIssuedRelease("order-1", "media-1", "b".repeat(64))).toThrow();
  });

  it("a missing log file (never written to) is an honest empty state, not a throw", () => {
    const log = new DurableMediaReleaseIssuanceLog(freshFile());
    expect(log.hasIssuedRelease("order-1", "media-1", "b".repeat(64))).toBe(false);
  });
});
