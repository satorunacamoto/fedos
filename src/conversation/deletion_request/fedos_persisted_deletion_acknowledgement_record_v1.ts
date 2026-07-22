/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Durable Acknowledgement Fact.
 *
 * Phase K — an acknowledgement, once constructed, is a single TERMINAL
 * fact per `requestId` — mirrors `b3b3a6d`'s own
 * `FedosPersistedDeletionExecutionRecordV1` insert-once discipline
 * exactly (no lifecycle transitions of its own; a request's OWN
 * lifecycle, Phase I, is what records "acknowledged" happened).
 */

import type { FedosDeletionAcknowledgementRecordV1 } from "./fedos_deletion_acknowledgement_record.js";

export interface FedosPersistedDeletionAcknowledgementRecordV1 {
  readonly schemaVersion: 1;
  readonly requestId: string;
  readonly acknowledgement: FedosDeletionAcknowledgementRecordV1;
  /** The signing event's own real `id` — an independent, real correlation anchor distinct from `requestId` (never the signature/private key itself). */
  readonly wireEventId: string;
  readonly recordedAt: number;
}

export function fedosPersistedDeletionAcknowledgementRecordsAreEqual(
  a: FedosPersistedDeletionAcknowledgementRecordV1,
  b: FedosPersistedDeletionAcknowledgementRecordV1,
): boolean {
  if (a.schemaVersion !== b.schemaVersion || a.requestId !== b.requestId || a.wireEventId !== b.wireEventId || a.recordedAt !== b.recordedAt) return false;
  const x = a.acknowledgement;
  const y = b.acknowledgement;
  return (
    x.schemaVersion === y.schemaVersion &&
    x.requestId === y.requestId &&
    x.recipientAccountRef === y.recipientAccountRef &&
    x.recipientDeviceRef === y.recipientDeviceRef &&
    x.outcome === y.outcome &&
    x.appliedScopes.length === y.appliedScopes.length &&
    x.appliedScopes.every((v, i) => v === y.appliedScopes[i]) &&
    x.retainedScopes.length === y.retainedScopes.length &&
    x.retainedScopes.every((v, i) => v === y.retainedScopes[i]) &&
    x.evidenceClass === y.evidenceClass &&
    x.acknowledgedAt === y.acknowledgedAt &&
    x.protocolVersion === y.protocolVersion
  );
}
