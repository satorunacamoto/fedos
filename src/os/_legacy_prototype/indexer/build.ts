/**
 * Stage 14 — pure builders from ingest/thread output to index records.
 *
 * These read already-validated events and thread trees and project them into
 * the compact `Indexed*` shapes. They are pure: inputs are never mutated, and
 * no network/storage/signing happens. Reply/root links reuse the Stage 2 NIP-10
 * resolvers; space refs reuse the Stage 9 classifier.
 */

import type { NostrEvent } from "../../messenger/adapters/nostr/protocol/types.js";
import type { IngestedEvent } from "../ingest/types.js";
import type { ThreadBuildResult, ThreadNode } from "../thread/types.js";
import { getReplyTarget, getRootTarget } from "../thread/thread.js";
import { getSpaceTags, classifyEventToSpaces } from "../community/classify.js";
import type { Space } from "../community/types.js";
import type {
  IndexQuery,
  IndexedEvent,
  IndexedSpaceRef,
  IndexedThread,
} from "./types.js";

/** Max length of `contentPreview`. Content is truncated, never stored in full. */
export const MAX_CONTENT_PREVIEW = 280;

export const DEFAULT_INDEX_LIMIT = 50;
export const MAX_INDEX_LIMIT = 200;

/** Truncates content to the preview length (no full-text storage). */
export function previewContent(content: string): string {
  return content.length <= MAX_CONTENT_PREVIEW
    ? content
    : content.slice(0, MAX_CONTENT_PREVIEW);
}

/** Projects ingested events into compact `IndexedEvent` records. Pure. */
export function buildIndexedEvents(events: readonly IngestedEvent[]): IndexedEvent[] {
  return events.map((source) => {
    const event = source.event;
    const replyTo = getReplyTarget(event);
    const rootId = getRootTarget(event);
    return {
      id: event.id,
      pubkey: event.pubkey,
      kind: event.kind,
      created_at: event.created_at,
      contentPreview: previewContent(event.content),
      ...(replyTo !== null ? { replyTo } : {}),
      ...(rootId !== null ? { rootId } : {}),
      spaceIds: getSpaceTags(event),
      ...(source.relayUrl ? { relayUrl: source.relayUrl } : {}),
      ingestedAt: source.ingestedAt,
    };
  });
}

/** Collects deduped space ids referenced anywhere in a thread subtree. */
function collectThreadSpaceIds(root: ThreadNode): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const walk = (node: ThreadNode): void => {
    for (const id of getSpaceTags(node.event)) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    for (const child of node.children) walk(child);
  };
  walk(root);
  return out;
}

/** Reply count and most-recent reply time across a subtree (excluding root). */
function rollupReplies(root: ThreadNode): { count: number; lastReplyAt?: number } {
  let count = 0;
  let lastReplyAt: number | undefined;
  const walk = (node: ThreadNode): void => {
    for (const child of node.children) {
      count++;
      const ts = child.event.created_at;
      if (lastReplyAt === undefined || ts > lastReplyAt) lastReplyAt = ts;
      walk(child);
    }
  };
  walk(root);
  return lastReplyAt !== undefined ? { count, lastReplyAt } : { count };
}

/** Projects a thread build result into compact `IndexedThread` records. Pure. */
export function buildIndexedThreads(result: ThreadBuildResult): IndexedThread[] {
  return result.roots.map((root) => {
    const rollup = rollupReplies(root);
    return {
      rootId: root.event.id,
      rootPubkey: root.event.pubkey,
      rootCreatedAt: root.event.created_at,
      replyCount: rollup.count,
      ...(rollup.lastReplyAt !== undefined ? { lastReplyAt: rollup.lastReplyAt } : {}),
      spaceIds: collectThreadSpaceIds(root),
    };
  });
}

/**
 * Builds (space, event) refs for events that belong to one of the KNOWN
 * `spaces`. Unknown space references are ignored. One ref per (event, space).
 * Pure: inputs are not mutated.
 */
export function buildIndexedSpaceRefs(
  events: readonly IngestedEvent[],
  spaces: readonly Space[],
): IndexedSpaceRef[] {
  const refs: IndexedSpaceRef[] = [];
  for (const source of events) {
    const event: NostrEvent = source.event;
    const matched = classifyEventToSpaces(event, spaces);
    if (matched.length === 0) continue;
    const rootId = getRootTarget(event);
    for (const space of matched) {
      refs.push({
        spaceId: space.id,
        eventId: event.id,
        ...(rootId !== null ? { rootId } : {}),
        created_at: event.created_at,
        pubkey: event.pubkey,
      });
    }
  }
  return refs;
}

/** Normalizes `limit`/`offset` (defaults + caps). Shared by all index impls. */
export function resolvePagination(query: IndexQuery): {
  limit: number;
  offset: number;
} {
  let limit = DEFAULT_INDEX_LIMIT;
  const rawLimit = query.limit;
  if (typeof rawLimit === "number" && Number.isFinite(rawLimit) && rawLimit > 0) {
    limit = Math.min(Math.floor(rawLimit), MAX_INDEX_LIMIT);
  }
  let offset = 0;
  const rawOffset = query.offset;
  if (typeof rawOffset === "number" && Number.isFinite(rawOffset) && rawOffset > 0) {
    offset = Math.floor(rawOffset);
  }
  return { limit, offset };
}
