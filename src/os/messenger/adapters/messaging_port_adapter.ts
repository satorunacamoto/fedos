/**
 * OS Capability Modularization — `MessagingPort` adapter.
 *
 * Implements the widened `MessagingPort` (`../../core/ports/messaging_port.js`
 * — send/read/list/onMessage, a structured failure-reason union, and
 * `replyToMessageId` support, per the Factory/Port Completion pass; see
 * that file's own header for the full rationale) by delegating to the
 * real, unmoved `FedosConversationDirectMessagingCoordinator`
 * (`../conversations/messaging/fedos_conversation_direct_messaging_coordinator.js`
 * — imported from its CANONICAL post-migration location, not the
 * `src/conversation/messaging/` compatibility shim this file used before
 * this pass). This file adds no new send/receive/read/list logic of its
 * own — every decision about encryption, membership, activation,
 * retention, and delivery route selection stays exactly where it already
 * lives, inside that coordinator and everything it composes over. This
 * adapter's entire job is translating between the Port's protocol-neutral
 * shape and the coordinator's own command/result shapes.
 *
 * This adapter takes an ALREADY-CONSTRUCTED coordinator instance rather
 * than assembling one itself — wiring the coordinator's own
 * `FedosConversationDirectMessagingCoordinatorDependencies` (draft/
 * activation/envelope persistence, membership authority, identity resolver,
 * retention authority, encryption/decryption coordinators, and the
 * optional delivery/ratchetDelivery routes) is the composition root's job
 * (today: `src/desktop/runtime/`), not this Port seam's job.
 *
 * `MessagingPort.onMessage` is a PUSH subscription. Nothing in the current
 * messenger code exposes a push-based "a message arrived" observer to
 * delegate to automatically: inbound Nostr delivery is pull/dispatch —
 * `FedosPrivateNostrInboundDeliveryCoordinator.receivePrivateEvent()`
 * is called once per already-validated inbound event by whatever
 * polls/subscribes the relay; it has no listener registry of its own to
 * hook into. This adapter is therefore honest about the gap: it maintains
 * its own listener registry and exposes `dispatchInbound()` (NOT part of
 * `MessagingPort`) as the seam a future caller uses to feed a real inbound
 * import into every registered handler, once one exists. Until that wiring
 * is built, `onMessage` genuinely registers handlers, but nothing yet calls
 * them.
 */

import type {
  ConversationId,
  MessageHandler,
  MessageId,
  MessageReadFailureReason,
  MessageReadResult,
  MessageSendFailureReason,
  MessagePayload,
  MessagingPort,
  MessageSummary,
  InboundMessage,
  SendResult,
  Unsubscribe,
} from "../../core/ports/messaging_port.js";
import type { FedosConversationDirectMessagingCoordinator } from "../conversations/messaging/fedos_conversation_direct_messaging_coordinator.js";

/** The real coordinator's own send-outcome tokens that this adapter passes through verbatim as `MessageSendFailureReason`s. */
const KNOWN_SEND_FAILURE_REASONS: ReadonlySet<string> = new Set<MessageSendFailureReason>([
  "invalid-input",
  "conversation-not-found",
  "conversation-not-active",
  "identity-unavailable",
  "unauthorized",
  "encryption-unavailable",
  "persistence-failed",
  "failed",
]);

/** The real coordinator's own read-outcome tokens that this adapter passes through verbatim as `MessageReadFailureReason`s. */
const KNOWN_READ_FAILURE_REASONS: ReadonlySet<string> = new Set<MessageReadFailureReason>([
  "invalid-envelope",
  "not-found",
  "conversation-not-active",
  "payload-unavailable",
  "unauthorized",
  "key-unavailable",
  "tombstoned",
  "failed",
]);

function toSendFailureReason(outcome: string): MessageSendFailureReason {
  return KNOWN_SEND_FAILURE_REASONS.has(outcome) ? (outcome as MessageSendFailureReason) : "failed";
}

function toReadFailureReason(outcome: string): MessageReadFailureReason {
  return KNOWN_READ_FAILURE_REASONS.has(outcome) ? (outcome as MessageReadFailureReason) : "failed";
}

export class FedosMessengerMessagingPortAdapter implements MessagingPort {
  readonly #coordinator: FedosConversationDirectMessagingCoordinator;
  readonly #handlers = new Set<MessageHandler>();

  constructor(coordinator: FedosConversationDirectMessagingCoordinator) {
    this.#coordinator = coordinator;
  }

  /** Delegates to `sendDirectMessage()`. Never throws — every branch of the coordinator's own closed outcome set maps to a `SendResult`. */
  async send(conversationId: ConversationId, payload: MessagePayload): Promise<SendResult> {
    if (typeof conversationId !== "string" || conversationId.length === 0) {
      return { delivered: false, reason: "invalid-input" };
    }
    if (payload === null || typeof payload !== "object" || typeof payload.text !== "string") {
      return { delivered: false, reason: "invalid-input" };
    }
    const replyToEnvelopeId = payload.replyToMessageId ?? null;
    const result = await this.#coordinator.sendDirectMessage({
      conversationId,
      body: payload.text,
      replyToEnvelopeId,
    });
    if (result.outcome === "sent-locally") {
      return { delivered: true, messageId: result.envelopeId };
    }
    return { delivered: false, reason: toSendFailureReason(result.outcome) };
  }

  /** Delegates to `readDirectMessage()`. Never throws. */
  async read(conversationId: ConversationId, messageId: MessageId): Promise<MessageReadResult> {
    if (typeof conversationId !== "string" || conversationId.length === 0) {
      return { ok: false, reason: "invalid-envelope" };
    }
    if (typeof messageId !== "string" || messageId.length === 0) {
      return { ok: false, reason: "invalid-envelope" };
    }
    const result = await this.#coordinator.readDirectMessage({ conversationId, envelopeId: messageId });
    if (result.outcome === "decrypted") {
      return { ok: true, plaintext: result.plaintext };
    }
    return { ok: false, reason: toReadFailureReason(result.outcome) };
  }

  /** Delegates to `listDirectMessages()`. Safe metadata only; never decrypts, never throws. */
  async list(conversationId: ConversationId): Promise<readonly MessageSummary[]> {
    if (typeof conversationId !== "string" || conversationId.length === 0) return [];
    const summaries = this.#coordinator.listDirectMessages(conversationId);
    // The real coordinator's `createdAt` is Unix SECONDS
    // (`FedosBoardRuntimeClock`'s own documented unit) — converted to
    // milliseconds here so this Port's `createdAtMs` field name stays
    // truthful about its unit.
    return summaries.map((summary) => ({
      conversationId,
      messageId: summary.envelopeId,
      createdAtMs: summary.createdAt * 1000,
      replyToMessageId: summary.replyToEnvelopeId,
      retentionState: summary.retentionState,
    }));
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
   * subscription (built once a real relay-subscription composition point
   * exists) calls once per newly-imported message, so every handler
   * registered via `onMessage` observes it. Exposed as a plain public
   * method rather than kept private specifically so that future wiring
   * point can reach it.
   */
  dispatchInbound(message: InboundMessage): void {
    for (const handler of this.#handlers) handler(message);
  }
}
