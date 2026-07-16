# Secure Runtime Alpha 692 — Anonymous and Imported Author Safety

Stage 12 of Phase A.

## Verified guarantees

- **Anonymous-local cannot bind.** `anonymousLocalAuthorReference()`
  (`src/board/runtime/fedos_board_runtime_author_authority.ts`) always
  sets `protocol: "fedos"`. `FedosSigningAuthorityNostrAuthorBinding.verifyBinding()`
  returns `"author-not-nostr"` for any non-`"nostr"` protocol — an
  anonymous-local author can never even reach the hex/derivation checks.
  `FedosBoardRuntime` additionally never calls the Binding Authority at
  all unless the resolved author's protocol is already `"nostr"` (Alpha
  698).
- **ActivityPub/AT Protocol/Session authors cannot bind.** Same
  `"author-not-nostr"` guard covers all three — tested explicitly in
  `test/secure_runtime_alpha_688_nostr_author_binding_authority.test.ts`
  test 2 (loops over `activitypub`/`atproto`/`session`/`fedos`).
- **An imported Nostr author with a different pubkey cannot bind.**
  `"public-key-mismatch"` — the core anti-impersonation guard, tested in
  test 5/6 of the same file.
- **An imported Nostr author with an equal pubkey** still requires the
  Signing Authority to independently confirm the SAME key for the
  configured account — equality alone is never trusted without that
  independent derivation (Permanent Invariant #7).
- **A caller cannot inject an author.** Binding always operates on
  whatever `FedosPublicAuthorAuthority` already resolved — no command
  parameter of any kind lets a caller supply an author or override the
  account index (Alpha 689).

No accidental bridge impersonation path exists: the only way a
`"nostr"`-protocol author ever becomes eligible is if the configured
Signing Authority itself derives the identical hex for the configured
account.
