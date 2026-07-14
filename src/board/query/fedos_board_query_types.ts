/**
 * Secure Runtime Alpha 372 ("Canonical Board Query Contract") — Stage
 * 2 of the Alpha 371–380 Canonical Board Query Foundation Arc.
 *
 * The TYPE-ONLY contract `FedosBoardQuery` (`./fedos_board_query.ts`,
 * Alpha 373–376) implements against. This file defines NO function,
 * NO class, NO construction logic — matching the same
 * type-only-first discipline `fedos_persisted_board_post_v1.ts`
 * (Alpha 313) and `fedos_board_persistence.ts`'s own interface half
 * (Alpha 315) already established for this Arc's own sibling
 * directories (`../persistence/`, `../repository/`).
 *
 * `FedosBoardQuerySource` is a MINIMAL structural interface — NOT a
 * direct dependency on `FedosBoardService` (Alpha 307) — mirroring
 * `FedosBoardFeedSource`'s own identical pattern
 * (`../repository/fedos_board_feed.ts`, Alpha 308) exactly: a
 * `FedosBoardService` instance already satisfies it with no explicit
 * relationship declared, since its own `listBoardPosts`/
 * `listThreadPosts` methods already match this shape verbatim.
 *
 * HARD GUARDRAILS:
 *   - `FedosBoardQueryFilter`, `FedosBoardQueryPageOptions`,
 *     `FedosBoardQueryResult`, and `FedosBoardQuerySource` are the
 *     ONLY exports.
 *   - Every field on every exported type is `readonly`.
 *   - No filter dimension beyond what `FedosBoardPost`'s own existing
 *     fields already support directly — no text search (no search
 *     index exists anywhere in the Board layer, Alpha 305 §"no search
 *     engine"), no reply-count threshold (no aggregation exists), no
 *     ranking/scoring field of any kind.
 *   - No cursor-shaped pagination token — `FedosBoardQueryPageOptions`
 *     is `limit`/`offset` only (Alpha 375's own Decision).
 *   - No mutation of any kind — this file defines shapes only.
 */

import type { FedosBoardId, FedosThreadId } from "../fedos_board_identifiers.js";
import type { FedosBoardPost } from "../fedos_board_post.js";
import type { FedosBoardSourceProtocol } from "../fedos_board_source.js";

/**
 * Every filter dimension a caller may combine — ALL are optional, and
 * every supplied field narrows the result (AND semantics, never OR).
 * Omitting a field means "do not filter on it," never "match only
 * empty/default values."
 */
export interface FedosBoardQueryFilter {
  /** Matches only posts whose `source.protocol` equals this value. */
  readonly protocol?: FedosBoardSourceProtocol;
  /** Matches only posts whose `author.publicIdentifier` equals this value exactly. */
  readonly authorPublicIdentifier?: string;
  /** Matches only posts with `createdAt >= since` (Unix seconds, inclusive). */
  readonly since?: number;
  /** Matches only posts with `createdAt <= until` (Unix seconds, inclusive). */
  readonly until?: number;
}

/** Offset/limit pagination only — no cursor. See Alpha 375 for the full Decision. */
export interface FedosBoardQueryPageOptions {
  readonly limit?: number;
  readonly offset?: number;
}

/** The result of one query call — filtered, sorted, and paginated. */
export interface FedosBoardQueryResult {
  readonly posts: readonly FedosBoardPost[];
  /** Total matching posts AFTER filtering, BEFORE pagination. */
  readonly total: number;
  /** The normalized offset actually applied. */
  readonly offset: number;
  /** The normalized limit actually applied. */
  readonly limit: number;
  /** `true` iff at least one more matching post exists beyond this page. */
  readonly hasMore: boolean;
}

/**
 * The minimal read shape `FedosBoardQuery` depends on. `FedosBoardService`
 * (Alpha 307) already satisfies this exactly, structurally — no
 * explicit `implements` needed anywhere.
 */
export interface FedosBoardQuerySource {
  listBoardPosts(boardId: FedosBoardId): readonly FedosBoardPost[];
  listThreadPosts(boardId: FedosBoardId, threadId: FedosThreadId): readonly FedosBoardPost[];
}
