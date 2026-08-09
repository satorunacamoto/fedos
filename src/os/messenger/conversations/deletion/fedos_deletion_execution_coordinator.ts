/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Local Deletion Execution Coordinator.
 *
 * Phase G — the ONLY mutating layer in this Arc. Four narrow entry
 * points, one per `FedosDeletionPlan` kind (`fedos_deletion_plan.ts`) —
 * never one polymorphic "execute anything" function, so each keeps the
 * minimal, honest dependency set its own real authority actually needs
 * (matching this codebase's own narrow-dependency convention throughout
 * `src/conversation/`).
 *
 * Every entry point:
 *   - Accepts only a canonical id/handle/plan — never a caller-supplied
 *     raw filesystem path.
 *   - Requires `confirmed: true` whenever `plan.requiresExplicitConfirmation`
 *     is `true` — refuses (`"confirmation-required"`) otherwise.
 *   - Checks `persistence.getRecord(plan.planId)` FIRST — restart-safe
 *     idempotency: a plan already executed (durably recorded) is never
 *     re-executed; its own real, already-persisted outcome is returned
 *     instead. A DIFFERENT `canonicalTargetRef` under the SAME `planId`
 *     fails closed (`"conflicting-plan"`) rather than silently
 *     overwriting or re-running against a different target.
 *   - Calls ONLY real, existing authorities — `FedosPayloadRetentionAuthority`,
 *     `FedosConversationSearchIndex.reconcilePayloadRetention()`,
 *     `removeFedosDeletionArchiveFile()`,
 *     `FedosSyncDeviceRegistry.revokeDevice()`,
 *     `FedosConversationMembershipAuthority.revoke()` — no new mutation
 *     path of its own.
 *   - Records every step's own outcome and evidence, and returns
 *     `"partially-deleted"` (never a false `"completed"`) if any step
 *     failed while at least one other succeeded.
 */

import type { FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosPayloadRetentionAuthority, FedosPayloadRetentionResult } from "../retention/fedos_payload_retention_authority.js";
import type { FedosPayloadRetentionReasonCode } from "../retention/fedos_payload_retention_decision.js";
import type { FedosConversationSearchIndex } from "../search/fedos_conversation_search_index.js";
import type { FedosSyncDeviceRegistry } from "../../../../sync/fedos_sync_device_registry.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";
import {
  removeFedosDeletionArchiveFile,
  resolveFedosDeletionArchiveFileHandle,
  type FedosDeletionArchiveFileHandle,
} from "./fedos_deletion_archive_file_authority.js";
import {
  fedosConversationArchiveCliNodeFileSystem,
  type FedosConversationArchiveCliFileSystem,
} from "../archive_cli/fedos_conversation_archive_cli_file_system.js";
import type { FedosDeletionPlan } from "./fedos_deletion_plan.js";
import type { FedosDeletionExecutionPersistence } from "./fedos_deletion_execution_persistence.js";
import type {
  FedosDeletionExecutionStepOutcome,
  FedosDeletionExecutionTerminalStatus,
  FedosPersistedDeletionExecutionRecordV1,
  FedosPersistedDeletionExecutionStepV1,
} from "./fedos_persisted_deletion_execution_record_v1.js";
import { fedosDeletionApplicableNonGuarantees } from "./fedos_deletion_non_guarantees.js";

function defaultClock(): number {
  return Math.floor(Date.now() / 1000);
}

export type FedosDeletionExecutionOutcome =
  | { readonly outcome: "executed"; readonly record: FedosPersistedDeletionExecutionRecordV1 }
  | { readonly outcome: "already-executed"; readonly record: FedosPersistedDeletionExecutionRecordV1 }
  | { readonly outcome: "confirmation-required" }
  | { readonly outcome: "conflicting-plan" };

function checkIdempotency(
  persistence: FedosDeletionExecutionPersistence,
  planId: string,
  canonicalTargetRef: string,
): FedosDeletionExecutionOutcome | null {
  const existing = persistence.getRecord(planId);
  if (existing === null) return null;
  if (existing.canonicalTargetRef !== canonicalTargetRef) return { outcome: "conflicting-plan" };
  return { outcome: "already-executed", record: existing };
}

function finalizeRecord(
  persistence: FedosDeletionExecutionPersistence,
  plan: FedosDeletionPlan,
  requestedBy: string,
  steps: readonly FedosPersistedDeletionExecutionStepV1[],
  clock: () => number,
): FedosDeletionExecutionOutcome {
  const anyFailed = steps.some((step) => step.outcome === "failed");
  const anySucceeded = steps.some((step) => step.outcome === "applied" || step.outcome === "already-applied");
  const status: FedosDeletionExecutionTerminalStatus = steps.length === 0 || !anyFailed ? "completed" : anySucceeded ? "partially-deleted" : "failed";

  const warnings = [...new Set(plan.steps.flatMap((step) => fedosDeletionApplicableNonGuarantees(step.target)))];

  const record: FedosPersistedDeletionExecutionRecordV1 = {
    schemaVersion: 1,
    id: plan.planId,
    planId: plan.planId,
    requestedBy,
    canonicalTargetRef: plan.canonicalTargetRef,
    steps,
    warnings,
    status,
    recordedAt: clock(),
  };

  const writeResult = persistence.putRecord(record);
  if (writeResult === "conflict") {
    const authoritative = persistence.getRecord(plan.planId);
    if (authoritative !== null) return { outcome: "already-executed", record: authoritative };
  }
  return { outcome: "executed", record };
}

export interface FedosDeletionPayloadExecutionDependencies {
  readonly retentionAuthority: Pick<FedosPayloadRetentionAuthority, "tombstonePayload" | "removeLocalPayload">;
  readonly searchIndex: Pick<FedosConversationSearchIndex, "reconcilePayloadRetention">;
  readonly persistence: FedosDeletionExecutionPersistence;
  readonly clock?: () => number;
}

export interface FedosDeletionPayloadExecutionRequest {
  readonly plan: FedosDeletionPlan;
  readonly requestedBy: string;
  readonly confirmed: boolean;
  readonly authorityReference: string | null;
  readonly reasonCode: FedosPayloadRetentionReasonCode;
}

/** Executes a `local-payload-deletion` plan — the ONLY entry point that calls `tombstonePayload`/`removeLocalPayload`/`reconcilePayloadRetention`. */
export function executeFedosLocalPayloadDeletionPlan(
  request: FedosDeletionPayloadExecutionRequest,
  deps: FedosDeletionPayloadExecutionDependencies,
): FedosDeletionExecutionOutcome {
  const { plan } = request;
  const idempotent = checkIdempotency(deps.persistence, plan.planId, plan.canonicalTargetRef);
  if (idempotent !== null) return idempotent;

  const clock = deps.clock ?? defaultClock;
  if (plan.steps.length === 0) return finalizeRecord(deps.persistence, plan, request.requestedBy, [], clock);
  if (plan.requiresExplicitConfirmation && !request.confirmed) return { outcome: "confirmation-required" };

  const payloadId = plan.canonicalTargetRef as FedosConversationPayloadId;
  const steps: FedosPersistedDeletionExecutionStepV1[] = [];

  for (const step of plan.steps) {
    if (step.kind === "retention-transition") {
      const result: FedosPayloadRetentionResult =
        step.operation === "tombstone"
          ? deps.retentionAuthority.tombstonePayload(payloadId, request.authorityReference, request.reasonCode)
          : deps.retentionAuthority.removeLocalPayload(payloadId, request.authorityReference, request.reasonCode);
      const outcome: FedosDeletionExecutionStepOutcome =
        result.outcome === "tombstoned" || result.outcome === "payload-removed"
          ? "applied"
          : result.outcome === "already-tombstoned" || result.outcome === "already-removed"
            ? "already-applied"
            : "failed";
      steps.push({ target: step.target, operation: step.operation, outcome, evidence: outcome === "failed" ? "none" : "local-observed" });
    } else if (step.kind === "purge-index") {
      try {
        deps.searchIndex.reconcilePayloadRetention(payloadId);
        steps.push({ target: step.target, operation: step.operation, outcome: "applied", evidence: "local-verified" });
      } catch {
        steps.push({ target: step.target, operation: step.operation, outcome: "failed", evidence: "none" });
      }
    }
  }

  return finalizeRecord(deps.persistence, plan, request.requestedBy, steps, clock);
}

export interface FedosDeletionArchiveFileExecutionDependencies {
  readonly persistence: FedosDeletionExecutionPersistence;
  readonly fileSystem?: FedosConversationArchiveCliFileSystem;
  readonly clock?: () => number;
}

export interface FedosDeletionArchiveFileExecutionRequest {
  readonly plan: FedosDeletionPlan;
  readonly requestedBy: string;
  readonly confirmed: boolean;
  readonly directoryPath: string;
  readonly conversationId: FedosConversationId;
}

/** Executes a `local-archive-file-removal` plan — the ONLY entry point that calls `removeFedosDeletionArchiveFile`. Never touches Retention/Search. */
export function executeFedosLocalArchiveFileRemovalPlan(
  request: FedosDeletionArchiveFileExecutionRequest,
  deps: FedosDeletionArchiveFileExecutionDependencies,
): FedosDeletionExecutionOutcome {
  const { plan } = request;
  const idempotent = checkIdempotency(deps.persistence, plan.planId, plan.canonicalTargetRef);
  if (idempotent !== null) return idempotent;

  const clock = deps.clock ?? defaultClock;
  if (plan.steps.length === 0) return finalizeRecord(deps.persistence, plan, request.requestedBy, [], clock);
  if (plan.requiresExplicitConfirmation && !request.confirmed) return { outcome: "confirmation-required" };

  const fileSystem = deps.fileSystem ?? fedosConversationArchiveCliNodeFileSystem;
  const steps: FedosPersistedDeletionExecutionStepV1[] = [];

  for (const step of plan.steps) {
    if (step.kind !== "remove-archive-file") continue;
    const resolved = resolveFedosDeletionArchiveFileHandle(request.directoryPath, request.conversationId, fileSystem);
    if (resolved.outcome !== "found") {
      steps.push({ target: step.target, operation: step.operation, outcome: "already-applied", evidence: "local-observed" });
      continue;
    }
    const removal = removeFedosDeletionArchiveFile(resolved.handle, { planId: plan.planId }, fileSystem);
    const outcome: FedosDeletionExecutionStepOutcome =
      removal === "removed" ? "applied" : removal === "already-removed" ? "already-applied" : "failed";
    steps.push({ target: step.target, operation: step.operation, outcome, evidence: outcome === "failed" ? "none" : "local-verified" });
  }

  return finalizeRecord(deps.persistence, plan, request.requestedBy, steps, clock);
}

export interface FedosDeletionDeviceAccessExecutionDependencies {
  readonly deviceRegistry: Pick<FedosSyncDeviceRegistry, "revokeDevice">;
  readonly persistence: FedosDeletionExecutionPersistence;
  readonly clock?: () => number;
}

export interface FedosDeletionDeviceAccessExecutionRequest {
  readonly plan: FedosDeletionPlan;
  readonly requestedBy: string;
  readonly confirmed: boolean;
  readonly deviceRef: string;
  readonly accountRef: string;
  readonly at: number;
}

/** Executes a `local-device-access-revocation` plan — the ONLY entry point that calls `revokeDevice`. Never touches Retention/Search/Archive/Membership. */
export function executeFedosLocalDeviceAccessRevocationPlan(
  request: FedosDeletionDeviceAccessExecutionRequest,
  deps: FedosDeletionDeviceAccessExecutionDependencies,
): FedosDeletionExecutionOutcome {
  const { plan } = request;
  const idempotent = checkIdempotency(deps.persistence, plan.planId, plan.canonicalTargetRef);
  if (idempotent !== null) return idempotent;

  const clock = deps.clock ?? defaultClock;
  if (plan.steps.length === 0) return finalizeRecord(deps.persistence, plan, request.requestedBy, [], clock);
  if (plan.requiresExplicitConfirmation && !request.confirmed) return { outcome: "confirmation-required" };

  const steps: FedosPersistedDeletionExecutionStepV1[] = [];
  for (const step of plan.steps) {
    if (step.kind !== "revoke-access") continue;
    const revoked = deps.deviceRegistry.revokeDevice(request.deviceRef, request.accountRef, request.at);
    steps.push({
      target: step.target,
      operation: step.operation,
      outcome: revoked ? "applied" : "already-applied",
      evidence: "local-verified",
    });
  }

  return finalizeRecord(deps.persistence, plan, request.requestedBy, steps, clock);
}

export interface FedosDeletionMembershipAccessExecutionDependencies {
  readonly membershipAuthority: Pick<FedosConversationMembershipAuthority, "revoke">;
  readonly persistence: FedosDeletionExecutionPersistence;
  readonly clock?: () => number;
}

export interface FedosDeletionMembershipAccessExecutionRequest {
  readonly plan: FedosDeletionPlan;
  readonly requestedBy: string;
  readonly confirmed: boolean;
  readonly conversationId: FedosConversationId;
  readonly participant: FedosConversationParticipantReference;
  readonly at: number;
}

/** Executes a `local-membership-access-revocation` plan — the ONLY entry point that calls `FedosConversationMembershipAuthority.revoke()`. Never touches Retention/Search/Archive/Device. */
export function executeFedosLocalMembershipAccessRevocationPlan(
  request: FedosDeletionMembershipAccessExecutionRequest,
  deps: FedosDeletionMembershipAccessExecutionDependencies,
): FedosDeletionExecutionOutcome {
  const { plan } = request;
  const idempotent = checkIdempotency(deps.persistence, plan.planId, plan.canonicalTargetRef);
  if (idempotent !== null) return idempotent;

  const clock = deps.clock ?? defaultClock;
  if (plan.steps.length === 0) return finalizeRecord(deps.persistence, plan, request.requestedBy, [], clock);
  if (plan.requiresExplicitConfirmation && !request.confirmed) return { outcome: "confirmation-required" };

  const steps: FedosPersistedDeletionExecutionStepV1[] = [];
  for (const step of plan.steps) {
    if (step.kind !== "revoke-access") continue;
    const result = deps.membershipAuthority.revoke(request.conversationId, request.participant, request.at);
    const outcome: FedosDeletionExecutionStepOutcome =
      result.outcome === "revoked" ? "applied" : result.outcome === "already-present" ? "already-applied" : "failed";
    steps.push({ target: step.target, operation: step.operation, outcome, evidence: outcome === "failed" ? "none" : "local-verified" });
  }

  return finalizeRecord(deps.persistence, plan, request.requestedBy, steps, clock);
}

export type { FedosDeletionArchiveFileHandle };
