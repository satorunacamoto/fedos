import { describe, it, expect } from "vitest";
import { LocalDeliveryRepository } from "../src/os/commerce/delivery/local_delivery_repository.js";
import { createDelivery } from "../src/os/commerce/delivery/delivery_state_machine.js";
import type { DeliveryRecord } from "../src/os/commerce/delivery/delivery_types.js";

/**
 * Commerce E2E Completion arc, Agent D (Wave B) -- LocalDeliveryRepository
 * tests. Mirrors `test/commerce_order_repository.test.ts`'s structure/style
 * exactly.
 */

const CUSTOMER = "1".repeat(64);
const OTHER_CUSTOMER = "2".repeat(64);
const MERCHANT = "f".repeat(64);
const OTHER_MERCHANT = "e".repeat(64);
const NOW = 1_700_000_000;

function delivery(id: string, orderId = "order-1", buyerPubkey = CUSTOMER, sellerPubkey = MERCHANT): DeliveryRecord {
  const result = createDelivery(
    { id, orderId, buyerPubkey, sellerPubkey, orderPaymentConfirmed: true },
    { kind: "merchant", pubkey: sellerPubkey },
    NOW,
  );
  if (!result.ok) throw new Error("fixture setup failed: " + result.reason);
  return result.delivery;
}

describe("LocalDeliveryRepository", () => {
  it("1. save() then findById() returns the saved delivery", () => {
    const repo = new LocalDeliveryRepository();
    const d = delivery("d-1");
    repo.save(d);
    expect(repo.findById("d-1")).toBe(d);
  });

  it("2. findById() on an unknown id returns undefined", () => {
    const repo = new LocalDeliveryRepository();
    expect(repo.findById("nope")).toBeUndefined();
  });

  it("3. save() upserts by id -- a second save with the same id overwrites, never duplicates", () => {
    const repo = new LocalDeliveryRepository();
    const original = delivery("d-1");
    repo.save(original);
    const updated: DeliveryRecord = { ...original, status: "fulfilling" };
    repo.save(updated);
    expect(repo.list()).toHaveLength(1);
    expect(repo.findById("d-1")?.status).toBe("fulfilling");
  });

  it("4. list() returns every saved delivery, and a fresh array each call", () => {
    const repo = new LocalDeliveryRepository();
    repo.save(delivery("d-1"));
    repo.save(delivery("d-2", "order-2"));
    const first = repo.list();
    const second = repo.list();
    expect(first).toHaveLength(2);
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("5. listByBuyer() filters to only that buyer's deliveries", () => {
    const repo = new LocalDeliveryRepository();
    repo.save(delivery("d-1", "order-1", CUSTOMER));
    repo.save(delivery("d-2", "order-2", OTHER_CUSTOMER));
    repo.save(delivery("d-3", "order-3", CUSTOMER));
    const mine = repo.listByBuyer(CUSTOMER);
    expect(mine).toHaveLength(2);
    expect(mine.map((d) => d.id).sort()).toEqual(["d-1", "d-3"]);
  });

  it("6. listBySeller() filters to only that seller's deliveries", () => {
    const repo = new LocalDeliveryRepository();
    repo.save(delivery("d-1", "order-1", CUSTOMER, MERCHANT));
    repo.save(delivery("d-2", "order-2", CUSTOMER, OTHER_MERCHANT));
    const mine = repo.listBySeller(MERCHANT);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.id).toBe("d-1");
  });

  it("7. findByOrderId() returns the delivery bound to a given order", () => {
    const repo = new LocalDeliveryRepository();
    repo.save(delivery("d-1", "order-1"));
    repo.save(delivery("d-2", "order-2"));
    expect(repo.findByOrderId("order-2")?.id).toBe("d-2");
  });

  it("8. findByOrderId() on an unknown orderId returns undefined", () => {
    const repo = new LocalDeliveryRepository();
    repo.save(delivery("d-1", "order-1"));
    expect(repo.findByOrderId("order-999")).toBeUndefined();
  });

  it("9. list()/listByBuyer()/listBySeller() never expose a live reference to the internal Map", () => {
    const repo = new LocalDeliveryRepository();
    repo.save(delivery("d-1"));
    const list = repo.list() as DeliveryRecord[];
    list.pop();
    expect(repo.list()).toHaveLength(1);
  });

  it("10. independent repository instances never share state", () => {
    const repoA = new LocalDeliveryRepository();
    const repoB = new LocalDeliveryRepository();
    repoA.save(delivery("d-1"));
    expect(repoB.list()).toHaveLength(0);
  });
});
