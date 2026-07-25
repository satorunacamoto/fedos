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

### Where to report

**Use GitHub Private Vulnerability Reporting.** On this repository:
**Security → Advisories → Report a vulnerability**, or open
`https://github.com/<owner>/<repo>/security/advisories/new` directly.

That channel is private between you and the maintainers. The report, and
the draft advisory it creates, are not visible to the public unless and
until a maintainer publishes them.

**Do not open a public GitHub Issue for a vulnerability.** A public
Issue is world-readable the instant it is submitted, is mirrored and
indexed by third parties within minutes, and cannot be meaningfully
un-published afterwards. Deleting it later does not undo the exposure.

**No email address is offered, deliberately.** This project has no
monitored security mailbox, and this file will not print an address that
nobody reads. If you cannot use GitHub Private Vulnerability Reporting
for some reason, say so in a public Issue **without any detail about the
vulnerability itself** — just ask for a private channel — and a
maintainer will arrange one.

> #### Status of this channel
>
> **HUMAN ACTION REQUIRED — Private Vulnerability Reporting must be
> enabled in the repository's Settings → Security before the Closed
> Pilot is announced.** It is not on by default. Until the repository
> owner enables it, the "Report a vulnerability" link above returns a
> 404, and **this channel is not live**. This file states that rather
> than implying a channel exists that does not.
>
> Closed Pilot participants: until you have confirmed the link works,
> use the contact route your pilot coordinator gave you directly. See
> [`docs/pilot/CLOSED_PILOT.md`](docs/pilot/CLOSED_PILOT.md).

### Non-sensitive bugs, questions, and feedback

Those are welcome in the **public** tracker, and do not belong in the
private channel:

- **Bugs with no security impact** — public Issues, using the bug report
  template.
- **Questions, setup help, design discussion, general pilot feedback** —
  Discussions.

If you are not sure which one your finding is: **treat it as sensitive
and report it privately.** Over-reporting to the private channel costs a
maintainer a few minutes. Under-reporting publishes a live weakness to
everyone at once. The asymmetry is not close, and nobody will criticise
you for choosing the private channel.

### Supported versions

This is Closed Beta software with a single active line (`0.1.0-beta.x`
on the `release/fedos-desktop-beta-0.1` branch). There is no
older-version support policy — always use the most recently distributed
Beta build for your pilot cohort.

### What counts as a security issue here

Report through the private channel above rather than the ordinary
Feedback Guide if the issue is any of: a way to read another
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

**This applies to the private channel too.** A private advisory is not a
safe place to put secrets either — it is still stored on a third party's
servers, and it may later be published.

Never include, in a first report:

- your passphrase, Master Seed, recovery code, `nsec`, or any private
  key material;
- a copy of your profile directory, database, or Archive export;
- another person's message contents or personal information;
- personal relay credentials, auth tokens, or API keys.

Describe the issue and how to reproduce it using **synthetic or test
data**. If a maintainer needs a specific artifact to investigate
further, they will ask for it explicitly, over the same private channel,
and explain why.

### Safe first-report checklist

Before you submit, confirm:

- [ ] I am using **GitHub Private Vulnerability Reporting**, not a
      public Issue, Discussion, or pull request.
- [ ] I reproduced this against a **throwaway profile**, not my real
      one, wherever that was possible.
- [ ] My report contains **no** private key, `nsec`, Master Seed,
      passphrase, or recovery code.
- [ ] I have attached **no** profile directory, database file, or
      Archive export.
- [ ] My report contains **no** real message plaintext and **no** third
      party's personal data.
- [ ] I have attached **no** personal relay credentials, tokens, or API
      keys.
- [ ] Any logs or screenshots are **redacted** — npubs, contact names,
      and message text removed.
- [ ] I have checked `KNOWN_LIMITATIONS.md`, in case this is an
      already-disclosed limitation rather than a new finding.
- [ ] I have said what the **impact** is, not only what the bug is.

### Encryption key request policy

No maintainer will ever ask you for your passphrase, Master Seed,
recovery code, or any raw private key material — this Beta has no
password-reset or key-escrow mechanism, and nobody legitimately needs
these to investigate a report. Treat any request for them, from anyone
claiming to be a maintainer, as itself a security incident.

### Expected acknowledgement

**There is no response-time commitment, and none is invented here.**
FedOS is maintained by a very small team without a staffed on-call
rotation. Reports are read and taken seriously, but you should not
assume a fixed acknowledgement or fix window, and you should not treat
silence as dismissal.

If a real service-level commitment is ever made, it will be stated here
explicitly, with the actual numbers.

### Disclosure coordination

Please allow the maintainers a reasonable opportunity to investigate and
address a report before disclosing it publicly. **No specific
coordinated-disclosure timeline is fixed here** — inventing a number
this project cannot currently honour would be worse than admitting there
isn't one.

In practice: tell us what you found, tell us if and when you intend to
publish, and we will tell you honestly whether that is achievable. If
you believe users are at active risk and we are not moving, say so —
that is a legitimate reason to accelerate, and we would rather hear it
from you than read it elsewhere.

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

If you are in the Closed Pilot specifically:

- **Security findings** — use GitHub Private Vulnerability Reporting
  (see "Where to report" above). If you have confirmed that link is not
  yet enabled, fall back to the contact route your pilot coordinator
  gave you directly.
- **Everything else** — public Issues and Discussions, or the pilot
  feedback route in
  [`docs/pilot/FEEDBACK.md`](docs/pilot/FEEDBACK.md).
- **When to stop using the build entirely** —
  [`docs/pilot/STOP_USE_CRITERIA.md`](docs/pilot/STOP_USE_CRITERIA.md).

See `docs/desktop_beta_feedback_guide.md` for the distinction between
ordinary feedback and a security report.

## Scope notes

- This is a Beta build. Treat it as suitable for testing and feedback, not
  for protecting information where compromise would cause serious harm.
- See `KNOWN_LIMITATIONS.md`, `ARCHITECTURE.md`, and the in-app Safety
  Center for the current, real, per-subsystem security state.
