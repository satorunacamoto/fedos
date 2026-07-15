# Secure Runtime Alpha 505 — Delivery Controller Tick Loop

Stage 5 of the Alpha 501–520 Durable Delivery Observation Wiring & Host
Delivery Lifecycle Arc.

**Status: this Stage IMPLEMENTS**, alongside Alpha 506, one new file:
`src/desktop/host/fedos_host_delivery_controller.ts`. This Stage's own
half: `start()` and the private `#runTickAndPersist()` helper it
schedules.

## What was implemented

See the file's own header comment for the full design record (shared
with Alpha 506, since both methods live in one class per Alpha 504's
own design). Summary of this Stage's own half:

- `start()` throws if already running (mirrors
  `FedosPublishScheduler.start()`'s own convention exactly), otherwise
  begins an injectable interval that calls `#runTickAndPersist()`.
- The reentrancy guard (`if (this.#currentTick !== null) return;`)
  ensures at most ONE `tick()` call is ever in flight at a time — a
  slow `publish()` attempt inside `FedosPublishScheduler` can never
  cause two concurrent `tick()` calls to race against the same Outbox
  intent.
- `#runTickAndPersist()` calls `this.#scheduler.tick()` (Alpha 476,
  UNCHANGED) and, for every observation every returned entry carries,
  bridges and records it — never calling `Publisher.publish()` itself,
  never constructing an observation from anything other than `tick()`'s
  own return value.

## What this Stage does NOT do

- Does not implement `stop()` — Alpha 506, the same file's other half.
- Does not call `FedosPublishScheduler.start()`/`stop()`.
- Does not retry, queue, or buffer a skipped tick.

## See also

- `docs/secure_runtime_alpha_504_delivery_controller_design_decision.md`
- `docs/secure_runtime_alpha_506_delivery_controller_shutdown_ordering.md`
