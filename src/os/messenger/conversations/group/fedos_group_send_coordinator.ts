/**
 * Secure Runtime Alpha 1341–1354 ("Canonical Group Message Identity"
 * through "Phase C Verification") — Phase C of the Alpha 1321–1390
 * Private Group Pairwise Fanout Foundation Arc.
 *
 * `sendGroupMessage()` — the ONE operation that fans a single logical
 * plaintext out into N independent, pairwise-encrypted Envelopes, one
 * per active OTHER group member, reusing the EXISTING, unmodified
 * `FedosConversationDirectMessagingCoordinator.sendDirectMessage()`
 * (Alpha 1126) once per recipient. This file invokes no crypto directly
 * (Alpha 1349) — every encryption decision belongs to that frozen
 * facade and, beneath it, the frozen Encryption Coordinator.
 *
 * ALL-OR-NOTHING FOR A FRESH SEND (Alpha 1345, Option A): every
 * recipient's own Direct path must already be `"ready"` before ANY
 * durable Group Message write happens — `preparePath()` is called for
 * each recipient first (lazily, per
 * `docs/reviews/private_group_pairwise_fanout/06_conversation_generation_boundaries.md`'s
 * own "lazily, on first need" finding), and a single not-ready path
 * fails the whole send closed with NO write at all.
 *
 * RECOVERY (Alpha 1350): `sendDirectMessage()`'s own public command
 * surface exposes no idempotency key of its own, so a bare retry of it
 * is NOT safe to call blindly after a crash. This coordinator's OWN
 * Fanout Delivery log is therefore the idempotency mechanism — before
 * calling `sendDirectMessage()` for a given recipient, it checks whether
 * a `"stored"` delivery fact already exists for that (Group Message,
 * recipient) pair and skips the call entirely if so, mirroring this
 * codebase's own "read how far a prior attempt got, only move forward"
 * discipline (Alpha 845 lineage) at the one boundary where it is not
 * already provided for free.
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosConversationMembershipAuthority } from "../../../../conversation/membership/fedos_conversation_membership_authority.js";
import type { FedosConversationParticipantReference } from "../../../../conversation/membership/fedos_conversation_participant_reference.js";
import { toFedosConversationMembershipId } from "../../../../conversation/membership/fedos_conversation_membership_id.js";
import type { FedosConversationIdentityResolver } from "../../../../conversation/encryption/identity/fedos_conversation_identity_resolver.js";
import type { FedosConversationDirectMessagingCoordinator } from "../../../../conversation/messaging/fedos_conversation_direct_messaging_coordinator.js";
import { validateFedosConversationDirectMessageBody } from "../../../../conversation/messaging/fedos_conversation_direct_message_plaintext_policy.js";
import type { FedosGroupGenerationPersistence } from "../../../../conversation/group/fedos_group_generation.js";
import { toFedosGroupDirectPathId, type FedosGroupDirectPathPersistence } from "../../../../conversation/group/fedos_group_direct_path.js";
import type { FedosGroupDirectPathAuthority } from "../../../../conversation/group/fedos_group_direct_path_authority.js";
import {
  toFedosGroupMessageId,
  type FedosGroupMessagePersistence,
  type FedosGroupMessageRecord,
} from "../../../../conversation/group/fedos_group_message.js";
import type { FedosGroupFanoutDeliveryPersistence } from "../../../../conversation/group/fedos_group_fanout_delivery.js";

export interface FedosGroupSendMessageCommand {
  readonly groupConversationId: string;
  readonly body: string;
  readonly replyToGroupMessageId: string | null;
  readonly idempotencyKey?: string;
}

export type FedosGroupSendResult =
  | { readonly outcome: "stored-for-all"; readonly groupMessageId: string; readonly recipientEnvelopeIds: readonly string[] }
  | { readonly outcome: "invalid-input" }
  | { readonly outcome: "group-not-usable" }
  | { readonly outcome: "sender-unauthorized" }
  | { readonly outcome: "recipient-path-unavailable" }
  | { readonly outcome: "fanout-failed" }
  | { readonly outcome: "partial-write"; readonly groupMessageId: string; readonly recipientEnvelopeIds: readonly string[] }
  | { readonly outcome: "persistence-failed" };

export interface FedosGroupSendCoordinatorDependencies {
  readonly membershipAuthority: FedosConversationMembershipAuthority;
  readonly identityResolver: FedosConversationIdentityResolver;
  readonly generationPersistence: FedosGroupGenerationPersistence;
  readonly pathPersistence: FedosGroupDirectPathPersistence;
  readonly pathAuthority: FedosGroupDirectPathAuthority;
  readonly messagePersistence: FedosGroupMessagePersistence;
  readonly deliveryPersistence: FedosGroupFanoutDeliveryPersistence;
  readonly directMessagingCoordinator: FedosConversationDirectMessagingCoordinator;
  readonly idempotencyKeyGenerator: { generateIdempotencyKey(): string };
  readonly clock: () => number;
}

const IDEMPOTENCY_KEY_MAX_LENGTH = 256;

function isSafeIdempotencyKey(value: string): boolean {
  return value.length > 0 && value.length <= IDEMPOTENCY_KEY_MAX_LENGTH && !value.includes("::");
}

export class FedosGroupSendCoordinator {
  readonly #deps: FedosGroupSendCoordinatorDependencies;

  constructor(deps: FedosGroupSendCoordinatorDependencies) {
    this.#deps = deps;
  }

  async sendGroupMessage(command: FedosGroupSendMessageCommand): Promise<FedosGroupSendResult> {
    if (command === null || typeof command !== "object") return { outcome: "invalid-input" };
    if (typeof command.groupConversationId !== "string" || command.groupConversationId.length === 0) return { outcome: "invalid-input" };
    const body = validateFedosConversationDirectMessageBody(command.body);
    if (body === null) return { outcome: "invalid-input" };
    if (
      command.replyToGroupMessageId !== null &&
      (typeof command.replyToGroupMessageId !== "string" || command.replyToGroupMessageId.length === 0)
    ) {
      return { outcome: "invalid-input" };
    }
    if (command.idempotencyKey !== undefined && (typeof command.idempotencyKey !== "string" || !isSafeIdempotencyKey(command.idempotencyKey))) {
      return { outcome: "invalid-input" };
    }

    const groupConversationId = command.groupConversationId as FedosConversationId;
    const generation = this.#deps.generationPersistence.currentGenerationForGroup(groupConversationId);
    if (generation === null) return { outcome: "group-not-usable" };

    const identity = this.#deps.identityResolver.resolveLocalParticipant();
    if (identity.outcome === "unavailable") return { outcome: "sender-unauthorized" };
    const localParticipant = identity.creator;
    const localMembership = this.#deps.membershipAuthority.findMembership(groupConversationId, localParticipant);
    if (localMembership === null || localMembership.state !== "active") return { outcome: "sender-unauthorized" };
    const localMembershipId = localMembership.id as string;

    const recipientIds = generation.activeMemberMembershipIds.filter((id) => id !== localMembershipId);
    if (recipientIds.length === 0) return { outcome: "group-not-usable" };

    const allMembers = this.#deps.membershipAuthority.listMemberships(groupConversationId);
    const recipients: FedosConversationParticipantReference[] = [];
    for (const recipientId of recipientIds) {
      const membership = allMembers.find((m) => (m.id as string) === recipientId);
      if (membership === undefined) return { outcome: "group-not-usable" };
      recipients.push(membership.participant);
    }

    // Option A (Alpha 1345) — every path must be ready BEFORE any durable write.
    const now = this.#deps.clock();
    for (const recipient of recipients) {
      const prepared = await this.#deps.pathAuthority.preparePath(groupConversationId, generation.generationId, localParticipant, recipient, now);
      if (prepared.outcome !== "ready") return { outcome: "recipient-path-unavailable" };
    }

    const idempotencyKey = command.idempotencyKey ?? this.#deps.idempotencyKeyGenerator.generateIdempotencyKey();
    if (!isSafeIdempotencyKey(idempotencyKey)) return { outcome: "invalid-input" };
    const groupMessageId = toFedosGroupMessageId(groupConversationId, idempotencyKey);

    const existingMessage = this.#deps.messagePersistence.getMessage(groupMessageId);
    if (existingMessage !== null && existingMessage.fanoutState === "complete") {
      return this.#reReadSuccess(groupMessageId, existingMessage);
    }

    if (existingMessage === null) {
      const planned: FedosGroupMessageRecord = {
        id: groupMessageId,
        groupConversationId,
        generationId: generation.generationId,
        senderMembershipId: localMembershipId,
        createdAt: now,
        replyToGroupMessageId: command.replyToGroupMessageId,
        recipientCount: recipientIds.length,
        fanoutState: "planned",
      };
      const write = this.#deps.messagePersistence.putMessageFact(planned);
      if (write === "failed" || write === "conflict") return { outcome: "persistence-failed" };
    }

    const envelopeIds: string[] = [];
    let anyFailed = false;
    for (const recipientId of recipientIds) {
      const existingDelivery = this.#deps.deliveryPersistence.getDelivery(groupMessageId, recipientId);
      if (existingDelivery !== null && existingDelivery.state === "stored" && existingDelivery.envelopeId !== null) {
        envelopeIds.push(existingDelivery.envelopeId);
        continue;
      }
      const path = this.#deps.pathPersistence.getPath(
        this.#pathIdFor(groupConversationId, generation.generationId, localMembershipId, recipientId),
      );
      if (path === null || path.state !== "ready") {
        anyFailed = true;
        this.#deps.deliveryPersistence.putDeliveryFact({
          groupMessageId,
          recipientMembershipId: recipientId,
          pathId: this.#pathIdFor(groupConversationId, generation.generationId, localMembershipId, recipientId),
          envelopeId: null,
          state: "failed",
          createdAt: now,
        });
        continue;
      }
      const sendResult = await this.#deps.directMessagingCoordinator.sendDirectMessage({
        conversationId: path.directConversationId,
        body,
        replyToEnvelopeId: null,
      });
      if (sendResult.outcome === "sent-locally") {
        envelopeIds.push(sendResult.envelopeId);
        this.#deps.deliveryPersistence.putDeliveryFact({
          groupMessageId,
          recipientMembershipId: recipientId,
          pathId: path.pathId,
          envelopeId: sendResult.envelopeId,
          state: "stored",
          createdAt: now,
        });
      } else {
        anyFailed = true;
        this.#deps.deliveryPersistence.putDeliveryFact({
          groupMessageId,
          recipientMembershipId: recipientId,
          pathId: path.pathId,
          envelopeId: null,
          state: "failed",
          createdAt: now,
        });
      }
    }

    if (!anyFailed) {
      this.#deps.messagePersistence.putMessageFact({
        id: groupMessageId,
        groupConversationId,
        generationId: generation.generationId,
        senderMembershipId: localMembershipId,
        createdAt: now,
        replyToGroupMessageId: command.replyToGroupMessageId,
        recipientCount: recipientIds.length,
        fanoutState: "complete",
      });
      return { outcome: "stored-for-all", groupMessageId, recipientEnvelopeIds: envelopeIds };
    }

    this.#deps.messagePersistence.putMessageFact({
      id: groupMessageId,
      groupConversationId,
      generationId: generation.generationId,
      senderMembershipId: localMembershipId,
      createdAt: now,
      replyToGroupMessageId: command.replyToGroupMessageId,
      recipientCount: recipientIds.length,
      fanoutState: "failed",
    });
    return envelopeIds.length > 0
      ? { outcome: "partial-write", groupMessageId, recipientEnvelopeIds: envelopeIds }
      : { outcome: "fanout-failed" };
  }

  #reReadSuccess(groupMessageId: string, message: FedosGroupMessageRecord): FedosGroupSendResult {
    const deliveries = this.#deps.deliveryPersistence.listDeliveriesForMessage(groupMessageId);
    const envelopeIds = deliveries
      .filter((d) => d.state === "stored" && d.envelopeId !== null)
      .map((d) => d.envelopeId as string);
    void message;
    return { outcome: "stored-for-all", groupMessageId, recipientEnvelopeIds: envelopeIds };
  }

  #pathIdFor(groupConversationId: string, generationId: string, localMembershipId: string, recipientMembershipId: string): string {
    return toFedosGroupDirectPathId(groupConversationId, generationId, localMembershipId, recipientMembershipId);
  }
}
