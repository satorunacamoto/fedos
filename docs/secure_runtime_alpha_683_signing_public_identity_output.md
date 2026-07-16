# Secure Runtime Alpha 683 — Signing Public Identity Output

Stage 3 of Phase A. Defines `FedosNostrSigningPublicIdentity`
(`src/nostr/sign/fedos_nostr_signing_public_identity.ts`):

```ts
export interface FedosNostrSigningPublicIdentity {
  readonly accountIndex: number;
  readonly publicKeyHex: string;
}
```

## Reviewed against the candidate

The candidate considered an optional `npub: string | null` field. This Arc
adopts the **preferred minimum**: `accountIndex` + canonical 64-character
lowercase hex only — no `npub`, no secret handle, no signing handle, no
root handle, no `nsec`, no arbitrary metadata.

Reasons `npub` is omitted:

- No Bech32 *decoder* exists anywhere in this repository (only an
  *encoder*, `nostr_identifier_encoding::bech32_encoding::bech32_encode`),
  and Alpha 687 decides binding comparison is hex-only — an `npub` field
  on this type would be dead weight with no consumer.
- Keeping the output to exactly two fields minimizes what a future reader
  could mistake for something richer (a profile, a capability, a
  credential).

`isWellFormedFedosNostrSigningPublicIdentity()` provides pure structural
validation (never a proof of key control by itself — see Alpha 688).

Verified in `test/secure_runtime_alpha_684_signing_public_identity.test.ts`.
