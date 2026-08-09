/**
 * Secure Runtime Alpha 3721–3800 — Conflict Authority / Resolution Planner
 * (Phase I/J).
 *
 * An ADDITIVE resolver/planner boundary: returns a PLAN, never an
 * arbitrary direct mutation of Sync Journal/Cursor/Pending-Change state
 * (Phase J's own explicit instruction). Separates DETECTION
 * (`fedos_device_sync_conflict.ts`, already run), PLANNING (this file),
 * APPLICATION (`fedos_device_sync_import_coordinator.ts`, which executes
 * ONLY `"apply"`/`"skip-identical"` plans through the EXISTING,
 * unmodified `FedosSyncState`), and OBSERVATION
 * (`persistence/fedos_device_sync_conflict_persistence.ts`, which records
 * every non-`"apply"` plan as a durable, queryable fact).
 *
 * Uses actual domain semantics named by this Arc's own Phase I
 * instruction, never one generic last-write-wins resolver:
 *   - Insert-once immutable records: identical duplicate -> idempotent
 *     accept; same identity/different content -> conflict, NEVER
 *     overwrite (`"record-conflict"`, never `"apply"`).
 *   - Append-only events: different identities safely coexist
 *     (`"apply"`); same identity/different content -> conflict.
 *   - Tombstone/revocation facts: a later terminal fact is respected; an
 *     upsert attempting to reverse a tombstone is REJECTED, never
 *     applied (`"reject-invalid"`) -- this file never restores a
 *     revoked fact from a stale upsert.
 *   - Projections: a stale, locally-re-derivable projection record is
 *     superseded by a local refresh, never blindly applied over newer
 *     local state (`"retry-after-refresh"`).
 *
 * Every decision carries a coarse `reason` (Phase J's own explicit
 * requirement) — never a bare enum value with no explanation.
 */

import type { FedosDeviceSyncConflictKind } from "../../../../device/sync_scheduler/fedos_device_sync_conflict.js";

export type FedosDeviceSyncResolutionDecision =
  | "apply"
  | "skip-identical"
  | "defer-missing-dependency"
  | "reject-invalid"
  | "record-conflict"
  | "require-operator"
  | "retry-after-refresh";

export interface FedosDeviceSyncResolutionPlan {
  readonly decision: FedosDeviceSyncResolutionDecision;
  readonly reason: string;
}

const PLAN_TABLE: Readonly<Record<FedosDeviceSyncConflictKind, { decision: FedosDeviceSyncResolutionDecision; reason: string }>> = Object.freeze({
  none: { decision: "apply", reason: "no conflict detected -- safe to apply directly" },
  "identical-duplicate": { decision: "skip-identical", reason: "byte-identical to the already-applied entry -- idempotent, nothing new to apply" },
  "missing-dependency": { decision: "defer-missing-dependency", reason: "an intermediate entry has not yet been applied -- deferred until the gap closes" },
  "immutable-record-conflict": { decision: "record-conflict", reason: "same record identity, different content, from a different Device -- an insert-once/immutable record is never overwritten" },
  "cursor-divergence": { decision: "require-operator", reason: "the incoming entry's sequence is behind the local cursor but does not match what was already applied -- a genuine, unexplained divergence" },
  "invalid-transition": { decision: "reject-invalid", reason: "the incoming entry attempts a transition the domain forbids (e.g. reversing a terminal tombstone) -- rejected, never applied" },
  "revoked-device-contribution": { decision: "reject-invalid", reason: "the originating Device is not currently trusted -- its contribution is rejected, never applied" },
  "unknown-record-type": { decision: "reject-invalid", reason: "the record type is not on the Sync Journal allowlist, or its metadata carries a sensitive marker -- rejected, never applied" },
  "stale-projection": { decision: "retry-after-refresh", reason: "a locally re-derivable projection record arrived older than local state -- superseded by a local refresh, never applied over newer state" },
  "safe-concurrent-append": { decision: "apply", reason: "an append-only event from a different Device -- safely coexists, applied directly" },
  "operator-decision-required": { decision: "require-operator", reason: "two different, currently-trusted Devices produced different changes for the same conversation with no domain context available to decide safely" },
});

/** Pure, deterministic — the SAME `FedosDeviceSyncConflictKind` always yields the SAME plan. No randomness, no I/O, no mutation. */
export function planFedosDeviceSyncResolution(conflictKind: FedosDeviceSyncConflictKind): FedosDeviceSyncResolutionPlan {
  return PLAN_TABLE[conflictKind];
}
