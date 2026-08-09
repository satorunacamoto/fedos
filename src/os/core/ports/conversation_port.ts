/**
 * OS Capability Modularization — `ConversationPort`.
 *
 * A minimal, protocol-neutral seam for creating/resolving a conversation
 * with a counterparty and listing its participants. Deliberately generic —
 * no messenger-internal type (no Nostr event shape, no ratchet/session
 * state, no FedOS `Conversation` record).
 *
 * This file is an INTERFACE ONLY. It must never import from `src/conversation`,
 * `src/os/messenger`, or any other messenger-specific module — a future
 * Messenger package provides the adapter that implements this port.
 */

/** Opaque identifier for a conversation. */
export type ConversationId = string;

/**
 * Opaque identifier for a counterparty. Intentionally not typed as any
 * specific identity/pubkey shape — that belongs to a concrete adapter.
 */
export type CounterpartyRef = string;

/** A conversation as observed through this port. */
export interface ConversationDescriptor {
  readonly conversationId: ConversationId;
  /** Participant references, including the local party. */
  readonly participants: readonly CounterpartyRef[];
}

/** Outcome of a create/resolve attempt. Failures are reported here, not thrown. */
export interface ConversationResult {
  readonly ok: boolean;
  readonly conversation?: ConversationDescriptor;
  /** Non-sensitive, human-readable explanation (e.g. on failure). */
  readonly reason?: string;
}

/**
 * The conversation seam. An adapter implementing this port owns the actual
 * conversation-creation/session logic; `os/core` and `os/commerce` depend
 * only on this shape.
 */
export interface ConversationPort {
  /**
   * Create a new conversation with the given counterparty, or resolve to an
   * existing one if the adapter considers one to already exist.
   */
  createOrResolve(counterparty: CounterpartyRef): Promise<ConversationResult>;
  /** List the participants of an existing conversation. Never throws. */
  listParticipants(conversationId: ConversationId): Promise<readonly CounterpartyRef[]>;
}
