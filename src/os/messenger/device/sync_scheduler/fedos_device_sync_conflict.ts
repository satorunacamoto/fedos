/**
 * Secure Runtime Alpha 3721–3800 ("Background Device Sync Scheduling and
 * Conflict Resolution") — the richer Conflict Vocabulary (Phase H).
 *
 * ADDITIVE, not a replacement: `classifyFedosSyncConflict()`
 * (`../../sync/fedos_sync_conflict.ts`, Alpha 2421–2500, UNMODIFIED,
 * unwidened) remains the base signal this file reads FIRST — its own
 * four-value `FedosSyncConflictKind` is reused verbatim as one input,
 * supplied by the CALLER (`baseConflictKind`) rather than recomputed here:
 * `FedosSyncState` (Alpha 2421–2500) keeps its own per-device,
 * per-conversation "last applied" state PRIVATE (`#lastAppliedByConversationPerDevice`)
 * — there is no public accessor for it, and this Arc does not add one
 * (that would be touching/widening the Sync Journal's own frozen shape).
 * A caller with direct access to `lastApplied`/`incoming` (a pure unit
 * test) computes `baseConflictKind` itself via the existing function; the
 * Import Coordinator (`fedos_device_sync_import_coordinator.ts`) reads it
 * from `FedosSyncApplyResult.conflict`, which `FedosSyncState.applyPendingChanges()`
 * already computed correctly using its own private state.
 *
 * This file adds the categories the base classifier has no room for at
 * all: record-allowlist status, LIVE Device Registry trust of the
 * originating Device, and sequence-gap/cursor-divergence detection — none
 * of which `classifyFedosSyncConflict()` was ever designed to know about
 * (it classifies one entry against one prior entry; it has no Registry
 * reference and no cursor reference).
 *
 * Does not call every duplicate a conflict, and does not collapse invalid
 * data with concurrent valid data (this Arc's own explicit Phase H
 * instruction): `"identical-duplicate"` is distinct from
 * `"safe-concurrent-append"`, and `"unknown-record-type"`/
 * `"revoked-device-contribution"` (genuinely invalid contributions) are
 * distinct from `"immutable-record-conflict"`/`"operator-decision-required"`
 * (genuinely concurrent, valid-but-conflicting contributions).
 */

import type { FedosSyncConflictKind } from "../../../../sync/fedos_sync_conflict.js";
import { reviewFedosSyncRecordForJournal } from "../../../../sync/fedos_sync_record_allowlist.js";
import type { FedosDeviceTrustState } from "../../../../device/fedos_device_binding.js";

export type FedosDeviceSyncConflictKind =
  | "none"
  | "identical-duplicate"
  | "immutable-record-conflict"
  | "missing-dependency"
  | "cursor-divergence"
  | "invalid-transition"
  | "revoked-device-contribution"
  | "unknown-record-type"
  | "stale-projection"
  | "safe-concurrent-append"
  | "operator-decision-required";

/** Record types this Arc treats as append-only, safely-coexisting event logs when produced by two different, both-currently-trusted Devices (Phase I's own "Append-only events: different identities -> coexist if dependencies valid"). Every OTHER allowlisted type is treated conservatively as insert-once/immutable. */
const APPEND_ONLY_SAFE_RECORD_TYPES: ReadonlySet<string> = new Set(["capability-public-event"]);

/** Record types this Arc treats as locally re-derivable projections (Phase I's own "derive from canonical event history where possible; do not sync mutable projection as canonical truth when reconstructible") -- a concurrent disagreement here is resolved by local re-derivation, never by either Device's own claim. */
const PROJECTION_RECORD_TYPES: ReadonlySet<string> = new Set(["search-canonical-id"]);

export interface FedosDeviceSyncConflictClassificationContext {
  /** The EXISTING, unmodified Alpha 2421–2500 signal — supplied by the caller (see this file's own header for why it is never recomputed here). */
  readonly baseConflictKind: FedosSyncConflictKind;
  readonly incomingSequence: number;
  readonly incomingConversationId: string;
  /** LIVE-checked by the caller against the Device Registry (`FedosDeviceRegistryPersistence.getBinding()`) -- this file never reaches into the Registry itself. */
  readonly incomingOriginDeviceTrustState: FedosDeviceTrustState | "unknown";
  /** The local device's own current Cursor sequence -- used for gap/divergence detection. */
  readonly localCursorSequence: number;
  /** OPTIONAL -- present when the caller has this context available (e.g. reviewing a record BEFORE it is journaled). The Journal itself carries no `recordType` field (Alpha 2421–2500's own frozen shape), so entries already IN the Journal were already allowlist-reviewed at their origin; this context lets a caller ALSO classify a not-yet-journaled candidate honestly. */
  readonly incomingRecordType?: string;
  readonly incomingRecordMetadata?: Readonly<Record<string, string>>;
}

export interface FedosDeviceSyncConflictClassification {
  readonly kind: FedosDeviceSyncConflictKind;
  readonly reason: string;
  readonly baseConflictKind: FedosSyncConflictKind;
}

export function classifyFedosDeviceSyncConflict(context: FedosDeviceSyncConflictClassificationContext): FedosDeviceSyncConflictClassification {
  const { baseConflictKind } = context;

  if (context.incomingRecordType !== undefined) {
    const review = reviewFedosSyncRecordForJournal(context.incomingRecordType, context.incomingRecordMetadata);
    if (!review.allowed) {
      return { kind: "unknown-record-type", reason: review.reason, baseConflictKind };
    }
  }

  if (context.incomingOriginDeviceTrustState !== "trusted") {
    return { kind: "revoked-device-contribution", reason: `originating device trust state is "${context.incomingOriginDeviceTrustState}", not "trusted"`, baseConflictKind };
  }

  if (context.incomingSequence > context.localCursorSequence + 1) {
    return { kind: "missing-dependency", reason: `incoming sequence ${context.incomingSequence} is ahead of local cursor ${context.localCursorSequence} by more than one -- an intermediate entry has not yet been applied`, baseConflictKind };
  }

  if (baseConflictKind === "duplicate") {
    return { kind: "identical-duplicate", reason: "same changeId as the last-applied entry for this conversation", baseConflictKind };
  }

  if (context.incomingSequence <= context.localCursorSequence) {
    return { kind: "cursor-divergence", reason: `incoming sequence ${context.incomingSequence} is at or behind the local cursor ${context.localCursorSequence} but is not recognized as the same change`, baseConflictKind };
  }

  if (baseConflictKind === "tombstone-vs-upsert") {
    return { kind: "invalid-transition", reason: "an upsert arrived for a conversation whose last-applied entry was a tombstone -- a tombstone is a terminal fact and is never reversed by a later upsert", baseConflictKind };
  }

  if (baseConflictKind === "concurrent-update") {
    if (context.incomingRecordType !== undefined && PROJECTION_RECORD_TYPES.has(context.incomingRecordType)) {
      return { kind: "stale-projection", reason: `record type "${context.incomingRecordType}" is a locally re-derivable projection -- a concurrent disagreement is resolved by local refresh, never by either Device's own claim`, baseConflictKind };
    }
    if (context.incomingRecordType !== undefined && APPEND_ONLY_SAFE_RECORD_TYPES.has(context.incomingRecordType)) {
      return { kind: "safe-concurrent-append", reason: `record type "${context.incomingRecordType}" is append-only-safe -- two different Devices' own entries coexist`, baseConflictKind };
    }
    if (context.incomingRecordType !== undefined) {
      return { kind: "immutable-record-conflict", reason: `record type "${context.incomingRecordType}" is insert-once/immutable -- a same-identity, different-content contribution from another Device is never silently overwritten`, baseConflictKind };
    }
    return { kind: "operator-decision-required", reason: "two different Devices produced different changes for the same conversation and no record-type context is available to decide whether this is safely coexisting or a genuine conflict", baseConflictKind };
  }

  return { kind: "none", reason: "no conflict -- safe to apply", baseConflictKind };
}
