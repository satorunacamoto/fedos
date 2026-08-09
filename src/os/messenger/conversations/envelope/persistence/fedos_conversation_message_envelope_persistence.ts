/**
 * Secure Runtime Alpha 857 ("Envelope Metadata Persistence") — Stage 7
 * of Phase A of the Alpha 851–890 Private Message Envelope and
 * Encryption Authority Activation Arc.
 *
 * A DEDICATED port — mirrors `FedosConversationPersistence`'s own shape
 * (Alpha 749) and `FedosConversationPayloadStorage`'s own shape (Alpha
 * 804) exactly: single-record-per-id, no delete method, synchronous.
 * Never carries ciphertext bytes (those live in the EXISTING
 * `FedosConversationPayloadStorage`, referenced only by `payloadId` —
 * this port stores Envelope METADATA only, the same "opaque payload
 * lives in its own port, referenced by id" split
 * `02_storage_alignment.md` already confirmed the existing Payload
 * Storage port satisfies).
 */

import type { FedosConversationId } from "../../fedos_conversation_id.js";
import type { FedosPersistedConversationMessageEnvelopeV1 } from "./fedos_persisted_conversation_message_envelope_v1.js";

/** Mirrors `FedosConversationPersistenceWriteResult` exactly (Alpha 749). */
export type FedosConversationMessageEnvelopePersistenceWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosConversationMessageEnvelopePersistence {
  putEnvelope(record: FedosPersistedConversationMessageEnvelopeV1): FedosConversationMessageEnvelopePersistenceWriteResult;
  getEnvelope(id: string): FedosPersistedConversationMessageEnvelopeV1 | null;
  listConversationEnvelopes(conversationId: FedosConversationId): readonly FedosPersistedConversationMessageEnvelopeV1[];
}

/** Structural equality over every field — the same role `fedosPersistedConversationRecordsAreEqual` plays for Conversation persistence (Alpha 749). */
export function fedosPersistedConversationMessageEnvelopesAreEqual(
  a: FedosPersistedConversationMessageEnvelopeV1,
  b: FedosPersistedConversationMessageEnvelopeV1,
): boolean {
  return (
    a.schemaVersion === b.schemaVersion &&
    a.id === b.id &&
    a.conversationId === b.conversationId &&
    a.senderMembershipId === b.senderMembershipId &&
    a.payloadId === b.payloadId &&
    a.encryptionSuite === b.encryptionSuite &&
    a.keyEpoch === b.keyEpoch &&
    a.createdAt === b.createdAt &&
    a.replyToEnvelopeId === b.replyToEnvelopeId
  );
}
