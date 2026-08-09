/**
 * OS Capability Modularization — `MessagingPort`.
 *
 * A minimal, protocol-neutral seam for sending and receiving a single
 * message. This interface is defined against what ANY generic consumer of
 * "send/receive a message" would need — it names no wire format (Nostr,
 * Matrix, XMPP, ...), no transport, and no FedOS messenger-internal type.
 *
 * This file is an INTERFACE ONLY. It must never import from `src/conversation`,
 * `src/os/messenger`, or any other messenger-specific module — a future
 * Messenger package provides the adapter that implements this port.
 */

/** Opaque identifier for a conversation/thread the message belongs to. */
export type ConversationId = string;

/** Opaque identifier for a single message once it has been assigned one. */
export type MessageId = string;

/**
 * The portable content of an outbound message. Kept to primitive/portable
 * types only — no protocol-specific envelope, tag, or wrapper shape.
 */
export interface MessagePayload {
  /** Human-readable body text. */
  readonly text: string;
  /** Optional structured attachments, kept opaque to this port. */
  readonly attachments?: readonly unknown[];
}

/** Outcome of a `send` attempt. Failures are reported here, not thrown. */
export interface SendResult {
  readonly delivered: boolean;
  /** The id assigned to the message, if one was assigned. */
  readonly messageId?: MessageId;
  /** Non-sensitive, human-readable explanation (e.g. on failure). */
  readonly reason?: string;
}

/** A message as observed by an inbound handler. */
export interface InboundMessage {
  readonly conversationId: ConversationId;
  readonly messageId: MessageId;
  readonly payload: MessagePayload;
  /** Milliseconds since epoch, when known. */
  readonly receivedAtMs?: number;
}

/** A handler registered via `onMessage`. */
export type MessageHandler = (message: InboundMessage) => void;

/** Call to stop receiving further messages from a prior `onMessage` call. */
export type Unsubscribe = () => void;

/**
 * The messaging seam. An adapter implementing this port owns the actual
 * protocol/transport; `os/core` and `os/commerce` depend only on this shape.
 */
export interface MessagingPort {
  /** Send a message into an existing conversation. Never throws. */
  send(conversationId: ConversationId, payload: MessagePayload): Promise<SendResult>;
  /** Subscribe to inbound messages. Returns a function to unsubscribe. */
  onMessage(handler: MessageHandler): Unsubscribe;
}
