# Secure Runtime Alpha 463 — Persisted Delivery Observation Record V1 and Codec

Stage 3 of the Alpha 461–470 Canonical Delivery Observation Arc.
Implementation.

## 1. Wire shape

`FedosPersistedDeliveryObservationRecordV1` — `schemaVersion` fixed to
`1`, `id`/`subjectId`/`state`/`observedAt`/optional `reason`. Mirrors
`FedosPersistedBoardOutboxRecordV1`'s own Alpha 416 relationship to its
runtime type exactly: a deliberately separate, stable wire shape, never
the branded runtime `FedosDeliveryObservation` itself.

## 2. Codec discipline

`serializeFedosDeliveryObservation`/`deserializeFedosDeliveryObservation`
are the ONLY two conversion functions. Deserialize:

- Rejects any `schemaVersion` other than `1` — no silent migration.
- Rejects any unknown top-level key — a hand-edited or corrupted record
  with an extra field is refused, not silently stripped.
- Re-derives the record's own `id` via
  `createFedosDeliveryObservation` → `makeFedosDeliveryObservationId`
  and rejects the record if the stored `id` does not match — a tampered
  log line can never resurrect a mismatched id (mirrors
  `deserializeFedosBoardOutboxIntent`'s own identical Alpha 416 rule).
- Never throws, for any input.

## 3. Implementation

`src/board/observation/fedos_delivery_observation_codec.ts`.

## 4. See also

- `docs/secure_runtime_alpha_462_delivery_observation_state_model.md`
- `docs/secure_runtime_alpha_416_persisted_outbox_record_v1_codec.md`
