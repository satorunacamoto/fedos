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
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FedosDeletionRequestScope } from "./fedos_deletion_request_scope.js";
import type { FedosDeletionRequestLifecycleState } from "./fedos_deletion_request_lifecycle_state.js";
import { canonicalBytesForFedosDeletionRequestRecordV1 } from "./fedos_deletion_request_canonical_bytes.js";
import type { FedosDeletionRequestRecordV1 } from "./fedos_deletion_request_record.js";

export interface FedosPersistedDeletionRequestStateRecordV1 {
  readonly schemaVersion: 1;
  readonly requestId: string;
  /** sha256(canonical bytes), lower-hex — binds this snapshot to one exact request body without persisting the body itself twice. */
  readonly bodyHash: string;
  readonly requesterAccountRef: string;
  readonly recipientAccountRef: string;
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
