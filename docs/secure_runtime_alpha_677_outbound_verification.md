# Secure Runtime Alpha 677 — Outbound Verification

Stage 7. Safe Nostr author/signing key-control matching is UNAVAILABLE
anywhere in this codebase (Alpha 649/665's own confirmed blocker) — no
successful outbound path is fabricated. Instead,
`test/secure_runtime_alpha_677_outbound_verification.test.ts` verifies
the fail-closed behavior itself, through the REAL running Local
Runtime:

- A real, resolved Nostr identity injected via `publicAuthorAuthority`
  (`StaticFedosPublicAuthorAuthority`) into `startFedosDesktopRuntime()`
  still fails closed on an explicit Nostr target — the post itself
  durably writes; the requested target surfaces `"ineligible"`, never
  `"inserted"`.
- `FedosBoardRuntime` never calls `startDelivery()` or a Publisher —
  confirmed via `host.deliveryStatus()` reporting `{ running: false }`
  after a command with outbound targets, when `deliveryEnabled: false`.
  Delivery remains an explicit, separate, Host-owned action.
