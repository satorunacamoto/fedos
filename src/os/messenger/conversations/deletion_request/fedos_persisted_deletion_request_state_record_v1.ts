/**
 * Secure Runtime Alpha 5641-5720 ("FedOS Signed Recipient Deletion
 * Request Types, Validation, and Durable State Foundation Arc") —
 * Durable Outbound Request State Fact.
 *
 * Phase I — one durable SNAPSHOT of a requester's own local view of one
 * logical request, keyed by `requestId`. A request's own lifecycle
 * (`FedosDeletionRequestLifecycleState`) advances by APPENDING a new
 * snapshot, never rewriting one in place (append-only, restated).
 *
 * HARD GUARDRAILS:
 *   - `bodyHash` (sha256 of the canonical bytes, hex) — never the
 *     plaintext canonical bytes themselves, and never `reasonCode`
 *     beyond the already-coarse closed code the record itself carries.
 *   - No raw path, no private key, no message plaintext.
 *
 * Secure Runtime Alpha 5881-5960 (FedOS Signed Recipient Deletion Request
 * Private Transport and Local Policy Integration Arc) — additive field
 * `recipientDeviceRef`. `5641-5720`'s own original snapshot carried no
 * Device-level fact at all (it had no transport to correlate an
 * acknowledgement's own claimed Device against); this Arc's own
 * Acknowledgement Inbound Coordinator (`fedos_deletion_acknowledgement_inbound_coordinator.ts`)
 * needs a DURABLE (restart-safe) record of which Device the request was
 * originally addressed to, to honestly deny an acknowledgement claiming
 * a DIFFERENT Device than the one this requester actually sent to —
 * without this field, that check could only ever be an in-memory fact,
 * lost across a restart. Opaque, advisory-only (mirrors every other
 * `*DeviceRef` field in this domain — no real per-Device key exists).
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FedosDeletionRequestScope } from "../../../../conversation/deletion_request/fedos_deletion_request_scope.js";
import type { FedosDeletionRequestLifecycleState } from "../../../../conversation/deletion_request/fedos_deletion_request_lifecycle_state.js";
import { canonicalBytesForFedosDeletionRequestRecordV1 } from "../../../../conversation/deletion_request/fedos_deletion_request_canonical_bytes.js";
import type { FedosDeletionRequestRecordV1 } from "../../../../conversation/deletion_request/fedos_deletion_request_record.js";

export interface FedosPersistedDeletionRequestStateRecordV1 {
  readonly schemaVersion: 1;
  readonly requestId: string;
  /** sha256(canonical bytes), lower-hex — binds this snapshot to one exact request body without persisting the body itself twice. */
  readonly bodyHash: string;
  readonly requesterAccountRef: string;
  readonly recipientAccountRef: string;
  /** Additive, Secure Runtime Alpha 5881-5960 — see this file's own header. `null` only for a snapshot written before this Arc's own outbound coordinator existed. */
  readonly recipientDeviceRef: string | null;
  readonly conversationId: string;
  readonly targetEnvelopeId: string;
  readonly scope: FedosDeletionRequestScope;
  readonly lifecycleState: FedosDeletionRequestLifecycleState;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly retryCount: number;
  /** `null` until an acknowledgement fact (Phase K) has actually been correlated to this request. */
  readonly acknowledgementCorrelationId: string | null;
  readonly recordedAt: number;
}

export function fedosDeletionRequestBodyHash(record: FedosDeletionRequestRecordV1): string {
  return bytesToHex(sha256(canonicalBytesForFedosDeletionRequestRecordV1(record)));
}

export function fedosPersistedDeletionRequestStateRecordsAreEqual(
  a: FedosPersistedDeletionRequestStateRecordV1,
  b: FedosPersistedDeletionRequestStateRecordV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.requestId === b.requestId &&
    a.bodyHash === b.bodyHash &&
    a.requesterAccountRef === b.requesterAccountRef &&
    a.recipientAccountRef === b.recipientAccountRef &&
    a.recipientDeviceRef === b.recipientDeviceRef &&
    a.conversationId === b.conversationId &&
    a.targetEnvelopeId === b.targetEnvelopeId &&
    a.scope === b.scope &&
    a.lifecycleState === b.lifecycleState &&
    a.issuedAt === b.issuedAt &&
    a.expiresAt === b.expiresAt &&
    a.retryCount === b.retryCount &&
    a.acknowledgementCorrelationId === b.acknowledgementCorrelationId &&
    a.recordedAt === b.recordedAt
  );
}
