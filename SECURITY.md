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
- **A Relay operator, or anyone observing a Relay's traffic, can see WHO
  is sending to WHOM and WHEN**, and can correlate that pattern over time
  (which accounts talk to which other accounts, how often, message
  timing and size) — encryption protects message contents, not this
  metadata. NIP-17's gift-wrap does not by itself defeat this kind of
  traffic analysis; no onion-style routing or mixing exists in this
  codebase to hide it (design-only, unimplemented — see the original
  project vision section of `README.md`). Treat this as public
  information to any Relay you connect through.
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
- **A second preload bridge, `window.fedosAcceptance`, exists alongside
  the real `window.fedosApp`** and is a structurally permanent part of
  this codebase, not an oversight — it carries a wider test-automation
  command vocabulary and is exposed only when a recognized
  `FEDOS_ELECTRON_BETA_AUTOTEST` mode is set, verified absent from an
  ordinary packaged launch by a real subprocess check, not merely a
  convention. Anyone who can set that environment variable on a running
  install has access to it.
- **Device-signature evidence is checked only during Ratchet session
  reset, on a best-effort basis** — not during a Direct conversation's
  initial session establishment.

See `ARCHITECTURE.md` for the full trust-boundary map and crypto
primitive inventory this status list summarizes.

## Reporting a vulnerability

### SECURITY CONTACT — HUMAN INPUT REQUIRED BEFORE PUBLIC BETA

**No real contact channel (email address, web form, or otherwise) has
been designated yet.** This file will not invent one. A human with the
authority to do so must add a real channel here before this Beta is
distributed beyond a Closed Beta pilot with its own separate,
human-controlled contact channel (see "Closed Beta pilot participants"
below). Until then:

- Do not open a public GitHub issue for an unpatched vulnerability.
- Closed Beta pilot participants: use the pilot's own separate contact
  channel (outside this repository) that your pilot coordinator gave
  you directly — not this file, which has no live channel yet.

### Supported versions

This is Closed Beta software with a single active line (`0.1.0-beta.x`
on the `release/fedos-desktop-beta-0.1` branch). There is no
older-version support policy — always use the most recently distributed
Beta build for your pilot cohort.

### What counts as a security issue here

Report through the private channel above (once live) rather than the
ordinary Feedback Guide if the issue is any of: a way to read another
user's message contents or Master Seed material without their
passphrase; a way to bypass or forge Device Pairing, Identity
Replacement, or Signed Deletion authorization; a memory-safety issue in
the Rust/WASM crypto core; a way to make the `fedosAcceptance`
test-automation bridge reachable from an ordinary packaged launch (see
"Current status" above — this must stay structurally absent); a
credential/secret leaked into a log, error message, or the DOM; or any
other way to defeat a guarantee this document or `KNOWN_LIMITATIONS.md`
claims this Beta actually provides. A gap this document or
`KNOWN_LIMITATIONS.md` already **discloses** as a known limitation is
not a new finding — check there first.

### What NOT to include in your first message

**Do not send your passphrase, Master Seed, private key material, or
another person's private message contents or personal information** in
a first-contact report, even to the private channel above. Describe the
issue and how to reproduce it using synthetic/test data. If a
maintainer needs a specific artifact from you to investigate further,
they will ask for it explicitly, over the same private channel.

### Encryption key request policy

No maintainer will ever ask you for your passphrase, Master Seed,
recovery code, or any raw private key material — this Beta has no
password-reset or key-escrow mechanism, and nobody legitimately needs
these to investigate a report. Treat any request for them, from anyone
claiming to be a maintainer, as itself a security incident.

### Expected acknowledgement

**HUMAN INPUT REQUIRED** — no acknowledgement-time or fix-time
commitment exists yet for this pre-release Beta. A human with the
authority to commit to a real SLA should add one here once a real
contact channel exists.

### Disclosure coordination

Once a real contact channel exists: please allow the maintainers a
reasonable opportunity to investigate and address a report before any
public disclosure. Specific coordinated-disclosure timelines are
**HUMAN INPUT REQUIRED** — not fabricated here.

### Safe reproduction guidance

Reproduce using a throwaway profile (a fresh `Create a profile`, not
your real one) and synthetic message content wherever possible. If you
must demonstrate an issue against real data, redact anything you don't
want a maintainer to see before sending.

### Severity vocabulary

- **Critical** — remote or local compromise of message confidentiality/
  integrity, or of Master Seed/key material, without the victim's
  passphrase.
- **High** — a way to bypass an authorization boundary (Device Pairing,
  Identity Replacement, Signed Deletion) or to reach the
  `fedosAcceptance` bridge from an ordinary launch.
- **Medium** — a way to defeat a specific disclosed guarantee (e.g. the
  double-submit protections, the Device revocation/local-fact model)
  without reaching Critical/High impact.
- **Low** — a hardening gap already substantially disclosed in
  `SECURITY.md`/`KNOWN_LIMITATIONS.md` (e.g. no `mlock`, no external
  audit) is not itself a new report unless you found a way to make its
  real-world impact worse than disclosed.

### Emergency stop-use criteria

Stop using this Beta and wait for guidance from your pilot coordinator
if: you have reason to believe your Master Seed or passphrase was
exposed outside this application; you observe behavior consistent with
a Critical-severity issue above; or your pilot coordinator issues an
explicit stop-use notice. There is no in-app "panic button" — stopping
use means closing the application and not reopening it until you hear
back.

### Closed Beta pilot participants

If you are in the Closed Beta pilot specifically, your pilot
coordinator's own separate, human-controlled contact channel (outside
this repository) is the correct first point of contact for anything
urgent — this file's own placeholder channel is not yet live. See
`docs/desktop_beta_feedback_guide.md` for the distinction between
ordinary feedback and a security report.

## Scope notes

- This is a Beta build. Treat it as suitable for testing and feedback, not
  for protecting information where compromise would cause serious harm.
- See `KNOWN_LIMITATIONS.md`, `ARCHITECTURE.md`, and the in-app Safety
  Center for the current, real, per-subsystem security state.
