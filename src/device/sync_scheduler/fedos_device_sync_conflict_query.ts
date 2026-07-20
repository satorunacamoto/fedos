/**
 * Secure Runtime Alpha 3721–3800 — Conflict Query and narrow resolution
 * commands (Phase L).
 *
 * Read-only query surface plus EXACTLY the four objectively-safe
 * resolution actions this Arc's own instructions name: `"accept-identical"`,
 * `"discard-invalid"`, `"refresh-missing-dependency"`, `"acknowledge"`.
 * There is NO "force overwrite canonical state" command anywhere in this
 * file, or anywhere in this Arc — `resolveFedosDeviceSyncConflict()`
 * REJECTS an action that is not on the safe list for that Conflict's own
 * `conflictKind` (`"unsafe-action"`), and NEVER itself mutates Sync
 * Journal/Cursor/Pending-Change state — resolving a Conflict record marks
 * this Arc's OWN bookkeeping fact resolved; it does not retroactively
 * apply, un-apply, or overwrite anything in the Sync Journal.
 */

import type { FedosDeviceSyncConflictKind } from "./fedos_device_sync_conflict.js";
import type { FedosDeviceSyncConflictPersistence, FedosDeviceSyncConflictRecordV1, FedosDeviceSyncConflictResolutionAction } from "./persistence/fedos_device_sync_conflict_persistence.js";

const SAFE_ACTIONS_BY_KIND: Readonly<Record<FedosDeviceSyncConflictKind, readonly FedosDeviceSyncConflictResolutionAction[]>> = Object.freeze({
  none: [],
  "identical-duplicate": ["accept-identical", "acknowledge"],
  "immutable-record-conflict": ["acknowledge"],
  "missing-dependency": ["refresh-missing-dependency", "acknowledge"],
  "cursor-divergence": ["acknowledge"],
  "invalid-transition": ["discard-invalid", "acknowledge"],
  "revoked-device-contribution": ["discard-invalid", "acknowledge"],
  "unknown-record-type": ["discard-invalid", "acknowledge"],
  "stale-projection": ["refresh-missing-dependency", "acknowledge"],
  "safe-concurrent-append": ["acknowledge"],
  "operator-decision-required": ["acknowledge"],
});

/** The objectively-safe resolution actions available for `conflict`'s own kind — NEVER includes a generic "overwrite canonical state" action of any kind. */
export function listSafeResolutionActionsForFedosDeviceSyncConflict(conflict: FedosDeviceSyncConflictRecordV1): readonly FedosDeviceSyncConflictResolutionAction[] {
  return SAFE_ACTIONS_BY_KIND[conflict.conflictKind];
}

export function listUnresolvedFedosDeviceSyncConflicts(persistence: FedosDeviceSyncConflictPersistence): readonly FedosDeviceSyncConflictRecordV1[] {
  return persistence.listUnresolved();
}

export function getFedosDeviceSyncConflictDetail(persistence: FedosDeviceSyncConflictPersistence, conflictId: string): FedosDeviceSyncConflictRecordV1 | null {
  return persistence.get(conflictId);
}

export type FedosDeviceSyncConflictResolveOutcome = "resolved" | "not-found" | "already-resolved" | "unsafe-action";

export function resolveFedosDeviceSyncConflict(
  persistence: FedosDeviceSyncConflictPersistence,
  conflictId: string,
  action: FedosDeviceSyncConflictResolutionAction,
  now: number,
): FedosDeviceSyncConflictResolveOutcome {
  const conflict = persistence.get(conflictId);
  if (conflict === null) return "not-found";
  if (conflict.resolved) return "already-resolved";
  if (!listSafeResolutionActionsForFedosDeviceSyncConflict(conflict).includes(action)) return "unsafe-action";
  const resolved = persistence.resolve(conflictId, action, now);
  return resolved ? "resolved" : "already-resolved";
}
