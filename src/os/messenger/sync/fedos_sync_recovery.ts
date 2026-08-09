/**
 * Secure Runtime Alpha 2421–2500 ("Multi Device Synchronization
 * Foundation") — Recovery State.
 *
 * A serializable snapshot of exactly the LOCAL, per-device state a
 * device process would need to persist to its own disk to survive a
 * restart without loss or duplication: its Sync Cursor position, the
 * `changeId`s still pending resolution, and the `changeId`s already
 * resolved (kept so a redelivery of an already-resolved change is
 * recognized as such immediately after restart, before the apply loop
 * would otherwise have re-derived that fact). The Sync Journal and
 * Device Registry are durable, account-level state that a device
 * restart does NOT lose — only this file's own snapshot is what a
 * single device's process needs to reconstruct.
 *
 * Deliberately out of scope: WHERE a snapshot is persisted (disk path,
 * IndexedDB, ...) — this file only defines the snapshot's shape and a
 * pure structural-consistency check, mirroring the Archive Arc's own
 * "export()/import() accept and return in-memory bytes/objects only"
 * deferral (Alpha 1541–1610).
 *
 * HARD GUARDRAILS:
 *   - Plain-data snapshot only — no class instance, no function value,
 *     safe to `JSON.stringify`.
 *   - `isFedosSyncRecoverySnapshotConsistent` never throws.
 */

import type { FedosSyncCursor } from "./fedos_sync_cursor.js";
import type { FedosSyncPendingChangeQueue } from "./fedos_sync_pending_changes.js";

export interface FedosSyncRecoverySnapshotV1 {
  readonly schemaVersion: 1;
  readonly deviceRef: string;
  readonly cursorSequence: number;
  readonly pendingChangeIds: readonly string[];
  readonly resolvedChangeIds: readonly string[];
  readonly capturedAt: number;
}

export function captureFedosSyncRecoverySnapshot(
  deviceRef: string,
  cursor: FedosSyncCursor,
  pendingQueue: FedosSyncPendingChangeQueue,
  at: number,
): FedosSyncRecoverySnapshotV1 {
  return {
    schemaVersion: 1,
    deviceRef,
    cursorSequence: cursor.sequence,
    pendingChangeIds: pendingQueue.listPending().map((entry) => entry.changeId),
    resolvedChangeIds: pendingQueue.listResolved().map((item) => item.entry.changeId),
    capturedAt: at,
  };
}

/**
 * Structural sanity check only (never re-validates against a journal —
 * a caller restoring from this snapshot is responsible for looking
 * each id up itself): valid `schemaVersion`, non-empty `deviceRef`,
 * non-negative `cursorSequence`, no duplicate id within either list,
 * and no id appearing in BOTH lists (a change cannot be simultaneously
 * still-pending and already-resolved).
 */
export function isFedosSyncRecoverySnapshotConsistent(snapshot: FedosSyncRecoverySnapshotV1): boolean {
  if (snapshot.schemaVersion !== 1) return false;
  if (snapshot.deviceRef.length === 0) return false;
  if (snapshot.cursorSequence < 0) return false;

  const pendingSet = new Set(snapshot.pendingChangeIds);
  if (pendingSet.size !== snapshot.pendingChangeIds.length) return false;

  const resolvedSet = new Set(snapshot.resolvedChangeIds);
  if (resolvedSet.size !== snapshot.resolvedChangeIds.length) return false;

  for (const id of pendingSet) {
    if (resolvedSet.has(id)) return false;
  }
  return true;
}
