import { describe, it, expect, afterEach } from "vitest";
// @ts-expect-error `node:fs` has no type declarations without `@types/node` in this project's tsconfig.
import { mkdtempSync, rmSync, appendFileSync, writeFileSync, readFileSync } from "node:fs";
// @ts-expect-error `node:os` has no type declarations without `@types/node` in this project's tsconfig.
import { tmpdir } from "node:os";
// @ts-expect-error `node:path` has no type declarations without `@types/node` in this project's tsconfig.
import { join } from "node:path";
import { DurablePaymentSettlementLedger } from "../src/os/commerce/payment/persistence/durable_payment_settlement_ledger.js";
import type { PaymentSettlementState } from "../src/os/commerce/payment/state_machine.js";
import type { PaymentEvidence } from "../src/os/commerce/payment/types.js";

/**
 * Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL
 * Closure arc (Agent D) — DurablePaymentSettlementLedger.
 */

function authoritativeEvidence(overrides: Partial<PaymentEvidence> = {}): PaymentEvidence {
  return {
    paymentId: "payment-1",
    productId: "prod-1",
    observedAt: Math.floor(Date.now() / 1000),
    status: "settled",
    reason: "test evidence",
    verification: { source: "test_simulator", authoritative: true, simulator: "DeterministicLocalPaymentProvider" },
    ...overrides,
  };
}

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

describe("DurablePaymentSettlementLedger -- restart recovery", () => {
  it("1. a missing log file replays to empty state", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const ledger = new DurablePaymentSettlementLedger(join(dir, "settlements.ndjson"));
    expect(ledger.get("payment-1")).toBeUndefined();
  });

  it("2. bind() then a FRESH instance over the same file recovers the exact same pending state", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const path = join(dir, "settlements.ndjson");
    const first = new DurablePaymentSettlementLedger(path);
    const bound = first.bind("payment-1", "order-1", "prod-1", 1_700_000_000);
    expect(bound.status).toBe("pending");

    const second = new DurablePaymentSettlementLedger(path);
    expect(second.get("payment-1")).toEqual(bound);
  });

  it("3. bind -> settle -> refund survives a restart after EVERY step (mid-transaction restart)", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const path = join(dir, "settlements.ndjson");

    let ledger: DurablePaymentSettlementLedger = new DurablePaymentSettlementLedger(path);
    ledger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);

    ledger = new DurablePaymentSettlementLedger(path);
    expect(ledger.get("payment-1")?.status).toBe("pending");

    const paidResult = ledger.apply(authoritativeEvidence({ status: "settled" }), "order-1");
    expect(paidResult.outcome).toBe("transitioned");

    ledger = new DurablePaymentSettlementLedger(path);
    expect(ledger.get("payment-1")?.status).toBe("paid");
    expect(ledger.get("payment-1")?.history).toHaveLength(1);

    const refundResult = ledger.apply(authoritativeEvidence({ status: "refunded" }), "order-1");
    expect(refundResult.outcome).toBe("transitioned");

    ledger = new DurablePaymentSettlementLedger(path);
    const final = ledger.get("payment-1");
    expect(final?.status).toBe("refunded");
    expect(final?.history).toHaveLength(2);
    // Identity fields survived every restart unchanged.
    expect(final?.orderId).toBe("order-1");
    expect(final?.productId).toBe("prod-1");
    expect(final?.createdAt).toBe(1_700_000_000);
  });

  it("4. a no_op/rejected apply() is never durably persisted -- a restart still shows the pre-apply state", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const path = join(dir, "settlements.ndjson");
    let ledger: DurablePaymentSettlementLedger = new DurablePaymentSettlementLedger(path);
    ledger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);

    // Wrong-order evidence -- rejected, must not be written to the log.
    const rejected = ledger.apply(authoritativeEvidence({ status: "settled" }), "some-other-order");
    expect(rejected.outcome).toBe("rejected");

    ledger = new DurablePaymentSettlementLedger(path);
    expect(ledger.get("payment-1")?.status).toBe("pending");
  });

  it("5. bind() on an already-bound paymentId throws, even when the binding is only known via replay", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const path = join(dir, "settlements.ndjson");
    new DurablePaymentSettlementLedger(path).bind("payment-1", "order-1", "prod-1", 1_700_000_000);

    const restarted = new DurablePaymentSettlementLedger(path);
    expect(() => restarted.bind("payment-1", "order-1", "prod-1", 1_700_000_000)).toThrow();
  });
});

describe("DurablePaymentSettlementLedger -- fail-closed on corruption", () => {
  it("1. a truncated final line throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const path = join(dir, "settlements.ndjson");
    const state: PaymentSettlementState = {
      paymentId: "payment-1",
      orderId: "order-1",
      productId: "prod-1",
      status: "pending",
      createdAt: 1_700_000_000,
      updatedAt: 1_700_000_000,
      history: [],
    };
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, state }) + "\n", "utf8");
    appendFileSync(path, '{"schemaVersion":1,"state":{"paymentId":"payment-2"', "utf8");
    expect(() => new DurablePaymentSettlementLedger(path)).toThrow();
  });

  it("2. an unknown/future schemaVersion throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const path = join(dir, "settlements.ndjson");
    const state: PaymentSettlementState = {
      paymentId: "payment-1",
      orderId: "order-1",
      productId: "prod-1",
      status: "pending",
      createdAt: 1_700_000_000,
      updatedAt: 1_700_000_000,
      history: [],
    };
    appendFileSync(path, JSON.stringify({ schemaVersion: 7, state }) + "\n", "utf8");
    expect(() => new DurablePaymentSettlementLedger(path)).toThrow();
  });

  it("3. a duplicate paymentId with conflicting identity fields throws on construction", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const path = join(dir, "settlements.ndjson");
    const state: PaymentSettlementState = {
      paymentId: "payment-1",
      orderId: "order-1",
      productId: "prod-1",
      status: "pending",
      createdAt: 1_700_000_000,
      updatedAt: 1_700_000_000,
      history: [],
    };
    const conflicting: PaymentSettlementState = { ...state, orderId: "order-DIFFERENT" };
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, state }) + "\n", "utf8");
    appendFileSync(path, JSON.stringify({ schemaVersion: 1, state: conflicting }) + "\n", "utf8");
    expect(() => new DurablePaymentSettlementLedger(path)).toThrow();
  });

  it("4. a non-JSON line throws unconditionally", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const path = join(dir, "settlements.ndjson");
    writeFileSync(path, "garbage\n", "utf8");
    expect(() => new DurablePaymentSettlementLedger(path)).toThrow();
  });

  it("5. no raw secret is ever written -- persisted records only ever contain opaque ids, a closed-vocabulary status, timestamps, and audit history", () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const path = join(dir, "settlements.ndjson");
    const ledger = new DurablePaymentSettlementLedger(path);
    ledger.bind("payment-1", "order-1", "prod-1", 1_700_000_000);
    ledger.apply(authoritativeEvidence({ status: "settled" }), "order-1");

    const contents = readFileSync(path, "utf8") as string;
    const lines = contents.split("\n").filter((l: string) => l.trim().length > 0);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(Object.keys(parsed.state).sort()).toEqual(
        ["createdAt", "history", "orderId", "paymentId", "productId", "status", "updatedAt"].sort(),
      );
    }
  });
});
