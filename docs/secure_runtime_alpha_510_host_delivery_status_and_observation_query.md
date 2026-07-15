# Secure Runtime Alpha 510 — Host.deliveryStatus() and Host.observationQuery()

Stage 10 of the Alpha 501–520 Durable Delivery Observation Wiring &
Host Delivery Lifecycle Arc.

**Status: this Stage IMPLEMENTS** two new methods, additive, part of
the same Alpha 507 diff.

## `deliveryStatus(): FedosHostDeliveryStatus`

`{ readonly running: boolean }` — pure, synchronous, never throws.
`running` is `true` only between a successful `startDelivery()` call
and the moment `stopDelivery()` is INVOKED (not merely when it
finishes settling — Alpha 509's own "clears `#deliveryController`
first" ordering makes `running` flip to `false` synchronously as soon
as `stopDelivery()` is called, before its own await completes).

## `observationQuery(): FedosDeliveryObservationQuery | null`

Mirrors `query()`'s (Alpha 383/384) own exact shape: returns the owned
`FedosDeliveryObservationQuery` — constructed fresh over the
Host-owned `#observationRepository` — ONLY when `state() === "ready"`;
`null` otherwise. This is the canonical way a caller cross-checks
"Observation History" (`historyFor()`) and "Current State"
(`currentStateFor()`) against whatever a `startDelivery()` run actually
recorded — Alpha 515 exercises this directly. This method itself never
writes — it is read-only, exactly like `query()`/`board()`.

## Why not fold `deliveryStatus()` into `state()`

`FedosDesktopHostState` is a closed, six-token contract (Alpha 333,
untouched). Delivery running/not-running is an ORTHOGONAL concern —
delivery can be started and stopped multiple times within a single
`"ready"` Host lifetime, which a value living inside the SAME closed
enum as `"constructed"`/`"starting"`/etc. could not represent without
either violating that contract's own closed vocabulary or conflating
two independent state machines into one.

## See also

- `docs/secure_runtime_alpha_509_host_stop_delivery.md`
- `docs/secure_runtime_alpha_467_delivery_observation_query.md`
