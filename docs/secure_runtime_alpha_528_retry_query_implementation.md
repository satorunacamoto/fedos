# Secure Runtime Alpha 528 — Retry Query Implementation

Stage 8 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

**Status: this Stage IMPLEMENTS.** One new file:
`src/board/observation/fedos_delivery_retry_query.ts`.

## What was implemented

`FedosDeliveryRetryQuery` — `historyFor()`/`retryCountFor()`/
`currentStateFor()`, constructed from nothing but a
`FedosDeliveryObservationQuery` (Alpha 467, unchanged — the SAME
instance `Host.observationQuery()` already returns). Walks
attempt-scoped subject ids `1, 2, 3, …` (Alpha 525) via
`query.currentStateFor()` until one returns `null`; decodes each
attempt's own `isFinal`/`retryReason` via `decodeFedosDeliveryRetryReason`
(Alpha 526). An attempt still `"publishing"` always reports
`isFinal: false`, regardless of its own (not-yet-written) `reason`.

## See also

- `docs/secure_runtime_alpha_522_retry_coordination_scope_decision.md`
- `docs/secure_runtime_alpha_467_delivery_observation_query.md`
