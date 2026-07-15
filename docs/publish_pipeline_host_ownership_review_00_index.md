# Publish Pipeline Host Ownership Review — Index

Design-only review. **No production source is modified anywhere in
this review** — every file it adds is under `docs/` or `test/`, and
every `test/` file is read-only against existing, unmodified source.

This review is deliberately named, not Alpha-numbered, per its own
instruction: the numbered `secure_runtime_alpha_NNN` sequence is owned
by the actual implementation Arc track and must not be given a
colliding number by a parallel, review-only worktree. Every doc in this
review is prefixed `publish_pipeline_host_ownership_review_`.

Performed in an isolated git worktree/branch
(`worktree-publish-pipeline-host-ownership-review`), separate from the
worktree any concurrent implementation session ("Claude A") is using,
per this review's own instruction.

## Scope

Designs how `FedosDesktopHost` should own, start, and stop the chain

```
FedosDesktopHost
    -> Outbox               (src/board/outbox/*, committed, Alpha 411-420)
    -> Scheduler             (FedosPublishScheduler, committed, Alpha 471-480)
    -> Publisher             (TWO implementations: generic FedosBoardOutboxPublisher,
                               Alpha 471-480; Nostr-specific FedosNostrBoardPublisher/
                               FedosRelayNostrBoardPublisher, Alpha 451-460)
    -> Durable Observation    (FedosDeliveryObservation*, committed, Alpha 461-470)
```

given the findings of the prior (also review-only) Publish Pipeline
Integration Review Arc
(`docs/secure_runtime_alpha_481_publish_pipeline_separation_of_concerns_review.md`
through
`docs/secure_runtime_alpha_490_publish_pipeline_integration_review_completion.md`),
most importantly its own Alpha 488/490 finding: **today, nothing owns
Publisher, Scheduler, or either Observation vocabulary.**
`FedosDesktopHost` owns only the Outbox WRITE side.

## Sections

1. `01_ownership_matrix.md` — what Host should own / inject / not own.
2. `02_startup_ordering.md` — startup sequence, auto-start review.
3. `03_shutdown_ordering.md` — shutdown sequence, current flush/await audit.
4. `04_failure_isolation.md` — Host-fatal vs. delivery-subsystem-only failures.
5. `05_ownership_api.md` — Option A/B/C/D comparison, one recommendation.
6. `06_durable_observation_wiring.md` — Scheduler in-memory log to durable Repository.
7. `07_outbox_processing.md` — pending/accepted/rejected/failed intent handling.
8. `08_protocol_extensibility.md` — four-protocol Host API stability.
9. `09_private_board_dm_eligibility.md` — private/DM misdelivery boundary.
10. `10_abuse_defense_separation.md` — what must NOT enter the delivery Host.
11. `11_deliverables_and_dependency_order.md` — next Arc candidates, ordered.
12. `12_compliance_and_completion.md` — prohibition compliance, verification, completion.

## See also

- `docs/secure_runtime_alpha_490_publish_pipeline_integration_review_completion.md`
