/**
 * FedOS Identity Transition Foundation Arc — In-Memory Transition Fact
 * Persistence. Mirrors
 * `../../ratchet/peer_capability/persistence/in_memory_fedos_ratchet_peer_capability_observation_persistence.ts`'s
 * private-`Map`-backed convention exactly.
 */
import { fedosIdentityTransitionFactKey, fedosIdentityTransitionLineageKeyParts, type FedosIdentityTransitionFactV1 } from "../../../../../conversation/identity_transition/fedos_identity_transition_fact.js";
import { determineFedosIdentityTransitionFactWriteOutcome, type FedosIdentityTransitionFactWriteOutcome } from "../../../../../conversation/identity_transition/fedos_identity_transition_fact_conflict_detection.js";
import type { FedosIdentityTransitionFactPersistence } from "../../../../../conversation/identity_transition/persistence/fedos_identity_transition_fact_persistence.js";

export class InMemoryFedosIdentityTransitionFactPersistence implements FedosIdentityTransitionFactPersistence {
  readonly #facts = new Map<string, FedosIdentityTransitionFactV1>();

  putFact(fact: FedosIdentityTransitionFactV1): FedosIdentityTransitionFactWriteOutcome {
    const outcome = determineFedosIdentityTransitionFactWriteOutcome([...this.#facts.values()], fact);
    if (outcome === "inserted") {
      this.#facts.set(fedosIdentityTransitionFactKey(fact), fact);
    }
    return outcome;
  }

  listFacts(): readonly FedosIdentityTransitionFactV1[] {
    return [...this.#facts.values()];
  }

  getFact(transitionId: string): FedosIdentityTransitionFactV1 | null {
    return this.#facts.get(transitionId) ?? null;
  }

  listLineage(oldAccountAuthority: string, oldAccountPublicIdentifier: string, oldAccountIdentityId: string | null): readonly FedosIdentityTransitionFactV1[] {
    const key = fedosIdentityTransitionLineageKeyParts(oldAccountAuthority, oldAccountPublicIdentifier, oldAccountIdentityId);
    return [...this.#facts.values()].filter(
      (f) => fedosIdentityTransitionLineageKeyParts(f.oldAccountIdentity.authority, f.oldAccountIdentity.publicIdentifier, f.oldAccountIdentity.identityId) === key,
    );
  }
}
