# Secure Runtime Alpha 706 — Delivery Start Policy

Stage 6 of Phase B. No change was needed — every guarantee this Alpha asks
to preserve was already true before this Arc and remains true:

- The Runtime can start with delivery disabled — `deliveryEnabled: false`
  (the safe default a caller must explicitly override) reaches `"ready"`
  without ever calling `startDelivery()` (`fedos_desktop_runtime.ts`,
  unchanged).
- Delivery starts only when explicitly enabled — `startFedosDesktopRuntime()`
  calls `host.startDelivery()` only inside `if (config.deliveryEnabled)`.
- `Host.start()` and `Host.startDelivery()` remain two separate calls
  internally — unchanged.
- No publish during module import — confirmed by Alpha 617's own
  "no implicit startup" guard, unaffected by any file this Arc touched.
- No automatic target creation — `FedosBoardRuntime` only ever creates an
  Outbox intent for an explicitly caller-requested `outboundTargets`
  entry (Alpha 634, unchanged); Phase A's binding check narrows WHICH
  targets are eligible, it never adds one.

Verified directly in
`test/secure_runtime_alpha_713_failure_matrix_and_safety.test.ts` test 4
(local-only posts, even with delivery started and a fully-configured real
signing/binding graph, never touch the Relay).
