# Secure Runtime Alpha 499 — Integration Verification

Stage 9 of the Alpha 491–500 Canonical Publisher & Delivery Observation
Contract Reconciliation Arc.

## 1. Checklist (this Arc's own required verification list)

| # | Item | Verified by |
|---|---|---|
| 1 | `queued` observation | `test/secure_runtime_alpha_499_*.test.ts` §1 — `FedosValidatingDeliveryObservationRepository.record(id, "queued", t)` → `"recorded"` |
| 2 | `publishing` observation | §1 — legal first-fact, and mid-sequence, both exercised |
| 3 | `accepted` result | §2 — real `FedosNostrBoardPublisherAdapter` over a connected `NullRelay`, end to end |
| 4 | `rejected` result | §2 — the CANONICAL `"rejected"` pathway is exercised directly against `isFedosOutboundPublishResult`/the write validator, since Alpha 492 §5 established the Nostr adapter itself can never produce it (no OK-correlation) — this is not a gap, it is the named limitation, re-confirmed here rather than silently untested |
| 5 | `failed` result | §2 — disconnected `NullRelay` |
| 6 | invalid transition rejection | §3 — reuses Alpha 495's own coverage, re-run here as part of the full pipeline |
| 7 | stale terminal observation rejection | §3 — same |
| 8 | Nostr Publisher adapter | §2 — real object, real `FedosRelay`, no mock of the adapter itself |
| 9 | Scheduler protocol neutrality | §4 — `fedos_publish_scheduler.ts`'s own source carries no Nostr/Relay reference (re-run from Alpha 491 §2) |
| 10 | repeated attempt policy | §5 — single-attempt-per-subject enforced (Alpha 494 §4); the fixed retry table never invents a numeric delay (Alpha 497 §2) |
| 11 | independent instances | §6 — two `FedosPublishScheduler`/`FedosValidatingDeliveryObservationRepository` instances never share state |
| 12 | no Host owner yet | §7 — no file this Arc adds imports `FedosDesktopHost`, and none constructs one |
| 13 | no automatic scheduler start | §7 — `FedosPublishScheduler`'s own constructor performs no `start()` call (Alpha 476, unchanged; re-confirmed) |
| 14 | no retry/backoff追加 | §5 — the retry-policy table has exactly three fixed entries, no numeric field anywhere |
| 15 | durable Observation wiring はまだ行わない | §8 — `fedos_board_outbox_observation_to_delivery_observation.ts` imports no Persistence/Repository; it is a pure value mapping |

## 2. Result

All fifteen items GREEN. See the accompanying test file for the exact
executable assertion behind each row.

## 3. See also

- `docs/secure_runtime_alpha_495_observation_write_validator.md`
- `docs/secure_runtime_alpha_496_publisher_adapter.md`
- `docs/secure_runtime_alpha_497_scheduler_contract_rewiring.md`
