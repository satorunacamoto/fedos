/**
 * Secure Runtime Alpha 795 ("Retention Decision Record") — Stage 5 of
 * the Alpha 791–820 Conversation Retention & Private Payload Storage
 * Boundary Foundation Arc.
 *
 * The STABLE WIRE SHAPE — mirrors `FedosPersistedConversationRecordV1`'s
 * own discipline (Alpha 750). `id` is the deterministic
 * `fedosPayloadRetentionDecisionKey(payloadId, action)` value, stored
 * explicitly so a durable backend's own idempotent-write semantics
 * (`"already-present"`/`"conflict"`) can key off it directly, exactly
 * like every other persisted record in this codebase.
 *
 * HARD GUARDRAILS:
 *   - `FedosPersistedPayloadRetentionDecisionV1` is the ONLY export.
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - Plain serializable data only; no secret.
 *   - This file defines a TYPE ONLY.
 */

export interface FedosPersistedPayloadRetentionDecisionV1 {
  readonly schemaVersion: 1;
  /** `fedosPayloadRetentionDecisionKey(payloadId, action)` — see this file's own header. */
  readonly id: string;
  readonly payloadId: string;
  readonly action: string;
  readonly decidedAt: number;
  readonly authorityReference: string | null;
  readonly reasonCode: string;
}
