/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Deterministic Local Deletion Plan.
 *
 * Phase F — every builder here is a PURE function of an already-computed
 * `FedosDeletionAssessment` (`fedos_deletion_assessment.ts`) — same
 * assessment in, same plan out, always. No authority is called here; a
 * plan only describes what the Execution Coordinator
 * (`fedos_deletion_execution_coordinator.ts`) would do next.
 *
 * BINDING, restated from this Arc's own Absolute Prohibitions: a
 * `local-payload-deletion` plan NEVER includes a `remove-archive-file`
 * step, and a `local-archive-file-removal` plan NEVER includes a
 * `retention-transition`/`purge-index` step — the two plan kinds are
 * built by entirely separate functions, each requiring its own
 * independent confirmation, so the two can never be silently combined
 * into one confirmation prompt.
 */

import type { FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosDeletionTarget } from "./fedos_deletion_target.js";
import type { FedosDeletionOperation } from "./fedos_deletion_operation.js";
import type { FedosDeletionAssessment, FedosDeletionArchiveFileAssessmentInput } from "./fedos_deletion_assessment.js";
import { assessFedosLocalArchiveFileDeletion } from "./fedos_deletion_assessment.js";

export type FedosDeletionPlanStepKind = "retention-transition" | "purge-index" | "remove-archive-file" | "revoke-access";

export interface FedosDeletionPlanStep {
  readonly kind: FedosDeletionPlanStepKind;
  readonly target: FedosDeletionTarget;
  readonly operation: FedosDeletionOperation;
}

export type FedosDeletionPlanKind =
  | "local-payload-deletion"
  | "local-archive-file-removal"
  | "local-device-access-revocation"
  | "local-membership-access-revocation";

export interface FedosDeletionPlan {
  readonly planId: string;
  readonly kind: FedosDeletionPlanKind;
  /** An opaque canonical reference (payloadId/conversationId/deviceRef, etc.) — never a raw path, never content. */
  readonly canonicalTargetRef: string;
  readonly steps: readonly FedosDeletionPlanStep[];
  readonly requiresExplicitConfirmation: boolean;
}

/**
 * The next single valid Retention transition (`tombstone` then, in a
 * LATER separately-confirmed plan, `logical-delete`) plus its
 * corresponding Search purge — never both retention steps in one plan,
 * matching `FedosPayloadRetentionAuthority`'s own Alpha 798 transition
 * rule that a payload advances ONE step at a time. Returns a zero-step
 * plan (nothing left to do) when the assessment reports `not-found` or
 * `already-terminal`.
 */
export function buildFedosLocalPayloadDeletionPlan(
  planId: string,
  payloadId: FedosConversationPayloadId,
  assessment: FedosDeletionAssessment,
): FedosDeletionPlan {
  if (assessment.blocker === "not-found" || assessment.blocker === "already-terminal") {
    return { planId, kind: "local-payload-deletion", canonicalTargetRef: payloadId, steps: [], requiresExplicitConfirmation: false };
  }

  const currentlyTombstoned = assessment.observations.some((o) => o.target === "local-payload" && o.status === "locally-tombstoned");
  const operation: FedosDeletionOperation = currentlyTombstoned ? "logical-delete" : "tombstone";

  return {
    planId,
    kind: "local-payload-deletion",
    canonicalTargetRef: payloadId,
    steps: [
      { kind: "retention-transition", target: "local-payload", operation },
      { kind: "purge-index", target: "local-index", operation: "purge-index" },
    ],
    requiresExplicitConfirmation: true,
  };
}

/** A separate, independently-confirmed plan for exactly one tracked Archive Package file — never bundled with a payload-deletion plan. */
export function buildFedosLocalArchiveFileRemovalPlan(
  planId: string,
  conversationId: FedosConversationId,
  assessmentInput: FedosDeletionArchiveFileAssessmentInput,
): FedosDeletionPlan {
  const assessment = assessFedosLocalArchiveFileDeletion(assessmentInput);
  if (assessment.handle === null) {
    return { planId, kind: "local-archive-file-removal", canonicalTargetRef: conversationId, steps: [], requiresExplicitConfirmation: false };
  }
  return {
    planId,
    kind: "local-archive-file-removal",
    canonicalTargetRef: conversationId,
    steps: [{ kind: "remove-archive-file", target: "local-archive-file", operation: "remove-file" }],
    requiresExplicitConfirmation: true,
  };
}

/** A single-step plan revoking one Device's sync access — never combined with payload/Archive deletion. */
export function buildFedosLocalDeviceAccessRevocationPlan(planId: string, deviceRef: string, assessment: FedosDeletionAssessment): FedosDeletionPlan {
  if (assessment.blocker !== "none") {
    return { planId, kind: "local-device-access-revocation", canonicalTargetRef: deviceRef, steps: [], requiresExplicitConfirmation: false };
  }
  return {
    planId,
    kind: "local-device-access-revocation",
    canonicalTargetRef: deviceRef,
    steps: [{ kind: "revoke-access", target: "local-device-access", operation: "revoke-access" }],
    requiresExplicitConfirmation: true,
  };
}

/** A single-step plan revoking one Membership's access — never combined with payload/Archive deletion. */
export function buildFedosLocalMembershipAccessRevocationPlan(
  planId: string,
  conversationId: FedosConversationId,
  assessment: FedosDeletionAssessment,
): FedosDeletionPlan {
  if (assessment.blocker !== "none") {
    return { planId, kind: "local-membership-access-revocation", canonicalTargetRef: conversationId, steps: [], requiresExplicitConfirmation: false };
  }
  return {
    planId,
    kind: "local-membership-access-revocation",
    canonicalTargetRef: conversationId,
    steps: [{ kind: "revoke-access", target: "local-membership-access", operation: "revoke-access" }],
    requiresExplicitConfirmation: true,
  };
}
