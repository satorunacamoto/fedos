import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { AppendOnlyFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/append_only_fedos_payload_retention_persistence.js";
import type { FedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/fedos_payload_retention_persistence.js";
import type { FedosPersistedPayloadRetentionDecisionV1 } from "../src/os/messenger/conversations/retention/fedos_persisted_payload_retention_decision_v1.js";

const RECORD: FedosPersistedPayloadRetentionDecisionV1 = {
  schemaVersion: 1,
  id: "payload-1::tombstoned",
  payloadId: "payload-1",
  action: "tombstoned",
  decidedAt: 1_700_000_000,
  authorityReference: null,
  reasonCode: "test_placeholder",
};

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function backends(): Array<[string, () => FedosPayloadRetentionPersistence]> {
  return [
    ["InMemory", () => new InMemoryFedosPayloadRetentionPersistence()],
    [
      "AppendOnly",
      () => {
        dir = mkdtempSync(join(tmpdir(), "a796-"));
        return new AppendOnlyFedosPayloadRetentionPersistence(join(dir, "retention.ndjson"));
      },
    ],
  ];
}

/**
 * Secure Runtime Alpha 796 ("Retention Authority Boundary") -- Stage 6
 * of the Alpha 791-820 Conversation Retention & Private Payload
 * Storage Boundary Foundation Arc. Verified against BOTH backends,
 * mirroring this Arc's own established pattern.
 */
describe.each(backends())("Secure Runtime Alpha 796 -- FedosPayloadRetentionPersistence (%s)", (_name, make) => {
  it("insert: a genuinely new decision is accepted", () => {
    const persistence = make();
    expect(persistence.putDecision(RECORD)).toBe("inserted");
    expect(persistence.getDecision("payload-1" as any, "tombstoned")).toEqual(RECORD);
  });

  it("idempotent duplicate: identical content returns already-present", () => {
    const persistence = make();
    persistence.putDecision(RECORD);
    expect(persistence.putDecision({ ...RECORD })).toBe("already-present");
  });

  it("conflict never overwrites: different content for the same key is rejected", () => {
    const persistence = make();
    persistence.putDecision(RECORD);
    expect(persistence.putDecision({ ...RECORD, decidedAt: 1 })).toBe("conflict");
    expect(persistence.getDecision("payload-1" as any, "tombstoned")?.decidedAt).toBe(RECORD.decidedAt);
  });

  it("a DIFFERENT action for the same payloadId is a separate, valid record -- not a conflict", () => {
    const persistence = make();
    persistence.putDecision(RECORD);
    const removed: FedosPersistedPayloadRetentionDecisionV1 = {
      ...RECORD,
      id: "payload-1::payload-removed",
      action: "payload-removed",
      decidedAt: 1_700_000_100,
    };
    expect(persistence.putDecision(removed)).toBe("inserted");
    expect(persistence.listDecisionsForPayload("payload-1" as any)).toHaveLength(2);
  });

  it("getDecision returns null for a nonexistent (payloadId, action) pair", () => {
    const persistence = make();
    expect(persistence.getDecision("does-not-exist" as any, "tombstoned")).toBeNull();
  });

  it("listDecisions returns every record across every payload", () => {
    const persistence = make();
    persistence.putDecision(RECORD);
    persistence.putDecision({ ...RECORD, id: "payload-2::tombstoned", payloadId: "payload-2" });
    expect(persistence.listDecisions()).toHaveLength(2);
  });
});

describe("Secure Runtime Alpha 796 -- AppendOnlyFedosPayloadRetentionPersistence structural", () => {
  it("constructing does not create the file -- no constructor I/O", () => {
    dir = mkdtempSync(join(tmpdir(), "a796-"));
    const filePath = join(dir, "retention.ndjson");
    new AppendOnlyFedosPayloadRetentionPersistence(filePath);
    expect(existsSync(filePath)).toBe(false);
  });

  it("a malformed trailing line fails closed -- throws, never silently repaired", () => {
    dir = mkdtempSync(join(tmpdir(), "a796-"));
    const filePath = join(dir, "retention.ndjson");
    appendFileSync(filePath, JSON.stringify(RECORD) + "\n{not valid json", "utf8");
    const persistence = new AppendOnlyFedosPayloadRetentionPersistence(filePath);
    expect(() => persistence.listDecisions()).toThrow();
  });
});
