/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Recipient Evaluation Coordinator.
 *
 * Phase G/J — the ONE real, in-process pipeline that turns a signed
 * request into a durably-recorded `FedosDeletionRecipientDecisionState`.
 * "In-process" is load-bearing: this Arc has no transport (Absolute
 * Prohibitions) — a caller (a future transport Arc, or this Arc's own
 * Phase O vertical-slice test) hands an already-received
 * `FedosSignedDeletionRequestV1` directly to
 * `evaluateFedosDeletionRequestForRecipient`; nothing here ever reads a
 * socket, subscribes to a Relay, or imports `FedosPrivateTransport`.
 *
 * `evaluateFedosDeletionRequestForRecipient` NEVER calls `b3b3a6d`'s
 * execution coordinator — it stops at `"policy-pending"` (authorized) or
 * a terminal denial (`"unauthorized"`/`"expired"`/`"unsupported"`).
 * `markFedosDeletionRecipientLocalPlanReady` and
 * `recordSuppliedFedosDeletionRecipientLocalOutcome` are the ONLY two
 * functions that can advance a `"policy-pending"` request further, and
 * BOTH require the caller to supply an already-computed fact (a real
 * `b3b3a6d` plan/execution result the CALLER produced) — this file
 * itself constructs neither.
 */

import { validateFedosDeletionRequestRecordV1Structure } from "../../../../conversation/deletion_request/fedos_deletion_request_validation.js";
import {
  assessFedosDeletionRequestAuthorization,
  type FedosDeletionRequestAuthorizationAssessmentDependencies,
} from "../../../../conversation/deletion_request/fedos_deletion_request_authorization_assessment.js";
import { coarsenFedosDeletionRequestAuthorizationOutcome } from "../../../../conversation/deletion_request/fedos_deletion_request_authorization_outcome.js";
import type { FedosSignedDeletionRequestV1 } from "../../../../conversation/deletion_request/fedos_deletion_request_signing.js";
import type { FedosDeletionRecipientDecisionState } from "../../../../conversation/deletion_request/fedos_deletion_recipient_decision_state.js";
import type {
  FedosDeletionRecipientDecisionPersistence,
  FedosDeletionRecipientDecisionPersistenceWriteResult,
} from "../../../../conversation/deletion_request/fedos_deletion_recipient_decision_persistence.js";
import type { FedosDeletionRecipientSuppliedLocalOutcome, FedosPersistedDeletionRecipientDecisionRecordV1 } from "../../../../conversation/deletion_request/fedos_persisted_deletion_recipient_decision_record_v1.js";

export interface FedosDeletionRequestRecipientEvaluationDependencies {
  readonly authorization: FedosDeletionRequestAuthorizationAssessmentDependencies;
  readonly persistence: FedosDeletionRecipientDecisionPersistence;
  readonly clock: () => number;
}

export type FedosDeletionRequestRecipientEvaluationOutcome =
  | { readonly outcome: "recorded"; readonly decisionState: FedosDeletionRecipientDecisionState; readonly record: FedosPersistedDeletionRecipientDecisionRecordV1 }
  | { readonly outcome: "duplicate"; readonly existing: FedosPersistedDeletionRecipientDecisionRecordV1 }
  | { readonly outcome: "conflicting-duplicate" }
  | { readonly outcome: "persistence-failed" };

function writeSnapshot(
  persistence: FedosDeletionRecipientDecisionPersistence,
  requestId: string,
  decisionState: FedosDeletionRecipientDecisionState,
  suppliedLocalOutcome: FedosDeletionRecipientSuppliedLocalOutcome | null,
  recordedAt: number,
): FedosDeletionRequestRecipientEvaluationOutcome {
  const record: FedosPersistedDeletionRecipientDecisionRecordV1 = { schemaVersion: 1, requestId, decisionState, suppliedLocalOutcome, recordedAt };
  const writeResult: FedosDeletionRecipientDecisionPersistenceWriteResult = persistence.putRecord(record);
  if (writeResult === "inserted") return { outcome: "recorded", decisionState, record };
  if (writeResult === "already-present") return { outcome: "duplicate", existing: persistence.getRecord(requestId)! };
  if (writeResult === "conflict" || writeResult === "invalid-transition" || writeResult === "invalid-initial-state") return { outcome: "conflicting-duplicate" };
  return { outcome: "persistence-failed" };
}

/**
 * Runs the full in-process pipeline: records `"received"`, then
 * structural validation + `assessFedosDeletionRequestAuthorization`
 * (Phase G/H), then records the resulting terminal
 * (`"unauthorized"`/`"expired"`/`"unsupported"`) or non-terminal
 * (`"policy-pending"`, authorized — awaiting a LOCAL policy decision
 * this Arc does not make) decision state. NEVER executes a local
 * deletion action.
 */
export function evaluateFedosDeletionRequestForRecipient(
  signed: FedosSignedDeletionRequestV1,
  deps: FedosDeletionRequestRecipientEvaluationDependencies,
): FedosDeletionRequestRecipientEvaluationOutcome {
  const now = deps.clock();
  const requestId = signed.record.requestId;

  // Idempotency FIRST (mirrors b3b3a6d's own `persistence.getRecord(planId)`-first
  // discipline): a request already evaluated to ANY state is never re-evaluated -- this
  // is what makes a repeat delivery of the identical requestId safe, instead of attempting
  // to re-write "received" and colliding with whatever this request has already progressed to.
  const existingRecord = deps.persistence.getRecord(requestId);
  if (existingRecord !== null) return { outcome: "duplicate", existing: existingRecord };

  const received = writeSnapshot(deps.persistence, requestId, "received", null, now);
  if (received.outcome !== "recorded") return received;

  const structural = validateFedosDeletionRequestRecordV1Structure(signed.record, now);
  if (structural !== "well-formed") {
    // A structurally-invalid request never reaches "validated" -- "received" transitions
    // directly to a terminal state (matches the reachable-transition table exactly).
    const terminal: FedosDeletionRecipientDecisionState = structural === "issued-in-future" || structural === "lifetime-exceeded" ? "expired" : "unauthorized";
    return writeSnapshot(deps.persistence, requestId, terminal, null, now);
  }

  const validated = writeSnapshot(deps.persistence, requestId, "validated", null, now);
  if (validated.outcome !== "recorded") return validated;

  const detailed = assessFedosDeletionRequestAuthorization(signed, deps.authorization);
  const coarse = coarsenFedosDeletionRequestAuthorizationOutcome(detailed);

  if (coarse === "authorized") return writeSnapshot(deps.persistence, requestId, "policy-pending", null, now);
  if (coarse === "expired") return writeSnapshot(deps.persistence, requestId, "expired", null, now);
  if (coarse === "unsupported") return writeSnapshot(deps.persistence, requestId, "unsupported", null, now);
  return writeSnapshot(deps.persistence, requestId, "unauthorized", null, now);
}

/**
 * Marks a `"policy-pending"` request `"local-plan-ready"` — the CALLER
 * (never this function) has already built a real `b3b3a6d`
 * `FedosDeletionPlan` via `buildFedosLocalPayloadDeletionPlan()`. This
 * function records that fact only; it never builds or executes a plan
 * itself.
 */
export function markFedosDeletionRecipientLocalPlanReady(
  requestId: string,
  persistence: FedosDeletionRecipientDecisionPersistence,
  clock: () => number,
): FedosDeletionRequestRecipientEvaluationOutcome {
  return writeSnapshot(persistence, requestId, "local-plan-ready", null, clock());
}

/**
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion Request
 * Private Transport and Local Policy Integration Arc) — records a
 * `"policy-pending"` request `"policy-rejected"`. The CALLER (the Inbound
 * Coordinator, `fedos_deletion_request_inbound_coordinator.ts`) has
 * already evaluated the real LOCAL recipient policy
 * (`fedos_deletion_recipient_policy.ts`, deliberately absent from
 * `5641-5720`'s own scope) and it denied the request. This function
 * records that fact only — it never decides policy itself, mirroring
 * `markFedosDeletionRecipientLocalPlanReady()`'s own "records, never
 * decides" discipline below.
 */
export function recordFedosDeletionRecipientPolicyRejection(
  requestId: string,
  persistence: FedosDeletionRecipientDecisionPersistence,
  clock: () => number,
): FedosDeletionRequestRecipientEvaluationOutcome {
  return writeSnapshot(persistence, requestId, "policy-rejected", null, clock());
}

/**
 * Records an ALREADY-PRODUCED local deletion outcome (the caller ran
 * `b3b3a6d`'s own real `executeFedosLocalPayloadDeletionPlan()` itself
 * and supplies its real terminal status here) — this Arc's own code
 * never calls that coordinator. Test-only / caller-driven, per Phase J's
 * own explicit instruction.
 */
export function recordSuppliedFedosDeletionRecipientLocalOutcome(
  requestId: string,
  suppliedOutcome: FedosDeletionRecipientSuppliedLocalOutcome,
  persistence: FedosDeletionRecipientDecisionPersistence,
  clock: () => number,
): FedosDeletionRequestRecipientEvaluationOutcome {
  const decisionState: FedosDeletionRecipientDecisionState = suppliedOutcome === "completed" ? "locally-applied" : suppliedOutcome === "partially-deleted" ? "partially-applied" : "failed";
  return writeSnapshot(persistence, requestId, decisionState, suppliedOutcome, clock());
}
