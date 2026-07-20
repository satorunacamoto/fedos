/**
 * Secure Runtime Alpha 3721–3800 ("Background Device Sync Scheduling and
 * Conflict Resolution") — Import Coordination (Phase K).
 *
 * A POST-PROCESSING enrichment layer over `FedosSyncState.applyPendingChanges()`
 * (Alpha 2421–2500, UNMODIFIED, unwidened) — this file adds NO new Journal
 * apply logic of its own; it calls that EXISTING method exactly once per
 * import, then re-classifies EVERY result (including a base `"applied"`/
 * `"archived-skip"` outcome — the base classifier has no Registry
 * reference and no record-allowlist awareness, so a since-revoked
 * origin or a disallowed record type is never something it can catch on
 * its own) through the richer Phase H/I/J vocabulary, and durably records
 * anything that is not a clean apply/skip as a Conflict fact.
 *
 * HONEST, DOCUMENTED ATOMICITY MODEL (Phase K's own "stop or isolate
 * according to documented atomicity model" instruction): `FedosSyncState.applyPendingChanges()`
 * is UNCHANGED — it advances the target Device's Cursor past EVERY
 * pending entry unconditionally, by its own Alpha 2421–2500 design
 * ("so no single conflicted/duplicate/archived entry can block everything
 * after it"). This Arc does not, and cannot without redesigning that
 * accepted behavior, make the Cursor itself stop at a blocking record.
 * Instead, "the unresolved blocking record remains visible" (Phase K's
 * own requirement) is satisfied by THIS file's own Conflict persistence
 * (Phase L): every entry the richer classifier does not mark safe to
 * apply is durably recorded as an unresolved Conflict, independent of
 * where the Cursor physically sits — visible via
 * `FedosDeviceSyncConflictPersistence.listUnresolved()` for as long as it
 * remains unresolved, regardless of Cursor position. This is the
 * documented, honest boundary this Arc stops at rather than silently
 * redesigning the Sync Journal's own cursor-advance semantics.
 *
 * "Expose applied/skipped/conflict counts honestly" (Phase K) is
 * satisfied by `FedosDeviceSyncImportSummary`'s own three explicit
 * counters, plus the full, unmodified `FedosSyncApplyResult[]` passthrough
 * for complete transparency.
 */

import { FedosSyncState, type FedosSyncApplyResult } from "../../sync/fedos_sync_state.js";
import type { FedosSyncJournalEntryV1 } from "../../sync/fedos_sync_journal.js";
import type { FedosSyncConflictKind } from "../../sync/fedos_sync_conflict.js";
import type { FedosDeviceRegistryPersistence } from "../persistence/fedos_device_registry_persistence.js";
import { classifyFedosDeviceSyncConflict, type FedosDeviceSyncConflictKind } from "./fedos_device_sync_conflict.js";
import { planFedosDeviceSyncResolution, type FedosDeviceSyncResolutionDecision } from "./fedos_device_sync_conflict_authority.js";
import { fedosDeviceSyncConflictId, type FedosDeviceSyncConflictPersistence } from "./persistence/fedos_device_sync_conflict_persistence.js";

export interface FedosDeviceSyncImportCoordinatorDeps {
  readonly syncState: FedosSyncState;
  /** Read-only -- resolves the LIVE trust state of each entry's own `originDeviceRef` (`deviceRef` in Registry terms). Never mutated by this file. */
  readonly registryPersistence: FedosDeviceRegistryPersistence;
  readonly conflictPersistence: FedosDeviceSyncConflictPersistence;
  /** OPTIONAL -- when a caller has separately resolved a `changeId`'s own record type (the Journal itself carries none), it may supply a lookup here so `"unknown-record-type"`/domain-specific classification can run. Absent entries are classified WITHOUT record-type context (a real, honest degradation, not a crash). */
  readonly recordTypeForChangeId?: (changeId: string) => string | undefined;
}

export interface FedosDeviceSyncImportEntryOutcome {
  readonly changeId: string;
  readonly conversationId: string;
  readonly baseOutcome: FedosSyncApplyResult["outcome"];
  readonly conflictKind: FedosDeviceSyncConflictKind | null;
  readonly decision: FedosDeviceSyncResolutionDecision | null;
}

export interface FedosDeviceSyncImportSummary {
  readonly targetDeviceId: string;
  readonly appliedCount: number;
  readonly skippedIdenticalCount: number;
  readonly conflictCount: number;
  readonly entries: readonly FedosDeviceSyncImportEntryOutcome[];
  readonly results: readonly FedosSyncApplyResult[];
}

export class FedosDeviceSyncImportCoordinator {
  readonly #deps: FedosDeviceSyncImportCoordinatorDeps;

  constructor(deps: FedosDeviceSyncImportCoordinatorDeps) {
    this.#deps = deps;
  }

  importPendingChanges(targetDeviceId: string, now: number): FedosDeviceSyncImportSummary {
    // Captured BEFORE the existing apply call -- the one honest reference point for gap detection this file has access to, since the Cursor itself advances past every entry unconditionally during the call below (see this file's own header).
    const cursorBeforeImport = this.#deps.syncState.getCursor(targetDeviceId).sequence;
    const entriesByChangeId = new Map<string, FedosSyncJournalEntryV1>(this.#deps.syncState.journalEntries().map((entry) => [entry.changeId, entry]));

    const results = this.#deps.syncState.applyPendingChanges(targetDeviceId, now);

    let appliedCount = 0;
    let skippedIdenticalCount = 0;
    let conflictCount = 0;
    const entries: FedosDeviceSyncImportEntryOutcome[] = [];
    // Tracks "the local Cursor value immediately before THIS entry" across the batch.
    // `FedosSyncState.applyPendingChanges()` advances the Cursor to `entry.sequence` after EVERY entry it
    // processes, in ascending sequence order (`FedosSyncPendingChangeQueue.listPending()`'s own contract) --
    // this mirrors that same progression rather than reusing one stale, batch-start snapshot for every
    // entry (which would spuriously flag every entry after the first in a multi-entry batch as
    // `"missing-dependency"`).
    let observedCursor = cursorBeforeImport;

    for (const result of results) {
      const entry = entriesByChangeId.get(result.changeId);
      const originTrustState = entry === undefined ? "unknown" : this.#deps.registryPersistence.getBinding(entry.originDeviceRef)?.trustState ?? "unknown";
      const recordType = this.#deps.recordTypeForChangeId?.(result.changeId);
      const localCursorSequence = observedCursor;
      if (entry !== undefined) observedCursor = entry.sequence;

      // Every result is classified through the richer vocabulary, unconditionally -- never only the subset
      // `FedosSyncState`'s own base classifier already flagged (Phase K: "inspect every record ... never
      // silently skip a blocking record"). In particular, a device revoked AFTER contributing a journal
      // entry, or a record type outside the Sync Journal allowlist, is NOT something the base classifier
      // (`classifyFedosSyncConflict()`, entry-vs-entry only, no Registry reference) can ever catch on its
      // own -- both are caught here even for an otherwise-clean `"applied"`/`"archived-skip"` base outcome.
      const baseConflictKind: FedosSyncConflictKind = result.outcome === "duplicate" ? "duplicate" : result.outcome === "conflict" ? (result.conflict ?? "concurrent-update") : "none";

      const classification = classifyFedosDeviceSyncConflict({
        baseConflictKind,
        incomingSequence: entry?.sequence ?? localCursorSequence + 1,
        incomingConversationId: result.conversationId,
        incomingOriginDeviceTrustState: originTrustState,
        localCursorSequence,
        incomingRecordType: recordType,
      });
      const plan = planFedosDeviceSyncResolution(classification.kind);

      if (plan.decision === "apply") {
        // `FedosSyncState.applyPendingChanges()` itself already decided whether to mark this entry applied;
        // this file adds no new apply logic of its own (see this file's own header). A reclassified
        // duplicate/conflict outcome (e.g. `"safe-concurrent-append"`) is recorded in `entries` for
        // transparency (`decision: "apply"`) without being double-counted here.
        if (result.outcome === "applied") appliedCount += 1;
      } else if (plan.decision === "skip-identical") {
        skippedIdenticalCount += 1;
      } else {
        conflictCount += 1;
        this.#deps.conflictPersistence.observe({
          schemaVersion: 1,
          conflictId: fedosDeviceSyncConflictId(targetDeviceId, result.changeId),
          sourceDeviceId: entry?.originDeviceRef ?? "unknown",
          targetDeviceId,
          changeId: result.changeId,
          conversationId: result.conversationId,
          recordType: recordType ?? null,
          conflictKind: classification.kind,
          decision: plan.decision,
          reason: plan.reason,
          firstObservedAt: now,
          lastObservedAt: now,
          resolved: false,
          resolutionAction: null,
          resolvedAt: null,
        });
      }

      entries.push({ changeId: result.changeId, conversationId: result.conversationId, baseOutcome: result.outcome, conflictKind: classification.kind, decision: plan.decision });
    }

    return { targetDeviceId, appliedCount, skippedIdenticalCount, conflictCount, entries, results };
  }
}
