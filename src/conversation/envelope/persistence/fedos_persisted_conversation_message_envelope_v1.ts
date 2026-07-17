/**
 * Secure Runtime Alpha 858 ("Persisted Envelope Record V1") — Stage 8 of
 * Phase A of the Alpha 851–890 Private Message Envelope and Encryption
 * Authority Activation Arc.
 *
 * The STABLE WIRE SHAPE — mirrors `FedosPersistedConversationRecordV1`
 * (Alpha 750) and `FedosPersistedConversationMembershipV1` (Alpha 825)
 * exactly: every field a plain `string`/`number`, no branded type, no
 * nested object.
 *
 * An Envelope, unlike a Membership, has NO state transition over its own
 * lifetime — it is written once and never mutated (Alpha 854's own
 * header: no `deletedAt`/`tombstoned` field, retention state lives in
 * the SEPARATE, `payloadId`-linked `FedosPayloadRetentionAuthority`,
 * Alpha 796/811, never duplicated here). The persistence port
 * (`./fedos_conversation_message_envelope_persistence.ts`) therefore
 * uses the SAME simple, single-record-per-id shape
 * `FedosConversationPersistence`/`FedosConversationPayloadStorage`
 * already establish, never Membership/Capability's own `(id, state)`-
 * keyed event scheme — there is no second state to key against.
 *
 * HARD GUARDRAILS:
 *   - `FedosPersistedConversationMessageEnvelopeV1` is the ONLY export.
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - No ciphertext byte, no key material, no bearer secret.
 *   - This file defines a TYPE ONLY — no function, no class.
 */

export interface FedosPersistedConversationMessageEnvelopeV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly conversationId: string;
  readonly senderMembershipId: string;
  readonly payloadId: string;
  readonly encryptionSuite: string;
  readonly keyEpoch: number;
  readonly createdAt: number;
  readonly replyToEnvelopeId: string | null;
}
