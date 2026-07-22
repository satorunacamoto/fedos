/**
 * Secure Runtime Alpha 5961–6040 — Peer Transition Observation
 * Persistence Port. Mirrors
 * `../../persistence/fedos_identity_transition_fact_persistence.ts`'s own
 * port shape — a DELIBERATELY SEPARATE port, never merged into the
 * Foundation's own Fact persistence or any Ratchet/Device persistence.
 */
import {
  fedosIdentityTransitionPeerObservationKey,
  fedosIdentityTransitionPeerObservationLineageKeyParts,
  fedosIdentityTransitionPeerObservationsAreEqual,
  type FedosIdentityTransitionPeerObservationV1,
} from "../fedos_identity_transition_peer_observation.js";
import type { FedosIdentityTransitionPeerObservationWriteOutcome } from "../fedos_identity_transition_peer_observation_conflict_detection.js";

export interface FedosIdentityTransitionPeerObservationPersistence {
  putObservation(observation: FedosIdentityTransitionPeerObservationV1): FedosIdentityTransitionPeerObservationWriteOutcome;
  listObservations(): readonly FedosIdentityTransitionPeerObservationV1[];
  getObservation(localDeviceRef: string, peerAccountRef: FedosIdentityTransitionPeerObservationV1["peerAccountRef"], peerDeviceRef: string, transitionId: string): FedosIdentityTransitionPeerObservationV1 | null;
  listLineage(localDeviceRef: string, oldAccountAuthority: string, oldAccountPublicIdentifier: string, oldAccountIdentityId: string | null): readonly FedosIdentityTransitionPeerObservationV1[];
  /** Secure Runtime Alpha 6121-6200 — every observation THIS local Device has ever recorded, regardless of lineage. Backs the Identity Transition Inbox (Phase J). */
  listObservationsForLocalDevice(localDeviceRef: string): readonly FedosIdentityTransitionPeerObservationV1[];
  /** Secure Runtime Alpha 6121-6200 — every row for one transitionId (one per reporting peer Device) — backs the Peer Device Evidence display (Phase E). */
  listObservationsForTransition(localDeviceRef: string, transitionId: string): readonly FedosIdentityTransitionPeerObservationV1[];
}

export { fedosIdentityTransitionPeerObservationKey, fedosIdentityTransitionPeerObservationLineageKeyParts, fedosIdentityTransitionPeerObservationsAreEqual };
export type { FedosIdentityTransitionPeerObservationWriteOutcome };
