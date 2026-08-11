/**
 * Secure Runtime Alpha 417 ("Outbox Persistence Port and In-Memory
 * Backend") — Stage 7 of the Alpha 411–420 Canonical Board Durable
 * Outbox Foundation Arc.
 *
 * The first, in-memory-only `FedosBoardOutboxPersistence`
 * (`./fedos_board_outbox_persistence.js`). Follows the SAME
 * private-field `Map`-backed class convention
 * `InMemoryFedosBoardPersistence`
 * (`../persistence/in_memory_fedos_board_persistence.ts`, Alpha 316)
 * already established.
 *
 * HARD GUARDRAILS:
 *   - Deterministic, no constructor side effects.
 *   - Independent instances never share state — no module-level
 *     mutable state exists in this file.
 *   - `listIntents()` returns a NEW array every call.
 *   - No persistence to JSON, no filesystem, no background work, no
 *     network.
 */

import {
  fedosPersistedBoardOutboxRecordsAreEqual,
  type FedosBoardOutboxPersistence,
  type FedosBoardOutboxPersistenceWriteResult,
} from "./fedos_board_outbox_persistence.js";
import type { FedosPersistedBoardOutboxRecordV1 } from "./fedos_board_outbox_codec.js";

export class InMemoryFedosBoardOutboxPersistence implements FedosBoardOutboxPersistence {
  readonly #records = new Map<string, FedosPersistedBoardOutboxRecordV1>();

  putIntent(record: FedosPersistedBoardOutboxRecordV1): FedosBoardOutboxPersistenceWriteResult {
    const existing = this.#records.get(record.id);
    if (existing === undefined) {
      this.#records.set(record.id, record);
      return "inserted";
    }
    if (fedosPersistedBoardOutboxRecordsAreEqual(existing, record)) {
      return "already-present";
    }
    return "conflict";
  }

  getIntent(id: string): FedosPersistedBoardOutboxRecordV1 | null {
    return this.#records.get(id) ?? null;
  }

  listIntents(): readonly FedosPersistedBoardOutboxRecordV1[] {
    return [...this.#records.values()];
  }
}
