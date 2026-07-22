/**
 * FedOS Identity Transition Foundation Arc — Phase M: read-only
 * Conversation / Archive / Search consequence plan.
 *
 * A pure, descriptive DTO only, matching Phase L's own posture. Absolute
 * Prohibitions honored: no history rewrite, no Archive modification, no
 * Search reindex — this file imports nothing from
 * `../membership/`, `../archive/`, or `../search/`; it only documents
 * what those domains' OWN existing, unmodified policies already imply.
 */
export interface FedosIdentityTransitionDownstreamPlanV1 {
  readonly schemaVersion: 1;
  readonly transitionId: string;
  readonly historicalMessagesRetainOldAuthorIdentity: true;
  readonly conversationMembershipNotSilentlyRewritten: true;
  readonly archiveRemainsImmutable: true;
  readonly archiveRestoreEstablishesNoNewTrust: true;
  readonly searchMustNotMergeIdentitiesWithoutAcceptedMapping: true;
  readonly groupIdentityTransitionUnsupported: true;
  readonly notes: readonly string[];
}

export function planFedosIdentityTransitionDownstreamConsequences(transitionId: string): FedosIdentityTransitionDownstreamPlanV1 {
  return Object.freeze({
    schemaVersion: 1,
    transitionId,
    historicalMessagesRetainOldAuthorIdentity: true,
    conversationMembershipNotSilentlyRewritten: true,
    archiveRemainsImmutable: true,
    archiveRestoreEstablishesNoNewTrust: true,
    searchMustNotMergeIdentitiesWithoutAcceptedMapping: true,
    groupIdentityTransitionUnsupported: true,
    notes: Object.freeze([
      "PLAN ONLY — no Conversation Membership, Archive, or Search mutation of any kind is performed by this Arc.",
      "An optional future continuity mapping (old identity -> new identity, surfaced to Search/UI) is deferred to a later Arc.",
    ]),
  });
}
