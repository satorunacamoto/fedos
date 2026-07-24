/**
 * Secure Runtime Alpha 5721–5800 — In-Memory Peer Capability Observation
 * Persistence. Mirrors
 * `../../persistence/in_memory_fedos_direct_ratchet_session_reset_record_persistence.ts`'s
 * private-`Map`-backed convention exactly.
 */
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";
import {
  fedosRatchetPeerCapabilityObservationKey,
  fedosRatchetPeerCapabilityObservationsAreEqual,
  fedosRatchetPeerCapabilityObservationSubjectKey,
  type FedosRatchetPeerCapabilityObservationV1,
} from "../fedos_ratchet_peer_capability_observation.js";
import type {
  FedosRatchetPeerCapabilityObservationPersistence,
  FedosRatchetPeerCapabilityObservationWriteResult,
} from "./fedos_ratchet_peer_capability_observation_persistence.js";

export class InMemoryFedosRatchetPeerCapabilityObservationPersistence implements FedosRatchetPeerCapabilityObservationPersistence {
  readonly #records = new Map<string, FedosRatchetPeerCapabilityObservationV1>();

  putObservation(record: FedosRatchetPeerCapabilityObservationV1): FedosRatchetPeerCapabilityObservationWriteResult {
    const key = fedosRatchetPeerCapabilityObservationKey(record);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosRatchetPeerCapabilityObservationsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  listObservations(): readonly FedosRatchetPeerCapabilityObservationV1[] {
    return [...this.#records.values()];
  }

  listObservationsForPeerDevice(
    localDeviceRef: string,
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
  ): readonly FedosRatchetPeerCapabilityObservationV1[] {
    const subject = fedosRatchetPeerCapabilityObservationSubjectKey(localDeviceRef, peerAccountRef, peerDeviceRef);
    return [...this.#records.values()].filter(
      (r) => fedosRatchetPeerCapabilityObservationSubjectKey(r.localDeviceRef, r.peerAccountRef, r.peerDeviceRef) === subject,
    );
  }
}
