# Secure Runtime Alpha 531 — Ripple Review

Stage 11 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

**Status: this Stage VERIFIES and, where a real regression was found,
FIXES.** No new public surface is added by this Stage. It re-runs and,
where necessary, corrects every pre-existing test the Arc's own new
code (Alpha 525–530) could plausibly ripple against.

## 1. Why a ripple review, specifically

Alpha 525's own new convention — `FedosDeliveryObservationSubjectId`
now means "one delivery ATTEMPT", not "one delivery intent", once a
caller has gone through `makeFedosDeliveryAttemptSubjectId()` — is a
convention change at the CALL site, not inside `fedos_delivery_observation.ts`
itself (Alpha 522 §4). Any pre-existing test that queried Observation
history/current-state directly by the FLAT original subject id was
written before that convention existed, and needed re-checking.

## 2. Pre-existing tests corrected (six files, all from the Alpha
501–520 Arc, all originally committed in `259ced4`)

- `test/secure_runtime_alpha_505_delivery_controller_tick_loop.test.ts`
- `test/secure_runtime_alpha_510_host_delivery_status_and_observation_query.test.ts`
- `test/secure_runtime_alpha_513_full_pipeline_flow_verification.test.ts`
- `test/secure_runtime_alpha_514_failure_path_verification.test.ts`
- `test/secure_runtime_alpha_515_multi_intent_consistency_verification.test.ts`
- `test/secure_runtime_alpha_516_independent_host_instances_verification.test.ts`

Every one of these queried `FedosDeliveryObservationQuery` directly by
the flat original subject id. Each is corrected the same way: read
through `FedosDeliveryRetryQuery` (Alpha 528) instead, by the SAME
original subject id, which now correctly aggregates across attempts.
No test's own INTENT changed — only how it reads Observation state.

Tests using the real wall clock (510, 513, 514, 515, 516) are also
made tolerant of the pre-existing Alpha 467 same-millisecond tie-break
(documented in `secure_runtime_alpha_529_controller_retry_rewiring.md`
§"Honest edge case") via `expect([...]).toContain(state)` assertions,
rather than asserting one exact state — this is not new leniency this
Arc introduces, it is the SAME tie-break these tests were always
theoretically exposed to; attempt-scoping simply makes it visible more
often, because most of these tests' own real-clock windows now span
MULTIPLE attempts instead of one.

## 3. A real, previously-latent bug found and fixed (not merely a test
correction)

`test/secure_runtime_alpha_514_failure_path_verification.test.ts`'s
own two-cycle scenario (`startDelivery()` → wait → `stopDelivery()` →
`startDelivery()` again → wait → `stopDelivery()`, same still-pending
intent) exposed that `FedosDesktopHost.startDelivery()` constructs a
FRESH `FedosHostDeliveryController` — and therefore, before this fix, a
FRESH `FedosDeliveryRetryRegistry` — on every call. Attempt numbering
reset to 1 on the second cycle, colliding with the already-terminal
attempt-1 subject the FIRST cycle had already written, and the
(correct, unchanged) Alpha 495 validator silently rejected every
retry-registry-visible write after that as `invalid-transition` — the
return value was never checked by the controller, so the failure was
invisible until this test's own attempt-count assertions caught it.

Fix, in two files:

- `src/desktop/host/fedos_host_delivery_controller.ts`: added an
  OPTIONAL `retryRegistry?: FedosDeliveryRetryRegistry` field to
  `FedosHostDeliveryControllerDependencies` (defaults to a fresh
  registry if omitted, so every other existing caller/test of this
  class is unaffected).
- `src/desktop/host/fedos_desktop_host.ts`: added ONE new private
  field, `#deliveryRetryRegistry: FedosDeliveryRetryRegistry`,
  constructed exactly once per Host instance (in the constructor) and
  passed into every `FedosHostDeliveryController` `startDelivery()`
  constructs, so attempt numbering now correctly persists across
  `stopDelivery()`/`startDelivery()` cycles for the same Host instance.

This is documented honestly, including the correction to Alpha 522's
own original claim that `FedosDesktopHost` needed zero changes, in
`docs/secure_runtime_alpha_522_retry_coordination_scope_decision.md`
§2 "Correction", and in `docs/secure_runtime_alpha_514_failure_path_verification.md`
§"Resolved by Alpha 521–540".

## 4. What did NOT need correction

`src/board/outbox/fedos_publish_scheduler.ts`, every file under
`src/board/publish/`, every file under `src/board/outbox/` other than
its own read-only usage, and the canonical Observation model files
(`fedos_delivery_observation.ts`, `_transition_graph.ts`,
`_write_validator.ts`, `_repository.ts`, `_query.ts`) needed zero
edits and zero ripple test corrections — confirmed by `git status
--porcelain`, which lists exactly the files named in §2–3 above as
modified, nothing else pre-existing.

## 5. Verification

`npx vitest run test/secure_runtime_alpha_5[0-3][0-9]*.test.ts`, run
FIVE times consecutively after this Stage's fixes: 31 files, 122
tests, all passing on every run, including the real-wall-clock tests
whose tie-break tolerance this Stage introduced.

## 6. See also

- `docs/secure_runtime_alpha_522_retry_coordination_scope_decision.md`
- `docs/secure_runtime_alpha_529_controller_retry_rewiring.md`
- `docs/secure_runtime_alpha_514_failure_path_verification.md`
