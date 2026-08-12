import { describe, it, expect } from "vitest";
import { LocalProductRepository } from "../src/os/commerce/catalog/local_product_repository.js";
import type { CreateProductInput } from "../src/os/commerce/catalog/product_repository_port.js";
import type { ProductDirectory } from "../src/os/commerce/catalog/directory.js";
import { createCommerce } from "../src/os/commerce/create_commerce.js";

const MERCHANT_A = "a".repeat(64);
const MERCHANT_B = "b".repeat(64);
const STRANGER = "c".repeat(64);

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

describe("LocalProductRepository.create", () => {
  it("1. creates a product owned by the actor, always starting draft", () => {
    const repo = new LocalProductRepository(sequentialIdGenerator("p"));
    const result = repo.create(MERCHANT_A, baseInput());
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.product.creatorPubkey).toBe(MERCHANT_A);
    expect(result.product.status).toBe("draft");
    expect(result.product.id).toBe("p-1");
  });

  it("2. rejects a blank actorPubkey", () => {
    const repo = new LocalProductRepository();
    const result = repo.create("", baseInput());
    expect(result.outcome).toBe("invalid-input");
  });

  it("3. rejects a blank title, negative price, and negative stock", () => {
    const repo = new LocalProductRepository();
    expect(repo.create(MERCHANT_A, baseInput({ title: "   " })).outcome).toBe("invalid-input");
    expect(repo.create(MERCHANT_A, baseInput({ priceCents: -1 })).outcome).toBe("invalid-input");
    expect(repo.create(MERCHANT_A, baseInput({ stock: -5 })).outcome).toBe("invalid-input");
  });

  it("4. defaults optional array/stock fields to empty/undefined without aliasing the input", () => {
    const repo = new LocalProductRepository();
    const linkedSpaceIds = ["s1"];
    const result = repo.create(MERCHANT_A, baseInput({ linkedSpaceIds }));
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.product.linkedSpaceIds).toEqual(["s1"]);
    expect(result.product.linkedSpaceIds).not.toBe(linkedSpaceIds);
    expect(result.product.stock).toBeUndefined();
  });
});

/**
 * Real Two-Party Commerce + UX P0/P1 Closure arc (Agent S) — friction
 * ledger row #2 P0: "Unknown merchant" mis-attributed listing. Proves the
 * DOMAIN-layer fix (`policy.ts`'s `canCreateProduct()`, wired into
 * `create()` above `findInputInvalidReason()`) rejects product creation
 * whenever the caller does not explicitly assert a `"merchant"` capacity
 * — a plain, otherwise-valid `actorPubkey` is never sufficient by itself,
 * closing the gap the tabletop review found: creating a product while
 * "Acting as: Customer" silently succeeded and produced a permanently
 * mis-attributed "Unknown merchant" listing with no fix path.
 */
describe("LocalProductRepository.create — actor-role authority (friction ledger row #2)", () => {
  it("16. rejects creation when the actor asserts a customer capacity, never constructing a product", () => {
    const repo = new LocalProductRepository();
    const result = repo.create(MERCHANT_A, baseInput({ actorRole: "customer" }));
    expect(result.outcome).toBe("unauthorized-actor");
    expect(repo.list()).toHaveLength(0);
  });

  it("17. rejects creation when actorRole is missing/malformed as invalid-input, never a silent default-allow", () => {
    const repo = new LocalProductRepository();
    const malformed = { ...baseInput(), actorRole: undefined as unknown as "merchant" };
    const result = repo.create(MERCHANT_A, malformed);
    expect(result.outcome).toBe("invalid-input");
    expect(repo.list()).toHaveLength(0);
  });

  it("18. accepts creation when the actor explicitly asserts a merchant capacity, same as before this fix", () => {
    const repo = new LocalProductRepository();
    const result = repo.create(MERCHANT_A, baseInput({ actorRole: "merchant" }));
    expect(result.outcome).toBe("ok");
  });
});

describe("LocalProductRepository merchant authority", () => {
  it("5. only the owning merchant may update", () => {
    const repo = new LocalProductRepository();
    const created = repo.create(MERCHANT_A, baseInput());
    if (created.outcome !== "ok") throw new Error("unreachable");
    const id = created.product.id;

    const byStranger = repo.update(STRANGER, id, { title: "Hacked" });
    expect(byStranger.outcome).toBe("forbidden");
    expect(repo.get(id)?.title).toBe("My Ebook");

    const byOwner = repo.update(MERCHANT_A, id, { title: "Updated Title" });
    expect(byOwner.outcome).toBe("ok");
    expect(repo.get(id)?.title).toBe("Updated Title");
  });

  it("6. only the owning merchant may publish/unpublish", () => {
    const repo = new LocalProductRepository();
    const created = repo.create(MERCHANT_A, baseInput());
    if (created.outcome !== "ok") throw new Error("unreachable");
    const id = created.product.id;

    expect(repo.publish(MERCHANT_B, id).outcome).toBe("forbidden");
    expect(repo.get(id)?.status).toBe("draft");

    expect(repo.publish(MERCHANT_A, id).outcome).toBe("ok");
    expect(repo.get(id)?.status).toBe("active");

    expect(repo.unpublish(STRANGER, id).outcome).toBe("forbidden");
    expect(repo.unpublish(MERCHANT_A, id).outcome).toBe("ok");
    expect(repo.get(id)?.status).toBe("archived");
  });

  it("7. mutating an unknown product id returns not-found, never throws", () => {
    const repo = new LocalProductRepository();
    expect(repo.update(MERCHANT_A, "nope", { title: "x" }).outcome).toBe("not-found");
    expect(repo.publish(MERCHANT_A, "nope").outcome).toBe("not-found");
    expect(repo.unpublish(MERCHANT_A, "nope").outcome).toBe("not-found");
  });

  it("8. update rejects invalid patch fields the same way create does", () => {
    const repo = new LocalProductRepository();
    const created = repo.create(MERCHANT_A, baseInput());
    if (created.outcome !== "ok") throw new Error("unreachable");
    const result = repo.update(MERCHANT_A, created.product.id, { priceCents: -100 });
    expect(result.outcome).toBe("invalid-input");
  });
});

describe("LocalProductRepository read paths", () => {
  it("9. list() returns every product regardless of status (merchant-only view)", () => {
    const repo = new LocalProductRepository();
    repo.create(MERCHANT_A, baseInput({ title: "Draft One" }));
    const second = repo.create(MERCHANT_A, baseInput({ title: "Published One" }));
    if (second.outcome === "ok") repo.publish(MERCHANT_A, second.product.id);
    expect(repo.list()).toHaveLength(2);
  });

  it("10. listOwnedByMerchant() scopes to one merchant's own products only", () => {
    const repo = new LocalProductRepository();
    repo.create(MERCHANT_A, baseInput({ title: "A1" }));
    repo.create(MERCHANT_B, baseInput({ title: "B1" }));
    expect(repo.listOwnedByMerchant(MERCHANT_A)).toHaveLength(1);
    expect(repo.listOwnedByMerchant(MERCHANT_A)[0]?.title).toBe("A1");
  });

  it("11. listPublished() excludes drafts/archived and reuses listViewableProducts()'s own visibility rules", () => {
    const repo = new LocalProductRepository();
    const draft = repo.create(MERCHANT_A, baseInput({ title: "Draft" }));
    const priv = repo.create(MERCHANT_A, baseInput({ title: "Private", visibility: "private" }));
    const pub = repo.create(MERCHANT_A, baseInput({ title: "Public" }));
    if (priv.outcome === "ok") repo.publish(MERCHANT_A, priv.product.id);
    if (pub.outcome === "ok") repo.publish(MERCHANT_A, pub.product.id);
    void draft;

    const published = repo.listPublished();
    expect(published.map((p) => p.title)).toEqual(["Public"]);
  });

  it("12. get() on an unknown id returns undefined, matching ProductDirectory's own contract", () => {
    const repo = new LocalProductRepository();
    expect(repo.get("nope")).toBeUndefined();
  });
});

describe("LocalProductRepository as a ProductDirectory", () => {
  it("13. satisfies the ProductDirectory interface structurally and plugs straight into createCommerce({ catalog })", () => {
    const repo = new LocalProductRepository();
    const asDirectory: ProductDirectory = repo;
    const created = repo.create(MERCHANT_A, baseInput());
    if (created.outcome !== "ok") throw new Error("unreachable");
    if (created.outcome === "ok") repo.publish(MERCHANT_A, created.product.id);

    expect(asDirectory.list()).toHaveLength(1);
    expect(asDirectory.get(created.product.id)?.title).toBe("My Ebook");

    const commerce = createCommerce({ catalog: repo });
    expect(commerce.catalog.list()).toHaveLength(1);
  });
});

describe("LocalProductRepository determinism/isolation", () => {
  it("14. independent instances never share state", () => {
    const repoOne = new LocalProductRepository();
    const repoTwo = new LocalProductRepository();
    repoOne.create(MERCHANT_A, baseInput());
    expect(repoOne.list()).toHaveLength(1);
    expect(repoTwo.list()).toHaveLength(0);
  });

  it("15. never overwrites an id already in use, even with a colliding generator", () => {
    let calls = 0;
    const collidingGenerator = () => {
      calls += 1;
      return calls <= 2 ? "dup" : `unique-${calls}`;
    };
    const repo = new LocalProductRepository(collidingGenerator);
    const first = repo.create(MERCHANT_A, baseInput({ title: "First" }));
    const second = repo.create(MERCHANT_A, baseInput({ title: "Second" }));
    if (first.outcome !== "ok" || second.outcome !== "ok") throw new Error("unreachable");
    expect(first.product.id).not.toBe(second.product.id);
    expect(repo.list()).toHaveLength(2);
  });
});
