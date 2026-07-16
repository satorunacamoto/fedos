# Secure Runtime Alpha 730 — OK Listener Lifecycle Implementation

Stage 10. Implemented/confirmed in
`FedosRelayOkCorrelatedNostrBoardPublisher`'s own `#correlate()`:

- listener registration happens once, at construction — safely BEFORE
  any `publishOneOutcome()`/`publishOne()` call can ever occur (a caller
  cannot call either method before constructing the object).
- exact Event ID filter — `Map<string, resolver>` keyed by `entry.event.id`.
- terminal resolve once — the map entry is deleted the instant it
  settles, on every path (accepted, rejected, timeout, or transport
  throw).
- listener removal — N/A at the per-publish level (ONE relay-wide
  listener persists for the Publisher's own lifetime, matching `FedosRelay`'s
  own "one Relay-level listener" design, Alpha 238) — cleanup instead
  happens on the PENDING MAP entry, per publish.
- timeout cancellation — implicit: once `#pending.delete(eventId)`
  removes the entry (via the OK path), the timeout's own callback later
  finds nothing to delete and is a no-op.
- disconnect cleanup — a thrown `relay.publish()` deletes its own pending
  entry immediately.
- duplicate OK protection — `#pending.get()` returns `undefined` once
  already consumed.
- stale socket guard — each Publisher instance owns its own `#pending`
  map; a different instance's callback cannot resolve it (Alpha 732).

No global listener registry of any kind — every `FedosRelayOkCorrelatedNostrBoardPublisher`
instance owns exactly one listener registration and one `Map`, scoped to
itself. No memory leak across repeated publishes — verified directly in
`test/secure_runtime_alpha_730_ok_listener_lifecycle.test.ts` (10 tests).
