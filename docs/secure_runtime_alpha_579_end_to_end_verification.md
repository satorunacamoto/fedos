# Secure Runtime Alpha 579 — End-to-End Verification

Stage 19 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## Verified, by real execution, in `test/secure_runtime_alpha_579_end_to_end_verification.test.ts`

- **Composed case groups, one real pipeline run** (mirroring Alpha
  536's own established pattern): immediate success (Intent A) / fail-
  then-retry-then-succeed (Intent B) / Publisher-declared
  `"rejected"`+`"never"` (Intent C) — all three through the SAME real
  `FedosDesktopHost` -> `FedosPublishScheduler` (single-flight) ->
  `FedosHostDeliveryController` -> Observation Repository pipeline,
  concurrently pending in the same Outbox. No cross-contamination: each
  intent's own `FedosDeliveryRetryQuery.historyFor()` result reflects
  only its own attempts; Intent C's own single recorded attempt reports
  `state: "rejected"`, `isFinal: true` — confirming the Alpha 567 state-
  reuse decision holds through the real pipeline, not just at the raw
  Scheduler unit level (already covered by Alpha 568).
- **Multiple independent Hosts, no cross-Host contamination:** two
  separate `FedosDesktopHost` instances, separate Outbox persistence,
  running delivery concurrently — each Host's own
  `FedosDeliveryRetryQuery` reports history for its OWN intent only,
  zero entries for the OTHER Host's intent.

## `abandonmentPolicy` is exercised separately, by design, not here

`FedosDesktopHost.startDelivery()` does not accept an
`abandonmentPolicy` parameter — this Arc's own Absolute Prohibitions
exclude Board Runtime Application API / production-wiring work, and
Alpha 566's own decision explicitly defers a production default to
whichever future Arc wires a real caller. Alpha 568's own tests already
cover `abandonmentPolicy` at the raw `FedosPublishScheduler` level,
which this Stage does not duplicate.

## `overlapping ticks` / `stop during in-flight` / `next start uses a fresh instance`

Covered directly by Alpha 563 (raw single-flight), Alpha 564/571 (stop
barrier and its exception-tolerance), and Alpha 573/574 (the "fresh
instance" characteristic, confirmed and honestly documented rather than
silently relied upon) respectively — not re-duplicated in this Stage's
own test file to avoid restating coverage that already exists,
per-case, elsewhere in this Arc's own test suite.

## See also

- `docs/secure_runtime_alpha_536_full_pipeline_verification.md`
- `docs/secure_runtime_alpha_567_abandoned_state_decision.md`
- `docs/secure_runtime_alpha_573_restart_stable_abandonment.md`
