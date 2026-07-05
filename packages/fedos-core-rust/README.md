# @nostr-window/fedos-core-rust

The **FedOS crypto core** package boundary — the INTENDED future home of a
RustCrypto-backed WASM/FFI crypto core, kept as a standalone package so the host
app depends only on its *contract*, never on its internals.

> **Status: Stage 138 — a fixed-size AEAD nonce helper:
> `fedos_aead_nonce_96`.** `FedosAeadNonceKind` (one variant,
> `NinetySixBit`), `FedosNonceState` (`Ready` / `EntropySourceUnavailable`
> — independent of `FedosRandomBytesState`), and `FedosAeadNonceDecision`
> (`kind`/`state`/`nonce: Option<[u8; 12]>`) round out the group.
> `fedos_aead_nonce_96()` draws exactly 12 bytes (96 bits) from the OS
> CSPRNG via `getrandom::fill` — a SECOND real call site of `getrandom`,
> independent of `fedos_random_bytes_32` (Stage 137) and not implemented
> by calling it. The public `pub fn` surface grows from twenty-three
> (Stage 137) to twenty-four. 96 bits matches both currently-adopted AEAD
> candidates' shared nonce size (ChaCha20-Poly1305, AES-256-GCM). Same
> shape as Stage 137 throughout: fixed, label-selected size, no
> zero-length/caller-supplied count, a fixed
> `EntropySourceUnavailable`/`nonce: None` failure with no fallback PRNG
> and no panic. The nonce is never deterministic, never a counter, and
> never derived from a seed/password/user input, per
> `docs/nonce_generation_policy.md` (Stage 134, updated §16 this stage).
> This is a nonce-DRAWING helper ONLY — no AEAD seal/open, no encryption,
> no decryption, and no connection to
> `encrypt_placeholder`/`decrypt_placeholder` (Stage 69), `aead_core`
> (Stage 80), `kdf_core` (Stage 82), or `SecretHandle` (Stage 79).
> `Cargo.toml` is UNCHANGED; no Runtime/Worker/CryptoProvider/WASM
> wiring. **Stage 137's cargo verification gate is also now confirmed
> GREEN** in a real toolchain environment
> (`stable-x86_64-pc-windows-msvc`, rustc/cargo 1.96.1) —
> `cargo check`/`cargo test`/`cargo check --tests` all passed, no code
> fix was needed (see `docs/random_bytes_implementation_plan.md` §15).
> See "Rust AEAD nonce helper (Stage 138)" below, and
> [`docs/nonce_generation_policy.md`](../../docs/nonce_generation_policy.md)
> §16 for the full record. Prior status:
>
> **Stage 137 — first REAL implementation behind this crate's
> public API: `fedos_random_bytes_32`.** `FedosRandomBytesLength` (one
> variant, `ThirtyTwo`), `FedosRandomBytesState` (`Ready` /
> `EntropySourceUnavailable`), and `FedosRandomBytesDecision`
> (`length`/`state`/`bytes: Option<[u8; 32]>`) round out the group.
> `fedos_random_bytes_32()` draws exactly 32 bytes from the OS CSPRNG via
> `getrandom::fill` — the FIRST time `getrandom` (adopted Stage 104,
> build-check only until now) is actually imported and called anywhere in
> this crate, production or test. The public `pub fn` surface grows from
> twenty-two (Stage 106) to twenty-three. Output length is fixed and
> label-selected, never an open caller-supplied count (no zero-length
> request exists); a CSPRNG failure returns `EntropySourceUnavailable`
> with `bytes: None` — no fallback PRNG, no `rand`/`thread_rng`
> substitute, and no panic. This is general-purpose randomness ONLY: no
> nonce generation, no key generation, no key derivation, and no AEAD/KDF/
> NIP-44 operation is added or connected — `SecretHandle` (Stage 79),
> `aead_core` (Stage 80), and `kdf_core` (Stage 82) remain untouched.
> `Cargo.toml` is UNCHANGED (no dependency change — `getrandom` was
> already adopted Stage 104); no Runtime/Worker/CryptoProvider/WASM
> wiring. See "Rust randomBytes implementation (Stage 137)" below, and
> [`docs/random_bytes_implementation_plan.md`](../../docs/random_bytes_implementation_plan.md),
> [`docs/nonce_generation_policy.md`](../../docs/nonce_generation_policy.md),
> and
> [`docs/secret_lifecycle_implementation_plan.md`](../../docs/secret_lifecycle_implementation_plan.md)
> for the full design records this stage follows. Prior status:
>
> **Stage 106 — Public Boundary Freeze v2: public key-USAGE label
> enumeration (`FedosKeyUsageLabel`, eight labels) + public algorithm
> policy metadata (`FedosAlgorithmRequirement`/`FedosAlgorithmCapability`/
> `FedosAlgorithmPolicy`) + a Capability/Feature/Policy/Version/Usage/
> Format/Algorithm README reorganization.** The public `pub fn` surface
> grows from eighteen (Stage 105) to twenty-two. Every label remains
> planning intent only — no raw key byte, no owned string, no growable
> byte collection, no parser, no validator, no enforced authorization or
> approval rule, and no import/export/generate function exists anywhere;
> `Cargo.toml` is UNCHANGED; no CSPRNG entropy source is consulted; no
> Runtime/Worker/CryptoProvider/WASM wiring. See "Public key-usage label
> boundary (Stage 106)", "Public algorithm policy metadata (Stage 106)",
> and "Public boundary overview" below for the full record. Prior status:
> Stage 105 added a public key-format label enumeration
> (`FedosKeyFormatLabel`, seven FUTURE PLANNING LABELS, plus
> `FedosKeyFormatState`/`FedosKeyFormatStatus`/`FedosKeyFormatDescriptor`
> and one fixed accessor, `fedos_key_format_descriptor_placeholder()`) —
> the public `pub fn` surface grew from seventeen (Stage 103) to eighteen.
> Prior status: Stage 104 adopted the `getrandom`
> CSPRNG dependency (build check ONLY, an EIGHTH `[dependencies]` entry)
> + a `cfg(test)`-only RNG-verification-infrastructure PLACEHOLDER
> (`csprng_verification_infrastructure`, a fixed label plan, never calling
> `getrandom`) + two new design docs
> ([`docs/public_random_design.md`](../../docs/public_random_design.md),
> [`docs/public_key_provisioning.md`](../../docs/public_key_provisioning.md)).
> The public `pub fn` surface stayed UNCHANGED at seventeen (Stage 103) —
> that stage added no new public type or function. No
> `randomBytes`/nonce/encrypt/decrypt/deriveKey/key-generation/import/export
> IMPLEMENTATION existed; `getrandom` was not imported or called ANYWHERE
> in `src/lib.rs`, production or test. See "`getrandom` CSPRNG adoption + RNG
> verification-infrastructure placeholder (Stage 104)" and "Public boundary
> overview" below for the full record. Prior status: Stage 103 added ten
> more label-only PUBLIC types across five operation-boundary status
> groups (`FedosRandomBoundary` / `FedosNonceBoundary` /
> `FedosKeyGenerationBoundary` / `FedosKeyImportBoundary` /
> `FedosKeyExportBoundary`) and five descriptor/metadata groups
> (`FedosCapabilityDescriptor` / `FedosAlgorithmDescriptor` /
> `FedosBoundaryVersion` / `FedosBoundaryFeature` / `FedosBoundaryPolicy`),
> plus three design docs
> ([`docs/public_random_boundary.md`](../../docs/public_random_boundary.md),
> [`docs/public_key_boundary.md`](../../docs/public_key_boundary.md),
> [`docs/public_boundary_versioning.md`](../../docs/public_boundary_versioning.md))
> — the public `pub fn` surface grew from seven (Stage 102) to seventeen.
> Prior status: Stage 102 added
> a small, label-only PUBLIC placeholder API boundary in `src/lib.rs`
> (`FedosCryptoOperation` / `FedosCryptoAlgorithm` /
> `FedosCryptoBoundaryState` / `FedosCryptoBoundaryStatus` /
> `FedosCryptoRequestDescriptor` / `FedosCryptoResponseDescriptor` +
> `fedos_crypto_boundary_status()`) plus
> [`docs/fedos_core_public_api_design.md`](../../docs/fedos_core_public_api_design.md)
> — this crate's public `pub fn` surface grew from six to seven for the
> first time since Stage 69. Prior status: Stage 101 adopted `aes-gcm` AND
> wired the NIST AES-256-GCM vectors to `cargo test`, with the seal/open
> test-only helper extracted from the start (one combined Stage; no public
> encrypt/decrypt API, no Runtime/Worker/CryptoProvider wiring, no
> production `aes-gcm` use). Public API STILL a placeholder SKELETON. No
> cryptography reachable from any public function.**
> See
> [`docs/fedos_core_architecture_freeze_v1.md`](../../docs/fedos_core_architecture_freeze_v1.md)
> for the fixed design record of every skeleton module Stage 79–99 added
> below (Stage 100, docs only — still accurate; this Stage adds a
> dependency + test-only vector wiring, not a new skeleton).
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
> Stage 83). **Stage 101 adopts `aes-gcm` v0.10.3 (RustCrypto AEAD,
> `default-features = false`, `features = ["aes", "alloc"]` — no
> `getrandom`), this crate's SECOND AEAD, AND wires it to the NIST CAVP
> AES-256-GCM vectors at
> [`test-vectors/aead/aes256gcm-nist.json`](../../test-vectors/aead/aes256gcm-nist.json)
> under `cfg(test)` — in the SAME Stage, with the
> `seal_aes256gcm_for_test`/`open_aes256gcm_for_test` test-only helper
> pair extracted from the start (unlike `chacha20poly1305`/`argon2`,
> which each wired their vector in a later Stage and refactored a helper
> in a later Stage still) — see "RFC 8439 vector wiring" below for the
> byte-level pattern this reuses; `aead_core` (Stage 80) remains
> unchanged and placeholder-only, unconnected to it.** Stage 78 adopted
> `zeroize` / `secrecy` / `subtle` as a
> secret-handling FOUNDATION. Stage 79 added a crate-private `secret_handle`
> module. Stage 80 added a second crate-private module, `aead_core`. Stage 82
> added a third crate-private module, `kdf_core` — see the "Internal KDF
> module skeleton" section below. Stage 84 adopted `argon2` v0.5.3
> (`default-features = false`, no features), wired to the RFC 9106 Argon2id
> vector under `cfg(test)` in Stage 85 (refactored into a test-only helper
> Stage 86). Stage 87 added a fourth crate-private module, `key_material`,
> Stage 88 a fifth, `domain_label`, Stage 89 a sixth, `operation_context`,
> Stage 90 a seventh, `request_descriptor`, Stage 91 an eighth,
> `response_descriptor`, Stage 92 a ninth, `crypto_pipeline`, Stage 93 a
> tenth, `descriptor_bundle`, Stage 94 an eleventh, `execution_plan`, Stage
> 95 a twelfth, `error_taxonomy`, Stage 96 a thirteenth, `audit_event`,
> Stage 97 a fourteenth, `audit_policy`, and Stage 98 a fifteenth,
> `lifecycle_state` — see the "Internal key material skeleton" / "Internal
> domain separation label skeleton" / "Internal operation context
> skeleton" / "Internal request descriptor skeleton" / "Internal response
> descriptor skeleton" / "Internal crypto pipeline skeleton" / "Internal
> descriptor bundle skeleton" / "Internal execution plan skeleton" /
> "Internal error taxonomy skeleton" / "Internal audit event label
> skeleton" / "Internal audit policy skeleton" / "Internal lifecycle
> state skeleton" sections below; all twelve are UNCHANGED this stage,
> still placeholder-only. **Stage 99 adds a sixteenth crate-private
> module, `module_registry`** — an INTERNAL-ONLY module-registry skeleton
> that ENUMERATES, by fixed label only, every crate-private skeleton
> module added since Stage 79, plus a `ModuleRegistryKind` label enum
> (`SecretHandlePlaceholder` / `AeadCorePlaceholder` / `KdfCorePlaceholder`
> / `KeyMaterialPlaceholder` / `DomainLabelPlaceholder` /
> `OperationContextPlaceholder` / `RequestDescriptorPlaceholder` /
> `ResponseDescriptorPlaceholder` / `CryptoPipelinePlaceholder` /
> `DescriptorBundlePlaceholder` / `ExecutionPlanPlaceholder` /
> `ErrorTaxonomyPlaceholder` / `AuditEventPlaceholder` /
> `AuditPolicyPlaceholder` / `LifecycleStatePlaceholder` /
> `TestOnlyPlaceholder`) — see the "Internal module registry skeleton"
> section below. **No dynamic registry mechanism** —
> `ModuleRegistry::registered_module_count()` returns the hardcoded
> literal `15` (the real skeleton count, excluding `TestOnlyPlaceholder`)
> — never a length method call, never a `Vec`/`HashMap`/`BTreeMap`/
> static-array-derived count, and no `lazy_static`/`once_cell`/
> `inventory`-crate mechanism anywhere. **No logging** — `ModuleRegistry`
> writes to no stdout/stderr/log sink (no
> `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere). **No
> module construction or reference** — `module_registry`'s
> `ModuleRegistryKind` variants are ENUMERATION labels only; it never
> constructs, holds, or reads a field of a `SecretHandle`,
> `AeadPlaceholderRequest`, `KdfPlaceholderRequest`, `KeyMaterialHandle`,
> `DomainLabel`, `OperationContext`, `RequestDescriptor`,
> `ResponseDescriptor`, `CryptoPipeline`, `DescriptorBundle`,
> `ExecutionPlan`, `CryptoErrorDescriptor`, `AuditEventLabel`,
> `AuditPolicy`, or `LifecycleMarker`. **Not connected to `secret_handle`,
> `aead_core`, `kdf_core`, `key_material`, `domain_label`,
> `operation_context`, `request_descriptor`, `response_descriptor`,
> `crypto_pipeline`, `descriptor_bundle`, `execution_plan`,
> `error_taxonomy`, `audit_event`, `audit_policy`, or `lifecycle_state`**
> — same "when in doubt, leave unconnected" reasoning those modules
> already state; all fifteen are UNCHANGED this stage, still
> placeholder-only. **No production `deriveKey`/password KDF** —
> production code (everything before this file's first
> `cfg(test)`-gated module) still does not import `argon2` at all;
> `derive_key_placeholder` remains byte-for-byte unchanged. `Cargo.toml`
> is UNCHANGED this stage (no new dependency needed). The Rust crate
> still has no `wasm-bindgen`, no `unsafe`, and produces **no `.wasm`**;
> the runtime/Worker/`CryptoProvider` are **not** wired to any of this. A
> real RustCrypto-backed core is a future, explicitly-reviewed stage
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
  the `cfg(test)`-only `rfc8439_vectors` module added Stage 75, and `aes-gcm`
  (this crate's SECOND AEAD, adopted Stage 101) is exercised ONLY inside the
  `cfg(test)`-only `aes256gcm_vectors` module added the SAME Stage, to check
  each dependency against its own official vectors (RFC 8439, NIST CAVP
  AES-256-GCM); no production code path imports, calls, or exercises
  either, and there is still no ChaCha20-Poly1305 / XChaCha20-Poly1305 /
  AES-GCM encrypt/decrypt function any caller can reach. Stage 80 adds an
  INTERNAL-ONLY `AeadPlaceholderRequest` skeleton (crate-private
  `aead_core` module, `pub(crate)` at most, never `pub`, never
  re-exported) that holds only an algorithm label and an encrypt-or-decrypt
  intent label — no key, nonce, plaintext, ciphertext, or tag byte, and its
  production code does not import `chacha20poly1305` or `aes-gcm` either
- No CSPRNG / random generation (chacha20poly1305's default `getrandom`
  feature is explicitly disabled; `hkdf` pulls in no `rand`/`getrandom`
  either; `argon2`'s default `rand` feature is explicitly disabled too, so
  it pulls in no `rand_core` either; `aes-gcm`'s optional `getrandom`
  feature is likewise explicitly disabled)
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
- No PUBLIC pipeline type — Stage 92 adds an INTERNAL-ONLY
  `CryptoPipeline` skeleton (crate-private `crypto_pipeline` module,
  `pub(crate)` at most, never `pub`, never re-exported) that names a
  future AEAD/HKDF/Argon2/NIP-44/Nostr-key-derivation PIPELINE via a
  `CryptoPipelineKind` label only; it accepts no user-, environment-, or
  config-derived input, holds no key/seed/plaintext/ciphertext/passphrase/
  tag/nonce byte, no `String`/`Vec` field, and does not construct or hold
  any of `secret_handle`/`aead_core`/`kdf_core`/`key_material`/
  `domain_label`/`operation_context`/`request_descriptor`/
  `response_descriptor`'s types
- No PUBLIC bundle type — Stage 93 adds an INTERNAL-ONLY
  `DescriptorBundle` skeleton (crate-private `descriptor_bundle` module,
  `pub(crate)` at most, never `pub`, never re-exported) that names a
  future AEAD/HKDF/Argon2/NIP-44/Nostr-key-derivation BUNDLE via a
  `DescriptorBundleKind` label only; it accepts no user-, environment-, or
  config-derived input, holds no key/seed/plaintext/ciphertext/passphrase/
  tag/nonce byte, no `String`/`Vec` field, and does not construct or hold
  any of `secret_handle`/`aead_core`/`kdf_core`/`key_material`/
  `domain_label`/`operation_context`/`request_descriptor`/
  `response_descriptor`/`crypto_pipeline`'s types
- No PUBLIC plan type — Stage 94 adds an INTERNAL-ONLY `ExecutionPlan`
  skeleton (crate-private `execution_plan` module, `pub(crate)` at most,
  never `pub`, never re-exported) that names a future AEAD/HKDF/Argon2/
  NIP-44/Nostr-key-derivation processing ORDER via an `ExecutionPlanKind`
  label and this crate's canonical six-step `ExecutionStepKind` label
  sequence only; it accepts no user-, environment-, or config-derived
  input, holds no key/seed/plaintext/ciphertext/passphrase/tag/nonce byte,
  no `String`/`Vec` field, `step_count()` returns a fixed `usize` chosen
  by `match` (never a runtime-sized collection length), and it does not
  construct or hold any of `secret_handle`/`aead_core`/`kdf_core`/
  `key_material`/`domain_label`/`operation_context`/`request_descriptor`/
  `response_descriptor`/`crypto_pipeline`/`descriptor_bundle`'s types
- No PUBLIC error type — Stage 95 adds an INTERNAL-ONLY
  `CryptoErrorDescriptor` skeleton (crate-private `error_taxonomy` module,
  `pub(crate)` at most, never `pub`, never re-exported) that classifies a
  future AEAD/HKDF/Argon2/NIP-44/Nostr-key-derivation operation FAILURE
  via a `CryptoErrorKind` label only; it accepts no user-, environment-,
  or config-derived input, holds no key/seed/plaintext/ciphertext/
  passphrase/tag/nonce byte, no error message field, no wrapped
  source-error field, no captured call-stack information, no `String`/
  `Vec` field, and it does not construct or hold any of
  `secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`/
  `operation_context`/`request_descriptor`/`response_descriptor`/
  `crypto_pipeline`/`descriptor_bundle`/`execution_plan`'s types
- No PUBLIC audit-event type, and no logging — Stage 96 adds an
  INTERNAL-ONLY `AuditEventLabel` skeleton (crate-private `audit_event`
  module, `pub(crate)` at most, never `pub`, never re-exported) that names
  a future FedOS Core crypto-internal state change via an `AuditEventKind`
  label only; it accepts no user-, environment-, or config-derived input,
  holds no key/seed/plaintext/ciphertext/passphrase/tag/nonce byte, no
  event payload field, no `String`/`Vec` field, writes to no stdout/
  stderr/log sink (no `println!`/`eprintln!`/`tracing`/`log` crate usage
  anywhere), and it does not construct or hold any of
  `secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`/
  `operation_context`/`request_descriptor`/`response_descriptor`/
  `crypto_pipeline`/`descriptor_bundle`/`execution_plan`/`error_taxonomy`'s
  types
- No PUBLIC audit-policy type, and no logging — Stage 97 adds an
  INTERNAL-ONLY `AuditPolicy` skeleton (crate-private `audit_policy`
  module, `pub(crate)` at most, never `pub`, never re-exported) that names
  a future decision of which kind of observation would be permitted via
  an `AuditPolicyKind` label and returns a fixed `AuditPolicyDecision`
  label (`decision_placeholder()` always returns the safe-default
  `DenyPlaceholder`, regardless of `kind`); it accepts no user-,
  environment-, or config-derived input, holds no key/seed/plaintext/
  ciphertext/passphrase/tag/nonce byte, no observation payload field, no
  `String`/`Vec` field, writes to no stdout/stderr/log sink (no
  `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere), does not
  reference `audit_event` (Stage 96) or its types by name, and does not
  construct or hold any of `secret_handle`/`aead_core`/`kdf_core`/
  `key_material`/`domain_label`/`operation_context`/`request_descriptor`/
  `response_descriptor`/`crypto_pipeline`/`descriptor_bundle`/
  `execution_plan`/`error_taxonomy`'s types
- No PUBLIC lifecycle type, no logging, no timestamp/counter — Stage 98
  adds an INTERNAL-ONLY `LifecycleMarker` skeleton (crate-private
  `lifecycle_state` module, `pub(crate)` at most, never `pub`, never
  re-exported) that names a future coarse crypto-provider/request/secret/
  audit/pipeline lifecycle transition via a `LifecycleKind` label and a
  six-variant `LifecycleState`; it accepts no user-, environment-, or
  config-derived input, holds no key/seed/plaintext/ciphertext/
  passphrase/tag/nonce byte, no observation-payload/timestamp/counter
  field, no `String`/`Vec` field, writes to no stdout/stderr/log sink (no
  `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere), its four
  `mark_*_placeholder(&mut self)` transition methods take no input beyond
  `&mut self`, and it does not construct or hold any of
  `secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`/
  `operation_context`/`request_descriptor`/`response_descriptor`/
  `crypto_pipeline`/`descriptor_bundle`/`execution_plan`/`error_taxonomy`/
  `audit_event`/`audit_policy`'s types
- No PUBLIC registry type, no dynamic registry mechanism, no logging —
  Stage 99 adds an INTERNAL-ONLY `ModuleRegistry` skeleton (crate-private
  `module_registry` module, `pub(crate)` at most, never `pub`, never
  re-exported) that ENUMERATES, by fixed `ModuleRegistryKind` label only,
  every crate-private skeleton module added since Stage 79;
  `registered_module_count()` returns the hardcoded literal `15` — never
  a length method call, never a `Vec`/`HashMap`/`BTreeMap`/static-array-
  derived count, and no `lazy_static`/`once_cell`/`inventory`-crate
  mechanism anywhere; it accepts no user-, environment-, or
  config-derived input, holds no key/seed/plaintext/ciphertext/
  passphrase/tag/nonce byte, no observation-payload/timestamp/counter
  field, no `String`/`Vec` field, writes to no stdout/stderr/log sink (no
  `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere), and does
  not construct or hold any of
  `secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`/
  `operation_context`/`request_descriptor`/`response_descriptor`/
  `crypto_pipeline`/`descriptor_bundle`/`execution_plan`/`error_taxonomy`/
  `audit_event`/`audit_policy`/`lifecycle_state`'s types
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
  Cargo.toml     — Rust crate skeleton (v0.0.0, edition 2021, rlib) + chacha20poly1305 dependency (Stage 74) + serde/serde_json/hex dev-dependencies (Stage 75) + hkdf dependency (Stage 76) + sha2 dev-dependency (Stage 77) + zeroize/secrecy/subtle dependencies (Stage 78) + argon2 dependency (Stage 84) + aes-gcm dependency (Stage 101) — UNCHANGED since Stage 101
  src/index.ts   — entry point: FedosCoreCrypto seam + PlaceholderFedosCoreCrypto / createFedosCoreCrypto
  src/types.ts   — FedosCoreCrypto contract, status/decision/capability, request shapes (imports nothing)
  src/wasm_loader.ts — WASM loader seam (Noop/Placeholder) — loads nothing (Stage 63)
  src/lib.rs     — Rust placeholder API (status/capabilities + *_placeholder fns), UNCHANGED since Stage 69 — NO crypto, NO unsafe, NO WASM in the public API; a `cfg(test)`-only `rfc8439_vectors` module (Stage 75) verifies chacha20poly1305 against RFC 8439, refactored Stage 81 to share seal/open logic via two test-only helper fns; a second `cfg(test)`-only `rfc5869_vectors` module (Stage 77) verifies hkdf against RFC 5869, refactored Stage 83 to share extract/expand logic via three test-only helper fns; a third `cfg(test)`-only `rfc9106_vectors` module (Stage 85) verifies argon2 against RFC 9106 Argon2id, refactored Stage 86 to share derivation logic via one test-only helper fn; a crate-private `secret_handle` module (Stage 79) is an INTERNAL-ONLY `SecretHandle` skeleton using zeroize/secrecy against a placeholder marker; a crate-private `aead_core` module (Stage 80, unchanged since) is an INTERNAL-ONLY `AeadPlaceholderRequest` skeleton (algorithm + operation labels only); a crate-private `kdf_core` module (Stage 82, unchanged since) is an INTERNAL-ONLY `KdfPlaceholderRequest` skeleton (algorithm + operation labels only); a crate-private `key_material` module (Stage 87) is an INTERNAL-ONLY `KeyMaterialHandle` skeleton reusing `secret_handle`'s zeroize/secrecy placeholder-marker pattern, plus a `KeyMaterialKind` label enum; a crate-private `domain_label` module (Stage 88) is an INTERNAL-ONLY `DomainLabel` skeleton holding only a fixed `&'static str` label per `DomainLabelKind`; a crate-private `operation_context` module (Stage 89) is an INTERNAL-ONLY `OperationContext` skeleton naming a future crypto operation via an `OperationKind` label only; a crate-private `request_descriptor` module (Stage 90) is an INTERNAL-ONLY `RequestDescriptor` skeleton naming a future crypto operation REQUEST via a `RequestDescriptorKind` label only, non-sensitive metadata only; a crate-private `response_descriptor` module (Stage 91) is an INTERNAL-ONLY `ResponseDescriptor` skeleton naming a future crypto operation RESULT via a `ResponseDescriptorKind` label only, non-sensitive metadata only; a crate-private `crypto_pipeline` module (Stage 92) is an INTERNAL-ONLY `CryptoPipeline` skeleton naming a future crypto PIPELINE via a `CryptoPipelineKind` label only, not yet bundling any other skeleton; a crate-private `descriptor_bundle` module (Stage 93) is an INTERNAL-ONLY `DescriptorBundle` skeleton naming a future crypto BUNDLE via a `DescriptorBundleKind` label only, not yet grouping any other skeleton's value; a crate-private `execution_plan` module (Stage 94) is an INTERNAL-ONLY `ExecutionPlan` skeleton naming a future crypto processing ORDER via an `ExecutionPlanKind` label and a fixed `ExecutionStepKind` six-step label sequence only; a crate-private `error_taxonomy` module (Stage 95) is an INTERNAL-ONLY `CryptoErrorDescriptor` skeleton classifying a future crypto operation FAILURE via a `CryptoErrorKind` label only, no error message/source/stack field; a crate-private `audit_event` module (Stage 96) is an INTERNAL-ONLY `AuditEventLabel` skeleton naming a future crypto-internal state change via an `AuditEventKind` label only, no event payload and no logging; a crate-private `audit_policy` module (Stage 97) is an INTERNAL-ONLY `AuditPolicy` skeleton naming a future observability decision via an `AuditPolicyKind` label and a fixed `AuditPolicyDecision` label (always `DenyPlaceholder` today), no observation payload, no logging, and no reference to `audit_event`; a crate-private `lifecycle_state` module (Stage 98) is an INTERNAL-ONLY `LifecycleMarker` skeleton naming a future coarse lifecycle transition via a `LifecycleKind` label and a six-variant `LifecycleState`, no payload/timestamp/counter, no logging; a crate-private `module_registry` module (Stage 99) is an INTERNAL-ONLY `ModuleRegistry` skeleton that ENUMERATES, by fixed `ModuleRegistryKind` label only, every skeleton module added since Stage 79, `registered_module_count()` hardcoded to `15`, no dynamic registry mechanism, no logging — none of the sixteen skeletons is part of the public API, and none is connected to any other; a fourth `cfg(test)`-only `aes256gcm_vectors` module (Stage 101) verifies aes-gcm against the NIST CAVP AES-256-GCM vectors, with its `seal_aes256gcm_for_test`/`open_aes256gcm_for_test` test-only helper pair extracted from the start
```

The Rust `src/lib.rs` mirrors the TS `FedosCoreCrypto` shape with placeholder-only
functions (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`) — each returns an `Unavailable` / `Placeholder`
`FedosCoreStatus` and runs no cryptography. `#![forbid(unsafe_code)]` bans
`unsafe`. No WASM target is declared; nothing compiles to `.wasm`.

## Dependencies (Stage 74/76/78/84/101/104 production + Stage 75/77 dev-dependencies)

- **`chacha20poly1305` v0.11.0** (RustCrypto, Apache-2.0 OR MIT,
  `default-features = false`, `features = ["alloc"]`) — one of EIGHT entries
  in `[dependencies]` (production). Pulls in, transitively, only other
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
  false`, NO `features` enabled) — the sixth entry in `[dependencies]`
  (production), adopted Stage 84. See "`argon2` dependency adoption
  (Stage 84)" below for the full review; NOT imported/used anywhere in
  `src/lib.rs` yet — production or `cfg(test)` — dependency + build check
  only.
- **`aes-gcm` v0.10.3** (RustCrypto, Apache-2.0 OR MIT, `default-features =
  false`, `features = ["aes", "alloc"]`) — the seventh entry in
  `[dependencies]` (production), and this crate's SECOND AEAD, adopted AND
  wired to the NIST CAVP AES-256-GCM vectors IN THE SAME Stage (101) — see
  "AES-256-GCM vector wiring (Stage 101)" below for the full review. Pulls
  in 10 NEW transitive packages beyond the existing tree — `aead` v0.5.2
  (a second, older generation, distinct from the `aead` v0.6.1 already
  pulled in by `chacha20poly1305`), `aes`, `cipher` v0.4.4 (a second, older
  generation, distinct from `cipher` v0.5.2), `ctr`, `ghash`,
  `opaque-debug`, `polyval`, and `universal-hash` v0.5.1 (a second, older
  generation, distinct from `universal-hash` v0.6.1) — **no `getrandom`, no
  `rand`/`rand_core`, no build script (`build.rs`) in any of them.**
  `aes-gcm` itself declares `#![deny(unsafe_code)]`; `aes` uses `unsafe`
  internally for its AES-NI/ARMv8 hardware-acceleration backends and their
  CPU-feature autodetection, the same pattern already noted for
  `chacha20poly1305`'s/`argon2`'s transitive trees above — this crate's own
  `#![forbid(unsafe_code)]` is unaffected. MSRV for `aes-gcm` 0.10.3 (and
  its new transitive crates) is Rust 1.56 — well below the existing 1.85
  floor, so no MSRV bump was needed. As of this same Stage, this dependency
  is exercised — but only inside `cfg(test)`, by the `aes256gcm_vectors`
  module (see below); production code still neither imports nor calls it.
- **`getrandom` v0.3.4** (rust-random project, MIT OR Apache-2.0, default
  features) — the eighth and newest entry in `[dependencies]` (production),
  and this crate's first CSPRNG entropy source, adopted Stage 104. Adopted
  DIRECTLY rather than the full `rand`/`rand_core` crates — the minimal
  entropy-source wrapper alone, with no `Rng`/`CryptoRng` trait ecosystem
  to also review. Pulls in ONE new transitive package (itself); `cfg-if`
  v1.0.4 is reused at its existing pinned version. Has a `build.rs` (target
  detection, its normal documented mechanism) and uses `unsafe` internally
  (direct OS syscall/FFI bindings — inherent to an entropy source). MSRV
  1.63, well below the 1.85 floor. NOT imported or called anywhere in
  `src/lib.rs` — production or `cfg(test)` — this stage: dependency + build
  check only, exactly like every prior first-adoption stage. See
  "`getrandom` CSPRNG adoption + RNG verification-infrastructure placeholder
  (Stage 104)" below for the full review.
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
  76, `zeroize`/`secrecy`/`subtle` — Stage 78, `argon2` — Stage 84, and
  `aes-gcm` — Stage 101 entries). **`Cargo.lock` is intentionally NOT
  committed** (library crate;
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

> **Stage 144–146 extends this skeleton to hold real secret bytes** — see
> [Internal secret-handle real-byte storage (Stage 144–146)](#internal-secret-handle-real-byte-storage-stage-144146)
> below. Everything described in this Stage 79 section remains true of the
> `new_placeholder()` path, unchanged.

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

## Internal crypto pipeline skeleton (Stage 92)

`src/lib.rs` gains a ninth crate-private module, `crypto_pipeline`
(alongside Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's
`kdf_core`, Stage 87's `key_material`, Stage 88's `domain_label`, Stage
89's `operation_context`, Stage 90's `request_descriptor`, and Stage 91's
`response_descriptor`, placed right after `response_descriptor`, still
ahead of this file's first module gated `cfg(test)`). It defines:

- **`CryptoPipelineState`** (`pub(crate) enum`) — `Placeholder` /
  `Disabled`. `Disabled` is the `Default` — the inert state before any
  `CryptoPipeline` is constructed for use (same shape as
  `OperationContextState`, Stage 89).
- **`CryptoPipelineKind`** (`pub(crate) enum`) — `AeadPipelinePlaceholder`
  / `KdfPipelinePlaceholder` / `Argon2idPipelinePlaceholder` /
  `Nip44PipelinePlaceholder` / `NostrKeyPipelinePlaceholder` /
  `TestOnlyPipelinePlaceholder` — a label only; no pipeline of any of these
  kinds is bundled here.
- **`CryptoPipelineStatus`** (`pub(crate) struct`) — a non-sensitive status
  snapshot, carrying only the state enum.
- **`CryptoPipeline`** (`pub(crate) struct`) — the skeleton itself, holding
  only `kind: CryptoPipelineKind` and `state: CryptoPipelineState`. Four
  methods: `new_placeholder(kind: CryptoPipelineKind)` (constructs a
  pipeline — takes only the label, no user-, environment-, or
  config-derived input of any kind, bundles no descriptor of any kind),
  `kind()` (returns the label — intent only), `status()` (returns the
  non-sensitive snapshot), and `is_placeholder()` (a boolean check —
  always `true` for any handle, since `new_placeholder` is the only
  constructor).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns a
`CryptoPipeline`. See
[`test/fedos_core_rust_crypto_pipeline.test.ts`](../../test/fedos_core_rust_crypto_pipeline.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, every `CryptoPipelineKind` variant is a
label-only unit variant, no `String`/`Vec` field, `new_placeholder` takes
only a `CryptoPipelineKind`, no env/runtime/config-derived pipeline
construction, no AEAD/HKDF/Argon2 usage, no `unsafe`, no committed build
artifact, Runtime/Worker untouched, no connection to
`secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`/
`operation_context`/`request_descriptor`/`response_descriptor`).

**No descriptor bundling yet.** `CryptoPipeline` does not construct or hold
a `SecretHandle`, `AeadPlaceholderRequest`, `KdfPlaceholderRequest`,
`KeyMaterialHandle`, `DomainLabel`, `OperationContext`,
`RequestDescriptor`, or `ResponseDescriptor` — it is a label-only type
basis for a future stage to actually bundle them. `CryptoPipelineKind`'s
six variants are all bare unit variants (no associated data);
`CryptoPipeline` stores no `String`, no `Vec<u8>`, and no
borrowed-byte-slice field of any kind — only the two labels
(`kind`/`state`).

**No connection to `secret_handle`, `aead_core`, `kdf_core`,
`key_material`, `domain_label`, `operation_context`, `request_descriptor`,
or `response_descriptor`.** `crypto_pipeline` never constructs any of
their types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, and
derives no Nostr key — same "when a skeleton-to-skeleton connection is
ambiguous, leave it unconnected rather than guess at a future design"
reasoning Stage 80/82/87/88/89/90/91 already established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, tag, or nonce
byte is accepted, stored, or handled anywhere in `crypto_pipeline`; no
AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and no Nostr
key is derived; `derive_key_placeholder`/`encrypt_placeholder`/
`decrypt_placeholder` are unchanged; and nothing is wired into the
Runtime, the Worker, or `CryptoProvider`/`FedosCoreCryptoProvider` — the
host still selects only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

## Internal descriptor bundle skeleton (Stage 93)

`src/lib.rs` gains a tenth crate-private module, `descriptor_bundle`
(alongside Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's
`kdf_core`, Stage 87's `key_material`, Stage 88's `domain_label`, Stage
89's `operation_context`, Stage 90's `request_descriptor`, Stage 91's
`response_descriptor`, and Stage 92's `crypto_pipeline`, placed right
after `crypto_pipeline`, still ahead of this file's first module gated
`cfg(test)`). It defines:

- **`DescriptorBundleState`** (`pub(crate) enum`) — `Placeholder` /
  `Disabled`. `Disabled` is the `Default` — the inert state before any
  `DescriptorBundle` is constructed for use (same shape as
  `CryptoPipelineState`, Stage 92).
- **`DescriptorBundleKind`** (`pub(crate) enum`) — `AeadBundlePlaceholder`
  / `KdfBundlePlaceholder` / `Argon2idBundlePlaceholder` /
  `Nip44BundlePlaceholder` / `NostrKeyBundlePlaceholder` /
  `TestOnlyBundlePlaceholder` — a label only; no bundle of any of these
  kinds is grouped here.
- **`DescriptorBundleStatus`** (`pub(crate) struct`) — a non-sensitive
  status snapshot, carrying only the state enum.
- **`DescriptorBundle`** (`pub(crate) struct`) — the skeleton itself,
  holding only `kind: DescriptorBundleKind` and
  `state: DescriptorBundleState`. Four methods:
  `new_placeholder(kind: DescriptorBundleKind)` (constructs a bundle —
  takes only the label, no user-, environment-, or config-derived input of
  any kind, groups no descriptor of any kind), `kind()` (returns the
  label — intent only), `status()` (returns the non-sensitive snapshot),
  and `is_placeholder()` (a boolean check — always `true` for any handle,
  since `new_placeholder` is the only constructor).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns a
`DescriptorBundle`. See
[`test/fedos_core_rust_descriptor_bundle.test.ts`](../../test/fedos_core_rust_descriptor_bundle.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, every `DescriptorBundleKind` variant is a
label-only unit variant, no `String`/`Vec` field, `new_placeholder` takes
only a `DescriptorBundleKind`, no env/runtime/config-derived bundle
construction, no AEAD/HKDF/Argon2 usage, no field-declaration storage of
any other skeleton's type, no `unsafe`, no committed build artifact,
Runtime/Worker untouched).

**No descriptor value wiring — a fully independent, label-only skeleton.**
`DescriptorBundle` does not construct or hold a `SecretHandle`,
`AeadPlaceholderRequest`, `KdfPlaceholderRequest`, `KeyMaterialHandle`,
`DomainLabel`, `OperationContext`, `RequestDescriptor`,
`ResponseDescriptor`, or `CryptoPipeline` — this is the explicit,
deliberate choice this stage's task made when weighing whether to hold
those types as real fields versus staying independent: "if in doubt, stay
fully independent" won. `DescriptorBundleKind`'s six variants are all bare
unit variants (no associated data); `DescriptorBundle` stores no `String`,
no `Vec<u8>`, and no borrowed-byte-slice field of any kind — only the two
labels (`kind`/`state`).

**No connection to `secret_handle`, `aead_core`, `kdf_core`,
`key_material`, `domain_label`, `operation_context`, `request_descriptor`,
`response_descriptor`, or `crypto_pipeline`.** `descriptor_bundle` never
constructs any of their types and runs no actual AEAD/HKDF/Argon2/NIP-44
operation, and derives no Nostr key — same "when a skeleton-to-skeleton
connection is ambiguous, leave it unconnected rather than guess at a
future design" reasoning Stage 80/82/87/88/89/90/91/92 already
established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, tag, or nonce
byte is accepted, stored, or handled anywhere in `descriptor_bundle`; no
AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and no Nostr
key is derived; `derive_key_placeholder`/`encrypt_placeholder`/
`decrypt_placeholder` are unchanged; and nothing is wired into the
Runtime, the Worker, or `CryptoProvider`/`FedosCoreCryptoProvider` — the
host still selects only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

## Internal execution plan skeleton (Stage 94)

`src/lib.rs` gains an eleventh crate-private module, `execution_plan`
(alongside Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's
`kdf_core`, Stage 87's `key_material`, Stage 88's `domain_label`, Stage
89's `operation_context`, Stage 90's `request_descriptor`, Stage 91's
`response_descriptor`, Stage 92's `crypto_pipeline`, and Stage 93's
`descriptor_bundle`, placed right after `descriptor_bundle`, still ahead
of this file's first module gated `cfg(test)`). It defines:

- **`ExecutionPlanState`** (`pub(crate) enum`) — `Placeholder` /
  `Disabled`. `Disabled` is the `Default` — the inert state before any
  `ExecutionPlan` is constructed for use (same shape as
  `CryptoPipelineState`, Stage 92).
- **`ExecutionPlanKind`** (`pub(crate) enum`) — `AeadPlanPlaceholder` /
  `KdfPlanPlaceholder` / `Argon2idPlanPlaceholder` / `Nip44PlanPlaceholder`
  / `NostrKeyPlanPlaceholder` / `TestOnlyPlanPlaceholder` — a label only;
  no plan of any of these kinds is ordered here.
- **`ExecutionStepKind`** (`pub(crate) enum`) — this crate's canonical
  six-step placeholder sequence: `ValidateRequestPlaceholder` /
  `ResolveDomainPlaceholder` / `ResolveKeyMaterialPlaceholder` /
  `ExecutePrimitivePlaceholder` / `BuildResponsePlaceholder` /
  `ClearTemporaryStatePlaceholder` — a label only; no step of any of these
  kinds is executed here.
- **`ExecutionPlanStatus`** (`pub(crate) struct`) — a non-sensitive status
  snapshot, carrying only the state enum.
- **`ExecutionPlan`** (`pub(crate) struct`) — the skeleton itself, holding
  only `kind: ExecutionPlanKind` and `state: ExecutionPlanState`. Five
  methods: `new_placeholder(kind: ExecutionPlanKind)` (constructs a plan —
  takes only the label, no user-, environment-, or config-derived input of
  any kind, orders no step of any kind), `kind()` (returns the label —
  intent only), `status()` (returns the non-sensitive snapshot),
  `is_placeholder()` (a boolean check — always `true` for any handle,
  since `new_placeholder` is the only constructor), and `step_count()`
  (returns a fixed `usize` — `6`, the count of `ExecutionStepKind`'s
  variants — chosen by a `match` on `kind`, never computed from a
  growable, heap-allocated collection).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns an
`ExecutionPlan`. See
[`test/fedos_core_rust_execution_plan.test.ts`](../../test/fedos_core_rust_execution_plan.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, every `ExecutionPlanKind`/`ExecutionStepKind`
variant is a label-only unit variant, no `String`/`Vec` field,
`new_placeholder` takes only an `ExecutionPlanKind`, `step_count()` returns
a fixed `usize` via `match` with no `.len()`/collection call, no
env/runtime/config-derived plan construction, no AEAD/HKDF/Argon2 usage, no
field-declaration storage of any other skeleton's type, no `unsafe`, no
committed build artifact, Runtime/Worker untouched).

**No descriptor/pipeline wiring — a fully independent, label-only
skeleton.** `ExecutionPlan` does not construct or hold a `SecretHandle`,
`AeadPlaceholderRequest`, `KdfPlaceholderRequest`, `KeyMaterialHandle`,
`DomainLabel`, `OperationContext`, `RequestDescriptor`,
`ResponseDescriptor`, `CryptoPipeline`, or `DescriptorBundle` — same "if in
doubt, stay fully independent" choice Stage 93 already made.
`ExecutionPlanKind`'s six variants and `ExecutionStepKind`'s six variants
are all bare unit variants (no associated data); `ExecutionPlan` stores no
`String`, no `Vec<u8>`, and no borrowed-byte-slice field of any kind — only
the two labels (`kind`/`state`).

**No connection to `secret_handle`, `aead_core`, `kdf_core`,
`key_material`, `domain_label`, `operation_context`, `request_descriptor`,
`response_descriptor`, `crypto_pipeline`, or `descriptor_bundle`.**
`execution_plan` never constructs any of their types and runs no actual
AEAD/HKDF/Argon2/NIP-44 operation, and derives no Nostr key — same "when a
skeleton-to-skeleton connection is ambiguous, leave it unconnected rather
than guess at a future design" reasoning Stage 80/82/87/88/89/90/91/92/93
already established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, tag, or nonce
byte is accepted, stored, or handled anywhere in `execution_plan`; no
AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and no Nostr
key is derived; `derive_key_placeholder`/`encrypt_placeholder`/
`decrypt_placeholder` are unchanged; and nothing is wired into the
Runtime, the Worker, or `CryptoProvider`/`FedosCoreCryptoProvider` — the
host still selects only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

## Internal error taxonomy skeleton (Stage 95)

`src/lib.rs` gains a twelfth crate-private module, `error_taxonomy`
(alongside Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's
`kdf_core`, Stage 87's `key_material`, Stage 88's `domain_label`, Stage
89's `operation_context`, Stage 90's `request_descriptor`, Stage 91's
`response_descriptor`, Stage 92's `crypto_pipeline`, Stage 93's
`descriptor_bundle`, and Stage 94's `execution_plan`, placed right after
`execution_plan`, still ahead of this file's first module gated
`cfg(test)`). It defines:

- **`CryptoErrorState`** (`pub(crate) enum`) — `Placeholder` / `Disabled`.
  `Disabled` is the `Default` — the inert state before any
  `CryptoErrorDescriptor` is constructed for use (same shape as
  `ExecutionPlanState`, Stage 94).
- **`CryptoErrorKind`** (`pub(crate) enum`) — `AeadFailurePlaceholder` /
  `KdfFailurePlaceholder` / `Argon2idFailurePlaceholder` /
  `Nip44FailurePlaceholder` / `NostrKeyFailurePlaceholder` /
  `InvalidRequestPlaceholder` / `UnsupportedOperationPlaceholder` /
  `InternalInvariantPlaceholder` / `TestOnlyFailurePlaceholder` — a label
  only; no failure of any of these kinds is classified here.
- **`CryptoErrorStatus`** (`pub(crate) struct`) — a non-sensitive status
  snapshot, carrying only the state enum.
- **`CryptoErrorDescriptor`** (`pub(crate) struct`) — the skeleton itself,
  holding only `kind: CryptoErrorKind` and `state: CryptoErrorState`. Four
  methods: `new_placeholder(kind: CryptoErrorKind)` (constructs a
  descriptor — takes only the label, no user-, environment-, or
  config-derived input of any kind, classifies no real failure of any
  kind), `kind()` (returns the label — intent only), `status()` (returns
  the non-sensitive snapshot), and `is_placeholder()` (a boolean check —
  always `true` for any handle, since `new_placeholder` is the only
  constructor).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns a
`CryptoErrorDescriptor`. See
[`test/fedos_core_rust_error_taxonomy.test.ts`](../../test/fedos_core_rust_error_taxonomy.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, every `CryptoErrorKind` variant is a
label-only unit variant, no `String`/`Vec` field, no error message/
source/stack field, `new_placeholder` takes only a `CryptoErrorKind`, no
env/runtime/config-derived error construction, no AEAD/HKDF/Argon2 usage,
no field-declaration storage of any other skeleton's type, no `unsafe`, no
committed build artifact, Runtime/Worker untouched).

**No raw error strings, no stack traces — a fully independent, label-only
skeleton.** `CryptoErrorDescriptor` holds no error message field, no
wrapped source-error field (no `impl std::error::Error`, no
`std::fmt::Display` implementation), and no captured call-stack
information of any kind — only the two labels (`kind`/`state`). It does
not construct or hold a `SecretHandle`, `AeadPlaceholderRequest`,
`KdfPlaceholderRequest`, `KeyMaterialHandle`, `DomainLabel`,
`OperationContext`, `RequestDescriptor`, `ResponseDescriptor`,
`CryptoPipeline`, `DescriptorBundle`, or `ExecutionPlan` — same "if in
doubt, stay fully independent" choice Stage 93/94 already made.
`CryptoErrorKind`'s nine variants are all bare unit variants (no
associated data); `CryptoErrorDescriptor` stores no `String`, no
`Vec<u8>`, and no borrowed-byte-slice field of any kind.

**No connection to `secret_handle`, `aead_core`, `kdf_core`,
`key_material`, `domain_label`, `operation_context`, `request_descriptor`,
`response_descriptor`, `crypto_pipeline`, `descriptor_bundle`, or
`execution_plan`.** `error_taxonomy` never constructs any of their types
and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, and derives no
Nostr key — same "when a skeleton-to-skeleton connection is ambiguous,
leave it unconnected rather than guess at a future design" reasoning
Stage 80/82/87/88/89/90/91/92/93/94 already established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, tag, or nonce
byte is accepted, stored, or handled anywhere in `error_taxonomy`; no
AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and no Nostr
key is derived; `derive_key_placeholder`/`encrypt_placeholder`/
`decrypt_placeholder` are unchanged; and nothing is wired into the
Runtime, the Worker, or `CryptoProvider`/`FedosCoreCryptoProvider` — the
host still selects only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

## Internal audit event label skeleton (Stage 96)

`src/lib.rs` gains a thirteenth crate-private module, `audit_event`
(alongside Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's
`kdf_core`, Stage 87's `key_material`, Stage 88's `domain_label`, Stage
89's `operation_context`, Stage 90's `request_descriptor`, Stage 91's
`response_descriptor`, Stage 92's `crypto_pipeline`, Stage 93's
`descriptor_bundle`, Stage 94's `execution_plan`, and Stage 95's
`error_taxonomy`, placed right after `error_taxonomy`, still ahead of this
file's first module gated `cfg(test)`). It defines:

- **`AuditEventState`** (`pub(crate) enum`) — `Placeholder` / `Disabled`.
  `Disabled` is the `Default` — the inert state before any
  `AuditEventLabel` is constructed for use (same shape as
  `CryptoErrorState`, Stage 95).
- **`AuditEventKind`** (`pub(crate) enum`) —
  `CryptoProviderSelectedPlaceholder` / `RequestAcceptedPlaceholder` /
  `RequestRejectedPlaceholder` / `PlanPreparedPlaceholder` /
  `PrimitiveExecutedPlaceholder` / `ResponseBuiltPlaceholder` /
  `SecretClearedPlaceholder` / `ErrorClassifiedPlaceholder` /
  `TestOnlyPlaceholder` — a label only; no state change of any of these
  kinds is observed here.
- **`AuditEventStatus`** (`pub(crate) struct`) — a non-sensitive status
  snapshot, carrying only the state enum.
- **`AuditEventLabel`** (`pub(crate) struct`) — the skeleton itself,
  holding only `kind: AuditEventKind` and `state: AuditEventState`. Four
  methods: `new_placeholder(kind: AuditEventKind)` (constructs a label —
  takes only the kind, no user-, environment-, or config-derived input of
  any kind, observes no real state change of any kind), `kind()` (returns
  the label — intent only), `status()` (returns the non-sensitive
  snapshot), and `is_placeholder()` (a boolean check — always `true` for
  any handle, since `new_placeholder` is the only constructor).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns an
`AuditEventLabel`. See
[`test/fedos_core_rust_audit_event.test.ts`](../../test/fedos_core_rust_audit_event.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, every `AuditEventKind` variant is a
label-only unit variant, no `String`/`Vec` field, no event payload
field-declaration, no `println!`/`eprintln!`/`log`/`tracing` usage,
`new_placeholder` takes only an `AuditEventKind`, no env/runtime/
config-derived event construction, no AEAD/HKDF/Argon2 usage, no
field-declaration storage of any other skeleton's type, no `unsafe`, no
committed build artifact, Runtime/Worker untouched).

**No logging, no event payload — a fully independent, label-only
skeleton.** `AuditEventLabel` writes to no stdout/stderr/log sink of any
kind and holds no payload field of any kind — only the two labels
(`kind`/`state`). It does not construct or hold a `SecretHandle`,
`AeadPlaceholderRequest`, `KdfPlaceholderRequest`, `KeyMaterialHandle`,
`DomainLabel`, `OperationContext`, `RequestDescriptor`,
`ResponseDescriptor`, `CryptoPipeline`, `DescriptorBundle`,
`ExecutionPlan`, or `CryptoErrorDescriptor` — same "if in doubt, stay
fully independent" choice Stage 93/94/95 already made. `AuditEventKind`'s
nine variants are all bare unit variants (no associated data);
`AuditEventLabel` stores no `String`, no `Vec<u8>`, and no
borrowed-byte-slice field of any kind.

**No connection to `secret_handle`, `aead_core`, `kdf_core`,
`key_material`, `domain_label`, `operation_context`, `request_descriptor`,
`response_descriptor`, `crypto_pipeline`, `descriptor_bundle`,
`execution_plan`, or `error_taxonomy`.** `audit_event` never constructs
any of their types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation,
and derives no Nostr key — same "when a skeleton-to-skeleton connection
is ambiguous, leave it unconnected rather than guess at a future design"
reasoning Stage 80/82/87/88/89/90/91/92/93/94/95 already established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, tag, or nonce
byte is accepted, stored, or handled anywhere in `audit_event`; no
AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, no Nostr key
is derived, and nothing is logged anywhere;
`derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder` are
unchanged; and nothing is wired into the Runtime, the Worker, or
`CryptoProvider`/`FedosCoreCryptoProvider` — the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

## Internal audit policy skeleton (Stage 97)

`src/lib.rs` gains a fourteenth crate-private module, `audit_policy`
(alongside Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's
`kdf_core`, Stage 87's `key_material`, Stage 88's `domain_label`, Stage
89's `operation_context`, Stage 90's `request_descriptor`, Stage 91's
`response_descriptor`, Stage 92's `crypto_pipeline`, Stage 93's
`descriptor_bundle`, Stage 94's `execution_plan`, Stage 95's
`error_taxonomy`, and Stage 96's `audit_event`, placed right after
`audit_event`, still ahead of this file's first module gated `cfg(test)`).
It defines:

- **`AuditPolicyState`** (`pub(crate) enum`) — `Placeholder` / `Disabled`.
  `Disabled` is the `Default` — the inert state before any `AuditPolicy`
  is constructed for use (same shape as `AuditEventState`, Stage 96).
- **`AuditPolicyKind`** (`pub(crate) enum`) — `MinimalPlaceholder` /
  `DevelopmentPlaceholder` / `TestOnlyPlaceholder` — a label only; no real
  policy profile of any of these kinds is applied here.
- **`AuditPolicyDecision`** (`pub(crate) enum`) — `AllowPlaceholder` /
  `DenyPlaceholder` — a label only; no real permission is granted or
  refused by either label alone.
- **`AuditPolicyStatus`** (`pub(crate) struct`) — a non-sensitive status
  snapshot, carrying only the state enum.
- **`AuditPolicy`** (`pub(crate) struct`) — the skeleton itself, holding
  only `kind: AuditPolicyKind` and `state: AuditPolicyState`. Five
  methods: `new_placeholder(kind: AuditPolicyKind)` (constructs a policy
  — takes only the label, no user-, environment-, or config-derived input
  of any kind), `kind()` (returns the label — intent only), `status()`
  (returns the non-sensitive snapshot), `is_placeholder()` (a boolean
  check — always `true` for any handle, since `new_placeholder` is the
  only constructor), and `decision_placeholder()` (takes NO input of any
  kind and always returns the fixed, safe-default label
  `AuditPolicyDecision::DenyPlaceholder`, regardless of `kind` — a real
  per-kind decision rule is deferred to a later, explicitly-reviewed
  stage).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns an
`AuditPolicy`. See
[`test/fedos_core_rust_audit_policy.test.ts`](../../test/fedos_core_rust_audit_policy.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, every `AuditPolicyKind`/`AuditPolicyDecision`
variant is a label-only unit variant, no `String`/`Vec` field, no
observation-payload field-declaration, no `println!`/`eprintln!`/`log`/
`tracing`/`dbg!` usage, `new_placeholder` takes only an `AuditPolicyKind`,
`decision_placeholder()` always returns the fixed `DenyPlaceholder` label,
no env/runtime/config-derived policy construction, no AEAD/HKDF/Argon2
usage, no field-declaration storage of any other skeleton's type, no
`unsafe`, no committed build artifact, Runtime/Worker untouched).

**No logging, no observation payload — a fully independent, label-only
skeleton.** `AuditPolicy` writes to no stdout/stderr/log sink of any kind
and holds no payload field of any kind — only the two labels
(`kind`/`state`). It does not construct or hold a `SecretHandle`,
`AeadPlaceholderRequest`, `KdfPlaceholderRequest`, `KeyMaterialHandle`,
`DomainLabel`, `OperationContext`, `RequestDescriptor`,
`ResponseDescriptor`, `CryptoPipeline`, `DescriptorBundle`,
`ExecutionPlan`, or `CryptoErrorDescriptor` — same "if in doubt, stay
fully independent" choice Stage 93/94/95/96 already made.

**No `audit_event` wiring — not even a name reference.** Per this stage's
explicit scope, `audit_policy` does not mention `audit_event` or any of
its types anywhere in its source, since no real connection between the
two exists yet; this goes one step further than earlier "unconnected"
skeletons (which name the modules they don't connect to in their own doc
comments) — here the instruction was to avoid the reference entirely when
it isn't necessary.

**No connection to `secret_handle`, `aead_core`, `kdf_core`,
`key_material`, `domain_label`, `operation_context`, `request_descriptor`,
`response_descriptor`, `crypto_pipeline`, `descriptor_bundle`,
`execution_plan`, or `error_taxonomy`.** `audit_policy` never constructs
any of their types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation,
and derives no Nostr key — same "when a skeleton-to-skeleton connection
is ambiguous, leave it unconnected rather than guess at a future design"
reasoning Stage 80/82/87/88/89/90/91/92/93/94/95/96 already established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, tag, or nonce
byte is accepted, stored, or handled anywhere in `audit_policy`; no
AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, no Nostr key
is derived, and nothing is logged anywhere;
`derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder` are
unchanged; and nothing is wired into the Runtime, the Worker, or
`CryptoProvider`/`FedosCoreCryptoProvider` — the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

## Internal lifecycle state skeleton (Stage 98)

`src/lib.rs` gains a fifteenth crate-private module, `lifecycle_state`
(alongside Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's
`kdf_core`, Stage 87's `key_material`, Stage 88's `domain_label`, Stage
89's `operation_context`, Stage 90's `request_descriptor`, Stage 91's
`response_descriptor`, Stage 92's `crypto_pipeline`, Stage 93's
`descriptor_bundle`, Stage 94's `execution_plan`, Stage 95's
`error_taxonomy`, Stage 96's `audit_event`, and Stage 97's
`audit_policy`, placed right after `audit_policy`, still ahead of this
file's first module gated `cfg(test)`). It defines:

- **`LifecycleState`** (`pub(crate) enum`) — six variants: `Disabled` /
  `Placeholder` / `PreparedPlaceholder` / `ActivePlaceholder` /
  `ClearedPlaceholder` / `ErrorPlaceholder`. `Disabled` is the `Default`
  — the inert state before any `LifecycleMarker` is constructed for use.
- **`LifecycleKind`** (`pub(crate) enum`) —
  `CryptoProviderLifecyclePlaceholder` / `RequestLifecyclePlaceholder` /
  `SecretLifecyclePlaceholder` / `AuditLifecyclePlaceholder` /
  `PipelineLifecyclePlaceholder` / `TestOnlyLifecyclePlaceholder` — a
  label only; no real tracked resource of any of these kinds exists here.
- **`LifecycleStatus`** (`pub(crate) struct`) — a non-sensitive status
  snapshot, carrying only the state enum.
- **`LifecycleMarker`** (`pub(crate) struct`) — the skeleton itself,
  holding only `kind: LifecycleKind` and `state: LifecycleState`. Eight
  methods: `new_placeholder(kind: LifecycleKind)` (constructs a marker —
  takes only the label, no user-, environment-, or config-derived input
  of any kind), `kind()` (returns the label — intent only), `status()`
  (returns the non-sensitive snapshot), `is_placeholder()` (a boolean
  check — `true` only before any `mark_*_placeholder` transition has been
  called), and four coarse, label-only transition methods —
  `mark_prepared_placeholder()`, `mark_active_placeholder()`,
  `mark_cleared_placeholder()`, `mark_error_placeholder()` — each taking
  no input beyond `&mut self` and only ever setting the fixed `state`
  label.

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns a
`LifecycleMarker`. See
[`test/fedos_core_rust_lifecycle_state.test.ts`](../../test/fedos_core_rust_lifecycle_state.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, every `LifecycleKind`/`LifecycleState`
variant is a label-only unit variant, no `String`/`Vec` field, no
payload/timestamp/counter field-declaration, no `println!`/`eprintln!`/
`log`/`tracing`/`dbg!` usage, `new_placeholder` takes only a
`LifecycleKind` and every `mark_*_placeholder` method takes nothing
beyond `&mut self`, no env/runtime/config-derived lifecycle construction,
no AEAD/HKDF/Argon2 usage, no field-declaration storage of any other
skeleton's type, no `unsafe`, no committed build artifact, Runtime/Worker
untouched).

**No logging, no payload, no timestamp, no counter — a fully independent,
label-only skeleton.** `LifecycleMarker` writes to no stdout/stderr/log
sink of any kind and holds no payload, timestamp, or counter field of any
kind — only the two labels (`kind`/`state`). It does not construct or
hold a `SecretHandle`, `AeadPlaceholderRequest`, `KdfPlaceholderRequest`,
`KeyMaterialHandle`, `DomainLabel`, `OperationContext`,
`RequestDescriptor`, `ResponseDescriptor`, `CryptoPipeline`,
`DescriptorBundle`, `ExecutionPlan`, `CryptoErrorDescriptor`,
`AuditEventLabel`, or `AuditPolicy` — same "if in doubt, stay fully
independent" choice Stage 93/94/95/96/97 already made. `LifecycleKind`'s
six variants and `LifecycleState`'s six variants are all bare unit
variants (no associated data); `LifecycleMarker` stores no `String`, no
`Vec<u8>`, and no borrowed-byte-slice field of any kind.

**No connection to `secret_handle`, `aead_core`, `kdf_core`,
`key_material`, `domain_label`, `operation_context`, `request_descriptor`,
`response_descriptor`, `crypto_pipeline`, `descriptor_bundle`,
`execution_plan`, `error_taxonomy`, `audit_event`, or `audit_policy`.**
`lifecycle_state` never constructs any of their types and runs no actual
AEAD/HKDF/Argon2/NIP-44 operation, and derives no Nostr key — same "when
a skeleton-to-skeleton connection is ambiguous, leave it unconnected
rather than guess at a future design" reasoning Stage
80/82/87/88/89/90/91/92/93/94/95/96/97 already established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, tag, or nonce
byte is accepted, stored, or handled anywhere in `lifecycle_state`; no
AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, no Nostr key
is derived, and nothing is logged anywhere;
`derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder` are
unchanged; and nothing is wired into the Runtime, the Worker, or
`CryptoProvider`/`FedosCoreCryptoProvider` — the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

## Internal module registry skeleton (Stage 99)

`src/lib.rs` gains a sixteenth crate-private module, `module_registry`
(alongside Stage 79's `secret_handle`, Stage 80's `aead_core`, Stage 82's
`kdf_core`, Stage 87's `key_material`, Stage 88's `domain_label`, Stage
89's `operation_context`, Stage 90's `request_descriptor`, Stage 91's
`response_descriptor`, Stage 92's `crypto_pipeline`, Stage 93's
`descriptor_bundle`, Stage 94's `execution_plan`, Stage 95's
`error_taxonomy`, Stage 96's `audit_event`, Stage 97's `audit_policy`,
and Stage 98's `lifecycle_state`, placed right after `lifecycle_state`,
still ahead of this file's first module gated `cfg(test)`). It defines:

- **`ModuleRegistryState`** (`pub(crate) enum`) — `Disabled` /
  `Placeholder`. `Disabled` is the `Default` — the inert state before any
  `ModuleRegistry` is constructed for use.
- **`ModuleRegistryKind`** (`pub(crate) enum`) — sixteen variants, one
  ENUMERATION label per crate-private skeleton module added since Stage
  79, plus `TestOnlyPlaceholder`: `SecretHandlePlaceholder` /
  `AeadCorePlaceholder` / `KdfCorePlaceholder` / `KeyMaterialPlaceholder`
  / `DomainLabelPlaceholder` / `OperationContextPlaceholder` /
  `RequestDescriptorPlaceholder` / `ResponseDescriptorPlaceholder` /
  `CryptoPipelinePlaceholder` / `DescriptorBundlePlaceholder` /
  `ExecutionPlanPlaceholder` / `ErrorTaxonomyPlaceholder` /
  `AuditEventPlaceholder` / `AuditPolicyPlaceholder` /
  `LifecycleStatePlaceholder` / `TestOnlyPlaceholder` — a label only;
  none of these variants ever constructs, holds, or reads a field of the
  module it names.
- **`ModuleRegistryStatus`** (`pub(crate) struct`) — a non-sensitive
  status snapshot, carrying only the state enum.
- **`ModuleRegistry`** (`pub(crate) struct`) — the skeleton itself,
  holding only `kind: ModuleRegistryKind` and `state: ModuleRegistryState`.
  Five methods: `new_placeholder(kind: ModuleRegistryKind)` (constructs a
  registry entry — takes only the label, no user-, environment-, or
  config-derived input of any kind), `kind()` (returns the label —
  intent only), `status()` (returns the non-sensitive snapshot),
  `is_placeholder()` (a boolean check — always `true` for any handle,
  since `new_placeholder` is the only constructor), and
  `registered_module_count()` (returns the hardcoded `usize` literal
  `15` — the real skeleton count, excluding `TestOnlyPlaceholder` —
  regardless of `self.kind`, never a length method call and never
  computed from any collection).

**NOT part of this crate's public API.** Every item above is `pub(crate)` at
most — never `pub` — and nothing is re-exported from the crate root. This
crate's public `pub fn` surface is still exactly the same six placeholder
functions from Stage 69 (`fedos_core_status`, `fedos_core_capabilities`,
`random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
`decrypt_placeholder`); none of them constructs, holds, or returns a
`ModuleRegistry`. See
[`test/fedos_core_rust_module_registry.test.ts`](../../test/fedos_core_rust_module_registry.test.ts)
for the dedicated guard tests (internal-only visibility, no public export,
public `pub fn` count still 6, `ModuleRegistry` holds only `kind`/`state`,
`registered_module_count()` returns the hardcoded literal `15`, no
`.len()`/`Vec`/`HashMap`/`BTreeMap`/`HashSet`/`BTreeSet`/static-array/
`lazy_static`/`once_cell`/`inventory`-crate usage, no `String`/`Vec`
field, no payload/timestamp/counter field-declaration, no
`println!`/`eprintln!`/`log`/`tracing`/`dbg!` usage, no Runtime/Worker/
`CryptoProvider` reference, no field-declaration storage of any other
skeleton's type, no `unsafe`, no committed build artifact).

**Enumeration labels only — no dynamic registry, no logging.**
`ModuleRegistryKind`'s sixteen variants are all bare unit variants (no
associated data); `ModuleRegistry` stores no `String`, no `Vec<u8>`, and
no borrowed-byte-slice field of any kind — only the two labels
(`kind`/`state`). It does not construct or hold a `SecretHandle`,
`AeadPlaceholderRequest`, `KdfPlaceholderRequest`, `KeyMaterialHandle`,
`DomainLabel`, `OperationContext`, `RequestDescriptor`,
`ResponseDescriptor`, `CryptoPipeline`, `DescriptorBundle`,
`ExecutionPlan`, `CryptoErrorDescriptor`, `AuditEventLabel`,
`AuditPolicy`, or `LifecycleMarker` — same "if in doubt, stay fully
independent" choice Stage 93/94/95/96/97/98 already made, extended here
to naming (not just avoiding) the crate's own skeleton inventory.

**No connection to `secret_handle`, `aead_core`, `kdf_core`,
`key_material`, `domain_label`, `operation_context`, `request_descriptor`,
`response_descriptor`, `crypto_pipeline`, `descriptor_bundle`,
`execution_plan`, `error_taxonomy`, `audit_event`, `audit_policy`, or
`lifecycle_state`.** `module_registry` never constructs any of their
types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, and derives
no Nostr key — same "when a skeleton-to-skeleton connection is
ambiguous, leave it unconnected rather than guess at a future design"
reasoning Stage 80/82/87/88/89/90/91/92/93/94/95/96/97/98 already
established.

This is dependency-free SKELETON work only (no new `Cargo.toml` entry this
stage): no key, seed, plaintext, ciphertext, passphrase, tag, or nonce
byte is accepted, stored, or handled anywhere in `module_registry`; no
AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, no Nostr key
is derived, and nothing is logged anywhere;
`derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder` are
unchanged; and nothing is wired into the Runtime, the Worker, or
`CryptoProvider`/`FedosCoreCryptoProvider` — the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

Per the user's own guidance for the next stage, Stage 100 is recommended
to be an **Architecture Freeze v1** — a documentation-only checkpoint
fixing the roles, boundaries, and non-connection rules of every internal
skeleton added Stage 79 through Stage 99 into a single design record,
without changing any implementation, before moving on to a real
cryptography-adoption phase (e.g. AES-GCM).

## Architecture Freeze v1 (Stage 100, docs only)

Stage 100 is a **documentation-only checkpoint**: it changes no `src/`
file, no `Cargo.toml` entry, no test, and adds no new skeleton module. It
fixes, in one design record, everything the sixteen crate-private skeleton
modules above (`secret_handle` through `module_registry`, Stage 79–99)
already established independently — a role table for all sixteen, which
pairs are explicitly NOT connected, confirmation that the public API is
still exactly the six Stage 69 placeholder functions, confirmation that
none of the sixteen is wired into the Runtime/Worker/`CryptoProvider`, a
summary of what IS verified today (RFC 8439/5869/9106, all under
`cfg(test)` only), an explicit list of what is NOT yet implemented, a
non-claims section, and a recommended next-phase order (AES-GCM dependency
adoption → AES-GCM NIST vector wiring → test-only AES-GCM helper →
internal public-API design docs → only then a public `encrypt`/`decrypt`
skeleton). See
[`docs/fedos_core_architecture_freeze_v1.md`](../../docs/fedos_core_architecture_freeze_v1.md)
for the full record.

`npm run typecheck`, `npm test` (1422 tests, same count as Stage 99),
`cargo check`, `cargo test` (101 tests, same count as Stage 99), and
`cargo check --tests` all stay GREEN because nothing they check changed —
this stage is purely additive at the documentation level.

## AES-256-GCM dependency adoption + vector wiring (Stage 101)

Stage 101 combines three steps into one reviewed Stage — unlike every
prior AEAD/KDF dependency, which spread "adopt" / "wire" / "extract a
helper" across separate, later Stages:

1. **`aes-gcm` v0.10.3** becomes a `[dependencies]` (production) entry —
   this crate's SECOND AEAD, alongside `chacha20poly1305` (Stage 74). See
   "Dependencies" above for the full crate review, and
   [`docs/rust_dependency_adoption.md`](../../docs/rust_dependency_adoption.md)
   §12 for the recorded review (version, features, transitive dependencies,
   license, MSRV, `unsafe`/build-script presence).
2. **The NIST CAVP AES-256-GCM known-answer vectors** already imported at
   [`test-vectors/aead/aes256gcm-nist.json`](../../test-vectors/aead/aes256gcm-nist.json)
   (Stage 73) are wired to `cargo test` via a new `#[cfg(test)]`-only
   module, `aes256gcm_vectors`, reading the file with `include_str!` and
   running four tests:
   - `aes256gcm_json_parses_and_is_non_empty` — the vector file parses and
     is non-empty.
   - `aes256gcm_positive_vectors_encrypt_and_decrypt_correctly` — for every
     `shouldPass: true` vector, `aes-gcm` both seals (encrypts)
     plaintext+AAD to exactly the NIST vector's expected ciphertext‖tag,
     and opens (decrypts) that same ciphertext‖tag back to exactly the
     NIST vector's expected plaintext.
   - `aes256gcm_negative_vectors_fail_to_decrypt_if_present` — for the
     `shouldPass: false` vector (NIST's own official negative case — the
     source `.rsp` file records `FAIL` in place of a `PT =` line, imported
     verbatim, not fabricated, per
     [`docs/crypto_vector_sources.md`](../../docs/crypto_vector_sources.md)
     §2), decryption/authentication must fail.
   - `seal_then_open_round_trip_for_test_helper` /
     `open_fails_for_tampered_sealed_bytes_for_test_helper` — the same
     helper-focused unit-test pair Stage 81/83/86 established for the
     other AEAD/KDF vector modules.
3. **The seal/open test-only helper pair is extracted from the start** —
   `seal_aes256gcm_for_test(key_bytes, iv_bytes, plaintext_bytes,
   aad_bytes) -> Result<Vec<u8>, AeadError>` and
   `open_aes256gcm_for_test(key_bytes, iv_bytes, sealed_bytes, aad_bytes)
   -> Result<Vec<u8>, AeadError>` (`sealed_bytes` is `ciphertext‖tag`),
   mirroring `seal_chacha20poly1305_for_test`/
   `open_chacha20poly1305_for_test`'s (Stage 81) byte-level shape and
   `_for_test` naming convention exactly. Both are private `fn`s — never
   `pub`/`pub(crate)`, never re-exported — that exist ONLY inside this
   `cfg(test)`-only module, and are NOT connected to the crate-private
   `aead_core` skeleton (Stage 80) or `secret_handle` (Stage 79) in any
   way. Unlike `chacha20poly1305` (helper extracted a separate Stage 81,
   four stages after Stage 77's wiring) or `argon2` (helper extracted a
   separate Stage 86), this Stage extracts the helper from the start —
   there is no earlier "inline, then refactor" step to redo.

This is the "wired" step of the vector lifecycle in
[`docs/verification_infrastructure.md`](../../docs/verification_infrastructure.md)
§5 for AES-256-GCM — it does not, by itself, make any public API real:
`encrypt_placeholder`/`decrypt_placeholder` are unchanged, and the runtime
still selects only `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`. See
[`test/fedos_core_rust_aes_gcm_wiring.test.ts`](../../test/fedos_core_rust_aes_gcm_wiring.test.ts)
for the dedicated Stage 101 guard tests (dependency presence, seven-entry
production dependency count, no direct `rand`/`getrandom`/`wasm-bindgen`,
module gated behind `cfg(test)` only, no production `aes-gcm` reference,
public `pub fn` count still 6, `aead_core` unchanged and still
placeholder-only and unconnected, helper presence/visibility, positive/
negative vector coverage, no production key/nonce/plaintext/ciphertext/tag
storage field, Runtime/Worker untouched, no committed build artifact).

This is dependency-adoption-AND-wiring work in one Stage: no key, seed,
plaintext, ciphertext, passphrase, or nonce byte is accepted, stored, or
handled anywhere in production code (everything before this file's first
`cfg(test)`-gated module); no public `encrypt`/`decrypt` implementation
exists; `derive_key_placeholder`/`encrypt_placeholder`/
`decrypt_placeholder` are byte-for-byte unchanged; and nothing is wired
into the Runtime, the Worker, or `CryptoProvider`/`FedosCoreCryptoProvider`
— the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`.

A future, explicitly-reviewed Stage 102 candidate is internal public-API
design docs — fixing, in writing, what a future public
`encrypt`/`decrypt`/`deriveKey` signature, error taxonomy, and
secret-handling contract would look like, reusing the label vocabulary
Stage 79–99's skeletons and the Architecture Freeze v1 (Stage 100) already
fixed — still no public API implementation.

## Public crypto API design docs + placeholder API boundary (Stage 102)

Stage 102 combines a documentation deliverable with this crate's first new
PUBLIC items since Stage 69:

1. **[`docs/fedos_core_public_api_design.md`](../../docs/fedos_core_public_api_design.md)**
   fixes the DESIGN (not the implementation) of a future public
   `encrypt`/`decrypt`/`deriveKey`/`randomBytes` API in twelve numbered
   sections: purpose; the future shape of each operation; why input stays
   centered on an opaque secret handle/reference even in the future design;
   why a raw key/seed/passphrase must never be a direct parameter; the two
   AEAD candidates (ChaCha20-Poly1305, AES-256-GCM); the two KDF candidates
   (HKDF-SHA256, Argon2id); why nonce/random generation is its own separate
   boundary; a fixed error taxonomy with no raw error text or stack trace;
   an audit boundary that records labels only, never a payload; Runtime/WASM
   wiring deferred to its own future stage; an explicit statement that this
   stage is placeholder API boundary ONLY; and a six-step implementation
   roadmap for later stages.
2. `src/lib.rs` gains a small, label-only PUBLIC boundary (placed right
   after the Stage 69 placeholder functions, still ahead of Stage 79's
   `secret_handle` module):
   - **`FedosCryptoOperation`** (`pub enum`) — `Encrypt` / `Decrypt` /
     `DeriveKey` / `RandomBytes` (a label only; no operation runs).
   - **`FedosCryptoAlgorithm`** (`pub enum`) — `ChaCha20Poly1305` /
     `Aes256Gcm` / `HkdfSha256` / `Argon2id` (a label only; no cipher or
     KDF is instantiated).
   - **`FedosCryptoBoundaryState`** (`pub enum`) — `Unavailable` /
     `Placeholder`, the same shape as `FedosCoreState`.
   - **`FedosCryptoBoundaryStatus`** (`pub struct`) — a non-sensitive
     status snapshot, carrying only the state enum.
   - **`FedosCryptoRequestDescriptor`** (`pub struct`) — carries only
     `operation: FedosCryptoOperation` and `algorithm: FedosCryptoAlgorithm`
     — never a key/seed/plaintext/passphrase/nonce byte.
   - **`FedosCryptoResponseDescriptor`** (`pub struct`) — carries only
     `operation`, `algorithm`, and `state: FedosCryptoBoundaryState` — never
     a ciphertext/plaintext/derived-key byte or raw error text.
   - **`fedos_crypto_boundary_status()`** (`pub fn`) — the one new public
     function this stage adds. Takes no input and returns a fixed,
     permanently `Unavailable` `FedosCryptoBoundaryStatus`, exactly like
     `fedos_core_status()` above.

This grows the crate's public `pub fn` surface from six to seven for the
first time since Stage 69 — see
[`test/fedos_core_rust_public_api_boundary.test.ts`](../../test/fedos_core_rust_public_api_boundary.test.ts)
for the dedicated Stage 102 guard tests (design doc presence and
twelve-section coverage, the six new type declarations, the seven-function
`pub fn` surface, no encrypt/decrypt/derive/random IMPLEMENTATION function,
no raw byte parameter or `Vec<u8>` field anywhere in the new boundary, the
six Stage 69 placeholder functions byte-for-byte unchanged, no
key/seed/plaintext/ciphertext/passphrase/nonce/tag storage field, no actual
AEAD/KDF crate usage or `SecretHandle` connection, Runtime/Worker
untouched, `Cargo.toml` unchanged, no `unsafe`, no committed build
artifact).

**No implementation — labels only.** No `pub fn` added this stage performs
an AEAD, KDF, or NIP-44 operation, generates a random byte, or derives a
key. `FedosCryptoRequestDescriptor`/`FedosCryptoResponseDescriptor` hold no
borrowed-byte-slice, `Vec<u8>`, or `String` field — only the enum labels
above. The six Stage 69 placeholder functions
(`fedos_core_status`/`fedos_core_capabilities`/`random_bytes_placeholder`/
`derive_key_placeholder`/`encrypt_placeholder`/`decrypt_placeholder`) are
byte-for-byte unchanged; none of them constructs, holds, or returns any of
the new types.

**No real connection.** The new boundary does not construct, hold, or
reference a `SecretHandle`, `AeadPlaceholderRequest`,
`KdfPlaceholderRequest`, or any other crate-private skeleton's type — same
"leave unconnected rather than guess at a future design" reasoning the
internal skeletons already established, now applied to the public
boundary too.

**`Cargo.toml` is UNCHANGED this stage** — no new dependency is needed for
label-only types. Nothing is wired into the Runtime, the Worker, or
`CryptoProvider`/`FedosCoreCryptoProvider` — the host still selects only
`NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`. No WASM binding exists.

Per the user's own Stage 103 candidate list, the recommended next step is
a **public `randomBytes` placeholder boundary** — fixing nonce/random
generation as its own design point (per this stage's docs §7) before any
public `encrypt`/`decrypt` skeleton needs to consume its output. The two
other candidates offered were a WASM manifest validation skeleton and a
NIP-44 vector source/update check.

## Consolidated placeholder API boundary (Stage 103)

Stage 103 consolidates what would otherwise have been several separate
stages into one reviewed unit, per the user's explicit direction to bundle
as much of the public-API boundary's design as possible before any real
implementation. Three new design docs and ten new PUBLIC, label-only
types land on `src/lib.rs` in this single stage.

**Docs:**

- [`docs/public_random_boundary.md`](../../docs/public_random_boundary.md)
  — fixes the design of a future public `randomBytes` and its nonce
  counterpart as two INDEPENDENT boundaries (different uniqueness/failure
  requirements), extending
  [`docs/fedos_core_public_api_design.md`](../../docs/fedos_core_public_api_design.md)
  section 7.
- [`docs/public_key_boundary.md`](../../docs/public_key_boundary.md) —
  fixes the design of three future public boundaries around key material
  (generation, import, export) as three INDEPENDENT trust boundaries —
  import is the one deliberate place a raw key/seed may cross the public
  boundary, immediately converted to an opaque handle; export is flagged
  as a candidate for never being implemented at all, pending a dedicated
  authorization review.
- [`docs/public_boundary_versioning.md`](../../docs/public_boundary_versioning.md)
  — fixes the design of five descriptor/metadata types that describe the
  SHAPE of the boundary itself (capabilities, algorithms, version,
  feature flags, policy decisions), as distinct from the operation-status
  types that report whether ONE operation is available.

**Rust — five operation-boundary status groups** (`src/lib.rs`, placed
right after Stage 102's group, still ahead of Stage 79's `secret_handle`
module), each with its own independent state enum and one accessor
function:

- **`FedosRandomBoundary`** / `FedosRandomBoundaryState` →
  `fedos_random_boundary_status()`
- **`FedosNonceBoundary`** / `FedosNonceBoundaryState` →
  `fedos_nonce_boundary_status()`
- **`FedosKeyGenerationBoundary`** / `FedosKeyGenerationBoundaryState` →
  `fedos_key_generation_boundary_status()`
- **`FedosKeyImportBoundary`** / `FedosKeyImportBoundaryState` →
  `fedos_key_import_boundary_status()`
- **`FedosKeyExportBoundary`** / `FedosKeyExportBoundaryState` →
  `fedos_key_export_boundary_status()`

Each status struct carries only its own `state` field
(`Unavailable`/`Placeholder`); each function takes no input and returns a
fixed, permanently `Unavailable` status — the exact same shape as
`fedos_core_status()` and Stage 102's `fedos_crypto_boundary_status()`.

**Rust — five descriptor/metadata groups**, each describing the shape of
the boundary rather than one operation's status:

- **`FedosCapabilityDescriptor`** (`kind: FedosCapabilityKind`,
  `state: FedosCryptoBoundaryState`) → `fedos_capability_descriptors()`
  returns a fixed eight-entry list (`AeadPlaceholder` /
  `KdfPlaceholder` / `RandomPlaceholder` / `NoncePlaceholder` /
  `KeyGenerationPlaceholder` / `KeyImportPlaceholder` /
  `KeyExportPlaceholder` / `Nip44Placeholder`). Deliberately reuses Stage
  102's `FedosCryptoBoundaryState` — an explicit, direct reuse of an
  already-fixed label, not a guess.
- **`FedosAlgorithmDescriptor`** (`algorithm: FedosCryptoAlgorithm`,
  `category: FedosAlgorithmCategory`) → `fedos_algorithm_descriptors()`
  returns a fixed four-entry list pairing each of Stage 102's four
  algorithm labels with `Aead`/`Kdf`.
- **`FedosBoundaryVersion`** (`major`/`minor`/`patch`, plain `u32` fields
  — not secret, not a byte buffer) → `fedos_boundary_version()` returns
  the fixed `1.0.0` triple, versioning the SHAPE of the boundary itself,
  not the crate's own package version.
- **`FedosBoundaryFeature`** (`PlaceholderOnly` / `AuditLabelOnly` /
  `ErrorTaxonomyFixed` / `VersionedBoundary`) → `fedos_boundary_features()`
  returns this fixed four-entry list, restating this crate's own design
  commitments as machine-checkable labels.
- **`FedosBoundaryPolicy`** (`kind: FedosBoundaryPolicyKind`,
  `decision: FedosBoundaryPolicyDecision`) →
  `fedos_boundary_policy_decision(kind)` always returns
  `DenyPlaceholder`, regardless of `kind` — mirrors the crate-private
  `audit_policy` skeleton's (Stage 97) always-deny pattern, now surfaced
  publicly. `FedosBoundaryPolicyDecision` has exactly one variant today;
  this is NOT a real authorization system.

**This crate's public `pub fn` surface grows from seven to seventeen** —
the sixteen functions from Stage 69/102 are byte-for-byte unchanged. See
[`test/fedos_core_rust_public_boundary_consolidation.test.ts`](../../test/fedos_core_rust_public_boundary_consolidation.test.ts)
(19 tests) for the dedicated Stage 103 guard tests (design docs exist and
name their types, all ten type declarations, the seventeen-function `pub
fn` surface, no encrypt/decrypt/derive/random/nonce/key-generation/
import/export IMPLEMENTATION function, every status function's fixed
body, no raw byte parameter or growable-byte-vector/owned-string field,
no key/seed/plaintext/ciphertext/passphrase/nonce/tag storage field, no
actual AEAD/KDF crate usage (specific crate-usage patterns, not a bare
substring match — `FedosAlgorithmDescriptor`'s fixed table legitimately
reuses Stage 102's algorithm labels) or `SecretHandle` connection, no
Runtime/Worker/`CryptoProvider` connection, `Cargo.toml` unchanged, no
`println!`/`eprintln!`/`log`/`tracing`/`dbg!` usage, no `unsafe`, each
enum's exact variant set, `fedos_boundary_policy_decision`'s
no-branching fixed body, `fedos_boundary_version`'s fixed `1.0.0` body,
no committed build artifact).

**No implementation — labels and fixed metadata only.** None of the ten
new functions performs an AEAD, KDF, or NIP-44 operation, generates a
random byte or nonce, or produces, imports, or exports a key. No type
holds a borrowed byte slice, growable byte vector, or owned string field
— `FedosBoundaryVersion`'s `u32` triple is the only non-enum field
anywhere in this stage's additions, and it is a fixed constant, never
derived from anything. `Cargo.toml` is UNCHANGED — no new dependency is
needed for label-only types and fixed metadata. Nothing is wired into
the host's execution environment, its background worker, or a crypto
provider; no WASM binding exists.

**Where this stage stopped.** Ten type groups is already a large surface
for one stage; a real key-IMPORT boundary in particular starts to brush
against implementation territory (the ONE place raw secret bytes would
legitimately cross this boundary), which is exactly why
`docs/public_key_boundary.md` reserves that provisioning-path design as
its own future, separately-reviewed stage rather than sketching it here.
Consolidating further — e.g. also fixing the CSPRNG dependency choice, or
the raw-input-to-opaque-handle provisioning path itself — would require
picking a real dependency or a real byte-level protocol, which is
implementation, not boundary design; this stage stops short of that
line.

## `getrandom` CSPRNG adoption + RNG verification-infrastructure placeholder (Stage 104)

Stage 104 picks up exactly where Stage 103 stopped: the CSPRNG dependency
choice `docs/public_random_boundary.md`'s roadmap deferred. Three things
land in one reviewed stage — a dependency, a test-only infrastructure
placeholder, and two design docs — all build-check/design only.

**1. `getrandom` v0.3.4 adopted** as an EIGHTH `[dependencies]`
(production) entry — see "Dependencies" above for the full crate review.
Not imported or called anywhere in `src/lib.rs`, production or test — a
dependency + build-check ADOPTION ONLY, exactly like `chacha20poly1305`
(Stage 74), `hkdf` (Stage 76), and `argon2` (Stage 84) each were at their
own first-adoption stage.

**2. A new `#[cfg(test)]`-only module, `csprng_verification_infrastructure`**
(at the bottom of `src/lib.rs`, alongside the RFC 8439/5869/9106/NIST
AES-256-GCM vector modules). Unlike those four, it wires no known-answer
vector — randomness has no known-answer vector to reproduce. Instead it
fixes, as a label enumeration (`RngVerificationCategory`: 4 variants —
`EntropySourceLinked` / `OutputLengthMatchesRequest` /
`ErrorSurfacedAsResult` / `RepeatedCallsNotObviouslyConstant`) and a
fixed `RNG_VERIFICATION_PLAN` constant, which categories a FUTURE wiring
stage would need to verify. Two unit tests assert the plan itself is
well-formed (fixed length 4, no duplicate category) — neither test calls
`getrandom`, draws a random byte, or asserts anything about randomness
QUALITY. This is a deliberately narrower scope than the vector-wiring
modules: it fixes the SHAPE of a future check, not an executed one.

**3. Two new design docs:**
[`docs/public_random_design.md`](../../docs/public_random_design.md)
extends `docs/public_random_boundary.md` now that the CSPRNG dependency
is fixed (why `getrandom` over `rand`, the expected call shape, error
mapping onto the fixed taxonomy, and what the verification-infrastructure
placeholder is/is-not) and
[`docs/public_key_provisioning.md`](../../docs/public_key_provisioning.md)
designs the raw-input-to-opaque-handle provisioning contract
`docs/public_key_boundary.md` deferred (exactly one raw input per call, a
fixed bounded length, conversion to a handle as the only visible effect,
never logged/echoed/returned).

See
[`test/fedos_core_rust_getrandom_adoption.test.ts`](../../test/fedos_core_rust_getrandom_adoption.test.ts)
(16 tests) for the dedicated Stage 104 guard tests (dependency presence,
eight-entry production dependency count, no direct `rand`/`rand_core`
sibling, no production `getrandom` reference, public `pub fn` surface
unchanged at seventeen, the verification module gated behind `cfg(test)`
only and never calling `getrandom`, the fixed four-category plan, no
key/seed/plaintext/ciphertext/passphrase/nonce/tag byte, no
Runtime/Worker/`CryptoProvider` connection, `aead_core`/`kdf_core`/
`secret_handle` unchanged and unconnected, no `unsafe`, both new docs
exist, no committed build artifact). Six pre-existing guard test files
(`fedos_core_rust_dependency.test.ts`, `fedos_core_rust_skeleton.test.ts`,
`fedos_core_rust_aes_gcm_wiring.test.ts`,
`fedos_core_rust_argon2_wiring.test.ts`,
`fedos_core_rust_hkdf_wiring.test.ts`,
`fedos_core_rust_rfc8439_wiring.test.ts`) were updated because they
previously asserted `getrandom`'s ABSENCE from `Cargo.toml` at the
whole-file level and a seven-entry production dependency count — both
flipped to presence and an eight-entry count, narrowing each dependency's
own "no direct rand opt-in" check to that dependency's own line instead
of the whole file (consistent with every prior dependency-adoption
stage's update pattern). Two more
(`fedos_core_rust_public_api_boundary.test.ts`,
`fedos_core_rust_public_boundary_consolidation.test.ts`) had their
"Cargo.toml is unchanged" tests narrowed to "Cargo.toml was not touched
BY that specific stage" — still true, since Stage 104 is a later, separate
change. `src/lib.rs`'s own crate-level doc comment for this stage
deliberately avoids the literal text `` `#[cfg(test)]` `` (writing
`` `cfg(test)` `` without brackets instead) — the same self-referential
regex trap Stage 75's note first documented, now hit and fixed again
while describing this stage's own new module.

## Public Boundary Freeze v2 (Stage 102–106)

Stage 106 closes a five-stage arc (102–106) the user named **Public
Boundary Freeze v2**: the public-API boundary is now as complete as it
can be made without crossing into real cryptography, real randomness,
real key import/export, or real wiring — see "Boundary overview" and
"Updated roadmap" below, and the stop condition this stage was run under
in "Where the boundary stops" further down.

### Boundary overview — seven label/metadata groups

A consolidated reference for the full label-only public boundary, since
the stage-by-stage narrative above has grown long.
[`docs/public_capability_matrix.md`](../../docs/public_capability_matrix.md)
is the authoritative record for how these seven groups differ from each
other; this table is its condensed form. All types are `pub`; all
functions take only label parameters (never a byte buffer) and return
only label/status values (never `Vec<u8>`/`String`/secret data).

| Group | Types | Function(s) | Stage |
| --- | --- | --- | --- |
| Core status | `FedosCoreState`, `FedosCoreStatus` | `fedos_core_status`, `fedos_core_capabilities` | 69 |
| Placeholder ops | — | `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`, `decrypt_placeholder` | 69 |
| Crypto boundary | `FedosCryptoOperation`, `FedosCryptoAlgorithm`, `FedosCryptoBoundaryState`, `FedosCryptoBoundaryStatus`, `FedosCryptoRequestDescriptor`, `FedosCryptoResponseDescriptor` | `fedos_crypto_boundary_status` | 102 |
| Random/nonce boundaries | `FedosRandomBoundary`(+`State`), `FedosNonceBoundary`(+`State`) | `fedos_random_boundary_status`, `fedos_nonce_boundary_status` | 103 |
| Key boundaries | `FedosKeyGenerationBoundary`, `FedosKeyImportBoundary`, `FedosKeyExportBoundary` (each +`State`) | `fedos_key_generation_boundary_status`, `fedos_key_import_boundary_status`, `fedos_key_export_boundary_status` | 103 |
| **1. Capability** | `FedosCapabilityKind`, `FedosCapabilityDescriptor` | `fedos_capability_descriptors` | 103 |
| **2. Feature** | `FedosBoundaryFeature` | `fedos_boundary_features` | 103 |
| **3. Policy (boundary)** | `FedosBoundaryPolicyKind`, `FedosBoundaryPolicyDecision`, `FedosBoundaryPolicy` | `fedos_boundary_policy_decision` | 103 |
| **4. Version** | `FedosBoundaryVersion` | `fedos_boundary_version` | 103 |
| **5. Format** | `FedosKeyFormatLabel`, `FedosKeyFormatState`, `FedosKeyFormatStatus`, `FedosKeyFormatDescriptor` | `fedos_key_format_descriptor_placeholder` | 105 |
| **6. Usage** | `FedosKeyUsageLabel`, `FedosKeyUsageState`, `FedosKeyUsageStatus`, `FedosKeyUsageDescriptor` | `fedos_key_usage_descriptor_placeholder` | 106 |
| **7. Algorithm** | `FedosAlgorithmCategory`, `FedosAlgorithmDescriptor` (103); `FedosAlgorithmRequirement`, `FedosAlgorithmCapability`, `FedosAlgorithmPolicy` (106) | `fedos_algorithm_descriptors` (103); `fedos_algorithm_requirements`, `fedos_algorithm_capabilities`, `fedos_algorithm_policy_decision` (106) | 103, 106 |

Twenty-two `pub fn`s total (Stage 104 added a dependency and a design
record, not a public type or function — the count stayed at seventeen
through that stage). `FedosBoundaryVersion` stays `1.0.0` — no EXISTING
type's SHAPE changed through Stage 106 (per
`docs/public_boundary_versioning.md` section 4's own policy, only a
shape change warrants a bump; adding wholly new groups, as Stage 105/106
each did, is not a shape change to an existing type).
`FedosCapabilityDescriptor`
(Stage 103) and `FEDOS_CORE_CAPABILITIES`/`fedos_core_capabilities()`
(Stage 69) intentionally coexist as two different views over a similar
concept — see `docs/public_boundary_versioning.md` section 2; nothing was
deprecated or merged in this cleanup, since removing either would be a
public API change this cleanup stage does not have authorization to make.

**Design docs, in reading order:**
[`docs/fedos_core_public_api_design.md`](../../docs/fedos_core_public_api_design.md)
(Stage 102, the original 12-section design) →
[`docs/public_random_boundary.md`](../../docs/public_random_boundary.md) /
[`docs/public_key_boundary.md`](../../docs/public_key_boundary.md) /
[`docs/public_boundary_versioning.md`](../../docs/public_boundary_versioning.md)
(Stage 103, per-group detail) →
[`docs/public_random_design.md`](../../docs/public_random_design.md) /
[`docs/public_key_provisioning.md`](../../docs/public_key_provisioning.md)
(Stage 104, post-dependency-adoption detail; `public_key_provisioning.md`
updated again at Stage 105 to record the key-format label enumeration) →
[`docs/public_key_usage.md`](../../docs/public_key_usage.md) /
[`docs/public_algorithm_policy.md`](../../docs/public_algorithm_policy.md)
(Stage 106, usage/policy detail) →
[`docs/public_capability_matrix.md`](../../docs/public_capability_matrix.md)
(Stage 106, the seven-group map — no new design of its own).

### Updated roadmap (supersedes the individual docs' own roadmap sections where they overlap)

1. ~~Fix the public API design (Stage 102).~~ Done.
2. ~~Consolidate the placeholder boundary (Stage 103).~~ Done.
3. ~~Adopt a CSPRNG dependency, build-check only (Stage 104).~~ Done.
4. Design and review the key-import provisioning contract on its own
   (`docs/public_key_provisioning.md` section 6, step 1) — still no
   implementation.
5. ~~Design the key-format label enumeration
   (`docs/public_key_provisioning.md` section 6, step 2).~~ Done — Stage
   105 (`FedosKeyFormatLabel`).
6. ~~Design the key-usage label enumeration and algorithm policy
   metadata.~~ Done — Stage 106 (`FedosKeyUsageLabel`,
   `FedosAlgorithmRequirement`/`FedosAlgorithmCapability`/
   `FedosAlgorithmPolicy`).
7. Design the `(FedosKeyFormatLabel, FedosKeyUsageLabel)` authorization
   rule set (`docs/public_key_usage.md` section 5, step 1) — still no
   implementation.
8. Implement real `randomBytes` behind `FedosRandomBoundary`.
9. Implement real key generation/import behind
   `FedosKeyGenerationBoundary`/`FedosKeyImportBoundary`, consuming
   `FedosKeyFormatLabel`/`FedosKeyUsageLabel` to name the format/usage
   being generated/imported — still without deciding a raw byte shape
   (step 4 above) or an enforced rule (step 7 above).
10. Implement real `deriveKey`, then real `encrypt`/`decrypt`, consuming
    the now-implemented random/key boundaries and the algorithm-policy
    approval decision from a future, real `FedosAlgorithmPolicyDecision`
    value (`docs/public_algorithm_policy.md` section 4).
11. Separately review whether `FedosKeyExportBoundary` should ever be
    implemented at all.
12. Only after 4–11 are each independently implemented and reviewed,
    wire the boundary into the Runtime/Worker/`CryptoProvider`.

### Where the boundary stops

Public Boundary Freeze v2 completes every remaining LABEL-ONLY gap the
prior stages' own roadmaps had flagged. What is deliberately still
missing, and why each is a stop condition rather than a to-do:

- **No raw byte is handled anywhere.** Every type across all seven
  groups holds only fixed enum labels or (in `FedosBoundaryVersion`'s
  case) a fixed `u32` triple — never a borrowed byte slice, growable
  byte vector, or owned string.
- **No serialization format is chosen.** `FedosKeyFormatLabel` names
  future formats; it does not fix how any of them would be encoded on
  the wire or in memory.
- **No import/export is implemented.** `FedosKeyImportBoundary`/
  `FedosKeyExportBoundary` (Stage 103) remain permanently `Unavailable`
  status types; Stage 104's provisioning-contract design
  (`docs/public_key_provisioning.md`) fixes the CONTRACT, not a
  concrete request/response type.
- **No `randomBytes` is implemented.** `getrandom` (Stage 104) is
  adopted but never called; `FedosRandomBoundary`/`FedosNonceBoundary`
  remain permanently `Unavailable`.
- **No nonce is generated anywhere**, for the same reason.
- **Nothing is wired into the Runtime, the Worker, or a crypto
  provider.** Every function across Stage 102–106 is reachable only by
  directly calling this crate — no host code path touches any of them.

Reaching any of the six items above from here is, by the definition this
multi-stage arc has used throughout, the START of the Implementation
Phase, not further boundary design — the next stage that touches any of
them should be scoped and reviewed as such.

## Public key-format label boundary (Stage 105)

Stage 105 fixes the key-format label enumeration
`docs/public_key_provisioning.md` section 6 (step 2) deferred at Stage
104 — the last remaining named gap in that document's roadmap short of
implementation itself.

**`FedosKeyFormatLabel`** (`pub enum`, placed right after Stage 103's
`fedos_boundary_policy_decision`, still ahead of Stage 79's
`secret_handle` module) — seven FUTURE PLANNING LABELS, each documented
as intent only, never a statement of "format support":

- `RawAeadKeyPlaceholder` — a raw symmetric key sized for one of Stage
  102's AEAD candidates.
- `RawKdfOutputPlaceholder` — raw output-keying-material bytes from one
  of Stage 102's KDF candidates.
- `NostrSecretKeyPlaceholder` — a Nostr secret key.
- `NostrPublicKeyPlaceholder` — a Nostr public key.
- `Nip44ConversationKeyPlaceholder` — a NIP-44 conversation key.
- `ExternalOpaqueKeyRefPlaceholder` — an opaque reference to a key held
  entirely outside this crate (e.g. a hardware/OS-level key store).
- `TestOnlyPlaceholder` — the fixed sentinel this stage's own placeholder
  function returns; never a real key format.

**`FedosKeyFormatState`** (`Unavailable` / `Placeholder`),
**`FedosKeyFormatStatus`** (carries only the state), and
**`FedosKeyFormatDescriptor`** (carries only `label`/`status`) round out
the group. **`fedos_key_format_descriptor_placeholder()`** — the one new
public function — takes no input and always returns
`FedosKeyFormatLabel::TestOnlyPlaceholder` paired with a permanently
`Unavailable` status, growing the crate's public `pub fn` surface from
seventeen to eighteen. The seventeen prior functions are byte-for-byte
unchanged.

**No raw byte, no parser, no serializer, no format decision.** Every
type holds ONLY fixed enum labels — no borrowed byte slice, growable byte
vector, or owned string field or parameter anywhere. No function parses,
serializes, deserializes, or validates a real byte layout; no
import/export function exists. Which of these seven labels a real
provisioning call would eventually accept, and in what byte shape, stays
UNIMPLEMENTED — exactly the decision
`docs/public_key_provisioning.md` originally deferred, still deferred
here. No CSPRNG entropy source is consulted; `Cargo.toml` is UNCHANGED;
nothing is wired into the Runtime, the Worker, or a crypto provider; no
WASM binding exists.

See
[`test/fedos_core_rust_key_format_label.test.ts`](../../test/fedos_core_rust_key_format_label.test.ts)
(14 tests) for the dedicated Stage 105 guard tests (all seven variants
present as bare unit variants, all four type declarations, no
`Vec`/`String`/borrowed-byte-slice field, no key/seed/plaintext/
ciphertext/passphrase/nonce/tag storage field, no parser/serializer/
import/export/validate function anywhere in `lib.rs`, the
eighteen-function `pub fn` surface, all seventeen prior functions
unchanged, no Runtime/Worker/`CryptoProvider` connection, `Cargo.toml`
unchanged, no `getrandom`/`rand` usage, no `println!`/`eprintln!`/`log`/
`tracing`/`dbg!` usage, no `unsafe`, the placeholder function's fixed
body, the design doc records completion, no committed build artifact).

## Public key-usage label boundary (Stage 106)

Stage 106 fixes `FedosKeyUsageLabel` — the "what is this key allowed to
be used for" dimension `docs/public_key_usage.md` separates from Stage
105's `FedosKeyFormatLabel` ("what shape is this key"). See
`docs/public_key_usage.md` section 1 for the full reasoning behind
keeping the two independent.

**`FedosKeyUsageLabel`** (`pub enum`, placed right after Stage 105's
`fedos_key_format_descriptor_placeholder`, still ahead of Stage 79's
`secret_handle` module) — eight FUTURE PLANNING LABELS:
`EncryptionPlaceholder`, `DecryptionPlaceholder`, `SigningPlaceholder`,
`VerificationPlaceholder`, `KeyDerivationPlaceholder`,
`StoragePlaceholder`, `TransportPlaceholder`, `TestOnlyPlaceholder`.
**`FedosKeyUsageState`** (`Unavailable` / `Placeholder`),
**`FedosKeyUsageStatus`** (carries only the state), and
**`FedosKeyUsageDescriptor`** (carries only `label`/`status`) round out
the group. **`fedos_key_usage_descriptor_placeholder()`** takes no input
and always returns `FedosKeyUsageLabel::TestOnlyPlaceholder` paired with
a permanently `Unavailable` status — the exact same shape Stage 105's
`fedos_key_format_descriptor_placeholder()` established.

**No enforced authorization.** No function anywhere binds a usage label
to a real key, restricts a real operation, or checks a
`(FedosKeyFormatLabel, FedosKeyUsageLabel)` pair against anything — that
authorization design is reserved for a future, separately-reviewed stage
(`docs/public_key_usage.md` section 5, step 1). No raw key byte, owned
string, or growable byte collection exists anywhere in this group.

See
[`test/fedos_core_rust_key_usage_label.test.ts`](../../test/fedos_core_rust_key_usage_label.test.ts)
(13 tests) for the dedicated Stage 106 guard tests (all eight variants
present as bare unit variants, all four type declarations, no
`Vec`/`String`/raw-byte field, no key/seed/plaintext/ciphertext/
passphrase/secret storage field, no parser/serializer/import/export/
generate/validate/authorize function anywhere in `lib.rs`, the
placeholder function's fixed body, the `pub fn` surface includes the new
function among twenty-two total, no Runtime/Worker/`CryptoProvider`
connection, `Cargo.toml` unchanged, no `getrandom`/`rand` usage, no
`println!`/`log`/`unsafe` usage, the design doc exists, no committed
build artifact).

## Public algorithm policy metadata (Stage 106)

Stage 106 also fixes three more label-only metadata types over Stage
102's four `FedosCryptoAlgorithm` candidates — what each would need,
what each would be capable of, and whether each is currently approved.
See `docs/public_algorithm_policy.md` for the full design record.

**`FedosAlgorithmRequirement`** (`algorithm: FedosCryptoAlgorithm`,
`requirement: FedosAlgorithmRequirementLabel`) → a fixed, const-backed
relational table (`fedos_algorithm_requirements()`) pairing each
algorithm with one or more of `RequiresKeyPlaceholder` /
`RequiresNoncePlaceholder` / `RequiresSaltPlaceholder` /
`RequiresNoAdditionalInputPlaceholder` — an algorithm needing more than
one kind of input appears as more than one row.

**`FedosAlgorithmCapability`** (`algorithm: FedosCryptoAlgorithm`,
`capability: FedosAlgorithmCapabilityLabel`) → a fixed, const-backed
relational table (`fedos_algorithm_capabilities()`) pairing each
algorithm with one or more of `AeadEncryptPlaceholder` /
`AeadDecryptPlaceholder` / `KdfDerivePlaceholder` — a finer-grained
statement than Stage 103's `FedosAlgorithmDescriptor`/
`FedosAlgorithmCategory` (which only says "this is an AEAD algorithm,"
not "this algorithm would encrypt AND decrypt").

**`FedosAlgorithmPolicy`** (`algorithm: FedosCryptoAlgorithm`, `decision:
FedosAlgorithmPolicyDecision`) →
`fedos_algorithm_policy_decision(algorithm)` always returns
`NotYetApprovedPlaceholder`, regardless of `algorithm` — mirrors Stage
103's `FedosBoundaryPolicy` always-deny pattern. `FedosAlgorithmPolicyDecision`
has exactly one variant today; this is NOT a real approval system.

**No real validation, capability grant, or approval.** All three tables
are fixed `const` arrays — no `Vec`/`HashMap`/dynamic collection, no
runtime-computed length. No function validates a real requirement
against real input, grants a real capability, or approves a real
algorithm for use.

See
[`test/fedos_core_rust_algorithm_policy.test.ts`](../../test/fedos_core_rust_algorithm_policy.test.ts)
(14 tests) for the dedicated Stage 106 guard tests (all three type
groups and their variant sets, both relational tables const-backed with
no dynamic collection, the policy function's fixed no-branching body, no
`Vec<u8>`/`String`/raw-byte field, no actual AEAD/KDF crate usage
(specific crate-usage patterns, not a bare substring match — the tables
legitimately reuse Stage 102's algorithm labels), no
Runtime/Worker/`CryptoProvider` connection, `Cargo.toml` unchanged, no
`getrandom`/`rand` usage, no `unsafe`/`println!`/`log` usage, the `pub
fn` surface includes all three new functions among twenty-three total
(updated from twenty-two once Stage 137 added a twenty-third, unrelated
function elsewhere), the design doc exists and names all three types, no
committed build artifact).

## Rust randomBytes implementation (Stage 137)

Stage 137 is this crate's FIRST real implementation — the first stage
since Stage 69 to replace a placeholder body with one that actually does
something. It implements exactly one function, deliberately scoped as
narrowly as `docs/random_bytes_implementation_plan.md` and
`docs/implementation_phase_roadmap.md` §1 item 2 require: nothing else
(nonce generation, key generation, key derivation, AEAD, `SecretHandle`
real bytes, WASM, Runtime wiring) is touched.

**`FedosRandomBytesLength`** (`pub enum`, placed right after Stage 106's
`fedos_algorithm_policy_decision`, still ahead of Stage 79's
`secret_handle` module) — exactly ONE variant, `ThirtyTwo`. There is no
zero-length, custom-length, or caller-selected-length variant; a future
additional length would be its own reviewed addition to this enum, never
a numeric parameter on the function itself.

**`FedosRandomBytesState`** (`Ready` / `EntropySourceUnavailable`) and
**`FedosRandomBytesDecision`** (`length: FedosRandomBytesLength`, `state:
FedosRandomBytesState`, `bytes: Option<[u8; 32]>`) round out the group.
`bytes` is a fixed-size `[u8; 32]` wrapped in `Option` — never a `Vec<u8>`
or a borrowed slice — `Some` only on `Ready`, always `None` on
`EntropySourceUnavailable`.

**`fedos_random_bytes_32()`** — the one new public function — takes NO
parameter of any kind (no length, no seed, nothing) and draws exactly 32
bytes from the OS CSPRNG via `getrandom::fill(&mut buf)`, matched
exhaustively (`Ok(())` / `Err(_)`, never `.unwrap()`/`.expect()`/`panic!`).
On success it returns `Ready` with the 32 drawn bytes; on any CSPRNG
failure it returns `EntropySourceUnavailable` with `bytes: None` — there
is no fallback PRNG, no `rand`/`thread_rng` substitute, and no
degraded/partial/zeroed output. This is this crate's first production
(not `#[cfg(test)]`-only) use of the `getrandom` dependency adopted Stage
104 — every occurrence of `getrandom::fill(` anywhere in `src/lib.rs`
outside its own doc comments is this one call site.

**What is explicitly NOT implemented or connected:**

- No nonce generation of any kind — `docs/nonce_generation_policy.md`
  (Stage 134) remains policy only.
- No key generation, key derivation, or AEAD/KDF/NIP-44 operation.
- No connection to `SecretHandle` (`secret_handle`, Stage 79),
  `AeadPlaceholderRequest` (`aead_core`, Stage 80), or
  `KdfPlaceholderRequest` (`kdf_core`, Stage 82) — all three remain
  exactly as placeholder as before this stage.
- `random_bytes_placeholder` (Stage 69) and
  `fedos_random_boundary_status`/`FedosRandomBoundary` (Stage 103) are
  byte-for-byte UNCHANGED — this stage adds a new, independent function
  rather than editing either.
- `Cargo.toml` is UNCHANGED — no dependency change of any kind.
- No WASM target, loader, or artifact; no Runtime/Worker/`CryptoProvider`
  wiring — `fedos_random_bytes_32` is reachable only by directly calling
  this crate.

**Rust-side `cargo test` coverage** (`random_bytes_wiring`, a new
`#[cfg(test)]`-only module at the end of `src/lib.rs`, kept separate from
Stage 104's `csprng_verification_infrastructure` PLAN module): a
successful call returns exactly 32 bytes tagged `Ready`; two calls in
immediate succession are asserted to differ (a non-determinism sanity
check, not a statistical randomness proof — the plan
`docs/random_bytes_implementation_plan.md` §12 fixed this distinction in
advance); the fixed `EntropySourceUnavailable`/`bytes: None` failure
shape is constructed and asserted directly, since fault-injecting a real
OS CSPRNG failure isn't practical in a portable `cargo test` (the plan's
own documented fallback); `FedosRandomBytesLength` is asserted to have no
variant beyond `ThirtyTwo`; and ten repeated calls are asserted not to
panic.

See
[`test/fedos_core_rust_random_bytes.test.ts`](../../test/fedos_core_rust_random_bytes.test.ts)
(20 tests) for the dedicated Stage 137 guard tests (all three new types
and the function declared, the length enum has no zero/open-length
escape hatch, the function takes no parameter, `bytes` is `Option<[u8;
32]>` never `Vec<u8>`, `getrandom::fill` is called exactly once and
matched exhaustively with no panic path, no fallback PRNG/`Math.random()`
equivalent, no nonce/key-generation/key-derivation/AEAD/KDF/NIP-44
construct — checked structurally rather than by a bare word match, since
this stage's own doc comments legitimately NAME each of those concepts to
say none is done — not connected to `SecretHandle`/`aead_core`/`kdf_core`,
the two unchanged prior functions verified byte-for-byte, the twenty-
three-function `pub fn` surface, `Cargo.toml` unchanged, no
Runtime/Worker/`CryptoProvider` connection, no `println!`/`log`/`unsafe`
usage, the `random_bytes_wiring` test module itself calls no `getrandom`,
no raw secret exposed on the public API, no committed build artifact, and
all three design docs exist).

## Rust AEAD nonce helper (Stage 138)

Stage 138 implements `docs/nonce_generation_policy.md`'s MVP decision
(Stage 134): a CSPRNG-drawn random nonce, fixed at 96 bits, never a
counter, never deterministic, never derived from a seed/password/user
input. It is the second real implementation this crate ships (after
Stage 137's `fedos_random_bytes_32`), deliberately scoped as narrowly:
nonce drawing ONLY, no AEAD seal/open, no encrypt/decrypt, no key
derivation, and no connection to the crate's crypto skeletons.

**`FedosAeadNonceKind`** (`pub enum`, placed right after
`fedos_random_bytes_32`, still ahead of Stage 79's `secret_handle`
module) — exactly ONE variant, `NinetySixBit`, matching this crate's two
adopted AEAD candidates' (ChaCha20-Poly1305, AES-256-GCM) shared nonce
size. No zero-length, custom-length, or caller-selected-length variant
exists; a future 192-bit (XChaCha20-Poly1305-style) variant would be its
own reviewed addition.

**`FedosNonceState`** (`Ready` / `EntropySourceUnavailable`) is a
DELIBERATELY SEPARATE type from `FedosRandomBytesState` — each
independent boundary this crate exposes gets its own state enum, the
same "each future operation gets its own type" choice Stage 103 already
established. **`FedosAeadNonceDecision`** (`kind: FedosAeadNonceKind`,
`state: FedosNonceState`, `nonce: Option<[u8; 12]>`) rounds out the
group — `nonce` is `Some` only on `Ready`, always `None` on
`EntropySourceUnavailable`, and is a fixed-size `[u8; 12]` never a
`Vec<u8>` or borrowed slice.

**`fedos_aead_nonce_96()`** — the one new public function — takes NO
parameter of any kind and draws exactly 12 bytes from the OS CSPRNG via
`getrandom::fill(&mut buf)`, matched exhaustively (`Ok(())` / `Err(_)`,
never `.unwrap()`/`.expect()`/`panic!`) — the crate's SECOND real
`getrandom` call site, textually and functionally independent of
`fedos_random_bytes_32` (neither calls the other). On success it returns
`Ready` with the 12 drawn bytes; on any CSPRNG failure it returns
`EntropySourceUnavailable` with `nonce: None` — no fallback PRNG, no
`rand`/`thread_rng` substitute, and no degraded/partial/counter-derived
output.

**What is explicitly NOT implemented or connected:**

- No AEAD seal/open, no encryption, no decryption, and no key
  derivation/generation of any kind.
- No connection to `encrypt_placeholder`/`decrypt_placeholder` (Stage
  69), `aead_core` (Stage 80), `kdf_core` (Stage 82), or `SecretHandle`
  (`secret_handle`, Stage 79) — all remain exactly as placeholder as
  before this stage. A future AEAD implementation stage would need to be
  the one to call this helper — that wiring does not exist yet.
- No deterministic nonce, no counter nonce, and no nonce derived from a
  seed, password, user id, or timestamp — the function accepts no
  parameter that could carry one.
- `fedos_nonce_boundary_status`/`FedosNonceBoundary` (Stage 103) are
  byte-for-byte UNCHANGED — this stage adds a new, independent function
  rather than editing either.
- `Cargo.toml` is UNCHANGED — no dependency change of any kind.
- No WASM target, loader, or artifact; no Runtime/Worker/`CryptoProvider`
  wiring.

**Rust-side `cargo test` coverage** (`aead_nonce_wiring`, a new
`#[cfg(test)]`-only module at the end of `src/lib.rs`, mirroring
Stage 137's `random_bytes_wiring` shape exactly): a successful call
returns exactly 12 bytes tagged `Ready`; two calls in immediate
succession are asserted to differ (a non-determinism sanity check, not a
statistical randomness proof); the fixed
`EntropySourceUnavailable`/`nonce: None` failure shape is constructed and
asserted directly, since fault-injecting a real OS CSPRNG failure isn't
practical in a portable `cargo test`; `FedosAeadNonceKind` is asserted to
have no variant beyond `NinetySixBit`; ten repeated calls are asserted
not to panic; and `fedos_aead_nonce_96`/`fedos_random_bytes_32` are
asserted to both succeed independently (guarding against a future
refactor accidentally making one call the other).

**Verified against a real Rust toolchain**
(`stable-x86_64-pc-windows-msvc`, rustc/cargo 1.96.1): `cargo check`,
`cargo test` (119 crate unit tests, up from 113 at Stage 137 — the six
new `aead_nonce_wiring` tests), and `cargo check --tests` all GREEN on
the first run; no code fix was needed.

See
[`test/fedos_core_rust_aead_nonce.test.ts`](../../test/fedos_core_rust_aead_nonce.test.ts)
(20 tests) for the dedicated Stage 138 guard tests (all three new types
and the function declared, the kind enum has no zero/variable/
caller-length escape hatch, the function takes no parameter, `nonce` is
`Option<[u8; 12]>` never `Vec<u8>`, `getrandom::fill` is called exactly
once inside this helper and independently of `fedos_random_bytes_32`'s
own call, matched exhaustively with no panic path, no fallback PRNG/
deterministic/counter/seed/password/user-input nonce construct —
checked structurally rather than by a bare word match, since this
stage's own doc comments legitimately NAME each of those concepts to say
none is done — not connected to
`SecretHandle`/`aead_core`/`kdf_core`/`fedos_random_bytes_32`, the prior
functions verified byte-for-byte, the twenty-four-function `pub fn`
surface, `Cargo.toml` unchanged, no Runtime/Worker/`CryptoProvider`
connection, no `println!`/`log`/`unsafe` usage, the `aead_nonce_wiring`
test module itself calls no `getrandom`, no raw secret exposed on the
public API, no committed build artifact, and the nonce policy doc
exists and names this helper's design).

## Internal secret-handle real-byte storage (Stage 144–146)

Stage 144–146 implements `docs/secret_lifecycle_implementation_plan.md`,
`docs/secret_handle_api_shape.md`, and `docs/secret_memory_test_strategy.md`
(Stage 141–143): the crate-private `secret_handle` module (Stage 79) gains
its FIRST real-byte construction path. `new_placeholder()` (Stage 79) is
completely unchanged; both construction paths coexist on the same
`SecretHandle` type.

**New/changed types (all `pub(crate)`-at-most, none re-exported):**

- **`SecretHandleState`** gains a fourth variant, `Holding` (real bytes are
  allocated), alongside the existing `Empty` / `Placeholder` / `Cleared`.
- **`SecretHandleKind`** (NEW) — a non-sensitive classification label:
  `Placeholder` (the Stage 79 path) plus five real-secret labels —
  `AeadKeyMaterial`, `HkdfInputMaterial`, `HkdfOutputMaterial`,
  `NostrKeyMaterial`, `TestOnlySecretMaterial`. Never a byte, never a length
  that narrows down which secret is held.
- **`SecretInputLength`** (NEW) — exactly one variant, `ThirtyTwo`, mirroring
  `FedosRandomBytesLength`/`FedosAeadNonceKind`'s "no open, caller-supplied
  count" shape.
- **`RealSecretBytes`** (private) — wraps a fixed `[u8; 32]`. Never `Clone`/
  `Copy`/`Debug`-over-raw-bytes/`Display`/`Serialize`; `secrecy`'s own
  `Clone for SecretBox<S>` requires `S: CloneableSecret`, which this type
  deliberately never implements, so `SecretBox<RealSecretBytes>` gets no
  `Clone` either. Its `Zeroize` impl bumps a `#[cfg(test)]`-only atomic
  counter so a test can prove `zeroize` actually runs — that counter never
  compiles into a production build and never exposes a secret byte.
- **`SecretPayload`** (private enum) — `Placeholder(SecretBox<PlaceholderMarker>)`
  or `Real(SecretBox<RealSecretBytes>)`; exactly one of `SecretHandle`'s two
  construction paths is active at a time.
- **`SecretHandle`** now holds `state: SecretHandleState`,
  `kind: SecretHandleKind`, and `payload: Option<SecretPayload>` — six
  methods total: `new_placeholder()` (Stage 79, unchanged),
  `new_from_32_bytes_for_internal_use(kind: SecretHandleKind, bytes: [u8; 32]) -> Self`
  (NEW — takes ownership of a fixed-size 32-byte array, never a slice/
  `Vec<u8>`/`String`, wraps it in `secrecy::SecretBox`, and returns a
  `Holding`-state handle), `status()` (unchanged shape), `kind()` (NEW —
  returns the label fixed at construction), `clear()` (zeroizes whichever
  payload is held and transitions to `Cleared`; safe to call twice — a
  second call is a no-op), and `is_cleared()` (unchanged).

**What `SecretHandle` still does NOT do** (per
`docs/secret_handle_api_shape.md` §3): it never calls
`fedos_random_bytes_32` or `fedos_aead_nonce_96` itself (a caller draws
bytes first and hands them to the constructor), never executes HKDF or
AEAD, never logs anything, and exposes no accessor that returns its raw
bytes anywhere — not even under `#[cfg(test)]`. `Cargo.toml` is UNCHANGED —
no new dependency. This crate's public `pub fn` surface is UNCHANGED (still
twenty-four functions) — every new item is `pub(crate)`-at-most.

**Rust-side `cargo test` coverage** (`secret_handle`'s own nested
`#[cfg(test)] mod tests`, now 15 tests, up from 5 at Stage 79): the
placeholder path's five original tests, plus new tests asserting
`new_from_32_bytes_for_internal_use` starts in `Holding` state with the
given `kind`; every one of the five real-secret `SecretHandleKind` variants
is preserved through construction; `clear()` on a real-byte handle
transitions to `Cleared`; calling `clear()` twice is idempotent and does not
panic; `zeroize` is proven to run (via the `#[cfg(test)]`-only atomic
counter) both on an explicit `clear()` call AND on an ordinary drop with NO
`clear()` call (proving `secrecy::SecretBox`'s own `Drop` impl zeroizes
real bytes, not just the placeholder path); `SecretInputLength` has no
variant besides `ThirtyTwo`; and the placeholder/real-byte paths stay
independent of each other.

**Verified against a real Rust toolchain**
(`stable-x86_64-pc-windows-msvc`): `cargo check`, `cargo test` (127 crate
unit tests, up from 119 at Stage 138 — 12 net new `secret_handle` tests),
and `cargo check --tests` all GREEN.

See
[`test/fedos_core_rust_secret_handle.test.ts`](../../test/fedos_core_rust_secret_handle.test.ts)
(updated: the `SecretHandleState` variant list and `SecretHandle` method-set
assertions now reflect four variants / six methods) and
[`test/fedos_core_rust_secret_handle_real_bytes.test.ts`](../../test/fedos_core_rust_secret_handle_real_bytes.test.ts)
(NEW, 16 tests) for the dedicated Stage 144–146 guard suite: the real-byte
constructor's fixed `[u8; 32]` signature, `SecretHandleKind`/
`SecretInputLength` existing as `pub(crate)`-only with the expected labels,
`SecretHandleState` gaining exactly `Holding`, no `Clone`/`Copy` derive or
impl on any real-secret-holding type, no `Debug`/`Display`/`Serialize`/
raw-secret `Eq`/`PartialEq`, no `AsRef<[u8]>` exposure, no public raw-byte
accessor and no sixth `pub(crate)` method beyond the expected six, the
twenty-four-function public `pub fn` surface unchanged, no connection to
HKDF/AEAD/`randomBytes`/nonce/`Cargo.toml`/Runtime/Worker, and no `unwrap`/
`expect`/`panic!`/`unsafe` anywhere in `secret_handle`.

**Limitations — named, not solved** (per
`docs/secret_lifecycle_implementation_plan.md` §10 and
`docs/secret_handle_api_shape.md` §9): zeroize-on-drop narrows the exposure
window, it does not eliminate it. Compiler-introduced copies (moves the
optimizer implements as a memory copy, stack slots/registers that
transiently held a copy) are not erased by `zeroize` alone. OS/hardware
paging (a page swapped to disk before it is zeroized) and core dumps/
attached debuggers can still observe live secret memory before `Drop` runs.
WASM's own memory model is a future, still-open question once a WASM
target exists (none does yet). None of this is a reason to skip `zeroize`/
`secrecy` — it is the honest, narrower claim this stage makes.

**What Stage 144–146 deliberately does NOT do** (each is its own future,
separate, explicitly-reviewed stage): no HKDF connection (`kdf_core` remains
exactly as unconnected as before), no AEAD connection (`aead_core` likewise),
no `deriveKey`/`encrypt`/`decrypt` public API change, and no Runtime/Worker/
WASM wiring of any kind.

## Internal HKDF-SHA256 implementation using SecretHandle (Stage 147)

Stage 147 implements `docs/hkdf_internal_plan.md`: the crate-private
`kdf_core` module (Stage 82) gains this crate's first REAL implementation.
`derive_secret_handle_internal(input: &SecretHandle, domain: HkdfDomain) ->
HkdfDecision` derives a NEW `SecretHandle(HkdfOutputMaterial)` from an
existing `SecretHandle(HkdfInputMaterial)` via HKDF-SHA256 (RFC 5869, the
`hkdf` dependency adopted Stage 76), using a fixed, `domain`-selected
salt/info — never a caller-supplied or randomly-drawn byte. The Stage 82
`KdfPlaceholderRequest` skeleton is UNCHANGED and coexists alongside this
new, separate real path.

**New types** (all `pub(crate)`-at-most, inside the existing `kdf_core`
module):

- **`HkdfDomain`** — `RootKey` / `Identity` / `Storage` / `Conversation` /
  `TestOnly`. Each variant has its OWN fixed `salt(self) -> &'static [u8]`
  and `info(self) -> &'static [u8]` — real domain separation, not a
  placeholder: two different domains derived from the same input produce
  different output bytes (`cargo test`-verified).
- **`HkdfStatus`** — `Ready` / `InvalidInput` / `InternalFailure`.
- **`HkdfDecision`** — `domain: HkdfDomain`, `status: HkdfStatus`,
  `output: Option<SecretHandle>`. Derives nothing (`Clone`/`Debug` would
  fail to compile anyway, since `SecretHandle` implements neither).

**`SecretHandle` gains one new, narrowly-scoped accessor**:
`expose_bytes_for_internal_derivation(&self) -> Option<[u8; 32]>` —
`pub(crate)`, named for its one reviewed caller (`kdf_core`'s HKDF call
site), returns `None` for the Stage 79 placeholder path and after
`clear()`. `SecretHandle`'s method count grows from six to seven as a
direct, reviewed consequence — still no public raw-byte accessor anywhere.

**`Cargo.toml`'s only change**: `sha2` is PROMOTED from
`[dev-dependencies]` to `[dependencies]` — `hkdf`'s API is generic over the
hash algorithm, so a concrete one (`sha2::Sha256`) is mandatory to
instantiate it in PRODUCTION code (previously only needed under
`#[cfg(test)]` for the pre-existing `rfc5869_vectors` module, Stage 77,
which is unchanged and still passes its own RFC 5869 vectors). No other
dependency changed.

**What is explicitly NOT implemented or connected:**

- No AEAD connection — `kdf_core` never constructs an
  `AeadPlaceholderRequest`, never imports `chacha20poly1305`/`aes-gcm`. See
  `docs/hkdf_internal_plan.md` section 10 for the AEAD staging preparation
  (labels/shape only, no code).
- No `randomBytes`/nonce connection — `derive_secret_handle_internal`
  never calls `fedos_random_bytes_32`/`fedos_aead_nonce_96`.
- No `encrypt`/`decrypt`/NIP-44 implementation, no public `deriveKey` API.
- No connection to `domain_label` (Stage 88) — `HkdfDomain` is its own,
  separate label enum; `domain_label` remains an unconnected placeholder.
- No Runtime/Worker/WASM wiring.

**Rust-side `cargo test` coverage** (`kdf_core`'s own nested
`#[cfg(test)] mod tests`, now 12 tests for the real path, alongside the
four pre-existing placeholder tests): input holding (the input handle is
left unchanged after derivation), output `SecretHandle` kind is
`HkdfOutputMaterial`, domain preserved for all five variants, invalid
input rejected (wrong kind, and an already-`clear()`-ed handle),
determinism (same input+domain → same output), domain separation (two
domains, same input → different output), and `HkdfDomain`'s exhaustive
five-variant match. `SecretHandle` gains two new tests for
`expose_bytes_for_internal_derivation`.

**Verified against a real Rust toolchain**: `cargo check`, `cargo test`
(146 crate unit tests, up from 127 at Stage 146 — 12 net new `kdf_core`
tests plus 2 new `secret_handle` tests for the new accessor, plus 5 new
tests from the Stage 150–151 `crypto` module below), and
`cargo check --tests` all GREEN.

See
[`test/fedos_core_rust_hkdf_internal.test.ts`](../../test/fedos_core_rust_hkdf_internal.test.ts)
(14 tests) for the dedicated Stage 147 guard suite, and the updated
[`test/fedos_core_rust_kdf_skeleton.test.ts`](../../test/fedos_core_rust_kdf_skeleton.test.ts),
[`test/fedos_core_rust_dependency.test.ts`](../../test/fedos_core_rust_dependency.test.ts),
[`test/fedos_core_rust_hkdf_wiring.test.ts`](../../test/fedos_core_rust_hkdf_wiring.test.ts),
[`test/fedos_core_rust_hkdf_test_helper.test.ts`](../../test/fedos_core_rust_hkdf_test_helper.test.ts),
[`test/fedos_core_rust_skeleton.test.ts`](../../test/fedos_core_rust_skeleton.test.ts),
[`test/fedos_core_rust_secret_handle.test.ts`](../../test/fedos_core_rust_secret_handle.test.ts),
and
[`test/fedos_core_rust_secret_handle_real_bytes.test.ts`](../../test/fedos_core_rust_secret_handle_real_bytes.test.ts)
files (each relaxed from "no hkdf/sha2/SecretHandle connection" to
"connected ONLY in the one reviewed kdf_core call site" — the same style
of relaxation Stage 79's own guard tests underwent when `secret_handle`
first used `zeroize`/`secrecy`).

## Crypto capability matrix + diagnostics preview (Stage 150–151)

Stage 150–151 add a crate-private `crypto` module —
[`src/crypto.rs`](src/crypto.rs) declaring two file-based children,
[`src/crypto/capability_matrix.rs`](src/crypto/capability_matrix.rs) and
[`src/crypto/diagnostics.rs`](src/crypto/diagnostics.rs) — the first
multi-file module in this crate (every prior crate-private module has been
an inline `mod name { ... }` block inside `src/lib.rs`).

**`capability_matrix.rs` (Stage 150)** fixes `CryptoCapability`: a
nine-variant, non-sensitive label enum (`Random` / `Nonce` /
`SecretHandle` / `Hkdf` / `Aead` / `Nip44` / `Schnorr` / `StorageKey` /
`ConversationKey`), `CryptoCapability::ALL` (a fixed 9-element array in
that order), and `as_static_label()` (a fixed `&'static str` per variant).
See `docs/crypto_capability_matrix.md`.

**`diagnostics.rs` (Stage 151)** fixes `CapabilityReadiness` (`Ready` /
`NotConnected` / `NotImplemented`) and `crypto_diagnostics_preview() ->
[CapabilityReport; 9]` — a FIXED, hand-maintained, display-only snapshot:
`Random`/`Nonce`/`SecretHandle`/`Hkdf` report `Ready`, `Aead` reports
`NotConnected` (a skeleton exists but no real seal/open), and
`Nip44`/`Schnorr`/`StorageKey`/`ConversationKey` report `NotImplemented`.
This is NOT a live health-check — it never calls
`fedos_random_bytes_32`/`fedos_aead_nonce_96`/`SecretHandle`/
`derive_secret_handle_internal` to compute these values, so it can never
observe (let alone display) a real secret byte. See
`docs/crypto_diagnostics.md`.

**Not part of this crate's public API**: every item in both files is
`pub(crate)`-at-most; `mod crypto;` in `src/lib.rs` is a plain (non-`pub`)
declaration. This crate's public `pub fn` surface is UNCHANGED (still
twenty-four functions). `Cargo.toml` is unchanged — no new dependency.
Neither file is wired into the Runtime, the Worker, storage, or Nostr.

**Rust-side `cargo test` coverage**: 4 tests in `capability_matrix.rs`
(every variant present in the documented order, `as_static_label` matches
per variant and is stable, every label unique) and 5 tests in
`diagnostics.rs` (exactly 9 rows in order, the `Ready` set is exactly
Random/Nonce/SecretHandle/Hkdf, `Aead` is specifically `NotConnected`, the
`NotImplemented` set is exactly Nip44/Schnorr/StorageKey/ConversationKey,
and the preview is stable across repeated calls).

See
[`test/fedos_core_rust_crypto_capability.test.ts`](../../test/fedos_core_rust_crypto_capability.test.ts)
(13 tests) for the dedicated Stage 150–151 guard suite.

## Internal AEAD implementation + diagnostics (Stage 152–156)

Stage 152–154 implement `docs/aead_internal_implementation.md`: a new
[`src/crypto/aead_internal.rs`](src/crypto/aead_internal.rs) gives this
crate its first REAL AEAD implementation — `seal_internal`/`open_internal`
implement BOTH ChaCha20-Poly1305 (Stage 74) and AES-256-GCM (Stage 101),
consuming ONLY a `SecretHandle(AeadKeyMaterial)` key and a `Ready`
`FedosAeadNonceDecision` nonce (from `fedos_aead_nonce_96`, Stage 138) —
never a caller-supplied raw key or nonce byte. AAD is a fixed
`AeadAadDomain` label (`RootKey`/`Identity`/`Storage`/`Conversation`/
`TestOnly`), mirroring `kdf_core::HkdfDomain`'s shape (Stage 147) as its
own, separate enum.

**New types** (all `pub(crate)`-at-most, inside `crypto::aead_internal`):
`AeadCipher` (`ChaCha20Poly1305` / `Aes256Gcm`), `AeadAadDomain` (five
fixed AAD labels), `AeadStatus` (`Ready` / `InvalidKey` / `InvalidNonce` /
`AuthenticationFailed` / `InternalFailure`), `AeadSealDecision`
(`algorithm`/`status`/`ciphertext: Option<Vec<u8>>`), `AeadOpenDecision`
(`algorithm`/`status`/`plaintext: Option<Vec<u8>>`).

**`SecretHandle` gains a SECOND narrowly-scoped accessor**,
`expose_bytes_for_internal_aead` (method count seven → eight) — a sibling
of Stage 147's `expose_bytes_for_internal_derivation`, not a reuse of it,
confined to `aead_internal`'s own reviewed call site.

**Misuse guards run before any cipher is touched**: a wrong-kinded or
cleared key returns `InvalidKey`; a non-`Ready` nonce decision returns
`InvalidNonce`. Decryption failure (wrong key/nonce/AAD, or a tampered
ciphertext) is a SINGLE fixed `AuthenticationFailed` label — this
implementation never distinguishes WHY authentication failed, per RFC
8439/NIST AEAD guidance (distinguishing the cause is itself a side
channel). Nonce-reuse prevention is a documented CALLER obligation (see
`docs/aead_internal_implementation.md` section 6), not runtime-tracked
state — this crate has no persistent, cross-call nonce registry.

**`Cargo.toml` is completely UNCHANGED** — `chacha20poly1305`/`aes-gcm`
were already production dependencies (Stage 74/101); no new dependency was
needed.

**What is explicitly NOT implemented or connected:**

- No public `encrypt`/`decrypt` API.
- No ciphertext envelope/serialization format — see
  `docs/ciphertext_envelope_plan.md` (a separate, docs-only planning
  record: version/algorithm/nonce/ciphertext/tag/AAD-domain fields named,
  not built).
- No NIP-44, no Nostr encrypted-message scheme.
- No Runtime/Worker/storage/WASM connection.
- No connection to the pre-existing `aead_core` (Stage 80) skeleton —
  left exactly as it was, per this crate's standing "leave unrelated
  skeletons unconnected" discipline (the same choice Stage 147 made for
  `domain_label`).

**Stage 155** adds
[`src/crypto/aead_diagnostics.rs`](src/crypto/aead_diagnostics.rs): a
fixed, hand-maintained, display-only `aead_diagnostics_preview() ->
[AeadAlgorithmReport; 2]` reporting both `ChaCha20Poly1305` and
`Aes256Gcm` as `Ready` — never a live probe. `crypto::diagnostics`'s own
coarse `crypto_diagnostics_preview()` has its `Aead` row flipped from
`NotConnected` to `Ready` this stage, so no capability reports
`NotConnected` anymore.

**Rust-side `cargo test` coverage**: 10 new tests in `aead_internal.rs`
(ChaCha20-Poly1305 round-trip, AES-256-GCM round-trip, wrong AAD domain
fails for both ciphers, wrong nonce fails for both ciphers, tampered
ciphertext fails for both ciphers, wrong key kind rejected before
touching the cipher, cleared key rejected, non-`Ready` nonce rejected,
seal is deterministic for the same inputs, and `AeadCipher`'s exhaustive
two-variant match), 3 new tests in `aead_diagnostics.rs`, 2 new tests in
`secret_handle` for `expose_bytes_for_internal_aead`, and `diagnostics.rs`
tests updated for `Aead` now being `Ready`.

**Verified against a real Rust toolchain**: `cargo check`, `cargo test`
(162 crate unit tests, up from 146 at Stage 151), and
`cargo check --tests` all GREEN, with zero new warnings (an initial
`Array::from_slice` deprecation warning from the `chacha20poly1305`/`aead`
0.6 upgrade path was fixed by switching to `Array::from`).

See
[`test/fedos_core_rust_aead_internal.test.ts`](../../test/fedos_core_rust_aead_internal.test.ts)
(16 tests) and
[`test/fedos_core_rust_aead_diagnostics.test.ts`](../../test/fedos_core_rust_aead_diagnostics.test.ts)
(9 tests) for the dedicated Stage 152–156 guard suites: no public
`encrypt`/`decrypt`, no public raw key getter, no Runtime/Worker/Storage/
Nostr/NIP-44/WASM connection, no `Cargo.toml` change (still 9 production
dependencies), no `Vec<u8>` exposed publicly, no `unwrap`/`expect`/
`panic!`/`unsafe`, the twenty-four-function `pub fn` surface unchanged,
and diagnostics carrying no secret byte.

## Internal ciphertext envelope skeleton + public API planning (Stage 157–160)

Stage 157–158 implement `docs/ciphertext_envelope_plan.md`'s six planned
fields as a concrete, `pub(crate)`-only skeleton: a new
[`src/crypto/ciphertext_envelope.rs`](src/crypto/ciphertext_envelope.rs)
defines `AeadCiphertextEnvelope` — `version: AeadEnvelopeVersion`,
`algorithm: AeadEnvelopeAlgorithm`, `nonce: [u8; 12]`, a fixed
`ciphertext_placeholder: [u8; 4]` marker (NOT real ciphertext‖tag), and
`aad_domain: AeadEnvelopeAadDomain`. `AeadEnvelopeAlgorithm`/
`AeadEnvelopeAadDomain` are deliberately NEW, SEPARATE types from
`crypto::aead_internal`'s own `AeadCipher`/`AeadAadDomain` — this
skeleton stays unconnected from the real AEAD implementation, same
discipline as every other unconnected skeleton in this crate.

**`validate_envelope_internal`** validates UNTRUSTED CANDIDATE field
values (raw version/algorithm/AAD-domain discriminant bytes, a nonce byte
slice, and a ciphertext-placeholder byte slice) — the same shape a future
deserializer would need, though no deserializer exists yet. Checks run in
order — version first, then algorithm, then AAD domain, then nonce
length, then the ciphertext placeholder's exact bytes — each returning
its own fixed `AeadEnvelopeStatus` (`Valid` / `InvalidVersion` /
`InvalidAlgorithm` / `InvalidAadDomain` / `InvalidNonceLength` /
`InvalidCiphertextPlaceholder`). No AEAD authentication/decryption is
performed (there is no real ciphertext yet to authenticate), and no
serialization/deserialization of any wire format exists — this is
validation of already-split candidate values, not a codec.

**Stage 159** fixes, in writing only (`docs/ciphertext_envelope_plan.md`
section 9), the shape a FUTURE Stage 161 bridge would take to connect
`crypto::aead_internal`'s real `AeadSealDecision`/`AeadOpenDecision`
results to a real (non-placeholder) `AeadCiphertextEnvelope` — a
`pub(crate)`-only bridge function, not built this stage.

**Stage 160** adds `docs/public_encrypt_decrypt_api_plan.md`: the shape a
future PUBLIC `encrypt`/`decrypt` API would take — key input as
`SecretHandle` only (never a raw byte/password/seed), nonce always
internal or envelope-extracted (never caller-supplied), ciphertext as an
envelope type (never a bare byte buffer with separately-tracked
metadata), AAD as a fixed domain-label selection. Runtime and storage
connections, and NIP-44, are all explicitly named as their own, later,
separate stages — not designed or authorized here.

**What is explicitly NOT implemented or connected:**

- No public `encrypt`/`decrypt`/`deriveKey` — `encrypt_placeholder`/
  `decrypt_placeholder`/`derive_key_placeholder` (Stage 69) unchanged.
- No serialization of any kind — no JSON, base64, CBOR, or `serde`
  derive on any envelope type.
- No connection from the envelope to `crypto::aead_internal`'s real
  seal/open functions — the ciphertext field stays a fixed placeholder.
- No NIP-44, no Nostr connection, no storage connection.
- No Runtime/Worker/WASM wiring.
- No `Cargo.toml` change — still 9 production dependencies, no new
  dependency.

**Rust-side `cargo test` coverage**: 12 new tests in
`ciphertext_envelope.rs` (envelope construction holding every field,
version/algorithm/domain preserved across every combination, nonce held
as a fixed 12-byte array, validation succeeds for a well-formed
candidate, wrong version/algorithm/AAD-domain tags rejected, wrong nonce
length rejected, empty and tampered ciphertext placeholders rejected, and
both label enums' exhaustive-variant matches).

**Verified against a real Rust toolchain**: `cargo check`, `cargo test`
(174 crate unit tests, up from 162 at Stage 156), and
`cargo check --tests` all GREEN.

See
[`test/fedos_core_rust_ciphertext_envelope.test.ts`](../../test/fedos_core_rust_ciphertext_envelope.test.ts)
(15 tests) for the dedicated Stage 157–158 guard suite: no public
`encrypt`/`decrypt`, no public raw key getter, no Runtime/Worker/Storage/
Nostr/NIP-44/WASM connection, no `Cargo.toml` change, no serialization of
any kind, the twenty-four-function `pub fn` surface unchanged, and no
`unwrap`/`expect`/`panic!`/`unsafe`.

## Internal crypto completion: AEAD/envelope bridge + public encrypt/decrypt API (Stage 161–170)

Stage 161–163 implement `docs/ciphertext_envelope_plan.md` section 9's
planned bridge: a new
[`src/crypto/aead_envelope_bridge.rs`](src/crypto/aead_envelope_bridge.rs)
adds `envelope_from_seal_decision_internal` (AEAD seal result → real
envelope) and `open_decision_from_envelope_internal` (envelope → AEAD
open), both `pub(crate)`-only. `AeadCiphertextEnvelope`'s ciphertext field
changes from a fixed `ciphertext_placeholder: [u8; 4]` to a real,
variable-length `ciphertext: Vec<u8>` (the struct drops its `Copy` derive
accordingly); the original placeholder-producing constructor is unchanged
in signature, and a new `new_with_ciphertext_for_internal_use` constructor
is the only way to populate the field with real bytes. A Stage 157–158
skeleton (placeholder) envelope passed to the open bridge is rejected via
ORDINARY AEAD authentication failure — no special-case branch exists.

Stage 164 adds a tenth `CryptoCapability` variant, `Envelope` (right
after `Aead`), reporting `Ready` in `crypto_diagnostics_preview()`.

Stage 165 updates this crate's own crate-level doc comment
(`src/lib.rs`) and the docs above (`docs/ciphertext_envelope_plan.md`
section 11, `docs/aead_internal_implementation.md` section 12,
`docs/crypto_capability_matrix.md` section 8,
`docs/crypto_diagnostics.md` section 8) to record all of the above as
implemented.

Stage 166–167 add this crate's FIRST public crypto-operation functions:
**`pub fn fedos_encrypt(algorithm, key: &SecretHandle, aad_domain,
plaintext: &[u8]) -> FedosEncryptDecision`** and **`pub fn
fedos_decrypt(key: &SecretHandle, envelope: &AeadCiphertextEnvelope) ->
FedosDecryptDecision`**. `fedos_encrypt` draws its own fresh nonce
internally (never a parameter) and returns a real envelope; `fedos_decrypt`
extracts everything it needs from the envelope, never a separate nonce/
algorithm parameter. **The crate's public `pub fn` surface grows from
twenty-four to twenty-six.**

**One deliberate, reviewed scope limitation**: `SecretHandle` and
`AeadCiphertextEnvelope` remain `pub(crate)` — not promoted to `pub` this
stage. `fedos_encrypt`/`fedos_decrypt` are `pub` in NAME, but not yet
practically callable from outside this crate until a future stage also
exposes those types (or narrowly-scoped opaque wrappers around them). See
`docs/public_crypto_api.md` for the full record of this choice, confirmed
explicitly during this stage's review. Both functions carry an
`#[allow(private_interfaces)]` with a doc comment explaining why, rather
than silently suppressing the compiler's own warning about it.

Stage 168 (public crypto diagnostics) is interpreted conservatively: no
new public function is added beyond `fedos_encrypt`/`fedos_decrypt`
themselves, consistent with this crate's standing precedent that the
Stage 103 "frozen" public-boundary status functions
(`fedos_crypto_boundary_status` and friends) stay untouched by every
real-implementation stage. Stage 169 adds `docs/public_crypto_api.md`
(this section's own companion document). Stage 170 is this final
integration verification itself.

**What is explicitly NOT implemented or connected:**

- No Runtime/Worker/Storage/Nostr/NIP-44/WASM connection anywhere in the
  bridge or the public API.
- No serialization of any kind.
- No public raw key byte, no public raw nonce byte, no public HKDF
  exposure, no public AEAD-implementation-type exposure.
- No `Cargo.toml` change — still 9 production dependencies.

**Rust-side `cargo test` coverage**: 10 new tests in
`aead_envelope_bridge.rs` (round trip for both ciphers, envelope carries
the algorithm/nonce/AAD-domain used to seal, wrong key, cleared key,
wrong nonce, wrong AAD domain, tampered ciphertext, a Stage 157–158
placeholder envelope rejected, and a non-`Ready` seal decision never
bridging); `ciphertext_envelope.rs`'s own suite updated (13 tests, net +1:
a new real-ciphertext constructor test and a real-variable-length
validation test added, the exact-marker tamper test replaced by a
non-emptiness check); 8 new tests in `src/lib.rs`'s
`fedos_encrypt_decrypt_wiring` module (encrypt→decrypt round trip for
both ciphers, wrong key, cleared key, wrong nonce, wrong AAD domain,
tampered ciphertext, a Stage 157–158 placeholder envelope, and a direct
pub-fn-surface sanity check).

**Verified against a real Rust toolchain**: `cargo check`, `cargo test`
(193 crate unit tests, up from 174 at Stage 157–158), and
`cargo check --tests` all GREEN.

See
[`test/fedos_core_rust_aead_envelope_bridge.test.ts`](../../test/fedos_core_rust_aead_envelope_bridge.test.ts)
(16 tests) and
[`test/fedos_core_rust_public_crypto_api.test.ts`](../../test/fedos_core_rust_public_crypto_api.test.ts)
(15 tests) for the dedicated Stage 161–170 guard suites, plus updated
checks in `test/fedos_core_rust_ciphertext_envelope.test.ts`,
`test/fedos_core_rust_crypto_capability.test.ts`,
`test/fedos_core_rust_secret_handle_real_bytes.test.ts`, and every other
test file that asserts an exact `pub fn` count or name list (now 24 → 26
throughout): no Runtime/Worker/Storage/Nostr/NIP-44 connection, no
`panic!`/`unwrap`/`expect`, and the twenty-six-function `pub fn` surface
verified by name.

## Public opaque crypto API completion (Stage 171–176)

Stage 171–176 resolve Stage 166–170's one deliberate scope limitation:
`fedos_encrypt`/`fedos_decrypt` are now genuinely callable from OUTSIDE
this crate, not just `pub` in name. See
[`docs/public_crypto_opaque_handles.md`](../../docs/public_crypto_opaque_handles.md)
for the full design record; `docs/public_crypto_api.md` section 6 records
the resolution against the original Stage 166–170 record.

**Two new public OPAQUE wrapper types** replace direct use of this
crate's secret/payload-carrying types in the public signature:
`FedosAeadKeyHandle` (wraps a `SecretHandle(AeadKeyMaterial)`) and
`FedosCiphertextEnvelope` (wraps an `AeadCiphertextEnvelope`). Both have a
private `inner` field and no `Clone`/`Debug`/`Display`/`Serialize`/
`AsRef<[u8]>` — **`SecretHandle` and `AeadCiphertextEnvelope` themselves
are NEVER promoted to `pub`**; opaque wrapping, not promotion, is the
permanent design.

**A new key-generation entry point**, **`pub fn
fedos_generate_aead_key_32() -> FedosGenerateAeadKeyDecision`**, draws a
fresh 32-byte key from the OS CSPRNG (`getrandom::fill`, no fallback PRNG,
same discipline as `fedos_random_bytes_32`/`fedos_aead_nonce_96`) and
returns it wrapped in a `FedosAeadKeyHandle` — never a raw `[u8; 32]`.
This is the only way to obtain one from outside the crate.

**Two new public label enums**, `FedosAeadAlgorithm`/`FedosAeadAadDomain`,
replace `crate::crypto::aead_internal::AeadCipher`/`AeadAadDomain` in the
public signature — deliberately SEPARATE types (the same "separate label
per boundary" discipline this crate has followed since Stage 157–158),
bridged internally by one small, reviewed conversion function each.
`AeadCipher`/`AeadAadDomain` themselves remain `pub(crate)`-only,
unchanged since Stage 152–154.

**`fedos_encrypt`/`fedos_decrypt`'s new signatures**:

```rust
pub fn fedos_encrypt(
    algorithm: FedosAeadAlgorithm,
    key: &FedosAeadKeyHandle,
    aad_domain: FedosAeadAadDomain,
    plaintext: &[u8],
) -> FedosEncryptDecision; // envelope: Option<FedosCiphertextEnvelope> — now pub

pub fn fedos_decrypt(
    key: &FedosAeadKeyHandle,
    envelope: &FedosCiphertextEnvelope,
) -> FedosDecryptDecision;
```

Neither function carries `#[allow(private_interfaces)]` any more —
every parameter/return type is genuinely `pub`, and
`FedosEncryptDecision::envelope` changes from `pub(crate)` to `pub`. **The
crate's public `pub fn` surface grows from twenty-six to twenty-seven.**

**Proof, not just assertion**: a new
[`tests/public_crypto_api.rs`](tests/public_crypto_api.rs) Cargo
integration test (auto-discovered — no `Cargo.toml` change needed) is
compiled as its OWN separate crate and reaches `fedos_core_rust` ONLY
through `fedos_generate_aead_key_32`/`fedos_encrypt`/`fedos_decrypt` and
the two opaque types — it cannot even name `SecretHandle`/
`AeadCiphertextEnvelope`/`AeadCipher`/`AeadAadDomain`.

**What is explicitly NOT implemented or connected:**

- No promotion of `SecretHandle`, `AeadCiphertextEnvelope`, `AeadCipher`,
  or `AeadAadDomain` to `pub` — all four remain `pub(crate)` forever.
- No `Clone`/`Debug`/`Display`/`Serialize`/`AsRef<[u8]>` on either opaque
  wrapper type, and no public raw-byte getter of any kind.
- No ciphertext envelope serialization (JSON/CBOR/base64/wire format) —
  still its own future, separate stage (Stage 177+ candidate).
- No Runtime/Worker/Storage/Nostr/NIP-44/WASM connection anywhere.
- No new `Cargo.toml` dependency or manifest change — still 9 production
  dependencies.

**Rust-side test coverage added**: 3 new tests in `src/lib.rs`'s
`fedos_encrypt_decrypt_wiring` module (`generate_key_returns_an_opaque_
handle_ready_to_encrypt`, `two_generated_keys_are_independent`, and a
structural no-raw-byte-reachability guard), on top of the 8 existing
tests updated to the new opaque-handle signatures; 3 new tests in the new
`tests/public_crypto_api.rs` integration crate (generate→encrypt→decrypt
round trip for both ciphers, wrong key fails, two generated keys never
collide).

**Verification status**: `cargo check` and `cargo check --tests` both
compiled clean (zero warnings) against this stage's final code. Live
execution of `cargo test` was intermittently blocked in this development
environment by a local Windows Application Control Policy (unrelated to
this crate's code — see `docs/public_crypto_api.md`'s companion session
notes); this is tracked as an environment issue, not a code defect, and
should be re-run in a clean environment before release.

See
[`test/fedos_core_rust_public_opaque_crypto_api.test.ts`](../../test/fedos_core_rust_public_opaque_crypto_api.test.ts)
(19 tests) for the dedicated Stage 171–176 guard suite, plus updated
checks in `test/fedos_core_rust_public_crypto_api.test.ts`,
`test/fedos_core_rust_secret_handle_real_bytes.test.ts`,
`test/fedos_core_rust_public_api_boundary.test.ts`, and every other test
file that asserts an exact `pub fn` count or name list (now 26 → 27
throughout): no Runtime/Worker/Storage/Nostr/NIP-44 connection, no
`panic!`/`unwrap`/`expect`, and the twenty-seven-function `pub fn`
surface verified by name.

## Ciphertext serialization + NIP-44 + storage/send boundary planning (Stage 177–181)

Stage 177–181 are **planning, skeleton, docs, and guards only** — no real
serialization, no NIP-44 implementation, and no Runtime/Worker/Storage/
Nostr connection of any kind.

**Stage 177–178**: a new crate-private module,
[`src/crypto/ciphertext_transport.rs`](src/crypto/ciphertext_transport.rs),
adds `CiphertextTransportDescriptor` — a LABEL-ONLY descriptor naming
`version` (`V1` only), `algorithm` (`ChaCha20Poly1305`/`Aes256Gcm`, its own
type, separate from `aead_internal`'s and `ciphertext_envelope`'s own
algorithm labels), `encoding` (`CiphertextEncodingPlaceholder::Undecided`
— its one variant, since no wire encoding is chosen yet), `transport_kind`
(`Storage`/`NostrEvent` — naming a future destination, connecting to
neither), and `status` (`Unavailable`). Holds no ciphertext, nonce, tag,
or key. Deliberately unconnected to `crypto::ciphertext_envelope`'s real
envelope type and to any real transport.

**Stage 179**: [`docs/ciphertext_envelope_serialization_plan.md`](../../docs/ciphertext_envelope_serialization_plan.md)
fixes the wire-format field list (extending
`docs/ciphertext_envelope_plan.md`'s in-memory fields with framing
concerns), compares four candidate encodings (JSON, base64, CBOR, raw
binary) against seven fixed selection criteria, and picks NO MVP encoding.
Raw secret, a key-identifier field, and buyer/payment/entitlement metadata
are all explicitly excluded from the future format.

**Stage 180**: [`docs/nip44_internal_plan.md`](../../docs/nip44_internal_plan.md)
fixes NIP-44 v2's full pipeline in writing — secp256k1 ECDH →
HKDF-extract (conversation key) → HKDF-expand (per-message chacha_key/
nonce/hmac_key) → pad-then-ChaCha20-encrypt → version‖nonce‖ciphertext‖
hmac_tag (base64) → HMAC-then-decrypt with fixed failure labels — against
this repository's already-imported `test-vectors/nip44/nip44-v2.json`, and
names a `SecretHandle` connection strategy for the conversation key. No
NIP-44 code, no secp256k1 dependency, no Chat/DM connection.

**Stage 181**: [`docs/encrypted_payload_storage_boundary.md`](../../docs/encrypted_payload_storage_boundary.md)
fixes what a future encrypted payload MAY hand to `StorageBackend`
(`src/storage/types.ts`) — an encrypted payload descriptor, an opaque
`idRef`, an algorithm label; never a raw key, plaintext, or bare extracted
nonce — and to a `FederationProvider` (`src/federation/types.ts`) — a
public event candidate by default, or an encrypted payload only when a
specific write explicitly opts in. No `StorageBackend`/`FederationProvider`
implementation change; this crate remains `crate-type = ["rlib"]` only,
with no WASM/FFI bridge to TypeScript.

**What is explicitly NOT implemented or connected:**

- No JSON/base64/CBOR/binary serialization implementation anywhere.
- No NIP-44 implementation, no NIP-17, no secp256k1/ECDH dependency.
- No Chat feature connection.
- No `StorageBackend`/Nostr/Federation/Runtime/Worker connection.
- No public API addition — still twenty-seven `pub fn`s.
- No `Cargo.toml` change, no new dependency.
- No raw key export, no raw nonce public getter, no raw ciphertext public
  getter.
- No buyer/payment/entitlement metadata anywhere in the new docs or code.

**Rust-side test coverage added**: 5 new tests in
`crypto::ciphertext_transport`'s own `#[cfg(test)] mod tests` (placeholder
construction reports `V1`/`Undecided`/`Unavailable` for every algorithm ×
transport-kind combination, algorithm/transport-kind are preserved
independently, and each single-variant enum has no other variant — an
exhaustive-match compile-time guard).

See
[`test/fedos_core_rust_ciphertext_transport.test.ts`](../../test/fedos_core_rust_ciphertext_transport.test.ts)
for the dedicated Stage 177–181 guard suite: the descriptor is
`pub(crate)`-only (never `pub`), no serialization/NIP-44 implementation
exists anywhere in this crate, no Runtime/Worker/Storage/Nostr/NIP-44
connection, `Cargo.toml` unchanged (still 9 production dependencies), and
the `pub fn` surface is unchanged at twenty-seven.

## Serialization format decision + TypeScript payload descriptor + NIP-44 vector readiness (Stage 182–185)

Stage 182–185 continue as **planning/skeleton/docs/guards only** — still
no real serialization implementation, no NIP-44 implementation, and no
Rust↔TypeScript/WASM/FFI bridge or Storage/Nostr/Runtime/Worker
connection of any kind.

**Stage 182**: [`docs/ciphertext_serialization_format_decision.md`](../../docs/ciphertext_serialization_format_decision.md)
picks the MVP wire encoding `docs/ciphertext_envelope_serialization_plan.md`
(Stage 179) deliberately left open — **canonical JSON + base64url
fields** — weighed explicitly against that document's seven selection
criteria, and fixes the canonical field order: `v` / `alg` / `aad` / `n` /
`ct` / `tag`. No `kid`/key-id field, no secret, no buyer/payment/
entitlement metadata. `crypto::ciphertext_transport::CiphertextEncodingPlaceholder`
gains a second, additive variant, `CanonicalJsonBase64UrlPlaceholder`
(`Undecided` remains valid; a new `new_placeholder_with_encoding`
constructor lets a caller pick either) — still a label only, no
encode/decode function, no `serde`/base64 dependency, no `Cargo.toml`
change.

**Stage 183**: [`src/storage/encrypted_payload.ts`](../../src/storage/encrypted_payload.ts)
(new, TypeScript side) adds `EncryptedPayloadDescriptor`/
`EncryptedPayloadEncoding`/`EncryptedPayloadAlgorithm`/
`EncryptedPayloadTransportKind`/`EncryptedPayloadDecision` and a pure
`reviewEncryptedPayloadDescriptor(descriptor)` — mirroring this crate's
`CiphertextTransportDescriptor` in ROLE (not by import; there is still no
Rust↔TypeScript bridge). No payload byte, ciphertext byte, plaintext, or
raw key field exists on the descriptor; the review function rejects
buyer/payment/entitlement and chat/DM/private metadata, never mutates its
input, and is not wired to `StorageBackend`/`FederationProvider`/Runtime/
Worker.

**Stage 184**: `docs/encrypted_payload_storage_boundary.md` and
`docs/nostr_adapter_planning.md` are updated to name the new TypeScript
descriptor as the pre-`StorageBackend` step (§9 of the former), and to
explain why an encrypted payload's `"nostr_event"` transport-kind label
does NOT reopen `nostr_placeholder`'s existing structural rejection of
`private_message_placeholder`/`paid_content_placeholder` (§10 of the
latter) — still no adapter, no write path, no NIP-44 code.

**Stage 185**: [`docs/nip44_vector_readiness.md`](../../docs/nip44_vector_readiness.md)
confirms `test-vectors/nip44/nip44-v2.json`'s 8 existing vector
categories cover every pipeline stage `docs/nip44_internal_plan.md`
names, and fixes the 7-step implementation ORDER a future stage must
follow: vector schema guard → secp256k1 dependency adoption →
conversation-key test → message-key test → padding test →
encrypt/decrypt test → invalid-case test. No NIP-44 code, no secp256k1
dependency, no Chat/DM connection.

**What is explicitly NOT implemented or connected:**

- No JSON/base64/CBOR/binary encode or decode function anywhere in Rust.
- No TypeScript serialization code for the new descriptor.
- No NIP-44 implementation, no secp256k1/ECDH dependency.
- No Rust↔TypeScript/WASM/FFI bridge — this crate remains
  `crate-type = ["rlib"]` only.
- No `StorageBackend`/`FederationProvider`/Nostr relay/Runtime/Worker
  connection.
- No public API addition — still twenty-seven `pub fn`s.
- No `Cargo.toml` or `package.json` change, no new dependency.
- No raw key/nonce/ciphertext getter anywhere; no plaintext or payload
  bytes field on the TypeScript descriptor.
- No buyer/payment/entitlement/chat/private metadata anywhere in the new
  docs or code.

**Rust-side test coverage**: `crypto::ciphertext_transport`'s test module
grows from 5 to 6 tests (an updated exhaustive-match guard now covering
both `CiphertextEncodingPlaceholder` variants, plus a new test
constructing a descriptor still recording `Undecided` via
`new_placeholder_with_encoding`).

See
[`test/fedos_core_rust_ciphertext_transport.test.ts`](../../test/fedos_core_rust_ciphertext_transport.test.ts)
(updated) and
[`test/encrypted_payload_boundary.test.ts`](../../test/encrypted_payload_boundary.test.ts)
(new) for the dedicated Stage 182–185 guard suites: the encoding label
change is verified, no serialization/NIP-44 implementation exists
anywhere, the TypeScript descriptor accepts safe labels and rejects
sensitive/commerce/chat metadata with no payload/plaintext/raw-key field,
no Storage/Federation/Runtime/Worker wiring exists, `Cargo.toml`/
`package.json` are unchanged, and the `pub fn` surface is unchanged at
twenty-seven.

## Rust ciphertext serialization implementation + NIP-44 vector schema guard (Stage 186–188)

Stage 186–188 IMPLEMENT the Stage 182 format decision and complete
`docs/nip44_vector_readiness.md` §3's first step — still no NIP-44
cryptography, no Runtime/Worker/Storage/Nostr/WASM connection, and no
TypeScript serialization.

**Stage 186**: [`src/crypto/ciphertext_serialization.rs`](src/crypto/ciphertext_serialization.rs)
(new) adds **`encode_envelope_internal`**/**`decode_envelope_internal`**,
the real implementation of the canonical JSON + base64url format
(`v`/`alg`/`aad`/`n`/`ct`/`tag`) — hand-written against the STANDARD
LIBRARY ONLY. `serde`/`serde_json`/`hex` remain `[dev-dependencies]`-only;
**no dependency was promoted, and `Cargo.toml` is byte-for-byte
unchanged.** This is safe (not just expedient) because the wire schema is
fully closed: fixed-label strings, one small integer, and base64url text
whose alphabet contains no `"`/`\`. Field order is STRICT in both
directions — a reordered document is rejected, resolving the leniency
question `docs/ciphertext_serialization_format_decision.md` §3 left open.
`ct`/`tag` are split wire fields (at the fixed 16-byte AEAD tag length)
even though the in-memory `AeadCiphertextEnvelope` keeps them combined —
`encode_envelope_internal` returns `None` (never panics) for a Stage
157–158 placeholder envelope too short to split. Connects to the REAL
envelope type (this stage's explicit authorization); not yet wired to
`fedos_encrypt`/`fedos_decrypt` or any bridge. No public API addition —
still twenty-seven `pub fn`s.

**Stage 187**: [`src/crypto/nip44_vector_schema.rs`](src/crypto/nip44_vector_schema.rs)
(new, `#[cfg(test)]`-only) implements `docs/nip44_vector_readiness.md`
§3's step 1 — and ONLY that step: confirms
`test-vectors/nip44/nip44-v2.json` parses and its 8 categories match the
documented schema (name, `shouldPass` polarity, non-empty `data`,
`get_message_keys`'s distinct object shape) — via `serde`/`serde_json`
(already `[dev-dependencies]`-only). **No cryptographic verification of
any kind** — no ECDH, no HKDF, no conversation-key/message-key
derivation, no padding calculation, no encrypt/decrypt. No secp256k1
dependency adopted.

**Stage 188**: `docs/ciphertext_serialization_format_decision.md` and
`docs/nip44_vector_readiness.md` are updated to record both as complete.

**What is explicitly NOT implemented or connected:**

- No NIP-44 cryptographic implementation — no conversation-key/
  message-key derivation, no padding, no encrypt/decrypt.
- No secp256k1/ECDH dependency.
- No TypeScript serialization implementation (no `JSON.stringify`-based
  encoder/decoder mirroring the Rust codec).
- No wiring of `ciphertext_serialization` to `fedos_encrypt`/
  `fedos_decrypt`, `aead_envelope_bridge`, or `ciphertext_transport`.
- No Runtime/Worker/Storage/Nostr/WASM connection.
- No public API addition — still twenty-seven `pub fn`s.
- No `Cargo.toml` or `package.json` change, no new dependency.
- No raw key getter, no raw nonce public getter, no raw ciphertext
  public getter beyond what the existing crate-private
  `AeadCiphertextEnvelope::ciphertext()` already exposed internally.

**Rust-side test coverage added**: 11 new tests in
`crypto::ciphertext_serialization`'s own test module (round trip for both
ciphers × every `AeadAadDomain`, canonical field order, reordered-fields
rejection, unknown/missing field rejection, invalid base64url rejection,
wrong version/algorithm/AAD-domain rejection, placeholder-envelope
encode returning `None`, and base64url encode/decode round-trip +
standard-base64/whitespace rejection); 6 new tests in
`crypto::nip44_vector_schema` (JSON parses, algorithm description sanity,
exactly the 8 expected categories present, each category's `shouldPass`
polarity + non-empty data, valid./invalid. naming consistency, and
`get_message_keys`'s object shape).

**Verified against a real Rust toolchain**: `cargo check`, `cargo test`
(219 crate unit tests, up from 202 at Stage 177–185, plus the 3
integration tests unchanged), and `cargo check --tests` all GREEN.

See
[`test/fedos_core_rust_ciphertext_serialization.test.ts`](../../test/fedos_core_rust_ciphertext_serialization.test.ts)
for the dedicated Stage 186–188 guard suite: serialization stays
Rust-only (no TypeScript JSON/base64 codec added), no NIP-44
cryptographic implementation exists anywhere, no Runtime/Worker/Storage/
Nostr wiring, `Cargo.toml`/`package.json` unchanged, and the `pub fn`
surface is unchanged at twenty-seven.

## Encrypted payload preview + diagnostics + NIP-44 dependency adoption planning (Stage 189–193)

Stage 189–193 add NO new cryptography anywhere. Stage 189–191 are
TypeScript-side display/boundary work (`src/render/`, `src/storage/`);
Stage 192 is a Rust-crate dependency PLANNING document (no `Cargo.toml`
change); Stage 193 is a pre-adoption JS guard.

**Stage 192**: [`docs/nip44_dependency_adoption.md`](../../docs/nip44_dependency_adoption.md)
(new) compares the two realistic secp256k1/ECDH candidates for
`docs/nip44_internal_plan.md`'s conversation-key derivation —
`rust-secp256k1` (C-FFI bindings to `libsecp256k1`, the same library
Bitcoin Core runs in production; the first C-FFI/`unsafe`-internally
candidate this crate has ever considered) and `k256` (pure Rust,
RustCrypto family — the same organization behind `hkdf`/`aes-gcm`/`sha2`/
`subtle`, already in this crate's dependency tree) — against nine fixed
adoption criteria (feature minimalism, no `rand`/`serde` feature, a
citable audit posture rather than an assumed one, `no_std`/WASM posture,
MSRV, one-crate-per-stage scope discipline). **Picks neither.**
`Cargo.toml` is unchanged — still 9 production dependencies, still zero
secp256k1/ECDH crates.

**Stage 193**: a pre-adoption JS guard suite (see
[`test/nip44_pre_adoption_guard.test.ts`](../../test/nip44_pre_adoption_guard.test.ts))
confirms, from OUTSIDE the crate, that none of this planning slipped into
code: `Cargo.toml` byte-for-byte unchanged, no `secp256k1`/`k256`
dependency, no NIP-44 cryptographic function (ECDH, conversation-key,
message-key, padding, MAC, encrypt, decrypt) exists anywhere in this
crate's production code, and the public `pub fn` surface is unchanged at
twenty-seven.

Stage 189–191's TypeScript-side work — `src/render/encrypted_payload_preview.ts`,
`src/render/payload_diagnostics.ts`, and the `PayloadPreviewDescriptor`/
`PayloadDiagnosticsDescriptor` extension to `src/storage/encrypted_payload.ts` —
lives entirely outside this Rust crate (there is still no Rust↔TypeScript
bridge); see the repository root `README.md`'s Stage 189–193 entry for
the full record of that work.

## secp256k1 dependency adoption + capability/diagnostics + guards + docs (Stage 194–197)

Stage 194–197 resolve Stage 192's open comparison: **`k256` is adopted.**
No ECDH, conversation-key, message-key, padding, encrypt, decrypt, or
NIP-44 code is written — this is dependency adoption plus capability-
label/diagnostics bookkeeping and guards only.

**Stage 194**: `Cargo.toml` gains `k256 = { version = "0.13",
default-features = false, features = ["arithmetic"] }` — production
dependency count 9 → 10. No `ecdsa`/`schnorr`/`serde`/`pem`/`pkcs8`/`rand`
feature is enabled; `arithmetic` alone is the minimum a future ECDH stage
needs to build on. A `cargo tree -i rand_core` check (run before
adoption, not after) found `rand_core` appearing as a REQUIRED,
non-optional transitive dependency of `elliptic-curve`/`ff`/`group`/
`crypto-bigint` — the RustCrypto elliptic-curve trait crates
`arithmetic` itself is built on — regardless of which `k256` feature
flags are selected. This is an ecosystem-wide trait requirement (e.g.
`ff::Field`'s `random(rng)` signature), not a feature this crate chose to
turn on; `rand_core` is trait-definitions-only, with no entropy-source
implementation of its own, and the full `rand` crate remains absent from
the resolved graph. Escalated to and confirmed by the user as a REVIEWED
EXCEPTION to this crate's standing "no `rand`/`rand_core`" dependency
policy — recorded in `Cargo.toml`'s own comment and in
`docs/nip44_dependency_adoption.md` §7.

**Stage 195**: `crypto::capability_matrix`'s `CryptoCapability` gains an
eleventh variant, `Ecdh` (right after `Envelope`). `crypto::diagnostics`'s
`CapabilityReadiness` gains a fourth variant, `ReadyForImplementation` —
distinct from `Ready` (real, wired code), `NotConnected` (a skeleton
type exists), and `NotImplemented` (no dependency, no code): the
dependency now exists, but zero ECDH code — no skeleton, no function, no
type — has been written. `crypto_diagnostics_preview()` reports exactly
one capability, `Ecdh`, in this new state.

**Stage 196**: two new guard suites confirm the adoption's shape stays
exactly this minimal. Rust-side:
[`crypto::secp256k1_dependency_guard`](src/crypto/secp256k1_dependency_guard.rs)
(`#[cfg(test)]`-only, mirroring `nip44_vector_schema`'s pattern) reads
the ACTUAL resolved `Cargo.toml`/`Cargo.lock` via `include_str!` and
confirms: exactly ten production dependencies, `k256` declared with
`default-features = false` and only the `arithmetic` feature, no
`rust-secp256k1` (C-FFI) dependency was also added, and `Cargo.lock`
resolves `k256` with `rand_core` present only as the documented
transitive exception (no full `rand` crate). TypeScript-side:
[`test/secp256k1_dependency_guard.test.ts`](../../test/secp256k1_dependency_guard.test.ts)
re-confirms all of the above from OUTSIDE the crate, plus: the
`CryptoCapability`/`CapabilityReadiness` enum changes land exactly as
specified, no ECDH/conversation-key/message-key/padding/encrypt/decrypt
function exists anywhere in production code, `secp256k1_dependency_guard`
is declared `#[cfg(test)]`-only (never `pub`/`pub(crate)`), the `pub fn`
surface is unchanged at twenty-seven, and there is no Runtime/Worker/
Storage/Federation connection. The pre-existing
[`test/nip44_pre_adoption_guard.test.ts`](../../test/nip44_pre_adoption_guard.test.ts)
(Stage 193) is updated in place — its premise ("nothing adopted yet")
is now false, so its checks are inverted/refocused where Stage 194–195
change what is legitimately present (e.g. `k256` in `Cargo.toml`, the
`Ecdh` capability label) while still confirming no actual ECDH
COMPUTATION exists.

**Stage 197**: [`docs/nip44_dependency_adoption.md`](../../docs/nip44_dependency_adoption.md)
gains a new §6–§9 recording the `k256` decision (weighed against the
nine §3 criteria — RustCrypto ecosystem fit was decisive; audit posture
was the one criterion favoring `rust-secp256k1`, outweighed here), the
exact feature-selection rationale, the `rand_core` exception
cross-reference, and the FIXED future implementation order: **ECDH →
ConversationKey → MessageKey → Padding → Encrypt → Decrypt → NIP-44** —
one capability per future stage, every intermediate commit within a
future stage keeping `cargo check`/`cargo test` green.

Public `pub fn` surface unchanged at twenty-seven. No ECDH,
conversation-key, message-key, padding, encrypt, decrypt, or NIP-44
implementation. No Runtime/Worker/Storage/Federation/Relay/WASM/FFI
connection. No TypeScript serialization change.

## NIP-44 key-derivation half: ConversationKey + ECDH + MessageKey + HKDF bridge (Stage 198–201)

Stage 198–201 implement `docs/nip44_internal_plan.md` §3 for real, and
lay a generic (not yet spec-accurate) bridge toward §4. **No padding, no
NIP-44 encrypt/decrypt, no public API addition, no Runtime/Worker/
Storage/Relay connection, no new `Cargo.toml` dependency.**

**Stage 198**: [`crypto::conversation_key`](src/crypto/conversation_key.rs)
(new) adds `ConversationKeyState`/`ConversationKeyKind`/`ConversationKey`/
`ConversationKeyDecision`/`ConversationKeyStatus`/`ConversationKeyGeneration`.
`ConversationKey` wraps a `SecretHandle` internally (a NEW
`SecretHandleKind::ConversationKeyMaterial` variant) — `pub(crate)`-only,
no `Clone`, no `Debug`, no public raw-byte accessor, zeroize-on-drop via
`SecretHandle`'s own `Drop`, and a `new_placeholder()` path mirroring
`SecretHandle`'s own skeleton-first shape.

**Stage 199**: the same module adds the REAL
`derive_conversation_key_via_ecdh_internal(secret_key: &SecretHandle,
public_key: &SecretHandle) -> ConversationKeyDecision` — this crate's
first production elliptic-curve point arithmetic. Both inputs MUST be
`SecretHandleKind::NostrKeyMaterial`-kinded and `Holding` real bytes;
wrong kind, the Stage 79 placeholder path, or an already-`clear()`-ed
handle are all rejected with `ConversationKeyStatus::InvalidKey` before
any `k256` call. The ECDH shared point is computed via MANUAL
`ProjectivePoint`/`AffinePoint` scalar multiplication — `k256`'s
`arithmetic` feature alone, no `ecdh` Cargo feature added — lifting the
32-byte x-only Nostr public key to a full curve point with a `0x02` SEC1
even-Y tag byte (the same convention NIP-44's reference implementation
uses). The shared X-coordinate then feeds `hkdf::Hkdf::extract` with the
fixed `"nip44-v2"` salt (EXTRACT ONLY, never expand) to produce the
32-byte conversation key. A new sibling `#[cfg(test)]`-only module,
[`nip44_conversation_key_vectors`](src/crypto/nip44_conversation_key_vectors.rs),
verifies this byte-for-byte against ALL 43 `valid`/
`invalid .get_conversation_key` cases in
`test-vectors/nip44/nip44-v2.json` — 35 valid cases produce the exact
documented `conversation_key`; all 8 invalid cases (out-of-range/zero
scalar, points with no valid on-curve lift, twist points) are rejected by
`k256`'s own constant-time validation, never a panic. `SecretHandle`
itself gains a THIRD narrowly-scoped raw-byte accessor,
`expose_bytes_for_internal_ecdh`, for this module's sole reviewed call
site — mirroring the two accessors Stage 147/152–154 already added for
`kdf_core`/`aead_internal`.

**Stage 200**: [`crypto::message_key`](src/crypto/message_key.rs) (new)
adds `MessageKey`/`MessageKeyKind`/`MessageKeyStatus`/`MessageKeyDecision`
— the same `SecretHandle`-backed (a NEW
`SecretHandleKind::MessageKeyMaterial` variant), placeholder-first,
`pub(crate)`-only, no-`Clone`/no-`Debug` shape as `ConversationKey`, with
zero derivation logic of its own.

**Stage 201**: [`crypto::hkdf_bridge`](src/crypto/hkdf_bridge.rs) (new)
adds the ONE function connecting them:
`derive_message_key_from_conversation_key_internal(&ConversationKey) ->
MessageKeyDecision`. It reuses `kdf_core::derive_secret_handle_internal`
(Stage 147, already real) under the pre-existing, FIXED
`HkdfDomain::Conversation` — there is no salt/info/domain parameter of
any kind on this function, so a caller cannot select a different domain.
A `ConversationKey` that is still the Stage 198 placeholder path, or
already `clear()`-ed, is rejected with `MessageKeyStatus::InvalidKey`
before any HKDF call. **This is a generic architectural bridge, NOT
NIP-44 v2's real per-message key derivation** — the real spec derives
`chacha_key`/`chacha_nonce`/`hmac_key` via HKDF-expand with a FRESH
RANDOM per-message nonce as salt (`docs/nip44_internal_plan.md` §4), which
this fixed-domain bridge deliberately does not accept; that real
derivation remains a future, separate, explicitly-reviewed stage.

**Capability/diagnostics**: `CryptoCapability` grows from eleven to
fifteen variants — `MessageKey`, `Padding`, `Encrypt`, `Decrypt` appended
after `ConversationKey`. `crypto_diagnostics_preview()` promotes `Ecdh`
(was `ReadyForImplementation`) and `ConversationKey` (was
`NotImplemented`) to `Ready`, reports the new `MessageKey` as `Ready`,
`Encrypt`/`Decrypt` as `NotConnected` (the underlying ChaCha20/HMAC-SHA256
primitive FAMILIES already exist transitively in this crate's dependency
graph, but no NIP-44-specific function is wired — mirroring how `Aead`
itself was `NotConnected` before Stage 152–154), and the new `Padding` as
`NotImplemented` (no padding code or dependency exists at all).

**Guards**: a new Rust-side
[`nip44_key_derivation_guard`](src/crypto/nip44_key_derivation_guard.rs)
(`#[cfg(test)]`-only) confirms `ConversationKey`/`MessageKey` derive
neither `Clone` nor `Debug`, that none of the three new files declare a
single `pub` item, and that none of them reference Runtime/Worker/
Storage/Relay. A new
[`test/nip44_key_derivation_stage_guard.test.ts`](../../test/nip44_key_derivation_stage_guard.test.ts)
re-confirms all of the above from OUTSIDE the crate, plus the
capability/diagnostics changes land exactly as specified and the `pub fn`
surface is unchanged at twenty-seven. The pre-existing
[`test/nip44_pre_adoption_guard.test.ts`](../../test/nip44_pre_adoption_guard.test.ts)
(Stage 193) and
[`test/secp256k1_dependency_guard.test.ts`](../../test/secp256k1_dependency_guard.test.ts)
(Stage 196) are both updated in place: several of their checks now
acknowledge that ECDH/`ConversationKey`/`MessageKey` ARE implemented for
real (in their own dedicated files, never in `lib.rs`/`crypto.rs`
directly), while confirming padding/NIP-44 encrypt/decrypt still exist
nowhere in the crate.

Public `pub fn` surface unchanged at twenty-seven. No padding, no NIP-44
encrypt/decrypt implementation. No Runtime/Worker/Storage/Federation/
Relay/WASM/FFI connection. No TypeScript serialization change. No new
`Cargo.toml` dependency.

## NIP-44 padding/encrypt/decrypt/authentication half: the FedOS internal NIP-44-like bridge (Stage 202–208)

**Terminology, fixed by Stage 209–213 and used throughout this section:**
what Stage 202–208 builds is the **"FedOS internal NIP-44-like bridge"**
— NIP-44-*shaped* (pad → encrypt-with-authentication → decrypt), but NOT
NIP-44 v2's byte-exact wire format. It must never be called "NIP-44
compatible" — see
[`docs/nip44_wire_compatibility_gap.md`](../../docs/nip44_wire_compatibility_gap.md)
for the full field-by-field record.

**Stage 202–203**: [`crypto::nip44_padding`](src/crypto/nip44_padding.rs)
(new) implements NIP-44 v2's real, SPEC-EXACT logarithmic-bucket padding
scheme (`docs/nip44_internal_plan.md` §5) — `calc_padded_len` (pure
integer arithmetic, no floating point), `pad_message` (2-byte big-endian
length prefix + zero-fill), `unpad_message` (the inverse). This is the ONE
piece of the Stage 202–208 bridge that already matches NIP-44 v2's real
wire format byte-for-byte, vector-verified by the sibling
`#[cfg(test)]`-only
[`nip44_padding_vectors`](src/crypto/nip44_padding_vectors.rs) module
against all 24 `valid.calc_padded_len` cases and all 4
`invalid.encrypt_msg_lengths` cases in `test-vectors/nip44/nip44-v2.json`.

**Stage 204–205**: [`crypto::nip44_encrypt`](src/crypto/nip44_encrypt.rs)/
[`crypto::nip44_decrypt`](src/crypto/nip44_decrypt.rs) (new) implement a
pad-then-seal / open-then-unpad pipeline keyed by a `MessageKey`, but
REUSE this crate's PRE-EXISTING ChaCha20-Poly1305 AEAD
(`crypto::aead_internal`, Stage 152–154) rather than NIP-44 v2's real
raw-ChaCha20-stream-cipher-plus-separate-HMAC-SHA256 construction —
zero new `Cargo.toml` dependency, at the cost of not being byte-exact.
`nip44_decrypt` collapses every reachable failure cause (wrong key, wrong
nonce, tampered ciphertext, invalid tag, and even a structurally malformed
padded plaintext discovered AFTER authentication already succeeded) into
a SINGLE fixed `Nip44DecryptStatus::AuthenticationFailed` label, never
distinguishing cause — verified by that module's own
`malformed_padding_after_successful_authentication_still_reports_authentication_failed`
test.

**Stage 206**: [`crypto::nip44_bridge`](src/crypto/nip44_bridge.rs) (new)
connects both to this crate's pre-existing, UNCHANGED
`ciphertext_envelope::AeadCiphertextEnvelope` type
(`nip44_envelope_from_encrypt_decision_internal`/
`nip44_decrypt_decision_from_envelope_internal`) — no new envelope field,
no new variant, no format change.

**Capability/diagnostics (Stage 207–208)**: `CryptoCapability` grows from
fifteen to sixteen variants — a new `Authentication` variant tracks
`nip44_decrypt`'s single-fixed-label MAC discipline as its own capability.
`crypto_diagnostics_preview()` promotes `Padding`/`Encrypt`/`Decrypt` from
`NotImplemented`/`NotConnected` to `Ready`, and reports the new
`Authentication` as `Ready` too — zero `NotConnected` rows remain.

**Guards**: a new Rust-side
[`nip44_encrypt_decrypt_guard`](src/crypto/nip44_encrypt_decrypt_guard.rs)
(`#[cfg(test)]`-only) confirms all four Stage 202–206 files stay
`pub(crate)`-only, `unsafe`/`.unwrap(`/`.expect(`/`panic!(`-free, import no
raw `chacha20`/`hmac` crate, and reference no Runtime/Worker/Storage/
Relay. A new
[`test/nip44_padding_encrypt_decrypt_guard.test.ts`](../../test/nip44_padding_encrypt_decrypt_guard.test.ts)
re-confirms all of the above from outside the crate, plus the capability/
diagnostics changes land exactly as specified and the `pub fn` surface
stays unchanged at twenty-seven.

Public `pub fn` surface unchanged at twenty-seven. **No byte-exact NIP-44
v2 wire format** (no 32-byte per-message nonce, no raw ChaCha20 stream
cipher, no separate HMAC-SHA256 tag, no base64 payload — see
`docs/nip44_wire_compatibility_gap.md`). No Runtime/Worker/Storage/
Federation/Relay/WASM/FFI connection. No TypeScript serialization change.
No new `Cargo.toml` dependency.

## NIP-44 wire compatibility gap clarification + wire-compatible implementation prep (Stage 209–213)

Stage 209–213 do NOT add any new encrypt/decrypt/base64/HMAC/ChaCha20
stream-cipher code. They exist to make the Stage 202–208 gap
impossible to miss going forward, and to fix the label vocabulary a
FUTURE byte-exact implementation would use.

**Docs**:
[`docs/nip44_wire_compatibility_gap.md`](../../docs/nip44_wire_compatibility_gap.md)
(new) states, field by field, exactly what the Stage 202–208 bridge is
(a generic ChaCha20-Poly1305-AEAD-based pipeline) and is not (NIP-44 v2's
real `chacha_key`/`chacha_nonce`/`hmac_key`-separated,
32-byte-nonce, base64-encoded, HMAC-SHA256-tagged wire format), and fixes
two terms: **"FedOS internal NIP-44-like bridge"** (what exists today) and
**"NIP-44 v2 wire-compatible implementation"** (the future target) — with
an explicit forbidden-phrasing list ("NIP-44 compatible", "NIP-44 v2
compatible", "NIP-44-compliant") that must never describe the former.
[`docs/nip44_wire_implementation_roadmap.md`](../../docs/nip44_wire_implementation_roadmap.md)
(new) proposes an eight-step order for actually closing the gap (exact
message-key derivation → padding re-confirmation → 32-byte nonce handling
→ raw ChaCha20 stream encryption → HMAC-SHA256 tag → base64 payload
encoding → invalid vectors → bridge to Nostr DM only once every vector
category passes), with candidate Stage numbers (214+) that are explicitly
not commitments. `docs/nip44_internal_plan.md` gains a terminology section
pointing at both new documents.

**Wire skeleton**: [`crypto::nip44_wire`](src/crypto/nip44_wire.rs) (new)
adds four LABEL-ONLY types — `Nip44WireVersion` (`V2`, the only wire
version), `Nip44WirePayloadKind` (`Nonce`/`Ciphertext`/`Mac` — which wire
section a value classifies), `Nip44WireStatus` (`Unimplemented` — its only
variant; no real wire encrypt/decrypt exists), and `Nip44WireDecision`
(holds only the above three labels — never a ciphertext, nonce, or tag
byte). Deliberately separate from, and does not modify, the existing
Stage 202–206 bridge (which keeps reporting `Ready` unchanged).

**Guards**: `crypto::nip44_wire`'s own `#[cfg(test)]` unit tests confirm
`Nip44WireStatus` has no variant beyond `Unimplemented` and
`Nip44WireVersion` has no variant beyond `V2` (an exhaustive `match` that
fails to compile if a future stage adds one without reviewing this test).
A new
[`test/fedos_core_rust_nip44_wire_compatibility.test.ts`](../../test/fedos_core_rust_nip44_wire_compatibility.test.ts)
confirms: no Stage 198–208 source (`nip44_padding`/`nip44_encrypt`/
`nip44_decrypt`/`nip44_bridge`/`capability_matrix`/`diagnostics`/
`crypto.rs`) ever claims "NIP-44 compatible"/"NIP-44 v2 compatible"/
"NIP-44-compliant"; the new docs exist and name the required/forbidden
terminology; `nip44_wire` is `pub(crate)`-only with no base64/HMAC/raw-
ChaCha20 import and no `fn` named `encrypt`/`decrypt`/`base64`/`hmac`; the
existing bridge is untouched; capability/diagnostics are unchanged in
shape; and the usual Runtime/Worker/Storage/Federation/`pub fn`-count/
`Cargo.toml`-dependency-count/`package.json`-dependency-count/no-`serde`-
derive checks all still hold.

Public `pub fn` surface unchanged at twenty-seven. No NIP-44 v2 wire
encrypt/decrypt implementation, no base64, no HMAC-SHA256, no raw ChaCha20
stream cipher. No Runtime/Worker/Storage/Federation/Relay/WASM/FFI
connection. No TypeScript serialization change. No new `Cargo.toml`
dependency.

## NIP-44 v2 exact wire preparation: message key review, nonce/payload planning, and derivation skeleton (Stage 214–218)

Stage 214–218 add zero new encrypt/decrypt/base64/HMAC/ChaCha20-stream
code. They fix the NIP-44 v2 spec itself — exact message key derivation,
the 32-byte wire nonce, and the fixed wire payload layout — in writing
and in a label-only skeleton, so the eventual byte-exact implementation
(`docs/nip44_wire_implementation_roadmap.md`) has zero ambiguity left to
resolve.

**Stage 214**:
[`docs/nip44_message_key_review.md`](../../docs/nip44_message_key_review.md)
(new) re-derives NIP-44 v2's real per-message key derivation
byte-for-byte against `test-vectors/nip44/nip44-v2.json`'s
`valid.get_message_keys` category: `HKDF-Expand(PRK = conversation_key,
info = nonce, L = 76)`, split into `chacha_key` (bytes 0–32),
`chacha_nonce` (bytes 32–44), `hmac_key` (bytes 44–76) — NOT a second
extract. It also corrects `docs/nip44_internal_plan.md` §4's own
terminology: the per-message `nonce` plays RFC 5869's `info` role (an
expand-step parameter), not `salt` (an extract-step parameter) — a
wording-only correction; the substantive claims in §4 were already right.
A diff table lines this up against what `crypto::hkdf_bridge` (Stage
200–201) actually implements today (a FIXED-domain, nonce-free,
single-32-byte-output bridge — nothing like the real per-message,
76-byte, three-way-split derivation).

**Stage 215**:
[`docs/nip44_wire_nonce.md`](../../docs/nip44_wire_nonce.md) (new) fixes
the 32-byte wire nonce's role (the HKDF-expand `info` parameter above,
ALSO carried in the clear as the wire payload's second field), generation
responsibility (sender draws it fresh every message, CSPRNG-only, never
deterministic), the reuse prohibition (repeating a nonce under the same
`conversation_key` deterministically repeats the ENTIRE `chacha_key`/
`chacha_nonce`/`hmac_key` triple — a compound keystream-reuse failure,
worse than a typical AEAD nonce reuse), and how it differs from both this
crate's own 12-byte `fedos_aead_nonce_96`/`FedosAeadNonceDecision` and the
Stage 204–206 bridge's own (unrelated, 12-byte, stand-in) nonce parameter.

**Stage 216**:
[`docs/nip44_wire_payload_layout.md`](../../docs/nip44_wire_payload_layout.md)
(new) fixes the complete wire payload: `version_byte (1 byte, 0x02) ‖
nonce (32 bytes) ‖ ciphertext (variable, per `calc_padded_len`) ‖ hmac_tag
(32 bytes)`, then standard-base64-encoded (NOT the base64url this crate's
OWN, separate `ciphertext_serialization`, Stage 186, already uses) as a
single string embedded in a Nostr event's `content` field. Documents
exactly where padding sits (entirely inside the `ciphertext` field,
invisible at the wire level once encrypted — never its own field) and
why the field order is fixed the way it is. No encode/decode function is
implemented.

**Stage 217**:
[`crypto::nip44_message_keys`](src/crypto/nip44_message_keys.rs) (new,
`pub(crate)`-only) adds `Nip44DerivedKeyKind` (`ChachaKey`/`ChachaNonce`/
`HmacKey`), `Nip44MessageKeyStatus` (`Placeholder` — its only variant),
`Nip44MessageKeyDecision` (holds only the above two labels), and
`derive_message_keys_exact_placeholder()` — takes NO `ConversationKey`,
NO nonce, and no other input, always returns all three kinds as
`Placeholder`. No HKDF call, no nonce generation, no HMAC, no ChaCha20
stream cipher — a label-only skeleton mirroring `crypto::nip44_wire`'s
own shape (Stage 209–213), fixing the vocabulary the real derivation
(`docs/nip44_wire_implementation_roadmap.md` step 1) would eventually
return through.

**Guards**: a new
[`test/fedos_core_rust_nip44_message_key_review.test.ts`](../../test/fedos_core_rust_nip44_message_key_review.test.ts)
confirms: the three new docs exist and name their required content;
`nip44_message_keys` is `pub(crate)`-only with no HKDF/HMAC/ChaCha20/
nonce-generation import in its code (comments may legitimately NAME them
in "this module does NOT use X" prose); `derive_message_keys_exact_placeholder`
takes no parameter and its status enum has no variant beyond
`Placeholder`; `crypto::conversation_key`/`crypto::message_key`/
`crypto::hkdf_bridge` and `crypto::nip44_wire` are untouched; capability/
diagnostics stay unchanged in shape; and the usual Runtime/Worker/
Storage/Federation/`pub fn`-count/`Cargo.toml`-dependency-count/
`package.json`-dependency-count/no-`serde`-derive checks all still hold.

Public `pub fn` surface unchanged at twenty-seven. No NIP-44 v2 wire
encrypt/decrypt implementation, no base64, no HMAC-SHA256, no raw ChaCha20
stream cipher, no nonce generation, no `ConversationKey`/`MessageKey`/
`HkdfDomain` change. No Runtime/Worker/Storage/Federation/Relay/WASM/FFI
connection. No TypeScript serialization change. No new `Cargo.toml`
dependency.

## NIP-44 v2 wire-compatible implementation, first slice: exact HKDF-expand message key derivation (Stage 219–223)

Stage 219–223 land the FIRST real slice of a byte-exact "NIP-44 v2
wire-compatible implementation" (`docs/nip44_wire_implementation_roadmap.md`
step 1): per-message key derivation, vector-verified against every
`valid.get_message_keys` case. **Derivation only** — no Encrypt/Decrypt,
no ChaCha20 stream cipher, no HMAC computation, no wire encoding, no
base64, no Nostr/Runtime/Worker/Storage connection.

**Stage 219**:
[`crypto::nip44_message_keys`](src/crypto/nip44_message_keys.rs) replaces
its Stage 217 `derive_message_keys_exact_placeholder()` label-only
skeleton with the REAL derivation
`docs/nip44_message_key_review.md` (Stage 214) reviewed:
`derive_message_keys_exact_internal(conversation_key: &ConversationKey,
nonce: &[u8; 32])` exposes `conversation_key`'s raw bytes via its own
pre-existing, UNCHANGED `expose_bytes_for_internal_message_key_derivation`
accessor, then calls `derive_message_keys_exact_from_bytes_internal` — a
lower-level pure-bytes engine (`Hkdf::<Sha256>::from_prk(conversation_key_bytes)`,
NEVER `Hkdf::extract`, then `.expand(nonce, &mut okm[76])`, split into
`chacha_key`/`chacha_nonce`/`hmac_key`) kept `pub(crate)` specifically so
vector tests can feed it a raw `conversation_key` value with no
corresponding `sec1`/`pub2` pair to re-derive it through. `Nip44MessageKeyStatus`
drops its Stage 217 `Placeholder` variant for `Ready`/
`InvalidConversationKey`/`InternalFailure`.

**Stage 220**: a new sibling `#[cfg(test)]`-only
[`nip44_message_key_vectors`](src/crypto/nip44_message_key_vectors.rs)
module wires ALL 32 `test-vectors/nip44/nip44-v2.json`
`valid.get_message_keys` cases against
`derive_message_keys_exact_from_bytes_internal` — every `chacha_key`/
`chacha_nonce`/`hmac_key` matches byte-for-byte. NIP-44 v2's reference
vector set defines no `invalid.get_message_keys` category, so this stage
wires `valid` only (invalid-input handling for this function — a
placeholder or cleared `ConversationKey` — is instead covered by
`nip44_message_keys`'s own unit tests).

**Stage 221**: a new
[`test/fedos_core_rust_nip44_message_key_vectors.test.ts`](../../test/fedos_core_rust_nip44_message_key_vectors.test.ts)
confirms: the Stage 217 placeholder function/variant is gone; real
`Hkdf::from_prk`/`.expand` is used, never `Hkdf::extract`/`Hkdf::new`;
`derive_message_keys_exact_internal`'s signature takes `&ConversationKey`
plus a 32-byte nonce; the vector module is wired and `#[cfg(test)]`-only;
`crypto::conversation_key`/`crypto::message_key`/`crypto::hkdf_bridge`
remain untouched; and the usual public API/`Cargo.toml`/`package.json`/
Runtime/Worker/Storage/Federation checks all still hold. The pre-existing
[`test/fedos_core_rust_nip44_message_key_review.test.ts`](../../test/fedos_core_rust_nip44_message_key_review.test.ts)
(Stage 218) is updated in place: its placeholder-shape assertions (tests
6–9) now check the real shape instead.

**Stage 222**: `capability_matrix`/`diagnostics` gain a documentation-only
update — NO seventeenth `CryptoCapability` variant is added.
`nip44_message_keys` is additional machinery behind NIP-44 v2's exact
wire path, not a newly-tracked capability of its own; `MessageKey`'s row
keeps reporting `Ready` for exactly the reason it already did at Stage
200–201 (`crypto::message_key`/`crypto::hkdf_bridge`'s own, still
UNCHANGED, generic bridge).

**Stage 223**: `docs/nip44_message_key_review.md` gains an "IMPLEMENTED
Stage 219-220" update note confirming its own reviewed derivation is now
real and vector-verified, embodying its own §2 terminology correction
directly in code (the parameter is named `nonce` and passed as
`expand`'s `info` argument, never near a `salt` parameter).

Public `pub fn` surface unchanged at twenty-seven. No Encrypt/Decrypt, no
ChaCha20 stream cipher, no HMAC computation, no base64, no wire
serialization, no `ConversationKey`/`crypto::hkdf_bridge` change, no
`CryptoCapability` addition. No Runtime/Worker/Storage/Federation/Relay/
WASM/FFI connection. No TypeScript serialization change. No new
`Cargo.toml` dependency.

## NIP-44 v2 wire-compatible implementation, second slice: wire nonce generation + payload skeleton (Stage 224–228)

Stage 224–228 land the wire format's SUPPORTING pieces — a real 32-byte
nonce generator and a payload skeleton/validator — still WITHOUT any
ChaCha20 stream encryption, HMAC computation, or encrypt/decrypt
connection.

**Stage 224**:
[`crypto::nip44_wire_nonce`](src/crypto/nip44_wire_nonce.rs) (new) adds
`generate_wire_nonce_internal() -> Nip44WireNonceDecision` — exactly 32
bytes from the OS CSPRNG via `getrandom::fill`, `Nip44WireNonceStatus`
(`Ready`/`InternalFailure`, no fallback). COMPLETELY INDEPENDENT of this
crate's pre-existing `fedos_aead_nonce_96`/`FedosAeadNonceDecision`
(Stage 138) — no shared type, no shared helper, per
`docs/nip44_wire_nonce.md` (Stage 215) and now
[`docs/nip44_wire_nonce_generation.md`](../../docs/nip44_wire_nonce_generation.md)
(the implementation record).

**Stage 225–226**:
[`crypto::nip44_wire_payload`](src/crypto/nip44_wire_payload.rs) (new)
adds `Nip44WirePayload { version, nonce, ciphertext, mac }` (`version`
fixed `V2`, `nonce` REAL via Stage 224, `ciphertext`/`mac` ALWAYS `None`
— placeholder only) and `Nip44WirePayloadBuilder::build_placeholder()` —
the one constructor, taking no ciphertext/plaintext/key/MAC input.
`validate_wire_payload_placeholder(version_tag, nonce, ciphertext_present,
mac_present)` checks STRUCTURE ONLY (version tag, nonce length, field
presence) — no authentication, no decryption, no base64 — mirroring
`crypto::ciphertext_envelope::validate_envelope_internal`'s own
"untrusted candidate, structural checks only" shape. Calling it against
the builder's own output honestly reports `MissingField` (verified by
this module's own
`a_freshly_built_placeholder_payload_is_not_yet_wire_valid` test) — see
[`docs/nip44_wire_payload_builder.md`](../../docs/nip44_wire_payload_builder.md)
for the full implementation record.

**Stage 227**:
[`crypto::nip44_wire_diagnostics`](src/crypto/nip44_wire_diagnostics.rs)
(new) adds a SEPARATE, fixed, two-row preview — `WireNonce` → `Ready`,
`WirePayload` → `Placeholder` — mirroring `aead_diagnostics`'s own
"per-feature detail preview alongside the main table" shape (Stage 155).
Adds NO `CryptoCapability` variant and changes NO existing capability's
meaning or readiness — `capability_matrix`/`diagnostics` stay exactly as
they were (still sixteen variants). `Nip44WireReadiness::Placeholder`
names a state `CapabilityReadiness`'s four existing labels have no
accurate match for: real, tested, connected code whose `ciphertext`/`mac`
fields are still an explicit placeholder.

**Guards**: a new
[`test/fedos_core_rust_nip44_wire_nonce_payload.test.ts`](../../test/fedos_core_rust_nip44_wire_nonce_payload.test.ts)
confirms: all three new files stay `pub(crate)`-only,
`unsafe`/`.unwrap(`/`.expect(`/`panic!(`-free; the nonce generator draws
32 bytes via `getrandom::fill` with zero connection to
`fedos_aead_nonce_96`; the payload builder/validator hold the documented
shape; no ChaCha20/HMAC/base64/encode/decode function exists anywhere in
the three files; `crypto::conversation_key`/`crypto::message_key`/
`crypto::hkdf_bridge` are untouched; `capability_matrix`/`diagnostics`
stay unchanged in shape; the two new docs exist and record the real
implementation; and the usual Runtime/Worker/Storage/Federation/
`pub fn`-count/`Cargo.toml`-dependency-count/`package.json`-dependency-count/
no-`serde`-derive checks all still hold.

Public `pub fn` surface unchanged at twenty-seven. No ChaCha20 stream
cipher, no HMAC computation, no encrypt/decrypt connection, no base64, no
wire encode/decode, no `ConversationKey`/`MessageKey`/`crypto::hkdf_bridge`
change, no `CryptoCapability` addition. No Runtime/Worker/Storage/
Federation/Relay/WASM/FFI connection. No TypeScript serialization change.
No new `Cargo.toml` dependency.

## NIP-44 v2 wire crypto completion: ChaCha20 + HMAC-SHA256 + decrypt pipeline (Stage 229–233)

Stage 229–233 land the CRYPTO CORE of the NIP-44 v2 wire-compatible
implementation: a real, byte-exact ChaCha20 stream cipher, real
HMAC-SHA256 authentication, and the complete verify-HMAC →
decrypt-stream → unpad DECRYPT pipeline — vector-verified end-to-end
against `test-vectors/nip44/nip44-v2.json`'s `valid.encrypt_decrypt`
category (all 10 cases). **Still not a full wire implementation**: no
base64 encode/decode, no `invalid.decrypt` wiring, and no encrypt
pipeline exist yet.

**Stage 229–230**:
[`crypto::nip44_stream_cipher`](src/crypto/nip44_stream_cipher.rs) (new)
hand-implements RFC 8439 §2.3–2.4's ChaCha20 block function and
keystream-XOR construction — NO `chacha20` crate adopted (pure `u32`
wrapping-arithmetic needs none). `encrypt_stream_internal`/
`decrypt_stream_internal` take `chacha_key`(32B)/`chacha_nonce`(12B)
only, keystream counter FIXED at `0`. NOT an AEAD — never calls, and is
never called by, `crypto::aead_internal`'s ChaCha20-Poly1305. A new
sibling `#[cfg(test)]`-only
[`nip44_stream_cipher_vectors`](src/crypto/nip44_stream_cipher_vectors.rs)
wires all 10 `valid.encrypt_decrypt` cases — every ChaCha20 ciphertext
byte matches exactly (decoding each vector's base64 `payload` via a
test-fixture-only decoder that adds no `Cargo.toml` dependency and is
never reachable from production code).

**Stage 231**: [`crypto::nip44_hmac`](src/crypto/nip44_hmac.rs) (new)
hand-implements RFC 2104's HMAC construction against this crate's
already-adopted `sha2::Sha256` — NO `hmac` crate adopted.
`compute_hmac_internal`/`verify_hmac_internal` compute/verify
`HMAC-SHA256(hmac_key, nonce ‖ ciphertext)`, using
`subtle::ConstantTimeEq` for the tag comparison — this crate's own
`subtle` dependency (adopted Stage 76 "for a future secret-derived byte
comparison", per `Cargo.toml`'s own comment), finally connected to
exactly that purpose. `verify_hmac_internal` returns only
`Verified`/`AuthenticationFailed` — no more detailed reason.

**Stage 232**:
[`crypto::nip44_wire_decrypt`](src/crypto/nip44_wire_decrypt.rs) (new)
composes the complete pipeline: verify HMAC → decrypt ChaCha20 stream →
unpad (`crypto::nip44_padding`, UNCHANGED), collapsing every reachable
failure into a single fixed `Nip44WireDecryptStatus::AuthenticationFailed`
label (a separate `InvalidConversationKey` covers the structural
precondition of a placeholder/cleared conversation key, checked first).
`decrypt_wire_internal` is the `ConversationKey`-facing entry point;
`decrypt_wire_from_bytes_internal` is the byte-level entry point vector
tests use. A new sibling `#[cfg(test)]`-only
[`nip44_wire_decrypt_vectors`](src/crypto/nip44_wire_decrypt_vectors.rs)
confirms all 10 `valid.encrypt_decrypt` cases decrypt to their exact
documented plaintext, and that a single tampered MAC byte fails every
one of them with `AuthenticationFailed`.

**Stage 233**: `crypto::nip44_wire_diagnostics`'s preview grows from two
rows to four — `WireCrypto` → `Ready` and `WireAuthentication` → `Ready`
join the unchanged `WireNonce` → `Ready`/`WirePayload` → `Placeholder`
rows. No `CryptoCapability` variant added, no existing capability's
meaning changed. New
[`docs/nip44_wire_crypto_completion.md`](../../docs/nip44_wire_crypto_completion.md)
records the full implementation; `docs/nip44_wire_implementation_roadmap.md`
and `docs/nip44_wire_compatibility_gap.md` are updated in place marking
steps 1/3/4/5 IMPLEMENTED while reaffirming the forbidden-phrasing list
still applies until base64/invalid-vectors/an encrypt pipeline also
exist.

**Guards**: a new
[`test/fedos_core_rust_nip44_wire_crypto.test.ts`](../../test/fedos_core_rust_nip44_wire_crypto.test.ts)
confirms: the three new production files stay `pub(crate)`-only and
panic/unsafe-free; ChaCha20 has zero AEAD/`chacha20`-crate connection;
HMAC uses `sha2`/`subtle` only, never a `hmac` crate; the decrypt
pipeline verifies HMAC strictly before decrypting; `capability_matrix`/
`diagnostics`/`conversation_key`/`message_key`/`hkdf_bridge`/
`nip44_padding`/`nip44_wire_nonce`/`nip44_wire_payload` are all
untouched; the two vector files' base64 decoders are `#[cfg(test)]`-only
and never `pub(crate)`; and the usual Runtime/Worker/Storage/Federation/
`pub fn`-count/`Cargo.toml`-dependency-count/`package.json`-dependency-count/
no-`serde`-derive checks all still hold. The pre-existing
[`test/fedos_core_rust_nip44_wire_compatibility.test.ts`](../../test/fedos_core_rust_nip44_wire_compatibility.test.ts)
(Stage 209–213) is updated in place: its forbidden-phrase check now also
scans the four new production files, and its roadmap-content check
accepts the doc's new past-tense wording and "IMPLEMENTED" annotations.

Public `pub fn` surface unchanged at twenty-seven. No AEAD connection, no
encrypt pipeline, no wire payload encode/decode, no production base64, no
`ConversationKey`/`MessageKey`/`crypto::hkdf_bridge`/`crypto::nip44_padding`
change, no `CryptoCapability` addition. No Runtime/Worker/Storage/
Federation/Relay/WASM/FFI connection. No TypeScript serialization change.
No new `Cargo.toml` dependency.
