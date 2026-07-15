# Secure Runtime Alpha 508 — Host.startDelivery()

Stage 8 of the Alpha 501–520 Durable Delivery Observation Wiring & Host
Delivery Lifecycle Arc.

**Status: this Stage IMPLEMENTS** `FedosDesktopHost.startDelivery()` —
one new method, additive, part of the same Alpha 507 diff.

## What it does

1. Throws if `state() !== "ready"` — mirrors `submitPost()`'s own
   ready-state guard exactly.
2. Throws if delivery is already running — mirrors `start()`'s own
   "may only be called once" convention.
3. Constructs a REAL `FedosPublishScheduler` (Alpha 476, UNCHANGED)
   over the Host-owned `#outboxPersistence`/`#publisher`/
   `#deliveryIntervalMs` — a FRESH instance every call, never reused
   across a stop/start cycle (its own `#delivered`/`#abandoned`
   in-memory Sets are therefore also fresh every cycle — this Arc adds
   no cross-cycle durability for THAT bookkeeping, unchanged from
   Alpha 476's own "not persisted" stance).
4. Constructs a `FedosDeliveryObservationQuery` and
   `FedosValidatingDeliveryObservationRepository` (Alpha 495, UNCHANGED)
   over the Host-owned `#observationRepository`.
5. Constructs and `start()`s a `FedosHostDeliveryController` (Alpha
   505/506).

`FedosDesktopHost` itself calls `.publish()`/`.publishOne()` NOWHERE in
this method (or anywhere else in this file) — confirmed by direct
grep, re-run at Alpha 512. The Scheduler this method constructs is the
ONLY thing that ever calls the injected Publisher.

## See also

- `docs/secure_runtime_alpha_507_host_constructor_and_factory_wiring.md`
- `docs/secure_runtime_alpha_505_delivery_controller_tick_loop.md`
