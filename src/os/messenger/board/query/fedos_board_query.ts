/**
 * Secure Runtime Alpha 373 ("Recent Feed Query") / Alpha 374 ("Thread
 * Query") / Alpha 375 ("Pagination Policy") / Alpha 376 ("Filter
 * Model") — Stages 3–6 of the Alpha 371–380 Canonical Board Query
 * Foundation Arc.
 *
 * `FedosBoardQuery` is the canonical READ layer for
 * `FedosBoardService`/any `FedosBoardQuerySource` (Alpha 372) — the
 * Repository (`../repository/fedos_board_repository.ts`, Alpha 302)
 * already owns storage; this class defines HOW clients read it,
 * exactly matching this Arc's own Objective. Deliberately NOT reusing
 * `FedosBoardFeed`'s own implementation (`../repository/fedos_board_feed.ts`,
 * Alpha 308) — that class's own `FEDOS_BOARD_FEED_MAX_LIMIT`/no-cursor
 * design was scoped to an UNFILTERED, UNPAGINATED feed only; this
 * layer's own job (filtering AND offset pagination AND thread
 * queries) is a strict superset that does not fit reusing its narrow
 * API, mirroring `FedosBoardFeed`'s own Alpha 308 precedent of writing
 * a fresh, self-contained comparator rather than importing one from an
 * unrelated-scoped concern (`src/query/thread_query.ts`, that Stage's
 * own doc comment). Alpha 377 verifies `recentFeed()`'s own default
 * (unfiltered, first page) ordering is IDENTICAL to `FedosBoardFeed`'s
 * own established order, byte-for-byte, so the two independent
 * implementations never silently drift apart.
 *
 * RECENT FEED (Alpha 373): `createdAt` DESC, `id` ASC on a tie — the
 * EXACT SAME ordering rule `FedosBoardFeed` already established
 * (Alpha 308 §4), reimplemented here rather than imported, per the
 * reasoning above.
 *
 * THREAD (Alpha 374): `createdAt` ASC, `id` ASC on a tie — the
 * OPPOSITE primary direction from the feed, deliberately: a thread is
 * read top-to-bottom in the order its posts were actually made (root
 * first, then replies chronologically), never newest-first. This is a
 * NEW ordering guarantee — `FedosBoardService.listThreadPosts()`
 * itself (Alpha 307) returns `Set` insertion order, with NO documented
 * sort — this class is the FIRST place in this repository to give
 * thread reads a fixed, deterministic order.
 *
 * PAGINATION (Alpha 375): offset/limit only, no cursor — mirroring
 * `src/query/thread_query.ts`'s own already-proven
 * `DEFAULT_LIMIT`/`MAX_LIMIT`/offset-clamping conventions (Stage 4 of
 * this repository's own original ingest pipeline), reimplemented here
 * independently rather than imported, since that file's own domain
 * (`ThreadNode`) is unrelated to `FedosBoardPost`. `total`/`hasMore`
 * are computed AFTER filtering, BEFORE pagination — an offset beyond
 * the total simply yields an empty `posts` array with `hasMore:
 * false`, never an error.
 *
 * FILTER MODEL (Alpha 376): `protocol`/`authorPublicIdentifier`/
 * `since`/`until`, ALL optional, ALL combined with AND semantics.
 * Applied BEFORE sorting and BEFORE pagination, in both `recentFeed()`
 * and `thread()` identically, via the ONE shared `matchesFilter()`
 * function — no filter dimension is implemented twice.
 *
 * HARD GUARDRAILS:
 *   - `FedosBoardQuery` and the three exported limit constants are the
 *     ONLY exports.
 *   - Both `recentFeed()` and `thread()` are PURE reads — neither
 *     method mutates `#source`, any `FedosBoardPost`, or any array
 *     `#source` returns.
 *   - No ranking, no personalization, no recommendation, no
 *     engagement score, no protocol/author priority, no random order
 *     — matching `FedosBoardFeed`'s own Alpha 308 guardrail exactly,
 *     for BOTH query methods this file adds.
 *   - No `FedosBoardRepository`/`FedosBoardPersistence` reference of
 *     any kind — this file depends ONLY on the minimal
 *     `FedosBoardQuerySource` shape (Alpha 372), never a concrete
 *     storage type.
 *   - No Worker, Runtime, Desktop, Relay, Protocol Adapter, or `p2p`
 *     reference of any kind.
 */

import type { FedosBoardId, FedosBoardPostId, FedosThreadId } from "../fedos_board_identifiers.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import type {
  FedosBoardQueryFilter,
  FedosBoardQueryPageOptions,
  FedosBoardQueryResult,
  FedosBoardQuerySource,
} from "./fedos_board_query_types.js";

/** The smallest requested limit either query method will ever return. */
export const FEDOS_BOARD_QUERY_MIN_LIMIT = 1;

/** The largest requested limit either query method will ever return. */
export const FEDOS_BOARD_QUERY_MAX_LIMIT = 100;

/** The limit applied when a caller supplies none. */
export const FEDOS_BOARD_QUERY_DEFAULT_LIMIT = 20;

function compareIdAsc(a: FedosBoardPostId, b: FedosBoardPostId): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `createdAt` DESC, then `id` ASC on a tie — see this file's own header §"RECENT FEED". */
function feedOrder(a: FedosBoardPost, b: FedosBoardPost): number {
  const dt = b.createdAt - a.createdAt;
  return dt !== 0 ? dt : compareIdAsc(a.id, b.id);
}

/** `createdAt` ASC, then `id` ASC on a tie — see this file's own header §"THREAD". */
function threadOrder(a: FedosBoardPost, b: FedosBoardPost): number {
  const dt = a.createdAt - b.createdAt;
  return dt !== 0 ? dt : compareIdAsc(a.id, b.id);
}

/** The ONE place every filter dimension (Alpha 376) is evaluated — used by both query methods. */
function matchesFilter(post: FedosBoardPost, filter: FedosBoardQueryFilter | undefined): boolean {
  if (filter === undefined) return true;
  if (filter.protocol !== undefined && post.source.protocol !== filter.protocol) return false;
  if (
    filter.authorPublicIdentifier !== undefined &&
    post.author.publicIdentifier !== filter.authorPublicIdentifier
  ) {
    return false;
  }
  if (filter.since !== undefined && post.createdAt < filter.since) return false;
  if (filter.until !== undefined && post.createdAt > filter.until) return false;
  return true;
}

/** Normalizes an arbitrary requested limit into `[FEDOS_BOARD_QUERY_MIN_LIMIT, FEDOS_BOARD_QUERY_MAX_LIMIT]`. */
function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return FEDOS_BOARD_QUERY_DEFAULT_LIMIT;
  const floored = Math.floor(limit);
  if (floored < FEDOS_BOARD_QUERY_MIN_LIMIT) return FEDOS_BOARD_QUERY_MIN_LIMIT;
  if (floored > FEDOS_BOARD_QUERY_MAX_LIMIT) return FEDOS_BOARD_QUERY_MAX_LIMIT;
  return floored;
}

/** Normalizes an arbitrary requested offset to a non-negative integer, defaulting to `0`. */
function normalizeOffset(offset: number | undefined): number {
  if (offset === undefined || !Number.isFinite(offset) || offset < 0) return 0;
  return Math.floor(offset);
}

/** Applies pagination to an already filtered-and-sorted array. See this file's own header §"PAGINATION". */
function paginate(sorted: readonly FedosBoardPost[], page: FedosBoardQueryPageOptions | undefined): FedosBoardQueryResult {
  const limit = normalizeLimit(page?.limit);
  const offset = normalizeOffset(page?.offset);
  const total = sorted.length;
  const posts = sorted.slice(offset, offset + limit);
  const hasMore = offset + posts.length < total;
  return { posts, total, offset, limit, hasMore };
}

export class FedosBoardQuery {
  readonly #source: FedosBoardQuerySource;

  constructor(source: FedosBoardQuerySource) {
    this.#source = source;
  }

  recentFeed(
    boardId: FedosBoardId,
    filter?: FedosBoardQueryFilter,
    page?: FedosBoardQueryPageOptions,
  ): FedosBoardQueryResult {
    const matched = this.#source.listBoardPosts(boardId).filter((post) => matchesFilter(post, filter));
    const sorted = matched.sort(feedOrder);
    return paginate(sorted, page);
  }

  thread(
    boardId: FedosBoardId,
    threadId: FedosThreadId,
    filter?: FedosBoardQueryFilter,
    page?: FedosBoardQueryPageOptions,
  ): FedosBoardQueryResult {
    const matched = this.#source.listThreadPosts(boardId, threadId).filter((post) => matchesFilter(post, filter));
    const sorted = matched.sort(threadOrder);
    return paginate(sorted, page);
  }
}
