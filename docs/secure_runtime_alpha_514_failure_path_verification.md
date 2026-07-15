# Secure Runtime Alpha 514 — Failure Path Verification

Stage 14 of the Alpha 501–520 Durable Delivery Observation Wiring &
Host Delivery Lifecycle Arc. Verification only.

## What is verified

The SAME chain as Alpha 513, but with a `FedosRelayNostrBoardPublisher`
wrapping a `NullRelay` that is NEVER connected — `relay.publish()`
throws (Alpha 216's own unchanged "throws when not connected"
contract), `FedosRelayNostrBoardPublisher.publishOne()` returns `false`
(Alpha 456, unchanged), `FedosNostrBoardPublisherAdapter.publish()`
returns `{ outcome: "failed", retryPolicy: "later" }` (Alpha 496 §5.3,
unchanged), and `FedosPublishScheduler` (unchanged) records this as an
`attempt-started`/`failed` pair, bridged by
`FedosHostDeliveryController` into a `publishing`/`failed`
`FedosDeliveryObservation` pair — visible via
`Host.observationQuery()`.

## Consistency checked

- `Host.observationQuery().historyFor(subjectId)` — contains exactly
  `publishing`/`failed`.
- `Host.observationQuery().currentStateFor(subjectId)` — equals
  `historyFor(...)`'s own last entry (by construction, Alpha 467,
  unchanged).
- The Outbox intent remains PENDING (not delivered, not abandoned) —
  `retryPolicy: "later"` never adds it to `FedosPublishScheduler`'s own
  `#abandoned` set — a subsequent `tick()` attempts it again, unchanged
  Alpha 476 behavior.

## Resolved by Alpha 521–540 (Durable Delivery Retry Coordination Arc)

The limitation this section originally documented — a retried
delivery's own SECOND `publishing`/terminal pair being rejected as
`"invalid-transition"` — is RESOLVED, not merely deferred:
`makeFedosDeliveryAttemptSubjectId`/`FedosDeliveryRetryQuery`
(`docs/secure_runtime_alpha_525_attempt_subject_id_implementation.md`,
`docs/secure_runtime_alpha_528_retry_query_implementation.md`) give
each retry attempt its own fresh subject identity, so retried delivery
history now grows correctly, attempt by attempt, with zero
`"invalid-transition"` rejections — re-verified directly by re-running
THIS FILE'S OWN test after that Arc landed
(`test/secure_runtime_alpha_514_failure_path_verification.test.ts`,
updated at that Arc's own Alpha 531 ripple review). This section's own
original text is preserved below UNCHANGED as the honest historical
record of what was true when this Stage was written.

## Discovered consequence: retries keep transporting, but stop recording after the first terminal fact

Running a SECOND `startDelivery()` cycle against the SAME still-pending
intent proves `FedosPublishScheduler` really does retry transport (the
injected `eventSource` is called again, a real second `publish()`
attempt happens) — but `FedosValidatingDeliveryObservationRepository`
(Alpha 495) rejects the second `publishing`/`failed` pair for the SAME
`subjectId` as `"invalid-transition"`, because `"failed"` is a terminal
state under the single-attempt-per-subject model Alpha 494 §4
deliberately adopted (multi-attempt/retry re-entry was explicitly NOT
designed this Arc). Recorded Observation history for one Outbox intent
therefore does NOT grow across delivery-loop retries today — only the
FIRST attempt's own `publishing`/terminal pair is ever durably visible,
even though the Scheduler keeps genuinely trying. This is a real,
honestly-surfaced consequence of an EARLIER decision meeting a REAL
retrying Scheduler for the first time, not a defect introduced by this
Stage — and it is exactly the kind of gap Alpha 494 §4 anticipated
("if retries are treated as separate attempts, an explicit attempt
identity is required"), left correctly unresolved pending a future
Arc's own explicit scoping, per this Arc's own "Retry変更禁止"/no
redesign-of-Contract instruction.

## See also

- `docs/secure_runtime_alpha_513_full_pipeline_flow_verification.md`
- `docs/secure_runtime_alpha_492_canonical_publisher_result_decision.md`
