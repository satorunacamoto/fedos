/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Read-Only Deletion Assessment.
 *
 * Phase E — three narrow, read-only assessment functions, one per
 * deletion-domain family this Arc normalizes. Every function here:
 *   - NEVER mutates state (no `tombstonePayload`/`removeLocalPayload`/
 *     `revoke`/`removeFedosDeletionArchiveFile` call anywhere in this
 *     file).
 *   - NEVER decrypts or reads payload content — only the pure-preview
 *     `evaluatePayloadAccess()` method, matching Search Runtime's own
 *     "never call `readPayload()`" guardrail (`../search/fedos_conversation_search_index.ts`).
 *   - Returns a `FedosDeletionAssessment` describing what a PLAN would do,
 *     never what already happened — the Execution Coordinator
 *     (`fedos_deletion_execution_coordinator.ts`) is the only place a
 *     status observation is asserted as a completed fact.
 */

import type { FedosConversationPayloadId } from "../payload_storage/fedos_conversation_payload_id.js";
import type { FedosConversationId } from "../fedos_conversation_id.js";
import type { FedosPayloadRetentionAuthority } from "../retention/fedos_payload_retention_authority.js";
import { getFedosDeletionCapabilityDescriptor } from "./fedos_deletion_capability_descriptor.js";
import type { FedosDeletionOperation } from "./fedos_deletion_operation.js";
import type { FedosDeletionEvidence } from "./fedos_deletion_evidence.js";
import type { FedosDeletionTarget } from "./fedos_deletion_target.js";
import type { FedosDeletionStatus, FedosDeletionStatusObservation } from "./fedos_deletion_status.js";
import { fedosDeletionApplicableNonGuarantees, type FedosDeletionNonGuaranteeCode } from "./fedos_deletion_non_guarantees.js";
import {
  resolveFedosDeletionArchiveFileHandle,
  type FedosDeletionArchiveFileHandle,
} from "./fedos_deletion_archive_file_authority.js";
import {
  fedosConversationArchiveCliNodeFileSystem,
  type FedosConversationArchiveCliFileSystem,
} from "../archive_cli/fedos_conversation_archive_cli_file_system.js";
import type { FedosSyncDeviceRegistry } from "../../sync/fedos_sync_device_registry.js";
import type { FedosConversationMembershipAuthority } from "../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../membership/fedos_conversation_participant_reference.js";

export type FedosDeletionAssessmentBlocker = "none" | "not-found" | "already-terminal" | "unsupported";

export interface FedosDeletionAssessment {
  readonly targetExists: boolean;
  readonly observations: readonly FedosDeletionStatusObservation[];
  readonly availableOperations: readonly FedosDeletionOperation[];
  readonly requiresExplicitConfirmation: boolean;
  readonly expectedEvidence: FedosDeletionEvidence;
  readonly dependentCopiesWarning: boolean;
  /** Archives ALREADY taken (before this evaluation) may retain a copy — an inherent, accepted property of a point-in-time snapshot, unrelated to whether a FUTURE export would. */
  readonly archiveRetentionWarning: boolean;
  readonly backupWarning: boolean;
  readonly remoteCopyWarning: boolean;
  readonly warnings: readonly FedosDeletionNonGuaranteeCode[];
  readonly blocker: FedosDeletionAssessmentBlocker;
  readonly safeSummary: string;
  /**
   * Secure Runtime Alpha 7481-7560 (FedOS Archive Envelope Retention
   * Parity and Metadata Deletion Semantics Arc) — `true` once this
   * Payload is denied (tombstoned or payload-removed): a NEW Archive
   * export taken from this point forward will exclude BOTH this
   * Payload's ciphertext AND its linked Envelope (existence, timestamp,
   * sender, recipient, conversation, envelope id) — closing the exact
   * gap a committed audit found (`2eed88d9`). Deliberately distinct from
   * `archiveRetentionWarning` above (which describes archives that
   * ALREADY exist, unaffected by this Arc, by design). Never
   * `deletedEverywhere` — this fact says nothing about any OTHER
   * device, backup, or already-exported file. `false` for every
   * non-payload assessment (archive-file/device-access/membership-access)
   * below — none of those targets are affected by this Arc's own fix.
   */
  readonly futureArchiveExportExcludesThis: boolean;
}

function baseAssessmentFields(target: FedosDeletionTarget) {
  const descriptor = getFedosDeletionCapabilityDescriptor(target);
  const warnings = fedosDeletionApplicableNonGuarantees(target);
  return {
    availableOperations: descriptor.supportedOperations,
    requiresExplicitConfirmation: descriptor.requiresExplicitConfirmation,
    expectedEvidence: descriptor.evidenceClass,
    backupWarning: descriptor.mayRetainBackups,
    remoteCopyWarning: descriptor.mayRetainRemoteCopies,
    warnings,
  };
}

export interface FedosDeletionPayloadAssessmentDependencies {
  readonly retentionAuthority: Pick<FedosPayloadRetentionAuthority, "evaluatePayloadAccess">;
}

/** Assesses `local-payload`/`local-envelope`/`local-index` for one payload. Read-only: calls ONLY `evaluatePayloadAccess()`. */
export function assessFedosLocalPayloadDeletion(
  payloadId: FedosConversationPayloadId,
  deps: FedosDeletionPayloadAssessmentDependencies,
): FedosDeletionAssessment {
  const evaluation = deps.retentionAuthority.evaluatePayloadAccess(payloadId);
  const payloadFields = baseAssessmentFields("local-payload");
  const indexFields = baseAssessmentFields("local-index");

  if (evaluation.outcome === "not-found") {
    return {
      targetExists: false,
      observations: [],
      availableOperations: [],
      requiresExplicitConfirmation: false,
      expectedEvidence: "none",
      dependentCopiesWarning: false,
      archiveRetentionWarning: false,
      backupWarning: false,
      remoteCopyWarning: false,
      warnings: [],
      blocker: "not-found",
      safeSummary: "No such payload is currently known locally.",
      futureArchiveExportExcludesThis: false,
    };
  }

  if (evaluation.outcome === "denied") {
    const status: FedosDeletionStatus = evaluation.state === "payload-removed" ? "local-payload-deleted" : "locally-tombstoned";
    return {
      targetExists: true,
      observations: [
        { target: "local-payload", status },
        // Secure Runtime Alpha 7481-7560 -- CORRECTED: the live Envelope
        // record is NEVER touched by local deletion (no delete method
        // exists on that port; confirmed by this Arc's own Phase A
        // reconciliation) -- it genuinely remains "present" in LIVE
        // storage. `futureArchiveExportExcludesThis` below is the
        // honest, separate fact this Arc's own real Archive-layer fix
        // provides instead.
        { target: "local-envelope", status: "present" },
      ],
      availableOperations: evaluation.state === "payload-removed" ? [] : payloadFields.availableOperations.filter((op) => op !== "tombstone"),
      requiresExplicitConfirmation: payloadFields.requiresExplicitConfirmation,
      expectedEvidence: payloadFields.expectedEvidence,
      dependentCopiesWarning: true,
      archiveRetentionWarning: true,
      backupWarning: payloadFields.backupWarning,
      remoteCopyWarning: payloadFields.remoteCopyWarning,
      warnings: [...payloadFields.warnings, ...indexFields.warnings],
      blocker: evaluation.state === "payload-removed" ? "already-terminal" : "none",
      safeSummary:
        evaluation.state === "payload-removed"
          ? "Already removed from local history. Any Archive copy, backup, other device, or recipient copy is unaffected. A NEW Archive export from this point forward will also exclude this message's own metadata (existence, timestamp, sender, recipient)."
          : "Currently tombstoned locally (hidden from normal reads). A further step can remove the local payload and purge the local Search index. A NEW Archive export from this point forward will also exclude this message's own metadata.",
      futureArchiveExportExcludesThis: true,
    };
  }

  return {
    targetExists: true,
    observations: [
      { target: "local-payload", status: "present" },
      { target: "local-envelope", status: "present" },
      { target: "local-index", status: "present" },
    ],
    availableOperations: payloadFields.availableOperations,
    requiresExplicitConfirmation: payloadFields.requiresExplicitConfirmation,
    expectedEvidence: payloadFields.expectedEvidence,
    dependentCopiesWarning: true,
    archiveRetentionWarning: true,
    backupWarning: payloadFields.backupWarning,
    remoteCopyWarning: payloadFields.remoteCopyWarning,
    warnings: [...payloadFields.warnings, ...indexFields.warnings],
    blocker: "none",
    safeSummary: "Present locally. Deleting it will tombstone the payload and purge it from the local Search index; it will no longer be reachable by FedOS.",
    futureArchiveExportExcludesThis: false,
  };
}

export interface FedosDeletionArchiveFileAssessmentInput {
  readonly directoryPath: string;
  readonly conversationId: FedosConversationId;
  readonly fileSystem?: FedosConversationArchiveCliFileSystem;
}

/** Assesses `local-archive-file` for one conversation's tracked Archive Package. Read-only: consults the directory's own index only. */
export function assessFedosLocalArchiveFileDeletion(input: FedosDeletionArchiveFileAssessmentInput): FedosDeletionAssessment & {
  readonly handle: FedosDeletionArchiveFileHandle | null;
} {
  const fields = baseAssessmentFields("local-archive-file");
  const resolved = resolveFedosDeletionArchiveFileHandle(
    input.directoryPath,
    input.conversationId,
    input.fileSystem ?? fedosConversationArchiveCliNodeFileSystem,
  );

  if (resolved.outcome !== "found") {
    return {
      targetExists: false,
      observations: [],
      availableOperations: [],
      requiresExplicitConfirmation: false,
      expectedEvidence: "none",
      dependentCopiesWarning: false,
      archiveRetentionWarning: false,
      backupWarning: false,
      remoteCopyWarning: false,
      warnings: [],
      blocker: resolved.outcome === "invalid-directory" ? "unsupported" : "not-found",
      safeSummary: "No tracked Archive Package file is currently known for this conversation at this location.",
      handle: null,
      futureArchiveExportExcludesThis: false,
    };
  }

  return {
    targetExists: true,
    observations: [{ target: "local-archive-file", status: "present" }],
    availableOperations: fields.availableOperations,
    requiresExplicitConfirmation: fields.requiresExplicitConfirmation,
    expectedEvidence: fields.expectedEvidence,
    dependentCopiesWarning: false,
    archiveRetentionWarning: false,
    backupWarning: fields.backupWarning,
    remoteCopyWarning: fields.remoteCopyWarning,
    warnings: fields.warnings,
    blocker: "none",
    safeSummary: "A tracked Archive Package file exists for this conversation. Removing it does not change live Conversation history.",
    handle: resolved.handle,
    futureArchiveExportExcludesThis: false,
  };
}

export interface FedosDeletionDeviceAccessAssessmentInput {
  readonly deviceRegistry: Pick<FedosSyncDeviceRegistry, "getDevice">;
  readonly deviceRef: string;
  readonly accountRef: string;
}

/** Assesses `local-device-access` — read-only: `getDevice()` only, never `revokeDevice()`. */
export function assessFedosLocalDeviceAccessRevocation(input: FedosDeletionDeviceAccessAssessmentInput): FedosDeletionAssessment {
  const fields = baseAssessmentFields("local-device-access");
  const binding = input.deviceRegistry.getDevice(input.deviceRef, input.accountRef);

  if (binding === null) {
    return {
      targetExists: false,
      observations: [],
      availableOperations: [],
      requiresExplicitConfirmation: false,
      expectedEvidence: "none",
      dependentCopiesWarning: false,
      archiveRetentionWarning: false,
      backupWarning: false,
      remoteCopyWarning: false,
      warnings: [],
      blocker: "not-found",
      safeSummary: "No such device binding is currently known for this account.",
      futureArchiveExportExcludesThis: false,
    };
  }

  if (binding.state === "revoked") {
    return {
      targetExists: true,
      observations: [{ target: "local-device-access", status: "access-revoked" }],
      availableOperations: [],
      requiresExplicitConfirmation: fields.requiresExplicitConfirmation,
      expectedEvidence: fields.expectedEvidence,
      dependentCopiesWarning: true,
      archiveRetentionWarning: false,
      backupWarning: fields.backupWarning,
      remoteCopyWarning: fields.remoteCopyWarning,
      warnings: fields.warnings,
      blocker: "already-terminal",
      safeSummary: "This device's access is already revoked. Anything it already received or decrypted before revocation is unaffected.",
      futureArchiveExportExcludesThis: false,
    };
  }

  return {
    targetExists: true,
    observations: [{ target: "local-device-access", status: "present" }],
    availableOperations: fields.availableOperations,
    requiresExplicitConfirmation: fields.requiresExplicitConfirmation,
    expectedEvidence: fields.expectedEvidence,
    dependentCopiesWarning: true,
    archiveRetentionWarning: false,
    backupWarning: fields.backupWarning,
    remoteCopyWarning: fields.remoteCopyWarning,
    warnings: fields.warnings,
    blocker: "none",
    safeSummary: "Revoking this device stops it from receiving future synced content; anything it already holds locally is unaffected.",
    futureArchiveExportExcludesThis: false,
  };
}

export interface FedosDeletionMembershipAccessAssessmentInput {
  readonly membershipAuthority: Pick<FedosConversationMembershipAuthority, "findMembership">;
  readonly conversationId: FedosConversationId;
  readonly participant: FedosConversationParticipantReference;
}

/** Assesses `local-membership-access` — read-only: `findMembership()` only, never `revoke()`. */
export function assessFedosLocalMembershipAccessRevocation(input: FedosDeletionMembershipAccessAssessmentInput): FedosDeletionAssessment {
  const fields = baseAssessmentFields("local-membership-access");
  const membership = input.membershipAuthority.findMembership(input.conversationId, input.participant);

  if (membership === null) {
    return {
      targetExists: false,
      observations: [],
      availableOperations: [],
      requiresExplicitConfirmation: false,
      expectedEvidence: "none",
      dependentCopiesWarning: false,
      archiveRetentionWarning: false,
      backupWarning: false,
      remoteCopyWarning: false,
      warnings: [],
      blocker: "not-found",
      safeSummary: "No such membership is currently known for this conversation.",
      futureArchiveExportExcludesThis: false,
    };
  }

  if (membership.state !== "active") {
    return {
      targetExists: true,
      observations: [{ target: "local-membership-access", status: "access-revoked" }],
      availableOperations: [],
      requiresExplicitConfirmation: fields.requiresExplicitConfirmation,
      expectedEvidence: fields.expectedEvidence,
      dependentCopiesWarning: true,
      archiveRetentionWarning: false,
      backupWarning: fields.backupWarning,
      remoteCopyWarning: fields.remoteCopyWarning,
      warnings: fields.warnings,
      blocker: "already-terminal",
      safeSummary: "This membership is already inactive. This does not imply any payload was deleted.",
      futureArchiveExportExcludesThis: false,
    };
  }

  return {
    targetExists: true,
    observations: [{ target: "local-membership-access", status: "present" }],
    availableOperations: fields.availableOperations,
    requiresExplicitConfirmation: fields.requiresExplicitConfirmation,
    expectedEvidence: fields.expectedEvidence,
    dependentCopiesWarning: true,
    archiveRetentionWarning: false,
    backupWarning: fields.backupWarning,
    remoteCopyWarning: fields.remoteCopyWarning,
    warnings: fields.warnings,
    blocker: "none",
    safeSummary: "Revoking this membership prevents further authorized Conversation operations for this participant; it does not delete any payload.",
    futureArchiveExportExcludesThis: false,
  };
}
