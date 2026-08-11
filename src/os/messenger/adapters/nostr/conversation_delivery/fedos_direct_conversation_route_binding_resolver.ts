/**
 * Secure Runtime Alpha 7401–7480 (FedOS Direct Conversation Route Binding
 * and NIP-17 Inbound Isolation Arc) — resolves an inbound message's
 * target Conversation DIRECTLY from an authenticated route-binding
 * `conversationId`, never from sender pubkey alone.
 *
 * This is the PRIMARY resolution path this Arc introduces, replacing
 * `resolveFedosPrivateNostrInboundDirectConversation()`
 * (`./fedos_private_nostr_inbound_conversation_resolver.js`, Alpha 1424,
 * UNMODIFIED) as the first-choice resolver for any message that carries
 * this Arc's own route binding — that function is retained, unmodified,
 * and reused ONLY for the bounded Legacy Policy fallback (see the
 * Legacy and Migration Policy doc). Unlike the peer-only resolver (an
 * O(N) scan returning the FIRST match by construction), this is an O(1)
 * direct lookup by the Conversation id the sender actually named,
 * followed by a genuine Membership check against THAT EXACT Conversation
 * — never a scan, never a first-match guess, never a fallback to a
 * different Conversation on ambiguity.
 */
import type { FedosConversationDraftPersistence } from "../../../conversations/construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../../../conversations/activation/fedos_conversation_activation_persistence.js";
import type { FedosConversationMembershipAuthority } from "../../../conversations/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../../../conversations/encryption/identity/fedos_conversation_identity_resolver.js";
import { resolveFedosConversationActiveConversation } from "../../../conversations/activation/fedos_conversation_active_lookup.js";
import { resolveFedosConversationCounterpartyPublicKeyHex } from "../../../conversations/encryption/identity/fedos_conversation_counterparty_public_key_resolver.js";
import type { FedosConversationId } from "../../../conversations/fedos_conversation_id.js";
import type { FedosConversationMembership } from "../../../conversations/membership/fedos_conversation_membership.js";

export interface FedosDirectConversationRouteBindingResolverDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
}

export type FedosDirectConversationRouteBindingResolution =
  | { readonly outcome: "resolved"; readonly conversationId: string; readonly counterpartyMembership: FedosConversationMembership }
  | { readonly outcome: "unknown-conversation" }
  | { readonly outcome: "membership-denied" }
  | { readonly outcome: "identity-unavailable" };

/** Total, never throws. */
export function resolveFedosDirectConversationByRouteBinding(
  deps: FedosDirectConversationRouteBindingResolverDependencies,
  conversationId: string,
  senderPublicKeyHex: string,
): FedosDirectConversationRouteBindingResolution {
  const identity = deps.identityResolver.resolveLocalParticipant();
  if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
  const localParticipant = identity.creator;

  const draft = deps.draftPersistence.getDraft(conversationId as FedosConversationId);
  if (draft === null || draft.mode !== "direct") return { outcome: "unknown-conversation" };

  const active = resolveFedosConversationActiveConversation(deps.draftPersistence, deps.activationPersistence, conversationId as FedosConversationId);
  if (active.outcome !== "active") return { outcome: "unknown-conversation" };

  const localMembership = deps.membershipAuthority.findMembership(conversationId as FedosConversationId, localParticipant);
  if (localMembership === null || localMembership.state !== "active") return { outcome: "unknown-conversation" };

  const members = deps.membershipAuthority.listMemberships(conversationId as FedosConversationId);
  for (const member of members) {
    if (member.state !== "active") continue;
    if (member.id === localMembership.id) continue;
    const keyResolution = resolveFedosConversationCounterpartyPublicKeyHex(member.participant);
    if (keyResolution.outcome === "resolved" && keyResolution.publicKeyHex === senderPublicKeyHex) {
      return { outcome: "resolved", conversationId, counterpartyMembership: member };
    }
  }

  // The Conversation genuinely exists and is active, but this sender is
  // not a genuine active Member of it -- never silently attributed to
  // whichever OTHER member happens to be active; a real, closed denial.
  return { outcome: "membership-denied" };
}
