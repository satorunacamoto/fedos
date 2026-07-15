# Secure Runtime Alpha 483 — Delivery State Transition Closure Review

Stage 3 of the Alpha 481–490 Publish Pipeline Integration Review Arc.
Review only.

## 1. Question

Is `queued → publishing → { accepted | rejected | failed }` a CLOSED
transition graph — i.e., does production code refuse an illegal
sequence (e.g. `accepted` followed by `queued`, or a second terminal
state after the first)?

## 2. Finding: the graph is documented convention, not enforced invariant

Both `createFedosDeliveryObservation`
(`src/board/observation/fedos_delivery_observation.ts`) and
`createFedosBoardOutboxObservation`
(`src/board/outbox/fedos_board_outbox_observation.ts`) validate ONLY:

- the state/kind is a member of the fixed vocabulary,
- `observedAt` is a non-negative integer,
- the subject/outbox id and optional reason are non-empty strings.

Neither constructor takes, or has access to, the PRIOR state for the
same subject — there is no "current state" parameter, no lookup, no
rejection of an out-of-order or post-terminal observation.
`test/secure_runtime_alpha_483_...test.ts` §1–2 demonstrates this
directly against the real, unmodified constructors: recording `failed`
at `observedAt = 1` and then `queued` at `observedAt = 2` for the SAME
subject succeeds on both calls — the type system and runtime validation
accept a semantically backwards sequence.

This is not a defect in either constructor considered alone — Alpha
462's own design doc is explicit that an Observation is "a durable,
immutable historical FACT," and a fact-recorder correctly has no
business rejecting a fact for contradicting an earlier one; enforcing a
transition graph is a REPOSITORY/write-side concern (validate before
recording), not a per-record construction concern. But no such
write-side enforcement exists either: `FedosDeliveryObservationRepository.record()`
(Alpha 466) calls `createFedosDeliveryObservation` and writes whatever
comes back — it does not consult `FedosDeliveryObservationQuery.currentStateFor()`
before writing, so nothing in the actual write path prevents the
same illegal sequence from being durably persisted.

`FedosPublishScheduler` DOES, in practice, only ever produce a legal
sequence for `FedosBoardOutboxObservation` — because its own internal
`#attemptIntent`/`#attemptOnce` control flow (Alpha 476) always emits
`attempt-started` before an outcome, and marks an intent `delivered`/
`abandoned` in its own `#delivered`/`#abandoned` Sets to prevent
re-attempting it. This is closure BY CALL-SITE DISCIPLINE (one
well-behaved producer), not closure enforced by the Observation type
itself — any other caller constructing `FedosBoardOutboxObservation`
directly (as this Stage's own review test does) is free to produce an
illegal sequence, and nothing rejects it.

## 3. Consequence

`FedosDeliveryObservationQuery.currentStateFor()` (Alpha 467) is
defined as "the last entry of `historyFor()`, ordered by `observedAt`."
Given finding §2, a caller that races two attempts and records `failed`
with a LATER `observedAt` than a genuinely later `accepted` (e.g. a
delayed retry's failure observation landing after a faster path's
success) would silently override the derived "current state" with a
stale-looking but chronologically-later fact. `test/secure_runtime_alpha_483_...test.ts`
§3 reproduces this directly. This is a real, demonstrable gap for any
future Arc wiring a real, possibly-concurrent Publisher to either
Observation vocabulary.

## 4. See also

- `docs/secure_runtime_alpha_462_delivery_observation_state_model.md`
- `docs/secure_runtime_alpha_466_delivery_observation_repository.md`
- `docs/secure_runtime_alpha_475_outbox_observation_realization.md`
