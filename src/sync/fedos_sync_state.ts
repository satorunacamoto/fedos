/**
 * Secure Runtime Alpha 2421–2500 ("Multi Device Synchronization
 * Foundation") — Sync State.
 *
 * The per-account coordinator composing every other primitive in this
 * Arc: Device Registry (`./fedos_sync_device_registry.ts`), Sync
 * Journal (`./fedos_sync_journal.ts`), Sync Cursor
 * (`./fedos_sync_cursor.ts`), Sync Queue (`./fedos_sync_queue.ts`),
 * Pending Changes (`./fedos_sync_pending_changes.ts`), Conflict
 * Vocabulary (`./fedos_sync_conflict.ts`), and Recovery State
 * (`./fedos_sync_recovery.ts`). Nothing here performs network I/O —
 * "delivery" is a Sync Queue state transition
 * (`deliverQueuedChanges()`/`redeliverChange()`), driven by a test or
 * a future transport wiring, never a socket this file owns itself.
 *
 * Archive interaction: `deps.archiveAwareness` is a narrow, OPTIONAL,
 * caller-injected port (a single boolean predicate) — this file never
 * imports or depends on `../conversation/archive/` directly. A change
 * targeting an archived conversation is still recorded in the Journal
 * and still advances the receiving device's Cursor (so the rest of
 * the Journal is never blocked behind it), but is reported
 * `"archived-skip"` rather than being applied to local state. Real
 * wiring of this port to the Archive module's own bundle/restore
 * types is deliberately left to a future Arc, mirroring Archive's own
 * 1541–1610 deferral of Sync.
 *
 * HARD GUARDRAILS:
 *   - No network I/O, no file/database access, no transport.
 *   - Never throws — every failure mode is reflected in a returned
 *     outcome value.
 */

import {
  FedosSyncDeviceRegistry,
  type FedosSyncDeviceRegistryOutcome,
} from "./fedos_sync_device_registry.js";
import type { FedosSyncDeviceBinding } from "./fedos_sync_device_binding.js";
import {
  FedosSyncJournal,
  type FedosSyncChangeKind,
  type FedosSyncJournalAppendResult,
  type FedosSyncJournalEntryV1,
} from "./fedos_sync_journal.js";
import { FedosSyncCursorStore, type FedosSyncCursor } from "./fedos_sync_cursor.js";
import { FedosSyncOutboundQueue, type FedosSyncOutboundQueueEntry } from "./fedos_sync_queue.js";
import { FedosSyncPendingChangeQueue } from "./fedos_sync_pending_changes.js";
import { classifyFedosSyncConflict, type FedosSyncConflictKind } from "./fedos_sync_conflict.js";
import {
  captureFedosSyncRecoverySnapshot,
  isFedosSyncRecoverySnapshotConsistent,
  type FedosSyncRecoverySnapshotV1,
} from "./fedos_sync_recovery.js";
import type { FedosSyncJournalPersistence } from "./persistence/fedos_sync_journal_persistence.js";

export interface FedosSyncArchiveAwareness {
  isConversationArchived(conversationId: string): boolean;
}

export interface FedosSyncStateDependencies {
  readonly archiveAwareness?: FedosSyncArchiveAwareness;
  /**
   * Secure Runtime Alpha 4581–4660 (Phase F) — OPTIONAL durable backend for
   * this account's own Sync Journal. Omitted (every pre-existing call
   * site), `FedosSyncJournal` is constructed exactly as before this Arc — a
   * pure in-memory ledger. Supplying one hydrates the Journal from durable
   * storage at construction and write-through's every successful
   * `recordLocalChange()` — see `./fedos_sync_journal.ts`'s own header.
   */
  readonly journalPersistence?: FedosSyncJournalPersistence;
}

export type FedosSyncApplyOutcome = "applied" | "duplicate" | "conflict" | "archived-skip";

export interface FedosSyncApplyResult {
  readonly changeId: string;
  readonly conversationId: string;
  readonly outcome: FedosSyncApplyOutcome;
  readonly conflict?: FedosSyncConflictKind;
}

export interface FedosSyncLocalChangeInput {
  readonly changeId: string;
  readonly conversationId: string;
  readonly kind: FedosSyncChangeKind;
  readonly contentHash: string;
}

export type FedosSyncRedeliverOutcome = "enqueued" | "duplicate" | "unknown-change";

export class FedosSyncState {
  readonly accountRef: string;
  readonly #archiveAwareness: FedosSyncArchiveAwareness | undefined;
  readonly #registry = new FedosSyncDeviceRegistry();
  readonly #journal: FedosSyncJournal;
  readonly #cursors = new FedosSyncCursorStore();
  readonly #pendingByDevice = new Map<string, FedosSyncPendingChangeQueue>();
  readonly #outbound = new FedosSyncOutboundQueue();
  /** Per-DEVICE, per-conversation "last entry this device applied locally" — each device's own local application state is independent, never shared with a sibling's. */
  readonly #lastAppliedByConversationPerDevice = new Map<string, Map<string, FedosSyncJournalEntryV1>>();

  constructor(accountRef: string, deps: FedosSyncStateDependencies = {}) {
    this.accountRef = accountRef;
    this.#archiveAwareness = deps.archiveAwareness;
    // Alpha 4581-4660 (Phase F) -- `deps.journalPersistence` omitted, this is
    // BYTE-FOR-BYTE the same `new FedosSyncJournal()` every pre-existing call
    // site already constructed.
    this.#journal = new FedosSyncJournal(deps.journalPersistence);
  }

  registerDevice(deviceRef: string, at: number): FedosSyncDeviceRegistryOutcome {
    return this.#registry.registerDevice(deviceRef, this.accountRef, at);
  }

  revokeDevice(deviceRef: string, at: number): boolean {
    return this.#registry.revokeDevice(deviceRef, this.accountRef, at);
  }

  listDevices(): readonly FedosSyncDeviceBinding[] {
    return this.#registry.listDevices(this.accountRef);
  }

  listActiveDevices(): readonly FedosSyncDeviceBinding[] {
    return this.#registry.listActiveDevices(this.accountRef);
  }

  /**
   * Appends `input` to the Sync Journal under `originDeviceRef`, then
   * fans it out into every OTHER active device's Sync Queue. A
   * `changeId` retried after the journal already recorded it reports
   * `"duplicate"` and fans out nothing a second time.
   */
  recordLocalChange(originDeviceRef: string, input: FedosSyncLocalChangeInput, at: number): FedosSyncJournalAppendResult {
    const result = this.#journal.append({
      changeId: input.changeId,
      accountRef: this.accountRef,
      originDeviceRef,
      conversationId: input.conversationId,
      kind: input.kind,
      contentHash: input.contentHash,
      recordedAt: at,
    });
    if (result.outcome === "appended") {
      for (const device of this.#registry.listActiveDevices(this.accountRef)) {
        if (device.deviceRef === originDeviceRef) continue;
        this.#outbound.enqueueForDevice(device.deviceRef, result.entry, at);
      }
    }
    return result;
  }

  /**
   * Moves every currently `"queued"`/`"failed"` outbound entry for
   * `targetDeviceRef` into that device's own Pending Changes, marking
   * each `"delivered"`. Returns the count actually newly staged (an
   * already-staged entry is not double-counted). A device that is
   * offline simply never has this called for it — its entries stay
   * `"queued"` indefinitely.
   */
  deliverQueuedChanges(targetDeviceRef: string, at: number): number {
    const pendingQueue = this.#pendingQueueFor(targetDeviceRef);
    let delivered = 0;
    for (const item of this.#outbound.listPendingForDevice(targetDeviceRef)) {
      const outcome = pendingQueue.enqueue(item.entry);
      if (outcome === "enqueued") delivered += 1;
      this.#outbound.markDelivered(targetDeviceRef, item.entry.changeId, at);
    }
    return delivered;
  }

  /** Directly stages a known `changeId` into `targetDeviceRef`'s Pending Changes — models an at-least-once transport redelivering a change outside the normal Sync Queue flow. */
  redeliverChange(targetDeviceRef: string, changeId: string): FedosSyncRedeliverOutcome {
    const entry = this.#journal.getByChangeId(changeId);
    if (entry === null) return "unknown-change";
    return this.#pendingQueueFor(targetDeviceRef).enqueue(entry);
  }

  /**
   * Resolves every pending change for `deviceRef`, in ascending
   * journal order, advancing that device's Sync Cursor past each one
   * regardless of outcome (so no single conflicted/duplicate/archived
   * entry can block everything after it).
   */
  applyPendingChanges(deviceRef: string, at: number): readonly FedosSyncApplyResult[] {
    const pendingQueue = this.#pendingQueueFor(deviceRef);
    const lastAppliedByConversation = this.#lastAppliedByConversationFor(deviceRef);
    const results: FedosSyncApplyResult[] = [];

    for (const entry of pendingQueue.listPending()) {
      if (this.#archiveAwareness?.isConversationArchived(entry.conversationId) === true) {
        pendingQueue.markSkippedArchived(entry.changeId);
        this.#cursors.advance(deviceRef, entry.sequence, at);
        results.push({ changeId: entry.changeId, conversationId: entry.conversationId, outcome: "archived-skip" });
        continue;
      }

      const lastApplied = lastAppliedByConversation.get(entry.conversationId) ?? null;
      const conflictKind = classifyFedosSyncConflict(lastApplied, entry);
      this.#cursors.advance(deviceRef, entry.sequence, at);

      if (conflictKind === "duplicate") {
        pendingQueue.markApplied(entry.changeId);
        results.push({ changeId: entry.changeId, conversationId: entry.conversationId, outcome: "duplicate" });
        continue;
      }
      if (conflictKind === "none") {
        lastAppliedByConversation.set(entry.conversationId, entry);
        pendingQueue.markApplied(entry.changeId);
        results.push({ changeId: entry.changeId, conversationId: entry.conversationId, outcome: "applied" });
        continue;
      }
      lastAppliedByConversation.set(entry.conversationId, entry);
      pendingQueue.markConflict(entry.changeId);
      results.push({ changeId: entry.changeId, conversationId: entry.conversationId, outcome: "conflict", conflict: conflictKind });
    }
    return results;
  }

  /** Marks every `"delivered"` outbound entry for `targetDeviceRef` `"acknowledged"` once the receiving device has resolved it. Returns the count acknowledged. */
  acknowledgeApplied(targetDeviceRef: string, at: number): number {
    const pendingQueue = this.#pendingQueueFor(targetDeviceRef);
    let count = 0;
    for (const item of this.#outbound.listDeliveredForDevice(targetDeviceRef)) {
      if (pendingQueue.isResolved(item.entry.changeId)) {
        this.#outbound.markAcknowledged(targetDeviceRef, item.entry.changeId, at);
        count += 1;
      }
    }
    return count;
  }

  getCursor(deviceRef: string): FedosSyncCursor {
    return this.#cursors.get(deviceRef);
  }

  listPendingChanges(deviceRef: string): readonly FedosSyncJournalEntryV1[] {
    return this.#pendingQueueFor(deviceRef).listPending();
  }

  listOutboundForDevice(deviceRef: string): readonly FedosSyncOutboundQueueEntry[] {
    return this.#outbound.listForDevice(deviceRef);
  }

  journalEntries(): readonly FedosSyncJournalEntryV1[] {
    return this.#journal.readAll();
  }

  captureRecoverySnapshot(deviceRef: string, at: number): FedosSyncRecoverySnapshotV1 {
    return captureFedosSyncRecoverySnapshot(deviceRef, this.#cursors.get(deviceRef), this.#pendingQueueFor(deviceRef), at);
  }

  /** Discards `deviceRef`'s own in-memory Cursor and Pending Changes — simulates a device process restarting and losing everything it had not persisted. The Journal, Device Registry, and Sync Queue (all account-level/durable) are unaffected. */
  resetDeviceRuntimeState(deviceRef: string): void {
    this.#pendingByDevice.delete(deviceRef);
    this.#cursors.reset(deviceRef);
  }

  /**
   * Restores `snapshot.deviceRef`'s Cursor and Pending Changes.
   * Resolved `changeId`s are re-seeded as `"applied"` (the exact
   * original sub-status is not needed for correctness — only the
   * resolved/not-resolved distinction matters for idempotent replay)
   * so a subsequent redelivery is recognized as `"duplicate"`
   * immediately, without re-running conflict/archive classification.
   * A structurally-inconsistent snapshot is rejected (`false`) and
   * changes nothing.
   */
  restoreDeviceFromRecoverySnapshot(snapshot: FedosSyncRecoverySnapshotV1): boolean {
    if (!isFedosSyncRecoverySnapshotConsistent(snapshot)) return false;

    this.#cursors.advance(snapshot.deviceRef, snapshot.cursorSequence, snapshot.capturedAt);
    const pendingQueue = this.#pendingQueueFor(snapshot.deviceRef);

    for (const changeId of snapshot.resolvedChangeIds) {
      const entry = this.#journal.getByChangeId(changeId);
      if (entry !== null) pendingQueue.seedResolved(entry, "applied");
    }
    for (const changeId of snapshot.pendingChangeIds) {
      const entry = this.#journal.getByChangeId(changeId);
      if (entry !== null) pendingQueue.enqueue(entry);
    }
    return true;
  }

  #pendingQueueFor(deviceRef: string): FedosSyncPendingChangeQueue {
    let queue = this.#pendingByDevice.get(deviceRef);
    if (queue === undefined) {
      queue = new FedosSyncPendingChangeQueue();
      this.#pendingByDevice.set(deviceRef, queue);
    }
    return queue;
  }

  #lastAppliedByConversationFor(deviceRef: string): Map<string, FedosSyncJournalEntryV1> {
    let byConversation = this.#lastAppliedByConversationPerDevice.get(deviceRef);
    if (byConversation === undefined) {
      byConversation = new Map();
      this.#lastAppliedByConversationPerDevice.set(deviceRef, byConversation);
    }
    return byConversation;
  }
}
