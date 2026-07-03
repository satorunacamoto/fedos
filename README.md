# nostr-window

A Reddit-style **window into Nostr**. Where Damus/Primal render Nostr as a
Twitter-like timeline, this product organizes the same underlying Nostr events
into Reddit-style threads, with paths toward communities, channels, groups, DMs,
digital goods, and promotion.

The architecture is a **Nostr + own-DB hybrid** (not fully decentralized at
first), targeting Cloudflare Workers + D1 + KV + R2.

> **Status: Stage 102 — Public crypto API design docs + a placeholder API
> boundary (no encrypt/decrypt/deriveKey/randomBytes implementation, no
> Runtime/Worker/CryptoProvider/WASM wiring, `Cargo.toml` unchanged).**
> [`docs/fedos_core_public_api_design.md`](docs/fedos_core_public_api_design.md)
> (new) fixes the DESIGN — not the implementation — of a future public
> `encrypt`/`decrypt`/`deriveKey`/`randomBytes` API in twelve numbered
> sections: purpose; the future shape of each operation; why input stays
> centered on an opaque secret handle/reference even in the future design;
> why a raw key/seed/passphrase must never be a direct parameter; the two
> AEAD candidates (ChaCha20-Poly1305, AES-256-GCM); the two KDF candidates
> (HKDF-SHA256, Argon2id); why nonce/random generation is its own separate
> design boundary; a fixed error taxonomy with no raw error text or stack
> trace; an audit boundary recording labels only, never a payload;
> Runtime/WASM wiring deferred to its own future stage; an explicit
> statement that this stage is placeholder API boundary ONLY; and a
> six-step implementation roadmap. `packages/fedos-core-rust/src/lib.rs`
> gains this crate's first new PUBLIC items since Stage 69 (placed right
> after the Stage 69 placeholder functions, still ahead of Stage 79's
> `secret_handle` module): `FedosCryptoOperation` (`pub enum`: `Encrypt` /
> `Decrypt` / `DeriveKey` / `RandomBytes`), `FedosCryptoAlgorithm`
> (`pub enum`: `ChaCha20Poly1305` / `Aes256Gcm` / `HkdfSha256` /
> `Argon2id`), `FedosCryptoBoundaryState` (`pub enum`: `Unavailable` /
> `Placeholder`), `FedosCryptoBoundaryStatus` (`pub struct`, carries only
> the state enum), `FedosCryptoRequestDescriptor` (`pub struct`, carries
> only `operation`/`algorithm`), `FedosCryptoResponseDescriptor`
> (`pub struct`, carries only `operation`/`algorithm`/`state`), and one new
> public function, `fedos_crypto_boundary_status()`, which takes no input
> and returns a fixed, permanently `Unavailable` status exactly like
> `fedos_core_status()`. This grows the crate's public `pub fn` surface
> from six to seven for the FIRST time since Stage 69 — the six Stage 69
> placeholder functions are byte-for-byte unchanged. Every new type holds
> ONLY fixed enum labels — no borrowed byte slice, `Vec<u8>`, or `String`
> field anywhere, no key/seed/plaintext/ciphertext/passphrase/nonce/tag
> byte, and no field of any crate-private skeleton type; nothing is wired
> into the Runtime, the Worker, or `CryptoProvider`, and `Cargo.toml` is
> UNCHANGED (no new dependency needed for label-only types). New
> [`test/fedos_core_rust_public_api_boundary.test.ts`](test/fedos_core_rust_public_api_boundary.test.ts)
> (19 tests) checks: the design doc exists and covers all twelve sections,
> the six new type declarations, the seven-function `pub fn` surface, no
> encrypt/decrypt/derive/random IMPLEMENTATION function, no raw byte
> parameter or `Vec<u8>` field anywhere in the new boundary, the six Stage
> 69 functions unchanged, no key/seed/plaintext/ciphertext/passphrase/
> nonce/tag storage field, no actual AEAD/KDF crate usage (specific
> crate-usage patterns, not a bare substring match — this stage's own
> `FedosCryptoAlgorithm::Aes256Gcm`/`ChaCha20Poly1305` labels legitimately
> contain "aes"/"gcm"/"chacha"/"poly1305" as substrings) or `SecretHandle`
> connection, Runtime/Worker untouched, `Cargo.toml` byte-count and
> seven-entry dependency-table check, no `unsafe`, no committed build
> artifact. Because the new algorithm labels legitimately contain AEAD
> substrings, four pre-existing guard test files with a bare
> `chacha|poly1305|xchacha|aes|gcm` substring check against production code
> (`test/fedos_core_rust_dependency.test.ts`,
> `test/fedos_core_rust_skeleton.test.ts`,
> `test/fedos_core_rust_aes_gcm_wiring.test.ts`,
> `test/fedos_core_rust_aead_test_helper.test.ts`) were updated to specific
> crate-usage patterns instead (`use chacha20poly1305`, `aes_gcm::`,
> `Aes256Gcm::new`, etc.), and twenty-one pre-existing files' hard-coded
> "exactly six `pub fn`" checks were updated to seven, including the new
> `fedos_crypto_boundary_status` name. `npm run typecheck`, `npm test`
> (1459 tests), `cargo check`, `cargo test` (106 tests, same count as Stage
> 101 — no new Rust unit test this stage), and `cargo check --tests` all
> stay GREEN. Stage 103 candidate: **a public `randomBytes` placeholder
> boundary** — fixing nonce/random generation as its own design point
> (per this stage's docs §7) before any public `encrypt`/`decrypt`
> skeleton needs to consume its output; the two other candidates offered
> were a WASM manifest validation skeleton and a NIP-44 vector
> source/update check. Prior status:
>
> **Stage 101 — Adopt `aes-gcm` AND wire the NIST AES-256-GCM
> vectors to `cargo test`, with the seal/open test-only helper extracted
> from the start (one combined Stage; no public encrypt/decrypt API, no
> Runtime/Worker/CryptoProvider wiring, no production `aes-gcm` use).**
> `packages/fedos-core-rust/Cargo.toml` gains a SEVENTH `[dependencies]`
> (production) entry, `aes-gcm` v0.10.3 (RustCrypto, Apache-2.0 OR MIT,
> `default-features = false`, `features = ["aes", "alloc"]` — no
> `getrandom`), this crate's SECOND AEAD alongside `chacha20poly1305`
> (Stage 74). Unlike every prior AEAD/KDF dependency (which spread
> "adopt"/"wire"/"extract a helper" across separate, later Stages —
> `chacha20poly1305` Stage 74→75→81; `argon2` Stage 84→85→86), this Stage
> combines all three into one reviewed unit: `packages/fedos-core-rust/src/lib.rs`
> gains a new `#[cfg(test)]`-only module, `aes256gcm_vectors`, that reads
> [`test-vectors/aead/aes256gcm-nist.json`](test-vectors/aead/aes256gcm-nist.json)
> (NIST CAVP AES-256-GCM known-answer vectors, imported Stage 73) via
> `include_str!` and asserts `aes-gcm` reproduces its expected bytes, via
> two private, test-only helpers extracted from the start —
> `seal_aes256gcm_for_test`/`open_aes256gcm_for_test` — mirroring
> `seal_chacha20poly1305_for_test`/`open_chacha20poly1305_for_test`'s
> (Stage 81) byte-level shape exactly; neither is `pub`/`pub(crate)`, and
> neither is re-exported. The crate-private `aead_core` skeleton (Stage
> 80) is UNCHANGED and remains placeholder-only, not connected to the new
> module — same "when in doubt, leave unconnected" reasoning every
> skeleton stage already established. `cargo test` is GREEN with all 106
> tests passing (101 pre-existing + 5 new `aes256gcm_vectors` tests);
> `cargo check` and `cargo check --tests` stay GREEN with no warnings.
> Production code (everything before `src/lib.rs`'s first
> `cfg(test)`-gated module) still does not import, reference, or call
> `aes-gcm` anywhere, and the crate-level doc comment stays free of any
> AEAD crate/algorithm name (same convention Stage 75/77/85 already
> established) — its Stage 101 paragraph describes the new module only as
> "an official NIST-sourced AEAD known-answer vector file" and "a SECOND
> AEAD dependency", never spelling out "AES"/"GCM"/"aes-gcm" literally, to
> avoid colliding with this repo's own bare-substring production-code
> guard checks. `encrypt_placeholder`/`decrypt_placeholder`/
> `derive_key_placeholder` remain byte-for-byte unchanged, and the crate's
> public `pub fn` surface stays exactly the same six placeholder functions
> from Stage 69. New
> [`test/fedos_core_rust_aes_gcm_wiring.test.ts`](test/fedos_core_rust_aes_gcm_wiring.test.ts)
> (18 tests) checks: `aes-gcm` dependency presence and the seven-entry
> production dependency count, no direct `rand`/`getrandom` and no
> `wasm-bindgen`, the vector module is gated behind `cfg(test)` only, no
> production `aes-gcm`/`Aes256Gcm` reference (a bare `chacha|poly1305|
> xchacha|aes|gcm` substring check across ALL of production code, not
> just an import-statement check), public `pub fn` count still 6,
> `aead_core` unchanged and still placeholder-only with no reference to
> the new module (and vice versa), the two test-only helpers exist,
> are private, and are never re-exported, `include_str!` reads the exact
> NIST vector path, positive AND negative vector coverage both exist and
> are exercised, no production key/nonce/plaintext/ciphertext/tag storage
> field, Runtime/Worker untouched, no committed build artifact. Three
> pre-existing guard test files
> (`test/fedos_core_rust_dependency.test.ts`,
> `test/fedos_core_rust_skeleton.test.ts`,
> `test/fedos_core_rust_rfc8439_wiring.test.ts`,
> `test/fedos_core_rust_hkdf_wiring.test.ts`) were updated because they
> previously asserted `aes-gcm`'s ABSENCE from `Cargo.toml` and a
> six-entry production dependency count — both now flipped to assert
> presence and a seven-entry count, consistent with every prior
> dependency-adoption stage's update pattern.
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md)
> §12 gains a dedicated `aes-gcm` — Stage 101 entry (crate review, feature
> configuration, 10 new transitive packages, 39-package combined
> production graph, `unsafe`/build-script/license/MSRV review, what was
> done vs. NOT done). Stage 102 candidate: **internal public-API design
> docs** — fixing, in writing, what a future public `encrypt`/`decrypt`/
> `deriveKey` signature, error taxonomy, and secret-handling contract
> would look like, reusing the label vocabulary Stage 79–99's skeletons
> and the Architecture Freeze v1 (Stage 100) already fixed — still no
> public API implementation. Prior status:
>
> **Stage 100 — FedOS Core Architecture Freeze v1 (docs only, no
> src changes, no `Cargo.toml` changes, no crypto implementation).**
> [`docs/fedos_core_architecture_freeze_v1.md`](docs/fedos_core_architecture_freeze_v1.md)
> (new) fixes, in writing, the internal type architecture Stage 79–99
> built: sixteen crate-private, label-only skeleton modules inside
> `packages/fedos-core-rust/src/lib.rs`
> (`secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`/
> `operation_context`/`request_descriptor`/`response_descriptor`/
> `crypto_pipeline`/`descriptor_bundle`/`execution_plan`/`error_taxonomy`/
> `audit_event`/`audit_policy`/`lifecycle_state`/`module_registry`), a
> role table for all sixteen, which pairs are explicitly NOT connected
> (with the three narrow, label-reuse-only exceptions already established
> in prior stages), confirmation that the public API is still exactly the
> six Stage 69 placeholder functions, confirmation that none of the
> sixteen modules is wired into the Runtime/Worker/`CryptoProvider`, a
> summary of what IS verified today (RFC 8439 ChaCha20-Poly1305, RFC 5869
> HKDF, and RFC 9106 Argon2id — all under `cfg(test)` only, none reachable
> from any public function), an explicit list of what is NOT yet
> implemented (public `encrypt`/`decrypt`, public `deriveKey`, CSPRNG,
> key generation, NIP-44, Nostr key derivation, AES-GCM, WASM loading,
> Runtime crypto execution), a non-claims section banning
> "military-grade"/"zero-trace"/"unbreakable"-style language and
> confirming no skeleton holds a log/secret/stack-trace, and a
> recommended next-phase order (AES-GCM dependency adoption → AES-GCM
> NIST vector wiring → a test-only AES-GCM helper → internal public-API
> design docs → only then a public `encrypt`/`decrypt` skeleton). **This
> stage changes NO code**: `src/`,
> `packages/fedos-core-rust/src/lib.rs`, `packages/fedos-core-rust/Cargo.toml`,
> and every existing test file are byte-for-byte unchanged; `npm run
> typecheck`, `npm test` (1422 tests, same count as Stage 99), `cargo
> check`, and `cargo test` (101 tests, same count as Stage 99) all stay
> GREEN because nothing they check changed. Stage 101 candidate: **adopt
> the `aes-gcm` dependency** — a dependency + build-check ADOPTION ONLY,
> exactly like every prior dependency stage (`chacha20poly1305` Stage 74,
> `hkdf` Stage 76, `argon2` Stage 84); no code imports or calls it yet.
> Prior status:
>
> **Stage 99 — Internal module registry skeleton (internal-only
> `module_registry` module; fixed enumeration labels only for every
> skeleton module added since Stage 79, no dynamic registry mechanism,
> `registered_module_count()` hardcoded to 15, no logging, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a sixteenth crate-private
> module, `module_registry` (alongside Stage 79's `secret_handle`, Stage
> 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`,
> Stage 88's `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, Stage 93's `descriptor_bundle`, Stage 94's
> `execution_plan`, Stage 95's `error_taxonomy`, Stage 96's
> `audit_event`, Stage 97's `audit_policy`, and Stage 98's
> `lifecycle_state`, placed right after `lifecycle_state`, still ahead
> of this file's first module gated `cfg(test)`). It defines:
> `ModuleRegistryState` (`pub(crate) enum`, `Disabled`/`Placeholder` —
> `Disabled` is the `Default`); `ModuleRegistryKind` (`pub(crate) enum`,
> sixteen label-only unit variants, one ENUMERATION label per
> crate-private skeleton module added since Stage 79 plus
> `TestOnlyPlaceholder` — `SecretHandlePlaceholder`/`AeadCorePlaceholder`/
> `KdfCorePlaceholder`/`KeyMaterialPlaceholder`/`DomainLabelPlaceholder`/
> `OperationContextPlaceholder`/`RequestDescriptorPlaceholder`/
> `ResponseDescriptorPlaceholder`/`CryptoPipelinePlaceholder`/
> `DescriptorBundlePlaceholder`/`ExecutionPlanPlaceholder`/
> `ErrorTaxonomyPlaceholder`/`AuditEventPlaceholder`/
> `AuditPolicyPlaceholder`/`LifecycleStatePlaceholder`/
> `TestOnlyPlaceholder` — none of these variants ever constructs, holds,
> or reads a field of the module it names); `ModuleRegistryStatus`
> (`pub(crate) struct`, a non-sensitive status snapshot carrying only the
> state enum); and `ModuleRegistry` (`pub(crate) struct`, holding
> `kind`/`state`) with five methods: `new_placeholder(kind:
> ModuleRegistryKind)` (takes only the label — no user-, environment-, or
> config-derived input of any kind), `kind()`, `status()`,
> `is_placeholder()`, and `registered_module_count()` (returns the
> hardcoded `usize` literal `15` — the real skeleton count, excluding
> `TestOnlyPlaceholder` — regardless of `kind`, never a length method
> call and never computed from any collection). **NOT part of this
> crate's public API**: every item is `pub(crate)` at most — never
> `pub` — nothing is re-exported from the crate root, and the crate's
> public `pub fn` surface is still exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns a
> `ModuleRegistry`. **Enumeration labels only — no dynamic registry, no
> logging**: `ModuleRegistry` writes to no stdout/stderr/log sink of any
> kind (no `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere),
> uses no `.len()`/`Vec`/`HashMap`/`BTreeMap`/`HashSet`/`BTreeSet`/
> static-array/`lazy_static`/`once_cell`/`inventory`-crate mechanism
> anywhere, and holds no `String`/`Vec<u8>`/borrowed-byte-slice field of
> any kind. **No module construction or reference**: `ModuleRegistry`
> does not construct or hold a `SecretHandle`, `AeadPlaceholderRequest`,
> `KdfPlaceholderRequest`, `KeyMaterialHandle`, `DomainLabel`,
> `OperationContext`, `RequestDescriptor`, `ResponseDescriptor`,
> `CryptoPipeline`, `DescriptorBundle`, `ExecutionPlan`,
> `CryptoErrorDescriptor`, `AuditEventLabel`, `AuditPolicy`, or
> `LifecycleMarker` — same "if in doubt, stay fully independent" choice
> Stage 93/94/95/96/97/98 already made. **Not connected to
> `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
> `domain_label`, `operation_context`, `request_descriptor`,
> `response_descriptor`, `crypto_pipeline`, `descriptor_bundle`,
> `execution_plan`, `error_taxonomy`, `audit_event`, `audit_policy`, or
> `lifecycle_state`** — `module_registry` never constructs any of their
> types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, derives no
> Nostr key, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage
> 80/82/87/88/89/90/91/92/93/94/95/96/97/98 already established; all
> fifteen of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 101 tests passing (96
> pre-existing + 5 new `module_registry::tests`); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — no new dependency needed (`module_registry`
> imports nothing beyond the standard library). New
> [`test/fedos_core_rust_module_registry.test.ts`](test/fedos_core_rust_module_registry.test.ts)
> (21 tests) checks: the module is internal-only and not `pub`;
> `ModuleRegistry` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged;
> `ModuleRegistry` holds only `kind`/`state`; `registered_module_count()`
> returns the hardcoded literal `15`; no
> `.len()`/`Vec`/`HashMap`/`BTreeMap`/`HashSet`/`BTreeSet`/static-array/
> `lazy_static`/`once_cell`/`inventory`-crate usage; no `String`/`Vec`
> field anywhere in the module; no payload/timestamp/counter
> field-declaration; no
> `println!`/`eprintln!`/`print!`/`eprint!`/`tracing::`/`log::`/`dbg!`
> usage; `new_placeholder` takes only a `ModuleRegistryKind`; no
> `std::env`/`env::`/`var_os`/`std::process` usage; no
> `CryptoProvider`/`Runtime`/`Worker` bare-word reference; no AEAD/HKDF/
> Argon2 usage (specific Rust-usage patterns only, not a bare word
> match, same lesson learned Stage 89-98); no field DECLARATION storing
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/
> `RequestDescriptor`/`ResponseDescriptor`/`CryptoPipeline`/
> `DescriptorBundle`/`ExecutionPlan`/`CryptoErrorDescriptor`/
> `AuditEventLabel`/`AuditPolicy`/`LifecycleMarker` (nor do those
> fifteen modules reference `ModuleRegistry*`); no `unsafe`; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the
> registry has exactly sixteen `ModuleRegistryKind` enumeration labels,
> two `ModuleRegistryState` variants, and the handle exposes exactly its
> five methods. **Fix during this stage**: the module's own doc
> comments originally wrote the literal text `.len()` when describing
> what does NOT happen (never a `.len()` call), which would have
> collided with the guard test's own bare-pattern absence check for
> that exact string (the same self-referential doc-comment trap as
> Stage 81/84/88-93/94) — fixed by rewording to "a length method call"
> in prose instead of the literal method-call spelling. Stage 100
> recommendation (per the user's own guidance): an **Architecture
> Freeze v1** — a documentation-only checkpoint fixing the roles,
> boundaries, and non-connection rules of every internal skeleton added
> Stage 79 through Stage 99 into a single design record, without
> changing any implementation, before moving on to a real
> cryptography-adoption phase (e.g. AES-GCM). Prior status:
>
> **Stage 98 — Internal lifecycle state skeleton (internal-only
> `lifecycle_state` module; fixed lifecycle states/kinds only, no
> logging, no payload, no timestamp/counter, no existing-module wiring
> yet, no real AEAD/HKDF/Argon2/NIP-44 connection, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a fifteenth crate-private
> module, `lifecycle_state` (alongside Stage 79's `secret_handle`, Stage
> 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`,
> Stage 88's `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, Stage 93's `descriptor_bundle`, Stage 94's
> `execution_plan`, Stage 95's `error_taxonomy`, Stage 96's
> `audit_event`, and Stage 97's `audit_policy`, placed right after
> `audit_policy`, still ahead of this file's first module gated
> `cfg(test)`). It defines: `LifecycleState` (`pub(crate) enum`, six
> variants — `Disabled`/`Placeholder`/`PreparedPlaceholder`/
> `ActivePlaceholder`/`ClearedPlaceholder`/`ErrorPlaceholder` —
> `Disabled` is the `Default`); `LifecycleKind` (`pub(crate) enum`,
> `CryptoProviderLifecyclePlaceholder`/`RequestLifecyclePlaceholder`/
> `SecretLifecyclePlaceholder`/`AuditLifecyclePlaceholder`/
> `PipelineLifecyclePlaceholder`/`TestOnlyLifecyclePlaceholder` — six
> label-only unit variants); `LifecycleStatus` (`pub(crate) struct`, a
> non-sensitive status snapshot carrying only the state enum); and
> `LifecycleMarker` (`pub(crate) struct`, holding `kind`/`state`) with
> eight methods: `new_placeholder(kind: LifecycleKind)` (takes only the
> label — no user-, environment-, or config-derived input of any kind),
> `kind()`, `status()`, `is_placeholder()`, and four coarse transition
> methods — `mark_prepared_placeholder()`, `mark_active_placeholder()`,
> `mark_cleared_placeholder()`, `mark_error_placeholder()` — each taking
> no input beyond `&mut self` and only ever setting the fixed `state`
> label. **NOT part of this crate's public API**: every item is
> `pub(crate)` at most — never `pub` — nothing is re-exported from the
> crate root, and the crate's public `pub fn` surface is still exactly
> the same six placeholder functions from Stage 69; none of them
> constructs, holds, or returns a `LifecycleMarker`. **No logging, no
> payload, no timestamp, no counter**: `LifecycleMarker` writes to no
> stdout/stderr/log sink of any kind (no
> `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere) and holds
> no payload/timestamp/counter field of any kind. **No existing-module
> wiring — a fully independent, label-only skeleton**: `LifecycleMarker`
> does not construct or hold a `SecretHandle`, `AeadPlaceholderRequest`,
> `KdfPlaceholderRequest`, `KeyMaterialHandle`, `DomainLabel`,
> `OperationContext`, `RequestDescriptor`, `ResponseDescriptor`,
> `CryptoPipeline`, `DescriptorBundle`, `ExecutionPlan`,
> `CryptoErrorDescriptor`, `AuditEventLabel`, or `AuditPolicy` — same "if
> in doubt, stay fully independent" choice Stage 93/94/95/96/97 already
> made; `LifecycleMarker` stores no `String`/`Vec<u8>`/borrowed-byte-slice
> field of any kind. **Not connected to `secret_handle`, `aead_core`,
> `kdf_core`, `key_material`, `domain_label`, `operation_context`,
> `request_descriptor`, `response_descriptor`, `crypto_pipeline`,
> `descriptor_bundle`, `execution_plan`, `error_taxonomy`, `audit_event`,
> or `audit_policy`** — `lifecycle_state` never constructs any of their
> types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, derives no
> Nostr key, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage
> 80/82/87/88/89/90/91/92/93/94/95/96/97 already established; all
> fourteen of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 96 tests passing (88
> pre-existing + 8 new `lifecycle_state::tests`); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — no new dependency needed (`lifecycle_state`
> imports nothing beyond the standard library). New
> [`test/fedos_core_rust_lifecycle_state.test.ts`](test/fedos_core_rust_lifecycle_state.test.ts)
> (19 tests) checks: the module is internal-only and not `pub`;
> `LifecycleMarker` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `LifecycleKind`/`LifecycleState` variant is a label-only unit variant
> (no tuple/struct data); no `String`/`Vec` field anywhere in the module;
> no payload/timestamp/counter field-declaration (including no
> `SystemTime`/`Instant`/`u64`/`u32` usage); no
> `println!`/`eprintln!`/`print!`/`eprint!`/`tracing::`/`log::`/`dbg!`
> usage; `new_placeholder` takes only a `LifecycleKind` and every
> `mark_*_placeholder` method takes nothing beyond `&mut self`; no
> `std::env`/`env::`/`var_os`/`std::process` usage; no AEAD/HKDF/Argon2
> usage (specific Rust-usage patterns only, not a bare word match, same
> lesson learned Stage 89-97); no field DECLARATION storing
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/
> `RequestDescriptor`/`ResponseDescriptor`/`CryptoPipeline`/
> `DescriptorBundle`/`ExecutionPlan`/`CryptoErrorDescriptor`/
> `AuditEventLabel`/`AuditPolicy` (nor do those fourteen modules
> reference `Lifecycle*`); no `unsafe`; Runtime/Worker sources mention
> neither `lifecycle_state` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the handle
> exposes exactly its eight methods. Stage 99 candidate: **an internal
> module registry skeleton** — listing the internal skeleton modules
> added so far by fixed label only, still not connecting any of them
> together. Prior status:
>
> **Stage 97 — Internal audit policy skeleton (internal-only
> `audit_policy` module; fixed policy/decision labels only, no logging, no
> observation payload, no `audit_event` wiring yet, no
> descriptor/pipeline/plan/error wiring yet, no real AEAD/HKDF/Argon2/
> NIP-44 connection, no Runtime/Worker/CryptoProvider wiring, no WASM
> change).**
> `packages/fedos-core-rust/src/lib.rs` gains a fourteenth crate-private
> module, `audit_policy` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage 88's
> `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, Stage 93's `descriptor_bundle`, Stage 94's
> `execution_plan`, Stage 95's `error_taxonomy`, and Stage 96's
> `audit_event`, placed right after `audit_event`, still ahead of this
> file's first module gated `cfg(test)`). It defines: `AuditPolicyState`
> (`pub(crate) enum`, `Placeholder`/`Disabled` — `Disabled` is the
> `Default`, same shape as `AuditEventState`); `AuditPolicyKind`
> (`pub(crate) enum`, `MinimalPlaceholder`/`DevelopmentPlaceholder`/
> `TestOnlyPlaceholder` — three label-only unit variants);
> `AuditPolicyDecision` (`pub(crate) enum`, `AllowPlaceholder`/
> `DenyPlaceholder` — two label-only unit variants); `AuditPolicyStatus`
> (`pub(crate) struct`, a non-sensitive status snapshot carrying only the
> state enum); and `AuditPolicy` (`pub(crate) struct`, holding
> `kind`/`state`) with five methods: `new_placeholder(kind:
> AuditPolicyKind)` (takes only the label — no user-, environment-, or
> config-derived input of any kind), `kind()`, `status()`,
> `is_placeholder()`, and `decision_placeholder()` (takes NO input and
> always returns the fixed safe-default label
> `AuditPolicyDecision::DenyPlaceholder`, regardless of `kind`). **NOT
> part of this crate's public API**: every item is `pub(crate)` at most —
> never `pub` — nothing is re-exported from the crate root, and the
> crate's public `pub fn` surface is still exactly the same six
> placeholder functions from Stage 69; none of them constructs, holds, or
> returns an `AuditPolicy`. **No logging, no observation payload**:
> `AuditPolicy` writes to no stdout/stderr/log sink of any kind (no
> `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere) and holds
> no payload field of any kind. **No `audit_event` wiring — not even a
> name reference**: per this stage's explicit scope, `audit_policy` does
> not mention `audit_event` or any of its types anywhere in its source,
> since no real connection between the two exists yet — one step further
> than earlier "unconnected" skeletons, which do name (in prose) the
> modules they don't connect to. **No descriptor/pipeline/plan/error
> wiring — a fully independent, label-only skeleton**: `AuditPolicy` does
> not construct or hold a `SecretHandle`, `AeadPlaceholderRequest`,
> `KdfPlaceholderRequest`, `KeyMaterialHandle`, `DomainLabel`,
> `OperationContext`, `RequestDescriptor`, `ResponseDescriptor`,
> `CryptoPipeline`, `DescriptorBundle`, `ExecutionPlan`, or
> `CryptoErrorDescriptor` — same "if in doubt, stay fully independent"
> choice Stage 93/94/95/96 already made; `AuditPolicy` stores no
> `String`/`Vec<u8>`/borrowed-byte-slice field of any kind. **Not
> connected to `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
> `domain_label`, `operation_context`, `request_descriptor`,
> `response_descriptor`, `crypto_pipeline`, `descriptor_bundle`,
> `execution_plan`, or `error_taxonomy`** — `audit_policy` never
> constructs any of their types and runs no actual AEAD/HKDF/Argon2/
> NIP-44 operation, derives no Nostr key, same "when a skeleton-to-
> skeleton connection is ambiguous, leave it unconnected" reasoning Stage
> 80/82/87/88/89/90/91/92/93/94/95/96 already established; all thirteen
> of those modules are UNCHANGED this stage, still placeholder-only.
> `cargo test` is GREEN with all 88 tests passing (82 pre-existing + 6
> new `audit_policy::tests`); `cargo check` and `cargo check --tests`
> stay GREEN with no warnings. `Cargo.toml` is UNCHANGED this stage — no
> new dependency needed (`audit_policy` imports nothing beyond the
> standard library). New
> [`test/fedos_core_rust_audit_policy.test.ts`](test/fedos_core_rust_audit_policy.test.ts)
> (21 tests) checks: the module is internal-only and not `pub`;
> `AuditPolicy` is `pub(crate)` at most and never re-exported; the public
> `pub fn` surface is exactly the six Stage 69 names; the six placeholder
> function bodies are byte-for-byte unchanged; every
> `AuditPolicyKind`/`AuditPolicyDecision` variant is a label-only unit
> variant (no tuple/struct data); no `String`/`Vec` field anywhere in the
> module; no observation-payload field-declaration
> (`payload`/`data`/`details`); no
> `println!`/`eprintln!`/`print!`/`eprint!`/`tracing::`/`log::`/`dbg!`
> usage; `new_placeholder` takes only an `AuditPolicyKind` (no
> `&str`/`String` parameter), and `decision_placeholder()` always returns
> `AuditPolicyDecision::DenyPlaceholder`; no
> `std::env`/`env::`/`var_os`/`std::process` usage; no bare-word or
> type-name reference to `audit_event`/`AuditEventLabel` anywhere (checked
> both directions — `audit_event` also doesn't reference
> `audit_policy`/`AuditPolicy`); no AEAD/HKDF/Argon2 usage (specific
> Rust-usage patterns only, not a bare word match, same lesson learned
> Stage 89-96); no field DECLARATION storing
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/
> `RequestDescriptor`/`ResponseDescriptor`/`CryptoPipeline`/
> `DescriptorBundle`/`ExecutionPlan`/`CryptoErrorDescriptor` (nor do those
> twelve modules reference `AuditPolicy*`); no `unsafe`; Runtime/Worker
> sources mention neither `audit_policy` nor auto-call a crypto
> operation; no `.wasm`/`Cargo.lock`/`target`/`build` artifact is
> committed; the state enum has exactly its two variants and the handle
> exposes exactly its five methods. Stage 98 candidate: **an internal
> lifecycle state skeleton** — representing future crypto-core internal
> state transitions without any secret information, still no public
> API/Runtime wiring. Prior status:
>
> **Stage 96 — Internal audit event label skeleton (internal-only
> `audit_event` module; fixed event-kind labels only, no logging, no
> event payload, no descriptor/pipeline/plan/error wiring yet, no real
> AEAD/HKDF/Argon2/NIP-44 connection, no Runtime/Worker/CryptoProvider
> wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a thirteenth crate-private
> module, `audit_event` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage 88's
> `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, Stage 93's `descriptor_bundle`, Stage 94's
> `execution_plan`, and Stage 95's `error_taxonomy`, placed right after
> `error_taxonomy`, still ahead of this file's first module gated
> `cfg(test)`). It defines: `AuditEventState` (`pub(crate) enum`,
> `Placeholder`/`Disabled` — `Disabled` is the `Default`, same shape as
> `CryptoErrorState`); `AuditEventKind` (`pub(crate) enum`,
> `CryptoProviderSelectedPlaceholder`/`RequestAcceptedPlaceholder`/
> `RequestRejectedPlaceholder`/`PlanPreparedPlaceholder`/
> `PrimitiveExecutedPlaceholder`/`ResponseBuiltPlaceholder`/
> `SecretClearedPlaceholder`/`ErrorClassifiedPlaceholder`/
> `TestOnlyPlaceholder` — nine label-only unit variants);
> `AuditEventStatus` (`pub(crate) struct`, a non-sensitive status snapshot
> carrying only the state enum); and `AuditEventLabel` (`pub(crate)
> struct`, holding `kind`/`state`) with four methods:
> `new_placeholder(kind: AuditEventKind)` (takes only the label — no
> user-, environment-, or config-derived input of any kind, observes no
> real state change of any kind), `kind()`, `status()`, and
> `is_placeholder()`. **NOT part of this crate's public API**: every item
> is `pub(crate)` at most — never `pub` — nothing is re-exported from the
> crate root, and the crate's public `pub fn` surface is still exactly the
> same six placeholder functions from Stage 69; none of them constructs,
> holds, or returns an `AuditEventLabel`. **No logging, no event
> payload**: `AuditEventLabel` writes to no stdout/stderr/log sink of any
> kind (no `println!`/`eprintln!`/`tracing`/`log` crate usage anywhere)
> and holds no payload field of any kind. **No descriptor/pipeline/plan/
> error wiring — a fully independent, label-only skeleton**:
> `AuditEventLabel` does not construct or hold a `SecretHandle`,
> `AeadPlaceholderRequest`, `KdfPlaceholderRequest`, `KeyMaterialHandle`,
> `DomainLabel`, `OperationContext`, `RequestDescriptor`,
> `ResponseDescriptor`, `CryptoPipeline`, `DescriptorBundle`,
> `ExecutionPlan`, or `CryptoErrorDescriptor` — same "if in doubt, stay
> fully independent" choice Stage 93/94/95 already made; `AuditEventLabel`
> stores no `String`/`Vec<u8>`/borrowed-byte-slice field of any kind.
> **Not connected to `secret_handle`, `aead_core`, `kdf_core`,
> `key_material`, `domain_label`, `operation_context`,
> `request_descriptor`, `response_descriptor`, `crypto_pipeline`,
> `descriptor_bundle`, `execution_plan`, or `error_taxonomy`** —
> `audit_event` never constructs any of their types and runs no actual
> AEAD/HKDF/Argon2/NIP-44 operation, derives no Nostr key, same "when a
> skeleton-to-skeleton connection is ambiguous, leave it unconnected"
> reasoning Stage 80/82/87/88/89/90/91/92/93/94/95 already established;
> all twelve of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 82 tests passing (77
> pre-existing + 5 new `audit_event::tests`); `cargo check` and `cargo
> check --tests` stay GREEN with no warnings. `Cargo.toml` is UNCHANGED
> this stage — no new dependency needed (`audit_event` imports nothing
> beyond the standard library, and no observability crate). New
> [`test/fedos_core_rust_audit_event.test.ts`](test/fedos_core_rust_audit_event.test.ts)
> (19 tests) checks: the module is internal-only and not `pub`;
> `AuditEventLabel` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `AuditEventKind` variant is a label-only unit variant (no tuple/struct
> data); no `String`/`Vec` field anywhere in the module; no event-payload
> field-declaration (`payload`/`data`/`details`); no
> `println!`/`eprintln!`/`print!`/`eprint!`/`tracing::`/`log::`/`dbg!`
> usage; `new_placeholder` takes only an `AuditEventKind` (no
> `&str`/`String` parameter); no `std::env`/`env::`/`var_os`/
> `std::process` usage; no AEAD/HKDF/Argon2 usage (specific Rust-usage
> patterns only, not a bare word match, same lesson learned Stage 89-95);
> no field DECLARATION storing `SecretHandle`/`AeadPlaceholderRequest`/
> `KdfPlaceholderRequest`/`KeyMaterialHandle`/`DomainLabel`/
> `OperationContext`/`RequestDescriptor`/`ResponseDescriptor`/
> `CryptoPipeline`/`DescriptorBundle`/`ExecutionPlan`/
> `CryptoErrorDescriptor` (nor do those twelve modules reference
> `AuditEvent*`); no `unsafe`; Runtime/Worker sources mention neither
> `audit_event` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its
> four methods. Stage 97 candidate: **an internal audit policy skeleton**
> — deciding which future events are observable without any secret
> information, still no logging or Runtime wiring. Prior status:
>
> **Stage 95 — Internal error taxonomy skeleton (internal-only
> `error_taxonomy` module; fixed error-kind labels only, no raw error
> strings, no stack traces, no descriptor/pipeline/plan wiring yet, no
> real AEAD/HKDF/Argon2/NIP-44 connection, no Runtime/Worker/
> CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a twelfth crate-private
> module, `error_taxonomy` (alongside Stage 79's `secret_handle`, Stage
> 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage
> 88's `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, Stage 93's `descriptor_bundle`, and Stage 94's
> `execution_plan`, placed right after `execution_plan`, still ahead of
> this file's first module gated `cfg(test)`). It defines:
> `CryptoErrorState` (`pub(crate) enum`, `Placeholder`/`Disabled` —
> `Disabled` is the `Default`, same shape as `ExecutionPlanState`);
> `CryptoErrorKind` (`pub(crate) enum`, `AeadFailurePlaceholder`/
> `KdfFailurePlaceholder`/`Argon2idFailurePlaceholder`/
> `Nip44FailurePlaceholder`/`NostrKeyFailurePlaceholder`/
> `InvalidRequestPlaceholder`/`UnsupportedOperationPlaceholder`/
> `InternalInvariantPlaceholder`/`TestOnlyFailurePlaceholder` — nine
> label-only unit variants); `CryptoErrorStatus` (`pub(crate) struct`, a
> non-sensitive status snapshot carrying only the state enum); and
> `CryptoErrorDescriptor` (`pub(crate) struct`, holding `kind`/`state`)
> with four methods: `new_placeholder(kind: CryptoErrorKind)` (takes only
> the label — no user-, environment-, or config-derived input of any
> kind, classifies no real failure of any kind), `kind()`, `status()`, and
> `is_placeholder()`. **NOT part of this crate's public API**: every item
> is `pub(crate)` at most — never `pub` — nothing is re-exported from the
> crate root, and the crate's public `pub fn` surface is still exactly the
> same six placeholder functions from Stage 69; none of them constructs,
> holds, or returns a `CryptoErrorDescriptor`. **No raw error strings, no
> stack traces**: `CryptoErrorDescriptor` holds no error message field, no
> wrapped source-error field (no `impl std::error::Error`, no
> `std::fmt::Display` implementation), and no captured call-stack
> information of any kind. **No descriptor/pipeline/plan wiring — a fully
> independent, label-only skeleton**: `CryptoErrorDescriptor` does not
> construct or hold a `SecretHandle`, `AeadPlaceholderRequest`,
> `KdfPlaceholderRequest`, `KeyMaterialHandle`, `DomainLabel`,
> `OperationContext`, `RequestDescriptor`, `ResponseDescriptor`,
> `CryptoPipeline`, `DescriptorBundle`, or `ExecutionPlan` — same "if in
> doubt, stay fully independent" choice Stage 93/94 already made;
> `CryptoErrorDescriptor` stores no `String`/`Vec<u8>`/borrowed-byte-slice
> field of any kind. **Not connected to `secret_handle`, `aead_core`,
> `kdf_core`, `key_material`, `domain_label`, `operation_context`,
> `request_descriptor`, `response_descriptor`, `crypto_pipeline`,
> `descriptor_bundle`, or `execution_plan`** — `error_taxonomy` never
> constructs any of their types and runs no actual AEAD/HKDF/Argon2/
> NIP-44 operation, derives no Nostr key, same "when a
> skeleton-to-skeleton connection is ambiguous, leave it unconnected"
> reasoning Stage 80/82/87/88/89/90/91/92/93/94 already established; all
> eleven of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 77 tests passing (72
> pre-existing + 5 new `error_taxonomy::tests`); `cargo check` and `cargo
> check --tests` stay GREEN with no warnings. `Cargo.toml` is UNCHANGED
> this stage — no new dependency needed (`error_taxonomy` imports nothing
> beyond the standard library). New
> [`test/fedos_core_rust_error_taxonomy.test.ts`](test/fedos_core_rust_error_taxonomy.test.ts)
> (18 tests) checks: the module is internal-only and not `pub`;
> `CryptoErrorDescriptor` is `pub(crate)` at most and never re-exported;
> the public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `CryptoErrorKind` variant is a label-only unit variant (no tuple/struct
> data); no `String`/`Vec` field anywhere in the module; no error
> message/source/stack field-declaration anywhere (nor `impl
> std::error::Error`/`std::fmt::Display`); `new_placeholder` takes only a
> `CryptoErrorKind` (no `&str`/`String` parameter); no
> `std::env`/`env::`/`var_os`/`std::process` usage; no AEAD/HKDF/Argon2
> usage (specific Rust-usage patterns only, not a bare word match, same
> "no bare `\bnip.?44\b` check" reasoning Stage 89-94 established, since
> it would also match this stage's own required `Nip44FailurePlaceholder`
> variant name — there is no `nip44`-named crate in this repo's
> dependency tree to import in the first place, so that absence is
> structural, not text-banned); no field DECLARATION storing
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/
> `RequestDescriptor`/`ResponseDescriptor`/`CryptoPipeline`/
> `DescriptorBundle`/`ExecutionPlan` (nor do those eleven modules
> reference `CryptoError*`); no `unsafe`; Runtime/Worker sources mention
> neither `error_taxonomy` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its
> four methods. Stage 96 candidate: **an internal audit event label
> skeleton** — observing future crypto-internal state changes without any
> secret information, still no logging or Runtime wiring. Prior status:
>
> **Stage 94 — Internal execution plan skeleton (internal-only
> `execution_plan` module; fixed plan/step labels only, no descriptor/
> pipeline wiring yet, no real AEAD/HKDF/Argon2/NIP-44 connection, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains an eleventh crate-private
> module, `execution_plan` (alongside Stage 79's `secret_handle`, Stage
> 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage
> 88's `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, Stage 92's
> `crypto_pipeline`, and Stage 93's `descriptor_bundle`, placed right after
> `descriptor_bundle`, still ahead of this file's first module gated
> `cfg(test)`). It defines: `ExecutionPlanState` (`pub(crate) enum`,
> `Placeholder`/`Disabled` — `Disabled` is the `Default`, same shape as
> `CryptoPipelineState`); `ExecutionPlanKind` (`pub(crate) enum`,
> `AeadPlanPlaceholder`/`KdfPlanPlaceholder`/`Argon2idPlanPlaceholder`/
> `Nip44PlanPlaceholder`/`NostrKeyPlanPlaceholder`/`TestOnlyPlanPlaceholder`
> — six label-only unit variants); `ExecutionStepKind` (`pub(crate) enum`,
> this crate's canonical six-step placeholder sequence:
> `ValidateRequestPlaceholder`/`ResolveDomainPlaceholder`/
> `ResolveKeyMaterialPlaceholder`/`ExecutePrimitivePlaceholder`/
> `BuildResponsePlaceholder`/`ClearTemporaryStatePlaceholder` — six
> label-only unit variants); `ExecutionPlanStatus` (`pub(crate) struct`, a
> non-sensitive status snapshot carrying only the state enum); and
> `ExecutionPlan` (`pub(crate) struct`, holding `kind`/`state`) with five
> methods: `new_placeholder(kind: ExecutionPlanKind)` (takes only the
> label — no user-, environment-, or config-derived input of any kind,
> orders no step of any kind), `kind()`, `status()`, `is_placeholder()`,
> and `step_count()` (returns the fixed `usize` `6` via a `match` on
> `kind` — never a `.len()`/collection-derived count). **NOT part of this
> crate's public API**: every item is `pub(crate)` at most — never `pub` —
> nothing is re-exported from the crate root, and the crate's public
> `pub fn` surface is still exactly the same six placeholder functions
> from Stage 69; none of them constructs, holds, or returns an
> `ExecutionPlan`. **No descriptor/pipeline wiring — a fully independent,
> label-only skeleton**: `ExecutionPlan` does not construct or hold a
> `SecretHandle`, `AeadPlaceholderRequest`, `KdfPlaceholderRequest`,
> `KeyMaterialHandle`, `DomainLabel`, `OperationContext`,
> `RequestDescriptor`, `ResponseDescriptor`, `CryptoPipeline`, or
> `DescriptorBundle` — same "if in doubt, stay fully independent" choice
> Stage 93 already made; `ExecutionPlan` stores no
> `String`/`Vec<u8>`/borrowed-byte-slice field of any kind. **Not
> connected to `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
> `domain_label`, `operation_context`, `request_descriptor`,
> `response_descriptor`, `crypto_pipeline`, or `descriptor_bundle`** —
> `execution_plan` never constructs any of their types and runs no actual
> AEAD/HKDF/Argon2/NIP-44 operation, derives no Nostr key, same "when a
> skeleton-to-skeleton connection is ambiguous, leave it unconnected"
> reasoning Stage 80/82/87/88/89/90/91/92/93 already established; all ten
> of those modules are UNCHANGED this stage, still placeholder-only.
> `cargo test` is GREEN with all 72 tests passing (66 pre-existing + 6 new
> `execution_plan::tests`); `cargo check` and `cargo check --tests` stay
> GREEN with no warnings. `Cargo.toml` is UNCHANGED this stage — no new
> dependency needed (`execution_plan` imports nothing beyond the standard
> library). New
> [`test/fedos_core_rust_execution_plan.test.ts`](test/fedos_core_rust_execution_plan.test.ts)
> (18 tests) checks: the module is internal-only and not `pub`;
> `ExecutionPlan` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `ExecutionPlanKind`/`ExecutionStepKind` variant is a label-only unit
> variant (no tuple/struct data); no `String`/`Vec` field anywhere in the
> module; `new_placeholder` takes only an `ExecutionPlanKind` (no
> `&str`/`String` parameter); `step_count()` returns a fixed `usize` via
> `match` with no `.len()`/collection call; no
> `std::env`/`env::`/`var_os`/`std::process` usage; no AEAD/HKDF/Argon2
> usage (specific Rust-usage patterns only, not a bare word match, same
> "no bare `\bnip.?44\b` check" reasoning Stage 89-93 established, since
> it would also match this stage's own required `Nip44PlanPlaceholder`
> variant name — there is no `nip44`-named crate in this repo's
> dependency tree to import in the first place, so that absence is
> structural, not text-banned); no field DECLARATION storing
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/
> `RequestDescriptor`/`ResponseDescriptor`/`CryptoPipeline`/
> `DescriptorBundle` (nor do those ten modules reference
> `ExecutionPlan*`); no `unsafe`; Runtime/Worker sources mention neither
> `execution_plan` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its
> five methods. **Fix during this stage**: the module's own doc comments
> originally wrote the literal text `Vec<ExecutionStepKind>` when
> describing what does NOT exist in this module, which collided with the
> guard test's own bare-pattern absence check for that exact string (the
> same self-referential doc-comment trap as Stage 81/84/88/89/90/91/92/93)
> — fixed by rewording to "a growable, heap-allocated collection ... " in
> prose instead of the literal generic-type spelling. Stage 95 candidate:
> **an internal error taxonomy skeleton** — classifying future
> cryptographic operation failure without any secret information, still
> no real cryptography wired in. Prior status:
>
> **Stage 93 — Internal descriptor bundle skeleton (internal-only
> `descriptor_bundle` module; fixed bundle-kind labels only, no descriptor
> value wiring yet, no real AEAD/HKDF/Argon2/NIP-44 connection, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a tenth crate-private module,
> `descriptor_bundle` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage 88's
> `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, Stage 91's `response_descriptor`, and Stage 92's
> `crypto_pipeline`, placed right after `crypto_pipeline`, still ahead of
> this file's first module gated `cfg(test)`). It defines:
> `DescriptorBundleState` (`pub(crate) enum`, `Placeholder`/`Disabled` —
> `Disabled` is the `Default`, same shape as `CryptoPipelineState`);
> `DescriptorBundleKind` (`pub(crate) enum`, `AeadBundlePlaceholder`/
> `KdfBundlePlaceholder`/`Argon2idBundlePlaceholder`/
> `Nip44BundlePlaceholder`/`NostrKeyBundlePlaceholder`/
> `TestOnlyBundlePlaceholder` — six label-only unit variants, no associated
> data); `DescriptorBundleStatus` (`pub(crate) struct`, a non-sensitive
> status snapshot carrying only the state enum); and `DescriptorBundle`
> (`pub(crate) struct`, holding `kind`/`state`) with four methods:
> `new_placeholder(kind: DescriptorBundleKind)` (takes only the label — no
> user-, environment-, or config-derived input of any kind, groups no
> descriptor of any kind), `kind()`, `status()`, and `is_placeholder()`.
> **NOT part of this crate's public API**: every item is `pub(crate)` at
> most — never `pub` — nothing is re-exported from the crate root, and the
> crate's public `pub fn` surface is still exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns a
> `DescriptorBundle`. **No descriptor value wiring — a fully independent,
> label-only skeleton**: `DescriptorBundle` does not construct or hold a
> `SecretHandle`, `AeadPlaceholderRequest`, `KdfPlaceholderRequest`,
> `KeyMaterialHandle`, `DomainLabel`, `OperationContext`,
> `RequestDescriptor`, `ResponseDescriptor`, or `CryptoPipeline` — "if in
> doubt, stay fully independent" won over holding those types as real
> fields; `DescriptorBundle` stores no `String`/`Vec<u8>`/
> borrowed-byte-slice field of any kind. **Not connected to
> `secret_handle`, `aead_core`, `kdf_core`, `key_material`, `domain_label`,
> `operation_context`, `request_descriptor`, `response_descriptor`, or
> `crypto_pipeline`** — `descriptor_bundle` never constructs any of their
> types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, derives no
> Nostr key, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage 80/82/87/88/89/90/91/92 already
> established; all nine of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 66 tests passing (61
> pre-existing + 5 new `descriptor_bundle::tests`); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — no new dependency needed (`descriptor_bundle`
> imports nothing beyond the standard library). New
> [`test/fedos_core_rust_descriptor_bundle.test.ts`](test/fedos_core_rust_descriptor_bundle.test.ts)
> (17 tests) checks: the module is internal-only and not `pub`;
> `DescriptorBundle` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `DescriptorBundleKind` variant is a label-only unit variant (no
> tuple/struct data); no `String`/`Vec` field anywhere in the module;
> `new_placeholder` takes only a `DescriptorBundleKind` (no `&str`/`String`
> parameter); no `std::env`/`env::`/`var_os`/`std::process` usage; no
> AEAD/HKDF/Argon2 usage (specific Rust-usage patterns only, not a bare
> word match, same "no bare `\bnip.?44\b` check" reasoning Stage
> 89/90/91/92 established, since it would also match this stage's own
> required `Nip44BundlePlaceholder` variant name — there is no
> `nip44`-named crate in this repo's dependency tree to import in the
> first place, so that absence is structural, not text-banned); no field
> DECLARATION storing `SecretHandle`/`AeadPlaceholderRequest`/
> `KdfPlaceholderRequest`/`KeyMaterialHandle`/`DomainLabel`/
> `OperationContext`/`RequestDescriptor`/`ResponseDescriptor`/
> `CryptoPipeline` (nor do those nine modules reference
> `DescriptorBundle*`); no `unsafe`; Runtime/Worker sources mention neither
> `descriptor_bundle` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its four
> methods. **Fix during this stage**: the struct-level doc comment
> originally listed the other nine skeletons' PascalCase type names
> (`SecretHandle`, `KeyMaterialHandle`, etc.) directly in prose, which
> collided with the guard test's own bare-word absence check (the same
> self-referential doc-comment trap as Stage 81/84/88/89/90/91/92) — fixed
> by rewording to name the lowercase MODULE names instead
> (`secret_handle`, `key_material`, etc.), consistent with how
> `crypto_pipeline`'s own doc comment already phrased the same idea. Stage
> 94 candidate: **an internal execution plan skeleton** — future
> processing order as non-sensitive labels only, still no real
> cryptography wired in. Prior status:
>
> **Stage 92 — Internal crypto pipeline skeleton (internal-only
> `crypto_pipeline` module; fixed pipeline-kind labels only, no descriptor
> wiring yet, no real AEAD/HKDF/Argon2/NIP-44 connection, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a ninth crate-private module,
> `crypto_pipeline` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage 88's
> `domain_label`, Stage 89's `operation_context`, Stage 90's
> `request_descriptor`, and Stage 91's `response_descriptor`, placed right
> after `response_descriptor`, still ahead of this file's first module
> gated `cfg(test)`). It defines: `CryptoPipelineState` (`pub(crate) enum`,
> `Placeholder`/`Disabled` — `Disabled` is the `Default`, same shape as
> `OperationContextState`); `CryptoPipelineKind` (`pub(crate) enum`,
> `AeadPipelinePlaceholder`/`KdfPipelinePlaceholder`/
> `Argon2idPipelinePlaceholder`/`Nip44PipelinePlaceholder`/
> `NostrKeyPipelinePlaceholder`/`TestOnlyPipelinePlaceholder` — six
> label-only unit variants, no associated data); `CryptoPipelineStatus`
> (`pub(crate) struct`, a non-sensitive status snapshot carrying only the
> state enum); and `CryptoPipeline` (`pub(crate) struct`, holding
> `kind`/`state`) with four methods: `new_placeholder(kind:
> CryptoPipelineKind)` (takes only the label — no user-, environment-, or
> config-derived input of any kind, bundles no descriptor of any kind),
> `kind()`, `status()`, and `is_placeholder()`. **NOT part of this crate's
> public API**: every item is `pub(crate)` at most — never `pub` — nothing
> is re-exported from the crate root, and the crate's public `pub fn`
> surface is still exactly the same six placeholder functions from Stage
> 69; none of them constructs, holds, or returns a `CryptoPipeline`. **No
> descriptor bundling yet**: `CryptoPipeline` does not construct or hold a
> `SecretHandle`, `AeadPlaceholderRequest`, `KdfPlaceholderRequest`,
> `KeyMaterialHandle`, `DomainLabel`, `OperationContext`,
> `RequestDescriptor`, or `ResponseDescriptor` — it is a label-only type
> basis for a future stage to bundle them; `CryptoPipeline` stores no
> `String`/`Vec<u8>`/borrowed-byte-slice field of any kind. **Not connected
> to `secret_handle`, `aead_core`, `kdf_core`, `key_material`,
> `domain_label`, `operation_context`, `request_descriptor`, or
> `response_descriptor`** — `crypto_pipeline` never constructs any of their
> types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, derives no
> Nostr key, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage 80/82/87/88/89/90/91 already
> established; all eight of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 61 tests passing (56
> pre-existing + 5 new `crypto_pipeline::tests`); `cargo check` and `cargo
> check --tests` stay GREEN with no warnings. `Cargo.toml` is UNCHANGED
> this stage — no new dependency needed (`crypto_pipeline` imports nothing
> beyond the standard library). New
> [`test/fedos_core_rust_crypto_pipeline.test.ts`](test/fedos_core_rust_crypto_pipeline.test.ts)
> (17 tests) checks: the module is internal-only and not `pub`;
> `CryptoPipeline` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `CryptoPipelineKind` variant is a label-only unit variant (no
> tuple/struct data); no `String`/`Vec` field anywhere in the module;
> `new_placeholder` takes only a `CryptoPipelineKind` (no `&str`/`String`
> parameter); no `std::env`/`env::`/`var_os`/`std::process` usage; no
> AEAD/HKDF/Argon2 usage (specific Rust-usage patterns only, not a bare
> word match, same "no bare `\bnip.?44\b` check" reasoning Stage 89/90/91
> established, since it would also match this stage's own required
> `Nip44PipelinePlaceholder` variant name — there is no `nip44`-named crate
> in this repo's dependency tree to import in the first place, so that
> absence is structural, not text-banned); no connection to
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/`OperationKind`/
> `RequestDescriptor`/`RequestDescriptorKind`/`ResponseDescriptor`/
> `ResponseDescriptorKind` (nor do those eight modules reference
> `CryptoPipeline*`); no `unsafe`; Runtime/Worker sources mention neither
> `crypto_pipeline` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its four
> methods. Stage 93 candidate: **an internal descriptor bundle skeleton** —
> still no real value connection between the descriptors this stage's
> `crypto_pipeline` anticipates. Prior status:
>
> **Stage 91 — Internal response descriptor skeleton (internal-only
> `response_descriptor` module; non-sensitive response-kind labels only, no
> real bytes/secrets/result payload, no real AEAD/HKDF/Argon2/NIP-44
> connection, no Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains an eighth crate-private
> module, `response_descriptor` (alongside Stage 79's `secret_handle`,
> Stage 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`,
> Stage 88's `domain_label`, Stage 89's `operation_context`, and Stage 90's
> `request_descriptor`, placed right after `request_descriptor`, still
> ahead of this file's first module gated `cfg(test)`). It defines:
> `ResponseDescriptorState` (`pub(crate) enum`, `Placeholder`/`Disabled`/
> `ErrorPlaceholder` — `Disabled` is the `Default`, same shape as
> `RequestDescriptorState` plus a placeholder ERROR state);
> `ResponseDescriptorKind` (`pub(crate) enum`,
> `AeadCiphertextPlaceholder`/`AeadPlaintextPlaceholder`/
> `HkdfPrkPlaceholder`/`HkdfOkmPlaceholder`/`Argon2idTagPlaceholder`/
> `Nip44CiphertextPlaceholder`/`Nip44PlaintextPlaceholder`/
> `NostrSecretKeyPlaceholder`/`NostrPublicKeyPlaceholder`/`ErrorPlaceholder`/
> `TestOnlyPlaceholder` — eleven label-only unit variants, no associated
> data); `ResponseDescriptorStatus` (`pub(crate) struct`, a non-sensitive
> status snapshot carrying only the state enum); and `ResponseDescriptor`
> (`pub(crate) struct`, holding `kind`/`state`) with six methods:
> `new_placeholder(kind: ResponseDescriptorKind)` (takes only the label —
> no user-, environment-, or config-derived input of any kind, no result
> payload), `new_error_placeholder()` (takes NO input — pairs
> `ErrorPlaceholder` kind with `ErrorPlaceholder` state), `kind()`,
> `status()`, `is_placeholder()`, and `is_error_placeholder()`. **NOT part
> of this crate's public API**: every item is `pub(crate)` at most — never
> `pub` — nothing is re-exported from the crate root, and the crate's
> public `pub fn` surface is still exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns a
> `ResponseDescriptor`. **Non-sensitive metadata only — no dynamic
> allocation, no secret bytes, no result payload**: all eleven
> `ResponseDescriptorKind` variants are bare unit variants,
> `ResponseDescriptor` stores no `String`/`Vec<u8>`/borrowed-byte-slice
> field of any kind, and neither constructor takes a real result byte
> (plaintext, ciphertext, key, tag, or associated-data) nor a real error
> payload/message/cause byte. **Not connected to `secret_handle`,
> `aead_core`, `kdf_core`, `key_material`, `domain_label`,
> `operation_context`, or `request_descriptor`** — `response_descriptor`
> never constructs any of their types and runs no actual
> AEAD/HKDF/Argon2/NIP-44 operation, derives no Nostr key, same "when a
> skeleton-to-skeleton connection is ambiguous, leave it unconnected"
> reasoning Stage 80/82/87/88/89/90 already established; all seven of
> those modules are UNCHANGED this stage, still placeholder-only. `cargo
> test` is GREEN with all 56 tests passing (51 pre-existing + 5 new
> `response_descriptor::tests`); `cargo check` and `cargo check --tests`
> stay GREEN with no warnings. `Cargo.toml` is UNCHANGED this stage — no
> new dependency needed (`response_descriptor` imports nothing beyond the
> standard library). New
> [`test/fedos_core_rust_response_descriptor.test.ts`](test/fedos_core_rust_response_descriptor.test.ts)
> (17 tests) checks: the module is internal-only and not `pub`;
> `ResponseDescriptor` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `ResponseDescriptorKind` variant is a label-only unit variant (no
> tuple/struct data); no `String`/`Vec` field anywhere in the module;
> `new_placeholder` takes only a `ResponseDescriptorKind` (no
> `&str`/`String` parameter) and `new_error_placeholder` takes nothing; no
> `std::env`/`env::`/`var_os`/`std::process` usage; no AEAD/HKDF/Argon2
> usage (specific Rust-usage patterns only, not a bare word match, same "no
> bare `\bnip.?44\b` check" reasoning Stage 89/90 established, since it
> would also match this stage's own required `Nip44Ciphertext`/
> `Nip44PlaintextPlaceholder` variant names — there is no `nip44`-named
> crate in this repo's dependency tree to import in the first place, so
> that absence is structural, not text-banned); no connection to
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel`/`OperationContext`/`OperationKind`/
> `RequestDescriptor`/`RequestDescriptorKind` (nor do those seven modules
> reference `ResponseDescriptor*`); no `unsafe`; Runtime/Worker sources
> mention neither `response_descriptor` nor auto-call a crypto operation;
> no `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its three variants and the handle exposes exactly its
> six methods. Stage 92 candidate: **an internal crypto pipeline skeleton**
> — a type basis to eventually connect the Request/Response/Operation/
> DomainLabel/KeyMaterial descriptors, still no real connection or
> cryptography wired in. Prior status:
>
> **Stage 90 — Internal request descriptor skeleton (internal-only
> `request_descriptor` module; non-sensitive request-kind labels only, no
> real bytes/secrets, no real AEAD/HKDF/Argon2/NIP-44 connection, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a seventh crate-private
> module, `request_descriptor` (alongside Stage 79's `secret_handle`, Stage
> 80's `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, Stage
> 88's `domain_label`, and Stage 89's `operation_context`, placed right
> after `operation_context`, still ahead of this file's first module gated
> `cfg(test)`). It defines: `RequestDescriptorState` (`pub(crate) enum`,
> `Placeholder`/`Disabled` — `Disabled` is the `Default`, same shape as
> `OperationContextState`); `RequestDescriptorKind` (`pub(crate) enum`,
> `AeadEncryptRequestPlaceholder`/`AeadDecryptRequestPlaceholder`/
> `HkdfExtractRequestPlaceholder`/`HkdfExpandRequestPlaceholder`/
> `HkdfExtractExpandRequestPlaceholder`/`Argon2idRequestPlaceholder`/
> `Nip44EncryptRequestPlaceholder`/`Nip44DecryptRequestPlaceholder`/
> `NostrKeyDerivationRequestPlaceholder`/`TestOnlyRequestPlaceholder` — ten
> label-only unit variants, no associated data); `RequestDescriptorStatus`
> (`pub(crate) struct`, a non-sensitive status snapshot carrying only the
> state enum); and `RequestDescriptor` (`pub(crate) struct`, holding
> `kind`/`state`) with four methods: `new_placeholder(kind:
> RequestDescriptorKind)` (takes only the label — no user-, environment-,
> or config-derived input of any kind), `kind()`, `status()`, and
> `is_placeholder()`. **NOT part of this crate's public API**: every item
> is `pub(crate)` at most — never `pub` — nothing is re-exported from the
> crate root, and the crate's public `pub fn` surface is still exactly the
> same six placeholder functions from Stage 69; none of them constructs,
> holds, or returns a `RequestDescriptor`. **Non-sensitive metadata only —
> no dynamic allocation, no secret bytes**: all ten
> `RequestDescriptorKind` variants are bare unit variants,
> `RequestDescriptor` stores no `String`/`Vec<u8>`/borrowed-byte-slice field
> of any kind, and describes no real request payload (no plaintext,
> ciphertext, key, salt, nonce, or associated-data byte). **Not connected to
> `secret_handle`, `aead_core`, `kdf_core`, `key_material`, `domain_label`,
> or `operation_context`** — `request_descriptor` never constructs any of
> their types and runs no actual AEAD/HKDF/Argon2/NIP-44 operation, derives
> no Nostr key, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage 80/82/87/88/89 already established;
> all six of those modules are UNCHANGED this stage, still
> placeholder-only. `cargo test` is GREEN with all 51 tests passing (46
> pre-existing + 5 new `request_descriptor::tests`); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — no new dependency needed (`request_descriptor`
> imports nothing beyond the standard library). New
> [`test/fedos_core_rust_request_descriptor.test.ts`](test/fedos_core_rust_request_descriptor.test.ts)
> (17 tests) checks: the module is internal-only and not `pub`;
> `RequestDescriptor` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `RequestDescriptorKind` variant is a label-only unit variant (no
> tuple/struct data); no `String`/`Vec` field anywhere in the module;
> `new_placeholder` takes only a `RequestDescriptorKind` (no
> `&str`/`String` parameter); no `std::env`/`env::`/`var_os`/`std::process`
> usage; no AEAD/HKDF/Argon2 usage (specific Rust-usage patterns only, not
> a bare word match, same "no bare `\bnip.?44\b` check" reasoning Stage 89
> established, since it would also match this stage's own required
> `Nip44Encrypt`/`Nip44DecryptRequestPlaceholder` variant names — there is
> no `nip44`-named crate in this repo's dependency tree to import in the
> first place, so that absence is structural, not text-banned); no
> connection to `SecretHandle`/`AeadPlaceholderRequest`/
> `KdfPlaceholderRequest`/`KeyMaterialHandle`/`DomainLabel`/
> `OperationContext`/`OperationKind` (nor do those six modules reference
> `RequestDescriptor*`); no `unsafe`; Runtime/Worker sources mention
> neither `request_descriptor` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its four
> methods. Stage 91 candidate: **an internal response descriptor skeleton**
> — non-sensitive metadata only, still no real bytes/secrets held. Prior
> status:
>
> **Stage 89 — Internal operation context skeleton (internal-only
> `operation_context` module; operation-kind labels only, no real
> AEAD/HKDF/Argon2/NIP-44 connection, no Runtime/Worker/CryptoProvider
> wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a sixth crate-private module,
> `operation_context` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, Stage 87's `key_material`, and Stage
> 88's `domain_label`, placed right after `domain_label`, still ahead of
> this file's first module gated `cfg(test)`). It defines:
> `OperationContextState` (`pub(crate) enum`, `Placeholder`/`Disabled` —
> `Disabled` is the `Default`, same shape as `DomainLabelState`);
> `OperationKind` (`pub(crate) enum`, `AeadEncryptPlaceholder`/
> `AeadDecryptPlaceholder`/`HkdfExtractPlaceholder`/`HkdfExpandPlaceholder`/
> `HkdfExtractExpandPlaceholder`/`Argon2idPlaceholder`/
> `Nip44EncryptPlaceholder`/`Nip44DecryptPlaceholder`/
> `NostrKeyDerivationPlaceholder`/`TestOnlyPlaceholder` — ten label-only
> unit variants, no associated data); `OperationContextStatus`
> (`pub(crate) struct`, a non-sensitive status snapshot carrying only the
> state enum); and `OperationContext` (`pub(crate) struct`, holding
> `kind`/`state`) with four methods: `new_placeholder(kind: OperationKind)`
> (takes only the label — no user-, environment-, or config-derived input
> of any kind), `kind()`, `status()`, and `is_placeholder()`. **NOT part of
> this crate's public API**: every item is `pub(crate)` at most — never
> `pub` — nothing is re-exported from the crate root, and the crate's
> public `pub fn` surface is still exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns an
> `OperationContext`. **Labels only — no dynamic allocation, no secret
> bytes**: all ten `OperationKind` variants are bare unit variants,
> `OperationContext` stores no `String`/`Vec<u8>`/borrowed-byte-slice field
> of any kind. **Not connected to `secret_handle`, `aead_core`, `kdf_core`,
> `key_material`, or `domain_label`** — `operation_context` never
> constructs any of their types and runs no actual AEAD/HKDF/Argon2/NIP-44
> operation, derives no Nostr key, same "when a skeleton-to-skeleton
> connection is ambiguous, leave it unconnected" reasoning Stage
> 80/82/87/88 already established; all five of those modules are UNCHANGED
> this stage, still placeholder-only. `cargo test` is GREEN with all 46
> tests passing (41 pre-existing + 5 new `operation_context::tests`);
> `cargo check` and `cargo check --tests` stay GREEN with no warnings.
> `Cargo.toml` is UNCHANGED this stage — no new dependency needed
> (`operation_context` imports nothing beyond the standard library). New
> [`test/fedos_core_rust_operation_context.test.ts`](test/fedos_core_rust_operation_context.test.ts)
> (17 tests) checks: the module is internal-only and not `pub`;
> `OperationContext` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; every
> `OperationKind` variant is a label-only unit variant (no tuple/struct
> data); no `String`/`Vec` field anywhere in the module; `new_placeholder`
> takes only an `OperationKind` (no `&str`/`String` parameter); no
> `std::env`/`env::`/`var_os`/`std::process` usage; no AEAD/HKDF/Argon2
> usage (specific Rust-usage patterns only, not a bare word match — a bare
> `\bnip.?44\b` check is deliberately NOT used here, since it would also
> match this stage's own required `Nip44Encrypt`/`Nip44DecryptPlaceholder`
> variant names and doc-comment prose, and there is no `nip44`-named crate
> in this repo's dependency tree to import in the first place, so that
> absence is structural, not text-banned); no connection to
> `SecretHandle`/`AeadPlaceholderRequest`/`KdfPlaceholderRequest`/
> `KeyMaterialHandle`/`DomainLabel` (nor do those five modules reference
> `OperationContext*`); no `unsafe`; Runtime/Worker sources mention neither
> `operation_context` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; the state
> enum has exactly its two variants and the handle exposes exactly its four
> methods. Stage 90 candidate: **an internal request descriptor skeleton**
> — non-sensitive metadata only, still no real bytes/secrets held. Prior
> status:
>
> **Stage 88 — Internal domain separation label skeleton
> (internal-only `domain_label` module; fixed static labels only, no
> user/environment/config-derived string, no HKDF/AEAD/NIP-44/Nostr-key
> connection yet, no Runtime/Worker/CryptoProvider wiring, no WASM
> change).**
> `packages/fedos-core-rust/src/lib.rs` gains a fifth crate-private module,
> `domain_label` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, Stage 82's `kdf_core`, and Stage 87's `key_material`, placed
> right after `key_material`, still ahead of this file's first module gated
> `cfg(test)`). It defines: `DomainLabelState` (`pub(crate) enum`,
> `Placeholder`/`Disabled` — `Disabled` is the `Default`);
> `DomainLabelKind` (`pub(crate) enum`, `FedosMasterPlaceholder`/
> `AeadKeyPlaceholder`/`KdfOutputPlaceholder`/`NostrKeyPlaceholder`/
> `Nip44Placeholder`/`TestOnlyPlaceholder` — a label identity only);
> `DomainLabelStatus` (`pub(crate) struct`, a non-sensitive status snapshot
> carrying only the state enum); and `DomainLabel` (`pub(crate) struct`,
> holding `kind`/`state`) with four methods: `new_placeholder(kind:
> DomainLabelKind)` (takes only the label identity — no user-,
> environment-, or config-derived input of any kind), `kind()`, `status()`,
> and `as_static_label()` (returns a fixed `&'static str` per kind via a
> private `const fn` lookup table — `"fedos:placeholder:master"`,
> `"fedos:placeholder:aead-key"`, `"fedos:placeholder:kdf-output"`,
> `"fedos:placeholder:nostr-key"`, `"fedos:placeholder:nip44"`,
> `"fedos:placeholder:test-only"`). **NOT part of this crate's public API**:
> every item is `pub(crate)` at most — never `pub` — nothing is re-exported
> from the crate root, and the crate's public `pub fn` surface is still
> exactly the same six placeholder functions from Stage 69; none of them
> constructs, holds, or returns a `DomainLabel`. **Fixed labels only**:
> every string `as_static_label()` can return is a compile-time `&'static
> str` literal — never built with `format!`, `String::from`,
> `.to_string()`, concatenation, or read from the process environment or any
> runtime configuration; `DomainLabel` stores no `String`/`Vec<u8>` field.
> **Not connected to `secret_handle`, `aead_core`, `kdf_core`, or
> `key_material`** — `domain_label` never constructs any of their types and
> mixes no fixed label into an actual HKDF/AEAD/NIP-44/Nostr-key-derivation
> operation, same "when a skeleton-to-skeleton connection is ambiguous,
> leave it unconnected" reasoning Stage 80/82/87 already established; all
> four of those modules are UNCHANGED this stage, still placeholder-only.
> `cargo test` is GREEN with all 41 tests passing (36 pre-existing + 5 new
> `domain_label::tests`); `cargo check` and `cargo check --tests` stay GREEN
> with no warnings. `Cargo.toml` is UNCHANGED this stage — no new dependency
> needed (`domain_label` imports nothing beyond the standard library). New
> [`test/fedos_core_rust_domain_label.test.ts`](test/fedos_core_rust_domain_label.test.ts)
> (16 tests) checks: the module is internal-only and not `pub`;
> `DomainLabel` is `pub(crate)` at most and never re-exported; the public
> `pub fn` surface is exactly the six Stage 69 names; the six placeholder
> function bodies are byte-for-byte unchanged; every `DomainLabelKind` label
> is a fixed static string literal matching the documented table inside a
> `const fn`; no `String`/`Vec` field anywhere in the module;
> `new_placeholder` takes only a `DomainLabelKind` (no `&str`/`String`
> parameter); no `std::env`/`env::`/`var_os`/`std::process` usage; no
> connection to `SecretHandle`/`AeadPlaceholderRequest`/
> `KdfPlaceholderRequest`/`KeyMaterialHandle` (nor do those four modules
> reference `DomainLabel*`), and no HKDF/AEAD/Argon2 usage (specific
> Rust-usage patterns only, not a bare word match, to avoid colliding with
> this module's own doc-comment prose); no `unsafe`; Runtime/Worker sources
> mention neither `domain_label` nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; both enums
> have exactly their specified variants and the handle exposes exactly its
> four methods. Stage 89 candidate: **an internal operation context
> skeleton** — a type basis for future AEAD/KDF/NIP-44 operations, still no
> real cryptography wired in. Prior status:
>
> **Stage 87 — Internal key material handle skeleton
> (internal-only `key_material` module; no public API change, no real
> key/seed/plaintext/ciphertext/passphrase/nonce byte, no AEAD/HKDF/Argon2/
> NIP-44 implementation, no Runtime/Worker/CryptoProvider wiring, no WASM
> change).**
> `packages/fedos-core-rust/src/lib.rs` gains a fourth crate-private module,
> `key_material` (alongside Stage 79's `secret_handle`, Stage 80's
> `aead_core`, and Stage 82's `kdf_core`, placed right after `kdf_core`,
> still ahead of this file's first module gated `cfg(test)`). It reuses
> `secret_handle`'s exact placeholder-only pattern — a fixed, non-secret
> `PlaceholderMarker` wrapped in `secrecy::SecretBox`, zeroized on
> `clear()` — rather than a divergent design, and defines:
> `KeyMaterialState` (`pub(crate) enum`, `Empty`/`Placeholder`/`Cleared`,
> same three variants as `SecretHandleState`); `KeyMaterialKind`
> (`pub(crate) enum`, `AeadKeyPlaceholder`/`KdfOutputPlaceholder`/
> `NostrKeyPlaceholder`/`UnknownPlaceholder` — a label only, naming a future
> AEAD/KDF/Nostr-identity connection point; no key of any of these kinds is
> held); `KeyMaterialStatus` (`pub(crate) struct`, a non-sensitive status
> snapshot carrying only the state enum); and `KeyMaterialHandle`
> (`pub(crate) struct`, holding `state`, `kind`, and
> `marker: SecretBox<PlaceholderMarker>`) with five methods:
> `new_placeholder(kind: KeyMaterialKind)` (takes only the label — no
> secret input of any kind), `status()`, `kind()`, `clear()` (zeroizes the
> marker and sets state to `Cleared`), and `is_cleared()`. **NOT part of
> this crate's public API**: every item is `pub(crate)` at most — never
> `pub` — nothing is re-exported from the crate root, and the crate's
> public `pub fn` surface is still exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns a
> `KeyMaterialHandle`. **Not connected to `secret_handle`, `aead_core`, or
> `kdf_core`** — `key_material` never constructs any of their types and
> reads no key/secret byte from one, same "when a skeleton-to-skeleton
> connection is ambiguous, leave it unconnected" reasoning Stage 80/82
> already established; all three of those modules are UNCHANGED this
> stage, still placeholder-only. `cargo test` is GREEN with all 36 tests
> passing (30 pre-existing + 6 new `key_material::tests`); `cargo check`
> and `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — `zeroize`/`secrecy` were already `[dependencies]`
> (production) entries since Stage 78; `subtle` remains unused, same
> reasoning as `secret_handle`. New
> [`test/fedos_core_rust_key_material.test.ts`](test/fedos_core_rust_key_material.test.ts)
> (16 tests) checks: the module is internal-only and not `pub`;
> `KeyMaterialHandle` is `pub(crate)` at most and never re-exported; the
> public `pub fn` surface is exactly the six Stage 69 names; the six
> placeholder function bodies are byte-for-byte unchanged; no
> key/seed/plaintext/ciphertext/passphrase/nonce storage field and no
> `Vec<u8>`/`String`/borrowed-byte-slice secret field anywhere in the
> module; no AEAD/HKDF/Argon2/NIP-44 usage (specific Rust-usage patterns
> only, not a bare word match, to avoid colliding with this module's own
> doc-comment prose); no random/`getrandom`; no `unsafe`; Runtime/Worker
> sources mention neither `key_material` nor auto-call a crypto operation;
> no `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed;
> `zeroize`/`secrecy` are used only against the placeholder marker and
> `subtle` stays unused; both enums have exactly their specified variants
> and the handle exposes exactly its five methods; and `key_material` does
> not construct or reference `SecretHandle`/`AeadPlaceholderRequest`/
> `KdfPlaceholderRequest` (nor do those three modules reference
> `KeyMaterial*`). Stage 88 candidate: **an internal domain separation
> label skeleton** — important for future HKDF/AEAD connections, still no
> real HKDF/AEAD implementation. Prior status:
>
> **Stage 86 — Extract a test-only Argon2id helper (test-only
> refactor; no public API change, no production deriveKey/password KDF, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs`'s pre-existing `cfg(test)`-only
> `rfc9106_vectors` module (Stage 85) is refactored: the Argon2id derivation
> logic that used to be written as a per-vector helper,
> `run_argon2id_for_vector(vector: &Vector)`, is now one small, private,
> test-only helper function taking raw bytes,
> `derive_argon2id_for_test(password_bytes, salt_bytes, secret_bytes,
> associated_data_bytes, memory_cost_kib, time_cost, parallelism,
> output_len) -> argon2::Result<Vec<u8>>` (constructed internally with
> `Algorithm::Argon2id`, hardcoded `Version::V0x13`, and the given `secret`
> bytes as the pepper via `Argon2::new_with_secret`) — mirroring the
> byte-level shape and `_for_test` naming convention Stage 81/83
> established for `seal_chacha20poly1305_for_test`/
> `extract_hkdf_sha256_for_test`. It is a private `fn` — never
> `pub`/`pub(crate)`, never re-exported — that exists ONLY inside the
> `cfg(test)`-only `rfc9106_vectors` module, and is NOT connected to the
> crate-private `kdf_core` skeleton (Stage 82, unchanged this stage — still
> placeholder-only) or `secret_handle`/`aead_core` in any way. **Test-only
> refactor, not a new capability**: the two pre-existing vector tests
> (`rfc9106_positive_vectors_hash_correctly` and
> `rfc9106_negative_vectors_do_not_match_if_present`) assert exactly what
> they asserted before Stage 86, just calling the shared helper instead of
> building an `argon2::Argon2` inline per vector. Two new unit tests
> exercise the helper directly, independent of the vector file:
> `derive_argon2id_is_deterministic_for_test_helper` (fixed, non-secret,
> test-only inputs always produce the same output) and
> `derive_argon2id_fails_for_unsupported_memory_cost_for_test_helper` (a
> memory cost below Argon2's own minimum makes the helper return an error).
> `cargo test` is GREEN with all 30 tests passing (28 pre-existing + 2 new
> helper unit tests); `cargo check` and `cargo check --tests` stay GREEN
> with no warnings. `Cargo.toml` is UNCHANGED this stage — `argon2` was
> already a `[dependencies]` (production) entry since Stage 84, with the
> same `default-features = false`, zero-features configuration. **No
> production `argon2` import**: `src/lib.rs`'s production code (everything
> before this file's first `cfg(test)`-gated module) still does not import,
> reference, or call `argon2` anywhere; `derive_key_placeholder` remains
> byte-for-byte unchanged, and the crate's public `pub fn` surface stays
> exactly the same six placeholder functions from Stage 69. New
> [`test/fedos_core_rust_argon2_test_helper.test.ts`](test/fedos_core_rust_argon2_test_helper.test.ts)
> (10 tests) checks: the helper exists inside the `cfg(test)`-gated region
> and is private (never `pub`/`pub(crate)`, never re-exported); production
> code (before the first `cfg(test)`) has no `Argon2::`/`Argon2<`/`argon2::`
> usage and no password/salt/secret/associatedData/tag field, and no
> reference to the new helper name either; the public `pub fn` surface is
> exactly the six Stage 69 names; `kdf_core` remains unchanged and
> placeholder-only (no `argon2` import, no reference to the new helper, its
> six methods unchanged); Runtime/Worker sources mention neither the helper
> name nor `argon2`/`rfc9106` and do not auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; and the
> helper call sites use the documented `argon2::Result<Vec<u8>>` signature.
> [`test/fedos_core_rust_argon2_wiring.test.ts`](test/fedos_core_rust_argon2_wiring.test.ts)
> test 5 was updated because it named the OLD per-vector helper —
> `run_argon2id_for_vector` no longer exists after this stage's rename, so
> that test now checks the new `derive_argon2id_for_test` name is not `pub`
> instead. Stage 87 candidate: **an internal key material type skeleton** —
> placeholder-only, holding no real secret bytes yet — in preparation for a
> future AEAD/KDF connection point. Prior status:
>
> **Stage 85 — Wire RFC 9106 Argon2id vectors to Rust
> `cargo test` (verification wiring only; no public `deriveKey`/password-KDF
> API, no Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a third bottom-of-file module,
> `rfc9106_vectors`, gated `#[cfg(test)]` (compiled only for `cargo test`),
> mirroring Stage 75/77's `rfc8439_vectors`/`rfc5869_vectors` modules. It
> reads
> [`test-vectors/kdf/argon2id-rfc9106.json`](test-vectors/kdf/argon2id-rfc9106.json)
> (imported verbatim Stage 73) at compile time via `include_str!` — no
> filesystem IO at test runtime — parses it into a `serde`-derived struct,
> and for the `shouldPass: true` vector (RFC 9106 §5.3's sole published
> Argon2id conformance test case: m=32 KiB, t=3, p=4) asserts `argon2`
> (adopted Stage 84) — constructed with `Algorithm::Argon2id`,
> `Version::V0x13`, the vector's `memoryKiB`/`iterations`/`parallelism`/
> `tagLength`/`associatedData`, and the vector's `secret` as the pepper via
> `Argon2::new_with_secret` — produces exactly the RFC's expected 32-byte
> tag from the vector's `password`/`salt`; a third test asserts the computed
> tag does NOT match the fixture for any `shouldPass: false` vector (none
> exist in this file today — RFC 9106 §5.3 publishes no byte-level tamper
> vector for this construction and none is fabricated, per
> [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md) §2 — so
> that test's loop runs zero iterations and trivially passes, ready to start
> enforcing automatically if a future re-import ever adds one). `cargo test`
> is GREEN with all 28 tests passing (25 pre-existing + 3 new RFC 9106
> tests); `cargo check` and `cargo check --tests` stay GREEN with no
> warnings. **`Cargo.toml` is UNCHANGED this stage** — the vector's memory
> buffer (`Block`s) is allocated with this crate's own `std::vec` and passed
> to `Argon2::hash_password_into_with_memory`; `argon2`'s optional `alloc`
> feature (which would transitively enable `password-hash` and pull in
> `rand_core`, per the Stage 84 review) turned out not to be needed for this
> API surface at all. `argon2` stays adopted exactly as Stage 84 left it:
> `default-features = false`, zero features enabled — verified empirically
> (a throwaway probe project, deleted before this stage's own commit) that
> this exact configuration reproduces the RFC's expected tag byte-for-byte.
> The crate's PUBLIC API — `fedos_core_status`, `fedos_core_capabilities`,
> `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
> `decrypt_placeholder` — is **completely unchanged** and still implements no
> cryptography; there is still **no public `deriveKey`/password-hashing
> implementation**, and nothing outside `#[cfg(test)]` imports or calls
> `argon2`. `crate-type = ["rlib"]`, `#![forbid(unsafe_code)]`, and the
> absence of `wasm-bindgen` all stay exactly as before; no `.wasm` is
> produced. The Runtime, the Worker, and
> `CryptoProvider`/`FedosCoreCryptoProvider` are **not** touched — no random,
> password, or key generation is added anywhere, and nothing wires this
> crate's dependency into the host; the crate-private `kdf_core` skeleton
> (Stage 82) is untouched and remains placeholder-only, unconnected to this
> wiring. `Cargo.lock` was generated to run `cargo test`/`cargo check
> --tests` and then deleted, not committed, per the same convention as every
> prior dependency-adoption stage. New
> [`test/fedos_core_rust_argon2_wiring.test.ts`](test/fedos_core_rust_argon2_wiring.test.ts)
> (12 tests) checks: `lib.rs` contains the `rfc9106_vectors` module wired to
> the exact vector file path via `include_str!` and actually imports/uses
> `argon2` (but only in its `#[cfg(test)]`-scoped tail); production code
> (before the first `#[cfg(test)]`) has no `Argon2::`/`Argon2<`/`argon2::`
> usage (a bare `\bArgon2\b` word match is deliberately NOT used, since this
> crate's pre-existing Stage 69/79 doc-comment prose already legitimately
> says "Argon2" describing what the crate does NOT do); `kdf_core` remains
> unchanged and placeholder-only; the public `pub fn` surface is exactly the
> six Stage 69 names; `derive_key_placeholder`'s body is byte-for-byte
> unchanged; no production password/salt/secret/associatedData/tag storage
> field exists in `kdf_core`; `rand`/`getrandom` remain absent from
> `Cargo.toml`; the `argon2` dependency line still has
> `default-features = false` and no `"password-hash"`/`"rand"`/`"alloc"`
> feature strings; Runtime/Worker sources mention neither `argon2` nor
> `rfc9106` and do not auto-call a crypto operation; and no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed. No existing
> Rust source guard test needed updating this stage — the new module was
> placed so its own nested `#[cfg(test)]` lands after `secret_handle`'s
> (lib.rs's existing first occurrence), leaving every prior file's slicing
> logic untouched. Stage 86 candidate: **an internal Argon2 test helper
> behind `cfg(test)`** — the Argon2id-side analogue of Stage 81/83's
> ChaCha20-Poly1305/HKDF helper extractions — still no public `deriveKey`
> implementation. Prior status:
>
> **Stage 84 — Adopt `argon2` dependency (build check only; no
> Argon2id implementation, no RFC 9106 vector wiring, no `deriveKey`
> implementation, no Runtime/Worker/CryptoProvider wiring, no WASM
> change).**
> `packages/fedos-core-rust/Cargo.toml`'s `[dependencies]` (production) table
> gains a SIXTH entry, `argon2` v0.5.3 (RustCrypto, `default-features =
> false`, NO features enabled — its default `alloc`/`password-hash`/`rand`
> feature set is explicitly excluded), alongside the unchanged
> `chacha20poly1305` v0.11.0 (Stage 74), `hkdf` v0.13.0 (Stage 76), and
> `zeroize`/`secrecy`/`subtle` (Stage 78). This is a dependency + build-check
> ADOPTION ONLY, exactly like every prior dependency Stage: nothing in
> `src/lib.rs` — production or `cfg(test)` — imports, calls, or exercises
> `argon2`; no RFC 9106 Argon2id vector (imported Stage 73 at
> [`test-vectors/kdf/argon2id-rfc9106.json`](test-vectors/kdf/argon2id-rfc9106.json))
> is loaded or wired; `derive_key_placeholder` is byte-for-byte unchanged from
> Stage 69. **`default-features = false` with NO features enabled** — unlike
> `hkdf`'s "default features are fine as-is" Stage 76 adoption, `argon2`'s
> own defaults (`alloc`, `password-hash`, `rand`) would pull in
> `password-hash`'s optional `rand_core` dependency for salt-generation
> convenience; excluding them mirrors `chacha20poly1305`'s Stage 74
> `default-features = false` treatment of its default `getrandom` feature —
> verified empirically that neither `rand_core` nor `password-hash` appears
> anywhere in the resolved dependency graph with this configuration. `argon2`
> adds exactly 8 NEW transitive packages beyond the existing 21-package
> `chacha20poly1305`/`hkdf`/`zeroize`/`secrecy`/`subtle` tree — `argon2`
> itself, `base64ct`, `blake2`, and a SECOND, older generation of
> `digest`/`block-buffer`/`crypto-common`/`generic-array`/`cpufeatures`
> (Argon2's `blake2` dependency pulls `digest` v0.10.7, distinct from the
> `digest` v0.11.3 already in the tree via `hkdf`; both generations coexist,
> which Cargo permits) — for a 29-package combined production dependency
> graph; `subtle` v2.6.1 and `typenum` v1.20.1 are REUSED at their existing
> pinned versions. `argon2` itself uses `unsafe` in 2 call sites (an AVX2
> SIMD backend, the same pattern already acknowledged for
> `chacha20poly1305`'s transitive tree); `blake2`/`base64ct` also use
> `unsafe` internally. None of this affects this crate's own
> `#![forbid(unsafe_code)]`, which governs only this crate's code. The full
> dependency review is recorded in
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md) §12,
> a new `argon2` — Stage 84 entry appended after the existing
> `zeroize`/`secrecy`/`subtle` — Stage 78 entry (never edited in place).
> `Cargo.lock` was generated to run `cargo check`/`cargo test` and then
> deleted, not committed, per the same convention as every prior
> dependency-adoption stage. `aes-gcm` / `rand` / `getrandom` /
> `wasm-bindgen` remain ABSENT; `crate-type = ["rlib"]` and
> `#![forbid(unsafe_code)]` stay exactly as before; no `.wasm` is produced.
> Existing [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> was updated (now 21 tests) to assert `argon2` is present (test 6), lib.rs's
> production code has no `Argon2::`/`Argon2<`/`argon2::` usage outside
> `#[cfg(test)]` (test 12, folded into test 16), and `rand`/`getrandom`
> remain strictly absent (test 9 — `argon2`'s feature configuration avoids
> `rand_core` entirely, so this stays the strict "does not contain" wording
> rather than a relaxed "unless argon2 pulls it in").
> [`test/fedos_core_rust_skeleton.test.ts`](test/fedos_core_rust_skeleton.test.ts)
> test 3 and
> [`test/fedos_core_rust_rfc8439_wiring.test.ts`](test/fedos_core_rust_rfc8439_wiring.test.ts)/[`test/fedos_core_rust_hkdf_wiring.test.ts`](test/fedos_core_rust_hkdf_wiring.test.ts)
> tests 1/3 were updated to expect SIX production dependency-table entries
> instead of five. A self-referential doc-comment trap was caught and fixed
> during this stage's own verification: a bare, case-matched `\bArgon2\b`
> regex collided with PRE-EXISTING prose in `src/lib.rs` (Stage 69's
> crate-level summary and Stage 79's `secret_handle` doc both already say
> "Argon2" in plain English describing what the crate does NOT do) — the
> new tests instead check specific Rust usage patterns (`Argon2::`,
> `Argon2<`, `Argon2::new(`) that would not appear in that prose. Stage 85
> candidate: **wire the RFC 9106 Argon2id vectors to `cargo test`**,
> following the exact pattern Stage 75/77 used for RFC 8439/RFC 5869 — a new
> `cfg(test)`-only module reading
> [`test-vectors/kdf/argon2id-rfc9106.json`](test-vectors/kdf/argon2id-rfc9106.json)
> via `include_str!` and asserting the known-answer tag bytes — still no
> public `deriveKey` implementation. Prior status:
>
> **Stage 83 — Extract a test-only HKDF-SHA256 helper (test-only
> refactor; no public API change, no production deriveKey, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs`'s pre-existing `cfg(test)`-only
> `rfc5869_vectors` module (Stage 77) is refactored: the HKDF-SHA256
> extract/expand logic that used to be written inline (and duplicated) in
> its two vector tests is now three small, private, test-only helper
> functions, `extract_hkdf_sha256_for_test(ikm_bytes, salt_bytes) ->
> Vec<u8>` (infallible, matching `hkdf`'s own `extract` signature),
> `expand_hkdf_sha256_for_test(prk_bytes, info_bytes, length) ->
> Result<Vec<u8>, InvalidLength>`, and
> `extract_expand_hkdf_sha256_for_test(ikm_bytes, salt_bytes, info_bytes,
> length) -> Result<(Vec<u8>, Vec<u8>), InvalidLength>` (runs both steps in
> one call). All three are private `fn`s — never `pub`/`pub(crate)`, never
> re-exported — that exist ONLY inside the `cfg(test)`-only `rfc5869_vectors`
> module, and are NOT connected to the crate-private `kdf_core` skeleton
> (Stage 82, unchanged this stage — still placeholder-only) or
> `secret_handle`/`aead_core` in any way. **Test-only refactor, not a new
> capability**: the two pre-existing vector tests
> (`rfc5869_positive_vectors_extract_and_expand_correctly` and
> `rfc5869_negative_vectors_do_not_match_if_present`) assert exactly what
> they asserted before Stage 83, just calling the shared helpers instead of
> constructing an `Hkdf<Sha256>` inline twice. Two new unit tests exercise
> the helpers directly, independent of the vector file:
> `extract_then_expand_round_trip_for_test_helper` (agrees between the
> three-helper path and the single combined-helper path over fixed,
> non-secret, test-only bytes) and
> `expand_fails_for_unsupported_length_for_test_helper` (an out-of-range
> OKM length makes expand fail). `cargo test` is GREEN with all 25 tests
> passing (23 pre-existing + 2 new helper unit tests); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — `hkdf`/`sha2` were already `[dependencies]`/
> `[dev-dependencies]` entries since Stage 76/77. **No production
> `hkdf`/`sha2` import**: `src/lib.rs`'s production code (everything before
> this file's first `cfg(test)`-gated module) still does not import,
> reference, or call `hkdf` or `sha2` anywhere; `derive_key_placeholder`
> remains byte-for-byte unchanged, and the crate's public `pub fn` surface
> stays exactly the same six placeholder functions from Stage 69. New
> [`test/fedos_core_rust_hkdf_test_helper.test.ts`](test/fedos_core_rust_hkdf_test_helper.test.ts)
> (10 tests) checks: the three helpers exist inside the `cfg(test)`-gated
> region and are private (never `pub`/`pub(crate)`, never re-exported);
> production code (before the first `cfg(test)`) has no `hkdf`/`sha2`
> import/reference and no reference to the new helper names either; the
> public `pub fn` surface is exactly the six Stage 69 names; `kdf_core`
> remains unchanged and placeholder-only (no `hkdf`/`sha2` import, no
> reference to the new helpers, its six methods unchanged) and still holds
> no production IKM/salt/info/PRK/OKM storage field or
> `Vec<u8>`/`String`/borrowed-byte-slice field; Runtime/Worker sources
> mention neither helper name nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; and all three
> helper call sites use the documented signatures. No existing Rust source
> guard test needed updating this stage — the refactor stayed entirely
> inside `rfc5869_vectors`'s existing `cfg(test)`-gated boundary, so
> `test/fedos_core_rust_hkdf_wiring.test.ts` (which already asserts
> `hkdf`/`sha2` usage is confined to that module's `cfg(test)`-scoped tail)
> needed no change. Stage 84 candidate: **adopt the `argon2` dependency**
> (build-check only, one crate per Stage) — still no public
> `deriveKey`/password-hashing implementation. Prior status:
>
> **Stage 82 — Add an internal KDF module skeleton (crate-private
> only; no public API change, no actual HKDF, no Runtime/Worker/
> CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a third crate-private module,
> `kdf_core`, placed right after Stage 80's `aead_core`. It defines
> `KdfAlgorithm` (`pub(crate) enum`: one variant, `HkdfSha256` — a label
> only), `KdfOperation` (`pub(crate) enum`: `Extract` / `Expand` /
> `ExtractExpand` — a label only), `KdfRequestStatus` (`pub(crate) struct`:
> wraps this crate's existing `FedosCoreState`, not a new parallel enum), and
> `KdfPlaceholderRequest` (`pub(crate) struct`: `algorithm: KdfAlgorithm` +
> `operation: KdfOperation` — no other field) with six methods —
> `new_placeholder_extract()` / `new_placeholder_expand()` /
> `new_placeholder_extract_expand()` (take NO IKM/salt/info/PRK/OKM/length
> input of any kind), `status()` (always `Placeholder` — this skeleton runs
> no cryptography), `algorithm()`, `operation()`. **NOT part of the public
> API**: every item is `pub(crate)` at most — never `pub` — nothing is
> re-exported, and this crate's public `pub fn` surface stays exactly the
> same six placeholder functions from Stage 69; none of them constructs,
> holds, or returns a `KdfPlaceholderRequest`. **No actual HKDF**:
> `kdf_core`'s production code does NOT import `hkdf` (adopted Stage 76) or
> `sha2` (dev-dependency since Stage 77) — both stay exercised ONLY by the
> pre-existing `cfg(test)`-only `rfc5869_vectors` module (Stage 77),
> unchanged this stage; `KdfPlaceholderRequest` stores only the two labels
> above — no borrowed-byte-slice/`Vec<u8>`/`String` field or parameter
> exists anywhere in the module. **No connection to `aead_core` (Stage 80)
> or `secret_handle` (Stage 79)**: `kdf_core` never constructs an
> `AeadPlaceholderRequest` or a `SecretHandle`, and extracts no key/secret
> byte from either — same "when in doubt, leave unconnected" reasoning Stage
> 80 already established; `aead_core` itself is untouched by this stage.
> `derive_key_placeholder` / `encrypt_placeholder` / `decrypt_placeholder`
> remain byte-for-byte unchanged. `Cargo.toml` is UNCHANGED this stage (no
> new dependency — `kdf_core` uses only this crate's own `FedosCoreState`,
> already in scope). `cargo test` is GREEN with all 23 tests passing (19
> pre-existing + 4 new `kdf_core::tests`, its own nested `#[cfg(test)] mod
> tests`: `new_placeholder_extract_reports_extract_operation_only`,
> `new_placeholder_expand_reports_expand_operation_only`,
> `new_placeholder_extract_expand_reports_extract_expand_operation_only`,
> `status_is_always_placeholder_only_no_real_cryptography`); `cargo check`
> and `cargo check --tests` stay GREEN with no warnings —
> `#[allow(dead_code)]` on the module suppresses the (expected) unused-code
> warning a plain, non-test build would otherwise emit, exactly as
> `secret_handle`/`aead_core` already do. New
> [`test/fedos_core_rust_kdf_skeleton.test.ts`](test/fedos_core_rust_kdf_skeleton.test.ts)
> (17 tests) checks: `kdf_core` is present and not `pub mod`;
> `KdfAlgorithm`/`KdfOperation`/`KdfRequestStatus`/`KdfPlaceholderRequest`
> are `pub(crate)`, never `pub`; no public re-export; the public `pub fn`
> surface is exactly the six Stage 69 names; the six placeholder
> signatures/bodies are byte-for-byte unchanged; `kdf_core`'s own extracted
> module text (via brace-matching) has no `hkdf`/`sha2` import; no
> IKM/salt/info/PRK/OKM/secret storage field (a colon-typed field
> declaration, not doc-comment prose) and no
> `Vec<u8>`/`String`/borrowed-byte-slice field anywhere in the module; no
> random/`getrandom`; no `AeadPlaceholderRequest`/`chacha20poly1305`
> mention; no `SecretHandle` mention; no `unsafe` anywhere in `lib.rs`; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact committed; and Runtime/
> Worker sources mention neither `kdf_core`/`KdfPlaceholderRequest` nor
> auto-call a crypto operation (the bare word "kdf" is deliberately NOT
> checked there, since both files already legitimately contain it in
> pre-existing, unrelated prose describing what `selectCryptoProvider` does
> NOT do). No existing Rust source guard test needed updating this stage —
> `kdf_core` was placed so its own nested `#[cfg(test)]` lands after
> `secret_handle`'s (lib.rs's existing first occurrence) and `aead_core`'s,
> leaving every prior file's slicing logic untouched, and the crate-level
> top-of-file doc comment update named no KDF/digest crate directly
> (following the same precedent Stage 80 set for AEAD crate names), avoiding
> the self-referential doc-comment trap two prior stages hit. Stage 83
> candidate: **an internal HKDF helper behind `cfg(test)` or crate-private
> visibility** — the KDF-side analogue of Stage 81's ChaCha20-Poly1305 helper
> extraction — still no public `deriveKey` implementation. Prior status:
>
> **Stage 81 — Extract a test-only ChaCha20-Poly1305 helper
> (test-only refactor; no public API change, no production encrypt/decrypt,
> no Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs`'s pre-existing `cfg(test)`-only
> `rfc8439_vectors` module (Stage 75) is refactored: the ChaCha20-Poly1305
> seal/open logic that used to be written inline (and duplicated) in its two
> vector tests is now two small, private, test-only helper functions,
> `seal_chacha20poly1305_for_test(key_bytes, nonce_bytes, plaintext_bytes,
> aad_bytes) -> Result<Vec<u8>, AeadError>` and
> `open_chacha20poly1305_for_test(key_bytes, nonce_bytes, sealed_bytes,
> aad_bytes) -> Result<Vec<u8>, AeadError>` (`sealed_bytes` is
> `ciphertext‖tag`). Both are private `fn`s — never `pub`/`pub(crate)`, never
> re-exported — that exist ONLY inside the `cfg(test)`-only `rfc8439_vectors`
> module, and are NOT connected to the crate-private `aead_core` skeleton
> (Stage 80, unchanged this stage — still placeholder-only) or
> `secret_handle` (Stage 79) in any way. **Test-only refactor, not a new
> capability**: the two pre-existing vector tests
> (`rfc8439_positive_vectors_encrypt_and_decrypt_correctly` and
> `rfc8439_negative_vectors_fail_to_decrypt_if_present`) assert exactly what
> they asserted before Stage 81, just calling the shared helper instead of
> constructing a `Key`/`Nonce`/`ChaCha20Poly1305` inline twice. Two new unit
> tests exercise the helpers directly, independent of the vector file:
> `seal_then_open_round_trip_for_test_helper` (round-trips fixed, non-secret,
> test-only bytes) and `open_fails_for_tampered_sealed_bytes_for_test_helper`
> (tampering with the tag makes open fail). `cargo test` is GREEN with all 19
> tests passing (17 pre-existing + 2 new helper unit tests); `cargo check`
> and `cargo check --tests` stay GREEN with no warnings. `Cargo.toml` is
> UNCHANGED this stage — `chacha20poly1305` was already a `[dependencies]`
> (production) entry since Stage 74. **No production `chacha20poly1305`
> import**: `src/lib.rs`'s production code (everything before this file's
> first `cfg(test)`-gated module) still does not import, reference, or call
> `chacha20poly1305` anywhere; `encrypt_placeholder`/`decrypt_placeholder`
> remain byte-for-byte unchanged, and the crate's public `pub fn` surface
> stays exactly the same six placeholder functions from Stage 69. New
> [`test/fedos_core_rust_aead_test_helper.test.ts`](test/fedos_core_rust_aead_test_helper.test.ts)
> (9 tests) checks: the two helpers exist inside the `cfg(test)`-gated
> region and are private (never `pub`/`pub(crate)`, never re-exported);
> production code (before the first `cfg(test)`) has no `chacha20poly1305`
> import/reference and no reference to the new helper names either; the
> public `pub fn` surface is exactly the six Stage 69 names; `aead_core`
> remains unchanged and placeholder-only (no `chacha20poly1305` import, no
> reference to the new helpers, its five methods unchanged) and still holds
> no production key/nonce/plaintext/ciphertext/tag/aad storage field or
> `Vec<u8>`/`String`/borrowed-byte-slice field; Runtime/Worker sources
> mention neither helper name nor auto-call a crypto operation; no
> `.wasm`/`Cargo.lock`/`target`/`build` artifact is committed; and both
> helper call sites use the documented `Result<Vec<u8>, AeadError>`
> signature. No existing Rust source guard test needed updating this stage —
> the refactor stayed entirely inside `rfc8439_vectors`'s existing
> `cfg(test)`-gated boundary, so `test/fedos_core_rust_rfc8439_wiring.test.ts`
> (which already asserts `chacha20poly1305` usage is confined to that
> module's `cfg(test)`-scoped tail) needed no change. Stage 82 candidate:
> **an internal KDF module skeleton** (the `secret_handle`/`aead_core`-
> analogue for HKDF) — still no public `deriveKey` implementation. Prior
> status:
>
> **Stage 80 — Add an internal AEAD module skeleton (crate-private
> only; no public API change, no actual encryption/decryption, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a second crate-private module,
> `aead_core`, placed right after Stage 79's `secret_handle`. It defines
> `AeadAlgorithm` (`pub(crate) enum`: one variant, `ChaCha20Poly1305` — a
> label only), `AeadOperation` (`pub(crate) enum`: `Encrypt` / `Decrypt` — a
> label only), `AeadRequestStatus` (`pub(crate) struct`: wraps this crate's
> existing `FedosCoreState`, not a new parallel enum), and
> `AeadPlaceholderRequest` (`pub(crate) struct`: `algorithm: AeadAlgorithm` +
> `operation: AeadOperation` — no other field) with five methods —
> `new_placeholder_encrypt()` / `new_placeholder_decrypt()` (take NO
> plaintext/ciphertext/key/nonce/AAD/tag input of any kind), `status()`
> (always `Placeholder` — this skeleton runs no cryptography), `algorithm()`,
> `operation()`. **NOT part of the public API**: every item is `pub(crate)`
> at most — never `pub` — nothing is re-exported, and this crate's public
> `pub fn` surface stays exactly the same six placeholder functions from
> Stage 69; none of them constructs, holds, or returns an
> `AeadPlaceholderRequest`. **No actual encryption/decryption**:
> `aead_core`'s production code does NOT import `chacha20poly1305` (adopted
> Stage 74) — that dependency stays exercised ONLY by the pre-existing
> `cfg(test)`-only `rfc8439_vectors` module (Stage 75), unchanged this stage;
> `AeadPlaceholderRequest` stores only the two labels above — no
> borrowed-byte-slice/`Vec<u8>`/`String` field or parameter exists anywhere
> in the module. **No connection to `secret_handle`**: `aead_core` never
> constructs a `SecretHandle` and extracts no key/secret byte from one — when
> a skeleton-to-skeleton connection was ambiguous, this stage deliberately
> left the two unconnected. `derive_key_placeholder` / `encrypt_placeholder`
> / `decrypt_placeholder` remain byte-for-byte unchanged. `Cargo.toml` is
> UNCHANGED this stage (no new dependency — `aead_core` uses only this
> crate's own `FedosCoreState`, already in scope). `cargo test` is GREEN with
> all 17 tests passing (14 pre-existing + 3 new `aead_core::tests`, its own
> nested `#[cfg(test)] mod tests`:
> `new_placeholder_encrypt_reports_encrypt_operation_only`,
> `new_placeholder_decrypt_reports_decrypt_operation_only`,
> `status_is_always_placeholder_only_no_real_cryptography`); `cargo check`
> and `cargo check --tests` stay GREEN with no warnings —
> `#[allow(dead_code)]` on the module suppresses the (expected) unused-code
> warning a plain, non-test build would otherwise emit, exactly as
> `secret_handle` already does. New
> [`test/fedos_core_rust_aead_skeleton.test.ts`](test/fedos_core_rust_aead_skeleton.test.ts)
> (16 tests) checks: `aead_core` is present and not `pub mod`;
> `AeadAlgorithm`/`AeadOperation`/`AeadRequestStatus`/`AeadPlaceholderRequest`
> are `pub(crate)`, never `pub`; no public re-export; the public `pub fn`
> surface is exactly the six Stage 69 names; the six placeholder
> signatures/bodies are byte-for-byte unchanged; `aead_core`'s own extracted
> module text (via brace-matching, not the fragile "first `cfg(test)`" slice)
> has no `chacha20poly1305` import; no key/nonce/plaintext/ciphertext/tag/aad
> storage field (a colon-typed field declaration, not doc-comment prose) and
> no `Vec<u8>`/`String`/borrowed-byte-slice field anywhere in the module; no
> random/`getrandom`; no HKDF mention; no `SecretHandle` mention; no `unsafe`
> anywhere in `lib.rs`; no `.wasm`/`Cargo.lock`/`target`/`build` artifact
> committed; and Runtime/Worker sources mention neither
> `aead_core`/`AeadPlaceholderRequest` nor auto-call a crypto operation (the
> bare word "aead" is deliberately NOT checked there, since both files
> already legitimately contain it in pre-existing, unrelated prose describing
> what `selectCryptoProvider` does NOT do). No existing Rust source guard
> test needed updating this stage — `aead_core` was placed so its own nested
> `#[cfg(test)]` lands after `secret_handle`'s (lib.rs's existing first
> occurrence), leaving every prior file's slicing logic untouched; the one
> near-miss caught during this stage's own verification was a
> self-referential doc-comment naming `chacha20poly1305` inside `lib.rs`'s
> top-of-file summary, ahead of the production-code slice boundary — reworded
> to avoid the literal crate name, following the same precedent the original
> Stage 69 doc comment already set for keeping AEAD crate names out of that
> summary. Stage 81 candidate: **an internal ChaCha20-Poly1305 helper behind
> `cfg(test)` or crate-private visibility** — a small, RFC-8439-vector-verified
> seal/open routine `aead_core` could eventually call — still no public
> `encrypt`/`decrypt` implementation. Prior status:
>
> **Stage 79 — Add an internal secret-handle skeleton (crate-private
> only; no public API change, no real secrets, no AEAD/HKDF/Argon2, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a crate-private `secret_handle`
> module — the first PRODUCTION code (not `#[cfg(test)]`-only, unlike Stage
> 75/77's vector-verification modules) in this crate to actually import and
> use `zeroize`/`secrecy` (adopted Stage 78), against a fixed, non-secret
> `PlaceholderMarker` only. It defines `SecretHandleState` (`pub(crate) enum`:
> `Empty` / `Placeholder` / `Cleared`), `SecretHandleStatus` (`pub(crate)
> struct`: a non-sensitive status snapshot), and `SecretHandle` (`pub(crate)
> struct`: `state: SecretHandleState` + `marker: SecretBox<PlaceholderMarker>`)
> with four methods — `new_placeholder()` (takes NO secret input of any
> kind), `status()`, `clear()` (zeroizes the placeholder marker, sets state
> `Cleared`), `is_cleared()`. **NOT part of the public API**: every item is
> `pub(crate)` at most — never `pub` — nothing is re-exported, and this
> crate's public `pub fn` surface stays exactly the same six placeholder
> functions from Stage 69; none of them constructs, holds, or returns a
> `SecretHandle`. **No real secret**: `SecretHandle` accepts and stores no
> key/seed/plaintext/ciphertext/passphrase byte — there is no
> borrowed-byte-slice/`Vec<u8>`/`String` secret parameter or field anywhere;
> `PlaceholderMarker` is a fixed, non-secret `u8` newtype, never derived from
> real secret material. **No AEAD/HKDF/Argon2/NIP-44** implementation exists
> in `secret_handle`. `subtle` (also adopted Stage 78) remains deliberately
> UNUSED this stage — it exists to guard real secret-DERIVED byte comparisons
> (e.g. an authentication tag), which this skeleton's own plain
> `SecretHandleState` enum equality is not; a future stage that needs a real
> comparison adopts it then. `derive_key_placeholder` /
> `encrypt_placeholder` / `decrypt_placeholder` remain byte-for-byte
> unchanged. `Cargo.toml` is UNCHANGED this stage (still the five production
> entries from Stage 78). `cargo test` is GREEN with all 14 tests passing (9
> pre-existing + 5 new `secret_handle::tests`, its own nested `#[cfg(test)]
> mod tests` — the emphasis in every new test name is placeholder-only:
> `new_placeholder_starts_in_placeholder_state_only`,
> `status_reports_placeholder_state_only_no_secret_bytes`,
> `clear_transitions_state_to_cleared_only`,
> `is_cleared_is_false_until_clear_is_called`,
> `empty_state_is_the_default_placeholder_only_state`); `cargo check` and
> `cargo check --tests` stay GREEN with no warnings — `#[allow(dead_code)]`
> on the module suppresses the (expected) unused-code warning a plain,
> non-test build would otherwise emit, since nothing outside
> `secret_handle`'s own tests calls into it yet. New
> [`test/fedos_core_rust_secret_handle.test.ts`](test/fedos_core_rust_secret_handle.test.ts)
> (15 tests) checks: `secret_handle` is present and not `pub mod`;
> `SecretHandle`/`SecretHandleState`/`SecretHandleStatus` are `pub(crate)`,
> never `pub`; no public re-export; the public `pub fn` surface is exactly
> the six Stage 69 names; the six placeholder signatures/bodies are
> byte-for-byte unchanged; no key/seed/plaintext/ciphertext/passphrase
> storage field (a colon-typed field declaration, not doc-comment prose) and
> no `Vec<u8>`/`String`/borrowed-byte-slice secret field anywhere in the
> module; no AEAD/HKDF/Argon2/NIP-44 mention; no random/`getrandom`; no
> `unsafe` anywhere in `lib.rs`; no `.wasm`/`Cargo.lock`/`target`/`build`
> artifact committed; Runtime/Worker sources mention neither
> `secret_handle`/`SecretHandle` nor auto-call a crypto operation; and
> `secret_handle` uses `secrecy::SecretBox`/`zeroize::Zeroize` against
> `PlaceholderMarker` while NOT using `subtle`/`ConstantTimeEq`/`.ct_eq()`.
> Existing [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> tests 12–13 were relaxed from "no `zeroize`/`secrecy` usage anywhere" to
> "no PUBLIC exposure of it" (test 14, `subtle`, is unchanged — still "no
> usage at all", since Stage 79 deliberately doesn't use it); test 15's
> production-code slice now ends at `secret_handle`'s own nested
> `#[cfg(test)]` (lib.rs's new first occurrence) instead of the pre-existing
> placeholder tests module — harmlessly, since `secret_handle`'s own
> production content mentions neither `chacha20poly1305` nor `hkdf`. Test 6 in
> [`test/fedos_core_rust_skeleton.test.ts`](test/fedos_core_rust_skeleton.test.ts)
> was updated to expect (not forbid) `zeroize`/`secrecy` in lib.rs's
> production-code slice. Stage 80 candidate: **an internal AEAD module
> skeleton** — the `chacha20poly1305`-analogue of this stage's KDF-adjacent
> secret-handle work — still no public `encrypt`/`decrypt` implementation.
> Prior status:
>
> **Stage 78 — Adopt `zeroize` / `secrecy` / `subtle` secret-handling
> foundation dependencies (build check only; no secret types, no
> zeroization behavior, no constant-time compare, no Runtime/Worker/
> CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/Cargo.toml`'s `[dependencies]` (production) table
> gains THREE new entries together — `zeroize` v1.9.0, `secrecy` v0.10.3,
> `subtle` v2.6.1 (all RustCrypto/dalek-cryptography, default features) —
> alongside the unchanged `chacha20poly1305` v0.11.0 (Stage 74) and `hkdf`
> v0.13.0 (Stage 76). This is a dependency + build-check ADOPTION ONLY,
> exactly like every prior dependency Stage: `src/lib.rs` is **completely
> unchanged** (no `#[cfg(test)]` module is added this stage — unlike Stage
> 75/77, this trio serves no single primitive and has no known-answer vector
> to wire), no code imports, references, or calls any of the three, no
> `Secret`/`SecretBox` type is defined, no type derives `Zeroize` or calls
> `.zeroize()`, and no `ConstantTimeEq`/`.ct_eq()` call exists anywhere.
> **Why now:** with the AEAD (RFC 8439, Stage 75) and KDF (RFC 5869, Stage
> 77) primitives both verified against their official vectors, the next
> natural step before any real secret byte is handled is the infrastructure
> that will hold, protect, and compare it — adopting it as its own reviewed
> Stage, immediately ahead of the internal secret-handle skeleton that will
> use it (Stage 79 candidate), keeps the foundation itself auditable in
> isolation before any code leans on it. `zeroize` and `subtle` add exactly 3
> NEW transitive packages beyond the existing 18-package
> `chacha20poly1305`/`hkdf` tree — `zeroize`, `secrecy` (depends only on
> `zeroize`), `subtle` (zero dependencies of its own) — for a 21-package
> combined production dependency graph; **no `getrandom`, no
> `rand`/`rand_core`, no build script (`build.rs`)** in any of the three.
> `zeroize` uses `unsafe` internally (volatile writes, load-bearing — this is
> how it defeats compiler dead-store elimination on stable Rust); `secrecy`
> declares `#![forbid(unsafe_code)]` (zero `unsafe`); `subtle` has 2 internal
> `unsafe` call sites (an optimization barrier and a `cmp::Ordering` cast).
> None of this affects this crate's own `#![forbid(unsafe_code)]`, which
> governs only this crate's code. Licenses: `zeroize`/`secrecy` are
> Apache-2.0 OR MIT (same family as `chacha20poly1305`/`hkdf`); `subtle` is
> BSD-3-Clause (a new, compatible license family for this graph). MSRV: no
> bump — `zeroize` 1.9.0 states Rust ≥ 1.85 (same floor already established),
> `secrecy` 0.10.3 states ≥ 1.60 (lower, no-op), `subtle` 2.6.1 states no
> `rust-version` upstream (only `edition = "2018"`, recorded as a documented
> gap per §9, not blocking since its floor is already far below the crate's
> actual toolchain). The full dependency review is recorded in
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md) §12,
> a new `zeroize`/`secrecy`/`subtle` — Stage 78 entry appended after the
> `hkdf` — Stage 76 entry (never edited in place); §5's original "adopted
> together with the first primitive that handles real secret bytes" wording
> is explicitly addressed there as a reviewed refinement, not a silent
> violation. `Cargo.lock` was generated to run `cargo check`/`cargo test` and
> then deleted, not committed, per the same convention as every prior
> dependency-adoption stage. `argon2` / `aes-gcm` / `rand` / `getrandom` /
> `wasm-bindgen` remain ABSENT; `crate-type = ["rlib"]` and
> `#![forbid(unsafe_code)]` stay exactly as before; no `.wasm` is produced.
> Existing [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> was rewritten (now 20 tests, following this stage's exact numbered
> checklist) to assert `zeroize`/`secrecy`/`subtle` are present as production
> dependencies, `sha2` stays dev-only, and lib.rs has no
> `Secret`/`SecretBox`/`ExposeSecret`, no `Zeroize` derive/`.zeroize()` call,
> and no `ConstantTimeEq`/`subtle` usage anywhere (the whole file, since
> Stage 78 adds no new `#[cfg(test)]` module to exclude);
> [`test/fedos_core_rust_skeleton.test.ts`](test/fedos_core_rust_skeleton.test.ts)
> test 3 and [`test/fedos_core_rust_rfc8439_wiring.test.ts`](test/fedos_core_rust_rfc8439_wiring.test.ts) /
> [`test/fedos_core_rust_hkdf_wiring.test.ts`](test/fedos_core_rust_hkdf_wiring.test.ts)
> tests 1/3 were updated to expect FIVE production dependency-table entries
> instead of two. Stage 79 candidate: **introduce an internal secret-handle
> skeleton** — the first code anywhere in this crate to actually import and
> use `zeroize`/`secrecy`/`subtle` — still without any real key derivation or
> encrypt/decrypt implementation. Prior status:
>
> **Stage 77 — Wire RFC 5869 HKDF-SHA256 vectors to Rust
> `cargo test` (verification wiring only; no public `deriveKey` API, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a second bottom-of-file module,
> `rfc5869_vectors`, gated `#[cfg(test)]` (compiled only for `cargo test`),
> mirroring Stage 75's `rfc8439_vectors` module. It reads
> [`test-vectors/kdf/hkdf-rfc5869.json`](test-vectors/kdf/hkdf-rfc5869.json)
> (imported verbatim Stage 73) at compile time via `include_str!` — no
> filesystem IO at test runtime — parses it into a `serde`-derived struct, and
> for every `shouldPass: true` vector (RFC 5869 Appendix A, Test Cases 1–3,
> HKDF-SHA256) asserts `hkdf::Hkdf::<sha2::Sha256>::extract` (adopted as a
> production dependency Stage 76) produces exactly the RFC's expected PRK, and
> `.expand` with that vector's `info` produces exactly the RFC's expected
> `L`-octet OKM; a third test asserts the derived PRK/OKM does NOT match the
> fixture for any `shouldPass: false` vector (none exist in this file today —
> RFC 5869 Appendix A publishes only positive known-answer cases and none is
> fabricated, per [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md)
> §2 — so that test's loop runs zero iterations and trivially passes, ready to
> start enforcing automatically if a future re-import ever adds one).
> `cargo test` is GREEN with all 9 tests passing (3 pre-existing placeholder
> tests + 3 RFC 8439 tests from Stage 75 + 3 new RFC 5869 tests); `cargo
> check` and `cargo check --tests` stay GREEN. `Cargo.toml` gains ONE new
> `[dev-dependencies]` entry, `sha2` v0.11.0 (RustCrypto, MIT OR Apache-2.0) —
> chosen over the older v0.10.x line because it depends on the same `digest`
> v0.11 generation as `hkdf` v0.13.0's `hmac` dependency (an older `sha2`
> pulls in `digest` v0.10, which fails `Hkdf<D>`'s trait bounds at `cargo
> check --tests` time — this mismatch was caught and fixed during this
> stage's own verification, before commit). `sha2` is used ONLY by the new
> test module to instantiate `Hkdf::<Sha256>`; it is NOT a production
> dependency, and `[dependencies]` (production) still has exactly two
> entries, `chacha20poly1305` and `hkdf`, unchanged from Stage 76. The
> crate's PUBLIC API — `fedos_core_status`, `fedos_core_capabilities`,
> `random_bytes_placeholder`, `derive_key_placeholder`, `encrypt_placeholder`,
> `decrypt_placeholder` — is **completely unchanged** and still implements no
> cryptography; there is still **no public `deriveKey` implementation**, and
> nothing outside `#[cfg(test)]` imports or calls `hkdf`/`sha2`.
> `crate-type = ["rlib"]`, `#![forbid(unsafe_code)]`, and the absence of
> `wasm-bindgen` all stay exactly as before; no `.wasm` is produced. The
> Runtime, the Worker, and `CryptoProvider`/`FedosCoreCryptoProvider` are
> **not** touched — no random, nonce, or key generation is added anywhere,
> and nothing wires this crate's dependency into the host. `Cargo.lock` was
> generated to run `cargo test`/`cargo check --tests` and then deleted, not
> committed, per the same convention as every prior dependency-adoption
> stage. New
> [`test/fedos_core_rust_hkdf_wiring.test.ts`](test/fedos_core_rust_hkdf_wiring.test.ts)
> (9 tests) checks: `[dependencies]` still has only `chacha20poly1305` +
> `hkdf`; `serde`/`serde_json`/`hex`/`sha2` are dev-dependencies only and
> excluded from `[dependencies]`; every other named crypto crate and
> `wasm-bindgen` stay absent; `lib.rs` contains the `rfc5869_vectors` module
> wired to the exact vector file path via `include_str!` and actually
> imports/uses `hkdf`/`sha2` (but only in its `#[cfg(test)]`-scoped tail); the
> six public placeholder function signatures and bodies are byte-for-byte
> unchanged; no `pub fn` anywhere in the file is anything other than those six
> names; no `.wasm`/`Cargo.lock`/`target`/`build`/compiled artifact is
> committed; and the Runtime/Worker sources neither mention
> `hkdf`/`rfc5869`/`sha2` nor auto-call a crypto operation. Three existing
> test files were updated because `sha2` newly and legitimately appears in
> `Cargo.toml` (as a dev-dependency): test 3 in both
> [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> and [`test/fedos_core_rust_skeleton.test.ts`](test/fedos_core_rust_skeleton.test.ts),
> and test 3 in
> [`test/fedos_core_rust_rfc8439_wiring.test.ts`](test/fedos_core_rust_rfc8439_wiring.test.ts),
> now assert `sha2` is absent from PRODUCTION `[dependencies]` specifically
> (rather than absent from the whole manifest) and present under
> `[dev-dependencies]`. Prior status:
>
> **Stage 75 — Wire RFC 8439 ChaCha20-Poly1305 vectors to Rust
> `cargo test` (verification wiring only; no public encrypt/decrypt API, no
> Runtime/Worker/CryptoProvider wiring, no WASM change).**
> `packages/fedos-core-rust/src/lib.rs` gains a new bottom-of-file module,
> `rfc8439_vectors`, gated `#[cfg(test)]` (compiled only for `cargo test`).
> It reads
> [`test-vectors/aead/chacha20poly1305-rfc8439.json`](test-vectors/aead/chacha20poly1305-rfc8439.json)
> (imported verbatim Stage 73) at compile time via `include_str!` — no
> filesystem IO at test runtime — parses it into a `serde`-derived struct, and
> for every `shouldPass: true` vector asserts the `chacha20poly1305` crate
> (adopted Stage 74) both seals plaintext+AAD to exactly the RFC's expected
> ciphertext‖tag AND opens that ciphertext‖tag back to exactly the RFC's
> expected plaintext; a third test asserts decrypt/authentication failure for
> any `shouldPass: false` vector (none exist in this file today — RFC 8439
> publishes no byte-level tamper vector for this construction and none is
> fabricated, per [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md)
> §2 — so that test's loop runs zero iterations and trivially passes, ready to
> start enforcing automatically if a future re-import ever adds one).
> `cargo test` is GREEN with all 6 tests passing (3 pre-existing placeholder
> tests + 3 new RFC 8439 tests); `cargo check` stays GREEN. `Cargo.toml` gains
> a `[dev-dependencies]` table — `serde` v1.0.228 (`features = ["derive"]`),
> `serde_json` v1.0.150, `hex` v0.4.3 — used ONLY by the new test module to
> parse the vector JSON and decode its hex fields; none is a production
> dependency, none is reachable from `src/lib.rs`'s public API, and
> `[dependencies]` (production) still has exactly one entry,
> `chacha20poly1305`, unchanged from Stage 74. The crate's PUBLIC API —
> `fedos_core_status`, `fedos_core_capabilities`, `random_bytes_placeholder`,
> `derive_key_placeholder`, `encrypt_placeholder`, `decrypt_placeholder` — is
> **completely unchanged** and still implements no cryptography; there is
> still **no public encrypt/decrypt implementation**, and nothing outside
> `#[cfg(test)]` imports or calls `chacha20poly1305`. `crate-type = ["rlib"]`,
> `#![forbid(unsafe_code)]`, and the absence of `wasm-bindgen` all stay exactly
> as before; no `.wasm` is produced. The Runtime, the Worker, and
> `CryptoProvider`/`FedosCoreCryptoProvider` are **not** touched — no random,
> nonce, or key generation is added anywhere, and nothing wires this crate's
> dependency into the host. `Cargo.lock` was generated to run `cargo test`
> and then deleted, not committed, per the same convention as Stage 74. New
> [`test/fedos_core_rust_rfc8439_wiring.test.ts`](test/fedos_core_rust_rfc8439_wiring.test.ts)
> (9 tests) checks: `[dependencies]` still has only `chacha20poly1305`;
> `serde`/`serde_json`/`hex` are dev-dependencies only and excluded from
> `[dependencies]`; every other named crypto crate and `wasm-bindgen` stay
> absent; `lib.rs` contains the `rfc8439_vectors` module wired to the exact
> vector file path via `include_str!` and actually imports/uses
> `chacha20poly1305` (but only in its `#[cfg(test)]`-scoped tail); the six
> public placeholder function signatures and bodies are byte-for-byte
> unchanged; no `pub fn` anywhere in the file is anything other than those six
> names; no `.wasm`/`Cargo.lock`/`target`/`build`/compiled artifact is
> committed; and the Runtime/Worker sources neither mention
> `chacha20poly1305`/`rfc8439` nor auto-call a crypto operation. Two existing
> test files were updated to keep scanning PRODUCTION code only, since the new
> `#[cfg(test)]` module legitimately mentions `chacha20poly1305`:
> [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> test 10, and [`test/fedos_core_rust_skeleton.test.ts`](test/fedos_core_rust_skeleton.test.ts)
> tests 3, 6, and 8 (test 3 also now stops its `[dependencies]` line-count at
> the next `[section]` header so `[dev-dependencies]` entries aren't
> miscounted as production dependencies) — every one of them now slices
> `lib.rs`'s source at its first `#[cfg(test)]` attribute and asserts the
> PRODUCTION prefix, not the whole file, has no AEAD mention. Stage 76
> candidate: **adopt the `hkdf` dependency** (production dependency + build
> check only, same one-crate-per-Stage pattern as Stage 74, no vector wiring
> yet — that follows in a later Stage once `hkdf` itself is adopted). Prior
> status:
>
> **Stage 74 — Adopt `chacha20poly1305` dependency (build check
> only; no crypto implementation, no vector wiring, no WASM change).**
> `packages/fedos-core-rust/Cargo.toml` gains its **first dependency**:
> `chacha20poly1305` v0.11.0 (RustCrypto, `default-features = false`,
> `features = ["alloc"]` — explicitly excludes the crate's default
> `getrandom` feature). `src/lib.rs` is **completely unchanged** — no import,
> no call, no encrypt/decrypt implementation, no test-vector loading, no
> random/nonce/key generation; `#![forbid(unsafe_code)]` and `crate-type =
> ["rlib"]` stay exactly as before. `cargo check` resolves and builds a
> 16-package dependency graph (`aead`, `chacha20`, `cipher`, `poly1305`,
> `crypto-common`, `inout`, `hybrid-array`, `universal-hash`, `block-buffer`,
> `typenum`, `cfg-if`, `cpufeatures`, `libc`, `cmov`, `ctutils`, plus
> `chacha20poly1305` itself) with **no `getrandom`, no `rand`/`rand_core`, no
> `zeroize`, no build script** anywhere in it (verified by inspecting the
> generated `Cargo.lock` before deleting it — **`Cargo.lock` is intentionally
> NOT committed** this stage, per the recommendation in
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md) §12:
> a library crate can defer lockfile reproducibility to the future
> build-manifest stage's `dependencyLockDigest`
> ([`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md))).
> `hkdf` / `argon2` / `aes-gcm` / `rand` / `getrandom` / `zeroize` / `secrecy`
> / `subtle` / `wasm-bindgen` remain ABSENT. The full dependency review (crate
> + version, why this crate, transitive count, build-script presence,
> internal `unsafe` in `chacha20`/`poly1305`/`cipher`/`aead`/`cpufeatures`,
> license, MSRV 1.85) is recorded in
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md) §12
> "Adoption log", the first entry under the Stage 72 one-crate-per-Stage
> process. New [`test/fedos_core_rust_dependency.test.ts`](test/fedos_core_rust_dependency.test.ts)
> (13 tests) checks: Cargo.toml contains `chacha20poly1305` and excludes every
> other named crypto crate; `crate-type` stays `rlib` only (no `cdylib`, no
> `wasm32`); `lib.rs` keeps `#![forbid(unsafe_code)]`, has no `unsafe` usage,
> and neither imports nor mentions `chacha20poly1305`/AEAD names, and its
> placeholder functions are untouched; no `.wasm`/compiled/`target`/`build`
> artifact and no `Cargo.lock` is committed; and the Runtime/Worker sources
> neither mention `chacha20poly1305` nor auto-call a crypto operation. The
> existing `test/fedos_core_rust_skeleton.test.ts` test 3 (previously "no
> crypto dependencies", asserting an empty `[dependencies]` table) was updated
> to assert `chacha20poly1305` is the table's ONLY entry, with every other
> crypto crate still forbidden. Stage 75 candidate: **wire the RFC 8439
> ChaCha20-Poly1305 vectors to `cargo test`** (read
> [`test-vectors/aead/chacha20poly1305-rfc8439.json`](test-vectors/aead/chacha20poly1305-rfc8439.json)
> from a Rust test and assert the crate's dependency reproduces the known
> answers — still no public encrypt/decrypt API). Prior status:
>
> **Stage 73 — Official crypto test vectors, verbatim import (no
> Rust, no crypto implementation, no dependency, no WASM change).**
> [`test-vectors/`](test-vectors/README.md) gains **five committed,
> verbatim-imported vector files** — the first real vector bytes in the
> repository — covering ChaCha20-Poly1305, AES-256-GCM, HKDF-SHA256,
> Argon2id, and NIP-44 v2, per the source catalog fixed in
> [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md):
> [`test-vectors/aead/chacha20poly1305-rfc8439.json`](test-vectors/aead/chacha20poly1305-rfc8439.json)
> (RFC 8439 §2.8.2 + Appendix A.5, 2 cases, fetched and scripted-extracted
> from `rfc-editor.org`, plaintext cross-checked by UTF-8 decode);
> [`test-vectors/aead/aes256gcm-nist.json`](test-vectors/aead/aes256gcm-nist.json)
> (NIST CAVP GCM Known-Answer Tests under SP 800-38D, from the official
> `gcmtestvectors.zip`'s `gcmEncryptExtIV256.rsp`/`gcmDecrypt256.rsp`, 5
> cases incl. one official `FAIL`/negative case, each recording its source
> file + `Count` index);
> [`test-vectors/kdf/hkdf-rfc5869.json`](test-vectors/kdf/hkdf-rfc5869.json)
> (RFC 5869 Appendix A.1–A.3, all 3 SHA-256 cases, including the zero-length
> salt/info case and the same-IKM/different-info domain-separation pair);
> [`test-vectors/kdf/argon2id-rfc9106.json`](test-vectors/kdf/argon2id-rfc9106.json)
> (RFC 9106 §5.3, the RFC's sole published Argon2id KAT); and
> [`test-vectors/nip44/nip44-v2.json`](test-vectors/nip44/nip44-v2.json) (the
> ENTIRE upstream `nip44.vectors.json` `v2` object from `paulmillr/nip44`,
> SHA-256-verified against the checksum published inline in
> `nostr-protocol/nips`' `44.md`, restructured — not value-altered — into 8
> named categories incl. 3 official `invalid.*` negative categories; a
> scripted deep-equality check confirmed every imported leaf value is
> byte-identical to upstream). Every file records its own `source` /
> `section` / `revision` / `license` fields; **no vector value was
> independently generated** — every negative/tamper case present (AES-256-GCM's
> `FAIL` case, all of NIP-44's `invalid.*` categories) is itself an official
> vector copied from source, since RFC 8439/RFC 5869/RFC 9106 do not publish
> byte-level tamper vectors and none is fabricated for those three files.
> **`XChaCha20-Poly1305` remains unimported** (source undecided,
> [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md) §4).
> [`test-vectors/README.md`](test-vectors/README.md),
> [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md) §10/§13, and
> [`docs/verification_infrastructure.md`](docs/verification_infrastructure.md)
> were updated in place (with an explicit "Update (Stage 73)" note preserving
> the original Stage 71/72 text) to record that these five primitives moved
> from lifecycle step 1 ("proposed") to step 2 ("imported") — **no primitive
> has reached step 3 ("wired")**; `packages/fedos-core-rust` is completely
> untouched (no `Cargo.toml`/`.rs` change, no dependency, no `unsafe`, no
> WASM), no crypto runs anywhere, and every runtime-gate condition in
> [`docs/verification_infrastructure.md`](docs/verification_infrastructure.md)
> §9 remains unmet for all primitives — the runtime still selects only the
> inert `NoopCryptoProvider`/`PlaceholderFedosCoreCrypto`. This stage adds no
> test — there is no new behavior to cover (the vectors are inert JSON data
> read by no code). Stage 74 candidate: **minimal RustCrypto dependency
> adoption** (`chacha20poly1305` / `hkdf` / `zeroize` / `subtle` / `secrecy` /
> `rand_core`) — dependency + build-plumbing only, per
> [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md), with
> no crypto API implementation and no Runtime wiring. Prior status:
>
> **Stage 72 — Crypto verification infrastructure skeleton (docs +
> empty `test-vectors/` directories only, no vectors, no crypto, no
> Rust/WASM change).**
> Four new docs plus an empty `test-vectors/` tree assemble the
> end-to-end **verification infrastructure** a future Rust crypto core will
> run inside — **no `src/` change, no `packages/fedos-core-rust/src/` change,
> no `Cargo.toml` change, no dependency, no vector JSON, no manifest JSON, no
> WASM, no Runtime/Worker change** in this stage.
> [`docs/verification_infrastructure.md`](docs/verification_infrastructure.md)
> fixes the pipeline: (1) purpose (a single pipeline doc, infrastructure not
> implementation, a gate registry); (2)–(3) the six-stage flow — source
> catalog → vector import → Rust implementation → `cargo test` → build
> manifest → runtime selection — each with an explicit gate condition;
> (4) the docs dependency graph (`crypto_test_vectors.md` →
> `crypto_vector_sources.md` → `fedos_core_rust_safety.md` →
> `rust_dependency_adoption.md` → `fedos_core_build_manifest.md` →
> `build_manifest_example.md` → this file → `test-vectors/README.md`);
> (5) vector lifecycle (proposed → imported → wired → passing → referenced →
> frozen, never edited to "fix" a failing implementation); (6) negative
> vectors (must assert explicit failure, never merely "didn't crash", never
> skipped for green CI); (7) regression policy (wired vectors run every
> `cargo test`; a dependency bump is validated against the full vector set);
> (8) CI policy as future intent only (no CI config changed in this stage);
> (9) the runtime gate condition (five conditions — sourced vectors, passing
> known-answer tests, failing-closed negative tests, a validated build
> manifest, WASM loader provenance — ALL required before a real provider can
> be selected; the placeholder stays selected otherwise); and (10) the
> current conclusion (docs + skeleton only, pipeline named end-to-end but
> unimplemented). [`docs/rust_dependency_adoption.md`](docs/rust_dependency_adoption.md)
> fixes the crate dependency process: one crate per Stage; audited crates
> only, no abandoned/single-author novelty crates; RustCrypto preferred by
> default; libsodium limited to uses with no RustCrypto equivalent (e.g.
> XChaCha20-Poly1305) with its C-dependency/build-script cost stated
> explicitly; `zeroize`/`secrecy`/`subtle` adopted together with the first
> primitive touching real secrets; `rand`/`getrandom` as its own Stage with
> production/test RNG kept separate; semver bumps validated against the full
> vector set and treated as a correctness incident if any output changes;
> a dependency-review record (crate+version, primitive served, why this
> crate, transitive count, build-script presence, internal `unsafe`, license,
> MSRV impact) required per Stage; MSRV stated explicitly once any dependency
> lands; and restated forbids (no home-grown crypto, no XOR, no custom
> constant-time compare, no `unsafe` added to FedOS's own code).
> [`docs/build_manifest_example.md`](docs/build_manifest_example.md) shows an
> ILLUSTRATIVE, non-normative example of the
> [`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md) §3
> field set with fabricated placeholder values (all-zero revisions,
> `EXAMPLE`-prefixed digests, `unset` signature/provenance refs, a
> self-describing `notes` field) — explicitly **not** the
> `packages/fedos-core-rust/manifest.example.json` file named as a future
> candidate elsewhere, and not committed anywhere but inside this markdown
> file's fenced code block. A new [`test-vectors/`](test-vectors/README.md)
> directory adds only a `README.md` (directory purpose, "no vectors committed
> yet", official-vectors-only rule, generated-vectors-forbidden-without-label
> rule, and the future `aead/`/`kdf`/`nip44/` layout) plus three EMPTY
> category subdirectories (`aead/`, `kdf/`, `nip44/`, each held in git by a
> `.gitkeep` placeholder) — no `.json` vector file exists anywhere in the
> tree. This stage adds no test — there is no new behavior to cover (the
> existing `fedos_core_rust_skeleton.test.ts` glob guard, scoped to
> `packages/fedos-core-rust/**`, is unaffected by the new top-level
> `test-vectors/` directory). Stage 73 candidate: **Official test vectors
> (verbatim import)** — the first Stage to add real `test-vectors/*.json`
> files (RFC 8439, RFC 5869, RFC 9106, NIST AES-GCM, upstream NIP-44), with
> source/license/revision fixed alongside each; Rust implementation still not
> started. Prior status:
>
> **Stage 71 — Crypto vector source research docs (docs only, no
> vectors, no crypto).**
> A new [`docs/crypto_vector_sources.md`](docs/crypto_vector_sources.md) fixes,
> in writing, the **official/upstream test-vector source catalog** a FUTURE
> FedOS Rust crypto core will draw known-answer vectors from — **no vector
> bytes copied, no `src/` change, no `packages/fedos-core-rust/src/` change, no
> dependency, no crypto, no WASM** in this stage. It is a **source-selection
> catalog**, concretizing the general rules already fixed in
> [`docs/crypto_test_vectors.md`](docs/crypto_test_vectors.md) §3–§7. It
> documents, per primitive: (1) purpose (source catalog before implementation;
> not a vector file, not an implementation spec); (2) adoption principles
> (official RFC/standard/upstream sources preferred; every vector needs
> source + section + revision + license note; generated/custom vectors stay
> out of scope; no implementation behavior specified); (3) ChaCha20-Poly1305
> (primary source RFC 8439 §2.8.2 + Appendix A.5; key/nonce/plaintext/AAD/
> ciphertext/tag; tag/ciphertext/AAD tamper cases; no nonce reuse);
> (4) XChaCha20-Poly1305 (candidate sources: draft-irtf-cfrg-xchacha,
> libsodium vectors, RustCrypto vectors only if traceable to an official
> source; weaker provenance than an RFC, revision must be recorded
> explicitly); (5) AES-256-GCM (candidate sources: NIST SP 800-38D, NIST CAVP
> GCM KATs, Wycheproof negative tests as optional future supplement;
> distinguishes 96-bit IV standard case from non-standard IV cases);
> (6) HKDF-SHA256 (primary source RFC 5869 SHA-256 cases; IKM/salt/info/L/PRK/
> OKM; domain-separation labels mandatory; Apple/Google/WebAuthn credential is
> never IKM/seed); (7) Argon2id (primary source RFC 9106; password
> label/salt/m/t/p/output/expected; mobile vs. desktop profile is a separate
> future decision; password never used directly as an AEAD key); (8) NIP-44
> (primary source upstream `nostr-protocol/nips` NIP-44 v2 vectors;
> conversation key/nonce/payload/ciphertext/decrypt-failure cases; NIP-44 is
> separate from the generic AEAD layer, no local variant); (9) cross-cutting
> negative/tamper vectors (tag/AAD/nonce/ciphertext tamper, malformed/
> truncated payload, wrong domain-separation label, KDF wrong info/salt must
> not collide); (10) the future `test-vectors/` file layout (six named files,
> none added); (11) a future JSON schema proposal (`algorithm` /`source`/
> `sourceRevision`/`licenseNote`/`cases[]`/`expected`/`shouldPass`/`notes` —
> proposal only, not committed); (12) Rust implementation linkage (connects to
> [`docs/fedos_core_rust_safety.md`](docs/fedos_core_rust_safety.md) and
> [`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md); a
> future implementation must pass these vectors before runtime provider
> selection is real; the runtime provider stays the inert placeholder); and
> (13) the current conclusion (docs only, no vectors, no crypto, no
> dependencies). This stage adds no test — there is no new behavior to cover.
> Stage 72 candidate: **Test-vector JSON schema docs and empty
> `test-vectors/` directory skeleton** (fix the schema and directory shape
> before any real vector bytes land). Prior status:
>
> **Stage 70 — FedOS Core Rust crate safety docs (docs only, no code).**
> A new [`docs/fedos_core_rust_safety.md`](docs/fedos_core_rust_safety.md) fixes,
> in writing, the guardrails around the Stage 69 minimal Rust crate skeleton —
> **no Rust/`Cargo.toml` change, no dependency, no crypto, no `zeroize`/`rand`, no
> WASM** in this stage — for adding dependencies, `unsafe`, crypto crates,
> randomness, and WASM before any real primitive lands. It documents: (1) the
> purpose (Rust crate safety contract; future crypto guardrails; not a crypto
> implementation spec); (2) the current crate state (Cargo.toml + lib.rs, no
> deps, `rlib` only, no cdylib/WASM, no crypto, `#![forbid(unsafe_code)]`);
> (3) the `unsafe` policy (keep it forbidden; adding it needs its own
> Stage + docs + review; no casual `unsafe` at FFI/WASM boundaries); (4) the
> dependency policy (adding deps is a separate Stage, audited crates only, crypto
> deps bind to the test-vector plan, `dependencyLockDigest`/manifest updated,
> supply-chain risk explicit); (5) the crypto-crate adoption policy
> (chacha20poly1305 / aes-gcm / hkdf / argon2 / zeroize / secrecy / subtle are
> candidates, adopt per feature per Stage, vectors mandatory, no custom XOR, no
> hand-rolled constant-time compare); (6) memory-safety / secret handling
> (`zeroize`/`secrecy` deferred until real secrets, arrive together with them, no
> secret in logs, panic/core-dump risk is future work); (7) the randomness policy
> (no `rand`/`getrandom` yet, CSPRNG is a separate Stage, separate test RNG from
> production RNG, no nonce reuse); (8) the WASM policy (no `wasm-bindgen`, no
> `cdylib`, no `.wasm`, follow the loader safety rules, runtime loading is a
> separate Stage); (9) the build-artifact policy (`target/`, `Cargo.lock`,
> `.wasm`, `.rlib`/`.so`/`.dll`/`.dylib`/`.a`/`.o`, `build/` never committed —
> enforced by `.gitignore` + test guards); (10) the test policy (`cargo check` /
> `cargo test` / `npm test` guards, official vectors at adoption, no unlabeled
> generated vectors); (11) the future implementation order (test-vector docs →
> build manifest docs → dependency adoption → AEAD → KDF → WASM target → runtime
> loading); and (12) the current conclusion (docs only, no Rust change, no deps,
> no crypto, no WASM). It complements
> [`docs/crypto_test_vectors.md`](docs/crypto_test_vectors.md),
> [`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md), and
> [`docs/fedos_core_wasm_safety.md`](docs/fedos_core_wasm_safety.md). This stage
> adds no test — there is no new behavior to cover. Stage 71 candidate: **AEAD
> vector source research docs** (survey which official AEAD known-answer vectors
> to adopt first). Prior status:
>
> **Stage 69 — Minimal FedOS Rust crate skeleton (Cargo project only, no
> cryptography, no WASM).**
> [`packages/fedos-core-rust`](packages/fedos-core-rust/README.md) gains a
> **minimal Rust crate skeleton** — a `Cargo.toml` (name `fedos-core-rust`,
> version `0.0.0`, edition 2021, `crate-type = ["rlib"]`, **no dependencies**) and
> a `src/lib.rs` with **placeholder functions only**. `lib.rs` defines
> `FedosCoreState` (`Unavailable`/`Placeholder`), `FedosCoreStatus`
> (`state` + `&'static str reason`), `fedos_core_status()`,
> `fedos_core_capabilities()`, and `random_bytes_placeholder()` /
> `derive_key_placeholder()` / `encrypt_placeholder()` / `decrypt_placeholder()` —
> each returns an `Unavailable`/`Placeholder` status and runs **no cryptography**.
> The crate has **no crypto crates** (no chacha20poly1305/aes-gcm/hkdf/argon2), no
> `rand`/`getrandom`, no `zeroize`/`secrecy`/`subtle`, no `bip39`/`secp256k1`, no
> `wasm-bindgen`, and `#![forbid(unsafe_code)]` bans `unsafe`. **No `.wasm`, no
> `cdylib`/WASM target, no build script, no `Cargo.lock`/`target/`** (a package
> `.gitignore` excludes build artifacts). The TS boundary
> (`FedosCoreCrypto` seam + inert `PlaceholderFedosCoreCrypto`) is unchanged and
> still passes typecheck, and the Rust crate is **not wired into the Runtime or
> Worker**. `cargo check` builds the dependency-free crate cleanly (optional; not
> required by CI). **Not implemented (still a future, explicitly-reviewed stage):**
> AEAD / HKDF / Argon2 / NIP-44 / BIP39 / BIP32, random generation, `zeroize`, key
> derivation, encryption/decryption, WASM generation, and any dependency — a real
> AEAD implementation must FIRST pass the crypto test vectors
> ([`docs/crypto_test_vectors.md`](docs/crypto_test_vectors.md)) and ship a build
> manifest ([`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md)).
> 13 tests in `test/fedos_core_rust_skeleton.test.ts` cover: Cargo.toml identity,
> lib.rs placeholder API, no crypto deps, no wasm-bindgen/cdylib, no `unsafe`, no
> crypto imports, no random/getrandom, no encryption beyond placeholder names, no
> `.wasm` committed, no `build/`/`target/` committed, README states skeleton-only,
> the TS boundary still loads inertly, and Runtime/Worker have no Rust/WASM
> auto-wire; the Stage 59/63 "no .rs/Cargo" guards were updated to "skeleton
> allowed, no compiled/WASM artifact". Stage 70 candidate: **Rust crate safety
> docs** (fix the dependency-addition / `unsafe` / `zeroize` / crypto-crate
> adoption rules before any real primitive lands). Prior status:
>
> **Stage 68 — FedOS Core build manifest plan (docs only, no code, no
> manifest committed).**
> A new [`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md)
> fixes, in writing, the plan for a build **manifest / provenance** contract a
> FUTURE FedOS Rust/WASM core must ship with — **no `src/` change, no
> `packages/fedos-core-rust/src/` change, no manifest JSON, no `Cargo.toml` / `.rs`
> / `.wasm`, no hashing/signing tooling** in this stage — so a build artifact can
> be tracked, pinned, and (eventually) verified before it is ever loaded. It is a
> **management plan, not a build spec**. It documents: (1) the purpose (provenance
> contract for a future core; a manifest skeleton; explicitly not a build spec);
> (2) why a manifest is needed (WASM module-swap risk, supply-chain risk,
> dependency drift, reproducibility, runtime loader safety); (3) the manifest
> skeleton fields (`manifestVersion`, `packageName`, `sourceRevision`,
> `sourceTreeDigest`, `rustToolchain`, `wasmTarget`, `buildProfile`,
> `dependencyLockDigest`, `testVectorSet`, `wasmArtifactDigest`, `signatureRef`,
> `provenanceRef`, `buildTimestampPolicy`, `notes`); (4) forbidden fields (secret,
> API key, private signing key, raw seed, local path with username, endpoint
> token, machine-specific absolute path); (5) the digest policy (SHA-256+, state
> what each digest covers, separate generated files from the source tree, no
> unverified WASM at runtime); (6) the signature policy (signed release is a
> future candidate, `signatureRef` is an opaque label, no private key in the
> manifest, verification unimplemented); (7) the reproducible-build policy
> (toolchain pinning, lockfile digest, deterministic flags, timestamp handling,
> environment note, state gaps honestly); (8) test-vector linkage (connects to
> [`docs/crypto_test_vectors.md`](docs/crypto_test_vectors.md) via `testVectorSet`;
> a Rust core must pass vectors before runtime selection); (9) the runtime-loader
> relationship (connects to
> [`docs/fedos_core_wasm_safety.md`](docs/fedos_core_wasm_safety.md); the loader
> does not read the manifest yet; a future manifest-validation boundary; no
> validation ⇒ no load); (10) the future file layout
> (`packages/fedos-core-rust/manifest.example.json`,
> `packages/fedos-core-rust/build/`, `test-vectors/` — none added yet); and
> (11) the current conclusion (docs only, no manifest JSON, no WASM, no Rust, a
> future explicit stage required). This stage adds no test — there is no new
> behavior to cover. Stage 69 candidate: **Minimal Rust crate skeleton** (a
> Cargo project only — no cryptography, no WASM generation). Prior status:
>
> **Stage 67 — Crypto operation test-vector plan (docs only, no code,
> no vectors committed).**
> A new [`docs/crypto_test_vectors.md`](docs/crypto_test_vectors.md) fixes, in
> writing, the KNOWN-ANSWER test vectors a FUTURE FedOS Rust crypto core must
> reproduce — **no `src/` change, no `packages/fedos-core-rust/src/` change, no
> vector JSON committed** in this stage — so that core can be built **test-first**.
> It is a **verification plan, not an implementation spec**. It documents:
> (1) the purpose (test-first plan for a future Rust core; no runtime dependency
> yet — the runtime still selects only `NoopCryptoProvider` / the inert
> `PlaceholderFedosCoreCrypto`); (2) candidate primitives (ChaCha20-Poly1305,
> XChaCha20-Poly1305, AES-256-GCM, HKDF-SHA256, Argon2id, NIP-44 — with
> BIP39/BIP32/NIP-06 deferred to a separate future candidate); (3) vector-adoption
> rules (prefer standard RFC / upstream official vectors; no home-grown vectors, or
> `generated` clearly labeled; do not freeze implementation-specific output);
> (4) AEAD rules (key / nonce / plaintext / AAD / ciphertext / tag, tamper-failure
> and no-nonce-reuse cases); (5) KDF rules (IKM / salt / info-context / length /
> expected OKM, mandatory domain separation); (6) Argon2id rules (m/t/p / salt /
> non-secret password label / length / expected, mobile-constraint note);
> (7) NIP-44 rules (reference the upstream NIP-44 v2 vectors, conversation key /
> nonce / payload, decrypt-failure cases; NIP-44 NOT implemented); (8) Rust
> prerequisites (`zeroize` / `secrecy` / `subtle`, audited crates, no custom XOR,
> no hand-rolled constant-time compare); (9) the forbidden list (XOR cipher,
> unauthenticated encryption, nonce reuse, custom KDF, password-as-key,
> Apple/Google/WebAuthn credential as seed); (10) the future `test-vectors/`
> layout (`aead/*.json`, `kdf/*.json`, `nip44/*.json` — added only when official
> vectors are copied with source notes, none added yet); and (11) the current
> conclusion (docs only, no crypto code, no vectors committed unless a verified
> source exists, and a future Rust implementation must pass these vectors before
> runtime selection). It complements
> [`docs/fedos_core_wasm_safety.md`](docs/fedos_core_wasm_safety.md) §10 (which
> names AEAD/KDF test vectors as prerequisites) and the crypto boundary. This
> stage adds no test — there is no new behavior to cover. Stage 68 candidate:
> **FedOS Core build manifest skeleton docs** (fix build manifest / provenance /
> pinned-digest management before any real Rust/WASM lands). Prior status:
>
> **Stage 66 — Anti-analysis & Shadow Vault risk docs (docs only, no
> code).**
> A new [`docs/anti_analysis_shadow_vault_risks.md`](docs/anti_analysis_shadow_vault_risks.md)
> fixes, in writing, a set of **hard prohibitions** — **no `src/` change, no
> behavior change** in this stage — so that nobody, now or in a future stage, adds
> anti-debugging, anti-VM detection, self-destruct, or fake "shadow data"
> generation. It documents: (1) anti-debug / anti-VM detection is NOT implemented
> (no `sys.gettrace`/`ptrace`/`debugger;` traps, no VM/emulator artifact scan, no
> "am I being analyzed?" fingerprinting); (2) self-destruct / forced exit /
> process kill is NOT implemented (no `os._exit`, no crash-on-detection, no
> heuristic-driven wipe trigger); (3) VM detection has high false positives and
> breaks legitimate users, developers/CI, and auditors; (4) debugger detection
> reads as evasion and is security theater; (5) the safe alternatives it DOES
> consider instead (app lock on background, explicit user lock, session timeout,
> a best-effort memory-wipe *request* boundary, crash-safe state clearing, no
> secret in logs) — reacting to the user/OS lifecycle, never to a "watched?"
> guess; (6) shadow data generator is NOT implemented; (7) branch-selected shadow
> vaults (e.g. `finger_id == 5`) are a clear anti-pattern; (8) fake activity
> generation carries large legal / UX / safety risk; (9) deniable storage stays a
> Stage 40 research boundary; (10) the prerequisites IF a legitimate hardened
> container were ever pursued (audited Rust core, fixed-size container, AEAD,
> padding, metadata-leak analysis, no hardcoded branch, no generated fake claims);
> (11) forbidden wording ("完全に隠せる" / "捜査に耐える" / "痕跡ゼロ" /
> "絶対バレない" and variants); and (12) the current conclusion (docs only, no
> anti-analysis, no shadow generator, prohibitions binding). It complements
> [`docs/deniable_storage_research.md`](docs/deniable_storage_research.md)
> (Stage 40) and [`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md).
> This stage adds no test — there is no new behavior to cover. Stage 67 candidate:
> **Crypto operation test-vector documentation** (fix the KNOWN-ANSWER vectors —
> AEAD / HKDF / Argon2 / NIP-44 — a future real core must reproduce). Prior
> status:
>
> **Stage 65 — Runtime crypto provider selection boundary (disabled by
> default, selection only, no WASM, no cryptography).**
> `createRuntime` can now SELECT a Stage 34 `CryptoProvider` from the environment
> and exposes it as `AppRuntime.cryptoProvider`. This is a **selection /
> dependency-injection seam ONLY** — building a runtime constructs the provider
> and nothing more: it never calls
> `randomBytes()`/`deriveKey()`/`encrypt()`/`decrypt()`, loads no WASM, issues no
> `fetch`/dynamic import, performs no WASM instantiation, and runs no
> KDF/AEAD/random/zeroize. New selection helper
> `selectCryptoProvider(env, overrides)`: (1) `overrides.cryptoProvider` wins
> unconditionally; (2) `CRYPTO_PROVIDER="noop"` → `NoopCryptoProvider`;
> (3) `CRYPTO_PROVIDER="fedos"` OR a truthy `ENABLE_CRYPTO_PLACEHOLDER`
> (`true`/`"1"`/`"true"`/`"yes"`/`"on"`) → a `FedosCoreCryptoProvider` injected
> with the permanently-inert **`PlaceholderFedosCoreCrypto` ONLY** (no real
> Rust/WASM core, no WASM loader — still `unavailable`, runs no cryptography);
> (4) anything else / invalid / absent → `NoopCryptoProvider` (the safe default —
> **disabled by default**). New env fields `RuntimeEnv.CRYPTO_PROVIDER?` and
> `RuntimeEnv.ENABLE_CRYPTO_PLACEHOLDER?` (mirrored on the Worker `Env`) are read
> but never mutated; the truthy check reuses the existing `isEnvFlagTruthy`
> helper. A new `RuntimeOverrides.cryptoProvider?` lets tests/callers pin a
> provider. The read-only Runtime status page adds `cryptoProvider` under the
> **security** category as a coarse constructor label only — it never calls
> `randomBytes`/`deriveKey`/`encrypt`/`decrypt` or any provider method. The Worker
> constructs and runs **nothing**: no crypto op, no WASM loader,
> and no cryptography. **Not implemented (still requires its own future, explicit
> stage):** any real WASM load / `WebAssembly.instantiate`, `.wasm` file, `fetch`,
> dynamic import, HKDF / Argon2 / AEAD, random generation, zeroize, encryption /
> decryption / key derivation, Vault unlock, and WebAuthn / Passkey. See
> [`docs/fedos_core_wasm_safety.md`](docs/fedos_core_wasm_safety.md) for the safety
> contract this selection boundary preserves (§6 "loader selection is a separate
> stage"). 12 tests in `test/runtime_crypto_env.test.ts` cover: override wins,
> `noop`→Noop, `fedos`→FedOS (placeholder core only), truthy
> `ENABLE_CRYPTO_PLACEHOLDER`→FedOS (and falsy→Noop), invalid→Noop,
> disabled-by-default, no crypto-op auto-call, no WASM instantiation / no `fetch`,
> status-page label-only (no provider method called), Worker runs no crypto op /
> no WASM loader, no `navigator.credentials` / `WebAssembly` / `fetch` call site in
> the runtime, and no env mutation. Stage 66 candidate: **Crypto operation
> test-vector documentation** (fix the KNOWN-ANSWER vectors — AEAD / HKDF /
> Argon2 / NIP-44 — a future real core must reproduce, so the Rust implementation
> can be built test-first). Prior status:
>
> **Stage 64 — FedOS Core WASM loader safety docs (docs only, no
> code).**
> A new [`docs/fedos_core_wasm_safety.md`](docs/fedos_core_wasm_safety.md) fixes,
> in writing, the safety contract that Stage 63's
> `packages/fedos-core-rust/src/wasm_loader.ts` already implements — **no `src/`
> change, no `packages/fedos-core-rust/src/` change, no behavior change** in this
> stage — so that when a real loader is eventually built (actual WASM
> instantiation) it cannot regress the rules that matter most: **nothing loads
> automatically, nothing is fetched, and no cryptography runs until an audited
> core exists behind an explicit, disabled-by-default gate.** It documents:
> (1) the loader boundary's purpose (WASM loader seam / future Rust crypto core
> replacement point — explicitly NOT an implementation spec, no runtime loading
> yet); (2) the absolute rules (no automatic WASM loading, no `fetch` by default,
> no dynamic import by default, no `WebAssembly.instantiate` by default, no
> path/URL resolution from env, no secrets in `moduleRef`/`integrityRef`, no
> crypto operation until an audited core exists); (3) what MAY be handled (opaque
> `moduleRef`/`integrityRef`, coarse loader state, placeholder capability,
> `PlaceholderFedosCoreCrypto` only); (4) what MUST NEVER be handled (raw module
> URL, endpoint URL, filesystem path, API key, seed, key material,
> plaintext/ciphertext bytes, stack trace, raw loader error); (5) the integrity /
> provenance policy (`integrityRef` is an opaque label, no real hash verification
> yet, a real loader needs a pinned digest / signed release / reproducible build /
> versioned manifest, and never loads real WASM without an integrity check);
> (6) the Runtime / Worker relationship (no auto-load from `createRuntime` or the
> Worker, loader selection is a separate stage, actual load is a further stage,
> status page shows a constructor label only); (7) the CryptoProvider relationship
> (`FedosCoreCryptoProvider` is the adapter, the bridge only extracts a core from a
> decision, no real KDF/AEAD/random/zeroize, Noop/Placeholder are not a safety
> guarantee); (8) error handling (no raw error, no stack trace, no endpoint/path
> echoed, error state + fixed reason only); (9) the test policy this area must keep
> satisfying (no `.wasm` committed, no `.rs`/Cargo committed, no
> fetch/import/`WebAssembly.instantiate`, Runtime/Worker not wired,
> `moduleRef`/`integrityRef` not resolved, no input mutation); and (10) the future
> implementation prerequisites (Rust crate separated, audited dependencies,
> `zeroize`/`secrecy`/`subtle`, AEAD test vectors, KDF test vectors, reproducible
> build, pinned digest, explicit disabled-by-default runtime gate, no auto
> network). Every rule matches code that already exists and is already tested in
> `test/fedos_core_wasm_loader.test.ts` — this stage adds no new test either, since
> there is no new behavior to cover. Stage 65 candidate: **Runtime crypto provider
> selection boundary, disabled by default** (let `createRuntime` SELECT a
> `CryptoProvider` — still with no real WASM load and no real cryptography). Prior
> status:
>
> **Stage 63 — FedOS Core WASM loader boundary (loader seam only,
> disabled by default, no WASM, no Rust, no cryptography).**
> A new [`packages/fedos-core-rust/src/wasm_loader.ts`](packages/fedos-core-rust/src/wasm_loader.ts)
> adds the LOADER SEAM a future stage would use to bring a real RustCrypto-backed
> WASM module online behind the Stage 59 `FedosCoreCrypto` seam — but this stage
> ships the **boundary / placeholder / pure bridge ONLY**, and **loads nothing**.
> It defines `FedosCoreWasmLoader` (`getStatus`, `getCapabilities`,
> `load(request)`, `unload()`), a `FedosCoreWasmLoaderState`
> (`disabled`/`unloaded`/`loaded_placeholder`/`unavailable`/`error`), placeholder
> `FedosCoreWasmLoaderCapability` labels (`wasm_loader_placeholder`,
> `instantiate_placeholder`, `integrity_check_placeholder`,
> `rust_core_placeholder`), a `FedosCoreWasmLoadRequest` (OPAQUE, non-secret
> `moduleRef`/`integrityRef` labels plus a coarse `source: "disabled" |
> "placeholder"`), and a `FedosCoreWasmLoadDecision` (`allowed`/`state`/`reason`
> plus an optional `core`). `NoopFedosCoreWasmLoader` is the **disabled-by-default**
> default (advertises nothing, denies every load); `PlaceholderFedosCoreWasmLoader`
> models an `unloaded → loaded_placeholder → unloaded` state machine — and even a
> `loaded_placeholder` hands back ONLY the permanently-inert
> `PlaceholderFedosCoreCrypto` (itself `unavailable`), never a real core; `unload()`
> only changes state. Two pure helpers: `fedosCoreWasmDecisionToCore(decision)`
> pulls the core a decision produced (or `undefined`), and
> `loadFedosCoreWasm(loader, request)` wraps any loader's `load` so a throw/reject
> becomes a non-sensitive `error` decision instead of propagating. **The loader is
> a boundary only: it issues no `fetch`, performs no dynamic module import, calls
> no WASM `instantiate`/`compile` engine API, resolves no module path/URL, and
> runs no cryptography** (no HKDF/Argon2/KDF, no AEAD, no CSPRNG/random, no
> zeroize, no key generation/derivation). `moduleRef`/`integrityRef` are opaque
> labels — never resolved, fetched, or echoed. It is **NOT wired into the runtime
> or the Worker** (`create_runtime.ts`/`worker.ts` contain no `wasm`/`fedos`
> reference). **No `.wasm` file, no `.rs`/`Cargo.toml`, and no Rust/crypto/WASM
> library** are added. **A future real loader (actual WASM instantiation) requires
> its own separate, explicit stage.** 15 tests in
> `test/fedos_core_wasm_loader.test.ts` cover: Noop always disabled, Placeholder
> constructor inert (starts `unloaded`), `load` issues no `fetch`, `load` calls no
> WASM `instantiate`/`compile`, `load` returns the inert placeholder core only,
> `moduleRef`/`integrityRef` never resolved or echoed, `unload` changes state
> only, loader errors caught by `loadFedosCoreWasm` (never thrown/leaked), no
> input mutation, Runtime/Worker have no WASM-loader auto-wire, no `.wasm`
> committed, no `.rs`/Cargo committed, no crypto/WASM import, and no dynamic
> import. Stage 64 candidate: **FedOS Core WASM safety docs** (fix, in writing,
> what a real loader MAY and MUST NEVER do before any real WASM lands). Prior
> status:
>
> **Stage 62 — WebAuthn runtime selection boundary (disabled by
> default, selection only, no browser API).**
> `createRuntime` can now SELECT a Stage 60 `WebAuthnProvider` from the
> environment and exposes it as `AppRuntime.webAuthnProvider`. This is a
> **selection / dependency-injection seam ONLY** — building a runtime constructs
> the provider and nothing more: it never calls `begin()`/`cancel()`, touches no
> browser credential API, launches no Face ID / Touch ID, contacts no Secure
> Enclave / Android Keystore, and stores no credential/challenge. **WebAuthn /
> Passkey stays an unlock TRIGGER only, never a key source — and no unlock ever
> happens by constructing a runtime.** New selection helper
> `selectWebAuthnProvider(env, overrides)`: (1) `overrides.webAuthnProvider`
> wins unconditionally; (2) `WEBAUTHN_PROVIDER="noop"` → `NoopWebAuthnProvider`;
> (3) `WEBAUTHN_PROVIDER="placeholder"` OR a truthy `ENABLE_WEBAUTHN_PLACEHOLDER`
> (`true`/`"1"`/`"true"`/`"yes"`/`"on"`) → `PlaceholderWebAuthnProvider`;
> (4) anything else / invalid / absent → `NoopWebAuthnProvider` (the safe,
> permanently-`unavailable` default — **disabled by default**). New env fields
> `RuntimeEnv.WEBAUTHN_PROVIDER?` and `RuntimeEnv.ENABLE_WEBAUTHN_PLACEHOLDER?`
> (mirrored on the Worker `Env`) are read but never mutated; the truthy check
> reuses the existing `isEnvFlagTruthy` helper. A new `RuntimeOverrides.
> webAuthnProvider?` lets tests/callers pin a provider. The read-only Runtime
> status page adds `webAuthnProvider` under the **security** category as a coarse
> constructor label only — it never calls `begin`/`cancel` or any provider
> method. The Worker constructs and begins **nothing**: no
> `new PlaceholderWebAuthnProvider`, no `begin()`/`cancel()`, no
> `navigator.credentials`. **Not implemented (still requires its own future,
> explicit stage):** any real `navigator.credentials.create/get` call, Face ID /
> Touch ID / platform-authenticator launch, Secure Enclave / Android Keystore
> access, conditional-UI / autofill, credential / challenge / response /
> attestation / assertion storage, JWT / OAuth, key generation / derivation, and
> Vault unlock. See [`docs/webauthn_passkey_safety.md`](docs/webauthn_passkey_safety.md)
> for the safety contract this selection boundary preserves. 13 tests in
> `test/runtime_webauthn_env.test.ts` cover: default→Noop, `noop`→Noop,
> `placeholder`→Placeholder, truthy `ENABLE_WEBAUTHN_PLACEHOLDER`→Placeholder
> (and falsy→Noop), invalid→Noop, override wins, no `begin()` auto-call, no
> `cancel()` auto-call, no `navigator.credentials` in the runtime sources (and no
> throw when building), no Worker `begin`/`navigator.credentials`, status-page
> label-only (no provider method called), and no env mutation. Stage 63
> candidate: **FedOS Core WASM loading boundary, disabled by default** (cut the
> next swap point — the FedOS Core WASM loader seam — so the Identity → WebAuthn
> → Vault → Crypto Core substitution path becomes visible). Prior status:
>
> **Stage 61 — WebAuthn / Passkey adapter safety docs (docs only, no
> code).**
> A new [`docs/webauthn_passkey_safety.md`](docs/webauthn_passkey_safety.md)
> fixes, in writing, the safety contract that Stage 60's
> `src/identity/webauthn_adapter.ts` already implements — **no `src/` change, no
> behavior change** in this stage — so that when a real browser adapter is
> eventually built (actual `navigator.credentials` calls) it cannot regress the
> rule that matters most: **WebAuthn / Passkey is an unlock TRIGGER, never a key
> source, never an identity seed.** It documents: (1) the adapter's purpose
> (unlock-trigger boundary / browser-provider seam — explicitly NOT a key source,
> NOT an identity seed); (2) the absolute rules (Apple ID / Google Account, a
> credential id, and an assertion response are NEVER a seed; challenge / `rawId` /
> `attestation` / `authenticatorData` / `clientDataJSON` / JWT / OAuth tokens are
> NEVER stored); (3) what MAY be handled (opaque `reference`/`rpIdRef`/`userRef`
> labels, coarse status, placeholder capability, non-secret reason); (4) what
> MUST NEVER be handled (credential, rawId, challenge bytes, assertion response,
> attestation object, authenticator data, private key, seed, token, JWT,
> profile/email, platform-authenticator secret); (5) the Vault relationship
> (WebAuthn → `PasskeyAuthenticationRequest` → `VaultUnlockRequest`, all separate
> boundaries — WebAuthn unlocks a LOCAL vault but never generates its seed, and no
> real unlock happens yet); (6) the Crypto / FedOS Core relationship (FedOS Core
> is the future crypto swap point; the adapter never calls a `CryptoProvider` and
> handles no KDF/AEAD/random); (7) the conditions any future real
> `navigator.credentials` adapter must satisfy (disabled by default, explicit user
> action, no automatic prompt, no credential/challenge persistence, sanitized
> errors, no stack trace, no raw provider response); (8) UI/UX wording ("Unlock
> with passkey" allowed; "Generate key from Apple ID" / "Face ID creates your
> Nostr key" / "Apple·Google account is your seed" forbidden); (9) the test policy
> this area must keep satisfying (no `navigator.credentials` call, no
> credential/challenge retention, Runtime/Worker not wired, type-only Passkey
> import, no crypto import); and (10) the current-state conclusion (docs only, no
> real WebAuthn, no key derivation, a future explicit stage required). Every rule
> matches code that already exists and is already tested in
> `test/webauthn_adapter.test.ts` — this stage adds no new test either, since
> there is no new behavior to cover. Stage 62 candidate: **WebAuthn runtime
> selection boundary, disabled by default** (let `createRuntime` SELECT a
> `WebAuthnProvider` — still with no real `navigator.credentials`). Prior status:
>
> **Stage 60 — WebAuthn / Passkey provider adapter skeleton (boundary
> only, no browser API).**
> A new [`src/identity/webauthn_adapter.ts`](src/identity/webauthn_adapter.ts)
> adds the browser-provider ADAPTER seam that a future unlock flow would hand to
> the Stage 36 `PasskeyBoundary` — but this stage ships the **boundary /
> placeholder / pure bridge ONLY**. It defines `WebAuthnProvider` (`getStatus`,
> `getCapabilities`, `begin(request)`, `cancel()`), a `WebAuthnAdapterStatus`
> (`unavailable`/`idle`/`waiting`/`authenticated_placeholder`/`cancelled`/
> `error`), placeholder `WebAuthnAdapterCapability` labels (`webauthn_placeholder`,
> `platform_authenticator_placeholder`, `cross_platform_authenticator_placeholder`,
> `conditional_ui_placeholder`), and a `WebAuthnAdapterRequest` (`kind: "get" |
> "create"` plus OPAQUE, non-secret `reference`/`rpIdRef`/`userRef` labels).
> `NoopWebAuthnProvider` is the permanently-`unavailable` default (advertises
> nothing, denies every attempt); `PlaceholderWebAuthnProvider` models an
> `idle → authenticated_placeholder ↔ cancelled` UX holding ONLY a coarse
> `WebAuthnReport` — its `authenticated_placeholder` is a LABEL (no credential is
> held and the Vault is NOT unlocked), `cancel()` only changes state, and the
> report's `reason` never echoes any opaque label. **The WebAuthn adapter is a
> boundary only: it calls no browser credential API** (`navigator.credentials`
> appears nowhere), launches no Face ID / Touch ID, contacts no Secure Enclave /
> Android Keystore, runs no conditional-UI flow, and stores no
> challenge/credential id/rawId/response/attestation/assertion/token/key.
> **Apple / Google / WebAuthn are unlock TRIGGERS ONLY, never a key source.** The
> pure `webauthnReportToPasskeyRequest(request)` bridge maps a WebAuthn
> `get`/`create` to a Stage 36 `PasskeyAuthenticationRequest` with `kind:
> "webauthn"` (never `apple_passkey`/`android_passkey`), passing only the opaque
> `reference` through (`rpIdRef`/`userRef` are NOT forwarded) — it derives no
> key, holds no credential, does NOT unlock the Vault, and keeps its Passkey-types
> dependency TYPE-ONLY. It is **NOT wired into the runtime or the Worker** —
> `create_runtime.ts`/`worker.ts` construct nothing from this file and contain no
> `webauthn` reference. **A future real browser adapter (actual
> `navigator.credentials` calls) requires its own separate, explicit stage.** 16
> tests in `test/webauthn_adapter.test.ts` cover: Noop always unavailable,
> Placeholder constructor is inert, `begin` calls no browser API (no throw in
> node + source has no `navigator.credentials`), a `create` request stores no
> challenge/attestation, a `get` request stores no credential id/assertion,
> `cancel` changes state only, the bridge is pure and passes only the opaque
> reference (never a platform passkey kind), no input mutation, no method throws,
> the Runtime and Worker sources contain no `webauthn` reference, no
> browser-credential API usage, and no WebAuthn/credential/crypto library import.
> Stage 61 candidate: **WebAuthn adapter safety docs** (fix, in writing, the
> "credential is not a key source / Apple·Google are not a seed" rules before any
> real browser API lands). Prior status:
>
> **Stage 59 — FedOS core crypto package boundary (no Rust, no WASM,
> no cryptography).**
> A new package [`packages/fedos-core-rust`](packages/fedos-core-rust/README.md)
> is the INTENDED future home of a RustCrypto-backed WASM/FFI crypto core — but
> this stage ships the **package boundary / TS adapter / placeholder core
> ONLY**. It defines the standalone `FedosCoreCrypto` seam (`getStatus`,
> `getCapabilities`, `randomBytes`, `deriveKey`, `encrypt`, `decrypt`) and a
> permanently-inert `PlaceholderFedosCoreCrypto` / `createFedosCoreCrypto()`
> that reports `state: "unavailable"`, advertises placeholder capabilities
> (labels of FUTURE intent, all ending `_placeholder`), and refuses every
> operation with a non-sensitive `FedosCoreDecision` (`{ allowed, state, reason }`
> — no output/bytes field, since nothing is computed). The package's `types.ts`
> imports nothing at all; its capability/state/decision string values mirror the
> host `src/crypto/types.ts` seam so the host adapter can pass them straight
> through. The host consumes it ONLY through the new
> `FedosCoreCryptoProvider implements CryptoProvider`
> (`src/crypto/fedos_core_adapter.ts`), which injects an optional
> `FedosCoreCrypto`: built WITHOUT a core it is a drop-in `NoopCryptoProvider`
> (delegates to one — `unavailable`, empty capabilities); built WITH the
> placeholder core it delegates `getStatus`/`getCapabilities` and returns
> `unavailable` for every operation. The adapter **never throws** (a core that
> throws/rejects is caught and reported as a non-sensitive `error`
> status/decision — the provider's own error text is dropped, never echoed),
> **never mutates** the input request, and **retains no** secret/key/plaintext/
> ciphertext bytes (requests carry only opaque handles). **This stage implements
> no real cryptography**: no HKDF/Argon2/KDF, no AEAD/ChaCha20-Poly1305/AES-GCM/
> encrypt/decrypt, no CSPRNG/random, no BIP39/BIP32, no NIP-44, no zeroize, no
> WebAuthn/passkey, no Secure Enclave, and no Apple/Google integration. No
> `.wasm`/`.rs`/Cargo file is committed. It is **NOT wired into the runtime or
> the Worker** — `create_runtime.ts`/`worker.ts` construct nothing from these
> files and contain zero `fedos` reference. 15+ tests in
> `test/fedos_core_adapter.test.ts` cover: the package exports the placeholder
> core, core status `unavailable`, capabilities placeholder-only, the adapter
> implements `CryptoProvider`, delegates `getStatus`/`getCapabilities`, returns
> `unavailable` for `randomBytes`/`deriveKey`/`encrypt`/`decrypt`, catches a
> throwing core without leaking its error text, no input mutation, the Runtime
> and Worker sources contain no `fedos` reference, no crypto/WASM library import,
> and no Rust/WASM binary committed. Stage 60 candidate: **WebAuthn/Passkey
> provider adapter skeleton** (a disabled-by-default browser-API boundary, so
> Identity → Vault → Crypto wiring can proceed). Prior status:
>
> **Stage 58 — Runtime external health check boundary, disabled by
> default.**
> A new `src/runtime/health_check.ts` ships ONLY the boundary shape for a
> future "is this selected provider/endpoint actually reachable?" seam — as
> opposed to Stage 50/51's `runtime_status.ts`, which only reports WHICH
> implementation was selected, never whether it works. `HealthCheckTarget`
> (`kind`/`label`/optional `endpointRef`) describes what would be checked —
> `endpointRef` is an OPAQUE display label only, never a real URL to
> dereference, and there is deliberately no field for an API key or token
> anywhere in this file. `HealthCheckProvider` (`getStatus()`/`check(target,
> options?)`) is the seam; `NoopHealthCheckProvider` and
> `DisabledHealthCheckProvider` are both safe, permanently-inert defaults —
> `check()` NEVER issues a `fetch`, pings anything, or calls a provider/cache/
> bridge method, and always resolves `status: "disabled"` without touching
> the network. The pure `canRunHealthCheck(target, options?)` policy helper
> models the opt-in gate itself: without `{ enabled: true }` it resolves
> `"disabled"`; even WITH that opt-in, it resolves `"skipped"` rather than
> fabricate a health result, because no real check implementation exists yet.
> `HealthCheckDecision.checkedAt` is populated ONLY from a caller-supplied
> `options.now` — this module never calls `Date.now()` itself, so omitting
> `now` means no `checkedAt` at all (never a silently guessed timestamp), and
> `targetLabel` echoes ONLY `target.label`, never `target.endpointRef` — even
> a caller-supplied endpointRef that looks like a real secret/URL never
> appears anywhere in the returned decision. **This stage implements no real
> probe, ping, or `fetch` of any kind, and is NOT wired into the runtime or
> the Worker** — `createRuntime`/`worker.ts` construct nothing from this file
> and call nothing in it; `src/runtime/health_check.ts` itself has zero
> imports. 15 new tests in `test/runtime_health_check.test.ts` cover: both
> Noop/Disabled providers are always `"disabled"`, `check()` issues no
> `fetch` (verified with a `globalThis.fetch` spy) and calls no provider
> method, `endpointRef` stays opaque and is never echoed in the decision (even
> a fake-secret-shaped value), no API-key/token-shaped field exists on the
> target or the decision, `checkedAt` reflects an injected `now` and is
> absent (not defaulted) without one, no input mutation, and both the Runtime
> and Worker sources have zero reference to this module. Stage 59 candidate:
> **Provider preview test matrix docs** (a table of the Stage 52 dual-flag ×
> Stage 53 diagnostic-state combinations and their expected rendered output,
> to guard against regression as that area accumulates more tests). Prior
> status:
>
> **Stage 57 — provider preview docs hardening (docs only, no code).**
> A new [`docs/provider_preview_safety.md`](docs/provider_preview_safety.md)
> fixes, in writing, the safety contract that Stage 49's
> `invokePromotionProviderPreview`, Stage 52's dual-flag Worker wiring, and
> Stage 53's diagnostics layer already implement — **no `src/` change, no
> Worker/Runtime/Promotion behavior change** in this stage. It documents: (1)
> the preview's purpose (a provider-integration check — explicitly NOT ad
> serving, NOT ranking, NOT billing, NOT tracking); (2) the exact dual-flag
> invocation condition (`ENABLE_PROMOTION_PROVIDER_PREVIEW` env AND
> `?edgeRecPreview=1`/`?providerPromotionPreview=1` query, BOTH required —
> query-only and env-only each call the provider zero times, disabled by
> default); (3) how it differs from the Stage 41 mock preview
> (`?promotionPreview=1` drives ONLY `MockPromotionProvider`; the two paths
> never share a flag or a provider); (4) exactly what MAY be shown (sanitized
> title/description/sponsor, bounded metadata — 10 entries/200 chars, the
> `provider_preview`/`provider_error`/`disabled` state, and a fixed diagnostic
> sentence); (5) exactly what MUST NEVER be shown (destination/image/tracking
> URLs, click/impression IDs, auction/ranking scores, billing info, API keys,
> endpoint URLs, stack traces, raw provider error bodies, viewer/actor
> pubkeys); (6) exactly what MUST NEVER be called (click/impression tracking,
> billing/Stripe, Telegram, `HTMLRewriter`, any automatic `fetch` outside the
> one gated `getPromotions` call, recommendation rewriting, default
> viewer-pubkey sending); (7) error handling (a provider throw becomes a
> FIXED `provider_error` sentence — the raw reason is dropped entirely, never
> carried into the diagnostic view); (8) privacy (viewer pubkey non-send by
> default, `?actor=` never threaded into the provider's placement request,
> bounded metadata, candidate URLs never surfaced); (9) the test policy this
> area must keep satisfying (dual-flag combinations, no link/image/tracking
> markup, error sanitization including a poisoned-error-message check, mock
> path unaffected); and (10) rules for any future real-serving work (its own
> Stage, its own disabled-by-default gate per concern, never a silent
> promotion of "preview" into production). Every rule in the document matches
> code that already exists and is already tested — this stage adds no new
> test either, since there is no new behavior to cover. Prior status:
>
> **Stage 56 — product purchase/grant preview polish.**
> `src/render/payment.ts` and `src/render/grant_preview.ts` get clearer,
> harder-to-misread copy — WITHOUT changing when either preview shows or what
> data it is built from. The purchase panel now shows an explicit **"Preview
> only."** notice (previously only "No payment is processed." disclosed
> this), right after the "Purchase preview" heading and before the price/rail
> table; the buyer line is reworded from "buyer candidate:" to "buyer preview
> reference:" to make its non-binding, display-only nature explicit (the
> `purchase-buyer-candidate` CSS class is UNCHANGED for backward
> compatibility). The disabled checkout button gains `aria-disabled="true"`
> alongside its native `disabled` attribute; the purchase/grant
> preview/unavailable sections all gain `data-testid`/`aria-label` attributes
> — safe, inert additions with no behavioral effect. The grant panel's fixed
> `PREVIEW_REASON` is split from one run-on sentence ("Preview only — no
> PurchaseGrant has been issued and no access has been granted.") into two
> explicit, independently-matchable sentences: **"No PurchaseGrant has been
> issued."** and **"No access has been granted."** — the standalone "Preview
> only." note above it already covers that phrase, so it isn't repeated in
> the reason text. The grant panel's buyer line is reworded the same way
> ("buyer preview reference:"), and the forbidden-word list is widened from
> paid/settled/purchased to also cover **bought/owned/unlocked** — a
> negated/negative-context use of "granted" (`not_granted`, "No access has
> been granted.") remains the only permitted appearance of that word; nothing
> here ever affirms "access granted", "grant issued", "download unlocked", or
> similar. **The gating logic is completely unchanged**: the grant preview
> still shows ONLY for an `accepted_placeholder` decision (`pending`/
> `rejected`/`unavailable`/`error` still show nothing), `paymentDecisionToGrant`
> is still never imported or called, no `PurchaseGrant` is ever constructed,
> and no invoice/checkout URL/QR/card form/signed URL/download ever appears.
> 6 new tests across `test/render_payment.test.ts` and `test/
> render_grant_preview.test.ts` cover: the purchase panel's explicit "Preview
> only." notice, the widened forbidden-word check (paid/settled/purchased/
> bought/owned/unlocked, plus a bare "granted" ban on the purchase panel,
> which has no grant fields to negate), the grant panel's two exact sentences
> ("No PurchaseGrant has been issued."/"No access has been granted."), a
> structural check that every occurrence of "granted" on the grant panel sits
> inside a negated sentence, and a source-level check that
> `src/render/grant_preview.ts` never imports or calls
> `paymentDecisionToGrant`. All pre-existing Stage 45/48 tests (escaping,
> disabled-button presence, unavailable-panel fallback, no-mutation, board/
> space/chat non-interference) continue to pass unmodified — this stage
> changed wording/attributes only, never the public API or the gating logic.
> Prior status:
>
> **Stage 55 — Runtime diagnostics docs hardening (docs only, no code).**
> A new [`docs/runtime_diagnostics.md`](docs/runtime_diagnostics.md) fixes, in
> writing, the safety contract that `src/render/runtime_status.ts` and the
> `?runtimeStatus=1`/`&format=json` Worker route (Stages 50–54) already
> implement — **no `src/` change, no Runtime/Worker/provider/cache behavior
> change** in this stage. It documents: (1) the diagnostics layer's purpose
> (read-only inspection of which implementation `createRuntime` selected —
> coarse type labels only, no health probing, no external calls); (2) exactly
> what MAY be shown (runtime mode, component name/category, constructor label
> or the `"(unnamed implementation)"` fallback, the five fixed categories);
> (3) exactly what MUST NEVER be shown (API keys, endpoint URLs, tokens,
> secrets, raw env values, actor/viewer pubkeys, payment metadata,
> notification payloads, asset bytes, provider response bodies, stack traces);
> (4) exactly what MUST NEVER be called (`getPromotions`/`getRecommendations`/
> `requestPayment`/`notify`/`publish`/`assetCache.get,put,has,delete,clear`/
> event-cache or directory/index lookups/external `fetch`) — the only
> permitted read is `.constructor.name`, a property read, never an
> invocation; (5) HTML-specific rules (mandatory `escapeHtml`, no endpoint
> links, no raw object dumps, no stack traces); (6) JSON-specific rules
> (allowlist fields only, never `JSON.stringify` the raw runtime, no
> functions/methods, `generatedAt` opt-in only, `format=json` as a strict
> allowlist rather than a denylist); (7) the test policy this area must keep
> satisfying (method-call spies at zero, secret/endpoint-shaped values proven
> absent, invalid-`format` fallback, no raw-runtime-stringify); and (8) rules
> for future extensions (new components need a category + safe label;
> calling a `getStatus()`-style method requires a documented inertness proof;
> external health checks must ship as their own disabled-by-default boundary,
> the way Stage 49/52 gated real provider invocation; diagnostics is not an
> audit log). Every rule in the document matches code that already exists and
> is already tested — this stage adds no new test either, since there is no
> new behavior to cover. Prior status:
>
> **Stage 54 — Runtime status JSON export, disabled by default.**
> `src/render/runtime_status.ts` gains an opt-in JSON export of the SAME
> Stage 50/51 `RuntimeStatusView` shown by `?runtimeStatus=1`.
> `serializeRuntimeStatusView(view, generatedAt?)` builds a `RuntimeStatusJson`
> (`{ mode, components, sections, generatedAt? }`) by reconstructing each
> component/section field-by-field from an explicit allowlist
> (`name`/`label`/`category`) — it NEVER `JSON.stringify`s the view or the raw
> `AppRuntime` directly, so the JSON can never accidentally carry more than
> the three safe fields the HTML page already shows. `generatedAt` is OMITTED
> unless a caller explicitly passes one (this function never reads the clock
> itself). `renderRuntimeStatusJson(view)` wraps that in `JSON.stringify`. In
> the Worker, a new `isRuntimeStatusJsonRequested(url)` checks for an EXACT
> `&format=json` (a strict allowlist — any other value, or its absence, falls
> back to HTML; there is no denylist to bypass). `?runtimeStatus=1` alone
> still renders HTML exactly as Stage 50 left it; `?runtimeStatus=1&format=json`
> returns the same view as `application/json` via a new `jsonResponse` helper.
> **Same safety guarantees as the HTML page, unchanged**: building/serializing
> the JSON calls NO provider/cache/bridge method (`getPromotions`,
> `getRecommendations`, `requestPayment`, `notify`, `publish`,
> `assetCache.get/put/has/delete/clear`), issues NO `fetch`, and the JSON
> never contains an endpoint URL, API key, env value, secret, or viewer/actor
> pubkey — none of that is read from `RuntimeEnv` by this module in the first
> place, only the ten components' coarse type labels. 10 new tests in
> `test/runtime_status_json.test.ts` and 12 new tests in `test/
> worker_runtime_status.test.ts` cover: the serialized JSON carries the
> mode/sections/categories/labels correctly, no endpoint/API-key/secret/pubkey
> ever appears, no function/method survives serialization (and the JSON
> round-trips cleanly), no input mutation, `renderRuntimeStatusJson` returns
> parseable JSON, `?format=json` returns `application/json` with the expected
> shape, `?runtimeStatus=1` without (or with an invalid) `format` still
> returns HTML (tested against `xml`/`yaml`/`JSON`/`1`/empty-string — an
> allowlist, not a denylist), zero provider/cache/bridge calls happen for the
> JSON path either, no `fetch`, and the default Worker export serves the JSON
> end-to-end. Prior status:
>
> **Stage 53 — provider preview diagnostics hardening.**
> `src/render/promotion.ts` gets a clearer, more explicit diagnostic layer for
> Stage 52's provider preview, WITHOUT touching when it is invoked — the dual
> flag (`ENABLE_PROMOTION_PROVIDER_PREVIEW` env + `?edgeRecPreview=1`/
> `?providerPromotionPreview=1` query, both required) is byte-for-byte
> unchanged. A new `PromotionPreviewDisabledReason` type
> (`"env_flag_disabled"` | `"query_flag_missing"` | `"preview_mode_not_requested"`)
> and `PromotionPreviewDiagnosticView` (`{ kind: "disabled" | "provider_preview"
> | "provider_error", disabledReason?, decision? }`) replace the old
> `renderPromotionInvocationPreview`. `buildPromotionPreviewDiagnostic(result,
> disabledReason?)` maps a Stage 49 `PromotionInvocationDecision` into this
> view — a successful `"provider_preview"` (with a decision) maps straight
> through; `"provider_error"` maps to `{ kind: "provider_error" }` (the raw
> reason is DROPPED, not carried forward); everything else maps to `{ kind:
> "disabled", disabledReason }`, defaulting to `"preview_mode_not_requested"`
> when the caller doesn't specify one — the Worker (which structurally knows
> the query flag was already checked before this function is ever reached)
> always passes `"env_flag_disabled"` explicitly. `renderPromotionPreviewDiagnostic
> (view)` renders three distinct panels: **disabled** → heading "Provider
> preview disabled" plus ONE OF THREE fixed, safe sentences keyed by
> `disabledReason` (never an echoed flag/env value); **provider_error** →
> heading "Provider preview unavailable" plus a SINGLE FIXED sentence ("the
> provider could not be reached or returned an error.") that NEVER echoes the
> provider's own error text, an endpoint, an API key, or a stack trace —
> `buildPromotionPreviewDiagnostic` drops `result.reason` entirely for this
> case, so there is nothing left to leak even if a future provider adapter
> starts stuffing richer detail into that field; **provider_preview** →
> unchanged `renderProviderPromotionDecisionPreview`, now headed "Provider
> preview" (dropped "only") with the disclaimer split into "Not a served
> advertisement." and "No click/impression tracking, ranking, auction, or
> billing occurs here." (both phrases required verbatim). Candidate rendering
> (`renderProviderPromotionCandidatePreview`) gains a metadata BOUND: at most
> 10 metadata entries, each value truncated to 200 chars — a real/injected
> provider is an external boundary and could otherwise return unbounded data;
> title/description/sponsor/metadata stay escaped and `destination`/`image`
> stay unrendered, unchanged from Stage 52. **The Stage 52 dual-flag gate,
> the Worker's routing (product/space only, never board/chat), and the
> pre-existing `?promotionPreview=1` mock-only path are all UNCHANGED** — this
> stage only changes what gets DISPLAYED for the disabled/error states, never
> when the real provider is called. 20 new tests in `test/
> promotion_provider_preview_diagnostics.test.ts` cover: each of the three
> disabled reasons renders its own fixed copy plus a `data-disabled-reason`
> attribute, the provider-invoked and provider_error labels render correctly,
> a provider_error never leaks a stack trace/endpoint/API key (tested both at
> the pure-render level with a poisoned `reason` string AND end-to-end through
> the Worker with a provider that throws a message containing a fake secret
> endpoint/key), candidate destination/image stay unrendered, candidate
> fields are escaped and metadata is bounded (both entry count and per-value
> length), the mock preview path is untouched by any of this, the dual flag
> is still required in all three combinations (query-only/env-only/both), the
> viewer/actor pubkey never renders, and no input mutation. Prior status:
>
> **Stage 52 — promotion provider preview behind a dual flag.**
> Stage 49's `invokePromotionProviderPreview` is now connected to the Worker's
> product/space routes, but ONLY behind TWO independent flags that must BOTH
> be true: an env flag (`ENABLE_PROMOTION_PROVIDER_PREVIEW`, reflected into
> the new `AppRuntime.promotionProviderPreviewAllowed`) AND a per-request query
> flag (`?edgeRecPreview=1`/`=true` or `?providerPromotionPreview=1`/`=true`,
> via the new `isProviderPromotionPreviewEnabled(url)`). Either flag alone
> calls the provider ZERO times. The new `renderProviderPromotionPreview`
> helper in `worker.ts` is the ONLY call site for
> `invokePromotionProviderPreview`: without the env flag it renders a
> `disabled` explanation (no candidates, no provider contact); with both flags
> it calls `invokePromotionProviderPreview(runtime.promotionProvider, request,
> { allowRealProvider: true, mode: "provider_preview" })` and renders the
> result via two NEW renderers in `src/render/promotion.ts` —
> `renderProviderPromotionCandidatePreview`/`renderProviderPromotionDecisionPreview`
> (worded "Provider preview only" / "Not a served advertisement" rather than
> "mock", since the underlying provider may be a real `EdgeRecPromotionProvider`)
> and `renderPromotionInvocationPreview` (dispatches on the invocation's
> `state`, so a `provider_error` renders a small escaped status note — never
> throws, never fakes a decision). **The pre-existing `?promotionPreview=1`
> mock-only path (Stage 41) is completely UNCHANGED** — it still only ever
> constructs `MockPromotionProvider` and is entirely independent of the new
> dual-flag path; both can coexist on the same page. `buildProductPlacement`/
> `buildSpacePlacement` are called with NO `viewerPubkey` option for the
> provider-preview request, exactly as the mock path already did — the actor
> is NEVER placed on the request. **Applies to the product/space routes
> ONLY** — the board (no `?space`) and chat routes never call the provider
> regardless of either flag. **This stage implements no real ad serving, no
> ranking/auction/CTR, no click/impression tracking, and no billing/Stripe/
> Telegram/HTMLRewriter** — the new renderers never emit a `destination` link
> or an image, and candidate title/description/sponsor/metadata are all
> HTML-escaped. 16 new tests in `test/promotion_provider_preview_ui.test.ts`
> cover: query-flag-only and env-flag-only both call the provider zero times,
> both flags together call it exactly once on the product route and exactly
> once on the space route, the board and chat routes never call it regardless
> of flags, `?promotionPreview=1` still drives the mock path only, a thrown
> provider renders `provider_error` (never throws out), no destination/image/
> click-tracking markup renders, candidate fields are escaped, the actor/
> viewer pubkey is never sent to the provider, the disabled explanation is
> escaped-safe, a fake "network" provider is invoked only under the explicit
> dual-flag combination, and no request mutation. Five pre-existing tests
> (across `test/worker.test.ts`, `test/render_promotion_preview.test.ts`,
> and `test/promotion_invocation.test.ts`) that asserted zero
> `EdgeRecPromotionProvider` mention anywhere in the Worker source are updated
> to check for no *construction* (`new EdgeRecPromotionProvider(`) instead —
> the class name now legitimately appears in a doc comment, and
> `invokePromotionProviderPreview(` is confirmed to appear from exactly one
> (gated) call site. Prior status:
>
> **Stage 51 — Runtime status page categorization (still read-only).**
> `src/render/runtime_status.ts` groups the Stage 50 status page's ten
> components into five FIXED display categories:
> **cache** (`eventCache`, `assetCache`), **storage** (`spaceDirectory`,
> `metadataIndex`), **provider** (`promotionProvider`, `recommendationProvider`,
> `paymentProvider`), **bridge** (`relayPublisher`, `notificationBridge`), and
> **security** (`signatureVerifier`). A new `RuntimeComponentCategory` type
> names these five, and `RuntimeComponentStatus` gains a `category` field
> alongside its existing `name`/`label`. `RuntimeStatusView` gains `.sections:
> readonly RuntimeComponentSection[]` — the same components grouped by
> category, in the fixed cache→storage→provider→bridge→security order — while
> its original **`.components` flat list is UNCHANGED**, kept for backward
> compatibility. `buildRuntimeStatusView(runtime)` still only reads
> `runtime.mode` and each component's `constructor.name`; it calls NO
> provider/cache/bridge method. A new `renderRuntimeStatusSection(section)`
> renders one category's heading (`"Cache"`, `"Storage"`, `"Provider"`,
> `"Bridge"`, `"Security"`) plus its component rows via the EXISTING
> `renderRuntimeComponentStatus` (now also rendering an escaped
> `data-category` attribute); `renderRuntimeStatusPage(view)` now renders
> `view.sections` instead of the flat list. **This stage changes NOTHING about
> what is read or called** — still zero `getPromotions`/`getRecommendations`/
> `requestPayment`/`notify`/`publish`/`assetCache.get,put,has,delete,clear`/
> event-cache/directory/index calls, still no `fetch`, and still no endpoint
> URL, API key, env value, secret, or viewer/actor pubkey ever rendered (none
> of that is read from `RuntimeEnv` — only the constructed `AppRuntime`'s
> component shapes). **The Worker route is UNCHANGED** — `?runtimeStatus=1`/
> `=true` behaves exactly as Stage 50 left it; only the rendered HTML gained
> category groupings. 11 tests in `test/render_runtime_status.test.ts` were
> rewritten/extended (21 total, up from 10) to cover: sections in the fixed
> category order, each category contains exactly its assigned components,
> every component carries the right category, section/page headings render
> for all five categories, category/name/label are all HTML-escaped
> (including a malicious category value), no endpoint/API-key/secret ever
> renders, and — using explicit method-counting spies on `assetCache` and
> `paymentProvider` (not a `Proxy`, which would have falsely flagged the
> harmless `constructor` property read as a "call") — building AND rendering
> the view never invokes a single provider/cache method. `test/
> worker_runtime_status.test.ts` gained a test confirming the rendered page
> shows all five category headings; its other 10 tests (unwired methods,
> unchanged board route, no secrets) continue to pass unmodified. Prior status:
>
> **Stage 50 — Runtime provider health/status page (read-only).**
> A new `src/render/runtime_status.ts` lets `?runtimeStatus=1` (or `=true`)
> show WHICH implementation `createRuntime(env)` selected for each of the ten
> `AppRuntime` boundaries (`eventCache`, `assetCache`, `spaceDirectory`,
> `metadataIndex`, `signatureVerifier`, `promotionProvider`,
> `recommendationProvider`, `relayPublisher`, `notificationBridge`,
> `paymentProvider`) — a COARSE TYPE LABEL only (e.g. `"InMemoryEventCache"`,
> `"EdgeRecPromotionProvider"`, `"PlaceholderPaymentProvider"`).
> `buildRuntimeStatusView(runtime)` reads only `runtime.mode` and each
> component's `constructor.name` (a property read, never a method call); a
> plain-object implementation that isn't a class instance (today, only
> `signatureVerifier` — `NobleSignatureVerifier` is an object literal) reports
> the safe fallback `"(unnamed implementation)"` rather than the meaningless
> `"Object"`. `renderRuntimeComponentStatus(component)` renders one escaped
> name/label row; `renderRuntimeStatusPage(view)` renders the whole page.
> **This is read-only in the strictest sense**: it calls NO provider/cache/
> bridge method at all — no `getPromotions`, `getRecommendations`,
> `requestPayment`, `notify`, `publish`, `assetCache.get/put/has/delete/clear`,
> or `eventCache`/directory/index lookup — and issues no `fetch`. It also
> never reads or renders an endpoint URL, API key, env value, secret, or
> viewer/actor pubkey (`buildRuntimeStatusView` never touches `RuntimeEnv` —
> only the already-constructed `AppRuntime`'s component shapes). The new
> `isRuntimeStatusEnabled(url)` flag takes precedence over every other route
> (board/product/space/chat) in `handleRequest`, which gained an optional
> `runtime?: AppRuntime` parameter (appended last, so existing positional call
> sites are unaffected) — the page renders ONLY when both the flag AND a full
> `runtime` are present; the flag alone (no runtime, as in most existing test
> call sites) falls through to normal routing unchanged. The Worker's default
> `fetch` now passes its constructed `runtime` through as that last argument.
> 10 new tests in `test/render_runtime_status.test.ts` and 10 new tests in
> `test/worker_runtime_status.test.ts` cover: the view lists all ten
> components in a fixed order, each label is a real `constructor.name` (or the
> safe fallback), env-selected providers are reflected (e.g.
> `PlaceholderPaymentProvider`), HTML-escaping of a malicious label, no
> endpoint/API-key/secret/URL ever renders, no input mutation, the status page
> route calls zero provider/cache/bridge methods (verified with spies on
> `getPromotions`/`getRecommendations`/`requestPayment`/`notify`/`publish`/
> `assetCache.get`), no `fetch(` to an external host, the existing default
> board route is unaffected, the flag alone (no runtime) falls through
> safely, and the default Worker export serves the page end-to-end. Prior status:
>
> **Stage 49 — EdgeRec real provider invocation boundary, disabled by
> default.**
> A new `src/promotion/invocation.ts` adds the missing middle step between
> Stage 38's env SELECTION of an `EdgeRecPromotionProvider` and Stage 41's
> mock-only preview renderer: a single narrow seam,
> `invokePromotionProviderPreview(provider, request, options)`, through which
> an already-selected `PromotionProvider` (real EdgeRec or otherwise) may
> ACTUALLY be invoked for a preview. `options` requires an explicit
> `allowRealProvider: boolean` (no default enables it — omitting it behaves as
> `false`) and a `mode: PromotionInvocationMode` (`"disabled"` |
> `"mock_preview"` | `"provider_preview"`), plus optional `now?`/`onError?`.
> `provider.getPromotions(request)` is called ONLY when `allowRealProvider ===
> true` AND `mode === "provider_preview"` — every other combination
> (`allowRealProvider: false`, or `mode: "disabled"`, or `mode:
> "mock_preview"`) returns a `PromotionInvocationDecision` with `state:
> "disabled"`/`"mock_preview"` and the provider is never touched. A thrown/
> rejected provider call is caught and reported as `state: "provider_error"`
> (never re-thrown); `onError`, if supplied, gets a diagnostic message. A
> successful call returns `state: "provider_preview"` plus the provider's raw
> `PromotionDecision` under `.decision` — a rendering INPUT only, to be shown
> through the EXISTING Stage 41 `renderPromotionDecisionPreview` (which never
> renders a `destination` link or an image). **This stage implements no ad
> serving, ranking, auction, CTR/A-B testing, click tracking, impression
> tracking, or billing, and calls no Stripe/Telegram/HTMLRewriter.** The module
> issues no `fetch` of its own — any network I/O happens only inside whatever
> `provider` the caller injects, and only when this function decides to call
> it. **The Stage 41 mock preview path (`renderMockPromotionPreview` driving
> `MockPromotionProvider` directly) is completely unchanged** — `mode:
> "mock_preview"` is a label only in this new function; it does not invoke the
> provider itself. **Deliberately NOT wired into the runtime or the Worker in
> this stage** — per the safety-first plan, Stage 49 ships the boundary and
> its tests only, so there is no `?edgeRecPreview=1` query flag and no
> `ENABLE_EDGE_REC_PROVIDER_PREVIEW` env field yet; wiring is left for a future
> stage once the boundary has proven itself in isolation. 14 new tests in
> `test/promotion_invocation.test.ts` cover: `allowRealProvider=false` and
> `mode="disabled"`/`"mock_preview"` never call the provider,
> `provider_preview`+`allowRealProvider=true` calls it exactly once, a thrown
> provider yields `provider_error` (never throws), selected candidates pass
> through on success, the existing preview renderer surfaces no destination/
> image for an EdgeRec-shaped candidate, no input mutation, no click/
> impression/billing/auction/rank field on the result, a fake "network"
> provider is invoked only under the explicit allow+mode combination and never
> otherwise, the Stage 41 mock path is unaffected, and both the Worker and
> Runtime sources contain zero reference to `invokePromotionProviderPreview`
> (proving the non-wiring). Prior status:
>
> **Stage 48 — product grant preview boundary.**
> A new `src/render/grant_preview.ts` shows what a `PurchaseGrant`
> (`src/commerce/types.ts`) WOULD look like if one were ever issued from an
> `accepted_placeholder` `PaymentDecision` — WITHOUT ever calling
> `paymentDecisionToGrant` and WITHOUT issuing a real `PurchaseGrant`.
> `buildGrantPreview(product, decision, actorPubkey?, now?)` returns a
> `GrantPreviewView | null`: `null` for every non-`accepted_placeholder` status
> (`pending`/`rejected`/`unavailable`/`error`); otherwise a view whose
> `source` is ALWAYS the literal `"preview_only"` and whose `access` is ALWAYS
> the literal `"not_granted"` — values a real `PurchaseGrantSource` never
> takes, so the view can never be confused with an actual grant at the type
> level. `renderGrantPreview(view)` renders the product, the fixed
> `preview_only`/`not_granted` fields, an escaped buyer-candidate line when an
> actor is present, and a fixed reason: **"Preview only — no PurchaseGrant has
> been issued and no access has been granted."** `renderGrantPreviewUnavailable
> (reason)` is a small escaped-reason panel for standalone/future use (the
> Worker does not currently call it — see below). The Worker's product route
> now shares ONE `PaymentDecision` between the purchase preview AND the grant
> preview (`resolveProductPaymentDecision`, replacing the old
> `renderProductPurchasePreview` helper) and appends the grant preview right
> after the purchase preview: it shows **regardless of `?paymentPreview=1`** —
> purely gated on the shared decision being `accepted_placeholder` — because a
> `NoopPaymentProvider` selected via Stage 46 env config yields `unavailable`
> either way, while the default local `PlaceholderPaymentProvider` (or an
> explicitly-selected `PlaceholderPaymentProvider`) yields `accepted_placeholder`
> and shows one. A non-eligible product (draft/archived/invalid price) never
> reaches `accepted_placeholder`, so it never shows a grant preview at all —
> board/space/chat routes don't call the payment boundary either, so they show
> none. **This stage issues no `PurchaseGrant`, calls no
> `paymentDecisionToGrant`, and claims no payment/settlement/purchase/grant
> outcome** — every product/decision/actor-derived string stays HTML-escaped,
> and the only "granted" wording anywhere is the explicitly negated
> `not_granted` field value and the "no access has been granted" disclaimer.
> 12 new tests in `test/render_grant_preview.test.ts` cover: a view is built
> only for `accepted_placeholder`, `null` for pending/rejected/unavailable/
> error, `source`/`access` are always the fixed literals, HTML escaping of
> title/reason/actor, no paid/settled/purchased/"grant issued"/"access
> granted"/"download unlocked" wording (only the negated preview phrasing), and
> no input mutation. 7 new tests in `test/payment_preview_runtime.test.ts`
> cover: an active product shows the grant preview (flag not required), a
> draft product shows none, `NoopPaymentProvider` under `?paymentPreview=1`
> shows none, `PlaceholderPaymentProvider` under the flag shows one, no
> `paymentDecisionToGrant` call, no grant-issuance wording, and board/space/
> chat routes never show one. Prior status:
>
> **Stage 47 — product purchase preview uses the runtime payment
> provider in preview-only mode.**
> The Stage 45 `?product=<id>` purchase preview can now be connected to
> Stage 46's env-selected `runtime.paymentProvider` — but ONLY under an
> explicit opt-in flag, and ONLY on the product route. A new
> `isPaymentPreviewEnabled(url)` recognizes `?paymentPreview=1` or
> `?paymentPreview=true`. `renderBoard` computes this flag and threads it (plus
> the `paymentProvider` passed down from `handleRequest`/the Worker's default
> `fetch`) into `renderProductRoute`, which passes them to
> `renderProductPurchasePreview(product, actor, runtimeProvider?)`: WITHOUT the
> flag, `runtimeProvider` is `undefined` and the function falls back to its own
> freshly-constructed `PlaceholderPaymentProvider`, EXACTLY as Stage 45 left
> it; WITH the flag, it calls `runtime.paymentProvider.requestPayment(request)`
> instead — which may be `NoopPaymentProvider` (renders the `unavailable`
> panel) or `PlaceholderPaymentProvider` (renders the `accepted_placeholder`
> panel) depending on `PAYMENT_PROVIDER`/`ENABLE_PAYMENT_PLACEHOLDER` env
> config. `handleRequest` and `renderBoard` both gained a `paymentProvider?`
> parameter (appended at the end, so existing positional call sites are
> unaffected); `export default { fetch }` now passes `runtime.paymentProvider`
> through. **`?paymentPreview=1` has NO effect on the board/space/chat
> routes** — those never call `paymentProvider` at all, flag or not. As
> before, `?actor=` is used only as a display "buyer candidate", never for
> payment or grant issuance, and `paymentDecisionToGrant` is still never called
> from the Worker — no `PurchaseGrant` is issued by this stage. **This stage
> implements no real payment, no invoice, no checkout URL, no settlement, and
> no grant issuance** — every rendered string stays HTML-escaped and the copy
> never claims "paid"/"settled"/"purchased"/"grant issued". 12 new tests in
> `test/payment_preview_runtime.test.ts` cover: the flag calls
> `runtime.paymentProvider.requestPayment` exactly once on the product route,
> no flag means zero calls (preview still renders via the local fallback), the
> flag has no effect on the board/space/chat routes, a `NoopPaymentProvider`
> renders the unavailable panel and a `PlaceholderPaymentProvider` renders the
> accepted-placeholder panel under the flag, no `paymentDecisionToGrant` call,
> no invoice/checkout-URL/QR/card/paid/settled/purchased/grant-issued text, a
> malicious `?actor` is escaped, no `fetch(` to an external host and no
> Stripe/Lightning/Breez/Greenlight/LNURL reference, and no request mutation.
> Prior status:
>
> **Stage 46 — payment provider runtime env selection boundary.**
> `createRuntime(env)` can now SELECT a `PaymentProvider` from three new
> `RuntimeEnv` fields — and NOTHING more, mirroring Stage 42's notification env
> selection exactly. **`PAYMENT_PROVIDER`** (`"noop"` or `"placeholder"`),
> **`ENABLE_PAYMENT_PLACEHOLDER`** (truthy string/boolean opt-in), and
> **`PAYMENT_DEFAULT_RAIL`** (one of the six `*_placeholder` rail names; any
> other value is silently ignored) let `selectPaymentProvider(env?, overrides?)`
> choose between `NoopPaymentProvider` (the safe default — every
> `requestPayment()` resolves `unavailable`/rejected) and
> `PlaceholderPaymentProvider` (dev/test — evaluates the request policy but
> **charges nothing**). Priority: (1) `overrides.paymentProvider` wins
> unconditionally; (2) `PAYMENT_PROVIDER=noop` → `NoopPaymentProvider`; (3)
> `PAYMENT_PROVIDER=placeholder` OR `ENABLE_PAYMENT_PLACEHOLDER` truthy →
> `PlaceholderPaymentProvider`; (4) absent/unrecognized →
> `NoopPaymentProvider`. `resolvePaymentDefaultRail` validates the rail name
> against `PAYMENT_RAILS` and returns `undefined` for any unrecognized value —
> no provider constructor takes it in this stage, so an invalid rail is simply
> ignored. `AppRuntime` gains a `paymentProvider` field; `RuntimeOverrides`
> gains `paymentProvider?`. The Worker `Env` interface is extended with the
> three payment fields so wrangler.toml can supply them — but the Worker
> **never calls `runtime.paymentProvider.requestPayment()`** and issues no
> payment request from this selection. **This is provider SELECTION only.**
> Constructing the runtime issues **no `fetch`**, calls **no
> Lightning/Stripe/Apple Pay/Google Pay rail**, and **never auto-calls
> `requestPayment()`** — `paymentProvider` is merely placed in the runtime,
> ready for a future caller to use it explicitly. `paymentDecisionToGrant` is
> never called from the runtime or the Worker, so **no `PurchaseGrant` is ever
> issued** by this stage. The Stage 45 product purchase preview is UNCHANGED:
> the Worker's `renderProductPurchasePreview` still constructs its own
> **fresh** `PlaceholderPaymentProvider` directly (not `runtime.paymentProvider`)
> for the `?product=<id>` display-only preview — the two paths are
> intentionally independent so the preview's behavior does not shift with env
> config. The Stage 44 `canRequestPaymentForProduct`/`productToPaymentRequest`
> guardrails remain in force: no secret/card/wallet/token in any payment
> request, no invoice, no checkout URL, no settlement. 14 new tests in
> `test/runtime_payment_env.test.ts` cover: no-env → Noop, each provider value,
> each truthy/falsy flag variant, invalid provider ignored, invalid/valid
> default rail, override wins, no `requestPayment()` auto-call, no `fetch`
> issued, Worker source has at most the one legitimate (Stage 45 preview)
> `.requestPayment(` call and never calls it via `runtime.paymentProvider`, no
> `paymentDecisionToGrant` call, no Lightning/Stripe/Breez/Greenlight import in
> the runtime sources, and env not mutated. The Stage 44
> `payment_boundary.test.ts` test #13 is updated: it now confirms
> `requestPayment()`/`paymentDecisionToGrant`/`productToPaymentRequest` are
> never auto-called from the runtime source (rather than asserting the runtime
> is entirely payment-free, which is no longer the case). Prior status:
>
> **Stage 45 — product purchase preview UI, placeholder only.**
> A new `src/render/payment.ts` renders a "Purchase preview" panel on the
> `?product=<id>` route using the Stage 44 payment boundary — display only,
> nothing is charged. `renderPurchasePreview(product, decision, options?)` is
> the main entry: given a `PaymentDecision`, an `accepted_placeholder`
> (`allowed`) result renders a heading, the display price/currency, the
> placeholder rail name, a `renderPaymentDecision(decision)` status line, a
> **"No payment is processed."** note, and a **DISABLED** `<button disabled>
> Checkout disabled</button>` — never an enabled one. Any other decision
> (`pending`/`rejected`/`unavailable`/`error`, or a draft/archived product, or
> an invalid price) falls back to `renderPurchaseUnavailable(reason)`, a small
> panel with just an escaped reason and no button at all.
> `renderPaymentDecision(decision)` is the standalone escaped status/rail/
> reason readout, reusable on its own. The Worker wires this into
> `renderProductRoute` ONLY: a new `renderProductPurchasePreview(product,
> actor)` helper calls `canRequestPaymentForProduct` (draft/archived/invalid
> price → straight to `renderPurchaseUnavailable`), then
> `productToPaymentRequest(product, actor || undefined)` (the `?actor=` value
> is used ONLY as a display "buyer candidate" — never for payment or grant
> issuance), then constructs a **fresh** `PlaceholderPaymentProvider` (never
> added to `createRuntime`/`Env` — the runtime stays exactly as unwired for
> payment as Stage 44 left it) and calls `requestPayment` for a decision to
> render. **`paymentDecisionToGrant` is never called from the Worker — no
> `PurchaseGrant` is ever issued by this preview.** The panel is appended ONLY
> on the product route, right after the existing product page and promotion
> placeholder; the board/space/chat routes and the default directory render
> nothing new. **This stage implements no Lightning, no Stripe, no Apple
> Pay/Google Pay, no invoice, no checkout URL/session, no QR code, no card
> form, and no settlement confirmation** — every product/decision-derived
> string (id, title, currency, rail, reason, and the buyer-candidate pubkey)
> is HTML-escaped, and the copy never claims "paid", "settled", "purchased",
> or "grant issued". Two pre-existing Stage 25/35 Worker tests
> (`test/worker.test.ts`, product-route tests #7 and asset-cache test #5) are
> updated: they used to assert NO `<button>`/`"checkout"` text at all, and now
> assert the button is present but **disabled**, with no invoice/signed-URL/
> Stripe/Lightning text — the earlier "no buy affordance at all" invariant is
> superseded by "a checkout affordance exists but is inert." The Stage 44
> `test/payment_boundary.test.ts` Worker-source test #14 is likewise updated:
> it no longer asserts the Worker has zero payment import (it legitimately
> constructs `PlaceholderPaymentProvider` now) but still asserts
> `paymentDecisionToGrant(` is never called and `NoopPaymentProvider` is never
> referenced. 10 new tests in `test/render_payment.test.ts` and 7 new tests in
> `test/worker.test.ts` cover: an active product renders the preview,
> price/currency/id/reason escaping, the disabled button markup, no invoice/
> checkout-URL/QR/card-form/grant-issued/paid-settled-purchased text anywhere,
> draft/archived products render the unavailable panel with no button, no
> input mutation, `?product=<draft>` (viewed as its creator) shows no enabled
> checkout, a malicious `?actor` is escaped, no `fetch(` to an external host
> and no Stripe/Lightning/Breez/Greenlight/LNURL reference in the Worker
> source, and the default board page renders no purchase preview at all. Prior status:
>
> **Stage 44 — Payment / Lightning boundary skeleton.**
> A new `src/payment/` treats a future payment step as the front door BEFORE a
> `PurchaseGrant` (`src/commerce/types.ts`) is ever issued — types and safe
> defaults ONLY. `src/payment/types.ts` defines `PaymentRail`
> (`lightning_placeholder`/`stripe_placeholder`/`apple_pay_placeholder`/
> `google_pay_placeholder`/`manual_placeholder`/`external_placeholder`),
> `PaymentStatus` (`unavailable`/`pending`/`accepted_placeholder`/`rejected`/
> `error`), `PaymentCapability`, `PaymentRequest` (productId, optional
> buyerPubkey, amountCents/currency display metadata, rail, optional
> metadata/createdAt), `PaymentDecision`, and the `PaymentProvider` seam
> (`getStatus`/`getCapabilities`/`requestPayment`). `src/payment/noop_payment.ts`
> ships `NoopPaymentProvider` (permanently `unavailable`/`rejected` — every
> `requestPayment` call is refused) and `PlaceholderPaymentProvider` (rejects a
> negative amount or metadata that looks like a card/wallet/secret, otherwise
> resolves `accepted_placeholder` — a policy-clean placeholder, NEVER a paid
> confirmation) plus the pure `sanitizePaymentMetadata` helper. `src/payment/
> commerce_bridge.ts` adds three pure functions: `canRequestPaymentForProduct
> (product)` (an `active` product with a non-negative price is `pending`-
> eligible; a draft/archived product or a negative price is `rejected`),
> `productToPaymentRequest(product, buyerPubkey?, options?)` (returns `null`
> when the eligibility check fails; otherwise a `PaymentRequest` built from the
> product's display price/currency/id with any card/wallet/secret-looking
> metadata entry stripped), and `paymentDecisionToGrant(decision, options?)`
> (`PurchaseGrant | null` — returns a grant ONLY for an `accepted_placeholder`
> decision with a known `buyerPubkey`; every other status is `null`). A grant
> built here is always `source: "manual"` or `"promo"` — **never** `"payment"`,
> because this boundary never verifies that money moved. **This stage
> implements no Lightning (BOLT11/LNURL, Breez SDK, Greenlight), no Stripe, no
> Apple Pay, no Google Pay, no wallet, no invoice, no checkout session, and no
> settlement/webhook confirmation** — nothing here charges a card, opens a
> channel, mints an invoice, builds a checkout URL, or issues a `fetch`.
> `PaymentDecision` carries no invoice/checkout URL field at all, by design.
> It is **not wired into the runtime or the Worker** — `create_runtime.ts` and
> `worker.ts` import nothing from `src/payment/` and reference no
> `PaymentProvider`/`requestPayment`/`productToPaymentRequest`/
> `paymentDecisionToGrant`. 18 new tests in `test/payment_boundary.test.ts`
> cover: Noop always unavailable/rejected, Placeholder never produces an
> invoice or checkout URL, an active product is allowed while draft/archived/
> negative-price products are rejected, `paymentDecisionToGrant` returns `null`
> for `pending`/`rejected`/`unavailable`/`error` and a grant only for
> `accepted_placeholder`, the grant's source is never `"payment"`, sensitive
> metadata (card number, wallet secret) is stripped by the bridge and denied by
> the provider, no input mutation, Runtime/Worker source have zero payment
> import/wiring, no Lightning/Stripe/Apple Pay/Google Pay/Breez/Greenlight
> import, and no `fetch`/invoice/checkout builder anywhere in the payment
> sources. Note on liquidity/custody: this stage takes NO position on how a
> future real rail would hold or move funds (custodial vs. non-custodial
> Lightning, chargeback exposure, KYC/AML) — that remains future research, not
> settled by this skeleton. Prior status:
>
> **Stage 43 — IPFS asset adapter boundary skeleton.**
> A new `src/asset/ipfs_asset_cache.ts` treats IPFS as a candidate FUTURE
> backend for the public `AssetCache` boundary (alongside R2 and MeshKV) —
> types and safe defaults ONLY. `IpfsClient` (`get(cid)`, `put(bytes,
> metadata)`, optional `pin(cid)`/`unpin(cid)`) is the shape a real client
> would implement; `NoopIpfsClient` is the permanently-unavailable default —
> `get` always resolves `null`, and `put`/`pin`/`unpin` always reject rather
> than fabricate a CID. `IpfsAssetCache implements AssetCache` runs the same
> `canCacheAsset` policy as R2/MeshKV on `put` (private/paid/`dm`/`secret`/
> `key`/`payment`/`entitlement` are rejected) and then **stops** — it NEVER
> calls the injected client's `get`/`put`/`pin`/`unpin`; `get`/`has` always
> report a miss/false and `delete`/`clear` are safe no-ops. A "cacheable"
> result means only "this asset passed the public-asset policy," never that
> anything was sent to, stored on, or pinned by IPFS. `PlaceholderIpfsAssetCache`
> is the concrete always-safe default (an `IpfsAssetCache` wired to
> `NoopIpfsClient` with no way to swap clients). Two pure helpers round out the
> boundary: `isIpfsCidLike(value)` is a plausibility check for CIDv0/CIDv1
> shapes that never contacts a node/gateway and never resolves/dereferences
> anything, and `assetKeyToIpfsRef(key)` maps an opaque `AssetKey` to a CID
> only if the key string is already CID-shaped — it never fabricates or
> resolves one (today it always returns `null`, since `createAssetKey` never
> produces a CID). **A CID is public, non-secret metadata — but it is NOT an
> authorization token**: whoever has a CID can fetch that content from any
> node/gateway that pins it, a CID also leaks size/availability/pinning
> information, and unpinning is not a deletion guarantee (other nodes may keep
> serving it indefinitely). This stage implements **no IPFS node, no gateway
> `fetch`, no pinning service, and no upload/download** — the adapter issues
> no network I/O of any kind. It is **not wired into the runtime or the
> Worker** (unlike Stage 42's notification env selection, there are no new env
> fields at all — `create_runtime.ts` and `worker.ts` have zero IPFS
> references). 15 new tests in `test/ipfs_asset_cache.test.ts` cover:
> `NoopIpfsClient.get` always null, `put`/`pin`/`unpin` always reject as
> unavailable, cache `get` always a miss (even after `put`), `put` on a public
> asset never touches the injected client (a spy client proves zero calls),
> private/paid/sensitive-tag rejection, `has` always false, `delete`/`clear`
> safe no-ops that never touch the client, the CID plausibility helper accepts
> only CID-shaped strings, a CID-shaped value grants no access (not an
> authorization token), no input mutation, and Runtime/Worker source contain no
> `ipfs` reference at all and no fetch/http/real-IPFS-client import. Prior status:
>
> **Stage 42 — Notification provider env selection boundary.**
> `createRuntime(env)` can now SELECT a `NotificationBridge` from three new
> `RuntimeEnv` fields — and NOTHING more. **`NOTIFICATION_PROVIDER`** (`"noop"` or
> `"placeholder"`), **`ENABLE_NOTIFICATION_PLACEHOLDER`** (truthy string/boolean opt-in),
> and **`NOTIFICATION_DEFAULT_CHANNEL`** (one of the six `*_placeholder` channel
> names; any other value is silently ignored) let `selectNotificationBridge(env?,
> overrides?)` choose between `NoopNotificationBridge` (the safe default — every
> `notify()` returns `unavailable`) and `PlaceholderNotificationBridge` (dev/test —
> evaluates `canSendNotification` but **delivers nothing**). Priority: (1)
> `overrides.notificationBridge` wins unconditionally; (2) `NOTIFICATION_PROVIDER=noop`
> → `NoopNotificationBridge`; (3) `NOTIFICATION_PROVIDER=placeholder` OR
> `ENABLE_NOTIFICATION_PLACEHOLDER` truthy → `PlaceholderNotificationBridge`; (4)
> absent / unrecognized → `NoopNotificationBridge`. `resolveNotificationDefaultChannel`
> validates the channel name against `NOTIFICATION_CHANNELS` and returns `undefined`
> for any unrecognized value — invalid channels are ignored without error.
> `AppRuntime` gains a `notificationBridge` field; `RuntimeOverrides` gains
> `notificationBridge?`. The Worker `Env` interface is extended with the three
> notification fields so wrangler.toml can supply them — but the Worker **never
> calls `notify()`** and routes no notification. **This is bridge SELECTION only.**
> Constructing the runtime issues **no `fetch`**, calls **no Telegram/LINE Bot API,
> no APNs, no FCM, no email service**, and **never auto-calls `notify()`** —
> `notificationBridge` is merely placed in the runtime, ready for a future caller
> to use it explicitly. The Stage 39 `sanitizeNotificationPayload` /
> `canSendNotification` guardrails remain in force: no secret / DM body / key /
> seed / payment / entitlement / credential in any notification payload. 12 new
> tests in `test/runtime_notification_env.test.ts` cover: no-env → Noop, each
> provider value, each truthy/falsy flag variant, invalid channel ignored,
> override wins, no `notify()` auto-call, no `fetch` issued, Worker source has no
> `.notify(` call, no Telegram/LINE/APNs/FCM/Email import, and env not mutated.
> The Stage 39 `notification_boundary.test.ts` tests 12/13 are updated: they now
> confirm that `notify()` is not auto-called and no real transport is imported
> (rather than checking the runtime is entirely notification-free, which is no
> longer the case). Prior status:
>
> **Stage 41 — Mock promotion preview mode.** The promotion boundary can
> now render actual candidate cards in the UI — but ONLY from the in-memory
> `MockPromotionProvider`, and ONLY under an explicit opt-in flag. Three pure
> renderers land in `src/render/promotion.ts`: `renderPromotionCandidatePreview`
> (one candidate card — escaped title/sponsor/description/metadata and a shortened
> id, with **NO `destination` link and NO image**), `renderPromotionDecisionPreview`
> (a whole `PromotionDecision`, with a safe empty state), and
> `renderMockPromotionPreview(request, provider = new MockPromotionProvider())`,
> which drives the **mock provider only** and never constructs or calls the real /
> EdgeRec provider. The Worker gates this behind `isPromotionPreviewEnabled(url)`
> (`?promotionPreview=1` or `=true`) **and** sample mode (`data.showPromotions`), so
> `?space=<id>&promotionPreview=1` and `?product=<id>&promotionPreview=1` append a
> mock preview block while the no-param board, the flag-less pages, and the live
> relay path render none. The Worker itself constructs no provider and contains no
> `getPromotions` / `EdgeRecPromotionProvider` / `edge_rec_adapter` reference — the
> mock invocation lives in the render helper. **This is a UI ↔ boundary connection
> check, not ad serving.** It issues **no `fetch`**, calls **no real/EdgeRec
> provider**, and does **no click tracking, no impression tracking, no ranking, no
> auction, no CTR, no billing, no destination link, and no image** — every candidate
> is disclosed as a mock preview and all candidate-derived text is HTML-escaped. The
> Stage 38 EdgeRec env selection still stands but is deliberately unused here. Prior
> status:
>
> **Stage 40 — Deniable Storage research boundary (docs only).** A new
> research note, [`docs/deniable_storage_research.md`](docs/deniable_storage_research.md),
> writes up the Shadow Vault / Deniable Storage / Hidden Volume threat model and its
> hard prohibitions **without adding any code** — no crypto, no vault, no hidden
> volume, no storage adapter, no IPFS. It fixes, in writing: this is a research
> boundary not a spec; the `finger_id = 5`-style branch-selected shadow vault is a
> **forbidden anti-pattern**; TrueCrypt/VeraCrypt are *reference only*; the hidden-
> volume leak vectors (fixed-size container, padding, metadata, timestamp, access
> pattern, backup, cloud sync, mobile-OS lifecycle); that AEAD/KDF/zeroize/memory-
> lock belong to the future Rust Crypto Core; IPFS dangers (CID size/tree leak,
> pinning/deletion impossibility, gateway traffic analysis, encrypted-payload
> metadata leak); the Nostr relationship (events are public metadata, a deletion
> request is not a deletion guarantee, relay IP-logging risk); **forbidden UI
> wording** ("completely hidden", "zero-trace", "absolutely safe", "legally safe");
> the preconditions for any future work (Rust core, audited primitives, fixed-size
> container, nonce discipline, no direct Apple ID seed derivation, local-only
> unlock, no cloud backup by default); and the conclusion — **no implementation, no
> production guarantee, docs only, future separate package only.** No `src/` code, no
> runtime/Worker wiring, and no Stage 1–39 boundary is touched. Prior status:
>
> **Stage 39 — Notification Bridge boundary skeleton.** A MINIMAL,
> future-facing seam for signalling "something happened" to an external channel
> (Telegram / LINE / APNs / FCM / Email) now lives in `src/notification/`, kept
> entirely OUT of the current Nostr/Cloudflare core, the chat layer, and the
> commerce layer. It fixes the shape of a notification as COARSE, non-sensitive
> metadata so a real transport can drop in later — WITHOUT ever carrying a secret.
> The `NotificationBridge` interface (`getStatus`/`getCapabilities`/`notify`) plus
> the `NotificationChannel` / `NotificationCapability` (six `*_placeholder` labels:
> `telegram`/`line`/`apns`/`fcm`/`email`/`local`), `NotificationKind`
> (`chat_activity`/`space_activity`/`product_update`/`moderation_notice`/
> `payment_status_placeholder`/`system_notice`), `NotificationPayload`, and
> `NotificationDecision` types define shapes ONLY. **This is a boundary, not a
> notifier.** It **sends nothing, calls no Telegram/LINE Bot API, no APNs, no FCM,
> and no email service, and issues no `fetch`**. A `NotificationPayload` carries only
> `kind`, `channel`, a generic `title`, an optional GENERIC `bodyPreview` (e.g. "New
> chat activity"), opaque `targetRef`/`actorRef`, a `createdAt`, and non-secret
> `metadata` — **never DM/message content, a secret, key, seed, token, payment
> secret, entitlement, or credential**. `policy.ts` enforces this: `canSendNotification`
> DENIES a payload whose fields or metadata look sensitive, `sanitizeNotificationPayload`
> returns a cleaned copy (sensitive title → generic, sensitive preview/refs dropped,
> sensitive metadata filtered), and `isSensitiveNotificationField` flags secret
> markers (it deliberately does NOT flag a plain hex pubkey). `NoopNotificationBridge`
> is the safe default: permanently `unavailable`, it denies every attempt.
> `PlaceholderNotificationBridge` (dev/test) evaluates the policy and returns the
> decision (`accepted`/`rejected`) but still **delivers nothing** — `accepted` is a
> placeholder queue label. `bridge.ts`'s pure `chatEventToNotification` /
> `spaceEventToNotification` / `productEventToNotification` build payloads from
> domain objects that OMIT the message body, the event content, and any
> payment/download detail (type-only domain imports). **APNs/FCM `metadata` can leak
> to third parties** — the policy keeps it non-sensitive. **Nothing is auto-wired**:
> `createRuntime` and the Worker never reference the notification layer (tests assert
> both sources are notification-free, that the sources import no
> Telegram/LINE/APNs/FCM/Email transport, and that they issue no `fetch`/send call),
> so the whole Stage 1–38 core is untouched. Telegram/LINE/APNs/FCM/Email remain
> FUTURE bridges, not implemented. Prior status:
>
> **Stage 38 — EdgeRec Worker env selection boundary.** `createRuntime`
> can now SELECT the `PromotionProvider` / `RecommendationProvider` from EdgeRec
> config on the `RuntimeEnv` / Worker `Env` — and NOTHING more. New env fields
> (`RECOMMENDATION_API_KEY`, `PROMOTION_SEND_VIEWER_PUBKEY`,
> `PROMOTION_HASH_VIEWER_PUBKEY`, `EDGE_REC_TIMEOUT_MS`, alongside the existing
> `PROMOTION_ENDPOINT`/`RECOMMENDATION_ENDPOINT`/`PROMOTION_API_KEY`/`fetch`) let
> `selectPromotionProvider` / `selectRecommendationProvider` wire an
> `EdgeRecPromotionProvider` **only when an endpoint AND an injected `fetch` are
> both present**; an endpoint with no `fetch` (the Worker's default — it injects
> none) falls back to the inert `MockPromotionProvider` / `MockRecommendationProvider`.
> The recommendation path falls back to `PROMOTION_ENDPOINT`/`PROMOTION_API_KEY`
> when its own are absent; `EDGE_REC_TIMEOUT_MS` is parsed and **clamped**
> (`parseEdgeRecTimeoutMs`, 100–30000 ms; unparseable/non-positive ignored). **Privacy
> default: the viewer pubkey is NEVER sent** — only an explicit truthy
> `PROMOTION_SEND_VIEWER_PUBKEY` opts in to the RAW pubkey, and
> `PROMOTION_HASH_VIEWER_PUBKEY` is recognized as intent but **no hash function is
> wired**, so it sends nothing and the raw pubkey is never leaked as a fallback.
> **This is provider SELECTION only.** Constructing the runtime issues **no
> `fetch`**, calls **no `getPromotions`/`getRecommendations`**, and there is still
> **no real ad serving, no ranking/auction/CTR, no click tracking, no billing, no
> Stripe/Telegram, no HTMLRewriter, and no external fetch** — the EdgeRec provider is
> merely constructed READY to call out behind an injected client. The Worker still
> shows only empty promotion placeholders and issues no promotion request. `env` is
> never mutated. Prior status:
>
> **Stage 37 — Identity Provider boundary skeleton.** A MINIMAL,
> future-facing seam that fixes Apple / Google / External identity providers as
> OPAQUE AUTHENTICATION-REFERENCE providers — **not** key sources — now lives in
> `src/identity/`, kept entirely OUT of the current Nostr/Cloudflare core, the
> Passkey seam, the Vault seam, and the crypto core. Apple / Google / External feed
> the Passkey unlock boundary (Stage 36) and, through it, the Vault (Stage 33); they
> generate no key. The `IdentityProviderBoundary` interface
> (`getStatus`/`getCapabilities`/`begin`/`cancel`) plus the `IdentityProviderKind`
> (`apple`/`google`/`external`/`passkey`), `IdentityProviderStatus`
> (`idle`/`waiting`/`authenticated`/`cancelled`/`unavailable`/`error`),
> `IdentityProviderCapability` (four `*_placeholder` labels:
> `apple`/`google`/`external`/`passkey_bridge`), `IdentityProviderRequest` (a `kind`
> + an OPAQUE, non-secret `reference`), and `IdentityProviderReport` (status +
> echoed kind + the same opaque reference + reason) types define shapes ONLY.
> **This is a boundary, not authentication.** It **starts no sign-in, runs no OAuth,
> parses/stores no JWT, calls no WebAuthn/Apple/Google API, launches no Face ID or
> Touch ID, touches no Secure Enclave/Android Keystore, and generates or derives no
> key** — Apple / Google are **authentication references, never a key source**, and
> nothing turns a token/JWT/credential/email/profile/seed into key material. Request
> and report carry an **OPAQUE, non-secret `reference` only**. `NoopIdentityProvider`
> is the safe default: permanently `unavailable`, it advertises nothing and every
> attempt is denied. `PlaceholderIdentityProvider` (dev/test) models an
> `idle → (placeholder) authenticated ↔ cancelled` lifecycle holding ONLY a coarse
> `IdentityProviderReport` — its `authenticated` state is a LABEL that **unlocks
> nothing**. `provider_bridge.ts`'s pure `identityProviderToPasskeyRequest` and
> `identityProviderToVaultRequest` map the provider `kind` to a
> `PasskeyAuthenticationKind` / `VaultUnlockKind` and pass the opaque `reference`
> through unchanged (type-only Passkey + Vault dependencies; they derive no key,
> unlock nothing, and wire nothing). **Nothing is auto-wired**: `createRuntime` and
> the Worker never reference the provider layer (tests assert both sources are
> provider-free, that the sources import no OAuth/JWT/WebAuthn/crypto library, and
> that the Vault/Passkey imports are type-only), so the whole Stage 1–36 core is
> untouched. See [`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md) for
> the design notes this seam is drawn from. Prior status:
>
> **Stage 36 — Passkey Unlock boundary skeleton.** A MINIMAL,
> future-facing seam that fixes WebAuthn / Passkey / Face ID / Touch ID as an
> AUTHENTICATION boundary that UNLOCKS the Vault — **not** a key source — now lives
> in `src/identity/`, kept entirely OUT of the current Nostr/Cloudflare core, the
> Vault seam, and the crypto core. It encodes the intended UX seam (Face ID →
> Passkey → Vault unlock → identity available) WITHOUT building any of it. The
> `PasskeyBoundary` interface
> (`getStatus`/`getCapabilities`/`beginAuthentication`/`cancelAuthentication`) plus
> the `PasskeyStatus` (`idle`/`waiting`/`authenticated`/`cancelled`/`unavailable`/
> `error`), `PasskeyReport`, `PasskeyCapability` (four `*_placeholder` labels:
> `faceid`/`touchid`/`passkey`/`external_webauthn`), and the
> `PasskeyAuthenticationRequest` (a `kind` of `apple_passkey`/`android_passkey`/
> `webauthn`/`external` + an OPAQUE, non-secret `reference`) types define shapes
> ONLY. **This is a boundary, not authentication.** It **starts no authentication,
> calls no WebAuthn/Passkey/Apple/Google API, launches no Face ID or Touch ID,
> touches no Secure Enclave/Android Keystore, and generates or derives no key** —
> Passkey / Apple ID / Google are **unlock triggers ONLY, never a key source**, and
> nothing turns a credential/JWT/challenge/token/seed into key material. The request
> carries an **OPAQUE, non-secret `reference` only** — never a credential, JWT,
> secret, token, challenge response, private/public key, seed, passphrase, or bytes.
> `NoopPasskeyBoundary` is the safe default: permanently `unavailable`, it
> advertises nothing and every attempt is denied. `PlaceholderPasskeyBoundary`
> (dev/test) models an `idle → (placeholder) authenticated ↔ cancelled` lifecycle
> holding ONLY a coarse `PasskeyReport` — its `authenticated` state is a LABEL that
> **does NOT unlock the Vault**. `vault_bridge.ts`'s pure
> `passkeyAuthenticationToVaultRequest` maps the authenticator `kind` to a
> `VaultUnlockKind` and passes the opaque `reference` through unchanged (type-only
> Vault dependency; it derives no key and wires nothing). **Nothing is auto-wired**:
> `createRuntime` and the Worker never reference the identity layer (tests assert
> both sources are identity-free, that `src/identity` imports no crypto/WebAuthn/
> auth library, and that its Vault import is type-only), so the whole Stage 1–35
> core is untouched. A future real unlock flow — connected to the planned Rust core
> — is not implemented. See
> [`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md) for the design
> notes this seam is drawn from. Prior status:
>
> **Stage 35 — Product asset preview metadata from runtime.** The
> `?product=<id>` route can now source its PUBLIC/UNLISTED asset PREVIEW metadata
> from the runtime's `AssetCache`, not just the fixed sample list.
> `src/commerce/asset_preview.ts`'s `resolveProductAssetPreviews(product,
> assetMetadataList, assetCache?, now?)` walks `product.assetIds` in order,
> starting from the sample metadata and — only when an `assetCache` is supplied —
> trying `assetCache.get(id, now)`; a hit contributes **`cached.metadata` ONLY**
> (the bytes are discarded and never reach a `ProductAsset` or the HTML), while a
> cache **miss or thrown error is swallowed** and the sample metadata stands.
> `isPreviewAssetVisible`/`filterPreviewAssetMetadata` reuse the Stage 22
> `canCacheAsset` policy so `private`/`paid` assets and anything tagged sensitive
> (dm/secret/key/payment/entitlement) are excluded — from cache hits as well as
> samples. The Worker passes `runtime.assetCache` into `handleRequest` and threads
> it to the product route **only**: `renderProductRoute` awaits the resolver, and
> the board/directory path never touches the cache (a test asserts the no-param
> board issues zero `assetCache.get` calls). This is **read-only metadata, not
> delivery**: still **no asset bytes in the HTML, no signed URL, no download, no
> payment**, and no real R2/MeshKV file fetch — the helper reads only the injected
> cache's already-resolved metadata and mutates neither the product, the sample
> list, nor a cached asset. Prior status:
>
> **Stage 34 — Crypto Core boundary skeleton.** A MINIMAL, future-facing
> seam for the FedOS crypto core now lives in `src/crypto/`, kept entirely OUT of
> the current Nostr/Cloudflare core, the Vault seam, and the asset layer. It fixes
> the swap point for a future real crypto core (the provisional
> `packages/fedos-core-rust` / a RustCrypto-backed WASM/FFI module) WITHOUT
> committing to any implementation. `CryptoProvider`
> (`getStatus`/`getCapabilities`/`randomBytes`/`deriveKey`/`encrypt`/`decrypt`)
> plus the `CryptoState` (`available`/`unavailable`/`error`), `CryptoStatus`,
> `CryptoDecision`, `CryptoCapability` (five `*_placeholder` labels), and the
> `RandomBytesRequest`/`DeriveKeyRequest`/`EncryptRequest`/`DecryptRequest` types
> define shapes ONLY. **This is a boundary, not crypto.** It performs **no
> encryption, no key derivation, and no random generation** — no AEAD/XOR, no
> HKDF/Argon2, no BIP39/BIP32, no NIP-44, no zeroize, no key generation. Requests
> carry **OPAQUE, non-secret handles and labels only** — never raw key material,
> seeds, passphrases, or plaintext — and a `CryptoDecision` carries **no output
> bytes** (nothing runs, so nothing is produced). `NoopCryptoProvider` is the safe
> default: permanently `unavailable`, it advertises nothing and every operation
> resolves to a denied/unavailable decision, never throwing and never mutating its
> input. `vault_bridge.ts`'s pure `cryptoCapabilitiesToVaultCapabilities` maps the
> crypto placeholders to the Vault placeholders they would back (type-only Vault
> dependency; it wires nothing). **Nothing is auto-wired**: `createRuntime` and the
> Worker never construct or reference a crypto core (tests assert both sources are
> crypto-free, that `src/crypto` contains no XOR, and that it imports no AEAD/crypto
> library), so the whole Stage 1–33 core is untouched. See
> [`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md) for the design
> notes (AEAD mandatory, XOR forbidden, Rust core as a separate package) this seam
> is drawn from. Prior status:
>
> **Stage 33 — Vault boundary skeleton.** A MINIMAL, future-facing seam
> for the FedOS Vault / Crypto / Identity layer now lives in `src/vault/`, kept
> entirely OUT of the current Nostr/Cloudflare core. `VaultBoundary`
> (`getState`/`getCapabilities`/`unlock`/`lock`/`isUnlocked`) plus the
> `VaultState` (`locked`/`unlocked`/`unavailable`/`error`), `VaultStatus`,
> `VaultDecision`, `VaultCapability` (all `*_placeholder`), and `VaultUnlockRequest`
> types define shapes ONLY. **This is a boundary, not crypto.** It performs **no
> cryptography, no key generation, no key derivation, and no seed storage** — no
> AEAD/XOR, no BIP39/BIP32, no NIP-44. `NoopVaultBoundary` is the safe default:
> permanently `unavailable`, it never unlocks and advertises nothing.
> `InMemoryVaultBoundary` (dev/test) models a `locked ↔ (placeholder) unlocked`
> lifecycle by holding ONLY a coarse status — no secret/key/seed/token field
> exists. **Apple ID / Passkey are `unlock` factors ONLY, never a key-derivation
> source**: `unlock` reads only the request `kind` (a fixed enum), derives nothing
> from the opaque, non-secret `reference`, and never turns a JWT / Apple `sub` /
> user id / Passkey credential into key material; a successful `unlock` is a
> "placeholder unlocked" state change and nothing more. `unlock`/`lock` never
> throw — a malformed request lands in `error` (state + `decision.reason`) instead
> — and neither mutates its input. Deniable/shadow storage stays RESEARCH only (a
> placeholder capability name, no shipped feature and no safety claim). **Nothing
> is auto-wired**: `createRuntime` and the Worker never construct or reference a
> vault (tests assert both sources are vault-free), so the whole Stage 1–32 core
> is untouched. See [`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md)
> for the design notes this seam is drawn from. Prior status:
>
> **Stage 32 — MeshKV browser lifecycle boundary.** Bringing a MeshKV
> node online is now an explicit, separate step in `src/asset/meshkv_lifecycle.ts`,
> kept OUT of `createRuntime` and the Worker. `MeshKVLifecycle`
> (`MeshKVBrowserLifecycle` / `createMeshKVLifecycle(node, initOptions?)`) drives a
> node through `idle → prepared → online → offline` (or `error`): the
> **constructor does nothing**, `prepare()` only wires the node (`init`, no
> socket), `goOnline()` is the FIRST call that may open signaling / join the WebRTC
> peer mesh (`startSignaling`), and `goOffline()` tears it down (`stop`). Every
> step is idempotent (double-calls are safe) and a failed step lands in `error`
> with the cause recorded (`getLastError`) instead of throwing. **Nothing is
> auto-wired**: `createRuntime` and the Worker never call the lifecycle, so
> WebRTC / signaling / peer discovery begin only when a caller explicitly invokes
> `goOnline()`. This adds no cache, policy, or data path and no guarantees; MeshKV
> still carries PUBLIC/unlisted bytes only. Prior status:
>
> **Stage 31 — MeshKV runtime opt-in wiring.** `createRuntime` can now
> build a `MeshKVBrowserClient` (over the `packages/meshkv` boundary) and slot it
> into the asset cache, but **only behind an explicit opt-in**:
> `ENABLE_MESHKV_ASSET_CACHE` must be truthy AND a `MeshKVApi` supplied (via
> `MESHKV_API` or `overrides.meshKVApi`). `selectMeshKVClient(env, overrides?)`
> resolves the client — `overrides.meshKVClient` > the legacy
> `MESHKV_ASSET_CACHE` binding > the opt-in browser client — and
> `selectAssetCache` composes it (R2 + MeshKV → `CompositeAssetCache`; MeshKV only
> → `MeshKVAssetCache`; neither → in-memory). **Opting in only SELECTS the
> adapter — it starts NO MeshKV network**: constructing the client calls no
> `init`/`connect`/`startSignaling`, so no signaling socket, WebRTC link, or peer
> discovery begins; `createRuntime` runs no asset op and issues no `fetch`, and
> `env` is never mutated. The **Worker does not auto-wire it** (no
> `ENABLE_MESHKV_ASSET_CACHE` handling), so default behavior is unchanged. MeshKV
> still carries PUBLIC/unlisted bytes only — private/paid/secret/DM/payment/
> entitlement data is refused by `canCacheAsset` before it can reach the mesh, and
> there are no signed URLs, downloads, or payment. Real WebRTC/signaling will be a
> separate explicit lifecycle boundary in a later stage. Prior status:
>
> **Stage 30 — Product / Chat / Space unified directory page.** The
> default (no-param) board now arranges the read-only Space, Product, and Chat
> directories into ONE section via `src/render/directory.ts`'s
> `renderUnifiedDirectory` (reusing the existing per-type helpers and their
> `?space=`/`?product=`/`?chat=` routes; product/chat sections are sample-mode
> only). It is pure presentation: **no new data lookup, no network, no new route,
> and no change to the Product/Chat/Space types** — the Stage 29 MeshKV boundary,
> the runtime, and every other boundary are untouched. Prior status:
>
> **Stage 29 — MeshKV boundary wired to the imported implementation.** The
> real MeshKV browser project has been imported (an external, git-ignored checkout
> whose runtime is a namespace module exporting `init`/`get`/`put`/`load`/`remove`,
> backed by IndexedDB + WebRTC). `packages/meshkv` is now the typed boundary for
> that runtime: `MeshKVApi` mirrors the real exports, an `index.ts` entry point is
> the stable import surface, and a browser-free reference node (`MeshKV` /
> `createMeshKV`) lets the host typecheck/test against the contract without a
> browser. The `MeshKVBrowserClient` adapter was retargeted to the **real** API —
> `put(key, bytes, contentType)`, `remove` for delete, `has` derived from `get`,
> and no bulk `clear` (the real MeshKV exposes none) — and still clones bytes
> across the boundary. **Constructing the adapter or a node starts no network** —
> no signaling socket, no WebRTC, no peer discovery; going online is an explicit
> step (`startSignaling()` here / `signal.connect()` in the browser runtime) the
> adapter never calls. **The runtime, `selectAssetCache`, the `AssetCache`
> interface, `MeshKVAssetCache`, the Worker, promotion, and the product/chat routes
> are all unchanged.** MeshKV carries PUBLIC bytes only; private/paid/secret content
> is refused by `canCacheAsset` before it reaches the package. Base below unchanged.
>
> Ingest, thread building, query
> policy, an HTML view, a NIP-01 read-only WebSocket adapter, an `EventCache`
> boundary (in-memory + Cloudflare KV), a real BIP-340 Schnorr `SignatureVerifier`
> (@noble), a community/channel/group policy model, a NIP-07 `EventSigner`
> boundary, read-only space directory + landing pages (`?space=`/`?actor=`), a
> `RelayPublisher` write-path boundary, a **preview-only** compose panel
> (`?compose=1`), a `MetadataIndex` boundary (in-memory + Cloudflare D1), a D1
> space directory adapter, a chat / DM model boundary, a creator commerce model
> boundary, a promotion integration boundary, an edge-rec promotion adapter,
> read-only promotion placeholders, a runtime integration layer (`createRuntime`),
> an asset cache boundary (`AssetCache` for PUBLIC media), a MeshKV asset cache
> adapter (peer cache), and now an **R2 asset cache adapter** (origin storage):
> `R2AssetCache implements AssetCache` over a minimal `R2LikeBucket` (with a
> `MockR2Bucket`), which the runtime prefers when an R2 bucket is bound (R2 →
> MeshKV → in-memory). Metadata/`cachedAt`/`expiresAt` round-trip through R2
> `customMetadata`; content type through `httpMetadata`. **Every write is gated by
> `canCacheAsset`** — public/unlisted, non-sensitive media only; private/paid,
> DMs, secrets, key material, and payment/entitlement data are refused. **No
> signed URLs, download delivery, payment, or DRM** — R2 is origin storage for
> public previews, not a delivery/entitlement path. `clear()` is a deliberate
> no-op (no safe bulk wipe), and the adapter does no external `fetch` of its own.

## What is implemented

- `src/nostr/types.ts` — NIP-01 event types.
- `src/nostr/event.ts` — pure structural validation + canonical id computation
  and id verification (via an injected hasher).
- `src/nostr/crypto.ts` — default WebCrypto SHA-256 (Workers + Node compatible).
- `src/nostr/relay.ts` — `RelayAdapter` interface, filter matching, in-memory adapter.
- `src/ingest/*` — pure validate → dedupe → normalize pipeline.
- `src/thread/*` — pure NIP-10 thread builder (reply graph → sorted trees).
- `src/query/*` — pure query policy: sort (new/old/top/hot), filters
  (author/text/minReplies/since/until) and pagination over root threads.
- `src/community/*` — pure space model: `Community`/`Channel`/`Group` types,
  role + read/post/moderate/admin policy decisions, event→space classification,
  and a `SpaceDirectory` (in-memory) with readable-space and event-filtering
  helpers. `directory.ts` also defines `AsyncSpaceDirectory`, the persisted
  counterpart of the sync interface (a backing store cannot satisfy synchronous
  reads). `d1_directory.ts` implements it as `D1SpaceDirectory` (Cloudflare D1):
  it persists space DEFINITIONS and (pubkey, role) members through prepared
  statements. `spaceToRows`/`rowsToSpace` map between a `Space` and its rows —
  members are normalized to the highest role per pubkey (`listMemberships`),
  "guest" is never stored, unknown member roles are ignored on read, and an
  invalid space-level enum is rejected rather than silently defaulted. D1 is the
  storage location for definitions only, **not** an access-control oracle;
  permission checks remain the pure policy layer's job. Schema:
  `schema/d1_space_directory.sql`. No storage of keys, no posting, and no
  membership/admin/creation/join-approval UI.
- `src/chat/*` — pure chat / DM model boundary toward LINE/Telegram-style
  conversations. `types.ts` defines `ChatRoom` (`DMThread` | `GroupChat`),
  `ChatMessage`, `ChatVisibility`, `ChatPostPolicy`, and `ChatDecision`.
  `policy.ts` decides `canReadChat`/`canPostChat`/`isChatParticipant` purely over
  participant/admin lists and the chat's visibility/postPolicy (DM = participants
  only; open group = guests may post; private group = participants; channel-like
  = owners/admins only). `classify.ts` reads chat references from an event's tags
  (`["chat", "<id>"]` / `["t", "chat:<id>"]`; malformed/unknown ignored) via
  `getChatTags`/`eventMatchesChat`/`classifyEventToChats`. `space_bridge.ts`
  derives a `GroupChat` from a Stage 9 space (`chatFromGroupSpace`) and reuses the
  space's `canRead` for `canOpenChatFromSpace`. `directory.ts` adds the read-only
  directory/lookup layer: a `ChatDirectory` (`InMemoryChatDirectory`) plus pure
  `findChatById`, `listReadableChats` (filters by `canReadChat`), and
  `getChatMessages` (selects a chat's messages by `chatId`). `sample_chats.ts`
  ships fixed `SAMPLE_CHATS`/`SAMPLE_CHAT_MESSAGES` (an open group, a channel-like
  broadcast group, a private members group, and a one-to-one DM; one message
  carries HTML-special characters to prove escaping). **Nothing is sent and no DM
  is encrypted** — NIP-04/NIP-44 are out of scope; `ChatMessage.content` is
  plaintext as supplied. The Stage 27 UI is read-only labels only.
- `src/commerce/*` — pure creator / EC (digital-content) model boundary from a
  board/space/chat toward a creator's digital goods. `types.ts` defines `Product`
  (`kind` = pdf/zip/template/software/link/other, `status` = draft/active/archived,
  `visibility` = public/unlisted/private, linked space/event/asset ids),
  `DigitalAsset` (opaque `storageRef`, no bytes), `PurchaseGrant` (an external
  entitlement result with an optional `revokedAt`), and `AccessDecision`.
  `policy.ts` decides `canViewProduct`/`canEditProduct`/`canAccessAsset`/
  `hasPurchaseGrant` purely over status, visibility, the creator pubkey, and the
  supplied grants (public/unlisted active → anyone; private → creator or a valid
  grant holder; draft/archived → creator only; edit → creator only; asset access
  → creator or valid grant). `classify.ts` reads product references from an
  event's tags (`["product", "<id>"]` / `["t", "product:<id>"]`; malformed/unknown
  ignored) via `getProductTags`/`eventMatchesProduct`/`classifyEventToProducts`.
  `bridge.ts` builds a draft product from a Stage 9 space (`productFromSpace`) or a
  Nostr event (`productFromEvent`) and decides `canPromoteProductInSpace` (creator
  who may post in the space). `directory.ts` adds the read-only directory/lookup
  layer: a `ProductDirectory` (`InMemoryProductDirectory`) plus pure helpers
  `findProductById`, `listViewableProducts` (filters by `canViewProduct`),
  `getProductAssets` (selects a product's assets by `assetIds`), and a
  `ProductAsset` (an asset id paired with its PREVIEW `AssetMetadata` — no bytes).
  `sample_products.ts` ships fixed `SAMPLE_PRODUCTS`/`SAMPLE_GRANTS`/
  `SAMPLE_ASSET_METADATA` (a public guide, a private grant-gated pack, a
  creator-only draft; each mixes public/unlisted previews with a hidden `paid`
  original). **No money moves and nothing is delivered** — no payment, checkout,
  download serving, inventory, or real Stripe/crypto/R2/D1; `priceCents` is
  display-only and there is no DRM. The Stage 25 UI is read-only PREVIEW only.
  `asset_preview.ts` (Stage 35) lets the product route resolve preview metadata
  from the runtime's `AssetCache`: `resolveProductAssetPreviews(product,
  assetMetadataList, assetCache?, now?)` walks `product.assetIds`, uses the sample
  metadata as a baseline, and — only when a cache is supplied — overrides an entry
  with `cached.metadata` on a hit (**bytes discarded**), swallowing a miss/error
  back to the sample. `isPreviewAssetVisible`/`filterPreviewAssetMetadata` reuse
  `canCacheAsset`, so `private`/`paid`/sensitive-tagged assets are excluded from
  cache hits and samples alike; it mutates no input and carries no bytes.
- `src/promotion/*` — pure INTEGRATION BOUNDARY toward the existing Cloudflare ad
  system (edge-rec-middleware / recommendation-rewriter); it is NOT an ad engine.
  `types.ts` defines `PlacementType` (11 slots across thread/space/chat/product/
  search), `PlacementContext`, `Placement`, `PromotionRequest`, `PromotionCandidate`,
  `PromotionDecision`, and `PromotionReason`. `policy.ts` purely resolves a slot
  (`resolvePlacement`), assembles a request (`buildPromotionRequest`), strips
  context ids irrelevant to a slot (`filterPromotionContext`), and gates on a
  positive limit (`canShowPromotion`). `bridge.ts` maps a surface to a normalized
  request: `buildThreadPlacement`/`buildSpacePlacement`/`buildChatPlacement`/
  `buildProductPlacement`/`buildSearchPlacement`. `adapter.ts` defines the
  `PromotionProvider`/`RecommendationProvider` seams plus `MockPromotionProvider`
  (returns fixed candidates, NO network). `edge_rec_adapter.ts` connects those
  seams to the existing Cloudflare ad system: `EdgeRecPromotionProvider` posts an
  `EdgeRecAdapterOptions.endpoint` through an INJECTED `EdgeRecFetchLike` client
  (never the global `fetch`) and adapts the reply. The mapping is pure and split
  out as `mapPromotionRequestToEdgeRec` (re-filters context, attaches the viewer
  only on opt-in), `mapEdgeRecResponseToDecision` (stamps `metadata.provider =
  "edge-rec"`), and the `isEdgeRecResponseLike` guard; a malformed body, non-200,
  rejection, or timeout all resolve to a `provider_error` decision. It duplicates
  no ad logic — no ranking, auction, CTR, click tracking, or billing — and the
  viewer pubkey is omitted unless a caller opts in (raw via `sendViewerPubkey`, or
  opaque via `hashViewerPubkey`). `src/render/promotion.ts`'s
  `renderPromotionPlaceholder` emits a labeled "Sponsored" placeholder only — it
  renders no candidate title/image/`destination` and links nothing. **This layer
  does not select, rank, auction, serve, or track ads, charge money, call
  Stripe/Telegram, or rewrite HTML** — it only hands requests to an injected
  provider, and only ever reaches the network through that injected client.
- `src/sign/*` — signer boundary: an `EventSigner` interface, a `Nip07EventSigner`
  adapter over an injected NIP-07 provider, and pure builders for **unsigned**
  events (`buildUnsignedTextNote`, reply/space tags, `prepareSpacePost`). The app
  never holds, generates, or stores a private key, and never publishes; signing
  is delegated to the external signer.
- `src/render/*` — pure HTML render layer (every event-derived string is
  HTML-escaped before output). `space.ts` renders the read-only space directory
  and landing pages and, by default, brackets a landing with EMPTY
  `space_header`/`space_footer` promotion placeholders (toggle via
  `renderSpaceLanding`'s `{ promotions }` option). `product.ts` adds read-only
  product views — `renderProductLabel` (kind + title), `renderProductSummary`
  (price/currency/status/visibility/linked spaces, no links or actions), and
  `renderProductPromotionPlaceholder` (an EMPTY `product_sidebar` slot). Stage 25
  adds the directory/page surface: `renderProductDirectory` (lists viewable
  products, each linking to its `?product=<id>` page), `renderProductPage`
  (summary + view-decision reason + asset previews + an EMPTY promotion slot),
  `renderAssetPreviewList` (PUBLIC/UNLISTED asset metadata labels only —
  kind/visibility/contentType/size/source/checksum/tags; `private`/`paid` are
  filtered out, with no bytes and no download/link/button), `renderProductNotFound`,
  and `renderProductAccessDenied`. `chat.ts` (Stage 27) adds read-only chat views —
  `renderChatLabel` (kind + id), `renderChatDirectory` (lists readable chats, each
  linking to its `?chat=<id>` room), `renderChatRoom` (label + view-policy + read/
  post hints + plaintext messages), `renderChatMessage` (author + timestamp +
  escaped plaintext content), `renderChatNotFound`, and `renderChatAccessDenied`.
  The chat views render **no send form/button, no socket, and no message
  delivery**, and they never describe a chat as "secure"/"encrypted" — a private
  chat is labeled "participant-only view policy" only.
  `promotion.ts`'s `renderPromotionPlaceholder` shows a disclosure label and the
  placement's own (escaped) label only. **No placeholder renders an ad candidate,
  destination link, price-to-pay, or download**, and none of these helpers call a
  promotion provider or the network. Stage 41 adds preview-only renderers to the
  same file — `renderPromotionCandidatePreview` / `renderPromotionDecisionPreview`
  (escaped candidate cards with **no destination link, no image**, and a safe empty
  state) and `renderMockPromotionPreview`, which drives the **in-memory
  `MockPromotionProvider` only** (never the real/EdgeRec provider, no `fetch`). The
  Worker renders these solely under `?promotionPreview=1|true` in sample mode
  (`isPromotionPreviewEnabled`); it does **no click/impression tracking, ranking,
  auction, or billing**, and the Worker constructs no provider itself.
  `directory.ts` (Stage 30) arranges those Space/Product/Chat directories into one
  read-only section: `renderUnifiedDirectory(view)` renders a Spaces + Products +
  Chats block (each section toggleable via `showSpaces`/`showProducts`/`showChats`,
  all default true; an empty state when none are shown), reusing
  `renderSpaceDirectory`/`renderProductDirectory`/`renderChatDirectory` and linking
  only to the existing `?space=`/`?product=`/`?chat=` routes. `renderDirectorySection`
  wraps a helper's (pre-escaped) body under an escaped title, and
  `renderDirectoryEmptyState` is the "nothing to browse" notice. It adds **no new
  data lookup, no network, no new route** — it only orders already-built fragments,
  escaping the titles/actor text it introduces and trusting the helpers' escaping.
- `src/nostr/messages.ts` — pure NIP-01 relay-message parser (EVENT/EOSE/NOTICE).
- `src/nostr/signature.ts` — `SignatureVerifier` interface + `Noop`/`RejectAll`
  implementations.
- `src/nostr/noble_signature.ts` — `NobleSignatureVerifier`: real BIP-340 Schnorr
  verification via `@noble/curves` + `@noble/hashes`. Verify-only; no signing.
- `src/nostr/ws_relay.ts` — read-only WebSocket relay adapter (REQ → collect →
  EOSE/timeout → CLOSE) with an injectable `WebSocketFactory`. Read-only: it
  never publishes events.
- `src/nostr/publish.ts` — relay **write-path** boundary, kept separate from the
  read-only adapter above. `RelayPublisher` sends `["EVENT", signedEvent]` and
  awaits the NIP-20 `["OK", id, accepted, message]`; `parseOkMessage` is a pure,
  total parser (malformed/unknown → `null`). `WebSocketRelayPublisher` is a
  distinct class (its own injected `WebSocketFactory`) with timeout, socket
  cleanup, and relay-error tolerance (errors resolve `accepted:false`, never
  throw). `MockRelayPublisher` records events and returns a configured verdict
  with no network. `validateBeforePublish` gates a publish on `isSignedEventLike`
  **plus** a real `SignatureVerifier.verify`. **Nothing here is auto-wired** —
  it is a boundary to compose and test, not an executed action.
- `src/sign/publish_flow.ts` — pure glue to the Stage 9 space policy:
  `canPublishToSpace` runs `canPost` for the **signed event's own** pubkey (and
  denies if a supplied `actorPubkey` disagrees), and `preparePublishDecision`
  combines the signature gate with the space policy. Returns allowed/denied
  decisions only; the actual send stays in the `RelayPublisher` layer.
- `src/indexer/*` — lightweight **metadata/index** boundary for discovery
  (search, listing, space navigation), kept entirely separate from the event
  cache. `types.ts` defines `IndexedEvent`/`IndexedThread`/`IndexedSpaceRef` and
  the `MetadataIndex` interface (`putEvents`/`putThreads`/`putSpaceRefs`,
  `queryEvents`/`queryThreads`, `getEvent`/`deleteEvent`). `build.ts` has pure
  projectors (`buildIndexedEvents`/`buildIndexedThreads`/`buildIndexedSpaceRefs`)
  that truncate content to a short preview (≤280 chars) and reuse the NIP-10
  resolvers + Stage 9 classifier. Two implementations ship: `InMemoryMetadataIndex`
  (**process-local, lost on restart**) and `D1MetadataIndex` (Cloudflare D1). The
  D1 adapter stores only derived metadata (no raw bodies/sigs) and runs every
  query through prepared-statement bindings (no user input in SQL text). Schema:
  `schema/d1_index.sql`. Not wired into the Worker yet.
- `src/render/publish.ts` — **mock-only** compose prototype (render layer).
  `buildPublishPrototypeView` consults `canPost` and `prepareSpacePost` to build
  an UNSIGNED event for display; `renderPublishPrototype` /
  `renderUnsignedEventPreview` / `renderPublishDenied` format it (all event text
  HTML-escaped). It never signs, never calls a signer, never calls a
  `RelayPublisher`. A missing actor is treated as a denial (you must name a
  candidate author). The publish button is always disabled and mock-only.
- `src/cache/*` — `EventCache` boundary + deterministic cache keys + a get-or-
  fetch policy (hit / miss / stale fallback / bypass). Two implementations ship:
  `InMemoryEventCache` (**process-local, lost on every isolate/process restart**)
  and `KvEventCache` (Cloudflare Workers KV). KV is **eventually consistent** and
  a cache — not a verified or durable store.
- `src/worker.ts` — Cloudflare Workers entry. Default = sample mode; `?relay=`
  switches to an **allowlisted** live read-only relay, served through the cache.
  Honors `?sort=&q=&author=&minReplies=&since=&until=&limit=&offset=`, plus
  `?timeout=`, `?ttl=` (seconds, capped at 300) and `?cache=0` (bypass). Also
  `?space=<id>` (read-only landing for one space, gated by `canRead`) and
  `?actor=<pubkey>` (viewer identity; guest when absent). `?product=<id>` renders
  a read-only product page over the fixed sample products — summary plus
  PUBLIC/UNLISTED asset PREVIEW metadata only, gated by `canViewProduct` (unknown
  → not found, denied → access denied). The product route sources that preview
  metadata via `resolveProductAssetPreviews` from the runtime's `AssetCache`
  (Stage 35), falling back to the sample metadata on a miss/error — METADATA ONLY,
  bytes discarded — and the `AssetCache` is consulted ONLY here, never on the
  board/directory path. `?chat=<id>` renders a read-only chat room
  over the fixed sample chats, gated by `canReadChat` (unknown → not found, denied
  → access denied, allowed → room + plaintext messages + a `canPostChat` hint).
  The default (no-param) board surfaces a **unified directory** (`renderUnifiedDirectory`)
  that combines the readable-space, viewable-product, and readable-chat listings into
  one section; the product and chat sections are sample-mode only (the live read-only
  path shows just the spaces and adds no new data lookup). Chat messages are plaintext
  labels only — **nothing is sent,
  nothing is encrypted, and there is no send form/button or message delivery**. No
  asset bytes, signed URLs, downloads, or payment paths are introduced. On a
  readable space,
  `?compose=1` adds a **preview-only** compose panel; `?content=<text>` previews
  the unsigned event for the `?actor` candidate. Posting is only ever a disabled
  mock-only preview — never signed, never sent. There is no POST endpoint (a POST
  renders exactly like a GET). `selectDirectory(env)` picks the space directory
  backend — `D1SpaceDirectory` when `NOSTR_SPACE_DB` is bound, otherwise the
  in-memory sample directory — but the synchronous render path still uses the
  in-memory directory; D1 is not wired into request handling yet (Stage 15 ships
  the adapter + selection seam only). The default `fetch` now builds an
  `AppRuntime` via `createRuntime(env)` and uses its event cache; the other
  selected boundaries are not auto-wired (no real publish, no NIP-07, no
  auto-served ads).
- `src/asset/*` — public **asset cache boundary**, separate from the event cache.
  `types.ts` defines `AssetKind` (image/video_segment/audio/preview/thumbnail/
  html_fragment/other), `AssetVisibility` (public/unlisted/private/paid),
  `AssetMetadata`, `CachedAsset` (bytes as `ArrayBuffer`), `AssetCacheDecision`,
  and the async `AssetCache` interface (`get`/`put`/`has`/`delete`/`clear`, with
  injected `now` for deterministic expiry). `policy.ts` is pure:
  `canCacheAsset`/`isPublicCacheable` allow only public/unlisted assets with no
  sensitive tag (dm/secret/key/payment/entitlement); `normalizeAssetMetadata` and
  `createAssetKey` give a deterministic, order-independent (and checksum-addressed
  when available) key. `memory_asset_cache.ts`'s `InMemoryAssetCache` is dev/test
  only (non-persistent) and ENFORCES the policy on `put` by default — private,
  paid, and sensitive assets are refused. It only holds public media; **no
  purchased originals, DMs, secrets, keys, or payment/entitlement bytes**, and it
  fetches/serves nothing. R2/HTTP/MeshKV adapters slot in behind `AssetCache`.
  `meshkv_asset_cache.ts` is the first such adapter: `MeshKVAssetCache implements
  AssetCache` over a `MeshKVClient` (`get`/`put`/`has`/`delete`/optional `clear`),
  with an in-process `MockMeshKVClient` (no peers). It gates every `put` through
  `canCacheAsset`, clones bytes (`ArrayBuffer.slice`) and normalizes metadata
  before handing them to the client, keeps metadata + expiry in a local
  side-table (the client stores only bytes), and honors expiry on `get`/`has`.
  **No real WebRTC/signaling/peer discovery / network** — boundary + mock only;
  it is a public-media cache, not access control, payment, entitlement, or DRM.
  `meshkv_browser_client.ts` is the adapter that plugs the standalone
  `packages/meshkv` package into `MeshKVClient`: `MeshKVBrowserClient implements
  MeshKVClient` forwards each call to the package's `MeshKVApi` — `get→get`,
  `put→put(key, bytes, metadata.contentType)`, `has→get≠null`, `delete→remove` —
  cloning bytes across the boundary. It omits the optional `clear` because the real
  MeshKV exposes no bulk clear. It is the only file in `src/` that reaches the
  package at RUNTIME (forwards `MeshKVClient` calls); a few others take type-only
  imports (`runtime/types.ts`, `meshkv_lifecycle.ts`). It adds no caching/policy/
  transport, and **starts no network** — constructing it calls no `init()`/
  `startSignaling()`, so no signaling/WebRTC/peer discovery begins.
  `meshkv_lifecycle.ts` (Stage 32) is the explicit ONLINE/OFFLINE boundary,
  separate from selection: `MeshKVLifecycle` (`MeshKVBrowserLifecycle` /
  `createMeshKVLifecycle(node, initOptions?)`) drives a lifecycle-capable node
  (`init` + `startSignaling` + `stop`, satisfied by the reference `MeshKV`) through
  `idle → prepared → online → offline` (or `error`). The **constructor does
  nothing**; `prepare()` wires only (`init`); `goOnline()` is the first call that
  may open signaling / join the peer mesh (`startSignaling`); `goOffline()` calls
  `stop`. Steps are idempotent and failures set `error` (cause via `getLastError`)
  rather than throwing. It is **not wired into the runtime or Worker** — WebRTC /
  signaling / peer discovery begin only through an explicit `goOnline()`. It adds
  no cache, policy, or data path, and makes no security guarantee.
  `r2_asset_cache.ts` is the origin-storage adapter: `R2AssetCache implements
  AssetCache` over a minimal `R2LikeBucket`/`R2LikeObject` (and a `MockR2Bucket`).
  It gates every `put` through `canCacheAsset`, clones bytes and normalizes
  metadata, and round-trips `cachedAt`/`expiresAt`/the metadata JSON through R2
  `customMetadata` (content type via `httpMetadata`), restoring them on `get`/`has`
  and treating malformed metadata as a miss. `clear()` is a deliberate no-op — R2
  has no safe atomic bulk wipe and the bucket may hold objects this adapter did not
  write. **No signed URLs, download delivery, payment, or DRM, and no external
  `fetch`** — origin storage for public previews only.
  `composite_asset_cache.ts` composes the three into one: `CompositeAssetCache
  implements AssetCache` over an ordered list of `AssetCacheLayer`s
  (`{ name, cache, writable, volatile }`). `get` falls through the layers and
  returns the first hit; a `CompositeReadStrategy` of `"warm-fill"` (default)
  back-populates the preceding writable layers (each re-checked by `canCacheAsset`,
  failures swallowed), `"fallback"` skips that. `put` is policy-gated **before any
  layer is touched**, then a `CompositeWriteStrategy` writes the first writable
  layer (`"first-writable"`, default) or every writable layer (`"all-writable"`).
  `delete` fans out to all layers; `has` is true if any layer has the key;
  `clear()` defaults to a **no-op** (`"none"`) and the opt-in `"volatile"` strategy
  clears only volatile layers so a durable origin (R2) is never bulk-wiped. The
  composite stores no bytes itself, mutates no input, opens no connection, and
  issues no `fetch` — it is a cache hierarchy, NOT access control, payment,
  entitlement, or DRM, and **private/paid/secret/key/payment/entitlement bytes are
  refused at the gate** (warm-fill included).
- `src/runtime/*` — the runtime integration layer: the single place that picks
  every boundary. `createRuntime(env?, overrides?)` returns an `AppRuntime`
  (`eventCache`, `assetCache`, `spaceDirectory`, `metadataIndex`,
  `signatureVerifier`, `promotionProvider`, `recommendationProvider`,
  `relayPublisher`, plus a `mode`). Each `select*` prefers a real
  Cloudflare-backed adapter when its binding/config is present — `KvEventCache`
  (`NOSTR_EVENT_CACHE`), `D1SpaceDirectory` (`NOSTR_SPACE_DB`), `D1MetadataIndex`
  (`NOSTR_INDEX`), `EdgeRecPromotionProvider` (a
  `PROMOTION_ENDPOINT`/`RECOMMENDATION_ENDPOINT` **plus** an injected `fetch`) —
  and otherwise a test/local-safe in-memory or mock default (`InMemory*`,
  `MockPromotionProvider`/`MockRecommendationProvider`, `MockRelayPublisher`,
  `NobleSignatureVerifier`). **Stage 38** threads the rest of the EdgeRec config
  through `select{Promotion,Recommendation}Provider`: `RECOMMENDATION_API_KEY` (falls
  back to `PROMOTION_API_KEY`), a `parseEdgeRecTimeoutMs`-clamped `EDGE_REC_TIMEOUT_MS`
  (100–30000 ms; unparseable/non-positive ignored), and the **default-off** viewer
  privacy flags — `PROMOTION_SEND_VIEWER_PUBKEY` opts in to the RAW pubkey while
  `PROMOTION_HASH_VIEWER_PUBKEY` is recognized but **unwired** (no hash function, so
  nothing is sent and the raw pubkey is never leaked). The same fields exist on the
  Worker `Env`, but the Worker injects **no `fetch`**, so it always resolves to the
  inert mock and issues no promotion request. Selecting a provider is DI only — no
  `getPromotions`/`getRecommendations` and no `fetch` runs. `selectMeshKVClient(env, overrides?)` resolves the
  MeshKV client the asset cache writes through — `overrides.meshKVClient` first,
  then the legacy already-built `MESHKV_ASSET_CACHE` binding, then (Stage 31) an
  **explicit opt-in** `MeshKVBrowserClient`: built ONLY when
  `ENABLE_MESHKV_ASSET_CACHE` is truthy (`true`/`"1"`/`"true"`/`"yes"`/`"on"`) AND
  a `MeshKVApi` is supplied (`MESHKV_API` or `overrides.meshKVApi`); without the
  flag the browser client is never constructed. `selectAssetCache(env, overrides?)`
  then composes a `CompositeAssetCache` (R2 origin → MeshKV peer → in-memory
  fallback) when **both** an `NOSTR_ASSET_R2` bucket and a MeshKV client are
  present, else a plain `R2AssetCache` (R2 only), else a `MeshKVAssetCache` (mesh
  only), else the shared in-memory cache. `overrides` win over `env`.
  **Constructing a runtime starts no external work**: no socket, no `fetch`, no
  publish, no signer, no asset/mesh/R2 I/O, and **no MeshKV lifecycle** — building
  the opt-in `MeshKVBrowserClient` calls no `init`/`connect`/`startSignaling`, so
  no signaling/WebRTC/peer discovery begins; selecting the EdgeRec, MeshKV, or R2
  adapter (or composing the chain) only makes it *ready* to call out behind its
  injected client. The runtime never reaches for a global `fetch`, and the Worker
  does not auto-wire the MeshKV opt-in.
- `src/notification/*` — the **Notification Bridge boundary skeleton** (Stage 39):
  a future-facing seam for signalling "something happened" to an external channel
  (Telegram / LINE / APNs / FCM / Email), kept OUT of the current core, the chat
  layer, and the commerce layer. `types.ts` defines shapes ONLY — the
  `NotificationChannel` / `NotificationCapability` (six `*_placeholder` labels),
  `NotificationKind` (`chat_activity`/`space_activity`/`product_update`/
  `moderation_notice`/`payment_status_placeholder`/`system_notice`),
  `NotificationPayload` (kind + channel + generic title + optional generic
  `bodyPreview` + opaque `targetRef`/`actorRef` + `createdAt` + non-secret
  `metadata`), `NotificationDecision`, and the `NotificationBridge` interface
  (`getStatus`/`getCapabilities`/`notify`). `policy.ts`'s pure `canSendNotification`
  DENIES a sensitive payload, `sanitizeNotificationPayload` returns a cleaned copy,
  and `isSensitiveNotificationField` flags secret markers (never a plain hex
  pubkey). `noop_notification.ts`'s `NoopNotificationBridge` is the permanently
  `unavailable` default that denies every attempt; `PlaceholderNotificationBridge`
  (dev/test) returns the policy decision but **delivers nothing**. `bridge.ts`'s pure
  `chatEventToNotification` / `spaceEventToNotification` / `productEventToNotification`
  build payloads that OMIT the message body, event content, and payment/download
  detail (type-only domain imports). **This is boundary only — it sends nothing,
  calls no Bot API/APNs/FCM/LINE/Email service, and issues no `fetch`**; a payload
  **never carries DM/message content, a secret, key, seed, token, payment secret,
  entitlement, or credential** (APNs/FCM `metadata` leakage is kept out by the
  policy). It is NOT wired into `createRuntime` or the Worker, and the external
  bridges are not implemented.
- `src/identity/*` — the **Passkey Unlock boundary skeleton** (Stage 36): a
  future-facing seam that fixes WebAuthn / Passkey / Face ID / Touch ID as the
  AUTHENTICATION boundary that UNLOCKS the Vault — **not** a key source — drawn from
  `docs/vault_crypto_identity.md` and kept OUT of the current core, the Vault seam,
  and the crypto core. `types.ts` defines shapes ONLY — `PasskeyStatus`
  (`idle`/`waiting`/`authenticated`/`cancelled`/`unavailable`/`error`),
  `PasskeyReport`, `PasskeyCapability` (four `*_placeholder` labels:
  `faceid`/`touchid`/`passkey`/`external_webauthn`), `PasskeyAuthenticationRequest`
  (a `kind` of `apple_passkey`/`android_passkey`/`webauthn`/`external` + an OPAQUE,
  non-secret `reference`), and the `PasskeyBoundary` interface
  (`getStatus`/`getCapabilities`/`beginAuthentication`/`cancelAuthentication`).
  `passkey_boundary.ts`'s `NoopPasskeyBoundary` is the safe default: permanently
  `unavailable`, it advertises nothing and every attempt is denied;
  `PlaceholderPasskeyBoundary` (dev/test) models an `idle → (placeholder)
  authenticated ↔ cancelled` lifecycle holding ONLY a coarse `PasskeyReport` — its
  `authenticated` state is a LABEL that **does NOT unlock the Vault**.
  `vault_bridge.ts`'s pure `passkeyAuthenticationToVaultRequest` maps the
  authenticator `kind` to a `VaultUnlockKind` (apple/android/webauthn passkeys →
  `passkey`; external → `external_signer`) and passes the opaque `reference` through
  unchanged — a **type-only** Vault dependency that derives no key and wires
  nothing. **This is boundary only — no authentication, no key generation, no key
  derivation**: it starts no auth, calls no WebAuthn/Passkey/Apple/Google API,
  launches no Face ID/Touch ID, touches no Secure Enclave/Android Keystore, holds no
  credential/JWT/token/seed, and mutates no request. Passkey / Apple ID / Google are
  **unlock triggers ONLY, never a key source**. It is NOT wired into `createRuntime`
  or the Worker, and a future real unlock flow (the planned Rust core) is not
  implemented. **Stage 37** adds the **Identity Provider boundary skeleton** in the
  same directory: `provider_types.ts` defines shapes ONLY — `IdentityProviderKind`
  (`apple`/`google`/`external`/`passkey`), `IdentityProviderStatus`
  (`idle`/`waiting`/`authenticated`/`cancelled`/`unavailable`/`error`),
  `IdentityProviderCapability` (four `*_placeholder` labels:
  `apple`/`google`/`external`/`passkey_bridge`), `IdentityProviderRequest` (a `kind`
  + OPAQUE, non-secret `reference`), `IdentityProviderReport` (status + echoed kind +
  the same opaque reference + reason), and the `IdentityProviderBoundary` interface
  (`getStatus`/`getCapabilities`/`begin`/`cancel`). `provider_boundary.ts`'s
  `NoopIdentityProvider` is the permanently `unavailable` default that advertises
  nothing and denies every attempt; `PlaceholderIdentityProvider` (dev/test) models
  an `idle → (placeholder) authenticated ↔ cancelled` lifecycle whose
  `authenticated` state **unlocks nothing**. `provider_bridge.ts`'s pure
  `identityProviderToPasskeyRequest` / `identityProviderToVaultRequest` map the
  provider `kind` to a `PasskeyAuthenticationKind` / `VaultUnlockKind`
  (apple → `apple_passkey`/`apple_id`; google → `android_passkey`/`passkey`;
  external → `external`/`external_signer`; passkey → `webauthn`/`passkey`) and pass
  the opaque `reference` through unchanged — **type-only** Passkey + Vault
  dependencies that derive no key and wire nothing. **Apple / Google / External are
  authentication references, NEVER a key source**: it runs no OAuth, parses/stores no
  JWT, calls no WebAuthn/Apple/Google API, holds no token/credential/email/profile,
  and unlocks nothing. It is NOT wired into `createRuntime` or the Worker.
- `src/crypto/*` — the **Crypto Core boundary skeleton** (Stage 34): a
  future-facing seam that fixes the swap point for a real crypto core (the
  provisional `packages/fedos-core-rust` / a RustCrypto-backed WASM/FFI module),
  drawn from `docs/vault_crypto_identity.md` and kept OUT of the current core.
  `types.ts` defines shapes ONLY — `CryptoState` (`available`/`unavailable`/
  `error`), `CryptoStatus`, `CryptoDecision` (allowed + state + non-sensitive
  reason, **no output/bytes field**), `CryptoCapability` (five `*_placeholder`
  labels: `aead`/`kdf`/`random`/`nip44`/`rust_core`), and the request shapes
  `RandomBytesRequest` (a length only), `DeriveKeyRequest`, `EncryptRequest`, and
  `DecryptRequest` — the latter three carrying **OPAQUE, non-secret handles and
  labels only** (`keyRef`/`plaintextRef`/`ciphertextRef`/`aad`/algorithm labels),
  never raw key/seed/passphrase/plaintext bytes, plus the `CryptoProvider`
  interface (`getStatus`/`getCapabilities`/`randomBytes`/`deriveKey`/`encrypt`/
  `decrypt`). `noop_crypto.ts`'s `NoopCryptoProvider` is the safe default:
  permanently `unavailable`, it advertises no capabilities and every operation
  resolves to a denied/unavailable `CryptoDecision`; it is total and never throws.
  `vault_bridge.ts`'s pure `cryptoCapabilitiesToVaultCapabilities` maps the crypto
  placeholders to the Vault placeholders they would back (aead/nip44/rust_core →
  `aead_crypto_placeholder`; kdf → `identity_unlock_placeholder`; random → none),
  deduped and without mutating its input — a **type-only** dependency on the Vault
  types that wires nothing. **This is boundary only — no encryption, no key
  derivation, no random generation** (no AEAD/XOR/HKDF/Argon2/BIP39/BIP32/NIP-44/
  zeroize anywhere); it holds no key, seed, or plaintext, mutates no request, and
  makes **no security or confidentiality claim**. It is NOT wired into
  `createRuntime` or the Worker, and a future Rust core is not implemented.
- `src/vault/*` — the **Vault boundary skeleton** (Stage 33): a future-facing seam
  for the FedOS Vault / Crypto / Identity layer sketched in
  `docs/vault_crypto_identity.md`, kept OUT of the current core. `types.ts` defines
  shapes ONLY — `VaultState` (`locked`/`unlocked`/`unavailable`/`error`),
  `VaultStatus`, `VaultDecision`, `VaultCapability` (four `*_placeholder` labels:
  `identity_unlock`/`deniable_storage`/`aead_crypto`/`external_signer`),
  `VaultUnlockRequest` (a `kind` enum + an OPAQUE, non-secret `reference`), and the
  `VaultBoundary` interface (`getState`/`getCapabilities`/`unlock`/`lock`/
  `isUnlocked`). `noop_vault.ts`'s `NoopVaultBoundary` is the safe default:
  permanently `unavailable`, it never unlocks, advertises no capabilities, and its
  every method is total. `memory_vault.ts`'s `InMemoryVaultBoundary` (dev/test)
  models a `locked ↔ (placeholder) unlocked` lifecycle holding ONLY a coarse
  `VaultStatus` — **there is no secret/key/seed/token/passphrase field**. **This is
  boundary only — no crypto, no key generation, no key derivation, no seed
  storage** (no AEAD/XOR/BIP39/BIP32/NIP-44 anywhere). `unlock` reads only the
  request `kind`, derives nothing from the `reference`, and never turns an Apple ID
  JWT / `sub` / user id / Passkey credential into key material — **Apple ID /
  Passkey are unlock factors ONLY, never a key source** — so a successful unlock is
  a "placeholder unlocked" state change and nothing more; `lock` returns to
  `locked`. Neither throws (a malformed request → `error` state + `decision.reason`)
  and neither mutates its input. Deniable/shadow storage is a placeholder capability
  name = RESEARCH only, with **no security, privacy, or hidden-storage claim**. It
  is NOT wired into `createRuntime` or the Worker.
- `packages/meshkv/*` — MeshKV as a **standalone external package**
  (`@nostr-window/meshkv`), the typed boundary for the imported browser runtime so
  the host depends only on its contract. `index.ts` is the stable entry point
  (exports `MeshKVApi` plus `MeshKV`/`createMeshKV`); `types.ts` defines
  `MeshKVApi` (`init`/`get`/`put`/`remove`, optional `load`) — mirroring the real
  module's exports — plus `MeshKVData`/`MeshKVInitOptions`/`MeshKVRecord`.
  `meshkv.ts` is a **browser-free reference node** with that same surface (backed
  by `local_cache.ts`; `peer_cache.ts`/`signaling.ts` are mesh/signaling
  boundaries with no real WebRTC or socket) so the host can typecheck/test without
  a browser; the production runtime is the imported browser MeshKV (git-ignored
  external checkout), and both satisfy `MeshKVApi`. Constructing a node opens **no
  connection**; `init()` only wires handlers, and going online is the explicit
  `startSignaling()` (browser: `signal.connect()`). The package imports only its
  own `./` siblings — it knows nothing of the host's asset/policy types; the host
  reaches it solely through the `src/asset/meshkv_browser_client.ts` adapter. It
  is a cache for PUBLIC bytes — not access control, payment, entitlement, or DRM.

## Security scope (read before trusting anything here)

This codebase verifies event signatures on the live path but makes **no**
confidentiality guarantees and is not a security audit of the wider system.

- **Signature verification (live path).** `NobleSignatureVerifier` performs real
  BIP-340 Schnorr verification: it recomputes the id from the event body and
  checks `sig` against the author's x-only `pubkey`. Events that fail are dropped
  during ingest. This proves an event is **authentic and untampered** — it does
  NOT mean the content is true, safe, or endorsed, and it is not a guarantee
  that the rest of the pipeline is free of bugs. Avoid words like "tamper-proof"
  or "completely secure".
- **`verifyEventId` is a different check.** It only confirms an event's `id` is a
  consistent SHA-256 of its serialization (self-consistency), and does **not**
  prove authorship. Signature verification is the separate `SignatureVerifier`
  path.
- **Sample mode is unsigned.** The default demo events are not signed and are
  served with the Noop verifier; they exist only to exercise rendering.
- **Cache ≠ verification.** `KvEventCache`/`InMemoryEventCache` store whatever
  events were fetched. Caching does not re-verify; do not treat a cached entry as
  a verified or trusted record.
- The live relay path is **read-only** and limited to an allowlist; it never
  publishes events. Disallowed relays are rejected.
- **Space policy is advisory, not enforced.** `canPost`/`canRead`/etc. are pure
  decisions over pubkey allowlists; nothing posts or gates access yet, and the
  policy layer does not itself verify signatures (it assumes the caller passes
  pubkeys it already trusts). Treat it as a model, not an access-control system.
- No private keys are handled, generated, or stored. The signer boundary
  delegates to an external NIP-07 provider; the unsigned-event builders never
  sign. Signed events returned by a provider are structurally validated and
  checked against the signer's pubkey, but this app does not run a signer
  automatically.
- **Publishing is a boundary, not a wired action.** `RelayPublisher` /
  `WebSocketRelayPublisher` can send a signed event to a relay, but nothing in
  the UI or Worker calls them, there is no publish endpoint, and no NIP-07
  signer is auto-invoked. `validateBeforePublish` only gates what *would* be
  safe to publish (structure + a real signature check); it does not itself send,
  and a passing decision is not a guarantee the rest of the flow is bug-free.
- **The D1 metadata index is not durable, not authoritative, not an audit log.**
  `D1MetadataIndex` stores only small derived metadata (id, author, a truncated
  content preview, reply/root links, space refs) — never raw event bodies or
  signatures. It exists to make discovery fast and can be rebuilt from relays;
  rows may be stale, incomplete, or absent. Do not treat the presence of a row
  as proof an event is authentic — signature verification is a separate concern.
  All queries use prepared-statement bindings; user input is never interpolated
  into SQL text.
- **The D1 space directory stores definitions, not permissions.**
  `D1SpaceDirectory` persists what a space looks like (its type, settings, and
  (pubkey, role) members) so the model can outlive a process restart. It is
  **not** an authoritative permission oracle and **not** an audit log: a stored
  row is not proof anyone is actually authorized to read or post. `canRead`/
  `canPost` decisions stay in the pure Stage 9 policy layer, which the app must
  run itself. Only the four assignable roles are stored ("guest" is never
  written); all access uses prepared-statement bindings, never SQL string
  interpolation. There is no admin, creation, or join/approval flow yet.
- **The chat model is advisory and unencrypted.** `canReadChat`/`canPostChat`/
  `isChatParticipant` are pure decisions over participant/admin lists; nothing
  sends a message or gates a conversation. DMs are **not** encrypted — NIP-04 and
  NIP-44 are out of scope for this stage, and `ChatMessage.content` is plaintext
  as supplied. The space→chat bridge derives a chat definition only; it does not
  open a socket or publish. Do not describe chats here as private/secure in any
  cryptographic sense.
- **The chat UI (Stage 27) is read-only labels.** The `?chat=<id>` route, the chat
  directory, and the room view only DISPLAY the Stage 16 model: a chat's id/kind,
  its `canReadChat`/`canPostChat` decisions, and its messages as escaped plaintext.
  There is **no send form, no send/publish button, no socket, no NIP-07 call, and
  no message delivery** — a `?chat=` request renders exactly like any other GET. A
  private chat is labeled **"participant-only view policy"** (an access note, not a
  cryptographic claim); the views deliberately avoid the words "secure"/"encrypted"
  because nothing here is. A readable-by-actor listing is a convenience filter, not
  an authorization guarantee.
- **The commerce model is advisory; no money moves and nothing is delivered.**
  `canViewProduct`/`canEditProduct`/`canAccessAsset` are pure decisions over a
  product's status/visibility/creator and the supplied grants; they do not charge,
  refund, gate a download, or serve a file. A `PurchaseGrant` records an EXTERNAL
  entitlement result only — issuing one does not take payment and `source:
  "payment"` does not mean this layer charged anyone. `priceCents` is display
  metadata; there is no checkout, inventory, R2/D1 storage, or DRM, and
  `canAccessAsset` is NOT content protection. Do not describe products here as
  "purchased", "protected", or "DRM-secured". The Stage 25 `?product=<id>` route
  and product render helpers are **read-only PREVIEW only**: the asset preview
  list shows descriptive `AssetMetadata` (kind/contentType/size/source/checksum/
  tags) for `public`/`unlisted` assets ONLY — `private`/`paid` assets are filtered
  out and never labeled. No asset bytes are embedded in the HTML, and there is no
  download link, signed URL, payment affordance, or real R2/MeshKV byte lookup.
  Stage 35 lets that preview metadata come from the runtime's `AssetCache`
  (`resolveProductAssetPreviews`) instead of only the sample list, but it stays
  **metadata-only**: a cache hit contributes `cached.metadata` and the bytes are
  discarded (never rendered), a miss/error falls back to the sample metadata, and
  `private`/`paid`/sensitive-tagged assets are still excluded (the filter reuses
  `canCacheAsset`). The cache is read on the `?product=` route ONLY — the board
  and directories issue no `assetCache.get` — and this adds no download, signed
  URL, delivery, or payment path.
- **The promotion layer is a request boundary, not an ad system.** It builds and
  normalizes "place a promotion here" requests and hands them to an injected
  `PromotionProvider` — it does not select, rank, auction, or weight ads, run
  CTR/A-B tests, track clicks, charge money, or call Stripe/Telegram, and it does
  no HTMLRewriting. It adds no D1/KV and is not wired into the Worker. The pure
  layer (policy/bridge) and `MockPromotionProvider` touch no network at all;
  `renderPromotionPlaceholder` shows a "Sponsored" label only and never a real ad.
- **The edge-rec adapter only translates and transports.** `EdgeRecPromotionProvider`
  forwards a request to the existing edge-rec-middleware / recommendation-rewriter
  through an INJECTED fetch client (never the global `fetch`), then maps the reply
  back. It duplicates none of the ad engine: no ranking, auction, CTR, click
  tracking, or billing live here. The viewer pubkey is NOT sent unless a caller
  explicitly opts in (raw via `sendViewerPubkey`, or opaque via `hashViewerPubkey`),
  and any transport failure (rejection, non-200, malformed body, timeout) becomes
  a `provider_error` decision rather than throwing. Do not describe this as ad
  serving or measurement — the selection logic stays in the external system.
- **Promotion placeholders are empty disclosure slots, not ads.** The space
  landing (sample mode only) and the product render helpers emit
  `renderPromotionPlaceholder` markup that shows a "Sponsored"/"Promotion" label
  and the placement's name — never an ad candidate, destination link, image,
  price-to-pay, or download button. They are produced purely from the Stage 18
  `buildSpacePlacement`/`buildProductPlacement` bridges; the Worker constructs no
  promotion provider and adds no `fetch`. Product views likewise render no
  checkout/payment/download affordance. Do not describe these slots as serving,
  selecting, or measuring ads.
- **The compose panel (`?compose=1`) is preview-only.** It builds and displays
  an UNSIGNED event (no `id`/`sig`) so a user can see what would be signed; it
  does not sign, does not call a signer, and does not call a `RelayPublisher`.
  The publish button is disabled. The `MockRelayPublisher` is referenced only in
  copy/tests and is never invoked from the request path — no network is touched.
- **The runtime layer is selection/DI only — it starts nothing.** `createRuntime`
  constructs adapters but opens no socket, issues no `fetch`, publishes nothing,
  and invokes no signer; selecting `EdgeRecPromotionProvider` only makes it ready
  to call its INJECTED client (the runtime never uses a global `fetch`). The
  Worker uses the runtime's event cache but does not auto-wire the publisher,
  providers, or async directory — there is still no real publish, no NIP-07
  auto-run, and no auto-served ads. The default relay publisher is the mock.
- **The MeshKV runtime opt-in wires an adapter, not a network.** `createRuntime`
  builds a `MeshKVBrowserClient` ONLY when `ENABLE_MESHKV_ASSET_CACHE` is truthy
  AND a `MeshKVApi` is supplied (`MESHKV_API`/`overrides.meshKVApi`); the legacy
  `MESHKV_ASSET_CACHE` binding and `overrides.meshKVClient` still work as before.
  Opting in only SELECTS the asset-cache layer — it starts **no** MeshKV network:
  no `init`, `connect`, `startSignaling`, WebRTC, or peer discovery is called from
  the runtime, and `createRuntime` performs no asset `get`/`put`/`has`. Bringing a
  node online stays an explicit caller step for a future lifecycle stage. The
  Worker does **not** auto-wire this opt-in, so its default behavior is unchanged,
  and MeshKV still holds public/unlisted bytes only (private/paid/secret/DM/
  payment/entitlement data is refused by `canCacheAsset`; no signed URLs,
  downloads, or payment).
- **Going online is an explicit lifecycle step, never automatic.**
  `MeshKVLifecycle` (`src/asset/meshkv_lifecycle.ts`) is the only place a MeshKV
  node is brought online. Constructing it does nothing; `prepare()` wires the node
  (`init`) without opening a socket; `goOnline()` is the FIRST call that may open
  signaling or join the WebRTC peer mesh (`startSignaling`); `goOffline()` calls
  `stop`. It is **not** wired into `createRuntime` or the Worker, so no signaling,
  WebRTC, or peer discovery begins unless a caller explicitly calls `goOnline()`.
  Steps are idempotent and failures set an `error` state rather than throwing. The
  boundary adds no cache, policy, delivery, or data path and makes **no** security
  or anonymity guarantee — it only sequences a node's online/offline transitions.
- **The asset cache holds PUBLIC media only.** `canCacheAsset` allows only
  `public`/`unlisted` assets with no sensitive tag, and `InMemoryAssetCache`
  enforces that on `put` — `private`/`paid` assets, DMs, secrets, key material,
  and payment/entitlement data are refused, never stored. It is a cache for
  previews/thumbnails/segments, NOT a delivery path: it fetches nothing, serves
  nothing, and never holds a purchased original. The in-memory cache is
  non-persistent.
- **The MeshKV adapter is a boundary + mock, not a mesh.** `MeshKVAssetCache`
  gates every write through `canCacheAsset`, so only public/unlisted, non-sensitive
  media can be written — private/paid content, DMs, secrets, key material, and
  payment/entitlement data are refused before they reach the client. It clones
  bytes/metadata so nothing live is shared. There is **NO real WebRTC, signaling
  server, peer discovery, or peer/network communication** in this stage — the only
  client shipped is the in-process `MockMeshKVClient`. MeshKV is a cache for public
  bytes; it is NOT access control, payment, entitlement, or DRM, and no purchased
  original is ever placed on it.
- **MeshKV is a browser package that starts nothing on its own.** `packages/meshkv`
  is an external, standalone package reached solely through the
  `MeshKVBrowserClient` adapter (`implements MeshKVClient`). The real runtime is an
  imported browser project (IndexedDB + WebRTC), kept as a git-ignored external
  checkout; the host builds against the typed `MeshKVApi` and a browser-free
  reference node. Constructing the adapter or a node performs **no network**: no
  signaling connection, no WebRTC, and no peer discovery are started — going online
  is an explicit step (`startSignaling()` / `signal.connect()`) the adapter never
  calls, and it is not auto-wired into the runtime or Worker. Note the real MeshKV
  `load()` performs an ORIGIN FETCH; the adapter deliberately never uses it (only
  the local-tier `get`/`put`/`remove`). The adapter clones bytes across the
  boundary so no live buffer is shared, and the package imports only its own
  siblings (a test asserts it never reaches into the host's `src/`). MeshKV carries
  PUBLIC assets only; private/paid/secret/DM/payment content is refused by
  `canCacheAsset` (in `MeshKVAssetCache`) before it could ever reach the package.
  There are still no signed URLs, downloads, or real asset delivery here.
- **The R2 adapter is origin storage for public media, not a delivery path.**
  `R2AssetCache` gates every write through `canCacheAsset`, so private/paid
  content, DMs, secrets, key material, and payment/entitlement data are refused
  before they reach the bucket. It clones bytes and normalizes metadata, and
  round-trips cache fields through R2 `customMetadata`/`httpMetadata`. There are
  **NO signed URLs, NO download/delivery endpoint, NO payment, and NO DRM** — R2
  holds public previews/thumbnails/segments only, never a purchased original. The
  adapter does no external `fetch` of its own (all I/O goes through the injected
  bucket), and `clear()` is a deliberate no-op because R2 has no safe atomic bulk
  wipe. A stored object is not proof of authorization — this is a cache, not an
  entitlement oracle.
- **The composite asset cache is a chain of the same gated layers — it weakens
  nothing.** `CompositeAssetCache` only orders/forwards to the layers it is given;
  it stores no bytes itself and adds no transport. Every write it performs — direct
  puts AND warm-fills — is gated by `canCacheAsset` first, so private/paid content,
  DMs, secrets, key material, and payment/entitlement data are refused before any
  layer is touched. **Warm-fill is a read-path optimization, not an authorization
  signal**: a key being present in (or copied into) a layer is not proof anyone is
  entitled to it. `clear()` defaults to a no-op and never bulk-wipes a durable
  origin (the opt-in `"volatile"` strategy clears local/peer layers only, never
  R2). There are still **no signed URLs, downloads, delivery, or payment**, and the
  composite opens no connection and issues no `fetch` of its own.
- **The crypto core boundary is a seam, not crypto.** `src/crypto/*` defines a
  `CryptoProvider` interface and a no-op provider — it performs **no encryption,
  no key derivation, and no random generation** (no AEAD/XOR/HKDF/Argon2/BIP39/
  BIP32/NIP-44/zeroize, no key generation), holds **no key, seed, or plaintext**,
  and its requests carry OPAQUE, non-secret handles/labels only (never raw
  key/seed/passphrase/plaintext bytes). A `CryptoDecision` carries no output —
  nothing is computed. `NoopCryptoProvider` is permanently `unavailable` and denies
  every operation; nothing throws and no request is mutated. The future Rust core
  (`packages/fedos-core-rust`, provisional) is **not implemented**. Do NOT describe
  this boundary as "safe", "complete", "secure", or "zero-trace". It is not wired
  into the runtime or Worker, and a test asserts `src/crypto` contains no XOR and
  imports no AEAD/crypto library.
- **The vault boundary is a seam, not a vault.** `src/vault/*` defines an
  interface and no-op/in-memory placeholders — it holds **no key, no seed, no
  passphrase, no token, and no secret bytes**, and it performs **no cryptography,
  key generation, or key derivation** (no AEAD/XOR/BIP39/BIP32/NIP-44). A
  "placeholder unlocked" state exposes no key and grants no crypto.
  `NoopVaultBoundary` never leaves `unavailable`. **Apple ID / Passkey are `unlock`
  factors ONLY** — a JWT, Apple `sub`/user id, or Passkey credential is never used
  as, or fed to derive, a key or seed; `unlock` reads only the request `kind` and
  derives nothing from the opaque `reference`. Operations never throw (a bad
  request becomes an `error` state + non-sensitive `reason`) and never mutate their
  input. "Deniable"/shadow storage is a placeholder name for RESEARCH only — do NOT
  describe this boundary as "safe", "secure", "zero-trace", or able to "hide"
  anything. It is not wired into the runtime or Worker.
- No application-level encryption is provided; when added it will use a vetted
  AEAD library, never hand-rolled XOR.

These constraints are deliberate. Do not document guarantees the code does not
yet provide.

## Commands

```bash
npm install
npm run typecheck   # tsc --noEmit (strict)
npm test            # vitest run
```

## Cloudflare KV cache (optional)

The live relay path caches results through `EventCache`. Bind a KV namespace as
`NOSTR_EVENT_CACHE` and the Worker uses `KvEventCache`; without the binding it
falls back to the in-memory cache.

```toml
# wrangler.toml
name = "nostr-window"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "NOSTR_EVENT_CACHE"
id = "<your-kv-namespace-id>"
```

KV caveats (do not over-promise on these):

- **Eventually consistent.** Reads can briefly miss a recent write, and an
  entry may be evicted before its logical expiry.
- **TTL floor.** Cloudflare rejects `expirationTtl` below 60s, so logical TTLs
  under a minute are stored at 60s; `get` still reports them stale at the real
  `expiresAt`.
- **Size limits.** KV values are capped (256 KB at time of writing); very large
  batches will be rejected by KV.
- **Not a clear-all.** `KvEventCache.clear()` is a deliberate no-op — there is no
  safe atomic wipe of a shared namespace. Evict per key with `delete` or let
  `expirationTtl` expire entries.
- **It's a cache, not an audit log.** KV here stores unverified relay events for
  speed; it is not durable, not authenticated, and not a security record.

## Cloudflare D1 metadata index (optional, not wired yet)

`MetadataIndex` is a discovery index (search/listing/space navigation) that is
**separate** from the event cache. Apply `schema/d1_index.sql` to a D1 database
and construct `D1MetadataIndex(db)`; in tests/dev use `InMemoryMetadataIndex`.
The Worker does not use it yet (Stage 14 ships the boundary + adapters only).

```toml
# wrangler.toml
[[d1_databases]]
binding = "NOSTR_INDEX"
database_name = "nostr-index"
database_id = "<your-d1-database-id>"
```

```bash
wrangler d1 execute nostr-index --file=schema/d1_index.sql
```

D1 caveats (do not over-promise on these):

- **Metadata only.** Stores derived fields (id, author, kind, a truncated
  content preview, reply/root links, space refs) — never raw event bodies or
  signatures.
- **Rebuildable, not authoritative.** It is a convenience index, not an audit
  log or durable source of truth; rows can be stale, incomplete, or rebuilt from
  relays. A row is not proof an event is authentic.
- **Bound parameters only.** Every query uses prepared-statement bindings; user
  input is never interpolated into SQL text.

## Cloudflare D1 space directory (optional, not wired yet)

`D1SpaceDirectory` persists Community/Channel/Group **definitions** and their
(pubkey, role) members behind the `AsyncSpaceDirectory` interface. Apply
`schema/d1_space_directory.sql` to a D1 database and construct
`D1SpaceDirectory({ db })`; in tests/dev use the in-memory `SpaceDirectory`. The
Worker selects it via `selectDirectory(env)` when `NOSTR_SPACE_DB` is bound, but
does not yet route requests through it (Stage 15 ships the adapter + seam only).

```toml
# wrangler.toml
[[d1_databases]]
binding = "NOSTR_SPACE_DB"
database_name = "nostr-spaces"
database_id = "<your-d1-database-id>"
```

```bash
wrangler d1 execute nostr-spaces --file=schema/d1_space_directory.sql
```

D1 space directory caveats (do not over-promise on these):

- **Definitions, not permissions.** A stored space/member row records what a
  space looks like; it is not proof anyone is authorized. `canRead`/`canPost`
  are decided by the pure policy layer, not by the presence of a row.
- **Not an audit log, not authoritative.** It is mutable storage for the current
  space model, not a tamper-evident history.
- **Stored roles only.** Just owner/admin/moderator/member are persisted; "guest"
  is the absence of a row. A pubkey is normalized to its highest role on write,
  and unknown roles are ignored on read.
- **Bound parameters only.** Every query uses prepared-statement bindings; user
  input is never interpolated into SQL text.

## Roadmap (stages)

1. Nostr event ingest ✓
2. Thread builder (NIP-10 reply graph → tree) ✓
3. Reddit-style read-only render ✓
4. Query / sort / filter policy ✓
5. Read-only relay WebSocket adapter + signature verifier boundary ✓
6. Relay event cache boundary (in-memory) ✓
7. Cloudflare KV cache adapter ✓
8. Real Schnorr signature verification ✓
9. Community / Channel / Group space model + policy ✓
10. NIP-07 signer boundary + unsigned-event builders ✓
11. Space directory / read-only landing pages ✓
12. Relay publish boundary (no UI) ✓
13. Mock-only publish UI prototype (preview only) ✓
14. D1 metadata/index adapter (discovery only) ✓
15. D1 space directory adapter (definitions only) ✓
16. Chat / DM model boundary (no send, no encryption) ✓
17. Creator commerce model boundary (no payment, no delivery) ✓
18. Promotion integration boundary (request seam only, no ad engine) ✓
19. edge-rec-middleware adapter (inject-only transport to the existing ad system) ✓
20. Read-only promotion placeholders + product render helpers ✓
21. Runtime integration layer (`createRuntime` selection/DI seam) ✓
22. Asset cache boundary (public media only; R2/HTTP/local/MeshKV-swappable) ✓
23. MeshKV adapter boundary (public previews/thumbnails/segments only; mock client) ✓
24. R2 AssetCache adapter (origin storage for public media; no signed URLs/DRM) ✓
25. Product read-only directory/page route + public asset preview ✓
26. Asset cache composed fallback chain (R2 → MeshKV → in-memory) ✓
27. Chat read-only UI labels ✓
28. MeshKV external package boundary (`packages/meshkv` + browser-client adapter) ✓
29. MeshKV boundary wired to the imported implementation (real `MeshKVApi`) ✓
30. Product / Chat / Space unified directory page ✓
31. Runtime MeshKV explicit opt-in wiring (no auto network) ✓
32. MeshKV browser lifecycle boundary (explicit connect/startSignaling) ✓
33. Vault boundary skeleton (interface + no-op/in-memory; no crypto, no keys) ✓
34. Crypto Core Boundary skeleton (`CryptoProvider` interface + `NoopCryptoProvider`) ✓
35. Product/Asset preview metadata from runtime (`runtime.assetCache`-backed previews) ✓
36. Passkey Unlock boundary skeleton (WebAuthn/Passkey/Face ID as *unlock trigger*, not a key source) ✓
37. Identity Provider boundary skeleton (Apple/Google/External as opaque auth references, not key sources) ✓
38. EdgeRec Worker env selection boundary (select the promotion provider from Worker env) ✓
39. Notification Bridge boundary skeleton (external notify seam; no secret/DM/payment content, no sending) ✓
40. Deniable Storage Research Boundary docs (threat model + prohibitions; docs only, no code) ✓
41. Mock promotion preview mode (MockPromotionProvider-only, opt-in flag; no real ads/fetch/tracking) ✓
42. Notification provider env selection boundary (`createRuntime` selects a `NotificationBridge` from env; no auto-`notify()`) ✓
43. IPFS Asset Adapter Boundary skeleton (`IpfsClient`/`NoopIpfsClient`/`IpfsAssetCache`; no real IPFS node/gateway) ✓
44. Payment / Lightning Boundary skeleton (`PaymentProvider`/`NoopPaymentProvider`/`PlaceholderPaymentProvider`; no real payment) ✓
45. Product purchase preview UI (placeholder-only purchase panel, disabled checkout button; no real payment) ✓
46. Payment provider runtime env selection boundary (`createRuntime` selects a `PaymentProvider` from env; no auto-charge) ✓
47. Product purchase preview uses the runtime payment provider in preview-only mode (`?paymentPreview=1`) ✓
48. Product grant preview boundary (`source: "preview_only"`/`access: "not_granted"`; no real `PurchaseGrant`) ✓
49. EdgeRec real provider invocation boundary, disabled by default (`invokePromotionProviderPreview`; no auto-invoke) ✓
50. Runtime provider health/status page, read-only (`?runtimeStatus=1`; no provider/cache method calls) ✓
51. Runtime status page categorization (cache/storage/provider/bridge/security sections; still read-only) ✓
52. Promotion provider preview behind a dual flag (env + query, both required; product/space routes only) ✓
53. Provider preview diagnostics hardening (`disabled`/`provider_error`/`provider_preview` states; sanitized reasons) ✓
54. Runtime status JSON export, disabled by default (`?runtimeStatus=1&format=json`; strict allowlist) ✓
55. Runtime diagnostics docs hardening ([`docs/runtime_diagnostics.md`](docs/runtime_diagnostics.md); docs only, no code) ✓
56. Product purchase/grant preview polish (explicit "Preview only." notices, split grant-preview sentences, widened forbidden-word list; wording/attributes only, no gating change) ✓
57. Provider preview docs hardening ([`docs/provider_preview_safety.md`](docs/provider_preview_safety.md); docs only, no code) ✓
58. Runtime external health check boundary, disabled by default (`HealthCheckProvider`/`NoopHealthCheckProvider`/`DisabledHealthCheckProvider`; no real probe, not wired) ✓
59. FedOS core crypto package boundary ([`packages/fedos-core-rust`](packages/fedos-core-rust/README.md); `FedosCoreCrypto` seam + `PlaceholderFedosCoreCrypto` + host adapter; no Rust, no WASM, no crypto, not wired) ✓
60. WebAuthn / Passkey provider adapter skeleton (`src/identity/webauthn_adapter.ts`; `WebAuthnProvider` + Noop/Placeholder + pure Passkey bridge; no `navigator.credentials`, not wired) ✓
61. WebAuthn / Passkey adapter safety docs ([`docs/webauthn_passkey_safety.md`](docs/webauthn_passkey_safety.md); docs only, no code) ✓
62. WebAuthn runtime selection boundary, disabled by default (`createRuntime` selects a `WebAuthnProvider` from env; `AppRuntime.webAuthnProvider`; selection only, no `navigator.credentials`, no `begin`/`cancel`) ✓
63. FedOS core WASM loader boundary, disabled by default (`packages/fedos-core-rust/src/wasm_loader.ts`; `FedosCoreWasmLoader` + Noop/Placeholder + bridge helpers; no WASM/Rust/fetch/instantiate, not wired) ✓
64. FedOS core WASM loader safety docs ([`docs/fedos_core_wasm_safety.md`](docs/fedos_core_wasm_safety.md); docs only, no code) ✓
65. Runtime crypto provider selection boundary, disabled by default (`createRuntime` selects a `CryptoProvider` from env; `AppRuntime.cryptoProvider`; FedOS option wraps the inert `PlaceholderFedosCoreCrypto` only; selection only, no WASM load, no cryptography, no crypto-op call) ✓
66. Anti-analysis & Shadow Vault risk docs ([`docs/anti_analysis_shadow_vault_risks.md`](docs/anti_analysis_shadow_vault_risks.md); docs only, no code; binding prohibitions — no anti-debug/anti-VM, no self-destruct, no shadow/fake-data generator) ✓
67. Crypto operation test-vector plan ([`docs/crypto_test_vectors.md`](docs/crypto_test_vectors.md); docs only, no code, no vectors committed; test-first verification plan for a future Rust core — AEAD/HKDF/Argon2id/NIP-44, official vectors only) ✓
68. FedOS Core build manifest plan ([`docs/fedos_core_build_manifest.md`](docs/fedos_core_build_manifest.md); docs only, no code, no manifest committed; provenance contract — manifest skeleton, digest/signature/reproducible-build policy, no validation ⇒ no load) ✓
69. Minimal FedOS Rust crate skeleton ([`packages/fedos-core-rust`](packages/fedos-core-rust/README.md); `Cargo.toml` + `src/lib.rs` placeholder API; no dependencies, no crypto, no `unsafe`, no WASM/cdylib, no build artifacts; TS boundary unchanged, not wired) ✓
70. FedOS Core Rust crate safety docs ([`docs/fedos_core_rust_safety.md`](docs/fedos_core_rust_safety.md); docs only, no code; guardrails for unsafe / dependencies / crypto-crate adoption / secrets / randomness / WASM / build artifacts) ✓
71–99. FedOS Core Rust crate internal skeleton build-out (`packages/fedos-core-rust/src/lib.rs`; sixteen crate-private, label-only skeleton modules — `secret_handle`/`aead_core`/`kdf_core`/`key_material`/`domain_label`/`operation_context`/`request_descriptor`/`response_descriptor`/`crypto_pipeline`/`descriptor_bundle`/`execution_plan`/`error_taxonomy`/`audit_event`/`audit_policy`/`lifecycle_state`/`module_registry`; plus `chacha20poly1305`/`hkdf`/`zeroize`/`secrecy`/`subtle`/`argon2` dependency adoption and RFC 8439/5869/9106 `cargo test` vector wiring; public API UNCHANGED since Stage 69, not wired to Runtime/Worker/CryptoProvider) ✓
100. FedOS Core Architecture Freeze v1 ([`docs/fedos_core_architecture_freeze_v1.md`](docs/fedos_core_architecture_freeze_v1.md); docs only, no code, no `Cargo.toml` change; fixes the Stage 79–99 internal skeleton architecture — role table, explicitly-unconnected pairs, public API/Runtime/Worker/CryptoProvider non-wiring confirmed, what IS verified today vs. what is NOT yet implemented, non-claims section, recommended next-phase order) ✓ ← you are here

### Future candidate boundaries (design notes only — not scheduled)

These are **exploratory** layers sketched in
[`docs/vault_crypto_identity.md`](docs/vault_crypto_identity.md). Each is a
future, opt-in boundary kept OUT of the current core; nothing here is
implemented, and none carries a security guarantee. When picked up, each lands as
an interface + mock/no-op first, with its own review, respecting all existing
guardrails.

- **Vault Boundary** — local encrypted master-seed storage unlocked by an auth
  factor (Apple ID/Passkey as *unlock only*, never a key-derivation source). No
  key custody in the app. *(Stage 33 lands the interface + no-op/in-memory
  skeleton in `src/vault/` — shapes only, still no crypto/keys/seed.)*
- **Crypto Core Boundary** — a separate Rust crate (`packages/fedos-core-rust`,
  provisional) for AEAD + KDF + secret zeroing; managed-runtime memory-zeroing
  limits are documented, not hand-waved. AEAD mandatory, XOR forbidden. *(Stage 34
  lands the `CryptoProvider` interface + `NoopCryptoProvider` in `src/crypto/` —
  a TypeScript seam that fixes the future Rust-core swap point; shapes only, still
  no real crypto/keys/randomness.)*
- **Deniable Storage Research Boundary** — threat-model study of hidden/shadow
  vaults (TrueCrypt/VeraCrypt as *reference*), with leak vectors (size/padding/
  metadata/timestamp/access-pattern) named and **no production safety claim**.
  *(Stage 40 writes this up as docs only in
  [`docs/deniable_storage_research.md`](docs/deniable_storage_research.md) — the
  forbidden `finger_id`-style branch anti-pattern, IPFS/Nostr leak risks,
  forbidden UI wording, and the preconditions for any future work. No code, no
  crypto, no storage; future separate package only.)*
- **IPFS Asset Adapter** — a future public-media adapter behind the existing
  `AssetCache` boundary (gateway/pinning, not an embedded node); non-deletability,
  liveness, and traffic-analysis risks documented. Public/unlisted bytes only.
- **Notification Bridge** — APNs/FCM/Telegram/LINE as contentless, opt-in
  notification pointers (no secrets in payloads; provider metadata leakage noted).
- **Payment / Lightning Boundary** — a future external, non-custodial payment
  seam (Breez SDK / Greenlight as investigation candidates); liquidity is the
  hard problem. No payment implemented or scheduled.
