import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppendOnlyFedosDeletionExecutionPersistence } from "../src/os/messenger/conversations/deletion/append_only_fedos_deletion_execution_persistence.js";
import { FedosPayloadRetentionAuthority } from "../src/os/messenger/conversations/retention/fedos_payload_retention_authority.js";
import { InMemoryFedosPayloadRetentionPersistence } from "../src/os/messenger/conversations/retention/in_memory_fedos_payload_retention_persistence.js";
import { InMemoryFedosConversationPayloadStorage } from "../src/os/messenger/conversations/payload_storage/in_memory_fedos_conversation_payload_storage.js";
import { toFedosConversationPayloadId } from "../src/os/messenger/conversations/payload_storage/fedos_conversation_payload_id.js";
import { toFedosConversationId } from "../src/os/messenger/conversations/fedos_conversation_id.js";
import { toFedosBoardId, toFedosThreadId } from "../src/os/messenger/board/fedos_board_identifiers.js";
import { assessFedosLocalPayloadDeletion } from "../src/os/messenger/conversations/deletion/fedos_deletion_assessment.js";
import { buildFedosLocalPayloadDeletionPlan } from "../src/os/messenger/conversations/deletion/fedos_deletion_plan.js";
import { executeFedosLocalPayloadDeletionPlan } from "../src/os/messenger/conversations/deletion/fedos_deletion_execution_coordinator.js";
import type { FedosPersistedDeletionExecutionRecordV1 } from "../src/os/messenger/conversations/deletion/fedos_persisted_deletion_execution_record_v1.js";

/**
 * Secure Runtime Alpha 5401-5480 -- Phase L: restart-safe idempotency,
 * interruption recovery, and corruption fail-closed, over the REAL
 * append-only log backend (`AppendOnlyFedosDeletionExecutionPersistence`),
 * mirroring `AppendOnlyFedosPayloadRetentionPersistence`'s own established
 * test pattern.
 */

const CONVERSATION_ID = toFedosConversationId(toFedosBoardId("board-a")!, toFedosThreadId("thread-1")!);

let dir: string;
let logPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fedos-deletion-restart-"));
  logPath = join(dir, "deletion-execution.ndjson");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function makeRetentionEnvironment(payloadIdRaw: string) {
  const payloadId = toFedosConversationPayloadId(payloadIdRaw)!;
  const payloadStorage = new InMemoryFedosConversationPayloadStorage();
  payloadStorage.putPayload({ id: payloadId, conversationId: CONVERSATION_ID, mediaType: "application/octet-stream", byteLength: 1, createdAt: 1_700_000_000 }, new Uint8Array([7]));
  const retentionAuthority = new FedosPayloadRetentionAuthority({ retentionPersistence: new InMemoryFedosPayloadRetentionPersistence(), payloadStorage, clock: () => 1_700_000_500 });
  return { payloadId, retentionAuthority };
}

describe("Secure Runtime Alpha 5401-5480 -- restart convergence over the real append-only log", () => {
  it("1. a plan executed, then re-executed after a simulated restart (a NEW persistence instance over the SAME log file), converges to the identical durable record", () => {
    const { payloadId, retentionAuthority } = makeRetentionEnvironment("payload-restart-1");
    const searchIndex = { reconcilePayloadRetention: () => 0 };
    const assessment = assessFedosLocalPayloadDeletion(payloadId, { retentionAuthority });
    const plan = buildFedosLocalPayloadDeletionPlan("plan-restart-1", payloadId, assessment);

    const persistenceBeforeRestart = new AppendOnlyFedosDeletionExecutionPersistence(logPath);
    const before = executeFedosLocalPayloadDeletionPlan(
      { plan, requestedBy: "local-user", confirmed: true, authorityReference: "local-user", reasonCode: "user_requested_placeholder" },
      { retentionAuthority, searchIndex, persistence: persistenceBeforeRestart },
    );
    expect(before.outcome).toBe("executed");

    // Simulated restart: an entirely new process would construct a fresh persistence instance over the same log file.
    const persistenceAfterRestart = new AppendOnlyFedosDeletionExecutionPersistence(logPath);
    const after = executeFedosLocalPayloadDeletionPlan(
      { plan, requestedBy: "local-user", confirmed: true, authorityReference: "local-user", reasonCode: "user_requested_placeholder" },
      { retentionAuthority, searchIndex, persistence: persistenceAfterRestart },
    );
    expect(after.outcome).toBe("already-executed");
    if (after.outcome !== "already-executed" || before.outcome !== "executed") throw new Error("unreachable");
    expect(after.record).toEqual(before.record);
  });

  it("2. interruption AFTER the Retention transition but BEFORE the durable execution record is appended: on restart, re-running the SAME plan converges via Retention's own idempotency, and completes durably this time", () => {
    const { payloadId, retentionAuthority } = makeRetentionEnvironment("payload-restart-2");
    const searchIndex = { reconcilePayloadRetention: () => 0 };
    const assessment = assessFedosLocalPayloadDeletion(payloadId, { retentionAuthority });
    const plan = buildFedosLocalPayloadDeletionPlan("plan-restart-2", payloadId, assessment);

    // Simulates a crash after the real Retention transition committed, but before this Arc's own execution
    // record was appended: the Retention Authority's own durable state already reflects "tombstoned".
    const tombstoneOutcome = retentionAuthority.tombstonePayload(payloadId, "local-user", "user_requested_placeholder");
    expect(tombstoneOutcome.outcome).toBe("tombstoned");
    expect(new AppendOnlyFedosDeletionExecutionPersistence(logPath).getRecord("plan-restart-2")).toBeNull();

    // Restart: re-running the identical plan must not throw and must record a real outcome --
    // Retention's own `already-tombstoned` idempotency is what makes this step safe to repeat.
    const persistenceAfterRestart = new AppendOnlyFedosDeletionExecutionPersistence(logPath);
    const after = executeFedosLocalPayloadDeletionPlan(
      { plan, requestedBy: "local-user", confirmed: true, authorityReference: "local-user", reasonCode: "user_requested_placeholder" },
      { retentionAuthority, searchIndex, persistence: persistenceAfterRestart },
    );
    expect(after.outcome).toBe("executed");
    if (after.outcome !== "executed") throw new Error("unreachable");
    expect(after.record.steps[0]).toMatchObject({ target: "local-payload", outcome: "already-applied" });
    expect(after.record.status).toBe("completed");
  });

  it("3. a conflicting duplicate planId (different canonicalTargetRef) written into the SAME log file fails closed on the next read, never silently picks one", () => {
    const persistence = new AppendOnlyFedosDeletionExecutionPersistence(logPath);
    const recordA: FedosPersistedDeletionExecutionRecordV1 = {
      schemaVersion: 1,
      id: "plan-conflict",
      planId: "plan-conflict",
      requestedBy: "local-user",
      canonicalTargetRef: "payload-a",
      steps: [],
      warnings: [],
      status: "completed",
      recordedAt: 1_700_000_000,
    };
    expect(persistence.putRecord(recordA)).toBe("inserted");

    // Simulates a second, divergent process appending a conflicting record for the identical planId
    // (e.g. two concurrent local sessions racing on the same log) directly at the storage layer.
    const recordB: FedosPersistedDeletionExecutionRecordV1 = { ...recordA, canonicalTargetRef: "payload-b" };
    appendFileSync(logPath, JSON.stringify(recordB) + "\n", "utf8");

    expect(() => persistence.getRecord("plan-conflict")).toThrow(/conflicting duplicate records/);
    expect(() => persistence.listRecords()).toThrow(/conflicting duplicate records/);
  });

  it("4. a corrupt (unparseable) line in the log file fails closed -- getRecord/listRecords both throw, never silently skip", () => {
    const persistence = new AppendOnlyFedosDeletionExecutionPersistence(logPath);
    const record: FedosPersistedDeletionExecutionRecordV1 = {
      schemaVersion: 1,
      id: "plan-corrupt",
      planId: "plan-corrupt",
      requestedBy: "local-user",
      canonicalTargetRef: "payload-corrupt",
      steps: [],
      warnings: [],
      status: "completed",
      recordedAt: 1_700_000_000,
    };
    expect(persistence.putRecord(record)).toBe("inserted");
    appendFileSync(logPath, "{ this is not valid json\n", "utf8");

    expect(() => persistence.getRecord("plan-corrupt")).toThrow();
    expect(() => persistence.listRecords()).toThrow();
  });

  it("5. re-inserting the identical record for an already-present planId is a durable no-op ('already-present'), never a duplicate log line", () => {
    const persistence = new AppendOnlyFedosDeletionExecutionPersistence(logPath);
    const record: FedosPersistedDeletionExecutionRecordV1 = {
      schemaVersion: 1,
      id: "plan-repeat-insert",
      planId: "plan-repeat-insert",
      requestedBy: "local-user",
      canonicalTargetRef: "payload-repeat",
      steps: [],
      warnings: [],
      status: "completed",
      recordedAt: 1_700_000_000,
    };
    expect(persistence.putRecord(record)).toBe("inserted");
    expect(persistence.putRecord(record)).toBe("already-present");
    expect(persistence.listRecords()).toHaveLength(1);
  });

  it("6. an empty (never-created) log file resolves to zero records, never an error -- a fresh Arc worktree has no prior state", () => {
    const persistence = new AppendOnlyFedosDeletionExecutionPersistence(join(dir, "never-written.ndjson"));
    expect(persistence.listRecords()).toEqual([]);
    expect(persistence.getRecord("anything")).toBeNull();
  });
});
