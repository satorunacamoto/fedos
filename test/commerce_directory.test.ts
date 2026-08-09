import { describe, it, expect } from "vitest";
import {
  InMemoryProductDirectory,
  findProductById,
  getProductAssets,
  listViewableProducts,
  type ProductAsset,
} from "../src/os/commerce/catalog/directory.js";
import type { Product, PurchaseGrant } from "../src/os/commerce/catalog/types.js";

const CREATOR = "f".repeat(64);
const BUYER = "1".repeat(64);
const STRANGER = "9".repeat(64);

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p-public",
    kind: "pdf",
    title: "Public Product",
    creatorPubkey: CREATOR,
    priceCents: 100,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: [],
    ...overrides,
  };
}

const PUBLIC = product();
const PRIVATE = product({ id: "p-private", visibility: "private", assetIds: ["a1", "a2"] });
const DRAFT = product({ id: "p-draft", status: "draft" });

const GRANTS: PurchaseGrant[] = [
  { productId: "p-private", buyerPubkey: BUYER, grantedAt: 1, source: "manual" },
];

function asset(id: string): ProductAsset {
  return {
    id,
    metadata: {
      kind: "preview",
      visibility: "public",
      contentType: "image/png",
      sizeBytes: 10,
      tags: [],
    },
  };
}

describe("findProductById", () => {
  it("1. finds a product by exact id, else undefined", () => {
    const list = [PUBLIC, PRIVATE];
    expect(findProductById(list, "p-private")).toBe(PRIVATE);
    expect(findProductById(list, "nope")).toBeUndefined();
  });

  it("InMemoryProductDirectory.get/list delegate to the array", () => {
    const dir = new InMemoryProductDirectory([PUBLIC, PRIVATE]);
    expect(dir.list()).toHaveLength(2);
    expect(dir.get("p-public")).toBe(PUBLIC);
    expect(dir.get("missing")).toBeUndefined();
  });
});

describe("listViewableProducts", () => {
  const all = [PUBLIC, PRIVATE, DRAFT];

  it("2. a guest sees a public active product", () => {
    const viewable = listViewableProducts(all);
    expect(viewable).toContain(PUBLIC);
  });

  it("3. a private product is hidden from a guest", () => {
    expect(listViewableProducts(all)).not.toContain(PRIVATE);
    expect(listViewableProducts(all, STRANGER, GRANTS)).not.toContain(PRIVATE);
  });

  it("4. a grant holder sees the private active product", () => {
    expect(listViewableProducts(all, BUYER, GRANTS)).toContain(PRIVATE);
  });

  it("5. a draft is visible to its creator only", () => {
    expect(listViewableProducts(all)).not.toContain(DRAFT);
    expect(listViewableProducts(all, CREATOR)).toContain(DRAFT);
  });
});

describe("getProductAssets", () => {
  const metadata = [asset("a1"), asset("a2"), asset("a3")];

  it("6. selects only the assets named by product.assetIds", () => {
    const selected = getProductAssets(PRIVATE, metadata);
    expect(selected.map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("ignores unknown ids and an empty assetIds list", () => {
    expect(getProductAssets(PUBLIC, metadata)).toEqual([]);
    expect(
      getProductAssets(product({ assetIds: ["a3", "ghost"] }), metadata).map((a) => a.id),
    ).toEqual(["a3"]);
  });
});

describe("directory purity", () => {
  it("7. does not mutate its inputs", () => {
    const products = [PUBLIC, PRIVATE, DRAFT];
    const metadata = [asset("a1"), asset("a2")];
    const snapProducts = JSON.stringify(products);
    const snapMeta = JSON.stringify(metadata);
    const snapGrants = JSON.stringify(GRANTS);

    listViewableProducts(products, BUYER, GRANTS);
    getProductAssets(PRIVATE, metadata);
    findProductById(products, "p-public");

    expect(JSON.stringify(products)).toBe(snapProducts);
    expect(JSON.stringify(metadata)).toBe(snapMeta);
    expect(JSON.stringify(GRANTS)).toBe(snapGrants);
  });
});
