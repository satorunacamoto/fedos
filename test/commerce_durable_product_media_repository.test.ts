import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurableProductMediaRepository } from "../src/os/commerce/catalog/persistence/durable_product_media_repository.js";
import type { AddProductMediaInput } from "../src/os/commerce/catalog/product_media_repository_port.js";
import type { Product } from "../src/os/commerce/catalog/types.js";

/**
 * Real Digital Delivery mega-arc (Coordinator, positive-E2E root-cause fix)
 * -- `DurableProductMediaRepository`. Mirrors
 * `commerce_durable_product_repository.test.ts`'s own restart-recovery
 * discipline (its own direct template) for the sibling ProductMedia
 * domain, whose ENTIRE lack of persistence (a bare in-memory `Map` via
 * `LocalProductMediaRepository`, unconditionally, for every real seller)
 * was the confirmed root cause of a live positive digital-delivery E2E
 * failure: `issueCommerceMediaAccessGrantsNonFatal()` silently issued NO
 * grant at all for a real product's genuinely-attached protected content
 * once the seller's process was merely restarted between "attach" and
 * "fulfill" -- see `durable_product_media_repository.ts`'s own header for
 * the full account.
 */

const MERCHANT_A = "a".repeat(64);
const MERCHANT_B = "b".repeat(64);

function fixtureProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-1",
    kind: "pdf",
    title: "My Ebook",
    description: "desc",
    creatorPubkey: MERCHANT_A,
    priceCents: 500,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: [],
    ...overrides,
  };
}

function protectedInput(overrides: Partial<AddProductMediaInput> = {}): AddProductMediaInput {
  return {
    role: "primary",
    classification: "protected",
    contentType: "application/pdf",
    sizeBytes: 1024,
    checksum: "b".repeat(64),
    checksumSubject: "ciphertext",
    storageRef: "storage-ref-real-1",
    ...overrides,
  };
}

function sequentialIdGenerator(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${(n += 1)}`;
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("DurableProductMediaRepository -- restart recovery (the exact live gap this fix closes)", () => {
  it("1. a missing log file replays to empty state", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-media-"));
    const repo = new DurableProductMediaRepository(join(dir, "product_media.ndjson"));
    expect(repo.listForProduct("p-1")).toEqual([]);
    expect(repo.get("m-1")).toBeUndefined();
  });

  it("2. add() a REAL protected record, then a FRESH instance over the SAME file recovers the exact same record -- including storageRef (the exact field the live E2E failure showed was being lost)", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-media-"));
    const path = join(dir, "product_media.ndjson");
    const product = fixtureProduct();

    const first = new DurableProductMediaRepository(path, sequentialIdGenerator("m"));
    const added = first.add(MERCHANT_A, product, protectedInput());
    if (added.outcome !== "ok") throw new Error("fixture setup failed");
    expect(added.media.classification).toBe("protected");
    expect(added.media.storageRef).toBe("storage-ref-real-1");

    // Simulates a real seller process restart: a brand-new instance, same
    // durable file, no shared in-memory state whatsoever.
    const second = new DurableProductMediaRepository(path);
    const restored = second.get(added.media.id);
    expect(restored).toEqual(added.media);
    expect(restored?.storageRef).toBe("storage-ref-real-1");
    expect(second.listForProduct(product.id)).toEqual([added.media]);
  });

  it("3. listForProduct() only returns records for the requested product, across a restart", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-media-"));
    const path = join(dir, "product_media.ndjson");
    const productA = fixtureProduct({ id: "p-a" });
    const productB = fixtureProduct({ id: "p-b" });

    let repo: DurableProductMediaRepository = new DurableProductMediaRepository(path, sequentialIdGenerator("m"));
    const addedA = repo.add(MERCHANT_A, productA, protectedInput());
    const addedB = repo.add(MERCHANT_A, productB, protectedInput({ storageRef: "storage-ref-real-2" }));
    if (addedA.outcome !== "ok" || addedB.outcome !== "ok") throw new Error("fixture setup failed");

    repo = new DurableProductMediaRepository(path);
    expect(repo.listForProduct("p-a").map((m) => m.id)).toEqual([addedA.media.id]);
    expect(repo.listForProduct("p-b").map((m) => m.id)).toEqual([addedB.media.id]);
    expect(repo.listForProduct("p-nonexistent")).toEqual([]);
  });

  it("4. multiple add() calls across separate restarts all durably accumulate (real multi-launch seller flow)", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-media-"));
    const path = join(dir, "product_media.ndjson");
    const product = fixtureProduct();

    let repo: DurableProductMediaRepository = new DurableProductMediaRepository(path, sequentialIdGenerator("m"));
    const first = repo.add(MERCHANT_A, product, protectedInput({ altText: "Full guide (PDF)" }));
    if (first.outcome !== "ok") throw new Error("fixture setup failed");

    // Restart #1 (mirrors the real Bob-attaches-then-closes-app scenario).
    repo = new DurableProductMediaRepository(path, sequentialIdGenerator("m"));
    const second = repo.add(MERCHANT_A, product, protectedInput({ storageRef: "storage-ref-real-3", classification: "public", checksumSubject: "plaintext" }));
    if (second.outcome !== "ok") throw new Error("fixture setup failed");
    expect(second.media.id).not.toBe(first.media.id);

    // Restart #2 -- both records must still be present, both original ids preserved.
    repo = new DurableProductMediaRepository(path);
    const all = repo.listForProduct(product.id);
    expect(all.length).toBe(2);
    expect(all.map((m) => m.id).sort()).toEqual([first.media.id, second.media.id].sort());
    expect(repo.get(first.media.id)?.storageRef).toBe("storage-ref-real-1");
    expect(repo.get(second.media.id)?.storageRef).toBe("storage-ref-real-3");
  });

  it("5. remove() removes from the live view (documented as non-durable across a restart -- see this class's own header)", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-media-"));
    const path = join(dir, "product_media.ndjson");
    const product = fixtureProduct();

    const repo = new DurableProductMediaRepository(path, sequentialIdGenerator("m"));
    const added = repo.add(MERCHANT_A, product, protectedInput());
    if (added.outcome !== "ok") throw new Error("fixture setup failed");

    const removed = repo.remove(MERCHANT_A, product, added.media.id);
    expect(removed.outcome).toBe("ok");
    expect(repo.get(added.media.id)).toBeUndefined();
    expect(repo.listForProduct(product.id)).toEqual([]);
  });

  it("6. add() enforces canEditProduct -- a non-creator actor is forbidden, never silently allowed", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-media-"));
    const path = join(dir, "product_media.ndjson");
    const product = fixtureProduct({ creatorPubkey: MERCHANT_A });

    const repo = new DurableProductMediaRepository(path, sequentialIdGenerator("m"));
    const result = repo.add(MERCHANT_B, product, protectedInput());
    expect(result.outcome).toBe("forbidden");
    expect(repo.listForProduct(product.id)).toEqual([]);
  });

  it("7. add() enforces validateProductMedia() -- protected classification with a plaintext checksumSubject is rejected, never persisted", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-media-"));
    const path = join(dir, "product_media.ndjson");
    const product = fixtureProduct();

    const repo = new DurableProductMediaRepository(path, sequentialIdGenerator("m"));
    const result = repo.add(MERCHANT_A, product, protectedInput({ checksumSubject: "plaintext" }));
    expect(result.outcome).toBe("invalid-input");
    expect(repo.listForProduct(product.id)).toEqual([]);
  });

  it("8. a genuinely corrupt log line fails CLOSED on construction (never silently drops/ignores real data)", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-media-"));
    const path = join(dir, "product_media.ndjson");
    writeFileSync(path, "{ not valid json\n", "utf8");
    expect(() => new DurableProductMediaRepository(path)).toThrow();
  });

  it("9. two records sharing the same id but disagreeing on productId is treated as corruption, fails closed", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-media-"));
    const path = join(dir, "product_media.ndjson");
    const base = {
      id: "m-conflict",
      role: "primary",
      classification: "protected",
      contentType: "application/pdf",
      sizeBytes: 1024,
      checksum: "c".repeat(64),
      checksumSubject: "ciphertext",
      storageRef: "storage-ref-x",
    };
    appendFileSync(path, `${JSON.stringify({ schemaVersion: 1, media: { ...base, productId: "p-a" } })}\n`, "utf8");
    appendFileSync(path, `${JSON.stringify({ schemaVersion: 1, media: { ...base, productId: "p-b" } })}\n`, "utf8");
    expect(() => new DurableProductMediaRepository(path)).toThrow();
  });
});
