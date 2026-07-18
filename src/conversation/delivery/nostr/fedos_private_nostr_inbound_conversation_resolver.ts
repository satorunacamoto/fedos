/**
 * Secure Runtime Alpha 1424 ("Conversation Resolution") — Phase D of the
 * Alpha 1391–1470 Nostr Private Direct and Pairwise Fanout Delivery Arc.
 *
 * Resolves an inbound event's SENDER pubkey to an existing, ACTIVE local
 * `direct` Conversation whose counterparty carries that exact pubkey.
 * This is the general mechanism for BOTH plain Direct delivery AND Group
 * pairwise fanout delivery — a Group child Direct path
 * (`../group/fedos_group_direct_path.ts`) IS a real `direct` Conversation
 * under the hood, so no separate Group-specific resolution exists or is
 * needed here (Alpha 1424's own "existing Group child Direct path" case
 * collapses into this one).
 *
 * Never auto-creates a Conversation (Alpha 1424's own explicit
 * prohibition) — an unmatched sender resolves to `null`, which the
 * Inbound Delivery Coordinator maps to Alpha 1425's own quarantine/drop
 * Unknown Sender Policy.
 *
 * O(N) over every locally-known draft (Alpha 1456's own documented,
 * honest cost — no index is built, matching this repository's existing
 * "no premature optimization" discipline elsewhere).
 */

import type { FedosConversationDraftPersistence } from "../../construction/fedos_conversation_draft_persistence.js";
import type { FedosConversationActivationPersistence } from "../../activation/fedos_conversation_activation_persistence.js";
import type { FedosConversationMembershipAuthority } from "../../membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../../encryption/identity/fedos_conversation_identity_resolver.js";
import { resolveFedosConversationActiveConversation } from "../../activation/fedos_conversation_active_lookup.js";
import { resolveFedosConversationCounterpartyPublicKeyHex } from "../../encryption/identity/fedos_conversation_counterparty_public_key_resolver.js";
import type { FedosConversationId } from "../../fedos_conversation_id.js";
import type { FedosConversationMembership } from "../../membership/fedos_conversation_membership.js";

export interface FedosPrivateNostrInboundConversationResolverDependencies {
  readonly draftPersistence: FedosConversationDraftPersistence;
  readonly activationPersistence: FedosConversationActivationPersistence;
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
}

export type FedosPrivateNostrInboundConversationResolution =
  | { readonly outcome: "resolved"; readonly conversationId: string; readonly counterpartyMembership: FedosConversationMembership }
  | { readonly outcome: "unknown-sender" }
  | { readonly outcome: "identity-unavailable" };

/** Total, never throws. */
export function resolveFedosPrivateNostrInboundDirectConversation(
  deps: FedosPrivateNostrInboundConversationResolverDependencies,
  senderPublicKeyHex: string,
): FedosPrivateNostrInboundConversationResolution {
  const identity = deps.identityResolver.resolveLocalParticipant();
  if (identity.outcome === "unavailable") return { outcome: "identity-unavailable" };
  const localParticipant = identity.creator;

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
        return { outcome: "resolved", conversationId, counterpartyMembership: member };
      }
    }
  }

  return { outcome: "unknown-sender" };
}
