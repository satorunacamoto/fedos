# @nostr-window/fedos-core-rust

The **FedOS crypto core** package boundary — the INTENDED future home of a
RustCrypto-backed WASM/FFI crypto core, kept as a standalone package so the host
app depends only on its *contract*, never on its internals.

> **Status: Stage 91 — Internal response descriptor skeleton (internal-only
> `response_descriptor` module; non-sensitive response-kind labels only, no
> real bytes/secrets/result payload, no real AEAD/HKDF/Argon2/NIP-44
> connection, no Runtime/Worker/CryptoProvider wiring, no WASM change).
> Public API STILL a placeholder SKELETON. No cryptography reachable from
> any public function.**
> This package ships the TypeScript `FedosCoreCrypto` seam, a permanently-inert
> `PlaceholderFedosCoreCrypto`, and (Stage 69) a **minimal Rust crate skeleton**
> (`Cargo.toml` + `src/lib.rs`) with **placeholder functions only**. That public
> API — `fedos_core_status`, `fedos_core_capabilities`,
> `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
> `decrypt_placeholder` — is UNCHANGED since Stage 69. Stage 74 added
> `chacha20poly1305` (RustCrypto AEAD, `default-features = false`, `features =
> ["alloc"]` — no `getrandom`), wired to the RFC 8439 vectors under
> `cfg(test)` in Stage 75 (refactored into a test-only helper Stage 81). Stage
> 76 adopted `hkdf` (RustCrypto KDF), wired to the RFC 5869 HKDF-SHA256
> vectors under `cfg(test)` in Stage 77 (refactored into a test-only helper
> Stage 83). Stage 78 adopted `zeroize` / `secrecy` / `subtle` as a
> secret-handling FOUNDATION. Stage 79 added a crate-private `secret_handle`
> module. Stage 80 added a second crate-private module, `aead_core`. Stage 82
> added a third crate-private module, `kdf_core` — see the "Internal KDF
> module skeleton" section below. Stage 84 adopted `argon2` v0.5.3
> (`default-features = false`, no features), wired to the RFC 9106 Argon2id
> vector under `cfg(test)` in Stage 85 (refactored into a test-only helper
> Stage 86). Stage 87 added a fourth crate-private module, `key_material`,
> Stage 88 a fifth, `domain_label`, Stage 89 a sixth, `operation_context`,
> and Stage 90 a seventh, `request_descriptor` — see the "Internal key
> material skeleton" / "Internal domain separation label skeleton" /
> "Internal operation context skeleton" / "Internal request descriptor
> skeleton" sections below; all four are UNCHANGED this stage, still
> placeholder-only. **Stage 91 adds an eighth crate-private module,
> `response_descriptor`** — an INTERNAL-ONLY response-descriptor skeleton
> naming a future AEAD/KDF/Argon2/NIP-44/Nostr-key-derivation operation
> RESULT via non-sensitive metadata only, plus a `ResponseDescriptorKind`
> label enum (`AeadCiphertextPlaceholder` / `AeadPlaintextPlaceholder` /
> `HkdfPrkPlaceholder` / `HkdfOkmPlaceholder` / `Argon2idTagPlaceholder` /
> `Nip44CiphertextPlaceholder` / `Nip44PlaintextPlaceholder` /
> `NostrSecretKeyPlaceholder` / `NostrPublicKeyPlaceholder` /
> `ErrorPlaceholder` / `TestOnlyPlaceholder`), plus a third
> `ResponseDescriptorState` variant, `ErrorPlaceholder`, and a matching
> `new_error_placeholder()` constructor — see the "Internal response
> descriptor skeleton" section below. **Not connected to `secret_handle`,
> `aead_core`, `kdf_core`, `key_material`, `domain_label`,
> `operation_context`, or `request_descriptor`** — same "when in doubt,
> leave unconnected" reasoning those modules already state; all seven are
> UNCHANGED this stage, still placeholder-only. **No production
> `deriveKey`/password KDF** — production code (everything before this
> file's first `cfg(test)`-gated module) still does not import `argon2` at
> all; `derive_key_placeholder` remains byte-for-byte unchanged.
> `Cargo.toml` is UNCHANGED this stage (no new dependency needed). The Rust
> crate still has no `wasm-bindgen`, no `unsafe`, and produces **no
> `.wasm`**; the runtime/Worker/`CryptoProvider` are **not** wired to any of
> this. A real RustCrypto-backed core is a future, explicitly-reviewed stage
> that must pass the full crypto test-vector plan
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
  and still does no real work. Stage 82 adds an INTERNAL-ONLY
  `KdfPlaceholderRequest` skeleton (crate-private `kdf_core` module,
  `pub(crate)` at most, never `pub`, never re-exported) that holds only an
  algorithm label and an extract/expand/extract-then-expand intent label —
  no IKM, salt, info, PRK, or OKM byte, and its production code does not
  import `hkdf` or `sha2` either
- No PUBLIC Argon2id / password-hashing implementation — `argon2` (adopted
  Stage 84, `default-features = false`, no features enabled) is exercised
  ONLY inside the `cfg(test)`-only `rfc9106_vectors` module added Stage 85,
  to check the dependency against the RFC 9106 vector; no production code
  path imports, calls, or exercises it, and there is still no Argon2id
  hash/verify function any caller can reach
- No PUBLIC AEAD implementation — `chacha20poly1305` is exercised ONLY inside
  the `cfg(test)`-only `rfc8439_vectors` module added Stage 75, to check the
  dependency against the RFC 8439 vectors; no production code path imports,
  calls, or exercises it, and there is still no ChaCha20-Poly1305 /
  XChaCha20-Poly1305 / AES-GCM encrypt/decrypt function any caller can reach.
  Stage 80 adds an INTERNAL-ONLY `AeadPlaceholderRequest` skeleton
  (crate-private `aead_core` module, `pub(crate)` at most, never `pub`,
  never re-exported) that holds only an algorithm label and an
  encrypt-or-decrypt intent label — no key, nonce, plaintext, ciphertext, or
  tag byte, and its production code does not import `chacha20poly1305`
  either
- No CSPRNG / random generation (chacha20poly1305's default `getrandom`
  feature is explicitly disabled; `hkdf` pulls in no `rand`/`getrandom`
  either; `argon2`'s default `rand` feature is explicitly disabled too, so
  it pulls in no `rand_core` either)
- No BIP39 / BIP32
- No NIP-44
- No PUBLIC secret type — Stage 79 adds an INTERNAL-ONLY `SecretHandle`
  skeleton (crate-private `secret_handle` module, `pub(crate)` at most,
  never `pub`, never re-exported) that uses `zeroize`/`secrecy` against a
  fixed, non-secret placeholder marker only; it accepts and stores no real
  key/seed/plaintext/ciphertext/passphrase byte. `subtle` remains
  UNUSED — no `ConstantTimeEq`/`.ct_eq()` call exists anywhere
- No PUBLIC key-material type — Stage 87 adds an INTERNAL-ONLY
  `KeyMaterialHandle` skeleton (crate-private `key_material` module,
  `pub(crate)` at most, never `pub`, never re-exported) reusing
  `secret_handle`'s exact placeholder-only pattern (`zeroize`/`secrecy`
  against a fixed, non-secret marker); it accepts and stores no real
  key/seed/plaintext/ciphertext/passphrase/nonce byte, and is not connected
  to `secret_handle`/`aead_core`/`kdf_core`
- No dynamic domain separation label — Stage 88 adds an INTERNAL-ONLY
  `DomainLabel` skeleton (crate-private `domain_label` module, `pub(crate)`
  at most, never `pub`, never re-exported) whose `as_static_label()` returns
  only a fixed, compile-time `&'static str` literal per `DomainLabelKind`;
  it accepts no user-, environment-, or config-derived string, holds no
  `String`/`Vec<u8>` field, and is not connected to
  `secret_handle`/`aead_core`/`kdf_core`/`key_material`
- No PUBLIC operation type — Stage 89 adds an INTERNAL-ONLY
  `OperationContext` skeleton (crate-private `operation_context` module,
  `pub(crate)` at most, never `pub`, never re-exported) that names a future
  AEAD/HKDF/Argon2/NIP-44/Nostr-key-derivation operation via an
  `OperationKind` label only; it accepts no user-, environment-, or
  config-derived input, holds no key/seed/plaintext/ciphertext/passphrase/
  nonce byte, no `String`/`Vec` field, and is not connected to
  `secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`
- No PUBLIC request type — Stage 90 adds an INTERNAL-ONLY
  `RequestDescriptor` skeleton (crate-private `request_descriptor` module,
  `pub(crate)` at most, never `pub`, never re-exported) that names a future
  AEAD/HKDF/Argon2/NIP-44/Nostr-key-derivation operation REQUEST via a
  `RequestDescriptorKind` label only; it accepts no user-, environment-, or
  config-derived input, holds no key/seed/plaintext/ciphertext/passphrase/
  nonce byte, no `String`/`Vec` field, and is not connected to
  `secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`/
  `operation_context`
- No PUBLIC response type — Stage 91 adds an INTERNAL-ONLY
  `ResponseDescriptor` skeleton (crate-private `response_descriptor`
  module, `pub(crate)` at most, never `pub`, never re-exported) that names
  a future AEAD/HKDF/Argon2/NIP-44/Nostr-key-derivation operation RESULT
  via a `ResponseDescriptorKind` label only; it accepts no user-,
  environment-, or config-derived input, holds no key/seed/plaintext/
  ciphertext/passphrase/tag/nonce byte and no result payload of any kind,
  no `String`/`Vec` field, and is not connected to
  `secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`/
  `operation_context`/`request_descriptor`
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
  Cargo.toml     — Rust crate skeleton (v0.0.0, edition 2021, rlib) + chacha20poly1305 dependency (Stage 74) + serde/serde_json/hex dev-dependencies (Stage 75) + hkdf dependency (Stage 76) + sha2 dev-dependency (Stage 77) + zeroize/secrecy/subtle dependencies (Stage 78) + argon2 dependency (Stage 84) — UNCHANGED since Stage 84
  src/index.ts   — entry point: FedosCoreCrypto seam + PlaceholderFedosCoreCrypto / createFedosCoreCrypto
  src/types.ts   — FedosCoreCrypto contract, status/decision/capability, request shapes (imports nothing)
  src/wasm_loader.ts — WASM loader seam (Noop/Placeholder) — loads nothing (Stage 63)
  src/lib.rs     — Rust placeholder API (status/capabilities + *_placeholder fns), UNCHANGED since Stage 69 — NO crypto, NO unsafe, NO WASM in the public API; a `cfg(test)`-only `rfc8439_vectors` module (Stage 75) verifies chacha20poly1305 against RFC 8439, refactored Stage 81 to share seal/open logic via two test-only helper fns; a second `cfg(test)`-only `rfc5869_vectors` module (Stage 77) verifies hkdf against RFC 5869, refactored Stage 83 to share extract/expand logic via three test-only helper fns; a third `cfg(test)`-only `rfc9106_vectors` module (Stage 85) verifies argon2 against RFC 9106 Argon2id, refactored Stage 86 to share derivation logic via one test-only helper fn; a crate-private `secret_handle` module (Stage 79) is an INTERNAL-ONLY `SecretHandle` skeleton using zeroize/secrecy against a placeholder marker; a crate-private `aead_core` module (Stage 80, unchanged since) is an INTERNAL-ONLY `AeadPlaceholderRequest` skeleton (algorithm + operation labels only); a crate-private `kdf_core` module (Stage 82, unchanged since) is an INTERNAL-ONLY `KdfPlaceholderRequest` skeleton (algorithm + operation labels only); a crate-private `key_material` module (Stage 87) is an INTERNAL-ONLY `KeyMaterialHandle` skeleton reusing `secret_handle`'s zeroize/secrecy placeholder-marker pattern, plus a `KeyMaterialKind` label enum; a crate-private `domain_label` module (Stage 88) is an INTERNAL-ONLY `DomainLabel` skeleton holding only a fixed `&'static str` label per `DomainLabelKind`; a crate-private `operation_context` module (Stage 89) is an INTERNAL-ONLY `OperationContext` skeleton naming a future crypto operation via an `OperationKind` label only; a crate-private `request_descriptor` module (Stage 90) is an INTERNAL-ONLY `RequestDescriptor` skeleton naming a future crypto operation REQUEST via a `RequestDescriptorKind` label only, non-sensitive metadata only; a crate-private `response_descriptor` module (Stage 91) is an INTERNAL-ONLY `ResponseDescriptor` skeleton naming a future crypto operation RESULT via a `ResponseDescriptorKind` label only, non-sensitive metadata only — none of the eight skeletons is part of the public API, and none is connected to any other
```

The Rust `src/lib.rs` mirrors the TS `FedosCoreCrypto` shape with placeholder-only
functions (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`) — each returns an `Unavailable` / `Placeholder`
`FedosCoreStatus` and runs no cryptography. `#![forbid(unsafe_code)]` bans
`unsafe`. No WASM target is declared; nothing compiles to `.wasm`.

## Dependencies (Stage 74/76/78/84 production + Stage 75/77 dev-dependencies)

- **`chacha20poly1305` v0.11.0** (RustCrypto, Apache-2.0 OR MIT,
  `default-features = false`, `features = ["alloc"]`) — one of six entries in
  `[dependencies]` (production). Pulls in, transitively, only other
  RustCrypto/utility crates (`aead`, `chacha20`, `cipher`, `poly1305`,
  `crypto-common`, `inout`, `hybrid-array`, `universal-hash`, `block-buffer`,
  `typenum`, `cfg-if`, `cpufeatures`, `cmov`, `ctutils` — plus itself) — **no
  `getrandom`, no `rand`/`rand_core`, no build script (`build.rs`) in any of
  them.** Several of the lower-level crates (`chacha20`, `poly1305`,
  `cipher`, `aead`, `cpufeatures`) use `unsafe` internally for SIMD backends /
  CPU feature detection — `chacha20poly1305` itself does not; this crate's
  own `#![forbid(unsafe_code)]` is unaffected (it governs this crate's code,
  not a dependency's). MSRV for `chacha20poly1305` 0.11.0 is Rust 1.85; this
  repo's toolchain is newer, so no MSRV bump was needed. As of Stage 75, this
  dependency is exercised — but only inside `cfg(test)`, by the
  `rfc8439_vectors` module (see below).
- **`hkdf` v0.13.0** (RustCrypto, MIT OR Apache-2.0, default features) —
  another entry in `[dependencies]` (production), adopted Stage 76. Adds
  three NEW transitive packages beyond what `chacha20poly1305` already pulls
  in: `hkdf` itself, `hmac` (its only dependency), and `digest` (`hmac`'s
  only dependency; `digest` is also shared/reused by `crypto-common` already
  in the tree from `chacha20poly1305`). No `build.rs` in any of the three; no
  `unsafe` in any of the three either — `digest` itself declares
  `#![forbid(unsafe_code)]`. `hkdf`'s only optional feature, `kdf` (an
  unrelated trait-abstraction crate), is NOT enabled — default features are
  used as-is. MSRV for `hkdf` 0.13.0 is Rust 1.85, same as `chacha20poly1305`;
  no toolchain change was needed. As of Stage 77, this dependency is
  exercised — but only inside `cfg(test)`, by the `rfc5869_vectors` module
  (see below); production code still neither imports nor calls it.
- **`zeroize` v1.9.0 / `secrecy` v0.10.3 / `subtle` v2.6.1** — three more
  entries in `[dependencies]` (production), adopted together Stage 78
  as a secret-handling foundation. See "Secret-handling foundation adoption
  (Stage 78)" below for the full review; none of the three is imported,
  referenced, or exercised anywhere in `src/lib.rs` — production or
  `cfg(test)` — yet.
- **`argon2` v0.5.3** (RustCrypto, MIT OR Apache-2.0, `default-features =
  false`, NO `features` enabled) — the sixth and newest entry in
  `[dependencies]` (production), adopted Stage 84. See "`argon2` dependency
  adoption (Stage 84)" below for the full review; NOT imported/used
  anywhere in `src/lib.rs` yet — production or `cfg(test)` — dependency +
  build check only.
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
  for the full adoption record and policy (§12 has dedicated `hkdf` — Stage
  76, `zeroize`/`secrecy`/`subtle` — Stage 78, and `argon2` — Stage 84
  entries). **`Cargo.lock` is intentionally NOT committed** (library crate;
  reproducibility via a lockfile digest is deferred to the future
  build-manifest stage,
  [`docs/fedos_core_build_manifest.md`](../../docs/fedos_core_build_manifest.md)).
  It was generated to run `cargo check`/`cargo test` this stage and then
  deleted, as in every prior dependency-adoption stage.

## RFC 8439 vector wiring (Stage 75, refactored Stage 81)

`src/lib.rs`'s `rfc8439_vectors` module (gated `#[cfg(test)]`, compiled only
for `cargo test`), reads
[`test-vectors/aead/chacha20poly1305-rfc8439.json`](../../test-vectors/aead/chacha20poly1305-rfc8439.json)
at compile time via `include_str!` and runs five tests:

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
- `seal_then_open_round_trip_for_test_helper` (Stage 81) — a seal-then-open
  round trip over fixed, non-secret, test-only bytes (not RFC vector data)
  returns the original plaintext.
- `open_fails_for_tampered_sealed_bytes_for_test_helper` (Stage 81) —
  tampering with the sealed bytes (the tag) makes the open helper return an
  error.

**Stage 81 refactor.** The two vector tests' seal/open logic — previously
written inline (and duplicated between the positive and negative test) — is
now two small, private, test-only helper functions declared earlier in the
same module: `seal_chacha20poly1305_for_test(key_bytes, nonce_bytes,
plaintext_bytes, aad_bytes) -> Result<Vec<u8>, AeadError>` and
`open_chacha20poly1305_for_test(key_bytes, nonce_bytes, sealed_bytes,
aad_bytes) -> Result<Vec<u8>, AeadError>` (`sealed_bytes` is
`ciphertext‖tag`). Both are private `fn`s — never `pub`/`pub(crate)`, never
re-exported — that exist ONLY inside this `cfg(test)`-only module, and are
NOT connected to the crate-private `aead_core` skeleton (Stage 80) or
`secret_handle` (Stage 79) in any way. This is a test-only refactor, not a
new capability: the two pre-existing vector tests assert exactly what they
asserted before Stage 81, just calling the shared helper instead of
constructing a `Key`/`Nonce`/`ChaCha20Poly1305` inline twice.

This is the "wired" step of the vector lifecycle in
[`docs/verification_infrastructure.md`](../../docs/verification_infrastructure.md)
§5 for ChaCha20-Poly1305 — it does not, by itself, make any public API real:
`encrypt_placeholder`/`decrypt_placeholder` are unchanged, and the runtime
still selects only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`. See
[`test/fedos_core_rust_aead_test_helper.test.ts`](../../test/fedos_core_rust_aead_test_helper.test.ts)
for the dedicated Stage 81 guard tests (helper presence/visibility, no
production `chacha20poly1305` reference, public `pub fn` count still 6,
`aead_core` unchanged and still placeholder-only, no production key/nonce/
plaintext/ciphertext/tag storage field, Runtime/Worker untouched, no
committed build artifact).

## `hkdf` dependency adoption (Stage 76)

`hkdf` v0.13.0 became a `[dependencies]` (production) entry in Stage 76 — see
"Dependencies" above for the full crate review. That stage was the "imported
as a dependency" step only, mirroring Stage 74's `chacha20poly1305` adoption
(no code imported `hkdf` yet, and no vector was wired). Stage 77 (below)
completes the "wired" step for this dependency.

## RFC 5869 vector wiring (Stage 77, refactored Stage 83)

`src/lib.rs`'s `rfc5869_vectors` module (gated `#[cfg(test)]`, compiled only
for `cargo test`), reads
[`test-vectors/kdf/hkdf-rfc5869.json`](../../test-vectors/kdf/hkdf-rfc5869.json)
at compile time via `include_str!` and runs five tests:

- `rfc5869_json_parses_and_is_non_empty` — the vector file parses and is
  non-empty.
- `rfc5869_positive_vectors_extract_and_expand_correctly` — for every
  `shouldPass: true` vector (RFC 5869 Appendix A, Test Cases 1–3, SHA-256),
  `hkdf::Hkdf::<sha2::Sha256>::extract` produces exactly the RFC's expected
  PRK, and `.expand` with that vector's `info` produces exactly the RFC's
  expected `L`-octet OKM — via the three test-only helpers described below.
- `rfc5869_negative_vectors_do_not_match_if_present` — for every
  `shouldPass: false` vector (none exist in the current file; RFC 5869
  Appendix A publishes only positive known-answer test cases for HKDF-SHA256,
  and none is fabricated per
  [`docs/crypto_vector_sources.md`](../../docs/crypto_vector_sources.md) §2),
  the derived PRK or OKM must NOT match the fixture's (necessarily incorrect)
  expected bytes. This loop runs zero iterations today and trivially passes;
  it starts enforcing automatically if a future, explicitly-reviewed
  re-import ever adds an official negative case.
- `extract_then_expand_round_trip_for_test_helper` (Stage 83) — an
  extract-then-expand round trip over fixed, non-secret, test-only bytes
  (not RFC vector data) agrees between the three-helper path and the single
  combined-helper path.
- `expand_fails_for_unsupported_length_for_test_helper` (Stage 83) —
  requesting an OKM length beyond RFC 5869 §2.3's `255 * HashLen` ceiling
  makes the expand helper return an error.

**Stage 83 refactor.** The two vector tests' extract/expand logic —
previously written inline (and duplicated between the positive and negative
test) — is now three small, private, test-only helper functions declared
earlier in the same module:
`extract_hkdf_sha256_for_test(ikm_bytes, salt_bytes) -> Vec<u8>` (infallible,
matching `hkdf`'s own `extract` signature),
`expand_hkdf_sha256_for_test(prk_bytes, info_bytes, length) ->
Result<Vec<u8>, InvalidLength>`, and
`extract_expand_hkdf_sha256_for_test(ikm_bytes, salt_bytes, info_bytes,
length) -> Result<(Vec<u8>, Vec<u8>), InvalidLength>` (runs both steps in one
call). All three are private `fn`s — never `pub`/`pub(crate)`, never
re-exported — that exist ONLY inside this `cfg(test)`-only module, and are
NOT connected to the crate-private `kdf_core` skeleton (Stage 82) or
`secret_handle`/`aead_core` in any way. This is a test-only refactor, not a
new capability — the KDF-side analogue of Stage 81's AEAD-side refactor: the
two pre-existing vector tests assert exactly what they asserted before Stage
83, just calling the shared helpers instead of constructing an
`Hkdf<Sha256>` inline twice.

This is the "wired" step of the vector lifecycle in
[`docs/verification_infrastructure.md`](../../docs/verification_infrastructure.md)
§5 for HKDF-SHA256 — it does not, by itself, make any public API real:
`derive_key_placeholder` is unchanged, there is still **no public `deriveKey`
implementation**, and the runtime still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`. See
[`test/fedos_core_rust_hkdf_test_helper.test.ts`](../../test/fedos_core_rust_hkdf_test_helper.test.ts)
for the dedicated Stage 83 guard tests (helper presence/visibility, no
production `hkdf`/`sha2` reference, public `pub fn` count still 6, `kdf_core`
unchanged and still placeholder-only, no production IKM/salt/info/PRK/OKM
storage field, Runtime/Worker untouched, no committed build artifact).
Nothing outside this package's own `src/lib.rs` changed.

## Secret-handling foundation adoption (Stage 78)

`zeroize` v1.9.0, `secrecy` v0.10.3, and `subtle` v2.6.1 became
`[dependencies]` (production) entries in Stage 78 — see "Dependencies" above
for the per-crate review, and
[`docs/rust_dependency_adoption.md`](../../docs/rust_dependency_adoption.md)
§12 for the full recorded review (versions, features, transitive
dependencies, license, MSRV, `unsafe`/build-script presence).

**Why adopted now, together, ahead of a consumer:** with the AEAD (RFC 8439,
Stage 75) and KDF (RFC 5869, Stage 77) primitives both verified against their
official vectors under `cargo test`, the next natural step before any real
secret byte is handled is the infrastructure that will hold, protect, and
compare it — `zeroize` clears secret buffers on drop, `secrecy` prevents a
secret value from being accidentally `Debug`/`Display`-printed or copied
without an explicit `expose_secret()` call, and `subtle` provides
constant-time equality so a future secret-derived byte comparison (e.g. an
authentication tag) is never a hand-rolled, timing-variable `==`. Adopting
this trio as its own reviewed Stage — ahead of, but immediately preceding,
the internal secret-handle skeleton that will actually use them (Stage 79
candidate) — keeps the foundation itself auditable in isolation, before any
code leans on it.

**What this stage does NOT do** (this is a dependency + build-check ADOPTION
ONLY, exactly like every prior dependency Stage):

- **No secret type.** No `Secret`/`SecretBox` (or any other) wrapper type is
  defined anywhere in `src/lib.rs`; no code imports or references `secrecy`.
- **No zeroization behavior.** No type derives `Zeroize`; no `.zeroize()` or
  `Zeroizing` usage exists anywhere; no code imports or references `zeroize`.
- **No constant-time compare behavior.** No `ConstantTimeEq`/`Choice`/
  `.ct_eq()` usage exists anywhere; no code imports or references `subtle`.
- **No key/seed/plaintext/ciphertext byte is handled, stored, or compared**
  anywhere in this crate — there is still nothing for these dependencies to
  protect.
- **No `#[cfg(test)]` module is added this stage** — unlike Stage 75/77
  (which each wired an official test-vector file), this trio serves no
  single AEAD/KDF primitive and has no known-answer vector to verify against
  under `cargo test`; there is nothing to wire yet.
- **No Runtime / Worker / `CryptoProvider` wiring.** Nothing outside this
  package's own `Cargo.toml`/`Cargo.lock` changed; the host still selects
  only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.
- **`derive_key_placeholder` / `encrypt_placeholder` / `decrypt_placeholder`
  are byte-for-byte unchanged** from Stage 69, and the crate's full public
  API is otherwise untouched.

A future, explicitly-reviewed Stage 79 candidate is to introduce an internal
secret-handle skeleton — the first code anywhere in this crate to actually
import and use `zeroize`/`secrecy`/`subtle` — still without any real key
derivation or encrypt/decrypt implementation.

## Internal secret-handle skeleton (Stage 79)

`src/lib.rs` gains a crate-private `secret_handle` module (still ahead of
this file's first module gated `cfg(test)`) — the first PRODUCTION code in
this crate (not `#[cfg(test)]`-only, unlike Stage 75/77's vector-verification
modules) to actually import and use the `zeroize`/`secrecy` dependencies
adopted Stage 78. It defines:

- **`SecretHandleState`** (`pub(crate) enum`) — `Empty` / `Placeholder` /
  `Cleared`.
- **`SecretHandleStatus`** (`pub(crate) struct`) — a non-sensitive status
  snapshot, carrying only the state enum.
- **`PlaceholderMarker`** (private) — a fixed, non-secret `u8` newtype.
  Exists ONLY so `SecretHandle` has a concrete `Zeroize`-able type to wrap in
  `secrecy::SecretBox`; its value is a constant, never derived from or
  holding any real key/seed/plaintext/ciphertext/passphrase byte.
- **`SecretHandle`** (`pub(crate) struct`) — the skeleton itself, holding
  `state: SecretHandleState` and `marker: SecretBox<PlaceholderMarker>`.
  Four methods: `new_placeholder()` (constructs a handle — takes NO secret
  input of any kind, no borrowed-byte-slice/`Vec<u8>`/`String` parameter),
  `status()` (returns the non-sensitive snapshot), `clear()` (zeroizes the
  placeholder marker and sets state to `Cleared` — does not return, expose,
  or copy the marker), and `is_cleared()` (a boolean check).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns a
`SecretHandle`. See
[`test/fedos_core_rust_secret_handle.test.ts`](../../test/fedos_core_rust_secret_handle.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, no key/seed/plaintext/ciphertext/passphrase
storage field, no `Vec<u8>`/`String`/borrowed-byte-slice secret field, no
AEAD/HKDF/Argon2, no random/`getrandom`, no `unsafe`, no committed build
artifact, Runtime/Worker untouched).

**Why `zeroize`/`secrecy` but not `subtle` this stage:** `clear()` calling
`marker.zeroize()` and wrapping `marker` in `secrecy::SecretBox` are both
meaningful to exercise even against a placeholder value — they prove out the
lifecycle pattern (allocate → hold → zeroize-on-clear) a future real secret
type will reuse. `subtle`'s constant-time comparison, by contrast, exists to
guard secret-DERIVED byte comparisons (e.g. an authentication tag) against
timing side-channels — comparing this skeleton's own `SecretHandleState` enum
(plain, non-secret, `#[derive(PartialEq)]`) would not exercise that use case
meaningfully, so `subtle` stays adopted-but-unused, deferred to the stage
that first needs a real secret-derived comparison.

**Every unit test in `secret_handle`'s own nested `#[cfg(test)] mod tests`**
(5 tests, `cargo test`-only) is intentionally placeholder-emphasizing in name
— `new_placeholder_starts_in_placeholder_state_only`,
`status_reports_placeholder_state_only_no_secret_bytes`,
`clear_transitions_state_to_cleared_only`,
`is_cleared_is_false_until_clear_is_called`,
`empty_state_is_the_default_placeholder_only_state` — none exercises or
asserts anything about a real secret byte, because there is none to assert
about. `#[allow(dead_code)]` on the module suppresses the (expected) warning
a plain, non-test `cargo check`/`cargo build` would otherwise emit, since
nothing outside `secret_handle`'s own tests calls into it yet; this clears
naturally once a future stage (e.g. an internal AEAD module) wires a real
consumer.

This is dependency + build-check-safe SKELETON work only: no key, seed,
plaintext, ciphertext, or passphrase byte is accepted, stored, or handled
anywhere in this crate; no AEAD/HKDF/Argon2/NIP-44 operation is implemented
or called; `derive_key_placeholder`/`encrypt_placeholder`/
`decrypt_placeholder` are unchanged; and nothing is wired into the Runtime,
the Worker, or `CryptoProvider`/`FedosCoreCryptoProvider` — the host still
selects only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

A future, explicitly-reviewed Stage 80 candidate is an internal AEAD module
skeleton (the `chacha20poly1305`-analogue of this stage's KDF-adjacent
secret-handle work) — still no public `encrypt`/`decrypt` implementation.

## Internal AEAD module skeleton (Stage 80)

`src/lib.rs` gains a second crate-private module, `aead_core` (alongside
Stage 79's `secret_handle`, placed right after it, still ahead of this
file's first module gated `cfg(test)`). It defines:

- **`AeadAlgorithm`** (`pub(crate) enum`) — one variant, `ChaCha20Poly1305`
  (a label only; no cipher is instantiated).
- **`AeadOperation`** (`pub(crate) enum`) — `Encrypt` / `Decrypt` (a label
  only; no bytes are sealed or opened).
- **`AeadRequestStatus`** (`pub(crate) struct`) — a non-sensitive status
  snapshot. Reuses this crate's existing `FedosCoreState` labels
  (`Unavailable` / `Placeholder`) rather than inventing a parallel enum.
- **`AeadPlaceholderRequest`** (`pub(crate) struct`) — the skeleton itself,
  holding only `algorithm: AeadAlgorithm` and `operation: AeadOperation`.
  Five methods: `new_placeholder_encrypt()` / `new_placeholder_decrypt()`
  (construct a request — take NO plaintext/ciphertext/key/nonce/AAD/tag
  input of any kind), `status()` (always returns `Placeholder` — this
  skeleton runs no cryptography, so there is no other state to report),
  `algorithm()`, `operation()` (return the two labels — intent only).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns an
`AeadPlaceholderRequest`. See
[`test/fedos_core_rust_aead_skeleton.test.ts`](../../test/fedos_core_rust_aead_skeleton.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, no `chacha20poly1305` import in `aead_core`'s
production code, no key/nonce/plaintext/ciphertext/tag storage field, no
`Vec<u8>`/`String`/borrowed-byte-slice byte-storage field, no random/
`getrandom`, no HKDF connection, no `SecretHandle` key extraction, no
`unsafe`, no committed build artifact, Runtime/Worker untouched).

**No actual encryption/decryption.** `aead_core`'s production code does NOT
import `chacha20poly1305` — that dependency (adopted Stage 74) stays
exercised ONLY by the pre-existing `cfg(test)`-only `rfc8439_vectors` module
(Stage 75), unchanged this stage. Nothing in `aead_core` seals or opens a
byte; `new_placeholder_encrypt()`/`new_placeholder_decrypt()` take no
plaintext/ciphertext/key/nonce/AAD/tag parameter, and
`AeadPlaceholderRequest` stores only the two labels — no
borrowed-byte-slice/`Vec<u8>`/`String` field exists anywhere in the module.

**No connection to `secret_handle`.** `aead_core` never constructs a
`SecretHandle` and extracts no key or secret byte from one. When a
skeleton-to-skeleton connection is ambiguous, this stage deliberately leaves
the two unconnected rather than guess at a future design — a real AEAD
implementation's actual key-sourcing design is deferred to the stage that
implements it.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, nonce, plaintext, ciphertext, or tag byte is accepted,
stored, or handled anywhere in `aead_core`; no HKDF is referenced;
`derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder` are
unchanged; and nothing is wired into the Runtime, the Worker, or
`CryptoProvider`/`FedosCoreCryptoProvider` — the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

Stage 81 (below) is the ChaCha20-Poly1305 helper this section anticipated —
see "RFC 8439 vector wiring" above for its details. It stays `cfg(test)`-only
and unconnected to `aead_core`; `aead_core` itself is untouched by Stage 81.

## Test-only ChaCha20-Poly1305 helper extraction (Stage 81)

`seal_chacha20poly1305_for_test` and `open_chacha20poly1305_for_test` are
now shared by both `rfc8439_vectors` tests instead of being written inline
(and duplicated) in each — see "RFC 8439 vector wiring" above for the full
description, signatures, and the two new helper-focused unit tests. This
section exists so the guardrails are stated once, explicitly, in the same
place as every other stage's summary:

- **Test-only refactor, not a new capability.** Both pre-existing
  `rfc8439_vectors` tests assert exactly what they asserted before this
  stage; only the seal/open construction moved into a shared function.
- **No production `chacha20poly1305` import.** `src/lib.rs`'s production
  code (everything before this file's first `cfg(test)`-gated module) still
  does not import, reference, or call `chacha20poly1305` anywhere.
- **`aead_core` (Stage 80) is unchanged and still placeholder-only.** The
  two new helpers are not called from it, not referenced by it, and it gains
  no new field or method this stage.
- **No connection to `secret_handle` (Stage 79).** The helpers take raw
  test-vector key/nonce bytes as plain parameters — never a `SecretHandle`,
  never anything sourced from one.
- **No `Cargo.toml` change.** No new dependency; `chacha20poly1305` was
  already a `[dependencies]` (production) entry since Stage 74.
- **Public API and Runtime/Worker/`CryptoProvider` wiring are exactly as
  before** — `encrypt_placeholder`/`decrypt_placeholder` are byte-for-byte
  unchanged, and the host still selects only
  `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

Stage 82 (below) is the internal KDF module skeleton this section
anticipated — see "Internal KDF module skeleton" below for its details. It
stays unconnected to `aead_core`/`secret_handle`; `aead_core` itself is
untouched by Stage 82.

## Internal KDF module skeleton (Stage 82)

`src/lib.rs` gains a third crate-private module, `kdf_core` (alongside
Stage 79's `secret_handle` and Stage 80's `aead_core`, placed right after
`aead_core`, still ahead of this file's first module gated `cfg(test)`). It
defines:

- **`KdfAlgorithm`** (`pub(crate) enum`) — one variant, `HkdfSha256` (a
  label only; no KDF is instantiated).
- **`KdfOperation`** (`pub(crate) enum`) — `Extract` / `Expand` /
  `ExtractExpand` (a label only; no bytes are extracted or expanded).
- **`KdfRequestStatus`** (`pub(crate) struct`) — a non-sensitive status
  snapshot. Reuses this crate's existing `FedosCoreState` labels
  (`Unavailable` / `Placeholder`) rather than inventing a parallel enum —
  same pattern as `AeadRequestStatus` (Stage 80).
- **`KdfPlaceholderRequest`** (`pub(crate) struct`) — the skeleton itself,
  holding only `algorithm: KdfAlgorithm` and `operation: KdfOperation`. Six
  methods: `new_placeholder_extract()` / `new_placeholder_expand()` /
  `new_placeholder_extract_expand()` (construct a request — take NO
  IKM/salt/info/PRK/OKM/length input of any kind), `status()` (always
  returns `Placeholder` — this skeleton runs no cryptography, so there is no
  other state to report), `algorithm()`, `operation()` (return the two
  labels — intent only).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns a
`KdfPlaceholderRequest`. See
[`test/fedos_core_rust_kdf_skeleton.test.ts`](../../test/fedos_core_rust_kdf_skeleton.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, `derive_key_placeholder` unchanged, no
`hkdf`/`sha2` import in `kdf_core`'s production code, no
IKM/salt/info/PRK/OKM storage field, no `Vec<u8>`/`String`/
borrowed-byte-slice byte-storage field, no random/`getrandom`, no AEAD
connection, no `SecretHandle` key extraction, no `unsafe`, no committed
build artifact, Runtime/Worker untouched).

**No actual HKDF.** `kdf_core`'s production code does NOT import `hkdf` or
`sha2` — those dependencies (adopted Stage 76, `sha2` added Stage 77) stay
exercised ONLY by the pre-existing `cfg(test)`-only `rfc5869_vectors` module
(Stage 77, refactored Stage 81's sibling pattern applies to a future stage,
not this one), unchanged this stage. Nothing in `kdf_core` extracts or
expands a byte; the three `new_placeholder_*` constructors take no
IKM/salt/info/PRK/OKM/length parameter, and `KdfPlaceholderRequest` stores
only the two labels — no borrowed-byte-slice/`Vec<u8>`/`String` field exists
anywhere in the module.

**No connection to `aead_core` or `secret_handle`.** `kdf_core` never
constructs an `AeadPlaceholderRequest` or a `SecretHandle`, and extracts no
key or secret byte from either — same "when a skeleton-to-skeleton
connection is ambiguous, leave it unconnected" reasoning Stage 80 already
established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no IKM, salt, info, PRK, OKM, or other secret byte is accepted,
stored, or handled anywhere in `kdf_core`; no AEAD is referenced;
`derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder` are
unchanged; and nothing is wired into the Runtime, the Worker, or
`CryptoProvider`/`FedosCoreCryptoProvider` — the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

Stage 83 (below) is the internal HKDF helper this section anticipated — see
"RFC 5869 vector wiring" above for its details. It stays `cfg(test)`-only
and unconnected to `kdf_core`; `kdf_core` itself is untouched by Stage 83.

## Test-only HKDF-SHA256 helper extraction (Stage 83)

`extract_hkdf_sha256_for_test`, `expand_hkdf_sha256_for_test`, and
`extract_expand_hkdf_sha256_for_test` are now shared by both
`rfc5869_vectors` tests instead of being written inline (and duplicated) in
each — see "RFC 5869 vector wiring" above for the full description,
signatures, and the two new helper-focused unit tests. This section exists
so the guardrails are stated once, explicitly, in the same place as every
other stage's summary — the KDF-side mirror of Stage 81's own section:

- **Test-only refactor, not a new capability.** Both pre-existing
  `rfc5869_vectors` tests assert exactly what they asserted before this
  stage; only the extract/expand construction moved into shared functions.
- **No production `hkdf`/`sha2` import.** `src/lib.rs`'s production code
  (everything before this file's first `cfg(test)`-gated module) still does
  not import, reference, or call `hkdf` or `sha2` anywhere.
- **`kdf_core` (Stage 82) is unchanged and still placeholder-only.** The
  three new helpers are not called from it, not referenced by it, and it
  gains no new field or method this stage.
- **No connection to `secret_handle` (Stage 79) or `aead_core` (Stage 80).**
  The helpers take raw test-vector IKM/salt/info/PRK bytes as plain
  parameters — never a `SecretHandle` or an `AeadPlaceholderRequest`, never
  anything sourced from either.
- **No `Cargo.toml` change.** No new dependency; `hkdf` was already a
  `[dependencies]` (production) entry since Stage 76, and `sha2` a
  `[dev-dependencies]` entry since Stage 77.
- **Public API and Runtime/Worker/`CryptoProvider` wiring are exactly as
  before** — `derive_key_placeholder` is byte-for-byte unchanged, and the
  host still selects only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

Stage 84 (below) is the `argon2` dependency adoption this section
anticipated — see "`argon2` dependency adoption" below for its details.

## `argon2` dependency adoption (Stage 84)

`argon2` v0.5.3 became a `[dependencies]` (production) entry in Stage 84 —
see "Dependencies" above for the full crate review. That stage was the
"imported as a dependency" step only, mirroring Stage 74/76's
`chacha20poly1305`/`hkdf` adoption (no code imported `argon2` yet, and no
vector was wired). Stage 85 (below) completes the "wired" step for this
dependency.

## RFC 9106 vector wiring (Stage 85, refactored Stage 86)

`src/lib.rs`'s `rfc9106_vectors` module (gated `#[cfg(test)]`, compiled only
for `cargo test`), reads
[`test-vectors/kdf/argon2id-rfc9106.json`](../../test-vectors/kdf/argon2id-rfc9106.json)
at compile time via `include_str!` and runs five tests:

- `rfc9106_json_parses_and_is_non_empty` — the vector file parses and is
  non-empty.
- `rfc9106_positive_vectors_hash_correctly` — for the `shouldPass: true`
  vector (RFC 9106 §5.3's sole published Argon2id conformance test case:
  m=32 KiB, t=3, p=4, a small, fast-to-verify parameter set — NOT a
  production parameter recommendation), the test-only helper (below)
  produces exactly the RFC's expected 32-byte tag from the vector's
  `password`/`salt`/`secret`/`associatedData`/`memoryKiB`/`iterations`/
  `parallelism`/`tagLength`.
- `rfc9106_negative_vectors_do_not_match_if_present` — for every
  `shouldPass: false` vector (none exist in the current file; RFC 9106 §5.3
  publishes only the one positive Argon2id conformance vector — no
  byte-level tamper/negative vector for this construction — and none is
  fabricated per
  [`docs/crypto_vector_sources.md`](../../docs/crypto_vector_sources.md) §2),
  the computed tag must NOT match the fixture's (necessarily incorrect)
  expected bytes. This loop runs zero iterations today and trivially passes;
  it starts enforcing automatically if a future, explicitly-reviewed
  re-import ever adds an official negative case.
- `derive_argon2id_is_deterministic_for_test_helper` (Stage 86) — the same
  fixed, non-secret, test-only inputs (not RFC vector data) always produce
  the same 32-byte output.
- `derive_argon2id_fails_for_unsupported_memory_cost_for_test_helper`
  (Stage 86) — a memory cost below Argon2's own minimum
  (`Params::MIN_M_COST`, 8 KiB) makes the helper return an error.

**Stage 86 refactor.** The positive/negative vector tests' Argon2id
derivation — previously a per-vector helper,
`run_argon2id_for_vector(vector: &Vector)` — is now one small, private,
test-only helper function declared earlier in the same module, taking raw
bytes: `derive_argon2id_for_test(password_bytes, salt_bytes, secret_bytes,
associated_data_bytes, memory_cost_kib, time_cost, parallelism, output_len)
-> argon2::Result<Vec<u8>>` (constructed internally with
`Algorithm::Argon2id`, hardcoded `Version::V0x13`, and the given `secret`
bytes as the pepper via `Argon2::new_with_secret`). This mirrors the
byte-level shape and `_for_test` naming convention Stage 81/83 established
for `seal_chacha20poly1305_for_test`/`extract_hkdf_sha256_for_test`. It is a
private `fn` — never `pub`/`pub(crate)`, never re-exported — that exists
ONLY inside this `cfg(test)`-only module, and is NOT connected to the
crate-private `kdf_core` skeleton (Stage 82) or `secret_handle`/`aead_core`
in any way. This is a test-only refactor, not a new capability: the two
pre-existing vector tests assert exactly what they asserted before Stage 86,
just calling the shared helper instead of building an `argon2::Argon2`
inline per vector.

**No `Cargo.toml` change was needed** (Stage 85 or Stage 86). The vector's
memory buffer (`Block`s) is allocated with this crate's own `std::vec` and
passed to `Argon2::hash_password_into_with_memory` — `argon2`'s optional
`alloc` feature (which would transitively enable `password-hash` and pull in
`rand_core`, per the Stage 84 review) is NOT needed for this API surface.
`argon2` stays adopted exactly as Stage 84 left it:
`default-features = false`, zero features enabled.

This is the "wired" step of the vector lifecycle in
[`docs/verification_infrastructure.md`](../../docs/verification_infrastructure.md)
§5 for Argon2id — it does not, by itself, make any public API real:
`derive_key_placeholder` is unchanged, there is still **no public
`deriveKey`/password-hashing implementation**, and the runtime still selects
only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`. See
[`test/fedos_core_rust_argon2_wiring.test.ts`](../../test/fedos_core_rust_argon2_wiring.test.ts)
and
[`test/fedos_core_rust_argon2_test_helper.test.ts`](../../test/fedos_core_rust_argon2_test_helper.test.ts)
for the dedicated guard tests (module/helper presence and visibility, no
production `argon2`/`Argon2` reference, `kdf_core` unchanged and still
placeholder-only, public `pub fn` count still 6, no production password/
salt/secret/tag storage field, `rand`/`getrandom` still not a direct
dependency, `password-hash` feature still not enabled, Runtime/Worker
untouched, no committed build artifact).

## Internal key material skeleton (Stage 87)

`src/lib.rs` gains a fourth crate-private module, `key_material` (alongside
Stage 79's `secret_handle`, Stage 80's `aead_core`, and Stage 82's
`kdf_core`, placed right after `kdf_core`, still ahead of this file's first
module gated `cfg(test)`). It reuses `secret_handle`'s exact
placeholder-only pattern rather than a divergent design, and defines:

- **`KeyMaterialState`** (`pub(crate) enum`) — `Empty` / `Placeholder` /
  `Cleared` — same three variants as `SecretHandleState`.
- **`KeyMaterialKind`** (`pub(crate) enum`) — `AeadKeyPlaceholder` /
  `KdfOutputPlaceholder` / `NostrKeyPlaceholder` / `UnknownPlaceholder` — a
  label only, naming a future connection point; no key of any of these kinds
  is held.
- **`KeyMaterialStatus`** (`pub(crate) struct`) — a non-sensitive status
  snapshot, carrying only the state enum.
- **`PlaceholderMarker`** (private) — a fixed, non-secret `u8` newtype,
  identical in shape to `secret_handle`'s own (deliberately not shared
  across modules, so each skeleton stays independently reviewable). Exists
  ONLY so `KeyMaterialHandle` has a concrete `Zeroize`-able type to wrap in
  `secrecy::SecretBox`.
- **`KeyMaterialHandle`** (`pub(crate) struct`) — the skeleton itself,
  holding `state: KeyMaterialState`, `kind: KeyMaterialKind`, and
  `marker: SecretBox<PlaceholderMarker>`. Five methods:
  `new_placeholder(kind: KeyMaterialKind)` (constructs a handle — takes only
  the label, no secret input of any kind, no borrowed-byte-slice/
  `Vec<u8>`/`String` parameter), `status()` (returns the non-sensitive
  snapshot), `kind()` (returns the label — intent only), `clear()`
  (zeroizes the placeholder marker and sets state to `Cleared` — does not
  return, expose, or copy the marker), and `is_cleared()` (a boolean check).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns a
`KeyMaterialHandle`. See
[`test/fedos_core_rust_key_material.test.ts`](../../test/fedos_core_rust_key_material.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, no key/seed/plaintext/ciphertext/passphrase/
nonce storage field, no `Vec<u8>`/`String`/borrowed-byte-slice secret field,
no AEAD/HKDF/Argon2/NIP-44, no random/`getrandom`, no `unsafe`, no committed
build artifact, Runtime/Worker untouched, no connection to
`secret_handle`/`aead_core`/`kdf_core`).

**A future AEAD/KDF connection point, still unconnected today.**
`key_material` never constructs a `SecretHandle`, an `AeadPlaceholderRequest`,
or a `KdfPlaceholderRequest`, and reads no key or secret byte from any of
them — same "when a skeleton-to-skeleton connection is ambiguous, leave it
unconnected rather than guess at a future design" reasoning Stage 80/82
already established. `KeyMaterialKind`'s four variants exist so a later,
explicitly-reviewed stage has a settled label vocabulary to extend from, once
it also implements the AEAD/KDF/Nostr-identity operation that would consume
real key bytes.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage — `zeroize`/`secrecy` were already `[dependencies]` entries since
Stage 78): no key, seed, plaintext, ciphertext, passphrase, or nonce byte is
accepted, stored, or handled anywhere in `key_material`; no AEAD/HKDF/
Argon2/NIP-44 operation is implemented or called;
`derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder` are
unchanged; and nothing is wired into the Runtime, the Worker, or
`CryptoProvider`/`FedosCoreCryptoProvider` — the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

## Internal domain separation label skeleton (Stage 88)

`src/lib.rs` gains a fifth crate-private module, `domain_label` (alongside
Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's `kdf_core`,
and Stage 87's `key_material`, placed right after `key_material`, still
ahead of this file's first module gated `cfg(test)`). It defines:

- **`DomainLabelState`** (`pub(crate) enum`) — `Placeholder` / `Disabled`.
  `Disabled` is the `Default` — the inert state before any `DomainLabel` is
  constructed for use.
- **`DomainLabelKind`** (`pub(crate) enum`) — `FedosMasterPlaceholder` /
  `AeadKeyPlaceholder` / `KdfOutputPlaceholder` / `NostrKeyPlaceholder` /
  `Nip44Placeholder` / `TestOnlyPlaceholder` — a label identity only; no
  key/derivation of any of these kinds happens here.
- **`DomainLabelStatus`** (`pub(crate) struct`) — a non-sensitive status
  snapshot, carrying only the state enum.
- **`DomainLabel`** (`pub(crate) struct`) — the skeleton itself, holding
  only `kind: DomainLabelKind` and `state: DomainLabelState`. Four methods:
  `new_placeholder(kind: DomainLabelKind)` (constructs a handle — takes only
  the label identity, no user-, environment-, or config-derived input of any
  kind), `kind()` (returns the label identity), `status()` (returns the
  non-sensitive snapshot), and `as_static_label()` (returns the fixed
  `&'static str` for this handle's kind, via a private `const fn` lookup
  table on `DomainLabelKind` — `"fedos:placeholder:master"`,
  `"fedos:placeholder:aead-key"`, `"fedos:placeholder:kdf-output"`,
  `"fedos:placeholder:nostr-key"`, `"fedos:placeholder:nip44"`,
  `"fedos:placeholder:test-only"`).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns a
`DomainLabel`. See
[`test/fedos_core_rust_domain_label.test.ts`](../../test/fedos_core_rust_domain_label.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, every label is a fixed static string literal
matching the documented table, no `String`/`Vec` field, `new_placeholder`
takes only a `DomainLabelKind`, no env/runtime/config-derived label
construction, no `unsafe`, no committed build artifact, Runtime/Worker
untouched, no connection to
`secret_handle`/`aead_core`/`kdf_core`/`key_material`).

**Fixed labels only — no dynamic construction.** Every string
`as_static_label()` can return is a compile-time `&'static str` literal
inside a `const fn` — never built with `format!`, `String::from`,
`.to_string()`, string concatenation, or read from `std::env`/any runtime
configuration/any user input. `DomainLabel` stores no `String`, no `Vec<u8>`,
and no borrowed-byte-slice field of any kind — only the two labels
(`kind`/`state`).

**No connection to `secret_handle`, `aead_core`, `kdf_core`, or
`key_material`.** `domain_label` never constructs any of their types and
mixes no fixed label into an actual HKDF/AEAD/NIP-44/Nostr-key-derivation
operation — same "when a skeleton-to-skeleton connection is ambiguous, leave
it unconnected rather than guess at a future design" reasoning Stage
80/82/87 already established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, or nonce byte is
accepted, stored, or handled anywhere in `domain_label`; no HKDF/AEAD/
NIP-44 operation is implemented or called, and no Nostr key is derived;
`derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder` are
unchanged; and nothing is wired into the Runtime, the Worker, or
`CryptoProvider`/`FedosCoreCryptoProvider` — the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

## Internal operation context skeleton (Stage 89)

`src/lib.rs` gains a sixth crate-private module, `operation_context`
(alongside Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's
`kdf_core`, Stage 87's `key_material`, and Stage 88's `domain_label`, placed
right after `domain_label`, still ahead of this file's first module gated
`cfg(test)`). It defines:

- **`OperationContextState`** (`pub(crate) enum`) — `Placeholder` /
  `Disabled`. `Disabled` is the `Default` — the inert state before any
  `OperationContext` is constructed for use (same shape as
  `DomainLabelState`, Stage 88).
- **`OperationKind`** (`pub(crate) enum`) — `AeadEncryptPlaceholder` /
  `AeadDecryptPlaceholder` / `HkdfExtractPlaceholder` /
  `HkdfExpandPlaceholder` / `HkdfExtractExpandPlaceholder` /
  `Argon2idPlaceholder` / `Nip44EncryptPlaceholder` /
  `Nip44DecryptPlaceholder` / `NostrKeyDerivationPlaceholder` /
  `TestOnlyPlaceholder` — a label only; no key/derivation/encryption of any
  of these kinds happens here.
- **`OperationContextStatus`** (`pub(crate) struct`) — a non-sensitive
  status snapshot, carrying only the state enum.
- **`OperationContext`** (`pub(crate) struct`) — the skeleton itself,
  holding only `kind: OperationKind` and `state: OperationContextState`.
  Four methods: `new_placeholder(kind: OperationKind)` (constructs a
  context — takes only the label, no user-, environment-, or
  config-derived input of any kind), `kind()` (returns the label — intent
  only), `status()` (returns the non-sensitive snapshot), and
  `is_placeholder()` (a boolean check — always `true` for any handle, since
  `new_placeholder` is the only constructor).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns an
`OperationContext`. See
[`test/fedos_core_rust_operation_context.test.ts`](../../test/fedos_core_rust_operation_context.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, every `OperationKind` variant is a label-only
unit variant, no `String`/`Vec` field, `new_placeholder` takes only an
`OperationKind`, no env/runtime/config-derived context construction, no
AEAD/HKDF/Argon2 usage, no `unsafe`, no committed build artifact,
Runtime/Worker untouched, no connection to
`secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`).

**Labels only — no dynamic allocation, no secret bytes.** `OperationKind`'s
ten variants are all bare unit variants (no associated data); `OperationContext`
stores no `String`, no `Vec<u8>`, and no borrowed-byte-slice field of any
kind — only the two labels (`kind`/`state`). `new_placeholder` takes no
user-, environment-, or config-derived input.

**No connection to `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
or `domain_label`.** `operation_context` never constructs any of their types
and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, and derives no Nostr
key — same "when a skeleton-to-skeleton connection is ambiguous, leave it
unconnected rather than guess at a future design" reasoning Stage
80/82/87/88 already established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, or nonce byte is
accepted, stored, or handled anywhere in `operation_context`; no AEAD/HKDF/
Argon2/NIP-44 operation is implemented or called, and no Nostr key is
derived; `derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder`
are unchanged; and nothing is wired into the Runtime, the Worker, or
`CryptoProvider`/`FedosCoreCryptoProvider` — the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

## Internal request descriptor skeleton (Stage 90)

`src/lib.rs` gains a seventh crate-private module, `request_descriptor`
(alongside Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's
`kdf_core`, Stage 87's `key_material`, Stage 88's `domain_label`, and Stage
89's `operation_context`, placed right after `operation_context`, still
ahead of this file's first module gated `cfg(test)`). It defines:

- **`RequestDescriptorState`** (`pub(crate) enum`) — `Placeholder` /
  `Disabled`. `Disabled` is the `Default` — the inert state before any
  `RequestDescriptor` is constructed for use (same shape as
  `OperationContextState`, Stage 89).
- **`RequestDescriptorKind`** (`pub(crate) enum`) —
  `AeadEncryptRequestPlaceholder` / `AeadDecryptRequestPlaceholder` /
  `HkdfExtractRequestPlaceholder` / `HkdfExpandRequestPlaceholder` /
  `HkdfExtractExpandRequestPlaceholder` / `Argon2idRequestPlaceholder` /
  `Nip44EncryptRequestPlaceholder` / `Nip44DecryptRequestPlaceholder` /
  `NostrKeyDerivationRequestPlaceholder` / `TestOnlyRequestPlaceholder` — a
  label only; no request payload of any of these kinds is described here.
- **`RequestDescriptorStatus`** (`pub(crate) struct`) — a non-sensitive
  status snapshot, carrying only the state enum.
- **`RequestDescriptor`** (`pub(crate) struct`) — the skeleton itself,
  holding only `kind: RequestDescriptorKind` and
  `state: RequestDescriptorState`. Four methods: `new_placeholder(kind:
  RequestDescriptorKind)` (constructs a descriptor — takes only the label,
  no user-, environment-, or config-derived input of any kind), `kind()`
  (returns the label — intent only), `status()` (returns the non-sensitive
  snapshot), and `is_placeholder()` (a boolean check — always `true` for
  any handle, since `new_placeholder` is the only constructor).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns a
`RequestDescriptor`. See
[`test/fedos_core_rust_request_descriptor.test.ts`](../../test/fedos_core_rust_request_descriptor.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, every `RequestDescriptorKind` variant is a
label-only unit variant, no `String`/`Vec` field, `new_placeholder` takes
only a `RequestDescriptorKind`, no env/runtime/config-derived descriptor
construction, no AEAD/HKDF/Argon2 usage, no `unsafe`, no committed build
artifact, Runtime/Worker untouched, no connection to
`secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`/
`operation_context`).

**Non-sensitive metadata only — no dynamic allocation, no secret bytes.**
`RequestDescriptorKind`'s ten variants are all bare unit variants (no
associated data); `RequestDescriptor` stores no `String`, no `Vec<u8>`, and
no borrowed-byte-slice field of any kind — only the two labels
(`kind`/`state`). `new_placeholder` takes no user-, environment-, or
config-derived input, and describes no real request payload (no plaintext,
ciphertext, key, salt, nonce, or associated-data byte).

**No connection to `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
`domain_label`, or `operation_context`.** `request_descriptor` never
constructs any of their types and runs no actual AEAD/HKDF/Argon2/NIP-44
operation, and derives no Nostr key — same "when a skeleton-to-skeleton
connection is ambiguous, leave it unconnected rather than guess at a future
design" reasoning Stage 80/82/87/88/89 already established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, or nonce byte is
accepted, stored, or handled anywhere in `request_descriptor`; no AEAD/HKDF/
Argon2/NIP-44 operation is implemented or called, and no Nostr key is
derived; `derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder`
are unchanged; and nothing is wired into the Runtime, the Worker, or
`CryptoProvider`/`FedosCoreCryptoProvider` — the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

## Internal response descriptor skeleton (Stage 91)

`src/lib.rs` gains an eighth crate-private module, `response_descriptor`
(alongside Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's
`kdf_core`, Stage 87's `key_material`, Stage 88's `domain_label`, Stage
89's `operation_context`, and Stage 90's `request_descriptor`, placed
right after `request_descriptor`, still ahead of this file's first module
gated `cfg(test)`). It defines:

- **`ResponseDescriptorState`** (`pub(crate) enum`) — `Placeholder` /
  `Disabled` / `ErrorPlaceholder`. `Disabled` is the `Default` — the inert
  state before any `ResponseDescriptor` is constructed for use (same shape
  as `RequestDescriptorState`, Stage 90, plus one extra variant: a
  placeholder ERROR state, never a real error payload/message/cause byte).
- **`ResponseDescriptorKind`** (`pub(crate) enum`) —
  `AeadCiphertextPlaceholder` / `AeadPlaintextPlaceholder` /
  `HkdfPrkPlaceholder` / `HkdfOkmPlaceholder` / `Argon2idTagPlaceholder` /
  `Nip44CiphertextPlaceholder` / `Nip44PlaintextPlaceholder` /
  `NostrSecretKeyPlaceholder` / `NostrPublicKeyPlaceholder` /
  `ErrorPlaceholder` / `TestOnlyPlaceholder` — a label only; no result
  payload of any of these kinds is described here.
- **`ResponseDescriptorStatus`** (`pub(crate) struct`) — a non-sensitive
  status snapshot, carrying only the state enum.
- **`ResponseDescriptor`** (`pub(crate) struct`) — the skeleton itself,
  holding only `kind: ResponseDescriptorKind` and
  `state: ResponseDescriptorState`. Six methods: `new_placeholder(kind:
  ResponseDescriptorKind)` (constructs a descriptor — takes only the
  label, no user-, environment-, or config-derived input of any kind, no
  result payload of any kind), `new_error_placeholder()` (takes NO input
  of any kind — always pairs `ResponseDescriptorKind::ErrorPlaceholder`
  with `ResponseDescriptorState::ErrorPlaceholder`), `kind()` (returns the
  label — intent only), `status()` (returns the non-sensitive snapshot),
  `is_placeholder()` (`true` only for a handle from `new_placeholder`),
  and `is_error_placeholder()` (`true` only for a handle from
  `new_error_placeholder`).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns a
`ResponseDescriptor`. See
[`test/fedos_core_rust_response_descriptor.test.ts`](../../test/fedos_core_rust_response_descriptor.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, every `ResponseDescriptorKind` variant is a
label-only unit variant, no `String`/`Vec` field, `new_placeholder` takes
only a `ResponseDescriptorKind` and `new_error_placeholder` takes nothing,
no env/runtime/config-derived descriptor construction, no AEAD/HKDF/Argon2
usage, no `unsafe`, no committed build artifact, Runtime/Worker untouched,
no connection to `secret_handle`/`aead_core`/`kdf_core`/`key_material`/
`domain_label`/`operation_context`/`request_descriptor`).

**Non-sensitive metadata only — no dynamic allocation, no secret bytes, no
result payload.** `ResponseDescriptorKind`'s eleven variants are all bare
unit variants (no associated data); `ResponseDescriptor` stores no
`String`, no `Vec<u8>`, and no borrowed-byte-slice field of any kind —
only the two labels (`kind`/`state`). Neither constructor takes a real
result byte (no plaintext, ciphertext, key, tag, or associated-data byte),
and `new_error_placeholder()` never carries a real error
payload/message/cause byte either.

**No connection to `secret_handle`, `aead_core`, `kdf_core`,
`key_material`, `domain_label`, `operation_context`, or
`request_descriptor`.** `response_descriptor` never constructs any of
their types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, and
derives no Nostr key — same "when a skeleton-to-skeleton connection is
ambiguous, leave it unconnected rather than guess at a future design"
reasoning Stage 80/82/87/88/89/90 already established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, tag, or nonce
byte is accepted, stored, or handled anywhere in `response_descriptor`;
no AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and no
Nostr key is derived; `derive_key_placeholder`/`encrypt_placeholder`/
`decrypt_placeholder` are unchanged; and nothing is wired into the
Runtime, the Worker, or `CryptoProvider`/`FedosCoreCryptoProvider` — the
host still selects only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

A future, explicitly-reviewed Stage 92 candidate is an internal crypto
pipeline skeleton — a type basis to eventually connect the Request/
Response/Operation/DomainLabel/KeyMaterial descriptors, still no real
connection or cryptography wired in.
