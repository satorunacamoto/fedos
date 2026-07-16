# Secure Runtime Alpha 567 — Abandoned State Decision

Stage 7 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## Options compared

- **Option A** (new terminal Observation state, e.g. `"abandoned"` in
  the CANONICAL `FedosDeliveryObservationState` union). Rejected — the
  canonical Observation vocabulary (`src/board/observation/fedos_delivery_observation.ts`,
  Alpha 462) was explicitly frozen by that Arc's own decision and has
  been treated as unchanged through every subsequent Arc since
  (Alpha 493 §4 already narrowed the Scheduler's OWN `"abandoned"` kind
  down to canonical `"failed"`, precisely to avoid a sixth canonical
  state). Extending it now, for a Scheduler-level POLICY concept, would
  reopen a boundary six prior Arcs have each independently chosen not
  to touch.
- **Option B** (a new state on `FedosDeliveryRetryRegistry`). Rejected
  as unnecessary — the Registry is write-time attempt-NUMBERING
  bookkeeping only (Alpha 527); it has no notion of "this subject is
  done" today and adding one would duplicate information already
  derivable from Observation history via `isFinal`.
- **Option C** (reuse the EXISTING `failed` canonical state + the
  EXISTING `isFinal`-via-retry-reason mechanism) — chosen.

## Decision: Option C, reusing 100% pre-existing machinery

`FedosPublishScheduler` already has its OWN `"abandoned"` kind in its
OWN (non-canonical) `FedosBoardOutboxObservationKind` vocabulary (Alpha
475, unchanged) — used, pre-Arc, for the Publisher-declared `"never"`
case. This Arc's new abandonment-by-policy path
(`fedos_publish_scheduler.ts`, `#attemptIntent()`) calls the EXACT SAME
`this.#observe(intent.id, "abandoned", result.reason)` the pre-existing
`"never"` path already called — meaning every downstream consumer
already understands it, with ZERO new wiring:

- `fedosBoardOutboxObservationToDeliveryObservation` (Alpha 497,
  unchanged) already maps `"abandoned" -> "failed"` (canonical state,
  narrowed, per Alpha 493 §4).
- `FedosHostDeliveryController`'s own `groupFedosBoardOutboxObservationsIntoAttempts`
  (Alpha 529, unchanged) already treats an `"abandoned"`-following
  terminal observation as `isFinal: true`.
- `encodeFedosDeliveryRetryReason(isFinal, reason)` (Alpha 526,
  unchanged) already encodes that `isFinal` into the persisted Delivery
  Observation's own `reason` field.
- `FedosDeliveryRetryQuery.historyFor()` (Alpha 528, unchanged) already
  decodes it back out as `isFinal: true` for any external reader.

## The external observability requirement — verified, not merely designed

This Stage's own instruction requires: "外部から『もう自動Retryされない』
と確認できなければならない." Verified by real execution:
`test/secure_runtime_alpha_568_abandonment_enforcement.test.ts` §2/§3
confirm the abandoned entry's own observation carries `kind: "abandoned"`;
`test/secure_runtime_alpha_579_end_to_end_verification.test.ts`
confirms, through the FULL real pipeline, that `FedosDeliveryRetryQuery`
reports `isFinal: true` for a Publisher-declared `"never"` case (the
SAME code path a policy-declared abandonment shares byte-for-byte).

## See also

- `docs/secure_runtime_alpha_493_canonical_delivery_observation_vocabulary.md`
- `docs/secure_runtime_alpha_566_abandonment_policy_decision.md`
- `docs/secure_runtime_alpha_568_abandonment_enforcement.md`
