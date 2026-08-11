import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, appendFileSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { DurableOrderRepository } from "../src/os/commerce/order/persistence/durable_order_repository.js";
import { createOrder, applyOrderAction } from "../src/os/commerce/order/order_state_machine.js";
import type { Order } from "../src/os/commerce/order/order_types.js";

/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent D) — DurableOrderRepository.
 */

const CUSTOMER = "1".repeat(64);
const MERCHANT = "f".repeat(64);
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

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("DurableOrderRepository -- restart recovery", () => {
  it("1. a missing log file replays to empty state, exactly like the precedent append-only backends", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-order-"));
    const repo = new DurableOrderRepository(join(dir, "orders.ndjson"));
    expect(repo.list()).toEqual([]);
    expect(repo.findById("o-1")).toBeUndefined();
  });

  it("2. save() then a FRESH instance over the same file recovers the exact same state (restart proof)", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-order-"));
    const path = join(dir, "orders.ndjson");
    const first = new DurableOrderRepository(path);
    const o = order("o-1");
    first.save(o);

    const second = new DurableOrderRepository(path);
    expect(second.findById("o-1")).toEqual(o);
    expect(second.list()).toEqual([o]);
  });

  it("3. a sequence of saves interleaved with fresh-instance construction survives a restart after EVERY step", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-order-"));
    const path = join(dir, "orders.ndjson");

    const created = order("o-1");
    new DurableOrderRepository(path).save(created);

    let repo = new DurableOrderRepository(path);
    expect(repo.findById("o-1")?.status).toBe("created");

    const submitResult = applyOrderAction(created, { type: "submit", actor: { kind: "customer", pubkey: CUSTOMER } }, NOW + 1);
    if (!submitResult.ok) throw new Error("fixture: submit failed");
    repo.save(submitResult.order);

    repo = new DurableOrderRepository(path);
    expect(repo.findById("o-1")?.status).toBe("submitted");

    const acceptResult = applyOrderAction(submitResult.order, { type: "accept", actor: { kind: "merchant", pubkey: MERCHANT } }, NOW + 2);
    if (!acceptResult.ok) throw new Error("fixture: accept failed");
    repo.save(acceptResult.order);

    repo = new DurableOrderRepository(path);
    expect(repo.findById("o-1")?.status).toBe("accepted");

    const paidResult = applyOrderAction(
      acceptResult.order,
      {
        type: "confirm_payment",
        actor: { kind: "payment_evidence" },
        evidence: { orderId: "o-1", paymentId: "pay-1", status: "settled", observedAt: NOW + 3, reason: "test" },
      },
      NOW + 3,
    );
    if (!paidResult.ok) throw new Error("fixture: confirm_payment failed");
    repo.save(paidResult.order);

    // Final restart -- the fully-transitioned order (status "paid", paymentId bound,
    // full history) must be exactly what a brand new process sees.
    repo = new DurableOrderRepository(path);
    const recovered = repo.findById("o-1");
    expect(recovered?.status).toBe("paid");
    expect(recovered?.paymentId).toBe("pay-1");
    expect(recovered?.history).toHaveLength(4); // create, submit, accept, confirm_payment
    expect(recovered).toEqual(paidResult.order);
  });

  it("4. multiple orders round-trip independently through a restart", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-order-"));
    const path = join(dir, "orders.ndjson");
    const repo = new DurableOrderRepository(path);
    repo.save(order("o-1"));
    repo.save(order("o-2"));

    const restarted = new DurableOrderRepository(path);
    expect(restarted.list()).toHaveLength(2);
    expect(restarted.listByBuyer(CUSTOMER).map((o) => o.id).sort()).toEqual(["o-1", "o-2"]);
  });
});

describe("DurableOrderRepository -- fail-closed on corruption", () => {
  it("1. a truncated final line throws on construction, never silently ignored", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-order-"));
    const path = join(dir, "orders.ndjson");
    const o = order("o-1");
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, order: o }) + "\n", "utf8");
    // Simulate a crash mid-write: a second record cut off partway through.
    appendFileSync(path, '{"schemaVersion":1,"order":{"id":"o-2","status":"c', "utf8");
    expect(() => new DurableOrderRepository(path)).toThrow();
  });

  it("2. an unknown/future schemaVersion throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-order-"));
    const path = join(dir, "orders.ndjson");
    const o = order("o-1");
    appendFileSync(path, JSON.stringify({ schemaVersion: 2, order: o }) + "\n", "utf8");
    expect(() => new DurableOrderRepository(path)).toThrow();
  });

  it("3. a duplicate order id with conflicting identity fields throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-order-"));
    const path = join(dir, "orders.ndjson");
    const o = order("o-1");
    const conflicting: Order = { ...o, buyerPubkey: "9".repeat(64) };
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, order: o }) + "\n", "utf8");
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, order: conflicting }) + "\n", "utf8");
    expect(() => new DurableOrderRepository(path)).toThrow();
  });

  it("4. save() itself refuses to persist a record that would change an order's identity field", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-order-"));
    const path = join(dir, "orders.ndjson");
    const repo = new DurableOrderRepository(path);
    const o = order("o-1");
    repo.save(o);
    const tampered: Order = { ...o, sellerPubkey: "8".repeat(64) };
    expect(() => repo.save(tampered)).toThrow();
  });

  it("5. a non-JSON line throws unconditionally", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-order-"));
    const path = join(dir, "orders.ndjson");
    writeFileSync(path, "not-json-at-all\n", "utf8");
    expect(() => new DurableOrderRepository(path)).toThrow();
  });

  it("6. a legitimate repeated save of the SAME order id with only mutable fields changed is NOT corruption", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-order-"));
    const path = join(dir, "orders.ndjson");
    const repo = new DurableOrderRepository(path);
    const o = order("o-1");
    repo.save(o);
    const updated: Order = { ...o, status: "submitted", updatedAt: NOW + 1 };
    expect(() => repo.save(updated)).not.toThrow();
    expect(new DurableOrderRepository(path).findById("o-1")?.status).toBe("submitted");
  });
});
