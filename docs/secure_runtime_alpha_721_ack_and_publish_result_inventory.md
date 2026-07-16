# Secure Runtime Alpha 721 — ACK and Publish Result Inventory

Stage 1 of the Alpha 721–740 Nostr Relay ACK Semantics & Permanent
Rejection Arc.

## Findings

1. **Every current Publisher result vocabulary.**
   - `FedosNostrBoardPublisher.publishOne()`/`publishBatch()` (Alpha 455):
     bare `boolean`.
   - `FedosOutboundPublishResult` (Alpha 492, `src/board/publish/fedos_outbound_publish_result.ts`):
     `"accepted" | "rejected" | "failed"` with `externalReference` —
     **already exactly the shape Alpha 722's own candidate describes**.
   - `FedosBoardOutboxPublishResult` (Alpha 473,
     `src/board/outbox/fedos_board_outbox_publisher.ts`): `outcome:
     "delivered" | "rejected" | "failed"` + `retryPolicy` — also already
     supports `"rejected"`.
   - `FedosBoardOutboxObservationKind`/`FedosDeliveryObservationState`:
     both already include `"rejected"` as a real, terminal value.

2. **Where boolean results still exist.** Only at
   `FedosNostrBoardPublisher.publishOne(): Promise<boolean>` (Alpha 455,
   frozen) and its one production caller,
   `FedosNostrBoardPublisherAdapter.publish()` (Alpha 496, frozen), which
   converts that boolean via `nostrPublishOneResultToOutboundPublishResult()`
   (Alpha 497, frozen) — which can ONLY ever produce `"accepted"`/`"failed"`,
   never `"rejected"`, because a bare boolean carries no third state.

3. **How accepted/rejected OK is currently mapped.**
   `FedosRelayOkCorrelatedNostrBoardPublisher` (Alpha 710/711) already
   correlates a real Relay `OK` and internally knows `accepted`/`rejected`
   — but was forced to collapse both into the SAME boolean at its own
   `publishOne()` boundary (`accepted: false` → `false`, indistinguishable
   from a timeout or transport failure).

4. **Timeout behavior.** A bounded `setTimeout` (constructor-injected,
   default 10s) resolves `false` and removes the pending entry — already
   correct.

5. **Disconnect behavior.** `relay.publish()` throws when not connected;
   caught, resolves `false` — already correct.

6. **Listener cleanup behavior.** The pending map entry is always removed
   on settlement (accepted, rejected, or timeout) — already correct.

7. **Duplicate OK behavior.** A second OK for an already-settled event id
   finds no pending entry and is silently ignored — already correct.

8. **Current retry decision source.**
   `outboundPublishOutcomeToRetryPolicy()` (Alpha 497, frozen) ALREADY
   maps `"accepted"`/`"rejected"` → `"never"` and `"failed"` → `"later"`
   — and `FedosPublishScheduler.#attemptIntent()` (Alpha 476, frozen)
   ALREADY treats `retryPolicy === "never"` as
   `abandonedByPublisher = true`, permanently abandoning the intent.

## The ONE actual defect

Every downstream layer (canonical result type, retry-policy lookup,
Scheduler abandonment, Observation vocabulary, transition graph) was
ALREADY correct and ALREADY built to handle `"rejected"` as a distinct,
terminal outcome (Alpha 491–500, 521–580). The ONLY broken link is that
NOTHING in the Nostr publish path could ever PRODUCE `"rejected"` — the
frozen boolean `FedosNostrBoardPublisher` interface and its frozen
boolean-to-canonical mapper are structurally incapable of carrying the
distinction `FedosRelayOkCorrelatedNostrBoardPublisher` already knows
internally.

## Ripple scope

`src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts`
(extended, not redesigned) plus two new, additive files (a new interface,
a new adapter). No other file needs to change — confirmed by the rigorous
before/after full-suite diff in Alpha 738/740, which found zero new
regressions.
