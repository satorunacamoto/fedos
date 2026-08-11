import { describe, it, expect } from "vitest";
import { LocalOrderRepository } from "../src/os/commerce/order/local_order_repository.js";
import { createOrder } from "../src/os/commerce/order/order_state_machine.js";
import type { Order } from "../src/os/commerce/order/order_types.js";

const CUSTOMER = "1".repeat(64);
const OTHER_CUSTOMER = "2".repeat(64);
const MERCHANT = "f".repeat(64);
const OTHER_MERCHANT = "e".repeat(64);
const NOW = 1_700_000_000;

function order(id: string, buyerPubkey = CUSTOMER, sellerPubkey = MERCHANT): Order {
  const result = createOrder(
    { id, productId: "product-1", sellerPubkey, unitPriceCents: 500, currency: "USD" },
    { kind: "customer", pubkey: buyerPubkey },
    NOW,
  );
  if (!result.ok) throw new Error("fixture setup failed");
  return result.order;
}

describe("LocalOrderRepository", () => {
  it("1. save() then findById() returns the saved order", () => {
    const repo = new LocalOrderRepository();
    const o = order("o-1");
    repo.save(o);
    expect(repo.findById("o-1")).toBe(o);
  });

  it("2. findById() on an unknown id returns undefined", () => {
    const repo = new LocalOrderRepository();
    expect(repo.findById("nope")).toBeUndefined();
  });

  it("3. save() upserts by id — a second save with the same id overwrites, never duplicates", () => {
    const repo = new LocalOrderRepository();
    const original = order("o-1");
    repo.save(original);
    const updated: Order = { ...original, status: "submitted" };
    repo.save(updated);
    expect(repo.list()).toHaveLength(1);
    expect(repo.findById("o-1")?.status).toBe("submitted");
  });

  it("4. list() returns every saved order, and a fresh array each call", () => {
    const repo = new LocalOrderRepository();
    repo.save(order("o-1"));
    repo.save(order("o-2"));
    const first = repo.list();
    const second = repo.list();
    expect(first).toHaveLength(2);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("5. listByBuyer() filters to only that buyer's orders", () => {
    const repo = new LocalOrderRepository();
    repo.save(order("o-1", CUSTOMER));
    repo.save(order("o-2", OTHER_CUSTOMER));
    repo.save(order("o-3", CUSTOMER));
    const mine = repo.listByBuyer(CUSTOMER);
    expect(mine.map((o) => o.id).sort()).toEqual(["o-1", "o-3"]);
  });

  it("6. listBySeller() filters to only that seller's orders", () => {
    const repo = new LocalOrderRepository();
    repo.save(order("o-1", CUSTOMER, MERCHANT));
    repo.save(order("o-2", CUSTOMER, OTHER_MERCHANT));
    const mine = repo.listBySeller(MERCHANT);
    expect(mine.map((o) => o.id)).toEqual(["o-1"]);
  });

  it("7. listByBuyer()/listBySeller() with no matches return an empty array, not undefined", () => {
    const repo = new LocalOrderRepository();
    repo.save(order("o-1"));
    expect(repo.listByBuyer("nobody")).toEqual([]);
    expect(repo.listBySeller("nobody")).toEqual([]);
  });

  it("8. independent instances never share state", () => {
    const repoA = new LocalOrderRepository();
    const repoB = new LocalOrderRepository();
    repoA.save(order("o-1"));
    expect(repoA.list()).toHaveLength(1);
    expect(repoB.list()).toHaveLength(0);
  });
});
