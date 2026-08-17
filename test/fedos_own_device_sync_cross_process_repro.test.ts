import { describe, it, expect } from "vitest";
import { FedosSyncState, type FedosSyncLocalChangeInput } from "../src/os/messenger/sync/fedos_sync_state.js";
import type { FedosSyncJournalEntryV1 } from "../src/os/messenger/sync/fedos_sync_journal.js";

/**
 * Own-Device Sync Protocol Final Closure arc — resolves, with a real test
 * rather than more reading, exactly how a real cross-process transport
 * should feed a remote device's own Sync Journal entries into the
 * RECEIVING process's own separate `FedosSyncState` instance.
 *
 * `FedosSyncState`'s own header says "delivery is a Sync Queue state
 * transition (deliverQueuedChanges()/redeliverChange()), driven by ... a
 * future transport wiring" -- this suggests `redeliverChange()` is the
 * intended direct-staging primitive for exactly this case, but that was
 * never verified against a real two-instance (two-process) scenario.
 */

const ACCOUNT_REF = "npub-test-account";
const DEVICE_A = "device-a";
const DEVICE_B = "device-b";

function change(id: string, conversationId: string, contentHash: string): FedosSyncLocalChangeInput {
  return { changeId: id, conversationId, kind: "upsert", contentHash };
}

describe("Own-Device Sync -- FedosSyncState cross-process integration (two real, separate instances)", () => {
  it("APPROACH 1 (recordLocalChange alone on the receiver): the entry is journaled on B but NEVER reaches B's own pending queue for B, so applyPendingChanges(B) never sees it -- confirms this approach is broken", () => {
    const stateA = new FedosSyncState(ACCOUNT_REF);
    const r1 = stateA.recordLocalChange(DEVICE_A, change("c1", "conv-1", "hash1"), 1000);
    expect(r1.outcome).toBe("appended");
    const entriesFromA: readonly FedosSyncJournalEntryV1[] = stateA.journalEntries();
    expect(entriesFromA).toHaveLength(1);

    // Device B's own SEPARATE process/instance.
    const stateB = new FedosSyncState(ACCOUNT_REF);
    const importResult = stateB.recordLocalChange(DEVICE_A, change(entriesFromA[0]!.changeId, entriesFromA[0]!.conversationId, entriesFromA[0]!.contentHash), entriesFromA[0]!.recordedAt);
    expect(importResult.outcome).toBe("appended"); // it DOES land in B's own local journal

    // But does it ever reach B's own pending queue FOR ITSELF?
    const applyResults = stateB.applyPendingChanges(DEVICE_B, 1001);
    expect(applyResults).toHaveLength(0); // <-- confirms the gap: recordLocalChange() alone never stages anything into B's own pending queue for B
  });

  it("APPROACH 2 (append via recordLocalChange, then redeliverChange to self, then apply): the entry reaches B's own local state correctly, cursor advances, single delivery applies exactly once", () => {
    const stateA = new FedosSyncState(ACCOUNT_REF);
    stateA.recordLocalChange(DEVICE_A, change("c1", "conv-1", "hash1"), 1000);
    const entriesFromA = stateA.journalEntries();

    const stateB = new FedosSyncState(ACCOUNT_REF);
    const appendResult = stateB.recordLocalChange(DEVICE_A, change(entriesFromA[0]!.changeId, entriesFromA[0]!.conversationId, entriesFromA[0]!.contentHash), entriesFromA[0]!.recordedAt);
    expect(appendResult.outcome).toBe("appended");

    const redeliver = stateB.redeliverChange(DEVICE_B, entriesFromA[0]!.changeId);
    expect(redeliver).toBe("enqueued");

    const applyResults = stateB.applyPendingChanges(DEVICE_B, 1002);
    expect(applyResults).toHaveLength(1);
    expect(applyResults[0]!.outcome).toBe("applied");
    expect(stateB.getCursor(DEVICE_B).sequence).toBe(1);
  });

  it("DUPLICATE DELIVERY: the identical wire delivery replayed a second time (transport at-least-once semantics) is safe -- no double-apply, cursor does not move backward or double-advance", () => {
    const stateA = new FedosSyncState(ACCOUNT_REF);
    stateA.recordLocalChange(DEVICE_A, change("c1", "conv-1", "hash1"), 1000);
    const entry = stateA.journalEntries()[0]!;

    const stateB = new FedosSyncState(ACCOUNT_REF);
    function deliverOnce() {
      const append = stateB.recordLocalChange(DEVICE_A, change(entry.changeId, entry.conversationId, entry.contentHash), entry.recordedAt);
      const redeliver = stateB.redeliverChange(DEVICE_B, entry.changeId);
      return { append, redeliver };
    }

    const first = deliverOnce();
    expect(first.append.outcome).toBe("appended");
    expect(first.redeliver).toBe("enqueued");
    const firstApply = stateB.applyPendingChanges(DEVICE_B, 1001);
    expect(firstApply).toHaveLength(1);
    expect(firstApply[0]!.outcome).toBe("applied");
    expect(stateB.getCursor(DEVICE_B).sequence).toBe(1);

    // Same wire delivery arrives again (e.g. redelivered by an at-least-once transport, or replayed by an attacker).
    const second = deliverOnce();
    expect(second.append.outcome).toBe("duplicate"); // journal-level changeId dedup catches it
    expect(second.redeliver).toBe("duplicate"); // pending-queue-level dedup ALSO catches it independently (already resolved)
    const secondApply = stateB.applyPendingChanges(DEVICE_B, 1002);
    expect(secondApply).toHaveLength(0); // nothing new to apply -- no double-apply
    expect(stateB.getCursor(DEVICE_B).sequence).toBe(1); // cursor unchanged, never double-advanced
  });

  it("OUT-OF-ORDER / REORDERED DELIVERY -- REAL FINDING: B's own local journal RENUMBERS entries by arrival order, not A's original order, so applying strictly in B's local sequence order after a reordered delivery can apply A's SECOND change before A's FIRST for the SAME conversation -- this is a genuine correctness risk for order-dependent facts (e.g. upsert-then-tombstone) unless the transport itself guarantees in-order delivery per conversation", () => {
    const stateA = new FedosSyncState(ACCOUNT_REF);
    stateA.recordLocalChange(DEVICE_A, change("c1", "conv-1", "hash-v1"), 1000); // A's sequence 1 -- the FIRST real change
    stateA.recordLocalChange(DEVICE_A, change("c2", "conv-1", "hash-v2"), 1001); // A's sequence 2 -- the SECOND real change, same conversation
    const [entryV1, entryV2] = stateA.journalEntries();
    expect(entryV1!.sequence).toBe(1);
    expect(entryV2!.sequence).toBe(2);

    // The transport delivers them to B OUT OF ORDER (entryV2 arrives before entryV1 -- a real possibility over an
    // unordered relay/multi-relay fan-out where "publish order" is not "delivery order").
    const stateB = new FedosSyncState(ACCOUNT_REF);
    stateB.recordLocalChange(DEVICE_A, change(entryV2!.changeId, entryV2!.conversationId, entryV2!.contentHash), entryV2!.recordedAt);
    stateB.redeliverChange(DEVICE_B, entryV2!.changeId);
    stateB.recordLocalChange(DEVICE_A, change(entryV1!.changeId, entryV1!.conversationId, entryV1!.contentHash), entryV1!.recordedAt);
    stateB.redeliverChange(DEVICE_B, entryV1!.changeId);

    // B's OWN local journal assigned its OWN sequence numbers by ARRIVAL order, not A's original order:
    const bJournal = stateB.journalEntries();
    const bEntryForV2 = bJournal.find((e) => e.changeId === entryV2!.changeId)!;
    const bEntryForV1 = bJournal.find((e) => e.changeId === entryV1!.changeId)!;
    expect(bEntryForV2.sequence).toBe(1); // V2 (A's chronologically SECOND change) got B's local sequence 1 -- arrived first
    expect(bEntryForV1.sequence).toBe(2); // V1 (A's chronologically FIRST change) got B's local sequence 2 -- arrived second

    // applyPendingChanges() processes strictly in B's own local sequence order (FedosSyncPendingChangeQueue.listPending()
    // sorts ascending by `sequence`) -- so it applies V2 (arrived-first) BEFORE V1 (arrived-second), the OPPOSITE of A's
    // real chronological order for the same conversation.
    const applyResults = stateB.applyPendingChanges(DEVICE_B, 1003);
    expect(applyResults.map((r) => r.changeId)).toEqual([entryV2!.changeId, entryV1!.changeId]);
    // Neither is flagged as a conflict by the BASE classifier (both are "upsert" for the same conversation with no
    // prior local state at the time each is evaluated in THIS arrival order) -- this reordering is genuinely silent
    // at the FedosSyncState layer. A real transport MUST NOT rely on FedosSyncState alone to detect or prevent this;
    // it must either (a) deliver a conversation's own changes in-order, or (b) the richer Import Coordinator's own
    // conflict classifier must be extended to compare against the SENDER's original sequence (carried in the wire
    // payload, not B's re-derived local one) rather than B's own re-numbered journal sequence.
    expect(applyResults.every((r) => r.outcome === "applied")).toBe(true);
  });
});
