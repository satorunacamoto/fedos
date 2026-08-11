/**
 * Secure Runtime Alpha 2421–2500 ("Multi Device Synchronization
 * Foundation") — Conflict Vocabulary.
 *
 * A pure CLASSIFICATION over one conversation's most-recently-applied
 * Sync Journal entry versus the next candidate entry — never a
 * resolution/merge. Resolution policy (last-write-wins, CRDT merge,
 * user prompt, ...) is deliberately OUT of this Arc's scope, mirroring
 * the Archive Arc's own "Restore ≠ new persistence logic" discipline
 * (Alpha 1541–1610): this file only names WHAT kind of conflict
 * exists, so a caller (Sync State, or a future Arc) can decide what to
 * do about it.
 *
 * `"duplicate"` is the SAME `changeId`-identity distinction the Sync
 * Journal itself already makes on `append()` — surfaced again here
 * because Pending Changes/Sync State classify entries that already
 * passed the journal's own append-time check (e.g. an at-least-once
 * redelivery of an already-applied change).
 *
 * HARD GUARDRAILS:
 *   - Pure function — no I/O, no mutation, never throws.
 *   - Invents no outcome beyond the four named here.
 */

import type { FedosSyncJournalEntryV1 } from "./fedos_sync_journal.js";

export type FedosSyncConflictKind = "none" | "duplicate" | "tombstone-vs-upsert" | "concurrent-update";

/**
 * Classifies `incoming` against `lastApplied` (the last journal entry
 * actually applied to local state for `incoming.conversationId`, or
 * `null` if none has been applied yet):
 *
 *   - `null` last-applied            -> `"none"` (nothing to conflict with)
 *   - same `changeId`                -> `"duplicate"`
 *   - last-applied was a `tombstone`,
 *     incoming is an `upsert`        -> `"tombstone-vs-upsert"`
 *   - different `originDeviceRef`    -> `"concurrent-update"` (two
 *     devices produced different changes for the same conversation
 *     with neither aware of the other — this Arc has no vector clock,
 *     so ANY cross-device difference is treated conservatively as
 *     concurrent)
 *   - otherwise (same device's own next edit) -> `"none"`
 */
export function classifyFedosSyncConflict(
  lastApplied: FedosSyncJournalEntryV1 | null,
  incoming: FedosSyncJournalEntryV1,
): FedosSyncConflictKind {
  if (lastApplied === null) return "none";
  if (lastApplied.changeId === incoming.changeId) return "duplicate";
  if (lastApplied.kind === "tombstone" && incoming.kind === "upsert") return "tombstone-vs-upsert";
  if (lastApplied.originDeviceRef !== incoming.originDeviceRef) return "concurrent-update";
  return "none";
}
