/**
 * Stage 2 — pure Thread Builder.
 *
 * Turns a flat list of ingested Nostr events into Reddit-style thread trees by
 * reading NIP-10 `e` tags. No network, no signing, no UI — just graph shaping.
 *
 * Reply/root resolution (NIP-10):
 *   - A marked `["e", id, relay, "reply"]` tag is the reply target.
 *   - A marked `["e", id, relay, "root"]` tag is the root target.
 *   - When NO `e` tag carries a marker (deprecated positional form):
 *       * exactly one `e` tag  -> that id is both root and reply,
 *       * multiple `e` tags    -> first is root, last is reply.
 *   - Malformed `e` tags are ignored (and reported as `invalid_e_tag`).
 *
 * Only kind:1 text notes participate; other kinds are excluded from the tree
 * (and cannot act as parents — a reply pointing at one becomes an orphan root).
 */

import type { NostrEvent } from "../../../nostr/types.js";
import type { IngestedEvent } from "../ingest/types.js";
import type {
  ThreadBuildResult,
  ThreadBuildWarning,
  ThreadNode,
} from "./types.js";

const HEX_64 = /^[0-9a-f]{64}$/;
const KNOWN_MARKERS = new Set(["root", "reply", "mention"]);

interface ParsedRef {
  readonly id: string;
  readonly marker: "root" | "reply" | "mention" | undefined;
}

interface ParsedETags {
  readonly valid: ParsedRef[];
  readonly invalidCount: number;
}

/** Extracts valid `e` references and counts malformed ones. */
function parseETags(event: NostrEvent): ParsedETags {
  const valid: ParsedRef[] = [];
  let invalidCount = 0;

  for (const tag of event.tags) {
    if (tag[0] !== "e") continue;
    const id = tag[1];
    if (typeof id !== "string" || !HEX_64.test(id)) {
      invalidCount++;
      continue;
    }
    const rawMarker = tag[3];
    const marker =
      typeof rawMarker === "string" && KNOWN_MARKERS.has(rawMarker)
        ? (rawMarker as "root" | "reply" | "mention")
        : undefined;
    valid.push({ id, marker });
  }

  return { valid, invalidCount };
}

/**
 * Returns the id of the event this one is a direct reply to, or null.
 * See module docs for NIP-10 resolution rules.
 */
export function getReplyTarget(event: NostrEvent): string | null {
  const { valid } = parseETags(event);
  if (valid.length === 0) return null;

  if (valid.some((r) => r.marker !== undefined)) {
    const reply = valid.find((r) => r.marker === "reply");
    return reply ? reply.id : null;
  }

  // Positional fallback (no markers present).
  if (valid.length === 1) return valid[0]!.id;
  return valid[valid.length - 1]!.id;
}

/**
 * Returns the id of the thread root this event belongs to, or null.
 * See module docs for NIP-10 resolution rules.
 */
export function getRootTarget(event: NostrEvent): string | null {
  const { valid } = parseETags(event);
  if (valid.length === 0) return null;

  if (valid.some((r) => r.marker !== undefined)) {
    const root = valid.find((r) => r.marker === "root");
    return root ? root.id : null;
  }

  // Positional fallback: first e tag is the root (also covers the single case).
  return valid[0]!.id;
}

interface BuildNode {
  readonly event: NostrEvent;
  readonly source: IngestedEvent;
  parentId: string | null;
  depth: number;
  children: BuildNode[];
}

const KIND_TEXT_NOTE = 1;

function compareIdAsc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** created_at ASC, then id ASC. */
function childOrder(a: BuildNode, b: BuildNode): number {
  const dt = a.event.created_at - b.event.created_at;
  return dt !== 0 ? dt : compareIdAsc(a.event.id, b.event.id);
}

/** created_at DESC, then id ASC. */
function rootOrder(a: BuildNode, b: BuildNode): number {
  const dt = b.event.created_at - a.event.created_at;
  return dt !== 0 ? dt : compareIdAsc(a.event.id, b.event.id);
}

/**
 * Builds thread trees from ingested events.
 *
 * Pure: the input array and its elements are never mutated; the same input
 * always yields an equivalent result.
 */
export function buildThreads(events: IngestedEvent[]): ThreadBuildResult {
  const warnings: ThreadBuildWarning[] = [];

  // 1. Keep kind:1 only; dedupe by id (first occurrence wins).
  const nodes = new Map<string, BuildNode>();
  for (const source of events) {
    const event = source.event;
    if (event.kind !== KIND_TEXT_NOTE) continue;
    if (nodes.has(event.id)) {
      warnings.push({
        kind: "duplicate_event",
        eventId: event.id,
        detail: "duplicate id in input; later occurrence dropped",
      });
      continue;
    }
    nodes.set(event.id, {
      event,
      source,
      parentId: null,
      depth: 0,
      children: [],
    });
  }

  // Deterministic processing order for warnings and cycle breaking.
  const orderedIds = [...nodes.keys()].sort(compareIdAsc);

  // 2. Resolve each node's parent within the set.
  for (const id of orderedIds) {
    const node = nodes.get(id)!;

    const { invalidCount } = parseETags(node.event);
    if (invalidCount > 0) {
      warnings.push({
        kind: "invalid_e_tag",
        eventId: id,
        detail: `${invalidCount} malformed e tag(s) ignored`,
      });
    }

    const replyTarget = getReplyTarget(node.event);
    if (replyTarget === null) continue; // root

    if (nodes.has(replyTarget)) {
      node.parentId = replyTarget;
    } else {
      // Parent not in the set: promote to root, but record why.
      warnings.push({
        kind: "orphan_reply",
        eventId: id,
        detail: `reply target ${replyTarget} not present in set`,
      });
      node.parentId = null;
    }
  }

  // 3. Break cycles deterministically (cut the edge that closes the cycle).
  breakCycles(nodes, orderedIds, warnings);

  // 4. Link children / collect roots.
  const roots: BuildNode[] = [];
  for (const id of orderedIds) {
    const node = nodes.get(id)!;
    if (node.parentId === null) {
      roots.push(node);
    } else {
      nodes.get(node.parentId)!.children.push(node);
    }
  }

  // 5. Sort and assign depth.
  roots.sort(rootOrder);
  for (const root of roots) sortAndDepth(root, 0);

  return {
    roots,
    nodesById: nodes as ReadonlyMap<string, ThreadNode>,
    warnings,
  };
}

/**
 * Detects cycles by walking parent links. When a walk re-enters a node already
 * on the current path, the edge from the most recently visited node back into
 * the path is cut (that node becomes a root) and a warning is recorded.
 */
function breakCycles(
  nodes: Map<string, BuildNode>,
  orderedIds: string[],
  warnings: ThreadBuildWarning[],
): void {
  const UNVISITED = 0;
  const ON_PATH = 1;
  const DONE = 2;
  const color = new Map<string, number>();

  for (const startId of orderedIds) {
    if ((color.get(startId) ?? UNVISITED) === DONE) continue;

    const path: string[] = [];
    let current: string | null = startId;

    while (current !== null) {
      const state = color.get(current) ?? UNVISITED;
      if (state === DONE) break; // joins an already-cleared chain
      if (state === ON_PATH) {
        // `current` is on the path we are walking -> cycle. Cut the edge from
        // the last node we visited (which points at `current`).
        const closing = path[path.length - 1]!;
        nodes.get(closing)!.parentId = null;
        warnings.push({
          kind: "cycle_detected",
          eventId: closing,
          detail: `reply chain via ${current} forms a cycle; edge cut`,
        });
        break;
      }
      color.set(current, ON_PATH);
      path.push(current);
      current = nodes.get(current)!.parentId;
    }

    for (const id of path) color.set(id, DONE);
  }
}

/** Sorts a node's children in place and assigns depth recursively. */
function sortAndDepth(node: BuildNode, depth: number): void {
  node.depth = depth;
  node.children.sort(childOrder);
  for (const child of node.children) sortAndDepth(child, depth + 1);
}
