/**
 * Secure Runtime Alpha 7401–7480 (FedOS Direct Conversation Route Binding
 * and NIP-17 Inbound Isolation Arc) — counts how many active `direct`
 * Conversations match a sender's pubkey, for the bounded Legacy Policy
 * ONLY (see the Legacy and Migration Policy doc). Never used for a
 * message that carries this Arc's own authenticated route binding —
 * `resolveFedosDirectConversationByRouteBinding()`
 * (`./fedos_direct_conversation_route_binding_resolver.js`) is the
 * PRIMARY resolver for those; this file exists solely to let a caller
 * distinguish "exactly one candidate" (legacy-unambiguous, acceptable)
 * from "two or more candidates" (ambiguous, must fail closed) for
 * messages with NO binding at all — mirrors
 * `resolveFedosPrivateNostrInboundDirectConversation()`'s
 * (`./fedos_private_nostr_inbound_conversation_resolver.js`, Alpha 1424,
 * UNMODIFIED) own iteration exactly, but collects every match instead of
 * returning only the first.
 */
import type { FedosConversationDraftPersistence } from "../../../conversations/construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../../../conversations/activation/fedos_conversation_activation_persistence.js";
import type { FedosConversationMembershipAuthority } from "../../../conversations/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../../../conversations/encryption/identity/fedos_conversation_identity_resolver.js";
import { resolveFedosConversationActiveConversation } from "../../../conversations/activation/fedos_conversation_active_lookup.js";
import { resolveFedosConversationCounterpartyPublicKeyHex } from "../../../conversations/encryption/identity/fedos_conversation_counterparty_public_key_resolver.js";
import type { FedosConversationId } from "../../../conversations/fedos_conversation_id.js";
import type { FedosConversationMembership } from "../../../conversations/membership/fedos_conversation_membership.js";

export interface FedosPrivateNostrInboundLegacyCandidateCountDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
}

export interface FedosPrivateNostrInboundLegacyCandidate {
  readonly conversationId: string;
  readonly counterpartyMembership: FedosConversationMembership;
}

export type FedosPrivateNostrInboundLegacyCandidateCountResult =
  | { readonly outcome: "counted"; readonly candidates: readonly FedosPrivateNostrInboundLegacyCandidate[] }
  | { readonly outcome: "identity-unavailable" };

/** Total, never throws. Never mutates anything. */
export function countFedosPrivateNostrInboundLegacyCandidates(
  deps: FedosPrivateNostrInboundLegacyCandidateCountDependencies,
  senderPublicKeyHex: string,
): FedosPrivateNostrInboundLegacyCandidateCountResult {
  const identity = deps.identityResolver.resolveLocalParticipant();
  if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
  const localParticipant = identity.creator;

  const candidates: FedosPrivateNostrInboundLegacyCandidate[] = [];
  for (const draft of deps.draftPersistence.listDrafts()) {
    if (draft.mode !== "direct") continue;
    const conversationId = draft.id as FedosConversationId;
    const active = resolveFedosConversationActiveConversation(deps.draftPersistence, deps.activationPersistence, conversationId);
    if (active.outcome !== "active") continue;

    const localMembership = deps.membershipAuthority.findMembership(conversationId, localParticipant);
    if (localMembership === null || localMembership.state !== "active") continue;

    const members = deps.membershipAuthority.listMemberships(conversationId);
    for (const member of members) {
      if (member.state !== "active") continue;
      if (member.id === localMembership.id) continue;
      const keyResolution = resolveFedosConversationCounterpartyPublicKeyHex(member.participant);
      if (keyResolution.outcome === "resolved" && keyResolution.publicKeyHex === senderPublicKeyHex) {
        candidates.push({ conversationId: conversationId as unknown as string, counterpartyMembership: member });
      }
    }
  }
  return { outcome: "counted", candidates };
}
