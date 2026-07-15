# Secure Runtime Alpha 509 — Host.stopDelivery()

Stage 9 of the Alpha 501–520 Durable Delivery Observation Wiring & Host
Delivery Lifecycle Arc.

**Status: this Stage IMPLEMENTS** `FedosDesktopHost.stopDelivery()` —
one new method, additive, part of the same Alpha 507 diff.

## What it does

```ts
async stopDelivery(): Promise<void> {
  if (this.#deliveryController === null) {
    throw new Error("FedosDesktopHost.stopDelivery() may only be called while delivery is running.");
  }
  const controller = this.#deliveryController;
  this.#deliveryController = null;
  await controller.stop();
}
```

Throws if delivery is not currently running. Otherwise clears
`#deliveryController` to `null` FIRST (so a concurrent
`deliveryStatus()`/`startDelivery()` call sees "not running"
immediately, synchronously — no caller can observe a state where
`#deliveryController` is non-null but already mid-shutdown), THEN
`await`s `FedosHostDeliveryController.stop()` (Alpha 506), which is
itself the thing that guarantees Scheduler停止 → tick終了待ち before
its own `Promise` settles. `Host.stopDelivery()`'s own `Promise`
therefore resolves only once that ENTIRE guarantee holds — the
"Host停止" step this Arc's own "Shutdown" section names.

## Why `Host.stop()` itself is not modified to auto-stop delivery

Considered and REJECTED: having the EXISTING `stop()` method
additionally call `stopDelivery()` internally. `FedosDesktopHostState`
(Alpha 333, a locked six-token contract this Arc does not touch) names
NO delivery-related transition, and `stop()`'s own body is confirmed
byte-for-byte unchanged (Alpha 511 re-verifies this mechanically) —
the safest reading of "既存Hostの`stop()`は既存設計を維持" this Arc
could adopt. A caller wanting a full, ordered shutdown calls
`stopDelivery()` (if delivery is running) before `stop()`; this Arc
documents the ordering as a caller responsibility rather than fabricate
an implicit coupling between two lifecycle concerns
`FedosDesktopHostState`'s own closed contract never named together.

## See also

- `docs/secure_runtime_alpha_506_delivery_controller_shutdown_ordering.md`
- `docs/secure_runtime_alpha_333_desktop_host_state_model.md`
