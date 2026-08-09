/**
 * Secure Runtime Alpha 1362/1366 ("History Semantics" / "Read Model") —
 * Phase D/E of the Alpha 1321–1390 Private Group Pairwise Fanout
 * Foundation Arc.
 *
 * Safe metadata only — never decrypts any recipient's own copy. The
 * SENDER's own local canonical `FedosGroupMessageRecord` log is the
 * display source (Alpha 1366) — this facade never reaches into a
 * recipient's own Direct Conversation to reconstruct a group view.
 */

import type { FedosConversationId } from "../../../../conversation/fedos_conversation_id.js";
import type { FedosGroupGenerationPersistence, FedosGroupGenerationRecord } from "../../../../conversation/group/fedos_group_generation.js";
import type { FedosGroupMessagePersistence } from "../../../../conversation/group/fedos_group_message.js";
import type { FedosGroupFanoutDeliveryPersistence } from "../../../../conversation/group/fedos_group_fanout_delivery.js";

export interface FedosGroupMessageSummary {
  readonly id: string;
  readonly senderMembershipId: string;
  readonly createdAt: number;
  readonly replyToGroupMessageId: string | null;
  readonly generationId: string;
  readonly fanoutSummary: { readonly recipientCount: number; readonly storedCount: number; readonly failedCount: number };
}

export interface FedosGroupReadFacadeDependencies {
  readonly generationPersistence: FedosGroupGenerationPersistence;
  readonly messagePersistence: FedosGroupMessagePersistence;
  readonly deliveryPersistence: FedosGroupFanoutDeliveryPersistence;
}

export class FedosGroupReadFacade {
  readonly #deps: FedosGroupReadFacadeDependencies;

  constructor(deps: FedosGroupReadFacadeDependencies) {
    this.#deps = deps;
  }

  listGenerations(groupConversationId: FedosConversationId): readonly FedosGroupGenerationRecord[] {
    return this.#deps.generationPersistence.listGenerations(groupConversationId);
  }

  /** `createdAt` ascending, id tie-break — LOCAL ordering only, mirrors `listDirectMessages()` exactly (Alpha 1133/1352). Never a global/cross-participant order. */
  listMessages(groupConversationId: FedosConversationId): readonly FedosGroupMessageSummary[] {
    return this.#deps.messagePersistence.listMessagesForGroup(groupConversationId).map((message) => {
      const deliveries = this.#deps.deliveryPersistence.listDeliveriesForMessage(message.id);
      const storedCount = deliveries.filter((d) => d.state === "stored").length;
      const failedCount = deliveries.filter((d) => d.state === "failed").length;
      return Object.freeze({
        id: message.id,
        senderMembershipId: message.senderMembershipId,
        createdAt: message.createdAt,
        replyToGroupMessageId: message.replyToGroupMessageId,
        generationId: message.generationId,
        fanoutSummary: Object.freeze({ recipientCount: message.recipientCount, storedCount, failedCount }),
      });
    });
  }
}
