# Secure Runtime Alpha 674 — Default Identity Behavior

Stage 4. The runtime default matches Alpha 645: anonymous-local remains
the V1 default. `startFedosDesktopRuntime()` still calls
`createDesktopApplication()` with NO argument (Alpha 606, byte-for-byte
unchanged) — `DesktopApplication.currentPublicIdentity()` still
resolves `null` by default (Alpha 641's own confirmed finding), so
`FedosDesktopPublicAuthorAuthority` (the default `publicAuthorAuthority`
when `config.publicAuthorAuthority` is omitted) resolves
`"anonymous-local"` for every command, by default, exactly as before
this Arc.

Confirmed consequences:

- **Local-only public posting works** — unaffected by identity;
  anonymous-local authorship is a first-class, valid author (Alpha
  645).
- **Outbound Nostr fails closed** — even if a caller DID inject a
  resolved Nostr identity via a custom `publicAuthorAuthority`,
  Phase C's own `evaluateFedosOutboundEligibility()` still fails every
  Nostr target closed (`"identity-not-controlled"`, Alpha 649/665) —
  this is independent of and additional to the identity default itself.
- **No secret generation** — no code path in this Arc generates a key,
  seed, or mnemonic of any kind.
- **No fake external identity** — the default author is always
  explicitly `protocol: "fedos"`, `publicIdentifier: "local-anonymous"`
  — never presented as a real external identity.

## How a caller injects a resolved identity

A caller who WANTS a real, resolved public author supplies a
`publicAuthorAuthority` implementation via `FedosDesktopRuntimeConfig`
— e.g. `new StaticFedosPublicAuthorAuthority({ outcome: "resolved",
author: {...} })`, or their own `FedosPublicAuthorAuthority`
implementation. This does NOT require calling
`createDesktopApplication(publicIdentity)` — the Authority layer is
now the sole seam `FedosBoardRuntime` consults (Alpha 642), fully
independent of whatever `DesktopApplication.currentPublicIdentity()`
itself would separately report. Startup itself never fails for lack of
a resolved identity — per Alpha 645, public V1 never requires one.
