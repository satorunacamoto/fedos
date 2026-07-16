# Secure Runtime Alpha 688 — Binding Authority Interface

Stage 8 of Phase A. Introduces
`src/board/runtime/identity/fedos_nostr_author_binding_authority.ts`:

```ts
export interface FedosNostrAuthorBindingAuthority {
  verifyBinding(input: {
    readonly author: FedosBoardAuthorReference;
    readonly accountIndex: number;
  }): Promise<FedosNostrAuthorBindingResult>;
}
```

`FedosSigningAuthorityNostrAuthorBinding` is the one production
implementation:

**Responsibilities:** validate `author.protocol === "nostr"`; validate the
hex shape of `author.publicIdentifier` (Alpha 687); call
`signingAuthority.publicIdentityForAccount(accountIndex)`; compare exactly
(`===` on the two hex strings); return a coarse result.

**Non-responsibilities:** signing, publishing, policy, Outbox, Relay,
retry, observation — this class imports none of those, confirmed by its
own file's import list.

Verified in
`test/secure_runtime_alpha_688_nostr_author_binding_authority.test.ts` (9
tests): bound, author-not-nostr (all four non-nostr protocols),
invalid-author-identifier (npub form, uppercase hex, wrong length),
signing-authority-unavailable, public-key-mismatch, cross-account
independence, and never-calls-`signEvent`.
