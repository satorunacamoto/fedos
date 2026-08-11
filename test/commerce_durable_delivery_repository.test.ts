import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, appendFileSync, writeFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { DurableDeliveryRepository } from "../src/os/commerce/delivery/persistence/durable_delivery_repository.js";
import { createDelivery, applyDeliveryAction } from "../src/os/commerce/delivery/delivery_state_machine.js";
import type { DeliveryRecord } from "../src/os/commerce/delivery/delivery_types.js";

/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent D) — DurableDeliveryRepository.
 */

const CUSTOMER = "1".repeat(64);
const MERCHANT = "f".repeat(64);
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

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("DurableDeliveryRepository -- restart recovery", () => {
  it("1. a missing log file replays to empty state", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-delivery-"));
    const repo = new DurableDeliveryRepository(join(dir, "deliveries.ndjson"));
    expect(repo.list()).toEqual([]);
    expect(repo.findById("d-1")).toBeUndefined();
  });

  it("2. save() then a FRESH instance over the same file recovers the exact same state", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-delivery-"));
    const path = join(dir, "deliveries.ndjson");
    const first = new DurableDeliveryRepository(path);
    const d = delivery("d-1");
    first.save(d);

    const second = new DurableDeliveryRepository(path);
    expect(second.findById("d-1")).toEqual(d);
    expect(second.findByOrderId("order-1")).toEqual(d);
  });

  it("3. pending -> fulfilling -> delivered -> completed survives a restart after EVERY step", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-delivery-"));
    const path = join(dir, "deliveries.ndjson");

    const created = delivery("d-1");
    new DurableDeliveryRepository(path).save(created);

    let repo = new DurableDeliveryRepository(path);
    expect(repo.findById("d-1")?.status).toBe("pending");

    const fulfillingResult = applyDeliveryAction(
      created,
      {
        type: "start_fulfillment",
        actor: { kind: "merchant", pubkey: MERCHANT },
        claim: { deliveryId: "d-1", orderId: "order-1", claimedAt: NOW + 1 },
      },
      NOW + 1,
    );
    if (!fulfillingResult.ok) throw new Error("fixture: start_fulfillment failed");
    repo.save(fulfillingResult.delivery);

    repo = new DurableDeliveryRepository(path);
    expect(repo.findById("d-1")?.status).toBe("fulfilling");

    const deliveredResult = applyDeliveryAction(
      fulfillingResult.delivery,
      {
        type: "confirm_delivery",
        actor: { kind: "delivery_evidence" },
        evidence: {
          deliveryId: "d-1",
          orderId: "order-1",
          status: "delivered",
          observedAt: NOW + 2,
          reason: "customer acknowledged receipt",
          verification: { source: "recipient_acknowledgment", authoritative: true, acknowledgedBy: CUSTOMER },
        },
      },
      NOW + 2,
    );
    if (!deliveredResult.ok) throw new Error("fixture: confirm_delivery failed");
    repo.save(deliveredResult.delivery);

    repo = new DurableDeliveryRepository(path);
    expect(repo.findById("d-1")?.status).toBe("delivered");

    const completedResult = applyDeliveryAction(
      deliveredResult.delivery,
      { type: "acknowledge", actor: { kind: "customer", pubkey: CUSTOMER } },
      NOW + 3,
    );
    if (!completedResult.ok) throw new Error("fixture: acknowledge failed");
    repo.save(completedResult.delivery);

    repo = new DurableDeliveryRepository(path);
    const final = repo.findById("d-1");
    expect(final?.status).toBe("completed");
    expect(final?.history).toHaveLength(4);
    expect(final).toEqual(completedResult.delivery);
    // Identity fields survived every restart unchanged.
    expect(final?.orderId).toBe("order-1");
    expect(final?.buyerPubkey).toBe(CUSTOMER);
    expect(final?.sellerPubkey).toBe(MERCHANT);
  });
});

describe("DurableDeliveryRepository -- fail-closed on corruption", () => {
  it("1. a truncated final line throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-delivery-"));
    const path = join(dir, "deliveries.ndjson");
    const d = delivery("d-1");
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, delivery: d }) + "\n", "utf8");
    appendFileSync(path, '{"schemaVersion":1,"delivery":{"id":"d-2","stat', "utf8");
    expect(() => new DurableDeliveryRepository(path)).toThrow();
  });

  it("2. an unknown/future schemaVersion throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-delivery-"));
    const path = join(dir, "deliveries.ndjson");
    const d = delivery("d-1");
    appendFileSync(path, JSON.stringify({ schemaVersion: 3, delivery: d }) + "\n", "utf8");
    expect(() => new DurableDeliveryRepository(path)).toThrow();
  });

  it("3. a duplicate delivery id with conflicting identity fields throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-delivery-"));
    const path = join(dir, "deliveries.ndjson");
    const d = delivery("d-1");
    const conflicting: DeliveryRecord = { ...d, orderId: "order-DIFFERENT" };
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, delivery: d }) + "\n", "utf8");
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, delivery: conflicting }) + "\n", "utf8");
    expect(() => new DurableDeliveryRepository(path)).toThrow();
  });

  it("4. save() itself refuses to persist a record that would change a delivery's identity field", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-delivery-"));
    const path = join(dir, "deliveries.ndjson");
    const repo = new DurableDeliveryRepository(path);
    const d = delivery("d-1");
    repo.save(d);
    const tampered: DeliveryRecord = { ...d, buyerPubkey: "9".repeat(64) };
    expect(() => repo.save(tampered)).toThrow();
  });

  it("5. a non-JSON line throws unconditionally", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-delivery-"));
    const path = join(dir, "deliveries.ndjson");
    writeFileSync(path, "not-json\n", "utf8");
    expect(() => new DurableDeliveryRepository(path)).toThrow();
  });
});
