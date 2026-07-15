# Secure Runtime Alpha 472 — Scheduler Responsibility Decision

Stage 2 of the Alpha 471–480 Canonical Publish Scheduler Foundation Arc.
Decision only — no implementation file in this Stage.

## 1. Candidates compared

- **Option A — fold Scheduler logic into `FedosDesktopHost`.** REJECTED:
  `FedosDesktopHost` (`src/desktop/host/fedos_desktop_host.ts`, Alpha
  400) is a request-driven coordinator (`submitPost()`), not a
  periodic-cadence owner; adding a timer and a retry loop to it would
  conflate two different lifecycles (per-call vs. background-interval)
  in one class, the same reason Alpha 412 rejected folding the Outbox
  into `FedosBoardPersistence`.
- **Option B — a separate `FedosPublishScheduler` class, depending only
  on the Outbox persistence port (read) and an injected Publisher port
  (write), owning cadence/orchestration/retry-directive application.**
  ADOPTED.
- **Option C — the Scheduler also implements `FedosBoardOutboxPublisher`
  itself (i.e., a single class both schedules AND publishes).**
  REJECTED: conflates "when to attempt" with "how to deliver" — a
  Nostr-only Scheduler could never be reused once ActivityPub/AT
  Protocol/Session gain a real Publisher, forcing an N-way duplication of
  the tick/retry logic instead of one Scheduler taking N different
  injected Publishers.
- **Option D — no Scheduler at all; require callers to invoke publish
  logic manually, once per intent, forever.** REJECTED: does not meet
  this Arc's own stated purpose ("Outboxを定期的にPublisherへ流す
  Schedulerを作る") — a manual-only shape is not periodic.

## 2. Decision

**Option B.** `FedosPublishScheduler` (`src/board/outbox/fedos_publish_scheduler.ts`,
Alpha 476–477) owns exactly:

- Reading pending intents from an injected `FedosBoardOutboxPersistence`
  (read-only — `listIntents()` only, never `putIntent()`).
- Calling an injected `FedosBoardOutboxPublisher.publish()` once (or, on
  an `"immediate"` retry directive, twice) per pending intent per
  `tick()`.
- Interpreting the three-value Retry Policy the Publisher itself returns
  (Alpha 474) and updating its OWN in-memory pending/delivered/abandoned
  bookkeeping accordingly.
- Recording `FedosBoardOutboxObservation`s (Alpha 475) for every
  attempt, returned from `tick()` — never persisted this Arc.
- `start()`/`stop()`/`tick()` cadence lifecycle only.

It does NOT own, and this Arc introduces no code for: signing, wire
event construction, Relay/WebSocket transport, protocol selection,
OK-message/ACK correlation, backoff-DURATION computation (only the
three-value directive, never a millisecond delay), a default/fallback
Publisher implementation, or any Board/Nostr/Relay/Ontology/`p2p/`/GUI
change.

## 3. Absolute prohibitions re-affirmed for this Arc

No modification anywhere in this Arc to: any existing Publisher-shaped
file (none exists in committed history; the uncommitted, in-progress
`src/board/publish/*` from a separate Arc is out of scope per Alpha 471
§5), any `src/desktop/*` Relay file, any `src/board/*` file outside the
new `src/board/outbox/` additions, any `src/nostr/*` file, any
`src/runtime/*`/Ontology file, `p2p/`, or any GUI/render file. No
exponential backoff, no scheduled-delay computation, of any kind.

## 4. See also

- `docs/secure_runtime_alpha_471_existing_scheduler_and_publisher_inventory.md`
- `docs/secure_runtime_alpha_412_outbox_responsibility_decision.md`
