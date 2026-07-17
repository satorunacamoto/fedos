/**
 * Secure Runtime Alpha 1471–1540 — the in-memory
 * `FedosConversationTransportOutboxPersistence`. Mirrors
 * `InMemoryFedosBoardOutboxPersistence`'s own `Map`-backed convention
 * exactly (`../../board/outbox/in_memory_fedos_board_outbox_persistence.ts`,
 * Alpha 417).
 *
 * HARD GUARDRAILS:
 *   - Independent instances never share state — no module-level mutable
 *     state exists in this file.
 *   - `listIntents()` returns a NEW array every call.
 */

import {
  fedosPersistedConversationTransportOutboxRecordsAreEqual,
  type FedosConversationTransportOutboxPersistence,
  type FedosConversationTransportOutboxPersistenceWriteResult,
} from "./fedos_conversation_transport_outbox_persistence.js";
import type { FedosPersistedConversationTransportOutboxRecordV1 } from "./fedos_conversation_transport_outbox_codec.js";

export class InMemoryFedosConversationTransportOutboxPersistence implements FedosConversationTransportOutboxPersistence {
  readonly #records = new Map<string, FedosPersistedConversationTransportOutboxRecordV1>();

  putIntent(record: FedosPersistedConversationTransportOutboxRecordV1): FedosConversationTransportOutboxPersistenceWriteResult {
    const existing = this.#records.get(record.id);
    if (existing === undefined) {
      this.#records.set(record.id, record);
      return "inserted";
    }
    if (fedosPersistedConversationTransportOutboxRecordsAreEqual(existing, record)) {
      return "already-present";
    }
    return "conflict";
  }

  getIntent(id: string): FedosPersistedConversationTransportOutboxRecordV1 | null {
    return this.#records.get(id) ?? null;
  }

  listIntents(): readonly FedosPersistedConversationTransportOutboxRecordV1[] {
    return [...this.#records.values()];
  }
}
