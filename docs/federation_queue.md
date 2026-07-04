# Federation Outbound Queue (boundary docs — types + pure policy shipped)

**Status: this document describes a SHIPPED boundary
(`src/federation/outbound_queue.ts`, Stage 118, plus
`src/federation/queue_status_preview.ts`/`src/render/queue_preview.ts`,
Stage 119) — not a design sketch. Nothing in any of these three files
sends, publishes, subscribes, signs, or opens a network connection of any
kind.**

---

## 1. Purpose

Fix, as a pure boundary, what it would mean for an item to "wait its turn"
before eventually going out to a future protocol adapter
(`src/federation/capability_matrix.ts`'s `ProtocolAdapterKind`) — a queue
POSITION, strictly earlier than a send. This sits between
`src/federation/publish_intent.ts`'s `PublishIntentDescriptor` (what a
caller wants to eventually publish) and any future real adapter's actual
send call, which does not exist yet.

---

## 2. `OutboundQueueItemDescriptor` and `enqueuePlaceholder`/`dequeuePlaceholder`

`src/federation/outbound_queue.ts` defines `OutboundQueueItemDescriptor`
(`idRef?`/`intentRef?`/`adapterKind`/`createdAt?`/`metadata?`, no
content/body/bytes field) and two PURE, synchronous functions:

- `enqueuePlaceholder(queue, item)`: rejects (never throws) when `item`'s
  metadata contains a sensitive key/value (the same signing/relay-specific
  family as `publish_intent.ts`); otherwise returns a NEW array with `item`
  appended and a `queued_placeholder` decision.
- `dequeuePlaceholder(queue)`: rejects (never throws) when `queue` is
  empty; otherwise returns a NEW array with the FRONT item removed (FIFO), a
  `dequeued_placeholder` decision, and the removed `item`.

Neither function mutates the `queue` array passed in — both return a NEW
array, matching this codebase's `sanitizeX`-style pure-helper convention.
Neither opens a network connection, signs anything, or calls a real
adapter.

---

## 3. `QueueStatusPreview` (Stage 119, a narrower, display-only vocabulary)

`src/federation/queue_status_preview.ts` defines a SEPARATE, narrower state
set for DISPLAY purposes only: `QueueStatusPreviewState` is either
`queued_placeholder` (one or more items waiting for that adapter) or
`idle_placeholder` (none) — deliberately narrower than
`OutboundQueueState` (which also has `dequeued_placeholder`/`rejected` for
OPERATIONS, not display). `summarizeQueueStatusPreview(queue)` is a PURE
fold that counts entries per adapter kind and returns one
`QueuePreviewDescriptor` (`adapterKind`/`itemCountPlaceholder`/`state`) per
`ProtocolAdapterKind` — including adapters with a zero count. It never
calls `enqueuePlaceholder`/`dequeuePlaceholder` itself; it only counts an
array a caller already holds.

---

## 4. Read-only preview UI (Stage 119, `src/render/queue_preview.ts`)

A fixed, static array of three sample queue items (`SAMPLE_QUEUE_ITEMS`) is
summarized via `summarizeQueueStatusPreview` and rendered as a read-only
page, gated behind `?queuePreview=1` in `src/worker.ts`. Each row shows an
adapter kind, its PLACEHOLDER item count, and its `queued_placeholder`/
`idle_placeholder` state (all HTML-escaped). There is no send/enqueue/
dequeue button, no form, and no live queue — the sample array is fixed at
module load and never mutated.

---

## 5. What is explicitly NOT implemented

- No real network send of any kind — `queued_placeholder` never means "in
  flight" or "delivered".
- No persistence — the queue is a plain in-memory array a caller
  constructs and discards; there is no durable store, no D1/KV/SQLite
  table, no cross-request state.
- No retry, backoff, or delivery-confirmation logic of any kind.
- No connection to `FederationProvider`, `StorageBackend`, `PaymentProvider`,
  or `EntitlementProvider`.

---

## 6. Conclusion

- The outbound queue, at this stage, is a pure ARRAY-OPERATIONS boundary:
  enqueue/dequeue report a decision and return a new array — nothing more.
- The status preview is a STRICTLY DISPLAY-ONLY layer on top, with its own
  narrower `queued_placeholder`/`idle_placeholder` vocabulary.
- Sending, persistence, and retry are not concepts either boundary has any
  vocabulary for, by design.
