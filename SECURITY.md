# Security

FedOS Desktop Beta is a pre-release, unaudited product. Please read this
before relying on it for anything sensitive.

## Current status

- **No external security audit has been performed on this codebase.**
  Every claim below is a claim about the source code and its own test
  suite, not an independent third-party finding.
- Release artifacts (installer/ZIP) produced by this repository's own
  build pipeline are **unsigned** unless a specific artifact is
  independently verified otherwise at the time you obtained it. Do not
  assume code-signing has occurred.
- Secure-memory zeroization of in-process secrets is currently
  best-effort, or unavailable, depending on the exact build and platform —
  see the in-app Safety Center screen for this build's own real, live
  status, never a generic claim.
- Group messaging, post-quantum cryptography, and MLS-style group ratchets
  are **not implemented** in this codebase. Only Direct (pairwise)
  conversations use the real production Ratchet.
- **"Double Ratchet" here means this codebase's own FedOS protocol
  implementation of the Double Ratchet algorithm** (forward secrecy +
  post-compromise security for Direct conversations) — it is not the
  Signal Protocol library, and it is not interoperable with Signal or any
  other Double-Ratchet-based messenger.
- Message transport uses NIP-17 (Nostr gift-wrapped direct messages) with
  this project's own additive extensions (e.g. real-time invitation
  delivery, an authenticated route-binding field inside the encrypted
  Rumor content for same-peer multi-conversation routing). These
  extensions are proprietary to this codebase, layered on top of the
  standard NIP-17 envelope — a generic NIP-17 client will not understand
  them, and this application does not claim broader Nostr-client
  interoperability beyond standard NIP-17 delivery itself.
- **Device Pairing trusts a Device, not a person, and every trust fact is
  local.** Pairing a second Device binds its own signing key as trusted
  under an account; there is no cross-Device Registry synchronization, so
  each Device's own view of "trusted"/"revoked" is a local fact recorded on
  that Device, not a guarantee the other side agrees. **Revoking a Device
  removes its trust for future messages and Sync — it does not delete
  messages that Device already has, and this application has no way to
  confirm or force deletion on another Device.** Offline is never treated
  as revoked.
- **No `mlock`/`VirtualLock` (or equivalent OS memory-pinning) guarantee
  exists.** Secrets held in process memory may be paged to disk by the
  operating system under memory pressure, like any ordinary application
  that does not use OS-level memory locking.
- **A compromised operating system, kernel, hypervisor, keylogger, or
  screen-capture tool is entirely outside this application's protection
  boundary.** No application-level defense against any of these exists or
  is claimed.

## Reporting a vulnerability

If you find a security issue, please open a private report through
whatever channel the maintainers of this repository currently designate
for that purpose. <!-- Contact details intentionally left as a placeholder:
this file does not invent an email address, response SLA, or bug-bounty
program that does not yet exist. --> Do not open a public issue for an
unpatched vulnerability.

## Scope notes

- This is a Beta build. Treat it as suitable for testing and feedback, not
  for protecting information where compromise would cause serious harm.
- See `docs/secure_runtime_alpha_8041_8120_completion_declaration.md` and
  the in-app Safety Center for the current, real, per-subsystem security
  state.
