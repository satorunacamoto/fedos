/**
 * FedOS Peer Device Discovery Arc — In-Memory Peer Device Announcement
 * Observation Persistence. Mirrors
 * `../../ratchet/peer_capability/persistence/in_memory_fedos_ratchet_peer_capability_observation_persistence.ts`'s
 * private-`Map`-backed convention exactly.
 */
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import {
  fedosPeerDeviceAnnouncementObservationKey,
  fedosPeerDeviceAnnouncementObservationsAreEqual,
  fedosPeerDeviceAnnouncementObservationSubjectKey,
  type FedosPeerDeviceAnnouncementObservationV1,
} from "../fedos_peer_device_announcement_observation.js";
import type { FedosPeerDeviceAnnouncementObservationPersistence, FedosPeerDeviceAnnouncementObservationWriteResult } from "./fedos_peer_device_announcement_observation_persistence.js";

export class InMemoryFedosPeerDeviceAnnouncementObservationPersistence implements FedosPeerDeviceAnnouncementObservationPersistence {
  readonly #records = new Map<string, FedosPeerDeviceAnnouncementObservationV1>();

  putObservation(record: FedosPeerDeviceAnnouncementObservationV1): FedosPeerDeviceAnnouncementObservationWriteResult {
    const key = fedosPeerDeviceAnnouncementObservationKey(record);
    const existing = this.#records.get(key);
    if (existing === undefined) {
      this.#records.set(key, record);
      return "inserted";
    }
    return fedosPeerDeviceAnnouncementObservationsAreEqual(existing, record) ? "already-present" : "conflict";
  }

  listObservations(): readonly FedosPeerDeviceAnnouncementObservationV1[] {
    return [...this.#records.values()];
  }

  listObservationsForPeerDevice(localDeviceRef: string, peerAccountRef: FedosDeviceBindingAccountRef, deviceId: string): readonly FedosPeerDeviceAnnouncementObservationV1[] {
    const subject = fedosPeerDeviceAnnouncementObservationSubjectKey(localDeviceRef, peerAccountRef, deviceId);
    return [...this.#records.values()].filter((r) => fedosPeerDeviceAnnouncementObservationSubjectKey(r.localDeviceRef, r.peerAccountRef, r.deviceId) === subject);
  }
}
