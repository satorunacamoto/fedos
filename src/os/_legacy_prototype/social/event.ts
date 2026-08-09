/**
 * Stage 110 — Social Event Model (labels only).
 *
 * A protocol-neutral SHAPE for "a piece of social activity" (a post, reply,
 * repost, reaction, profile update, article, marketplace listing, chat
 * message, or moderation action), so board/thread rendering can eventually
 * be written against ONE model instead of a specific protocol's event shape
 * (a Nostr `NostrEvent`, a Bluesky/AT-Protocol record, a Threads/ActivityPub
 * post, an RSS item). This file defines a LABEL-ONLY descriptor — it carries
 * no payload.
 *
 * HARD GUARDRAILS:
 *   - NO raw bytes field. NO `content`/`body`/`text` field of any kind. A
 *     `SocialEventDescriptor` is a set of OPAQUE labels/metadata strings —
 *     never the actual post/message text, image, or attachment.
 *   - `id`/`authorRef` are OPAQUE labels a real adapter would resolve on its
 *     own side — never a protocol-specific id/hash, DID, or handle used for
 *     a real lookup.
 *   - This file performs no parsing, no protocol translation, and no
 *     storage/federation call. It is not wired into `FederationProvider`
 *     (`src/federation/`), `StorageBackend` (`src/storage/`), the Runtime,
 *     or the Worker.
 */

/**
 * What kind of social activity this describes — a label of intent only. Not
 * every future protocol will map every kind (e.g. RSS has no `reaction`);
 * this is FedOS's own neutral vocabulary, not a specific protocol's.
 */
export type SocialEventKind =
  | "post"
  | "reply"
  | "repost"
  | "reaction"
  | "profile"
  | "article"
  | "marketplace"
  | "chat"
  | "moderation"
  | "test";

/** How widely this activity is meant to be reachable — a label of intent only. */
export type SocialVisibility = "public" | "followers" | "community" | "private_placeholder";

/**
 * A non-sensitive, protocol-neutral description of one piece of social
 * activity. Carries NO bytes/content/body field of any kind — only opaque
 * labels and metadata strings.
 */
export interface SocialEventDescriptor {
  /** OPAQUE label a real adapter would resolve to its own event id/hash/URI. */
  readonly id?: string;
  readonly kind: SocialEventKind;
  readonly visibility: SocialVisibility;
  /** OPAQUE label (e.g. a display name) — never a pubkey/DID/handle used for lookup. */
  readonly authorRef?: string;
  /** Unix milliseconds. A timestamp label only — never derived from content. */
  readonly createdAt?: number;
  /** Non-sensitive key/value display labels only. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** Every social-event-kind label (for mapping/documentation helpers). */
export const SOCIAL_EVENT_KINDS: readonly SocialEventKind[] = [
  "post",
  "reply",
  "repost",
  "reaction",
  "profile",
  "article",
  "marketplace",
  "chat",
  "moderation",
  "test",
];

/** Every visibility label (for mapping/documentation helpers). */
export const SOCIAL_VISIBILITIES: readonly SocialVisibility[] = [
  "public",
  "followers",
  "community",
  "private_placeholder",
];
