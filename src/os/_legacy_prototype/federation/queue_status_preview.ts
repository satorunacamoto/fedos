/**
 * Stage 119 — Federation queue status preview (types + pure summary).
 *
 * A read-only SUMMARY layer over `./outbound_queue.js`'s in-memory queue —
 * answers "how many items are waiting for adapter X, right now, in this
 * array a caller already holds", never "send them". This is a NARROWER
 * vocabulary than `OutboundQueueState` (which also has `dequeued_placeholder`/
 * `rejected` for OPERATIONS): a status preview reports ONLY
 * `queued_placeholder` (one or more items waiting) or `idle_placeholder`
 * (none waiting) per adapter — a display-only distinction.
 *
 * HARD GUARDRAILS:
 *   - NO network of any kind, NO `fetch`, NO `WebSocket`. `summarizeQueueStatusPreview`
 *     is a PURE, synchronous fold over an array already in memory.
 *   - NO send/publish/subscribe of any kind — this file never calls
 *     `enqueuePlaceholder`/`dequeuePlaceholder` itself; it only COUNTS what a
 *     caller already has.
 *   - `itemCountPlaceholder` is a count of array entries ONLY — never a
 *     real relay-reported backlog size.
 */

import type { OutboundQueueItemDescriptor } from "./outbound_queue.js";
import { PROTOCOL_ADAPTER_KINDS, type ProtocolAdapterKind } from "./capability_matrix.js";

/** Coarse observable state of one adapter's queue row — a display-only distinction. */
export type QueueStatusPreviewState = "queued_placeholder" | "idle_placeholder";

/** One adapter's read-only queue summary row. Never a real backlog size or send status. */
export interface QueuePreviewDescriptor {
  readonly adapterKind: ProtocolAdapterKind;
  /** A count of array entries only — never a real relay-reported backlog size. */
  readonly itemCountPlaceholder: number;
  readonly state: QueueStatusPreviewState;
}

/** The full, read-only queue status preview: one row per known adapter kind. */
export interface QueueStatusPreview {
  readonly descriptors: readonly QueuePreviewDescriptor[];
}

/**
 * Pure fold: counts `queue` entries per `ProtocolAdapterKind` and reports
 * `queued_placeholder`/`idle_placeholder` per adapter. Never mutates
 * `queue`, opens no connection, sends nothing. Always returns one row per
 * `PROTOCOL_ADAPTER_KINDS` entry, even when its count is zero.
 */
export function summarizeQueueStatusPreview(
  queue: readonly OutboundQueueItemDescriptor[],
): QueueStatusPreview {
  const counts = new Map<ProtocolAdapterKind, number>();
  for (const item of queue) {
    counts.set(item.adapterKind, (counts.get(item.adapterKind) ?? 0) + 1);
  }
  const descriptors = PROTOCOL_ADAPTER_KINDS.map((adapterKind) => {
    const itemCountPlaceholder = counts.get(adapterKind) ?? 0;
    return {
      adapterKind,
      itemCountPlaceholder,
      state: (itemCountPlaceholder > 0 ? "queued_placeholder" : "idle_placeholder") as QueueStatusPreviewState,
    };
  });
  return { descriptors };
}
