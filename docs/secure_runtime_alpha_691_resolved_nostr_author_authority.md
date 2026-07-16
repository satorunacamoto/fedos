# Secure Runtime Alpha 691 — Resolved Nostr Author Authority

Stage 11 of Phase A. Implements
`FedosNostrSigningPublicAuthorAuthority`
(`src/board/runtime/identity/fedos_nostr_signing_public_author_authority.ts`),
backed by a `FedosNostrSigningAuthority` + explicit `accountIndex`:

- Returns a resolved `FedosBoardAuthorReference` whose `publicIdentifier`
  IS `publicIdentityForAccount(accountIndex)`'s own `publicKeyHex` —
  sourced from the actual controlled Nostr key, never a separately
  configured/guessed value.
- No secret is ever touched or returned.
- Deterministic; account index explicit (constructor argument, not
  inferred).
- No network/profile lookup, no mutation.
- `identityId` is always `null` — an explicit policy choice (this
  authority has no local `FedosIdentityRecord` to link), not an omission.
- `displayName`/`avatar` are never populated, matching
  `FedosBoardAuthorReference`'s own permanent exclusion of both.
- Local authority only — never wired as any global default; existing
  imported identity readers (`FedosDesktopPublicAuthorAuthority` remains
  the unchanged default) are untouched.

Verified in
`test/secure_runtime_alpha_690_nostr_signing_public_author_authority.test.ts`
(5 tests, including one proving a self-assembled author always binds
against the same signing authority/account by construction).
