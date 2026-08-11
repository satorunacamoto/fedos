/**
 * Stage 118 — Federation outbound queue skeleton (types + pure policy).
 *
 * A protocol-neutral SHAPE for "an item WOULD wait here before eventually
 * going out to a future protocol adapter" — a QUEUE POSITION, not a send.
 * This is a DIFFERENT, LATER layer than `./publish_intent.js`'s
 * `PublishIntentDescriptor`: a publish intent names WHAT a caller wants to
 * eventually publish; an outbound queue item is that same kind of thing
 * ALREADY reviewed and waiting its turn for a specific `ProtocolAdapterKind`
 * (`./capability_matrix.js`) — still strictly before any mapping, signing,
 * or relay send exists for it.
 *
 * HARD GUARDRAILS (see `docs/nostr_adapter_planning.md`):
 *   - NO network of any kind. `enqueuePlaceholder`/`dequeuePlaceholder` are
 *     PURE, synchronous array operations over an in-memory list a caller
 *     already holds — no `fetch`, no `WebSocket`, no relay connection, no
 *     HTTP request, ever.
 *   - NO signing of any kind. No private key, no `nsec`, no signature field,
 *     no event id is ever produced or referenced by this file.
 *   - NO publish, NO subscribe. A `queued_placeholder`/`dequeued_placeholder`
 *     state means "this item WOULD wait/WOULD leave the queue" — NEVER that
 *     anything was sent to, or received from, a real protocol.
 *   - NO `content`/`body`/bytes field of any kind. An
 *     `OutboundQueueItemDescriptor` carries OPAQUE labels/metadata strings
 *     only — never the actual post/reply/profile text a user typed.
 *   - `enqueuePlaceholder`/`dequeuePlaceholder` never mutate the queue array
 *     passed in — each returns a NEW array, exactly like this codebase's
 *     other `sanitizeX`-style pure helpers.
 */

import type { ProtocolAdapterKind } from "./capability_matrix.js";

/**
 * A non-sensitive description of one queued item. Carries NO
 * `content`/`body`/bytes field of any kind — only opaque labels, an adapter
 * kind, and metadata strings.
 */
export interface OutboundQueueItemDescriptor {
  /** OPAQUE label a real route would resolve to its own queue-row id. */
  readonly idRef?: string;
  /** OPAQUE label to the `PublishIntentDescriptor.idRef` this item came from. */
  readonly intentRef?: string;
  /** Which future protocol adapter this item would eventually go out via. */
  readonly adapterKind: ProtocolAdapterKind;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed on enqueue. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Coarse observable state of a queue operation. No signed/relay/network
 * data is exposed at any state.
 */
export type OutboundQueueState = "queued_placeholder" | "dequeued_placeholder" | "rejected";

/** The result of one queue operation. Never carries a network ack or content. */
export interface OutboundQueueDecision {
  readonly allowed: boolean;
  readonly state: OutboundQueueState;
  readonly reason: string;
}

/** The result of `enqueuePlaceholder`: a decision plus the (possibly unchanged) queue. */
export interface OutboundQueueEnqueueResult {
  readonly decision: OutboundQueueDecision;
  readonly queue: readonly OutboundQueueItemDescriptor[];
}

/** The result of `dequeuePlaceholder`: a decision, the remaining queue, and the removed item (if any). */
export interface OutboundQueueDequeueResult {
  readonly decision: OutboundQueueDecision;
  readonly queue: readonly OutboundQueueItemDescriptor[];
  readonly item?: OutboundQueueItemDescriptor;
}

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Mirrors `./publish_intent.js`'s signing/relay-specific family (a real
 * private key/signature/relay reference must never ride on a queued item)
 * alongside the conservative marker family used across this codebase's
 * other boundaries.
 */
const SENSITIVE_MARKERS: readonly string[] = [
  "secret",
  "key",
  "seed",
  "token",
  "payment",
  "entitlement",
  "dm",
  "body",
  "content",
  "message",
  "sig",
  "signature",
  "privkey",
  "nsec",
  "relay",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive/signing content. */
export function isSensitiveOutboundQueueValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveOutboundQueueValue(value)) return true;
  }
  return false;
}

/**
 * Ask to add `item` to the end of `queue`. Denies (never throws) when
 * `item.metadata` contains a sensitive key/value — in that case the
 * ORIGINAL `queue` reference is returned, unchanged. A clean item is
 * `queued_placeholder` and appended to a NEW array; `queue` itself is never
 * mutated. Opens no network connection, signs nothing, publishes nothing.
 */
export function enqueuePlaceholder(
  queue: readonly OutboundQueueItemDescriptor[],
  item: OutboundQueueItemDescriptor,
): OutboundQueueEnqueueResult {
  if (hasSensitiveMetadata(item.metadata)) {
    return {
      decision: {
        allowed: false,
        state: "rejected",
        reason: "item metadata contains a sensitive key or value",
      },
      queue,
    };
  }
  return {
    decision: {
      allowed: true,
      state: "queued_placeholder",
      reason: "item carries only non-sensitive, opaque labels (nothing sent/signed/published)",
    },
    queue: [...queue, item],
  };
}

/**
 * Ask to remove the FRONT item of `queue` (FIFO). Denies (never throws)
 * when `queue` is empty — the original (empty) `queue` reference is
 * returned and `item` is left `undefined`. Otherwise returns
 * `dequeued_placeholder`, the removed `item`, and a NEW array of the
 * remaining items; `queue` itself is never mutated. Opens no network
 * connection, signs nothing, publishes nothing.
 */
export function dequeuePlaceholder(
  queue: readonly OutboundQueueItemDescriptor[],
): OutboundQueueDequeueResult {
  if (queue.length === 0) {
    return {
      decision: {
        allowed: false,
        state: "rejected",
        reason: "queue is empty",
      },
      queue,
    };
  }
  const [item, ...rest] = queue;
  return {
    decision: {
      allowed: true,
      state: "dequeued_placeholder",
      reason: "item removed from the front of the queue (nothing sent/signed/published)",
    },
    queue: rest,
    item,
  };
}
