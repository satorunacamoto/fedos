# @nostr-window/fedos-core-rust

The **FedOS crypto core** package boundary — the INTENDED future home of a
RustCrypto-backed WASM/FFI crypto core, kept as a standalone package so the host
app depends only on its *contract*, never on its internals.

> **Status: Stage 76 — Adopt `hkdf` dependency (build check only; no HKDF
> implementation, no vector wiring, no `deriveKey` implementation, no WASM
> change). Public API STILL a placeholder SKELETON. No cryptography reachable
> from any public function.**
> This package ships the TypeScript `FedosCoreCrypto` seam, a permanently-inert
> `PlaceholderFedosCoreCrypto`, and (Stage 69) a **minimal Rust crate skeleton**
> (`Cargo.toml` + `src/lib.rs`) with **placeholder functions only**. That public
> API — `fedos_core_status`, `fedos_core_capabilities`,
> `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
> `decrypt_placeholder` — is UNCHANGED since Stage 69. Stage 74 added
> `chacha20poly1305` (RustCrypto AEAD, `default-features = false`, `features =
> ["alloc"]` — no `getrandom`), wired to the RFC 8439 vectors under
> `cfg(test)` in Stage 75 — see the "RFC 8439 vector wiring" section below.
> Stage 76 adds a SECOND `[dependencies]` (production) entry, **`hkdf`**
> v0.13.0 (RustCrypto KDF) — a dependency + build-check ADOPTION ONLY,
> exactly like Stage 74: nothing imports, calls, or exercises `hkdf`
> anywhere in this crate yet (production or `cfg(test)`), `derive_key_placeholder`
> is byte-for-byte unchanged, and no RFC 5869 HKDF-SHA256 vector (imported
> Stage 73 at
> [`test-vectors/kdf/hkdf-rfc5869.json`](../../test-vectors/kdf/hkdf-rfc5869.json))
> is loaded or wired yet. `sha2` is deliberately NOT added this stage — see
> "Dependencies" below for why. The Rust crate still has no `wasm-bindgen`, no
> `unsafe`, and produces **no `.wasm`**; the runtime/Worker/`CryptoProvider`
> are **not** wired to any of this. A real RustCrypto-backed core is a future,
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

- No HKDF implementation and no key derivation — `hkdf` is a Cargo
  dependency as of Stage 76, but is not imported, called, or exercised by
  any code in this crate (production or `cfg(test)`); `derive_key_placeholder`
  is unchanged and still does no real work
- No Argon2 / any other KDF
- No PUBLIC AEAD implementation — `chacha20poly1305` is exercised ONLY inside
  the `cfg(test)`-only `rfc8439_vectors` module added Stage 75, to check the
  dependency against the RFC 8439 vectors; no production code path imports,
  calls, or exercises it, and there is still no ChaCha20-Poly1305 /
  XChaCha20-Poly1305 / AES-GCM encrypt/decrypt function any caller can reach
- No CSPRNG / random generation (chacha20poly1305's default `getrandom`
  feature is explicitly disabled; `hkdf` pulls in no `rand`/`getrandom`
  either)
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
  Cargo.toml     — Rust crate skeleton (v0.0.0, edition 2021, rlib) + chacha20poly1305 dependency (Stage 74) + serde/serde_json/hex dev-dependencies (Stage 75) + hkdf dependency (Stage 76)
  src/index.ts   — entry point: FedosCoreCrypto seam + PlaceholderFedosCoreCrypto / createFedosCoreCrypto
  src/types.ts   — FedosCoreCrypto contract, status/decision/capability, request shapes (imports nothing)
  src/wasm_loader.ts — WASM loader seam (Noop/Placeholder) — loads nothing (Stage 63)
  src/lib.rs     — Rust placeholder API (status/capabilities + *_placeholder fns), UNCHANGED since Stage 69 — NO crypto, NO unsafe, NO WASM in the public API; a `cfg(test)`-only `rfc8439_vectors` module (Stage 75) verifies chacha20poly1305 against RFC 8439; hkdf is not referenced anywhere yet
```

The Rust `src/lib.rs` mirrors the TS `FedosCoreCrypto` shape with placeholder-only
functions (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`) — each returns an `Unavailable` / `Placeholder`
`FedosCoreStatus` and runs no cryptography. `#![forbid(unsafe_code)]` bans
`unsafe`. No WASM target is declared; nothing compiles to `.wasm`.

## Dependencies (Stage 74/76 production + Stage 75 dev-dependencies)

- **`chacha20poly1305` v0.11.0** (RustCrypto, Apache-2.0 OR MIT,
  `default-features = false`, `features = ["alloc"]`) — one of two entries in
  `[dependencies]` (production). Pulls in, transitively, only other
  RustCrypto/utility crates (`aead`, `chacha20`, `cipher`, `poly1305`,
  `crypto-common`, `inout`, `hybrid-array`, `universal-hash`, `block-buffer`,
  `typenum`, `cfg-if`, `cpufeatures`, `cmov`, `ctutils` — plus itself) — **no
  `getrandom`, no `rand`/`rand_core`, no `zeroize`, no build script
  (`build.rs`) in any of them.** Several of the lower-level crates
  (`chacha20`, `poly1305`, `cipher`, `aead`, `cpufeatures`) use `unsafe`
  internally for SIMD backends / CPU feature detection — `chacha20poly1305`
  itself does not; this crate's own `#![forbid(unsafe_code)]` is unaffected
  (it governs this crate's code, not a dependency's). MSRV for
  `chacha20poly1305` 0.11.0 is Rust 1.85; this repo's toolchain is newer, so
  no MSRV bump was needed. As of Stage 75, this dependency is exercised — but
  only inside `cfg(test)`, by the `rfc8439_vectors` module (see below).
- **`hkdf` v0.13.0** (RustCrypto, MIT OR Apache-2.0, default features) — the
  other entry in `[dependencies]` (production), adopted Stage 76. Adds three
  NEW transitive packages beyond what `chacha20poly1305` already pulls in:
  `hkdf` itself, `hmac` (its only dependency), and `digest` (`hmac`'s only
  dependency; `digest` is also shared/reused by `crypto-common` already in
  the tree from `chacha20poly1305`). No `build.rs` in any of the three; no
  `unsafe` in any of the three either — `digest` itself declares
  `#![forbid(unsafe_code)]`. `hkdf`'s only optional feature, `kdf` (an
  unrelated trait-abstraction crate), is NOT enabled — default features are
  used as-is. MSRV for `hkdf` 0.13.0 is Rust 1.85, same as `chacha20poly1305`;
  no toolchain change was needed. **NOT imported or used anywhere in
  `src/lib.rs` yet** — production or `cfg(test)` — `cargo check`/`cargo test`
  resolve and build the dependency graph, nothing more.
  **`sha2` was deliberately NOT added this stage.** `hkdf` is generic over its
  digest algorithm: it depends only on `hmac`, which is itself generic over
  `digest`'s traits. Neither `hkdf` nor `hmac` requires a concrete hash
  algorithm crate to compile — `sha2` (the RustCrypto SHA-256 implementation)
  is only needed once code actually instantiates `Hkdf::<Sha256>`, which is
  Stage 77 candidate work (wiring
  [`test-vectors/kdf/hkdf-rfc5869.json`](../../test-vectors/kdf/hkdf-rfc5869.json),
  imported Stage 73) — not this stage.
- **`[dev-dependencies]` (Stage 75, test-only, NOT production dependencies):**
  `serde` v1.0.228 (`features = ["derive"]`), `serde_json` v1.0.150, `hex`
  v0.4.3. Used exclusively by the `cfg(test)`-only `rfc8439_vectors` module in
  `src/lib.rs` to parse
  [`test-vectors/aead/chacha20poly1305-rfc8439.json`](../../test-vectors/aead/chacha20poly1305-rfc8439.json)
  and decode its hex fields; none is reachable from `src/lib.rs`'s public API
  or from any non-test code path.
- See
  [`docs/rust_dependency_adoption.md`](../../docs/rust_dependency_adoption.md)
  for the full adoption record and policy (§12 has a dedicated `hkdf` — Stage
  76 entry). **`Cargo.lock` is intentionally NOT committed** (library crate;
  reproducibility via a lockfile digest is deferred to the future
  build-manifest stage,
  [`docs/fedos_core_build_manifest.md`](../../docs/fedos_core_build_manifest.md)).
  It was generated to run `cargo check`/`cargo test` this stage and then
  deleted, as in every prior dependency-adoption stage.

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

## `hkdf` dependency adoption (Stage 76)

`hkdf` v0.13.0 is now a `[dependencies]` (production) entry — see
"Dependencies" above for the full crate review. This stage is the "imported
as a dependency" step only, mirroring Stage 74's `chacha20poly1305` adoption:

- **No HKDF implementation.** No code anywhere in `src/lib.rs` — production
  or `cfg(test)` — imports `hkdf`, references `hkdf::`, or names `Hkdf`.
- **No vector wiring.** [`test-vectors/kdf/hkdf-rfc5869.json`](../../test-vectors/kdf/hkdf-rfc5869.json)
  (imported verbatim Stage 73) is not read by any Rust code yet; this
  dependency stays at vector-lifecycle step 2 ("imported"), not step 3
  ("wired") in [`docs/verification_infrastructure.md`](../../docs/verification_infrastructure.md)
  §5.
- **No `deriveKey` implementation.** `derive_key_placeholder` is
  byte-for-byte unchanged from Stage 69: it still calls `placeholder_status()`
  and does no real key derivation.
- **No Runtime / Worker / `CryptoProvider` wiring.** Nothing outside this
  package's own `Cargo.toml`/`Cargo.lock` changed; the host still selects
  only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

A future, explicitly-reviewed Stage 77 candidate is to wire the RFC 5869
HKDF-SHA256 vectors to `cargo test`, following the exact same pattern Stage
75 used for RFC 8439: a new `cfg(test)`-only module that reads the vector
file via `include_str!`, adds `sha2` as a dev-dependency (or a production
dependency, decided in that stage) to instantiate `Hkdf::<Sha256>`, and
asserts the known-answer `OKM` (output keying material) bytes — still no
public `deriveKey` implementation.
