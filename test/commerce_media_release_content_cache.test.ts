import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DurableMediaReleaseContentCache,
  type MediaReleaseContentRecord,
} from "../src/os/commerce/media_grant/persistence/durable_media_release_content_cache.js";

/**
 * BUYER DISCOVERY + DIGITAL CONTENT DELIVERY mega-arc (Agent A) — this arc's
 * own mandate item 6 ("Content access must survive a real restart... no
 * transient renderer-only state") proven at the persistence layer: a fresh
 * `DurableMediaReleaseContentCache` instance pointed at the SAME file (the
 * cheapest honest simulation of a process restart, mirroring how
 * `AppendOnlyMediaAccessGrantPersistence`'s own restart-survival is proven
 * elsewhere in this codebase) reads back exactly what an earlier instance
 * wrote.
 */

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});
function freshFile(): string {
  const d = mkdtempSync(join(tmpdir(), "fedos-media-release-cache-"));
  dir = d;
  return join(d, "media_release_content.ndjson");
}

function record(overrides: Partial<MediaReleaseContentRecord> = {}): MediaReleaseContentRecord {
  return {
    orderId: "order-1",
    mediaId: "media-1",
    buyerPubkey: "b".repeat(64),
    sellerPubkey: "c".repeat(64),
    grantVersion: 1,
    contentType: "application/pdf",
    contentDigest: "d".repeat(64),
    contentBase64: "aGVsbG8gd29ybGQ=",
    obtainedAt: 1_700_000_000,
    ...overrides,
  };
}

describe("DurableMediaReleaseContentCache", () => {
  it("put then get returns the exact record", () => {
    const cache = new DurableMediaReleaseContentCache(freshFile());
    expect(cache.putRelease(record())).toBe("inserted");
    expect(cache.getRelease("order-1", "media-1", "b".repeat(64))).toEqual(record());
    expect(cache.hasRelease("order-1", "media-1", "b".repeat(64))).toBe(true);
  });

  it("getRelease/hasRelease is false for an unknown triple", () => {
    const cache = new DurableMediaReleaseContentCache(freshFile());
    expect(cache.getRelease("order-x", "media-x", "b".repeat(64))).toBeUndefined();
    expect(cache.hasRelease("order-x", "media-x", "b".repeat(64))).toBe(false);
  });

  it("RESTART SURVIVAL: a fresh instance over the SAME file sees a release written by an earlier instance", () => {
    const filePath = freshFile();
    const first = new DurableMediaReleaseContentCache(filePath);
    expect(first.putRelease(record())).toBe("inserted");

    // Simulate a process restart: a brand-new instance, no shared in-memory state.
    const second = new DurableMediaReleaseContentCache(filePath);
    expect(second.hasRelease("order-1", "media-1", "b".repeat(64))).toBe(true);
    expect(second.getRelease("order-1", "media-1", "b".repeat(64))).toEqual(record());
  });

  it("a byte-identical re-put of the same triple is 'already-present', never duplicated", () => {
    const cache = new DurableMediaReleaseContentCache(freshFile());
    expect(cache.putRelease(record())).toBe("inserted");
    expect(cache.putRelease(record())).toBe("already-present");
  });

  it("a DIFFERENT record reusing the same (orderId, mediaId, buyerPubkey) triple is a 'conflict', never silently overwritten", () => {
    const cache = new DurableMediaReleaseContentCache(freshFile());
    expect(cache.putRelease(record())).toBe("inserted");
    const conflicting = record({ contentBase64: "ZGlmZmVyZW50", contentDigest: "e".repeat(64) });
    expect(cache.putRelease(conflicting)).toBe("conflict");
    // The original record is still what is stored -- never overwritten by the conflicting write.
    expect(cache.getRelease("order-1", "media-1", "b".repeat(64))).toEqual(record());
  });

  it("different buyers/orders/media for otherwise-identical content are independent keys", () => {
    const cache = new DurableMediaReleaseContentCache(freshFile());
    expect(cache.putRelease(record())).toBe("inserted");
    expect(cache.putRelease(record({ buyerPubkey: "f".repeat(64) }))).toBe("inserted");
    expect(cache.putRelease(record({ orderId: "order-2" }))).toBe("inserted");
    expect(cache.putRelease(record({ mediaId: "media-2" }))).toBe("inserted");
    expect(cache.hasRelease("order-1", "media-1", "b".repeat(64))).toBe(true);
    expect(cache.hasRelease("order-1", "media-1", "f".repeat(64))).toBe(true);
    expect(cache.hasRelease("order-2", "media-1", "b".repeat(64))).toBe(true);
    expect(cache.hasRelease("order-1", "media-2", "b".repeat(64))).toBe(true);
  });

  it("putRelease fails closed ('failed') on a structurally malformed record, never appends it", () => {
    const cache = new DurableMediaReleaseContentCache(freshFile());
    const malformed = { ...record(), contentDigest: "not-a-real-digest" } as MediaReleaseContentRecord;
    expect(cache.putRelease(malformed)).toBe("failed");
    expect(cache.hasRelease("order-1", "media-1", "b".repeat(64))).toBe(false);
  });

  it("a corrupt log line throws on read (fail-closed on corruption, mirrors AppendOnlyMediaAccessGrantPersistence)", () => {
    const filePath = freshFile();
    const cache = new DurableMediaReleaseContentCache(filePath);
    cache.putRelease(record());
    // Append a non-JSON garbage line directly to the log file.
    appendFileSync(filePath, "not-json-at-all\n", "utf8");
    expect(() => cache.getRelease("order-1", "media-1", "b".repeat(64))).toThrow();
  });

  // CROSS-PROCESS COMPLETION SYNC + BUYER RESTART CONTENT RE-ACCESS mega-arc
  // (Coordinator) -- `listReleasesForOrder()`, the additive accessor closing
  // Finding 2 (`docs/commerce/SELLER-SIDE-COMPLETION-SYNC-INVARIANT-GAP.md`):
  // `handleCommerceMediaGrantRedeem()` needs to find an already-cached
  // release by `(orderId, buyerPubkey)` alone, WITHOUT first needing a
  // trustworthy `ProductMedia` list to even know which `mediaId` to look up.
  describe("listReleasesForOrder", () => {
    it("returns the one release for a (orderId, buyerPubkey) pair with exactly one media item", () => {
      const cache = new DurableMediaReleaseContentCache(freshFile());
      cache.putRelease(record());
      expect(cache.listReleasesForOrder("order-1", "b".repeat(64))).toEqual([record()]);
    });

    it("returns an empty array for an order/buyer pair with no releases -- never throws, never a false hit", () => {
      const cache = new DurableMediaReleaseContentCache(freshFile());
      expect(cache.listReleasesForOrder("order-x", "b".repeat(64))).toEqual([]);
    });

    it("RESTART SURVIVAL: a fresh instance over the SAME file still lists a release written by an earlier instance", () => {
      const filePath = freshFile();
      const first = new DurableMediaReleaseContentCache(filePath);
      first.putRelease(record());

      const second = new DurableMediaReleaseContentCache(filePath);
      expect(second.listReleasesForOrder("order-1", "b".repeat(64))).toEqual([record()]);
    });

    it("multiple protected media items on the same order all appear", () => {
      const cache = new DurableMediaReleaseContentCache(freshFile());
      cache.putRelease(record({ mediaId: "media-1" }));
      cache.putRelease(record({ mediaId: "media-2" }));
      const listed = cache.listReleasesForOrder("order-1", "b".repeat(64));
      expect(listed).toHaveLength(2);
      expect(listed.map((r) => r.mediaId).sort()).toEqual(["media-1", "media-2"]);
    });

    it("WRONG-BINDING: never returns a release belonging to a different order or a different buyer for the same media", () => {
      const cache = new DurableMediaReleaseContentCache(freshFile());
      cache.putRelease(record({ orderId: "order-1", buyerPubkey: "b".repeat(64) }));
      cache.putRelease(record({ orderId: "order-2", buyerPubkey: "b".repeat(64) }));
      cache.putRelease(record({ orderId: "order-1", buyerPubkey: "f".repeat(64) }));
      expect(cache.listReleasesForOrder("order-1", "b".repeat(64))).toEqual([record({ orderId: "order-1", buyerPubkey: "b".repeat(64) })]);
    });
  });
});
