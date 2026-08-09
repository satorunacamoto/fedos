/**
 * Secure Runtime Alpha 1411–1418 (Phase C — Group Pairwise Delivery) of
 * the Alpha 1391–1470 Nostr Private Direct and Pairwise Fanout Delivery
 * Arc.
 *
 * `deliverGroupMessage()` reuses the EXISTING Pairwise Fanout plan
 * (`FedosGroupFanoutDeliveryPersistence`/`FedosGroupDirectPathPersistence`,
 * Alpha 1321–1390, unmodified) rather than building a second planning
 * mechanism: for each `"stored"` `FedosGroupFanoutDeliveryRecord`, its own
 * `pathId` resolves to the recipient's Group child Direct path
 * (`directConversationId`) — which IS a real `direct` Conversation — and
 * this file calls `FedosPrivateNostrOutboundDeliveryCoordinator.deliverEnvelope()`
 * ONCE per recipient over THAT conversation/envelope pair (Alpha 1411:
 * "never emit one shared group event"). The sender's own local
 * `groupMessageId` is threaded through as `groupLinkage` so it travels
 * INSIDE the authenticated encrypted wire payload (Alpha 1394/1411) —
 * never as a plaintext tag, never as anyone's canonical local id but the
 * sender's own.
 *
 * Delivery-request identity is already collision-free per recipient
 * (Alpha 1412): `toFedosPrivateNostrDeliveryRequestId()` is keyed by
 * `(directConversationId, envelopeId, recipientMembershipId)`, and each
 * recipient's own `directConversationId` differs — no cross-recipient
 * overwrite is possible.
 *
 * A per-recipient result array is always returned (Alpha 1413/1414) —
 * one Relay rejection never erases another recipient's own accepted
 * result, and this file never mutates the existing local
 * `FedosGroupMessageRecord`/`FedosGroupFanoutDeliveryRecord` state
 * (Alpha 1413's own "do not rewrite... merely because network delivery
 * is partial"). Retrying only calls `deliverEnvelope()` again for
 * recipients whose OWN delivery didn't already reach a terminal
 * `"accepted"` Observation (Alpha 1415 — isolated per recipient, reusing
 * the Outbound Coordinator's own restart-safe idempotency gate).
 */

import { MembershipFedosConversationParticipantResolver } from "../../../conversations/encryption/identity/fedos_conversation_participant_resolver.js";
import type { FedosConversationMembershipAuthority } from "../../../conversations/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationIdentityResolver } from "../../../conversations/encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosGroupMessagePersistence } from "../../../conversations/group/fedos_group_message.js";
import type { FedosGroupFanoutDeliveryPersistence } from "../../../conversations/group/fedos_group_fanout_delivery.js";
import type { FedosGroupDirectPathPersistence } from "../../../conversations/group/fedos_group_direct_path.js";
import {
  FedosPrivateNostrOutboundDeliveryCoordinator,
  type FedosPrivateNostrOutboundDeliveryOptions,
  type FedosPrivateNostrOutboundDeliveryResult,
} from "./fedos_private_nostr_outbound_delivery_coordinator.js";
import type { FedosConversationId } from "../../../conversations/fedos_conversation_id.js";

export interface FedosPrivateNostrGroupDeliveryRecipientResult {
  readonly recipientMembershipId: string;
  readonly directConversationId: string;
  readonly result: FedosPrivateNostrOutboundDeliveryResult;
}

export type FedosPrivateNostrGroupDeliveryResult =
  | { readonly outcome: "planned"; readonly perRecipient: readonly FedosPrivateNostrGroupDeliveryRecipientResult[] }
  | { readonly outcome: "group-message-not-found" }
  | { readonly outcome: "no-stored-deliveries" };

export interface FedosPrivateNostrGroupDeliveryPlannerDependencies {
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly groupMessagePersistence: FedosGroupMessagePersistence;
  readonly groupFanoutDeliveryPersistence: FedosGroupFanoutDeliveryPersistence;
  readonly groupDirectPathPersistence: FedosGroupDirectPathPersistence;
  readonly outboundCoordinator: FedosPrivateNostrOutboundDeliveryCoordinator;
}

export class FedosPrivateNostrGroupDeliveryPlanner {
  readonly #deps: FedosPrivateNostrGroupDeliveryPlannerDependencies;

  constructor(deps: FedosPrivateNostrGroupDeliveryPlannerDependencies) {
    this.#deps = deps;
  }

  async deliverGroupMessage(
    groupMessageId: string,
    options: Omit<FedosPrivateNostrOutboundDeliveryOptions, "recipientMembershipId" | "groupLinkage">,
  ): Promise<FedosPrivateNostrGroupDeliveryResult> {
    const message = this.#deps.groupMessagePersistence.getMessage(groupMessageId);
    if (message === null) return { outcome: "group-message-not-found" };

    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "no-stored-deliveries" };
    const localParticipant = identity.creator;
    const participantResolver = new MembershipFedosConversationParticipantResolver(this.#deps.membershipAuthority);

    const deliveries = this.#deps.groupFanoutDeliveryPersistence.listDeliveriesForMessage(groupMessageId);
    const storedDeliveries = deliveries.filter((d) => d.state === "stored" && d.envelopeId !== null);
    if (storedDeliveries.length === 0) return { outcome: "no-stored-deliveries" };

    const perRecipient: FedosPrivateNostrGroupDeliveryRecipientResult[] = [];
    for (const delivery of storedDeliveries) {
      const path = this.#deps.groupDirectPathPersistence.getPath(delivery.pathId);
      if (path === null || path.state !== "ready") continue;

      const directConversationId = path.directConversationId as FedosConversationId;
      const resolution = participantResolver.resolveCounterparty(directConversationId, localParticipant);
      if (resolution.outcome !== "resolved") continue;

      const result = await this.#deps.outboundCoordinator.deliverEnvelope(directConversationId, delivery.envelopeId as string, {
        recipientMembershipId: resolution.counterparty.id as unknown as string,
        relayUrls: options.relayUrls,
        mode: options.mode,
        expiresAt: options.expiresAt,
        groupLinkage: { senderGroupMessageId: message.id, replyToGroupMessageId: message.replyToGroupMessageId },
      });
      perRecipient.push({
        recipientMembershipId: delivery.recipientMembershipId,
        directConversationId,
        result,
      });
    }

    if (perRecipient.length === 0) return { outcome: "no-stored-deliveries" };
    return { outcome: "planned", perRecipient };
  }
}
