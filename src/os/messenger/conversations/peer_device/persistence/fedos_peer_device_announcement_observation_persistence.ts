/**
 * FedOS Peer Device Discovery Arc — Peer Device Announcement Observation
 * Persistence Port. Mirrors
 * `../../ratchet/peer_capability/persistence/fedos_ratchet_peer_capability_observation_persistence.ts`'s
 * own port shape exactly — a DELIBERATELY SEPARATE port, never reused from
 * or merged into any existing Ratchet/Device Sync/Peer Capability
 * persistence port.
 */
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import {
  fedosPeerDeviceAnnouncementObservationKey,
  fedosPeerDeviceAnnouncementObservationsAreEqual,
  fedosPeerDeviceAnnouncementObservationSubjectKey,
  type FedosPeerDeviceAnnouncementObservationV1,
} from "../fedos_peer_device_announcement_observation.js";

export type FedosPeerDeviceAnnouncementObservationWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosPeerDeviceAnnouncementObservationPersistence {
  putObservation(record: FedosPeerDeviceAnnouncementObservationV1): FedosPeerDeviceAnnouncementObservationWriteResult;
  listObservations(): readonly FedosPeerDeviceAnnouncementObservationV1[];
  listObservationsForPeerDevice(localDeviceRef: string, peerAccountRef: FedosDeviceBindingAccountRef, deviceId: string): readonly FedosPeerDeviceAnnouncementObservationV1[];
}

export { fedosPeerDeviceAnnouncementObservationKey, fedosPeerDeviceAnnouncementObservationsAreEqual, fedosPeerDeviceAnnouncementObservationSubjectKey };
