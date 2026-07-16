# Secure Runtime Alpha 583 — Durable Retry Record Schema

Stage 3 of the Alpha 581–600 Durable Retry Registry & Delivery Recovery
Arc.

## Decision: no new schema

Per Alpha 582's own canonical-ownership decision, the "durable retry
record" IS the existing `FedosPersistedDeliveryObservationRecordV1`
schema (Alpha 463, `src/board/observation/fedos_delivery_observation_codec.ts`,
UNCHANGED) — `{schemaVersion, id, subjectId, state, observedAt,
reason?}`, one record per attempt-scoped observation, already durable,
already versioned. Recovery reads this schema exclusively through the
EXISTING `FedosDeliveryRetryAttemptState` view
(`FedosDeliveryRetryQuery.historyFor()`, Alpha 528, UNCHANGED) —
`{attemptNumber, state, isFinal, retryReason, observedAt}` per attempt
— rather than inventing a parallel "recovery record" shape.

## The ONE new type this Arc defines, and why it is not a schema

`FedosDeliveryRecoveryState`
(`src/desktop/host/fedos_delivery_recovery_hydration.ts`, Alpha 585):

```ts
interface FedosDeliveryRecoveryState {
  readonly delivered: ReadonlySet<string>;
  readonly abandoned: ReadonlySet<string>;
  readonly completedAttempts: ReadonlyMap<string, number>;
  readonly nextAttemptCountBySubject: ReadonlyMap<FedosDeliveryObservationSubjectId, number>;
}
```

This is an in-memory VIEW, computed fresh on every call, never
persisted, never given its own `schemaVersion` — it is the exact same
category of thing `FedosBoardHydrationResult`
(`src/board/persistence/fedos_board_hydration.ts`, Alpha 318) already
is for Board state: a return value describing "what was rebuilt,"
not a new durable artifact.

## Derivation rule (restated precisely, matches the implementation)

For an intent whose `historyFor(subjectId)` is non-empty, letting
`latest` be the last entry:

- `latest.state === "accepted"` → the intent's own id is in `delivered`.
- `latest.state !== "accepted"` AND `latest.isFinal === true` → the
  intent's own id is in `abandoned` (Publisher-`"never"` and
  policy-`"abandon"` are indistinguishable by design, Alpha 567,
  unchanged — this Arc inherits, not revisits, that decision).
- Otherwise (still pending, mid-retry) → the intent's own id maps, in
  `completedAttempts`, to the COUNT of attempts in its history whose
  own `state !== "publishing"` (an attempt still `"publishing"` with no
  terminal write is a mid-flight/crashed attempt, never counted as
  completed).
- Every subject with at least one recorded attempt (regardless of
  outcome) is present in `nextAttemptCountBySubject`, mapped to
  `history.length` — the Retry Registry's own seed.

## See also

- `docs/secure_runtime_alpha_582_canonical_ownership_decision.md`
- `docs/secure_runtime_alpha_584_recovery_lifecycle_design.md`
- `docs/secure_runtime_alpha_585_durable_retry_persistence_implementation.md`
