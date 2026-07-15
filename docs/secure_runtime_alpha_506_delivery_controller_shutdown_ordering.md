# Secure Runtime Alpha 506 — Delivery Controller Shutdown Ordering

Stage 6 of the Alpha 501–520 Durable Delivery Observation Wiring & Host
Delivery Lifecycle Arc.

**Status: this Stage IMPLEMENTS**, completing
`src/desktop/host/fedos_host_delivery_controller.ts` (Alpha 505 built
`start()`). This Stage's own half: `stop()`.

## What was implemented

```ts
async stop(): Promise<void> {
  if (!this.#running) {
    throw new Error("FedosHostDeliveryController.stop() may only be called from the running state.");
  }
  this.#clearIntervalFn(this.#timerHandle);
  this.#timerHandle = undefined;
  this.#running = false;
  if (this.#currentTick !== null) {
    await this.#currentTick;
  }
}
```

- **Step 1 — "Scheduler停止"**: `this.#clearIntervalFn(...)` — no
  future firing can ever start a NEW `tick()` call after this line
  runs, synchronously.
- **Step 2 — "tick終了待ち"**: `if (this.#currentTick !== null) await
  this.#currentTick;` — if a `tick()` call was already in flight when
  `stop()` was invoked, this line does not return until that SPECIFIC
  call's own `Promise` settles — the exact guarantee Alpha 504 §1
  identified as impossible via `FedosPublishScheduler.start()`/`stop()`
  directly.
- **Step 3 — "Host停止"**: `stop()`'s own `Promise` resolves only after
  both prior steps complete — `FedosDesktopHost.stopDelivery()` (Alpha
  509) awaits this exact call, so a caller awaiting
  `host.stopDelivery()` is guaranteed no further Observation write, and
  no further `Publisher.publish()` call, can occur after it resolves.

## Idempotency and error discipline

`stop()` throws (does not silently no-op) when called while not
running — mirroring `FedosPublishScheduler.stop()`'s own SIBLING
convention as closely as possible while intentionally diverging from
its exact idempotent-no-op behavior, because SILENTLY returning here
would let a caller believe the ordering guarantee held when `stop()`
was never meaningfully invoked at all. `FedosDesktopHost.stopDelivery()`
(Alpha 509) is itself the caller responsible for only invoking this
method when delivery is actually running, matching this class's own
contract.

## See also

- `docs/secure_runtime_alpha_504_delivery_controller_design_decision.md`
- `docs/secure_runtime_alpha_505_delivery_controller_tick_loop.md`
