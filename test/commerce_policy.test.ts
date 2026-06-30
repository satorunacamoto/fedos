import { describe, it, expect } from "vitest";
import {
  canAccessAsset,
  canEditProduct,
  canViewProduct,
  hasPurchaseGrant,
} from "../src/commerce/policy.js";
import type { Product, PurchaseGrant } from "../src/commerce/types.js";

const CREATOR = "a".repeat(64);
const BUYER = "b".repeat(64);
const STRANGER = "c".repeat(64);

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    kind: "pdf",
    title: "Field Guide",
    creatorPubkey: CREATOR,
    priceCents: 500,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: ["asset-1"],
    ...overrides,
  };
}

function grant(overrides: Partial<PurchaseGrant> = {}): PurchaseGrant {
  return {
    productId: "prod-1",
    buyerPubkey: BUYER,
    grantedAt: 1,
    source: "payment",
    ...overrides,
  };
}

describe("commerce policy", () => {
  it("1. a public active product is viewable by a guest", () => {
    expect(canViewProduct("", product()).allowed).toBe(true);
    expect(canViewProduct(STRANGER, product()).allowed).toBe(true);
  });

  it("2. a draft product is denied to a guest / non-creator", () => {
    const draft = product({ status: "draft" });
    expect(canViewProduct("", draft).allowed).toBe(false);
    const denied = canViewProduct(STRANGER, draft);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/draft/);
  });

  it("3. a draft product is viewable by its creator", () => {
    expect(canViewProduct(CREATOR, product({ status: "draft" })).allowed).toBe(true);
    // ...as is an archived one.
    expect(canViewProduct(CREATOR, product({ status: "archived" })).allowed).toBe(true);
  });

  it("4. a private product without a grant is denied", () => {
    const priv = product({ visibility: "private" });
    expect(canViewProduct(STRANGER, priv).allowed).toBe(false);
    // No grants supplied at all.
    expect(canViewProduct(BUYER, priv).allowed).toBe(false);
  });

  it("5. a private product with a valid grant is viewable", () => {
    const priv = product({ visibility: "private" });
    expect(canViewProduct(BUYER, priv, [grant()]).allowed).toBe(true);
    expect(hasPurchaseGrant(BUYER, priv.id, [grant()])).toBe(true);
  });

  it("6. a revoked grant does not grant view or asset access", () => {
    const priv = product({ visibility: "private" });
    const revoked = [grant({ revokedAt: 2 })];
    expect(canViewProduct(BUYER, priv, revoked).allowed).toBe(false);
    expect(canAccessAsset(BUYER, priv, revoked).allowed).toBe(false);
    expect(hasPurchaseGrant(BUYER, priv.id, revoked)).toBe(false);
  });

  it("7. the creator may edit the product", () => {
    expect(canEditProduct(CREATOR, product()).allowed).toBe(true);
  });

  it("8. a non-creator may not edit the product", () => {
    const denied = canEditProduct(STRANGER, product());
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/creator/);
    // A guest (empty actor) cannot edit either.
    expect(canEditProduct("", product()).allowed).toBe(false);
  });

  it("9. asset access is allowed with a valid grant (and to the creator)", () => {
    expect(canAccessAsset(BUYER, product(), [grant()]).allowed).toBe(true);
    expect(canAccessAsset(CREATOR, product(), []).allowed).toBe(true);
  });

  it("10. asset access is denied without a grant", () => {
    const denied = canAccessAsset(STRANGER, product(), []);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/grant/);
    // A grant for a different product does not count.
    expect(
      canAccessAsset(BUYER, product(), [grant({ productId: "other" })]).allowed,
    ).toBe(false);
  });

  it("11. does not mutate its inputs", () => {
    const priv = product({ visibility: "private" });
    const grants = [grant()];
    const prodSnap = JSON.stringify(priv);
    const grantsSnap = JSON.stringify(grants);
    canViewProduct(BUYER, priv, grants);
    canAccessAsset(BUYER, priv, grants);
    canEditProduct(CREATOR, priv);
    hasPurchaseGrant(BUYER, priv.id, grants);
    expect(JSON.stringify(priv)).toBe(prodSnap);
    expect(JSON.stringify(grants)).toBe(grantsSnap);
  });
});
