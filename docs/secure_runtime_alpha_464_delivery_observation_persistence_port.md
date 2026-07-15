# Secure Runtime Alpha 464 — Delivery Observation Persistence Port

Stage 4 of the Alpha 461–470 Canonical Delivery Observation Arc.
Decision + implementation.

## 1. Port shape

`FedosDeliveryObservationPersistence { putObservation, getObservation,
listObservations }` — synchronous, mirrors `FedosBoardOutboxPersistence`'s
own Alpha 417 shape and write-result vocabulary
(`inserted`/`already-present`/`conflict`/`failed`) exactly.

Rejected: folding this port into `FedosBoardOutboxPersistence` or any
other existing persistence port. A Delivery Observation is not an
Outbox intent, and Alpha 461 §3 already decided this Arc's own
vocabulary is standalone — a separate port keeps that boundary real at
the storage layer too, mirroring the precedent Alpha 411 §7 already set
("a separate persistence port IS required") when the Outbox itself was
first separated from Board persistence.

## 2. No delete, no update

An Observation is a historical fact, never rewritten. This port
exposes no delete/update method of any kind — matching this Arc's own
absolute prohibitions (no Retry, no Pool, no mutation vocabulary).

## 3. Implementation

`src/board/observation/fedos_delivery_observation_persistence.ts` (port
+ `fedosPersistedDeliveryObservationRecordsAreEqual`, the field-by-field
equality the `"already-present"` rule depends on — deliberately not a
`JSON.stringify` comparison, so key order never matters).

## 4. See also

- `docs/secure_runtime_alpha_463_persisted_delivery_observation_record_v1_codec.md`
- `docs/secure_runtime_alpha_417_outbox_persistence_port_memory_backend.md`
