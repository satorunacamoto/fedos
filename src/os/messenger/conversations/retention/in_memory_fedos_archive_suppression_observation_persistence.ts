/**
 * Secure Runtime Alpha 7721–7800 — the in-memory
 * `FedosArchiveSuppressionObservationPersistence`. Mirrors
 * `InMemoryFedosConversationTransportOutboxPersistence`'s own `Map`-backed
 * convention exactly.
 *
 * HARD GUARDRAILS:
 *   - Independent instances never share state.
 *   - `listObservations()`/`listObservationsForSubject()` return a NEW
 *     array every call.
 */

import {
  fedosPersistedArchiveSuppressionObservationsAreEqual,
  type FedosPersistedArchiveSuppressionObservationV1,
} from "../../../../conversation/retention/fedos_persisted_archive_suppression_observation_v1.js";
import type {
  FedosArchiveSuppressionObservationPersistence,
  FedosArchiveSuppressionObservationPersistenceWriteResult,
} from "../../../../conversation/retention/fedos_archive_suppression_observation_persistence.js";

export class InMemoryFedosArchiveSuppressionObservationPersistence implements FedosArchiveSuppressionObservationPersistence {
  readonly #records = new Map<string, FedosPersistedArchiveSuppressionObservationV1>();

  putObservation(record: FedosPersistedArchiveSuppressionObservationV1): FedosArchiveSuppressionObservationPersistenceWriteResult {
    const existing = this.#records.get(record.id);
    if (existing === undefined) {
      this.#records.set(record.id, record);
      return "inserted";
    }
    return fedosPersistedArchiveSuppressionObservationsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  getObservation(id: string): FedosPersistedArchiveSuppressionObservationV1 | null {
    return this.#records.get(id) ?? null;
  }

  listObservationsForSubject(subjectRef: string): readonly FedosPersistedArchiveSuppressionObservationV1[] {
    return [...this.#records.values()].filter((record) => record.subjectRef === subjectRef);
  }

  listObservations(): readonly FedosPersistedArchiveSuppressionObservationV1[] {
    return [...this.#records.values()];
  }
}
