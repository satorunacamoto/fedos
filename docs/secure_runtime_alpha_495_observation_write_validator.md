# Secure Runtime Alpha 495 — Observation Write Validator

Stage 5 of the Alpha 491–500 Canonical Publisher & Delivery Observation
Contract Reconciliation Arc.

## 1. Shape decision

Two new, additive pieces — `FedosDeliveryObservationRepository`
(Alpha 466) and `FedosDeliveryObservationQuery` (Alpha 467) are
**byte-for-byte unchanged**, per this Arc's own "既存Interfaceを変更し
ない" instruction:

- `validateFedosDeliveryObservationTransition(current, candidate)` — a
  PURE function (`fedos_delivery_observation_write_validator.ts`):
  looks up the subject's current latest observation (if any) via a
  `FedosDeliveryObservationQuery`, applies
  `isAllowedFedosDeliveryObservationTransition` (Alpha 494) plus the
  staleness check (Alpha 494 §5), and returns a closed result — never
  throws, never mutates anything.
- `FedosValidatingDeliveryObservationRepository` — a decorator/wrapper
  class, composing an existing `FedosDeliveryObservationRepository` and
  `FedosDeliveryObservationQuery` (both injected, neither subclassed
  nor modified), exposing the SAME `record()`/`get()`/`list()` shape
  PLUS the closed write-outcome extension named below. It is a NEW
  class in a NEW file — the underlying Repository class itself gains no
  method.

## 2. Write-outcome result

```ts
export type FedosDeliveryObservationValidatedWriteResult =
  | FedosDeliveryObservationRepositoryWriteResult
  | "invalid-transition"
  | "stale";
```

A pure, additive UNION over the EXISTING result type (Alpha 466,
unchanged) — `"invalid-transition"` for a structurally illegal next
state (Alpha 494 §3), `"stale"` for a candidate whose `observedAt` is
strictly earlier than the subject's current latest recorded fact
(Alpha 494 §5, the Alpha 483 §3 gap this Stage closes).

## 3. Ordering guarantee

`FedosValidatingDeliveryObservationRepository.record()` ALWAYS
validates before writing — `current = query.currentStateFor(subjectId)`
is read first, the candidate is checked against it, and
`repository.record()` (the real, unchanged write) is called ONLY on a
passing validation. A rejected candidate never reaches the underlying
Persistence layer, and the underlying Repository's own existing
correct history is therefore never touched by an invalid write attempt
— it fails closed before any side effect occurs.

## 4. No effect beyond the Observation Repository

Per this Arc's own requirement ("Observation Repository以外へ副作用な
し"): the validator reads only via the injected `Query`, writes only
via the injected `Repository`'s own `record()` — no Board, Outbox,
Publisher, Relay, or filesystem reference of any kind.

## 5. What this Stage does NOT do

- Does not change `FedosDeliveryObservationRepository`,
  `FedosDeliveryObservationQuery`, or `FedosDeliveryObservationPersistence`
  in any way.
- Does not add a `delete`/`update-in-place` method — `record()` remains
  the only write path, exactly mirroring the underlying Repository's
  own discipline.
- Does not implement multi-attempt/retry re-entry (Alpha 494 §4's own
  deferral still holds).

## 6. See also

- `docs/secure_runtime_alpha_494_state_transition_contract.md`
- `docs/secure_runtime_alpha_483_delivery_state_transition_closure_review.md`
- `docs/secure_runtime_alpha_466_delivery_observation_repository.md`
