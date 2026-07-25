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
