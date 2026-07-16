# Secure Runtime Alpha 684 — Signing Public Identity Method

Stage 4 of Phase A. Adds one additive method to `FedosNostrSigningAuthority`
(`src/nostr/sign/fedos_nostr_signing_authority.ts`):

```ts
publicIdentityForAccount(accountIndex: number): Promise<FedosNostrSigningPublicIdentity | null>;
```

Implemented in `FedosWasmNostrSigningAuthority`
(`src/nostr/sign/fedos_wasm_nostr_signing_authority.ts`):

- Validates `accountIndex` as a `u32` before ever reaching the WASM
  boundary (mirrors `signEvent()`'s own validation discipline).
- Calls the new `attemptDevOnlyNostrPublicIdentityForAccountCall()` loader
  boundary method (`src/runtime/fedos_wasm_loader.ts`), which itself calls
  `authority.public_key_hex_for_account(accountIndex)` — the one new Rust
  export (Alpha 685).
- No signing occurs. No Relay. No Board. No Outbox. No cache beyond
  whatever the authority already owns.
- Deterministic: the same account index against the same held Master Seed
  always returns the same hex.
- Fails closed to `null` on any missing Master Seed, any derivation
  failure, or a malformed/non-canonical hex value returned from the
  boundary (never trusts an injected boundary blindly).

Reuses the existing public-key encoder
(`nostr_identifier_encoding::encode_nostr_public_key_hex_internal`) exactly
as instructed — no new encoding logic.

Verified in `test/secure_runtime_alpha_684_signing_public_identity.test.ts`
(7 tests: success, unavailable authority, boundary failure, malformed hex
rejection, out-of-range account index rejected before the boundary is
reached, never signs, structural validator).
