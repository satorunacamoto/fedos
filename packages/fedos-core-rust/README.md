# @nostr-window/fedos-core-rust

The **FedOS crypto core** package boundary — the INTENDED future home of a
RustCrypto-backed WASM/FFI crypto core, kept as a standalone package so the host
app depends only on its *contract*, never on its internals.

> **Status: Stage 75 — RFC 8439 ChaCha20-Poly1305 vectors wired to
> `cargo test`. Public API STILL a placeholder SKELETON. No cryptography
> reachable from any public function. No WASM.**
> This package ships the TypeScript `FedosCoreCrypto` seam, a permanently-inert
> `PlaceholderFedosCoreCrypto`, and (Stage 69) a **minimal Rust crate skeleton**
> (`Cargo.toml` + `src/lib.rs`) with **placeholder functions only**. That public
> API — `fedos_core_status`, `fedos_core_capabilities`,
> `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
> `decrypt_placeholder` — is UNCHANGED since Stage 69. Stage 74 added exactly
> ONE Rust *production* dependency, `chacha20poly1305` (RustCrypto,
> `default-features = false`, `features = ["alloc"]` — no `getrandom`).
> Stage 75 adds a `cfg(test)`-only module, `rfc8439_vectors`, at the bottom of
> `src/lib.rs`: it reads the official RFC 8439 known-answer vector file
> ([`test-vectors/aead/chacha20poly1305-rfc8439.json`](../../test-vectors/aead/chacha20poly1305-rfc8439.json),
> imported verbatim Stage 73) via `include_str!` and asserts
> `chacha20poly1305` both seals plaintext+AAD to the RFC's exact
> ciphertext‖tag and opens that ciphertext‖tag back to the RFC's exact
> plaintext — **`cargo test` now verifies ChaCha20-Poly1305 vector
> correctness.** This is verification WIRING only: there is still **no public
> encrypt/decrypt implementation** anywhere in this crate, nothing outside
> `cfg(test)` imports or calls `chacha20poly1305`, and nothing here —
> TypeScript or Rust, production or test — derives a key or generates
> randomness. The Rust crate still has no `wasm-bindgen`, no `unsafe`, and
> produces **no `.wasm`**; the runtime/Worker/`CryptoProvider` are **not**
> wired to any of this. A real RustCrypto-backed core is a future,
> explicitly-reviewed stage that must pass the full crypto test-vector plan
> ([`docs/crypto_test_vectors.md`](../../docs/crypto_test_vectors.md)) and ship a
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
- No PUBLIC AEAD implementation — `chacha20poly1305` is exercised ONLY inside
  the `cfg(test)`-only `rfc8439_vectors` module added Stage 75, to check the
  dependency against the RFC 8439 vectors; no production code path imports,
  calls, or exercises it, and there is still no ChaCha20-Poly1305 /
  XChaCha20-Poly1305 / AES-GCM encrypt/decrypt function any caller can reach
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
  Cargo.toml     — Rust crate skeleton (v0.0.0, edition 2021, rlib) + chacha20poly1305 dependency (Stage 74) + serde/serde_json/hex dev-dependencies (Stage 75)
  src/index.ts   — entry point: FedosCoreCrypto seam + PlaceholderFedosCoreCrypto / createFedosCoreCrypto
  src/types.ts   — FedosCoreCrypto contract, status/decision/capability, request shapes (imports nothing)
  src/wasm_loader.ts — WASM loader seam (Noop/Placeholder) — loads nothing (Stage 63)
  src/lib.rs     — Rust placeholder API (status/capabilities + *_placeholder fns), UNCHANGED since Stage 69 — NO crypto, NO unsafe, NO WASM in the public API; a `cfg(test)`-only `rfc8439_vectors` module (Stage 75) verifies chacha20poly1305 against RFC 8439
```

The Rust `src/lib.rs` mirrors the TS `FedosCoreCrypto` shape with placeholder-only
functions (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`) — each returns an `Unavailable` / `Placeholder`
`FedosCoreStatus` and runs no cryptography. `#![forbid(unsafe_code)]` bans
`unsafe`. No WASM target is declared; nothing compiles to `.wasm`.

## Dependencies (Stage 74 production + Stage 75 dev-dependencies)

- **`chacha20poly1305` v0.11.0** (RustCrypto, Apache-2.0 OR MIT,
  `default-features = false`, `features = ["alloc"]`) — the only entry in
  `[dependencies]` (production). Pulls in, transitively, only other
  RustCrypto/utility crates (`aead`, `chacha20`, `cipher`, `poly1305`,
  `crypto-common`, `inout`, `hybrid-array`, `universal-hash`, `block-buffer`,
  `typenum`, `cfg-if`, `cpufeatures`, `libc`, `cmov`, `ctutils` — 16 packages
  total per `cargo check`'s dependency-resolution output) — **no `getrandom`,
  no `rand`/`rand_core`, no `zeroize`, no build script (`build.rs`) in any of
  them.** Several of the lower-level crates (`chacha20`, `poly1305`, `cipher`,
  `aead`, `cpufeatures`) use `unsafe` internally for SIMD backends / CPU
  feature detection — `chacha20poly1305` itself does not; this crate's own
  `#![forbid(unsafe_code)]` is unaffected (it governs this crate's code, not a
  dependency's). MSRV for `chacha20poly1305` 0.11.0 is Rust 1.85; this repo's
  toolchain is newer, so no MSRV bump was needed. As of Stage 75, this
  dependency is exercised — but only inside `cfg(test)`, by the
  `rfc8439_vectors` module (see below).
- **`[dev-dependencies]` (Stage 75, test-only, NOT production dependencies):**
  `serde` v1.0.228 (`features = ["derive"]`), `serde_json` v1.0.150, `hex`
  v0.4.3. Used exclusively by the `cfg(test)`-only `rfc8439_vectors` module in
  `src/lib.rs` to parse
  [`test-vectors/aead/chacha20poly1305-rfc8439.json`](../../test-vectors/aead/chacha20poly1305-rfc8439.json)
  and decode its hex fields; none is reachable from `src/lib.rs`'s public API
  or from any non-test code path.
- See
  [`docs/rust_dependency_adoption.md`](../../docs/rust_dependency_adoption.md)
  for the full adoption record and policy. **`Cargo.lock` is intentionally NOT
  committed** (library crate; reproducibility via a lockfile digest is
  deferred to the future build-manifest stage,
  [`docs/fedos_core_build_manifest.md`](../../docs/fedos_core_build_manifest.md)).

## RFC 8439 vector wiring (Stage 75)

`src/lib.rs`'s bottom-most module, `rfc8439_vectors` (gated `#[cfg(test)]`,
compiled only for `cargo test`), reads
[`test-vectors/aead/chacha20poly1305-rfc8439.json`](../../test-vectors/aead/chacha20poly1305-rfc8439.json)
at compile time via `include_str!` and runs three tests:

- `rfc8439_json_parses_and_is_non_empty` — the vector file parses and is
  non-empty.
- `rfc8439_positive_vectors_encrypt_and_decrypt_correctly` — for every
  `shouldPass: true` vector, `chacha20poly1305` both seals (encrypts)
  plaintext+AAD to exactly the RFC's expected ciphertext‖tag, and opens
  (decrypts) that same ciphertext‖tag back to exactly the RFC's expected
  plaintext.
- `rfc8439_negative_vectors_fail_to_decrypt_if_present` — for every
  `shouldPass: false` vector (none exist in the current file; RFC 8439
  publishes no byte-level tamper vector for this construction, and none is
  fabricated per [`docs/crypto_vector_sources.md`](../../docs/crypto_vector_sources.md)
  §2), decryption/authentication must fail. This loop runs zero iterations
  today and trivially passes; it starts enforcing automatically if a future,
  explicitly-reviewed re-import ever adds an official negative case.

This is the "wired" step of the vector lifecycle in
[`docs/verification_infrastructure.md`](../../docs/verification_infrastructure.md)
§5 for ChaCha20-Poly1305 — it does not, by itself, make any public API real:
`encrypt_placeholder`/`decrypt_placeholder` are unchanged, and the runtime
still selects only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.
