/**
 * OS Capability Modularization — `MessagingPort` (widened).
 *
 * Factory/Port Completion pass (Architecture Dependency Closure +
 * Ports/Factories Completion + OSS Catalog Completion arc): widens the
 * original send/receive-only seam per
 * `docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md`'s gap analysis,
 * measured against the real
 * `FedosConversationDirectMessagingCoordinator`
 * (`src/os/messenger/conversations/messaging/fedos_conversation_direct_messaging_coordinator.ts`,
 * `sendDirectMessage`/`readDirectMessage`/`listDirectMessages`).
 *
 * Interface segregation: rather than one growing "God" interface, the
 * seam is split into three narrow capabilities —
 * `MessageSendPort` (write), `MessageHistoryPort` (read/list),
 * `MessageInboundPort` (push subscription) — composed back into the
 * `MessagingPort` name below for every existing consumer/adapter that
 * wants the full surface. A future consumer that only needs to read
 * history, or only needs to send, can depend on the narrower interface
 * instead.
 *
 * Still protocol-neutral: no wire format (Nostr, Matrix, XMPP, ...), no
 * transport, and no FedOS messenger-internal type crosses this file.
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
 *
 * NOTE: an earlier draft of this Port carried a speculative
 * `attachments?: readonly unknown[]` field. It was removed rather than kept
 * "aspirational" — no attachment concept exists anywhere in the real
 * coordinator this Port is modeled against (verified: zero references
 * repo-wide), and this Port's own discipline is to name only what real code
 * does. Reintroduce it only once a real coordinator-side attachment
 * concept exists to model it against.
 */
export interface MessagePayload {
  /** Human-readable body text. */
  readonly text: string;
  /**
   * Threads this send under an existing message, mirroring the real
   * coordinator's `replyToEnvelopeId` command field. `null`/omitted means
   * "not a reply" — the real coordinator's own default.
   */
  readonly replyToMessageId?: MessageId | null;
}

/**
 * The real coordinator's closed `sendDirectMessage()` failure outcome set,
 * minus its one success token (`sent-locally`, represented instead by
 * `SendResult`'s `delivered: true` branch). Every branch here is a REAL
 * outcome the coordinator returns — this Port invents no new failure code
 * of its own; an adapter-level input-validation failure (e.g. a malformed
 * `conversationId`) maps to `"invalid-input"`, the same token the real
 * coordinator itself uses for its own command-shape validation.
 */
export type MessageSendFailureReason =
  | "invalid-input"
  | "conversation-not-found"
  | "conversation-not-active"
  | "identity-unavailable"
  | "unauthorized"
  | "encryption-unavailable"
  | "persistence-failed"
  | "failed";

/**
 * Outcome of a `send` attempt. A discriminated union, not a stringly-typed
 * `reason?: string` — a caller can `switch` on `result.reason` and the
 * compiler enforces exhaustiveness. Failures are reported here, never
 * thrown.
 *
 * NOTE ON FORWARD SECRECY: the real coordinator's `sent-locally` outcome
 * MAY additionally carry a `forwardSecrecy` descriptor (Conversation
 * Forward Secrecy Phase 1, reporting-only — see
 * `fedos_direct_conversation_forward_secrecy_route.ts`). That descriptor is
 * deliberately NOT represented on this Port yet: it is Messenger-internal
 * route-reporting detail, not a portable, protocol-neutral concept, and
 * surfacing it here would leak a Nostr/ratchet-shaped concern into a Port
 * that must stay meaningful for a hypothetical non-Nostr transport. A
 * caller that needs forward-secrecy visibility today reads it directly off
 * the concrete coordinator, not through this Port.
 */
export type SendResult =
  | { readonly delivered: true; readonly messageId: MessageId }
  | { readonly delivered: false; readonly reason: MessageSendFailureReason };

/**
 * The real coordinator's closed `readDirectMessage()` failure outcome set,
 * minus its one success token (`decrypted`, represented instead by
 * `MessageReadResult`'s `ok: true` branch).
 */
export type MessageReadFailureReason =
  | "invalid-envelope"
  | "not-found"
  | "conversation-not-active"
  | "payload-unavailable"
  | "unauthorized"
  | "key-unavailable"
  | "tombstoned"
  | "failed";

/** Outcome of a `read` attempt. Discriminated union; failures are reported here, never thrown. */
export type MessageReadResult =
  | { readonly ok: true; readonly plaintext: Uint8Array }
  | { readonly ok: false; readonly reason: MessageReadFailureReason };

/** Coarse retention state of a message, mirroring the real coordinator's `listDirectMessages()` summary. */
export type MessageRetentionState = "active" | "tombstoned" | "payload-removed";

/** Safe, non-decrypting metadata for one message — what `list()` returns. Never carries plaintext. */
export interface MessageSummary {
  readonly conversationId: ConversationId;
  readonly messageId: MessageId;
  /** Milliseconds since epoch, when known. */
  readonly createdAtMs?: number;
  readonly replyToMessageId?: MessageId | null;
  /** Omitted when the adapter cannot determine retention state. */
  readonly retentionState?: MessageRetentionState;
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

/** Write-only half of the messaging seam. */
export interface MessageSendPort {
  /** Send a message into an existing conversation. Never throws. */
  send(conversationId: ConversationId, payload: MessagePayload): Promise<SendResult>;
}

/**
 * Read-only half of the messaging seam — mirrors the real coordinator's
 * `readDirectMessage()`/`listDirectMessages()`, absent from the Port before
 * this pass. A consumer that only ever needs history (e.g. a Commerce-side
 * order-conversation viewer) can depend on this narrower interface alone.
 */
export interface MessageHistoryPort {
  /** Fetch and decrypt one message. Never throws. */
  read(conversationId: ConversationId, messageId: MessageId): Promise<MessageReadResult>;
  /** Safe metadata only for every message in a conversation; never decrypts. `[]` for an unknown/inactive conversation. Never throws. */
  list(conversationId: ConversationId): Promise<readonly MessageSummary[]>;
}

/** Push-subscription half of the messaging seam. */
export interface MessageInboundPort {
  /** Subscribe to inbound messages. Returns a function to unsubscribe. */
  onMessage(handler: MessageHandler): Unsubscribe;
}

/**
 * The full messaging seam — the union of the three narrower interfaces
 * above, kept as one name for every existing consumer/adapter that wants
 * the whole surface. An adapter implementing this port owns the actual
 * protocol/transport; `os/core` and `os/commerce` depend only on this
 * shape.
 */
export interface MessagingPort extends MessageSendPort, MessageHistoryPort, MessageInboundPort {}
