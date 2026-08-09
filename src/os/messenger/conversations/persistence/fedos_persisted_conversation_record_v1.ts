/**
 * Secure Runtime Alpha 750 ("Persisted Conversation Record V1") — Stage
 * 10 of the Alpha 741–760 Canonical Conversation Identity and Record
 * Foundation Arc.
 *
 * The STABLE WIRE SHAPE the persistence layer writes to a backend —
 * mirrors `FedosPersistedBoardPostRecordV1`'s own discipline
 * (`../../board/persistence/fedos_persisted_board_post_v1.ts`, Alpha
 * 313): deliberately NOT the branded runtime `FedosConversationRecord`
 * type itself, since branding is a compile-time-only device and this
 * type is a wire format.
 *
 * HARD GUARDRAILS:
 *   - `FedosPersistedConversationRecordV1` is the ONLY export.
 *   - `schemaVersion` is the literal numeric type `1` — any other value
 *     is a compile-time error here; the codec
 *     (`./fedos_conversation_record_codec.ts`) adds the matching RUNTIME
 *     check against an unknown future schema, rejected rather than
 *     migrated (Alpha 750's own "no silent migration" requirement).
 *   - Plain serializable data only — every field is a `string` or
 *     `number`. No branded type, secret, mutable array/object, or
 *     transport state of any kind.
 *   - This file defines a TYPE ONLY — no function, no class.
 */

export interface FedosPersistedConversationRecordV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly mode: string;
  readonly boardId: string;
  readonly rootThreadId: string;
  readonly rootPostId: string;
  readonly policyReference: string;
  readonly createdAt: number;
}
