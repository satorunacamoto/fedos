/**
 * Secure Runtime Alpha 5721–5800 — Peer Capability Observation
 * Persistence Port. Mirrors
 * `../../persistence/fedos_direct_ratchet_session_reset_record_persistence.ts`'s
 * own port shape exactly, applied to peer-capability observation facts —
 * a DELIBERATELY SEPARATE port, never reused from or merged into any
 * existing Ratchet or Device Sync persistence port (this codebase's own
 * established convention, confirmed twice in Phase A).
 */
import type { FedosDeviceBindingAccountRef } from "../../../../device/fedos_device_binding.js";
import {
  fedosRatchetPeerCapabilityObservationKey,
  fedosRatchetPeerCapabilityObservationsAreEqual,
  fedosRatchetPeerCapabilityObservationSubjectKey,
  type FedosRatchetPeerCapabilityObservationV1,
} from "../fedos_ratchet_peer_capability_observation.js";

export type FedosRatchetPeerCapabilityObservationWriteResult = "inserted" | "already-present" | "conflict" | "failed";

export interface FedosRatchetPeerCapabilityObservationPersistence {
  putObservation(record: FedosRatchetPeerCapabilityObservationV1): FedosRatchetPeerCapabilityObservationWriteResult;
  listObservations(): readonly FedosRatchetPeerCapabilityObservationV1[];
  listObservationsForPeerDevice(
    localDeviceRef: string,
    peerAccountRef: FedosDeviceBindingAccountRef,
    peerDeviceRef: string,
  ): readonly FedosRatchetPeerCapabilityObservationV1[];
}

export { fedosRatchetPeerCapabilityObservationKey, fedosRatchetPeerCapabilityObservationsAreEqual, fedosRatchetPeerCapabilityObservationSubjectKey };
