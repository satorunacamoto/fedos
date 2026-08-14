# Device Trust Visibility — Classification

See `06_IMPLEMENTATION_PLAN.md` §5 for the full decision; this file is the
short, standalone classification record mandate §55 asks for.

**DEVICE TRUST VISIBILITY: PARTIAL — protocol prerequisite.**

- Local account device inventory ("My Devices"): COMPLETE. Real, durable,
  already-shipped UI + backend (`fedos_electron_beta_page.html` `#app-screen-devices`,
  `devicesList()`/`deviceDetail()`/`deviceRevoke()`/`deviceSyncStatus()`,
  all real IPC → `FedosDesktopApplicationShell`).
- Peer (remote account) device inventory as a full directory: NOT
  IMPLEMENTED — genuinely blocked. Exact missing piece: a cross-account
  peer-Device discovery/announcement protocol (a peer publishing a signed
  "here are my devices" record another account's process can durably,
  independently verify and enumerate). No such protocol, message type, or
  persistence exists anywhere in this codebase (`src/os/messenger/device/`
  is same-account-pairing only).
- What IS real and used instead: `Shell.peerCapabilityListObserved()` —
  every peer Device this local Device has directly received a
  cryptographically real capability advertisement from. This is genuinely
  bounded and honest (never claims completeness), and backs the
  `DEVICE_KNOWLEDGE` axis and a "devices observed" list in the Security
  Details panel, explicitly labeled "observed, not a complete directory."

Per mandate §19/§40, this arc does not design the missing discovery
protocol — see `docs/reviews/fedos-direct-ratchet-readiness-current.md`
for the bounded, read-only note on that exact blocker.
