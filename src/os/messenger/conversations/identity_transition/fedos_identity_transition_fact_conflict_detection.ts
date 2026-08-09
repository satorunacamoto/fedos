/**
 * FedOS Identity Transition Foundation Arc — Phase J: pure
 * predecessor-chain / rollback / cycle / competing-transition detection.
 *
 * A pure, synchronous function shared by BOTH persistence backends
 * (in-memory and append-only) so this domain logic exists in exactly one
 * place — mirrors this repo's own "pure decision authority, separate from
 * persistence I/O" convention
 * (`../fedos_direct_ratchet_session_reset_authority.ts`,
 * `../peer_capability/fedos_ratchet_peer_capability_acceptance_policy.ts`).
 *
 * Scope: one "lineage" is all facts sharing the same OLD account
 * identity (`fedosIdentityTransitionLineageKey()`) — a lineage models the
 * ordered, single-threaded history of replacement attempts FOR that one
 * old identity. Two different transitionIds attempting to extend the
 * SAME predecessor, or a transitionId whose own revision does not exceed
 * the lineage's current maximum, are exactly the "two competing
 * replacement transitions" / "revision rollback" cases Phase P names.
 */
import { fedosIdentityTransitionFactsAreEqual, fedosIdentityTransitionLineageKey, type FedosIdentityTransitionFactV1 } from "../../../../conversation/identity_transition/fedos_identity_transition_fact.js";

export type FedosIdentityTransitionFactWriteOutcome =
  | "inserted"
  | "already-present"
  | "conflict"
  | "broken-predecessor"
  | "rollback-detected"
  | "cycle-detected"
  | "failed";

/**
 * Pure. Never mutates `existingFacts`. Determines what MUST happen to
 * `candidate` given every fact already recorded — the persistence layer
 * only needs to act on this result (append on `"inserted"`, do nothing
 * otherwise) rather than re-deriving any of this logic itself.
 */
export function determineFedosIdentityTransitionFactWriteOutcome(
  existingFacts: readonly FedosIdentityTransitionFactV1[],
  candidate: FedosIdentityTransitionFactV1,
): FedosIdentityTransitionFactWriteOutcome {
  const existingByTransitionId = existingFacts.find((f) => f.transitionId === candidate.transitionId);
  if (existingByTransitionId !== undefined) {
    return fedosIdentityTransitionFactsAreEqual(existingByTransitionId, candidate) ? "already-present" : "conflict";
  }

  const lineageKey = fedosIdentityTransitionLineageKey(candidate);
  const lineage = existingFacts.filter((f) => fedosIdentityTransitionLineageKey(f) === lineageKey);

  if (candidate.revision === 0) {
    if (candidate.previousTransitionId !== null) return "broken-predecessor";
    if (lineage.some((f) => f.revision === 0)) return "conflict";
    return "inserted";
  }

  if (candidate.previousTransitionId === null) return "broken-predecessor";
  const predecessor = lineage.find((f) => f.transitionId === candidate.previousTransitionId);
  if (predecessor === undefined) return "broken-predecessor";
  if (predecessor.revision !== candidate.revision - 1) return "broken-predecessor";

  const maxRevisionSoFar = lineage.reduce((max, f) => Math.max(max, f.revision), -1);
  if (candidate.revision <= maxRevisionSoFar) return "rollback-detected";

  const competingSibling = lineage.find(
    (f) => f.previousTransitionId === candidate.previousTransitionId && f.transitionId !== candidate.transitionId,
  );
  if (competingSibling !== undefined) return "conflict";

  // Cycle detection: walk the predecessor chain from the candidate's own
  // parent backward; if any transitionId (including the candidate's own)
  // reappears, the chain is cyclic.
  const visited = new Set<string>([candidate.transitionId]);
  let cursor: string | null = candidate.previousTransitionId;
  while (cursor !== null) {
    if (visited.has(cursor)) return "cycle-detected";
    visited.add(cursor);
    const cursorFact = lineage.find((f) => f.transitionId === cursor);
    cursor = cursorFact === undefined ? null : cursorFact.previousTransitionId;
  }

  return "inserted";
}

/**
 * Pure query helper — `supersededByTransitionId` is always `null` on a
 * stored fact (this Arc never rewrites an already-inserted fact, see
 * `fedos_identity_transition_fact.ts`'s own header). "Is this fact
 * superseded?" is instead DERIVED at read time: `true` iff some other
 * fact in the same lineage has a strictly higher revision.
 */
export function isFedosIdentityTransitionFactSuperseded(
  fact: FedosIdentityTransitionFactV1,
  lineageFacts: readonly FedosIdentityTransitionFactV1[],
): boolean {
  return lineageFacts.some((f) => f.transitionId !== fact.transitionId && f.revision > fact.revision);
}
