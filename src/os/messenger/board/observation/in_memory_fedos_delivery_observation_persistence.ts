/**
 * Secure Runtime Alpha 465 ("In-Memory Delivery Observation Persistence
 * Backend") — Stage 5 of the Alpha 461–470 Canonical Delivery Observation
 * Arc.
 *
 * The first, in-memory-only `FedosDeliveryObservationPersistence`
 * (`./fedos_delivery_observation_persistence.js`). Follows the SAME
 * private-field `Map`-backed class convention
 * `InMemoryFedosBoardOutboxPersistence`
 * (`../outbox/in_memory_fedos_board_outbox_persistence.ts`, Alpha 417)
 * already established.
 *
 * HARD GUARDRAILS:
 *   - Deterministic, no constructor side effects.
 *   - Independent instances never share state — no module-level mutable
 *     state exists in this file.
 *   - `listObservations()` returns a NEW array every call.
 *   - No persistence to JSON, no filesystem, no background work, no
 *     network.
 */

import {
  fedosPersistedDeliveryObservationRecordsAreEqual,
  type FedosDeliveryObservationPersistence,
  type FedosDeliveryObservationPersistenceWriteResult,
} from "./fedos_delivery_observation_persistence.js";
import type { FedosPersistedDeliveryObservationRecordV1 } from "./fedos_delivery_observation_codec.js";

export class InMemoryFedosDeliveryObservationPersistence implements FedosDeliveryObservationPersistence {
  readonly #records = new Map<string, FedosPersistedDeliveryObservationRecordV1>();

  putObservation(
    record: FedosPersistedDeliveryObservationRecordV1,
  ): FedosDeliveryObservationPersistenceWriteResult {
    const existing = this.#records.get(record.id);
    if (existing === undefined) {
      this.#records.set(record.id, record);
      return "inserted";
    }
    if (fedosPersistedDeliveryObservationRecordsAreEqual(existing, record)) {
      return "already-present";
    }
    return "conflict";
  }

  getObservation(id: string): FedosPersistedDeliveryObservationRecordV1 | null {
    return this.#records.get(id) ?? null;
  }

  listObservations(): readonly FedosPersistedDeliveryObservationRecordV1[] {
    return [...this.#records.values()];
  }
}
