/**
 * OS Capability Modularization — `MessagingPort` adapter.
 *
 * Implements `MessagingPort` (`../../core/ports/messaging_port.js`, owned by
 * a concurrent agent in this same arc) by delegating to the real, unmoved
 * `FedosConversationDirectMessagingCoordinator`
 * (`../../../conversation/messaging/fedos_conversation_direct_messaging_coordinator.js`).
 * This file adds no new send/receive logic of its own — every decision
 * about encryption, membership, activation, retention, and delivery route
 * selection stays exactly where it already lives, inside that coordinator
 * and everything it composes over. This adapter's entire job is translating
 * between the Port's protocol-neutral shape and the coordinator's own
 * command/result shapes.
 *
 * This adapter takes an ALREADY-CONSTRUCTED coordinator instance rather
 * than assembling one itself — wiring the coordinator's own
 * `FedosConversationDirectMessagingCoordinatorDependencies` (draft/
 * activation/envelope persistence, membership authority, identity resolver,
 * retention authority, encryption/decryption coordinators, and the
 * optional delivery/ratchetDelivery routes) is the composition root's job
 * (today: `src/desktop/runtime/`), not this Port seam's job. Once the
 * physical migration lands, that composition root moves too and continues
 * to construct the same coordinator the same way; only the import path
 * changes.
 *
 * `MessagingPort.onMessage` is a PUSH subscription. Nothing in the current,
 * unmoved messenger code exposes a push-based "a message arrived" observer
 * to delegate to automatically: inbound Nostr delivery is pull/dispatch —
 * `FedosPrivateNostrInboundDeliveryCoordinator.receivePrivateEvent()`
 * (`../../../conversation/delivery/nostr/fedos_private_nostr_inbound_delivery_coordinator.js`)
 * is called once per already-validated inbound event by whatever
 * polls/subscribes the relay; it has no listener registry of its own to
 * hook into. This adapter is therefore honest about the gap: it maintains
 * its own listener registry and exposes `dispatchInbound()` (NOT part of
 * `MessagingPort`) as the seam a future caller uses to feed a real inbound
 * import into every registered handler, once one exists. Until that wiring
 * is built (a later arc's job, once the physical move happens and a real
 * relay-subscription composition point exists), `onMessage` genuinely
 * registers handlers, but nothing yet calls them.
 */

import type {
  ConversationId,
  InboundMessage,
  MessageHandler,
  MessagePayload,
  MessagingPort,
  SendResult,
  Unsubscribe,
} from "../../core/ports/messaging_port.js";
import type { FedosConversationDirectMessagingCoordinator } from "../../../conversation/messaging/fedos_conversation_direct_messaging_coordinator.js";

export class FedosMessengerMessagingPortAdapter implements MessagingPort {
  readonly #coordinator: FedosConversationDirectMessagingCoordinator;
  readonly #handlers = new Set<MessageHandler>();

  constructor(coordinator: FedosConversationDirectMessagingCoordinator) {
    this.#coordinator = coordinator;
  }

  /** Delegates to `sendDirectMessage()`. Never throws — every branch of the coordinator's own closed outcome set maps to a `SendResult`. */
  async send(conversationId: ConversationId, payload: MessagePayload): Promise<SendResult> {
    if (typeof conversationId !== "string" || conversationId.length === 0) {
      return { delivered: false, reason: "invalid-conversation-id" };
    }
    if (payload === null || typeof payload !== "object" || typeof payload.text !== "string") {
      return { delivered: false, reason: "invalid-payload" };
    }
    const result = await this.#coordinator.sendDirectMessage({
      conversationId,
      body: payload.text,
      replyToEnvelopeId: null,
    });
    if (result.outcome === "sent-locally") {
      return { delivered: true, messageId: result.envelopeId };
    }
    return { delivered: false, reason: result.outcome };
  }

  /** Registers a handler for `dispatchInbound()` below. See this file's own header for why this is not yet wired to a live subscription. */
  onMessage(handler: MessageHandler): Unsubscribe {
    this.#handlers.add(handler);
    return () => {
      this.#handlers.delete(handler);
    };
  }

  /**
   * NOT part of `MessagingPort`. The integration seam a future inbound
   * subscription (built once the physical migration lands) calls once per
   * newly-imported message, so every handler registered via `onMessage`
   * observes it. Exposed as a plain public method rather than kept
   * private specifically so that future wiring point can reach it.
   */
  dispatchInbound(message: InboundMessage): void {
    for (const handler of this.#handlers) handler(message);
  }
}
