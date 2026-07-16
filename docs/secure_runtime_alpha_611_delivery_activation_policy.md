# Secure Runtime Alpha 611 — Delivery Activation Policy

Stage 11 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## Decision: inherit the existing separation, do not revisit it

`FedosDesktopHost.start()`/`startDelivery()` have been separate calls
since the Alpha 501–520 Arc's own explicit decision ("Host起動とdelivery
起動は分離"), unchanged through every subsequent Arc. This Arc's own
runtime honors that exactly: `startFedosDesktopRuntime()` always calls
`host.start()`; it calls `host.startDelivery()` ONLY when
`config.deliveryEnabled === true` (Alpha 603).

## Verified, by real execution, in `test/secure_runtime_alpha_611_delivery_activation_policy.test.ts`

- `deliveryEnabled: false` — `deliveryStatus()` reports `{running:
  false}`; a real, explicitly-targeted Outbox intent submitted
  afterward is NEVER attempted (a real injected Publisher's own call
  count stays `0`, confirmed after a real wait, not merely absence of
  an immediate call).
- `deliveryEnabled: true` with a real injected Publisher — `deliveryStatus()`
  reports `{running: true}` immediately after `startFedosDesktopRuntime()`
  resolves; a pending intent IS attempted.

## See also

- `docs/secure_runtime_alpha_603_local_runtime_configuration_model.md`
- `docs/secure_runtime_alpha_610_publisher_registry_wiring.md`
- `docs/secure_runtime_alpha_612_runtime_stop_ordering.md`
