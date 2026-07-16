# Secure Runtime Alpha 690 — Public Author Authority Assembly

Stage 10 of Phase A.

## Options compared

A. derive public author directly from Signing Authority. B. retain
Desktop reader but verify binding on each outbound request. C. configure
both from a shared account authority.

## Decision: A and B together (the smallest safe combination)

- **A** is implemented as `FedosNostrSigningPublicAuthorAuthority`
  (Alpha 691) — an optional, additive `FedosPublicAuthorAuthority` a
  caller may inject when it wants "author == this signing account,
  always, by construction."
- **B** is already what every command gets *unconditionally*: whichever
  `FedosPublicAuthorAuthority` `FedosBoardRuntime` is configured with (the
  default `FedosDesktopPublicAuthorAuthority`, or A above, or any future
  authority), the resolved `"nostr"`-protocol author is independently
  verified against the configured Signing Authority via
  `FedosNostrAuthorBindingAuthority` before any Nostr target is ever
  eligible (Alpha 694/698).
- **C** is subsumed: since B checks the SAME Signing Authority regardless
  of which Author Authority resolved the author, a caller wiring the
  Desktop reader to whatever identity source and the Signing Authority to
  whatever Master Seed effectively gets "shared account authority" the
  moment both agree — verified, not assumed.

This directly satisfies the objective's own instruction: no runtime keeps
"one independent public identity source" and "one independent Master Seed
signer" merely hoping their public keys match — either the author IS
derived from the signer (A), or the match is cryptographically checked
before it is ever trusted (B).

Existing imported identity readers are never globally replaced — this
remains entirely opt-in configuration.
