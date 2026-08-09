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

import type { NostrEvent } from "../../../nostr/types.js";

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

/**
 * Stage 111 — Chat PROVIDER boundary (types only, additive).
 *
 * A SEPARATE, protocol-neutral seam from the `ChatRoom`/`ChatMessage` model
 * above (Stage 16, already wired to notification/render — that model's
 * `ChatMessage.content` is real plaintext for the existing in-app
 * Reddit-style/LINE-style chat). `ChatProvider` is the FUTURE seam a real
 * DM/chat TRANSPORT (Nostr NIP-04/NIP-17/NIP-44 DMs, or any other protocol)
 * would eventually implement. It defines shapes ONLY: no encryption, no
 * relay/WebSocket call, no `fetch`, and no message content is held.
 *
 * HARD GUARDRAILS:
 *   - NO NIP-04/NIP-44/NIP-17 implementation and NO encrypted-chat
 *     implementation of any kind. `ChatMessageDescriptor` carries OPAQUE
 *     labels ONLY — never `content`, `body`, or raw bytes. This is a
 *     DIFFERENT, narrower shape than `ChatMessage` above on purpose.
 *   - `sendPlaceholder`/`fetchPlaceholder` evaluate a decision ONLY —
 *     nothing is sent/received, and `fetchPlaceholder` always returns an
 *     empty `items` list in this stage.
 *   - This boundary is not wired into `FederationProvider`
 *     (`src/federation/`), `StorageBackend` (`src/storage/`), any
 *     `CryptoProvider` (`src/crypto/`), the Runtime beyond selecting
 *     `NoopChatProvider`, or the Worker.
 */

/** Which future chat/DM shape a message/request names — a label of intent only. */
export type ChatProviderKind =
  | "direct_placeholder"
  | "group_placeholder"
  | "community_placeholder"
  | "support_placeholder"
  | "test_placeholder";

/** Coarse observable state of a chat-provider operation. No content is exposed at any state. */
export type ChatProviderState =
  | "unavailable" // no chat provider is present (the no-op default)
  | "accepted_placeholder" // passed placeholder review; nothing was sent
  | "rejected" // failed placeholder review
  | "error"; // an operation could not be served; recorded, never thrown

/**
 * A non-sensitive description of one message. Carries NO `content`/`body`/
 * bytes field of any kind — only opaque labels and metadata strings.
 */
export interface ChatMessageDescriptor {
  /** OPAQUE label a real provider would resolve to its own message id. */
  readonly idRef?: string;
  /** OPAQUE label a real provider would resolve to its own chat/thread id. */
  readonly chatRef?: string;
  /** OPAQUE label (e.g. a display name) — never a pubkey/DID used for lookup. */
  readonly authorRef?: string;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** The current, non-sensitive status of a chat provider. */
export interface ChatProviderStatus {
  readonly allowed: boolean;
  readonly state: ChatProviderState;
  readonly reason?: string;
}

/** How a caller asks to (eventually) send. `message` carries no content — see the guardrail above. */
export interface ChatSendRequest {
  readonly kind: ChatProviderKind;
  readonly message: ChatMessageDescriptor;
}

/** The result of a `sendPlaceholder` attempt. Never carries a delivery receipt or content. */
export interface ChatSendDecision {
  readonly allowed: boolean;
  readonly state: ChatProviderState;
  readonly reason?: string;
}

/** How a caller asks to (eventually) fetch. `chatRef` is an OPAQUE label — never a relay filter/query. */
export interface ChatFetchRequest {
  readonly kind: ChatProviderKind;
  readonly chatRef?: string;
}

/** The result of a `fetchPlaceholder` attempt. `items` is ALWAYS empty in this stage. */
export interface ChatFetchDecision {
  readonly allowed: boolean;
  readonly state: ChatProviderState;
  readonly reason?: string;
  readonly items: readonly ChatMessageDescriptor[];
}

/**
 * The chat-provider seam. Implementations MUST NOT open a relay/WebSocket
 * connection, issue a `fetch`, run any encryption/decryption (NIP-04/
 * NIP-44/NIP-17 or otherwise), or hold message content. Every method is
 * total and never throws. Constructing an implementation does nothing.
 */
export interface ChatProvider {
  /** Current coarse status (pure read). */
  status(): ChatProviderStatus;
  /** Ask to (eventually) send. Sends NOTHING in this stage. */
  sendPlaceholder(request: ChatSendRequest): Promise<ChatSendDecision>;
  /** Ask to (eventually) fetch. Fetches NOTHING in this stage; `items` is always empty. */
  fetchPlaceholder(request: ChatFetchRequest): Promise<ChatFetchDecision>;
}

/** Every chat-provider-kind label (for mapping/documentation helpers). */
export const CHAT_PROVIDER_KINDS: readonly ChatProviderKind[] = [
  "direct_placeholder",
  "group_placeholder",
  "community_placeholder",
  "support_placeholder",
  "test_placeholder",
];
