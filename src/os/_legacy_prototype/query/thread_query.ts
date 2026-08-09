/**
 * Stage 4 — pure query / sorting / filter policy over built threads.
 *
 * Takes a `ThreadBuildResult` and returns a new `ThreadQueryResult` with roots
 * filtered, sorted and paginated for the UI. Never mutates the input, never
 * touches the network, and does not change `buildThreads`' default ordering.
 */

import type { ThreadBuildResult, ThreadNode } from "../thread/types.js";
import type {
  ResolvedQueryOptions,
  SortMode,
  ThreadQueryOptions,
  ThreadQueryResult,
} from "./types.js";

const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

const SORT_MODES: ReadonlySet<string> = new Set(["new", "old", "top", "hot"]);

/** Counts every descendant of a node (not including the node itself). */
export function countDescendants(node: ThreadNode): number {
  let total = 0;
  for (const child of node.children) {
    total += 1 + countDescendants(child);
  }
  return total;
}

/** Deepest relative depth within a subtree (a leaf root scores 0). */
function subtreeMaxDepth(node: ThreadNode, base: number): number {
  let max = node.depth - base;
  for (const child of node.children) {
    max = Math.max(max, subtreeMaxDepth(child, base));
  }
  return max;
}

/**
 * Deterministic "hotness" score for a thread. No time decay, so the same tree
 * always scores the same. Weighs total engagement, immediate breadth, and how
 * deep the conversation goes.
 */
export function scoreThread(node: ThreadNode): number {
  const descendants = countDescendants(node);
  const directChildren = node.children.length;
  const maxDepth = subtreeMaxDepth(node, node.depth);
  return descendants * 10 + directChildren * 3 + maxDepth;
}

function threadHasAuthor(node: ThreadNode, pubkey: string): boolean {
  if (node.event.pubkey === pubkey) return true;
  return node.children.some((c) => threadHasAuthor(c, pubkey));
}

function threadHasText(node: ThreadNode, lowerNeedle: string): boolean {
  if (node.event.content.toLowerCase().includes(lowerNeedle)) return true;
  return node.children.some((c) => threadHasText(c, lowerNeedle));
}

/**
 * Returns `node` if the thread matches every active filter, else null.
 * Matching is whole-thread: the returned node (and its subtree) is unchanged.
 */
export function filterThread(
  node: ThreadNode,
  options: ThreadQueryOptions,
): ThreadNode | null {
  const { authorPubkey, text, minReplies, since, until } = options;

  if (typeof since === "number" && Number.isFinite(since)) {
    if (node.event.created_at < since) return null;
  }
  if (typeof until === "number" && Number.isFinite(until)) {
    if (node.event.created_at > until) return null;
  }
  if (typeof minReplies === "number" && Number.isFinite(minReplies) && minReplies > 0) {
    if (countDescendants(node) < minReplies) return null;
  }
  if (typeof authorPubkey === "string" && authorPubkey.length > 0) {
    if (!threadHasAuthor(node, authorPubkey)) return null;
  }
  if (typeof text === "string") {
    const needle = text.trim().toLowerCase();
    if (needle.length > 0 && !threadHasText(node, needle)) return null;
  }

  return node;
}

function compareIdAsc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** created_at DESC, then id ASC. */
function byNew(a: ThreadNode, b: ThreadNode): number {
  const dt = b.event.created_at - a.event.created_at;
  return dt !== 0 ? dt : compareIdAsc(a.event.id, b.event.id);
}

/** created_at ASC, then id ASC. */
function byOld(a: ThreadNode, b: ThreadNode): number {
  const dt = a.event.created_at - b.event.created_at;
  return dt !== 0 ? dt : compareIdAsc(a.event.id, b.event.id);
}

function buildMetricMap(
  roots: readonly ThreadNode[],
  metric: (n: ThreadNode) => number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const root of roots) map.set(root.event.id, metric(root));
  return map;
}

/** Sorts a COPY of `roots` by the given mode. Input array is untouched. */
function sortRoots(roots: readonly ThreadNode[], sort: SortMode): ThreadNode[] {
  const arr = [...roots];
  switch (sort) {
    case "old":
      arr.sort(byOld);
      break;
    case "top": {
      const m = buildMetricMap(arr, countDescendants);
      arr.sort((a, b) => m.get(b.event.id)! - m.get(a.event.id)! || byNew(a, b));
      break;
    }
    case "hot": {
      const m = buildMetricMap(arr, scoreThread);
      arr.sort((a, b) => m.get(b.event.id)! - m.get(a.event.id)! || byNew(a, b));
      break;
    }
    case "new":
    default:
      arr.sort(byNew);
      break;
  }
  return arr;
}

function normalizeOptions(o: ThreadQueryOptions): ResolvedQueryOptions {
  const sort: SortMode =
    typeof o.sort === "string" && SORT_MODES.has(o.sort) ? o.sort : "new";

  let limit = DEFAULT_LIMIT;
  if (typeof o.limit === "number" && Number.isFinite(o.limit) && o.limit > 0) {
    limit = Math.min(Math.floor(o.limit), MAX_LIMIT);
  }

  let offset = 0;
  if (typeof o.offset === "number" && Number.isFinite(o.offset) && o.offset > 0) {
    offset = Math.floor(o.offset);
  }

  let minReplies = 0;
  if (
    typeof o.minReplies === "number" &&
    Number.isFinite(o.minReplies) &&
    o.minReplies > 0
  ) {
    minReplies = Math.floor(o.minReplies);
  }

  const authorPubkey =
    typeof o.authorPubkey === "string" && o.authorPubkey.trim().length > 0
      ? o.authorPubkey.trim()
      : undefined;
  const text =
    typeof o.text === "string" && o.text.trim().length > 0
      ? o.text.trim()
      : undefined;
  const since =
    typeof o.since === "number" && Number.isFinite(o.since) ? o.since : undefined;
  const until =
    typeof o.until === "number" && Number.isFinite(o.until) ? o.until : undefined;

  return { sort, limit, offset, minReplies, authorPubkey, text, since, until };
}

/**
 * Applies filtering, sorting and pagination to built threads.
 * Pure: returns a fresh result; input result and its nodes are never mutated.
 */
export function queryThreads(
  result: ThreadBuildResult,
  options: ThreadQueryOptions = {},
): ThreadQueryResult {
  const resolved = normalizeOptions(options);

  const matched: ThreadNode[] = [];
  for (const root of result.roots) {
    if (filterThread(root, resolved) !== null) matched.push(root);
  }

  const sorted = sortRoots(matched, resolved.sort);
  const total = sorted.length;
  const page = sorted.slice(resolved.offset, resolved.offset + resolved.limit);
  const hasMore = resolved.offset + page.length < total;

  return {
    roots: page,
    total,
    limit: resolved.limit,
    offset: resolved.offset,
    hasMore,
    sort: resolved.sort,
    options: resolved,
  };
}
