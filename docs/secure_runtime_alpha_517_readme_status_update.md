# Secure Runtime Alpha 517 — README Status Update

Stage 17 of the Alpha 501–520 Durable Delivery Observation Wiring &
Host Delivery Lifecycle Arc.

## What changed

`README.md`'s own top `> **Status: ...**` block is replaced by a new
Alpha 501–520 entry; the prior Alpha 481–490 entry (and everything
below it) is preserved, unmodified, wrapped under a `> Prior status:`
marker — the same additive layering convention every prior Arc's own
README edit has used.

## What the new entry states

- Three new optional `FedosDesktopHostDependencies` fields, each
  defaulted like `outboxPersistence` (Alpha 419).
- Four new `FedosDesktopHost` methods; `FedosPublishScheduler`/
  `FedosBoardOutboxPublisher` unmodified.
- Why `FedosHostDeliveryController` drives `tick()` directly rather
  than calling `FedosPublishScheduler.start()`/`stop()`.
- The real end-to-end verification performed (Alpha 513/514).
- The honestly-discovered single-attempt-per-subject retry/Observation
  limitation (Alpha 514), NOT hidden from the status entry.
- Verification summary and scope boundaries respected.

## See also

- `docs/secure_runtime_alpha_514_failure_path_verification.md`
