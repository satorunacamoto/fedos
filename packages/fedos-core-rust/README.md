# @nostr-window/fedos-core-rust

The **FedOS crypto core** package boundary — the INTENDED future home of a
RustCrypto-backed WASM/FFI crypto core, kept as a standalone package so the host
app depends only on its *contract*, never on its internals.

> **Status: Stage 59 — package boundary only. No Rust. No WASM. No cryptography.**
> This package ships the `FedosCoreCrypto` seam and a permanently-inert
> `PlaceholderFedosCoreCrypto`. Nothing here encrypts, decrypts, derives a key,
> or generates randomness. See [`docs/vault_crypto_identity.md`](../../docs/vault_crypto_identity.md).

## What this is

A TypeScript boundary package. A real Rust/WASM core is meant to drop in later
behind `FedosCoreCrypto`, without the host, the Vault seam, or the identity
layer depending on any concrete implementation.

The host reaches this package ONLY through its own adapter,
`FedosCoreCryptoProvider` (`src/crypto/fedos_core_adapter.ts`), which maps this
seam onto the host's `CryptoProvider` interface (`src/crypto/types.ts`).

## API (`FedosCoreCrypto`)

```ts
getStatus(): FedosCoreStatus                 // { state, reason } — "unavailable" here
getCapabilities(): readonly FedosCoreCapability[]  // placeholder labels of intent only
randomBytes(request): Promise<FedosCoreDecision>   // generates NONE
deriveKey(request): Promise<FedosCoreDecision>     // derives NONE
encrypt(request): Promise<FedosCoreDecision>       // encrypts NOTHING
decrypt(request): Promise<FedosCoreDecision>       // decrypts NOTHING
```

Every operation resolves to a non-sensitive `FedosCoreDecision`
(`{ allowed, state, reason }`) — never throws, and carries **no output/bytes
field** because nothing is computed. `PlaceholderFedosCoreCrypto` /
`createFedosCoreCrypto()` are the safe, always-`unavailable` default.

## Hard guardrails (this stage implements NONE of these)

- No HKDF / Argon2 / any KDF, no key derivation
- No AEAD, no ChaCha20-Poly1305 / XChaCha20-Poly1305, no AES-GCM, no encrypt/decrypt
- No CSPRNG / random generation
- No BIP39 / BIP32
- No NIP-44
- No zeroize
- No WebAuthn / passkey, no Secure Enclave, no Apple/Google enclave integration
- Handles no secret bytes: requests carry OPAQUE, non-secret handles/labels only

## No secrets on this boundary

Requests carry only opaque handles (`keyRef`, `plaintextRef`, `ciphertextRef`)
and non-secret labels (`purpose`, `aad`, algorithm/KDF names) — never raw key
material, seeds, passphrases, plaintext, or ciphertext. A future Rust core would
hold secret bytes internally on its own side and resolve handles there. This
boundary neither transports nor stores secret material, and makes **no**
security/confidentiality/"safe storage" guarantee.

## Future replacement point

When a real core lands, it implements `FedosCoreCrypto` here (Rust compiled to
WASM, or an FFI module) and is selected in place of
`PlaceholderFedosCoreCrypto`. The host adapter and the `CryptoProvider`
interface do not change. It is **not** wired into the runtime or the Worker in
this stage.

```
packages/fedos-core-rust/src
  index.ts   — entry point: FedosCoreCrypto seam + PlaceholderFedosCoreCrypto / createFedosCoreCrypto
  types.ts   — FedosCoreCrypto contract, status/decision/capability, request shapes (imports nothing)
```
