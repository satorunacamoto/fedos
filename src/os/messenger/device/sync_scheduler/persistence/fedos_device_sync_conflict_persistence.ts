/**
 * Secure Runtime Alpha 3721–3800 — Conflict Persistence (Phase L).
 *
 * A DELIBERATE, DOCUMENTED simplification relative to this Arc's own
 * event-sourced Schedule persistence: a Conflict record has only three
 * real transitions (observed -> reobserved (0+ times) -> resolved), so
 * this file uses a "full snapshot per write, last-write-wins by
 * `conflictId`" NDJSON style rather than a per-transition event type —
 * still durable/restart-safe (replay takes the LAST line for a given
 * `conflictId`), still fail-closed on a corrupt line, still zero reliance
 * on an in-memory-only set, just a smaller surface for a smaller state
 * machine.
 *
 * `conflictId` is deterministic: `${targetDeviceId}:${changeId}` — one
 * target Device's own encounter with one Journal change is one Conflict
 * identity, so a retried import of the SAME change against the SAME
 * target re-observes the SAME record (updating `lastObservedAt`) rather
 * than fabricating a new one.
 */

import type { FedosDeviceSyncConflictKind } from "../fedos_device_sync_conflict.js";
import type { FedosDeviceSyncResolutionDecision } from "../fedos_device_sync_conflict_authority.js";

export type FedosDeviceSyncConflictResolutionAction = "accept-identical" | "discard-invalid" | "refresh-missing-dependency" | "acknowledge";

export interface FedosDeviceSyncConflictRecordV1 {
  readonly schemaVersion: 1;
  readonly conflictId: string;
  readonly sourceDeviceId: string;
  readonly targetDeviceId: string;
  readonly changeId: string;
  readonly conversationId: string;
  readonly recordType: string | null;
  readonly conflictKind: FedosDeviceSyncConflictKind;
  readonly decision: FedosDeviceSyncResolutionDecision;
  readonly reason: string;
  readonly firstObservedAt: number;
  readonly lastObservedAt: number;
  readonly resolved: boolean;
  readonly resolutionAction: FedosDeviceSyncConflictResolutionAction | null;
  readonly resolvedAt: number | null;
}

export function fedosDeviceSyncConflictId(targetDeviceId: string, changeId: string): string {
  return `${targetDeviceId}:${changeId}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUnixSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

const CONFLICT_KINDS: readonly FedosDeviceSyncConflictKind[] = [
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
];

const RESOLUTION_ACTIONS: readonly FedosDeviceSyncConflictResolutionAction[] = ["accept-identical", "discard-invalid", "refresh-missing-dependency", "acknowledge"];

/** Structural validation only. Fails closed; never throws. */
export function isWellFormedFedosDeviceSyncConflictRecordV1(candidate: unknown): candidate is FedosDeviceSyncConflictRecordV1 {
  if (typeof candidate !== "object" || candidate === null) return false;
  const value = candidate as Record<string, unknown>;
  if (Object.keys(value).length !== 15) return false;
  if (value.schemaVersion !== 1) return false;
  if (!isNonEmptyString(value.conflictId) || !isNonEmptyString(value.sourceDeviceId) || !isNonEmptyString(value.targetDeviceId)) return false;
  if (!isNonEmptyString(value.changeId) || !isNonEmptyString(value.conversationId)) return false;
  if (value.recordType !== null && !isNonEmptyString(value.recordType)) return false;
  if (!CONFLICT_KINDS.includes(value.conflictKind as FedosDeviceSyncConflictKind)) return false;
  if (typeof value.decision !== "string") return false;
  if (!isNonEmptyString(value.reason)) return false;
  if (!isValidUnixSeconds(value.firstObservedAt) || !isValidUnixSeconds(value.lastObservedAt)) return false;
  if (typeof value.resolved !== "boolean") return false;
  if (value.resolutionAction !== null && !RESOLUTION_ACTIONS.includes(value.resolutionAction as FedosDeviceSyncConflictResolutionAction)) return false;
  if (value.resolvedAt !== null && !isValidUnixSeconds(value.resolvedAt)) return false;
  return true;
}

export interface FedosDeviceSyncConflictPersistence {
  /** Inserts a NEW conflict, or (if `conflictId` already exists) updates `lastObservedAt` to the later of the two timestamps, WITHOUT clearing an existing `resolved` state -- re-observing an already-resolved conflict never silently reopens it. */
  observe(record: FedosDeviceSyncConflictRecordV1): void;
  resolve(conflictId: string, action: FedosDeviceSyncConflictResolutionAction, resolvedAt: number): boolean;
  get(conflictId: string): FedosDeviceSyncConflictRecordV1 | null;
  listUnresolved(): readonly FedosDeviceSyncConflictRecordV1[];
  listAll(): readonly FedosDeviceSyncConflictRecordV1[];
}
