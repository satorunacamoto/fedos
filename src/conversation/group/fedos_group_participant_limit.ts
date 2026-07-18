/**
 * Secure Runtime Alpha 1329 ("Group Participant Limit") — Phase A of the
 * Alpha 1321–1390 Private Group Pairwise Fanout Foundation Arc.
 *
 * An OPERATIONAL limit only — never a cryptographic one. Pairwise fanout
 * (`docs/reviews/private_group_pairwise_fanout/16_pairwise_fanout.md`)
 * costs one full `encrypt()` call, one Envelope, one Payload, and one
 * Direct Path per OTHER active member per message; this bound exists to
 * keep that real, already-O(N) local cost predictable and testable, not
 * because any larger number would be cryptographically unsafe. Injected/
 * configurable so a deployment may choose a stricter (never looser than
 * reviewed) bound without a source change.
 */

/** Conservative default: local fanout cost, storage, and test runtime all stay small and predictable at this size. */
export const FEDOS_GROUP_DEFAULT_MAX_ACTIVE_MEMBERS = 8;

export interface FedosGroupParticipantLimitPolicy {
  /** The maximum number of ACTIVE members (including the local participant) a group may have for fanout to remain usable. */
  maxActiveMembers(): number;
}

export class FixedFedosGroupParticipantLimitPolicy implements FedosGroupParticipantLimitPolicy {
  readonly #limit: number;

  constructor(limit: number = FEDOS_GROUP_DEFAULT_MAX_ACTIVE_MEMBERS) {
    this.#limit = limit;
  }

  maxActiveMembers(): number {
    return this.#limit;
  }
}
