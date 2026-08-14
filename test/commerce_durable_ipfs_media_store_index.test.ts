import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurableIpfsMediaStoreIndex } from "../src/os/commerce/catalog/persistence/durable_ipfs_media_store_index.js";
import type { MediaObjectMetadata } from "../src/os/commerce/catalog/media_store_port.js";

/**
 * Real Digital Delivery mega-arc (Coordinator, protected-media-byte-
 * durability closure) -- `DurableIpfsMediaStoreIndex`. Mirrors
 * `commerce_durable_product_media_repository.test.ts`'s own restart-
 * recovery discipline for the METADATA half of the same fix (see
 * `durable_ipfs_media_store_index.ts`'s own header for why this is a
 * SEPARATE seam from `DurableIpfsTransport`).
 */

function fixtureMetadata(overrides: Partial<MediaObjectMetadata> = {}): MediaObjectMetadata {
  return {
    key: "fake-cid:" + "a".repeat(64),
    contentType: "application/pdf",
    sizeBytes: 1024,
    checksum: "a".repeat(64),
    storedAt: 1_700_000_000_000,
    ...overrides,
  };
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});
function freshFilePath(): string {
  dir = mkdtempSync(join(tmpdir(), "fedos-durable-ipfs-index-"));
  return join(dir, "media_index.ndjson");
}

describe("DurableIpfsMediaStoreIndex -- restart recovery (the exact live gap this fix closes)", () => {
  it("1. a missing log file replays to empty state", () => {
    const index = new DurableIpfsMediaStoreIndex(freshFilePath());
    expect(index.loadAll().size).toBe(0);
  });

  it("2. record() a REAL metadata entry, then a FRESH instance over the SAME file recovers the exact same entry", () => {
    const filePath = freshFilePath();
    const first = new DurableIpfsMediaStoreIndex(filePath);
    const metadata = fixtureMetadata();
    first.record(metadata);

    const second = new DurableIpfsMediaStoreIndex(filePath);
    expect(second.loadAll().get(metadata.key)).toEqual(metadata);
  });

  it("3. multiple record() calls across separate restarts all durably accumulate", () => {
    const filePath = freshFilePath();
    const metaA = fixtureMetadata({ key: "fake-cid:" + "a".repeat(64) });
    const metaB = fixtureMetadata({ key: "fake-cid:" + "b".repeat(64) });

    const first = new DurableIpfsMediaStoreIndex(filePath);
    first.record(metaA);

    const second = new DurableIpfsMediaStoreIndex(filePath);
    second.record(metaB);

    const third = new DurableIpfsMediaStoreIndex(filePath);
    const all = third.loadAll();
    expect(all.get(metaA.key)).toEqual(metaA);
    expect(all.get(metaB.key)).toEqual(metaB);
    expect(all.size).toBe(2);
  });

  it("4. a genuinely corrupt log line fails CLOSED on loadAll() (never silently drops/ignores real data)", () => {
    const filePath = freshFilePath();
    writeFileSync(filePath, "{ not valid json\n", "utf8");
    const index = new DurableIpfsMediaStoreIndex(filePath);
    expect(() => index.loadAll()).toThrow();
  });

  it("5. an unknown schemaVersion fails closed", () => {
    const filePath = freshFilePath();
    writeFileSync(filePath, JSON.stringify({ schemaVersion: 999, metadata: fixtureMetadata() }) + "\n", "utf8");
    const index = new DurableIpfsMediaStoreIndex(filePath);
    expect(() => index.loadAll()).toThrow();
  });

  it("6. a structurally-invalid metadata record (missing required field) fails closed", () => {
    const filePath = freshFilePath();
    appendFileSync(filePath, JSON.stringify({ schemaVersion: 1, metadata: { key: "fake-cid:" + "a".repeat(64) } }) + "\n", "utf8");
    const index = new DurableIpfsMediaStoreIndex(filePath);
    expect(() => index.loadAll()).toThrow();
  });

  it("7. two records sharing the same key but disagreeing on checksum is treated as corruption, fails closed", () => {
    const filePath = freshFilePath();
    const metaA = fixtureMetadata({ checksum: "a".repeat(64) });
    const metaB = fixtureMetadata({ checksum: "b".repeat(64) }); // same key, different checksum
    appendFileSync(filePath, JSON.stringify({ schemaVersion: 1, metadata: metaA }) + "\n", "utf8");
    appendFileSync(filePath, JSON.stringify({ schemaVersion: 1, metadata: metaB }) + "\n", "utf8");
    const index = new DurableIpfsMediaStoreIndex(filePath);
    expect(() => index.loadAll()).toThrow();
  });

  it("8. two records sharing the same key AND agreeing on checksum (a legitimate re-record of an idempotent write) replay fine, last-write-wins on the non-conflicting fields", () => {
    const filePath = freshFilePath();
    const metaA = fixtureMetadata({ storedAt: 1000 });
    const metaB = fixtureMetadata({ storedAt: 2000 }); // same key/checksum, different storedAt -- not a conflict
    appendFileSync(filePath, JSON.stringify({ schemaVersion: 1, metadata: metaA }) + "\n", "utf8");
    appendFileSync(filePath, JSON.stringify({ schemaVersion: 1, metadata: metaB }) + "\n", "utf8");
    const index = new DurableIpfsMediaStoreIndex(filePath);
    expect(index.loadAll().get(metaA.key)).toEqual(metaB);
  });
});
