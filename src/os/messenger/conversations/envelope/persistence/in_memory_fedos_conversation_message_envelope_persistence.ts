/**
 * Secure Runtime Alpha 859 ("In-Memory Envelope Persistence") — Stage 9
 * of Phase A of the Alpha 851–890 Private Message Envelope and
 * Encryption Authority Activation Arc.
 *
 * Mirrors `InMemoryFedosConversationPersistence`'s own private-field
 * `Map`-backed convention exactly (Alpha 751) — single-record-per-id,
 * no state-transition scheme (an Envelope has none, see
 * `../fedos_persisted_conversation_message_envelope_v1.ts`'s own
 * header).
 */

import {
  fedosPersistedConversationMessageEnvelopesAreEqual,
  type FedosConversationMessageEnvelopePersistence,
  type FedosConversationMessageEnvelopePersistenceWriteResult,
} from "./fedos_conversation_message_envelope_persistence.js";
import type { FedosPersistedConversationMessageEnvelopeV1 } from "./fedos_persisted_conversation_message_envelope_v1.js";
import type { FedosConversationId } from "../../fedos_conversation_id.js";

export class InMemoryFedosConversationMessageEnvelopePersistence implements FedosConversationMessageEnvelopePersistence {
  readonly #records = new Map<string, FedosPersistedConversationMessageEnvelopeV1>();

  putEnvelope(record: FedosPersistedConversationMessageEnvelopeV1): FedosConversationMessageEnvelopePersistenceWriteResult {
    const existing = this.#records.get(record.id);
    if (existing === undefined) {
      this.#records.set(record.id, record);
      return "inserted";
    }
    return fedosPersistedConversationMessageEnvelopesAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getEnvelope(id: string): FedosPersistedConversationMessageEnvelopeV1 | null {
    return this.#records.get(id) ?? null;
  }

  listConversationEnvelopes(conversationId: FedosConversationId): readonly FedosPersistedConversationMessageEnvelopeV1[] {
    return [...this.#records.values()].filter((record) => record.conversationId === conversationId);
  }
}
