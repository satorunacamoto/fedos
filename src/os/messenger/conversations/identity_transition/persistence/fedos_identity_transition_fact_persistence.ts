/**
 * FedOS Identity Transition Foundation Arc — Phase J: durable Transition
 * Fact Persistence Port. Mirrors
 * `../../ratchet/peer_capability/persistence/fedos_ratchet_peer_capability_observation_persistence.ts`'s
 * own port shape exactly — a DELIBERATELY SEPARATE port, never merged
 * into any existing Ratchet/Device/Peer-Capability persistence port.
 */
import { fedosIdentityTransitionFactKey, fedosIdentityTransitionFactsAreEqual, fedosIdentityTransitionLineageKey, fedosIdentityTransitionLineageKeyParts, type FedosIdentityTransitionFactV1 } from "../../../../../conversation/identity_transition/fedos_identity_transition_fact.js";
import type { FedosIdentityTransitionFactWriteOutcome } from "../../../../../conversation/identity_transition/fedos_identity_transition_fact_conflict_detection.js";

export interface FedosIdentityTransitionFactPersistence {
  putFact(fact: FedosIdentityTransitionFactV1): FedosIdentityTransitionFactWriteOutcome;
  listFacts(): readonly FedosIdentityTransitionFactV1[];
  getFact(transitionId: string): FedosIdentityTransitionFactV1 | null;
  listLineage(oldAccountAuthority: string, oldAccountPublicIdentifier: string, oldAccountIdentityId: string | null): readonly FedosIdentityTransitionFactV1[];
}

export { fedosIdentityTransitionFactKey, fedosIdentityTransitionFactsAreEqual, fedosIdentityTransitionLineageKey, fedosIdentityTransitionLineageKeyParts };
export type { FedosIdentityTransitionFactWriteOutcome };
