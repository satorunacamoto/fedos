/**
 * Secure Runtime Alpha 308 ("Chronological Board Feed") — Stage 8 of
 * the Alpha 301–310 Canonical Board Repository, Index & Feed
 * Foundation Arc.
 *
 * A genuinely new, protocol-neutral, UNRANKED, chronological-only feed
 * over `FedosBoardPost` — deliberately NOT the same as, and NOT reusing
 * any code from, `src/query/thread_query.ts`'s own ranked (`top`/`hot`)
 * Nostr-specific feed (Stage 4, unmodified, untouched by this Arc). See
 * this Stage's own design doc for the full ordering/limit-policy
 * rationale.
 *
 * HARD GUARDRAILS:
 *   - No ranking, no personalization, no recommendations, no engagement
 *     score, no protocol/author priority, no random order.
 *   - No mutation of the source's own returned array.
 *   - No pagination cursor.
 */

import type { FedosBoardId, FedosBoardPostId } from "../fedos_board_identifiers.js";
import type { FedosBoardPost } from "../fedos_board_post.js";

/** The smallest requested limit `listRecentPosts` will ever return. */
export const FEDOS_BOARD_FEED_MIN_LIMIT = 1;

/** The largest requested limit `listRecentPosts` will ever return. */
export const FEDOS_BOARD_FEED_MAX_LIMIT = 100;

/**
 * The minimal shape `FedosBoardFeed` depends on — NOT a direct
 * dependency on `FedosBoardService` (Alpha 307). Structural typing
 * means a `FedosBoardService` instance already satisfies this
 * interface with no explicit relationship declared.
 */
export interface FedosBoardFeedSource {
  listBoardPosts(boardId: FedosBoardId): readonly FedosBoardPost[];
}

function compareIdAsc(a: FedosBoardPostId, b: FedosBoardPostId): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `createdAt` DESC, then `id` ASC on a tie -- see this Stage's own design doc §4. */
function feedOrder(a: FedosBoardPost, b: FedosBoardPost): number {
  const dt = b.createdAt - a.createdAt;
  return dt !== 0 ? dt : compareIdAsc(a.id, b.id);
}

/** Normalize an arbitrary requested limit into `[FEDOS_BOARD_FEED_MIN_LIMIT, FEDOS_BOARD_FEED_MAX_LIMIT]`. See design doc §6. */
function normalizeFeedLimit(limit: number): number {
  if (!Number.isFinite(limit)) return FEDOS_BOARD_FEED_MIN_LIMIT;
  const floored = Math.floor(limit);
  if (floored < FEDOS_BOARD_FEED_MIN_LIMIT) return FEDOS_BOARD_FEED_MIN_LIMIT;
  if (floored > FEDOS_BOARD_FEED_MAX_LIMIT) return FEDOS_BOARD_FEED_MAX_LIMIT;
  return floored;
}

export class FedosBoardFeed {
  readonly #source: FedosBoardFeedSource;

  constructor(source: FedosBoardFeedSource) {
    this.#source = source;
  }

  listRecentPosts(boardId: FedosBoardId, limit: number): readonly FedosBoardPost[] {
    const normalizedLimit = normalizeFeedLimit(limit);
    const posts = [...this.#source.listBoardPosts(boardId)];
    posts.sort(feedOrder);
    return posts.slice(0, normalizedLimit);
  }
}
