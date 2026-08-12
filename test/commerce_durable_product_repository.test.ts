import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurableProductRepository } from "../src/os/commerce/catalog/persistence/durable_product_repository.js";
import type { CreateProductInput } from "../src/os/commerce/catalog/product_repository_port.js";
import type { Product } from "../src/os/commerce/catalog/types.js";

/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent D) — DurableProductRepository.
 */

const MERCHANT_A = "a".repeat(64);
const MERCHANT_B = "b".repeat(64);

function baseInput(overrides: Partial<CreateProductInput> = {}): CreateProductInput {
  return {
    kind: "pdf",
    title: "My Ebook",
    priceCents: 500,
    currency: "USD",
    visibility: "public",
    actorRole: "merchant",
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

describe("DurableProductRepository -- restart recovery", () => {
  it("1. a missing log file replays to empty state", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-"));
    const repo = new DurableProductRepository(join(dir, "products.ndjson"));
    expect(repo.list()).toEqual([]);
    expect(repo.get("p-1")).toBeUndefined();
  });

  it("2. create() then a FRESH instance over the same file recovers the exact same state (restart proof)", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-"));
    const path = join(dir, "products.ndjson");
    const first = new DurableProductRepository(path, sequentialIdGenerator("p"));
    const result = first.create(MERCHANT_A, baseInput());
    if (result.outcome !== "ok") throw new Error("fixture setup failed");

    const second = new DurableProductRepository(path);
    expect(second.get(result.product.id)).toEqual(result.product);
    expect(second.list()).toEqual([result.product]);
  });

  it("3. create -> publish -> update survives a restart after EVERY step", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-"));
    const path = join(dir, "products.ndjson");

    let repo: DurableProductRepository = new DurableProductRepository(path, sequentialIdGenerator("p"));
    const created = repo.create(MERCHANT_A, baseInput());
    if (created.outcome !== "ok") throw new Error("fixture: create failed");
    const id = created.product.id;

    repo = new DurableProductRepository(path);
    expect(repo.get(id)?.status).toBe("draft");

    const published = repo.publish(MERCHANT_A, id);
    expect(published.outcome).toBe("ok");

    repo = new DurableProductRepository(path);
    expect(repo.get(id)?.status).toBe("active");

    const updated = repo.update(MERCHANT_A, id, { priceCents: 999 });
    expect(updated.outcome).toBe("ok");

    repo = new DurableProductRepository(path);
    const final = repo.get(id);
    expect(final?.status).toBe("active");
    expect(final?.priceCents).toBe(999);
    // Identity fields survived every restart unchanged.
    expect(final?.creatorPubkey).toBe(MERCHANT_A);
    expect(final?.kind).toBe("pdf");
  });

  it("4. unpublish() persists and survives a restart", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-"));
    const path = join(dir, "products.ndjson");
    const repo = new DurableProductRepository(path, sequentialIdGenerator("p"));
    const created = repo.create(MERCHANT_A, baseInput());
    if (created.outcome !== "ok") throw new Error("fixture: create failed");
    repo.publish(MERCHANT_A, created.product.id);
    repo.unpublish(MERCHANT_A, created.product.id);

    const restarted = new DurableProductRepository(path);
    expect(restarted.get(created.product.id)?.status).toBe("archived");
  });
});

describe("DurableProductRepository -- authority is still enforced", () => {
  it("0. create() by an actor asserting a customer capacity is rejected and never persisted (Real Two-Party Commerce + UX P0/P1 Closure arc, friction ledger row #2)", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-"));
    const path = join(dir, "products.ndjson");
    const repo = new DurableProductRepository(path, sequentialIdGenerator("p"));
    const result = repo.create(MERCHANT_A, baseInput({ actorRole: "customer" }));
    expect(result.outcome).toBe("unauthorized-actor");
    expect(repo.list()).toHaveLength(0);

    const restarted = new DurableProductRepository(path);
    expect(restarted.list()).toHaveLength(0);
  });

  it("1. update() by a non-owning merchant is forbidden and never persisted", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-"));
    const path = join(dir, "products.ndjson");
    const repo = new DurableProductRepository(path, sequentialIdGenerator("p"));
    const created = repo.create(MERCHANT_A, baseInput());
    if (created.outcome !== "ok") throw new Error("fixture: create failed");

    const result = repo.update(MERCHANT_B, created.product.id, { title: "Hijacked" });
    expect(result.outcome).toBe("forbidden");

    const restarted = new DurableProductRepository(path);
    expect(restarted.get(created.product.id)?.title).toBe("My Ebook");
  });
});

describe("DurableProductRepository -- fail-closed on corruption", () => {
  it("1. a truncated final line throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-"));
    const path = join(dir, "products.ndjson");
    const product: Product = {
      id: "p-1",
      kind: "pdf",
      title: "T",
      creatorPubkey: MERCHANT_A,
      priceCents: 100,
      currency: "USD",
      status: "draft",
      visibility: "public",
      linkedSpaceIds: [],
      linkedEventIds: [],
      assetIds: [],
    };
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, product }) + "\n", "utf8");
    appendFileSync(path, '{"schemaVersion":1,"product":{"id":"p-2","kind"', "utf8");
    expect(() => new DurableProductRepository(path)).toThrow();
  });

  it("2. an unknown/future schemaVersion throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-"));
    const path = join(dir, "products.ndjson");
    const product: Product = {
      id: "p-1",
      kind: "pdf",
      title: "T",
      creatorPubkey: MERCHANT_A,
      priceCents: 100,
      currency: "USD",
      status: "draft",
      visibility: "public",
      linkedSpaceIds: [],
      linkedEventIds: [],
      assetIds: [],
    };
    appendFileSync(path, JSON.stringify({ schemaVersion: 99, product }) + "\n", "utf8");
    expect(() => new DurableProductRepository(path)).toThrow();
  });

  it("3. a duplicate product id with conflicting identity fields throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-"));
    const path = join(dir, "products.ndjson");
    const product: Product = {
      id: "p-1",
      kind: "pdf",
      title: "T",
      creatorPubkey: MERCHANT_A,
      priceCents: 100,
      currency: "USD",
      status: "draft",
      visibility: "public",
      linkedSpaceIds: [],
      linkedEventIds: [],
      assetIds: [],
    };
    const conflicting: Product = { ...product, creatorPubkey: MERCHANT_B };
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, product }) + "\n", "utf8");
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, product: conflicting }) + "\n", "utf8");
    expect(() => new DurableProductRepository(path)).toThrow();
  });

  it("4. a non-JSON line throws unconditionally", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-product-"));
    const path = join(dir, "products.ndjson");
    writeFileSync(path, "definitely-not-json\n", "utf8");
    expect(() => new DurableProductRepository(path)).toThrow();
  });
});
