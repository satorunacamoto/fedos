/**
 * Secure Runtime Alpha 3641–3720 — In-Memory Device Sync Observation
 * Repository. Mirrors `../../../board/observation/in_memory_fedos_delivery_observation_persistence.ts`'s
 * own private-`Map<id, fact>`-backed convention exactly.
 */

import {
  fedosDeviceRelaySyncObservationId,
  type FedosDeviceRelaySyncObservationRepository,
  type FedosDeviceRelaySyncObservationState,
  type FedosDeviceRelaySyncObservationV1,
  type FedosDeviceRelaySyncObservationWriteResult,
} from "../../../../../device/relay_sync/fedos_device_relay_sync_observation.js";

function factsAreEqual(a: FedosDeviceRelaySyncObservationV1, b: FedosDeviceRelaySyncObservationV1): boolean {
  return a.subjectId === b.subjectId && a.state === b.state && a.observedAt === b.observedAt && a.reason === b.reason;
}

export class InMemoryFedosDeviceRelaySyncObservationRepository implements FedosDeviceRelaySyncObservationRepository {
  readonly #facts = new Map<string, FedosDeviceRelaySyncObservationV1>();

  record(subjectId: string, state: FedosDeviceRelaySyncObservationState, observedAt: number, reason: string | null = null): FedosDeviceRelaySyncObservationWriteResult {
    if (typeof subjectId !== "string" || subjectId.trim().length === 0) return "failed";
    const id = fedosDeviceRelaySyncObservationId(subjectId, state, observedAt);
    const fact: FedosDeviceRelaySyncObservationV1 = Object.freeze({ id, subjectId, state, observedAt, reason });
    const existing = this.#facts.get(id);
    if (existing === undefined) {
      this.#facts.set(id, fact);
      return "recorded";
    }
    return factsAreEqual(existing, fact) ? "already-present" : "conflict";
  }

  get(id: string): FedosDeviceRelaySyncObservationV1 | null {
    return this.#facts.get(id) ?? null;
  }

  list(): readonly FedosDeviceRelaySyncObservationV1[] {
    return [...this.#facts.values()];
  }

  listBySubject(subjectId: string): readonly FedosDeviceRelaySyncObservationV1[] {
    return this.list().filter((fact) => fact.subjectId === subjectId);
  }
}
