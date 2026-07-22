import {
  fedosIdentityTransitionPeerObservationKey,
  fedosIdentityTransitionPeerObservationLineageKeyParts,
  type FedosIdentityTransitionPeerObservationV1,
} from "../fedos_identity_transition_peer_observation.js";
import { determineFedosIdentityTransitionPeerObservationWriteOutcome, type FedosIdentityTransitionPeerObservationWriteOutcome } from "../fedos_identity_transition_peer_observation_conflict_detection.js";
import type { FedosIdentityTransitionPeerObservationPersistence } from "./fedos_identity_transition_peer_observation_persistence.js";

export class InMemoryFedosIdentityTransitionPeerObservationPersistence implements FedosIdentityTransitionPeerObservationPersistence {
  readonly #observations = new Map<string, FedosIdentityTransitionPeerObservationV1>();

  putObservation(observation: FedosIdentityTransitionPeerObservationV1): FedosIdentityTransitionPeerObservationWriteOutcome {
    const outcome = determineFedosIdentityTransitionPeerObservationWriteOutcome([...this.#observations.values()], observation);
    if (outcome === "inserted") {
      this.#observations.set(fedosIdentityTransitionPeerObservationKey(observation), observation);
    }
    return outcome;
  }

  listObservations(): readonly FedosIdentityTransitionPeerObservationV1[] {
    return [...this.#observations.values()];
  }

  getObservation(
    localDeviceRef: string,
    peerAccountRef: FedosIdentityTransitionPeerObservationV1["peerAccountRef"],
    peerDeviceRef: string,
    transitionId: string,
  ): FedosIdentityTransitionPeerObservationV1 | null {
    const key = fedosIdentityTransitionPeerObservationKey({
      schemaVersion: 1,
      localDeviceRef,
      peerAccountRef,
      peerDeviceRef,
      transitionId,
    } as FedosIdentityTransitionPeerObservationV1);
    return this.#observations.get(key) ?? null;
  }

  listLineage(
    localDeviceRef: string,
    oldAccountAuthority: string,
    oldAccountPublicIdentifier: string,
    oldAccountIdentityId: string | null,
  ): readonly FedosIdentityTransitionPeerObservationV1[] {
    const key = fedosIdentityTransitionPeerObservationLineageKeyParts(localDeviceRef, oldAccountAuthority, oldAccountPublicIdentifier, oldAccountIdentityId);
    return [...this.#observations.values()].filter(
      (o) => fedosIdentityTransitionPeerObservationLineageKeyParts(o.localDeviceRef, o.oldAccountIdentity.authority, o.oldAccountIdentity.publicIdentifier, o.oldAccountIdentity.identityId) === key,
    );
  }

  listObservationsForLocalDevice(localDeviceRef: string): readonly FedosIdentityTransitionPeerObservationV1[] {
    return [...this.#observations.values()].filter((o) => o.localDeviceRef === localDeviceRef);
  }

  listObservationsForTransition(localDeviceRef: string, transitionId: string): readonly FedosIdentityTransitionPeerObservationV1[] {
    return [...this.#observations.values()].filter((o) => o.localDeviceRef === localDeviceRef && o.transitionId === transitionId);
  }
}
