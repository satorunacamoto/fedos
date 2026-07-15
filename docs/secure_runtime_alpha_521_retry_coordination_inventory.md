# Secure Runtime Alpha 521 — Retry Coordination Inventory

Stage 1 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.
Review only.

## 1. The problem, re-confirmed by direct re-run

`docs/secure_runtime_alpha_514_failure_path_verification.md`
§"Discovered consequence" already demonstrated this directly: a second
delivery cycle against the same still-pending Outbox intent makes
`FedosPublishScheduler` (Alpha 476, unchanged) genuinely retry
transport, but `FedosValidatingDeliveryObservationRepository` (Alpha
495, unchanged) rejects the SECOND `publishing`/terminal pair for the
SAME `FedosDeliveryObservationSubjectId` as `"invalid-transition"` —
`"failed"`/`"rejected"`/`"accepted"` are terminal under
`isAllowedFedosDeliveryObservationTransition` (Alpha 494, unchanged),
and this Arc's own single-attempt-per-subject model (Alpha 494 §4)
never designed re-entry.

## 2. What is already complete (Alpha 451–520, none of it touched by this Arc)

`FedosDesktopHost.startDelivery()`/`stopDelivery()`, `FedosHostDeliveryController`'s
own tick loop and shutdown ordering, `FedosPublishScheduler`,
`FedosNostrBoardPublisherAdapter`, `FedosBoardOutboxObservation`'s five
kinds (`attempt-started`/`delivered`/`rejected`/`failed`/`abandoned`),
and the canonical `FedosDeliveryObservation` five-state vocabulary
(`queued`/`publishing`/`accepted`/`rejected`/`failed`) are ALL
production-ready and unchanged. Only Retry Coordination — turning
MULTIPLE Scheduler-level attempts into a coherent, queryable
per-intent history — is missing.

## 3. `FedosPublishScheduler#attemptIntent()`'s own exact observation shape (unchanged, re-confirmed)

Direct inspection of the unchanged Alpha 476 body confirms
`entry.observations` is ALWAYS one of:

- `[attempt-started, terminal]` — one attempt, no immediate retry.
- `[attempt-started, terminal, attempt-started, terminal]` — the
  `"immediate"`-retry guardrail fired once.
- Either of the above PLUS a trailing `abandoned` singleton — appended
  only when the FINAL merged result's own `retryPolicy` is `"never"`.

This exact, stable shape is what this Arc's own retry-coordination
logic groups into individual attempts (Alpha 529) — a real, load-
bearing fact about UNCHANGED code, not a new assumption.

## 4. See also

- `docs/secure_runtime_alpha_514_failure_path_verification.md`
- `docs/secure_runtime_alpha_494_state_transition_contract.md`
- `docs/secure_runtime_alpha_520_durable_delivery_observation_wiring_and_host_delivery_lifecycle_completion.md`
