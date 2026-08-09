/**
 * Secure Runtime Alpha 5401-5480 ("FedOS Local Deletion Capability and
 * Deletion-State Foundation Arc") — Durable Deletion-State Fact.
 *
 * Phase K — a dedicated durable record for the AGGREGATE outcome of one
 * deletion plan's execution (`fedos_deletion_execution_coordinator.ts`).
 * The existing Retention Decision Log (`../retention/`) already durably
 * records a payload's own tombstone/removal transitions on its own — this
 * record does NOT duplicate that; it exists only because no existing
 * record anywhere in this codebase captures the CROSS-CUTTING outcome of
 * one coordinated plan (which steps ran, in what order, with what
 * evidence, across Retention AND Search AND, where selected, Archive-file
 * removal) as one restart-recoverable fact keyed by `planId`.
 *
 * HARD GUARDRAILS:
 *   - No message plaintext — `canonicalTargetRef` is an opaque id
 *     (a `FedosConversationPayloadId`/`FedosConversationId`/device or
 *     membership reference string), never conversation content.
 *   - No raw filesystem path — an Archive-file step's own outcome names
 *     no path, only its own step-level `outcome`/`evidence`.
 *   - No secret — nothing here is a key, buffer, or seed.
 *   - Append-only — a record is inserted once per `planId` and never
 *     rewritten in place; a later `putRecord` call is only ever expected
 *     for a NEW `planId`, mirroring `FedosPayloadRetentionPersistence`'s
 *     own "no delete method" discipline.
 */

import type { FedosDeletionTarget } from "../../../../conversation/deletion/fedos_deletion_target.js";
import type { FedosDeletionOperation } from "../../../../conversation/deletion/fedos_deletion_operation.js";
import type { FedosDeletionEvidence } from "../../../../conversation/deletion/fedos_deletion_evidence.js";
import type { FedosDeletionNonGuaranteeCode } from "../../../../conversation/deletion/fedos_deletion_non_guarantees.js";

export type FedosDeletionExecutionStepOutcome = "applied" | "already-applied" | "skipped" | "unsupported" | "failed";

export interface FedosPersistedDeletionExecutionStepV1 {
  readonly target: FedosDeletionTarget;
  readonly operation: FedosDeletionOperation;
  readonly outcome: FedosDeletionExecutionStepOutcome;
  readonly evidence: FedosDeletionEvidence;
}

export type FedosDeletionExecutionTerminalStatus = "completed" | "partially-deleted" | "failed";

export interface FedosPersistedDeletionExecutionRecordV1 {
  readonly schemaVersion: 1;
  /** Deterministic key — always equal to `planId`; a port implementation may use this directly as its own storage key. */
  readonly id: string;
  readonly planId: string;
  /** An opaque local requester reference (e.g. an account/local-user id) — never a display name, never plaintext. */
  readonly requestedBy: string;
  /** An opaque canonical target reference (e.g. a `FedosConversationPayloadId` string) — never a raw path, never content. */
  readonly canonicalTargetRef: string;
  readonly steps: readonly FedosPersistedDeletionExecutionStepV1[];
  readonly warnings: readonly FedosDeletionNonGuaranteeCode[];
  readonly status: FedosDeletionExecutionTerminalStatus;
  readonly recordedAt: number;
}

/** Structural equality over every field — mirrors `fedosPersistedPayloadRetentionDecisionsAreEqual`'s own role for Retention. */
export function fedosPersistedDeletionExecutionRecordsAreEqual(
  a: FedosPersistedDeletionExecutionRecordV1,
  b: FedosPersistedDeletionExecutionRecordV1,
): boolean {
  if (
    a.schemaVersion !== b.schemaVersion ||
    a.id !== b.id ||
    a.planId !== b.planId ||
    a.requestedBy !== b.requestedBy ||
    a.canonicalTargetRef !== b.canonicalTargetRef ||
    a.status !== b.status ||
    a.recordedAt !== b.recordedAt ||
    a.steps.length !== b.steps.length ||
    a.warnings.length !== b.warnings.length
  ) {
    return false;
  }
  for (let i = 0; i < a.steps.length; i += 1) {
    const stepA = a.steps[i];
    const stepB = b.steps[i];
    if (stepA?.target !== stepB?.target || stepA?.operation !== stepB?.operation || stepA?.outcome !== stepB?.outcome || stepA?.evidence !== stepB?.evidence) {
      return false;
    }
  }
  for (let i = 0; i < a.warnings.length; i += 1) {
    if (a.warnings[i] !== b.warnings[i]) return false;
  }
  return true;
}
