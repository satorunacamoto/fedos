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
 *
 * Secure Runtime Alpha 1841–1920 Phase B — widened, additively, to the
 * `FedosPersistedConversationTransportOutboxRecord` union (V1 | V2). The
 * `Map`-backed implementation itself needed no behavior change — it was
 * always structurally generic over "whatever record shape the port
 * names."
 */

import {
  fedosPersistedConversationTransportOutboxRecordsAreEqual,
  type FedosConversationTransportOutboxPersistence,
  type FedosConversationTransportOutboxPersistenceWriteResult,
} from "./fedos_conversation_transport_outbox_persistence.js";
import type { FedosPersistedConversationTransportOutboxRecord } from "./fedos_conversation_transport_outbox_codec.js";

export class InMemoryFedosConversationTransportOutboxPersistence implements FedosConversationTransportOutboxPersistence {
  readonly #records = new Map<string, FedosPersistedConversationTransportOutboxRecord>();

  putIntent(record: FedosPersistedConversationTransportOutboxRecord): FedosConversationTransportOutboxPersistenceWriteResult {
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

  getIntent(id: string): FedosPersistedConversationTransportOutboxRecord | null {
    return this.#records.get(id) ?? null;
  }

  listIntents(): readonly FedosPersistedConversationTransportOutboxRecord[] {
    return [...this.#records.values()];
  }
}
