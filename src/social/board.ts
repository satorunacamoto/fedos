/**
 * Stage 110 — Board skeleton (labels only).
 *
 * A protocol-neutral SHAPE for "a place `SocialEventDescriptor`s (see
 * `./event.js`) are grouped into" — a Reddit-style board, a single thread, a
 * channel, a marketplace listing group, or a knowledge-base section. This
 * file defines a LABEL-ONLY descriptor — it holds no event, no bytes, and no
 * content.
 *
 * HARD GUARDRAILS:
 *   - NO event/bytes/content field. A `BoardDescriptor` names and categorizes
 *     a grouping — it never embeds the activity inside it.
 *   - `id` is an OPAQUE label a real directory would resolve on its own side
 *     — never a protocol-specific id or URL.
 *   - This file performs no lookup, no membership check, and no
 *     storage/federation call. It is not wired into `FederationProvider`
 *     (`src/federation/`), `StorageBackend` (`src/storage/`), the Runtime,
 *     or the Worker.
 */

/** What kind of grouping this is — a label of intent only. */
export type BoardKind = "thread" | "board" | "channel" | "marketplace" | "knowledge" | "test";

/** A topic label a board MAY be tagged with. Display/grouping only. */
export interface TopicLabel {
  /** OPAQUE label a real directory would resolve on its own side. */
  readonly id: string;
  /** Display name only. */
  readonly name: string;
}

/** A category label a board MAY be tagged with. Display/grouping only. */
export interface CategoryLabel {
  /** OPAQUE label a real directory would resolve on its own side. */
  readonly id: string;
  /** Display name only. */
  readonly name: string;
}

/**
 * A non-sensitive, protocol-neutral description of one board/thread/channel.
 * Carries NO event/bytes/content field of any kind — only opaque labels and
 * display metadata.
 */
export interface BoardDescriptor {
  /** OPAQUE label a real directory would resolve to its own board id/URL. */
  readonly id?: string;
  readonly kind: BoardKind;
  /** Display title only. */
  readonly title: string;
  readonly topics?: readonly TopicLabel[];
  readonly categories?: readonly CategoryLabel[];
}

/** Every board-kind label (for mapping/documentation helpers). */
export const BOARD_KINDS: readonly BoardKind[] = [
  "thread",
  "board",
  "channel",
  "marketplace",
  "knowledge",
  "test",
];
