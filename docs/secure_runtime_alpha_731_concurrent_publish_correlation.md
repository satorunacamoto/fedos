# Secure Runtime Alpha 731 — Concurrent Publish Correlation

Stage 11. Verified in
`test/secure_runtime_alpha_731_concurrent_publish_correlation.test.ts`
(3 tests) directly against a single `FedosRelayOkCorrelatedNostrBoardPublisher`
instance:

- Event A accepted, Event B rejected, unrelated Event C's OK ignored, all
  arriving out of order (B, then C, then A) — each of A/B resolves to
  exactly its own correct outcome.
- Settling one event id's pending entry never affects a different,
  still-pending event id's own entry (independent cleanup).
- 10 concurrent in-flight publishes, resolved in reverse order,
  alternating accept/reject — every one resolves to its own correct,
  independent outcome.

No broad parallel Scheduler change was made or is needed — concurrency
here is purely a property of `FedosRelayOkCorrelatedNostrBoardPublisher`'s
own `Map`-keyed correlation (Alpha 724), already correct by construction;
`FedosPublishScheduler` itself still processes intents one at a time,
per `#runTick()`'s own unchanged sequential `for` loop.
