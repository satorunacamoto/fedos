# @nostr-window/fedos-core-rust

The **FedOS crypto core** package boundary — the INTENDED future home of a
RustCrypto-backed WASM/FFI crypto core, kept as a standalone package so the host
app depends only on its *contract*, never on its internals.

> **Status: Stage 77 — Wire RFC 5869 HKDF-SHA256 vectors to Rust
> `cargo test` (verification wiring only; no public `deriveKey` API, no
> Runtime/Worker/CryptoProvider wiring, no WASM change). Public API STILL a
> placeholder SKELETON. No cryptography reachable from any public function.**
> This package ships the TypeScript `FedosCoreCrypto` seam, a permanently-inert
> `PlaceholderFedosCoreCrypto`, and (Stage 69) a **minimal Rust crate skeleton**
> (`Cargo.toml` + `src/lib.rs`) with **placeholder functions only**. That public
> API — `fedos_core_status`, `fedos_core_capabilities`,
> `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
> `decrypt_placeholder` — is UNCHANGED since Stage 69. Stage 74 added
> `chacha20poly1305` (RustCrypto AEAD, `default-features = false`, `features =
> ["alloc"]` — no `getrandom`), wired to the RFC 8439 vectors under
> `cfg(test)` in Stage 75 — see the "RFC 8439 vector wiring" section below.
> Stage 76 adopted a SECOND `[dependencies]` (production) entry, **`hkdf`**
> v0.13.0 (RustCrypto KDF), as a dependency + build-check ADOPTION ONLY.
> Stage 77 wires that dependency: `src/lib.rs` gains a new bottom-of-file
> `#[cfg(test)]`-only module, `rfc5869_vectors`, that reads
> [`test-vectors/kdf/hkdf-rfc5869.json`](../../test-vectors/kdf/hkdf-rfc5869.json)
> (imported verbatim Stage 73) via `include_str!` and asserts `hkdf::Hkdf::<sha2::Sha256>`
> reproduces the RFC's known-answer PRK and OKM bytes for all three official
> HKDF-SHA256 test cases — see the "RFC 5869 vector wiring" section below.
> `sha2` v0.11.0 is added this stage, but ONLY under `[dev-dependencies]`
> (test-only) — never a production dependency; see "Dependencies" below.
> `derive_key_placeholder` remains byte-for-byte unchanged and there is still
> **no public `deriveKey` implementation**. The Rust crate still has no
> `wasm-bindgen`, no `unsafe`, and produces **no `.wasm`**; the
> runtime/Worker/`CryptoProvider` are **not** wired to any of this. A real
> RustCrypto-backed core is a future, explicitly-reviewed stage that must pass
> the full crypto test-vector plan
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

- No PUBLIC HKDF / key derivation implementation — `hkdf` is exercised ONLY
  inside the `cfg(test)`-only `rfc5869_vectors` module added Stage 77, to
  check the dependency against the RFC 5869 vectors; no production code path
  imports, calls, or exercises it, and `derive_key_placeholder` is unchanged
  and still does no real work
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
  Cargo.toml     — Rust crate skeleton (v0.0.0, edition 2021, rlib) + chacha20poly1305 dependency (Stage 74) + serde/serde_json/hex dev-dependencies (Stage 75) + hkdf dependency (Stage 76) + sha2 dev-dependency (Stage 77)
  src/index.ts   — entry point: FedosCoreCrypto seam + PlaceholderFedosCoreCrypto / createFedosCoreCrypto
  src/types.ts   — FedosCoreCrypto contract, status/decision/capability, request shapes (imports nothing)
  src/wasm_loader.ts — WASM loader seam (Noop/Placeholder) — loads nothing (Stage 63)
  src/lib.rs     — Rust placeholder API (status/capabilities + *_placeholder fns), UNCHANGED since Stage 69 — NO crypto, NO unsafe, NO WASM in the public API; a `cfg(test)`-only `rfc8439_vectors` module (Stage 75) verifies chacha20poly1305 against RFC 8439; a second `cfg(test)`-only `rfc5869_vectors` module (Stage 77) verifies hkdf against RFC 5869
```

The Rust `src/lib.rs` mirrors the TS `FedosCoreCrypto` shape with placeholder-only
functions (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`) — each returns an `Unavailable` / `Placeholder`
`FedosCoreStatus` and runs no cryptography. `#![forbid(unsafe_code)]` bans
`unsafe`. No WASM target is declared; nothing compiles to `.wasm`.

## Dependencies (Stage 74/76 production + Stage 75/77 dev-dependencies)

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
  no toolchain change was needed. As of Stage 77, this dependency is
  exercised — but only inside `cfg(test)`, by the `rfc5869_vectors` module
  (see below); production code still neither imports nor calls it.
- **`[dev-dependencies]` (Stage 75/77, test-only, NOT production
  dependencies):** `serde` v1.0.228 (`features = ["derive"]`), `serde_json`
  v1.0.150, `hex` v0.4.3 (Stage 75) — used by the `cfg(test)`-only
  `rfc8439_vectors` module to parse
  [`test-vectors/aead/chacha20poly1305-rfc8439.json`](../../test-vectors/aead/chacha20poly1305-rfc8439.json)
  and decode its hex fields — plus **`sha2` v0.11.0** (Stage 77), used
  exclusively by the `cfg(test)`-only `rfc5869_vectors` module to instantiate
  `hkdf::Hkdf::<sha2::Sha256>` and verify it against
  [`test-vectors/kdf/hkdf-rfc5869.json`](../../test-vectors/kdf/hkdf-rfc5869.json).
  `sha2` v0.11.0 was chosen (not the older v0.10.x) because it depends on the
  same `digest` v0.11 generation as `hkdf` v0.13.0's `hmac` dependency — an
  older `sha2` v0.10.x pulls in `digest` v0.10, which does not satisfy the
  trait bounds `Hkdf<D>` requires (`cargo check --tests` fails to compile
  with a `CoreProxy`/`Sized` trait-bound mismatch if the two `digest`
  generations disagree). None of these four dev-dependencies is reachable
  from `src/lib.rs`'s public API or from any non-test code path.
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

`hkdf` v0.13.0 became a `[dependencies]` (production) entry in Stage 76 — see
"Dependencies" above for the full crate review. That stage was the "imported
as a dependency" step only, mirroring Stage 74's `chacha20poly1305` adoption
(no code imported `hkdf` yet, and no vector was wired). Stage 77 (below)
completes the "wired" step for this dependency.

## RFC 5869 vector wiring (Stage 77)

`src/lib.rs`'s bottom-most module, `rfc5869_vectors` (gated `#[cfg(test)]`,
compiled only for `cargo test`), reads
[`test-vectors/kdf/hkdf-rfc5869.json`](../../test-vectors/kdf/hkdf-rfc5869.json)
at compile time via `include_str!` and runs three tests:

- `rfc5869_json_parses_and_is_non_empty` — the vector file parses and is
  non-empty.
- `rfc5869_positive_vectors_extract_and_expand_correctly` — for every
  `shouldPass: true` vector (RFC 5869 Appendix A, Test Cases 1–3, SHA-256),
  `hkdf::Hkdf::<sha2::Sha256>::extract` produces exactly the RFC's expected
  PRK, and `.expand` with that vector's `info` produces exactly the RFC's
  expected `L`-octet OKM.
- `rfc5869_negative_vectors_do_not_match_if_present` — for every
  `shouldPass: false` vector (none exist in the current file; RFC 5869
  Appendix A publishes only positive known-answer test cases for HKDF-SHA256,
  and none is fabricated per
  [`docs/crypto_vector_sources.md`](../../docs/crypto_vector_sources.md) §2),
  the derived PRK or OKM must NOT match the fixture's (necessarily incorrect)
  expected bytes. This loop runs zero iterations today and trivially passes;
  it starts enforcing automatically if a future, explicitly-reviewed
  re-import ever adds an official negative case.

This is the "wired" step of the vector lifecycle in
[`docs/verification_infrastructure.md`](../../docs/verification_infrastructure.md)
§5 for HKDF-SHA256 — it does not, by itself, make any public API real:
`derive_key_placeholder` is unchanged, there is still **no public `deriveKey`
implementation**, and the runtime still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`. Nothing outside this
package's own `Cargo.toml`/`Cargo.lock`/`src/lib.rs` changed.
