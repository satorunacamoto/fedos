# Secure Runtime Alpha 467 — Delivery Observation Query

Stage 7 of the Alpha 461–470 Canonical Delivery Observation Arc.
Implementation.

## 1. Role

`FedosDeliveryObservationQuery` is the canonical READ layer over
`FedosDeliveryObservationRepository` — the Repository already owns
storage; this class defines HOW clients read it, mirroring
`FedosBoardQuery`'s own Alpha 373–376 identical relationship to the
Board Repository. Read-only: no method writes.

## 2. Methods

- `historyFor(subjectId)` — every Observation for a subject, ordered
  `observedAt` ASC, `id` ASC on a tie: a timeline read top-to-bottom in
  real order, mirroring `FedosBoardQuery.thread()`'s own Alpha 374
  rationale rather than its newest-first feed rationale.
- `currentStateFor(subjectId)` — the last entry of `historyFor()`, or
  `null`. A DERIVED read, never a separately stored status field — Alpha
  462's own "Observations are historical facts, never a mutable status"
  rule applies to reads too.
- `listByState(state)` — every Observation currently in a given state,
  across every subject, oldest first.

## 3. Implementation

`src/board/observation/fedos_delivery_observation_query.ts`.

## 4. See also

- `docs/secure_runtime_alpha_466_delivery_observation_repository.md`
- `docs/secure_runtime_alpha_372_canonical_board_query_contract.md`
