# Secure Runtime Alpha 732 — Disconnect and Reconnect Semantics

Stage 12. Verified in
`test/secure_runtime_alpha_732_disconnect_reconnect_semantics.test.ts`
(4 tests):

- **Active publish on disconnect fails.** `relay.publish()` throws when
  not connected (pre-existing `FedosRelay` contract, unchanged); the
  correlation layer catches it and resolves `"failed"` — never hangs,
  never falsely succeeds.
- **Reconnect with a new socket.** Each real production wiring
  constructs one `FedosRelayOkCorrelatedNostrBoardPublisher` per Relay
  connection generation — a fresh instance starts with a clean, empty
  pending map, verified by simulating two independent
  Publisher/Relay-generation pairs in the same test.
- **Late callback from an old socket cannot complete a new publish for
  the same Event ID.** Each Publisher instance owns its own `#pending`
  map; an old generation's relay reference firing an OK can only ever
  resolve that OLD instance's own (already-settled/timed-out) entries —
  it has no way to reach a different instance's live `Map`.
- **No automatic republish inside the Publisher.** `publishOneOutcome()`
  calls `relay.publish()` exactly once per invocation, regardless of
  outcome — Scheduler/Retry (unchanged) remain the ONLY retry owner, per
  this Arc's own required V1 scope.

`FedosRelay`/`WebSocketRelay` themselves are untouched — this Arc adds no
new disconnect/reconnect hook to either; the guarantees above are a
direct consequence of the Publisher-level per-instance `Map` design
already in place since Alpha 711.
