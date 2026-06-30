/**
 * Stage 16 — chat / DM model (types only).
 *
 * Models LINE/Telegram-style conversations on top of the existing Nostr + space
 * layers: one-to-one DMs, group chats, and channel-like broadcast chats. As with
 * Stage 9 spaces, everything here is data; the decisions live in `policy.ts` as
 * pure functions over these shapes. No sending, no encryption, no key material.
 *
 * Encrypted DMs (NIP-04 / NIP-44) are explicitly OUT OF SCOPE for this stage —
 * `ChatMessage.content` is whatever plaintext the caller already holds; this
 * layer neither encrypts nor decrypts. Participation is expressed as pubkey
 * lists; signature verification is a separate concern (Stage 8).
 */

import type { NostrEvent } from "../nostr/types.js";

/** A chat is either a DM thread or a (multi-party) group chat. */
export type ChatKind = "dm" | "group";

/**
 * - public:  readable by anyone.
 * - private: readable by participants (and admins) only.
 */
export type ChatVisibility = "public" | "private";

/** Minimum standing required to post into a chat. */
export type ChatPostPolicy =
  | "open" // anyone, including guests
  | "participants" // participants of the chat (e.g. DM members)
  | "members" // chat/space members (participants)
  | "admins"; // owners/admins only (channel-like broadcast)

/** Fields shared by every chat type. */
export interface ChatBase {
  readonly id: string;
  readonly kind: ChatKind;
  readonly visibility: ChatVisibility;
  readonly postPolicy: ChatPostPolicy;
  /** Pubkeys that take part in this chat (members of a DM/group). */
  readonly participants: readonly string[];
  /** Elevated pubkeys (owners/admins) for the `admins` post policy. */
  readonly admins: readonly string[];
  /** Optional link back to the Stage 9 space this chat was opened from. */
  readonly spaceId?: string;
}

/** One-to-one (or small, fixed) private conversation. */
export interface DMThread extends ChatBase {
  readonly kind: "dm";
}

/**
 * Multi-party chat. A plain group uses `participants`/`members`; a channel-like
 * broadcast group uses the `admins` post policy so only owners/admins can post.
 */
export interface GroupChat extends ChatBase {
  readonly kind: "group";
}

/** Any chat. Discriminated by `kind`. */
export type ChatRoom = DMThread | GroupChat;

/**
 * A chat message projected from a Nostr event. NOTE: `content` is plaintext as
 * supplied — this stage performs no NIP-04/NIP-44 decryption.
 */
export interface ChatMessage {
  /** Source event id. */
  readonly id: string;
  /** Chat this message belongs to. */
  readonly chatId: string;
  readonly authorPubkey: string;
  /** Unix timestamp in seconds (from the source event). */
  readonly createdAt: number;
  readonly content: string;
  /** The originating event, for callers that need the full wire shape. */
  readonly event: NostrEvent;
}

/** Result of a chat permission check: the answer plus a human-readable reason. */
export interface ChatDecision {
  readonly allowed: boolean;
  readonly reason: string;
}
