# Secure Runtime Alpha 497 — Scheduler Contract Rewiring

Stage 7 of the Alpha 491–500 Canonical Publisher & Delivery Observation
Contract Reconciliation Arc.

## 1. The central move: `FedosPublishScheduler` itself is touched by **zero bytes**

`FedosPublishSchedulerDependencies.publisher: FedosBoardOutboxPublisher`
(Alpha 476) is an INTERFACE dependency — `FedosNostrBoardPublisherAdapter`
(Alpha 496) already `implements` that exact, unchanged interface. "Connecting
the Scheduler to the canonical Publisher result" therefore requires no
edit to `fedos_publish_scheduler.ts` at all: constructing a `FedosPublishScheduler`
with a `FedosNostrBoardPublisherAdapter` injected as its `publisher` IS
the rewiring, fully satisfied by Alpha 496 alone. `git diff --stat --
src/board/outbox/fedos_publish_scheduler.ts` is empty for this entire
Arc (confirmed at Alpha 499).

This satisfies every one of this Stage's own requirements at once:

- **protocol-specific import禁止** — the Scheduler's own file still
  imports nothing Nostr-specific; the adapter is protocol-specific, but
  it lives entirely OUTSIDE the Scheduler's own dependency graph.
- **Schedulerのstart/stop/tick意味論を維持** — trivially true; nothing
  changed.

## 2. Retry directive — from the fixed table, not the Publisher

`outboundPublishOutcomeToRetryPolicy`
(`src/board/publish/fedos_outbound_publish_result_retry_policy.ts`) —
`accepted → never`, `rejected → never`, `failed → later`. Reused,
unchanged, by `outboundPublishResultToFedosBoardOutboxPublishResult`
(same directory) — the LAST step inside `FedosNostrBoardPublisherAdapter.publish()`
(Alpha 496 §3.4), which is therefore what actually supplies
`FedosBoardOutboxPublishResult.retryPolicy` the Scheduler reads
(Alpha 474 §3's own "Publisher-supplied" contract, still honored
literally — the Publisher, i.e. the adapter, still supplies it; it is
simply no longer a per-call protocol-aware judgment underneath).

## 3. Canonical observation vocabulary — via an explicit, isolated bridge

`fedosBoardOutboxObservationToDeliveryObservation`
(`src/board/outbox/fedos_board_outbox_observation_to_delivery_observation.ts`)
— maps each `FedosPublishSchedulerTickEntry.observations` entry (still
the OLD vocabulary, produced by the Scheduler's own unchanged internals)
to the canonical `FedosDeliveryObservation`. This is a VALUE mapping
only — it does not write to `FedosDeliveryObservationRepository`
(durable wiring is explicitly out of this Arc's own scope, named as
Alpha 500's own "Next Arc" recommendation). A caller driving `tick()`
today can call this bridge per returned observation to obtain the
canonical shape for its own use (logging, a future durability layer, a
test assertion) without the Scheduler itself ever constructing a
`FedosDeliveryObservation` — "独自Observation型を新規生成しない"
holds for the Scheduler's own file specifically; the BRIDGE'S job is
precisely to produce the canonical type from the old one, which is what
this Stage's own instruction asks for, not a contradiction of it.

## 4. What this Stage does NOT do

- Does not modify `fedos_publish_scheduler.ts`,
  `fedos_board_outbox_observation.ts`, `fedos_board_outbox_publisher.ts`,
  or either Delivery Observation file — all confirmed unchanged (Alpha
  499).
- Does not persist a `FedosDeliveryObservation` anywhere — the bridge
  in §3 produces values only.
- Does not give the Scheduler an Observation-storage dependency of any
  kind (Alpha 490 §3's own proposal #3 remains a NAMED, undone future
  Arc, not started here).

## 5. See also

- `docs/secure_runtime_alpha_496_publisher_adapter.md`
- `docs/secure_runtime_alpha_493_canonical_delivery_observation_vocabulary.md`
- `docs/secure_runtime_alpha_474_retry_policy_model.md`
