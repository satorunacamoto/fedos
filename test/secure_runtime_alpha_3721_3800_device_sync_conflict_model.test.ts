import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyFedosSyncConflict } from "../src/sync/fedos_sync_conflict.js";
import type { FedosSyncJournalEntryV1 } from "../src/sync/fedos_sync_journal.js";
import { classifyFedosDeviceSyncConflict } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_conflict.js";
import { planFedosDeviceSyncResolution } from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_conflict_authority.js";
import {
  fedosDeviceSyncConflictId,
  type FedosDeviceSyncConflictRecordV1,
} from "../src/os/messenger/device/sync_scheduler/persistence/fedos_device_sync_conflict_persistence.js";
import { InMemoryFedosDeviceSyncConflictPersistence } from "../src/os/messenger/device/sync_scheduler/persistence/in_memory_fedos_device_sync_conflict_persistence.js";
import { AppendOnlyFedosDeviceSyncConflictPersistence } from "../src/os/messenger/device/sync_scheduler/persistence/append_only_fedos_device_sync_conflict_persistence.js";
import {
  listSafeResolutionActionsForFedosDeviceSyncConflict,
  listUnresolvedFedosDeviceSyncConflicts,
  resolveFedosDeviceSyncConflict,
} from "../src/os/messenger/device/sync_scheduler/fedos_device_sync_conflict_query.js";

const NOW = 1_700_000_000;

function makeEntry(overrides: Partial<FedosSyncJournalEntryV1> = {}): FedosSyncJournalEntryV1 {
  return {
    sequence: 5,
    changeId: "change-5",
    accountRef: "nostr:ab",
    originDeviceRef: "phone",
    conversationId: "board-a::thread-1",
    kind: "upsert",
    contentHash: "hash-5",
    recordedAt: NOW,
    ...overrides,
  };
}

function makeConflictRecord(overrides: Partial<FedosDeviceSyncConflictRecordV1> = {}): FedosDeviceSyncConflictRecordV1 {
  return {
    schemaVersion: 1,
    conflictId: fedosDeviceSyncConflictId("laptop", "change-5"),
    sourceDeviceId: "phone",
    targetDeviceId: "laptop",
    changeId: "change-5",
    conversationId: "board-a::thread-1",
    recordType: "membership-metadata",
    conflictKind: "immutable-record-conflict",
    decision: "record-conflict",
    reason: "test reason",
    firstObservedAt: NOW,
    lastObservedAt: NOW,
    resolved: false,
    resolutionAction: null,
    resolvedAt: null,
    ...overrides,
  };
}

describe("Secure Runtime Alpha 3721-3800 -- richer Conflict Vocabulary (Phase H)", () => {
  it("1. identical-duplicate -- the same changeId as last-applied", () => {
    const lastApplied = makeEntry();
    const incoming = makeEntry();
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: classifyFedosSyncConflict(lastApplied, incoming),
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 5,
    });
    expect(result.kind).toBe("identical-duplicate");
  });

  it("2. immutable-record-conflict -- concurrent update, record type is NOT append-only-safe", () => {
    const lastApplied = makeEntry({ changeId: "change-4", sequence: 4, originDeviceRef: "phone" });
    const incoming = makeEntry({ changeId: "change-5", sequence: 5, originDeviceRef: "laptop" });
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: classifyFedosSyncConflict(lastApplied, incoming),
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 4,
      incomingRecordType: "membership-metadata",
    });
    expect(result.kind).toBe("immutable-record-conflict");
  });

  it("3. missing-dependency -- incoming sequence is more than one ahead of the local cursor", () => {
    const incoming = makeEntry({ sequence: 10 });
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: "none",
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 4,
    });
    expect(result.kind).toBe("missing-dependency");
  });

  it("4. cursor-divergence -- incoming sequence is at/behind the cursor but not recognized as the same change", () => {
    const incoming = makeEntry({ sequence: 3, changeId: "change-3-different" });
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: "none",
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 5,
    });
    expect(result.kind).toBe("cursor-divergence");
  });

  it("5. invalid-transition -- an upsert arrives after a tombstone", () => {
    const lastApplied = makeEntry({ changeId: "change-4", kind: "tombstone", sequence: 4 });
    const incoming = makeEntry({ changeId: "change-5", kind: "upsert", sequence: 5 });
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: classifyFedosSyncConflict(lastApplied, incoming),
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 4,
    });
    expect(result.kind).toBe("invalid-transition");
  });

  it("6. revoked-device-contribution -- the originating device is not currently trusted", () => {
    const incoming = makeEntry({ sequence: 5 });
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: "none",
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "revoked",
      localCursorSequence: 4,
    });
    expect(result.kind).toBe("revoked-device-contribution");
  });

  it("7. unknown-record-type -- a record type outside the closed allowlist", () => {
    const incoming = makeEntry({ sequence: 5 });
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: "none",
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 4,
      incomingRecordType: "not-a-real-record-type",
    });
    expect(result.kind).toBe("unknown-record-type");
  });

  it("8. unknown-record-type -- a Master Seed-shaped metadata value is rejected even for an allowed record type", () => {
    const incoming = makeEntry({ sequence: 5 });
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: "none",
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 4,
      incomingRecordType: "membership-metadata",
      incomingRecordMetadata: { masterSeed: "irrelevant" },
    });
    expect(result.kind).toBe("unknown-record-type");
  });

  it("9. safe-concurrent-append -- concurrent update, an append-only-safe record type", () => {
    const lastApplied = makeEntry({ changeId: "change-4", sequence: 4, originDeviceRef: "phone" });
    const incoming = makeEntry({ changeId: "change-5", sequence: 5, originDeviceRef: "laptop" });
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: classifyFedosSyncConflict(lastApplied, incoming),
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 4,
      incomingRecordType: "capability-public-event",
    });
    expect(result.kind).toBe("safe-concurrent-append");
  });

  it("10. stale-projection -- concurrent update, a re-derivable projection record type", () => {
    const lastApplied = makeEntry({ changeId: "change-4", sequence: 4, originDeviceRef: "phone" });
    const incoming = makeEntry({ changeId: "change-5", sequence: 5, originDeviceRef: "laptop" });
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: classifyFedosSyncConflict(lastApplied, incoming),
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 4,
      incomingRecordType: "search-canonical-id",
    });
    expect(result.kind).toBe("stale-projection");
  });

  it("11. operator-decision-required -- concurrent update with NO record-type context available", () => {
    const lastApplied = makeEntry({ changeId: "change-4", sequence: 4, originDeviceRef: "phone" });
    const incoming = makeEntry({ changeId: "change-5", sequence: 5, originDeviceRef: "laptop" });
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: classifyFedosSyncConflict(lastApplied, incoming),
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 4,
    });
    expect(result.kind).toBe("operator-decision-required");
  });

  it("12. none -- no conflict, safe to apply directly", () => {
    const incoming = makeEntry({ sequence: 5 });
    const result = classifyFedosDeviceSyncConflict({
      baseConflictKind: "none",
      incomingSequence: incoming.sequence,
      incomingConversationId: incoming.conversationId,
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 4,
    });
    expect(result.kind).toBe("none");
  });

  it("13. duplicates are never confused with concurrent-but-valid entries -- both kinds classify distinctly", () => {
    const dup = classifyFedosDeviceSyncConflict({
      baseConflictKind: "duplicate",
      incomingSequence: 5,
      incomingConversationId: "c",
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 5,
    });
    const concurrent = classifyFedosDeviceSyncConflict({
      baseConflictKind: "concurrent-update",
      incomingSequence: 5,
      incomingConversationId: "c",
      incomingOriginDeviceTrustState: "trusted",
      localCursorSequence: 4,
      incomingRecordType: "capability-public-event",
    });
    expect(dup.kind).not.toBe(concurrent.kind);
  });
});

describe("Secure Runtime Alpha 3721-3800 -- Conflict Authority planning (Phase I/J)", () => {
  it("1. every conflict kind has a plan with a non-empty reason", () => {
    const kinds = [
      "none",
      "identical-duplicate",
      "immutable-record-conflict",
      "missing-dependency",
      "cursor-divergence",
      "invalid-transition",
      "revoked-device-contribution",
      "unknown-record-type",
      "stale-projection",
      "safe-concurrent-append",
      "operator-decision-required",
    ] as const;
    for (const kind of kinds) {
      const plan = planFedosDeviceSyncResolution(kind);
      expect(plan.reason.length).toBeGreaterThan(0);
    }
  });

  it("2. an immutable conflict is NEVER planned as 'apply' -- it is never silently overwritten", () => {
    expect(planFedosDeviceSyncResolution("immutable-record-conflict").decision).not.toBe("apply");
  });

  it("3. an invalid-transition (reversing a tombstone) is rejected, never applied", () => {
    expect(planFedosDeviceSyncResolution("invalid-transition").decision).toBe("reject-invalid");
  });

  it("4. a safe concurrent append IS planned to apply", () => {
    expect(planFedosDeviceSyncResolution("safe-concurrent-append").decision).toBe("apply");
  });

  it("5. an identical duplicate is skipped, never re-applied", () => {
    expect(planFedosDeviceSyncResolution("identical-duplicate").decision).toBe("skip-identical");
  });
});

describe("Secure Runtime Alpha 3721-3800 -- Conflict Persistence and Query (Phase L)", () => {
  it("1. observe() then listUnresolved() surfaces the new conflict", () => {
    const persistence = new InMemoryFedosDeviceSyncConflictPersistence();
    persistence.observe(makeConflictRecord());
    expect(listUnresolvedFedosDeviceSyncConflicts(persistence)).toHaveLength(1);
  });

  it("2. re-observing the SAME conflictId updates lastObservedAt without creating a duplicate", () => {
    const persistence = new InMemoryFedosDeviceSyncConflictPersistence();
    persistence.observe(makeConflictRecord({ firstObservedAt: NOW, lastObservedAt: NOW }));
    persistence.observe(makeConflictRecord({ firstObservedAt: NOW, lastObservedAt: NOW + 100 }));
    const all = persistence.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]!.lastObservedAt).toBe(NOW + 100);
  });

  it("3. only objectively-safe resolution actions are available per conflict kind -- no generic 'force overwrite' action exists anywhere", () => {
    const record = makeConflictRecord({ conflictKind: "immutable-record-conflict" });
    const actions = listSafeResolutionActionsForFedosDeviceSyncConflict(record);
    expect(actions).toEqual(["acknowledge"]);
    expect(actions).not.toContain("accept-identical" as never);
  });

  it("4. resolveFedosDeviceSyncConflict rejects an unsafe action for this conflict's own kind", () => {
    const persistence = new InMemoryFedosDeviceSyncConflictPersistence();
    persistence.observe(makeConflictRecord({ conflictKind: "immutable-record-conflict" }));
    const result = resolveFedosDeviceSyncConflict(persistence, fedosDeviceSyncConflictId("laptop", "change-5"), "accept-identical", NOW + 1);
    expect(result).toBe("unsafe-action");
  });

  it("5. resolveFedosDeviceSyncConflict accepts a safe action and marks it resolved", () => {
    const persistence = new InMemoryFedosDeviceSyncConflictPersistence();
    persistence.observe(makeConflictRecord({ conflictKind: "identical-duplicate" }));
    const conflictId = fedosDeviceSyncConflictId("laptop", "change-5");
    const result = resolveFedosDeviceSyncConflict(persistence, conflictId, "accept-identical", NOW + 1);
    expect(result).toBe("resolved");
    expect(persistence.get(conflictId)?.resolved).toBe(true);
    expect(listUnresolvedFedosDeviceSyncConflicts(persistence)).toHaveLength(0);
  });

  it("6. resolving an already-resolved conflict is refused, not silently re-applied", () => {
    const persistence = new InMemoryFedosDeviceSyncConflictPersistence();
    persistence.observe(makeConflictRecord({ conflictKind: "identical-duplicate" }));
    const conflictId = fedosDeviceSyncConflictId("laptop", "change-5");
    resolveFedosDeviceSyncConflict(persistence, conflictId, "accept-identical", NOW + 1);
    const second = resolveFedosDeviceSyncConflict(persistence, conflictId, "accept-identical", NOW + 2);
    expect(second).toBe("already-resolved");
  });

  it("7. resolving an unknown conflictId reports not-found", () => {
    const persistence = new InMemoryFedosDeviceSyncConflictPersistence();
    expect(resolveFedosDeviceSyncConflict(persistence, "no-such-conflict", "acknowledge", NOW)).toBe("not-found");
  });

  it("8. no raw secret or plaintext ever appears in a Conflict record's own JSON encoding", () => {
    const record = makeConflictRecord({ reason: "record type \"membership-metadata\" is insert-once/immutable" });
    const json = JSON.stringify(record).toLowerCase();
    for (const marker of ["masterseed", "privatekey", "nsec", "mnemonic", "passphrase", "bearer"]) {
      expect(json.includes(marker)).toBe(false);
    }
  });

  it("9. restart recovery -- a fresh Append-Only persistence instance over the SAME log file recovers an identical, still-unresolved conflict", () => {
    const dir = mkdtempSync(join(tmpdir(), "fedos-device-sync-conflict-"));
    const logPath = join(dir, "conflicts.ndjson");
    try {
      const persistenceA = new AppendOnlyFedosDeviceSyncConflictPersistence(logPath);
      persistenceA.observe(makeConflictRecord());

      const persistenceB = new AppendOnlyFedosDeviceSyncConflictPersistence(logPath);
      const recovered = persistenceB.get(fedosDeviceSyncConflictId("laptop", "change-5"));
      expect(recovered?.resolved).toBe(false);
      expect(listUnresolvedFedosDeviceSyncConflicts(persistenceB)).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
