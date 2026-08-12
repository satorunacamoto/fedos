import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurablePaymentSettlementLedger } from "../src/os/commerce/payment/persistence/durable_payment_settlement_ledger.js";
import type { PaymentSettlementState } from "../src/os/commerce/payment/state_machine.js";
import type { PaymentEvidence } from "../src/os/commerce/payment/types.js";
import { DeterministicLocalPaymentProvider } from "../src/os/commerce/payment/local_simulator.js";

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

describe("DeterministicLocalPaymentProvider x DurablePaymentSettlementLedger -- restart-safe payment ids (Commerce Mainline Integration, regression for a real disclosed defect)", () => {
  it("6. a payment requested by a FRESH provider instance (simulating a process restart) never collides with an id already durably bound by a PRIOR instance over the SAME ledger file", async () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const path = join(dir, "settlements.ndjson");

    // Launch 1: fresh provider + fresh ledger view over the file, exactly
    // as the Electron main process constructs both on every real launch.
    const providerLaunch1 = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const ledgerLaunch1 = new DurablePaymentSettlementLedger(path);
    const decisionOne = await providerLaunch1.requestPayment({
      productId: "prod-1",
      orderId: "order-1",
      amountCents: 1000,
      currency: "USD",
      rail: "manual_placeholder",
    });
    expect(decisionOne.allowed).toBe(true);
    expect(decisionOne.paymentId).toBeDefined();
    ledgerLaunch1.bind(decisionOne.paymentId!, "order-1", "prod-1");

    // Launch 2 ("restart"): a genuinely NEW provider instance -- before the
    // fix, its in-memory `#nextId` counter always restarted at 0, so its
    // very first payment always re-minted the exact same id
    // ("local-sim-payment-1") the FIRST provider instance already
    // durably bound above, and this second `bind()` call threw.
    const providerLaunch2 = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
    const ledgerLaunch2 = new DurablePaymentSettlementLedger(path);
    const decisionTwo = await providerLaunch2.requestPayment({
      productId: "prod-2",
      orderId: "order-2",
      amountCents: 2000,
      currency: "USD",
      rail: "manual_placeholder",
    });
    expect(decisionTwo.allowed).toBe(true);
    expect(decisionTwo.paymentId).toBeDefined();

    // The actual regression assertion: this must NOT throw.
    expect(() => ledgerLaunch2.bind(decisionTwo.paymentId!, "order-2", "prod-2")).not.toThrow();

    // And the two ids must be genuinely distinct (not just non-throwing by
    // accident) -- both orders' payments must be independently resolvable.
    expect(decisionTwo.paymentId).not.toBe(decisionOne.paymentId);
    expect(ledgerLaunch2.get(decisionOne.paymentId!)?.orderId).toBe("order-1");
    expect(ledgerLaunch2.get(decisionTwo.paymentId!)?.orderId).toBe("order-2");
  });

  it("7. a THIRD fresh provider instance's first-ever payment id still never collides, across many simulated restarts", async () => {
    dir = mkdtempSync(join(tmpdir(), "fedos-durable-payment-"));
    const path = join(dir, "settlements.ndjson");
    const seenIds = new Set<string>();

    for (let restart = 0; restart < 25; restart += 1) {
      const provider = new DeterministicLocalPaymentProvider({ acknowledgeTestOnly: true });
      const ledger = new DurablePaymentSettlementLedger(path);
      const decision = await provider.requestPayment({
        productId: `prod-${restart}`,
        orderId: `order-${restart}`,
        amountCents: 500,
        currency: "USD",
        rail: "manual_placeholder",
      });
      expect(decision.allowed).toBe(true);
      const paymentId = decision.paymentId!;
      expect(seenIds.has(paymentId)).toBe(false);
      seenIds.add(paymentId);
      expect(() => ledger.bind(paymentId, `order-${restart}`, `prod-${restart}`)).not.toThrow();
    }
    expect(seenIds.size).toBe(25);
  });
});
