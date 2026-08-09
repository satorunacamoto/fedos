/**
 * Secure Runtime Alpha 932 ("Conversation Participant Resolver") — Stage
 * 2 of the Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc.
 *
 * Given a Conversation id and the already-resolved LOCAL participant
 * (`./fedos_conversation_identity_resolver.ts`), answers the second
 * question Alpha 890's own completion declaration named as unresolved:
 * "who is the conversation's OTHER participant?" — composed entirely
 * over the EXISTING, unmodified `FedosConversationMembershipAuthority`
 * (Alpha 761–790) via its own public `findMembership()`/
 * `listMemberships()` methods; no Membership file is touched.
 *
 * V1 scope, matching Alpha 890's own "Pairwise (Direct-mode) only"
 * crypto boundary (`09_direct_key_strategy.md`): exactly ONE other
 * ACTIVE member is a resolvable counterparty. Zero active members other
 * than the local participant, or two-or-more, both fail closed —
 * `"ambiguous-counterparty"` for the latter is a deliberate, honest
 * refusal to guess which of several private-group members the pairwise
 * key should be derived against, never a silent "pick the first one".
 * A future group/Private-Group key strategy (`10_group_key_strategy.md`,
 * still unresolved per Alpha 890) would need its own resolver — this one
 * is not widened to fake a multi-party answer.
 */

import type { FedosConversationId } from "../../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationMembership } from "../../../../../conversation/membership/fedos_conversation_membership.js";
import type { FedosConversationMembershipAuthority } from "../../../../../conversation/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../../../../../conversation/membership/fedos_conversation_participant_reference.js";

export type FedosConversationParticipantResolution =
  | { readonly outcome: "resolved"; readonly local: FedosConversationMembership; readonly counterparty: FedosConversationMembership }
  | { readonly outcome: "not-member" }
  | { readonly outcome: "no-counterparty" }
  | { readonly outcome: "ambiguous-counterparty" };

export interface FedosConversationParticipantResolver {
  /** Total, never throws — mirrors every other Authority read in this codebase. */
  resolveCounterparty(
    conversationId: FedosConversationId,
    localParticipant: FedosConversationParticipantReference,
  ): FedosConversationParticipantResolution;
}

function participantsEqual(a: FedosConversationParticipantReference, b: FedosConversationParticipantReference): boolean {
  return a.authority === b.authority && a.publicIdentifier === b.publicIdentifier;
}

/**
 * The ONE production implementation — composed entirely over an injected
 * `FedosConversationMembershipAuthority`. Performs no encryption, no
 * identity resolution of its own (the local participant is always
 * supplied by the caller, never re-resolved here).
 */
export class MembershipFedosConversationParticipantResolver implements FedosConversationParticipantResolver {
  readonly #membershipAuthority: FedosConversationMembershipAuthority;

  constructor(membershipAuthority: FedosConversationMembershipAuthority) {
    this.#membershipAuthority = membershipAuthority;
  }

  resolveCounterparty(
    conversationId: FedosConversationId,
    localParticipant: FedosConversationParticipantReference,
  ): FedosConversationParticipantResolution {
    const local = this.#membershipAuthority.findMembership(conversationId, localParticipant);
    if (local === null || local.state !== "active") return { outcome: "not-member" };

    const others = this.#membershipAuthority
      .listMemberships(conversationId)
      .filter((m) => m.state === "active" && !participantsEqual(m.participant, localParticipant));

    if (others.length === 0) return { outcome: "no-counterparty" };
    if (others.length > 1) return { outcome: "ambiguous-counterparty" };

    return { outcome: "resolved", local, counterparty: others[0]! };
  }
}
