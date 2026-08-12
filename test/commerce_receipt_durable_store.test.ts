import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurableReceiptStore } from "../src/os/commerce/receipt/persistence/durable_receipt_store.js";

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) — friction-ledger row #5 / arc §33: proves the concrete fix
 * for "signed receipt is not durably persisted; silently disappears after
 * a real app restart, regenerating on every call with no separate
 * storage." Every test below exercises the SAME `putIfAbsent()`/
 * `getByOrderId()` contract `handleCommerceReceiptIssue()`
 * (`fedos_electron_beta_main.cts`) actually calls.
 */

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});
function freshFile(): string {
  const d = mkdtempSync(join(tmpdir(), "fedos-receipt-store-"));
  dir = d;
  return join(d, "receipts.ndjson");
}

const SAMPLE_ENVELOPE = { version: 1, type: "fedos.trust.envelope.v1", payload: { orderId: "order-1", kind: "trade_completion" }, signature: "deadbeef" };

describe("DurableReceiptStore — idempotent issuance (the concrete row #5 fix)", () => {
  it("the FIRST putIfAbsent for an orderId durably records it and returns 'inserted'", () => {
    const store = new DurableReceiptStore(freshFile());
    expect(store.getByOrderId("order-1")).toBeUndefined();
    const result = store.putIfAbsent("order-1", SAMPLE_ENVELOPE, 1_000);
    expect(result).toBe("inserted");
    const stored = store.getByOrderId("order-1");
    expect(stored?.envelope).toEqual(SAMPLE_ENVELOPE);
    expect(stored?.issuedAt).toBe(1_000);
  });

  it("a SECOND putIfAbsent for the SAME orderId is a no-op ('already-present'), never overwrites, never mints a second envelope", () => {
    const store = new DurableReceiptStore(freshFile());
    store.putIfAbsent("order-1", SAMPLE_ENVELOPE, 1_000);
    const differentEnvelope = { ...SAMPLE_ENVELOPE, signature: "cafebabe" };
    const result = store.putIfAbsent("order-1", differentEnvelope, 2_000);
    expect(result).toBe("already-present");
    // The ORIGINAL envelope/issuedAt survives — the second call's
    // (different) envelope was never persisted.
    const stored = store.getByOrderId("order-1");
    expect(stored?.envelope).toEqual(SAMPLE_ENVELOPE);
    expect(stored?.issuedAt).toBe(1_000);
  });

  it("different orderIds are independent — each gets its own durable record", () => {
    const store = new DurableReceiptStore(freshFile());
    store.putIfAbsent("order-1", SAMPLE_ENVELOPE, 1_000);
    store.putIfAbsent("order-2", { ...SAMPLE_ENVELOPE, payload: { ...SAMPLE_ENVELOPE.payload, orderId: "order-2" } }, 2_000);
    expect(store.getByOrderId("order-1")?.issuedAt).toBe(1_000);
    expect(store.getByOrderId("order-2")?.issuedAt).toBe(2_000);
  });
});

describe("DurableReceiptStore — real restart simulation (the actual property this file closes)", () => {
  it("a receipt issued by 'launch 1' is durably visible to a FRESH store instance ('launch 2') over the SAME file, with byte-identical content", () => {
    const filePath = freshFile();

    // "Launch 1": issues + persists a receipt for order-1.
    const launch1 = new DurableReceiptStore(filePath);
    const result = launch1.putIfAbsent("order-1", SAMPLE_ENVELOPE, 1_000);
    expect(result).toBe("inserted");

    // "Launch 2" (restart): a brand-new store instance replays the SAME
    // file from scratch — no in-memory state carried over.
    const launch2 = new DurableReceiptStore(filePath);
    const restored = launch2.getByOrderId("order-1");
    expect(restored).toBeDefined();
    expect(restored?.envelope).toEqual(SAMPLE_ENVELOPE);
    expect(restored?.issuedAt).toBe(1_000);

    // And a SECOND issuance attempt under launch 2 is STILL idempotent —
    // the durability survives the restart, not just the in-process cache.
    const secondAttempt = launch2.putIfAbsent("order-1", { ...SAMPLE_ENVELOPE, signature: "different" }, 9_999);
    expect(secondAttempt).toBe("already-present");
  });
});

describe("DurableReceiptStore — fails closed on disk corruption, never silently drops or fabricates", () => {
  it("a corrupted (non-JSON) line in the NDJSON file makes the constructor throw", () => {
    const filePath = freshFile();
    writeFileSync(filePath, "not valid json at all\n", "utf8");
    expect(() => new DurableReceiptStore(filePath)).toThrow();
  });

  it("a schema-invalid line (missing required field) makes the constructor throw", () => {
    const filePath = freshFile();
    writeFileSync(filePath, JSON.stringify({ schemaVersion: 1, orderId: "order-1" }) + "\n", "utf8");
    expect(() => new DurableReceiptStore(filePath)).toThrow();
  });

  it("two DIFFERENT envelopes claiming the same orderId is corruption — throws rather than silently picking a winner", () => {
    const filePath = freshFile();
    const line1 = JSON.stringify({ schemaVersion: 1, orderId: "order-1", envelope: SAMPLE_ENVELOPE, issuedAt: 1_000 });
    const line2 = JSON.stringify({ schemaVersion: 1, orderId: "order-1", envelope: { ...SAMPLE_ENVELOPE, signature: "other" }, issuedAt: 1_000 });
    writeFileSync(filePath, line1 + "\n" + line2 + "\n", "utf8");
    expect(() => new DurableReceiptStore(filePath)).toThrow();
  });

  it("a missing file (never issued anything yet) is an ordinary empty state, not an error", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fedos-receipt-store-"));
    dir = tempDir;
    const filePath = join(tempDir, "does-not-exist-yet.ndjson");
    expect(() => new DurableReceiptStore(filePath)).not.toThrow();
    const store = new DurableReceiptStore(filePath);
    expect(store.getByOrderId("anything")).toBeUndefined();
  });
});
