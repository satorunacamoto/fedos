# @nostr-window/fedos-core-rust

The **FedOS crypto core** package boundary — the INTENDED future home of a
RustCrypto-backed WASM/FFI crypto core, kept as a standalone package so the host
app depends only on its *contract*, never on its internals.

> **Status: Stage 74 — Rust crate SKELETON + first dependency
> (`chacha20poly1305`). Still no cryptography. No WASM.**
> This package ships the TypeScript `FedosCoreCrypto` seam, a permanently-inert
> `PlaceholderFedosCoreCrypto`, and (Stage 69) a **minimal Rust crate skeleton**
> (`Cargo.toml` + `src/lib.rs`) with **placeholder functions only**. `src/lib.rs`
> is UNCHANGED since Stage 69. Stage 74 adds exactly ONE Rust dependency,
> `chacha20poly1305` (RustCrypto, `default-features = false`, `features =
> ["alloc"]` — no `getrandom`), to `Cargo.toml` — a **dependency + build check
> only**; nothing imports, calls, or exercises it anywhere in this crate yet.
> Nothing here — TypeScript or Rust — encrypts, decrypts, derives a key, or
> generates randomness. The Rust crate still has no `wasm-bindgen`, no
> `unsafe`, and produces **no `.wasm`**. A real RustCrypto-backed core is a
> future, explicitly-reviewed stage that must FIRST wire the RFC 8439 test
> vectors ([`test-vectors/aead/chacha20poly1305-rfc8439.json`](../../test-vectors/aead/chacha20poly1305-rfc8439.json))
> to `cargo test`, pass the full crypto test-vector plan
> ([`docs/crypto_test_vectors.md`](../../docs/crypto_test_vectors.md)), and ship a
> build manifest ([`docs/fedos_core_build_manifest.md`](../../docs/fedos_core_build_manifest.md))
> before it can be selected at runtime. See also
> [`docs/vault_crypto_identity.md`](../../docs/vault_crypto_identity.md) and
> [`docs/rust_dependency_adoption.md`](../../docs/rust_dependency_adoption.md).

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
- No AEAD *implementation* — `chacha20poly1305` is a Cargo dependency as of
  Stage 74, but is not imported, called, or exercised by any code in this
  crate; there is still no ChaCha20-Poly1305 / XChaCha20-Poly1305 / AES-GCM
  encrypt/decrypt anywhere
- No CSPRNG / random generation (the dependency's default `getrandom` feature
  is explicitly disabled)
- No BIP39 / BIP32
- No NIP-44
- No zeroize / secrecy / subtle
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
packages/fedos-core-rust
  Cargo.toml     — Rust crate skeleton (v0.0.0, edition 2021, rlib) + chacha20poly1305 dependency — Stage 69 / 74
  src/index.ts   — entry point: FedosCoreCrypto seam + PlaceholderFedosCoreCrypto / createFedosCoreCrypto
  src/types.ts   — FedosCoreCrypto contract, status/decision/capability, request shapes (imports nothing)
  src/wasm_loader.ts — WASM loader seam (Noop/Placeholder) — loads nothing (Stage 63)
  src/lib.rs     — Rust placeholder API (status/capabilities + *_placeholder fns) — NO crypto, NO unsafe, NO WASM, UNCHANGED since Stage 69
```

The Rust `src/lib.rs` mirrors the TS `FedosCoreCrypto` shape with placeholder-only
functions (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`) — each returns an `Unavailable` / `Placeholder`
`FedosCoreStatus` and runs no cryptography. `#![forbid(unsafe_code)]` bans
`unsafe`. No WASM target is declared; nothing compiles to `.wasm`.

## Dependencies (Stage 74)

- **`chacha20poly1305` v0.11.0** (RustCrypto, Apache-2.0 OR MIT,
  `default-features = false`, `features = ["alloc"]`) — the only dependency in
  `Cargo.toml`. Not imported or used by `src/lib.rs`; `cargo check` resolves
  and builds the dependency graph, nothing more. Pulls in, transitively, only
  other RustCrypto/utility crates (`aead`, `chacha20`, `cipher`, `poly1305`,
  `crypto-common`, `inout`, `hybrid-array`, `universal-hash`, `block-buffer`,
  `typenum`, `cfg-if`, `cpufeatures`, `libc`, `cmov`, `ctutils` — 16 packages
  total per `cargo check`'s dependency-resolution output) — **no `getrandom`,
  no `rand`/`rand_core`, no `zeroize`, no build script (`build.rs`) in any of
  them.** Several of the lower-level crates (`chacha20`, `poly1305`, `cipher`,
  `aead`, `cpufeatures`) use `unsafe` internally for SIMD backends / CPU
  feature detection — `chacha20poly1305` itself does not; this crate's own
  `#![forbid(unsafe_code)]` is unaffected (it governs this crate's code, not a
  dependency's). MSRV for `chacha20poly1305` 0.11.0 is Rust 1.85; this repo's
  toolchain is newer, so no MSRV bump was needed. See
  [`docs/rust_dependency_adoption.md`](../../docs/rust_dependency_adoption.md)
  for the full adoption record and policy. **`Cargo.lock` is intentionally NOT
  committed** (library crate; reproducibility via a lockfile digest is
  deferred to the future build-manifest stage,
  [`docs/fedos_core_build_manifest.md`](../../docs/fedos_core_build_manifest.md)).
