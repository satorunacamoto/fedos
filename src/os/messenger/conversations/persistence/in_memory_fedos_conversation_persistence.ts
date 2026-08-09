/**
 * Secure Runtime Alpha 751 ("In-Memory Persistence") — Stage 11 of the
 * Alpha 741–760 Canonical Conversation Identity and Record Foundation
 * Arc.
 *
 * Mirrors `InMemoryFedosBoardPersistence`'s own private-field
 * `Map`-backed convention exactly
 * (`../../board/persistence/in_memory_fedos_board_persistence.ts`,
 * Alpha 316). `FedosBoardRuntime`'s own default when no
 * `conversationPersistence` dependency is injected (Alpha 754).
 *
 * HARD GUARDRAILS:
 *   - Deterministic, no constructor side effects.
 *   - Independent instances never share state — no module-level
 *     mutable state exists in this file.
 *   - `listConversations()` returns a NEW array every call.
 *   - No persistence to JSON, no filesystem, no background work, no
 *     index beyond the one `Map` this class itself holds.
 */

import {
  fedosPersistedConversationRecordsAreEqual,
  type FedosConversationPersistence,
  type FedosConversationPersistenceWriteResult,
} from "../../../../conversation/persistence/fedos_conversation_persistence.js";
import type { FedosPersistedConversationRecordV1 } from "../../../../conversation/persistence/fedos_persisted_conversation_record_v1.js";
import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";

export class InMemoryFedosConversationPersistence implements FedosConversationPersistence {
  readonly #records = new Map<string, FedosPersistedConversationRecordV1>();

  putConversation(record: FedosPersistedConversationRecordV1): FedosConversationPersistenceWriteResult {
    const existing = this.#records.get(record.id);
    if (existing === undefined) {
      this.#records.set(record.id, record);
      return "inserted";
    }
    if (fedosPersistedConversationRecordsAreEqual(existing, record)) {
      return "already-present";
    }
    return "conflict";
  }

  getConversation(id: FedosConversationId): FedosPersistedConversationRecordV1 | null {
    return this.#records.get(id) ?? null;
  }

  listConversations(): readonly FedosPersistedConversationRecordV1[] {
    return [...this.#records.values()];
  }
}
