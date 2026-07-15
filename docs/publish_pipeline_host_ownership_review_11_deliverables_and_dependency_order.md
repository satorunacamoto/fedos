# 11 — Deliverables: Future Implementation Arc Candidates

This review authorizes none of the following — they are named,
scoped, and sequenced for whichever session picks up implementation
next, consistent with this review's own no-src-change mandate.

## Candidates

1. **Durable Observation Wiring** — implements Alpha 06 in full:
   the `FedosBoardOutboxObservation -> FedosDeliveryObservation`
   adapter, Host calling `observationRepository.record()` after every
   `tick()`, the `queued`-at-intent-creation recording inside
   `submitPostWithOutbox()`, and re-seeding the Scheduler's
   `#delivered`/`#abandoned` state from durable history at
   `startDelivery()` time (which additionally requires a NEW
   `FedosPublishScheduler` constructor option or method to accept
   pre-seeded state — a Scheduler-level production change).
2. **Publish Pipeline Host Ownership** — implements Alpha 01/02/03/04/05
   directly: the Publisher registry, Host-constructed Scheduler,
   Observation Repository injection, `startDelivery()`/`stopDelivery()`/
   `deliveryStatus()` facade, and the Host-fatal-vs-delivery-degraded
   failure boundary.
3. **Delivery Attempt Coordinator** — the two concrete gaps Alpha 03/07
   name as blocking a fully correct shutdown/manual-retry story:
   (a) a Scheduler-exposed in-flight-`tick()` accessor so shutdown can
   genuinely await it (Alpha 03's own named gap), and (b) a
   `retryIntent(outboxId)` escape hatch clearing a specific id from the
   Scheduler's own terminal-state tracking (Alpha 07's own named gap).
4. **Nostr Publisher -> Generic Publisher Adapter** — already named by
   the prior review (Alpha 490 §4); this review adds the SPECIFIC
   requirement it must satisfy per Alpha 08: implement
   `FedosBoardOutboxPublisher.publish(record)` by internally resolving
   an already-signed `FedosNostrWireEvent` for `record` and delegating
   to `FedosRelayNostrBoardPublisher.publishOne()` — which requires
   deciding where that signing step happens, a question this review
   does not resolve (it is a Nostr Signing Authority integration
   question, outside Host Ownership scope entirely).
5. **Private Board / DM Eligibility Boundary** — implements Alpha 09's
   required shape: a visibility field on (or alongside) the canonical
   post model, plus the fail-closed `isEligibleForOutboundTarget()`
   gate inside `submitPostWithOutbox()`, ahead of Outbox intent
   creation.

## Dependency order

```
                (1) Durable Observation Wiring
                 (needs the existing durable Repository only --
                  no dependency on 2/3/4/5)
                          |
                          v
        (2) Publish Pipeline Host Ownership
   (needs (1) complete, since Alpha 06's own
    Host-driven adapter call is part of this
    Arc's own scope; needs NOTHING from 3/4/5)
                    /            \
                   v              v
   (3) Delivery Attempt        (5) Private Board / DM
       Coordinator                 Eligibility Boundary
   (needs (2)'s own Scheduler   (needs (2)'s own
    ownership/facade to have    submitPostWithOutbox()
    a caller; independent       call site to exist in
    of (4) and (5))             its current, stable shape --
                                 already true today, so (5)
                                 could actually start in
                                 PARALLEL with (1)/(2)/(3),
                                 the ONE candidate with no
                                 real dependency on this
                                 review's own Host-ownership
                                 work at all)

   (4) Nostr Publisher -> Generic Publisher Adapter
   (needs (2)'s own registry to exist as a real target to
    register into; independent of (1)/(3)/(5) otherwise)
```

**Recommended sequencing for a single implementer:** (1) -> (2) -> then
(3) and (4) in either order (both depend only on (2)) -> (5) whenever
convenient (genuinely independent, but logically most urgent from a
safety standpoint — recommended NOT to be deprioritized just because it
has no hard dependency, per Alpha 09's own risk framing).

## See also

- `docs/publish_pipeline_host_ownership_review_01_ownership_matrix.md`
  through `docs/publish_pipeline_host_ownership_review_09_private_board_dm_eligibility.md`
- `docs/secure_runtime_alpha_490_publish_pipeline_integration_review_completion.md`
