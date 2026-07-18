import { describe, it, expect } from "vitest";
import { FedosSyncJournal, type FedosSyncJournalEntryV1 } from "../src/sync/fedos_sync_journal.js";
import { FedosSyncCursorStore } from "../src/sync/fedos_sync_cursor.js";
import { FedosSyncOutboundQueue } from "../src/sync/fedos_sync_queue.js";
import { FedosSyncPendingChangeQueue } from "../src/sync/fedos_sync_pending_changes.js";
import { classifyFedosSyncConflict } from "../src/sync/fedos_sync_conflict.js";

function change(overrides: Partial<Omit<FedosSyncJournalEntryV1, "sequence">> = {}): Omit<FedosSyncJournalEntryV1, "sequence"> {
  return {
    changeId: "c1",
    accountRef: "acct-1",
    originDeviceRef: "dev-A",
    conversationId: "conv-1",
    kind: "upsert",
    contentHash: "hash-1",
    recordedAt: 1,
    ...overrides,
  };
}

describe("Secure Runtime Alpha 2421-2500 -- Sync Journal", () => {
  it("assigns monotonically increasing sequence numbers in append order", () => {
    const journal = new FedosSyncJournal();
    const r1 = journal.append(change({ changeId: "c1" }));
    const r2 = journal.append(change({ changeId: "c2" }));
    const r3 = journal.append(change({ changeId: "c3" }));
    expect([r1.entry.sequence, r2.entry.sequence, r3.entry.sequence]).toEqual([1, 2, 3]);
    expect(journal.latestSequence()).toBe(3);
  });

  it("re-appending an already-known changeId is a no-op that reports 'duplicate' and returns the ORIGINAL entry", () => {
    const journal = new FedosSyncJournal();
    const first = journal.append(change({ changeId: "c1", contentHash: "hash-1" }));
    const second = journal.append(change({ changeId: "c1", contentHash: "hash-DIFFERENT" }));
    expect(first.outcome).toBe("appended");
    expect(second.outcome).toBe("duplicate");
    expect(second.entry).toEqual(first.entry);
    expect(journal.readAll().length).toBe(1);
  });

  it("readFrom(cursorSequence) returns only strictly-later entries, in order; readAll/getByChangeId/latestSequence behave on an empty journal", () => {
    const journal = new FedosSyncJournal();
    expect(journal.readAll()).toEqual([]);
    expect(journal.latestSequence()).toBe(0);
    expect(journal.getByChangeId("nope")).toBeNull();

    journal.append(change({ changeId: "c1" }));
    journal.append(change({ changeId: "c2" }));
    journal.append(change({ changeId: "c3" }));

    expect(journal.readFrom(0).map((e) => e.changeId)).toEqual(["c1", "c2", "c3"]);
    expect(journal.readFrom(1).map((e) => e.changeId)).toEqual(["c2", "c3"]);
    expect(journal.readFrom(3)).toEqual([]);
    expect(journal.getByChangeId("c2")?.sequence).toBe(2);
  });
});

describe("Secure Runtime Alpha 2421-2500 -- Sync Cursor", () => {
  it("defaults an unknown device's cursor to sequence 0", () => {
    const cursors = new FedosSyncCursorStore();
    expect(cursors.get("dev-A")).toEqual({ deviceRef: "dev-A", sequence: 0, updatedAt: 0 });
  });

  it("advance() is monotonic-only -- a lower/equal sequence never regresses the cursor", () => {
    const cursors = new FedosSyncCursorStore();
    cursors.advance("dev-A", 5, 100);
    expect(cursors.get("dev-A").sequence).toBe(5);
    cursors.advance("dev-A", 3, 200);
    expect(cursors.get("dev-A").sequence).toBe(5);
    cursors.advance("dev-A", 7, 300);
    expect(cursors.get("dev-A").sequence).toBe(7);
  });

  it("reset() discards a device's cursor back to the default", () => {
    const cursors = new FedosSyncCursorStore();
    cursors.advance("dev-A", 5, 100);
    cursors.reset("dev-A");
    expect(cursors.get("dev-A").sequence).toBe(0);
  });

  it("list() reflects every device with an advanced cursor", () => {
    const cursors = new FedosSyncCursorStore();
    cursors.advance("dev-A", 5, 100);
    cursors.advance("dev-B", 2, 100);
    expect(cursors.list().map((c) => c.deviceRef).sort()).toEqual(["dev-A", "dev-B"]);
  });
});

describe("Secure Runtime Alpha 2421-2500 -- Sync Queue (outbound)", () => {
  it("enqueueForDevice is idempotent per (targetDeviceRef, changeId)", () => {
    const queue = new FedosSyncOutboundQueue();
    const entry = { ...change({ changeId: "c1" }), sequence: 1 };
    expect(queue.enqueueForDevice("dev-B", entry, 100)).toBe("queued");
    expect(queue.enqueueForDevice("dev-B", entry, 200)).toBe("already-queued");
    expect(queue.listForDevice("dev-B").length).toBe(1);
  });

  it("state transitions: queued -> delivered -> acknowledged; unknown pairs report false", () => {
    const queue = new FedosSyncOutboundQueue();
    const entry = { ...change({ changeId: "c1" }), sequence: 1 };
    queue.enqueueForDevice("dev-B", entry, 100);

    expect(queue.markDelivered("dev-ghost", "c1", 100)).toBe(false);
    expect(queue.markDelivered("dev-B", "c1", 150)).toBe(true);
    expect(queue.listForDevice("dev-B")[0]?.state).toBe("delivered");

    expect(queue.markAcknowledged("dev-B", "c1", 200)).toBe(true);
    expect(queue.listForDevice("dev-B")[0]?.state).toBe("acknowledged");
  });

  it("listPendingForDevice includes queued+failed, excludes delivered/acknowledged; listDeliveredForDevice includes only delivered", () => {
    const queue = new FedosSyncOutboundQueue();
    queue.enqueueForDevice("dev-B", { ...change({ changeId: "c1" }), sequence: 1 }, 100);
    queue.enqueueForDevice("dev-B", { ...change({ changeId: "c2" }), sequence: 2 }, 100);
    queue.enqueueForDevice("dev-B", { ...change({ changeId: "c3" }), sequence: 3 }, 100);
    queue.markDelivered("dev-B", "c2", 110);
    queue.markFailed("dev-B", "c3", 110);

    expect(queue.listPendingForDevice("dev-B").map((e) => e.entry.changeId).sort()).toEqual(["c1", "c3"]);
    expect(queue.listDeliveredForDevice("dev-B").map((e) => e.entry.changeId)).toEqual(["c2"]);
  });
});

describe("Secure Runtime Alpha 2421-2500 -- Pending Changes", () => {
  it("enqueue is idempotent per changeId, reporting 'duplicate' on a repeat", () => {
    const pending = new FedosSyncPendingChangeQueue();
    const entry = { ...change({ changeId: "c1" }), sequence: 1 };
    expect(pending.enqueue(entry)).toBe("enqueued");
    expect(pending.enqueue(entry)).toBe("duplicate");
    expect(pending.size()).toBe(1);
  });

  it("listPending is sorted ascending by sequence regardless of enqueue order", () => {
    const pending = new FedosSyncPendingChangeQueue();
    pending.enqueue({ ...change({ changeId: "c3" }), sequence: 3 });
    pending.enqueue({ ...change({ changeId: "c1" }), sequence: 1 });
    pending.enqueue({ ...change({ changeId: "c2" }), sequence: 2 });
    expect(pending.listPending().map((e) => e.changeId)).toEqual(["c1", "c2", "c3"]);
  });

  it("mark*/isResolved/listResolved reflect exactly the resolved distinction, and enqueue never re-stages a resolved changeId", () => {
    const pending = new FedosSyncPendingChangeQueue();
    const entry = { ...change({ changeId: "c1" }), sequence: 1 };
    pending.enqueue(entry);
    expect(pending.isResolved("c1")).toBe(false);
    pending.markApplied("c1");
    expect(pending.isResolved("c1")).toBe(true);
    expect(pending.listPending()).toEqual([]);
    expect(pending.listResolved()).toEqual([{ entry, status: "applied" }]);
    expect(pending.enqueue(entry)).toBe("duplicate");
  });

  it("seedResolved stages a changeId directly as resolved, bypassing the pending state entirely", () => {
    const pending = new FedosSyncPendingChangeQueue();
    const entry = { ...change({ changeId: "c1" }), sequence: 1 };
    pending.seedResolved(entry, "applied");
    expect(pending.isResolved("c1")).toBe(true);
    expect(pending.listPending()).toEqual([]);
    expect(pending.enqueue(entry)).toBe("duplicate");
  });
});

describe("Secure Runtime Alpha 2421-2500 -- Conflict Vocabulary", () => {
  it("classifies 'none' when nothing has been applied yet", () => {
    const incoming = { ...change({ changeId: "c1" }), sequence: 1 };
    expect(classifyFedosSyncConflict(null, incoming)).toBe("none");
  });

  it("classifies the same changeId re-seen as 'duplicate'", () => {
    const lastApplied = { ...change({ changeId: "c1" }), sequence: 1 };
    const incoming = { ...change({ changeId: "c1", contentHash: "different" }), sequence: 1 };
    expect(classifyFedosSyncConflict(lastApplied, incoming)).toBe("duplicate");
  });

  it("classifies an upsert arriving after a tombstone as 'tombstone-vs-upsert'", () => {
    const lastApplied = { ...change({ changeId: "c1", kind: "tombstone" }), sequence: 1 };
    const incoming = { ...change({ changeId: "c2", kind: "upsert" }), sequence: 2 };
    expect(classifyFedosSyncConflict(lastApplied, incoming)).toBe("tombstone-vs-upsert");
  });

  it("classifies two different devices' changes to the same conversation as 'concurrent-update'", () => {
    const lastApplied = { ...change({ changeId: "c1", originDeviceRef: "dev-A" }), sequence: 1 };
    const incoming = { ...change({ changeId: "c2", originDeviceRef: "dev-B" }), sequence: 2 };
    expect(classifyFedosSyncConflict(lastApplied, incoming)).toBe("concurrent-update");
  });

  it("classifies the SAME device's own next edit as 'none'", () => {
    const lastApplied = { ...change({ changeId: "c1", originDeviceRef: "dev-A" }), sequence: 1 };
    const incoming = { ...change({ changeId: "c2", originDeviceRef: "dev-A" }), sequence: 2 };
    expect(classifyFedosSyncConflict(lastApplied, incoming)).toBe("none");
  });
});
