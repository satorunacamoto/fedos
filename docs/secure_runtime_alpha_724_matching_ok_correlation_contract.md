# Secure Runtime Alpha 724 — Matching OK Correlation Contract

Stage 4. Formalized in
`src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts`'s
own `#correlate()` method, shared by both `publishOne()` and
`publishOneOutcome()`:

- **key:** exact signed Event ID (`entry.event.id`), string equality only.
- **`accepted=true` → `accepted`:** `{ outcome: "accepted", externalReference: eventId }`.
- **`accepted=false` → `rejected`:** `{ outcome: "rejected", externalReference: eventId }`.
- **unrelated Event ID → ignore:** no pending-map entry, no effect.
- **malformed OK → ignore:** `parseRelayInboundMessage()` (unchanged)
  already rejects any `"OK"` frame whose `accepted` is not a real
  boolean before `onRelayMessage()` ever fires — this class never even
  sees a malformed OK.
- **NOTICE → ignore as publish result:** the listener returns immediately
  for any non-`"ok"` message kind.
- **duplicate matching OK → first terminal result wins:** the pending
  entry is deleted on first settlement; a later OK for the same id finds
  nothing.
- **stale socket callback → ignore:** each `FedosRelayOkCorrelatedNostrBoardPublisher`
  instance owns its own `#pending` map; a callback from a superseded
  instance can only ever resolve THAT instance's own (already-settled or
  timed-out) entries, never a different instance's live one (verified in
  Alpha 732).
- **post-cleanup callback → ignore:** same mechanism — once an entry is
  deleted (settled or timed out), any further callback for that id is a
  no-op.
- **timeout → failed:** `{ outcome: "failed", externalReference: null }`.
- **disconnect before result → failed:** `relay.publish()` throws before
  any pending entry is even needed to resolve; caught, resolves `"failed"`.

Listener cleanup occurs on all terminal paths — verified directly in
`test/secure_runtime_alpha_730_ok_listener_lifecycle.test.ts` (10 tests)
and `test/secure_runtime_alpha_731_concurrent_publish_correlation.test.ts`
(3 tests, out-of-order/concurrent arrival).
