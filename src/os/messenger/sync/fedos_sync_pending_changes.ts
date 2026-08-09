/**
 * Secure Runtime Alpha 2421–2500 ("Multi Device Synchronization
 * Foundation") — Pending Changes.
 *
 * A per-device INBOUND staging area: journal entries a device has
 * received (via Sync Queue delivery, or a direct redelivery) but not
 * yet resolved. `enqueue()` is the ONE place duplicate delivery is
 * caught independently of the Sync Journal's own `changeId`
 * de-duplication — a transport with at-least-once delivery semantics
 * can redeliver an entry the journal already knows about, and this
 * queue must not stage it twice.
 *
 * A resolved item (`"applied"` / `"skipped-archived"` / `"conflict"`)
 * is kept, never removed — `isResolved()`/`listResolved()` let Sync
 * State's own Recovery snapshot capture exactly which changes must
 * NOT be reprocessed after a restart.
 *
 * HARD GUARDRAILS:
 *   - No `delete` method.
 *   - Never throws.
 */

import type { FedosSyncJournalEntryV1 } from "./fedos_sync_journal.js";

export type FedosSyncPendingChangeStatus = "pending" | "applied" | "skipped-archived" | "conflict";
export type FedosSyncPendingChangeEnqueueOutcome = "enqueued" | "duplicate";

export interface FedosSyncResolvedPendingChange {
  readonly entry: FedosSyncJournalEntryV1;
  readonly status: Exclude<FedosSyncPendingChangeStatus, "pending">;
}

interface FedosSyncPendingChangeItem {
  readonly entry: FedosSyncJournalEntryV1;
  status: FedosSyncPendingChangeStatus;
}

export class FedosSyncPendingChangeQueue {
  readonly #items = new Map<string, FedosSyncPendingChangeItem>();

  /** `"duplicate"` iff `entry.changeId` is already staged (pending OR resolved) — never re-stages it. */
  enqueue(entry: FedosSyncJournalEntryV1): FedosSyncPendingChangeEnqueueOutcome {
    if (this.#items.has(entry.changeId)) return "duplicate";
    this.#items.set(entry.changeId, { entry, status: "pending" });
    return "enqueued";
  }

  has(changeId: string): boolean {
    return this.#items.has(changeId);
  }

  isResolved(changeId: string): boolean {
    const item = this.#items.get(changeId);
    return item !== undefined && item.status !== "pending";
  }

  /** Every not-yet-resolved entry, ascending by journal `sequence`. */
  listPending(): readonly FedosSyncJournalEntryV1[] {
    return [...this.#items.values()]
      .filter((item): item is FedosSyncPendingChangeItem & { status: "pending" } => item.status === "pending")
      .map((item) => item.entry)
      .sort((a, b) => a.sequence - b.sequence);
  }

  listResolved(): readonly FedosSyncResolvedPendingChange[] {
    return [...this.#items.values()]
      .filter((item): item is FedosSyncPendingChangeItem & { status: Exclude<FedosSyncPendingChangeStatus, "pending"> } => item.status !== "pending")
      .map((item) => ({ entry: item.entry, status: item.status }));
  }

  markApplied(changeId: string): void {
    this.#setStatus(changeId, "applied");
  }

  markSkippedArchived(changeId: string): void {
    this.#setStatus(changeId, "skipped-archived");
  }

  markConflict(changeId: string): void {
    this.#setStatus(changeId, "conflict");
  }

  /**
   * Seeds `entry` directly into a RESOLVED status without passing
   * through `enqueue()`/the apply loop — used ONLY by Recovery State
   * restore, to rebuild this queue's dedup memory after a restart
   * without re-running conflict/archive classification a second time.
   */
  seedResolved(entry: FedosSyncJournalEntryV1, status: Exclude<FedosSyncPendingChangeStatus, "pending">): void {
    this.#items.set(entry.changeId, { entry, status });
  }

  size(): number {
    return this.#items.size;
  }

  #setStatus(changeId: string, status: FedosSyncPendingChangeStatus): void {
    const item = this.#items.get(changeId);
    if (item !== undefined) item.status = status;
  }
}
