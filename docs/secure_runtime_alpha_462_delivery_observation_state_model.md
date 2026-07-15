# Secure Runtime Alpha 462 — Delivery Observation State Model

Stage 2 of the Alpha 461–470 Canonical Delivery Observation Arc.
Decision + implementation.

## 1. State vocabulary

`queued | publishing | accepted | rejected | failed` — this Arc's own
required, exhaustive list. `isFedosDeliveryObservationState` is the
single source of truth for membership; nothing else in this Arc
hardcodes the list a second time.

Rejected: reusing Alpha 415's candidate vocabulary
(`queued`/`attempt-started`/`delivered`/`rejected`/`failed`/
`abandoned`) or Alpha 475's realized subset. Both name a DIFFERENT set
(no `publishing`/`accepted`; `attempt-started`/`delivered`/`abandoned`
instead) — see Alpha 461 §3 for why this Arc does not reconcile them.

## 2. Identifier scheme

`FedosDeliveryObservationSubjectId` — opaque, caller-supplied,
brand-only (mirrors `FedosBoardId`'s own Alpha 252 "brand an
already-chosen string, mint nothing" convention). `FedosDeliveryObservationId`
is DETERMINISTICALLY derived from `subjectId + state + observedAt`
(mirrors `makeFedosBoardOutboxId`'s own Alpha 413 rationale), so
recording the same logical fact twice is idempotent by construction —
no separate dedupe index needed at the persistence layer (Alpha 464).

Rejected: a random/UUID observation id. Would make "record the same
fact twice" produce two distinct rows, breaking the idempotency
property this Arc's own Repository (Alpha 466) depends on.

## 3. Immutability

`FedosDeliveryObservation` is `Object.freeze`d and has exactly one
constructor, `createFedosDeliveryObservation`, mirroring
`createFedosBoardOutboxIntent`/`createFedosBoardOutboxObservation`'s own
"fails closed to `null`, never throws" convention exactly. No setter, no
mutation method — an Observation is a historical fact.

## 4. Implementation

`src/board/observation/fedos_delivery_observation.ts` — zero imports;
the foundational type file for this Arc's own directory.

## 5. See also

- `docs/secure_runtime_alpha_461_existing_observation_vocabulary_inventory.md`
- `docs/secure_runtime_alpha_413_outbox_identifier_target_model.md`
- `docs/secure_runtime_alpha_414_immutable_outbox_intent_model.md`
