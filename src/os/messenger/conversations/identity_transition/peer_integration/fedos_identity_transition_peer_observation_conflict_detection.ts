/**
 * Secure Runtime Alpha 5961–6040 — pure predecessor-chain / rollback /
 * competing-transition detection for peer observations. Mirrors
 * `../fedos_identity_transition_fact_conflict_detection.ts`'s own
 * algorithm exactly, scoped to one (localDeviceRef, oldAccountIdentity)
 * lineage rather than just oldAccountIdentity — Phase M's own "one
 * Device observation is not account-wide acceptance" / "Bob Device B
 * observes independently" requirement.
 *
 * A duplicate key (same localDeviceRef+peerAccountRef+peerDeviceRef+
 * transitionId) is idempotent-vs-conflicting exactly like the
 * Foundation's own facts. Two DIFFERENT peer Devices (e.g. Alice's old
 * desktop and Alice's old tablet) reporting the SAME transitionId
 * produce two DISTINCT rows (never merged — "per-Device corroboration
 * remains distinct") but are still checked against the SAME lineage for
 * rollback/competing-revision-0 detection, so a conflicting claim from a
 * different sender Device is still caught.
 */
import {
  fedosIdentityTransitionPeerObservationLineageKey,
  fedosIdentityTransitionPeerObservationsAreEqual,
  type FedosIdentityTransitionPeerObservationV1,
} from "./fedos_identity_transition_peer_observation.js";

export type FedosIdentityTransitionPeerObservationWriteOutcome =
  | "inserted"
  | "already-present"
  | "conflict"
  | "broken-predecessor"
  | "rollback-detected"
  | "cycle-detected"
  | "failed";

export function determineFedosIdentityTransitionPeerObservationWriteOutcome(
  existing: readonly FedosIdentityTransitionPeerObservationV1[],
  candidate: FedosIdentityTransitionPeerObservationV1,
): FedosIdentityTransitionPeerObservationWriteOutcome {
  const existingByKey = existing.find(
    (o) =>
      o.localDeviceRef === candidate.localDeviceRef &&
      o.peerAccountRef.authority === candidate.peerAccountRef.authority &&
      o.peerAccountRef.publicIdentifier === candidate.peerAccountRef.publicIdentifier &&
      o.peerAccountRef.identityId === candidate.peerAccountRef.identityId &&
      o.peerDeviceRef === candidate.peerDeviceRef &&
      o.transitionId === candidate.transitionId,
  );
  if (existingByKey !== undefined) {
    return fedosIdentityTransitionPeerObservationsAreEqual(existingByKey, candidate) ? "already-present" : "conflict";
  }

  const lineageKey = fedosIdentityTransitionPeerObservationLineageKey(candidate);
  const lineage = existing.filter((o) => fedosIdentityTransitionPeerObservationLineageKey(o) === lineageKey);
  // Multiple rows may already exist for the SAME transitionId (one per
  // reporting peer Device) — collapse to one entry per transitionId
  // before applying revision/predecessor logic, so a second Device
  // corroborating the SAME already-accepted transitionId is never
  // mistaken for a competing sibling.
  const distinctTransitionIds = new Map<string, FedosIdentityTransitionPeerObservationV1>();
  for (const o of lineage) {
    if (!distinctTransitionIds.has(o.transitionId)) distinctTransitionIds.set(o.transitionId, o);
  }
  const distinctLineage = [...distinctTransitionIds.values()];

  if (candidate.revision === 0) {
    if (candidate.previousTransitionId !== null) return "broken-predecessor";
    if (distinctLineage.some((o) => o.revision === 0 && o.transitionId !== candidate.transitionId)) return "conflict";
    return "inserted";
  }

  if (candidate.previousTransitionId === null) return "broken-predecessor";
  const predecessor = distinctLineage.find((o) => o.transitionId === candidate.previousTransitionId);
  if (predecessor === undefined) return "broken-predecessor";
  if (predecessor.revision !== candidate.revision - 1) return "broken-predecessor";

  const maxRevisionSoFar = distinctLineage.reduce((max, o) => Math.max(max, o.revision), -1);
  if (candidate.revision <= maxRevisionSoFar) return "rollback-detected";

  const competingSibling = distinctLineage.find(
    (o) => o.previousTransitionId === candidate.previousTransitionId && o.transitionId !== candidate.transitionId,
  );
  if (competingSibling !== undefined) return "conflict";

  const visited = new Set<string>([candidate.transitionId]);
  let cursor: string | null = candidate.previousTransitionId;
  while (cursor !== null) {
    if (visited.has(cursor)) return "cycle-detected";
    visited.add(cursor);
    const cursorObservation = distinctLineage.find((o) => o.transitionId === cursor);
    cursor = cursorObservation === undefined ? null : cursorObservation.previousTransitionId;
  }

  return "inserted";
}

/** Pure query — supersession is derived, never stored mutably (mirrors the Foundation's own `isFedosIdentityTransitionFactSuperseded()`). */
export function isFedosIdentityTransitionPeerObservationSuperseded(
  observation: FedosIdentityTransitionPeerObservationV1,
  lineageObservations: readonly FedosIdentityTransitionPeerObservationV1[],
): boolean {
  return lineageObservations.some((o) => o.transitionId !== observation.transitionId && o.revision > observation.revision);
}
