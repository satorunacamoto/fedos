import { describe, it, expect } from "vitest";
import { FedosSyncState } from "../src/sync/fedos_sync_state.js";

describe("Secure Runtime Alpha 2421-2500 -- End-to-End Verification", () => {
  it("1. two devices: a change recorded on one device is delivered to and applied on the other, and never fans back to its own origin", () => {
    const state = new FedosSyncState("acct-1");
    state.registerDevice("dev-A", 100);
    state.registerDevice("dev-B", 100);

    state.recordLocalChange("dev-A", { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "h1" }, 100);

    expect(state.listOutboundForDevice("dev-A")).toEqual([]);
    expect(state.deliverQueuedChanges("dev-B", 110)).toBe(1);

    const results = state.applyPendingChanges("dev-B", 120);
    expect(results).toEqual([{ changeId: "c1", conversationId: "conv-1", outcome: "applied" }]);
    expect(state.getCursor("dev-B").sequence).toBe(1);
  });

  it("2. three devices: a change recorded on one device fans out to BOTH siblings, and each applies it independently", () => {
    const state = new FedosSyncState("acct-1");
    state.registerDevice("dev-A", 100);
    state.registerDevice("dev-B", 100);
    state.registerDevice("dev-C", 100);

    state.recordLocalChange("dev-A", { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "h1" }, 100);

    expect(state.listOutboundForDevice("dev-A")).toEqual([]);
    expect(state.listOutboundForDevice("dev-B").length).toBe(1);
    expect(state.listOutboundForDevice("dev-C").length).toBe(1);

    state.deliverQueuedChanges("dev-B", 110);
    state.deliverQueuedChanges("dev-C", 110);

    expect(state.applyPendingChanges("dev-B", 120).map((r) => r.outcome)).toEqual(["applied"]);
    expect(state.applyPendingChanges("dev-C", 120).map((r) => r.outcome)).toEqual(["applied"]);
    expect(state.getCursor("dev-B").sequence).toBe(1);
    expect(state.getCursor("dev-C").sequence).toBe(1);
  });

  it("3. offline: a change queued for a device that never comes online stays 'queued' forever and is never staged as pending", () => {
    const state = new FedosSyncState("acct-1");
    state.registerDevice("dev-A", 100);
    state.registerDevice("dev-B", 100);

    state.recordLocalChange("dev-A", { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "h1" }, 100);

    expect(state.listOutboundForDevice("dev-B")[0]?.state).toBe("queued");
    expect(state.listPendingChanges("dev-B")).toEqual([]);
    expect(state.getCursor("dev-B").sequence).toBe(0);
  });

  it("4. online: a previously-offline device that later comes online receives and applies everything it missed, in order", () => {
    const state = new FedosSyncState("acct-1");
    state.registerDevice("dev-A", 100);
    state.registerDevice("dev-B", 100);

    state.recordLocalChange("dev-A", { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "h1" }, 100);
    state.recordLocalChange("dev-A", { changeId: "c2", conversationId: "conv-1", kind: "upsert", contentHash: "h2" }, 101);
    // dev-B stays offline through both -- nothing delivered yet.
    expect(state.listPendingChanges("dev-B")).toEqual([]);

    // dev-B comes online.
    expect(state.deliverQueuedChanges("dev-B", 200)).toBe(2);
    expect(state.listOutboundForDevice("dev-B").every((e) => e.state === "delivered")).toBe(true);

    const results = state.applyPendingChanges("dev-B", 210);
    expect(results.map((r) => [r.changeId, r.outcome])).toEqual([
      ["c1", "applied"],
      ["c2", "applied"],
    ]);
    expect(state.getCursor("dev-B").sequence).toBe(2);

    expect(state.acknowledgeApplied("dev-B", 220)).toBe(2);
    expect(state.listOutboundForDevice("dev-B").every((e) => e.state === "acknowledged")).toBe(true);
  });

  it("5. conflict: two devices independently change the SAME conversation before either has seen the other's change; a third device that receives both reports 'conflict', and still advances past it", () => {
    const state = new FedosSyncState("acct-1");
    state.registerDevice("dev-A", 100);
    state.registerDevice("dev-B", 100);
    state.registerDevice("dev-C", 100);

    state.recordLocalChange("dev-A", { changeId: "c1", conversationId: "conv-shared", kind: "upsert", contentHash: "from-A" }, 100);
    state.recordLocalChange("dev-B", { changeId: "c2", conversationId: "conv-shared", kind: "upsert", contentHash: "from-B" }, 101);

    state.deliverQueuedChanges("dev-C", 200);
    const results = state.applyPendingChanges("dev-C", 210);

    expect(results).toEqual([
      { changeId: "c1", conversationId: "conv-shared", outcome: "applied" },
      { changeId: "c2", conversationId: "conv-shared", outcome: "conflict", conflict: "concurrent-update" },
    ]);
    // the conflicted entry still advances the cursor -- it never blocks the journal.
    expect(state.getCursor("dev-C").sequence).toBe(2);
  });

  it("6. duplicate: a retried local write with an already-known changeId never re-fans-out, and an out-of-band redelivery of an already-resolved change is recognized as a duplicate", () => {
    const state = new FedosSyncState("acct-1");
    state.registerDevice("dev-A", 100);
    state.registerDevice("dev-B", 100);

    const first = state.recordLocalChange("dev-A", { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "h1" }, 100);
    expect(first.outcome).toBe("appended");
    expect(state.listOutboundForDevice("dev-B").length).toBe(1);

    // dev-A retries the SAME write (e.g. before it saw its own local ack).
    const retry = state.recordLocalChange("dev-A", { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "h1" }, 105);
    expect(retry.outcome).toBe("duplicate");
    expect(state.listOutboundForDevice("dev-B").length).toBe(1); // no second fan-out

    state.deliverQueuedChanges("dev-B", 110);
    state.applyPendingChanges("dev-B", 120);

    // an at-least-once transport redelivers c1 to dev-B again, after it was already resolved.
    expect(state.redeliverChange("dev-B", "c1")).toBe("duplicate");
    expect(state.redeliverChange("dev-B", "no-such-change")).toBe("unknown-change");
  });

  it("7. restart: a device's local cursor/pending state can be lost and exactly reconstructed from a Recovery snapshot, with no duplicate re-application and no lost change", () => {
    const state = new FedosSyncState("acct-1");
    state.registerDevice("dev-A", 100);
    state.registerDevice("dev-B", 100);

    state.recordLocalChange("dev-A", { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "h1" }, 100);
    state.recordLocalChange("dev-A", { changeId: "c2", conversationId: "conv-1", kind: "upsert", contentHash: "h2" }, 101);
    state.deliverQueuedChanges("dev-B", 200);
    state.applyPendingChanges("dev-B", 210);

    const snapshot = state.captureRecoverySnapshot("dev-B", 220);
    expect(snapshot.cursorSequence).toBe(2);
    expect([...snapshot.resolvedChangeIds].sort()).toEqual(["c1", "c2"]);
    expect(snapshot.pendingChangeIds).toEqual([]);

    // simulate the crash: dev-B's own in-memory cursor/pending state is gone.
    state.resetDeviceRuntimeState("dev-B");
    expect(state.getCursor("dev-B").sequence).toBe(0);
    expect(state.listPendingChanges("dev-B")).toEqual([]);

    // restart: reload from the snapshot dev-B had persisted just before the crash.
    expect(state.restoreDeviceFromRecoverySnapshot(snapshot)).toBe(true);
    expect(state.getCursor("dev-B").sequence).toBe(2);

    // a redelivery of an already-resolved change after restart is still recognized as a duplicate.
    expect(state.redeliverChange("dev-B", "c1")).toBe("duplicate");
  });

  it("7b. restart before any apply: changes delivered but still pending at the moment of the crash are neither lost nor silently dropped after restore", () => {
    const state = new FedosSyncState("acct-1");
    state.registerDevice("dev-A", 100);
    state.registerDevice("dev-B", 100);

    state.recordLocalChange("dev-A", { changeId: "c1", conversationId: "conv-1", kind: "upsert", contentHash: "h1" }, 100);
    state.recordLocalChange("dev-A", { changeId: "c2", conversationId: "conv-1", kind: "upsert", contentHash: "h2" }, 101);
    state.deliverQueuedChanges("dev-B", 200);

    // dev-B crashes right after delivery, before it ever ran applyPendingChanges.
    expect(state.listPendingChanges("dev-B").map((e) => e.changeId)).toEqual(["c1", "c2"]);
    const snapshot = state.captureRecoverySnapshot("dev-B", 205);
    expect(snapshot.cursorSequence).toBe(0);
    expect(snapshot.pendingChangeIds).toEqual(["c1", "c2"]);
    expect(snapshot.resolvedChangeIds).toEqual([]);

    state.resetDeviceRuntimeState("dev-B");
    expect(state.listPendingChanges("dev-B")).toEqual([]);

    expect(state.restoreDeviceFromRecoverySnapshot(snapshot)).toBe(true);
    expect(state.listPendingChanges("dev-B").map((e) => e.changeId)).toEqual(["c1", "c2"]);

    // sync resumes normally after restore -- nothing was lost.
    const results = state.applyPendingChanges("dev-B", 210);
    expect(results.map((r) => [r.changeId, r.outcome])).toEqual([
      ["c1", "applied"],
      ["c2", "applied"],
    ]);
    expect(state.getCursor("dev-B").sequence).toBe(2);
  });

  it("8. archive interaction: a change targeting an archived conversation is skipped (not applied) but still advances the cursor, and does not block the rest of the journal", () => {
    const archivedConversations = new Set(["conv-archived"]);
    const state = new FedosSyncState("acct-1", {
      archiveAwareness: { isConversationArchived: (id) => archivedConversations.has(id) },
    });
    state.registerDevice("dev-A", 100);
    state.registerDevice("dev-B", 100);

    state.recordLocalChange("dev-A", { changeId: "c1", conversationId: "conv-archived", kind: "upsert", contentHash: "h1" }, 100);
    state.recordLocalChange("dev-A", { changeId: "c2", conversationId: "conv-live", kind: "upsert", contentHash: "h2" }, 101);
    state.deliverQueuedChanges("dev-B", 200);

    const results = state.applyPendingChanges("dev-B", 210);
    expect(results).toEqual([
      { changeId: "c1", conversationId: "conv-archived", outcome: "archived-skip" },
      { changeId: "c2", conversationId: "conv-live", outcome: "applied" },
    ]);
    expect(state.getCursor("dev-B").sequence).toBe(2);
  });
});
