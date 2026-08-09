import { describe, it, expect } from "vitest";
import {
  classifyEventToProducts,
  eventMatchesProduct,
  getProductTags,
} from "../src/os/commerce/catalog/adapters/nostr/classify.js";
import type { Product } from "../src/os/commerce/catalog/types.js";
import type { NostrEvent, NostrTag } from "../src/os/messenger/adapters/nostr/protocol/types.js";

function event(tags: NostrTag[]): NostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1,
    kind: 1,
    tags,
    content: "x",
    sig: "b".repeat(128),
  };
}

function product(id: string): Product {
  return {
    id,
    kind: "pdf",
    title: id,
    creatorPubkey: "a".repeat(64),
    priceCents: 0,
    currency: "USD",
    status: "active",
    visibility: "public",
    linkedSpaceIds: [],
    linkedEventIds: [],
    assetIds: [],
  };
}

describe("commerce classify", () => {
  it('1. reads a ["product", id] tag', () => {
    expect(getProductTags(event([["product", "guide"]]))).toEqual(["guide"]);
    expect(eventMatchesProduct(event([["product", "guide"]]), product("guide"))).toBe(
      true,
    );
  });

  it('2. reads a ["t", "product:<id>"] tag', () => {
    expect(getProductTags(event([["t", "product:guide"]]))).toEqual(["guide"]);
  });

  it("3. classifies an event onto multiple known products (deduped)", () => {
    const ev = event([
      ["product", "a"],
      ["t", "product:b"],
      ["product", "a"], // duplicate -> collapsed
    ]);
    expect(getProductTags(ev)).toEqual(["a", "b"]);
    const products = [product("a"), product("b"), product("c")];
    expect(classifyEventToProducts(ev, products).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("4. ignores malformed / unrelated tags", () => {
    const ev = event([
      ["product"], // missing value
      ["product", ""], // empty value
      ["t", "topic"], // not a product: prefix
      ["chat", "guide"], // a chat tag, not a product tag
      ["e", "1".repeat(64)],
    ]);
    expect(getProductTags(ev)).toEqual([]);
    expect(eventMatchesProduct(ev, product("guide"))).toBe(false);
  });

  it("5. ignores references to unknown products", () => {
    const ev = event([["product", "ghost"]]);
    expect(classifyEventToProducts(ev, [product("guide")])).toEqual([]);
  });

  it("returns [] for an event with no product tags", () => {
    expect(classifyEventToProducts(event([]), [product("guide")])).toEqual([]);
  });

  it("6. does not mutate the inputs", () => {
    const ev = event([["product", "a"]]);
    const products = [product("a"), product("b")];
    const evSnap = JSON.stringify(ev);
    const productsSnap = JSON.stringify(products);
    classifyEventToProducts(ev, products);
    expect(JSON.stringify(ev)).toBe(evSnap);
    expect(JSON.stringify(products)).toBe(productsSnap);
  });
});
