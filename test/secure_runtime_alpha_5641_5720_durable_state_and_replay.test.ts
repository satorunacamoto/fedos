import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryFedosDeletionRequestStatePersistence } from "../src/os/messenger/conversations/deletion_request/in_memory_fedos_deletion_request_state_persistence.js";
import { AppendOnlyFedosDeletionRequestStatePersistence } from "../src/os/messenger/conversations/deletion_request/append_only_fedos_deletion_request_state_persistence.js";
import type { FedosPersistedDeletionRequestStateRecordV1 } from "../src/os/messenger/conversations/deletion_request/fedos_persisted_deletion_request_state_record_v1.js";
import { InMemoryFedosDeletionRecipientDecisionPersistence } from "../src/os/messenger/conversations/deletion_request/in_memory_fedos_deletion_recipient_decision_persistence.js";
import { AppendOnlyFedosDeletionRecipientDecisionPersistence } from "../src/os/messenger/conversations/deletion_request/append_only_fedos_deletion_recipient_decision_persistence.js";
import type { FedosPersistedDeletionRecipientDecisionRecordV1 } from "../src/os/messenger/conversations/deletion_request/fedos_persisted_deletion_recipient_decision_record_v1.js";
import { InMemoryFedosDeletionAcknowledgementPersistence } from "../src/os/messenger/conversations/deletion_request/in_memory_fedos_deletion_acknowledgement_persistence.js";
import { AppendOnlyFedosDeletionAcknowledgementPersistence } from "../src/os/messenger/conversations/deletion_request/append_only_fedos_deletion_acknowledgement_persistence.js";
import type { FedosPersistedDeletionAcknowledgementRecordV1 } from "../src/os/messenger/conversations/deletion_request/fedos_persisted_deletion_acknowledgement_record_v1.js";

/**
 * Secure Runtime Alpha 5641-5720 -- durable state for all three domains
 * (request lifecycle, recipient decision, acknowledgement): matching
 * duplicate, conflicting duplicate, monotonic-transition enforcement,
 * corruption fail-closed, and restart replay, over BOTH the in-memory
 * and the real append-only NDJSON backends.
 */

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fedos-deletion-request-durable-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function requestSnapshot(overrides: Partial<FedosPersistedDeletionRequestStateRecordV1> = {}): FedosPersistedDeletionRequestStateRecordV1 {
  return {
    schemaVersion: 1,
    requestId: "a".repeat(64),
    bodyHash: "body-hash-1",
    requesterAccountRef: "alice-account",
    recipientAccountRef: "bob-account",
    recipientDeviceRef: "bob-device-a",
    conversationId: "conv-1",
    targetEnvelopeId: "envelope-1",
    scope: "local-history-and-index",
    lifecycleState: "draft",
    issuedAt: 1_700_000_000,
    expiresAt: 1_700_100_000,
    retryCount: 0,
    acknowledgementCorrelationId: null,
    recordedAt: 1_700_000_000,
    ...overrides,
  };
}

describe.each([
  ["in-memory", () => new InMemoryFedosDeletionRequestStatePersistence()],
  ["append-only", () => new AppendOnlyFedosDeletionRequestStatePersistence(join(dir, "request-state.ndjson"))],
] as const)("Secure Runtime Alpha 5641-5720 -- request-state persistence (%s)", (_label, makePersistence) => {
  it("1. the first write for a requestId must be 'draft' -- any other initial state is invalid-initial-state", () => {
    const persistence = makePersistence();
    expect(persistence.putRecord(requestSnapshot({ lifecycleState: "signed" }))).toBe("invalid-initial-state");
    expect(persistence.putRecord(requestSnapshot({ lifecycleState: "draft" }))).toBe("inserted");
  });

  it("2. a matching duplicate write (identical snapshot) is idempotent", () => {
    const persistence = makePersistence();
    const snapshot = requestSnapshot();
    expect(persistence.putRecord(snapshot)).toBe("inserted");
    expect(persistence.putRecord(snapshot)).toBe("already-present");
  });

  it("3. a valid reachable transition (draft->signed) is accepted and becomes the new latest snapshot", () => {
    const persistence = makePersistence();
    persistence.putRecord(requestSnapshot({ lifecycleState: "draft" }));
    const signedSnapshot = requestSnapshot({ lifecycleState: "signed", recordedAt: 1_700_000_010 });
    expect(persistence.putRecord(signedSnapshot)).toBe("inserted");
    expect(persistence.getRecord("a".repeat(64))?.lifecycleState).toBe("signed");
  });

  it("4. an unreachable transition (draft->acknowledged, skipping signed) is rejected", () => {
    const persistence = makePersistence();
    persistence.putRecord(requestSnapshot({ lifecycleState: "draft" }));
    const outcome = persistence.putRecord(requestSnapshot({ lifecycleState: "acknowledged", recordedAt: 1_700_000_010 }));
    expect(outcome).toBe("invalid-transition");
    expect(persistence.getRecord("a".repeat(64))?.lifecycleState).toBe("draft");
  });

  it("5. a conflicting duplicate (same requestId, DIFFERENT bodyHash) is rejected", () => {
    const persistence = makePersistence();
    persistence.putRecord(requestSnapshot({ lifecycleState: "draft", bodyHash: "hash-a" }));
    const outcome = persistence.putRecord(requestSnapshot({ lifecycleState: "signed", bodyHash: "hash-b", recordedAt: 1_700_000_010 }));
    expect(outcome).toBe("conflict");
  });

  it("6. listAllSnapshots reflects every accepted write, in order", () => {
    const persistence = makePersistence();
    persistence.putRecord(requestSnapshot({ lifecycleState: "draft" }));
    persistence.putRecord(requestSnapshot({ lifecycleState: "signed", recordedAt: 1_700_000_010 }));
    persistence.putRecord(requestSnapshot({ lifecycleState: "acknowledged", recordedAt: 1_700_000_020 }));
    const snapshots = persistence.listAllSnapshots();
    expect(snapshots.map((s) => s.lifecycleState)).toEqual(["draft", "signed", "acknowledged"]);
  });

  it("7. a never-seen requestId returns null, never an error", () => {
    const persistence = makePersistence();
    expect(persistence.getRecord("never-seen")).toBeNull();
  });
});

describe("Secure Runtime Alpha 5641-5720 -- request-state restart replay and corruption (real append-only backend)", () => {
  it("8. a fresh persistence instance over the SAME log file replays to the identical latest state", () => {
    const logPath = join(dir, "restart-request-state.ndjson");
    const before = new AppendOnlyFedosDeletionRequestStatePersistence(logPath);
    before.putRecord(requestSnapshot({ lifecycleState: "draft" }));
    before.putRecord(requestSnapshot({ lifecycleState: "signed", recordedAt: 1_700_000_010 }));

    const after = new AppendOnlyFedosDeletionRequestStatePersistence(logPath);
    expect(after.getRecord("a".repeat(64))?.lifecycleState).toBe("signed");
    expect(after.listAllSnapshots()).toHaveLength(2);
  });

  it("9. a corrupt (unparseable) line fails closed on the next read", () => {
    const logPath = join(dir, "corrupt-request-state.ndjson");
    const persistence = new AppendOnlyFedosDeletionRequestStatePersistence(logPath);
    persistence.putRecord(requestSnapshot({ lifecycleState: "draft" }));
    appendFileSync(logPath, "{ not valid json\n", "utf8");
    expect(() => persistence.getRecord("a".repeat(64))).toThrow();
  });

  it("10. a log containing an invalid transition (hand-edited/corrupted) fails closed on replay", () => {
    const logPath = join(dir, "invalid-transition-request-state.ndjson");
    appendFileSync(logPath, JSON.stringify(requestSnapshot({ lifecycleState: "acknowledged" })) + "\n", "utf8");
    const persistence = new AppendOnlyFedosDeletionRequestStatePersistence(logPath);
    expect(() => persistence.getRecord("a".repeat(64))).toThrow();
  });

  it("11. an empty (never-created) log file resolves to zero snapshots, never an error", () => {
    const persistence = new AppendOnlyFedosDeletionRequestStatePersistence(join(dir, "never-written.ndjson"));
    expect(persistence.listAllSnapshots()).toEqual([]);
    expect(persistence.getRecord("anything")).toBeNull();
  });
});

function recipientSnapshot(overrides: Partial<FedosPersistedDeletionRecipientDecisionRecordV1> = {}): FedosPersistedDeletionRecipientDecisionRecordV1 {
  return {
    schemaVersion: 1,
    requestId: "a".repeat(64),
    decisionState: "received",
    suppliedLocalOutcome: null,
    recordedAt: 1_700_000_000,
    ...overrides,
  };
}

describe.each([
  ["in-memory", () => new InMemoryFedosDeletionRecipientDecisionPersistence()],
  ["append-only", () => new AppendOnlyFedosDeletionRecipientDecisionPersistence(join(dir, "recipient-decision.ndjson"))],
] as const)("Secure Runtime Alpha 5641-5720 -- recipient-decision persistence (%s)", (_label, makePersistence) => {
  it("12. the first write must be 'received'", () => {
    const persistence = makePersistence();
    expect(persistence.putRecord(recipientSnapshot({ decisionState: "validated" }))).toBe("invalid-initial-state");
    expect(persistence.putRecord(recipientSnapshot({ decisionState: "received" }))).toBe("inserted");
  });

  it("13. 'locally-applied' is unreachable directly from 'received' -- must pass through validated -> policy-pending -> local-plan-ready first", () => {
    const persistence = makePersistence();
    persistence.putRecord(recipientSnapshot({ decisionState: "received" }));
    const outcome = persistence.putRecord(recipientSnapshot({ decisionState: "locally-applied", suppliedLocalOutcome: "completed", recordedAt: 1_700_000_010 }));
    expect(outcome).toBe("invalid-transition");
  });

  it("14. the full real chain received -> validated -> policy-pending -> local-plan-ready -> locally-applied succeeds", () => {
    const persistence = makePersistence();
    expect(persistence.putRecord(recipientSnapshot({ decisionState: "received" }))).toBe("inserted");
    expect(persistence.putRecord(recipientSnapshot({ decisionState: "validated", recordedAt: 1_700_000_001 }))).toBe("inserted");
    expect(persistence.putRecord(recipientSnapshot({ decisionState: "policy-pending", recordedAt: 1_700_000_002 }))).toBe("inserted");
    expect(persistence.putRecord(recipientSnapshot({ decisionState: "local-plan-ready", recordedAt: 1_700_000_003 }))).toBe("inserted");
    expect(persistence.putRecord(recipientSnapshot({ decisionState: "locally-applied", suppliedLocalOutcome: "completed", recordedAt: 1_700_000_004 }))).toBe("inserted");
    expect(persistence.getRecord("a".repeat(64))?.decisionState).toBe("locally-applied");
  });
});

function ackFact(overrides: Partial<FedosPersistedDeletionAcknowledgementRecordV1> = {}): FedosPersistedDeletionAcknowledgementRecordV1 {
  return {
    schemaVersion: 1,
    requestId: "a".repeat(64),
    acknowledgement: {
      schemaVersion: 1,
      requestId: "a".repeat(64),
      recipientAccountRef: "bob-account",
      recipientDeviceRef: "bob-device-a",
      outcome: "applied-local-history-and-index",
      appliedScopes: ["local-history", "local-index"],
      retainedScopes: [],
      evidenceClass: "local-verified",
      acknowledgedAt: 1_700_050_000,
      protocolVersion: 1,
    },
    wireEventId: "c".repeat(64),
    recordedAt: 1_700_050_000,
    ...overrides,
  };
}

describe.each([
  ["in-memory", () => new InMemoryFedosDeletionAcknowledgementPersistence()],
  ["append-only", () => new AppendOnlyFedosDeletionAcknowledgementPersistence(join(dir, "ack.ndjson"))],
] as const)("Secure Runtime Alpha 5641-5720 -- acknowledgement persistence (%s)", (_label, makePersistence) => {
  it("15. a matching duplicate write is idempotent", () => {
    const persistence = makePersistence();
    const fact = ackFact();
    expect(persistence.putRecord(fact)).toBe("inserted");
    expect(persistence.putRecord(fact)).toBe("already-present");
  });

  it("16. a conflicting duplicate (same requestId, different outcome) is rejected", () => {
    const persistence = makePersistence();
    persistence.putRecord(ackFact());
    const conflicting = ackFact({ acknowledgement: { ...ackFact().acknowledgement, outcome: "failed" } });
    expect(persistence.putRecord(conflicting)).toBe("conflict");
  });

  it("17. restart replay converges to the identical fact (append-only real backend)", () => {
    if (_label !== "append-only") return;
    const logPath = join(dir, "ack-restart.ndjson");
    const before = new AppendOnlyFedosDeletionAcknowledgementPersistence(logPath);
    before.putRecord(ackFact());
    const after = new AppendOnlyFedosDeletionAcknowledgementPersistence(logPath);
    expect(after.getRecord("a".repeat(64))).toEqual(ackFact());
  });
});
