# Secure Runtime Alpha 457 — FedosRelayNostrBoardPublisher: publishBatch

**Status: this Stage IMPLEMENTS. It edits exactly one existing file —
`src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts` (Alpha
456) — to add one method, `publishBatch()`. No new file is added. Stage
7 of the Alpha 451–460 Canonical Nostr Outbound Publisher Foundation
Arc, and the closing implementation Stage of the Publisher itself —
Alpha 458–460 are verification/completion only.**

## 1. Why now

`FedosNostrBoardPublisher` (Alpha 455) names `publishBatch()` alongside
`publishOne()`. This Stage gives it real behavior, the LAST method this
Arc's own scope list names ("publishBatch()").

## 2. What was implemented

```ts
async publishBatch(entries: readonly FedosNostrBoardPublishEntry[]): Promise<readonly boolean[]> {
  const results: boolean[] = [];
  for (const entry of entries) {
    results.push(await this.publishOne(entry));
  }
  return results;
}
```

- A plain SEQUENTIAL `for` loop calling `publishOne()` (Alpha 456,
  UNCHANGED) once per entry, collecting each boolean result in input
  order.
- Deliberately NOT `Promise.all` — no concurrency Pool of any kind, this
  Arc's own absolute prohibition.
- Deliberately NOT short-circuiting on the first `false` — one entry's
  failure never suppresses an independent entry's own publish attempt;
  every entry in `entries` receives exactly one `publishOne()` call,
  regardless of any other entry's outcome.
- Returns `readonly boolean[]`, positionally aligned with the input
  `entries` array — no result object, no partitioned
  succeeded/failed arrays, no summary count.

## 3. Responsibility boundary

- **Sequential, not pooled:** `publishBatch()` is a convenience loop
  over `publishOne()`, not a scheduler — it introduces no concurrency
  control, no queue, no worker of any kind.
- **Independent outcomes:** each entry's `true`/`false` reflects ONLY
  that entry's own `relay.publish()` attempt.

## 4. What this Stage does NOT do

- Does **not** add any new file — this Stage edits one existing file
  only.
- Does **not** retry a failed entry, either within this call or across
  calls.
- Does **not** run entries concurrently (no `Promise.all`, no
  `Promise.allSettled`, no worker pool).
- Does **not** modify `publishOne()`'s own body — reused unchanged.
- Does **not** modify `fedos_nostr_board_publisher.ts`,
  `fedos_nostr_wire_event_to_event_descriptor.ts`, `fedos_relay.ts`,
  `websocket_relay.ts`, or `null_relay.ts`.
- Does **not** implement ActivityPub, AT Protocol, Session, Ontology, or
  any `p2p/` publisher of any kind.

## 5. See also

- `docs/secure_runtime_alpha_456_relay_nostr_board_publisher_publish_one.md`
- `docs/secure_runtime_alpha_455_fedos_nostr_board_publisher_interface.md`
- `docs/secure_runtime_alpha_452_publisher_scope_and_return_contract_decision.md`
