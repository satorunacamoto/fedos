import type { ThreadNode } from "../thread/types.js";

/** UI sort modes for the root thread list. */
export type SortMode = "new" | "old" | "top" | "hot";

/**
 * Raw query options (e.g. parsed from URL params). Every field is optional and
 * may be malformed; `queryThreads` normalizes them into `ResolvedQueryOptions`.
 *
 * Filters operate at thread (root) granularity: a root thread is kept whole if
 * it matches; matching never prunes the subtree.
 */
export interface ThreadQueryOptions {
  sort?: SortMode;
  /** Keep threads in which ANY node is authored by this pubkey. */
  authorPubkey?: string;
  /** Keep threads whose root OR any descendant content contains this text. */
  text?: string;
  /** Keep threads with at least this many descendants (replies). */
  minReplies?: number;
  /** Keep threads whose root created_at >= since. */
  since?: number;
  /** Keep threads whose root created_at <= until. */
  until?: number;
  /** Page size. Clamped to [1, MAX_LIMIT]; defaults to DEFAULT_LIMIT. */
  limit?: number;
  /** Page offset. Negatives/NaN fall back to 0. */
  offset?: number;
}

/** Options after normalization — concrete, safe, and echoed back to callers. */
export interface ResolvedQueryOptions {
  sort: SortMode;
  limit: number;
  offset: number;
  minReplies: number;
  authorPubkey?: string;
  text?: string;
  since?: number;
  until?: number;
}

export interface ThreadQueryResult {
  /** The page of root threads after filtering, sorting and pagination. */
  readonly roots: readonly ThreadNode[];
  /** Total matching roots BEFORE pagination. */
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
  readonly sort: SortMode;
  /** The normalized options that produced this result. */
  readonly options: ResolvedQueryOptions;
}
