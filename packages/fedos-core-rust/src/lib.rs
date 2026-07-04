//! FedOS Core — minimal Rust crate skeleton (Stage 69).
//!
//! Placeholder API ONLY. This crate implements NO cryptography: no AEAD, no
//! HKDF/Argon2/KDF, no CSPRNG/random, no NIP-44, no BIP39/BIP32, no zeroize, and
//! no key generation/derivation. Every function returns an `unavailable` /
//! placeholder status and touches no key/seed/plaintext/ciphertext bytes.
//!
//! It exists so a FUTURE, explicitly-reviewed stage can implement the real
//! RustCrypto-backed core BEHIND this shape — but only after passing the crypto
//! test vectors (see `docs/crypto_test_vectors.md`) and shipping a build
//! manifest (see `docs/fedos_core_build_manifest.md`). There is no forbidden
//! (unsafe) code, no FFI, no file/network IO, and no WASM binding here.
//!
//! Mirrors the TypeScript `FedosCoreCrypto` seam
//! (`packages/fedos-core-rust/src/types.ts`) so a real core can eventually drop
//! in without the host depending on any concrete implementation.
//!
//! Stage 75 adds ONE thing beyond the above: a test-only module (gated
//! `cfg(test)`, at the bottom of this file) that reads an official RFC 8439
//! AEAD known-answer vector file and asserts Stage 74's AEAD dependency
//! reproduces its expected bytes under `cargo test`. That module is
//! verification plumbing only — it is compiled only for `cargo test`, is not
//! compiled into the library's public API, and does not change any function
//! above. (Its own doc comment, just above its declaration, names the
//! specific dependency and vector file — kept out of this crate-level doc so
//! this production-facing summary stays free of any AEAD crate name.)
//!
//! Stage 77 adds a second test-only module of the same shape, verifying
//! Stage 76's KDF dependency against an official RFC 5869 HKDF known-answer
//! vector file. Same rules apply: `cfg(test)` only, no public API change.
//!
//! Stage 79 adds a crate-private `secret_handle` module (below, still ahead
//! of this file's first module gated `cfg(test)`): an INTERNAL-ONLY
//! `SecretHandle` skeleton, the first code in this crate to actually import
//! and use the `zeroize`/`secrecy` dependencies adopted Stage 78 — but only
//! against a fixed, non-secret placeholder marker. It is not part of the
//! public API (nothing below is `pub`, nothing is re-exported), holds no
//! real key/seed/plaintext/ciphertext/passphrase byte, and none of the six
//! functions above constructs, holds, or returns one.
//!
//! Stage 80 adds a second crate-private module, `aead_core`, of the same
//! shape: an INTERNAL-ONLY AEAD request skeleton (labels and a non-sensitive
//! status only — no key, nonce, plaintext, ciphertext, or tag byte, and its
//! production code imports no AEAD cipher crate — same reason that crate
//! name is kept out of this summary, see the note above). Same rules apply:
//! not part of the public API, no public function above constructs, holds,
//! or returns one of its types.
//!
//! Stage 81 is a test-only refactor of the Stage 75 module: the seal/open
//! logic that used to be written inline in its two vector tests is now two
//! small, private, test-only helper functions inside that same module
//! (their own doc comments, next to their declarations, name them). No
//! production code changed — the six functions above are untouched, and the
//! Stage 80 skeleton is not connected to this refactor.
//!
//! Stage 82 adds a third crate-private module, `kdf_core`, of the same
//! shape as `aead_core`: an INTERNAL-ONLY KDF request skeleton (labels and a
//! non-sensitive status only — no IKM, salt, info, PRK, or OKM byte, and its
//! production code imports no KDF/digest crate — same reason those crate
//! names are kept out of this summary, see the note above). Same rules
//! apply: not part of the public API, no public function above constructs,
//! holds, or returns one of its types.
//!
//! Stage 83 is a test-only refactor of the Stage 77 module — the KDF-side
//! analogue of Stage 81's AEAD-side refactor: the extract/expand logic that
//! used to be written inline in its two vector tests is now three small,
//! private, test-only helper functions inside that same module (their own
//! doc comments, next to their declarations, name them). No production code
//! changed — the six functions above are untouched, and the Stage 82
//! skeleton is not connected to this refactor.
//!
//! Stage 85 adds a third test-only module of the same shape as Stage 75/77,
//! verifying Stage 84's Argon2id dependency against an official RFC 9106
//! known-answer vector file. Same rules apply: `cfg(test)` only, no public
//! API change.
//!
//! Stage 86 is a test-only refactor of the Stage 85 module — the
//! Argon2id-side analogue of Stage 81/83's refactors: the derivation logic
//! that used to be written as a per-vector helper is now one small,
//! private, test-only helper function taking raw bytes (its own doc
//! comment, next to its declaration, names it). No production code
//! changed — the six functions above are untouched, and the Stage 82
//! skeleton is not connected to this refactor.
//!
//! Stage 87 adds a fourth crate-private module, `key_material`, reusing
//! `secret_handle`'s (Stage 79) exact placeholder-only pattern: an
//! INTERNAL-ONLY key-material handle skeleton (labels and a non-sensitive
//! status only — no key, seed, plaintext, ciphertext, passphrase, or nonce
//! byte). It exists as a future AEAD/KDF connection point, still not
//! connected to `secret_handle`, `aead_core`, or `kdf_core` today. Same
//! rules apply: not part of the public API, no public function above
//! constructs, holds, or returns one of its types.
//!
//! Stage 88 adds a fifth crate-private module, `domain_label`: an
//! INTERNAL-ONLY domain-separation-label skeleton holding only a fixed,
//! non-secret, `&'static str` label per named future connection point
//! (never a user-, environment-, or config-derived string, and never a
//! `String`/`Vec<u8>` field). It exists in preparation for a future HKDF/
//! AEAD/NIP-44/Nostr-key-derivation connection, still not connected to
//! `secret_handle`, `aead_core`, `kdf_core`, or `key_material` today. Same
//! rules apply: not part of the public API, no public function above
//! constructs, holds, or returns one of its types.
//!
//! Stage 89 adds a sixth crate-private module, `operation_context`: an
//! INTERNAL-ONLY operation-context skeleton naming a future AEAD/KDF/
//! Argon2/NIP-44/Nostr-key-derivation operation (a label and a
//! non-sensitive status only — no key, seed, plaintext, ciphertext,
//! passphrase, or nonce byte, and no `String`/`Vec` field). It exists as a
//! type basis for a future real operation, still not connected to
//! `secret_handle`, `aead_core`, `kdf_core`, `key_material`, or
//! `domain_label` today. Same rules apply: not part of the public API, no
//! public function above constructs, holds, or returns one of its types.
//!
//! Stage 90 adds a seventh crate-private module, `request_descriptor`: an
//! INTERNAL-ONLY request-descriptor skeleton naming a future AEAD/KDF/
//! Argon2/NIP-44/Nostr-key-derivation operation REQUEST (a label and a
//! non-sensitive status only — no key, seed, plaintext, ciphertext,
//! passphrase, or nonce byte, and no `String`/`Vec` field). It exists as a
//! non-sensitive-metadata type basis for a future real request, still not
//! connected to `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
//! `domain_label`, or `operation_context` today. Same rules apply: not part
//! of the public API, no public function above constructs, holds, or
//! returns one of its types.
//!
//! Stage 91 adds an eighth crate-private module, `response_descriptor`: an
//! INTERNAL-ONLY response-descriptor skeleton naming a future AEAD/KDF/
//! Argon2/NIP-44/Nostr-key-derivation operation RESULT (a label and a
//! non-sensitive status only — no key, seed, plaintext, ciphertext,
//! passphrase, tag, or nonce byte, and no `String`/`Vec` field, no result
//! payload of any kind). It exists as a non-sensitive-metadata type basis
//! for a future real response, still not connected to `secret_handle`,
//! `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, or `request_descriptor` today. Same rules apply:
//! not part of the public API, no public function above constructs, holds,
//! or returns one of its types.
//!
//! Stage 92 adds a ninth crate-private module, `crypto_pipeline`: an
//! INTERNAL-ONLY crypto-pipeline skeleton naming a future AEAD/KDF/Argon2/
//! NIP-44/Nostr-key-derivation PIPELINE that would eventually bundle the
//! descriptor/context/label/key-material skeletons above (a label and a
//! non-sensitive status only — no key, seed, plaintext, ciphertext,
//! passphrase, tag, or nonce byte, and no `String`/`Vec` field). It exists
//! as a type basis for a future real pipeline, still not connected to
//! `secret_handle`, `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, `request_descriptor`, or `response_descriptor`
//! today. Same rules apply: not part of the public API, no public function
//! above constructs, holds, or returns one of its types.
//!
//! Stage 93 adds a tenth crate-private module, `descriptor_bundle`: an
//! INTERNAL-ONLY descriptor-bundle skeleton naming a future AEAD/KDF/
//! Argon2/NIP-44/Nostr-key-derivation BUNDLE that would eventually group
//! the descriptor/context/label/key-material skeletons above (a label and
//! a non-sensitive status only — no key, seed, plaintext, ciphertext,
//! passphrase, tag, or nonce byte, and no `String`/`Vec` field). It exists
//! as a fully independent, label-only type basis for a future real bundle,
//! still not connected to — and not holding an instance of —
//! `secret_handle`, `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, `request_descriptor`, `response_descriptor`, or
//! `crypto_pipeline` today. Same rules apply: not part of the public API,
//! no public function above constructs, holds, or returns one of its
//! types.
//!
//! Stage 94 adds an eleventh crate-private module, `execution_plan`: an
//! INTERNAL-ONLY execution-plan skeleton naming a future AEAD/KDF/Argon2/
//! NIP-44/Nostr-key-derivation processing ORDER, as fixed, non-sensitive
//! plan/step labels only — no key, seed, plaintext, ciphertext, passphrase,
//! tag, or nonce byte, and no `String`/`Vec` field. It exists as a fully
//! independent, label-only type basis for a future real plan, still not
//! connected to — and not holding an instance of — `secret_handle`,
//! `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, `request_descriptor`, `response_descriptor`,
//! `crypto_pipeline`, or `descriptor_bundle` today. Same rules apply: not
//! part of the public API, no public function above constructs, holds, or
//! returns one of its types.
//!
//! Stage 95 adds a twelfth crate-private module, `error_taxonomy`: an
//! INTERNAL-ONLY error-taxonomy skeleton classifying a future AEAD/KDF/
//! Argon2/NIP-44/Nostr-key-derivation operation FAILURE, as a fixed,
//! non-sensitive label only — no error message, no source error, no stack
//! trace, and no `String`/`Vec` field. It exists as a fully independent,
//! label-only type basis for a future real error type, still not
//! connected to — and not holding an instance of — `secret_handle`,
//! `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, `request_descriptor`, `response_descriptor`,
//! `crypto_pipeline`, `descriptor_bundle`, or `execution_plan` today. Same
//! rules apply: not part of the public API, no public function above
//! constructs, holds, or returns one of its types.
//!
//! Stage 96 adds a thirteenth crate-private module, `audit_event`: an
//! INTERNAL-ONLY audit-event-label skeleton naming a future crypto-internal
//! state change (a fixed, non-sensitive label only — no event payload, no
//! log output, and no `String`/`Vec` field). It exists as a fully
//! independent, label-only type basis for a future real observability
//! mechanism, still not connected to — and not holding an instance of —
//! `secret_handle`, `aead_core`, `kdf_core`, `key_material`, `domain_label`,
//! `operation_context`, `request_descriptor`, `response_descriptor`,
//! `crypto_pipeline`, `descriptor_bundle`, `execution_plan`, or
//! `error_taxonomy` today. Same rules apply: not part of the public API,
//! no public function above constructs, holds, or returns one of its
//! types.
//!
//! Stage 97 adds a fourteenth crate-private module, `audit_policy`: an
//! INTERNAL-ONLY audit-policy skeleton naming a future decision of which
//! kind of observation would be permitted (a fixed, non-sensitive label
//! and a fixed allow/deny label only — no event payload, no log output,
//! and no `String`/`Vec` field). It exists as a fully independent,
//! label-only type basis for a future real policy check, still not
//! connected to — and not holding an instance of — any other module in
//! this crate today. Same rules apply: not part of the public API, no
//! public function above constructs, holds, or returns one of its types.
//!
//! Stage 98 adds a fifteenth crate-private module, `lifecycle_state`: an
//! INTERNAL-ONLY lifecycle-state skeleton naming a future coarse state
//! transition for a crypto-provider/request/secret/audit/pipeline
//! lifecycle (fixed, non-sensitive labels only — no timestamp, no
//! counter, no error text, no log output, and no `String`/`Vec` field).
//! It exists as a fully independent, label-only type basis for a future
//! real lifecycle tracker, still not connected to — and not holding an
//! instance of — any other module in this crate today. Same rules apply:
//! not part of the public API, no public function above constructs,
//! holds, or returns one of its types.
//!
//! Stage 99 adds a sixteenth crate-private module, `module_registry`: an
//! INTERNAL-ONLY module-registry skeleton that ENUMERATES, by fixed label
//! only, every crate-private skeleton module added since Stage 79 — never
//! constructing, holding, or referencing an instance of any of them, and
//! never using a `Vec`/`HashMap`/`BTreeMap`/slice/static array/reflection/
//! macro-registry mechanism to do so. It exists purely to document and
//! fix, in one place, which internal skeletons exist today; it is not
//! connected to the Runtime, the Worker, or `CryptoProvider`, and holds
//! no `String`/`Vec` field, no payload, no timestamp, and no counter.
//! Same rules apply: not part of the public API, no public function
//! above constructs, holds, or returns one of its types.
//!
//! Stage 101 adds a THIRD test-only module of the same shape as Stage
//! 75/77/85: a `cfg(test)`-only module (at the bottom of this file) that
//! reads an official NIST-sourced AEAD known-answer vector file and
//! asserts a SECOND AEAD dependency (also adopted this Stage) reproduces
//! its expected bytes under `cargo test` — with its seal/open helper
//! extracted from the start, mirroring the byte-level shape Stage 81/83/86
//! already established for the other two AEAD/KDF vector modules. Same
//! rules apply: `cfg(test)` only, no public API change, production code
//! still does not import this Stage's AEAD dependency anywhere, and the
//! crate-private `aead_core` skeleton (Stage 80) remains placeholder-only
//! and unconnected to it. (Its own doc comment, just above its
//! declaration, names the specific dependency and vector file — kept out
//! of this crate-level doc so this production-facing summary stays free
//! of any AEAD crate/algorithm name, same reasoning the Stage 75 note
//! above already states.)
//!
//! Stage 102 adds this crate's first new PUBLIC items since Stage 69: a
//! small group of label-only types (below, just ahead of the Stage 79
//! module) fixing the shape of a FUTURE public crypto-API boundary, plus
//! one new public function, `fedos_crypto_boundary_status`, that returns
//! a fixed, permanently `Unavailable` status the same way
//! `fedos_core_status` already does. None of it performs, or is wired
//! toward performing, an AEAD, KDF, or NIP-44 operation, a random-byte
//! draw, or a key derivation — no such operation is implemented by this
//! crate. The six functions from Stage 69 are unchanged. See
//! `docs/fedos_core_public_api_design.md` for the full design record this
//! boundary follows and the roadmap for implementing behind it later.
//!
//! Stage 103 consolidates ten more label-only PUBLIC types onto the same
//! boundary (below, right after Stage 102's group, still ahead of the
//! Stage 79 module): five independent operation-boundary status types
//! (`FedosRandomBoundary`, `FedosNonceBoundary`,
//! `FedosKeyGenerationBoundary`, `FedosKeyImportBoundary`,
//! `FedosKeyExportBoundary`, each with its own `fedos_*_boundary_status`
//! function) and five descriptor/metadata types
//! (`FedosCapabilityDescriptor`, `FedosAlgorithmDescriptor`,
//! `FedosBoundaryVersion`, `FedosBoundaryFeature`, `FedosBoundaryPolicy`,
//! each with its own accessor function). None of the ten new functions
//! generates a random byte, a nonce, or a key, or performs any AEAD, KDF,
//! or NIP-44 operation — every one returns a fixed, non-sensitive label or
//! status. The sixteen functions from Stage 69/102 are unchanged. See
//! `docs/public_random_boundary.md`, `docs/public_key_boundary.md`, and
//! `docs/public_boundary_versioning.md` for the design records this
//! consolidation follows.
//!
//! Stage 104 adopts a SEVENTH production dependency, `getrandom` — this
//! crate's first CSPRNG entropy source — as a dependency + build-check
//! ADOPTION ONLY, exactly like every prior first-adoption stage: it is
//! not imported or referenced anywhere in this file, production or test.
//! A fourth test-only module of the same `cfg(test)` shape as the ones
//! above (at the bottom of this file), `csprng_verification_infrastructure`,
//! fixes — as a label enumeration only — which categories a FUTURE,
//! separately-reviewed wiring stage would need to verify; unlike the
//! AEAD/KDF vector modules above, it does not call `getrandom` at all,
//! since randomness has no known-answer vector to reproduce. The
//! seventeen functions from Stage 69/102/103 are unchanged;
//! `Cargo.toml`'s public surface implications are zero (no new type, no
//! new function beyond what Stage 103 already added). See
//! `docs/public_random_design.md` for the full design record.
//!
//! Stage 105 adds one more label-only PUBLIC group (below, right after
//! Stage 103's group, still ahead of the Stage 79 module):
//! `FedosKeyFormatLabel` — the key-format planning-label enumeration
//! `docs/public_key_provisioning.md` section 6 deferred — plus
//! `FedosKeyFormatState`, `FedosKeyFormatStatus`,
//! `FedosKeyFormatDescriptor`, and one new function,
//! `fedos_key_format_descriptor_placeholder`, which returns a fixed
//! sentinel descriptor. No raw key byte, parser, validator, or
//! serialization format is added; `Cargo.toml` is untouched; no CSPRNG
//! entropy source is consulted. The seventeen functions from Stage
//! 69/102/103/104 are unchanged. See `docs/public_key_provisioning.md`
//! for the full design record this addition follows.
//!
//! Stage 106 adds two more label-only PUBLIC groups (below, right after
//! Stage 105's group, still ahead of the Stage 79 module):
//! `FedosKeyUsageLabel` (eight variants — separating "what is this key
//! for" from Stage 105's "what format is this key") plus
//! `FedosKeyUsageState`/`FedosKeyUsageStatus`/`FedosKeyUsageDescriptor`
//! and one new function, `fedos_key_usage_descriptor_placeholder`; and
//! `FedosAlgorithmRequirement`/`FedosAlgorithmCapability`/
//! `FedosAlgorithmPolicy` (fixed relational label tables over Stage
//! 102's four algorithm candidates) plus three new functions,
//! `fedos_algorithm_requirements`, `fedos_algorithm_capabilities`, and
//! `fedos_algorithm_policy_decision`. No raw key byte, parser,
//! validator, or enforced authorization rule is added anywhere;
//! `Cargo.toml` is untouched; no CSPRNG entropy source is consulted. The
//! eighteen functions from Stage 69/102/103/104/105 are unchanged. See
//! `docs/public_key_usage.md` and `docs/public_algorithm_policy.md` for
//! the full design records.
//!
//! Stage 137 adds this crate's FIRST real implementation: `fedos_random_bytes_32`
//! (below, right after Stage 106's group, still ahead of the Stage 79
//! module) draws exactly 32 bytes from the OS's CSPRNG — the first time
//! the already-adopted `getrandom` dependency (Stage 104, build-check
//! only until now) is actually imported and called anywhere in this
//! crate, production or test. (Its own doc comment, just above its
//! declaration, names the exact call — kept out of this crate-level doc
//! so this production-facing summary stays free of the exact code path,
//! same reasoning the Stage 75/101 notes above already state for their
//! AEAD dependencies.) `FedosRandomBytesLength` (one variant, `ThirtyTwo`),
//! `FedosRandomBytesState` (`Ready` / `EntropySourceUnavailable`), and
//! `FedosRandomBytesDecision` (`length`/`state`/`bytes: Option<[u8; 32]>`)
//! round out the group — the crate's public `pub fn` surface grows from
//! twenty-two (Stage 106) to twenty-three. The output length is fixed and
//! label-selected, never an open caller-supplied count, so there is no
//! zero-length request; a CSPRNG failure returns `EntropySourceUnavailable`
//! with `bytes: None` — no fallback PRNG, no degraded output, and no
//! panic. This is general-purpose randomness ONLY: no nonce generation, no
//! key generation, no key derivation, and no AEAD/KDF/NIP-44 operation is
//! added or connected — `random_bytes_placeholder` (Stage 69),
//! `fedos_random_boundary_status`/`FedosRandomBoundary` (Stage 103),
//! `SecretHandle` (Stage 79), `aead_core` (Stage 80), and `kdf_core`
//! (Stage 82) are all UNCHANGED and unconnected to this addition.
//! `Cargo.toml` is untouched (no dependency change — `getrandom` was
//! already adopted Stage 104). Nothing is wired into the Runtime, the
//! Worker, or a crypto provider; no WASM binding exists. See
//! `docs/random_bytes_implementation_plan.md`,
//! `docs/nonce_generation_policy.md`, and
//! `docs/secret_lifecycle_implementation_plan.md` for the full design
//! records this addition follows (and deliberately does not yet build
//! against).
//!
//! Stage 138 adds a second real function, `fedos_aead_nonce_96` (below,
//! right after `fedos_random_bytes_32`, still ahead of the Stage 79
//! module): draws exactly 12 bytes (96 bits) from the OS's CSPRNG, the
//! shared nonce size of this crate's two adopted AEAD candidates
//! (ChaCha20-Poly1305, AES-256-GCM). It is a standalone nonce-drawing
//! helper, independent of `fedos_random_bytes_32` and not implemented by
//! calling it, and does not call — and is not called by — any encrypt/
//! decrypt/AEAD function. `FedosAeadNonceKind` (one variant,
//! `NinetySixBit`), `FedosNonceState` (`Ready` /
//! `EntropySourceUnavailable`), and `FedosAeadNonceDecision`
//! (`kind`/`state`/`nonce: Option<[u8; 12]>`) round out the group — the
//! crate's public `pub fn` surface grows from twenty-three (Stage 137) to
//! twenty-four. Same shape as Stage 137 throughout: a fixed,
//! label-selected size, no zero-length or caller-supplied count, no
//! fallback PRNG, no panic on CSPRNG failure. The nonce is never
//! deterministic, never a counter, and never derived from a seed,
//! password, or user input — see `docs/nonce_generation_policy.md`
//! (Stage 134) for the policy this stage implements against.
//! `encrypt_placeholder`/`decrypt_placeholder` (Stage 69), `aead_core`
//! (Stage 80), `kdf_core` (Stage 82), and `SecretHandle` (Stage 79)
//! remain UNCHANGED and unconnected. `Cargo.toml` is untouched; nothing is
//! wired into the Runtime, the Worker, or a crypto provider; no WASM
//! binding exists.
//!
//! Stage 144–146 extends the Stage 79 `secret_handle` module to hold its
//! FIRST real secret bytes: `SecretHandle::new_from_32_bytes_for_internal_use`
//! accepts an already-drawn, fixed-size `[u8; 32]` (never a slice, `Vec<u8>`,
//! or `String`) plus a non-sensitive `SecretHandleKind` classification label,
//! wraps it in its own `secrecy::SecretBox`, and transitions the handle to a
//! new `SecretHandleState::Holding` state. `new_placeholder()` (Stage 79) is
//! unchanged and still works standalone. `SecretHandle` remains
//! `pub(crate)`-at-most, gains no `pub` export, and this crate's public
//! `pub fn` surface is unchanged (still twenty-four functions). It still
//! does NOT call `fedos_random_bytes_32` or `fedos_aead_nonce_96` itself, and
//! is still NOT connected to `aead_core` (Stage 80) or `kdf_core` (Stage 82)
//! — HKDF and AEAD each connect in their own future, separate stage, per
//! `docs/secret_lifecycle_implementation_plan.md` section 9. See that
//! document, `docs/secret_handle_api_shape.md`, and
//! `docs/secret_memory_test_strategy.md` for the full design/test records
//! this addition builds against.
//!
//! Stage 147 gives `kdf_core` (Stage 82) its first REAL implementation:
//! `derive_secret_handle_internal` derives a NEW
//! `SecretHandle(HkdfOutputMaterial)` from an existing
//! `SecretHandle(HkdfInputMaterial)` via HKDF-SHA256 (RFC 5869, the `hkdf`
//! dependency adopted Stage 76), using a fixed, `HkdfDomain`-selected
//! salt/info — never a caller-supplied or randomly-drawn byte. `sha2` is
//! PROMOTED from `[dev-dependencies]` to `[dependencies]` this stage (the
//! only `Cargo.toml` change) since production code now needs a concrete
//! hash algorithm for HKDF-SHA256. `SecretHandle` gains one
//! new, narrowly-scoped `pub(crate)` accessor,
//! `expose_bytes_for_internal_derivation`, confined to this one reviewed
//! call site — still no public raw-byte accessor, still `pub(crate)`-at-
//! most throughout, still twenty-four `pub fn`s. This module does NOT call
//! `fedos_random_bytes_32`/`fedos_aead_nonce_96`, does NOT connect to
//! `aead_core` (Stage 80), does NOT implement `encrypt`/`decrypt`/NIP-44,
//! and is NOT wired into the Runtime/Worker/WASM — each remains its own
//! future, separate stage. See `docs/hkdf_internal_plan.md` (Stage 147–149,
//! including the AEAD staging preparation notes for the future AEAD
//! connection) for the full design record.
//!
//! Stage 150–151 add a crate-private `crypto` module (`src/crypto.rs` +
//! `src/crypto/capability_matrix.rs` + `src/crypto/diagnostics.rs`): a fixed
//! `CryptoCapability` label enumeration (Random/Nonce/SecretHandle/HKDF/
//! AEAD/NIP-44/Schnorr/StorageKey/ConversationKey) and a fixed, hand-
//! maintained `crypto_diagnostics_preview()` snapshot reporting each
//! capability's `CapabilityReadiness` (`Ready`/`NotConnected`/
//! `NotImplemented`) — display-only, non-secret, `pub(crate)`-at-most, not
//! wired into the Runtime/Worker/WASM, and adding no `pub fn`. See
//! `docs/crypto_capability_matrix.md` and `docs/crypto_diagnostics.md`.

#![forbid(unsafe_code)]

mod crypto;

/// Coarse observable state of the core. No secret is exposed at any state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosCoreState {
    /// No real core is present (the safe default).
    Unavailable,
    /// A placeholder result: a label of intent only — runs no cryptography.
    Placeholder,
}

/// A non-sensitive snapshot of the core. `reason` is a fixed, human-readable
/// label and never contains a secret, key, seed, plaintext, or ciphertext.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosCoreStatus {
    pub state: FedosCoreState,
    pub reason: &'static str,
}

/// Placeholder capability labels — intent only. None is implemented or safe.
/// The string values match the TypeScript `FedosCoreCapability` union.
const FEDOS_CORE_CAPABILITIES: &[&str] = &[
    "aead_placeholder",
    "kdf_placeholder",
    "random_placeholder",
    "nip44_placeholder",
    "rust_core_placeholder",
];

/// Current status: permanently `Unavailable` in this skeleton.
pub fn fedos_core_status() -> FedosCoreStatus {
    FedosCoreStatus {
        state: FedosCoreState::Unavailable,
        reason: "no FedOS Rust crypto core is implemented (skeleton only)",
    }
}

/// The placeholder capability labels this skeleton advertises (intent only).
pub fn fedos_core_capabilities() -> &'static [&'static str] {
    FEDOS_CORE_CAPABILITIES
}

/// Placeholder: generates NO random bytes.
pub fn random_bytes_placeholder() -> FedosCoreStatus {
    placeholder_status()
}

/// Placeholder: derives NO key.
pub fn derive_key_placeholder() -> FedosCoreStatus {
    placeholder_status()
}

/// Placeholder: encrypts NOTHING.
pub fn encrypt_placeholder() -> FedosCoreStatus {
    placeholder_status()
}

/// Placeholder: decrypts NOTHING.
pub fn decrypt_placeholder() -> FedosCoreStatus {
    placeholder_status()
}

/// Build a placeholder status. Reads nothing, computes nothing, stores nothing.
fn placeholder_status() -> FedosCoreStatus {
    FedosCoreStatus {
        state: FedosCoreState::Placeholder,
        reason: "placeholder only (no cryptography performed)",
    }
}

/// Stage 102 — a PUBLIC crypto-API placeholder boundary.
///
/// This is NOT a real `encrypt`/`decrypt`/`deriveKey`/`randomBytes`
/// implementation: every type below is a non-sensitive LABEL only (an
/// intended future operation/algorithm/state), and the one new function
/// this stage adds, [`fedos_crypto_boundary_status`], returns a fixed,
/// permanently `Unavailable` status — exactly like [`fedos_core_status`]
/// above. It exists to fix, in the type system, the shape of the public
/// boundary a FUTURE, explicitly-reviewed stage would implement behind —
/// see `docs/fedos_core_public_api_design.md` for the full design record
/// this boundary follows. Nothing here runs an AEAD, KDF, or NIP-44
/// operation, generates a random byte, or derives a key — the existing
/// six placeholder functions above (`random_bytes_placeholder`,
/// `derive_key_placeholder`, `encrypt_placeholder`, `decrypt_placeholder`,
/// plus the two status/capability functions) are UNCHANGED by this
/// stage; this boundary is additive only.
///
/// Every type below holds ONLY fixed enum labels — no borrowed byte
/// slice, growable byte vector, or owned string field or parameter
/// anywhere, no key/seed/plaintext/ciphertext/passphrase/nonce/tag byte,
/// and no field of any internal skeleton type from any module below.
/// Nothing here is wired into the Runtime, the Worker, or a crypto
/// provider; no WASM binding exists.

/// A future cryptographic operation this boundary would eventually
/// perform — a label of intent only, not an implementation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosCryptoOperation {
    /// Intended future connection point: an AEAD encrypt operation.
    Encrypt,
    /// Intended future connection point: an AEAD decrypt operation.
    Decrypt,
    /// Intended future connection point: a KDF key-derivation operation.
    DeriveKey,
    /// Intended future connection point: a CSPRNG random-byte operation.
    RandomBytes,
}

/// A future cryptographic algorithm this boundary would eventually use —
/// a label of intent only, not an implementation. Named after the
/// dependencies already verified against their official test vectors
/// under `cargo test` (see `docs/fedos_core_public_api_design.md`,
/// sections 5 and 6).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosCryptoAlgorithm {
    /// AEAD candidate, verified against official RFC 8439 vectors under
    /// `cfg(test)`; not yet implemented for any public function.
    ChaCha20Poly1305,
    /// AEAD candidate, verified against official NIST CAVP vectors under
    /// `cfg(test)`; not yet implemented for any public function.
    Aes256Gcm,
    /// KDF candidate, verified against official RFC 5869 vectors under
    /// `cfg(test)`; not yet implemented for any public function.
    HkdfSha256,
    /// KDF candidate, verified against official RFC 9106 vectors under
    /// `cfg(test)`; not yet implemented for any public function.
    Argon2id,
}

/// Coarse observable state of the public crypto-API boundary. No secret is
/// exposed at any state — same shape as [`FedosCoreState`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosCryptoBoundaryState {
    /// No real public crypto API is implemented (the safe default).
    Unavailable,
    /// A placeholder result: a label of intent only — runs no cryptography.
    Placeholder,
}

/// A non-sensitive status snapshot for the public crypto-API boundary.
/// Never contains a key/seed/plaintext/ciphertext/passphrase/nonce byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosCryptoBoundaryStatus {
    pub state: FedosCryptoBoundaryState,
}

/// A non-sensitive, label-only description of a future crypto-operation
/// request this boundary would eventually accept — never a real
/// key/seed/plaintext/passphrase/nonce byte. See
/// `docs/fedos_core_public_api_design.md`, sections 3 and 4, for why real
/// input will always be an opaque handle or reference, never a raw byte
/// parameter, on this boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosCryptoRequestDescriptor {
    pub operation: FedosCryptoOperation,
    pub algorithm: FedosCryptoAlgorithm,
}

/// A non-sensitive, label-only description of a future crypto-operation
/// result this boundary would eventually return — never a real
/// ciphertext, plaintext, derived-key byte, error text, or stack trace.
/// See `docs/fedos_core_public_api_design.md`, section 8, for the fixed
/// error taxonomy this boundary would eventually use instead of raw
/// error text.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosCryptoResponseDescriptor {
    pub operation: FedosCryptoOperation,
    pub algorithm: FedosCryptoAlgorithm,
    pub state: FedosCryptoBoundaryState,
}

/// Current status of the public crypto-API boundary: permanently
/// `Unavailable` in this stage — exactly like [`fedos_core_status`] above.
/// Reads nothing, computes nothing, stores nothing.
pub fn fedos_crypto_boundary_status() -> FedosCryptoBoundaryStatus {
    FedosCryptoBoundaryStatus {
        state: FedosCryptoBoundaryState::Unavailable,
    }
}

/// Stage 103 — consolidated placeholder API boundary additions.
///
/// Ten more label-only, PUBLIC placeholder types (five operation-boundary
/// status groups plus five descriptor/metadata groups), completing as
/// much of the public-API boundary's design as is possible before any
/// real cryptography, random generation, or key handling is implemented.
/// Every item below follows the exact non-sensitive-label shape Stage
/// 102's `FedosCrypto*` group established: no borrowed byte slice,
/// growable byte vector, or owned string field or parameter anywhere, no
/// key/seed/plaintext/ciphertext/passphrase/nonce/tag byte, and no field
/// of any internal skeleton type from any module below. Nothing here is
/// wired into the host's execution environment, its background worker, or
/// a crypto provider; no WASM binding exists; no random number is
/// generated; no key is produced, imported, or exported. See
/// `docs/public_random_boundary.md`,
/// `docs/public_key_boundary.md`, and `docs/public_boundary_versioning.md`
/// for the design records these types follow.
///
/// The five operation-boundary groups below
/// (`FedosRandomBoundary`/`FedosNonceBoundary`/`FedosKeyGenerationBoundary`/
/// `FedosKeyImportBoundary`/`FedosKeyExportBoundary`) each get their OWN
/// independent state enum rather than sharing one generic status across
/// unrelated future operations — the same "each future operation gets its
/// own type" choice Stage 102 already made for
/// `FedosCryptoBoundaryStatus`. The five descriptor/metadata groups below
/// (`FedosCapabilityDescriptor`/`FedosAlgorithmDescriptor`/
/// `FedosBoundaryVersion`/`FedosBoundaryFeature`/`FedosBoundaryPolicy`), by
/// contrast, DELIBERATELY reuse Stage 102's `FedosCryptoBoundaryState` and
/// `FedosCryptoAlgorithm` labels where they describe the same boundary
/// Stage 102 already fixed — an explicit, direct reuse of an
/// already-fixed label vocabulary, not a guess at an ambiguous future
/// design, so it does not fall under this crate's usual "leave
/// unconnected" convention for internal skeletons.

/// Coarse observable state of the random-generation boundary. No random
/// byte is generated at any state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosRandomBoundaryState {
    Unavailable,
    Placeholder,
}

/// A non-sensitive status snapshot for the random-generation boundary.
/// Never contains a generated byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosRandomBoundary {
    pub state: FedosRandomBoundaryState,
}

/// Current status of the random-generation boundary: permanently
/// `Unavailable` in this stage. Reads nothing, computes nothing, generates
/// nothing.
pub fn fedos_random_boundary_status() -> FedosRandomBoundary {
    FedosRandomBoundary {
        state: FedosRandomBoundaryState::Unavailable,
    }
}

/// Coarse observable state of the nonce-generation boundary — kept
/// separate from [`FedosRandomBoundaryState`] per
/// `docs/fedos_core_public_api_design.md` section 7 (nonce/random
/// generation is its own design boundary, not a detail folded into an
/// AEAD or general-random design). No nonce byte is generated at any
/// state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosNonceBoundaryState {
    Unavailable,
    Placeholder,
}

/// A non-sensitive status snapshot for the nonce-generation boundary.
/// Never contains a generated byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosNonceBoundary {
    pub state: FedosNonceBoundaryState,
}

/// Current status of the nonce-generation boundary: permanently
/// `Unavailable` in this stage. Reads nothing, computes nothing, generates
/// nothing.
pub fn fedos_nonce_boundary_status() -> FedosNonceBoundary {
    FedosNonceBoundary {
        state: FedosNonceBoundaryState::Unavailable,
    }
}

/// Coarse observable state of the key-generation boundary. No key is
/// generated at any state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosKeyGenerationBoundaryState {
    Unavailable,
    Placeholder,
}

/// A non-sensitive status snapshot for the key-generation boundary. Never
/// contains a generated key byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosKeyGenerationBoundary {
    pub state: FedosKeyGenerationBoundaryState,
}

/// Current status of the key-generation boundary: permanently
/// `Unavailable` in this stage. Reads nothing, computes nothing, generates
/// nothing.
pub fn fedos_key_generation_boundary_status() -> FedosKeyGenerationBoundary {
    FedosKeyGenerationBoundary {
        state: FedosKeyGenerationBoundaryState::Unavailable,
    }
}

/// Coarse observable state of the key-import boundary. No key is accepted
/// or imported at any state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosKeyImportBoundaryState {
    Unavailable,
    Placeholder,
}

/// A non-sensitive status snapshot for the key-import boundary. Never
/// contains an imported key byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosKeyImportBoundary {
    pub state: FedosKeyImportBoundaryState,
}

/// Current status of the key-import boundary: permanently `Unavailable`
/// in this stage. Reads nothing, computes nothing, imports nothing.
pub fn fedos_key_import_boundary_status() -> FedosKeyImportBoundary {
    FedosKeyImportBoundary {
        state: FedosKeyImportBoundaryState::Unavailable,
    }
}

/// Coarse observable state of the key-export boundary. No key is exposed
/// or exported at any state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosKeyExportBoundaryState {
    Unavailable,
    Placeholder,
}

/// A non-sensitive status snapshot for the key-export boundary. Never
/// contains an exported key byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosKeyExportBoundary {
    pub state: FedosKeyExportBoundaryState,
}

/// Current status of the key-export boundary: permanently `Unavailable`
/// in this stage. Reads nothing, computes nothing, exports nothing.
pub fn fedos_key_export_boundary_status() -> FedosKeyExportBoundary {
    FedosKeyExportBoundary {
        state: FedosKeyExportBoundaryState::Unavailable,
    }
}

/// A capability KIND this crate's public boundary may (in the future)
/// support — a label only. Distinct from `FEDOS_CORE_CAPABILITIES` above
/// (a flat `&'static str` list from Stage 69): this is a typed
/// enumeration covering the same original placeholder capabilities plus
/// the boundary groups added Stage 102/103.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosCapabilityKind {
    AeadPlaceholder,
    KdfPlaceholder,
    RandomPlaceholder,
    NoncePlaceholder,
    KeyGenerationPlaceholder,
    KeyImportPlaceholder,
    KeyExportPlaceholder,
    Nip44Placeholder,
}

/// A non-sensitive descriptor pairing one [`FedosCapabilityKind`] with its
/// current boundary state (reusing Stage 102's [`FedosCryptoBoundaryState`]
/// — see this section's own opening note on why that reuse is direct, not
/// a guess). Never contains a key/seed/plaintext/ciphertext byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosCapabilityDescriptor {
    pub kind: FedosCapabilityKind,
    pub state: FedosCryptoBoundaryState,
}

const FEDOS_CAPABILITY_DESCRIPTORS: &[FedosCapabilityDescriptor] = &[
    FedosCapabilityDescriptor {
        kind: FedosCapabilityKind::AeadPlaceholder,
        state: FedosCryptoBoundaryState::Placeholder,
    },
    FedosCapabilityDescriptor {
        kind: FedosCapabilityKind::KdfPlaceholder,
        state: FedosCryptoBoundaryState::Placeholder,
    },
    FedosCapabilityDescriptor {
        kind: FedosCapabilityKind::RandomPlaceholder,
        state: FedosCryptoBoundaryState::Placeholder,
    },
    FedosCapabilityDescriptor {
        kind: FedosCapabilityKind::NoncePlaceholder,
        state: FedosCryptoBoundaryState::Placeholder,
    },
    FedosCapabilityDescriptor {
        kind: FedosCapabilityKind::KeyGenerationPlaceholder,
        state: FedosCryptoBoundaryState::Placeholder,
    },
    FedosCapabilityDescriptor {
        kind: FedosCapabilityKind::KeyImportPlaceholder,
        state: FedosCryptoBoundaryState::Placeholder,
    },
    FedosCapabilityDescriptor {
        kind: FedosCapabilityKind::KeyExportPlaceholder,
        state: FedosCryptoBoundaryState::Placeholder,
    },
    FedosCapabilityDescriptor {
        kind: FedosCapabilityKind::Nip44Placeholder,
        state: FedosCryptoBoundaryState::Unavailable,
    },
];

/// The fixed list of capability descriptors this crate's public boundary
/// currently enumerates — intent only; mirrors [`fedos_core_capabilities`]
/// above but as typed descriptors instead of raw strings. Reads nothing,
/// computes nothing.
pub fn fedos_capability_descriptors() -> &'static [FedosCapabilityDescriptor] {
    FEDOS_CAPABILITY_DESCRIPTORS
}

/// The broad cryptographic CATEGORY a [`FedosCryptoAlgorithm`] (Stage 102)
/// belongs to — a label only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosAlgorithmCategory {
    Aead,
    Kdf,
}

/// A non-sensitive descriptor pairing one [`FedosCryptoAlgorithm`] (Stage
/// 102) with its [`FedosAlgorithmCategory`] — explicit, direct reuse of
/// the algorithm label vocabulary Stage 102 already fixed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosAlgorithmDescriptor {
    pub algorithm: FedosCryptoAlgorithm,
    pub category: FedosAlgorithmCategory,
}

const FEDOS_ALGORITHM_DESCRIPTORS: &[FedosAlgorithmDescriptor] = &[
    FedosAlgorithmDescriptor {
        algorithm: FedosCryptoAlgorithm::ChaCha20Poly1305,
        category: FedosAlgorithmCategory::Aead,
    },
    FedosAlgorithmDescriptor {
        algorithm: FedosCryptoAlgorithm::Aes256Gcm,
        category: FedosAlgorithmCategory::Aead,
    },
    FedosAlgorithmDescriptor {
        algorithm: FedosCryptoAlgorithm::HkdfSha256,
        category: FedosAlgorithmCategory::Kdf,
    },
    FedosAlgorithmDescriptor {
        algorithm: FedosCryptoAlgorithm::Argon2id,
        category: FedosAlgorithmCategory::Kdf,
    },
];

/// The fixed list of algorithm descriptors this crate's public boundary
/// currently enumerates — intent only, reusing exactly the four
/// [`FedosCryptoAlgorithm`] labels Stage 102 already fixed. Reads nothing,
/// computes nothing.
pub fn fedos_algorithm_descriptors() -> &'static [FedosAlgorithmDescriptor] {
    FEDOS_ALGORITHM_DESCRIPTORS
}

/// A fixed version marker for the SHAPE of this crate's public boundary
/// (the types and functions themselves) — not the crate's own
/// `Cargo.toml` version, not a real API version-negotiation mechanism, and
/// not tied to any cryptographic algorithm version.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosBoundaryVersion {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

/// The public boundary's current fixed version: `1.0.0`, marking the
/// shape Stage 102 (crypto operation/algorithm/status/descriptor types)
/// plus Stage 103 (this consolidation) established. Reads nothing,
/// computes nothing.
pub fn fedos_boundary_version() -> FedosBoundaryVersion {
    FedosBoundaryVersion {
        major: 1,
        minor: 0,
        patch: 0,
    }
}

/// A fixed feature FLAG describing one property of this crate's public
/// boundary DESIGN itself (not a cryptographic capability — see
/// [`FedosCapabilityKind`] above for that) — a label only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosBoundaryFeature {
    /// Every operation on this boundary is placeholder-only today.
    PlaceholderOnly,
    /// Any future audit record on this boundary carries labels only,
    /// never a payload (`docs/fedos_core_public_api_design.md` section 9).
    AuditLabelOnly,
    /// Any future error on this boundary surfaces as a fixed taxonomy
    /// label, never raw error text or a stack trace
    /// (`docs/fedos_core_public_api_design.md` section 8).
    ErrorTaxonomyFixed,
    /// This boundary carries an explicit version marker (this stage; see
    /// [`FedosBoundaryVersion`] above).
    VersionedBoundary,
}

const FEDOS_BOUNDARY_FEATURES: &[FedosBoundaryFeature] = &[
    FedosBoundaryFeature::PlaceholderOnly,
    FedosBoundaryFeature::AuditLabelOnly,
    FedosBoundaryFeature::ErrorTaxonomyFixed,
    FedosBoundaryFeature::VersionedBoundary,
];

/// The fixed list of feature flags this crate's public boundary currently
/// declares — intent only. Reads nothing, computes nothing.
pub fn fedos_boundary_features() -> &'static [FedosBoundaryFeature] {
    FEDOS_BOUNDARY_FEATURES
}

/// Which future boundary operation a [`FedosBoundaryPolicy`] decision
/// applies to — a label only.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosBoundaryPolicyKind {
    RandomBoundary,
    NonceBoundary,
    KeyGenerationBoundary,
    KeyImportBoundary,
    KeyExportBoundary,
    CryptoBoundary,
}

/// A fixed decision for a [`FedosBoundaryPolicyKind`] — mirrors the
/// crate-private `audit_policy` skeleton's always-`DenyPlaceholder`
/// pattern, now surfaced on the public boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosBoundaryPolicyDecision {
    DenyPlaceholder,
}

/// A non-sensitive pairing of one [`FedosBoundaryPolicyKind`] with its
/// fixed [`FedosBoundaryPolicyDecision`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosBoundaryPolicy {
    pub kind: FedosBoundaryPolicyKind,
    pub decision: FedosBoundaryPolicyDecision,
}

/// The fixed policy decision for a given [`FedosBoundaryPolicyKind`]:
/// always `DenyPlaceholder`, regardless of `kind` — this boundary permits
/// no real operation yet. Reads nothing, computes nothing.
pub fn fedos_boundary_policy_decision(kind: FedosBoundaryPolicyKind) -> FedosBoundaryPolicy {
    FedosBoundaryPolicy {
        kind,
        decision: FedosBoundaryPolicyDecision::DenyPlaceholder,
    }
}

/// Stage 105 — public key-format label enumeration (planning only).
///
/// `docs/public_key_provisioning.md` section 6 (Stage 104) deferred the
/// concrete key-format label enumeration a future provisioning function
/// would eventually select by. The type below fixes that enumeration as
/// FUTURE PLANNING LABELS only — not a decision about which raw format is
/// actually supported, not a serialization format, and not a parser or
/// validator for any byte layout. No raw key byte, no owned string, and
/// no growable byte collection exists anywhere in this section: every
/// type holds ONLY fixed enum labels, the exact same non-sensitive-label
/// shape Stage 102/103's `FedosCrypto*`/`FedosBoundary*` groups already
/// established. Nothing here draws a random byte, imports or exports a
/// key, or performs any AEAD/KDF/NIP-44 operation — the raw-input format
/// decision itself stays UNIMPLEMENTED, exactly as
/// `docs/public_key_provisioning.md` left it.

/// A future key-format LABEL a provisioning path would eventually accept
/// or a generation path would eventually produce — planning intent only,
/// never a decision about a real byte layout.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosKeyFormatLabel {
    /// Planned future label: a raw symmetric key sized for one of Stage
    /// 102's AEAD candidates.
    RawAeadKeyPlaceholder,
    /// Planned future label: raw output-keying-material bytes from one of
    /// Stage 102's KDF candidates.
    RawKdfOutputPlaceholder,
    /// Planned future label: a Nostr secret key.
    NostrSecretKeyPlaceholder,
    /// Planned future label: a Nostr public key.
    NostrPublicKeyPlaceholder,
    /// Planned future label: a NIP-44 conversation key.
    Nip44ConversationKeyPlaceholder,
    /// Planned future label: an opaque reference to a key held entirely
    /// outside this crate (e.g. a hardware/OS-level key store).
    ExternalOpaqueKeyRefPlaceholder,
    /// A fixed sentinel this stage's own placeholder function returns —
    /// never a real key format.
    TestOnlyPlaceholder,
}

/// Coarse observable state of the key-format planning boundary. No key
/// byte is accepted, parsed, or validated at any state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosKeyFormatState {
    Unavailable,
    Placeholder,
}

/// A non-sensitive status snapshot for the key-format planning boundary.
/// Never contains a key byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosKeyFormatStatus {
    pub state: FedosKeyFormatState,
}

/// A non-sensitive descriptor pairing one [`FedosKeyFormatLabel`] with its
/// [`FedosKeyFormatStatus`] — planning intent only, never a real key byte,
/// parsed structure, or validated layout.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosKeyFormatDescriptor {
    pub label: FedosKeyFormatLabel,
    pub status: FedosKeyFormatStatus,
}

/// A fixed placeholder key-format descriptor: always labels
/// [`FedosKeyFormatLabel::TestOnlyPlaceholder`] with a permanently
/// `Unavailable` status, regardless of any future input this function
/// does not yet accept. Reads nothing, computes nothing, parses nothing.
pub fn fedos_key_format_descriptor_placeholder() -> FedosKeyFormatDescriptor {
    FedosKeyFormatDescriptor {
        label: FedosKeyFormatLabel::TestOnlyPlaceholder,
        status: FedosKeyFormatStatus {
            state: FedosKeyFormatState::Unavailable,
        },
    }
}

/// Stage 106 — public key-usage label enumeration + algorithm policy
/// metadata (planning only).
///
/// Two more label-only PUBLIC groups. `FedosKeyUsageLabel` separates
/// "what is this key allowed to be used for" from Stage 105's "what
/// format is this key" — planning intent only, never an enforced
/// authorization rule. `FedosAlgorithmRequirement`/
/// `FedosAlgorithmCapability`/`FedosAlgorithmPolicy` fix, as fixed
/// relational tables of labels, what Stage 102's four algorithm
/// candidates would eventually need as input and would eventually be
/// capable of, plus a fixed approval-policy decision mirroring Stage
/// 103's `FedosBoundaryPolicy` pattern. No raw byte, no owned string, and
/// no growable byte collection exists anywhere in this section: every
/// type holds ONLY fixed enum labels. Nothing here enforces a real
/// authorization rule, validates a real algorithm requirement, or grants
/// a real capability — every function returns a fixed, non-sensitive
/// label or status. See `docs/public_key_usage.md` and
/// `docs/public_algorithm_policy.md` for the full design records.

/// A future key-USAGE label a provisioning or generation path would
/// eventually attach to a key — planning intent only, never an enforced
/// authorization rule.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosKeyUsageLabel {
    EncryptionPlaceholder,
    DecryptionPlaceholder,
    SigningPlaceholder,
    VerificationPlaceholder,
    KeyDerivationPlaceholder,
    StoragePlaceholder,
    TransportPlaceholder,
    /// A fixed sentinel this stage's own placeholder function returns —
    /// never a real key usage.
    TestOnlyPlaceholder,
}

/// Coarse observable state of the key-usage planning boundary. No key
/// byte is accepted, bound, or enforced at any state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosKeyUsageState {
    Unavailable,
    Placeholder,
}

/// A non-sensitive status snapshot for the key-usage planning boundary.
/// Never contains a key byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosKeyUsageStatus {
    pub state: FedosKeyUsageState,
}

/// A non-sensitive descriptor pairing one [`FedosKeyUsageLabel`] with its
/// [`FedosKeyUsageStatus`] — planning intent only, never an enforced
/// authorization decision.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosKeyUsageDescriptor {
    pub label: FedosKeyUsageLabel,
    pub status: FedosKeyUsageStatus,
}

/// A fixed placeholder key-usage descriptor: always labels
/// [`FedosKeyUsageLabel::TestOnlyPlaceholder`] with a permanently
/// `Unavailable` status, regardless of any future input this function
/// does not yet accept. Reads nothing, computes nothing, authorizes
/// nothing.
pub fn fedos_key_usage_descriptor_placeholder() -> FedosKeyUsageDescriptor {
    FedosKeyUsageDescriptor {
        label: FedosKeyUsageLabel::TestOnlyPlaceholder,
        status: FedosKeyUsageStatus {
            state: FedosKeyUsageState::Unavailable,
        },
    }
}

/// A REQUIREMENT label describing one kind of input a
/// [`FedosCryptoAlgorithm`] (Stage 102) would eventually need supplied to
/// it — planning intent only, never a real validation rule enforced
/// anywhere.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosAlgorithmRequirementLabel {
    RequiresKeyPlaceholder,
    RequiresNoncePlaceholder,
    RequiresSaltPlaceholder,
    RequiresNoAdditionalInputPlaceholder,
}

/// A non-sensitive pairing of one [`FedosCryptoAlgorithm`] with one
/// [`FedosAlgorithmRequirementLabel`] — explicit, direct reuse of Stage
/// 102's algorithm label vocabulary, not a guess at a future design.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosAlgorithmRequirement {
    pub algorithm: FedosCryptoAlgorithm,
    pub requirement: FedosAlgorithmRequirementLabel,
}

const FEDOS_ALGORITHM_REQUIREMENTS: &[FedosAlgorithmRequirement] = &[
    FedosAlgorithmRequirement {
        algorithm: FedosCryptoAlgorithm::ChaCha20Poly1305,
        requirement: FedosAlgorithmRequirementLabel::RequiresKeyPlaceholder,
    },
    FedosAlgorithmRequirement {
        algorithm: FedosCryptoAlgorithm::ChaCha20Poly1305,
        requirement: FedosAlgorithmRequirementLabel::RequiresNoncePlaceholder,
    },
    FedosAlgorithmRequirement {
        algorithm: FedosCryptoAlgorithm::Aes256Gcm,
        requirement: FedosAlgorithmRequirementLabel::RequiresKeyPlaceholder,
    },
    FedosAlgorithmRequirement {
        algorithm: FedosCryptoAlgorithm::Aes256Gcm,
        requirement: FedosAlgorithmRequirementLabel::RequiresNoncePlaceholder,
    },
    FedosAlgorithmRequirement {
        algorithm: FedosCryptoAlgorithm::HkdfSha256,
        requirement: FedosAlgorithmRequirementLabel::RequiresSaltPlaceholder,
    },
    FedosAlgorithmRequirement {
        algorithm: FedosCryptoAlgorithm::Argon2id,
        requirement: FedosAlgorithmRequirementLabel::RequiresSaltPlaceholder,
    },
];

/// The fixed list of algorithm requirements this crate's public boundary
/// currently enumerates — intent only. Reads nothing, computes nothing.
pub fn fedos_algorithm_requirements() -> &'static [FedosAlgorithmRequirement] {
    FEDOS_ALGORITHM_REQUIREMENTS
}

/// A CAPABILITY label describing one operation a [`FedosCryptoAlgorithm`]
/// would eventually be capable of performing — planning intent only,
/// never a real capability grant.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosAlgorithmCapabilityLabel {
    AeadEncryptPlaceholder,
    AeadDecryptPlaceholder,
    KdfDerivePlaceholder,
}

/// A non-sensitive pairing of one [`FedosCryptoAlgorithm`] with one
/// [`FedosAlgorithmCapabilityLabel`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosAlgorithmCapability {
    pub algorithm: FedosCryptoAlgorithm,
    pub capability: FedosAlgorithmCapabilityLabel,
}

const FEDOS_ALGORITHM_CAPABILITIES: &[FedosAlgorithmCapability] = &[
    FedosAlgorithmCapability {
        algorithm: FedosCryptoAlgorithm::ChaCha20Poly1305,
        capability: FedosAlgorithmCapabilityLabel::AeadEncryptPlaceholder,
    },
    FedosAlgorithmCapability {
        algorithm: FedosCryptoAlgorithm::ChaCha20Poly1305,
        capability: FedosAlgorithmCapabilityLabel::AeadDecryptPlaceholder,
    },
    FedosAlgorithmCapability {
        algorithm: FedosCryptoAlgorithm::Aes256Gcm,
        capability: FedosAlgorithmCapabilityLabel::AeadEncryptPlaceholder,
    },
    FedosAlgorithmCapability {
        algorithm: FedosCryptoAlgorithm::Aes256Gcm,
        capability: FedosAlgorithmCapabilityLabel::AeadDecryptPlaceholder,
    },
    FedosAlgorithmCapability {
        algorithm: FedosCryptoAlgorithm::HkdfSha256,
        capability: FedosAlgorithmCapabilityLabel::KdfDerivePlaceholder,
    },
    FedosAlgorithmCapability {
        algorithm: FedosCryptoAlgorithm::Argon2id,
        capability: FedosAlgorithmCapabilityLabel::KdfDerivePlaceholder,
    },
];

/// The fixed list of algorithm capabilities this crate's public boundary
/// currently enumerates — intent only. Reads nothing, computes nothing.
pub fn fedos_algorithm_capabilities() -> &'static [FedosAlgorithmCapability] {
    FEDOS_ALGORITHM_CAPABILITIES
}

/// A fixed approval decision for a [`FedosCryptoAlgorithm`] — mirrors
/// Stage 103's `FedosBoundaryPolicy` always-`DenyPlaceholder` pattern.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosAlgorithmPolicyDecision {
    NotYetApprovedPlaceholder,
}

/// A non-sensitive pairing of one [`FedosCryptoAlgorithm`] with its fixed
/// [`FedosAlgorithmPolicyDecision`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosAlgorithmPolicy {
    pub algorithm: FedosCryptoAlgorithm,
    pub decision: FedosAlgorithmPolicyDecision,
}

/// The fixed policy decision for a given [`FedosCryptoAlgorithm`]: always
/// `NotYetApprovedPlaceholder`, regardless of `algorithm` — no algorithm
/// is approved for real use yet. Reads nothing, computes nothing.
pub fn fedos_algorithm_policy_decision(algorithm: FedosCryptoAlgorithm) -> FedosAlgorithmPolicy {
    FedosAlgorithmPolicy {
        algorithm,
        decision: FedosAlgorithmPolicyDecision::NotYetApprovedPlaceholder,
    }
}

/// Stage 137 — first REAL implementation behind this crate's random-byte
/// boundary.
///
/// [`fedos_random_bytes_32`] draws exactly 32 bytes from the OS CSPRNG via
/// `getrandom::fill` — the FIRST production (not gated `cfg(test)`) code
/// anywhere in this crate to import and call `getrandom` (adopted Stage
/// 104, build-check only until now). Scope is deliberately narrow, per
/// `docs/random_bytes_implementation_plan.md`: exactly 32 bytes, selected
/// by a fixed label ([`FedosRandomBytesLength::ThirtyTwo`]) rather than an
/// open, caller-supplied count — there is no zero-length or
/// variable-length request anywhere on this boundary, and no caller-facing
/// parameter of any kind. On success the caller gets exactly 32 fresh
/// CSPRNG bytes; on any OS CSPRNG failure the call returns a fixed
/// [`FedosRandomBytesState::EntropySourceUnavailable`] with `bytes: None`
/// — there is no fallback PRNG, no `rand`/`thread_rng`/deterministic
/// substitute, and this function never panics (`getrandom::fill`'s
/// `Result` is matched exhaustively, never `.unwrap()`/`.expect()`-ed).
///
/// This is general-purpose randomness ONLY. It performs NO nonce
/// generation (`docs/nonce_generation_policy.md` remains policy only — no
/// nonce is drawn here or anywhere else in this crate), NO key
/// generation, NO key derivation, and NO AEAD/KDF/NIP-44 operation; it is
/// not connected to [`SecretHandle`] (`secret_handle`, Stage 79),
/// `AeadPlaceholderRequest` (`aead_core`, Stage 80), or
/// `KdfPlaceholderRequest` (`kdf_core`, Stage 82) — those crate-private
/// skeletons remain exactly as placeholder as before this stage.
/// `random_bytes_placeholder` (Stage 69) and
/// `fedos_random_boundary_status`/[`FedosRandomBoundary`] (Stage 103) are
/// also UNCHANGED — this stage adds a new, independent function rather
/// than editing either. Not wired into the Runtime, the Worker, or any
/// `CryptoProvider`; no WASM binding exists. See
/// `docs/random_bytes_implementation_plan.md` for the full design record,
/// and `docs/secret_lifecycle_implementation_plan.md` section 8 for why
/// `bytes` below is a plain returned value, not a `SecretHandle`-wrapped
/// secret.

/// The fixed, label-selected output length this boundary supports —
/// never an open, caller-supplied byte count
/// (`docs/random_bytes_implementation_plan.md` section 4). Exactly one
/// variant exists today; a future additional length would be its own
/// reviewed addition, never a numeric parameter.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosRandomBytesLength {
    /// Exactly 32 bytes — the only length this boundary supports today.
    ThirtyTwo,
}

/// Coarse observable outcome of a [`fedos_random_bytes_32`] call. No
/// generated byte is exposed through this label itself — only through
/// [`FedosRandomBytesDecision::bytes`] on the `Ready` state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosRandomBytesState {
    /// The OS CSPRNG produced the requested bytes.
    Ready,
    /// The OS CSPRNG reported a failure. There is no fallback PRNG and no
    /// degraded output — see `docs/random_bytes_implementation_plan.md`
    /// section 6.
    EntropySourceUnavailable,
}

/// The result of a [`fedos_random_bytes_32`] call. On
/// [`FedosRandomBytesState::Ready`], `bytes` holds exactly 32 freshly
/// drawn CSPRNG bytes; on
/// [`FedosRandomBytesState::EntropySourceUnavailable`], `bytes` is
/// `None` — never a zeroed, truncated, or otherwise degraded substitute.
///
/// `bytes` is a fixed-size `[u8; 32]`, never a `Vec<u8>` or a borrowed
/// slice — there is no length for a caller to separately validate. This
/// is NOT a secret-handling type: the output is general-purpose random
/// bytes handed back to the caller in full, not a key or seed held by
/// this crate (`docs/secret_lifecycle_implementation_plan.md` section 8
/// governs a raw secret's own eventual provisioning path, which this
/// function does not implement).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosRandomBytesDecision {
    pub length: FedosRandomBytesLength,
    pub state: FedosRandomBytesState,
    pub bytes: Option<[u8; 32]>,
}

/// Draw exactly 32 bytes from the OS CSPRNG via `getrandom::fill`. Never
/// accepts a caller-supplied length, a seed, or any other parameter.
/// Returns [`FedosRandomBytesState::Ready`] with the drawn bytes on
/// success; on any CSPRNG failure, returns
/// [`FedosRandomBytesState::EntropySourceUnavailable`] with
/// `bytes: None` — there is no fallback PRNG, no `rand`/`thread_rng`
/// substitute, and no panic (the `Result` `getrandom::fill` returns is
/// matched exhaustively, never `.unwrap()`/`.expect()`-ed).
pub fn fedos_random_bytes_32() -> FedosRandomBytesDecision {
    let mut buf = [0u8; 32];
    match getrandom::fill(&mut buf) {
        Ok(()) => FedosRandomBytesDecision {
            length: FedosRandomBytesLength::ThirtyTwo,
            state: FedosRandomBytesState::Ready,
            bytes: Some(buf),
        },
        Err(_) => FedosRandomBytesDecision {
            length: FedosRandomBytesLength::ThirtyTwo,
            state: FedosRandomBytesState::EntropySourceUnavailable,
            bytes: None,
        },
    }
}

/// Stage 138 — a fixed-size AEAD nonce helper, drawn from the OS CSPRNG,
/// following `docs/nonce_generation_policy.md`'s MVP decision (a
/// CSPRNG-drawn random nonce, never a counter, never deterministic, never
/// derived from a seed/password/user input).
///
/// [`fedos_aead_nonce_96`] draws exactly 12 bytes (96 bits) from the OS
/// CSPRNG via `getrandom::fill` — the SECOND real call site of the
/// `getrandom` dependency (adopted Stage 104), independent of
/// [`fedos_random_bytes_32`] (Stage 137) and not implemented by calling
/// it. 96 bits is this crate's two currently-adopted AEAD candidates'
/// shared nonce size (ChaCha20-Poly1305 and AES-256-GCM both use a 96-bit
/// nonce, per RFC 8439 and NIST SP 800-38D). Scope is deliberately narrow,
/// mirroring [`fedos_random_bytes_32`]'s shape exactly: a fixed,
/// label-selected size ([`FedosAeadNonceKind::NinetySixBit`]) rather than
/// an open, caller-supplied count — there is no zero-length or
/// variable-length request anywhere on this boundary, and no
/// caller-facing parameter of any kind. On success the caller gets
/// exactly 12 fresh CSPRNG bytes; on any OS CSPRNG failure the call
/// returns a fixed [`FedosNonceState::EntropySourceUnavailable`] with
/// `nonce: None` — there is no fallback PRNG, no `rand`/`thread_rng`/
/// deterministic substitute, and this function never panics
/// (`getrandom::fill`'s `Result` is matched exhaustively, never
/// `.unwrap()`/`.expect()`-ed).
///
/// This is a nonce-DRAWING helper ONLY. It performs NO AEAD seal/open, NO
/// encryption, NO decryption, and NO key derivation/generation; it is not
/// connected to `encrypt_placeholder`/`decrypt_placeholder` (Stage 69),
/// `aead_core` (Stage 80), `kdf_core` (Stage 82), or [`SecretHandle`]
/// (`secret_handle`, Stage 79) — those remain exactly as placeholder as
/// before this stage, and a future AEAD implementation would need its
/// OWN, separately-reviewed stage to actually call this helper.
/// [`fedos_nonce_boundary_status`]/[`FedosNonceBoundary`] (Stage 103) are
/// also UNCHANGED — this stage adds a new, independent function rather
/// than editing it. The nonce is never derived from a counter, a
/// timestamp, a seed, a password, or any user-supplied input — see
/// `docs/nonce_generation_policy.md` sections 5-8 for why a counter nonce
/// is explicitly deferred (this codebase has no durable, crash-safe
/// counter-persistence mechanism yet). Not wired into the Runtime, the
/// Worker, or any `CryptoProvider`; no WASM binding exists.

/// The fixed, label-selected nonce size this boundary supports — never an
/// open, caller-supplied byte count. Exactly one variant exists today,
/// matching this crate's two currently-adopted AEAD candidates' shared
/// 96-bit nonce size; a future 192-bit (XChaCha20-Poly1305-style) variant
/// would be its own reviewed addition, never a numeric parameter.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosAeadNonceKind {
    /// Exactly 12 bytes (96 bits) — ChaCha20-Poly1305's and
    /// AES-256-GCM's shared nonce size.
    NinetySixBit,
}

/// Coarse observable outcome of a [`fedos_aead_nonce_96`] call. No
/// generated byte is exposed through this label itself — only through
/// [`FedosAeadNonceDecision::nonce`] on the `Ready` state. A separate type
/// from [`FedosRandomBytesState`] — each independent boundary this crate
/// exposes gets its own state enum rather than sharing one generic status
/// across unrelated operations, the same choice Stage 103 already made.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FedosNonceState {
    /// The OS CSPRNG produced the requested nonce bytes.
    Ready,
    /// The OS CSPRNG reported a failure. There is no fallback PRNG and no
    /// degraded output.
    EntropySourceUnavailable,
}

/// The result of a [`fedos_aead_nonce_96`] call. On
/// [`FedosNonceState::Ready`], `nonce` holds exactly 12 freshly drawn
/// CSPRNG bytes; on [`FedosNonceState::EntropySourceUnavailable`],
/// `nonce` is `None` — never a zeroed, truncated, counter-derived, or
/// otherwise degraded substitute.
///
/// `nonce` is a fixed-size `[u8; 12]`, never a `Vec<u8>` or a borrowed
/// slice — there is no length for a caller to separately validate. A
/// nonce is not a secret (it is expected to travel alongside its
/// ciphertext, per `docs/nonce_generation_policy.md` section 9-10), so
/// this type is plain returned data, not a [`SecretHandle`]-wrapped
/// value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FedosAeadNonceDecision {
    pub kind: FedosAeadNonceKind,
    pub state: FedosNonceState,
    pub nonce: Option<[u8; 12]>,
}

/// Draw exactly 12 bytes (96 bits) from the OS CSPRNG via
/// `getrandom::fill`, for use as a future AEAD nonce. Never accepts a
/// caller-supplied length, a seed, a password, a user id, or any other
/// parameter, and never derives its output from a counter or a
/// timestamp. Returns [`FedosNonceState::Ready`] with the drawn bytes on
/// success; on any CSPRNG failure, returns
/// [`FedosNonceState::EntropySourceUnavailable`] with `nonce: None` —
/// there is no fallback PRNG, no `rand`/`thread_rng` substitute, and no
/// panic (the `Result` `getrandom::fill` returns is matched exhaustively,
/// never `.unwrap()`/`.expect()`-ed). This function is NOT called by, and
/// does NOT call, any encrypt/decrypt/AEAD function — it is a standalone
/// nonce-drawing helper, not part of an AEAD implementation.
pub fn fedos_aead_nonce_96() -> FedosAeadNonceDecision {
    let mut buf = [0u8; 12];
    match getrandom::fill(&mut buf) {
        Ok(()) => FedosAeadNonceDecision {
            kind: FedosAeadNonceKind::NinetySixBit,
            state: FedosNonceState::Ready,
            nonce: Some(buf),
        },
        Err(_) => FedosAeadNonceDecision {
            kind: FedosAeadNonceKind::NinetySixBit,
            state: FedosNonceState::EntropySourceUnavailable,
            nonce: None,
        },
    }
}

/// Stage 79 — an INTERNAL-ONLY secret-handle skeleton. It originally held
/// only a fixed, non-secret [`PlaceholderMarker`] wrapped in
/// `secrecy::SecretBox`. Stage 144–146 extends it to hold its first REAL
/// secret bytes: [`SecretHandle::new_from_32_bytes_for_internal_use`]
/// accepts an already-drawn, fixed-size `[u8; 32]` (never a slice,
/// `Vec<u8>`, or `String`) plus a non-sensitive [`SecretHandleKind`] label,
/// wraps the bytes in its own `secrecy::SecretBox`-held payload, and
/// transitions the handle to [`SecretHandleState::Holding`].
/// `new_placeholder()` (Stage 79) is UNCHANGED — both construction paths
/// coexist on the same type.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of this crate's `pub fn` functions constructs, holds, or returns a
/// [`SecretHandle`].
///
/// `SecretHandle` does not, and must not, generate its own bytes: it never
/// calls `fedos_random_bytes_32` (Stage 137) or `fedos_aead_nonce_96`
/// (Stage 138) itself — a caller draws bytes first and hands them to the
/// constructor. No AEAD/HKDF/Argon2/NIP-44 operation is implemented or
/// called here, and no field or method reaches into `aead_core`/`kdf_core`/
/// `key_material` — per `docs/secret_lifecycle_implementation_plan.md`
/// section 9 and `docs/secret_handle_api_shape.md` section 3, HKDF and AEAD
/// each connect in their own future, later, separate stage.
/// `subtle` (also adopted Stage 78) is intentionally still NOT used here —
/// [`SecretHandleState`]/[`SecretHandleKind`]'s derived `PartialEq` below is
/// plain, non-secret label equality, never a raw-secret comparison.
///
/// [`SecretHandleKind`] (NEW) is a non-sensitive classification label —
/// `Placeholder` (the Stage 79 path) plus five real-secret labels
/// (`AeadKeyMaterial`, `HkdfInputMaterial`, `HkdfOutputMaterial`,
/// `NostrKeyMaterial`, `TestOnlySecretMaterial`) fixed at construction and
/// returned by [`SecretHandle::kind`] — never a byte, never a length that
/// narrows down which secret is held.
///
/// [`SecretInputLength`] (NEW) mirrors `FedosRandomBytesLength`/
/// `FedosAeadNonceKind`'s "exactly one variant, no open count" shape —
/// `ThirtyTwo` is the only length this boundary accepts today.
///
/// The real-byte payload (`RealSecretBytes`, private to this module) is
/// never `Clone`/`Copy`/`Debug`-over-raw-bytes/`Display`/`Serialize`, and
/// this module exposes no accessor that returns its raw bytes — `clear()`
/// zeroizes it in place, and `secrecy::SecretBox`'s own `Drop` impl
/// zeroizes it again if a handle is ever dropped without `clear()` being
/// called first. See `docs/secret_lifecycle_implementation_plan.md` section
/// 10 for the limitations this does NOT solve (compiler-introduced copies,
/// OS paging, core dumps, and — once a WASM target exists — WASM's own
/// memory model).
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`. This is expected for a type not
/// yet wired to any consumer; it clears once a future stage (e.g. an
/// internal HKDF module) actually uses `SecretHandle`.
#[allow(dead_code)]
mod secret_handle {
    use secrecy::{ExposeSecret, SecretBox};
    use zeroize::Zeroize;

    // Used ONLY to prove `zeroize` actually runs on `clear()`/drop (see
    // `RealSecretBytes` below) — never compiled into a production build.
    #[cfg(test)]
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// Coarse internal lifecycle state of a [`SecretHandle`]. Crate-private
    /// only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum SecretHandleState {
        /// No placeholder marker or real payload has been allocated yet.
        Empty,
        /// A placeholder marker is allocated (`new_placeholder()`). Still
        /// holds no real secret.
        Placeholder,
        /// Real secret bytes are allocated
        /// (`new_from_32_bytes_for_internal_use`).
        Holding,
        /// [`SecretHandle::clear`] was called: the payload was zeroized and
        /// this handle must not be treated as holding anything.
        Cleared,
    }

    impl Default for SecretHandleState {
        fn default() -> Self {
            SecretHandleState::Empty
        }
    }

    /// A non-sensitive classification label for what KIND of secret a
    /// [`SecretHandle`] holds — a label only, never a byte. Crate-private
    /// only. `Placeholder` is the Stage 79 non-secret path; the remaining
    /// variants label real secret material a future `kdf_core`/`aead_core`
    /// stage may eventually consume (still unconnected today).
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum SecretHandleKind {
        /// `new_placeholder()`'s non-secret path.
        Placeholder,
        /// A symmetric AEAD key (future `aead_core` consumer).
        AeadKeyMaterial,
        /// Input key material for a future `kdf_core` derivation step.
        HkdfInputMaterial,
        /// Output key material derived by a future `kdf_core` step.
        HkdfOutputMaterial,
        /// Nostr signing-key material.
        NostrKeyMaterial,
        /// A test-fixture-only secret — never real production material.
        TestOnlySecretMaterial,
    }

    /// The fixed, label-selected input length
    /// [`SecretHandle::new_from_32_bytes_for_internal_use`] accepts — never
    /// an open, caller-supplied byte count (same "exactly one variant, no
    /// open count" shape this crate's other fixed-size boundaries already
    /// use). Exactly one variant exists today; a future additional length
    /// would be its own reviewed addition, never a numeric parameter.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum SecretInputLength {
        /// Exactly 32 bytes — the only length this boundary supports today.
        ThirtyTwo,
    }

    /// A non-sensitive status snapshot for a [`SecretHandle`]. Crate-private
    /// only. Never contains a key/seed/plaintext/ciphertext byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct SecretHandleStatus {
        pub(crate) state: SecretHandleState,
    }

    /// A fixed, non-secret placeholder value. Exists ONLY so [`SecretHandle`]
    /// has a concrete `Zeroize`-able type to wrap in `secrecy::SecretBox` for
    /// its `new_placeholder()` path — its value is a constant, never derived
    /// from or holding any real key/seed/plaintext/ciphertext/passphrase
    /// byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct PlaceholderMarker(u8);

    impl Zeroize for PlaceholderMarker {
        fn zeroize(&mut self) {
            self.0 = 0;
        }
    }

    /// The real 32-byte secret payload held once a [`SecretHandle`] is
    /// constructed via [`SecretHandle::new_from_32_bytes_for_internal_use`].
    /// Deliberately NOT `Clone`/`Copy`/`Debug`-over-raw-bytes/`Display`/
    /// `Serialize` — the same prohibitions bind this type as bind
    /// `SecretHandle` itself
    /// (`docs/secret_lifecycle_implementation_plan.md` sections 4–5).
    /// `secrecy::SecretBox<RealSecretBytes>` gets no `Clone` impl either:
    /// `secrecy`'s own `Clone for SecretBox<S>` requires `S: CloneableSecret`,
    /// which this type deliberately never implements. The `#[cfg(test)]`-only
    /// call-count bump inside `zeroize` below exists SOLELY so a test can
    /// prove `zeroize` actually runs on `clear()`/drop — it never compiles
    /// into a production build and never exposes a byte of the secret
    /// itself.
    struct RealSecretBytes([u8; 32]);

    impl Zeroize for RealSecretBytes {
        fn zeroize(&mut self) {
            self.0.zeroize();
            #[cfg(test)]
            REAL_SECRET_ZEROIZE_CALLS.fetch_add(1, Ordering::SeqCst);
        }
    }

    #[cfg(test)]
    static REAL_SECRET_ZEROIZE_CALLS: AtomicUsize = AtomicUsize::new(0);

    /// Either the Stage 79 non-secret placeholder marker or a real 32-byte
    /// payload — exactly one of `SecretHandle`'s two construction paths is
    /// active at a time. Crate-private; never `Clone`/`Debug`-over-raw-bytes.
    enum SecretPayload {
        Placeholder(SecretBox<PlaceholderMarker>),
        Real(SecretBox<RealSecretBytes>),
    }

    impl SecretPayload {
        fn zeroize_in_place(&mut self) {
            match self {
                SecretPayload::Placeholder(marker) => marker.zeroize(),
                SecretPayload::Real(bytes) => bytes.zeroize(),
            }
        }
    }

    /// An INTERNAL-ONLY secret-handle (crate-private; not part of this
    /// crate's public API — see the module-level doc comment above). Holds
    /// EITHER the Stage 79 non-secret [`PlaceholderMarker`] (via
    /// `new_placeholder()`) OR, as of Stage 144–146, a real 32-byte secret
    /// buffer (via `new_from_32_bytes_for_internal_use`) — both wrapped in
    /// `secrecy::SecretBox`. No `Clone`, no `Debug`, no `Display`, no
    /// `Serialize`, no `Eq`/`PartialEq` over the payload, and no public raw
    /// byte accessor anywhere on this type.
    pub(crate) struct SecretHandle {
        state: SecretHandleState,
        kind: SecretHandleKind,
        payload: Option<SecretPayload>,
    }

    impl SecretHandle {
        /// Construct a placeholder handle. Takes NO secret input of any
        /// kind — there is no borrowed-byte-slice, `Vec<u8>`, or `String`
        /// parameter here — unchanged from Stage 79.
        pub(crate) fn new_placeholder() -> Self {
            Self {
                state: SecretHandleState::Placeholder,
                kind: SecretHandleKind::Placeholder,
                payload: Some(SecretPayload::Placeholder(SecretBox::new(Box::new(
                    PlaceholderMarker(0),
                )))),
            }
        }

        /// Construct a handle holding REAL secret bytes. Takes ownership of
        /// a fixed-size `[u8; 32]` (never a slice, never a `Vec<u8>`, never
        /// a `String`) plus the non-sensitive [`SecretHandleKind`] label the
        /// caller is asserting for it, and immediately wraps the bytes in
        /// `secrecy::SecretBox`. Never calls `fedos_random_bytes_32` or
        /// `fedos_aead_nonce_96` itself — the caller draws bytes first. The
        /// `_for_internal_use` suffix signals this stays `pub(crate)` —
        /// never a crate-public provisioning entry point (a future,
        /// separate, narrowly-scoped decision per
        /// `docs/secret_lifecycle_implementation_plan.md` section 8).
        pub(crate) fn new_from_32_bytes_for_internal_use(
            kind: SecretHandleKind,
            bytes: [u8; 32],
        ) -> Self {
            Self {
                state: SecretHandleState::Holding,
                kind,
                payload: Some(SecretPayload::Real(SecretBox::new(Box::new(
                    RealSecretBytes(bytes),
                )))),
            }
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> SecretHandleStatus {
            SecretHandleStatus { state: self.state }
        }

        /// The non-sensitive classification label fixed at construction.
        pub(crate) fn kind(&self) -> SecretHandleKind {
            self.kind
        }

        /// Zeroizes the held payload (placeholder marker or real bytes) and
        /// marks this handle `Cleared`. Does not return, expose, or copy the
        /// payload. Safe to call more than once — a second call is a no-op
        /// (there is no payload left to zeroize).
        pub(crate) fn clear(&mut self) {
            if let Some(payload) = self.payload.as_mut() {
                payload.zeroize_in_place();
            }
            self.payload = None;
            self.state = SecretHandleState::Cleared;
        }

        /// Whether [`SecretHandle::clear`] has been called.
        pub(crate) fn is_cleared(&self) -> bool {
            self.state == SecretHandleState::Cleared
        }

        /// Stage 147 — a narrowly-scoped internal accessor exposing a COPY
        /// of the real 32-byte payload, for the sole reviewed use of
        /// `kdf_core`'s `derive_secret_handle_internal` (its key-derivation
        /// call site). Returns `None` for the Stage 79 placeholder path and
        /// after `clear()` — only a `Holding`-state real payload has bytes
        /// to expose. This is the ONE deliberate, narrow raw-byte exposure
        /// `docs/secret_lifecycle_implementation_plan.md` section 8 and
        /// `docs/secret_handle_api_shape.md` section 6 anticipated: confined
        /// to `pub(crate)`, named for exactly its one legitimate caller
        /// (mirroring the `_for_internal_use` suffix convention), never
        /// re-exported, and never reachable from this crate's public API.
        /// The caller is responsible for zeroizing its own copy once the
        /// derivation that needs it is done — `kdf_core` does so.
        pub(crate) fn expose_bytes_for_internal_derivation(&self) -> Option<[u8; 32]> {
            match &self.payload {
                Some(SecretPayload::Real(boxed)) => Some(boxed.expose_secret().0),
                _ => None,
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        // A clearly-labeled, non-production test fixture — a fixed
        // repeating pattern, never a real key/seed/passphrase
        // (`docs/crypto_test_vectors.md` section 6's labeling rule
        // generalized to secret fixtures).
        const TEST_FIXTURE_BYTES: [u8; 32] = [0xAB; 32];

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let handle = SecretHandle::new_placeholder();
            assert_eq!(handle.status().state, SecretHandleState::Placeholder);
            assert_eq!(handle.kind(), SecretHandleKind::Placeholder);
            assert!(!handle.is_cleared());
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            // `SecretHandleStatus` carries only the coarse state enum — no
            // secret byte, no marker, nothing derived from the payload.
            let handle = SecretHandle::new_placeholder();
            let status = handle.status();
            assert_eq!(status.state, SecretHandleState::Placeholder);
        }

        #[test]
        fn clear_transitions_state_to_cleared_only() {
            let mut handle = SecretHandle::new_placeholder();
            handle.clear();
            assert_eq!(handle.status().state, SecretHandleState::Cleared);
            assert!(handle.is_cleared());
        }

        #[test]
        fn is_cleared_is_false_until_clear_is_called() {
            let handle = SecretHandle::new_placeholder();
            assert!(!handle.is_cleared());
        }

        #[test]
        fn empty_state_is_the_default_placeholder_only_state() {
            assert_eq!(SecretHandleState::default(), SecretHandleState::Empty);
        }

        #[test]
        fn new_from_32_bytes_for_internal_use_starts_in_holding_state_with_given_kind() {
            let handle = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::TestOnlySecretMaterial,
                TEST_FIXTURE_BYTES,
            );
            assert_eq!(handle.status().state, SecretHandleState::Holding);
            assert_eq!(handle.kind(), SecretHandleKind::TestOnlySecretMaterial);
            assert!(!handle.is_cleared());
        }

        #[test]
        fn real_byte_handle_preserves_every_kind_variant() {
            for kind in [
                SecretHandleKind::AeadKeyMaterial,
                SecretHandleKind::HkdfInputMaterial,
                SecretHandleKind::HkdfOutputMaterial,
                SecretHandleKind::NostrKeyMaterial,
                SecretHandleKind::TestOnlySecretMaterial,
            ] {
                let handle =
                    SecretHandle::new_from_32_bytes_for_internal_use(kind, TEST_FIXTURE_BYTES);
                assert_eq!(handle.kind(), kind);
                assert_eq!(handle.status().state, SecretHandleState::Holding);
            }
        }

        #[test]
        fn clear_on_real_byte_handle_transitions_to_cleared() {
            let mut handle = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::TestOnlySecretMaterial,
                TEST_FIXTURE_BYTES,
            );
            handle.clear();
            assert_eq!(handle.status().state, SecretHandleState::Cleared);
            assert!(handle.is_cleared());
        }

        #[test]
        fn clear_is_idempotent_and_does_not_panic_on_double_clear() {
            let mut handle = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::TestOnlySecretMaterial,
                TEST_FIXTURE_BYTES,
            );
            handle.clear();
            handle.clear();
            assert!(handle.is_cleared());
            assert_eq!(handle.status().state, SecretHandleState::Cleared);
        }

        #[test]
        fn real_byte_zeroize_is_called_on_explicit_clear() {
            let before = REAL_SECRET_ZEROIZE_CALLS.load(Ordering::SeqCst);
            let mut handle = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::TestOnlySecretMaterial,
                TEST_FIXTURE_BYTES,
            );
            handle.clear();
            let after = REAL_SECRET_ZEROIZE_CALLS.load(Ordering::SeqCst);
            assert!(after > before, "clear() must zeroize the real payload");
        }

        #[test]
        fn real_byte_zeroize_is_called_on_drop_without_explicit_clear() {
            let before = REAL_SECRET_ZEROIZE_CALLS.load(Ordering::SeqCst);
            {
                let _handle = SecretHandle::new_from_32_bytes_for_internal_use(
                    SecretHandleKind::TestOnlySecretMaterial,
                    TEST_FIXTURE_BYTES,
                );
                // `_handle` drops at the end of this block without `clear()`
                // ever being called — `secrecy::SecretBox`'s own `Drop` impl
                // must zeroize the payload on its own.
            }
            let after = REAL_SECRET_ZEROIZE_CALLS.load(Ordering::SeqCst);
            assert!(after > before, "drop must zeroize the real payload");
        }

        /// `SecretInputLength` supports exactly one variant today — an
        /// exhaustive match with no wildcard arm compiles only because no
        /// zero-length or caller-chosen-length variant exists to add one
        /// for (mirrors
        /// `fedos_random_bytes_length_has_no_variant_other_than_thirty_two`,
        /// Stage 137).
        #[test]
        fn secret_input_length_has_no_variant_other_than_thirty_two() {
            let length = SecretInputLength::ThirtyTwo;
            match length {
                SecretInputLength::ThirtyTwo => {}
            }
        }

        /// The placeholder path (Stage 79) still works entirely unchanged
        /// alongside the new real-byte path.
        #[test]
        fn placeholder_and_real_byte_paths_stay_independent() {
            let placeholder = SecretHandle::new_placeholder();
            let real = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::TestOnlySecretMaterial,
                TEST_FIXTURE_BYTES,
            );
            assert_eq!(placeholder.status().state, SecretHandleState::Placeholder);
            assert_eq!(real.status().state, SecretHandleState::Holding);
        }

        #[test]
        fn expose_bytes_for_internal_derivation_returns_none_for_placeholder_and_cleared() {
            let placeholder = SecretHandle::new_placeholder();
            assert!(placeholder.expose_bytes_for_internal_derivation().is_none());

            let mut real = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::TestOnlySecretMaterial,
                TEST_FIXTURE_BYTES,
            );
            real.clear();
            assert!(real.expose_bytes_for_internal_derivation().is_none());
        }

        #[test]
        fn expose_bytes_for_internal_derivation_returns_the_stored_bytes_for_a_holding_handle() {
            let real = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::TestOnlySecretMaterial,
                TEST_FIXTURE_BYTES,
            );
            assert_eq!(
                real.expose_bytes_for_internal_derivation(),
                Some(TEST_FIXTURE_BYTES)
            );
        }
    }
}

/// Stage 80 — an INTERNAL-ONLY AEAD request skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns an
/// [`AeadPlaceholderRequest`].
///
/// This module holds NO key, nonce, plaintext, ciphertext, or tag byte —
/// there is no borrowed-byte-slice, `Vec<u8>`, or `String` field or
/// parameter anywhere below, and no real encrypt/decrypt operation is
/// implemented or called. Production code here does NOT import
/// `chacha20poly1305` — that dependency is exercised only by the
/// `cfg(test)`-only `rfc8439_vectors` module above, unchanged since Stage
/// 75. This module does not connect to `secret_handle` (above): it never
/// constructs a `SecretHandle` and never reads a key/secret byte out of one
/// — when in doubt about a connection between the two skeletons, this stage
/// deliberately leaves them unconnected rather than guess at a future
/// design. `hkdf` is likewise not referenced here.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle` above
/// does. This is expected for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod aead_core {
    use crate::FedosCoreState;

    /// A supported AEAD algorithm label — intent only, no implementation.
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum AeadAlgorithm {
        ChaCha20Poly1305,
    }

    /// Which AEAD operation an [`AeadPlaceholderRequest`] represents —
    /// a label only, no bytes are sealed or opened. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum AeadOperation {
        Encrypt,
        Decrypt,
    }

    /// A non-sensitive status snapshot for an [`AeadPlaceholderRequest`].
    /// Crate-private only. Never contains a key/nonce/plaintext/ciphertext/
    /// tag byte — `state` reuses this crate's existing
    /// [`FedosCoreState`](crate::FedosCoreState) labels (`Unavailable` /
    /// `Placeholder`) rather than inventing a parallel enum.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct AeadRequestStatus {
        pub(crate) state: FedosCoreState,
    }

    /// An INTERNAL-ONLY AEAD placeholder request skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds ONLY the two labels below — no key, nonce,
    /// plaintext, ciphertext, or tag byte, and no `chacha20poly1305` type.
    /// A future, explicitly-reviewed stage may extend this skeleton to
    /// actually seal/open bytes behind `cfg(test)` first; until then it
    /// accepts and stores none.
    pub(crate) struct AeadPlaceholderRequest {
        algorithm: AeadAlgorithm,
        operation: AeadOperation,
    }

    impl AeadPlaceholderRequest {
        /// Construct a placeholder ENCRYPT request. Takes NO plaintext,
        /// key, nonce, or AAD input of any kind.
        pub(crate) fn new_placeholder_encrypt() -> Self {
            Self {
                algorithm: AeadAlgorithm::ChaCha20Poly1305,
                operation: AeadOperation::Encrypt,
            }
        }

        /// Construct a placeholder DECRYPT request. Takes NO ciphertext,
        /// tag, key, nonce, or AAD input of any kind.
        pub(crate) fn new_placeholder_decrypt() -> Self {
            Self {
                algorithm: AeadAlgorithm::ChaCha20Poly1305,
                operation: AeadOperation::Decrypt,
            }
        }

        /// A non-sensitive status snapshot. Always `Placeholder` — this
        /// skeleton runs no cryptography, so there is no other state to
        /// report.
        pub(crate) fn status(&self) -> AeadRequestStatus {
            AeadRequestStatus {
                state: FedosCoreState::Placeholder,
            }
        }

        /// The algorithm label this request names — intent only.
        pub(crate) fn algorithm(&self) -> AeadAlgorithm {
            self.algorithm
        }

        /// The operation label this request names — intent only.
        pub(crate) fn operation(&self) -> AeadOperation {
            self.operation
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_encrypt_reports_encrypt_operation_only() {
            let request = AeadPlaceholderRequest::new_placeholder_encrypt();
            assert_eq!(request.operation(), AeadOperation::Encrypt);
            assert_eq!(request.algorithm(), AeadAlgorithm::ChaCha20Poly1305);
            assert_eq!(request.status().state, FedosCoreState::Placeholder);
        }

        #[test]
        fn new_placeholder_decrypt_reports_decrypt_operation_only() {
            let request = AeadPlaceholderRequest::new_placeholder_decrypt();
            assert_eq!(request.operation(), AeadOperation::Decrypt);
            assert_eq!(request.algorithm(), AeadAlgorithm::ChaCha20Poly1305);
            assert_eq!(request.status().state, FedosCoreState::Placeholder);
        }

        #[test]
        fn status_is_always_placeholder_only_no_real_cryptography() {
            for request in [
                AeadPlaceholderRequest::new_placeholder_encrypt(),
                AeadPlaceholderRequest::new_placeholder_decrypt(),
            ] {
                assert_eq!(request.status().state, FedosCoreState::Placeholder);
            }
        }
    }
}

/// Stage 82 — an INTERNAL-ONLY KDF request skeleton. Stage 147 extends it
/// with this crate's FIRST real HKDF-SHA256 implementation.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of this crate's `pub fn` functions constructs, holds, or returns a
/// [`KdfPlaceholderRequest`] or an [`HkdfDecision`].
///
/// The Stage 82 [`KdfPlaceholderRequest`] skeleton is UNCHANGED: it still
/// holds NO IKM, salt, info, PRK, OKM, or other secret byte, and its three
/// `new_placeholder_*` constructors still take no such input. Stage 147
/// adds a SEPARATE, real derivation path alongside it:
/// [`derive_secret_handle_internal`] is this crate's first PRODUCTION
/// (not `#[cfg(test)]`-only) use of the `hkdf`/`sha2` dependencies —
/// previously exercised only by the `cfg(test)`-only `rfc5869_vectors`
/// module above (Stage 77/81/83), which remains unchanged and still passes
/// its own RFC 5869 vectors unmodified.
///
/// [`derive_secret_handle_internal`] is this module's first connection to
/// `secret_handle` (Stage 79/144–146): it takes a
/// `&`[`SecretHandle`](crate::secret_handle::SecretHandle) as input,
/// validates its [`SecretHandleKind`](crate::secret_handle::SecretHandleKind)
/// is `HkdfInputMaterial`, reads its bytes ONLY via `SecretHandle`'s own
/// narrowly-scoped `expose_bytes_for_internal_derivation` accessor (added
/// this stage, per `docs/secret_handle_api_shape.md` section 6/10), and
/// returns a brand-new `SecretHandle(HkdfOutputMaterial)` — it never
/// mutates the input handle, never returns a raw byte to its own caller,
/// and never constructs an `AeadPlaceholderRequest` or calls `aead_core`
/// (Stage 80) in any way: HKDF connects to `SecretHandle` in this stage,
/// AEAD connects to HKDF's output in a later, separate stage
/// (`docs/hkdf_internal_plan.md`, `docs/secret_lifecycle_implementation_plan.md`
/// section 9). This module also never calls `fedos_random_bytes_32` or
/// `fedos_aead_nonce_96` — both the salt and the info context are FIXED,
/// compile-time constants selected by [`HkdfDomain`], never a
/// caller-supplied or randomly-drawn byte.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle` and
/// `aead_core` above do. This is expected for a skeleton not yet wired to
/// any consumer.
#[allow(dead_code)]
mod kdf_core {
    use crate::secret_handle::{SecretHandle, SecretHandleKind};
    use crate::FedosCoreState;
    use hkdf::Hkdf;
    use sha2::Sha256;
    use zeroize::Zeroize;

    /// A supported KDF algorithm label — intent only, no implementation.
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum KdfAlgorithm {
        HkdfSha256,
    }

    /// Which KDF operation a [`KdfPlaceholderRequest`] represents — a label
    /// only, no bytes are extracted or expanded. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum KdfOperation {
        Extract,
        Expand,
        ExtractExpand,
    }

    /// A non-sensitive status snapshot for a [`KdfPlaceholderRequest`].
    /// Crate-private only. Never contains an IKM/salt/info/PRK/OKM byte —
    /// `state` reuses this crate's existing
    /// [`FedosCoreState`](crate::FedosCoreState) labels (`Unavailable` /
    /// `Placeholder`) rather than inventing a parallel enum.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct KdfRequestStatus {
        pub(crate) state: FedosCoreState,
    }

    /// An INTERNAL-ONLY KDF placeholder request skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds ONLY the two labels below — no IKM, salt,
    /// info, PRK, OKM, or other secret byte, and no `hkdf`/`sha2` type. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually extract/expand bytes behind `cfg(test)` first; until then it
    /// accepts and stores none.
    pub(crate) struct KdfPlaceholderRequest {
        algorithm: KdfAlgorithm,
        operation: KdfOperation,
    }

    impl KdfPlaceholderRequest {
        /// Construct a placeholder EXTRACT request. Takes NO IKM or salt
        /// input of any kind.
        pub(crate) fn new_placeholder_extract() -> Self {
            Self {
                algorithm: KdfAlgorithm::HkdfSha256,
                operation: KdfOperation::Extract,
            }
        }

        /// Construct a placeholder EXPAND request. Takes NO PRK or info
        /// input of any kind.
        pub(crate) fn new_placeholder_expand() -> Self {
            Self {
                algorithm: KdfAlgorithm::HkdfSha256,
                operation: KdfOperation::Expand,
            }
        }

        /// Construct a placeholder combined EXTRACT-THEN-EXPAND request.
        /// Takes NO IKM, salt, info, or length input of any kind.
        pub(crate) fn new_placeholder_extract_expand() -> Self {
            Self {
                algorithm: KdfAlgorithm::HkdfSha256,
                operation: KdfOperation::ExtractExpand,
            }
        }

        /// A non-sensitive status snapshot. Always `Placeholder` — this
        /// skeleton runs no cryptography, so there is no other state to
        /// report.
        pub(crate) fn status(&self) -> KdfRequestStatus {
            KdfRequestStatus {
                state: FedosCoreState::Placeholder,
            }
        }

        /// The algorithm label this request names — intent only.
        pub(crate) fn algorithm(&self) -> KdfAlgorithm {
            self.algorithm
        }

        /// The operation label this request names — intent only.
        pub(crate) fn operation(&self) -> KdfOperation {
            self.operation
        }
    }

    /// Stage 147 — which fixed domain a [`derive_secret_handle_internal`]
    /// call separates its output for. A non-sensitive label only — never a
    /// byte. Each variant maps to its OWN fixed salt and info context (see
    /// [`HkdfDomain::salt`]/[`HkdfDomain::info`]) so keys derived for
    /// different purposes from the SAME input `SecretHandle` never collide,
    /// per `docs/crypto_test_vectors.md` section 5's domain-separation rule.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum HkdfDomain {
        /// A top-level FedOS root-key derivation.
        RootKey,
        /// An identity/signing-key derivation.
        Identity,
        /// A storage-encryption-key derivation.
        Storage,
        /// A conversation/messaging-key derivation.
        Conversation,
        /// Reserved for this module's own tests / future test-only fixtures
        /// — never used by production call sites.
        TestOnly,
    }

    impl HkdfDomain {
        /// The fixed HKDF salt for this domain. Never derived from caller
        /// input, never random, never a parameter accepted from outside
        /// this module — a plain `&'static` byte-string literal chosen at
        /// compile time, the same "fixed label chosen at compile time"
        /// shape this crate's other label-holding types already use for
        /// their own fixed strings.
        const fn salt(self) -> &'static [u8] {
            match self {
                HkdfDomain::RootKey => b"fedos-hkdf-salt-root-key-v1",
                HkdfDomain::Identity => b"fedos-hkdf-salt-identity-v1",
                HkdfDomain::Storage => b"fedos-hkdf-salt-storage-v1",
                HkdfDomain::Conversation => b"fedos-hkdf-salt-conversation-v1",
                HkdfDomain::TestOnly => b"fedos-hkdf-salt-test-only-v1",
            }
        }

        /// The fixed HKDF `info` context for this domain — same rules as
        /// [`HkdfDomain::salt`]: fixed, `'static`, never caller-supplied.
        const fn info(self) -> &'static [u8] {
            match self {
                HkdfDomain::RootKey => b"fedos-hkdf-info-root-key-v1",
                HkdfDomain::Identity => b"fedos-hkdf-info-identity-v1",
                HkdfDomain::Storage => b"fedos-hkdf-info-storage-v1",
                HkdfDomain::Conversation => b"fedos-hkdf-info-conversation-v1",
                HkdfDomain::TestOnly => b"fedos-hkdf-info-test-only-v1",
            }
        }
    }

    /// Coarse observable outcome of a [`derive_secret_handle_internal`]
    /// call. Crate-private only. No secret byte is exposed through this
    /// label itself — only through [`HkdfDecision::output`] on `Ready`, and
    /// even then only as an opaque [`SecretHandle`], never a raw byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum HkdfStatus {
        /// Derivation succeeded; `HkdfDecision::output` is `Some`.
        Ready,
        /// The input `SecretHandle` was not `HkdfInputMaterial`-kinded, or
        /// held no real bytes (Stage 79 placeholder, or already `clear()`-ed)
        /// — `HkdfDecision::output` is `None`.
        InvalidInput,
        /// The underlying `hkdf` crate's `expand` step failed (RFC 5869
        /// section 2.3's `255 * HashLen` output-length ceiling) —
        /// unreachable in practice at this module's fixed 32-byte output,
        /// but matched exhaustively rather than assumed infallible,
        /// exactly like `fedos_random_bytes_32`/`fedos_aead_nonce_96`
        /// exhaustively match their own CSPRNG failure branch.
        InternalFailure,
    }

    /// The result of a [`derive_secret_handle_internal`] call. Crate-private
    /// only; never `Clone`/`Debug`-over-raw-bytes (deriving either would
    /// fail to compile, since `output: Option<SecretHandle>` and
    /// `SecretHandle` itself implements neither).
    pub(crate) struct HkdfDecision {
        pub(crate) domain: HkdfDomain,
        pub(crate) status: HkdfStatus,
        pub(crate) output: Option<SecretHandle>,
    }

    /// Derive a NEW `SecretHandle(HkdfOutputMaterial)` from an existing
    /// `SecretHandle(HkdfInputMaterial)` via HKDF-SHA256 (RFC 5869), using a
    /// fixed, `domain`-selected salt/info (never caller-supplied, never
    /// random). This is the ONLY place in this crate's production code that
    /// calls `hkdf`/`sha2`.
    ///
    /// Input validation: if `input.kind()` is not
    /// [`SecretHandleKind::HkdfInputMaterial`], or `input` holds no real
    /// bytes (the Stage 79 placeholder path, or a handle already
    /// `clear()`-ed), this returns [`HkdfStatus::InvalidInput`] with
    /// `output: None` — it never attempts a derivation against a
    /// wrong-kinded or empty handle.
    ///
    /// Does NOT call `fedos_random_bytes_32`, `fedos_aead_nonce_96`,
    /// `aead_core`, or any message-encryption operation — this function
    /// derives a key; it does not use one. Does not mutate `input` — the
    /// input handle is borrowed, not consumed, and is left exactly as it
    /// was (still `Holding`, still holding the same bytes) after this call
    /// returns, so the same input can be derived from again under a
    /// different `domain` for domain-separated sub-keys.
    pub(crate) fn derive_secret_handle_internal(
        input: &SecretHandle,
        domain: HkdfDomain,
    ) -> HkdfDecision {
        if input.kind() != SecretHandleKind::HkdfInputMaterial {
            return HkdfDecision {
                domain,
                status: HkdfStatus::InvalidInput,
                output: None,
            };
        }
        let mut ikm = match input.expose_bytes_for_internal_derivation() {
            Some(bytes) => bytes,
            None => {
                return HkdfDecision {
                    domain,
                    status: HkdfStatus::InvalidInput,
                    output: None,
                };
            }
        };
        let hk = Hkdf::<Sha256>::new(Some(domain.salt()), &ikm);
        ikm.zeroize();
        let mut okm = [0u8; 32];
        let decision = match hk.expand(domain.info(), &mut okm) {
            Ok(()) => HkdfDecision {
                domain,
                status: HkdfStatus::Ready,
                output: Some(SecretHandle::new_from_32_bytes_for_internal_use(
                    SecretHandleKind::HkdfOutputMaterial,
                    okm,
                )),
            },
            Err(_) => HkdfDecision {
                domain,
                status: HkdfStatus::InternalFailure,
                output: None,
            },
        };
        okm.zeroize();
        decision
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_extract_reports_extract_operation_only() {
            let request = KdfPlaceholderRequest::new_placeholder_extract();
            assert_eq!(request.operation(), KdfOperation::Extract);
            assert_eq!(request.algorithm(), KdfAlgorithm::HkdfSha256);
            assert_eq!(request.status().state, FedosCoreState::Placeholder);
        }

        #[test]
        fn new_placeholder_expand_reports_expand_operation_only() {
            let request = KdfPlaceholderRequest::new_placeholder_expand();
            assert_eq!(request.operation(), KdfOperation::Expand);
            assert_eq!(request.algorithm(), KdfAlgorithm::HkdfSha256);
            assert_eq!(request.status().state, FedosCoreState::Placeholder);
        }

        #[test]
        fn new_placeholder_extract_expand_reports_extract_expand_operation_only() {
            let request = KdfPlaceholderRequest::new_placeholder_extract_expand();
            assert_eq!(request.operation(), KdfOperation::ExtractExpand);
            assert_eq!(request.algorithm(), KdfAlgorithm::HkdfSha256);
            assert_eq!(request.status().state, FedosCoreState::Placeholder);
        }

        #[test]
        fn status_is_always_placeholder_only_no_real_cryptography() {
            for request in [
                KdfPlaceholderRequest::new_placeholder_extract(),
                KdfPlaceholderRequest::new_placeholder_expand(),
                KdfPlaceholderRequest::new_placeholder_extract_expand(),
            ] {
                assert_eq!(request.status().state, FedosCoreState::Placeholder);
            }
        }

        // A clearly-labeled, non-production test fixture — a fixed
        // repeating pattern, never a real key/seed/passphrase (mirrors
        // `secret_handle`'s own `TEST_FIXTURE_BYTES`).
        const TEST_IKM: [u8; 32] = [0xCD; 32];

        #[test]
        fn derive_secret_handle_internal_holds_input_and_produces_ready_output() {
            let input = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::HkdfInputMaterial,
                TEST_IKM,
            );
            let decision = derive_secret_handle_internal(&input, HkdfDomain::TestOnly);
            assert_eq!(decision.status, HkdfStatus::Ready);
            assert_eq!(decision.domain, HkdfDomain::TestOnly);
            // The input handle is untouched: still Holding, still HkdfInputMaterial.
            assert_eq!(input.kind(), SecretHandleKind::HkdfInputMaterial);
            assert!(!input.is_cleared());
        }

        #[test]
        fn derive_secret_handle_internal_produces_an_hkdf_output_material_secret_handle() {
            let input = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::HkdfInputMaterial,
                TEST_IKM,
            );
            let decision = derive_secret_handle_internal(&input, HkdfDomain::RootKey);
            let output = decision.output.expect("Ready decision must carry output");
            assert_eq!(output.kind(), SecretHandleKind::HkdfOutputMaterial);
        }

        #[test]
        fn derive_secret_handle_internal_preserves_the_requested_domain_for_every_variant() {
            let input = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::HkdfInputMaterial,
                TEST_IKM,
            );
            for domain in [
                HkdfDomain::RootKey,
                HkdfDomain::Identity,
                HkdfDomain::Storage,
                HkdfDomain::Conversation,
                HkdfDomain::TestOnly,
            ] {
                let decision = derive_secret_handle_internal(&input, domain);
                assert_eq!(decision.domain, domain);
                assert_eq!(decision.status, HkdfStatus::Ready);
            }
        }

        #[test]
        fn derive_secret_handle_internal_rejects_wrong_kind_input() {
            for input in [
                SecretHandle::new_placeholder(),
                SecretHandle::new_from_32_bytes_for_internal_use(
                    SecretHandleKind::AeadKeyMaterial,
                    TEST_IKM,
                ),
                SecretHandle::new_from_32_bytes_for_internal_use(
                    SecretHandleKind::TestOnlySecretMaterial,
                    TEST_IKM,
                ),
            ] {
                let decision = derive_secret_handle_internal(&input, HkdfDomain::TestOnly);
                assert_eq!(decision.status, HkdfStatus::InvalidInput);
                assert!(decision.output.is_none());
            }
        }

        #[test]
        fn derive_secret_handle_internal_rejects_a_cleared_input() {
            let mut input = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::HkdfInputMaterial,
                TEST_IKM,
            );
            input.clear();
            let decision = derive_secret_handle_internal(&input, HkdfDomain::TestOnly);
            assert_eq!(decision.status, HkdfStatus::InvalidInput);
            assert!(decision.output.is_none());
        }

        #[test]
        fn derive_secret_handle_internal_is_deterministic_for_the_same_input_and_domain() {
            let input = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::HkdfInputMaterial,
                TEST_IKM,
            );
            let first = derive_secret_handle_internal(&input, HkdfDomain::Storage)
                .output
                .expect("Ready decision must carry output");
            let second = derive_secret_handle_internal(&input, HkdfDomain::Storage)
                .output
                .expect("Ready decision must carry output");
            assert_eq!(
                first.expose_bytes_for_internal_derivation(),
                second.expose_bytes_for_internal_derivation()
            );
        }

        #[test]
        fn derive_secret_handle_internal_separates_output_by_domain() {
            let input = SecretHandle::new_from_32_bytes_for_internal_use(
                SecretHandleKind::HkdfInputMaterial,
                TEST_IKM,
            );
            let storage = derive_secret_handle_internal(&input, HkdfDomain::Storage)
                .output
                .expect("Ready decision must carry output");
            let conversation = derive_secret_handle_internal(&input, HkdfDomain::Conversation)
                .output
                .expect("Ready decision must carry output");
            assert_ne!(
                storage.expose_bytes_for_internal_derivation(),
                conversation.expose_bytes_for_internal_derivation()
            );
        }

        /// `HkdfDomain` supports exactly the five specified variants — an
        /// exhaustive match with no wildcard arm compiles only because no
        /// other variant exists to add one for.
        #[test]
        fn hkdf_domain_has_no_variant_other_than_the_five_specified() {
            let domain = HkdfDomain::TestOnly;
            match domain {
                HkdfDomain::RootKey => {}
                HkdfDomain::Identity => {}
                HkdfDomain::Storage => {}
                HkdfDomain::Conversation => {}
                HkdfDomain::TestOnly => {}
            }
        }
    }
}

/// Stage 87 — an INTERNAL-ONLY key-material handle skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`KeyMaterialHandle`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or `String`
/// field or parameter anywhere below, and no AEAD/HKDF/Argon2/NIP-44
/// operation is implemented or called. It reuses `secret_handle`'s
/// (Stage 79) exact placeholder-only pattern — a fixed, non-secret marker
/// wrapped in `secrecy::SecretBox`, zeroized on `clear()` — rather than
/// duplicating a second, divergent design; `subtle` (adopted Stage 78) is
/// intentionally NOT used yet, same reasoning as `secret_handle`. This
/// module does not connect to `secret_handle`, `aead_core` (Stage 80), or
/// `kdf_core` (Stage 82): it never constructs any of their types and never
/// reads a key/secret byte out of one — when in doubt about a connection
/// between skeletons, this crate deliberately leaves them unconnected
/// rather than guess at a future design (the same reasoning `aead_core`'s
/// own doc comment already states). It exists as a future AEAD/KDF
/// connection point: a place a later, explicitly-reviewed stage can extend
/// to actually hold key bytes, once it also implements the AEAD/KDF
/// operation that would consume them.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core` above do. This is expected for a skeleton not yet
/// wired to any consumer.
#[allow(dead_code)]
mod key_material {
    use secrecy::SecretBox;
    use zeroize::Zeroize;

    /// Coarse internal lifecycle state of a [`KeyMaterialHandle`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum KeyMaterialState {
        /// No placeholder marker has been allocated yet.
        Empty,
        /// A placeholder marker is allocated. Still holds no real key byte.
        Placeholder,
        /// [`KeyMaterialHandle::clear`] was called: the placeholder marker
        /// was zeroized and this handle must not be treated as holding
        /// anything.
        Cleared,
    }

    impl Default for KeyMaterialState {
        fn default() -> Self {
            KeyMaterialState::Empty
        }
    }

    /// Which future connection point a [`KeyMaterialHandle`] names — a
    /// label only, intent, not an implementation. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum KeyMaterialKind {
        /// Intended future connection point: an AEAD key (e.g. for
        /// `aead_core`, Stage 80). No AEAD key is held here.
        AeadKeyPlaceholder,
        /// Intended future connection point: KDF output (e.g. HKDF's OKM or
        /// Argon2id's tag, for `kdf_core`, Stage 82). No KDF output is held
        /// here.
        KdfOutputPlaceholder,
        /// Intended future connection point: a Nostr identity/signing key.
        /// No Nostr key is held here.
        NostrKeyPlaceholder,
        /// Any other future connection point not yet named above.
        UnknownPlaceholder,
    }

    /// A non-sensitive status snapshot for a [`KeyMaterialHandle`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct KeyMaterialStatus {
        pub(crate) state: KeyMaterialState,
    }

    /// A fixed, non-secret placeholder value. Exists ONLY so
    /// [`KeyMaterialHandle`] has a concrete `Zeroize`-able type to wrap in
    /// `secrecy::SecretBox` — its value is a constant, never derived from
    /// or holding any real key/seed/plaintext/ciphertext/passphrase/nonce
    /// byte. Identical in shape to `secret_handle`'s own `PlaceholderMarker`
    /// (Stage 79) — deliberately not shared across modules, so each
    /// skeleton stays independently reviewable.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    struct PlaceholderMarker(u8);

    impl Zeroize for PlaceholderMarker {
        fn zeroize(&mut self) {
            self.0 = 0;
        }
    }

    /// An INTERNAL-ONLY key-material handle skeleton (crate-private; not
    /// part of this crate's public API — see the module-level doc comment
    /// above). Holds NO real key, seed, plaintext, ciphertext, passphrase,
    /// or nonce byte: `marker` is the fixed, non-secret [`PlaceholderMarker`]
    /// above, wrapped in `secrecy::SecretBox` purely to exercise the
    /// secret-handling foundation adopted Stage 78, same as
    /// `secret_handle`. A future, explicitly-reviewed stage may extend this
    /// skeleton to hold real key bytes; until then it accepts and stores
    /// none.
    pub(crate) struct KeyMaterialHandle {
        state: KeyMaterialState,
        kind: KeyMaterialKind,
        marker: SecretBox<PlaceholderMarker>,
    }

    impl KeyMaterialHandle {
        /// Construct a placeholder handle of the given [`KeyMaterialKind`].
        /// Takes NO key, seed, plaintext, ciphertext, passphrase, or nonce
        /// input of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: KeyMaterialKind) -> Self {
            Self {
                state: KeyMaterialState::Placeholder,
                kind,
                marker: SecretBox::new(Box::new(PlaceholderMarker(0))),
            }
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> KeyMaterialStatus {
            KeyMaterialStatus { state: self.state }
        }

        /// The [`KeyMaterialKind`] label this handle was constructed with —
        /// intent only.
        pub(crate) fn kind(&self) -> KeyMaterialKind {
            self.kind
        }

        /// Zeroizes the (non-secret) placeholder marker and marks this
        /// handle `Cleared`. Does not return, expose, or copy the marker.
        pub(crate) fn clear(&mut self) {
            self.marker.zeroize();
            self.state = KeyMaterialState::Cleared;
        }

        /// Whether [`KeyMaterialHandle::clear`] has been called.
        pub(crate) fn is_cleared(&self) -> bool {
            self.state == KeyMaterialState::Cleared
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let handle = KeyMaterialHandle::new_placeholder(KeyMaterialKind::AeadKeyPlaceholder);
            assert_eq!(handle.status().state, KeyMaterialState::Placeholder);
            assert!(!handle.is_cleared());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                KeyMaterialKind::AeadKeyPlaceholder,
                KeyMaterialKind::KdfOutputPlaceholder,
                KeyMaterialKind::NostrKeyPlaceholder,
                KeyMaterialKind::UnknownPlaceholder,
            ] {
                let handle = KeyMaterialHandle::new_placeholder(kind);
                assert_eq!(handle.kind(), kind);
                assert_eq!(handle.status().state, KeyMaterialState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            // `KeyMaterialStatus` carries only the coarse state enum — no
            // secret byte, no marker, nothing derived from `marker`.
            let handle = KeyMaterialHandle::new_placeholder(KeyMaterialKind::KdfOutputPlaceholder);
            let status = handle.status();
            assert_eq!(status.state, KeyMaterialState::Placeholder);
        }

        #[test]
        fn clear_transitions_state_to_cleared_only() {
            let mut handle =
                KeyMaterialHandle::new_placeholder(KeyMaterialKind::NostrKeyPlaceholder);
            handle.clear();
            assert_eq!(handle.status().state, KeyMaterialState::Cleared);
            assert!(handle.is_cleared());
        }

        #[test]
        fn is_cleared_is_false_until_clear_is_called() {
            let handle = KeyMaterialHandle::new_placeholder(KeyMaterialKind::UnknownPlaceholder);
            assert!(!handle.is_cleared());
        }

        #[test]
        fn empty_state_is_the_default_placeholder_only_state() {
            assert_eq!(KeyMaterialState::default(), KeyMaterialState::Empty);
        }
    }
}

/// Stage 88 — an INTERNAL-ONLY domain-separation-label skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a [`DomainLabel`].
///
/// This module holds NO user-, environment-, or config-derived string — every
/// label [`DomainLabel::as_static_label`] can return is a fixed `&'static
/// str` literal, chosen at compile time from a [`DomainLabelKind`], never
/// built, formatted, concatenated, or read from any input, the process
/// environment, or runtime configuration. There is no `String` or owned
/// byte-buffer field
/// anywhere below — only the fixed `&'static str` table and the two label
/// enums. No AEAD/HKDF/Argon2/NIP-44 operation is implemented or called, and
/// no Nostr key is derived. This module does not connect to `secret_handle`
/// (Stage 79), `aead_core` (Stage 80), `kdf_core` (Stage 82), or
/// `key_material` (Stage 87): it never constructs any of their types and
/// never reads a key/secret byte out of one — when in doubt about a
/// connection between skeletons, this crate deliberately leaves them
/// unconnected rather than guess at a future design (the same reasoning
/// `aead_core`'s own doc comment already states). It exists in preparation
/// for a future HKDF/AEAD/NIP-44/Nostr-key-derivation connection point: a
/// place a later, explicitly-reviewed stage can extend to actually mix a
/// fixed label into a real derivation, once it also implements the
/// HKDF/AEAD/NIP-44 operation that would consume it.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material` above do. This is expected for a
/// skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod domain_label {
    /// Coarse internal lifecycle state of a [`DomainLabel`]. Crate-private
    /// only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum DomainLabelState {
        /// A fixed placeholder label is active and returnable.
        Placeholder,
        /// No fixed label should be treated as active — the default, inert
        /// state before any [`DomainLabel`] is constructed for use.
        Disabled,
    }

    impl Default for DomainLabelState {
        fn default() -> Self {
            DomainLabelState::Disabled
        }
    }

    /// Which future domain-separation connection point a [`DomainLabel`]
    /// names — a label identity only, not an implementation. Crate-private
    /// only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum DomainLabelKind {
        /// Intended future connection point: a top-level FedOS master
        /// domain-separation label. No master key is derived here.
        FedosMasterPlaceholder,
        /// Intended future connection point: an AEAD key label (e.g. for
        /// `aead_core`, Stage 80, or `key_material`, Stage 87). No AEAD key
        /// is derived here.
        AeadKeyPlaceholder,
        /// Intended future connection point: a KDF output label (e.g. for
        /// `kdf_core`, Stage 82). No KDF output is derived here.
        KdfOutputPlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// label. No Nostr key is derived here.
        NostrKeyPlaceholder,
        /// Intended future connection point: a NIP-44 encryption label. No
        /// NIP-44 operation is performed here.
        Nip44Placeholder,
        /// Reserved for this module's own tests / future test-only fixtures
        /// — never used by production code paths.
        TestOnlyPlaceholder,
    }

    impl DomainLabelKind {
        /// The fixed `&'static str` label for this kind. Never built,
        /// formatted, concatenated, or derived from any input — a plain
        /// literal chosen at compile time.
        const fn as_static_label(self) -> &'static str {
            match self {
                DomainLabelKind::FedosMasterPlaceholder => "fedos:placeholder:master",
                DomainLabelKind::AeadKeyPlaceholder => "fedos:placeholder:aead-key",
                DomainLabelKind::KdfOutputPlaceholder => "fedos:placeholder:kdf-output",
                DomainLabelKind::NostrKeyPlaceholder => "fedos:placeholder:nostr-key",
                DomainLabelKind::Nip44Placeholder => "fedos:placeholder:nip44",
                DomainLabelKind::TestOnlyPlaceholder => "fedos:placeholder:test-only",
            }
        }
    }

    /// A non-sensitive status snapshot for a [`DomainLabel`]. Crate-private
    /// only. Never contains a key/seed/plaintext/ciphertext/passphrase/nonce
    /// byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct DomainLabelStatus {
        pub(crate) state: DomainLabelState,
    }

    /// An INTERNAL-ONLY domain-separation-label handle skeleton
    /// (crate-private; not part of this crate's public API — see the
    /// module-level doc comment above). Holds only a [`DomainLabelKind`]
    /// label identity and a [`DomainLabelState`] — no key, seed, plaintext,
    /// ciphertext, passphrase, or nonce byte, and no user-, environment-, or
    /// config-derived string. A future, explicitly-reviewed stage may extend
    /// this skeleton to actually mix its fixed label into a real
    /// derivation; until then it accepts and stores none.
    pub(crate) struct DomainLabel {
        kind: DomainLabelKind,
        state: DomainLabelState,
    }

    impl DomainLabel {
        /// Construct a placeholder label handle of the given
        /// [`DomainLabelKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind — `kind` is a fixed label
        /// identity only.
        pub(crate) fn new_placeholder(kind: DomainLabelKind) -> Self {
            Self {
                kind,
                state: DomainLabelState::Placeholder,
            }
        }

        /// The [`DomainLabelKind`] this handle was constructed with —
        /// identity only.
        pub(crate) fn kind(&self) -> DomainLabelKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> DomainLabelStatus {
            DomainLabelStatus { state: self.state }
        }

        /// The fixed `&'static str` label for this handle's
        /// [`DomainLabelKind`] — never a `String`, never built/formatted/
        /// concatenated, never derived from user input, the process
        /// environment, or runtime configuration.
        pub(crate) fn as_static_label(&self) -> &'static str {
            self.kind.as_static_label()
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let label = DomainLabel::new_placeholder(DomainLabelKind::AeadKeyPlaceholder);
            assert_eq!(label.status().state, DomainLabelState::Placeholder);
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                DomainLabelKind::FedosMasterPlaceholder,
                DomainLabelKind::AeadKeyPlaceholder,
                DomainLabelKind::KdfOutputPlaceholder,
                DomainLabelKind::NostrKeyPlaceholder,
                DomainLabelKind::Nip44Placeholder,
                DomainLabelKind::TestOnlyPlaceholder,
            ] {
                let label = DomainLabel::new_placeholder(kind);
                assert_eq!(label.kind(), kind);
                assert_eq!(label.status().state, DomainLabelState::Placeholder);
            }
        }

        #[test]
        fn as_static_label_returns_the_documented_fixed_string_per_kind() {
            let expected = [
                (DomainLabelKind::FedosMasterPlaceholder, "fedos:placeholder:master"),
                (DomainLabelKind::AeadKeyPlaceholder, "fedos:placeholder:aead-key"),
                (DomainLabelKind::KdfOutputPlaceholder, "fedos:placeholder:kdf-output"),
                (DomainLabelKind::NostrKeyPlaceholder, "fedos:placeholder:nostr-key"),
                (DomainLabelKind::Nip44Placeholder, "fedos:placeholder:nip44"),
                (DomainLabelKind::TestOnlyPlaceholder, "fedos:placeholder:test-only"),
            ];
            for (kind, expected_label) in expected {
                let label = DomainLabel::new_placeholder(kind);
                assert_eq!(label.as_static_label(), expected_label);
            }
        }

        #[test]
        fn as_static_label_is_stable_across_repeated_calls() {
            let label = DomainLabel::new_placeholder(DomainLabelKind::Nip44Placeholder);
            assert_eq!(label.as_static_label(), label.as_static_label());
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(DomainLabelState::default(), DomainLabelState::Disabled);
        }
    }
}

/// Stage 89 — an INTERNAL-ONLY operation-context skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns an
/// [`OperationContext`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or `String`
/// field or parameter anywhere below, and no AEAD/HKDF/Argon2/NIP-44
/// operation is implemented or called, and no Nostr key is derived. It
/// takes no user-, environment-, or config-derived input of any kind —
/// [`OperationContext::new_placeholder`] accepts only an [`OperationKind`]
/// label. This module does not connect to `secret_handle` (Stage 79),
/// `aead_core` (Stage 80), `kdf_core` (Stage 82), `key_material` (Stage 87),
/// or `domain_label` (Stage 88): it never constructs any of their types and
/// never reads a key/secret/label byte out of one — when in doubt about a
/// connection between skeletons, this crate deliberately leaves them
/// unconnected rather than guess at a future design (the same reasoning
/// `aead_core`'s own doc comment already states). It exists as a type basis
/// a later, explicitly-reviewed stage can extend to actually name and
/// eventually run a real AEAD/KDF/NIP-44/Nostr-key-derivation operation,
/// once it also implements that operation.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label` above do. This is
/// expected for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod operation_context {
    /// Coarse internal lifecycle state of an [`OperationContext`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum OperationContextState {
        /// A placeholder operation context is active. Runs no cryptography.
        Placeholder,
        /// No operation context should be treated as active — the default,
        /// inert state before any [`OperationContext`] is constructed for
        /// use.
        Disabled,
    }

    impl Default for OperationContextState {
        fn default() -> Self {
            OperationContextState::Disabled
        }
    }

    /// Which future cryptographic operation an [`OperationContext`] names —
    /// a label only, intent, not an implementation. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum OperationKind {
        /// Intended future connection point: an AEAD seal/encrypt
        /// operation. No AEAD encryption is performed here.
        AeadEncryptPlaceholder,
        /// Intended future connection point: an AEAD open/decrypt
        /// operation. No AEAD decryption is performed here.
        AeadDecryptPlaceholder,
        /// Intended future connection point: an HKDF extract step. No HKDF
        /// extraction is performed here.
        HkdfExtractPlaceholder,
        /// Intended future connection point: an HKDF expand step. No HKDF
        /// expansion is performed here.
        HkdfExpandPlaceholder,
        /// Intended future connection point: a combined HKDF
        /// extract-then-expand step. No HKDF operation is performed here.
        HkdfExtractExpandPlaceholder,
        /// Intended future connection point: an Argon2id hash operation. No
        /// Argon2id hashing is performed here.
        Argon2idPlaceholder,
        /// Intended future connection point: a NIP-44 encrypt operation. No
        /// NIP-44 encryption is performed here.
        Nip44EncryptPlaceholder,
        /// Intended future connection point: a NIP-44 decrypt operation. No
        /// NIP-44 decryption is performed here.
        Nip44DecryptPlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation. No Nostr key is derived here.
        NostrKeyDerivationPlaceholder,
        /// Reserved for this module's own tests / future test-only fixtures
        /// — never used by production code paths.
        TestOnlyPlaceholder,
    }

    /// A non-sensitive status snapshot for an [`OperationContext`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct OperationContextStatus {
        pub(crate) state: OperationContextState,
    }

    /// An INTERNAL-ONLY operation-context handle skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only an [`OperationKind`] label and an
    /// [`OperationContextState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, or nonce byte, and no user-, environment-, or
    /// config-derived input. A future, explicitly-reviewed stage may extend
    /// this skeleton to actually run the named operation; until then it
    /// accepts and stores none.
    pub(crate) struct OperationContext {
        kind: OperationKind,
        state: OperationContextState,
    }

    impl OperationContext {
        /// Construct a placeholder operation context of the given
        /// [`OperationKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: OperationKind) -> Self {
            Self {
                kind,
                state: OperationContextState::Placeholder,
            }
        }

        /// The [`OperationKind`] label this context was constructed with —
        /// intent only.
        pub(crate) fn kind(&self) -> OperationKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> OperationContextStatus {
            OperationContextStatus { state: self.state }
        }

        /// Whether this context is still in the [`OperationContextState::Placeholder`]
        /// state — always `true` for any handle constructed via
        /// [`OperationContext::new_placeholder`], since no other
        /// constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == OperationContextState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let context = OperationContext::new_placeholder(OperationKind::AeadEncryptPlaceholder);
            assert_eq!(context.status().state, OperationContextState::Placeholder);
            assert!(context.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                OperationKind::AeadEncryptPlaceholder,
                OperationKind::AeadDecryptPlaceholder,
                OperationKind::HkdfExtractPlaceholder,
                OperationKind::HkdfExpandPlaceholder,
                OperationKind::HkdfExtractExpandPlaceholder,
                OperationKind::Argon2idPlaceholder,
                OperationKind::Nip44EncryptPlaceholder,
                OperationKind::Nip44DecryptPlaceholder,
                OperationKind::NostrKeyDerivationPlaceholder,
                OperationKind::TestOnlyPlaceholder,
            ] {
                let context = OperationContext::new_placeholder(kind);
                assert_eq!(context.kind(), kind);
                assert_eq!(context.status().state, OperationContextState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let context = OperationContext::new_placeholder(OperationKind::HkdfExtractPlaceholder);
            let status = context.status();
            assert_eq!(status.state, OperationContextState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_context() {
            for kind in [
                OperationKind::Argon2idPlaceholder,
                OperationKind::Nip44DecryptPlaceholder,
                OperationKind::TestOnlyPlaceholder,
            ] {
                assert!(OperationContext::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(OperationContextState::default(), OperationContextState::Disabled);
        }
    }
}

/// Stage 90 — an INTERNAL-ONLY request-descriptor skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`RequestDescriptor`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or `String`
/// field or parameter anywhere below, and no AEAD/HKDF/Argon2/NIP-44
/// operation is implemented or called, and no Nostr key is derived. It
/// takes no user-, environment-, or config-derived input of any kind —
/// [`RequestDescriptor::new_placeholder`] accepts only a
/// [`RequestDescriptorKind`] label. This module does not connect to
/// `secret_handle` (Stage 79), `aead_core` (Stage 80), `kdf_core` (Stage
/// 82), `key_material` (Stage 87), `domain_label` (Stage 88), or
/// `operation_context` (Stage 89): it never constructs any of their types
/// and never reads a key/secret/label/operation byte out of one — when in
/// doubt about a connection between skeletons, this crate deliberately
/// leaves them unconnected rather than guess at a future design (the same
/// reasoning `aead_core`'s own doc comment already states). It exists as a
/// non-sensitive-metadata type basis a later, explicitly-reviewed stage can
/// extend to actually describe a real AEAD/KDF/NIP-44/Nostr-key-derivation
/// operation REQUEST, once it also implements the operation the request
/// would describe.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`
/// above do. This is expected for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod request_descriptor {
    /// Coarse internal lifecycle state of a [`RequestDescriptor`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum RequestDescriptorState {
        /// A placeholder request descriptor is active. Describes no real
        /// request; runs no cryptography.
        Placeholder,
        /// No request descriptor should be treated as active — the
        /// default, inert state before any [`RequestDescriptor`] is
        /// constructed for use.
        Disabled,
    }

    impl Default for RequestDescriptorState {
        fn default() -> Self {
            RequestDescriptorState::Disabled
        }
    }

    /// Which future cryptographic operation REQUEST a [`RequestDescriptor`]
    /// names — a label only, intent, not an implementation and not a real
    /// request payload. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum RequestDescriptorKind {
        /// Intended future connection point: an AEAD seal/encrypt request.
        /// No AEAD encryption request is described here.
        AeadEncryptRequestPlaceholder,
        /// Intended future connection point: an AEAD open/decrypt request.
        /// No AEAD decryption request is described here.
        AeadDecryptRequestPlaceholder,
        /// Intended future connection point: an HKDF extract request. No
        /// HKDF extraction request is described here.
        HkdfExtractRequestPlaceholder,
        /// Intended future connection point: an HKDF expand request. No
        /// HKDF expansion request is described here.
        HkdfExpandRequestPlaceholder,
        /// Intended future connection point: a combined HKDF
        /// extract-then-expand request. No HKDF request is described here.
        HkdfExtractExpandRequestPlaceholder,
        /// Intended future connection point: an Argon2id hash request. No
        /// Argon2id hashing request is described here.
        Argon2idRequestPlaceholder,
        /// Intended future connection point: a NIP-44 encrypt request. No
        /// NIP-44 encryption request is described here.
        Nip44EncryptRequestPlaceholder,
        /// Intended future connection point: a NIP-44 decrypt request. No
        /// NIP-44 decryption request is described here.
        Nip44DecryptRequestPlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation request. No Nostr key derivation request is
        /// described here.
        NostrKeyDerivationRequestPlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyRequestPlaceholder,
    }

    /// A non-sensitive status snapshot for a [`RequestDescriptor`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct RequestDescriptorStatus {
        pub(crate) state: RequestDescriptorState,
    }

    /// An INTERNAL-ONLY request-descriptor handle skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only a [`RequestDescriptorKind`] label and a
    /// [`RequestDescriptorState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, or nonce byte, and no user-, environment-, or
    /// config-derived input. A future, explicitly-reviewed stage may extend
    /// this skeleton to actually describe a real request; until then it
    /// accepts and stores none.
    pub(crate) struct RequestDescriptor {
        kind: RequestDescriptorKind,
        state: RequestDescriptorState,
    }

    impl RequestDescriptor {
        /// Construct a placeholder request descriptor of the given
        /// [`RequestDescriptorKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: RequestDescriptorKind) -> Self {
            Self {
                kind,
                state: RequestDescriptorState::Placeholder,
            }
        }

        /// The [`RequestDescriptorKind`] label this descriptor was
        /// constructed with — intent only.
        pub(crate) fn kind(&self) -> RequestDescriptorKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> RequestDescriptorStatus {
            RequestDescriptorStatus { state: self.state }
        }

        /// Whether this descriptor is still in the
        /// [`RequestDescriptorState::Placeholder`] state — always `true`
        /// for any handle constructed via
        /// [`RequestDescriptor::new_placeholder`], since no other
        /// constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == RequestDescriptorState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let descriptor =
                RequestDescriptor::new_placeholder(RequestDescriptorKind::AeadEncryptRequestPlaceholder);
            assert_eq!(descriptor.status().state, RequestDescriptorState::Placeholder);
            assert!(descriptor.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                RequestDescriptorKind::AeadEncryptRequestPlaceholder,
                RequestDescriptorKind::AeadDecryptRequestPlaceholder,
                RequestDescriptorKind::HkdfExtractRequestPlaceholder,
                RequestDescriptorKind::HkdfExpandRequestPlaceholder,
                RequestDescriptorKind::HkdfExtractExpandRequestPlaceholder,
                RequestDescriptorKind::Argon2idRequestPlaceholder,
                RequestDescriptorKind::Nip44EncryptRequestPlaceholder,
                RequestDescriptorKind::Nip44DecryptRequestPlaceholder,
                RequestDescriptorKind::NostrKeyDerivationRequestPlaceholder,
                RequestDescriptorKind::TestOnlyRequestPlaceholder,
            ] {
                let descriptor = RequestDescriptor::new_placeholder(kind);
                assert_eq!(descriptor.kind(), kind);
                assert_eq!(descriptor.status().state, RequestDescriptorState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let descriptor =
                RequestDescriptor::new_placeholder(RequestDescriptorKind::HkdfExtractRequestPlaceholder);
            let status = descriptor.status();
            assert_eq!(status.state, RequestDescriptorState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_descriptor() {
            for kind in [
                RequestDescriptorKind::Argon2idRequestPlaceholder,
                RequestDescriptorKind::Nip44DecryptRequestPlaceholder,
                RequestDescriptorKind::TestOnlyRequestPlaceholder,
            ] {
                assert!(RequestDescriptor::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(
                RequestDescriptorState::default(),
                RequestDescriptorState::Disabled
            );
        }
    }
}

/// Stage 91 — an INTERNAL-ONLY response-descriptor skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`ResponseDescriptor`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, no result payload of any
/// kind, and no AEAD/HKDF/Argon2/NIP-44 operation is implemented or called,
/// and no Nostr key is derived. It takes no user-, environment-, or
/// config-derived input of any kind —
/// [`ResponseDescriptor::new_placeholder`] accepts only a
/// [`ResponseDescriptorKind`] label, and
/// [`ResponseDescriptor::new_error_placeholder`] accepts nothing at all.
/// This module does not connect to `secret_handle` (Stage 79), `aead_core`
/// (Stage 80), `kdf_core` (Stage 82), `key_material` (Stage 87),
/// `domain_label` (Stage 88), `operation_context` (Stage 89), or
/// `request_descriptor` (Stage 90): it never constructs any of their types
/// and never reads a key/secret/label/operation/request byte out of one —
/// when in doubt about a connection between skeletons, this crate
/// deliberately leaves them unconnected rather than guess at a future
/// design (the same reasoning `aead_core`'s own doc comment already
/// states). It exists as a non-sensitive-metadata type basis a later,
/// explicitly-reviewed stage can extend to actually describe a real
/// AEAD/KDF/NIP-44/Nostr-key-derivation operation RESULT, once it also
/// implements the operation the response would describe.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor` above do. This is expected for a skeleton not yet
/// wired to any consumer.
#[allow(dead_code)]
mod response_descriptor {
    /// Coarse internal lifecycle state of a [`ResponseDescriptor`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ResponseDescriptorState {
        /// A placeholder response descriptor is active. Describes no real
        /// result; runs no cryptography.
        Placeholder,
        /// No response descriptor should be treated as active — the
        /// default, inert state before any [`ResponseDescriptor`] is
        /// constructed for use.
        Disabled,
        /// A placeholder ERROR response descriptor is active — describes
        /// only that a future real operation would have failed, never a
        /// real error payload/message/cause byte.
        ErrorPlaceholder,
    }

    impl Default for ResponseDescriptorState {
        fn default() -> Self {
            ResponseDescriptorState::Disabled
        }
    }

    /// Which future cryptographic operation RESULT a [`ResponseDescriptor`]
    /// names — a label only, intent, not an implementation and not a real
    /// result payload. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ResponseDescriptorKind {
        /// Intended future connection point: an AEAD ciphertext result. No
        /// AEAD ciphertext is described here.
        AeadCiphertextPlaceholder,
        /// Intended future connection point: an AEAD plaintext result. No
        /// AEAD plaintext is described here.
        AeadPlaintextPlaceholder,
        /// Intended future connection point: an HKDF PRK result. No HKDF
        /// PRK is described here.
        HkdfPrkPlaceholder,
        /// Intended future connection point: an HKDF OKM result. No HKDF
        /// OKM is described here.
        HkdfOkmPlaceholder,
        /// Intended future connection point: an Argon2id tag result. No
        /// Argon2id tag is described here.
        Argon2idTagPlaceholder,
        /// Intended future connection point: a NIP-44 ciphertext result. No
        /// NIP-44 ciphertext is described here.
        Nip44CiphertextPlaceholder,
        /// Intended future connection point: a NIP-44 plaintext result. No
        /// NIP-44 plaintext is described here.
        Nip44PlaintextPlaceholder,
        /// Intended future connection point: a Nostr secret-key derivation
        /// result. No Nostr secret key is described here.
        NostrSecretKeyPlaceholder,
        /// Intended future connection point: a Nostr public-key derivation
        /// result. No Nostr public key is described here.
        NostrPublicKeyPlaceholder,
        /// A placeholder ERROR result label — pairs with
        /// [`ResponseDescriptorState::ErrorPlaceholder`]. Never a real error
        /// payload/message/cause byte.
        ErrorPlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyPlaceholder,
    }

    /// A non-sensitive status snapshot for a [`ResponseDescriptor`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct ResponseDescriptorStatus {
        pub(crate) state: ResponseDescriptorState,
    }

    /// An INTERNAL-ONLY response-descriptor handle skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only a [`ResponseDescriptorKind`] label and a
    /// [`ResponseDescriptorState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, and no user-, environment-, or
    /// config-derived input, and no result payload of any kind. A future,
    /// explicitly-reviewed stage may extend this skeleton to actually
    /// describe a real response; until then it accepts and stores none.
    pub(crate) struct ResponseDescriptor {
        kind: ResponseDescriptorKind,
        state: ResponseDescriptorState,
    }

    impl ResponseDescriptor {
        /// Construct a placeholder response descriptor of the given
        /// [`ResponseDescriptorKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind, and no result payload of any
        /// kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: ResponseDescriptorKind) -> Self {
            Self {
                kind,
                state: ResponseDescriptorState::Placeholder,
            }
        }

        /// Construct a placeholder ERROR response descriptor. Takes NO
        /// input of any kind — never a real error payload/message/cause
        /// byte. Always pairs [`ResponseDescriptorKind::ErrorPlaceholder`]
        /// with [`ResponseDescriptorState::ErrorPlaceholder`].
        pub(crate) fn new_error_placeholder() -> Self {
            Self {
                kind: ResponseDescriptorKind::ErrorPlaceholder,
                state: ResponseDescriptorState::ErrorPlaceholder,
            }
        }

        /// The [`ResponseDescriptorKind`] label this descriptor was
        /// constructed with — intent only.
        pub(crate) fn kind(&self) -> ResponseDescriptorKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> ResponseDescriptorStatus {
            ResponseDescriptorStatus { state: self.state }
        }

        /// Whether this descriptor is in the
        /// [`ResponseDescriptorState::Placeholder`] state — `true` for any
        /// handle constructed via
        /// [`ResponseDescriptor::new_placeholder`], `false` for one
        /// constructed via [`ResponseDescriptor::new_error_placeholder`].
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == ResponseDescriptorState::Placeholder
        }

        /// Whether this descriptor is in the
        /// [`ResponseDescriptorState::ErrorPlaceholder`] state — `true`
        /// only for a handle constructed via
        /// [`ResponseDescriptor::new_error_placeholder`].
        pub(crate) fn is_error_placeholder(&self) -> bool {
            self.state == ResponseDescriptorState::ErrorPlaceholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let descriptor =
                ResponseDescriptor::new_placeholder(ResponseDescriptorKind::AeadCiphertextPlaceholder);
            assert_eq!(descriptor.status().state, ResponseDescriptorState::Placeholder);
            assert!(descriptor.is_placeholder());
            assert!(!descriptor.is_error_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                ResponseDescriptorKind::AeadCiphertextPlaceholder,
                ResponseDescriptorKind::AeadPlaintextPlaceholder,
                ResponseDescriptorKind::HkdfPrkPlaceholder,
                ResponseDescriptorKind::HkdfOkmPlaceholder,
                ResponseDescriptorKind::Argon2idTagPlaceholder,
                ResponseDescriptorKind::Nip44CiphertextPlaceholder,
                ResponseDescriptorKind::Nip44PlaintextPlaceholder,
                ResponseDescriptorKind::NostrSecretKeyPlaceholder,
                ResponseDescriptorKind::NostrPublicKeyPlaceholder,
                ResponseDescriptorKind::TestOnlyPlaceholder,
            ] {
                let descriptor = ResponseDescriptor::new_placeholder(kind);
                assert_eq!(descriptor.kind(), kind);
                assert_eq!(descriptor.status().state, ResponseDescriptorState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let descriptor =
                ResponseDescriptor::new_placeholder(ResponseDescriptorKind::HkdfPrkPlaceholder);
            let status = descriptor.status();
            assert_eq!(status.state, ResponseDescriptorState::Placeholder);
        }

        #[test]
        fn new_error_placeholder_pairs_error_kind_with_error_state() {
            let descriptor = ResponseDescriptor::new_error_placeholder();
            assert_eq!(descriptor.kind(), ResponseDescriptorKind::ErrorPlaceholder);
            assert_eq!(
                descriptor.status().state,
                ResponseDescriptorState::ErrorPlaceholder
            );
            assert!(descriptor.is_error_placeholder());
            assert!(!descriptor.is_placeholder());
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(
                ResponseDescriptorState::default(),
                ResponseDescriptorState::Disabled
            );
        }
    }
}

/// Stage 92 — an INTERNAL-ONLY crypto-pipeline skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a [`CryptoPipeline`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It takes no user-, environment-, or config-derived input of any kind —
/// [`CryptoPipeline::new_placeholder`] accepts only a [`CryptoPipelineKind`]
/// label. This module does not connect to `secret_handle` (Stage 79),
/// `aead_core` (Stage 80), `kdf_core` (Stage 82), `key_material` (Stage 87),
/// `domain_label` (Stage 88), `operation_context` (Stage 89),
/// `request_descriptor` (Stage 90), or `response_descriptor` (Stage 91): it
/// never constructs any of their types and never reads a key/secret/label/
/// operation/request/response byte out of one — when in doubt about a
/// connection between skeletons, this crate deliberately leaves them
/// unconnected rather than guess at a future design (the same reasoning
/// `aead_core`'s own doc comment already states). It exists as a type basis
/// a later, explicitly-reviewed stage can extend to actually bundle the
/// descriptor/context/label/key-material skeletons above into a real
/// AEAD/KDF/NIP-44/Nostr-key-derivation pipeline, once it also implements
/// the operation that pipeline would run.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor`/`response_descriptor` above do. This is expected
/// for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod crypto_pipeline {
    /// Coarse internal lifecycle state of a [`CryptoPipeline`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum CryptoPipelineState {
        /// A placeholder pipeline is active. Runs no cryptography and
        /// bundles no descriptor.
        Placeholder,
        /// No pipeline should be treated as active — the default, inert
        /// state before any [`CryptoPipeline`] is constructed for use.
        Disabled,
    }

    impl Default for CryptoPipelineState {
        fn default() -> Self {
            CryptoPipelineState::Disabled
        }
    }

    /// Which future cryptographic PIPELINE a [`CryptoPipeline`] names — a
    /// label only, intent, not an implementation and not a real bundling of
    /// descriptors. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum CryptoPipelineKind {
        /// Intended future connection point: an AEAD encrypt/decrypt
        /// pipeline. No AEAD pipeline is bundled here.
        AeadPipelinePlaceholder,
        /// Intended future connection point: an HKDF extract/expand
        /// pipeline. No KDF pipeline is bundled here.
        KdfPipelinePlaceholder,
        /// Intended future connection point: an Argon2id hashing pipeline.
        /// No Argon2id pipeline is bundled here.
        Argon2idPipelinePlaceholder,
        /// Intended future connection point: a NIP-44 encrypt/decrypt
        /// pipeline. No NIP-44 pipeline is bundled here.
        Nip44PipelinePlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation pipeline. No Nostr key pipeline is bundled here.
        NostrKeyPipelinePlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyPipelinePlaceholder,
    }

    /// A non-sensitive status snapshot for a [`CryptoPipeline`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct CryptoPipelineStatus {
        pub(crate) state: CryptoPipelineState,
    }

    /// An INTERNAL-ONLY crypto-pipeline handle skeleton (crate-private; not
    /// part of this crate's public API — see the module-level doc comment
    /// above). Holds only a [`CryptoPipelineKind`] label and a
    /// [`CryptoPipelineState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, and no user-, environment-, or
    /// config-derived input, and no bundled descriptor of any kind. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually bundle a real pipeline; until then it accepts and stores
    /// none.
    pub(crate) struct CryptoPipeline {
        kind: CryptoPipelineKind,
        state: CryptoPipelineState,
    }

    impl CryptoPipeline {
        /// Construct a placeholder pipeline of the given
        /// [`CryptoPipelineKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind, and bundles no descriptor of
        /// any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: CryptoPipelineKind) -> Self {
            Self {
                kind,
                state: CryptoPipelineState::Placeholder,
            }
        }

        /// The [`CryptoPipelineKind`] label this pipeline was constructed
        /// with — intent only.
        pub(crate) fn kind(&self) -> CryptoPipelineKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> CryptoPipelineStatus {
            CryptoPipelineStatus { state: self.state }
        }

        /// Whether this pipeline is still in the
        /// [`CryptoPipelineState::Placeholder`] state — always `true` for
        /// any handle constructed via [`CryptoPipeline::new_placeholder`],
        /// since no other constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == CryptoPipelineState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let pipeline = CryptoPipeline::new_placeholder(CryptoPipelineKind::AeadPipelinePlaceholder);
            assert_eq!(pipeline.status().state, CryptoPipelineState::Placeholder);
            assert!(pipeline.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                CryptoPipelineKind::AeadPipelinePlaceholder,
                CryptoPipelineKind::KdfPipelinePlaceholder,
                CryptoPipelineKind::Argon2idPipelinePlaceholder,
                CryptoPipelineKind::Nip44PipelinePlaceholder,
                CryptoPipelineKind::NostrKeyPipelinePlaceholder,
                CryptoPipelineKind::TestOnlyPipelinePlaceholder,
            ] {
                let pipeline = CryptoPipeline::new_placeholder(kind);
                assert_eq!(pipeline.kind(), kind);
                assert_eq!(pipeline.status().state, CryptoPipelineState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let pipeline = CryptoPipeline::new_placeholder(CryptoPipelineKind::KdfPipelinePlaceholder);
            let status = pipeline.status();
            assert_eq!(status.state, CryptoPipelineState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_pipeline() {
            for kind in [
                CryptoPipelineKind::Argon2idPipelinePlaceholder,
                CryptoPipelineKind::Nip44PipelinePlaceholder,
                CryptoPipelineKind::TestOnlyPipelinePlaceholder,
            ] {
                assert!(CryptoPipeline::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(CryptoPipelineState::default(), CryptoPipelineState::Disabled);
        }
    }
}

/// Stage 93 — an INTERNAL-ONLY descriptor-bundle skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`DescriptorBundle`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It takes no user-, environment-, or config-derived input of any kind —
/// [`DescriptorBundle::new_placeholder`] accepts only a
/// [`DescriptorBundleKind`] label. Unlike a future real bundle, this
/// skeleton does NOT hold an instance of any other skeleton type: it does
/// not connect to `secret_handle` (Stage 79), `aead_core` (Stage 80),
/// `kdf_core` (Stage 82), `key_material` (Stage 87), `domain_label` (Stage
/// 88), `operation_context` (Stage 89), `request_descriptor` (Stage 90),
/// `response_descriptor` (Stage 91), or `crypto_pipeline` (Stage 92) — it
/// never constructs, stores, or reads a field of any of their types — when
/// in doubt about a connection between skeletons, this crate deliberately
/// leaves them unconnected rather than guess at a future design (the same
/// reasoning `aead_core`'s own doc comment already states). It exists as a
/// fully independent, label-only type basis a later, explicitly-reviewed
/// stage can extend to actually group the descriptor/context/label/
/// key-material skeletons above into a real bundle, once it also
/// implements the operation that bundle would support.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor`/`response_descriptor`/`crypto_pipeline` above do.
/// This is expected for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod descriptor_bundle {
    /// Coarse internal lifecycle state of a [`DescriptorBundle`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum DescriptorBundleState {
        /// A placeholder bundle is active. Groups no real descriptor; runs
        /// no cryptography.
        Placeholder,
        /// No bundle should be treated as active — the default, inert
        /// state before any [`DescriptorBundle`] is constructed for use.
        Disabled,
    }

    impl Default for DescriptorBundleState {
        fn default() -> Self {
            DescriptorBundleState::Disabled
        }
    }

    /// Which future cryptographic BUNDLE a [`DescriptorBundle`] names — a
    /// label only, intent, not an implementation and not a real grouping of
    /// descriptors. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum DescriptorBundleKind {
        /// Intended future connection point: an AEAD request/response
        /// bundle. No AEAD bundle is grouped here.
        AeadBundlePlaceholder,
        /// Intended future connection point: an HKDF request/response
        /// bundle. No KDF bundle is grouped here.
        KdfBundlePlaceholder,
        /// Intended future connection point: an Argon2id request/response
        /// bundle. No Argon2id bundle is grouped here.
        Argon2idBundlePlaceholder,
        /// Intended future connection point: a NIP-44 request/response
        /// bundle. No NIP-44 bundle is grouped here.
        Nip44BundlePlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation bundle. No Nostr key bundle is grouped here.
        NostrKeyBundlePlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyBundlePlaceholder,
    }

    /// A non-sensitive status snapshot for a [`DescriptorBundle`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct DescriptorBundleStatus {
        pub(crate) state: DescriptorBundleState,
    }

    /// An INTERNAL-ONLY descriptor-bundle handle skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only a [`DescriptorBundleKind`] label and a
    /// [`DescriptorBundleState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, no user-, environment-, or
    /// config-derived input, and no field of any other skeleton's type
    /// from `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
    /// `domain_label`, `operation_context`, `request_descriptor`,
    /// `response_descriptor`, or `crypto_pipeline`. A future,
    /// explicitly-reviewed stage may extend this skeleton to actually
    /// group a real bundle; until then it accepts and stores none.
    pub(crate) struct DescriptorBundle {
        kind: DescriptorBundleKind,
        state: DescriptorBundleState,
    }

    impl DescriptorBundle {
        /// Construct a placeholder bundle of the given
        /// [`DescriptorBundleKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind, and groups no descriptor of
        /// any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: DescriptorBundleKind) -> Self {
            Self {
                kind,
                state: DescriptorBundleState::Placeholder,
            }
        }

        /// The [`DescriptorBundleKind`] label this bundle was constructed
        /// with — intent only.
        pub(crate) fn kind(&self) -> DescriptorBundleKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> DescriptorBundleStatus {
            DescriptorBundleStatus { state: self.state }
        }

        /// Whether this bundle is still in the
        /// [`DescriptorBundleState::Placeholder`] state — always `true` for
        /// any handle constructed via [`DescriptorBundle::new_placeholder`],
        /// since no other constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == DescriptorBundleState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let bundle = DescriptorBundle::new_placeholder(DescriptorBundleKind::AeadBundlePlaceholder);
            assert_eq!(bundle.status().state, DescriptorBundleState::Placeholder);
            assert!(bundle.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                DescriptorBundleKind::AeadBundlePlaceholder,
                DescriptorBundleKind::KdfBundlePlaceholder,
                DescriptorBundleKind::Argon2idBundlePlaceholder,
                DescriptorBundleKind::Nip44BundlePlaceholder,
                DescriptorBundleKind::NostrKeyBundlePlaceholder,
                DescriptorBundleKind::TestOnlyBundlePlaceholder,
            ] {
                let bundle = DescriptorBundle::new_placeholder(kind);
                assert_eq!(bundle.kind(), kind);
                assert_eq!(bundle.status().state, DescriptorBundleState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let bundle = DescriptorBundle::new_placeholder(DescriptorBundleKind::KdfBundlePlaceholder);
            let status = bundle.status();
            assert_eq!(status.state, DescriptorBundleState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_bundle() {
            for kind in [
                DescriptorBundleKind::Argon2idBundlePlaceholder,
                DescriptorBundleKind::Nip44BundlePlaceholder,
                DescriptorBundleKind::TestOnlyBundlePlaceholder,
            ] {
                assert!(DescriptorBundle::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(
                DescriptorBundleState::default(),
                DescriptorBundleState::Disabled
            );
        }
    }
}

/// Stage 94 — an INTERNAL-ONLY execution-plan skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns an [`ExecutionPlan`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It takes no user-, environment-, or config-derived input of any kind —
/// [`ExecutionPlan::new_placeholder`] accepts only an [`ExecutionPlanKind`]
/// label. [`ExecutionPlan::step_count`] returns a fixed, non-secret
/// `usize` chosen by a `match` — never a runtime-computed length, never a
/// growable, heap-allocated collection of [`ExecutionStepKind`] values or
/// any other dynamically-sized collection. This
/// module does NOT hold an instance of any other skeleton type: it does
/// not connect to `secret_handle` (Stage 79), `aead_core` (Stage 80),
/// `kdf_core` (Stage 82), `key_material` (Stage 87), `domain_label` (Stage
/// 88), `operation_context` (Stage 89), `request_descriptor` (Stage 90),
/// `response_descriptor` (Stage 91), `crypto_pipeline` (Stage 92), or
/// `descriptor_bundle` (Stage 93) — it never constructs, stores, or reads a
/// field of any of their types — when in doubt about a connection between
/// skeletons, this crate deliberately leaves them unconnected rather than
/// guess at a future design (the same reasoning `aead_core`'s own doc
/// comment already states). It exists as a fully independent, label-only
/// type basis a later, explicitly-reviewed stage can extend to actually
/// order a real AEAD/KDF/NIP-44/Nostr-key-derivation execution, once it
/// also implements the operation that plan would run.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor`/`response_descriptor`/`crypto_pipeline`/
/// `descriptor_bundle` above do. This is expected for a skeleton not yet
/// wired to any consumer.
#[allow(dead_code)]
mod execution_plan {
    /// Coarse internal lifecycle state of an [`ExecutionPlan`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ExecutionPlanState {
        /// A placeholder plan is active. Runs no cryptography and orders
        /// no real step.
        Placeholder,
        /// No plan should be treated as active — the default, inert state
        /// before any [`ExecutionPlan`] is constructed for use.
        Disabled,
    }

    impl Default for ExecutionPlanState {
        fn default() -> Self {
            ExecutionPlanState::Disabled
        }
    }

    /// Which future cryptographic operation an [`ExecutionPlan`] would
    /// eventually order — a label only, intent, not an implementation and
    /// not a real processing order. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ExecutionPlanKind {
        /// Intended future connection point: an AEAD encrypt/decrypt plan.
        /// No AEAD plan is ordered here.
        AeadPlanPlaceholder,
        /// Intended future connection point: an HKDF extract/expand plan.
        /// No KDF plan is ordered here.
        KdfPlanPlaceholder,
        /// Intended future connection point: an Argon2id hashing plan. No
        /// Argon2id plan is ordered here.
        Argon2idPlanPlaceholder,
        /// Intended future connection point: a NIP-44 encrypt/decrypt
        /// plan. No NIP-44 plan is ordered here.
        Nip44PlanPlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation plan. No Nostr key plan is ordered here.
        NostrKeyPlanPlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyPlanPlaceholder,
    }

    /// A single named step a future real [`ExecutionPlan`] would order —
    /// a label only, intent, not an implementation. Crate-private only.
    /// This crate's canonical six-step placeholder sequence, in the order
    /// a future real plan would eventually run them (still not ordered or
    /// executed by anything in this module today).
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ExecutionStepKind {
        /// Intended future step: validate a request descriptor's shape.
        ValidateRequestPlaceholder,
        /// Intended future step: resolve a domain-separation label.
        ResolveDomainPlaceholder,
        /// Intended future step: resolve key material for the operation.
        ResolveKeyMaterialPlaceholder,
        /// Intended future step: execute the underlying cryptographic
        /// primitive.
        ExecutePrimitivePlaceholder,
        /// Intended future step: build a response descriptor from the
        /// primitive's result.
        BuildResponsePlaceholder,
        /// Intended future step: clear any temporary state used along the
        /// way.
        ClearTemporaryStatePlaceholder,
    }

    /// A non-sensitive status snapshot for an [`ExecutionPlan`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct ExecutionPlanStatus {
        pub(crate) state: ExecutionPlanState,
    }

    /// An INTERNAL-ONLY execution-plan handle skeleton (crate-private; not
    /// part of this crate's public API — see the module-level doc comment
    /// above). Holds only an [`ExecutionPlanKind`] label and an
    /// [`ExecutionPlanState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, no user-, environment-, or
    /// config-derived input, and no field of any other skeleton's type
    /// from `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
    /// `domain_label`, `operation_context`, `request_descriptor`,
    /// `response_descriptor`, `crypto_pipeline`, or `descriptor_bundle`. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually order a real plan; until then it accepts and stores none.
    pub(crate) struct ExecutionPlan {
        kind: ExecutionPlanKind,
        state: ExecutionPlanState,
    }

    impl ExecutionPlan {
        /// Construct a placeholder plan of the given [`ExecutionPlanKind`].
        /// Takes NO user-, environment-, or config-derived input of any
        /// kind, and orders no step of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: ExecutionPlanKind) -> Self {
            Self {
                kind,
                state: ExecutionPlanState::Placeholder,
            }
        }

        /// The [`ExecutionPlanKind`] label this plan was constructed with
        /// — intent only.
        pub(crate) fn kind(&self) -> ExecutionPlanKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> ExecutionPlanStatus {
            ExecutionPlanStatus { state: self.state }
        }

        /// Whether this plan is still in the
        /// [`ExecutionPlanState::Placeholder`] state — always `true` for
        /// any handle constructed via [`ExecutionPlan::new_placeholder`],
        /// since no other constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == ExecutionPlanState::Placeholder
        }

        /// A fixed, non-secret step count for this plan's
        /// [`ExecutionPlanKind`] — this crate's canonical six-step
        /// placeholder sequence ([`ExecutionStepKind`]'s six variants),
        /// chosen by a `match`, never computed from a growable,
        /// heap-allocated collection (none exists anywhere in this
        /// module).
        pub(crate) fn step_count(&self) -> usize {
            match self.kind {
                ExecutionPlanKind::AeadPlanPlaceholder => 6,
                ExecutionPlanKind::KdfPlanPlaceholder => 6,
                ExecutionPlanKind::Argon2idPlanPlaceholder => 6,
                ExecutionPlanKind::Nip44PlanPlaceholder => 6,
                ExecutionPlanKind::NostrKeyPlanPlaceholder => 6,
                ExecutionPlanKind::TestOnlyPlanPlaceholder => 6,
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let plan = ExecutionPlan::new_placeholder(ExecutionPlanKind::AeadPlanPlaceholder);
            assert_eq!(plan.status().state, ExecutionPlanState::Placeholder);
            assert!(plan.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                ExecutionPlanKind::AeadPlanPlaceholder,
                ExecutionPlanKind::KdfPlanPlaceholder,
                ExecutionPlanKind::Argon2idPlanPlaceholder,
                ExecutionPlanKind::Nip44PlanPlaceholder,
                ExecutionPlanKind::NostrKeyPlanPlaceholder,
                ExecutionPlanKind::TestOnlyPlanPlaceholder,
            ] {
                let plan = ExecutionPlan::new_placeholder(kind);
                assert_eq!(plan.kind(), kind);
                assert_eq!(plan.status().state, ExecutionPlanState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let plan = ExecutionPlan::new_placeholder(ExecutionPlanKind::KdfPlanPlaceholder);
            let status = plan.status();
            assert_eq!(status.state, ExecutionPlanState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_plan() {
            for kind in [
                ExecutionPlanKind::Argon2idPlanPlaceholder,
                ExecutionPlanKind::Nip44PlanPlaceholder,
                ExecutionPlanKind::TestOnlyPlanPlaceholder,
            ] {
                assert!(ExecutionPlan::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn step_count_is_the_fixed_six_step_placeholder_sequence_for_every_kind() {
            for kind in [
                ExecutionPlanKind::AeadPlanPlaceholder,
                ExecutionPlanKind::KdfPlanPlaceholder,
                ExecutionPlanKind::Argon2idPlanPlaceholder,
                ExecutionPlanKind::Nip44PlanPlaceholder,
                ExecutionPlanKind::NostrKeyPlanPlaceholder,
                ExecutionPlanKind::TestOnlyPlanPlaceholder,
            ] {
                assert_eq!(ExecutionPlan::new_placeholder(kind).step_count(), 6);
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(
                ExecutionPlanState::default(),
                ExecutionPlanState::Disabled
            );
        }
    }
}

/// Stage 95 — an INTERNAL-ONLY error-taxonomy skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`CryptoErrorDescriptor`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It holds no textual explanation of any failure, no wrapped underlying
/// error value, and no captured call-stack information of any kind — only
/// a fixed [`CryptoErrorKind`] label. It takes no user-, environment-, or
/// config-derived input of any kind —
/// [`CryptoErrorDescriptor::new_placeholder`] accepts only a
/// [`CryptoErrorKind`] label. This module does NOT hold an instance of any
/// other skeleton type: it does not connect to `secret_handle` (Stage 79),
/// `aead_core` (Stage 80), `kdf_core` (Stage 82), `key_material` (Stage
/// 87), `domain_label` (Stage 88), `operation_context` (Stage 89),
/// `request_descriptor` (Stage 90), `response_descriptor` (Stage 91),
/// `crypto_pipeline` (Stage 92), `descriptor_bundle` (Stage 93), or
/// `execution_plan` (Stage 94) — it never constructs, stores, or reads a
/// field of any of their types — when in doubt about a connection between
/// skeletons, this crate deliberately leaves them unconnected rather than
/// guess at a future design (the same reasoning `aead_core`'s own doc
/// comment already states). It exists as a fully independent, label-only
/// type basis a later, explicitly-reviewed stage can extend to actually
/// classify a real AEAD/KDF/NIP-44/Nostr-key-derivation failure, once it
/// also implements the operation that failure would come from.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor`/`response_descriptor`/`crypto_pipeline`/
/// `descriptor_bundle`/`execution_plan` above do. This is expected for a
/// skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod error_taxonomy {
    /// Coarse internal lifecycle state of a [`CryptoErrorDescriptor`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum CryptoErrorState {
        /// A placeholder error descriptor is active. Classifies no real
        /// failure; runs no cryptography.
        Placeholder,
        /// No error descriptor should be treated as active — the default,
        /// inert state before any [`CryptoErrorDescriptor`] is constructed
        /// for use.
        Disabled,
    }

    impl Default for CryptoErrorState {
        fn default() -> Self {
            CryptoErrorState::Disabled
        }
    }

    /// Which future cryptographic operation FAILURE a
    /// [`CryptoErrorDescriptor`] names — a label only, intent, not an
    /// implementation and not a real failure explanation. Crate-private
    /// only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum CryptoErrorKind {
        /// Intended future connection point: an AEAD seal/open failure.
        /// No AEAD failure is classified here.
        AeadFailurePlaceholder,
        /// Intended future connection point: an HKDF extract/expand
        /// failure. No KDF failure is classified here.
        KdfFailurePlaceholder,
        /// Intended future connection point: an Argon2id hashing failure.
        /// No Argon2id failure is classified here.
        Argon2idFailurePlaceholder,
        /// Intended future connection point: a NIP-44 encrypt/decrypt
        /// failure. No NIP-44 failure is classified here.
        Nip44FailurePlaceholder,
        /// Intended future connection point: a Nostr identity/signing key
        /// derivation failure. No Nostr key failure is classified here.
        NostrKeyFailurePlaceholder,
        /// Intended future connection point: an invalid request shape (a
        /// future request descriptor rejected before any primitive runs).
        InvalidRequestPlaceholder,
        /// Intended future connection point: a requested operation kind
        /// with no supporting implementation yet.
        UnsupportedOperationPlaceholder,
        /// Intended future connection point: this crate's own internal
        /// invariant violated (a bug, not caller input).
        InternalInvariantPlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyFailurePlaceholder,
    }

    /// A non-sensitive status snapshot for a [`CryptoErrorDescriptor`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte, and never a failure explanation.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct CryptoErrorStatus {
        pub(crate) state: CryptoErrorState,
    }

    /// An INTERNAL-ONLY error-taxonomy handle skeleton (crate-private; not
    /// part of this crate's public API — see the module-level doc comment
    /// above). Holds only a [`CryptoErrorKind`] label and a
    /// [`CryptoErrorState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, no user-, environment-, or
    /// config-derived input, no textual explanation of any failure, no
    /// wrapped underlying error value, no captured call-stack information,
    /// and no field of any other skeleton's type from `secret_handle`,
    /// `aead_core`, `kdf_core`, `key_material`, `domain_label`,
    /// `operation_context`, `request_descriptor`, `response_descriptor`,
    /// `crypto_pipeline`, `descriptor_bundle`, or `execution_plan`. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually classify a real failure; until then it accepts and stores
    /// none.
    pub(crate) struct CryptoErrorDescriptor {
        kind: CryptoErrorKind,
        state: CryptoErrorState,
    }

    impl CryptoErrorDescriptor {
        /// Construct a placeholder error descriptor of the given
        /// [`CryptoErrorKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind, and classifies no real
        /// failure of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: CryptoErrorKind) -> Self {
            Self {
                kind,
                state: CryptoErrorState::Placeholder,
            }
        }

        /// The [`CryptoErrorKind`] label this descriptor was constructed
        /// with — intent only.
        pub(crate) fn kind(&self) -> CryptoErrorKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> CryptoErrorStatus {
            CryptoErrorStatus { state: self.state }
        }

        /// Whether this descriptor is still in the
        /// [`CryptoErrorState::Placeholder`] state — always `true` for any
        /// handle constructed via
        /// [`CryptoErrorDescriptor::new_placeholder`], since no other
        /// constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == CryptoErrorState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let descriptor =
                CryptoErrorDescriptor::new_placeholder(CryptoErrorKind::AeadFailurePlaceholder);
            assert_eq!(descriptor.status().state, CryptoErrorState::Placeholder);
            assert!(descriptor.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                CryptoErrorKind::AeadFailurePlaceholder,
                CryptoErrorKind::KdfFailurePlaceholder,
                CryptoErrorKind::Argon2idFailurePlaceholder,
                CryptoErrorKind::Nip44FailurePlaceholder,
                CryptoErrorKind::NostrKeyFailurePlaceholder,
                CryptoErrorKind::InvalidRequestPlaceholder,
                CryptoErrorKind::UnsupportedOperationPlaceholder,
                CryptoErrorKind::InternalInvariantPlaceholder,
                CryptoErrorKind::TestOnlyFailurePlaceholder,
            ] {
                let descriptor = CryptoErrorDescriptor::new_placeholder(kind);
                assert_eq!(descriptor.kind(), kind);
                assert_eq!(descriptor.status().state, CryptoErrorState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let descriptor =
                CryptoErrorDescriptor::new_placeholder(CryptoErrorKind::KdfFailurePlaceholder);
            let status = descriptor.status();
            assert_eq!(status.state, CryptoErrorState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_descriptor() {
            for kind in [
                CryptoErrorKind::Argon2idFailurePlaceholder,
                CryptoErrorKind::Nip44FailurePlaceholder,
                CryptoErrorKind::TestOnlyFailurePlaceholder,
            ] {
                assert!(CryptoErrorDescriptor::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(CryptoErrorState::default(), CryptoErrorState::Disabled);
        }
    }
}

/// Stage 96 — an INTERNAL-ONLY audit-event-label skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns an
/// [`AuditEventLabel`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It holds no event payload of any kind — only a fixed [`AuditEventKind`]
/// label. Nothing in this module writes to stdout, stderr, or any log
/// sink: there is no macro call that would emit a line anywhere below,
/// and no observability crate is imported. It takes no user-,
/// environment-, or config-derived input of any kind —
/// [`AuditEventLabel::new_placeholder`] accepts only an [`AuditEventKind`]
/// label. This module does NOT hold an instance of any other skeleton
/// type: it does not connect to `secret_handle` (Stage 79), `aead_core`
/// (Stage 80), `kdf_core` (Stage 82), `key_material` (Stage 87),
/// `domain_label` (Stage 88), `operation_context` (Stage 89),
/// `request_descriptor` (Stage 90), `response_descriptor` (Stage 91),
/// `crypto_pipeline` (Stage 92), `descriptor_bundle` (Stage 93),
/// `execution_plan` (Stage 94), or `error_taxonomy` (Stage 95) — it never
/// constructs, stores, or reads a field of any of their types — when in
/// doubt about a connection between skeletons, this crate deliberately
/// leaves them unconnected rather than guess at a future design (the same
/// reasoning `aead_core`'s own doc comment already states). It exists as a
/// fully independent, label-only type basis a later, explicitly-reviewed
/// stage can extend to actually observe a real crypto-internal state
/// change, once it also implements the observability mechanism (and
/// policy) that event would feed.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`, exactly as `secret_handle`/
/// `aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/
/// `request_descriptor`/`response_descriptor`/`crypto_pipeline`/
/// `descriptor_bundle`/`execution_plan`/`error_taxonomy` above do. This is
/// expected for a skeleton not yet wired to any consumer.
#[allow(dead_code)]
mod audit_event {
    /// Coarse internal lifecycle state of an [`AuditEventLabel`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum AuditEventState {
        /// A placeholder audit-event label is active. Observes no real
        /// state change; emits no output.
        Placeholder,
        /// No audit-event label should be treated as active — the
        /// default, inert state before any [`AuditEventLabel`] is
        /// constructed for use.
        Disabled,
    }

    impl Default for AuditEventState {
        fn default() -> Self {
            AuditEventState::Disabled
        }
    }

    /// Which future crypto-internal state change an [`AuditEventLabel`]
    /// names — a label only, intent, not an implementation and not a real
    /// observation. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum AuditEventKind {
        /// Intended future connection point: a `CryptoProvider`
        /// implementation was selected. No selection is observed here.
        CryptoProviderSelectedPlaceholder,
        /// Intended future connection point: an incoming request was
        /// accepted. No acceptance is observed here.
        RequestAcceptedPlaceholder,
        /// Intended future connection point: an incoming request was
        /// rejected. No rejection is observed here.
        RequestRejectedPlaceholder,
        /// Intended future connection point: an execution plan was
        /// prepared. No preparation is observed here.
        PlanPreparedPlaceholder,
        /// Intended future connection point: an underlying cryptographic
        /// primitive was executed. No execution is observed here.
        PrimitiveExecutedPlaceholder,
        /// Intended future connection point: a response was built. No
        /// build is observed here.
        ResponseBuiltPlaceholder,
        /// Intended future connection point: a secret was cleared. No
        /// clearing is observed here.
        SecretClearedPlaceholder,
        /// Intended future connection point: a failure was classified
        /// (see `error_taxonomy`, Stage 95). No classification is
        /// observed here.
        ErrorClassifiedPlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyPlaceholder,
    }

    /// A non-sensitive status snapshot for an [`AuditEventLabel`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte, and never an event payload.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct AuditEventStatus {
        pub(crate) state: AuditEventState,
    }

    /// An INTERNAL-ONLY audit-event-label handle skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only an [`AuditEventKind`] label and an
    /// [`AuditEventState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, no user-, environment-, or
    /// config-derived input, no event payload of any kind, and no field
    /// of any other skeleton's type from `secret_handle`, `aead_core`,
    /// `kdf_core`, `key_material`, `domain_label`, `operation_context`,
    /// `request_descriptor`, `response_descriptor`, `crypto_pipeline`,
    /// `descriptor_bundle`, `execution_plan`, or `error_taxonomy`. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually observe a real state change; until then it accepts and
    /// stores none, and emits no output of any kind.
    pub(crate) struct AuditEventLabel {
        kind: AuditEventKind,
        state: AuditEventState,
    }

    impl AuditEventLabel {
        /// Construct a placeholder audit-event label of the given
        /// [`AuditEventKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind, and observes no real state
        /// change of any kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: AuditEventKind) -> Self {
            Self {
                kind,
                state: AuditEventState::Placeholder,
            }
        }

        /// The [`AuditEventKind`] label this handle was constructed with
        /// — intent only.
        pub(crate) fn kind(&self) -> AuditEventKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> AuditEventStatus {
            AuditEventStatus { state: self.state }
        }

        /// Whether this label is still in the
        /// [`AuditEventState::Placeholder`] state — always `true` for any
        /// handle constructed via [`AuditEventLabel::new_placeholder`],
        /// since no other constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == AuditEventState::Placeholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let label =
                AuditEventLabel::new_placeholder(AuditEventKind::CryptoProviderSelectedPlaceholder);
            assert_eq!(label.status().state, AuditEventState::Placeholder);
            assert!(label.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                AuditEventKind::CryptoProviderSelectedPlaceholder,
                AuditEventKind::RequestAcceptedPlaceholder,
                AuditEventKind::RequestRejectedPlaceholder,
                AuditEventKind::PlanPreparedPlaceholder,
                AuditEventKind::PrimitiveExecutedPlaceholder,
                AuditEventKind::ResponseBuiltPlaceholder,
                AuditEventKind::SecretClearedPlaceholder,
                AuditEventKind::ErrorClassifiedPlaceholder,
                AuditEventKind::TestOnlyPlaceholder,
            ] {
                let label = AuditEventLabel::new_placeholder(kind);
                assert_eq!(label.kind(), kind);
                assert_eq!(label.status().state, AuditEventState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let label = AuditEventLabel::new_placeholder(AuditEventKind::RequestAcceptedPlaceholder);
            let status = label.status();
            assert_eq!(status.state, AuditEventState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_label() {
            for kind in [
                AuditEventKind::SecretClearedPlaceholder,
                AuditEventKind::ErrorClassifiedPlaceholder,
                AuditEventKind::TestOnlyPlaceholder,
            ] {
                assert!(AuditEventLabel::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(AuditEventState::default(), AuditEventState::Disabled);
        }
    }
}

/// Stage 97 — an INTERNAL-ONLY audit-policy skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns an [`AuditPolicy`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It holds no observation payload of any kind — only fixed
/// [`AuditPolicyKind`] and [`AuditPolicyDecision`] labels. Nothing in this
/// module writes to stdout, stderr, or any log sink: there is no macro
/// call that would emit a line anywhere below, and no observability crate
/// is imported. It takes no user-, environment-, or config-derived input
/// of any kind — [`AuditPolicy::new_placeholder`] accepts only an
/// [`AuditPolicyKind`] label, and [`AuditPolicy::decision_placeholder`]
/// takes nothing at all and always returns the same fixed, safe-default
/// label ([`AuditPolicyDecision::DenyPlaceholder`]) regardless of `kind` —
/// a real per-kind decision is deferred to a later, explicitly-reviewed
/// stage. This module does NOT hold an instance of any other skeleton
/// type in this crate — it never constructs, stores, or reads a field of
/// any of them — when in doubt about a connection between skeletons, this
/// crate deliberately leaves them unconnected rather than guess at a
/// future design (the same reasoning `aead_core`'s own doc comment already
/// states). It exists as a fully independent, label-only type basis a
/// later, explicitly-reviewed stage can extend to actually decide a real
/// observability policy, once it also implements the observation
/// mechanism that policy would govern.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`. This is expected for a skeleton
/// not yet wired to any consumer.
#[allow(dead_code)]
mod audit_policy {
    /// Coarse internal lifecycle state of an [`AuditPolicy`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum AuditPolicyState {
        /// A placeholder policy is active. Decides no real observation;
        /// emits no output.
        Placeholder,
        /// No policy should be treated as active — the default, inert
        /// state before any [`AuditPolicy`] is constructed for use.
        Disabled,
    }

    impl Default for AuditPolicyState {
        fn default() -> Self {
            AuditPolicyState::Disabled
        }
    }

    /// Which future audit-policy profile an [`AuditPolicy`] names — a
    /// label only, intent, not an implementation and not a real decision
    /// rule set. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum AuditPolicyKind {
        /// Intended future connection point: the smallest, most
        /// restrictive observability profile. No real profile is applied
        /// here.
        MinimalPlaceholder,
        /// Intended future connection point: a broader, developer-focused
        /// observability profile. No real profile is applied here.
        DevelopmentPlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyPlaceholder,
    }

    /// A fixed allow/deny label an [`AuditPolicy`] would eventually
    /// return for a real observation request — a label only, never a
    /// real decision computed from any input. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum AuditPolicyDecision {
        /// Intended future meaning: the observation would be permitted.
        /// No real permission is granted by this label alone.
        AllowPlaceholder,
        /// Intended future meaning: the observation would be refused.
        /// This is the safe default this skeleton's
        /// [`AuditPolicy::decision_placeholder`] always returns today.
        DenyPlaceholder,
    }

    /// A non-sensitive status snapshot for an [`AuditPolicy`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte, and never an observation payload.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct AuditPolicyStatus {
        pub(crate) state: AuditPolicyState,
    }

    /// An INTERNAL-ONLY audit-policy handle skeleton (crate-private; not
    /// part of this crate's public API — see the module-level doc comment
    /// above). Holds only an [`AuditPolicyKind`] label and an
    /// [`AuditPolicyState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, no user-, environment-, or
    /// config-derived input, no observation payload of any kind, and no
    /// field of any other skeleton type in this crate. A future,
    /// explicitly-reviewed stage may extend this skeleton to actually
    /// decide a real policy; until then it accepts and stores none, and
    /// emits no output of any kind.
    pub(crate) struct AuditPolicy {
        kind: AuditPolicyKind,
        state: AuditPolicyState,
    }

    impl AuditPolicy {
        /// Construct a placeholder policy of the given [`AuditPolicyKind`].
        /// Takes NO user-, environment-, or config-derived input of any
        /// kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: AuditPolicyKind) -> Self {
            Self {
                kind,
                state: AuditPolicyState::Placeholder,
            }
        }

        /// The [`AuditPolicyKind`] label this policy was constructed with
        /// — intent only.
        pub(crate) fn kind(&self) -> AuditPolicyKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> AuditPolicyStatus {
            AuditPolicyStatus { state: self.state }
        }

        /// Whether this policy is still in the
        /// [`AuditPolicyState::Placeholder`] state — always `true` for any
        /// handle constructed via [`AuditPolicy::new_placeholder`], since
        /// no other constructor exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == AuditPolicyState::Placeholder
        }

        /// A fixed, non-secret decision label — takes NO input of any
        /// kind and always returns the same safe-default label,
        /// [`AuditPolicyDecision::DenyPlaceholder`], regardless of
        /// `self.kind`. Never computed from a real observation request;
        /// a real per-kind decision rule is deferred to a later,
        /// explicitly-reviewed stage.
        pub(crate) fn decision_placeholder(&self) -> AuditPolicyDecision {
            AuditPolicyDecision::DenyPlaceholder
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let policy = AuditPolicy::new_placeholder(AuditPolicyKind::MinimalPlaceholder);
            assert_eq!(policy.status().state, AuditPolicyState::Placeholder);
            assert!(policy.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                AuditPolicyKind::MinimalPlaceholder,
                AuditPolicyKind::DevelopmentPlaceholder,
                AuditPolicyKind::TestOnlyPlaceholder,
            ] {
                let policy = AuditPolicy::new_placeholder(kind);
                assert_eq!(policy.kind(), kind);
                assert_eq!(policy.status().state, AuditPolicyState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let policy = AuditPolicy::new_placeholder(AuditPolicyKind::DevelopmentPlaceholder);
            let status = policy.status();
            assert_eq!(status.state, AuditPolicyState::Placeholder);
        }

        #[test]
        fn is_placeholder_is_true_for_every_constructed_policy() {
            for kind in [
                AuditPolicyKind::MinimalPlaceholder,
                AuditPolicyKind::DevelopmentPlaceholder,
                AuditPolicyKind::TestOnlyPlaceholder,
            ] {
                assert!(AuditPolicy::new_placeholder(kind).is_placeholder());
            }
        }

        #[test]
        fn decision_placeholder_always_returns_the_fixed_deny_label_for_every_kind() {
            for kind in [
                AuditPolicyKind::MinimalPlaceholder,
                AuditPolicyKind::DevelopmentPlaceholder,
                AuditPolicyKind::TestOnlyPlaceholder,
            ] {
                assert_eq!(
                    AuditPolicy::new_placeholder(kind).decision_placeholder(),
                    AuditPolicyDecision::DenyPlaceholder
                );
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(AuditPolicyState::default(), AuditPolicyState::Disabled);
        }
    }
}

/// Stage 98 — an INTERNAL-ONLY lifecycle-state skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`LifecycleMarker`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It holds no observation payload, no error text, no timestamp, and no
/// counter of any kind — only fixed [`LifecycleKind`] and [`LifecycleState`]
/// labels. Nothing in this module writes to stdout, stderr, or any log
/// sink: there is no macro call that would emit a line anywhere below, and
/// no observability crate is imported. It takes no user-, environment-, or
/// config-derived input of any kind — [`LifecycleMarker::new_placeholder`]
/// accepts only a [`LifecycleKind`] label, and every `mark_*_placeholder`
/// transition method takes nothing beyond `&mut self`. This module does
/// NOT hold an instance of any other skeleton type in this crate — it
/// never constructs, stores, or reads a field of any of them — when in
/// doubt about a connection between skeletons, this crate deliberately
/// leaves them unconnected rather than guess at a future design (the same
/// reasoning `aead_core`'s own doc comment already states). It exists as a
/// fully independent, label-only type basis a later, explicitly-reviewed
/// stage can extend to actually track a real crypto-provider/request/
/// secret/audit/pipeline lifecycle, once it also implements the mechanism
/// that lifecycle would govern.
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`. This is expected for a skeleton
/// not yet wired to any consumer.
#[allow(dead_code)]
mod lifecycle_state {
    /// Coarse internal lifecycle state a [`LifecycleMarker`] may be in —
    /// a fixed label only, never derived from a timestamp, a counter, or
    /// any other real observation. Crate-private only — never exposed via
    /// this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum LifecycleState {
        /// No lifecycle marker should be treated as active — the
        /// default, inert state before any [`LifecycleMarker`] is
        /// constructed for use.
        Disabled,
        /// A placeholder marker is active. Tracks no real transition;
        /// emits no output.
        Placeholder,
        /// Intended future meaning: the tracked resource was prepared.
        /// No real preparation is observed by reaching this label.
        PreparedPlaceholder,
        /// Intended future meaning: the tracked resource became active.
        /// No real activation is observed by reaching this label.
        ActivePlaceholder,
        /// Intended future meaning: the tracked resource's state was
        /// cleared. No real clearing is observed by reaching this label.
        ClearedPlaceholder,
        /// Intended future meaning: the tracked resource entered an
        /// error state. No real error text is carried by this label.
        ErrorPlaceholder,
    }

    impl Default for LifecycleState {
        fn default() -> Self {
            LifecycleState::Disabled
        }
    }

    /// Which future crypto-internal lifecycle a [`LifecycleMarker`] names
    /// — a label only, intent, not an implementation and not a real
    /// tracked resource. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum LifecycleKind {
        /// Intended future connection point: a `CryptoProvider`
        /// implementation's own lifecycle. No provider lifecycle is
        /// tracked here.
        CryptoProviderLifecyclePlaceholder,
        /// Intended future connection point: an incoming request's
        /// lifecycle. No request lifecycle is tracked here.
        RequestLifecyclePlaceholder,
        /// Intended future connection point: a secret's lifecycle. No
        /// secret lifecycle is tracked here.
        SecretLifecyclePlaceholder,
        /// Intended future connection point: an audit mechanism's own
        /// lifecycle. No audit lifecycle is tracked here.
        AuditLifecyclePlaceholder,
        /// Intended future connection point: a crypto pipeline's
        /// lifecycle. No pipeline lifecycle is tracked here.
        PipelineLifecyclePlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyLifecyclePlaceholder,
    }

    /// A non-sensitive status snapshot for a [`LifecycleMarker`].
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte, never an observation payload, and never
    /// a timestamp or counter.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct LifecycleStatus {
        pub(crate) state: LifecycleState,
    }

    /// An INTERNAL-ONLY lifecycle-state handle skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only a [`LifecycleKind`] label and a
    /// [`LifecycleState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, no user-, environment-, or
    /// config-derived input, no observation payload, no timestamp, no
    /// counter, and no field of any other skeleton type in this crate. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually track a real lifecycle; until then it accepts and stores
    /// none, and emits no output of any kind.
    pub(crate) struct LifecycleMarker {
        kind: LifecycleKind,
        state: LifecycleState,
    }

    impl LifecycleMarker {
        /// Construct a placeholder marker of the given [`LifecycleKind`].
        /// Takes NO user-, environment-, or config-derived input of any
        /// kind — `kind` is a label only.
        pub(crate) fn new_placeholder(kind: LifecycleKind) -> Self {
            Self {
                kind,
                state: LifecycleState::Placeholder,
            }
        }

        /// The [`LifecycleKind`] label this marker was constructed with —
        /// intent only.
        pub(crate) fn kind(&self) -> LifecycleKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> LifecycleStatus {
            LifecycleStatus { state: self.state }
        }

        /// Whether this marker is still in the
        /// [`LifecycleState::Placeholder`] state — `true` only before any
        /// `mark_*_placeholder` transition method has been called.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == LifecycleState::Placeholder
        }

        /// Coarse label-only transition: sets the state to
        /// [`LifecycleState::PreparedPlaceholder`]. Takes NO input beyond
        /// `&mut self` — never a real preparation payload, error text, or
        /// timestamp.
        pub(crate) fn mark_prepared_placeholder(&mut self) {
            self.state = LifecycleState::PreparedPlaceholder;
        }

        /// Coarse label-only transition: sets the state to
        /// [`LifecycleState::ActivePlaceholder`]. Takes NO input beyond
        /// `&mut self`.
        pub(crate) fn mark_active_placeholder(&mut self) {
            self.state = LifecycleState::ActivePlaceholder;
        }

        /// Coarse label-only transition: sets the state to
        /// [`LifecycleState::ClearedPlaceholder`]. Takes NO input beyond
        /// `&mut self` — does not zeroize or clear any real byte, since
        /// this marker holds none.
        pub(crate) fn mark_cleared_placeholder(&mut self) {
            self.state = LifecycleState::ClearedPlaceholder;
        }

        /// Coarse label-only transition: sets the state to
        /// [`LifecycleState::ErrorPlaceholder`]. Takes NO input beyond
        /// `&mut self` — never a real error message, source error, or
        /// stack trace.
        pub(crate) fn mark_error_placeholder(&mut self) {
            self.state = LifecycleState::ErrorPlaceholder;
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let marker =
                LifecycleMarker::new_placeholder(LifecycleKind::CryptoProviderLifecyclePlaceholder);
            assert_eq!(marker.status().state, LifecycleState::Placeholder);
            assert!(marker.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                LifecycleKind::CryptoProviderLifecyclePlaceholder,
                LifecycleKind::RequestLifecyclePlaceholder,
                LifecycleKind::SecretLifecyclePlaceholder,
                LifecycleKind::AuditLifecyclePlaceholder,
                LifecycleKind::PipelineLifecyclePlaceholder,
                LifecycleKind::TestOnlyLifecyclePlaceholder,
            ] {
                let marker = LifecycleMarker::new_placeholder(kind);
                assert_eq!(marker.kind(), kind);
                assert_eq!(marker.status().state, LifecycleState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let marker = LifecycleMarker::new_placeholder(LifecycleKind::RequestLifecyclePlaceholder);
            let status = marker.status();
            assert_eq!(status.state, LifecycleState::Placeholder);
        }

        #[test]
        fn mark_prepared_placeholder_transitions_state_only() {
            let mut marker =
                LifecycleMarker::new_placeholder(LifecycleKind::SecretLifecyclePlaceholder);
            marker.mark_prepared_placeholder();
            assert_eq!(marker.status().state, LifecycleState::PreparedPlaceholder);
            assert!(!marker.is_placeholder());
        }

        #[test]
        fn mark_active_placeholder_transitions_state_only() {
            let mut marker =
                LifecycleMarker::new_placeholder(LifecycleKind::AuditLifecyclePlaceholder);
            marker.mark_active_placeholder();
            assert_eq!(marker.status().state, LifecycleState::ActivePlaceholder);
        }

        #[test]
        fn mark_cleared_placeholder_transitions_state_only() {
            let mut marker =
                LifecycleMarker::new_placeholder(LifecycleKind::PipelineLifecyclePlaceholder);
            marker.mark_cleared_placeholder();
            assert_eq!(marker.status().state, LifecycleState::ClearedPlaceholder);
        }

        #[test]
        fn mark_error_placeholder_transitions_state_only() {
            let mut marker =
                LifecycleMarker::new_placeholder(LifecycleKind::TestOnlyLifecyclePlaceholder);
            marker.mark_error_placeholder();
            assert_eq!(marker.status().state, LifecycleState::ErrorPlaceholder);
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(LifecycleState::default(), LifecycleState::Disabled);
        }
    }
}

/// Stage 99 — an INTERNAL-ONLY module-registry skeleton.
///
/// NOT part of this crate's public API: every item below is `pub(crate)` at
/// most (never `pub`), nothing is re-exported from the crate root, and none
/// of the six functions above (`fedos_core_status`, `fedos_core_capabilities`,
/// `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
/// `decrypt_placeholder`) constructs, holds, or returns a
/// [`ModuleRegistry`].
///
/// This module holds NO real key, seed, plaintext, ciphertext, passphrase,
/// tag, or nonce byte — there is no borrowed-byte-slice, `Vec<u8>`, or
/// `String` field or parameter anywhere below, and no AEAD/HKDF/Argon2/
/// NIP-44 operation is implemented or called, and no Nostr key is derived.
/// It holds no observation payload, no timestamp, and no counter of any
/// kind — only fixed [`ModuleRegistryKind`] and [`ModuleRegistryState`]
/// labels. Nothing in this module writes to stdout, stderr, or any log
/// sink: there is no macro call that would emit a line anywhere below.
/// [`ModuleRegistry::registered_module_count`] returns a fixed `usize`
/// literal — never a length method call, never anything computed from a
/// growable, heap-allocated collection, a fixed-size array, or any lookup
/// table; there is no `Vec`, no `HashMap`, no `BTreeMap`, no static array,
/// and no macro-based or reflection-based registry mechanism anywhere in
/// this module. It takes no user-, environment-, or config-derived input
/// of any kind — [`ModuleRegistry::new_placeholder`] accepts only a
/// [`ModuleRegistryKind`] label. This module does NOT hold, construct, or
/// reference an instance of any other skeleton type in this crate — its
/// [`ModuleRegistryKind`] variants are ENUMERATION labels only, one per
/// crate-private skeleton module added since Stage 79, existing purely to
/// document and fix which internal skeletons exist today — when in doubt
/// about a connection between skeletons, this crate deliberately leaves
/// them unconnected rather than guess at a future design (the same
/// reasoning `aead_core`'s own doc comment already states).
///
/// Every item in this module is currently exercised ONLY by its own unit
/// tests below (gated `cfg(test)`) — nothing outside this module calls it —
/// so `#[allow(dead_code)]` suppresses the resulting warning on a plain,
/// non-test `cargo check`/`cargo build`. This is expected for a skeleton
/// not yet wired to any consumer.
#[allow(dead_code)]
mod module_registry {
    /// Coarse internal lifecycle state of a [`ModuleRegistry`].
    /// Crate-private only — never exposed via this crate's public API.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ModuleRegistryState {
        /// No registry entry should be treated as active — the default,
        /// inert state before any [`ModuleRegistry`] is constructed for
        /// use.
        Disabled,
        /// A placeholder registry entry is active. Enumerates a module
        /// label only; emits no output.
        Placeholder,
    }

    impl Default for ModuleRegistryState {
        fn default() -> Self {
            ModuleRegistryState::Disabled
        }
    }

    /// Which crate-private skeleton module a [`ModuleRegistry`] entry
    /// names — a fixed enumeration label only, never a constructed
    /// instance of the module it names. Crate-private only.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) enum ModuleRegistryKind {
        /// Names the Stage 79 skeleton module — enumeration label only.
        SecretHandlePlaceholder,
        /// Names the Stage 80 skeleton module — enumeration label only.
        AeadCorePlaceholder,
        /// Names the Stage 82 skeleton module — enumeration label only.
        KdfCorePlaceholder,
        /// Names the Stage 87 skeleton module — enumeration label only.
        KeyMaterialPlaceholder,
        /// Names the Stage 88 skeleton module — enumeration label only.
        DomainLabelPlaceholder,
        /// Names the Stage 89 skeleton module — enumeration label only.
        OperationContextPlaceholder,
        /// Names the Stage 90 skeleton module — enumeration label only.
        RequestDescriptorPlaceholder,
        /// Names the Stage 91 skeleton module — enumeration label only.
        ResponseDescriptorPlaceholder,
        /// Names the Stage 92 skeleton module — enumeration label only.
        CryptoPipelinePlaceholder,
        /// Names the Stage 93 skeleton module — enumeration label only.
        DescriptorBundlePlaceholder,
        /// Names the Stage 94 skeleton module — enumeration label only.
        ExecutionPlanPlaceholder,
        /// Names the Stage 95 skeleton module — enumeration label only.
        ErrorTaxonomyPlaceholder,
        /// Names the Stage 96 skeleton module — enumeration label only.
        AuditEventPlaceholder,
        /// Names the Stage 97 skeleton module — enumeration label only.
        AuditPolicyPlaceholder,
        /// Names the Stage 98 skeleton module — enumeration label only.
        LifecycleStatePlaceholder,
        /// Reserved for this module's own tests / future test-only
        /// fixtures — never used by production code paths.
        TestOnlyPlaceholder,
    }

    /// A non-sensitive status snapshot for a [`ModuleRegistry`] entry.
    /// Crate-private only. Never contains a key/seed/plaintext/ciphertext/
    /// passphrase/tag/nonce byte, and never an observation payload.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub(crate) struct ModuleRegistryStatus {
        pub(crate) state: ModuleRegistryState,
    }

    /// An INTERNAL-ONLY module-registry entry skeleton (crate-private;
    /// not part of this crate's public API — see the module-level doc
    /// comment above). Holds only a [`ModuleRegistryKind`] label and a
    /// [`ModuleRegistryState`] — no key, seed, plaintext, ciphertext,
    /// passphrase, tag, or nonce byte, no user-, environment-, or
    /// config-derived input, no observation payload, no timestamp, no
    /// counter, and no field of any other skeleton type in this crate. A
    /// future, explicitly-reviewed stage may extend this skeleton to
    /// actually track a real module registry; until then it accepts and
    /// stores none, and emits no output of any kind.
    pub(crate) struct ModuleRegistry {
        kind: ModuleRegistryKind,
        state: ModuleRegistryState,
    }

    impl ModuleRegistry {
        /// Construct a placeholder registry entry of the given
        /// [`ModuleRegistryKind`]. Takes NO user-, environment-, or
        /// config-derived input of any kind — `kind` is a fixed
        /// enumeration label only.
        pub(crate) fn new_placeholder(kind: ModuleRegistryKind) -> Self {
            Self {
                kind,
                state: ModuleRegistryState::Placeholder,
            }
        }

        /// The [`ModuleRegistryKind`] label this entry was constructed
        /// with — an enumeration label only, never a constructed instance
        /// of the module it names.
        pub(crate) fn kind(&self) -> ModuleRegistryKind {
            self.kind
        }

        /// A non-sensitive status snapshot.
        pub(crate) fn status(&self) -> ModuleRegistryStatus {
            ModuleRegistryStatus { state: self.state }
        }

        /// Whether this entry is still in the
        /// [`ModuleRegistryState::Placeholder`] state — always `true` for
        /// any handle constructed via
        /// [`ModuleRegistry::new_placeholder`], since no other constructor
        /// exists.
        pub(crate) fn is_placeholder(&self) -> bool {
            self.state == ModuleRegistryState::Placeholder
        }

        /// A fixed, non-secret count of the crate-private skeleton
        /// modules named by [`ModuleRegistryKind`] (Stage 79 through
        /// Stage 98, excluding [`ModuleRegistryKind::TestOnlyPlaceholder`])
        /// — a hardcoded `usize` literal, never a length method call and
        /// never computed from any collection.
        pub(crate) fn registered_module_count(&self) -> usize {
            15
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn new_placeholder_starts_in_placeholder_state_only() {
            let registry = ModuleRegistry::new_placeholder(ModuleRegistryKind::SecretHandlePlaceholder);
            assert_eq!(registry.status().state, ModuleRegistryState::Placeholder);
            assert!(registry.is_placeholder());
        }

        #[test]
        fn kind_reports_the_constructed_placeholder_kind_only() {
            for kind in [
                ModuleRegistryKind::SecretHandlePlaceholder,
                ModuleRegistryKind::AeadCorePlaceholder,
                ModuleRegistryKind::KdfCorePlaceholder,
                ModuleRegistryKind::KeyMaterialPlaceholder,
                ModuleRegistryKind::DomainLabelPlaceholder,
                ModuleRegistryKind::OperationContextPlaceholder,
                ModuleRegistryKind::RequestDescriptorPlaceholder,
                ModuleRegistryKind::ResponseDescriptorPlaceholder,
                ModuleRegistryKind::CryptoPipelinePlaceholder,
                ModuleRegistryKind::DescriptorBundlePlaceholder,
                ModuleRegistryKind::ExecutionPlanPlaceholder,
                ModuleRegistryKind::ErrorTaxonomyPlaceholder,
                ModuleRegistryKind::AuditEventPlaceholder,
                ModuleRegistryKind::AuditPolicyPlaceholder,
                ModuleRegistryKind::LifecycleStatePlaceholder,
                ModuleRegistryKind::TestOnlyPlaceholder,
            ] {
                let registry = ModuleRegistry::new_placeholder(kind);
                assert_eq!(registry.kind(), kind);
                assert_eq!(registry.status().state, ModuleRegistryState::Placeholder);
            }
        }

        #[test]
        fn status_reports_placeholder_state_only_no_secret_bytes() {
            let registry = ModuleRegistry::new_placeholder(ModuleRegistryKind::AeadCorePlaceholder);
            let status = registry.status();
            assert_eq!(status.state, ModuleRegistryState::Placeholder);
        }

        #[test]
        fn registered_module_count_is_the_fixed_fifteen_for_every_kind() {
            for kind in [
                ModuleRegistryKind::SecretHandlePlaceholder,
                ModuleRegistryKind::AeadCorePlaceholder,
                ModuleRegistryKind::KdfCorePlaceholder,
                ModuleRegistryKind::KeyMaterialPlaceholder,
                ModuleRegistryKind::DomainLabelPlaceholder,
                ModuleRegistryKind::OperationContextPlaceholder,
                ModuleRegistryKind::RequestDescriptorPlaceholder,
                ModuleRegistryKind::ResponseDescriptorPlaceholder,
                ModuleRegistryKind::CryptoPipelinePlaceholder,
                ModuleRegistryKind::DescriptorBundlePlaceholder,
                ModuleRegistryKind::ExecutionPlanPlaceholder,
                ModuleRegistryKind::ErrorTaxonomyPlaceholder,
                ModuleRegistryKind::AuditEventPlaceholder,
                ModuleRegistryKind::AuditPolicyPlaceholder,
                ModuleRegistryKind::LifecycleStatePlaceholder,
                ModuleRegistryKind::TestOnlyPlaceholder,
            ] {
                assert_eq!(
                    ModuleRegistry::new_placeholder(kind).registered_module_count(),
                    15
                );
            }
        }

        #[test]
        fn disabled_state_is_the_default_placeholder_only_state() {
            assert_eq!(
                ModuleRegistryState::default(),
                ModuleRegistryState::Disabled
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_is_unavailable() {
        assert_eq!(fedos_core_status().state, FedosCoreState::Unavailable);
    }

    #[test]
    fn capabilities_are_placeholders_only() {
        for cap in fedos_core_capabilities() {
            assert!(cap.ends_with("_placeholder"));
        }
    }

    #[test]
    fn operations_return_placeholder_only() {
        for status in [
            random_bytes_placeholder(),
            derive_key_placeholder(),
            encrypt_placeholder(),
            decrypt_placeholder(),
        ] {
            assert_eq!(status.state, FedosCoreState::Placeholder);
        }
    }
}

/// Stage 75 — RFC 8439 known-answer verification, `#[cfg(test)]` ONLY.
///
/// This module is not part of the crate's public API: it is compiled only
/// under `cargo test`, imports `chacha20poly1305` (adopted as a production
/// dependency in Stage 74) purely to check that dependency against the
/// official vectors, and implements no encrypt/decrypt function that any
/// other code — production or otherwise — can call. The placeholder
/// functions above (`encrypt_placeholder`, `decrypt_placeholder`, etc.) are
/// untouched.
///
/// Stage 81 extracts the seal/open logic that used to be written inline in
/// the two vector tests below into two small test-only helpers,
/// [`seal_chacha20poly1305_for_test`] and [`open_chacha20poly1305_for_test`]
/// — private `fn`s that exist ONLY inside this `cfg(test)`-only module, are
/// not `pub`/`pub(crate)`, are not re-exported, and are NOT connected to the
/// crate-private `aead_core` skeleton (Stage 80) or to `secret_handle`
/// (Stage 79) in any way. This is a test-only refactor: the two vector tests
/// (`rfc8439_positive_vectors_encrypt_and_decrypt_correctly` and
/// `rfc8439_negative_vectors_fail_to_decrypt_if_present`) assert exactly the
/// same things as before, just calling the shared helper instead of
/// constructing a `Key`/`Nonce`/`ChaCha20Poly1305` inline twice.
#[cfg(test)]
mod rfc8439_vectors {
    use chacha20poly1305::aead::{Aead, Error as AeadError, KeyInit, Payload};
    use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce};
    use serde::Deserialize;

    /// One vector entry. Only the fields this test needs are named; unknown
    /// JSON fields (`nonceConstant`, `plaintextUtf8`, `notes`, ...) are
    /// ignored by serde rather than mirrored here.
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Vector {
        id: String,
        should_pass: bool,
        key: String,
        nonce: String,
        aad: String,
        plaintext: String,
        ciphertext: String,
        tag: String,
    }

    #[derive(Debug, Deserialize)]
    struct VectorFile {
        vectors: Vec<Vector>,
    }

    /// The RFC 8439 vector file imported verbatim in Stage 73, read at
    /// compile time so this test has no filesystem/IO dependency at runtime.
    const RFC8439_JSON: &str =
        include_str!("../../../test-vectors/aead/chacha20poly1305-rfc8439.json");

    fn decode_hex(field: &str, id: &str, value: &str) -> Vec<u8> {
        hex::decode(value).unwrap_or_else(|err| {
            panic!("{id}: invalid hex in field `{field}`: {err}")
        })
    }

    /// Test-only ChaCha20-Poly1305 SEAL (encrypt-then-tag) helper — private
    /// `fn`, exists ONLY under `cfg(test)`, never `pub`/`pub(crate)`. Takes
    /// raw key/nonce/plaintext/AAD bytes (all test-vector bytes, never a
    /// real secret) and returns `ciphertext‖tag` on success, or the
    /// underlying AEAD error on failure (e.g. a malformed key/nonce length).
    fn seal_chacha20poly1305_for_test(
        key_bytes: &[u8],
        nonce_bytes: &[u8],
        plaintext_bytes: &[u8],
        aad_bytes: &[u8],
    ) -> Result<Vec<u8>, AeadError> {
        let key = Key::try_from(key_bytes).expect("test helper: key is not 32 bytes");
        let nonce = Nonce::try_from(nonce_bytes).expect("test helper: nonce is not 12 bytes");
        let cipher = ChaCha20Poly1305::new(&key);
        cipher.encrypt(
            &nonce,
            Payload {
                msg: plaintext_bytes,
                aad: aad_bytes,
            },
        )
    }

    /// Test-only ChaCha20-Poly1305 OPEN (verify-then-decrypt) helper — same
    /// scope/rules as [`seal_chacha20poly1305_for_test`] above.
    /// `sealed_bytes` is `ciphertext‖tag`; returns the plaintext on success,
    /// or an error if authentication fails (e.g. for a tampered/negative
    /// vector).
    fn open_chacha20poly1305_for_test(
        key_bytes: &[u8],
        nonce_bytes: &[u8],
        sealed_bytes: &[u8],
        aad_bytes: &[u8],
    ) -> Result<Vec<u8>, AeadError> {
        let key = Key::try_from(key_bytes).expect("test helper: key is not 32 bytes");
        let nonce = Nonce::try_from(nonce_bytes).expect("test helper: nonce is not 12 bytes");
        let cipher = ChaCha20Poly1305::new(&key);
        cipher.decrypt(
            &nonce,
            Payload {
                msg: sealed_bytes,
                aad: aad_bytes,
            },
        )
    }

    #[test]
    fn rfc8439_json_parses_and_is_non_empty() {
        let file: VectorFile =
            serde_json::from_str(RFC8439_JSON).expect("RFC 8439 vector JSON must parse");
        assert!(
            !file.vectors.is_empty(),
            "expected at least one RFC 8439 vector"
        );
    }

    /// `shouldPass=true` vectors: [`seal_chacha20poly1305_for_test`] must
    /// seal plaintext+AAD to exactly the RFC's expected ciphertext||tag, and
    /// [`open_chacha20poly1305_for_test`] must open that same
    /// ciphertext||tag back to exactly the RFC's expected plaintext.
    #[test]
    fn rfc8439_positive_vectors_encrypt_and_decrypt_correctly() {
        let file: VectorFile =
            serde_json::from_str(RFC8439_JSON).expect("RFC 8439 vector JSON must parse");

        let mut checked = 0usize;
        for vector in file.vectors.iter().filter(|v| v.should_pass) {
            let key_bytes = decode_hex("key", &vector.id, &vector.key);
            let nonce_bytes = decode_hex("nonce", &vector.id, &vector.nonce);
            let aad_bytes = decode_hex("aad", &vector.id, &vector.aad);
            let plaintext_bytes = decode_hex("plaintext", &vector.id, &vector.plaintext);
            let ciphertext_bytes = decode_hex("ciphertext", &vector.id, &vector.ciphertext);
            let tag_bytes = decode_hex("tag", &vector.id, &vector.tag);

            let mut expected_sealed = ciphertext_bytes.clone();
            expected_sealed.extend_from_slice(&tag_bytes);

            let sealed = seal_chacha20poly1305_for_test(
                &key_bytes,
                &nonce_bytes,
                &plaintext_bytes,
                &aad_bytes,
            )
            .unwrap_or_else(|err| panic!("{}: encrypt failed: {err}", vector.id));
            assert_eq!(
                sealed, expected_sealed,
                "{}: ciphertext||tag did not match the RFC 8439 vector",
                vector.id
            );

            let opened = open_chacha20poly1305_for_test(
                &key_bytes,
                &nonce_bytes,
                &expected_sealed,
                &aad_bytes,
            )
            .unwrap_or_else(|err| panic!("{}: decrypt failed: {err}", vector.id));
            assert_eq!(
                opened, plaintext_bytes,
                "{}: decrypted plaintext did not match the RFC 8439 vector",
                vector.id
            );

            checked += 1;
        }
        assert!(
            checked > 0,
            "expected at least one shouldPass=true RFC 8439 vector to be checked"
        );
    }

    /// `shouldPass=false` vectors, if any exist in the imported file, must
    /// fail to decrypt/authenticate via [`open_chacha20poly1305_for_test`].
    /// RFC 8439 itself publishes no byte-level tamper/negative vector for
    /// this construction (per docs/crypto_vector_sources.md §2's
    /// verbatim-only import rule, none is fabricated here — see the file's
    /// own `notes` field) — so today this loop body runs zero times and the
    /// test trivially passes. It exists so that IF a future,
    /// explicitly-reviewed re-import of this file ever adds an official
    /// negative case, this test starts enforcing it with no further code
    /// change required.
    #[test]
    fn rfc8439_negative_vectors_fail_to_decrypt_if_present() {
        let file: VectorFile =
            serde_json::from_str(RFC8439_JSON).expect("RFC 8439 vector JSON must parse");

        for vector in file.vectors.iter().filter(|v| !v.should_pass) {
            let key_bytes = decode_hex("key", &vector.id, &vector.key);
            let nonce_bytes = decode_hex("nonce", &vector.id, &vector.nonce);
            let aad_bytes = decode_hex("aad", &vector.id, &vector.aad);
            let ciphertext_bytes = decode_hex("ciphertext", &vector.id, &vector.ciphertext);
            let tag_bytes = decode_hex("tag", &vector.id, &vector.tag);

            let mut sealed = ciphertext_bytes.clone();
            sealed.extend_from_slice(&tag_bytes);

            let result =
                open_chacha20poly1305_for_test(&key_bytes, &nonce_bytes, &sealed, &aad_bytes);
            assert!(
                result.is_err(),
                "{}: expected decrypt/authentication failure for a shouldPass=false vector",
                vector.id
            );
        }
    }

    /// Unit test for the helpers themselves, independent of the vector
    /// file: a seal-then-open round trip over fixed, non-secret,
    /// test-only bytes must return the original plaintext.
    #[test]
    fn seal_then_open_round_trip_for_test_helper() {
        let key_bytes = [0x11u8; 32];
        let nonce_bytes = [0x22u8; 12];
        let aad_bytes = b"aad-for-test";
        let plaintext_bytes = b"plaintext-for-test";

        let sealed =
            seal_chacha20poly1305_for_test(&key_bytes, &nonce_bytes, plaintext_bytes, aad_bytes)
                .expect("seal should succeed with a well-formed key/nonce");
        let opened =
            open_chacha20poly1305_for_test(&key_bytes, &nonce_bytes, &sealed, aad_bytes)
                .expect("open should succeed against its own sealed output");
        assert_eq!(opened, plaintext_bytes);
    }

    /// Unit test for the OPEN helper's failure path: tampering with the
    /// sealed bytes (the authentication tag, here) must make
    /// [`open_chacha20poly1305_for_test`] return an error.
    #[test]
    fn open_fails_for_tampered_sealed_bytes_for_test_helper() {
        let key_bytes = [0x33u8; 32];
        let nonce_bytes = [0x44u8; 12];
        let aad_bytes = b"aad-for-test";
        let plaintext_bytes = b"plaintext-for-test";

        let mut sealed =
            seal_chacha20poly1305_for_test(&key_bytes, &nonce_bytes, plaintext_bytes, aad_bytes)
                .expect("seal should succeed with a well-formed key/nonce");
        let last = sealed.len() - 1;
        sealed[last] ^= 0xff;

        let result = open_chacha20poly1305_for_test(&key_bytes, &nonce_bytes, &sealed, aad_bytes);
        assert!(
            result.is_err(),
            "expected authentication failure for tampered sealed bytes"
        );
    }
}

/// Stage 77 — RFC 5869 HKDF-SHA256 known-answer verification, `#[cfg(test)]`
/// ONLY.
///
/// This module is not part of the crate's public API: it is compiled only
/// under `cargo test`, imports `hkdf` (adopted as a production dependency in
/// Stage 76) and `sha2` (a `[dev-dependencies]`-only crate added this stage)
/// purely to check the `hkdf` dependency against the official RFC 5869
/// vectors, and implements no key-derivation function that any other code —
/// production or otherwise — can call. `derive_key_placeholder` above is
/// untouched.
///
/// Stage 83 extracts the extract/expand logic that used to be written
/// inline in the two vector tests below into three small test-only helpers,
/// [`extract_hkdf_sha256_for_test`], [`expand_hkdf_sha256_for_test`], and
/// [`extract_expand_hkdf_sha256_for_test`] — private `fn`s that exist ONLY
/// inside this `cfg(test)`-only module, are not `pub`/`pub(crate)`, are not
/// re-exported, and are NOT connected to the crate-private `kdf_core`
/// skeleton (Stage 82) or to `secret_handle`/`aead_core` in any way. This is
/// a test-only refactor, mirroring Stage 81's `rfc8439_vectors` refactor:
/// the two vector tests
/// (`rfc5869_positive_vectors_extract_and_expand_correctly` and
/// `rfc5869_negative_vectors_do_not_match_if_present`) assert exactly the
/// same things as before, just calling the shared helpers instead of
/// constructing an `Hkdf<Sha256>` inline twice.
#[cfg(test)]
mod rfc5869_vectors {
    use hkdf::{Hkdf, InvalidLength};
    use serde::Deserialize;
    use sha2::Sha256;

    /// One vector entry. Only the fields this test needs are named; unknown
    /// JSON fields (`description`, `notes`, ...) are ignored by serde rather
    /// than mirrored here.
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Vector {
        id: String,
        should_pass: bool,
        ikm: String,
        salt: String,
        info: String,
        length: usize,
        prk: String,
        okm: String,
    }

    #[derive(Debug, Deserialize)]
    struct VectorFile {
        vectors: Vec<Vector>,
    }

    /// The RFC 5869 vector file imported verbatim in Stage 73, read at
    /// compile time so this test has no filesystem/IO dependency at runtime.
    const RFC5869_JSON: &str = include_str!("../../../test-vectors/kdf/hkdf-rfc5869.json");

    fn decode_hex(field: &str, id: &str, value: &str) -> Vec<u8> {
        hex::decode(value).unwrap_or_else(|err| {
            panic!("{id}: invalid hex in field `{field}`: {err}")
        })
    }

    /// Test-only HKDF-SHA256 EXTRACT helper — private `fn`, exists ONLY
    /// under `cfg(test)`, never `pub`/`pub(crate)`. Takes raw IKM/salt bytes
    /// (test-vector bytes, never a real secret) and returns the PRK.
    /// Infallible, matching the `hkdf` crate's own `extract` signature.
    fn extract_hkdf_sha256_for_test(ikm_bytes: &[u8], salt_bytes: &[u8]) -> Vec<u8> {
        let (prk, _) = Hkdf::<Sha256>::extract(Some(salt_bytes), ikm_bytes);
        prk.to_vec()
    }

    /// Test-only HKDF-SHA256 EXPAND helper — same scope/rules as
    /// [`extract_hkdf_sha256_for_test`] above. Takes a PRK (raw bytes, e.g.
    /// from [`extract_hkdf_sha256_for_test`] or a vector's own fixture
    /// value) + `info` + a desired output length, and returns OKM bytes on
    /// success, or the underlying `InvalidLength` error if the requested
    /// length is unsupported (RFC 5869 §2.3's `255 * HashLen` ceiling).
    fn expand_hkdf_sha256_for_test(
        prk_bytes: &[u8],
        info_bytes: &[u8],
        length: usize,
    ) -> Result<Vec<u8>, InvalidLength> {
        let hk = Hkdf::<Sha256>::from_prk(prk_bytes)
            .expect("test helper: PRK is not the correct length");
        let mut okm = vec![0u8; length];
        hk.expand(info_bytes, &mut okm)?;
        Ok(okm)
    }

    /// Test-only combined HKDF-SHA256 EXTRACT-THEN-EXPAND helper — same
    /// scope/rules as [`extract_hkdf_sha256_for_test`] above. Runs extract
    /// then expand in one call; returns `(prk_bytes, okm_bytes)` on success.
    fn extract_expand_hkdf_sha256_for_test(
        ikm_bytes: &[u8],
        salt_bytes: &[u8],
        info_bytes: &[u8],
        length: usize,
    ) -> Result<(Vec<u8>, Vec<u8>), InvalidLength> {
        let (prk, hk) = Hkdf::<Sha256>::extract(Some(salt_bytes), ikm_bytes);
        let mut okm = vec![0u8; length];
        hk.expand(info_bytes, &mut okm)?;
        Ok((prk.to_vec(), okm))
    }

    #[test]
    fn rfc5869_json_parses_and_is_non_empty() {
        let file: VectorFile =
            serde_json::from_str(RFC5869_JSON).expect("RFC 5869 vector JSON must parse");
        assert!(
            !file.vectors.is_empty(),
            "expected at least one RFC 5869 vector"
        );
    }

    /// `shouldPass=true` vectors: [`extract_hkdf_sha256_for_test`] must
    /// extract a PRK from IKM+salt matching the RFC's expected PRK,
    /// [`expand_hkdf_sha256_for_test`] must expand that PRK with `info` to
    /// exactly the RFC's expected `L`-octet OKM, and
    /// [`extract_expand_hkdf_sha256_for_test`] must reproduce both bytes in
    /// one combined call.
    #[test]
    fn rfc5869_positive_vectors_extract_and_expand_correctly() {
        let file: VectorFile =
            serde_json::from_str(RFC5869_JSON).expect("RFC 5869 vector JSON must parse");

        let mut checked = 0usize;
        for vector in file.vectors.iter().filter(|v| v.should_pass) {
            let ikm_bytes = decode_hex("ikm", &vector.id, &vector.ikm);
            let salt_bytes = decode_hex("salt", &vector.id, &vector.salt);
            let info_bytes = decode_hex("info", &vector.id, &vector.info);
            let prk_bytes = decode_hex("prk", &vector.id, &vector.prk);
            let okm_bytes = decode_hex("okm", &vector.id, &vector.okm);

            let prk = extract_hkdf_sha256_for_test(&ikm_bytes, &salt_bytes);
            assert_eq!(
                prk, prk_bytes,
                "{}: PRK did not match the RFC 5869 vector",
                vector.id
            );

            let okm = expand_hkdf_sha256_for_test(&prk_bytes, &info_bytes, vector.length)
                .unwrap_or_else(|err| panic!("{}: expand failed: {err}", vector.id));
            assert_eq!(
                okm, okm_bytes,
                "{}: OKM did not match the RFC 5869 vector",
                vector.id
            );

            let (combined_prk, combined_okm) = extract_expand_hkdf_sha256_for_test(
                &ikm_bytes,
                &salt_bytes,
                &info_bytes,
                vector.length,
            )
            .unwrap_or_else(|err| panic!("{}: extract_expand failed: {err}", vector.id));
            assert_eq!(
                combined_prk, prk_bytes,
                "{}: combined-helper PRK did not match the RFC 5869 vector",
                vector.id
            );
            assert_eq!(
                combined_okm, okm_bytes,
                "{}: combined-helper OKM did not match the RFC 5869 vector",
                vector.id
            );

            checked += 1;
        }
        assert!(
            checked > 0,
            "expected at least one shouldPass=true RFC 5869 vector to be checked"
        );
    }

    /// `shouldPass=false` vectors, if any exist in the imported file, must
    /// produce a PRK or OKM (via [`extract_expand_hkdf_sha256_for_test`])
    /// that does NOT match whatever (necessarily incorrect) expected bytes
    /// the fixture carries. The currently imported RFC 5869 file has no
    /// negative case (RFC 5869 Appendix A publishes only positive
    /// known-answer test cases for HKDF-SHA256 — see
    /// docs/crypto_vector_sources.md §2's verbatim-only import rule; none is
    /// fabricated here) — so today this loop body runs zero times and the
    /// test trivially passes. It exists so that IF a future,
    /// explicitly-reviewed re-import of this file ever adds an official
    /// negative case, this test starts enforcing it with no further code
    /// change required.
    #[test]
    fn rfc5869_negative_vectors_do_not_match_if_present() {
        let file: VectorFile =
            serde_json::from_str(RFC5869_JSON).expect("RFC 5869 vector JSON must parse");

        for vector in file.vectors.iter().filter(|v| !v.should_pass) {
            let ikm_bytes = decode_hex("ikm", &vector.id, &vector.ikm);
            let salt_bytes = decode_hex("salt", &vector.id, &vector.salt);
            let info_bytes = decode_hex("info", &vector.id, &vector.info);
            let prk_bytes = decode_hex("prk", &vector.id, &vector.prk);
            let okm_bytes = decode_hex("okm", &vector.id, &vector.okm);

            let (prk, okm) = extract_expand_hkdf_sha256_for_test(
                &ikm_bytes,
                &salt_bytes,
                &info_bytes,
                vector.length,
            )
            .unwrap_or_else(|err| panic!("{}: expand failed: {err}", vector.id));

            assert!(
                prk != prk_bytes || okm != okm_bytes,
                "{}: expected PRK or OKM mismatch for a shouldPass=false vector",
                vector.id
            );
        }
    }

    /// Unit test for the helpers themselves, independent of the vector
    /// file: an extract-then-expand round trip over fixed, non-secret,
    /// test-only bytes must agree between the three-helper path and the
    /// single combined-helper path.
    #[test]
    fn extract_then_expand_round_trip_for_test_helper() {
        let ikm_bytes = [0x11u8; 22];
        let salt_bytes = [0x22u8; 13];
        let info_bytes = b"info-for-test";
        let length = 42;

        let prk = extract_hkdf_sha256_for_test(&ikm_bytes, &salt_bytes);
        let okm = expand_hkdf_sha256_for_test(&prk, info_bytes, length)
            .expect("expand should succeed with a well-formed PRK");
        assert_eq!(okm.len(), length);

        let (combined_prk, combined_okm) =
            extract_expand_hkdf_sha256_for_test(&ikm_bytes, &salt_bytes, info_bytes, length)
                .expect("extract_expand should succeed with well-formed input");
        assert_eq!(combined_prk, prk);
        assert_eq!(combined_okm, okm);
    }

    /// Unit test for the EXPAND helper's failure path: RFC 5869 §2.3 caps
    /// HKDF-SHA256 output at `255 * 32` octets — requesting more must make
    /// [`expand_hkdf_sha256_for_test`] return an error.
    #[test]
    fn expand_fails_for_unsupported_length_for_test_helper() {
        let ikm_bytes = [0x33u8; 22];
        let salt_bytes = [0x44u8; 13];
        let prk = extract_hkdf_sha256_for_test(&ikm_bytes, &salt_bytes);

        let result = expand_hkdf_sha256_for_test(&prk, b"info-for-test", 255 * 32 + 1);
        assert!(
            result.is_err(),
            "expected an error for an out-of-range OKM length"
        );
    }
}

/// Stage 85 — RFC 9106 Argon2id known-answer verification, `#[cfg(test)]`
/// ONLY.
///
/// This module is not part of the crate's public API: it is compiled only
/// under `cargo test`, imports `argon2` (adopted as a production dependency
/// in Stage 84) purely to check that dependency against the official RFC
/// 9106 §5.3 Argon2id test vector, and implements no password-hashing/KDF
/// function that any other code — production or otherwise — can call.
/// `derive_key_placeholder` above is untouched.
///
/// Stage 86 extracts the Argon2id derivation logic that used to be written
/// as a per-vector helper into [`derive_argon2id_for_test`] — a private
/// `fn`, exists ONLY inside this `cfg(test)`-only module, takes raw
/// password/salt/secret/associatedData bytes plus the cost parameters
/// (mirroring the byte-level shape of Stage 81/83's
/// `seal_chacha20poly1305_for_test`/`extract_hkdf_sha256_for_test`), and is
/// NOT connected to the crate-private `kdf_core` skeleton (Stage 82) or
/// `secret_handle` (Stage 79) in any way. This is a test-only refactor: the
/// two vector tests below assert exactly the same things as before, just
/// calling the shared helper instead of building an `Argon2` inline.
#[cfg(test)]
mod rfc9106_vectors {
    use argon2::{Algorithm, Argon2, AssociatedData, Block, ParamsBuilder, Version};
    use serde::Deserialize;

    /// One vector entry. Only the fields this test needs are named; unknown
    /// JSON fields (`type`, `description`, `preHashingDigestH0`, `notes`,
    /// ...) are ignored by serde rather than mirrored here — `tag` (the
    /// final digest) is the only field RFC 9106 §5.3 publishes as a
    /// complete, independently-verifiable known-answer value (see the
    /// imported vector file's own `notes` field).
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Vector {
        id: String,
        should_pass: bool,
        version: u32,
        #[serde(rename = "memoryKiB")]
        memory_kib: u32,
        iterations: u32,
        parallelism: u32,
        tag_length: usize,
        password: String,
        salt: String,
        secret: String,
        associated_data: String,
        tag: String,
    }

    #[derive(Debug, Deserialize)]
    struct VectorFile {
        vectors: Vec<Vector>,
    }

    /// The RFC 9106 vector file imported verbatim in Stage 73, read at
    /// compile time so this test has no filesystem/IO dependency at runtime.
    const RFC9106_JSON: &str =
        include_str!("../../../test-vectors/kdf/argon2id-rfc9106.json");

    fn decode_hex(field: &str, id: &str, value: &str) -> Vec<u8> {
        hex::decode(value).unwrap_or_else(|err| {
            panic!("{id}: invalid hex in field `{field}`: {err}")
        })
    }

    /// Test-only Argon2id derivation helper — private `fn`, exists ONLY
    /// under `cfg(test)`, never `pub`/`pub(crate)`. Takes raw
    /// password/salt/secret/associatedData bytes (all test-vector bytes,
    /// never a real passphrase) plus the Argon2id cost parameters, and
    /// returns the computed tag on success, or the underlying
    /// `argon2::Error` on failure (e.g. invalid parameters). Hardcodes
    /// `Version::V0x13` (0x13 = 19) — RFC 9106 §5.3's own test vector, the
    /// only one this crate imports — rather than taking a version
    /// parameter; a future re-import with a different version would need
    /// this updated (each vector's own `version` field is still checked
    /// against it below, in the tests). `memory_blocks` is allocated with
    /// this crate's own `std::vec` (NOT `argon2`'s optional `alloc`
    /// feature, which is deliberately not enabled — see the Cargo.toml
    /// comment above the `argon2` entry), so no additional `argon2` feature
    /// is required beyond the `default-features = false` configuration
    /// already adopted Stage 84.
    fn derive_argon2id_for_test(
        password_bytes: &[u8],
        salt_bytes: &[u8],
        secret_bytes: &[u8],
        associated_data_bytes: &[u8],
        memory_cost_kib: u32,
        time_cost: u32,
        parallelism: u32,
        output_len: usize,
    ) -> argon2::Result<Vec<u8>> {
        let mut builder = ParamsBuilder::new();
        builder
            .m_cost(memory_cost_kib)
            .t_cost(time_cost)
            .p_cost(parallelism)
            .output_len(output_len)
            .data(AssociatedData::new(associated_data_bytes)?);
        let params = builder.build()?;
        let block_count = params.block_count();

        let argon2 =
            Argon2::new_with_secret(secret_bytes, Algorithm::Argon2id, Version::V0x13, params)?;

        let mut memory_blocks = vec![Block::default(); block_count];
        let mut tag = vec![0u8; output_len];
        argon2.hash_password_into_with_memory(
            password_bytes,
            salt_bytes,
            &mut tag,
            &mut memory_blocks,
        )?;
        Ok(tag)
    }

    #[test]
    fn rfc9106_json_parses_and_is_non_empty() {
        let file: VectorFile =
            serde_json::from_str(RFC9106_JSON).expect("RFC 9106 vector JSON must parse");
        assert!(
            !file.vectors.is_empty(),
            "expected at least one RFC 9106 vector"
        );
    }

    /// `shouldPass=true` vectors: [`derive_argon2id_for_test`] must produce
    /// exactly the RFC's expected tag from the vector's
    /// password/salt/secret/associatedData/memoryKiB/iterations/parallelism/
    /// tagLength.
    #[test]
    fn rfc9106_positive_vectors_hash_correctly() {
        let file: VectorFile =
            serde_json::from_str(RFC9106_JSON).expect("RFC 9106 vector JSON must parse");

        let mut checked = 0usize;
        for vector in file.vectors.iter().filter(|v| v.should_pass) {
            assert_eq!(
                vector.version, 0x13,
                "{}: derive_argon2id_for_test hardcodes RFC 9106 §5.3's version (0x13); \
                 update it if a future vector uses a different one",
                vector.id
            );

            let password_bytes = decode_hex("password", &vector.id, &vector.password);
            let salt_bytes = decode_hex("salt", &vector.id, &vector.salt);
            let secret_bytes = decode_hex("secret", &vector.id, &vector.secret);
            let ad_bytes = decode_hex("associatedData", &vector.id, &vector.associated_data);
            let expected_tag = decode_hex("tag", &vector.id, &vector.tag);

            let tag = derive_argon2id_for_test(
                &password_bytes,
                &salt_bytes,
                &secret_bytes,
                &ad_bytes,
                vector.memory_kib,
                vector.iterations,
                vector.parallelism,
                vector.tag_length,
            )
            .unwrap_or_else(|err| panic!("{}: derive failed: {err}", vector.id));

            assert_eq!(
                tag, expected_tag,
                "{}: Argon2id tag did not match the RFC 9106 vector",
                vector.id
            );

            checked += 1;
        }
        assert!(
            checked > 0,
            "expected at least one shouldPass=true RFC 9106 vector to be checked"
        );
    }

    /// `shouldPass=false` vectors, if any exist in the imported file, must
    /// produce a tag that does NOT match whatever (necessarily incorrect)
    /// expected bytes the fixture carries. RFC 9106 §5.3 publishes only the
    /// single positive Argon2id conformance vector — no byte-level
    /// tamper/negative vector — and none is fabricated here (per
    /// docs/crypto_vector_sources.md §2's verbatim-only import rule) — so
    /// today this loop body runs zero times and the test trivially passes.
    /// It exists so that IF a future, explicitly-reviewed re-import of this
    /// file ever adds an official negative case, this test starts enforcing
    /// it with no further code change required.
    #[test]
    fn rfc9106_negative_vectors_do_not_match_if_present() {
        let file: VectorFile =
            serde_json::from_str(RFC9106_JSON).expect("RFC 9106 vector JSON must parse");

        for vector in file.vectors.iter().filter(|v| !v.should_pass) {
            let password_bytes = decode_hex("password", &vector.id, &vector.password);
            let salt_bytes = decode_hex("salt", &vector.id, &vector.salt);
            let secret_bytes = decode_hex("secret", &vector.id, &vector.secret);
            let ad_bytes = decode_hex("associatedData", &vector.id, &vector.associated_data);
            let expected_tag = decode_hex("tag", &vector.id, &vector.tag);

            let tag = derive_argon2id_for_test(
                &password_bytes,
                &salt_bytes,
                &secret_bytes,
                &ad_bytes,
                vector.memory_kib,
                vector.iterations,
                vector.parallelism,
                vector.tag_length,
            )
            .unwrap_or_else(|err| panic!("{}: derive failed: {err}", vector.id));

            assert_ne!(
                tag, expected_tag,
                "{}: expected tag mismatch for a shouldPass=false vector",
                vector.id
            );
        }
    }

    /// Unit test for the helper itself, independent of the vector file:
    /// Argon2id must be deterministic — identical inputs must always
    /// produce identical output.
    #[test]
    fn derive_argon2id_is_deterministic_for_test_helper() {
        let password = b"password-for-test";
        let salt = b"salt-for-test-0123456789012345";
        let secret = b"secret-for-test";
        let ad = b"ad-for-test";

        let first = derive_argon2id_for_test(password, salt, secret, ad, 32, 3, 4, 32)
            .expect("derive should succeed with well-formed parameters");
        let second = derive_argon2id_for_test(password, salt, secret, ad, 32, 3, 4, 32)
            .expect("derive should succeed with well-formed parameters");

        assert_eq!(first.len(), 32);
        assert_eq!(first, second, "Argon2id must be deterministic for identical inputs");
    }

    /// Unit test for the helper's failure path: a memory cost below Argon2's
    /// own minimum (`Params::MIN_M_COST`, 8 KiB) must make
    /// [`derive_argon2id_for_test`] return an error.
    #[test]
    fn derive_argon2id_fails_for_unsupported_memory_cost_for_test_helper() {
        let result = derive_argon2id_for_test(b"password-for-test", b"salt-for-test", b"", b"", 1, 3, 4, 32);
        assert!(
            result.is_err(),
            "expected an error for an out-of-range memory cost"
        );
    }
}

/// Stage 101 — NIST CAVP AES-256-GCM known-answer verification,
/// `#[cfg(test)]` ONLY, with the seal/open helper extracted from the start
/// (unlike RFC 8439/RFC 9106, which were wired in one stage and refactored
/// into a shared helper in a later stage, this module adopts `aes-gcm` and
/// wires it with the helper already extracted, in the same Stage).
///
/// This module is not part of the crate's public API: it is compiled only
/// under `cargo test`, imports `aes-gcm` (adopted as a production
/// dependency in this same Stage) purely to check that dependency against
/// the official NIST vectors, and implements no encrypt/decrypt function
/// that any other code — production or otherwise — can call. The
/// placeholder functions above (`encrypt_placeholder`, `decrypt_placeholder`,
/// etc.) are untouched, and production code (everything before this file's
/// first `#[cfg(test)]`-gated module) still does not import `aes-gcm`
/// anywhere. The crate-private `aead_core` skeleton (Stage 80) remains
/// placeholder-only and is NOT connected to this module — same
/// "when a skeleton-to-skeleton connection is ambiguous, leave it
/// unconnected" reasoning `aead_core`'s own doc comment already states.
///
/// [`seal_aes256gcm_for_test`] and [`open_aes256gcm_for_test`] are private
/// `fn`s that exist ONLY inside this `cfg(test)`-only module, are not
/// `pub`/`pub(crate)`, are not re-exported, and mirror the byte-level shape
/// and `_for_test` naming convention `seal_chacha20poly1305_for_test`/
/// `open_chacha20poly1305_for_test` (Stage 81) and
/// `derive_argon2id_for_test` (Stage 86) already established.
#[cfg(test)]
mod aes256gcm_vectors {
    use aes_gcm::aead::{Aead, Error as AeadError, KeyInit, Payload};
    use aes_gcm::{Aes256Gcm, Key, Nonce};
    use serde::Deserialize;

    /// One vector entry. Only the fields this test needs are named; unknown
    /// JSON fields (`sourceFile`, `sourceCount`, `description`,
    /// `expectedResult`, ...) are ignored by serde rather than mirrored
    /// here. `plaintext` is `#[serde(default)]` because NIST's own official
    /// negative case (see `aes256gcm-nist.json`'s `notes` field) has no
    /// `plaintext` value at all — its source `.rsp` line reads `FAIL`.
    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Vector {
        id: String,
        should_pass: bool,
        key: String,
        iv: String,
        aad: String,
        #[serde(default)]
        plaintext: String,
        ciphertext: String,
        tag: String,
    }

    #[derive(Debug, Deserialize)]
    struct VectorFile {
        vectors: Vec<Vector>,
    }

    /// The NIST CAVP AES-256-GCM vector file imported verbatim in Stage 73,
    /// read at compile time so this test has no filesystem/IO dependency at
    /// runtime.
    const AES256GCM_JSON: &str =
        include_str!("../../../test-vectors/aead/aes256gcm-nist.json");

    fn decode_hex(field: &str, id: &str, value: &str) -> Vec<u8> {
        hex::decode(value).unwrap_or_else(|err| {
            panic!("{id}: invalid hex in field `{field}`: {err}")
        })
    }

    /// Test-only AES-256-GCM SEAL (encrypt-then-tag) helper — private `fn`,
    /// exists ONLY under `cfg(test)`, never `pub`/`pub(crate)`. Takes raw
    /// key/IV/plaintext/AAD bytes (all test-vector bytes, never a real
    /// secret) and returns `ciphertext‖tag` on success, or the underlying
    /// AEAD error on failure (e.g. a malformed key/IV length).
    fn seal_aes256gcm_for_test(
        key_bytes: &[u8],
        iv_bytes: &[u8],
        plaintext_bytes: &[u8],
        aad_bytes: &[u8],
    ) -> Result<Vec<u8>, AeadError> {
        assert_eq!(key_bytes.len(), 32, "test helper: key is not 32 bytes");
        assert_eq!(iv_bytes.len(), 12, "test helper: iv is not 12 bytes");
        let key = Key::<Aes256Gcm>::from_slice(key_bytes);
        let nonce = Nonce::from_slice(iv_bytes);
        let cipher = Aes256Gcm::new(key);
        cipher.encrypt(
            nonce,
            Payload {
                msg: plaintext_bytes,
                aad: aad_bytes,
            },
        )
    }

    /// Test-only AES-256-GCM OPEN (verify-then-decrypt) helper — same
    /// scope/rules as [`seal_aes256gcm_for_test`] above. `sealed_bytes` is
    /// `ciphertext‖tag`; returns the plaintext on success, or an error if
    /// authentication fails (e.g. for NIST's own official negative vector).
    fn open_aes256gcm_for_test(
        key_bytes: &[u8],
        iv_bytes: &[u8],
        sealed_bytes: &[u8],
        aad_bytes: &[u8],
    ) -> Result<Vec<u8>, AeadError> {
        assert_eq!(key_bytes.len(), 32, "test helper: key is not 32 bytes");
        assert_eq!(iv_bytes.len(), 12, "test helper: iv is not 12 bytes");
        let key = Key::<Aes256Gcm>::from_slice(key_bytes);
        let nonce = Nonce::from_slice(iv_bytes);
        let cipher = Aes256Gcm::new(key);
        cipher.decrypt(
            nonce,
            Payload {
                msg: sealed_bytes,
                aad: aad_bytes,
            },
        )
    }

    #[test]
    fn aes256gcm_json_parses_and_is_non_empty() {
        let file: VectorFile =
            serde_json::from_str(AES256GCM_JSON).expect("AES-256-GCM vector JSON must parse");
        assert!(
            !file.vectors.is_empty(),
            "expected at least one AES-256-GCM vector"
        );
    }

    /// `shouldPass=true` vectors: [`seal_aes256gcm_for_test`] must seal
    /// plaintext+AAD to exactly the NIST vector's expected ciphertext||tag,
    /// and [`open_aes256gcm_for_test`] must open that same ciphertext||tag
    /// back to exactly the NIST vector's expected plaintext.
    #[test]
    fn aes256gcm_positive_vectors_encrypt_and_decrypt_correctly() {
        let file: VectorFile =
            serde_json::from_str(AES256GCM_JSON).expect("AES-256-GCM vector JSON must parse");

        let mut checked = 0usize;
        for vector in file.vectors.iter().filter(|v| v.should_pass) {
            let key_bytes = decode_hex("key", &vector.id, &vector.key);
            let iv_bytes = decode_hex("iv", &vector.id, &vector.iv);
            let aad_bytes = decode_hex("aad", &vector.id, &vector.aad);
            let plaintext_bytes = decode_hex("plaintext", &vector.id, &vector.plaintext);
            let ciphertext_bytes = decode_hex("ciphertext", &vector.id, &vector.ciphertext);
            let tag_bytes = decode_hex("tag", &vector.id, &vector.tag);

            let mut expected_sealed = ciphertext_bytes.clone();
            expected_sealed.extend_from_slice(&tag_bytes);

            let sealed = seal_aes256gcm_for_test(&key_bytes, &iv_bytes, &plaintext_bytes, &aad_bytes)
                .unwrap_or_else(|err| panic!("{}: encrypt failed: {err}", vector.id));
            assert_eq!(
                sealed, expected_sealed,
                "{}: ciphertext||tag did not match the AES-256-GCM vector",
                vector.id
            );

            let opened = open_aes256gcm_for_test(&key_bytes, &iv_bytes, &expected_sealed, &aad_bytes)
                .unwrap_or_else(|err| panic!("{}: decrypt failed: {err}", vector.id));
            assert_eq!(
                opened, plaintext_bytes,
                "{}: decrypted plaintext did not match the AES-256-GCM vector",
                vector.id
            );

            checked += 1;
        }
        assert!(
            checked > 0,
            "expected at least one shouldPass=true AES-256-GCM vector to be checked"
        );
    }

    /// `shouldPass=false` vectors must fail to decrypt/authenticate via
    /// [`open_aes256gcm_for_test`] — NIST's own official negative case (see
    /// `aes256gcm-nist.json`'s `notes` field): an authentication-tag
    /// mismatch that MUST cause decryption to fail closed.
    #[test]
    fn aes256gcm_negative_vectors_fail_to_decrypt_if_present() {
        let file: VectorFile =
            serde_json::from_str(AES256GCM_JSON).expect("AES-256-GCM vector JSON must parse");

        let mut checked = 0usize;
        for vector in file.vectors.iter().filter(|v| !v.should_pass) {
            let key_bytes = decode_hex("key", &vector.id, &vector.key);
            let iv_bytes = decode_hex("iv", &vector.id, &vector.iv);
            let aad_bytes = decode_hex("aad", &vector.id, &vector.aad);
            let ciphertext_bytes = decode_hex("ciphertext", &vector.id, &vector.ciphertext);
            let tag_bytes = decode_hex("tag", &vector.id, &vector.tag);

            let mut sealed = ciphertext_bytes.clone();
            sealed.extend_from_slice(&tag_bytes);

            let result = open_aes256gcm_for_test(&key_bytes, &iv_bytes, &sealed, &aad_bytes);
            assert!(
                result.is_err(),
                "{}: expected decrypt/authentication failure for a shouldPass=false vector",
                vector.id
            );

            checked += 1;
        }
        assert!(
            checked > 0,
            "expected at least one shouldPass=false AES-256-GCM vector to be checked"
        );
    }

    /// Unit test for the helpers themselves, independent of the vector
    /// file: a seal-then-open round trip over fixed, non-secret, test-only
    /// bytes must return the original plaintext.
    #[test]
    fn seal_then_open_round_trip_for_test_helper() {
        let key_bytes = [0x11u8; 32];
        let iv_bytes = [0x22u8; 12];
        let aad_bytes = b"aad-for-test";
        let plaintext_bytes = b"plaintext-for-test";

        let sealed = seal_aes256gcm_for_test(&key_bytes, &iv_bytes, plaintext_bytes, aad_bytes)
            .expect("seal should succeed with a well-formed key/iv");
        let opened = open_aes256gcm_for_test(&key_bytes, &iv_bytes, &sealed, aad_bytes)
            .expect("open should succeed against its own sealed output");
        assert_eq!(opened, plaintext_bytes);
    }

    /// Unit test for the OPEN helper's failure path: tampering with the
    /// sealed bytes (the authentication tag, here) must make
    /// [`open_aes256gcm_for_test`] return an error.
    #[test]
    fn open_fails_for_tampered_sealed_bytes_for_test_helper() {
        let key_bytes = [0x33u8; 32];
        let iv_bytes = [0x44u8; 12];
        let aad_bytes = b"aad-for-test";
        let plaintext_bytes = b"plaintext-for-test";

        let mut sealed = seal_aes256gcm_for_test(&key_bytes, &iv_bytes, plaintext_bytes, aad_bytes)
            .expect("seal should succeed with a well-formed key/iv");
        let last = sealed.len() - 1;
        sealed[last] ^= 0xff;

        let result = open_aes256gcm_for_test(&key_bytes, &iv_bytes, &sealed, aad_bytes);
        assert!(
            result.is_err(),
            "expected authentication failure for tampered sealed bytes"
        );
    }
}

/// Stage 104 — `getrandom` CSPRNG dependency adoption (build check ONLY)
/// AND a future RNG-verification-infrastructure PLACEHOLDER.
///
/// Unlike every prior AEAD/KDF dependency (each verified against an
/// official known-answer vector file), a CSPRNG has no "correct" output
/// to reproduce — there is no known-answer vector for randomness. The
/// module below therefore does NOT import or call `getrandom` at all,
/// even under `#[cfg(test)]`: it exists ONLY to fix, as a label
/// enumeration, which categories a FUTURE, separately-reviewed wiring
/// stage would need to verify (entropy-source linkage, requested-length
/// matching, error surfaced as a `Result` rather than a panic, and that
/// repeated calls are not obviously constant) — see
/// `docs/public_random_design.md` for the full design record this
/// placeholder follows. No random byte is drawn, read, or asserted about
/// anywhere in this crate; asserting anything about actual randomness
/// QUALITY is explicitly out of scope for this stage. `getrandom` itself
/// is adopted as a `[dependencies]` (production) entry — see
/// `docs/rust_dependency_adoption.md` for the full crate review — but is
/// not imported or referenced anywhere in `src/lib.rs`, production or
/// test; `random_bytes_placeholder`/`fedos_random_boundary_status` are
/// byte-for-byte unchanged.
#[cfg(test)]
mod csprng_verification_infrastructure {
    /// A FUTURE verification category a real `getrandom`-wiring stage
    /// would need to cover — a label only, never exercised here.
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    enum RngVerificationCategory {
        /// The entropy source links and can be called at all.
        EntropySourceLinked,
        /// A requested output length is honored exactly.
        OutputLengthMatchesRequest,
        /// A failure surfaces as a `Result::Err`, never a panic.
        ErrorSurfacedAsResult,
        /// Two calls in immediate succession are not obviously identical.
        RepeatedCallsNotObviouslyConstant,
    }

    /// The fixed, non-exhaustive plan of future verification categories —
    /// intent only, never executed against a real entropy source here.
    const RNG_VERIFICATION_PLAN: &[RngVerificationCategory] = &[
        RngVerificationCategory::EntropySourceLinked,
        RngVerificationCategory::OutputLengthMatchesRequest,
        RngVerificationCategory::ErrorSurfacedAsResult,
        RngVerificationCategory::RepeatedCallsNotObviouslyConstant,
    ];

    /// The plan is fixed at exactly four categories — a literal length
    /// check, never a runtime-derived count.
    #[test]
    fn rng_verification_plan_is_fixed_and_non_empty() {
        assert_eq!(RNG_VERIFICATION_PLAN.len(), 4);
    }

    /// No category is listed twice — the plan itself is well-formed.
    #[test]
    fn rng_verification_plan_contains_no_duplicate_category() {
        let mut seen = std::collections::HashSet::new();
        for category in RNG_VERIFICATION_PLAN {
            assert!(seen.insert(*category), "duplicate category: {category:?}");
        }
    }
}

/// Stage 137 — `cargo test` coverage for [`fedos_random_bytes_32`], the
/// real `getrandom`-backed implementation added this stage.
///
/// Kept separate from `csprng_verification_infrastructure` (Stage 104)
/// above: that module is a label-only PLAN with no real entropy source to
/// exercise; this module tests the REAL implementation. A genuine OS
/// CSPRNG failure cannot be triggered deterministically from a portable
/// `cargo test` without fault-injection machinery this crate does not
/// have, so — per `docs/random_bytes_implementation_plan.md`'s own
/// fallback allowance — the failure PATH is exercised structurally (the
/// fixed `EntropySourceUnavailable` state is constructed directly and its
/// shape asserted) rather than by forcing a real `getrandom` error.
#[cfg(test)]
mod random_bytes_wiring {
    use super::*;

    /// A successful call always returns exactly 32 bytes, tagged
    /// `ThirtyTwo`/`Ready`.
    #[test]
    fn fedos_random_bytes_32_returns_ready_with_exactly_32_bytes() {
        let decision = fedos_random_bytes_32();
        assert_eq!(decision.length, FedosRandomBytesLength::ThirtyTwo);
        assert_eq!(decision.state, FedosRandomBytesState::Ready);
        let bytes = decision.bytes.expect("Ready state must carry bytes");
        assert_eq!(bytes.len(), 32);
    }

    /// Two calls in immediate succession are not obviously identical — a
    /// basic non-determinism sanity check, NOT a statistical proof of
    /// randomness quality (see `docs/random_bytes_implementation_plan.md`
    /// section 12, category 4). Two genuine 32-byte CSPRNG draws
    /// colliding has probability 1 in 2^256 — this is not treated as a
    /// flaky assertion.
    #[test]
    fn fedos_random_bytes_32_two_calls_are_not_obviously_identical() {
        let first = fedos_random_bytes_32()
            .bytes
            .expect("first call should succeed");
        let second = fedos_random_bytes_32()
            .bytes
            .expect("second call should succeed");
        assert_ne!(first, second);
    }

    /// The fixed failure state exists and carries no bytes — standing in
    /// for a real CSPRNG-failure test, which would require fault-injecting
    /// the OS entropy source (not available here). See
    /// `docs/random_bytes_implementation_plan.md` section 6: a failure
    /// must map to this exact state, with `bytes: None`, never a
    /// degraded/partial/fallback value.
    #[test]
    fn entropy_source_unavailable_state_carries_no_bytes() {
        let failure = FedosRandomBytesDecision {
            length: FedosRandomBytesLength::ThirtyTwo,
            state: FedosRandomBytesState::EntropySourceUnavailable,
            bytes: None,
        };
        assert_eq!(
            failure.state,
            FedosRandomBytesState::EntropySourceUnavailable
        );
        assert!(failure.bytes.is_none());
    }

    /// `FedosRandomBytesLength` supports exactly one variant today — an
    /// exhaustive match with no wildcard arm compiles only because no
    /// zero-length or caller-chosen-length variant exists to add one for.
    #[test]
    fn fedos_random_bytes_length_has_no_variant_other_than_thirty_two() {
        let length = FedosRandomBytesLength::ThirtyTwo;
        match length {
            FedosRandomBytesLength::ThirtyTwo => {}
        }
    }

    /// Repeated calls do not panic — ten calls in a row all succeed with
    /// the fixed shape (guards against a non-total implementation, not a
    /// performance benchmark).
    #[test]
    fn fedos_random_bytes_32_does_not_panic_across_repeated_calls() {
        for _ in 0..10 {
            let decision = fedos_random_bytes_32();
            assert_eq!(decision.length, FedosRandomBytesLength::ThirtyTwo);
            assert_eq!(decision.state, FedosRandomBytesState::Ready);
        }
    }
}

/// Stage 138 — `cargo test` coverage for [`fedos_aead_nonce_96`], the
/// real `getrandom`-backed nonce helper added this stage.
///
/// Mirrors `random_bytes_wiring`'s (Stage 137) shape exactly: a genuine
/// OS CSPRNG failure cannot be triggered deterministically from a
/// portable `cargo test` without fault-injection machinery this crate
/// does not have, so the failure PATH is exercised structurally (the
/// fixed `EntropySourceUnavailable` state is constructed directly and its
/// shape asserted) rather than by forcing a real `getrandom` error.
#[cfg(test)]
mod aead_nonce_wiring {
    use super::*;

    /// A successful call always returns exactly 12 bytes, tagged
    /// `NinetySixBit`/`Ready`.
    #[test]
    fn fedos_aead_nonce_96_returns_ready_with_exactly_12_bytes() {
        let decision = fedos_aead_nonce_96();
        assert_eq!(decision.kind, FedosAeadNonceKind::NinetySixBit);
        assert_eq!(decision.state, FedosNonceState::Ready);
        let nonce = decision.nonce.expect("Ready state must carry a nonce");
        assert_eq!(nonce.len(), 12);
    }

    /// Two calls in immediate succession are not obviously identical — a
    /// basic non-determinism sanity check, NOT a statistical proof of
    /// randomness quality. Two genuine 12-byte CSPRNG draws colliding has
    /// probability 1 in 2^96 — this is not treated as a flaky assertion.
    #[test]
    fn fedos_aead_nonce_96_two_calls_are_not_obviously_identical() {
        let first = fedos_aead_nonce_96()
            .nonce
            .expect("first call should succeed");
        let second = fedos_aead_nonce_96()
            .nonce
            .expect("second call should succeed");
        assert_ne!(first, second);
    }

    /// The fixed failure state exists and carries no bytes — standing in
    /// for a real CSPRNG-failure test, which would require fault-injecting
    /// the OS entropy source (not available here).
    #[test]
    fn entropy_source_unavailable_state_carries_no_nonce() {
        let failure = FedosAeadNonceDecision {
            kind: FedosAeadNonceKind::NinetySixBit,
            state: FedosNonceState::EntropySourceUnavailable,
            nonce: None,
        };
        assert_eq!(failure.state, FedosNonceState::EntropySourceUnavailable);
        assert!(failure.nonce.is_none());
    }

    /// `FedosAeadNonceKind` supports exactly one variant today — an
    /// exhaustive match with no wildcard arm compiles only because no
    /// zero-length, variable-length, or caller-chosen-length variant
    /// exists to add one for.
    #[test]
    fn fedos_aead_nonce_kind_has_no_variant_other_than_ninety_six_bit() {
        let kind = FedosAeadNonceKind::NinetySixBit;
        match kind {
            FedosAeadNonceKind::NinetySixBit => {}
        }
    }

    /// Repeated calls do not panic — ten calls in a row all succeed with
    /// the fixed shape (guards against a non-total implementation, not a
    /// performance benchmark).
    #[test]
    fn fedos_aead_nonce_96_does_not_panic_across_repeated_calls() {
        for _ in 0..10 {
            let decision = fedos_aead_nonce_96();
            assert_eq!(decision.kind, FedosAeadNonceKind::NinetySixBit);
            assert_eq!(decision.state, FedosNonceState::Ready);
        }
    }

    /// The nonce helper is independent of `fedos_random_bytes_32` — two
    /// calls, one to each function, both succeed independently (guards
    /// against a future refactor accidentally making one call the other
    /// internally, which would violate the "two boundaries, not one"
    /// design `docs/public_random_boundary.md` section 1 fixed).
    #[test]
    fn fedos_aead_nonce_96_and_fedos_random_bytes_32_both_succeed_independently() {
        let nonce_decision = fedos_aead_nonce_96();
        let random_decision = fedos_random_bytes_32();
        assert_eq!(nonce_decision.state, FedosNonceState::Ready);
        assert_eq!(random_decision.state, FedosRandomBytesState::Ready);
    }
}
