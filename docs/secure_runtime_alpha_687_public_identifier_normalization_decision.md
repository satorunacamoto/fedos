# Secure Runtime Alpha 687 — Public Identifier Normalization Decision

Stage 7 of Phase A.

## Options compared

A. hex only. B. npub only. C. both via a reviewed decoder. D. descriptor
carries a structured Nostr identity form.

## Decision: A — hex only

No Bech32 *decoder* exists anywhere in this repository (Alpha 173 only
ever added an *encoder*, `bech32_encode`, never `bech32_decode`). Adding
one would be new code with real parsing-correctness risk, purely to
support a form this Arc's own signing-side output (Alpha 683) does not
even produce.

`FedosSigningAuthorityNostrAuthorBinding.verifyBinding()`
(`src/board/runtime/identity/fedos_nostr_author_binding_authority.ts`)
therefore requires `author.publicIdentifier` to already match
`/^[0-9a-f]{64}$/` — an `npub1...`-form identifier, an uppercase hex
string, or a wrong-length string all fail closed to
`"invalid-author-identifier"` rather than being decoded or guessed at.
"Matching strings alone are not sufficient" (Permanent Invariant #7) is
honored strictly: no string-prefix guessing is performed anywhere.

## Known V1 limitation

A local Nostr identity source configured to surface an `npub`-form
`publicIdentifier` (rather than hex) will never bind, even if it is
genuinely the same key. This is an intentional, honestly-documented
narrowing — not a silent gap — and is the concrete reason `FedosDesktopPublicAuthorAuthority`-based
setups should prefer a hex-emitting identity source, or use
`FedosNostrSigningPublicAuthorAuthority` (Alpha 690/691), which always
emits hex.

No new Bech32 dependency was added, per the task's explicit requirement.
