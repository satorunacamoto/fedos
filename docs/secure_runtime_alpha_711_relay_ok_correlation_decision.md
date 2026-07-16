# Secure Runtime Alpha 711 — Relay OK Correlation Decision

Stage 11 of Phase B. `FedosRelayOkCorrelatedNostrBoardPublisher`
(`src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts`)
defines every element the task's own instruction lists:

- **event ID key** — the event's own deterministic NIP-01 `id`, never a
  Relay-issued token.
- **listener registration** — ONE relay-wide `onRelayMessage()` listener,
  registered ONCE at construction (never per-publish), matching
  `FedosRelay`'s own "one Relay-level listener" design (Alpha 238) — a
  second registration would silently overwrite the first, so this class
  never risks that by only ever registering once.
- **matching OK `accepted: true`** — resolves `publishOne()`'s own
  `Promise<boolean>` to `true`.
- **matching OK `accepted: false`** — resolves to `false` (collapsed into
  the SAME boolean `false` every other failure path already returns —
  Alpha 455's own "false covers every failure path uniformly" contract,
  honored unchanged; see the disclosed limitation below).
- **unrelated OK ignored** — keyed lookup in a `Map<eventId, resolver>`;
  no entry, no effect.
- **NOTICE not a result** — the listener returns immediately for any
  non-`"ok"` message kind.
- **timeout** — a bounded `setTimeout` (default 10s) races against
  correlation; on timeout the pending entry is removed and `false` is
  returned.
- **listener cleanup** — the pending map entry is deleted on every
  settlement path (matched OK, timeout, or a thrown `relay.publish()`
  call) — no leak across calls.
- **duplicate OK** — a no-op once the first OK for an event id has
  already been consumed (the map entry no longer exists).
- **disconnect behavior / stale socket behavior** — no explicit
  disconnect hook exists on `FedosRelay` for a wrapping class to observe;
  a disconnect after `publish()` succeeds but before any OK arrives is
  honestly covered by the SAME timeout path (no OK will ever arrive, so
  it resolves `false` once the timeout elapses) — a deliberate, disclosed
  choice rather than adding a new Relay-level disconnect listener
  contract this Arc's own scope does not otherwise need.

No Relay Pool. No change to `FedosRelay`/`WebSocketRelay` themselves.

## Disclosed V1 limitation

`publishOne(): Promise<boolean>` cannot carry a THIRD state
("permanently rejected, do not retry") without widening a frozen
interface — doing so would trigger this Arc's own "formal ripple review"
requirement (Alpha 712), which was not performed. A real Relay rejection
(`accepted: false`) therefore currently retries on the SAME
`retryPolicy: "later"` schedule a transient transport failure would (see
`test/secure_runtime_alpha_707_real_nostr_outbox_processing.test.ts` test
2) — correctly reflected as "not accepted," but not yet distinguished
from "temporarily failed" at the Scheduler's retry-policy layer. A future
Arc with a demonstrated need could widen `FedosOutboundPublishResult`
to add `"rejected"` properly, with the formal ripple review this Arc
deliberately did not open.
