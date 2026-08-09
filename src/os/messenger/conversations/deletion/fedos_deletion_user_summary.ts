/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — User-Safe Summary DTO.
 *
 * Phase M — this lineage has no accepted presentation-boundary type for
 * Conversation deletion (no `docs/`-documented view-model layer exists
 * for it anywhere under `src/conversation/`), so this Arc exposes a
 * plain, framework-neutral DTO directly from the local deletion facade
 * rather than inventing a presentation framework. No Electron IPC/UI is
 * added by this Arc.
 *
 * HARD GUARDRAILS:
 *   - No raw filesystem path anywhere in the returned DTO — a
 *     `FedosDeletionAssessment`/`FedosPersistedDeletionExecutionRecordV1`
 *     never carries one to begin with (see those files' own headers).
 *   - Every warning is drawn from the closed
 *     `FedosDeletionNonGuaranteeCode` vocabulary's own fixed text
 *     (`fedos_deletion_non_guarantees.ts`) — never free text a caller
 *     could soften into an overclaim.
 *   - `"no-deleted-everywhere"` is always included once, appended last —
 *     restated from this Arc's own binding floor: no status combination
 *     is ever presented as "deleted everywhere."
 */

import type { FedosDeletionAssessment } from "./fedos_deletion_assessment.js";
import { FEDOS_DELETION_NON_GUARANTEE_TEXT } from "./fedos_deletion_non_guarantees.js";
import type { FedosPersistedDeletionExecutionRecordV1 } from "./fedos_persisted_deletion_execution_record_v1.js";

export interface FedosDeletionUserSafeSummary {
  readonly targetExists: boolean;
  readonly statuses: readonly { readonly target: string; readonly status: string }[];
  readonly safeSummary: string;
  readonly warnings: readonly string[];
}

function withUniversalWarning(warnings: readonly string[]): readonly string[] {
  return [...warnings, FEDOS_DELETION_NON_GUARANTEE_TEXT["no-deleted-everywhere"]];
}

/** Builds a safe, pre-execution summary from a read-only assessment. */
export function buildFedosDeletionAssessmentSummary(assessment: FedosDeletionAssessment): FedosDeletionUserSafeSummary {
  return {
    targetExists: assessment.targetExists,
    statuses: assessment.observations.map((o) => ({ target: o.target, status: o.status })),
    safeSummary: assessment.safeSummary,
    warnings: withUniversalWarning(assessment.warnings.map((code) => FEDOS_DELETION_NON_GUARANTEE_TEXT[code])),
  };
}

/** Builds a safe, post-execution summary from a durable execution record — never includes a raw path, plan internals beyond target/operation/outcome, or plaintext. */
export function buildFedosDeletionExecutionSummary(record: FedosPersistedDeletionExecutionRecordV1): FedosDeletionUserSafeSummary {
  const summary =
    record.status === "completed"
      ? "Completed: removed from local history and local Search index where applicable."
      : record.status === "partially-deleted"
        ? "Partially completed: some steps succeeded, others did not — see individual statuses."
        : "Failed: no step completed successfully.";

  return {
    targetExists: true,
    statuses: record.steps.map((s) => ({ target: s.target, status: s.outcome })),
    safeSummary: summary,
    warnings: withUniversalWarning(record.warnings.map((code) => FEDOS_DELETION_NON_GUARANTEE_TEXT[code])),
  };
}
