# nostr-window

A Reddit-style **window into Nostr**. Where Damus/Primal render Nostr as a
Twitter-like timeline, this product organizes the same underlying Nostr events
into Reddit-style threads, with paths toward communities, channels, groups, DMs,
digital goods, and promotion.

The architecture is a **Nostr + own-DB hybrid** (not fully decentralized at
first), targeting Cloudflare Workers + D1 + KV + R2.

> **Status: Stage 157–160 — Ciphertext envelope skeleton + public API
> planning.** A new `src/crypto/ciphertext_envelope.rs` turns
> `docs/ciphertext_envelope_plan.md`'s six planned fields into a concrete,
> `pub(crate)`-only skeleton: `AeadCiphertextEnvelope` holds `version:
> AeadEnvelopeVersion`, `algorithm: AeadEnvelopeAlgorithm`, `nonce: [u8;
> 12]`, a fixed `ciphertext_placeholder: [u8; 4]` marker (NOT real
> ciphertext‖tag), and `aad_domain: AeadEnvelopeAadDomain`.
> `AeadEnvelopeAlgorithm`/`AeadEnvelopeAadDomain` are deliberately NEW,
> SEPARATE types from `crypto::aead_internal`'s own `AeadCipher`/
> `AeadAadDomain` — this skeleton stays unconnected from the real AEAD
> implementation, same discipline as every other unconnected skeleton in
> this crate.
>
> `validate_envelope_internal` validates UNTRUSTED CANDIDATE field values
> (raw version/algorithm/AAD-domain discriminant bytes, a nonce byte
> slice, a ciphertext-placeholder byte slice) in order — version first,
> then algorithm, then AAD domain, then nonce length, then the ciphertext
> placeholder's exact bytes — returning a fixed `AeadEnvelopeStatus`. No
> AEAD authentication/decryption is performed (no real ciphertext exists
> yet), and no serialization/deserialization of any wire format exists —
> this is validation of already-split candidate values, not a codec.
>
> `docs/ciphertext_envelope_plan.md` section 9 fixes, in writing only, the
> shape a FUTURE Stage 161 bridge would take to connect
> `crypto::aead_internal`'s real seal/open results to a real (non-
> placeholder) envelope — not built this stage.
> `docs/public_encrypt_decrypt_api_plan.md` (new) fixes the shape a future
> PUBLIC `encrypt`/`decrypt` API would take: key input as `SecretHandle`
> only (never a raw byte/password/seed), nonce always internal or
> envelope-extracted (never caller-supplied), ciphertext as an envelope
> type, AAD as a fixed domain-label selection. Runtime/storage
> connections and NIP-44 are all explicitly named as their own, later,
> separate stages.
>
> **Still NOT implemented**: public `encrypt`/`decrypt`/`deriveKey`, any
> serialization (JSON/base64/CBOR/`serde`), the envelope↔AEAD seal/open
> bridge (ciphertext stays a fixed placeholder), NIP-44,
> Runtime/Worker/storage/WASM wiring.
>
> This crate's public `pub fn` surface is UNCHANGED (still twenty-four
> functions) — every new item is `pub(crate)`-at-most. `cargo check`/
> `cargo test` (174 crate unit tests, up from 162 — 12 net new
> `ciphertext_envelope` tests)/`cargo check --tests` all GREEN. `npm run
> typecheck`/`npm test` GREEN (137 files, 2046 tests, up from 136/2031 —
> one new guard file,
> [`test/fedos_core_rust_ciphertext_envelope.test.ts`](test/fedos_core_rust_ciphertext_envelope.test.ts)
> (15 tests)). `git status` clean aside from this batch's intended files.
>
> See `docs/ciphertext_envelope_plan.md` and
> `docs/public_encrypt_decrypt_api_plan.md` for the full design records.
> Stage 161 candidates: (1) Internal AEAD envelope seal/open bridge
> (recommended first — connect the envelope to real ciphertext before the
> public boundary); (2) Public `encrypt`/`decrypt` API skeleton; (3) NIP-44
> internal implementation planning.
> Prior status:
>
> **Stage 152–156 — AEAD Internal Foundation.** A new
> `src/crypto/aead_internal.rs` gives this crate its FIRST real AEAD
> implementation: `seal_internal`/`open_internal` implement BOTH
> ChaCha20-Poly1305 (Stage 74) and AES-256-GCM (Stage 101), consuming
> ONLY a `SecretHandle(AeadKeyMaterial)` key and a `Ready`
> `FedosAeadNonceDecision` nonce (from `fedos_aead_nonce_96`, Stage 138) —
> never a caller-supplied raw key/nonce byte. `SecretHandle` gains a
> SECOND narrowly-scoped accessor, `expose_bytes_for_internal_aead`
> (method count seven → eight). Misuse guards run BEFORE any cipher is
> touched (`InvalidKey`/`InvalidNonce`); decryption failure is a SINGLE
> fixed `AuthenticationFailed` label. `Cargo.toml` UNCHANGED. Stage 155
> adds `aead_diagnostics` (both ciphers `Ready`).
>
> **Still NOT implemented** (as of that stage): public `encrypt`/
> `decrypt`, a ciphertext envelope/serialization format, NIP-44,
> Runtime/Worker/storage/WASM wiring.
> Prior status:
>
> **Stage 147–151 — Crypto Core Boundary Completion (HKDF internal
> implementation + capability matrix + diagnostics preview).** The
> crate-private `kdf_core` module (Stage 82) gains its FIRST real
> implementation: `derive_secret_handle_internal(input: &SecretHandle,
> domain: HkdfDomain) -> HkdfDecision` derives a NEW
> `SecretHandle(HkdfOutputMaterial)` from an existing
> `SecretHandle(HkdfInputMaterial)` via HKDF-SHA256 (RFC 5869), using a
> fixed, `HkdfDomain`-selected salt/info (`RootKey`/`Identity`/`Storage`/
> `Conversation`/`TestOnly`) — never caller-supplied, never random. Real
> domain separation is `cargo test`-verified: two domains, same input,
> produce different output bytes. `SecretHandle` gains one new,
> narrowly-scoped `pub(crate)` accessor,
> `expose_bytes_for_internal_derivation` (method count six → seven) — still
> no public raw-byte accessor anywhere. `Cargo.toml`'s ONLY change: `sha2`
> promoted from `[dev-dependencies]` to `[dependencies]` (mandatory — `hkdf`
> needs a concrete hash algorithm to instantiate in production code).
>
> Stage 150–151 add a crate-private `crypto` module — this crate's FIRST
> multi-file module (`src/crypto.rs` + `src/crypto/capability_matrix.rs` +
> `src/crypto/diagnostics.rs`, vs. every prior module being inline in
> `src/lib.rs`): a fixed nine-capability label enum (`CryptoCapability` —
> Random/Nonce/SecretHandle/Hkdf/Aead/Nip44/Schnorr/StorageKey/
> ConversationKey) and a fixed, hand-maintained, DISPLAY-ONLY
> `crypto_diagnostics_preview()` reporting Random/Nonce/SecretHandle/Hkdf as
> `Ready`, Aead as `NotConnected`, and Nip44/Schnorr/StorageKey/
> ConversationKey as `NotImplemented` — never a live probe, never touching
> a secret byte.
>
> **Still NOT implemented**: AEAD execution, `encrypt`/`decrypt`, NIP-44,
> public `deriveKey` API, Runtime/Worker/WASM wiring, `domain_label`
> (Stage 88) connection.
> Prior status:
>
> **Stage 144–146 — SecretHandle real-byte implementation.** The
> crate-private `secret_handle` module (Stage 79) gains its FIRST real-byte
> construction path,
> `new_from_32_bytes_for_internal_use(kind: SecretHandleKind, bytes: [u8; 32])`,
> alongside a new `SecretHandleKind` classification label (`Placeholder` /
> `AeadKeyMaterial` / `HkdfInputMaterial` / `HkdfOutputMaterial` /
> `NostrKeyMaterial` / `TestOnlySecretMaterial`) and `SecretInputLength`
> (exactly one variant, `ThirtyTwo`). `new_placeholder()` (Stage 79) is
> UNCHANGED; both construction paths coexist on the same type. Implements
> the design the Stage 141–143 docs-only batch fixed in writing (below,
> under "Prior status").
>
> `SecretHandle` now holds real 32-byte secret material wrapped in
> `secrecy::SecretBox`, zeroized on `clear()` and again on drop (proven via
> a `#[cfg(test)]`-only atomic counter — never a production code path, never
> exposing a byte). No `Clone`, no `Debug` over raw bytes, no `Display`, no
> `Serialize`, no raw-secret `Eq`/`PartialEq`, no public raw-byte accessor,
> and no connection to `fedos_random_bytes_32`/`fedos_aead_nonce_96`/HKDF/
> AEAD/Runtime/Worker/WASM — all remain exactly as unconnected as before
> this stage. `Cargo.toml` is UNCHANGED. This crate's public `pub fn`
> surface is UNCHANGED (still twenty-four functions) — every new item is
> `pub(crate)`-at-most.
>
> `cargo check`/`cargo test` (127 crate unit tests, up from 119 — 12 net
> new `secret_handle` tests)/`cargo check --tests` all GREEN. `npm run
> typecheck`/`npm test` GREEN (132 files, 1979 tests, up from 131/1963 — one
> new guard file
> ([`test/fedos_core_rust_secret_handle_real_bytes.test.ts`](test/fedos_core_rust_secret_handle_real_bytes.test.ts),
> 16 tests) plus the existing
> [`test/fedos_core_rust_secret_handle.test.ts`](test/fedos_core_rust_secret_handle.test.ts)
> updated for the four-variant state enum and six-method set). `git status`
> clean aside from this stage's intended files.
>
> **What this stage deliberately does NOT do**: no HKDF connection, no AEAD
> connection, no `deriveKey`/`encrypt`/`decrypt` public API change, and no
> Runtime/Worker/WASM wiring — each is its own future, separate,
> explicitly-reviewed stage.
> Prior status:
>
> **Stage 141–143 — SecretHandle real-byte implementation
> preparation (docs only).** A three-stage, **docs-only** batch that
> fixes the concrete type/method shape and test strategy a future stage
> must satisfy before `SecretHandle` (Stage 79) is extended to hold real
> secret bytes. **No `src/`, `packages/`, `Cargo.toml`, or `test/` file
> was touched — no real bytes given to `SecretHandle`, no HKDF/AEAD
> wiring, and no Runtime/Worker change of any kind.**
>
> **Stage 141 — [`docs/secret_lifecycle_implementation_plan.md`](docs/secret_lifecycle_implementation_plan.md)
> §14 update.** Records that Stage 137's `fedos_random_bytes_32` and
> Stage 138's `fedos_aead_nonce_96` are now both real, `cargo test`-verified
> implementations — the two preconditions
> `docs/implementation_phase_roadmap.md` §1 placed before `SecretHandle`
> real bytes are done, and `SecretHandle` real bytes is next but still
> **NOT implemented**. Fixes explicitly that `SecretHandle` must never
> call `fedos_random_bytes_32`/`fedos_aead_nonce_96` itself (it receives
> already-drawn bytes as a constructor parameter) and must not connect to
> HKDF or AEAD in the same stage that gives it real bytes — both
> connections remain their own, later, separate stages.
>
> **Stage 142 — [`docs/secret_handle_api_shape.md`](docs/secret_handle_api_shape.md)
> (new).** Fixes the concrete type/method shape: five candidate types
> (`SecretHandleState`, `SecretHandleKind`, `SecretHandle`,
> `SecretHandleStatus`, `SecretInputLength`) and five candidate methods
> (`new_from_32_bytes_for_internal_use`, `status`, `kind`, `clear`,
> `is_cleared`). Input starts at a fixed-size `[u8; 32]` only —
> `Vec<u8>` and `String`/password input stay forbidden. `Clone`, raw-byte
> `Debug`, public `AsRef<[u8]>`, `Display`, `Serialize`, and raw-secret
> `Eq`/`PartialEq` are all explicitly forbidden. Names the future
> HKDF/AEAD connection shape without building it.
>
> **Stage 143 — [`docs/secret_memory_test_strategy.md`](docs/secret_memory_test_strategy.md)
> (new).** Fixes the concrete test gates: `Clone`-absence proof,
> `Debug`-no-raw-byte assertion, `clear()`/`is_cleared()` state-machine
> checks (including double-clear idempotency), a drop-time zeroize
> verification approach (with its use-after-free-adjacent caveat named
> explicitly), no-raw-exposure and exact-method-set assertions, and
> no-`Vec`/`String`/`serde` checks. Panic-time zeroization and WASM-time
> behavior are named as open, untested limitations, not solved problems;
> Miri/Valgrind/sanitizer tooling is recorded as valuable future work, not
> a blocker for the first real-byte stage.
>
> **This batch is docs-only, with no Rust/`src`/`test` change of any
> kind.** `npm run typecheck` and `npm test` stay GREEN (131 files, 1963
> tests, unchanged); `cargo check`/`cargo test`/`cargo check --tests`
> were re-confirmed GREEN in the `stable-x86_64-pc-windows-msvc` toolchain
> this session, unaffected since no `.rs`/`Cargo.toml` file was touched;
> `git status` is clean aside from this docs batch. **The next step is
> the `SecretHandle` real-byte implementation itself** — the
> Implementation Phase has landed `randomBytes` (Stage 137) and the nonce
> helper (Stage 138) but has not yet touched `SecretHandle`. Stage 144
> candidates: (1) **`SecretHandle` real-byte implementation** (recommended
> first — the shape and test gates are now fixed in writing, so the next
> stage can implement directly against
> `docs/secret_handle_api_shape.md`/`docs/secret_memory_test_strategy.md`
> rather than designing under pressure); (2) HKDF internal implementation
> planning update; (3) AEAD implementation staging docs.
> Prior status:
>
> **Stage 138–140 — Fixed-size AEAD nonce helper + Stage 137
> cargo-verification gate closed.** `packages/fedos-core-rust/src/lib.rs`
> gains `fedos_aead_nonce_96()` — the crate's SECOND real implementation,
> drawing exactly 12 bytes (96 bits) from the OS CSPRNG via
> `getrandom::fill`, independent of Stage 137's `fedos_random_bytes_32`
> (neither calls the other). `FedosAeadNonceKind` (one variant,
> `NinetySixBit`), `FedosNonceState` (`Ready` / `EntropySourceUnavailable`
> — its own independent type, not shared with `FedosRandomBytesState`),
> and `FedosAeadNonceDecision` (`kind`/`state`/`nonce: Option<[u8; 12]>`)
> round out the group. The public `pub fn` surface grows from twenty-three
> (Stage 137) to twenty-four.
>
> **Implements `docs/nonce_generation_policy.md`'s MVP decision (Stage
> 134) exactly**: a CSPRNG-drawn random nonce, never a counter, never
> deterministic, never derived from a seed/password/user id — the
> function accepts no parameter of any kind. A CSPRNG failure returns
> `EntropySourceUnavailable` with `nonce: None` — no fallback PRNG, no
> panic. **This is a nonce-DRAWING helper ONLY**: no AEAD seal/open, no
> encrypt/decrypt, no key derivation, and no connection to
> `encrypt_placeholder`/`decrypt_placeholder` (Stage 69), `aead_core`
> (Stage 80), `kdf_core` (Stage 82), or `SecretHandle` (Stage 79) — a
> future AEAD stage would need to be the one to call this helper, and
> that wiring does not exist yet. `Cargo.toml` is UNCHANGED; no
> Runtime/Worker/WASM wiring.
>
> New [`test/fedos_core_rust_aead_nonce.test.ts`](test/fedos_core_rust_aead_nonce.test.ts)
> (20 tests) and a new `#[cfg(test)]`-only `aead_nonce_wiring` module in
> `src/lib.rs` (6 tests: exact 12 bytes returned, two calls differ — a
> non-determinism sanity check, not a randomness proof — the fixed
> failure shape, the single-variant kind enum, no panic across repeated
> calls, and independence from `fedos_random_bytes_32`) cover the new
> boundary. Thirty-one existing `fedos_core_rust_*.test.ts` guard files
> were updated for the new twenty-four-function `pub fn` total, and one
> pre-existing invariant test
> ([`test/fedos_core_rust_aes_gcm_wiring.test.ts`](test/fedos_core_rust_aes_gcm_wiring.test.ts))
> gained a narrow, explicit exception for the one reviewed `nonce` field
> this stage introduces.
>
> **Stage 137's cargo-verification gate — outstanding since that stage's
> own status report — is now CLOSED.** No Rust toolchain existed in the
> working environment; a `stable-x86_64-pc-windows-msvc` toolchain
> (rustc/cargo 1.96.1) was installed (Visual Studio Build Tools 2026 +
> `rustup`, after the GNU host's bundled linker turned out to be
> incomplete) and `cargo check`/`cargo test`/`cargo check --tests` all ran
> GREEN — 113 crate unit tests passed at Stage 137 (119 after this
> stage's own nonce tests), including all five dedicated
> `random_bytes_wiring` tests. **No code fix was needed** — Stage 137's
> implementation compiled and passed on the first real `cargo test` run.
> `docs/random_bytes_implementation_plan.md` §15 and
> `docs/nonce_generation_policy.md` §16 record this. `npm run typecheck`
> and `npm test` stay GREEN (131 files, 1963 tests). Where this batch
> stopped, on purpose: no AEAD/encrypt/decrypt/deriveKey implementation,
> no `SecretHandle` real bytes, no WASM, and no Runtime/Worker wiring —
> see `docs/implementation_phase_roadmap.md`. Stage 141 candidates: (1)
> `SecretHandle` real-byte implementation PLANNING update (recommended
> first — finalize the real-byte design in writing, per
> `docs/secret_lifecycle_implementation_plan.md`, before touching the
> type); (2) `SecretHandle` real-byte implementation; (3) HKDF internal
> implementation.
> Prior status:
>
> **Stage 137 — Rust `randomBytes` implementation.** The
> Implementation Phase's FIRST real code: `packages/fedos-core-rust/src/lib.rs`
> gains `FedosRandomBytesLength` (one variant, `ThirtyTwo`),
> `FedosRandomBytesState` (`Ready` / `EntropySourceUnavailable`),
> `FedosRandomBytesDecision` (`length`/`state`/`bytes: Option<[u8; 32]>`),
> and one new function, `fedos_random_bytes_32()`, which draws exactly 32
> bytes from the OS CSPRNG via `getrandom::fill` — the FIRST time
> `getrandom` (adopted Stage 104, build-check only until now) is actually
> imported and called anywhere in this crate, production or test. The
> public `pub fn` surface grows from twenty-two (Stage 106) to
> twenty-three.
>
> **Scope, exactly as planned Stage 134–136:** output length is fixed at
> 32 bytes, selected by a label, never an open caller-supplied count — no
> zero-length request exists. A CSPRNG failure returns
> `EntropySourceUnavailable` with `bytes: None` — no fallback PRNG, no
> `rand`/`thread_rng`/`Math.random()`-equivalent substitute, and no panic
> (`getrandom::fill`'s `Result` is matched exhaustively, never
> `.unwrap()`/`.expect()`-ed). **No nonce generation, no key generation,
> no key derivation, and no AEAD/KDF/NIP-44 operation is added or
> connected** — `SecretHandle` (Stage 79), `aead_core` (Stage 80), and
> `kdf_core` (Stage 82) remain exactly as placeholder as before this
> stage; `random_bytes_placeholder` (Stage 69) and
> `fedos_random_boundary_status`/`FedosRandomBoundary` (Stage 103) are
> byte-for-byte unchanged. `Cargo.toml` is UNCHANGED (no dependency
> change). **No WASM target/loader and no Runtime/Worker/`CryptoProvider`
> wiring** — `fedos_random_bytes_32` is reachable only by directly calling
> the crate.
>
> New [`test/fedos_core_rust_random_bytes.test.ts`](test/fedos_core_rust_random_bytes.test.ts)
> (20 tests) covers the new declarations, the fixed-length/no-caller-
> parameter shape, the single `getrandom::fill` call site matched
> exhaustively, the no-fallback-PRNG guarantee, and (checked structurally,
> not by a bare word match, since this stage's own doc comments legitimately
> NAME "nonce"/"NIP-44"/"SecretHandle"/"Runtime"/"Worker" to say none is
> done) that none of those is actually implemented or connected. A new
> `#[cfg(test)]`-only `random_bytes_wiring` module in `src/lib.rs` (kept
> separate from Stage 104's label-only `csprng_verification_infrastructure`
> plan) covers: a successful call returns exactly 32 bytes tagged `Ready`;
> two calls in immediate succession differ (a non-determinism sanity
> check, not a statistical randomness proof —
> [`docs/random_bytes_implementation_plan.md`](docs/random_bytes_implementation_plan.md)
> §12 fixed this distinction in advance); the fixed
> `EntropySourceUnavailable` failure shape is constructed and asserted
> directly, since fault-injecting a real OS CSPRNG failure isn't practical
> in a portable `cargo test`; and ten repeated calls do not panic. Twenty-
> six existing `fedos_core_rust_*.test.ts` guard files were updated for
> the new twenty-three-function `pub fn` total (mechanical `22 → 23`
> bumps plus the new function name added to each expected list/whitelist);
> two Stage-106 tests
> ([`test/fedos_core_rust_algorithm_policy.test.ts`](test/fedos_core_rust_algorithm_policy.test.ts),
> [`test/fedos_core_rust_key_usage_label.test.ts`](test/fedos_core_rust_key_usage_label.test.ts))
> had their section-extraction end marker narrowed from "Stage 79" to
> Stage 137's own marker so their scope stays exactly what Stage 106
> added — the same narrowing pattern this repo used when Stage 103 first
> landed after Stage 102; and
> [`test/fedos_core_rust_getrandom_adoption.test.ts`](test/fedos_core_rust_getrandom_adoption.test.ts)'s
> Stage 104 "never calls getrandom" assertion was narrowed to "calls it
> only inside `fedos_random_bytes_32`." `npm run typecheck` and `npm test`
> stay GREEN (129 → 130 test files, 1923 → 1943 tests); `cargo` remains
> unavailable in this environment (confirmed again this stage), so `cargo
> check`/`cargo test`/`cargo check --tests` could not be re-run here — the
> new Rust code and its `#[cfg(test)]` coverage should be verified in an
> environment with `cargo` on `PATH` before Stage 138 builds on top of it.
> Where this stage stopped, on purpose: no nonce/encrypt/decrypt/deriveKey
> implementation, no `SecretHandle` real bytes, no WASM, and no Runtime/
> Worker wiring of any kind — see
> [`docs/implementation_phase_roadmap.md`](docs/implementation_phase_roadmap.md)
> for why each is its own later, separate stage. Stage 138 candidates: (1)
> a nonce helper implementation (recommended — narrow, AEAD-internal-only,
> building directly on this stage's `getrandom` wiring per
> [`docs/nonce_generation_policy.md`](docs/nonce_generation_policy.md));
> (2) `SecretHandle` real-byte implementation planning update; (3)
> randomBytes WASM behavior docs.
> Prior status:
>
> **Stage 134–136 — Nonce / Random / Secret lifecycle
> implementation-prep docs (docs only).** A three-stage, **docs-only**
> batch that fixes the last safety-design questions before the
> Implementation Phase begins. **No `src/`, `packages/`, `Cargo.toml`, or
> `test/` file was touched — no `randomBytes` implementation, no nonce
> generation implementation, no `SecretHandle` implementation change, no
> HKDF/AEAD wiring, and no Runtime/Worker change of any kind.**
>
> **Stage 134 — [`docs/nonce_generation_policy.md`](docs/nonce_generation_policy.md).**
> Fixes the nonce policy `docs/public_random_boundary.md` (Stage 103) and
> `docs/public_random_design.md` (Stage 104) deliberately deferred:
> unconditional (key, nonce) reuse prohibition for every AEAD candidate
> (ChaCha20-Poly1305 and AES-GCM, both 96-bit nonces; XChaCha20-Poly1305's
> 192-bit nonce named as a future option); a random-vs-counter comparison
> concluding the MVP draws a CSPRNG random nonce (this codebase has no
> durable, crash-safe counter-persistence mechanism today, and building one
> is a strictly larger, separate undertaking); deterministic and
> seed/password/user-id-derived nonces forbidden outright, with no
> fallback on CSPRNG failure — the whole `encrypt` operation aborts
> instead; a nonce is not a secret but must never be exposed as a
> standalone public function or reused; storage/transmission travels with
> the ciphertext in the clear; a test policy banning any "reuse works"
> test; and NIP-44's own upstream-defined nonce construction taking
> precedence for NIP-44 traffic specifically, while §2's reuse ban and §7's
> determinism ban still apply unconditionally to it.
>
> **Stage 135 — [`docs/random_bytes_implementation_plan.md`](docs/random_bytes_implementation_plan.md).**
> Fixes the preconditions for a real `randomBytes`: `getrandom` (Stage 104)
> is adopted but called by zero lines of code anywhere, prod or test;
> output length is always a fixed, small, label-selected size, never an
> open caller-supplied count, so a zero-length request is not even
> representable; an OS CSPRNG failure surfaces as one fixed error label
> and must never fall back to a secondary/software PRNG, `Math.random()`,
> or any degraded output; a deterministic/seeded RNG may exist only under
> `#[cfg(test)]`, never in a production path; WASM loading stays an
> explicitly separate, later stage; and a four-category test strategy
> (linkage, exact length, `Result::Err`-not-panic on failure,
> non-determinism between calls) that deliberately does not attempt a
> known-answer vector, since none exists for randomness by design.
>
> **Stage 136 — [`docs/secret_lifecycle_implementation_plan.md`](docs/secret_lifecycle_implementation_plan.md).**
> Fixes the policy for giving `SecretHandle` (Stage 79) real bytes instead
> of its current placeholder marker: `secrecy`/`zeroize` wrap and
> zeroize-on-drop every real secret; `Clone` is forbidden on any
> real-secret type; `Debug`/`Display`/logging of the raw value is
> forbidden, with only a non-sensitive placeholder representation
> permitted; zeroize-on-drop is the guarantee made, while panic-safety and
> core-dump exposure are explicitly named as an unsolved, deferred concern
> per the existing safety docs, never oversold as solved; no public
> function may ever return or accept raw secret bytes, only opaque
> handles; HKDF connects to `SecretHandle` before AEAD connects to HKDF's
> output, each its own reviewed stage; memory-safety limitations
> (compiler-introduced copies, OS paging, core dumps, WASM's own model) are
> stated plainly rather than wished away; and a test strategy covering the
> `Clone` ban, the `Debug` ban, zeroize-on-drop, and the no-raw-bytes-on-
> the-public-API guarantee.
>
> **This batch is docs-only, with no Rust/`src`/`test` change of any
> kind.** `npm run typecheck` and `npm test` (129 files, 1923 tests) stay
> GREEN; `git status` is clean aside from this docs batch (the
> pre-existing untracked `.claude/` directory is unrelated); `cargo` is not
> on `PATH` in this environment, so `cargo check`/`cargo test` were not
> re-run this batch either — unchanged from Stage 131–133, and moot anyway
> since no `.rs`/`Cargo.toml` file was touched. **The next step is the Rust
> `randomBytes` implementation** (`docs/implementation_phase_roadmap.md`
> §1 item 2, now that item 1's nonce policy is fixed) — the Implementation
> Phase has still not started as of Stage 136. Stage 137 candidates: (1)
> **Rust `randomBytes` implementation** (recommended first — the nonce/
> random/secret-lifecycle policies this batch fixed are now all in place,
> so the minimal real implementation, wiring the already-adopted
> `getrandom` behind the already-designed boundary, is the safest next
> step); (2) `SecretHandle` real-byte implementation; (3) a nonce helper
> skeleton.
> Prior status:
>
> **Stage 131–133 — Boundary Phase index + Implementation
> readiness checklist + Phase transition roadmap (docs only).** A
> three-stage, **docs-only** batch that closes out FedOS's Boundary Phase
> (Stage 1–130) and fixes the map for the next one. **No `src/`,
> `packages/`, `Cargo.toml`, or `test/` file was touched — no new
> boundary, no new preview, no new implementation, and no Runtime/Worker/
> Rust change of any kind.**
>
> **Stage 131 — [`docs/boundary_phase_index.md`](docs/boundary_phase_index.md).**
> A single cross-cutting index over every boundary shipped Stage 1–130,
> organized into ten categories (Crypto/Identity/Storage/Federation/
> Social/Creator/Governance/Device/Preview/Docs) instead of chronology —
> each entry names its stage number, file(s), role, implemented scope, and
> explicit NOT-implemented scope. Its conclusion (§12) restates, in one
> place, that real cryptography, real network transport, real payment/
> settlement, and real persistent storage do not exist anywhere in this
> codebase — every provider shipped is `Noop*`/`Placeholder*`/in-memory/
> mock, with the narrow exceptions already on record (NIP-07 delegation,
> Noble Schnorr verification, D1/KV/R2/MeshKV behind opt-in gates, and the
> RFC/NIST-vector-verified `cfg(test)`-only AEAD/KDF crates).
>
> **Stage 132 — [`docs/implementation_readiness_checklist.md`](docs/implementation_readiness_checklist.md).**
> A `[ ]`/`[x]` checklist across six areas — Crypto (`randomBytes`, nonce
> policy, `SecretHandle` real bytes, HKDF/AEAD internal implementation,
> public `encrypt`/`decrypt`/`deriveKey`), Storage (local-only-first
> sequencing, encrypted packet format, no Google Drive direct dependency),
> Federation (Nostr signing, relay connection, publish-queue retry
> policy), Creator (listing/entitlement models, payment deferred),
> Security (threat model, secret lifecycle, logging ban, no shadow-vault/
> anti-analysis implementation), and Testing (RFC vectors green, no
> secrets in logs, no Runtime auto-call without an explicit flag) — each
> item cites the exact stage/doc that satisfies it, or names it as an open
> blocker for Stage 134+. An `[x]` marks a **precondition** satisfied
> (a policy or safety-rule doc exists), never that the real primitive is
> implemented; §7 records this session's verified baseline (`npm run
> typecheck` green; `npm test` **129 files, 1923 tests**, green; `cargo`
> not on `PATH` in this environment, so `cargo check`/`cargo test` were
> not re-run — no Rust file has changed since Stage 106's last recorded
> green run).
>
> **Stage 133 — [`docs/implementation_phase_roadmap.md`](docs/implementation_phase_roadmap.md).**
> Fixes the recommended Stage 134+ order — ten items from a nonce-policy
> doc through Nostr signing/publish, each its own reviewed stage — plus
> why each is split rather than merged, three cross-domain combinations
> that are explicitly forbidden (crypto+storage+federation in one stage,
> payment+entitlement in one stage, NIP-44+chat in one stage), a rollback
> strategy (every stage independently revertible, every opt-in flag
> defaults off, no vector/guard-test weakening to force a revert to pass),
> and the test gates every future stage must clear. It deliberately
> reorders `docs/fedos_core_architecture_freeze_v1.md` §11's plain
> adoption list: nonce generation policy now comes **before** the
> `randomBytes` implementation, since `getrandom` is already adopted
> (Stage 104) and fixing nonce discipline in writing first prevents the
> exact (key, nonce) reuse accident that discipline exists to prevent once
> a real AEAD implementation lands.
>
> **Boundary Phase: complete.** Stage 1–130 shipped the full boundary/
> preview surface across every domain this product needs; Stage 131–133
> closes that phase with an index, a readiness checklist, and a roadmap
> instead of one more boundary. **The Implementation Phase has not
> started.** No `randomBytes`, nonce policy, `SecretHandle` real bytes,
> HKDF/AEAD internal implementation, public `encrypt`/`decrypt`/
> `deriveKey`, WASM build, Runtime crypto opt-in, local encrypted storage,
> or Nostr signing/publish exists yet — Stage 134 is the first stage that
> may begin it. `npm run typecheck` and `npm test` (129 files, 1923 tests)
> stay GREEN; `git status` is clean aside from this docs batch (the
> pre-existing untracked `.claude/` directory is unrelated). Stage 134
> candidates, in the roadmap's recommended order: (1) **nonce generation
> policy docs** (short, docs-only — fixes the scheme/source/reuse-
> prevention question before any byte-producing code); (2) **Rust
> `randomBytes` implementation** (wires the already-adopted `getrandom`
> dependency, following the nonce policy item); (3) `SecretHandle`
> real-byte implementation planning (paired with its zeroize guarantee,
> per `docs/fedos_core_rust_safety.md` §6).
> Prior status:
>
> **Stage 119–130 — Boundary Completion Batch (Protocol Adapter /
> Creator Governance / Identity & Device suites).** A twelve-stage batch
> completing FedOS's design-boundary phase — still **no relay/WebSocket/
> fetch/OAuth connection, no signing, no publish/subscribe, no real crypto,
> no real storage, no payment/Lightning/Stripe, no Runtime auto-call, no
> Worker auto-communication, and no `Cargo.toml`/Rust change of any kind.**
> Every addition is a fixed TypeScript type, a pure review/summary
> function, or a read-only preview page — exactly the "Placeholder /
> Label-only / Pure function" posture this batch was scoped to stop at.
>
> **Protocol Adapter suite (Stage 119–122):** new
> [`docs/bluesky_adapter_planning.md`](docs/bluesky_adapter_planning.md),
> [`docs/threads_adapter_planning.md`](docs/threads_adapter_planning.md),
> and [`docs/rss_adapter_planning.md`](docs/rss_adapter_planning.md) mirror
> `docs/nostr_adapter_planning.md`'s structure for the three other
> `ProtocolAdapterKind`s named since Stage 117 — each fixes a compatibility
> posture and a candidate-mapping table, and each confirms its
> `capability_matrix.ts` row stays `unavailable` outside the trivial test
> capability. New
> [`src/federation/queue_status_preview.ts`](src/federation/queue_status_preview.ts)
> defines a narrower, DISPLAY-ONLY vocabulary over the Stage 118 outbound
> queue — `QueueStatusPreviewState` (`queued_placeholder`/`idle_placeholder`
> ONLY) and a pure `summarizeQueueStatusPreview(queue)` fold reporting one
> `QueuePreviewDescriptor` (`adapterKind`/`itemCountPlaceholder`/`state`)
> per adapter kind — it never calls `enqueuePlaceholder`/
> `dequeuePlaceholder` itself, just counts an array a caller already holds.
> New [`src/render/queue_preview.ts`](src/render/queue_preview.ts), gated by
> `?queuePreview=1`, and [`docs/federation_queue.md`](docs/federation_queue.md)
> round out the boundary docs.
>
> **Creator Governance suite (Stage 123–126):** four new pure boundaries —
> [`src/creator/appeal.ts`](src/creator/appeal.ts) (`CreatorAppealDescriptor`/
> `reviewCreatorAppeal`, a labeled DISPUTE record, never an enforcement/
> reversal), [`src/creator/reputation.ts`](src/creator/reputation.ts)
> (`ReputationSignalDescriptor`/`reviewReputationSignal`, a FIXED
> `CreatorReputationLabel` — never a numeric score/weight/rank),
> [`src/creator/subscription_policy.ts`](src/creator/subscription_policy.ts)
> (`SubscriptionPolicyTargetInput`/`reviewSubscriptionPolicyTarget` —
> STRUCTURALLY conservative: only `public_placeholder` ever resolves to
> `visible_placeholder`; every gated tier resolves to
> `restricted_placeholder` UNCONDITIONALLY, no real entitlement ever
> checked), and
> [`src/community/treasury_policy.ts`](src/community/treasury_policy.ts)
> (`CommunityTreasuryDisclosureRequest`/`reviewCommunityTreasuryDisclosure`
> — a CATEGORY-name disclosure policy that computes no balance/amount/fund
> of any kind). New
> [`src/render/creator_governance_preview.ts`](src/render/creator_governance_preview.ts),
> gated by `?creatorGovernancePreview=1`, and
> [`docs/creator_governance.md`](docs/creator_governance.md) cover all four.
> None of the four implements a DAO, a vote, a payment, a settlement, or a
> real treasury balance.
>
> **Identity & Device suite (Stage 127–130):** four new pure boundaries —
> [`src/identity/device_registration.ts`](src/identity/device_registration.ts)
> (`DeviceRegistrationDescriptor`/`reviewDeviceRegistration`, a device NAME
> label, never a pairing/key exchange/sync),
> [`src/identity/device_trust.ts`](src/identity/device_trust.ts)
> (`DeviceTrustLabel`/`reviewDeviceTrust`, mirroring
> `src/creator/profile.ts`'s trust-label convention — never a real
> attestation),
> [`src/identity/session_boundary.ts`](src/identity/session_boundary.ts)
> (`SessionRequestDescriptor`/`reviewSessionRequest` — `start_`/`end_`/
> `refresh_placeholder` map 1:1 to `active_`/`ended_`/`refreshed_placeholder`,
> never a real session created/stored/invalidated), and
> [`src/identity/recovery_policy.ts`](src/identity/recovery_policy.ts)
> (`IdentityRecoveryRequestDescriptor`/`reviewIdentityRecoveryRequest` — the
> strictest boundary in this batch, given the subject matter). ALL FOUR
> reject any password/recovery-phrase/mnemonic/seed/backup/export/import/
> sync/authentication field in metadata, on top of this codebase's usual
> conservative marker family — the strictest guardrail set in this
> codebase. New
> [`src/render/device_preview.ts`](src/render/device_preview.ts), gated by
> `?devicePreview=1`, and
> [`docs/device_identity_boundary.md`](docs/device_identity_boundary.md)
> cover all four.
>
> **Worker wiring:** three new EXPLICIT flags —
> `?queuePreview=1`/`?creatorGovernancePreview=1`/`?devicePreview=1` — were
> inserted into [`src/worker.ts`](src/worker.ts) right after the Stage 118
> `?creatorAnalyticsPreview=1` branch, extending the SAME precedence chain:
> runtimeStatus → boardPreview → marketplacePreview → creatorPreview →
> communityRulesPreview → creatorDashboardPreview → creatorAnalyticsPreview
> → queuePreview → creatorGovernancePreview → devicePreview → normal
> routing. Every new branch reads no `runtime` and calls no Runtime-selected
> boundary; every pre-existing route is unaffected. New
> [`test/protocol_adapter_suite.test.ts`](test/protocol_adapter_suite.test.ts)
> (20 tests),
> [`test/creator_governance_suite.test.ts`](test/creator_governance_suite.test.ts)
> (30 tests), and
> [`test/identity_device_suite.test.ts`](test/identity_device_suite.test.ts)
> (30 tests) check: every new type is placeholder-labeled, every review
> function rejects its sensitive-marker family without mutating input, the
> subscription policy stays structurally conservative regardless of any
> supplied viewer tier, the treasury/reputation boundaries carry no numeric
> field, all three new preview flags gate correctly with the full
> precedence chain verified, and no new source imports a relay/WebSocket/
> fetch/OAuth library, calls a provider method, or reads a Runtime-selected
> boundary from the Worker. `npm run typecheck` and `npm test` (132 files,
> 1923 tests) stay GREEN; `cargo check`/`cargo test` are unchanged — no Rust
> file was touched this batch (this environment's shell has no `cargo` on
> `PATH` to re-run it, but nothing under `Cargo.toml`/`*.rs` was edited).
> Where this batch stopped, on purpose: no relay/WebSocket/fetch/OAuth/
> OAuth-token/signing/publish/subscribe, no AES/HKDF/NIP-44 implementation,
> no storage implementation (SQLite/IndexedDB/Google Drive or otherwise), no
> payment/Lightning/Stripe, no Runtime auto-call, no Worker
> auto-communication, and no `Cargo.toml`/Rust/crypto change of any kind.
> Stage 131 candidates: (1) a Marketplace listing search/filter preview
> boundary (label-only); (2) a Notification digest preview (opt-in,
> read-only); (3) a cross-suite "Boundary Phase index" doc summarizing every
> boundary shipped Stage 1–130 in one place.
> Prior status:
>
> **Stage 118 — Federation outbound queue skeleton + Creator
> analytics preview boundary + Protocol moderation compatibility docs.** One
> more pure, in-memory queue boundary, one more opt-in read-only preview
> page, and a new docs-only note — still **no real network send, no real
> preview route touches the Worker.** New
> [`src/federation/outbound_queue.ts`](src/federation/outbound_queue.ts)
> defines `OutboundQueueItemDescriptor` (`idRef?`/`intentRef?`/
> `adapterKind`/`createdAt?`/`metadata?`, NO content/body/bytes field) and
> `OutboundQueueState` (`queued_placeholder`/`dequeued_placeholder`/
> `rejected`), with pure `enqueuePlaceholder`/`dequeuePlaceholder` functions
> that reject the same signing/relay-specific sensitive-marker family as
> `src/federation/publish_intent.ts` and return a NEW array rather than
> mutating the one passed in — no `fetch`, no `WebSocket`, no signing, no
> publish/subscribe anywhere. New
> [`src/render/creator_analytics_preview.ts`](src/render/creator_analytics_preview.ts)
> (`renderCreatorAnalyticsPreview`/`renderCreatorAnalyticsPreviewPage`, plus
> static `SAMPLE_CREATOR_ANALYTICS`) shows a sample creator's `creatorRef`,
> four PLACEHOLDER counts (posts/replies/reactions/moderation events —
> static numbers, never a real aggregation), and a fixed
> `ModerationVisibilityDecision`-label summary, HTML-escaped, ending in a
> permanently `disabled` "view detail" button — no real purchaser identity
> and no monetary/settlement field of any kind. Gated behind an EXPLICIT
> `?creatorAnalyticsPreview=1` flag in
> [`src/worker.ts`](src/worker.ts) (`isCreatorAnalyticsPreviewEnabled`),
> inserted right after the Stage 117 `?creatorDashboardPreview=1` branch so
> priority is runtimeStatus → boardPreview → marketplacePreview →
> creatorPreview → communityRulesPreview → creatorDashboardPreview →
> creatorAnalyticsPreview → normal routing; the new branch reads no
> `runtime` and calls no Runtime-selected boundary, and every pre-existing
> route is unaffected. New
> [`docs/protocol_moderation_compatibility.md`](docs/protocol_moderation_compatibility.md)
> fixes, per protocol, how a future adapter would express moderation
> (Nostr's NIP-09/NIP-51 hide/mute/filter model restated protocol-
> specifically; Bluesky's label-and-single-host differences; Threads'
> centralized-platform-authority differences; RSS's "no primitive at all")
> and how FedOS's own `ModerationVisibilityDecision`
> (`src/community/moderation.ts`) stays the single source of truth for
> FedOS's own rendering regardless of protocol — docs only, no AT Protocol/
> Threads API/RSS-fetch call, no change to any shipped boundary's shape.
> New
> [`test/outbound_queue_creator_analytics.test.ts`](test/outbound_queue_creator_analytics.test.ts)
> (26 tests) checks: `enqueuePlaceholder`/`dequeuePlaceholder` are FIFO,
> pure, and never mutate their input queue, both reject the sensitive-marker
> family without enqueuing, the analytics preview escapes every label
> (including an XSS-shaped one), every button is permanently `disabled`, no
> revenue/amount/payment/checkout/invoice/buyer/email word appears anywhere
> in the new preview file, the `creatorAnalyticsPreview` flag gates
> correctly and yields precedence to every earlier preview flag, and no
> source imports a relay/WebSocket library, calls a provider method, or
> reads a Runtime-selected boundary from the Worker. `npm run typecheck` and
> `npm test` (127 files, 1843 tests) stay GREEN; `cargo check`/`cargo test`
> are unchanged — no Rust file was touched this stage (this environment's
> shell has no `cargo` on `PATH` to re-run it, but nothing under
> `Cargo.toml`/`*.rs` was edited). Where this stage stopped, on purpose: no
> real network send/signing/publish, no real analytics aggregation, no real
> moderation action, no `StorageBackend`/`PaymentProvider`/
> `EntitlementProvider`/`MarketplaceProvider`/`FederationProvider`/
> `ChatProvider` call from any new file, and no Runtime auto-call. Stage 119
> candidates: (1) a Federation outbound queue Worker-visible status preview
> (still no send); (2) a Bluesky adapter planning doc (mirroring
> `docs/nostr_adapter_planning.md`'s structure); (3) a Creator moderation
> appeal boundary (naming-only, no enforcement).
> Prior status:
>
> **Stage 117 — Protocol adapter capability matrix + Creator
> dashboard preview UI.** One more fixed, cross-protocol naming boundary
> plus one more opt-in, read-only preview page — still **no real relay/
> WebSocket/OAuth/AT-Protocol connection, no real analytics/settlement
> calculation, and only the one new preview route touches the Worker.** New
> [`src/federation/capability_matrix.ts`](src/federation/capability_matrix.ts)
> defines `ProtocolAdapterKind` (mirroring `FederationProviderKind`'s six
> labels: `nostr_`/`bluesky_`/`threads_`/`rss_`/`local_`/`test_placeholder`)
> and `ProtocolAdapterCapability` (`read_public_`/`publish_public_`/
> `reply_`/`reaction_`/`profile_`/`marketplace_announcement_`/
> `moderation_signal_`/`private_message_`/`paid_content_`/`test_placeholder`),
> with a pure `getProtocolAdapterCapabilities(adapter)` returning a FIXED row
> of `ProtocolAdapterCapabilityDecision` (`allowed`/`state`/`reason?`) and
> `canProtocolAdapterSupport(adapter, capability)` for a single lookup.
> `nostr_placeholder` marks the public-surface set (read/publish/reply/
> reaction/profile/marketplace-announcement/moderation-signal)
> `available_placeholder`; `private_message_placeholder`/
> `paid_content_placeholder` are `rejected` for Nostr STRUCTURALLY (never
> "not yet built") — private/paid content must never ride on a public relay
> event, matching the existing Nostr adapter planning docs.
> `bluesky_placeholder`/`threads_placeholder`/`rss_placeholder` are
> `unavailable` across every non-test capability — a placeholder matrix
> only, no OAuth/API/adapter design committed this stage. New
> [`src/render/creator_dashboard_preview.ts`](src/render/creator_dashboard_preview.ts)
> (`renderCreatorDashboardPreview`/`renderCreatorDashboardPreviewPage`, plus
> static `SAMPLE_CREATOR_DASHBOARDS`) shows a sample creator's `creatorRef`,
> three PLACEHOLDER counts (listings/membership plans/community rules —
> static numbers, never a real tally), and two fixed label lists (a
> federation capability summary pulled from the new matrix, and a
> moderation visibility summary), HTML-escaped, ending in three permanently
> `disabled` navigation buttons — no listing/plan/rule fetch and no
> monetary/settlement field of any kind. Gated behind an EXPLICIT
> `?creatorDashboardPreview=1` flag in
> [`src/worker.ts`](src/worker.ts) (`isCreatorDashboardPreviewEnabled`),
> inserted right after the Stage 116 `?communityRulesPreview=1` branch so
> priority is runtimeStatus → boardPreview → marketplacePreview →
> creatorPreview → communityRulesPreview → creatorDashboardPreview → normal
> routing; the new branch reads no `runtime` and calls no Runtime-selected
> boundary, and every pre-existing route is unaffected. Short **Stage 117+
> update notes** were appended to
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md#16-stage-117-update-note--protocol-adapter-capability-matrix)
> and
> [`docs/creator_monetization_flow.md`](docs/creator_monetization_flow.md#16-stage-117-update-note--creator-dashboard-preview).
> New
> [`test/capability_matrix_creator_dashboard.test.ts`](test/capability_matrix_creator_dashboard.test.ts)
> (26 tests) checks: the matrix returns a fixed row for every adapter/
> capability pair, Nostr's public-surface labels are `available_placeholder`,
> `private_message_placeholder`/`paid_content_placeholder` are never
> `available_placeholder` for ANY adapter, Bluesky/Threads/RSS stay
> `unavailable` outside the trivial test capability, the dashboard preview
> escapes every label (including an XSS-shaped one), every button is
> permanently `disabled`, no revenue/amount/payment/checkout/invoice/buyer/
> email word appears anywhere in the new preview file, the
> `creatorDashboardPreview` flag gates correctly and yields precedence to
> every earlier preview flag, and no source imports a relay/WebSocket
> library, calls a provider method, or reads a Runtime-selected boundary
> from the Worker. `npm run typecheck` and `npm test` stay GREEN; `cargo
> check`/`cargo test` are unchanged — no Rust file was touched this stage.
> Where this stage stopped, on purpose: no real relay/WebSocket/OAuth/AT-
> Protocol connection, no real analytics/settlement calculation, no
> `StorageBackend`/`PaymentProvider`/`EntitlementProvider`/
> `MarketplaceProvider`/`FederationProvider`/`ChatProvider` call from any
> new file, and no Runtime auto-call. Stage 118 candidates: (1) a Federation
> outbound queue skeleton; (2) a Creator analytics preview boundary; (3)
> Protocol moderation compatibility docs.
> Prior status:
>
> **Stage 116 — Nostr publish intent + Creator membership plan +
> Community ruleset preview UI.** Two more pure boundaries plus one more
> opt-in, read-only preview page — still **no real publish, no relay
> connection, no signing, no real payment/checkout, no real moderation
> action, and only the one new preview route touches the Worker.** New
> [`src/federation/publish_intent.ts`](src/federation/publish_intent.ts)
> defines `PublishIntentDescriptor` (`idRef?`/`actorRef?`/`targetRef?`/
> `kind`/`createdAt?`/`metadata?`, NO content/body/bytes field) with seven
> `PublishIntentKind` placeholders (`post_`/`reply_`/`reaction_`/
> `marketplace_announcement_`/`creator_profile_`/`moderation_signal_`/
> `test_placeholder`) and a pure `reviewPublishIntent` that rejects
> sensitive metadata — including a signing-specific
> `sig`/`signature`/`privkey`/`nsec`/`relay` family on top of this
> codebase's usual conservative marker list. An `accepted_placeholder`
> decision means "policy-clean", NEVER "published" or "sent"; nothing here
> signs anything, opens a relay connection, or publishes/subscribes. New
> [`src/creator/membership.ts`](src/creator/membership.ts) defines
> `MembershipPlanDescriptor` (`idRef?`/`creatorRef?`/`kind`/`visibility`/
> `metadata?`) with six `MembershipPlanKind` placeholders (`free_`/
> `supporter_`/`premium_`/`community_`/`private_chat_`/`test_placeholder`)
> and a pure `reviewMembershipPlan` that rejects any
> price/card/payment/checkout/invoice/download/entitlement metadata and
> imports neither `PaymentProvider` nor `EntitlementProvider`. New
> [`src/render/community_rules_preview.ts`](src/render/community_rules_preview.ts)
> (`renderCommunityRulePreview`/`renderCommunityRulesPreviewPage`, plus
> static `SAMPLE_COMMUNITY_RULES`) shows four sample rules' policy/target/
> action labels (HTML-escaped) plus the visibility label the Stage 115
> `reviewCommunityModerationTarget` maps each one to — never a claim of
> deletion/removal/purge, and no `content`/`body`/bytes field anywhere on
> the page. Gated behind an EXPLICIT `?communityRulesPreview=1` flag in
> [`src/worker.ts`](src/worker.ts) (`isCommunityRulesPreviewEnabled`),
> inserted right after the Stage 115 `?creatorPreview=1` branch so priority
> is runtimeStatus → boardPreview → marketplacePreview → creatorPreview →
> communityRulesPreview → normal routing; the new branch reads no `runtime`
> and calls no Runtime-selected boundary, and every pre-existing route is
> unaffected. Short **Stage 116+ update notes** were appended to
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md#15-stage-116-update-note--publish-intent),
> [`docs/creator_monetization_flow.md`](docs/creator_monetization_flow.md#15-stage-116-update-note),
> and [`docs/community_moderation_policy.md`](docs/community_moderation_policy.md)
> (§6). New
> [`test/publish_intent_membership_ruleset.test.ts`](test/publish_intent_membership_ruleset.test.ts)
> (30 tests) checks: both new boundaries accept a clean input and reject
> their respective sensitive-marker families without mutating input, the
> ruleset preview page shows a hide/mute/filter visibility label per rule
> and never a delete/remove/purge action value, the `communityRulesPreview`
> flag gates correctly (absent/`1`/`true`, `creatorPreview` winning when
> both are present), every label is HTML-escaped (including an XSS-shaped
> label), and no source imports a relay/WebSocket/signing library, calls a
> provider method, or reads a Runtime-selected boundary from the Worker.
> `npm run typecheck` and `npm test` (124 files, 1791 tests) stay GREEN;
> `cargo check`/`cargo test` are unchanged — no Rust file was touched this
> stage (this environment's shell has no `cargo` on `PATH` to re-run it,
> but nothing under `Cargo.toml`/`*.rs` was edited). Where this stage
> stopped, on purpose: no real publish/signing/relay, no real payment/
> checkout, no real moderation hide/mute/filter/apply action, no
> `StorageBackend`/`PaymentProvider`/`EntitlementProvider`/
> `MarketplaceProvider`/`FederationProvider`/`ChatProvider` call from any
> new file, and no Runtime auto-call. Stage 117 candidates: (1) a Protocol
> adapter capability matrix (docs); (2) a Creator dashboard preview UI; (3)
> a Federation outbound queue skeleton.
> Prior status:
>
> **Stage 115 — Creator profile preview UI + creator trust label boundary
> + Community moderation policy boundary.** One opt-in, read-only preview
> page plus two new pure boundaries — still **no real identity
> verification, no real moderation action, no relay connection, and only
> the one new preview route touches the Worker.** New
> [`src/creator/profile.ts`](src/creator/profile.ts) defines
> `CreatorProfileDescriptor` (`creatorRef?`/`displayName?`/`bioPreview?`/
> `category?`/`trustLabels?`/`createdAt?`/`metadata?`, no payment/
> entitlement field) with six `CreatorTrustLabel` placeholders (`unknown_`/
> `verified_`/`community_trusted_`/`new_creator_`/`reported_`/
> `test_placeholder`) and a pure `reviewCreatorProfile` that rejects
> sensitive bio/metadata content — `"verified_placeholder"` is documented
> explicitly as a FUTURE label name only; nothing in this stage performs
> KYC, OAuth, or any document check, and no code path can produce that
> label from a real verification step. New
> [`src/community/moderation.ts`](src/community/moderation.ts) defines
> `ModerationVisibilityDecision` (`visible_`/`hidden_`/`muted_`/
> `filtered_placeholder`/`rejected`), `CommunityModerationPolicyKind`,
> `CommunityModerationTargetKind`, and a pure
> `reviewCommunityModerationTarget` that maps a requested
> `hide_placeholder`/`mute_placeholder`/`filter_placeholder` action 1:1 to
> its visibility label (or `rejected` for a policy-dirty request) — no
> delete/remove/purge action exists on the type, by construction; nothing
> here mutates or deletes any content. New
> [`src/render/creator_profile_preview.ts`](src/render/creator_profile_preview.ts)
> (`renderCreatorProfilePreview`/`renderCreatorProfilePreviewPage`, plus
> static `SAMPLE_CREATOR_PROFILES`) shows a profile's display name/bio/
> category/trust labels (HTML-escaped) plus the `reviewCreatorProfile`
> review state, ending in a permanently `disabled` "follow" button — no
> profile fetch, no metadata display, no follow/subscribe/buy/message flow.
> Gated behind an EXPLICIT `?creatorPreview=1` flag in
> [`src/worker.ts`](src/worker.ts) (`isCreatorPreviewEnabled`), inserted
> right after the Stage 114 `?marketplacePreview=1` branch so priority is
> runtimeStatus → boardPreview → marketplacePreview → creatorPreview →
> normal routing; the new branch reads no `runtime` and calls no
> Runtime-selected boundary. Short **Stage 115+ update notes** were
> appended to
> [`docs/creator_monetization_flow.md`](docs/creator_monetization_flow.md#14-stage-115-update-note)
> and a new
> [`docs/community_moderation_policy.md`](docs/community_moderation_policy.md)
> was added (cross-referenced from
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md#14-stage-115-update-note--moderationvisibility)
> §14). New
> [`test/creator_profile_community_moderation.test.ts`](test/creator_profile_community_moderation.test.ts)
> (32 tests) checks: the profile preview escapes every label (including an
> XSS-shaped name), never renders `metadata`, the `creatorPreview` flag
> gates correctly and yields precedence to `boardPreview`, every trust
> label/policy/target/action kind is a `_placeholder`, sensitive
> metadata/bio content is rejected without mutation, `verified_placeholder`
> is never produced by `reviewCreatorProfile` itself, moderation actions
> map 1:1 to their visibility label with no delete/remove/purge action
> ever definable, and no source imports a relay/WebSocket/signing library,
> calls a provider method, or reads a Runtime-selected boundary from the
> Worker. `npm run typecheck` and `npm test` (123 files, 1761 tests) stayed
> GREEN at this point; `cargo check`/`cargo test` unchanged — no Rust file
> was touched.
>
> **Stage 114 — Board/Marketplace preview UI + interaction intent
> boundaries.** Two opt-in, read-only preview pages plus two new pure
> "intent" boundaries — still **no real post/purchase, no relay
> connection, no payment/entitlement processing, no storage, and only the
> two preview routes touch the Worker.** New
> [`src/render/board_preview.ts`](src/render/board_preview.ts)
> (`renderBoardPreview`/`renderBoardPreviewPage`, plus static
> `SAMPLE_BOARDS`) shows a `BoardDescriptor`'s title/topics/categories
> (HTML-escaped) and — by directly calling the Stage 113
> `boardToNostrCandidate` PURE mapping function — its candidate
> `kindLabel` only; there is no post/reply form and no content/body/bytes
> field to display. New
> [`src/render/marketplace_preview.ts`](src/render/marketplace_preview.ts)
> (`renderMarketplaceListingPreview`/`renderMarketplacePreviewPage`, plus
> static `SAMPLE_LISTINGS`) shows a listing's kind/visibility/creator
> reference and its `marketplaceListingToNostrCandidate` kindLabel, ending
> in a permanently `disabled` "buy" button — no price/payment/checkout/
> download/signed-URL field exists on the type to show. Both routes are
> gated behind an EXPLICIT `?boardPreview=1`/`?marketplacePreview=1` flag
> in [`src/worker.ts`](src/worker.ts) (`isBoardPreviewEnabled`/
> `isMarketplacePreviewEnabled`), inserted right after the existing
> `?runtimeStatus=1` branch so priority is runtimeStatus → boardPreview →
> marketplacePreview → normal routing; neither branch reads `runtime` or
> calls any Runtime-selected boundary (storage/federation/marketplace/
> payment/entitlement/chat), and every pre-existing route is unaffected.
> New [`src/social/intent.ts`](src/social/intent.ts) defines
> `BoardInteractionIntentDescriptor` (`idRef?`/`boardRef?`/`actorRef?`/
> `targetRef?`/`kind`/`createdAt?`/`metadata?`, NO content/body/bytes
> field) with seven `BoardInteractionIntentKind` placeholders
> (`create_post_`/`reply_`/`react_`/`hide_`/`mute_`/`report_`/
> `test_placeholder`) and a pure `reviewBoardInteractionIntent` — an
> `accepted_placeholder` decision means "policy-clean", NEVER "posted" or
> "sent". New [`src/marketplace/intent.ts`](src/marketplace/intent.ts)
> defines `MarketplaceIntentDescriptor` with six `MarketplaceIntentKind`
> placeholders (`view_listing_`/`purchase_intent_`/`subscribe_intent_`/
> `tip_intent_`/`request_access_`/`test_placeholder`) and a pure
> `reviewMarketplaceIntent` that rejects any price/card/payment/checkout/
> invoice/download metadata and imports neither `PaymentProvider` nor
> `EntitlementProvider`. Short **Stage 114+ update notes** were appended to
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md#13-stage-114-update-note)
> and
> [`docs/creator_monetization_flow.md`](docs/creator_monetization_flow.md#13-stage-114-update-note).
> New
> [`test/board_marketplace_preview.test.ts`](test/board_marketplace_preview.test.ts)
> (36 tests) checks: both preview flags gate correctly (absent/`1`/`true`,
> `boardPreview` winning when both are present), every label is
> HTML-escaped (including an XSS-shaped title), no price/payment/checkout/
> download/signed-URL field is ever shown, the buy button is present but
> `disabled` with no surrounding `<form>`, both intent boundaries accept a
> clean input and reject their respective sensitive-marker families
> without mutating input, and no source imports a relay/WebSocket/signing
> library, calls a provider method
> (`put`/`get`/`delete`/`requestPayment`/`purchasePlaceholder`/
> `listPlaceholder`/`checkPlaceholder`/`sendPlaceholder`/
> `publishPlaceholder`/`connect`/`disconnect`), or reads
> `runtime.storageBackend`/`.federationProvider`/`.marketplaceProvider`/
> `.creatorEntitlementProvider`/`.chatProvider` from the Worker. Two
> existing tests (`test/social_board_skeleton.test.ts` #10 and four
> `*_boundary.test.ts` "Worker source does not select/call a
> FederationProvider/ChatProvider/EntitlementProvider/MarketplaceProvider"
> checks) needed their Worker-source assertions kept passing by rewording
> two `worker.ts` doc comments that had named those types in prose — the
> underlying invariant (the Worker still never selects or calls any of
> them) did not change. `npm run typecheck`, `npm test` (122 files, 1729
> tests), `cargo check`, `cargo check --tests`, and `cargo test` (108
> tests, unchanged — no Rust file was touched this stage) all stay GREEN.
> Where this stage stopped, on purpose: no real post/reply/react/purchase,
> no relay connection, no `fetch`/WebSocket, no signing, no
> `StorageBackend`/`PaymentProvider`/`EntitlementProvider`/
> `MarketplaceProvider`/`FederationProvider`/`ChatProvider` call from any
> new file, and no Runtime auto-call. Stage 115 candidates: (1) a Creator
> profile preview UI + creator trust label boundary; (2) a Nostr publish
> intent boundary; (3) a Community moderation policy boundary
> (recommended together with (1) — with Board/Marketplace display and
> intent now in place, fixing Creator profile display and Community
> moderation policy next completes the creator-economy/self-governance
> foundation before any of them is wired to a real relay or payment rail).
> Prior status:
>
> **Stage 113 — Nostr event mapping boundary skeleton.** Realizes
> `docs/nostr_adapter_planning.md` §10 step 1 as a PURE mapping
> boundary — still **no relay connection, no WebSocket/`fetch`, no
> signing, no private key, no NIP-44/NIP-17, no publish/subscribe, and no
> private/gated/payment/entitlement data on any candidate.** New types in
> [`src/federation/types.ts`](src/federation/types.ts) (additive):
> `NostrEventCandidate` (`kindLabel`/`tags`/`contentPreview?`/
> `pubkeyRef?`/`createdAt?`/`metadata?` — no event id, signature, or real
> pubkey field), eight `NostrEventCandidateKind` labels (`text_note_`/
> `reply_`/`reaction_`/`profile_`/`long_form_`/
> `marketplace_announcement_`/`moderation_signal_`/`test_placeholder`),
> `NostrEventMappingDecision`, and a new `ModerationSignalInput`/
> `ModerationAction` (`hide_`/`mute_`/`filter_placeholder`) pair for the
> fourth mapping function. New
> [`src/federation/nostr_mapping.ts`](src/federation/nostr_mapping.ts)
> ships four PURE functions — `socialEventToNostrCandidate`,
> `boardToNostrCandidate`, `marketplaceListingToNostrCandidate`,
> `moderationSignalToNostrCandidate` — each returning an
> `accepted_placeholder`/`candidate` pair or a `rejected` decision, never
> mutating input, never throwing. Policy: only `public` visibility
> (`SocialEventDescriptor`; it has no "unlisted" value) or `public`/
> `unlisted` (`MarketplaceListingDescriptor`) is ever candidate-ized —
> `followers`/`community`/`private_placeholder`/`private` are rejected
> outright; `SocialEventKind: "chat"` is rejected UNCONDITIONALLY
> regardless of visibility (chat/DM activity never becomes a public
> candidate); and metadata/reason/title strings containing a secret/key/
> seed/token/payment/entitlement/buyer/checkout/invoice/download/signed/
> url/dm/message/body/content marker are dropped from `metadata` or cause
> outright rejection for a single field like `reason`/`title`.
> `contentPreview` is always either a FIXED placeholder string or (for a
> board's already-display-only `title`) that same sanitized label — never
> real post/message content. New
> [`test/nostr_event_mapping.test.ts`](test/nostr_event_mapping.test.ts)
> (28 tests) checks all four mapping functions against a clean input, a
> rejected chat/non-public/private visibility, sensitive metadata/reason/
> title rejection, the fixed-placeholder `contentPreview`, no mutation, no
> `id`/`sig`/`privateKey`/`pubkey` field on any candidate, and that no
> source imports a relay/WebSocket/signing/crypto library or
> `PaymentProvider`/`EntitlementProvider`/`StorageBackend`/`CryptoProvider`,
> and that neither the Runtime nor the Worker references any of the four
> mapping functions. Short **Stage 113 update notes** were appended to
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md#12-stage-113-update-note)
> cross-linking the shipped mapping table to §5's candidate table. `npm
> run typecheck`, `npm test` (121 files, 1693 tests), `cargo check`,
> `cargo check --tests`, and `cargo test` (108 tests, unchanged — no Rust
> file was touched this stage) all stay GREEN. Where this stage stopped,
> on purpose: no relay/WebSocket/HTTP connection, no `fetch`, no event
> signing of any kind, no NIP-44/NIP-17, no publish/subscribe, no
> connection to `PaymentProvider`/`EntitlementProvider`/`StorageBackend`/
> `CryptoProvider`/any `FederationProvider` implementation, and no
> Runtime/Worker wiring — constructing a candidate is the only thing any
> of the four functions does. Stage 114 candidates: (1) a board route
> preview UI skeleton; (2) a creator listing preview UI skeleton
> (recommended together — with mapping candidates in place, a read-only
> preview of how a board/listing WOULD render gives the product a visible
> shape while relay/payment/entitlement all remain unimplemented); (3)
> Nostr mapping diagnostics docs. Prior status:
>
> **Stage 112 — Creator monetization + Nostr adapter planning
> (docs only).** Two new design docs fix how the already-shipped
> boundaries are EXPECTED to eventually connect — **no source file
> changed, no test file changed, no new provider/API, no `src/worker.ts`/
> `src/runtime/*`/Rust/`Cargo.toml` change.** New
> [`docs/creator_monetization_flow.md`](docs/creator_monetization_flow.md)
> fixes the sequence a future sale would follow — listing
> (`MarketplaceProvider`) → purchase intent → payment placeholder
> (`PaymentProvider`) → entitlement check (`EntitlementProvider`) → gated
> chat/content (`ChatProvider`) → federation announcement
> (`FederationProvider`) — states the central rule that "paid" and
> "accessible" are different facts and `EntitlementProvider` alone answers
> the access question, names fee concepts (platform fee/creator share/
> developer fund/community treasury) as POLICY-ONLY with no calculation or
> ledger, names community self-governance concepts (moderation/listing
> visibility/creator trust/appeal) with an explicit "no DAO implemented"
> line, and fixes security rules (payment metadata never in chat/
> federation payloads, no entitlement decision on a public event, no buyer-
> identity leak via a public announcement). New
> [`docs/nostr_adapter_planning.md`](docs/nostr_adapter_planning.md) fixes
> how a future real Nostr adapter behind `FederationProvider` would work:
> Nostr as a visibility/filter/moderation-only layer (never a deletion
> guarantee), a Damus/Primal/Amethyst compatibility goal for public posts/
> replies/reactions, a PUBLIC-metadata-only rule for what FedOS-specific
> data may ride on an event, a candidate event-mapping table (post/reply/
> board-thread/marketplace-announcement/profile/moderation-signal — naming
> only, no kind numbers finalized), and a hide/mute/filter moderation model
> instead of relying on NIP-09 delete. Both docs end with a "future
> implementation order" naming Stage 113's likely next step (a pure,
> unsigned `SocialEventDescriptor` → Nostr-event-candidate mapping
> function) without building it. Short **Stage 112 update notes** were
> appended to
> [`docs/chat_boundary.md`](docs/chat_boundary.md#6-stage-112-update-note),
> [`docs/marketplace_boundary.md`](docs/marketplace_boundary.md#7-stage-112-update-note),
> and
> [`docs/creator_entitlement_boundary.md`](docs/creator_entitlement_boundary.md#6-stage-112-update-note)
> cross-linking the new flow/planning docs — none of their shipped
> boundary content changed. `npm run typecheck`, `npm test` (120 files,
> 1665 tests, unchanged — no test file was touched), `cargo check`,
> `cargo test` (108 tests, unchanged), and `cargo check --tests` all stay
> GREEN, since no source or test file was touched. Where this stage
> stopped, on purpose: no relay connection, no WebSocket/`fetch`, no
> signing, no NIP-44/NIP-17, no `PaymentProvider` connection, no
> `PurchaseGrant` issuance, no checkout/invoice, no download unlock, and no
> chat-content implementation — every flow step named is still exactly the
> placeholder it was before this stage. Stage 113 candidates: (1) a board
> route preview UI skeleton; (2) a Nostr event mapping boundary skeleton —
> a PURE function from `SocialEventDescriptor` to a Nostr-event-candidate
> shape, still no relay/signing (recommended, since
> `docs/nostr_adapter_planning.md` §10 step 1 names this as the natural
> next step and it can be built and tested with zero network/crypto
> surface); (3) a creator listing preview UI skeleton. Prior status:
>
> **Stage 111 — Chat + Marketplace + Creator entitlement boundary
> foundation.** Fixes three more upper-app-layer seams — still **no real
> DM/encryption, no real payment/checkout, no entitlement issuance, no
> Worker wiring, no Rust change.** New
> [`src/chat/types.ts`](src/chat/types.ts) ADDS (does not replace) a
> protocol-neutral `ChatProvider` transport seam
> (`status`/`sendPlaceholder`/`fetchPlaceholder`) alongside the pre-existing
> Stage 16 `ChatRoom`/`ChatMessage` model in the SAME file — the new types
> are deliberately named `ChatProviderKind`/`ChatMessageDescriptor`/etc. to
> avoid colliding with the existing `ChatKind`/`ChatMessage` (which keeps
> its real `content` field and stays wired to notification/render, fully
> untouched). `ChatMessageDescriptor` carries NO `content`/`body`/bytes
> field — opaque `idRef`/`chatRef`/`authorRef`/metadata only. New
> [`src/chat/noop_chat.ts`](src/chat/noop_chat.ts) ships the only
> implementation, `NoopChatProvider` (permanently `unavailable`). New
> [`src/marketplace/types.ts`](src/marketplace/types.ts) +
> [`src/marketplace/noop_marketplace.ts`](src/marketplace/noop_marketplace.ts)
> define `MarketplaceProvider` (`status`/`listPlaceholder`/
> `purchasePlaceholder`) and `MarketplaceListingDescriptor` — six
> `MarketplaceItemKind` placeholders, NO price/payment/checkout/download/
> bytes field, no `PaymentProvider` import, no `PurchaseGrant`
> construction; `NoopMarketplaceProvider` always lists nothing and grants
> nothing. New [`src/creator/entitlement.ts`](src/creator/entitlement.ts)
> defines `EntitlementProvider` (`status`/`checkPlaceholder`),
> `EntitlementDecision`, and five `EntitlementKind` placeholders —
> `NoopEntitlementProvider` is the only implementation and, like
> `NoopFederationProvider`'s `connect()` before it, NEVER returns `allowed:
> true`: no grant is ever issued and no payment is ever verified by this
> boundary. All three deliberately stay uncoupled from `PaymentProvider`,
> `src/commerce/`'s `PurchaseGrant`, `StorageBackend`, `CryptoProvider`,
> and each other. `AppRuntime` gains `chatProvider`/`marketplaceProvider`/
> `creatorEntitlementProvider`; three new `select*` functions in
> [`src/runtime/create_runtime.ts`](src/runtime/create_runtime.ts) each
> ALWAYS return their Noop default unless the matching `overrides.*` is
> supplied — no env-selectable placeholder variant exists yet for any of
> the three, and the Worker is UNTOUCHED (no reference to any of them).
> Three new docs —
> [`docs/chat_boundary.md`](docs/chat_boundary.md),
> [`docs/marketplace_boundary.md`](docs/marketplace_boundary.md), and
> [`docs/creator_entitlement_boundary.md`](docs/creator_entitlement_boundary.md)
> — fix each seam's role and explicit non-scope, and why payment,
> marketplace, and entitlement stay three separate decisions ("was this
> paid for" vs. "what is offered" vs. "does this subject have access now").
> New
> [`test/chat_provider_boundary.test.ts`](test/chat_provider_boundary.test.ts)
> (15 tests),
> [`test/marketplace_boundary.test.ts`](test/marketplace_boundary.test.ts)
> (15 tests), and
> [`test/creator_entitlement_boundary.test.ts`](test/creator_entitlement_boundary.test.ts)
> (14 tests) check: every Noop provider stays `unavailable`/denies every
> attempt across every kind; `createRuntime` never calls any of the seven
> new placeholder methods; the Worker references none of the three
> providers; every descriptor carries no content/body/bytes/price/payment/
> checkout/download field; and no source imports `PaymentProvider`,
> `PurchaseGrant`/`src/commerce/`, `StorageBackend`, `CryptoProvider`, a
> relay/WebSocket library, or performs NIP-04/NIP-44/NIP-17 encryption.
> `npm run typecheck`, `npm test` (120 files, 1665 tests), `cargo check`,
> `cargo check --tests`, and `cargo test` (108 tests, unchanged — no Rust
> file was touched this stage) all stay GREEN. Where this stage stopped, on
> purpose: no NIP-04/NIP-44/NIP-17 implementation, no encrypted-chat
> implementation, no message content storage, no real payment/Stripe/
> Lightning, no checkout, no download/signed URL, no entitlement/grant
> issuance, and no Federation/Storage/Crypto/Worker wiring beyond Noop
> selection. Stage 112 candidates: (1) Nostr adapter planning docs; (2) a
> board route preview UI skeleton; (3) Creator monetization flow docs
> (recommended — now that Chat/Marketplace/Entitlement boundaries exist,
> fixing in docs how a sale, a membership, and a chat permission would
> eventually connect is safer to do before any of the three is
> implemented). Prior status:
>
> **Stage 110 — Federation + Social boundary foundation.** Fixes the
> seam FedOS will eventually use to speak to multiple social
> protocols/ecosystems (Nostr, Bluesky, Threads, RSS, and its own local
> store) — **no real relay/WebSocket/HTTP/OAuth/AT-Protocol connection, no
> signing, no publish/subscribe.** New
> [`src/federation/types.ts`](src/federation/types.ts) defines
> `FederationProvider` (`status`/`connect`/`disconnect`/
> `publishPlaceholder`/`fetchPlaceholder`), `FederationProviderKind` (six
> PLACEHOLDER labels — `nostr_placeholder`, `bluesky_placeholder`,
> `threads_placeholder`, `rss_placeholder`, `local_placeholder`,
> `test_placeholder`), `FederationCapability`, `FederationStatus`, and
> `FederationDescriptor`. New
> [`src/federation/noop_federation.ts`](src/federation/noop_federation.ts)
> ships `NoopFederationProvider` — the ONLY implementation this stage
> ships, and unlike every other boundary's placeholder, its `connect()`
> NEVER reaches `connected_placeholder` (claiming a session exists is
> closer to the Nearby consent boundary's "never claim granted" posture
> than to a payment/storage placeholder's "policy-clean" acceptance — see
> [`docs/federation_boundary.md`](docs/federation_boundary.md) §5). New
> [`src/social/event.ts`](src/social/event.ts) defines a protocol-neutral
> `SocialEventDescriptor` (ten `SocialEventKind` labels — post/reply/
> repost/reaction/profile/article/marketplace/chat/moderation/test — and
> four `SocialVisibility` labels) with NO bytes/content/body field — opaque
> labels and metadata only. New [`src/social/board.ts`](src/social/board.ts)
> defines a protocol-neutral `BoardDescriptor` (six `BoardKind` labels —
> thread/board/channel/marketplace/knowledge/test — plus `TopicLabel`/
> `CategoryLabel`), also label-only. Social/Board are deliberately decoupled
> from `FederationProvider`/`StorageBackend`/`CryptoProvider` — no
> cross-import in either direction. `AppRuntime` gains `federationProvider`;
> new `selectFederationProvider(env?, overrides?)` in
> [`src/runtime/create_runtime.ts`](src/runtime/create_runtime.ts) ALWAYS
> returns `NoopFederationProvider` unless `overrides.federationProvider` is
> supplied — there is no env-selectable placeholder adapter yet, unlike
> Storage/Payment/Notification/WebAuthn/Crypto's two-way switches. The
> Worker is untouched (no `FederationProvider` reference at all). New
> [`docs/federation_boundary.md`](docs/federation_boundary.md) fixes each
> future adapter's role (read/write/reply only) and explicit non-scope
> (never Storage, never Crypto, never Identity/consent — swapping or adding
> a protocol adapter must never require touching those, and vice versa).
> New [`test/federation_boundary.test.ts`](test/federation_boundary.test.ts)
> (17 tests) and
> [`test/social_board_skeleton.test.ts`](test/social_board_skeleton.test.ts)
> (12 tests) check: `NoopFederationProvider` stays `disconnected` through
> `connect()`/`disconnect()`, denies `publishPlaceholder`/`fetchPlaceholder`
> (`items` always empty); Runtime selection defaults to
> `NoopFederationProvider` and never calls any of its four methods; the
> Worker references neither `FederationProvider` nor the social model; every
> label is a fixed, complete `_placeholder`-suffixed or plain set; no
> `bytes`/`content`/`body` field exists anywhere; and no source imports a
> relay/WebSocket/HTTP/OAuth/AT-Protocol/EventSource library or
> `StorageBackend`/`CryptoProvider`. `npm run typecheck`, `npm test` (117
> files, 1621 tests), `cargo check`, `cargo test` (108 tests, unchanged — no
> Rust file was touched this stage), and `cargo check --tests` all stay
> GREEN. Where this stage stopped, on purpose: no Nostr relay/WebSocket, no
> Bluesky/AT-Protocol/OAuth session, no Threads/ActivityPub call, no RSS
> fetch/parse, no event signing (NIP-44/NIP-17 or otherwise) or publish/
> subscribe, and no connection to `StorageBackend` or any `CryptoProvider`.
> Stage 111 candidates: (1) a Chat boundary skeleton and (2) a Marketplace
> boundary skeleton, done together in one review unit (recommended — FedOS's
> target order is Identity → Crypto → Storage → Federation → Board → Chat →
> Marketplace, so finishing Chat+Marketplace next keeps the foundation
> complete before any real Nostr/Bluesky/Threads adapter is attempted); (3)
> a Creator entitlement boundary. Prior status:
>
> **Stage 109 — Storage provider env selection + Nearby consent
> boundary + storage metadata sanitizer.** Three small, independent
> additions consolidate the Stage 107/108 boundaries into selectable/usable
> shape, still with NO real storage, NO real location, and NO wiring beyond
> selection. (1) **Storage provider env selection**: `RuntimeEnv` gains
> `STORAGE_PROVIDER?`/`ENABLE_STORAGE_PLACEHOLDER?`, `RuntimeOverrides` gains
> `storageBackend?`, and `AppRuntime` gains `storageBackend` — new
> `selectStorageBackend(env, overrides?)` in
> [`src/runtime/create_runtime.ts`](src/runtime/create_runtime.ts) picks
> `NoopStorageBackend` (default) or `PlaceholderStorageBackend` (Stage 107),
> exactly mirroring how `selectPaymentProvider`/`selectNotificationBridge`
> already work. The Worker's `Env` interface gains the same two fields for
> parity; the Worker still never calls `put()`/`get()`/`delete()`, and
> `createRuntime` never calls them either — selection only. (2) **Nearby
> consent boundary skeleton**: new
> [`src/nearby/types.ts`](src/nearby/types.ts) defines
> `NearbyConsentProvider` (`getStatus`/`getCapabilities`/`requestConsent`/
> `revokeConsent`/`isGranted`) and new
> [`src/nearby/noop_consent.ts`](src/nearby/noop_consent.ts) provides
> `NoopNearbyConsentProvider` (permanently `unavailable`) and
> `PlaceholderNearbyConsentProvider` — which, unlike every other placeholder
> in this codebase, can NEVER reach an "accepted" state: `requestConsent`
> ALWAYS resolves `denied`, because Nearby Discovery has no real, informed
> consent UI yet (see `docs/nearby_consent_policy.md`) and granting consent
> without one would misrepresent it. No GPS, no
> `navigator.geolocation` call, no permission request, no area-id
> computation; NOT wired into the runtime, the Worker, or `StorageBackend`.
> (3) **Storage metadata sanitizer**: new `sanitizeStorageMetadata` in
> [`src/storage/policy.ts`](src/storage/policy.ts) is a pure function that
> strips the EXISTING sensitive markers (secret/key/seed/token/payment/
> entitlement/dm/body/content/message) AND a NEW, independent
> location-derived marker set (area id/geohash/H3/S2/lat/lon/coordinate/
> GPS) from a metadata object, per `docs/storage_metadata_policy.md` §2 —
> deliberately kept a standalone helper, NOT called from
> `reviewStoragePacket` or `PlaceholderStorageBackend.put()`, so
> `NoopStorageBackend`/`PlaceholderStorageBackend` are UNCHANGED by this
> stage. New
> [`test/runtime_storage_env.test.ts`](test/runtime_storage_env.test.ts)
> (13 tests),
> [`test/nearby_consent_boundary.test.ts`](test/nearby_consent_boundary.test.ts)
> (13 tests), and
> [`test/storage_metadata_sanitizer.test.ts`](test/storage_metadata_sanitizer.test.ts)
> (13 tests) check: env/override selection picks the right backend and
> never calls `put`/`get`/`delete`; the Worker exposes the two new fields
> but never constructs a backend or calls its methods; `PlaceholderNearbyConsentProvider`
> never grants consent even after repeated requests, leaks no coordinate,
> and stays unwired; `sanitizeStorageMetadata` drops both marker families
> without mutating its input and is not called from `noop_storage.ts`; and
> no source imports Google Drive/Nostr WebSocket/SQLite/Bluetooth/geolocation/
> H3/geohash/S2. Two Stage 107 assertions in
> [`test/storage_backend_boundary.test.ts`](test/storage_backend_boundary.test.ts)
> were updated (same pattern Stage 46/Stage 42 used for payment/notification
> selection): they now allow the Runtime/Worker sources to reference
> `StorageBackend` for SELECTION, while still asserting `put`/`get`/`delete`
> are never called from either. `npm run typecheck`, `npm test` (115 files,
> 1592 tests), `cargo check`, `cargo test` (108 tests, unchanged — no Rust
> file was touched this stage), and `cargo check --tests` all stay GREEN.
> Where this stage stopped, on purpose: no real Google Drive/Nostr
> relay/SQLite/Bluetooth-Wi-Fi/IPFS storage, no GPS/browser geolocation, no
> area-id computation, no H3/Geohash/S2 dependency, no peer discovery, no
> bandwidth priority, and no automatic storage operation from the Runtime or
> Worker. Stage 110 candidates: (1) a Nostr federation boundary skeleton —
> a `FederationProvider`-shaped seam naming relay-set/federation concepts
> with NO real relay connection (recommended, since it is FedOS's core
> not-yet-abstracted coupling now that Storage/consent/metadata boundaries
> are in place); (2) a board/event model skeleton (Reddit-style
> board/thread shapes decoupled from the Nostr event they're rendered from);
> (3) a storage packet preview route (a read-only `?storageStatus=1`-style
> page mirroring `renderRuntimeStatusPage`, showing the selected backend's
> type label only). Prior status:
>
> **Stage 108 — Nearby / storage-metadata privacy boundaries
> (docs only).** Three new research/policy documents fix the privacy
> boundary for a not-yet-built "Nearby Discovery" feature and extend the
> `StorageBackend` metadata policy — **no source file changed, no test file
> changed, no new dependency, no location implementation.** New
> [`docs/nearby_area_indexing_research.md`](docs/nearby_area_indexing_research.md)
> documents why the Python v8.6 host's `get_area_id(lat, lon, precision=4)`
> (independent `round(lat, 1)`/`round(lon, 1)`) is not production safe — a
> fixed rectangular grid has a boundary problem (two nearby points can land
> in different cells while distant ones share a cell), cell size is not
> uniform across latitude, and even a coarse rounded coordinate is a
> non-zero privacy cost — then compares Geohash/H3/S2/a coarser fixed grid
> as candidates ONLY (none adopted, no dependency added), lists H3's
> hex-cell/neighbor-ring/deterministic-adjacency advantages alongside its
> dependency, WASM-footprint, exact-location-inference, and
> resolution-choice risks, and fixes the privacy rules any future
> implementation must follow (no raw-coordinate storage or transmission, an
> area id is itself a tracking identifier, salt/epoch/rotation design is a
> separate future stage, explicit opt-in consent, off by default) plus the
> broader metadata leak surface (area-id frequency, time correlation, peer
> count, bandwidth priority, relay observation). New
> [`docs/nearby_consent_policy.md`](docs/nearby_consent_policy.md) fixes the
> consent rules for that same not-yet-built feature (explicit/informed/
> separable consent, off by default, revocation stops new signal generation
> rather than just hiding UI, consent is not retroactive, and consent does
> not by itself authorize storing an area id in `StorageBackend`). New
> [`docs/storage_metadata_policy.md`](docs/storage_metadata_policy.md)
> restates the EXISTING `reviewStoragePacket` marker policy
> (`src/storage/policy.ts`, Stage 107 — unchanged by this stage) and fixes
> the explicit rule that a location-derived value (an area id, geohash, H3
> index, etc.) is NOT cleared for `StorageBackend` metadata just because it
> passes today's secret/key/seed/token/payment/entitlement/dm/body/content/
> message check — that check was never a location-privacy control, and
> storing one requires its own future policy stage gated on both the
> area-indexing and consent preconditions. `npm run typecheck`, `npm test`
> (112 files, 1553 tests, unchanged), `cargo check`, `cargo test` (108
> tests, unchanged), and `cargo check --tests` all stay GREEN, since no
> source or test file was touched. Where this stage stopped, on purpose: no
> H3/Geohash/S2 dependency was added, no GPS/`navigator.geolocation` call
> was written, no area-id function exists in this codebase, no consent UI
> or permission flow was built, no `StorageBackend`/Runtime/Worker wiring
> changed. Stage 109 candidates: (1) a storage-provider environment-
> selection boundary — mirroring how `createRuntime` already selects a
> `PaymentProvider`/`NotificationBridge` from env, but for `StorageBackend`
> (still no real backend) (recommended, since it is the natural next step
> now that the metadata-privacy boundary around it is fixed in docs); (2) a
> Nearby consent boundary **skeleton** (types/decision shapes only, no UI,
> no permission call); (3) a storage metadata sanitizer boundary (a pure
> function mirroring `sanitizePaymentMetadata`/`sanitizeNotificationPayload`
> for `StoragePacket.metadata`, still no location-value support). Prior
> status:
>
> **Stage 107 — `StorageBackend` abstraction boundary skeleton.**
> A MINIMAL, future-facing seam for pluggable storage backends: new
> [`src/storage/types.ts`](src/storage/types.ts) defines `StorageBackend`
> (`getStatus`/`put`/`get`/`delete`), `StorageBackendKind` (six PLACEHOLDER
> labels — `google_drive_placeholder`, `nostr_relay_placeholder`,
> `local_sqlite_placeholder`, `local_mesh_placeholder`, `ipfs_placeholder`,
> `external_placeholder`), `StorageVisibility`, `StoragePacket`, `StorageRef`,
> `StorageDecision`, and `StorageReadDecision`. This is the seam that would
> eventually let the Python v8.6 host's Google Drive coupling be replaced by
> a real backend selected behind one interface — without the rest of the app
> depending on any concrete backend. New
> [`src/storage/policy.ts`](src/storage/policy.ts) (`reviewStoragePacket`)
> rejects a packet whose metadata key/value contains a
> secret/key/seed/token/payment/entitlement/dm/body/content/message marker,
> or whose `idRef` is shaped like a URL or file path (e.g. a Google Drive
> share link or a local path) rather than an opaque label. New
> [`src/storage/noop_storage.ts`](src/storage/noop_storage.ts) provides two
> safe defaults: `NoopStorageBackend` (permanently `unavailable`, denies
> every `put`/`get`/`delete`) and `PlaceholderStorageBackend` (`put`
> evaluates the policy and returns `accepted_placeholder`/`rejected`; `get`
> always resolves `unavailable`; `delete` is a safe no-op) — NEITHER stores
> a byte, calls the Google Drive API, opens a Nostr relay WebSocket, touches
> SQLite, a Bluetooth/Wi-Fi mesh, or an IPFS gateway, performs file IO, or
> issues a `fetch`. No packet ever carries raw bytes or a plaintext/
> ciphertext body — only opaque labels and non-sensitive metadata strings.
> This boundary is NOT wired into the runtime, the Worker, or any
> `CryptoProvider`; constructing either implementation does nothing. New
> [`test/storage_backend_boundary.test.ts`](test/storage_backend_boundary.test.ts)
> (18 tests) checks: `NoopStorageBackend` stays `unavailable` for every
> operation; `PlaceholderStorageBackend` accepts a policy-clean packet and
> rejects sensitive metadata or a URL/path-shaped `idRef`; `get` always
> reports `unavailable` and `delete` is always a safe no-op; no function
> mutates its input or throws; the packet/ref/decision shapes carry no
> `bytes`/`body`/`content` field; the source imports no Google Drive /
> `google.colab` / Nostr WebSocket / SQLite / Bluetooth / Wi-Fi / IPFS client
> and issues no `fetch`/file IO; and the Runtime and Worker sources reference
> neither `StorageBackend` nor either implementation. `npm run typecheck`,
> `npm test` (112 files, 1553 tests), `cargo check`, `cargo test` (108
> tests, unchanged — no Rust file was touched this stage), and
> `cargo check --tests` all stay GREEN. Where this stage stopped, on
> purpose: no Google Drive, Nostr relay, SQLite, Bluetooth/Wi-Fi mesh, or
> IPFS implementation was written; nothing connects to a `CryptoProvider`;
> nothing is wired into the runtime or Worker. Stage 108 candidates: (1)
> nearby-area indexing research docs (recommended — location data warrants
> fixing a privacy boundary in docs before any implementation); (2) a
> storage-provider environment-selection boundary (mirroring how
> `createRuntime` selects a `PaymentProvider`/`NotificationBridge` from
> env, but for `StorageBackend` — still no real backend); (3) a public
> key-usage label enumeration on the Rust side (`docs/public_key_usage.md`
> section 5, step 1). Prior status:
>
> **Stage 106 — Public Boundary Freeze v2.** Two more label-only
> PUBLIC groups land in `packages/fedos-core-rust/src/lib.rs`:
> `FedosKeyUsageLabel` (eight labels — separating "what is this key for"
> from Stage 105's "what format is this key," see
> `docs/public_key_usage.md`) plus `FedosKeyUsageState`/
> `FedosKeyUsageStatus`/`FedosKeyUsageDescriptor` and one new function,
> `fedos_key_usage_descriptor_placeholder()`; and
> `FedosAlgorithmRequirement`/`FedosAlgorithmCapability`/
> `FedosAlgorithmPolicy` — three fixed relational/policy label tables
> over Stage 102's four algorithm candidates (see
> `docs/public_algorithm_policy.md`) plus three new functions,
> `fedos_algorithm_requirements`, `fedos_algorithm_capabilities`, and
> `fedos_algorithm_policy_decision`. The public `pub fn` surface grows
> from eighteen (Stage 105) to twenty-two. Every label remains planning
> intent only — no raw key byte, no owned string, no growable byte
> collection, no parser, no validator, no enforced authorization or
> approval rule, and no import/export/generate function exists anywhere;
> `Cargo.toml` is UNCHANGED; no CSPRNG entropy source is consulted; no
> Runtime/Worker/CryptoProvider/WASM wiring. A new
> [`docs/public_capability_matrix.md`](docs/public_capability_matrix.md)
> maps all seven label/metadata groups added across Stage 103/105/106
> (Capability, Feature, Policy, Version, Format, Usage, Algorithm) in one
> table, and `packages/fedos-core-rust/README.md`'s "Public boundary
> overview" was rewritten as **Public Boundary Freeze v2** (Stage
> 102–106), consolidating the roadmap and adding an explicit "where the
> boundary stops" section (no raw byte, no serialization format, no
> import/export implementation, no `randomBytes` implementation, no
> nonce generation, no Runtime/Worker/CryptoProvider wiring — reaching
> any of these is the Implementation Phase, not further boundary
> design). New
> [`test/fedos_core_rust_key_usage_label.test.ts`](test/fedos_core_rust_key_usage_label.test.ts)
> (13 tests) and
> [`test/fedos_core_rust_algorithm_policy.test.ts`](test/fedos_core_rust_algorithm_policy.test.ts)
> (14 tests) check all of the above; twenty-four pre-existing guard test
> files' hard-coded "pub fn total" checks were updated from 18 to 22 with
> the four new function names, and
> `test/fedos_core_rust_key_format_label.test.ts`'s own Stage-105-scoped
> section extraction was narrowed to end at Stage 106's new marker
> instead of Stage 79's. `npm run typecheck`, `npm test` (111 files, 1535
> tests), `cargo check`, `cargo test` (108 tests, same count as Stage 105
> — no new Rust unit test this stage, since no new `#[cfg(test)]` module
> was added), and `cargo check --tests` all stay GREEN. This closes the
> Public Boundary Freeze v2 arc (Stage 102–106) at the stop condition the
> user specified: no raw byte, serialization format, import/export
> implementation, `randomBytes` implementation, nonce generation, or
> Runtime wiring was touched — the next stage that touches any of those
> is Implementation Phase, not boundary design. Stage 107 candidates: (1)
> design the `(FedosKeyFormatLabel, FedosKeyUsageLabel)` authorization
> rule set (`docs/public_key_usage.md` section 5, step 1 — still
> design-only) — recommended, since it's the last remaining label-design
> gap the Freeze v2 roadmap lists before the arc has to cross into
> Implementation Phase; (2) a WASM manifest validation skeleton; (3) a
> NIP-44 vector source/update check. Prior status:
>
> **Stage 105 — Public key-format label enumeration
> (`FedosKeyFormatLabel`, seven FUTURE PLANNING LABELS, plus
> `FedosKeyFormatState`/`FedosKeyFormatStatus`/`FedosKeyFormatDescriptor`
> and one fixed accessor, `fedos_key_format_descriptor_placeholder()`).**
> `packages/fedos-core-rust/src/lib.rs`'s public `pub fn` surface grows
> from seventeen (Stage 103) to eighteen. Every label is planning intent
> only — no raw key byte, no owned string, no growable byte collection,
> no parser, no serializer, no validator, and no import/export function
> exists anywhere; the raw-input FORMAT decision itself stays
> UNIMPLEMENTED, exactly as `docs/public_key_provisioning.md` left it. No
> CSPRNG entropy source is consulted (no `getrandom`/`rand` usage
> anywhere in the new section); `Cargo.toml` is UNCHANGED; no
> Runtime/Worker/CryptoProvider/WASM wiring. New
> [`test/fedos_core_rust_key_format_label.test.ts`](test/fedos_core_rust_key_format_label.test.ts)
> (14 tests) checks all of the above; twenty-three pre-existing guard test
> files' hard-coded "pub fn total" checks were updated from 17 to 18 with
> the new function name (the same mass-update pattern every prior public
> API growth stage has used), and
> `test/fedos_core_rust_public_boundary_consolidation.test.ts`'s own
> Stage-103-scoped section extraction was narrowed to end at Stage 105's
> new marker instead of Stage 79's, so it stays scoped to exactly what
> Stage 103 added.
> `docs/public_key_provisioning.md` section 6 step 2 is marked complete;
> `packages/fedos-core-rust/README.md`'s "Public boundary overview" table
> and roadmap were updated to include the new group. `npm run typecheck`,
> `npm test` (109 files, 1508 tests), `cargo check`, `cargo test` (108
> tests, same count as Stage 104 — no new Rust unit test this stage,
> since no new `#[cfg(test)]` module was added), and `cargo check --tests`
> all stay GREEN. Where this stage stopped: no raw-input byte layout, no
> serialization/parsing format, and no import/export implementation were
> decided — deciding any of those would mean picking a real byte-level
> protocol, which is implementation, not label planning; the
> `FedosKeyExportBoundary` non-implementation question from Stage 103
> also remains untouched. Stage 106 candidates: (1) a public key-USAGE
> label enumeration (separating "what format is this key" from "what is
> this key allowed to be used for") — recommended, since it is the
> natural next boundary-design gap before any real
> import/generate/export decision has to conflate the two; (2) a WASM
> manifest validation skeleton; (3) a NIP-44 vector source/update check.
> Prior status:
>
> **Stage 104 — `getrandom` CSPRNG dependency adopted (build check
> ONLY, an EIGHTH `packages/fedos-core-rust/Cargo.toml` `[dependencies]`
> entry) + a `cfg(test)`-only RNG-verification-infrastructure
> PLACEHOLDER (`csprng_verification_infrastructure`, a fixed four-category
> label plan, never calling `getrandom`) + two new design docs
> ([`docs/public_random_design.md`](docs/public_random_design.md),
> [`docs/public_key_provisioning.md`](docs/public_key_provisioning.md)).**
> The public `pub fn` surface stays UNCHANGED at seventeen (Stage 103) —
> this stage adds no new public type or function. `getrandom` is not
> imported or called ANYWHERE in `src/lib.rs`, production or test; no
> `randomBytes`/nonce/encrypt/decrypt/deriveKey/key-generation/import/export
> IMPLEMENTATION exists. New
> [`test/fedos_core_rust_getrandom_adoption.test.ts`](test/fedos_core_rust_getrandom_adoption.test.ts)
> (16 tests) checks all of the above; six pre-existing guard test files
> (`fedos_core_rust_dependency.test.ts`, `fedos_core_rust_skeleton.test.ts`,
> `fedos_core_rust_aes_gcm_wiring.test.ts`,
> `fedos_core_rust_argon2_wiring.test.ts`,
> `fedos_core_rust_hkdf_wiring.test.ts`,
> `fedos_core_rust_rfc8439_wiring.test.ts`) had their whole-file
> "getrandom is absent" checks narrowed to each dependency's OWN line
> (Stage 104 makes `getrandom` legitimately present at the top level, even
> though `aes-gcm`/`argon2` still separately exclude their OWN optional
> `rand`/`getrandom` convenience features); two more
> (`fedos_core_rust_public_api_boundary.test.ts`,
> `fedos_core_rust_public_boundary_consolidation.test.ts`) had their
> "Cargo.toml is unchanged" tests narrowed to "not touched BY that
> specific stage" — still true. `src/lib.rs`'s own Stage 104 doc comment
> hit the same self-referential trap Stage 75 first documented — it
> initially wrote the literal text `` `#[cfg(test)]` `` while describing
> its own new test-only module, colliding with the `firstCfgTestIdx`
> "first #[cfg(test)] in the file" boundary a dozen pre-existing guard
> tests rely on to slice out "production code"; fixed by writing
> `` `cfg(test)` `` (no brackets) instead, matching how Stage 77's
> paragraph already phrased the identical situation. `packages/fedos-core-rust/README.md`
> also gained a new "Public boundary overview" table (Stage 102–104,
> unifying the by-then-long stage-by-stage narrative into one reference)
> and two design docs (`docs/public_random_design.md`,
> `docs/public_key_provisioning.md`) extending Stage 103's
> `public_random_boundary.md`/`public_key_boundary.md` now that the CSPRNG
> dependency choice is fixed and the key-import provisioning contract is
> designed — still no implementation. `npm run typecheck`, `npm test`
> (108 files, 1494 tests), `cargo check`, `cargo test` (108 tests, +2 from
> the new verification-plan unit tests), and `cargo check --tests` all
> stay GREEN. Where this stage stopped: the raw-input-to-opaque-handle
> provisioning path is now DESIGNED
> (`docs/public_key_provisioning.md`) but deliberately NOT implemented —
> and NOT even given a concrete request/response type — because fixing
> its exact byte-level shape would mean picking a real serialization
> format, which is implementation, not design; similarly, no CSPRNG
> feature configuration decision beyond "default features, native only"
> was made, since choosing a WASM-specific feature flag would anticipate a
> WASM target this crate does not have yet. Stage 105 candidates: (1) the
> key-format label enumeration `docs/public_key_provisioning.md` section 6
> step 2 references (still design-only, no implementation) — recommended,
> since it is the smallest remaining boundary-design gap and stays
> squarely on the "design, not implementation" side of the line the last
> three stages have held; (2) a WASM manifest validation skeleton; (3) a
> NIP-44 vector source/update check. Prior status:
>
> **Stage 103 — Consolidated placeholder API boundary: ten more
> label-only PUBLIC types
> (`FedosRandomBoundary`/`FedosNonceBoundary`/`FedosKeyGenerationBoundary`/
> `FedosKeyImportBoundary`/`FedosKeyExportBoundary` +
> `FedosCapabilityDescriptor`/`FedosAlgorithmDescriptor`/
> `FedosBoundaryVersion`/`FedosBoundaryFeature`/`FedosBoundaryPolicy`) and
> three new design docs
> ([`docs/public_random_boundary.md`](docs/public_random_boundary.md),
> [`docs/public_key_boundary.md`](docs/public_key_boundary.md),
> [`docs/public_boundary_versioning.md`](docs/public_boundary_versioning.md)),
> bundled into one reviewed stage per the user's explicit direction to
> consolidate as much of the public-API boundary's design as possible
> before any real implementation. `packages/fedos-core-rust/src/lib.rs`'s
> public `pub fn` surface grows from seven (Stage 102) to seventeen — the
> sixteen prior functions are byte-for-byte unchanged. No
> encrypt/decrypt/deriveKey/randomBytes/nonce/key generation/import/export
> IMPLEMENTATION function exists anywhere; every new function returns a
> fixed, non-sensitive label or status (`FedosBoundaryVersion`'s `u32`
> triple is the only non-enum field added, and it is a fixed constant).
> `Cargo.toml` is UNCHANGED — no new dependency. Nothing is wired into the
> host's execution environment, its background worker, or a crypto
> provider; no WASM binding exists. New
> [`test/fedos_core_rust_public_boundary_consolidation.test.ts`](test/fedos_core_rust_public_boundary_consolidation.test.ts)
> (19 tests) checks all of the above; twenty-four pre-existing guard test
> files' hard-coded "pub fn total" checks were updated from 7 to 17 with
> the ten new names (the same mass-update pattern Stage 102 used for
> 6→7), and `test/fedos_core_rust_public_api_boundary.test.ts`'s own
> Stage-102-scoped section extraction was narrowed to end at Stage 103's
> new marker instead of Stage 79's, so it stays scoped to exactly what
> Stage 102 added. Where this stage stopped: a real key-import boundary
> design touches the one place raw secret bytes would legitimately cross
> this boundary, so `docs/public_key_boundary.md` reserves that
> provisioning-path design as its own future, separately-reviewed stage
> rather than sketching it here — consolidating further would mean
> picking a real CSPRNG dependency or a real byte-level protocol, which is
> implementation, not boundary design. `npm run typecheck`, `npm test`
> (107 files, 1478 tests), `cargo check`, `cargo test` (106 tests, same
> count as Stage 102 — no new Rust unit test this stage, since no new
> `#[cfg(test)]` module was added), and `cargo check --tests` all stay
> GREEN. Stage 104 candidates: (1) a CSPRNG dependency adoption (no
> `randomBytes`/nonce implementation yet) — the natural next step per
> `docs/public_random_boundary.md`'s own roadmap; (2) a WASM manifest
> validation skeleton; (3) a NIP-44 vector source/update check. Prior
> status:
>
> **Stage 102 — Public crypto API design docs + a placeholder API
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
100. FedOS Core Architecture Freeze v1 ([`docs/fedos_core_architecture_freeze_v1.md`](docs/fedos_core_architecture_freeze_v1.md); docs only, no code, no `Cargo.toml` change; fixes the Stage 79–99 internal skeleton architecture — role table, explicitly-unconnected pairs, public API/Runtime/Worker/CryptoProvider non-wiring confirmed, what IS verified today vs. what is NOT yet implemented, non-claims section, recommended next-phase order) ✓
101–170. FedOS Core Rust crate real crypto build-out — "Internal Crypto Completion" ([`packages/fedos-core-rust`](packages/fedos-core-rust/README.md); see that package's own README for the full stage-by-stage record). Real, `cargo test`-verified implementations replace the Stage 79–99 skeletons one capability at a time: `SecretHandle` real-byte storage, HKDF-SHA256 key derivation, real AEAD (ChaCha20-Poly1305 + AES-256-GCM) seal/open, a real ciphertext envelope bridged to that AEAD output, and — Stage 166–167 — this crate's first public crypto-operation functions, `fedos_encrypt`/`fedos_decrypt` (public `pub fn` surface: 24 → 26; `SecretHandle`/the envelope type stay `pub(crate)` by deliberate, documented choice — see `docs/public_crypto_api.md`). Still not wired to the Runtime, Worker, storage, or Nostr; still no NIP-44; still no WASM binding; still no new `Cargo.toml` dependency beyond the crypto crates already adopted. ✓
171–176. FedOS Core Rust crate "Public opaque crypto API completion" ([`packages/fedos-core-rust`](packages/fedos-core-rust/README.md); see `docs/public_crypto_opaque_handles.md` for the full design record). Resolves Stage 166–170's one deliberate limitation: two new public OPAQUE wrapper types, `FedosAeadKeyHandle`/`FedosCiphertextEnvelope` (no `Clone`/`Debug`/`Display`/`Serialize`/`AsRef<[u8]>`, no public raw-byte getter — `SecretHandle`/`AeadCiphertextEnvelope` themselves stay `pub(crate)` forever), a new key-generation entry point `fedos_generate_aead_key_32`, and two new public label enums `FedosAeadAlgorithm`/`FedosAeadAadDomain` (`AeadCipher`/`AeadAadDomain` themselves stay `pub(crate)`-only) make `fedos_encrypt`/`fedos_decrypt` genuinely callable from OUTSIDE this crate — proven by a real Cargo integration test (`packages/fedos-core-rust/tests/public_crypto_api.rs`), not just a string-scan assertion. Public `pub fn` surface: 26 → 27. Still no Runtime/Worker/Storage/Nostr/NIP-44/WASM connection, no ciphertext serialization, no new `Cargo.toml` dependency. ✓
177–181. FedOS Core Rust crate "Ciphertext serialization + NIP-44 + storage/send boundary planning" ([`packages/fedos-core-rust`](packages/fedos-core-rust/README.md); planning/skeleton/docs/guards only). A new crate-private `crypto::ciphertext_transport` module adds a LABEL-ONLY `CiphertextTransportDescriptor` (version/algorithm/encoding-placeholder/transport-kind/status; holds no ciphertext, nonce, tag, or key). Three new planning documents, no code: `docs/ciphertext_envelope_serialization_plan.md` (wire-format field list, four candidate encodings compared, seven selection criteria fixed, no MVP chosen; raw secret/key-ID/buyer-payment-entitlement metadata excluded), `docs/nip44_internal_plan.md` (NIP-44 v2's conversation-key/message-key/padding/MAC pipeline fixed against this repo's already-imported `test-vectors/nip44/nip44-v2.json`, no code, no secp256k1 dependency), and `docs/encrypted_payload_storage_boundary.md` (what a future encrypted payload may hand to `StorageBackend`/`FederationProvider` — no implementation, no bridge; this crate remains `crate-type = ["rlib"]` only). No public API addition — still twenty-seven `pub fn`s. No serialization implementation, no NIP-44 implementation, no Runtime/Worker/Storage/Nostr/WASM connection, no `Cargo.toml` change. ✓
182–185. FedOS Core Rust crate + TypeScript "Ciphertext serialization format decision + TypeScript encrypted payload descriptor + NIP-44 vector readiness" ([`packages/fedos-core-rust`](packages/fedos-core-rust/README.md); planning/skeleton/docs/guards only). `docs/ciphertext_serialization_format_decision.md` picks the MVP wire encoding (canonical JSON + base64url fields, field order `v`/`alg`/`aad`/`n`/`ct`/`tag`) `docs/ciphertext_envelope_serialization_plan.md` left open — `crypto::ciphertext_transport::CiphertextEncodingPlaceholder` gains an additive `CanonicalJsonBase64UrlPlaceholder` label (`Undecided` stays valid); still no encode/decode function, no dependency change. [`src/storage/encrypted_payload.ts`](src/storage/encrypted_payload.ts) (new) adds `EncryptedPayloadDescriptor` + a pure `reviewEncryptedPayloadDescriptor` — label/metadata-only, no payload/plaintext/raw-key field, rejects buyer/payment/entitlement/chat/private metadata, not wired to `StorageBackend`/`FederationProvider`. `docs/encrypted_payload_storage_boundary.md`/`docs/nostr_adapter_planning.md` updated to name it as the pre-`StorageBackend` step, still unconnected. `docs/nip44_vector_readiness.md` confirms `test-vectors/nip44/nip44-v2.json`'s 8 categories are ready and fixes the 7-step implementation order (vector schema guard → secp256k1 adoption → conversation-key → message-key → padding → encrypt/decrypt → invalid-case tests). No public API addition — still twenty-seven `pub fn`s. No serialization/NIP-44 implementation, no secp256k1 dependency, no Rust↔TypeScript/WASM bridge, no Storage/Federation/Nostr/Runtime/Worker connection, no `Cargo.toml`/`package.json` change. ✓
186–188. FedOS Core Rust crate "Rust ciphertext serialization implementation + NIP-44 vector schema guard" ([`packages/fedos-core-rust`](packages/fedos-core-rust/README.md)). Implements the Stage 182 format decision: `src/crypto/ciphertext_serialization.rs` adds `encode_envelope_internal`/`decode_envelope_internal` (canonical JSON + base64url, field order `v`/`alg`/`aad`/`n`/`ct`/`tag`, strict order both ways, `ct`/`tag` split at the fixed 16-byte AEAD tag length) hand-written against the STANDARD LIBRARY ONLY — `serde`/`serde_json`/`hex` stay `[dev-dependencies]`-only, `Cargo.toml` byte-for-byte unchanged. `src/crypto/nip44_vector_schema.rs` (`#[cfg(test)]`-only) completes `docs/nip44_vector_readiness.md` §3's step 1: confirms `test-vectors/nip44/nip44-v2.json`'s 8 categories parse and match the documented schema — no cryptographic verification, no secp256k1 dependency. Both format-decision and vector-readiness docs updated to record completion. No public API addition — still twenty-seven `pub fn`s. No NIP-44 cryptography, no TypeScript serialization, no Runtime/Worker/Storage/Nostr/WASM connection, no `Cargo.toml`/`package.json` change. ✓
189–193. FedOS "Encrypted payload preview + payload diagnostics + NIP-44 dependency adoption planning" (TypeScript display layer + Rust dependency planning, no new cryptography). [`src/render/encrypted_payload_preview.ts`](src/render/encrypted_payload_preview.ts) (new) adds `renderEncryptedPayloadPreview`/`renderEncryptedPayloadPreviewPage` — shows only version/algorithm/aadDomain/encoding/payloadId/transportKind/status from a new `PayloadPreviewDescriptor` (`src/storage/encrypted_payload.ts`, Stage 191; carries no ciphertext/nonce/tag/plaintext/key/metadata field at all); Export/Download/Copy/Decrypt render as permanently `disabled` buttons. [`src/render/payload_diagnostics.ts`](src/render/payload_diagnostics.ts) (new) adds pure `buildPayloadDiagnostics`/`renderPayloadDiagnostics` over a new `PayloadDiagnosticsDescriptor` — algorithm/encoding/version/transport/validation status only. `src/storage/encrypted_payload.ts` gains both new descriptor types plus a pure `reviewPayloadPreview`. `docs/nip44_dependency_adoption.md` (new) compares `rust-secp256k1` (C-FFI, Bitcoin-Core-proven) vs `k256` (pure Rust, RustCrypto-family) against fixed adoption criteria (feature minimalism, no `rand`/`serde`, audit posture, `no_std`/WASM, MSRV, scope discipline) — picks neither, `Cargo.toml` unchanged. No public API addition — still twenty-seven `pub fn`s. No NIP-44 cryptography (no ECDH/conversation-key/message-key/padding/MAC/encrypt/decrypt), no secp256k1/k256 dependency, no TypeScript serialization, no Runtime/Worker/Storage/Federation/Relay connection, no `Cargo.toml`/`package.json` change. ✓
194–197. FedOS Core Rust crate "secp256k1 dependency adoption + capability/diagnostics update + guards + documentation" ([`packages/fedos-core-rust`](packages/fedos-core-rust/README.md); resolves Stage 192's open comparison). `Cargo.toml` adopts `k256` (`default-features = false`, `features = ["arithmetic"]` only — no `ecdsa`/`schnorr`/`serde`/`pem`/`pkcs8`/`rand` feature; production dependency count 9 → 10), with a documented REVIEWED EXCEPTION for `rand_core` appearing as an unavoidable, trait-only transitive dependency of `elliptic-curve`/`ff`/`group`/`crypto-bigint` (verified via `cargo tree -i rand_core`; the full `rand` crate remains absent). `CryptoCapability` gains an eleventh variant, `Ecdh`; `CapabilityReadiness` gains a fourth variant, `ReadyForImplementation`, reported for `Ecdh` alone (dependency adopted, zero ECDH code). New `crypto::secp256k1_dependency_guard` (`#[cfg(test)]`-only Rust module) and `test/secp256k1_dependency_guard.test.ts` (TypeScript) guard the exact minimal shape of this adoption. `docs/nip44_dependency_adoption.md` records the decision, the feature-selection rationale, and fixes the future implementation order: ECDH → ConversationKey → MessageKey → Padding → Encrypt → Decrypt → NIP-44. No public API addition — still twenty-seven `pub fn`s. No ECDH/conversation-key/message-key/padding/encrypt/decrypt/NIP-44 implementation, no Runtime/Worker/Storage/Federation/Relay/WASM/FFI connection, no TypeScript serialization change. ✓
198–201. FedOS Core Rust crate "NIP-44 key-derivation half: ConversationKey + ECDH + MessageKey + HKDF bridge" ([`packages/fedos-core-rust`](packages/fedos-core-rust/README.md); implements `docs/nip44_internal_plan.md` §3 for real). New `crypto::conversation_key` adds `ConversationKey` (`SecretHandle`-backed, no `Clone`/`Debug`/raw-byte getter) plus the REAL `derive_conversation_key_via_ecdh_internal`: secp256k1 ECDH via manual `k256` `arithmetic`-only point multiplication (no `ecdh` Cargo feature added) followed by HKDF-SHA256 extract-only with the fixed `"nip44-v2"` salt — vector-verified against all 43 `valid`/`invalid .get_conversation_key` cases in `test-vectors/nip44/nip44-v2.json`. New `crypto::message_key` adds the same-shaped `MessageKey` type (skeleton only). New `crypto::hkdf_bridge` connects them via the pre-existing, FIXED `HkdfDomain::Conversation` (Stage 147) — a generic architectural bridge, deliberately NOT NIP-44 v2's real per-message nonce-salted derivation (a future, separate stage). `CryptoCapability` grows from eleven to fifteen variants (`MessageKey`/`Padding`/`Encrypt`/`Decrypt` added); `Ecdh`/`ConversationKey`/`MessageKey` now report `Ready`, `Encrypt`/`Decrypt` report `NotConnected`, `Padding` reports `NotImplemented`. Two new `#[cfg(test)]`-only Rust guards (`nip44_conversation_key_vectors`, `nip44_key_derivation_guard`) plus `test/nip44_key_derivation_stage_guard.test.ts` confirm encapsulation and vector correctness. No public API addition — still twenty-seven `pub fn`s. No padding, no NIP-44 encrypt/decrypt, no Runtime/Worker/Storage/Federation/Relay/WASM/FFI connection, no TypeScript serialization change, no new `Cargo.toml` dependency. ✓
202–240. FedOS Core Rust crate "NIP-44 v2 wire-compatible implementation" — from the Stage 202–208 generic internal bridge through a byte-exact wire pipeline ([`packages/fedos-core-rust`](packages/fedos-core-rust/README.md); see that package's own README for the full stage-by-stage record — this entry summarizes). Stage 202–208 implement §5 (padding, spec-exact) and a generic pad-then-seal/open-then-unpad bridge reusing this crate's own pre-existing ChaCha20-Poly1305 AEAD — explicitly named the "FedOS internal NIP-44-like bridge", NOT byte-exact NIP-44 v2 (`docs/nip44_wire_compatibility_gap.md`, Stage 209–213, fixes this terminology in writing and forbids ever calling it "NIP-44 compatible"; `docs/nip44_wire_implementation_roadmap.md` fixes the 8-step path to real wire compatibility). Stage 214–228 review/plan/skeleton the exact per-message key derivation, the 32-byte wire nonce, and the wire payload field order, then implement the first real pieces: exact HKDF-Expand message-key derivation (`crypto::nip44_message_keys`, vector-verified against all 32 `valid.get_message_keys` cases) and real wire nonce generation (`crypto::nip44_wire_nonce`, independent of the pre-existing `fedos_aead_nonce_96`). Stage 229–233 hand-implement (no new `Cargo.toml` dependency) a byte-exact raw ChaCha20 stream cipher (`crypto::nip44_stream_cipher`, RFC 8439) and real HMAC-SHA256 authentication (`crypto::nip44_hmac`, RFC 2104, using this crate's own `subtle::ConstantTimeEq` for the tag comparison), composed into a complete verify-HMAC → decrypt-stream → unpad DECRYPT pipeline (`crypto::nip44_wire_decrypt`). Stage 234–237 hand-implement standard base64 wire payload encoding (`crypto::nip44_wire_encoding` — deliberately separate from `crypto::ciphertext_serialization`'s own base64url codec, Stage 186, UNCHANGED), wire `invalid.decrypt`'s full 12-case category, and implement the complete ENCRYPT pipeline (`crypto::nip44_wire_encrypt`) — full round-trip vector verification confirms this crate's own encrypt+decrypt reproduces EVERY `valid.encrypt_decrypt` vector's payload string and plaintext exactly, and EVERY `invalid.decrypt` vector correctly fails. Stage 238–240 update diagnostics (`crypto::nip44_wire_diagnostics`'s preview: eight rows, all `Ready` except `WirePayload`'s intentional `Placeholder`), guards, and docs to record: the NIP-44 v2 wire encrypt/decrypt implementation is now COMPLETE at the crate-internal level. **Still true throughout Stage 202–240**: no `CryptoCapability` variant added beyond the sixteen already fixed by Stage 208 (`Authentication`); no public API addition — still twenty-seven `pub fn`s; `fedos_encrypt`/`fedos_decrypt` (Stage 166–176) completely untouched and unrelated; no Runtime/Worker/Storage/Federation/Relay/Nostr/WASM/FFI connection anywhere in this NIP-44 wire code. What remains: bridging this pipeline to a real Nostr encrypted-direct-message flow, and deciding whether/how a future public API ever exposes it — both explicitly deferred, separate, future stages. ✓
241–248. FedOS Core Rust crate "NIP-44 public wire boundary: planning + skeleton" ([`packages/fedos-core-rust`](packages/fedos-core-rust/README.md); see that package's own README for the full stage-by-stage record — this entry summarizes). With the internal wire pipeline complete (Stage 234–240), this arc fixes the FINAL PUBLIC BOUNDARY a future stage would connect Runtime/Nostr to, still without making that connection. Stage 241 adds `docs/public_nip44_wire_api.md`, planning the boundary in front of the complete internal pipeline and stating explicitly that `ConversationKey`/`MessageKey`/`SecretHandle`/`Nip44WirePayload` are NEVER exposed publicly — only an OPAQUE HANDLE, mirroring `docs/public_crypto_opaque_handles.md`'s existing AEAD-handle design, would ever be. Stage 242 adds `crypto::nip44_public_api`, an internal-only, label-only `pub(crate)` skeleton (`Nip44OpaqueConversation`/`Nip44OpaquePayload`/`Nip44OpaqueStatus`/`Nip44OpaqueDecision`) naming that future shape — no public API added. Stage 243 adds `docs/runtime_crypto_bridge.md`, planning the `Runtime → Opaque API → Internal Crypto` connection policy against the existing, unchanged `CryptoProvider` seam (`src/crypto/types.ts`) — no Runtime code touched. Stage 244 adds `docs/nostr_dm_bridge.md`, planning the DM publish/receive flow against the existing, unchanged `FederationProvider`/`ChatProvider` seams (`src/federation/types.ts`) — NIP-17/Relay/Network explicitly left unconnected. Stage 245 adds `test/fedos_core_rust_nip44_public_boundary.test.ts`, guarding the unchanged `pub fn` count, the `pub(crate)`-only status of every internal secret/key/payload type, and the absence of any Runtime/Worker/Storage/Relay/NIP-17 reference. Stage 246 extends `crypto::nip44_public_api` with a fixed `Nip44PublicBoundaryReadiness` diagnostics label moving from `NipInternal` to `PublicBoundaryReady` (planned + skeleton-named, still not a real public API). Stage 247 updates `docs/nip44_wire_implementation_roadmap.md` with the Stage 249–252 candidates (Runtime opt-in bridge, Nostr DM bridge, NIP-17 planning, WASM; recommended order 249 → 250 → 251, with 252 independent). Stage 248 is a final review confirming no `Cargo.toml`/`package.json`/`pub fn` change and no Runtime/Storage/Worker/Relay/NIP-17 connection anywhere in this arc. **Still true throughout Stage 241–248**: no public API addition — still twenty-seven `pub fn`s; no new Cargo dependency; no Runtime/Worker/Storage/Relay/Nostr/NIP-17/WASM/FFI connection. ✓
249–256. "Runtime Crypto Boundary Foundation" ([`src/runtime/`](src/runtime/); renumbers Stage 247's original 249–252 candidate slots — still planning/definitions, not the actual Runtime opt-in connection, per this arc's own "no commitment to exact Stage numbers" discipline). New `src/runtime/crypto_provider.ts` (Stage 249) defines `RuntimeCryptoProvider` — a NEW, Runtime-facing seam (`encrypt`/`decrypt`/`capabilities`/`status`, deliberately separate from `src/crypto/types.ts`'s existing `CryptoProvider`) whose one implementation, `PlaceholderRuntimeCryptoProvider`, resolves every operation to ONLY `Placeholder`/`NotConnected`/`Unsupported` — never real cryptography, and never calling `packages/fedos-core-rust` (Rust crate or TS package boundary) at all. New `src/runtime/runtime_crypto_capability.ts` (Stage 250) is a pure `RuntimeCryptoCapability → CryptoCapability` mapping table — no execution. New `src/runtime/runtime_crypto_diagnostics.ts` (Stage 251) is a read-only diagnostics preview reading ONLY `status()`/`capabilities()` (never `encrypt()`/`decrypt()`), reporting `Enabled`/`Disabled`/`Placeholder`/`NotConnected` — `Enabled` is never produced. New `docs/runtime_worker_crypto_bridge.md` (Stage 252) names a FOURTH boundary layer, `Runtime → Opaque API → FedOS → Internal Crypto` — "FedOS" being the already-existing, inert `packages/fedos-core-rust` TS package boundary (Stage 59) — extending `docs/runtime_crypto_bridge.md`'s three-layer policy; no Worker code touched. New `docs/fedos_wasm_boundary.md` (Stage 253) restates the opaque-handle-only rule specifically for a future WASM boundary: `ConversationKey`/`MessageKey`/`SecretHandle`/`Nip44WirePayload` may never cross a JS↔WASM marshalling boundary either. Stage 254 adds `test/runtime_crypto_boundary.test.ts`, guarding: every `RuntimeCryptoProvider` operation stays denied; the capability mapping is exhaustive and pure; diagnostics never calls encrypt/decrypt; no Runtime/Worker file references FedOS crypto or WASM; `pub fn` count/`Cargo.toml`/`package.json`/`CryptoCapability`-variant-count all unchanged. Stage 255 updates this README with the architecture diagram `Runtime → Opaque Layer → FedOS Core → Crypto Core`. Stage 256 is verification. **Still true throughout Stage 249–256**: `RuntimeCryptoProvider` is NOT wired into `AppRuntime`/`createRuntime`/the Worker; no Storage/Relay/Nostr-Publish/NIP-17/WASM/FFI connection; no public API addition — still twenty-seven `pub fn`s; no new Cargo/npm dependency; `SecretHandle`/`ConversationKey`/`MessageKey`/`Nip44WirePayload` remain unexposed. ✓
257–264. "Runtime Opt-in Crypto Bridge (Non-Operational)" ([`src/runtime/`](src/runtime/)). Wires a `RuntimeCryptoProvider` into `AppRuntime` for the first time — still opt-in-gated OFF, still no real cryptography. New `src/runtime/runtime_crypto_registry.ts` (Stage 257) adds `RuntimeCryptoProviderRegistry`, registering ONLY `"placeholder"` → `PlaceholderRuntimeCryptoProvider` by default — no FedOS/Rust/WASM provider is ever registered. New `src/runtime/runtime_crypto_config.ts` (Stage 258) fixes `runtimeCryptoEnabled: false` as a frozen constant, reading no `RuntimeEnv`/`process.env` field at all. New `src/runtime/runtime_crypto_bridge.ts` (Stage 259) adds `buildRuntimeCryptoProvider()`, resolving the Registry's `"placeholder"` entry in both branches of `if (!runtimeCryptoEnabled)` — a provider is never constructed with `new` outside the Registry. Stage 260 adds `AppRuntime.crypto`/`RuntimeOverrides.runtimeCryptoProvider` (`src/runtime/types.ts`) and wires `createRuntime()`'s new `selectRuntimeCryptoProvider` into the assembled runtime — selection only; `createRuntime` never calls `encrypt`/`decrypt`. Stage 261 adds `runtimeCryptoActivationStatus()` (`src/runtime/runtime_crypto_diagnostics.ts`), reporting a fixed `{ enabled: false, provider: "placeholder" }` summary read directly from the Stage 258 config. New `docs/runtime_crypto_activation.md` (Stage 262) names a five-layer activation path, `Runtime → Registry → Opaque Provider → FedOS → Crypto` — no activation flag flipped, no real provider registered. Stage 263 adds `test/runtime_crypto_activation_boundary.test.ts` (19 tests), guarding: the Registry's default-only-placeholder invariant; the config's permanently-`false`/env-free value; the bridge's registry-only resolution (even with a supplied empty registry); `AppRuntime.crypto` defaulting to the placeholder and an override still never being called; the activation status's fixed shape; no Worker reference to any of the four new files; and the usual `pub fn`/`Cargo.toml`/`package.json`/`CryptoCapability`-count/opaque-type invariants. Stage 264 is verification. **Still true throughout Stage 257–264**: `runtimeCryptoEnabled` is permanently `false`; no Runtime→FedOS real connection, no `encrypt`/`decrypt` execution, no Worker/WASM/FFI/Storage/Relay/Nostr-Publish/NIP-17 connection; no public API addition — still twenty-seven `pub fn`s; no new Cargo/npm dependency; `SecretHandle`/`ConversationKey`/`MessageKey`/`Nip44WirePayload` remain unexposed. ✓
265–272. "Runtime FedOS Provider Integration (Opt-in, Safe-by-default)" ([`src/runtime/`](src/runtime/)). Gives the Registry a second, FedOS-named provider, and gates it behind an explicit two-flag opt-in that never actually passes. New `src/runtime/fedos_runtime_crypto_provider.ts` (Stage 265) adds `FedosRuntimeCryptoProvider` — `encrypt`/`decrypt` ALWAYS resolve to `"Unsupported"`, and no `packages/fedos-core-rust` call exists in the file. Stage 266 registers it as `"fedos"` in `createDefaultRuntimeCryptoProviderRegistry()`, alongside the unchanged `"placeholder"` entry — registering it changes nothing about which provider is actually used. Stage 267 extends `RuntimeCryptoConfig` (`src/runtime/runtime_crypto_config.ts`) with `runtimeCryptoProvider: "placeholder" | "fedos"`, fixed at `"placeholder"`, reading no env. Stage 268 rewrites `buildRuntimeCryptoProvider()`'s (`src/runtime/runtime_crypto_bridge.ts`) selection into a two-flag `&&` gate (`runtimeCryptoEnabled && runtimeCryptoProvider === "fedos"`) — since `runtimeCryptoEnabled` stays permanently `false`, this branch can never actually run, and a provider is still never constructed with `new` outside the Registry. Stage 269 extends `runtimeCryptoActivationStatus()` (`src/runtime/runtime_crypto_diagnostics.ts`) to report the EFFECTIVE provider name (mirroring the bridge's own gate) rather than blindly echoing the config — still permanently `"placeholder"`. New `docs/runtime_fedos_provider_activation.md` (Stage 270) names a five-step order, `Placeholder → FedOS Provider → Worker → Runtime → Nostr` — no activation happens. Stage 271 adds `test/runtime_fedos_provider_boundary.test.ts` (15 tests), guarding: `FedosRuntimeCryptoProvider` always denies with `Unsupported`; the Registry's two-name default; the config's fixed values and env-free reads; the bridge's `&&`-only gate and registry-only construction; the diagnostics' mirrored effective-provider computation; `AppRuntime.crypto` still defaulting to the placeholder; no Worker reference to any of the new files; and the usual `pub fn`/`Cargo.toml`/`package.json` invariants. Stage 272 is verification. **Still true throughout Stage 265–272**: `runtimeCryptoEnabled` is permanently `false`; Runtime never calls `encrypt`/`decrypt`; no Worker/WASM/FFI/Relay/Storage/NIP-17 connection; no new Rust `pub fn`, no `Cargo.toml`/`package.json` change; `SecretHandle`/`ConversationKey`/`MessageKey`/`Nip44WirePayload` remain unexposed. ✓
273–280. "Worker Opt-in Gate Foundation" ([`src/runtime/`](src/runtime/)). Gives Worker its OWN, completely independent config/registry/bridge/diagnostics stack, parallel to Runtime's — still never imported by `src/worker.ts`. New `src/runtime/worker_crypto_config.ts` (Stage 273) fixes `workerCryptoEnabled: false`/`workerCryptoProvider: "placeholder"`, reading no env. New `src/runtime/worker_crypto_registry.ts` (Stage 274) builds a SEPARATE `RuntimeCryptoProviderRegistry` instance (reusing Stage 257's class and Stage 249/265's provider types — no new provider type needed) registering `"placeholder"`/`"fedos"`; `"fedos"` is constructible but its `encrypt`/`decrypt` are never called by anything in this stage. New `src/runtime/worker_crypto_bridge.ts` (Stage 275) adds `buildWorkerCryptoProvider()`, mirroring the Runtime bridge's two-flag `&&` gate against Worker's own config/registry — never reaching into Runtime's registry, and nothing calls this function yet. New `docs/runtime_worker_activation_boundary.md` (Stage 276) names a five-layer review order, `Runtime → Worker Bridge → FedOS Provider → FedOS Core → Crypto`, and explains why Runtime/Worker each get independent knobs. New `src/runtime/worker_crypto_diagnostics.ts` (Stage 277) adds `workerCryptoActivationStatus()`, reporting `{ enabled, provider, reachable }` — `reachable` fixed `false` since `src/worker.ts` cannot reach this boundary at all yet. Stage 278 adds `test/worker_crypto_boundary.test.ts` (16 tests), guarding: the config's fixed/env-free values; the registry's two-name default as a SEPARATE instance from Runtime's; the bridge's `&&`-only gate and registry-only construction; no Worker crypto file calling `encrypt`/`decrypt` itself; the Runtime and Worker crypto stacks never importing each other; the Worker never referencing any of the five new files; and the usual `pub fn`/`Cargo.toml`/`package.json` invariants. Stage 279 updates this README. Stage 280 is verification. **Still true throughout Stage 273–280**: `workerCryptoEnabled`/`runtimeCryptoEnabled` are both permanently `false`; neither Worker nor Runtime calls `encrypt`/`decrypt`; no Relay/Storage/WASM/FFI/NIP-17 connection; no new Rust `pub fn`, no `Cargo.toml`/`package.json` change. ✓
281–288. "Env-Selectable Crypto Provider Naming" ([`src/runtime/`](src/runtime/)). Lets Runtime and Worker each read `FEDOS_CRYPTO_PROVIDER` to CHOOSE a provider NAME — still without ever executing crypto or flipping either `enabled` gate. New `src/runtime/crypto_provider_env.ts` (Stage 281) adds `parseFedosCryptoProviderEnv`, shared by both sides: recognizes ONLY the literal (trimmed) strings `"placeholder"`/`"fedos"` — `undefined`/empty/unrecognized text AND truthy-flag spellings (`"true"`/`"1"`/`"on"`/`"enabled"`) AND dev-only variant names (`"fedos-dev-only"`, etc.) all fall back to `"placeholder"`. Stage 282 makes `runtime_crypto_config.ts`'s `getRuntimeCryptoConfig` accept an OPTIONAL `FedosCryptoProviderEnvLike` and derive `runtimeCryptoProvider` from it — `runtimeCryptoEnabled` stays fixed `false`; reads no `process.env`. Stage 283 does the same for `worker_crypto_config.ts`. Stage 284 adds a matching OPTIONAL `env` parameter (placed AFTER `registry` so every existing call site keeps working) to both `buildRuntimeCryptoProvider`/`buildWorkerCryptoProvider`, confirming their existing two-flag `&&` gates still hold: `FEDOS_CRYPTO_PROVIDER=fedos` alone still never resolves a `FedosRuntimeCryptoProvider`. Stage 285 splits both diagnostics functions' single `provider` field into `configuredProvider` (the parsed config value — NEVER the raw env string) and `effectiveProvider` (the two-flag-gated result) — setting the env var makes `configuredProvider` report `"fedos"` while `effectiveProvider` stays `"placeholder"`. Stage 286 updates `docs/runtime_crypto_activation.md`/`docs/runtime_fedos_provider_activation.md`/`docs/runtime_worker_activation_boundary.md` to record all of the above. Stage 287 adds `test/crypto_provider_env.test.ts` (9 tests) plus extends the three existing guard suites (23/18/20 tests) confirming: exact two-value parsing; truthy-flag/dev-only rejection; no raw env string leak into diagnostics; no `process.env` reference anywhere; `FedosRuntimeCryptoProvider` still always `Unsupported`; and the usual `pub fn`/`Cargo.toml`/`package.json` invariants. Stage 288 is verification. **Still true throughout Stage 281–288**: both `enabled` gates stay permanently `false`; Runtime/Worker never call `encrypt`/`decrypt`; no Relay/Storage/WASM/FFI/NIP-17 connection; no new Rust `pub fn`, no `Cargo.toml`/`package.json` change. ✓
289–296. "Activation Policy (Fail-Closed)" ([`src/runtime/`](src/runtime/)). Answers "may FedOS crypto activate RIGHT NOW, and why not" — a single, auditable reason, independent of (and layered on top of) the bridge's own two-flag gate. New `src/runtime/runtime_crypto_activation_policy.ts` (Stage 289) adds `evaluateRuntimeCryptoActivation`, checking, in fixed priority order: `!runtimeCryptoEnabled` → `"DisabledByConfig"`; `runtimeCryptoProvider !== "fedos"` → `"ProviderNotSelected"`; otherwise → `"ProviderUnavailable"` (a fixed, private, permanently-`false` `FEDOS_PROVIDER_IMPLEMENTED` constant with no override anywhere makes `"Allowed"` structurally unreturnable this stage). New `src/runtime/worker_crypto_activation_policy.ts` (Stage 290) is a fully INDEPENDENT re-implementation for Worker — no shared import, no shared type, mirroring `docs/runtime_worker_activation_boundary.md`'s own "separate knob per boundary" discipline. Stage 291 adds `activationReason` to both `runtimeCryptoActivationStatus()`/`workerCryptoActivationStatus()`. New `docs/runtime_crypto_activation_policy.md` (Stage 292) names the five conditions FedOS activation needs ALL of (env selection, the enable gate, a real provider implementation, Runtime connection, Worker connection) — missing even one means FedOS never starts. New `docs/runtime_crypto_threat_model.md` (Stage 293) states the fail-closed guarantee explicitly: setting `FEDOS_CRYPTO_PROVIDER=fedos` alone, with nothing else changed, starts no cryptography — `"DisabledByConfig"` wins over the provider name every time. Stage 294 adds `test/runtime_crypto_activation_policy.test.ts` (16 tests), guarding: `"Allowed"` never returned by either function; `"DisabledByConfig"` always wins when disabled, regardless of provider; the exact priority order for `"ProviderNotSelected"`/`"ProviderUnavailable"`; full Runtime/Worker independence; no `process.env` reference; no `encrypt`/`decrypt` call; and the usual `pub fn`/`Cargo.toml`/`package.json` invariants. Stage 295 updates this README with an Activation Policy section stating plainly: **FedOS does not start just because a provider was chosen.** Stage 296 is verification. **Still true throughout Stage 289–296**: both `enabled` gates stay permanently `false`; `"Allowed"` is never returned; Runtime/Worker never call `encrypt`/`decrypt`; no Relay/Storage/Nostr/WASM/FFI connection; no `RuntimeEnv`/Rust/`Cargo.toml`/`package.json` change; no new `pub fn`. ✓
297–304. "Dual-Lock Activation Gate" ([`src/runtime/`](src/runtime/)). Adds a SECOND, independent lock alongside `FEDOS_CRYPTO_PROVIDER` ("Lock #1", unchanged): `FEDOS_CRYPTO_ENABLED` ("Lock #2"), which accepts EXACTLY ONE enabling value — the literal `"explicit-dev-only"` — and treats EVERYTHING else, including every common truthy spelling (`"true"`/`"1"`/`"yes"`/`"on"`/`"enabled"`), negatives, environment-name-shaped words (`"dev"`/`"prod"`/etc.), and FedOS-adjacent words (`"allow-fedos"`/`"real-fedos"`/etc.), as `"disabled"`. New `src/runtime/crypto_provider_env.ts`'s `parseFedosCryptoEnabledEnv` (Stage 297) is the shared parser (mirroring `FEDOS_CRYPTO_PROVIDER`'s own Stage 281 precedent), extending `FedosCryptoProviderEnvLike` with an optional `FEDOS_CRYPTO_ENABLED` field — `parseFedosCryptoProviderEnv`'s own behavior is completely unchanged. `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation` (Stage 297, each independently) now treat the gate as "enabled" if EITHER the existing fixed config flag (still permanently `false`) OR the env lock parses to `"explicit-dev-only"` — but `runtime_crypto_bridge.ts`/`worker_crypto_bridge.ts` are NOT touched, so a real `FedosRuntimeCryptoProvider` still never gets resolved, and `FEDOS_PROVIDER_IMPLEMENTED` stays fixed `false` in both policy files, so `"Allowed"` is STILL never returned — even when `provider === "fedos"` AND `enabled === "explicit-dev-only"` simultaneously, the result is `"ProviderUnavailable"`. Diagnostics gain `configuredEnabled` (the parsed Lock #2 label); `effectiveProvider` is deliberately unchanged and can now diverge from `activationReason`. `docs/runtime_crypto_activation_policy.md`/`docs/runtime_crypto_threat_model.md` document the dual-lock model, why `explicit-dev-only` was chosen over a boolean flag, and the "both locks set" scenario (still nothing happens). `test/runtime_crypto_dual_lock.test.ts` (17 tests) guards: every common truthy/negative/environment-name/FedOS-adjacent spelling rejected; only `explicit-dev-only` accepted; both locks open still cannot activate crypto; `"Allowed"` unreachable under any input; Runtime/Worker independence; neither bridge reads `FEDOS_CRYPTO_ENABLED`; Worker still doesn't import any Worker crypto file; `pub fn`/`Cargo.toml`/`package.json` invariants. **Still true throughout Stage 297–304**: both `enabled` gates stay permanently `false`; `"Allowed"` is never returned under any combination of env inputs; Runtime/Worker never call `encrypt`/`decrypt`; no Relay/Storage/Nostr/WASM/FFI connection; no `RuntimeEnv`/Rust/`Cargo.toml`/`package.json` change; no new `pub fn`. ✓
305–312. "FedOS Provider Implementation Readiness (Shape Only)" ([`src/runtime/`](src/runtime/)). Prepares `FedosRuntimeCryptoProvider` (`src/runtime/fedos_runtime_crypto_provider.ts`) for an eventual internal implementation — WITHOUT enabling any real cryptography. Stage 305 adds `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`, a fixed, permanently-`false` constant (no env path, no parameter, no override anywhere), surfaced read-only on `status()`'s return value as `implemented` (`FedosRuntimeCryptoProviderStatus`, a strict superset of `RuntimeCryptoStatus`). Stage 306 adds `internalCapabilitySurface()` — an ADDITIONAL method (`capabilities()` itself is UNCHANGED) naming `runtime_nip44_wire_placeholder` as `"internal-only"` (the underlying `packages/fedos-core-rust` NIP-44 wire pipeline is real and tested, but this class doesn't call it) and the other three labels `"not-implemented"` — purely display-only, no secret material, no behavior change. Stage 307 adds `FedosProviderDecisionReason`/`decisionReason()` — an additional vocabulary for WHY `encrypt`/`decrypt` deny every request, always `"NotImplemented"` in this stage; `encrypt()`/`decrypt()`'s own return type/values are unchanged. Stage 308 makes `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation` (each independently) read `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` directly as a single source of truth, instead of each keeping its own redundant `false` literal — still fixed `false`, so `"Allowed"` is still never returned, even with BOTH `FEDOS_CRYPTO_PROVIDER=fedos` AND `FEDOS_CRYPTO_ENABLED=explicit-dev-only` set (`activationReason` stays `"ProviderUnavailable"`). Stage 309 adds `providerImplemented` to both diagnostics functions, reading the same constant. New `docs/runtime_fedos_provider_implementation.md` (Stage 310) records what this all does and does NOT mean; `docs/runtime_crypto_activation_policy.md`/`docs/runtime_crypto_threat_model.md` updated to match. Stage 311 adds `test/runtime_fedos_provider_implementation.test.ts` (15 tests) plus extensions to `test/runtime_fedos_provider_boundary.test.ts` (24 tests) and `test/runtime_crypto_activation_policy.test.ts` (19 tests), guarding: `implemented`/`providerImplemented` fixed `false`; no env override path; `encrypt`/`decrypt` still `"Unsupported"`; `capabilities()`/`internalCapabilitySurface()` carry no secret material; `"Allowed"` unreachable even with both locks open; Runtime/Worker still never call real crypto; Worker still doesn't import any Worker crypto file; `pub fn`/`Cargo.toml`/`package.json` invariants. Stage 312 is verification. **Still true throughout Stage 305–312**: `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`; `"Allowed"` is never returned; `encrypt`/`decrypt` always resolve `"Unsupported"`; Runtime/Worker never call real crypto; no Relay/Storage/Nostr/NIP-17/WASM/FFI connection; no Rust/`Cargo.toml`/`package.json` change; no new `pub fn`; no public API removed. ✓
313–320. "FedOS Provider Internal Execution Design (Blocked)" ([`src/runtime/`](src/runtime/)). Models the complete internal chain a real `encrypt`/`decrypt` call would eventually walk — WITHOUT ever reaching FedOS. New `src/runtime/fedos_runtime_operation.ts` (Stage 313) adds `FedosRuntimeOperation`/`FedosRuntimeOperationStatus`/`FedosRuntimeOperationDecision` plus `planFedosRuntimeOperation`/`evaluateFedosRuntimeOperation` — plain data and pure functions, `evaluateFedosRuntimeOperation` always resolving `"Blocked"` (`"Completed"` reserved, unreachable). New `src/runtime/fedos_runtime_opaque_request.ts` (Stage 314) adds `OpaqueEncryptRequest`/`OpaqueDecryptRequest`/`FedosOpaqueRequest`/`buildOpaqueRequestFromOperation` — opaque handles only (mirroring `RuntimeEncryptRequest`/`RuntimeDecryptRequest`'s existing discipline), building an EMPTY request shape with no plaintext/ciphertext ever attached; no `SecretHandle`/`ConversationKey`/`MessageKey`/`Nip44WirePayload` reference (all `pub(crate)`-private in `packages/fedos-core-rust`, never exposed to TypeScript). Stage 315 wires `FedosRuntimeCryptoProvider`'s new private `#planInternalExecution`: plans the operation, evaluates it, builds the opaque request — then TERMINATES, discarding the request before it ever reaches `encrypt()`/`decrypt()`, `packages/fedos-core-rust`, WASM/FFI, or Runtime/Worker. Stage 316 adds `FedosRuntimeExecutionState`/`FedosRuntimeExecutionDecision`/the public `planExecution()` method, always resolving `"BlockedByImplementation"` (`"BlockedByActivation"`/`"ReadyForOpaqueExecution"` reserved, unreachable — the Provider itself never reads `RuntimeCryptoConfig`/`WorkerCryptoConfig`). Stage 317 adds three standalone pure "state" functions — `fedosProviderImplementationState()`/`fedosProviderExecutionState()`/`fedosProviderOperationState()` — usable without constructing an instance, plus `providerImplementationState`/`providerExecutionState`/`providerOperationState` on both diagnostics functions. New `docs/runtime_fedos_provider_execution.md` (Stage 318) diagrams the full six-step chain and states plainly this stage stops before FedOS/Runtime/Worker/Rust. Stage 319 adds `test/runtime_fedos_provider_execution.test.ts` (15 tests), guarding: no Rust/WASM/Runtime/Worker invocation; no `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` leakage; execution always blocked; `"Allowed"` still unreachable even with both locks open; the implementation flag unchanged; `pub fn`/`Cargo.toml`/`package.json` invariants; `encrypt`/`decrypt`'s own shape untouched. Stage 320 is verification. **Still true throughout Stage 313–320**: `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`; `"Allowed"` is never returned; `encrypt`/`decrypt` always resolve `"Unsupported"`; no opaque request ever reaches FedOS/Runtime/Worker/Rust/WASM/FFI; no Relay/Storage/Nostr/NIP-17 connection; no Rust/`Cargo.toml`/`package.json` change; no new `pub fn`; no public opaque API; no `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` export. ✓
321–328. "FedOS Opaque API Internal Wiring (Blocked before Rust)" ([`src/runtime/`](src/runtime/)). Adds a FOURTH link to the internal execution chain, between the Opaque Request and Rust — WITHOUT ever reaching Rust. New `src/runtime/fedos_opaque_api.ts` (Stage 321/323) adds `FedosOpaqueApi`/`FedosOpaqueApiStatus`/`FedosOpaqueApiDecision`/`FedosOpaqueApiPlaceholder`/`createFedosOpaqueApi`/`planFedosOpaqueApiExecution`/`fedosOpaqueApiState` — internal only, imported ONLY by `fedos_runtime_crypto_provider.ts`, never by Runtime/Worker. `planEncrypt()`/`planDecrypt()` ALWAYS resolve `"BlockedByImplementation"` — no ciphertext, no plaintext, no `SecretHandle`/`ConversationKey`/`MessageKey`; the Opaque API itself never invokes `packages/fedos-core-rust`/WASM/FFI, it simply receives the request. Stage 322 extends `#planInternalExecution` to build a `FedosOpaqueApi` and route the opaque request to it via `planFedosOpaqueApiExecution` — then discards the result and terminates, exactly as before. Stage 324 adds `FedosProviderImplementationStage`/`fedosProviderImplementationStage()` — a coarser four-step milestone (`"Unavailable"` → `"ProviderReady"` → `"OpaqueApiReady"` → `"RustReady"`) tracking the internal architecture's own progress, fixed at `"OpaqueApiReady"` (`"RustReady"` reserved, unreachable). Stage 325 adds `providerImplementationStage`/`opaqueApiState`/`runtimeExecutionState` to both diagnostics functions. New `docs/runtime_fedos_opaque_api.md` (Stage 326) diagrams the full seven-step chain and states plainly this stage stops before Rust: no Runtime, Worker, Rust, or WASM execution. Stage 327 adds `test/runtime_fedos_opaque_api.test.ts` (19 tests), guarding: Provider reaches the Opaque API only; the Opaque API never reaches Rust/WASM; `planEncrypt`/`planDecrypt` blocked; Runtime/Worker unchanged; `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` hidden; diagnostics updated; `"Allowed"` unreachable even with both locks open; the implementation flag unchanged; `pub fn`/`Cargo.toml`/`package.json` invariants; public API unchanged. Stage 328 is verification. **Still true throughout Stage 321–328**: `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`; `"Allowed"` is never returned; `encrypt`/`decrypt` always resolve `"Unsupported"`; the Opaque API never reaches Rust/WASM/FFI; no Relay/Storage/Nostr/NIP-17 connection; no Rust/`Cargo.toml`/`package.json` change; no new `pub fn`; no `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` export. ✓
329–336. "Private Rust Boundary (Blocked before Rust Crypto)" ([`src/runtime/`](src/runtime/)). Adds a FIFTH link to the internal execution chain, between the Opaque API and real Rust crypto — WITHOUT ever reaching it. New `src/runtime/fedos_rust_boundary.ts` (Stage 329/331) adds `FedosRustBoundary`/`FedosRustBoundaryStatus`/`FedosRustBoundaryDecision`/`FedosRustBoundaryPlaceholder`/`createFedosRustBoundary`/`planFedosRustBoundaryExecution`/`fedosRustBoundaryState`/`fedosRustBoundaryReachable` — internal only, imported ONLY by `fedos_opaque_api.ts`, never by Runtime/Worker. `planRustEncrypt()`/`planRustDecrypt()` ALWAYS resolve `"BlockedByImplementation"` — no crypto, no Rust call, no payload processing, no plaintext, no ciphertext; the Rust Boundary itself never invokes `packages/fedos-core-rust`/WASM/FFI, it simply receives the request and the request terminates immediately. Stage 330 extends `FedosOpaqueApiPlaceholder.planEncrypt()`/`planDecrypt()` to build a `FedosRustBoundary` and route the request to it via `planFedosRustBoundaryExecution` — then discards the boundary's own decision and returns its OWN unchanged `"BlockedByImplementation"` answer. Stage 332 extends `FedosProviderImplementationStage` from four steps to five (`"Unavailable"` → `"ProviderReady"` → `"OpaqueApiReady"` → `"RustBoundaryReady"` → `"RustReady"`), fixed at `"RustBoundaryReady"` (`"RustReady"` remains reserved, unreachable). Stage 333 adds `rustBoundaryState`/`rustBoundaryReachable` to both diagnostics functions (`rustBoundaryReachable` fixed `true` — the code path is structurally wired, NOT a claim that real crypto executes). New `docs/runtime_fedos_rust_boundary.md` (Stage 334) diagrams the full seven-step chain and states plainly this stage stops before Rust crypto: no Runtime, Worker, Rust, or WASM execution. Stage 335 adds `test/runtime_fedos_rust_boundary.test.ts` (23 tests), guarding: Provider reaches the Rust Boundary only; the Rust Boundary never reaches Rust crypto/WASM/FFI; `planRustEncrypt`/`planRustDecrypt` blocked; Runtime/Worker unchanged; `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` hidden; `"Allowed"` unreachable even with both locks open; the implementation stage fixed; `pub fn`/`Cargo.toml`/`package.json` invariants; public API unchanged. Stage 336 is verification. **Still true throughout Stage 329–336**: `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`; `"Allowed"` is never returned; `encrypt`/`decrypt` always resolve `"Unsupported"`; the Rust Boundary never reaches real Rust/WASM/FFI; no Relay/Storage/Nostr/NIP-17 connection; no Rust/`Cargo.toml`/`package.json` change; no new `pub fn`; no `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` export. ✓
337–344. "Private Rust API Connection (Blocked before Rust Crypto)" ([`src/runtime/`](src/runtime/)). Adds a SIXTH link to the internal execution chain, between the Rust Boundary and real Rust crypto — WITHOUT ever reaching it. New `src/runtime/fedos_rust_api.ts` (Stage 337/339) adds `FedosRustApi`/`FedosRustApiStatus`/`FedosRustApiDecision`/`FedosRustApiPlaceholder`/`createFedosRustApi`/`planFedosRustApiExecution`/`fedosRustApiState`/`fedosRustApiReachable` — internal only, imported ONLY by `fedos_rust_boundary.ts`, never by Runtime/Worker. `planRustApiEncrypt()`/`planRustApiDecrypt()` ALWAYS resolve `"BlockedByImplementation"` — no payload, no plaintext, no ciphertext, no key material; the Rust API itself never invokes `packages/fedos-core-rust`/WASM/FFI, execution stops immediately before the actual Rust implementation. Stage 338 extends `FedosRustBoundaryPlaceholder.planRustEncrypt()`/`planRustDecrypt()` to build a `FedosRustApi` and route the request to it via `planFedosRustApiExecution` — then discards the API's own decision and returns its OWN unchanged `"BlockedByImplementation"` answer. Stage 340 extends `FedosProviderImplementationStage` from five steps to six, inserting `"RustApiReady"` between `"RustBoundaryReady"` and `"RustReady"`, fixed at `"RustApiReady"` (`"RustReady"` remains reserved, unreachable). Stage 341 adds `rustApiState`/`rustApiReachable` to both diagnostics functions (`rustApiReachable` fixed `true` — the code path is structurally wired, NOT a claim that real crypto executes). New `docs/runtime_fedos_rust_api.md` (Stage 342) diagrams the full eight-step chain and states plainly this stage stops before real Rust crypto: no Runtime, Worker, Rust, or WASM execution. Stage 343 adds `test/runtime_fedos_rust_api.test.ts` (23 tests), guarding: Provider reaches the Rust API only; the Rust API never reaches Rust crypto/WASM/FFI; `planRustApiEncrypt`/`planRustApiDecrypt` blocked with no payload/plaintext/ciphertext/key material; Runtime/Worker unchanged; `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` hidden; `"Allowed"` unreachable even with both locks open; `pub fn`/`Cargo.toml`/`package.json` invariants; public API unchanged. Stage 344 is verification. **Still true throughout Stage 337–344**: `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`; `"Allowed"` is never returned; `encrypt`/`decrypt` always resolve `"Unsupported"`; the Rust API never reaches real Rust/WASM/FFI; no Relay/Storage/Nostr/NIP-17 connection; no Rust/`Cargo.toml`/`package.json` change; no new `pub fn`; no `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` export. ✓
345–352. "Private Rust Execution Review (Blocked before Crypto)" ([`src/runtime/`](src/runtime/)). Adds a SEVENTH and FINAL abstraction link to the internal execution chain, between the Rust API and real Rust crypto — the LAST stop before any real invocation. New `src/runtime/fedos_rust_execution_review.ts` (Stage 345) adds `FedosRustExecutionReview`/`FedosRustExecutionReviewStatus`/`FedosRustExecutionReviewDecision`/`FedosRustExecutionReviewReason`/`FedosRustExecutionReviewPlaceholder`/`createFedosRustExecutionReview`/`reviewFedosRustExecution`/`fedosRustExecutionReviewState`/`fedosRustExecutionReviewReason`/`fedosRustExecutionApproved` — internal only, imported ONLY by `fedos_rust_api.ts`, never by Runtime/Worker. `reviewEncrypt()`/`reviewDecrypt()` ALWAYS resolve `{ approved: false, reason: "BlockedBeforeCrypto" }` — no crypto, no Rust/WASM/FFI call, no payload, no plaintext, no ciphertext, no key material; `"RuntimeNotActivated"`/`"WorkerNotActivated"`/`"RustExecutionNotApproved"`/`"FutureOnly"` are reserved and unreachable (there is no code path in this file that could ever branch to them). Stage 346 extends `FedosRustApiPlaceholder.planRustApiEncrypt()`/`planRustApiDecrypt()` to build a `FedosRustExecutionReview` and route the request to it via `reviewFedosRustExecution` — then discards the review's own decision and returns its OWN unchanged `"BlockedByImplementation"` answer. New `docs/runtime_fedos_rust_execution_review.md` (Stage 347) diagrams the full nine-step chain and explains why `"BlockedBeforeCrypto"` is the only reachable reason. New `docs/runtime_fedos_execution_approval_checklist.md` (Stage 348) names the eight conditions needed before real execution could ever be considered — items 1–5 (Dual Lock, Provider, Opaque API, Rust Boundary, Rust API) are structurally ready; items 6–8 (execution review approval, Runtime activation approval, Worker activation approval) are NOT approved and cannot become so by finishing more architecture. Stage 349 adds `rustExecutionReviewState`/`rustExecutionReviewReason`/`rustExecutionApproved` to both diagnostics functions (`providerImplementationStage` deliberately unchanged — the Execution Review is a permission layer, not an architecture milestone). Stage 350 adds `test/runtime_fedos_rust_execution_review.test.ts` (24 tests), guarding: Provider reaches the Execution Review only; the review never reaches Rust crypto/WASM/FFI; `approved` always `false`, `reason` always `"BlockedBeforeCrypto"`; the Rust API's own return value stays `"BlockedByImplementation"`; `encrypt`/`decrypt` remain `"Unsupported"`; `"Allowed"` unreachable even with both locks open; Runtime/Worker unchanged; `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` hidden; `Cargo.toml`/`package.json`/`pub fn` invariants. Stage 351 updates this README. Stage 352 is verification. **Still true throughout Stage 345–352**: `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`; `"Allowed"` is never returned; `encrypt`/`decrypt` always resolve `"Unsupported"`; the Execution Review exists, but real Rust crypto execution is STILL blocked; no Runtime/Worker activation of any kind; no Relay/Storage/Nostr/NIP-17 connection; no Rust/`Cargo.toml`/`package.json` change; no new `pub fn`; no `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` export. ✓
353–360. "Internal Rust Call Planning (Blocked before Invocation)" ([`src/runtime/`](src/runtime/)). Adds an EIGHTH abstraction link to the internal execution chain, between the Execution Review and real Rust crypto — planning a call, never making it. New `src/runtime/fedos_internal_rust_call.ts` (Stage 353) adds `FedosInternalRustCall`/`FedosInternalRustCallStatus`/`FedosInternalRustCallDecision`/`FedosInternalRustCallKind` (`"Encrypt"`/`"Decrypt"`) plus `planFedosInternalRustCall`/`evaluateFedosInternalRustCall`/`fedosInternalRustCallState`/`fedosInternalRustCallReachable`/`fedosInternalRustCallExecuted` — internal only, imported ONLY by `fedos_rust_execution_review.ts`, never by Runtime/Worker. `FedosInternalRustCall` is PLAIN DATA (a `kind` label only); `evaluateFedosInternalRustCall` ALWAYS resolves `"Planned"` — `"Executed"` is reserved and unreachable (no code path in this file could ever produce it). Stage 354 extends `FedosRustExecutionReviewPlaceholder.reviewEncrypt()`/`reviewDecrypt()` to build and evaluate a `FedosInternalRustCall` — then IMMEDIATELY DISCARDS it and returns the EXISTING review result UNCHANGED (`{ approved: false, reason: "BlockedBeforeCrypto" }`). New `docs/runtime_internal_rust_call.md` (Stage 355) specifies — WITHOUT implementing — the future call target (`packages/fedos-core-rust`'s existing, already-tested `fedos_encrypt`/`fedos_decrypt`), future input/output translation, failure handling, and required invariants; explicitly states the current implementation stops before invocation. New `docs/runtime_internal_execution_contract.md` (Stage 356) names all eight links in the chain — only the first seven exist; Rust Crypto (link 8) remains disconnected. Stage 357 adds `internalRustCallState`/`internalRustCallReachable` to both diagnostics functions (fixed `"Planned"`/`true` — never a claim that any call has executed). Stage 358 adds `test/runtime_internal_rust_call.test.ts` (24 tests), guarding: Provider reaches Internal Rust Call planning only; it never reaches Rust crypto/WASM/FFI; the Execution Review's own answer stays unchanged; `Executed` always `false`; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable even with both locks open; Runtime/Worker unchanged; `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` hidden; `Cargo.toml`/`package.json`/`pub fn` invariants. Stage 359 updates this README, `docs/runtime_fedos_rust_execution_review.md`, and `docs/runtime_crypto_activation_policy.md`. Stage 360 is verification. **Still true throughout Stage 353–360**: `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`; `"Allowed"` is never returned; `encrypt`/`decrypt` always resolve `"Unsupported"`; Internal Rust Call planning is completed, but real execution remains blocked; no Runtime/Worker activation of any kind; no Relay/Storage/Nostr/NIP-17 connection; no Rust/`Cargo.toml`/`package.json` change; no new `pub fn`. ✓
361–368. "Rust Invocation Adapter (Blocked before Rust Execution)" ([`src/runtime/`](src/runtime/)). Adds a NINTH and FINAL abstraction link to the internal execution chain, between the Internal Rust Call and real Rust crypto. New `src/runtime/fedos_rust_invocation_adapter.ts` (Stage 361/363) adds `FedosRustInvocationAdapter`/`FedosRustInvocationAdapterStatus`/`FedosRustInvocationAdapterDecision`/`FedosRustInvocationAdapterPlaceholder`/`createFedosRustInvocationAdapter`/`planFedosRustInvocationAdapterExecution`/`fedosRustInvocationAdapterState`/`fedosRustInvocationAdapterReachable`/`fedosRustInvocationAdapterExecuted` — internal only, imported ONLY by `fedos_internal_rust_call.ts`, never by Runtime/Worker. `planEncrypt()`/`planDecrypt()` ALWAYS resolve `"BlockedByImplementation"` — never execute anything, never allocate a payload, plaintext, ciphertext, or key of any kind; `"ReadyForRustExecution"` is reserved and unreachable. Stage 362 extends `evaluateFedosInternalRustCall` to build a `FedosRustInvocationAdapter` and route the call to it via `planFedosRustInvocationAdapterExecution` — then immediately discards the result and returns the EXISTING `"Planned"` status UNCHANGED. Stage 364 extends `FedosProviderImplementationStage` from six steps to seven, inserting `"RustInvocationAdapterReady"` between `"RustApiReady"` and `"RustReady"`, fixed at `"RustInvocationAdapterReady"` (`"RustReady"` remains reserved, unreachable). Stage 365 adds `rustInvocationAdapterState`/`rustInvocationAdapterReachable`/`rustInvocationAdapterExecuted` to both diagnostics functions. New `docs/runtime_fedos_rust_invocation_adapter.md` (Stage 366) diagrams the full eleven-step chain and states plainly current execution stops at the Rust Invocation Adapter: no Rust execution, no WASM, no FFI. Stage 367 adds `test/runtime_fedos_rust_invocation_adapter.test.ts` (24 tests), guarding: Provider reaches the Adapter only; the Adapter never reaches Rust/WASM/FFI; the Execution Review's/Internal Rust Call's own answers stay unchanged; `Executed` always `false`; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable even with both locks open; Runtime/Worker unchanged; `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload` hidden; `Cargo.toml`/`package.json`/`pub fn` invariants. Stage 368 is verification. **Still true throughout Stage 361–368**: `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`; `"Allowed"` is never returned; `encrypt`/`decrypt` always resolve `"Unsupported"`; the entire nine-link internal chain exists, but real Rust crypto execution is STILL blocked; no Runtime/Worker activation of any kind; no Relay/Storage/Nostr/NIP-17 connection; no Rust/`Cargo.toml`/`package.json` change; no new `pub fn`. ✓
369–376. "The First Minimal Rust Invocation: Ping" ([`packages/fedos-core-rust/`](packages/fedos-core-rust/), [`src/runtime/`](src/runtime/)). The FIRST executable Rust entry point this codebase introduces is intentionally a harmless, constant-returning ping — never a cryptographic function. Stage 369 adds `fedos_runtime_ping_internal()` to `packages/fedos-core-rust/src/lib.rs`: `pub(crate)` (NOT part of the crate's public API), no parameters, no allocation, no state, ALWAYS returns `true`; a dedicated `fedos_runtime_ping_wiring` test module (2 tests) verifies this. Stage 370 adds `planPing()`/`FedosRustInvocationAdapterPingDecision` to `FedosRustInvocationAdapter`/`FedosRustInvocationAdapterPlaceholder` (`src/runtime/fedos_rust_invocation_adapter.ts`) — the TypeScript-side counterpart, which ALWAYS resolves `"BlockedByImplementation"` in this stage and **never calls Rust yet**; the Rust function and the TypeScript method are two independent, UNWIRED pieces. New `docs/runtime_first_rust_invocation.md` (Stage 371) explains why ping exists (isolating the cross-language call mechanism from cryptographic logic), why crypto is intentionally excluded, and the future migration path (ping proven first, `fedos_encrypt`/`fedos_decrypt` only after). Stage 372 adds `rustPingReachable`/`rustPingExecuted` to both diagnostics functions (fixed `true`/`false`). Stage 373 adds `test/runtime_first_rust_invocation.test.ts` (20 tests), guarding: the Rust ping exists and is `pub(crate)`; its body always returns `true` with no crypto reference; no `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload`/encrypt/decrypt/WASM/FFI in the Adapter file; no Runtime/Worker activation; `Cargo.toml`/`package.json`/Rust public API (`pub fn` count) unchanged. Stage 374 updates this README. Stage 375 is verification. **Still true throughout Stage 369–376**: no cryptographic operation of any kind is ever executed; no encrypt, no decrypt, no NIP-44 execution; no `SecretHandle`/`ConversationKey`/`MessageKey`/`Nip44WirePayload` exposure; no WASM, no FFI; no Runtime/Worker activation of any kind; no Rust/`Cargo.toml`/`package.json` change; no new Rust public API; no Relay/Storage/Nostr/NIP-17 connection. ✓
377–384. "The First Rust Ping 'Execution' (Honestly, Without a Real Boundary)" ([`src/runtime/`](src/runtime/)). `FedosRustInvocationAdapter.planPing()` now RESOLVES rather than blocks: Stage 377 adds `fedosRustPingBridgeCall()` to `src/runtime/fedos_rust_invocation_adapter.ts` — a hand-maintained, pure TypeScript function that reproduces `packages/fedos-core-rust`'s `fedos_runtime_ping_internal()` (Stage 369) contract EXACTLY (no parameters, no allocation, no state, always `true`) — and `planPing()` now calls it, resolving `{ state: "RustPingExecuted", succeeded: true, ... }` instead of Stage 370's `"BlockedByImplementation"`. This is a VERIFIED LOGICAL EQUIVALENCE, honestly NOT a literal call across a WASM/FFI/native-addon boundary — none exists in this repository, and none is added by this stage; no Rust file changes at all. Stage 378 adds `FedosRustPingExecutionState` (`"RustPingNotExecuted"`/`"RustPingExecuted"`) — a dedicated execution-state model for the ping boundary ONLY, kept completely separate from `FedosRustInvocationAdapterDecisionState`, which `planEncrypt()`/`planDecrypt()` still use, UNCHANGED, fixed at `"BlockedByImplementation"`. Stage 379 flips `rustPingExecuted` to fixed `true` and adds `rustPingSucceeded` (fixed `true`) to both diagnostics functions. New `docs/runtime_first_rust_ping_execution.md` (Stage 380) explains, with a diagram, exactly what "executed" honestly means here and what it does not. Stage 381 adds `test/runtime_first_rust_ping_execution.test.ts` (24 tests), guarding: `encrypt`/`decrypt` and `planEncrypt`/`planDecrypt` unchanged; `planPing()`'s new state is a dedicated, separate model; no other Rust function (encrypt/decrypt/key-generation) is referenced by the ping path; no NIP-44, no crypto, no WASM, no FFI, no key generation, no `ConversationKey`/`MessageKey`/`SecretHandle`/`WirePayload`; the TS mirror and Rust's own function share the identical trivial body; no compiled/native artifact exists; `"Allowed"` still unreachable; Runtime/Worker unchanged; `Cargo.toml`/`package.json`/Rust public API (`pub fn` count) unchanged. Stage 382 updates this README. Stage 383 is verification. **Still true throughout Stage 377–384**: no cryptographic operation of any kind is ever executed; no NIP-44, no AES, no ChaCha20, no HKDF execution; no key generation; no `SecretHandle`/`ConversationKey`/`MessageKey`/`Nip44WirePayload` exposure; no WASM, no FFI, no native addon; no Runtime/Worker activation of any kind; `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`; `"Allowed"` is never returned; no Rust/`Cargo.toml`/`package.json` change; no new Rust public API. ✓
385–392. "FedOS Runtime ⇄ Rust Boundary Decision: WebAssembly (Not Loaded)" ([`docs/`](docs/), [`src/runtime/`](src/runtime/)). A formal architecture decision, not executable code: **WebAssembly is the sole official MVP boundary between FedOS Runtime and `packages/fedos-core-rust`.** New `docs/runtime_rust_boundary_decision.md` (Stage 385) records this decision in writing and explains why Node Native Addon, a spawned CLI process, and raw FFI were each rejected for the MVP (with reasons), while noting each may be reconsidered later as its own, separate, explicitly-reviewed decision. New `src/runtime/fedos_wasm_boundary.ts` (Stage 386) adds `FedosWasmBoundary`/`FedosWasmBoundaryState`/`FedosWasmBoundaryDecision`/`FedosWasmBoundaryPlaceholder`/`createFedosWasmBoundary`/`fedosWasmBoundaryState`/`fedosWasmBoundaryReachable`/`fedosWasmLoaded` — internal only, imported ONLY by `fedos_rust_invocation_adapter.ts`, never by Runtime/Worker. `planLoad()`/`planEncrypt()`/`planDecrypt()` ALWAYS resolve `"BlockedByImplementation"` — never call `WebAssembly.instantiate`/`compile`, never `wasm-bindgen`, never `packages/fedos-core-rust`, never FFI, never a Native Addon; nothing is ever loaded or executed. Stage 387 extends `FedosRustInvocationAdapterPlaceholder.planEncrypt()`/`planDecrypt()` with an eleventh link: each now builds a `FedosWasmBoundary` and calls its `planLoad()` ONLY — then discards the result and returns its OWN unchanged `"BlockedByImplementation"` answer; `planPing()` is untouched. Stage 388 adds `wasmBoundaryState`/`wasmBoundaryReachable`/`wasmLoaded` to both diagnostics functions (fixed `"NotLoaded"`/`true`/`false`). New `docs/runtime_wasm_boundary.md` (Stage 389) diagrams the full eleven-step chain and states plainly the Rust crate remains unconnected; `docs/runtime_internal_execution_contract.md` is updated to add link 8 (Rust Invocation Adapter) and link 9 (WASM Boundary, not loaded), pushing Rust Crypto to link 10. Stage 390 adds `test/runtime_wasm_boundary.test.ts` (24 tests), guarding: WASM not loaded; no `WebAssembly.instantiate`/`compile` call (verified both by source scan AND a runtime spy); no `wasm-bindgen`, FFI, Native Addon, or CLI/subprocess reference; `encrypt`/`decrypt` and `planEncrypt`/`planDecrypt` unchanged; no Rust crypto, no NIP-44, no `SecretHandle`/`ConversationKey`/`MessageKey`/`WirePayload`; no compiled/native artifact exists; `"Allowed"` still unreachable; Runtime/Worker unchanged; `Cargo.toml`/`package.json`/Rust public API (`pub fn` count) unchanged. Stage 391 updates this README. Stage 392 is verification. **Still true throughout Stage 385–392**: no cryptographic operation of any kind is ever executed; no Rust execution, no WASM load, no FFI, no Native Addon, no CLI; no `SecretHandle`/`ConversationKey`/`MessageKey`/`Nip44WirePayload` exposure; no Runtime/Worker activation of any kind; `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` and `FEDOS_CRYPTO_ENABLED` handling stay unchanged; `"Allowed"` is never returned; no Rust/`Cargo.toml`/`package.json` change; no new Rust public API. ✓
393–400. "FedOS Rust → WASM Build Architecture: WASM Artifact (Not Built)" ([`docs/`](docs/), [`src/runtime/`](src/runtime/)). Designs the BUILD FLOW toward the WASM boundary already decided (Stage 385), without building anything. New `docs/runtime_wasm_build_plan.md` (Stage 393) diagrams the intended pipeline — crate → wasm32 target → bindgen → loader → Runtime Provider — labeling every step PLANNING ONLY; no `cargo build --target wasm32-*`, no `wasm-bindgen`/`wasm-pack`, no `.wasm` file. New `src/runtime/fedos_wasm_artifact.ts` (Stage 394) adds `FedosWasmArtifact`/`FedosWasmArtifactState`/`FedosWasmArtifactDecision`/`FedosWasmArtifactPlaceholder`/`createFedosWasmArtifact`/`fedosWasmArtifactState`/`fedosWasmArtifactReachable`/`fedosWasmArtifactBuilt` — internal only, imported ONLY by `fedos_wasm_boundary.ts`, never by Runtime/Worker. `planBuild()`/`planLoad()` ALWAYS resolve `"BlockedByImplementation"` — never invoke any build tool; nothing is ever built or loaded. Stage 395 extends `FedosWasmBoundaryPlaceholder.planLoad()` with a twelfth link: it now builds a `FedosWasmArtifact` and calls its `planBuild()` ONLY — then discards the result and returns its OWN unchanged `"BlockedByImplementation"` answer; `planEncrypt()`/`planDecrypt()` are untouched. Stage 396 adds `wasmArtifactState`/`wasmArtifactReachable`/`wasmArtifactBuilt` to both diagnostics functions (fixed `"NotBuilt"`/`true`/`false`). New `docs/runtime_wasm_artifact.md` (Stage 397) diagrams the full twelve-step chain and states plainly the Rust crate remains unconnected; `docs/runtime_internal_execution_contract.md` is updated to add link 10 (WASM Artifact, not built), pushing Rust Crypto to link 11. Stage 398 adds `test/runtime_wasm_artifact.test.ts` (23 tests), guarding: no WASM generated, no `.wasm` file, no `wasm-pack`/`wasm-bindgen`, no `cargo build --target wasm32-*`, no `WebAssembly.instantiate`/`compile` call (source scan AND runtime spy); `encrypt`/`decrypt` and `planEncrypt`/`planDecrypt` unchanged; no Rust crypto, no NIP-44; Runtime/Worker unchanged; `Cargo.toml`/`package.json`/Rust public API (`pub fn` count) unchanged. Stage 399 updates this README. Stage 400 is verification. **Still true throughout Stage 393–400**: no cryptographic operation of any kind is ever executed; no Rust execution, no WASM build, no WASM load, no FFI, no Native Addon; no Runtime/Worker activation of any kind; `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` and `FEDOS_CRYPTO_ENABLED` handling stay unchanged; `"Allowed"` is never returned; no Rust/`Cargo.toml`/`package.json` change; no new Rust public API. ✓
401–408. "FedOS Execution Backend Architecture" ([`docs/`](docs/), [`src/runtime/`](src/runtime/)). Formalizes the Runtime ⇄ Rust execution boundary as a swappable **Execution Backend** abstraction — retiring the framing that WASM is the only possible mechanism, WITHOUT undoing Stage 385's decision that WASM is the first real one. New `docs/runtime_execution_backend.md` (Stage 401) fixes the architecture: `FedOS Core (Rust) → Execution Backend → Runtime`, names WASM/Native Desktop/Mobile/Other as candidates (only WASM has any code), and states plainly that `packages/fedos-core-rust` itself remains fully backend-agnostic — no Rust file, dependency, or `pub fn` references "backend," "WASM," "native," or "mobile" in any capacity. New `src/runtime/fedos_execution_backend.ts` (Stage 402) adds `FedosExecutionBackend`/`FedosExecutionBackendKind` (`"Wasm" | "Native" | "Future"`)/`FedosExecutionBackendState`/`FedosExecutionBackendPlaceholder`/`createExecutionBackend`/`planBackend`/`planLoad`/`fedosExecutionBackendKind`/`fedosExecutionBackendState`/`fedosExecutionBackendReachable`/`fedosExecutionBackendImplemented` — internal only, imported ONLY by `fedos_rust_invocation_adapter.ts`, never by Runtime/Worker. `planBackend()`/`planLoad()` ALWAYS resolve `"Planning"`, `status()` ALWAYS `"NotConnected"` — never select, connect to, build, or load any real backend. Stage 403 REWIRES `FedosRustInvocationAdapterPlaceholder.planEncrypt()`/`planDecrypt()` to reach `FedosExecutionBackend` INSTEAD OF `FedosWasmBoundary` directly — the Execution Backend's own `planLoad()` builds the UNCHANGED `FedosWasmBoundary` (Stage 386) and calls ITS `planLoad()`, discarding the result at both layers; the WASM Boundary file itself is untouched, only reached one level deeper. Stage 404 adds `executionBackend`/`executionBackendState`/`executionBackendReachable`/`backendImplemented` to both diagnostics functions (fixed `"Wasm"`/`"Planning"`/`true`/`false`). Stage 405 updates `docs/runtime_execution_backend.md` with the full chain diagram (`Execution Backend → WASM Backend → Artifact → Runtime`, plus future-only Native/Mobile diagrams) and `docs/runtime_internal_execution_contract.md` (Execution Backend inserted as link 9, WASM Boundary/Artifact renumbered 10/11, Rust Crypto pushed to link 12). Stage 406 adds `test/runtime_execution_backend.test.ts` (22 tests), guarding: Backend abstraction only, fixed `Planning`/`NotConnected`; no WASM/Native generation, no CLI, no FFI, no `WebAssembly.instantiate`/`compile` call (source scan AND runtime spy); `encrypt`/`decrypt` and every earlier `planEncrypt`/`planDecrypt` unchanged; no Rust crypto, no NIP-44; the Rust Invocation Adapter now wires to the Execution Backend (not the WASM Boundary) and the Execution Backend wires to the WASM Boundary; Runtime/Worker unchanged; `Cargo.toml`/`package.json`/Rust public API (`pub fn` count) unchanged; diagnostics fields present on both Runtime and Worker summaries. Stage 407 updates this README with the "Execution Backend Architecture" section, stating explicitly that FedOS is Backend-swappable, not WASM-exclusive. Stage 408 is verification. **Still true throughout Stage 401–408**: no cryptographic operation of any kind is ever executed; no Rust execution, no WASM generation, no Native/Mobile backend of any kind, no FFI, no Native Addon, no CLI; no Runtime/Worker activation of any kind; `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` and `FEDOS_CRYPTO_ENABLED` handling stay unchanged; `"Allowed"` is never returned; no Rust/`Cargo.toml`/`package.json` change; no new Rust public API; `packages/fedos-core-rust` byte-for-byte untouched. ✓
409–416. "Runtime architecture phase review" ([`docs/`](docs/), [`test/`](test/)). The design-phase-end review for Stage 1–408: no new `src/` code, no new Runtime/Provider/Backend link — this batch is docs plus one guard test only. New `docs/runtime_architecture_phase_review.md` (Stage 409) reproduces the full 12-link Runtime → Provider → Execution Backend → FedOS Core chain from `docs/runtime_internal_execution_contract.md` in one place and restates the Stage 401–408 Execution Backend abstraction as the fixed baseline for future work. New `docs/runtime_backend_implementation_sequence.md` (Stage 410) fixes the ORDER (not the schedule) for replacing the chain's remaining placeholders: (1) WASM build toolchain planning final check, (2) `wasm32` target / `wasm-bindgen` introduction, (3) WASM artifact generation, (4) TS loader real connection, (5) `ping` real cross-boundary execution, (6) NIP-44 real connection, (7) Runtime dev-only activation, (8) Worker/Nostr integration — each its own future, separate, explicitly-reviewed stage, never combined. New `docs/runtime_backend_risk_register.md` (Stage 411) names six risks against that sequence: WASM memory secret handling, the OneDrive/Windows non-ASCII path issue that breaks `cargo test`'s mingw-w64 link step in this exact environment, Smart App Control blocking unsigned build tooling, `target`/`Cargo.lock` guard scope for a new `wasm32` output tree, `wasm-bindgen` accidentally widening the reviewed 27-`pub fn` public surface, and Runtime/Worker accidental activation once a real flag exists. New `docs/runtime_backend_verification_policy.md` (Stage 412) fixes that any future stage touching `packages/fedos-core-rust` or WASM tooling must run `cargo check`, `cargo check --tests`, AND `cargo test` to green — using WSL or an ASCII-only path clone wherever this environment's OneDrive path would otherwise block the test target — with `cargo check` alone declared explicitly insufficient. Stage 413 is this README update. New `test/runtime_architecture_phase_review.test.ts` (Stage 414) guards: all four new docs exist and are non-empty; the Execution Backend/WASM-swappable framing is stated, not walked back, in the new docs; the Stage 410 eight-item sequence is named in full; `Cargo.toml`/`package.json`/Rust public API (`pub fn` count) are unchanged; `"Allowed"` is still unreachable from either activation policy; `create_runtime.ts`/`src/worker.ts` remain unchanged, importing none of the chain's files. Stage 415 is `npm run typecheck`/`npm test` verification; per `docs/runtime_backend_verification_policy.md` §3, the `cargo check --tests`/`cargo test` requirement does not apply to this docs-only batch, since `packages/fedos-core-rust`'s diff is empty by construction. Stage 416 is the commit split (phase review / sequence+risk register / policy+guards+README) and a final `git status` check. **Still true throughout Stage 409–416**: no cryptographic operation of any kind is ever executed; no Rust execution, no WASM generation of any kind, no Native/Mobile backend, no FFI, no Native Addon, no CLI; no Runtime/Worker activation of any kind; `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` and `FEDOS_CRYPTO_ENABLED` handling stay unchanged; `"Allowed"` is never returned; no Rust/`Cargo.toml`/`package.json` change; no new Rust public API; `packages/fedos-core-rust` byte-for-byte untouched. ✓
417–424. "FedOS WASM toolchain readiness" ([`docs/`](docs/), [`src/runtime/`](src/runtime/), [`test/`](test/)). Final preparation before ever introducing a real `wasm32`/`wasm-bindgen`/`wasm-pack` toolchain — additive only, no WASM generation, no toolchain invocation, no Rust public API change, no Runtime/Worker activation. New `docs/runtime_wasm_toolchain_readiness.md` (Stage 417) inventories the six missing pieces (`wasm32` target, `wasm-bindgen-cli`, `wasm-pack`, build script, generated `.wasm` artifact, generated JS bindings), each fixed "Not Installed / Not Generated" and confirmed by direct inspection, not assumption. New `docs/runtime_wasm_build_contract.md` (Stage 418) fixes ONE diagram spanning the full path: Rust Source → `cargo build` (future) → `wasm-bindgen` (future) → Generated JS Glue (future) → Generated `.wasm` (future) → `FedosWasmArtifact` → `FedosWasmBoundary` → `ExecutionBackend` → Runtime — diagram only, no implementation. New `src/runtime/fedos_wasm_toolchain.ts` (Stage 419) adds `FedosWasmToolchain`/`FedosWasmToolchainState`/`FedosWasmToolchainPlaceholder`/`createFedosWasmToolchain`/`status`/`planInstall`/`planBuild`/`planBindgen`/`planVerify` — UNLIKE every other link in the Runtime → Rust chain, this module is deliberately standalone and UNWIRED (no `fedos_wasm_artifact.ts`/`fedos_wasm_boundary.ts`/`fedos_execution_backend.ts`/Runtime/Worker imports it); every method fixed `"Planning"`; never calls `WebAssembly`, never spawns a `child_process`. Stage 420 adds `wasmToolchainInstalled`/`wasmToolchainVerified`/`wasmBuildReady` (`fedosWasmToolchainInstalled()`/`fedosWasmToolchainVerified()`/`fedosWasmBuildReady()`, all fixed `false`, no `reachable` field since the module is unwired) to both `runtimeCryptoActivationStatus`/`workerCryptoActivationStatus`; the three pre-existing exact-snapshot diagnostics tests are updated accordingly. New `docs/runtime_wasm_migration_plan.md` (Stage 421) fixes a ten-item migration order: (1) Runtime unchanged, (2) Toolchain introduction, (3) Build confirmation, (4) WASM generation, (5) Loader connection, (6) `ping` execution, (7) NIP-44, (8) Runtime dev-only, (9) Worker, (10) Production review — restating `docs/runtime_backend_implementation_sequence.md` (Stage 410) at Production Review granularity, adding an explicit starting baseline and a mandatory pre-widening review gate. Stage 423 is this README update. New `test/runtime_wasm_toolchain.test.ts` (Stage 422, 17 tests) guards: no `wasm-pack`/`wasm-bindgen`/`child_process`/`WebAssembly` reference in the toolchain file (source scan AND runtime spy); no build script or `.wasm`/generated-bindings artifact anywhere; `encrypt`/`decrypt` unchanged; Runtime/Worker remain unconnected; `Cargo.toml`/`package.json`/Rust public API (`pub fn` count) unchanged; `"Allowed"` unreachable from either activation policy; the three new diagnostics fields present on both summaries. Stage 424 is `npm run typecheck`/`npm test` verification — no Rust file changed this batch, so no `cargo` re-verification is required per `docs/runtime_backend_verification_policy.md` §3. **Still true throughout Stage 417–424**: no cryptographic operation of any kind is ever executed; no WASM generation, no `wasm-bindgen`/`wasm-pack` invocation, no `cargo build --target wasm32-*`; no Runtime/Worker activation of any kind; `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` and `FEDOS_CRYPTO_ENABLED` handling stay unchanged; `"Allowed"` is never returned; no Rust/`Cargo.toml`/`package.json` change; no new Rust public API; `packages/fedos-core-rust` byte-for-byte untouched. ✓
425–432. "FedOS WASM toolchain minimal adoption" ([`docs/`](docs/), [`src/runtime/`](src/runtime/), [`test/`](test/)). The FIRST real, non-repository action in the WASM arc: a MINIMAL toolchain preflight on the development machine, still zero WASM generation, zero Rust crypto execution, zero Runtime/Worker activation, zero Rust public API change. Stage 425 ran `rustup target add wasm32-unknown-unknown` and `cargo install wasm-bindgen-cli` (0.2.100), and deliberately did NOT install `wasm-pack` — both commands write only to this machine's `~/.rustup`/`~/.cargo` directories, entirely outside this repository's tracked tree; `git status` was clean before and after. `docs/runtime_wasm_toolchain_readiness.md` (Stage 417, updated Stage 425–426) records the result: `wasm32-unknown-unknown`/`wasm-bindgen-cli` are now "Installed" as ENVIRONMENT capabilities (not repository dependencies), `wasm-pack` stays explicitly "Not Adopted", and build script/generated `.wasm`/generated JS bindings stay "Not Added"/"Not Committed". `docs/runtime_wasm_build_contract.md` (Stage 418, updated Stage 427) adds §5 naming the exact future `cargo build --target wasm32-unknown-unknown`/`wasm-bindgen` command lines for reference only — no `package.json` script added, neither command run. `src/runtime/fedos_wasm_toolchain.ts` (Stage 419, updated Stage 428) adds four fixed, NON-DETECTING plan labels — `toolchainPlanStatus: "Planned"`, `wasmTargetExpected: "wasm32-unknown-unknown"`, `bindgenExpected: true`, `wasmPackExpected: false` — to `FedosWasmToolchainStatus`/`status()`, plus matching standalone pure functions; `wasmToolchainInstalled`/`wasmToolchainVerified`/`wasmBuildReady` stay fixed `false`, unaffected by what is or is not actually installed on any given machine. `docs/runtime_wasm_migration_plan.md` is unchanged this batch. `test/runtime_wasm_toolchain.test.ts` (Stage 429, 18 tests) is rewritten: `wasm-pack` still has zero hyphenated reference anywhere in the toolchain file's code and the plan fixes it `false`; `wasm-bindgen` is confirmed a PLANNED label only, never a `Cargo.toml`/`package.json` dependency; no `package.json` script invokes `wasm-pack`/`wasm-bindgen`/`wasm32`/`cargo build`/`rustup`; no `.wasm`/generated-bindings artifact anywhere; `Cargo.toml` production dependency count (10) and `package.json` dependency count (2) unchanged; Rust public API (`pub fn` count, 27) unchanged; Runtime/Worker remain unconnected; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable from either activation policy. Stage 430 is this README update, stating plainly: **the toolchain is installed/available as an environment capability, but the build remains non-operational** — no `cdylib` target, no build script, no artifact, no loader connection. Stage 431 verification: `npm run typecheck`/`npm test` green (178 files / 2779 tests); `cargo check` green with zero Rust source diff; `cargo check --tests`/`cargo test` FAILED identically to the pre-existing, documented, unrelated environment issue (`docs/runtime_backend_verification_policy.md`) — this repository's OneDrive path contains non-ASCII characters, which breaks mingw-w64's linker when linking the `serde_derive` dev-dependency, reproduced again here with zero Rust file touched; `rustup target list --installed` confirms `wasm32-unknown-unknown`; `wasm-bindgen --version` confirms `0.2.100`; `cargo build --target wasm32-unknown-unknown` was NOT run, per this batch's own scope. Stage 432 is the four-commit split and a final `git status` check. **Still true throughout Stage 425–432**: `wasm-pack` is never adopted; no `package.json` script added; `Cargo.toml`/`package.json` dependencies unchanged; no `.wasm`/generated-bindings artifact committed; no Runtime/Worker activation; no Rust crypto execution, no `encrypt`/`decrypt` execution; no `WebAssembly.instantiate`/`compile` call; `"Allowed"` never reached; no Rust public API change (27 `pub fn`, unchanged). ✓
433–440. "FedOS WASM build confirmation (first observation)" ([`docs/`](docs/), [`src/runtime/`](src/runtime/), [`test/`](test/)). The FIRST time this repository's `packages/fedos-core-rust` crate was actually pointed at the `wasm32-unknown-unknown` target — an OBSERVATION, not a fix: no code change, no `Cargo.toml` edit, no `cdylib` added. Stage 433 preflight re-confirmed: `git status` clean, `wasm32-unknown-unknown` in `rustup target list --installed`, `wasm-bindgen --version` reports `0.2.100`, `wasm-pack` absent, `[lib]` still `crate-type = ["rlib"]` only. `docs/runtime_wasm_build_contract.md` (updated Stage 434) adds §6, fixing the decision that `crate-type` stays `["rlib"]` for this batch — `cdylib` adoption is deferred to a future, separate stage, since it changes the crate's public/artifact boundary independently of whether the existing dependency graph even compiles for `wasm32`. Stage 435 ran `cargo check --target wasm32-unknown-unknown`; Stage 436 ran `cargo build --target wasm32-unknown-unknown` (both allowed, unmodified crate) — **both FAILED**, identically, compiling the `getrandom` dependency: `getrandom` 0.3.4 does not support `wasm32-unknown-unknown` without an opt-in `wasm_js` feature/cfg flag this crate's `Cargo.toml` does not set. New `docs/runtime_wasm_build_observation.md` (Stage 437) records the full command lines, the exact error, and a classification ruling OUT dependency/target/crate-type/`std`/`k256`/fedos-authored-feature causes and ruling IN a `getrandom` classification — plus three open decisions deferred to a future stage (whether/how to enable `wasm_js`, whether to bundle that with `cdylib` adoption, whether `k256`'s reviewed `rand_core` exception needs re-review once `getrandom` actually compiles for `wasm32`). No `.wasm`/`.rlib`(for this crate)/JS-glue artifact exists — the build never reached the crate's own compilation step; `target/`/`Cargo.lock` (both gitignored) were deleted after the observation was recorded. `src/runtime/fedos_wasm_toolchain.ts` (updated Stage 438) adds two more fixed, NON-DETECTING labels — `wasmTargetCheckObserved`/`wasmBuildObserved`, both `"Failed"` — recording this ALREADY-COMPLETED observation; this file still never re-runs `cargo` itself. Stage 439 is this README update. `test/runtime_wasm_toolchain.test.ts` (Stage 438, 21 tests) adds: the two new labels match the documented `"Failed"` result; the `cargo check`/`cargo build` commands are documented (build contract + observation doc) but never scripted in `package.json`; `wasm-bindgen` was not run (the failure predates it); every Stage 417–432 guarantee (`wasm-pack` not adopted, `Cargo.toml`/`package.json` unchanged, no artifact, Runtime/Worker unconnected, `encrypt`/`decrypt` unchanged, `"Allowed"` unreachable) still holds. Stage 440 verification: `npm run typecheck`/`npm test` green (178 files / 2782 tests); `cargo check` green, `cargo check --target wasm32-unknown-unknown`/`cargo build --target wasm32-unknown-unknown` both reproduce the same `getrandom` failure; `cargo check --tests`/`cargo test` were not re-attempted this stage beyond Stage 425–432's already-recorded OneDrive/mingw-w64 result; `packages/fedos-core-rust/target`/`Cargo.lock` deleted as the final step. **Still true throughout Stage 433–440**: no `Cargo.toml`/`package.json` change; `crate-type` still `["rlib"]` only, no `cdylib`; `wasm-bindgen` never run; `wasm-pack` never adopted; no `package.json` script added; no `.wasm`/generated-JS-glue committed; no Rust crypto execution, no `encrypt`/`decrypt` execution; no Runtime/Worker activation; `"Allowed"` never reached; no code fix was attempted for the observed `getrandom` failure; no new Rust public API (27 `pub fn`, unchanged). ✓
441–448. "FedOS `getrandom` `wasm_js` opt-in — first GREEN `wasm32` build" ([`docs/`](docs/), [`packages/fedos-core-rust`](packages/fedos-core-rust/Cargo.toml), [`src/runtime/`](src/runtime/), [`test/`](test/)). RESOLVES the Stage 433–440 `getrandom` blocker: the FIRST time `packages/fedos-core-rust` and its full dependency graph actually compile for `wasm32-unknown-unknown`. New `docs/runtime_wasm_getrandom_policy.md` (Stage 441) fixes the policy: `getrandom` 0.3.x needs BOTH its own `wasm_js` Cargo feature AND a `--cfg getrandom_backend="wasm_js"` compiler flag (the feature alone is insufficient, per `getrandom`'s own documentation); fallback/insecure PRNGs (hand-rolled PRNGs, `Math.random()`, predictable seeds) are permanently forbidden; CSPRNG failure still fails closed, exactly like every other target. Stage 442 makes the ONE minimal `Cargo.toml` change this requires: `getrandom`'s entry gains `features = ["wasm_js"]` — version unchanged (`"0.3"`), production dependency COUNT unchanged (still 10), no `wasm-bindgen` direct dependency added (its JS-interop shim lives entirely inside `getrandom`'s own `Cargo.toml`), native `cargo check` reconfirmed green with `wasm-bindgen` absent from `cargo tree -i wasm-bindgen`. Stage 443 ran `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' cargo check --target wasm32-unknown-unknown` — **SUCCEEDED** (exit 0), `getrandom v0.3.4` and every dependency including `k256` (never reached by the Stage 435 failing run) compiling clean. Stage 444 ran the same `RUSTFLAGS` with `cargo build --target wasm32-unknown-unknown` — **also SUCCEEDED**, producing only `target/wasm32-unknown-unknown/debug/libfedos_core_rust.rlib` (still `crate-type = ["rlib"]` only, no `cdylib`, no `.wasm` file anywhere); the `wasm-bindgen` LIBRARY crate compiled as `getrandom`'s own internal dependency, but the `wasm-bindgen` CLI was never invoked. `docs/runtime_wasm_build_observation.md` (updated Stage 445) adds §7–8 recording this SUCCESS and its classification (RESOLVED, superseding — not erasing — the original Stage 435–437 failing-run record); `docs/runtime_wasm_toolchain_readiness.md` (updated Stage 445) adds item 7, "`getrandom` `wasm_js` backend: Applied, verified green"; `docs/runtime_wasm_build_contract.md` (updated Stage 445) adds §7 noting the "`cargo build` (future)" diagram box is no longer purely future, while `wasm-bindgen`/Generated JS Glue/Generated `.wasm` remain unchanged and still future (no `cdylib`). `src/runtime/fedos_wasm_toolchain.ts` (updated Stage 446) updates `wasmTargetCheckObserved`/`wasmBuildObserved` from `"Failed"` to `"Succeeded"` and adds three new fixed, NON-DETECTING labels — `getrandomWasmPolicy: "wasm_js"`, `getrandomBackendCfgRequired: true`, `wasmTargetCheckStatus: "ObservedGreen"` — still no live `cargo`/toolchain probe of any kind. Stage 447 is this README update. `test/runtime_wasm_toolchain.test.ts` (Stage 446, 24 tests) adds: the three new labels match; `Cargo.toml`'s `getrandom` entry shows the `wasm_js` feature with version/dependency-count unchanged and no `wasm-bindgen` dependency line; the policy doc names the `--cfg` flag and forbids fallback PRNGs/documents fail-closed behavior; the updated observation doc still documents the ORIGINAL Stage 435–436 "`wasm-bindgen` NOT run" finding AND the Stage 443–444 "`wasm-bindgen` (the CLI) NOT invoked"/"RESOLVED" text; every Stage 417–440 guarantee (`wasm-pack` not adopted, `package.json` unchanged, no artifact/generated-glue committed, Runtime/Worker unconnected, `encrypt`/`decrypt` unchanged, `"Allowed"` unreachable, Rust public API 27 `pub fn` unchanged) still holds. Stage 448 verification: `npm run typecheck` clean; `npm test` green (178 files / 2785 tests); `cargo check` green (native, zero behavior change); `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' cargo check`/`cargo build --target wasm32-unknown-unknown` both green; `cargo check --tests`/`cargo test` not re-attempted beyond the already-documented OneDrive/mingw-w64 environment issue (`docs/runtime_backend_verification_policy.md`); `packages/fedos-core-rust/target`/`Cargo.lock` (both gitignored) deleted as the final step; `git status` clean apart from this batch's own four commits. **Still true throughout Stage 441–448**: no `getrandom` version change; no NEW production dependency added (`wasm_js` is a feature flag on an EXISTING dependency, not a new crate); no `wasm-bindgen`/`wasm-pack` direct dependency; no `cdylib`/`crate-type` change; no `package.json` change or new script; no `.wasm`/generated-JS-glue committed; no `wasm-bindgen` CLI invocation; no Rust crypto execution, no `encrypt`/`decrypt` execution, no NIP-44 code path; no Runtime/Worker activation of any kind; `"Allowed"` never reached; no fallback/insecure PRNG added anywhere. ✓
449–456. "FedOS WASM Artifact generation planning — script, output dir, generation state" ([`docs/`](docs/), [`package.json`](package.json), [`packages/fedos-core-rust/.gitignore`](packages/fedos-core-rust/.gitignore), [`src/runtime/`](src/runtime/), [`test/`](test/)). Names the REMAINING steps between the now-GREEN `cargo build --target wasm32-unknown-unknown` (Stage 443–444) and a real, loadable `.wasm` Artifact — without ever running any of them. New `docs/runtime_wasm_generation.md` (Stage 449) fixes the finer-grained diagram `cargo build` (real, green) → `wasm-bindgen` (not run) → Generated JS Glue (not generated) → Generated `.wasm` (not generated) → `FedosWasmArtifact` → `FedosWasmBoundary` → `ExecutionBackend` → Runtime (未接続), and records WHY `build:wasm`'s command text deliberately omits an embedded `RUSTFLAGS` (POSIX-shell-specific syntax + the same explicit-opt-in-never-baked-in reasoning as `docs/runtime_wasm_getrandom_policy.md` §4). Stage 450 adds ONE new `package.json` script, `build:wasm` (`cargo build --manifest-path packages/fedos-core-rust/Cargo.toml --target wasm32-unknown-unknown --release && wasm-bindgen --target web --out-dir packages/fedos-core-rust/pkg ...`) — added, never executed by this batch, never wired into any lifecycle hook (`pretest`/`prepare`/`postinstall`/etc.), and not invoked by `npm test`/`npm run typecheck`. Stage 451 fixes the future generated-artifact output directory, `packages/fedos-core-rust/pkg/`, and adds `/pkg/` to `packages/fedos-core-rust/.gitignore` — the directory itself is not created, nothing is generated. `src/runtime/fedos_wasm_artifact.ts` (updated Stage 452) adds a SECOND, independent status axis — `generationState`/`FedosWasmArtifactGenerationState` (`"Generated"`/`"NotGenerated"`, fixed `"NotGenerated"`), plus standalone `fedosWasmArtifactGenerationState()`/`fedosWasmArtifactGenerated()`/`fedosGeneratedArtifactPath()` (fixed `"NotGenerated"`/`false`/`null`) — DISTINCT from the pre-existing `state`/`"NotBuilt"` (Stage 394): `state` asks whether this Provider-internal abstraction's own build step ever executed (never), `generationState` asks whether a real `.wasm` + JS glue pair exists on disk (never). `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (updated Stage 453) add `wasmArtifactGenerated`/`generatedArtifactPath` (fixed `false`/`null`) to both activation summaries. New `test/runtime_wasm_generation.test.ts` (Stage 454, 14 tests) guards: the new generation-state/diagnostics labels; `build:wasm` exists, names the expected pipeline, and is referenced by no OTHER script or lifecycle hook; Cargo/`package.json` production dependency counts unchanged (10/2); `.gitignore` covers `/pkg/`; no `.wasm`/glue/`pkg/` content exists anywhere; Rust public API unchanged (27 `pub fn`); Runtime/Worker unconnected; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable; `WebAssembly.instantiate`/`compile` never invoked. `test/runtime_wasm_toolchain.test.ts` tests 8/20 are updated (not weakened) to allow ONLY the `build:wasm` script to reference `wasm-bindgen`/`wasm32`/`cargo build`, while still forbidding `wasm-pack`/`rustup` everywhere and any auto-invoking lifecycle hook; three pre-existing exact-snapshot diagnostics tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include the two new fields. Stage 455 is this README update. Stage 456 verification: `npm run typecheck` clean; `npm test` green (179 files / 2799 tests); `cargo check` green (native); `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' cargo check`/`cargo build --target wasm32-unknown-unknown` both green; `packages/fedos-core-rust/target`/`Cargo.lock` (both gitignored) deleted as the final step; `git status` clean apart from this batch's own commits. **Still true throughout Stage 449–456**: no `.wasm`/generated JS glue/`.d.ts` file generated, committed, or loaded; `wasm-bindgen` (the CLI) never invoked; `build:wasm` never executed by this batch or any automatic hook; no `Cargo.toml`/`package.json` DEPENDENCY added (script only); no new Rust `pub fn`; `FedosWasmArtifact`/`FedosWasmBoundary`/`ExecutionBackend` keep their existing fixed `"BlockedByImplementation"`/`"Planning"`/`"NotConnected"` answers; no Runtime/Worker activation; `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`; Dual Lock unchanged; `"Allowed"` never reached; no `encrypt`/`decrypt` code path touched, in Rust or TypeScript. ✓

457–464. "FedOS WASM artifact generation — first real observed run: `cargo build` succeeds, `wasm-bindgen` fails (no `cdylib`)" ([`docs/runtime_wasm_artifact_observation.md`](docs/runtime_wasm_artifact_observation.md), [`src/runtime/fedos_wasm_artifact.ts`](src/runtime/fedos_wasm_artifact.ts), [`test/`](test/)). Runs the real `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' npm run build:wasm` (Stage 450's script) for the first time, against the crate exactly as it exists today (`crate-type = ["rlib"]`, no `cdylib`, `Cargo.toml` untouched). `cargo build --manifest-path packages/fedos-core-rust/Cargo.toml --target wasm32-unknown-unknown --release` SUCCEEDS (producing only `libfedos_core_rust.rlib`, matching `crate-type`, under `packages/fedos-core-rust/target/`); the chained `wasm-bindgen --target web --out-dir packages/fedos-core-rust/pkg target/wasm32-unknown-unknown/release/fedos_core_rust.wasm` FAILS (`error: failed reading '...fedos_core_rust.wasm'`, path not found) for two independent, compounding reasons classified without any code fix: (1) no `.wasm` file is ever produced without a `cdylib` target (Stage 445's finding still holds), and (2) the standalone (non-workspace) manifest's actual `target-dir` resolves under `packages/fedos-core-rust/target/`, not the repo-root `target/` the script's fixed path names. New `docs/runtime_wasm_artifact_observation.md` (Stage 459) records the command, the partial-success/failure split, both root causes (ruling out `getrandom`/toolchain/permissions problems by direct evidence), what was generated (`.rlib` + `Cargo.lock`, both gitignored) vs. not (`.wasm`, JS glue, `pkg/` — none of these exist), and why nothing generated is ever committed. **WASM artifact generation observed, artifacts remain untracked.** `src/runtime/fedos_wasm_artifact.ts` (updated Stage 460) adds a THIRD status axis — `artifactGenerationObserved`/`artifactGeneratedButUntracked`/`artifactCommitPolicy` (new `FedosWasmArtifactCommitPolicy`, fixed `"NeverCommitGeneratedArtifact"`) plus standalone `fedosArtifactGenerationObserved()`/`fedosArtifactGeneratedButUntracked()`/`fedosArtifactCommitPolicy()` — all hand-fixed constants (`true`/`true`/`"NeverCommitGeneratedArtifact"`), still no filesystem/runtime check, DISTINCT from `generationState`/`fedosWasmArtifactGenerated()` (still `"NotGenerated"`/`false` — the observed attempt failed to produce a real artifact). `test/runtime_wasm_generation.test.ts` (+1 test, item 15) and `test/runtime_wasm_artifact.test.ts` (+1 test, item 23) guard the three new labels; both files' existing filesystem-scan guards (item 7 / item 2) are RELAXED from "must never exist" to "allowed to exist locally, must never be git-tracked" (checked directly against `git ls-files`), so a future real `build:wasm` run leaving `pkg/`/`.wasm` output on disk no longer fails `npm test` — while still hard-failing if such a file is ever staged/committed. Runtime/Worker remain unconnected; `WebAssembly.instantiate`/`compile` never invoked; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). Cleanup (Stage 463): the real `packages/fedos-core-rust/target/`/`Cargo.lock` this run produced were confirmed gitignored/untracked (`git status --ignored`) then deleted; no `pkg/` ever existed to delete. Verification (Stage 464): `npm run typecheck` clean; `npm test` green (179 files / 2801 tests); `git status --short` clean. ✓

465–472. "FedOS WASM artifact generation fix — cdylib added, build:wasm path corrected, first real .wasm produced" ([`docs/runtime_wasm_artifact_generation_fix.md`](docs/runtime_wasm_artifact_generation_fix.md), [`docs/runtime_wasm_artifact_observation.md`](docs/runtime_wasm_artifact_observation.md), [`packages/fedos-core-rust/Cargo.toml`](packages/fedos-core-rust/Cargo.toml), [`package.json`](package.json), [`test/`](test/)). Resolves BOTH causes Stage 457–459 classified. New `docs/runtime_wasm_artifact_generation_fix.md` (Stage 465) records the fix and WHY `rlib` is kept (native `cargo test`/`cargo check` link against it) while `cdylib` is added (the only crate-type that makes `wasm32-unknown-unknown` emit a standalone `.wasm`). Stage 466 makes the ONE `Cargo.toml` edit this batch performs: `[lib]` `crate-type` becomes `["rlib", "cdylib"]` (was `["rlib"]`) — no dependency/feature/API change. Stage 467 corrects `build:wasm`'s `wasm-bindgen` input-path argument from the wrong repo-root-relative `target/wasm32-unknown-unknown/release/fedos_core_rust.wasm` to the crate-manifest-relative `packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm` that matches where this standalone (non-workspace) manifest's build actually writes; `cargo build`'s half of the script and the `--out-dir packages/fedos-core-rust/pkg` destination are unchanged. Stage 468 re-ran `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' npm run build:wasm`: **both original causes CONFIRMED RESOLVED** — `cargo build` produced a REAL, first-ever `fedos_core_rust.wasm` (35,744 bytes, `cdylib` output) alongside `libfedos_core_rust.rlib` (1,229,950 bytes, `rlib` output), and `wasm-bindgen` successfully located and read it (no more "path not found") — but hit a NEW, third, previously-unknown failure: a `wasm-bindgen` CLI/crate schema-version mismatch (`rust Wasm file schema version: 0.2.126` vs. `this binary schema version: 0.2.100`, the installed CLI from Stage 425 vs. the unpinned `wasm-bindgen` library version `getrandom`'s `wasm_js` feature pulled in transitively). Per this batch's own "on failure, classify, don't fix" rule, NO version pin or CLI reinstall was attempted. `docs/runtime_wasm_artifact_observation.md` §7–9 (Stage 469) records this result — what was generated (the real `.wasm` + `.rlib` + `Cargo.lock`, all gitignored) vs. not (JS glue, `pkg/` — `wasm-bindgen` still failed before writing output) — and reaffirms the existing never-commit policy covers the new `.wasm` file too. New `test/runtime_wasm_artifact_generation_fix.test.ts` (Stage 470, 14 tests) guards: `crate-type` is `rlib`+`cdylib`; `build:wasm`'s corrected path (and the old wrong path's absence); no `wasm-pack` reference anywhere; dependency counts (10/2) and Rust public API (27 `pub fn`) unchanged; `.gitignore` still covers `/pkg/`/`/target/`/`Cargo.lock`; any generated artifact is allowed to exist locally but never git-tracked (checked against `git ls-files`); Runtime/Worker unconnected; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable; `WebAssembly.instantiate`/`compile` never invoked; both WASM-fix docs state the resolved causes and the new failure. `test/runtime_wasm_generation.test.ts` (+1 test, item 16) additionally guards the corrected `crate-type`/path directly; five PRE-EXISTING guard tests across `fedos_core_rust_aes_gcm_wiring.test.ts`/`fedos_core_rust_dependency.test.ts`/`fedos_core_rust_getrandom_adoption.test.ts`/`fedos_core_rust_hkdf_wiring.test.ts`/`fedos_core_rust_rfc8439_wiring.test.ts`/`fedos_core_rust_skeleton.test.ts` that hard-asserted `crate-type = ["rlib"]`-only (no `cdylib`) are updated to match the new, deliberate `["rlib", "cdylib"]` state — still forbidding `wasm32`/`wasm-bindgen`/`staticlib` as literal Cargo.toml tokens. Stage 471 is this README update. Stage 472 verification: `cargo check` (native) green; `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' cargo check`/`cargo build --target wasm32-unknown-unknown` both green (the SAME real `.wasm` reproduced); `npm run typecheck` clean; `npm test` green (180 files / 2816 tests); `packages/fedos-core-rust/target`/`Cargo.lock` (both gitignored, confirmed via `git status --ignored`) deleted as the final step, no `pkg/` ever existed to delete; `git status --short` clean. **Still true throughout Stage 465–472**: no generated artifact committed; Runtime/Worker untouched; `WebAssembly.instantiate`/`compile` never invoked; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"` never reached; no `Cargo.toml`/`package.json` dependency added; `wasm-pack` never installed or invoked; Rust public API unchanged (27 `pub fn`). ✓

473–480. "FedOS wasm-bindgen CLI/crate version alignment — FIRST real JS glue generated" ([`docs/runtime_wasm_bindgen_version_policy.md`](docs/runtime_wasm_bindgen_version_policy.md), [`docs/runtime_wasm_artifact_observation.md`](docs/runtime_wasm_artifact_observation.md), [`src/runtime/fedos_wasm_toolchain.ts`](src/runtime/fedos_wasm_toolchain.ts), [`test/`](test/)). Resolves the THIRD cause Stage 468–469 classified — a `wasm-bindgen` CLI (`0.2.100`) / crate (`0.2.126`) schema mismatch. New `docs/runtime_wasm_bindgen_version_policy.md` (Stage 473) fixes the policy: the LOCAL `wasm-bindgen-cli` binary is upgraded to match whatever `wasm-bindgen` version the crate's dependency graph resolves to, never the reverse — because `wasm-bindgen` is not a direct dependency of this crate (only `getrandom`'s own internal `wasm_js`-feature dependency) and `Cargo.lock` is never committed, so pinning the crate side down would not be durable across a fresh `cargo build`'s re-resolution anyway. Stage 474 applied it: `cargo install wasm-bindgen-cli --version 0.2.126 --force` (`wasm-bindgen --version` now reports `0.2.126`) — a MACHINE-LOCAL environment-capability change, same category as the original Stage 425 install, touching no `Cargo.toml`/`package.json`/`Cargo.lock`. Stage 475 re-ran `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' npm run build:wasm`: **FULL SUCCESS** — the FIRST real `.wasm` + JS glue pair ever produced in this repository's history. `packages/fedos-core-rust/pkg/` now contains `fedos_core_rust_bg.wasm` (18,377 bytes, `wasm-bindgen`'s post-processed module), `fedos_core_rust.js` (3,720 bytes, the complete JS glue for this `--target web` output — this `wasm-bindgen` version consolidates what older versions split into a separate `_bg.js` file), `fedos_core_rust.d.ts` (1,166 bytes), and `fedos_core_rust_bg.wasm.d.ts` (181 bytes); the source `fedos_core_rust.wasm` `cargo` produces stayed the identical 35,744 bytes observed at Stage 468, confirming the crate's own compiled output was never the problem. `docs/runtime_wasm_artifact_observation.md` §10–11 (Stage 476) records this result and reaffirms the never-commit policy now covers the JS glue too. `src/runtime/fedos_wasm_toolchain.ts` (updated Stage 477) adds three more fixed, non-detecting labels — `wasmBindgenCliExpectedVersion` (`"0.2.126"`), `wasmBindgenVersionAligned` (`true`), `wasmGlueGenerationObserved` (`true`) — still never a live probe of any installed binary or `Cargo.lock`. New `test/runtime_wasm_bindgen_version.test.ts` (Stage 478, 14 tests) and 3 new tests across `test/runtime_wasm_toolchain.test.ts` (items 25–27) guard: the version-policy doc's CLI-moves-not-crate reasoning; no `Cargo.toml` dependency VERSION change and no `package.json` dependency added; `wasm-pack` still not adopted; `build:wasm`'s script text unchanged since Stage 467; `.gitignore` still covers `/pkg/`/`/target/`/`Cargo.lock`; any generated artifact (now including real JS glue) is allowed to exist locally but never git-tracked; Runtime/Worker unconnected; `WebAssembly.instantiate`/`compile` never invoked; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable; the new fixed toolchain labels. `test/runtime_wasm_toolchain.test.ts` item 9 (its own filesystem-scan guard) is relaxed the same way as the prior batch's item 7/2/7: allowed to exist locally, never git-tracked. Stage 479 is this README update. Stage 480 verification: `npm run typecheck` clean; `npm test` green (181 files / 2833 tests); `cargo check` (native) green; `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' cargo check`/`cargo build --target wasm32-unknown-unknown` both green; `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' npm run build:wasm` reproduces the SAME real `.wasm` + JS glue pair; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg/` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 473–480**: no generated artifact (including the new JS glue) committed; no `Cargo.toml` dependency version changed; no `package.json` dependency added; `wasm-pack` never installed or invoked; Runtime/Worker untouched; `WebAssembly.instantiate`/`compile` never invoked; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"` never reached; Rust public API unchanged (27 `pub fn`). ✓

481–488. "FedOS generated wasm-bindgen JS glue — observation and contract fixing, never usage" ([`docs/runtime_wasm_js_glue_contract.md`](docs/runtime_wasm_js_glue_contract.md), [`src/runtime/fedos_wasm_loader_contract.ts`](src/runtime/fedos_wasm_loader_contract.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Observes and fixes the CONTRACT of the real, locally-generated JS glue (Stage 475) — never imports, loads, or executes it. New `docs/runtime_wasm_js_glue_contract.md` (Stage 481) records, by direct observation only, `fedos_core_rust.js`'s exact export statement (`export { initSync, __wbg_init as default };` — TWO exports, no crate-specific function, since none of the crate's 27 `pub fn`s carries a `#[wasm_bindgen]` attribute), confirms a default export IS present (the async init function) and TWO init functions exist (`initSync` sync, default async), confirms a `memory: WebAssembly.Memory` export IS present (via `InitOutput`), and records the full four-file structure (`fedos_core_rust.js`/`.d.ts`, `fedos_core_rust_bg.wasm`/`.wasm.d.ts`). New `src/runtime/fedos_wasm_loader_contract.ts` (Stage 482) adds `FedosWasmLoaderContract`/`FedosWasmLoaderContractPlaceholder`/`createFedosWasmLoaderContract` plus pure, fixed-value-only standalone functions — `wasmLoaderState()` (`"NotLoaded"`), `loaderContractVersion()` (`"1"`), `loaderImportMode()` (`"StaticPlanning"`), `loaderInitialized()` (`false`) — deliberately UNWIRED even from `fedos_wasm_artifact.ts` (unlike every earlier adjacent pair in this chain). `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 483) add `loaderContractState`/`loaderImportMode`/`loaderInitialized` (fixed `"NotLoaded"`/`"StaticPlanning"`/`false`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (Stage 356, updated 484) gains a new section with the CALL-direction diagram (`ExecutionBackend → FedosWasmBoundary → FedosWasmArtifact → FedosWasmLoaderContract → Generated JS Glue → Generated .wasm → Rust`), complementing the existing BUILD-direction diagram (`docs/runtime_wasm_build_contract.md`) — every box is real, no arrow between them is wired as code. New `test/runtime_wasm_js_glue_contract.test.ts` (Stage 485, 13 tests) guards: the glue contract doc's recorded export list/default-export/init-function/memory-export facts; a locally-generated JS glue's ACTUAL export list matches exactly (conditional on it existing, never required); any generated artifact stays untracked; the loader contract's fixed labels; Runtime/Worker import none of the chain including the new loader contract or the generated files directly; no dynamic `import()`/`require()` of the generated glue; `WebAssembly.instantiate`/`compile` never invoked; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable; Rust public API unchanged (27 `pub fn`, none `#[wasm_bindgen]`-annotated) and no new dependency. One PRE-EXISTING guard (`runtime_crypto_boundary.test.ts` item 8) is narrowed from a bare `"wasm_loader"` substring check to the OLD loader file's actual import path/symbol names (`wasm_loader.ts`, `FedosCoreWasmLoader`, etc.) — Stage 483's legitimate `./fedos_wasm_loader_contract.js` import shares that substring but is an unrelated, new file. Stage 486 is this README update. Stage 487 (`RUSTFLAGS='--cfg getrandom_backend="wasm_js"' npm run build:wasm`, run twice during this batch for observation) confirmed `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg/` (all gitignored, confirmed via `git status --ignored`) deleted as the final step. Stage 488 verification: `npm run typecheck` clean; `npm test` green (182 files / 2846 tests); `cargo check` (native) green; `git status --short` clean. **Still true throughout Stage 481–488**: no Runtime/Worker connection of any kind; no generated file edited or committed; `WebAssembly.instantiate`/`compile` never invoked; no `fetch`/dynamic `import()`; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

489–500. "FedOS WASM Loader Skeleton — planning and policy only, still no load" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`docs/runtime_wasm_loader.md`](docs/runtime_wasm_loader.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Completes the chain "Generated JS Glue → Loader Skeleton → Loader State → Loader Policy → Diagnostics → Guard" — no load ever happens. New `src/runtime/fedos_wasm_loader.ts` (Stage 489–492) adds `FedosWasmLoader`/`FedosWasmLoaderSkeleton`/`createFedosWasmLoader` plus pure, fixed-value-only standalone functions — `loaderState()` (`"NotLoaded"`), `loaderMode()` (`"PlanningOnly"`), `loaderPolicy()` (`"FailClosed"`) — and three planned operations, `planLoad()`/`planInitialize()`/`planUnload()`, ALL fixed `"BlockedByPolicy"` (`"Allowed"` RESERVED, unreachable). This is a SEPARATE link from Stage 482's `FedosWasmLoaderContract` (a `status()`-only read) — deliberately UNWIRED to it, to the generated JS glue, or to anything else in the chain. New `docs/runtime_wasm_loader.md` (Stage 493) records the three fixed states (`NotLoaded`/`PlanningOnly`/`FailClosed`) and why denial is framed as a POLICY (`FailClosed`) rather than only "not implemented yet". `docs/runtime_internal_execution_contract.md` (updated Stage 494) gains a short, separate diagram — `Generated JS Glue → FedosWasmLoader ("Loader Skeleton") → STOP` — distinct from the existing longer CALL-direction diagram that still runs through `FedosWasmLoaderContract`. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 495) add `loaderSkeletonState`/`loaderSkeletonMode`/`loaderSkeletonPolicy` (fixed `"NotLoaded"`/`"PlanningOnly"`/`"FailClosed"`) to both activation summaries, alongside the pre-existing, unchanged `loaderContractState`/`loaderImportMode`/`loaderInitialized` fields — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. New `test/runtime_wasm_loader.test.ts` (Stage 496–497, 13 tests) guards: constructing/calling the loader does nothing and is idempotent; `planLoad`/`planInitialize`/`planUnload` all fixed `"BlockedByPolicy"`; the loader skeleton source never references the generated JS glue, `import()`, `require()`, `WebAssembly`, `fetch`, `instantiateStreaming`, the filesystem, `child_process`, `process.env`, or any earlier link in the chain (`fedos_wasm_loader_contract`/`fedos_wasm_artifact`/`fedos_wasm_boundary`); `WebAssembly.instantiate`/`compile` never invoked even when exercising the loader's full surface; no `fetch` call happens; both diagnostics summaries expose the new fixed labels; Runtime/Worker import none of the WASM chain including the new loader skeleton; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable from either activation policy; Rust public API unchanged (27 `pub fn`); both docs record their required facts. One PRE-EXISTING guard (`runtime_crypto_boundary.test.ts` item 8) is narrowed further: its `wasm_loader.(js|ts)` substring check now excludes any `fedos_`-prefixed loader file via a negative lookbehind, since Stage 495 legitimately adds a new, unrelated `./fedos_wasm_loader.js` import alongside Stage 483's pre-existing `./fedos_wasm_loader_contract.js` one. Stage 498 is this README update. Stage 499 verification: `npm run typecheck` clean; `npm test` green (183 files / 2859 tests); `cargo check` (native) green; `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' cargo check` also run for observation only, green. Stage 500: `packages/fedos-core-rust/target`/`Cargo.lock` (both gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 489–500**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no `fetch`/dynamic `import()`; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

501–508. "FedOS WASM Loader Planning — the last four phases before any load, all still blocked" ([`docs/runtime_wasm_loader_planning.md`](docs/runtime_wasm_loader_planning.md), [`src/runtime/fedos_wasm_loader_plan.ts`](src/runtime/fedos_wasm_loader_plan.ts), [`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Completes "when may the generated JS glue ever load" as design/contract/diagnostics/guard only — no load ever happens. New `docs/runtime_wasm_loader_planning.md` (Stage 501) separates that question into FIVE ordered phases: Loader Creation (already real, Stage 489), Import Permission, Initialization Permission, Runtime Attach, Worker Attach — each a separate, independent gate, none implied by another. New `src/runtime/fedos_wasm_loader_plan.ts` (Stage 502) adds `FedosWasmLoaderPlan`/`FedosWasmLoaderPlanSkeleton`/`createFedosWasmLoaderPlan` plus pure, fixed-value-only standalone functions — `planImport()`/`planInitialize()`/`planRuntimeAttach()`/`planWorkerAttach()` (ALL fixed `"BlockedByPolicy"`, `"Allowed"` RESERVED), `loaderPlanState()` (`"PlanningOnly"`), `loaderImportAllowed()`/`loaderInitializationAllowed()` (both fixed `false`) — naming phases #2–#5. Stage 503 wires `FedosWasmLoader.planLoad()` (`fedos_wasm_loader.ts`) to CONSTRUCT a `FedosWasmLoaderPlan` and call its `planImport()`, discarding the result — `planLoad()`'s own return value is UNCHANGED, mirroring `fedos_wasm_boundary.ts`'s established "reach one link deeper, keep your own answer" pattern; the file otherwise stays as UNWIRED as before (still no reference to `fedos_wasm_loader_contract.ts`/`fedos_wasm_artifact.ts`/`fedos_wasm_boundary.ts`/`create_runtime.ts`/`src/worker.ts`). `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 504) add `loaderPlanState`/`loaderImportAllowed`/`loaderInitializationAllowed` (fixed `"PlanningOnly"`/`false`/`false`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 505) revises the Stage 489–494 diagram: `ExecutionBackend` (named at top for POSITIONAL context only, not a real code wire) `→ FedosWasmLoader ("Loader Skeleton") → FedosWasmLoaderPlan ("Loader Plan") → Generated JS Glue → STOP`, explicitly marking which arrows are REAL wiring (Loader Skeleton → Loader Plan) versus positional-only. New `test/runtime_wasm_loader_plan.test.ts` (Stage 506, 14 tests) guards: constructing/calling the plan does nothing and is idempotent; all four plan operations (interface methods AND standalone functions) fixed `"BlockedByPolicy"`; the loader plan source never references the generated JS glue, `import()`, `require()`, `WebAssembly`, `fetch`, `instantiateStreaming`, `initSync`, the filesystem, `child_process`, `process.env`, `create_runtime`/`AppRuntime`, `worker.ts`, or any earlier chain link; the loader skeleton legitimately references the new plan file but never the generated JS glue/`WebAssembly`/`initSync`; `WebAssembly.instantiate`/`compile` never invoked even when exercising both files' full surface; no `fetch` call happens; both diagnostics summaries expose the new fixed labels; Runtime/Worker import none of the WASM chain including the new loader plan; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable from either activation policy; Rust public API unchanged (27 `pub fn`); both docs record their required facts. Stage 507 is this README update. Stage 508 verification: `npm run typecheck` clean; `npm test` green (184 files / 2873 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock` (both gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 501–508**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; `initSync`/the generated JS glue's default export never called; no `fetch`/dynamic `import()`; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

509–516. "FedOS WASM Loader Import Policy — fixing the six conditions before any import, all still unmet" ([`docs/runtime_wasm_loader_import_policy.md`](docs/runtime_wasm_loader_import_policy.md), [`src/runtime/fedos_wasm_loader_import_policy.ts`](src/runtime/fedos_wasm_loader_import_policy.ts), [`src/runtime/fedos_wasm_loader_plan.ts`](src/runtime/fedos_wasm_loader_plan.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Fixes the Import Policy phase #2 ("Import Permission") itself requires — design/contract/diagnostics/guard only, no import ever happens. New `docs/runtime_wasm_loader_import_policy.md` (Stage 509) fixes SIX minimum conditions, all currently unmet: Loader Plan import allowed, generated artifact present, artifact untracked/gitignored, Runtime dev-only approval, no Worker approval, Execution Review approval — every condition must hold simultaneously, and §2 explains why "generated artifact present" is deliberately never a live filesystem check. New `src/runtime/fedos_wasm_loader_import_policy.ts` (Stage 510) adds `FedosWasmLoaderImportPolicy`/`FedosWasmLoaderImportDecision`/`FedosWasmLoaderImportReason` plus `evaluateWasmLoaderImportPolicy()`, mirroring `runtime_crypto_activation_policy.ts`'s own `ActivationPolicy`/`ActivationDecision`/`ActivationReason` shape one level down this WASM arc — ALWAYS resolving `{ allowed: false, reason: "BlockedByPolicy" }` (`"Allowed"` RESERVED, unreachable), plus standalone `wasmLoaderImportPolicyState()` (`"Blocked"`). Stage 511 wires `FedosWasmLoaderPlan.planImport()` (`fedos_wasm_loader_plan.ts`) to CALL `evaluateWasmLoaderImportPolicy()`, discarding the result — `planImport()`'s own return value is UNCHANGED, mirroring Stage 503's established "reach one link deeper, keep your own answer" pattern one link down. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 512) add `loaderImportPolicyState`/`loaderImportPolicyAllowed`/`loaderImportPolicyReason` (fixed `"Blocked"`/`false`/`"BlockedByPolicy"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 513) revises the Stage 501–505 diagram, inserting Import Policy between Loader Plan and Generated JS Glue, still ending `→ STOP`. New `test/runtime_wasm_loader_import_policy.test.ts` (Stage 514, 13 tests) guards: `evaluateWasmLoaderImportPolicy()` always `allowed: false`/`reason: "BlockedByPolicy"`, pure and idempotent; the import policy source never references the generated JS glue, `import()`, `require()`, `WebAssembly`, `fetch`, `instantiateStreaming`, `initSync`, the filesystem, `child_process`, `process.env`, `create_runtime`/`AppRuntime`, or `worker.ts`; the loader plan legitimately references the import policy but never the generated JS glue/`WebAssembly`/`initSync`; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full loader/plan/policy surface; no `fetch` call happens; both diagnostics summaries expose the new fixed labels; Runtime/Worker import none of the WASM chain including the new import policy; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable from either activation policy or the import policy; Rust public API unchanged (27 `pub fn`) and no new dependency; both docs record their required facts. Stage 515 is this README update. Stage 516 verification: `npm run typecheck` clean; `npm test` green (185 files / 2886 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock` (both gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 509–516**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; `initSync`/the generated JS glue's default export never called; no `fetch`/dynamic `import()`; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

517–524. "FedOS WASM Static Import Plan — naming the exact static import a future stage would write, never writing it" ([`docs/runtime_wasm_static_import_plan.md`](docs/runtime_wasm_static_import_plan.md), [`src/runtime/fedos_wasm_static_import_plan.ts`](src/runtime/fedos_wasm_static_import_plan.ts), [`src/runtime/fedos_wasm_loader_import_policy.ts`](src/runtime/fedos_wasm_loader_import_policy.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Fixes the Static Import Plan one level below the Import Policy — design/contract/diagnostics/guard only, no import ever happens. New `docs/runtime_wasm_static_import_plan.md` (Stage 517) names the EXACT static `import` target (`packages/fedos-core-rust/pkg/fedos_core_rust.js`) and the two exports Stage 481 directly observed (`initSync` named, `default`/`__wbg_init` default) — without ever writing the statement, calling `initSync`/the default export, `WebAssembly.instantiate`/`compile`/`instantiateStreaming`, or `fetch`. New `src/runtime/fedos_wasm_static_import_plan.ts` (Stage 518) adds `FedosWasmStaticImportPlan`/`FedosWasmStaticImportDecision`/`FedosWasmStaticImportStatus` plus `createFedosWasmStaticImportPlan()`/`planStaticImport()` (ALWAYS fixed `"BlockedByPolicy"`, `"Allowed"` RESERVED, unreachable) and the fixed `FEDOS_WASM_STATIC_IMPORT_TARGET` string constant — a plain, non-resolved label, never `import()`-ed, `require()`-ed, or filesystem-checked. Stage 519 wires `evaluateWasmLoaderImportPolicy()` (`fedos_wasm_loader_import_policy.ts`) to CONSTRUCT a `FedosWasmStaticImportPlan` and call its `planStaticImport()`, discarding the result — the policy's own return value stays UNCHANGED (`allowed: false`/`reason: "BlockedByPolicy"`), the SAME "reach one link deeper, keep your own answer" pattern Stage 503/511 already established twice over. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 520) add `staticImportPlanState`/`staticImportTarget`/`staticImportAllowed` (fixed `"PlanningOnly"`/`"packages/fedos-core-rust/pkg/fedos_core_rust.js"`/`false`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 521) revises the Stage 509–513 diagram, inserting Static Import Plan between Import Policy and Generated JS Glue, still ending `→ STOP`. New `test/runtime_wasm_static_import_plan.test.ts` (Stage 522, 12 tests) guards: `planStaticImport()` always `"BlockedByPolicy"`, pure and idempotent; the import target matches identically across the plan, doc, and both diagnostics summaries; the static import plan source never references the generated JS glue, `import()`, `require()`, `WebAssembly`, `fetch`, `instantiateStreaming`, `initSync`, the filesystem, `child_process`, `process.env`, `create_runtime`/`AppRuntime`, or `worker.ts`; the import policy legitimately references the static import plan but never the generated JS glue/`WebAssembly`/`initSync`; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full policy/plan surface; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new static import plan; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable from either activation policy, the import policy, or the static import plan; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 523 is this README update. Stage 524 verification: `npm run typecheck` clean; `npm test` green (186 files / 2898 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock` (both gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 517–524**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; `initSync`/the generated JS glue's default export never called; no `fetch`/dynamic `import()`; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

525–532. "FedOS WASM Static Import Safety Review — reviewing the static import named by Stage 517, never performing it" ([`docs/runtime_wasm_static_import_safety_review.md`](docs/runtime_wasm_static_import_safety_review.md), [`src/runtime/fedos_wasm_static_import_review.ts`](src/runtime/fedos_wasm_static_import_review.ts), [`src/runtime/fedos_wasm_static_import_plan.ts`](src/runtime/fedos_wasm_static_import_plan.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a dedicated SAFETY REVIEW one level below the Static Import Plan — design/contract/diagnostics/guard only, no import ever happens. New `docs/runtime_wasm_static_import_safety_review.md` (Stage 525) reviews what would break, and why, if the static `import` statement Stage 517 names were ever written: the generated JS glue is a gitignored, never-committed build artifact (`packages/fedos-core-rust/.gitignore`, Stage 451), so a static import of it would break every environment that has not just run `npm run build:wasm` locally — fresh clones, CI, and any environment lacking the WASM toolchain — and no amount of "just commit the file" can fix that, since generated artifacts are never committed here by standing policy. New `src/runtime/fedos_wasm_static_import_review.ts` (Stage 526) adds `FedosWasmStaticImportReviewState`/`FedosWasmStaticImportReviewReason`/`FedosWasmStaticImportReviewDecision` plus `reviewStaticImport()` (ALWAYS fixed `{ approved: false, reason: "GeneratedArtifactNotCommitted" }`, `"Approved"` RESERVED, unreachable), `staticImportReviewState()` (`"ReviewedAndBlocked"`), `staticImportReviewApproved()` (`false`), and `staticImportReviewReason()` (`"GeneratedArtifactNotCommitted"`). Stage 527 wires `FedosWasmStaticImportPlanSkeleton.planStaticImport()` (`fedos_wasm_static_import_plan.ts`) to CALL `reviewStaticImport()`, discarding the result — `planStaticImport()`'s own return value is UNCHANGED, mirroring Stage 503/511/519's established "reach one link deeper, keep your own answer" pattern a fourth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 528) add `staticImportReviewState`/`staticImportReviewApproved`/`staticImportReviewReason` (fixed `"ReviewedAndBlocked"`/`false`/`"GeneratedArtifactNotCommitted"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 529) revises the Stage 517–521 diagram, inserting Static Import Review between Static Import Plan and Generated JS Glue, still ending `→ STOP`. New `test/runtime_wasm_static_import_review.test.ts` (Stage 530, 13 tests) guards: `reviewStaticImport()` always `{ approved: false, reason: "GeneratedArtifactNotCommitted" }`, pure and idempotent; the review's fixed answers match across both diagnostics summaries; the review source never references the generated JS glue, `import()`, `require()`, `WebAssembly`, `fetch`, `instantiateStreaming`, `initSync`, the filesystem, `child_process`, `process.env`, `create_runtime`/`AppRuntime`, or `worker.ts`; the static import plan legitimately references the review but never the generated JS glue/`WebAssembly`/`initSync`; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full plan/review surface; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new review; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Approved"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts; the generated artifact stays gitignored and, if present locally, is confirmed never git-tracked via `git ls-files`. Stage 531 is this README update. Stage 532 verification: `npm run typecheck` clean; `npm test` green (187 files / 2911 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock` (both gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 525–532**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; `initSync`/the generated JS glue's default export never called; no `fetch`/dynamic `import()`; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"`/`"Approved"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

533–536. "FedOS WASM Static Import Readiness — the eight conditions required after Safety Review passes, never satisfied" ([`docs/runtime_wasm_static_import_readiness.md`](docs/runtime_wasm_static_import_readiness.md), [`src/runtime/fedos_wasm_static_import_readiness.ts`](src/runtime/fedos_wasm_static_import_readiness.ts), [`src/runtime/fedos_wasm_static_import_review.ts`](src/runtime/fedos_wasm_static_import_review.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a READINESS record one level below the Safety Review — design/contract/diagnostics/guard only, no import ever happens. New `docs/runtime_wasm_static_import_readiness.md` (Stage 533) names EIGHT conditions that would ALL need to hold, simultaneously, before the static import Stage 517 names could ever actually run — Safety Review passed, Generated JS Glue present, import path fixed, Runtime unconnected, Worker unconnected, `initSync` not executed, default init not executed, Fail Closed maintained — with #1/#2/#6/#7 each independently sufficient to keep readiness at `false` today. New `src/runtime/fedos_wasm_static_import_readiness.ts` (Stage 534) adds `FedosWasmStaticImportReadinessState`/`FedosWasmStaticImportReadinessReason`/`FedosWasmStaticImportReadiness` plus `createStaticImportReadiness()` (ALWAYS fixed `{ readinessState: "PlanningOnly", ready: false, reason: "RuntimeNotReady" }`, `"Ready"` RESERVED, unreachable), `staticImportReadinessState()` (`"PlanningOnly"`), `staticImportReady()` (`false`), and `staticImportReadinessReason()` (`"RuntimeNotReady"`) — none of which ever touches the generated JS glue. Stage 535 wires `reviewStaticImport()` (`fedos_wasm_static_import_review.ts`) to CALL `createStaticImportReadiness()`, discarding the result — `reviewStaticImport()`'s own return value is UNCHANGED (`approved: false`/`reason: "GeneratedArtifactNotCommitted"`), mirroring Stage 503/511/519/527's established "reach one link deeper, keep your own answer" pattern a fifth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 536) add `readinessState`/`staticImportReady`/`staticImportReadinessReason` (fixed `"PlanningOnly"`/`false`/`"RuntimeNotReady"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 536) revises the Stage 525–529 diagram, inserting Static Import Readiness between Static Import Review and Generated JS Glue, still ending `→ STOP`. New `test/runtime_wasm_static_import_readiness.test.ts` (Stage 536, 12 tests) guards: `createStaticImportReadiness()` always `{ readinessState: "PlanningOnly", ready: false, reason: "RuntimeNotReady" }`, pure and idempotent; the readiness record's fixed answers match across both diagnostics summaries; the readiness source never references the generated JS glue, `import()`, `require()`, `WebAssembly`, `fetch`, `instantiateStreaming`, `initSync`, `__wbg_init`, the filesystem, `child_process`, `process.env`, `create_runtime`/`AppRuntime`, or `worker.ts`; the static import review legitimately references the readiness record but never the generated JS glue/`WebAssembly`/`initSync`/default init; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full plan/review/readiness surface; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new readiness record; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Approved"`/`"Ready"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 536 verification: `npm run typecheck` clean; `npm test` green (188 files / 2923 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock` (both gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 533–536**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; `initSync`/the generated JS glue's default export never called; no `fetch`/dynamic `import()`; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"`/`"Approved"`/`"Ready"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

537–544. "FedOS Generated Artifact Presence Policy — the last safety layer before a static import, never a live filesystem check" ([`docs/runtime_generated_artifact_presence_policy.md`](docs/runtime_generated_artifact_presence_policy.md), [`src/runtime/fedos_generated_artifact_presence.ts`](src/runtime/fedos_generated_artifact_presence.ts), [`src/runtime/fedos_wasm_static_import_readiness.ts`](src/runtime/fedos_wasm_static_import_readiness.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a PRESENCE POLICY one level below Static Import Readiness — design/contract/diagnostics/guard only, no import ever happens. New `docs/runtime_generated_artifact_presence_policy.md` (Stage 537) fixes what "the generated JS glue/`.wasm` exist" and "the generated JS glue/`.wasm` may be imported" would need to mean, naming SEVEN conditions (Generated JS Glue exists, Generated `.wasm` exists, neither git-tracked, Runtime unconnected, Worker unconnected, presence ≠ permission, Fail Closed maintained) and stating plainly that confirming a file's presence never, by itself, grants permission to import it. New `src/runtime/fedos_generated_artifact_presence.ts` (Stage 538) adds `FedosGeneratedArtifactPresenceState`/`FedosGeneratedArtifactPresenceReason`/`FedosGeneratedArtifactPresence` plus `createGeneratedArtifactPresence()` (ALWAYS fixed `{ state: "PlanningOnly", present: false, reason: "ArtifactNotGeneratedForRuntime" }`, `"Checked"`/`"Present"` RESERVED, unreachable), `artifactPresenceState()` (`"PlanningOnly"`), `artifactPresent()` (`false`), and `artifactPresenceReason()` (`"ArtifactNotGeneratedForRuntime"`) — using NO `fs`/`path`/`existsSync`/`statSync`/glob API to determine that answer, and never importing the generated JS glue. Stage 539 wires `createStaticImportReadiness()` (`fedos_wasm_static_import_readiness.ts`) to CALL `createGeneratedArtifactPresence()`, discarding the result — `createStaticImportReadiness()`'s own return value is UNCHANGED (`ready: false`/`reason: "RuntimeNotReady"`), mirroring Stage 503/511/519/527/535's established "reach one link deeper, keep your own answer" pattern a sixth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 540) add `artifactPresenceState`/`artifactPresent`/`artifactPresenceReason` (fixed `"PlanningOnly"`/`false`/`"ArtifactNotGeneratedForRuntime"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 541) revises the Stage 533–536 diagram, inserting Generated Artifact Presence between Static Import Readiness and Generated JS Glue, still ending `→ STOP`. New `test/runtime_generated_artifact_presence.test.ts` (Stage 542, 12 tests) guards: `createGeneratedArtifactPresence()` always `{ state: "PlanningOnly", present: false, reason: "ArtifactNotGeneratedForRuntime" }`, pure and idempotent; the presence policy's fixed answers match across both diagnostics summaries; the presence source never references the generated JS glue, `import()`, `require()`, `fs`/`node:fs`, `path`/`node:path`, `existsSync`, `statSync`, any glob API, `WebAssembly`, `fetch`, `instantiateStreaming`, `initSync`, `__wbg_init`, `child_process`, `process.env`, `create_runtime`/`AppRuntime`, or `worker.ts`; the static import readiness record legitimately references the presence policy but never the generated JS glue/`WebAssembly`/`initSync`/filesystem; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full plan/review/readiness/presence surface; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new presence policy; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 543 is this README update. Stage 544 verification: `npm run typecheck` clean; `npm test` green (189 files / 2935 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 537–544**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; `initSync`/the generated JS glue's default export never called; no `fetch`/dynamic `import()`; no `fs`/`path`/`existsSync`/`statSync`/glob-based presence check anywhere in this arc; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

545–552. "FedOS Static Import Activation Review — the final gate before real static import, Generated JS Glue never referenced" ([`docs/runtime_static_import_activation_review.md`](docs/runtime_static_import_activation_review.md), [`src/runtime/fedos_static_import_activation_review.ts`](src/runtime/fedos_static_import_activation_review.ts), [`src/runtime/fedos_generated_artifact_presence.ts`](src/runtime/fedos_generated_artifact_presence.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds an ACTIVATION REVIEW one level below Generated Artifact Presence — design/contract/diagnostics/guard only, no import ever happens, and Generated JS Glue is never referenced anywhere in this arc. New `docs/runtime_static_import_activation_review.md` (Stage 545) is the FINAL GATE immediately before real static import could ever be permitted, gathering every prior gate's answer into a single, named ACTIVATION decision — naming SEVEN conditions (Safety Review passed, Readiness complete, Artifact Presence confirmed, Generated JS Glue built, Runtime-side review completed, Fail Closed maintained, crypto API unexposed) and restating, at this final gate, that "the Generated Artifact exists" and "Runtime imports it" are separate concepts answered by different mechanisms. New `src/runtime/fedos_static_import_activation_review.ts` (Stage 546) adds `FedosStaticImportActivationState`/`FedosStaticImportActivationReason`/`FedosStaticImportActivationReview` plus `createStaticImportActivationReview()` (ALWAYS fixed `{ state: "PlanningOnly", approved: false, reason: "RuntimeActivationReviewPending" }`, `"Reviewed"`/`"Approved"` RESERVED, unreachable), `staticImportActivationState()` (`"PlanningOnly"`), `staticImportActivationApproved()` (`false`), and `staticImportActivationReason()` (`"RuntimeActivationReviewPending"`) — never referencing the generated JS glue in any way. Stage 547 wires `createGeneratedArtifactPresence()` (`fedos_generated_artifact_presence.ts`) to CALL `createStaticImportActivationReview()`, discarding the result — `createGeneratedArtifactPresence()`'s own return value is UNCHANGED (`present: false`/`reason: "ArtifactNotGeneratedForRuntime"`), mirroring Stage 503/511/519/527/535/539's established "reach one link deeper, keep your own answer" pattern a seventh time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 548) add `staticImportActivationState`/`staticImportActivationApproved`/`staticImportActivationReason` (fixed `"PlanningOnly"`/`false`/`"RuntimeActivationReviewPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 549) revises the Stage 537–541 diagram, inserting Static Import Activation Review between Generated Artifact Presence and Generated JS Glue, still ending `→ STOP`. New `test/runtime_static_import_activation_review.test.ts` (Stage 550, 12 tests) guards: `createStaticImportActivationReview()` always `{ state: "PlanningOnly", approved: false, reason: "RuntimeActivationReviewPending" }`, pure and idempotent; the activation review's fixed answers match across both diagnostics summaries; the review source never references the generated JS glue, `import()`, `require()`, `WebAssembly`, `fetch`, `instantiateStreaming`, `initSync`, `__wbg_init`, `fs`, `existsSync`/`statSync`, `child_process`, `process.env`, `create_runtime`/`AppRuntime`, or `worker.ts`; the generated artifact presence policy legitimately references the activation review but never the generated JS glue/`WebAssembly`/`initSync`/filesystem; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full plan/review/readiness/presence/activation surface; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new activation review; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 551 is this README update. Stage 552 verification: `npm run typecheck` clean; `npm test` green (190 files / 2947 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 545–552**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; `initSync`/the generated JS glue's default export never called; no `fetch`/dynamic `import()`; Generated JS Glue never imported anywhere in this arc; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

553–560. "FedOS Generated Artifact Distribution Policy — build-time generation only (Option B), never committed" ([`docs/runtime_generated_artifact_distribution_policy.md`](docs/runtime_generated_artifact_distribution_policy.md), [`src/runtime/fedos_generated_artifact_distribution.ts`](src/runtime/fedos_generated_artifact_distribution.ts), [`src/runtime/fedos_static_import_activation_review.ts`](src/runtime/fedos_static_import_activation_review.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing DISTRIBUTION POLICY one level below Static Import Activation Review — design/contract/diagnostics/guard only, no import ever happens. New `docs/runtime_generated_artifact_distribution_policy.md` (Stage 553) compares Option A (commit the generated `.wasm`/JS glue pair) against Option B (never commit; build-time generation only) and fixes this repository's standing choice as Option B — `packages/fedos-core-rust/pkg/` stays gitignored (Stage 451/69, unchanged), and a fresh clone requires `npm run build:wasm` before the generated artifact exists at all; this choice does not, by itself, make a future static import safe, since build-time generation means the artifact is never guaranteed present. New `src/runtime/fedos_generated_artifact_distribution.ts` (Stage 554) adds `FedosGeneratedArtifactDistributionMode`/`FedosGeneratedArtifactDistributionReason`/`FedosGeneratedArtifactDistribution` plus `createGeneratedArtifactDistribution()` (ALWAYS fixed `{ distributionMode: "BuildTimeGenerated", artifactCommitted: false, staticImportSafe: false, reason: "GeneratedArtifactNotCommitted" }`, `"Committed"`/`"Approved"` RESERVED, unreachable), `generatedArtifactDistributionMode()` (`"BuildTimeGenerated"`), `generatedArtifactCommitted()` (`false`), and `staticImportSafe()` (`false`) — never referencing the generated JS glue in any way. Stage 555 wires `createStaticImportActivationReview()` (`fedos_static_import_activation_review.ts`) to CALL `createGeneratedArtifactDistribution()`, discarding the result — `createStaticImportActivationReview()`'s own return value is UNCHANGED (`approved: false`/`reason: "RuntimeActivationReviewPending"`), mirroring Stage 503/511/519/527/535/539/547's established "reach one link deeper, keep your own answer" pattern an eighth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 556) add `generatedArtifactDistributionMode`/`generatedArtifactCommitted`/`staticImportSafe` (fixed `"BuildTimeGenerated"`/`false`/`false`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 557) revises the Stage 545–549 diagram, inserting Generated Artifact Distribution Policy between Static Import Activation Review and Generated JS Glue, still ending `→ STOP`. New `test/runtime_generated_artifact_distribution.test.ts` (Stage 558, 13 tests) guards: `createGeneratedArtifactDistribution()` always `{ distributionMode: "BuildTimeGenerated", artifactCommitted: false, staticImportSafe: false, reason: "GeneratedArtifactNotCommitted" }`, pure and idempotent; `packages/fedos-core-rust/.gitignore` still ignores `/pkg/`, and if a locally-generated artifact happens to exist on disk it is confirmed never git-tracked via `git ls-files`; the distribution policy's fixed answers match across both diagnostics summaries; the distribution source never references the generated JS glue, `import()`, `require()`, `WebAssembly`, `fetch`, `instantiateStreaming`, `initSync`, `__wbg_init`, `fs`, `existsSync`/`statSync`, `child_process`, `process.env`, `create_runtime`/`AppRuntime`, or `worker.ts`; the static import activation review legitimately references the distribution policy but never the generated JS glue/`WebAssembly`/`initSync`; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full plan/review/readiness/presence/activation/distribution surface; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new distribution policy; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Approved"`/`"Committed"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 559 is this README update. Stage 560 verification: `npm run typecheck` clean; `npm test` green (191 files / 2960 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 553–560**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no `fetch`/dynamic `import()`; Generated JS Glue never imported anywhere in this arc; no generated file edited or committed; `packages/fedos-core-rust/.gitignore`'s `/pkg/` rule unchanged; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

561–568. "FedOS Build-Time Loader Strategy — Option C (dynamic loader with an explicit dev-only gate) designated as a future candidate, never implemented" ([`docs/runtime_build_time_loader_strategy.md`](docs/runtime_build_time_loader_strategy.md), [`src/runtime/fedos_build_time_loader_strategy.ts`](src/runtime/fedos_build_time_loader_strategy.ts), [`src/runtime/fedos_generated_artifact_distribution.ts`](src/runtime/fedos_generated_artifact_distribution.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing LOADER STRATEGY DECISION one level below Generated Artifact Distribution Policy — design/contract/diagnostics/guard only, no import (static or dynamic) ever happens. New `docs/runtime_build_time_loader_strategy.md` (Stage 561) draws the direct consequence of the "never commit the generated artifact" (Option B) policy for how the generated JS glue/`.wasm` could ever be LOADED — no loader may assume the artifact is present, and static import is unsafe — then compares THREE candidate future loading strategies (A: require a prebuild step; B: an optional no-op loader; C: a dynamic loader with an explicit dev-only gate) and designates Option C as the future candidate WITHOUT implementing it. New `src/runtime/fedos_build_time_loader_strategy.ts` (Stage 562) adds `FedosBuildTimeLoaderStrategyKind`/`FedosBuildTimeLoaderStrategy` plus `createBuildTimeLoaderStrategy()` (ALWAYS fixed `{ strategy: "DynamicLoaderPlanned", requiresPrebuild: true, staticImportAllowed: false, dynamicImportAllowed: false, runtimeAttachAllowed: false }`, `"PrebuildRequired"`/`"OptionalLoader"` RESERVED, unreachable), `buildTimeLoaderStrategy()` (`"DynamicLoaderPlanned"`), `buildTimeLoaderRequiresPrebuild()` (`true`), and `buildTimeLoaderRuntimeAttachAllowed()` (`false`) — writing NO dynamic `import()` of any kind despite naming one as the future candidate, and never referencing the generated JS glue. Stage 563 wires `createGeneratedArtifactDistribution()` (`fedos_generated_artifact_distribution.ts`) to CALL `createBuildTimeLoaderStrategy()`, discarding the result — `createGeneratedArtifactDistribution()`'s own return value is UNCHANGED (`staticImportSafe: false`), mirroring Stage 503/511/519/527/535/539/547/555's established "reach one link deeper, keep your own answer" pattern a ninth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 564) add `buildTimeLoaderStrategy`/`buildTimeLoaderRequiresPrebuild`/`buildTimeLoaderRuntimeAttachAllowed` (fixed `"DynamicLoaderPlanned"`/`true`/`false`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 565) revises the Stage 553–557 diagram, inserting Build-Time Loader Strategy between Generated Artifact Distribution Policy and Generated JS Glue, still ending `→ STOP`. New `test/runtime_build_time_loader_strategy.test.ts` (Stage 566, 13 tests) guards: `createBuildTimeLoaderStrategy()` always `{ strategy: "DynamicLoaderPlanned", requiresPrebuild: true, staticImportAllowed: false, dynamicImportAllowed: false, runtimeAttachAllowed: false }`, pure and idempotent; the loader strategy's fixed answers match across both diagnostics summaries; the strategy source never references the generated JS glue, `import()`, `require()`, `WebAssembly`, `fetch`, `instantiateStreaming`, `initSync`, `__wbg_init`, `fs`, `existsSync`/`statSync`, `child_process`, `process.env`, `create_runtime`/`AppRuntime`, or `worker.ts`; the distribution policy legitimately references the loader strategy but never the generated JS glue/`WebAssembly`; `packages/fedos-core-rust/.gitignore` still ignores `/pkg/`, and any locally-generated artifact is confirmed never git-tracked via `git ls-files`; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full plan/review/readiness/presence/activation/distribution/loader-strategy surface; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new loader strategy; `encrypt`/`decrypt` unchanged; `"Allowed"` unreachable anywhere in the chain, and the strategy never flips to `"PrebuildRequired"`/`"OptionalLoader"` on its own; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 567 is this README update. Stage 568 verification: `npm run typecheck` clean; `npm test` green (192 files / 2973 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 561–568**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `packages/fedos-core-rust/.gitignore`'s `/pkg/` rule unchanged; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

569–576. "FedOS Dynamic Loader Gate — eight conditions before any future dynamic import(), all unmet, no side effects" ([`docs/runtime_dynamic_loader_gate.md`](docs/runtime_dynamic_loader_gate.md), [`src/runtime/fedos_dynamic_loader_gate.ts`](src/runtime/fedos_dynamic_loader_gate.ts), [`src/runtime/fedos_build_time_loader_strategy.ts`](src/runtime/fedos_build_time_loader_strategy.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing GATE one level below Build-Time Loader Strategy — design/contract/diagnostics/guard only, no import (static or dynamic) ever happens, and no side effect of any kind. New `docs/runtime_dynamic_loader_gate.md` (Stage 569) fixes EIGHT minimum conditions a future, separate, explicitly-reviewed stage would need to satisfy before a dynamic `import()` of the generated JS glue could ever be written and executed — Build-Time Loader Strategy complete, Generated Artifact Distribution policy finalized, Static Import Review complete, Runtime Activation Review complete, Runtime dev-only gating, Fail Closed maintained, Generated JS Glue unmodified, Worker out of scope — all currently unmet or insufficient alone; naming the gate is explicitly NOT opening it. New `src/runtime/fedos_dynamic_loader_gate.ts` (Stage 570) adds `FedosDynamicLoaderGateState`/`FedosDynamicLoaderGateReason`/`FedosDynamicLoaderGate` plus `createDynamicLoaderGate()` (ALWAYS fixed `{ gateState: "PlanningOnly", dynamicLoaderAllowed: false, reason: "DynamicLoaderGatePending" }`, `"Open"`/`"Allowed"` RESERVED, unreachable), `dynamicLoaderGateState()` (`"PlanningOnly"`), `dynamicLoaderAllowed()` (`false`), and `dynamicLoaderGateReason()` (`"DynamicLoaderGatePending"`) — with NO side effects and NO dynamic `import()` written anywhere in this file, even though the gate itself concerns a future dynamic loader. Stage 571 wires `createBuildTimeLoaderStrategy()` (`fedos_build_time_loader_strategy.ts`) to CALL `createDynamicLoaderGate()`, discarding the result — `createBuildTimeLoaderStrategy()`'s own return value is UNCHANGED (`strategy: "DynamicLoaderPlanned"`), mirroring Stage 503/511/519/527/535/539/547/555/563's established "reach one link deeper, keep your own answer" pattern a tenth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 572) add `dynamicLoaderGateState`/`dynamicLoaderAllowed`/`dynamicLoaderGateReason` (fixed `"PlanningOnly"`/`false`/`"DynamicLoaderGatePending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 573) revises the Stage 561–565 diagram, inserting Dynamic Loader Gate between Build-Time Loader Strategy and Generated JS Glue, still ending `→ STOP`, and explicitly records that condition #5 ("Runtime dev-only") is itself UNMET — no dev-only flag or code path anywhere consults this gate's answer, and `create_runtime.ts` does not reference it, directly or indirectly; no Runtime connection of any kind exists yet, not even a dev-only one. New `test/runtime_dynamic_loader_gate.test.ts` (Stage 574, 13 tests) guards: `createDynamicLoaderGate()` always `{ gateState: "PlanningOnly", dynamicLoaderAllowed: false, reason: "DynamicLoaderGatePending" }`, pure and idempotent; the gate's fixed answers match across both diagnostics summaries; the gate source never writes `import()`/`require()`, never references the generated JS glue, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the loader strategy legitimately references the gate but never the generated JS glue/`WebAssembly`; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full plan/review/readiness/presence/activation/distribution/loader-strategy/gate surface; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new gate; the generated JS glue is never imported (code, not comments) anywhere in the gate or loader strategy source, static or dynamic; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Open"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 575 is this README update. Stage 576 verification: `npm run typecheck` clean; `npm test` green (193 files / 2986 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 569–576**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

577–584. "FedOS Dynamic Loader Dev Approval — eight dev-only conditions before any future dynamic loader activation, all unmet, no side effects" ([`docs/runtime_dynamic_loader_dev_approval.md`](docs/runtime_dynamic_loader_dev_approval.md), [`src/runtime/fedos_dynamic_loader_dev_approval.ts`](src/runtime/fedos_dynamic_loader_dev_approval.ts), [`src/runtime/fedos_dynamic_loader_gate.ts`](src/runtime/fedos_dynamic_loader_gate.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing DEV-ONLY APPROVAL one level below Dynamic Loader Gate — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, and no side effect of any kind. New `docs/runtime_dynamic_loader_dev_approval.md` (Stage 577) fixes EIGHT minimum dev-only conditions a future, separate, explicitly-reviewed stage would need to satisfy before a dynamic loader could ever be ACTIVATED — Dynamic Loader Gate passed, dev build only, disabled in production builds, Runtime Review complete, Generated JS Glue verified, Fail Closed maintained, prohibited in Worker, prohibited in production deploy — all currently unmet or insufficient alone; this is explicitly a SEPARATE, narrower question than the Gate's own "may a dynamic `import()` ever be written at all" — this approval asks "under what conditions may it ever be ACTIVATED." New `src/runtime/fedos_dynamic_loader_dev_approval.ts` (Stage 578) adds `FedosDynamicLoaderDevApprovalState`/`FedosDynamicLoaderDevApprovalReason`/`FedosDynamicLoaderDevApproval` plus `createDynamicLoaderDevApproval()` (ALWAYS fixed `{ approvalState: "PlanningOnly", approved: false, reason: "DevApprovalPending" }`, `"Granted"`/`"Allowed"` RESERVED, unreachable), `dynamicLoaderDevApprovalState()` (`"PlanningOnly"`), `dynamicLoaderDevApproved()` (`false`), and `dynamicLoaderDevReason()` (`"DevApprovalPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file. Stage 579 wires `createDynamicLoaderGate()` (`fedos_dynamic_loader_gate.ts`) to CALL `createDynamicLoaderDevApproval()`, discarding the result — `createDynamicLoaderGate()`'s own return value is UNCHANGED (`dynamicLoaderAllowed: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571's established "reach one link deeper, keep your own answer" pattern an eleventh time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 580) add `dynamicLoaderDevApprovalState`/`dynamicLoaderDevApproved`/`dynamicLoaderDevReason` (fixed `"PlanningOnly"`/`false`/`"DevApprovalPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 581) revises the Stage 569–573 diagram, inserting Dynamic Loader Dev Approval between Dynamic Loader Gate and Generated JS Glue, still ending `→ STOP`, and explicitly records that Runtime connection does not exist and Worker connection does not exist — neither `create_runtime.ts` nor `src/worker.ts` references this approval, and no dev-only flag or code path anywhere consults its answer. New `test/runtime_dynamic_loader_dev_approval.test.ts` (Stage 582, 13 tests) guards: `createDynamicLoaderDevApproval()` always `{ approvalState: "PlanningOnly", approved: false, reason: "DevApprovalPending" }`, pure and idempotent; the approval's fixed answers match across both diagnostics summaries; the approval source never writes `import()`/`require()`, never references the generated JS glue, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the gate legitimately references the approval but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in the approval or gate source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full plan/review/readiness/presence/activation/distribution/loader-strategy/gate/dev-approval surface; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new approval; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Granted"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 583 is this README update. Stage 584 verification: `npm run typecheck` clean; `npm test` green (194 files / 2999 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 577–584**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

585–592. "FedOS Explicit Crypto Initialization — no auto-load, no implicit load, only a future explicit initCrypto()-style call may ever load anything, no side effects" ([`docs/runtime_explicit_crypto_initialization.md`](docs/runtime_explicit_crypto_initialization.md), [`src/runtime/fedos_explicit_crypto_initialization.ts`](src/runtime/fedos_explicit_crypto_initialization.ts), [`src/runtime/fedos_dynamic_loader_dev_approval.ts`](src/runtime/fedos_dynamic_loader_dev_approval.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing DESIGN RECORD one level below Dynamic Loader Dev Approval — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, and no side effect of any kind. New `docs/runtime_explicit_crypto_initialization.md` (Stage 585) fixes SIX permanent rules for WHEN the generated JS glue/WASM may ever be loaded, one level closer to Runtime's own call surface than the Dev Approval's "under what conditions may activation ever happen" — no auto-load at startup, no implicit load on `encrypt`/`decrypt`, only a future, separately-named, separately-reviewed `initCrypto()`-style call may ever load anything, Runtime never knows WASM/JS Glue directly, everything routes through the existing Loader/Backend abstractions rather than a bare `import()`/`WebAssembly.instantiate` call, Worker out of scope. New `src/runtime/fedos_explicit_crypto_initialization.ts` (Stage 586) adds `FedosCryptoInitializationMode`/`FedosCryptoInitializationReason`/`FedosExplicitCryptoInitialization` plus `createExplicitCryptoInitialization()` (ALWAYS fixed `{ mode: "ExplicitInitialization", initializationAllowed: false, initialized: false, reason: "InitializationApprovalPending" }`, `"Allowed"` RESERVED, unreachable; `mode` has no reachable alternative — this document permanently rules out any auto/implicit-load design), `cryptoInitializationMode()` (`"ExplicitInitialization"`), `cryptoInitializationAllowed()` (`false`), `cryptoInitialized()` (`false`), and `cryptoInitializationReason()` (`"InitializationApprovalPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file. Stage 587 wires `createDynamicLoaderDevApproval()` (`fedos_dynamic_loader_dev_approval.ts`) to CALL `createExplicitCryptoInitialization()`, discarding the result — `createDynamicLoaderDevApproval()`'s own return value is UNCHANGED (`approved: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579's established "reach one link deeper, keep your own answer" pattern a twelfth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 588) add `cryptoInitializationMode`/`cryptoInitializationAllowed`/`cryptoInitialized`/`cryptoInitializationReason` (fixed `"ExplicitInitialization"`/`false`/`false`/`"InitializationApprovalPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 589) revises the Stage 577–581 diagram, inserting Explicit Crypto Initialization between Dynamic Loader Dev Approval and Generated JS Glue, with a purely POSITIONAL "Dynamic Import" box beneath it naming the exact `import()` call a future dynamic loader would eventually write (per Stage 561's Option C) without implementing it, still ending `→ STOP`, and explicitly records that Runtime connection does not exist and Worker connection does not exist — neither `create_runtime.ts` nor `src/worker.ts` references this design record, and no dev-only flag or code path anywhere consults its answer. New `test/runtime_explicit_crypto_initialization.test.ts` (Stage 590, 13 tests) guards: `createExplicitCryptoInitialization()` always `{ mode: "ExplicitInitialization", initializationAllowed: false, initialized: false, reason: "InitializationApprovalPending" }`, pure and idempotent; the design record's fixed answers match across both diagnostics summaries; the source never writes `import()`/`require()`, never references the generated JS glue, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the dev approval legitimately references the design record but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full plan/review/readiness/presence/activation/distribution/loader-strategy/gate/dev-approval/explicit-init surface; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new design record; `encrypt`/`decrypt` unchanged; `"Allowed"`/`initialized` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 591 is this README update. Stage 592 verification: `npm run typecheck` clean; `npm test` green (195 files / 3012 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 585–592**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Loaded"`/`"Active"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

593–600. "FedOS Crypto Loader Facade — design-only seam between Provider and WASM Loader, PlanningOnly/denied, no side effects" ([`docs/runtime_crypto_loader_facade.md`](docs/runtime_crypto_loader_facade.md), [`src/runtime/fedos_crypto_loader_facade.ts`](src/runtime/fedos_crypto_loader_facade.ts), [`src/runtime/fedos_explicit_crypto_initialization.ts`](src/runtime/fedos_explicit_crypto_initialization.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing FACADE DESIGN one level below Explicit Crypto Initialization — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, no `WebAssembly`/generated JS glue reference, and no side effect of any kind; this stage is explicitly DESIGN ONLY, no real load implemented. New `docs/runtime_crypto_loader_facade.md` (Stage 593) names the target architecture — Crypto Runtime -> Crypto Provider -> Crypto Loader Facade -> WASM Loader -> Rust — and SIX responsibilities: Runtime sees only the Facade, Provider sees only the Facade, WASM Loader is never known directly, Rust is never known directly, the backend is swappable in the future, Fail Closed is maintained; this target diagram is explicitly CONCEPTUAL — `Crypto Runtime`/`Crypto Provider` name the pre-existing `AppRuntime.crypto`/`RuntimeCryptoProvider` wiring positionally (it terminates at `PlaceholderRuntimeCryptoProvider` and never calls the Facade), and `WASM Loader` names `fedos_wasm_loader.ts` positionally (the Facade never imports or calls it). New `src/runtime/fedos_crypto_loader_facade.ts` (Stage 594) adds `FedosCryptoLoaderFacadeState`/`FedosCryptoLoaderFacadeBackend`/`FedosCryptoLoaderFacadeReason`/`FedosCryptoLoaderFacade`/`FedosCryptoLoaderFacadeInitializationDecision` plus `createCryptoLoaderFacade()` (ALWAYS fixed `{ state: "PlanningOnly", initialized: false, backend: "WasmPlanned", reason: "FacadeInitializationPending" }`, `"Active"`/`"WasmActive"`/`"Allowed"` RESERVED, unreachable), `initializeCrypto()` (ALWAYS fixed `{ allowed: false, reason: "FacadeInitializationPending" }`), `cryptoLoaderFacadeState()` (`"PlanningOnly"`), `cryptoLoaderFacadeBackend()` (`"WasmPlanned"`), `cryptoLoaderFacadeInitialized()` (`false`), and `cryptoLoaderFacadeReason()` (`"FacadeInitializationPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file, and NO reference to `fedos_wasm_loader.ts`/`fedos_wasm_loader_plan.ts`. Stage 595 wires `createExplicitCryptoInitialization()` (`fedos_explicit_crypto_initialization.ts`) to CALL `createCryptoLoaderFacade()`, discarding the result — `createExplicitCryptoInitialization()`'s own return value is UNCHANGED (`initializationAllowed: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579/587's established "reach one link deeper, keep your own answer" pattern a thirteenth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 596) add `cryptoLoaderFacadeState`/`cryptoLoaderFacadeBackend`/`cryptoLoaderFacadeInitialized`/`cryptoLoaderFacadeReason` (fixed `"PlanningOnly"`/`"WasmPlanned"`/`false`/`"FacadeInitializationPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 597) revises the Stage 585–589 diagram, inserting Crypto Loader Facade between Explicit Crypto Initialization and the still-positional Dynamic Import box, still ending `→ STOP`, and separately presents the Stage 593 target-architecture diagram, explicitly noting per the user's own instruction that it stops at `Rust` and deliberately does NOT extend to Dynamic Import/Generated JS Glue — those remain exclusive to the lower-level parked-chain diagram; explicitly records that Runtime connection does not exist and Worker connection does not exist, and no `RuntimeCryptoProvider` implementation calls the Facade. New `test/runtime_crypto_loader_facade.test.ts` (Stage 598, 13 tests) guards: `createCryptoLoaderFacade()`/`initializeCrypto()` always fixed, pure and idempotent; the Facade's fixed answers match across both diagnostics summaries; the Facade source never writes `import()`/`require()`, never references the generated JS glue or `fedos_wasm_loader.ts`, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the explicit init design legitimately references the Facade but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full plan/review/readiness/presence/activation/distribution/loader-strategy/gate/dev-approval/explicit-init/facade surface; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new Facade; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Active"`/`"WasmActive"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 599 is this README update. Stage 600 verification: `npm run typecheck` clean; `npm test` green (196 files / 3025 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 593–600**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Loaded"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

601–608. "FedOS Crypto Provider / Facade Boundary — design-only seam recording Provider/Facade connection, PlanningOnly/denied, no side effects" ([`docs/runtime_crypto_provider_facade_boundary.md`](docs/runtime_crypto_provider_facade_boundary.md), [`src/runtime/fedos_crypto_provider_facade_boundary.ts`](src/runtime/fedos_crypto_provider_facade_boundary.ts), [`src/runtime/fedos_crypto_loader_facade.ts`](src/runtime/fedos_crypto_loader_facade.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing BOUNDARY DESIGN one level below Crypto Loader Facade — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, no `WebAssembly`/generated JS glue reference, and no side effect of any kind; this stage is explicitly DESIGN ONLY, no real connection implemented. New `docs/runtime_crypto_provider_facade_boundary.md` (Stage 601) fixes a dedicated boundary object sitting exactly at the Facade's own seam, recording whether the Provider side (`providerConnected`) and the Facade side (`facadeConnected`) have ever actually been connected — kept deliberately separate from `FedosCryptoLoaderFacade`'s own `state`/`initialized` so "Provider knows how to reach the Facade" and "the Facade itself is ready" can be reasoned about independently. New `src/runtime/fedos_crypto_provider_facade_boundary.ts` (Stage 602) adds `FedosCryptoProviderFacadeBoundaryState`/`FedosCryptoProviderFacadeBoundaryReason`/`FedosCryptoProviderFacadeBoundary` plus `createCryptoProviderFacadeBoundary()` (ALWAYS fixed `{ state: "PlanningOnly", providerConnected: false, facadeConnected: false, reason: "ProviderFacadeConnectionPending" }`, `"Connected"`/`"Allowed"` RESERVED, unreachable), `providerFacadeBoundaryState()` (`"PlanningOnly"`), `providerFacadeConnected()` (`false`, the logical AND of `providerConnected`/`facadeConnected`), and `providerFacadeReason()` (`"ProviderFacadeConnectionPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file, and NO reference to `FedosRuntimeCryptoProvider`/`fedos_wasm_loader.ts`. Stage 603 wires `createCryptoLoaderFacade()` (`fedos_crypto_loader_facade.ts`) to CALL `createCryptoProviderFacadeBoundary()`, discarding the result — `createCryptoLoaderFacade()`'s own return value is UNCHANGED (`initialized: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579/587/595's established "reach one link deeper, keep your own answer" pattern a thirteenth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 604) add `providerFacadeBoundaryState`/`providerFacadeConnected`/`providerFacadeReason` (fixed `"PlanningOnly"`/`false`/`"ProviderFacadeConnectionPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 605) revises the Stage 593–597 diagram, inserting Provider/Facade Boundary between Crypto Loader Facade and the still-positional Dynamic Import box, still ending `→ STOP`; explicitly records that Runtime connection does not exist and Worker connection does not exist, and no `RuntimeCryptoProvider` implementation calls the Boundary. New `test/runtime_crypto_provider_facade_boundary.test.ts` (Stage 606, 13 tests) guards: `createCryptoProviderFacadeBoundary()` always fixed, pure and idempotent; the Boundary's fixed answers match across both diagnostics summaries; the Boundary source never writes `import()`/`require()`, never references the generated JS glue, `FedosRuntimeCryptoProvider`, or `fedos_wasm_loader.ts`, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the Facade legitimately references the Boundary but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full parked-chain surface through the Boundary; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new Boundary; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Connected"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 607 is this README update. Stage 608 verification is combined with Stage 616 below. **Still true throughout Stage 601–608**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Loaded"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

609–616. "FedOS Crypto Provider Initialization Request Planning — provider-side planning one level above the Boundary, PlanningOnly/denied, no side effects" ([`docs/runtime_crypto_provider_initialization_request.md`](docs/runtime_crypto_provider_initialization_request.md), [`src/runtime/fedos_crypto_provider_initialization_request.ts`](src/runtime/fedos_crypto_provider_initialization_request.ts), [`src/runtime/fedos_crypto_provider_facade_boundary.ts`](src/runtime/fedos_crypto_provider_facade_boundary.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing REQUEST PLAN — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, no `WebAssembly`/generated JS glue reference, and no side effect of any kind; this stage is explicitly DESIGN ONLY, no real request ever issued. New `docs/runtime_crypto_provider_initialization_request.md` (Stage 609) is provider-side planning one level ABOVE the Boundary in the extended target architecture — Crypto Provider -> Provider Initialization Request -> Provider/Facade Boundary -> Crypto Loader Facade -> STOP (CONCEPTUAL, exactly like the Stage 593 target diagram it extends, and per the user's own instruction deliberately stopping at Crypto Loader Facade without reaching WASM Loader/Rust/Dynamic Import/Generated JS Glue); fixes what a Provider would actually hand to the Boundary once connected, keeping `requested` (has a Provider ever issued one) and `allowed` (would the Boundary currently accept it) deliberately separate so a future stage can move one without silently implying the other. New `src/runtime/fedos_crypto_provider_initialization_request.ts` (Stage 610) adds `FedosCryptoProviderInitializationRequestState`/`FedosCryptoProviderInitializationRequestReason`/`FedosCryptoProviderInitializationRequest` plus `createCryptoProviderInitializationRequest()` (ALWAYS fixed `{ state: "PlanningOnly", requested: false, allowed: false, reason: "ProviderInitializationRequestPending" }`, `"Requested"`/`"Allowed"` RESERVED, unreachable), `providerInitializationRequestState()` (`"PlanningOnly"`), `providerInitializationRequested()` (`false`), `providerInitializationAllowed()` (`false`), and `providerInitializationReason()` (`"ProviderInitializationRequestPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file, and NO reference to `FedosRuntimeCryptoProvider`/`fedos_crypto_loader_facade.ts`. Stage 611 wires `createCryptoProviderFacadeBoundary()` (`fedos_crypto_provider_facade_boundary.ts`) to CALL `createCryptoProviderInitializationRequest()`, discarding the result — `createCryptoProviderFacadeBoundary()`'s own return value is UNCHANGED (`providerConnected: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603's established "reach one link deeper, keep your own answer" pattern a fourteenth time; NOTE this real wire runs BELOW the Boundary in the parked implementation chain, the OPPOSITE direction from the request's position ABOVE the Boundary in the target architecture diagram — the two diagrams name the SAME four real files from two deliberately separate vantage points. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 612) add `providerInitializationRequestState`/`providerInitializationRequested`/`providerInitializationAllowed`/`providerInitializationReason` (fixed `"PlanningOnly"`/`false`/`false`/`"ProviderInitializationRequestPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 613) revises the Stage 601–605 diagram, inserting Provider Initialization Request between Provider/Facade Boundary and the still-positional Dynamic Import box, still ending `→ STOP`, and separately presents the extended target-architecture diagram; explicitly records that Runtime connection does not exist and Worker connection does not exist, and no `RuntimeCryptoProvider` implementation constructs or issues a request. New `test/runtime_crypto_provider_initialization_request.test.ts` (Stage 614, 13 tests) guards: `createCryptoProviderInitializationRequest()` always fixed, pure and idempotent; the request's fixed answers match across both diagnostics summaries; the request source never writes `import()`/`require()`, never references the generated JS glue, `FedosRuntimeCryptoProvider`, or `fedos_crypto_loader_facade.ts`, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the Boundary legitimately references the request plan but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full parked-chain surface through the request plan; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new request plan; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Requested"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 615 is this README update. Stage 616 (and Stage 608 above) verification: `npm run typecheck` clean; `npm test` green (198 files / 3051 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 601–616**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/`"Loaded"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

617–624. "FedOS Provider Initialization Approval — design-only review step one level deeper than the Request's own allowed flag, PlanningOnly/denied, no side effects" ([`docs/runtime_provider_initialization_approval.md`](docs/runtime_provider_initialization_approval.md), [`src/runtime/fedos_provider_initialization_approval.ts`](src/runtime/fedos_provider_initialization_approval.ts), [`src/runtime/fedos_crypto_provider_initialization_request.ts`](src/runtime/fedos_crypto_provider_initialization_request.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing APPROVAL DESIGN one level below Provider Initialization Request — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, no `WebAssembly`/generated JS glue reference, and no side effect of any kind; this stage is explicitly DESIGN ONLY, no real approval ever granted. New `docs/runtime_provider_initialization_approval.md` (Stage 617) fixes a dedicated approval step one level deeper than `FedosCryptoProviderInitializationRequest.allowed` (Stage 610): whether a SPECIFIC, already-issued request has actually been reviewed and approved, distinct from whether the Boundary would structurally accept one. New `src/runtime/fedos_provider_initialization_approval.ts` (Stage 618) adds `FedosProviderInitializationApprovalState`/`FedosProviderInitializationApprovalReason`/`FedosProviderInitializationApproval` plus `createProviderInitializationApproval()` (ALWAYS fixed `{ state: "PlanningOnly", approved: false, reason: "ProviderInitializationApprovalPending" }`, `"Approved"`/`"Allowed"` RESERVED, unreachable), `providerInitializationApprovalState()` (`"PlanningOnly"`), `providerInitializationApproved()` (`false`), and `providerInitializationApprovalReason()` (`"ProviderInitializationApprovalPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file, and NO reference to `FedosRuntimeCryptoProvider`/`fedos_crypto_loader_facade.ts`/`fedos_crypto_provider_facade_boundary.ts`. Stage 619 wires `createCryptoProviderInitializationRequest()` (`fedos_crypto_provider_initialization_request.ts`) to CALL `createProviderInitializationApproval()`, discarding the result — `createCryptoProviderInitializationRequest()`'s own return value is UNCHANGED (`requested: false`, `allowed: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611's established "reach one link deeper, keep your own answer" pattern a fourteenth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 620) add `providerInitializationApprovalState`/`providerInitializationApproved`/`providerInitializationApprovalReason` (fixed `"PlanningOnly"`/`false`/`"ProviderInitializationApprovalPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 621) revises the Stage 609–613 diagram, inserting Provider Initialization Approval between Provider Initialization Request and the still-positional Dynamic Import box, still ending `→ STOP`; explicitly records that Runtime connection does not exist and Worker connection does not exist, and no `RuntimeCryptoProvider` implementation approves a request. New `test/runtime_provider_initialization_approval.test.ts` (Stage 622, 13 tests) guards: `createProviderInitializationApproval()` always fixed, pure and idempotent; the Approval's fixed answers match across both diagnostics summaries; the Approval source never writes `import()`/`require()`, never references the generated JS glue, `FedosRuntimeCryptoProvider`, `fedos_crypto_loader_facade.ts`, or `fedos_crypto_provider_facade_boundary.ts`, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the Request legitimately references the Approval but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full parked-chain surface through the Approval; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new Approval; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Approved"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 623 is this README update. Stage 624 verification is combined with Stage 632 below. **Still true throughout Stage 617–624**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/`"Loaded"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

625–632. "FedOS Provider Init Facade Contract — last design layer before the already-real Provider/Facade Boundary, full target architecture named, PlanningOnly/denied, no side effects" ([`docs/runtime_provider_init_facade_contract.md`](docs/runtime_provider_init_facade_contract.md), [`src/runtime/fedos_provider_init_facade_contract.ts`](src/runtime/fedos_provider_init_facade_contract.ts), [`src/runtime/fedos_provider_initialization_approval.ts`](src/runtime/fedos_provider_initialization_approval.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing CONTRACT DESIGN — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, no `WebAssembly`/generated JS glue reference, and no side effect of any kind; this stage is explicitly DESIGN ONLY, no real contract ever established. New `docs/runtime_provider_init_facade_contract.md` (Stage 625) fixes the LAST layer before the already-real Provider/Facade Boundary (`fedos_crypto_provider_facade_boundary.ts`, Stage 602): whether the Provider side and the Facade side currently agree on a shared call/return shape for `initializeCrypto()`, distinct from whether a request has been approved; extends the target architecture to its FULL form — Crypto Provider -> Provider Initialization Request -> Provider Initialization Approval -> Provider Init Facade Contract -> Provider/Facade Boundary -> Crypto Loader Facade -> STOP (CONCEPTUAL, exactly like the Stage 593/609 target diagrams it extends, every box naming a REAL file but every ARROW conceptual, and per the user's own instruction still stopping at Crypto Loader Facade). New `src/runtime/fedos_provider_init_facade_contract.ts` (Stage 626) adds `FedosProviderInitFacadeContractState`/`FedosProviderInitFacadeContractReason`/`FedosProviderInitFacadeContract` plus `createProviderInitFacadeContract()` (ALWAYS fixed `{ state: "PlanningOnly", contractReady: false, reason: "ProviderInitFacadeContractPending" }`, `"Ready"`/`"Allowed"` RESERVED, unreachable), `providerInitFacadeContractState()` (`"PlanningOnly"`), `providerInitFacadeContractReady()` (`false`), and `providerInitFacadeContractReason()` (`"ProviderInitFacadeContractPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file, and NO reference to `FedosRuntimeCryptoProvider`/`fedos_crypto_loader_facade.ts`/`fedos_crypto_provider_facade_boundary.ts`. Stage 627 wires `createProviderInitializationApproval()` (`fedos_provider_initialization_approval.ts`) to CALL `createProviderInitFacadeContract()`, discarding the result — `createProviderInitializationApproval()`'s own return value is UNCHANGED (`approved: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619's established "reach one link deeper, keep your own answer" pattern a fifteenth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 628) add `providerInitFacadeContractState`/`providerInitFacadeContractReady`/`providerInitFacadeContractReason` (fixed `"PlanningOnly"`/`false`/`"ProviderInitFacadeContractPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 629) revises the Stage 617–621 diagram, inserting Provider Init Facade Contract between Provider Initialization Approval and the still-positional Dynamic Import box, still ending `→ STOP`, and separately presents the extended full target-architecture diagram named above; explicitly records that Runtime connection does not exist and Worker connection does not exist, and no `RuntimeCryptoProvider` implementation establishes a contract with the Facade. New `test/runtime_provider_init_facade_contract.test.ts` (Stage 631, 13 tests) guards: `createProviderInitFacadeContract()` always fixed, pure and idempotent; the Contract's fixed answers match across both diagnostics summaries; the Contract source never writes `import()`/`require()`, never references the generated JS glue, `FedosRuntimeCryptoProvider`, `fedos_crypto_loader_facade.ts`, or `fedos_crypto_provider_facade_boundary.ts`, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the Approval legitimately references the Contract but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full parked-chain surface through the Contract; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new Contract; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Ready"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 630 is this README update. Stage 632 (and Stage 624 above) verification: `npm run typecheck` clean; `npm test` green (200 files / 3077 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 617–632**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/`"Loaded"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

633–640. "FedOS initializeCrypto API Contract — design-only callability layer one level deeper than the Provider Init Facade Contract's shape agreement, PlanningOnly/denied, no side effects" ([`docs/runtime_initialize_crypto_api_contract.md`](docs/runtime_initialize_crypto_api_contract.md), [`src/runtime/fedos_initialize_crypto_api_contract.ts`](src/runtime/fedos_initialize_crypto_api_contract.ts), [`src/runtime/fedos_provider_init_facade_contract.ts`](src/runtime/fedos_provider_init_facade_contract.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing API CONTRACT DESIGN one level below Provider Init Facade Contract — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, no `WebAssembly`/generated JS glue reference, and no side effect of any kind; this stage is explicitly DESIGN ONLY, no real call ever made. New `docs/runtime_initialize_crypto_api_contract.md` (Stage 633) fixes whether `FedosCryptoLoaderFacade.initializeCrypto()` (Stage 594) itself is currently CALLABLE and whether it has ever actually run, distinct from `FedosProviderInitFacadeContract.contractReady` (Stage 626), which only answers whether the two sides agree on a shape. New `src/runtime/fedos_initialize_crypto_api_contract.ts` (Stage 634) adds `FedosInitializeCryptoApiContractState`/`FedosInitializeCryptoApiContractReason`/`FedosInitializeCryptoApiContract` plus `createInitializeCryptoApiContract()` (ALWAYS fixed `{ state: "PlanningOnly", callable: false, initialized: false, reason: "InitializeCryptoApiPending" }`, `"Callable"`/`"Allowed"` RESERVED, unreachable), `initializeCryptoApiState()` (`"PlanningOnly"`), `initializeCryptoCallable()` (`false`), `initializeCryptoInitialized()` (`false`), and `initializeCryptoReason()` (`"InitializeCryptoApiPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file, and NO reference to `FedosRuntimeCryptoProvider`/`fedos_crypto_loader_facade.ts`/`fedos_crypto_provider_facade_boundary.ts`/`fedos_wasm_loader.ts`. Stage 635 wires `createProviderInitFacadeContract()` (`fedos_provider_init_facade_contract.ts`) to CALL `createInitializeCryptoApiContract()`, discarding the result — `createProviderInitFacadeContract()`'s own return value is UNCHANGED (`contractReady: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627's established "reach one link deeper, keep your own answer" pattern a sixteenth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 636) add `initializeCryptoApiState`/`initializeCryptoCallable`/`initializeCryptoInitialized`/`initializeCryptoReason` (fixed `"PlanningOnly"`/`false`/`false`/`"InitializeCryptoApiPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 637) revises the Stage 625–630 diagram, inserting initializeCrypto API Contract between Provider Init Facade Contract and the still-positional Dynamic Import box, still ending `→ STOP`; explicitly records that Runtime connection does not exist and Worker connection does not exist, and `initializeCrypto()` is never actually called by anything in this file. New `test/runtime_initialize_crypto_api_contract.test.ts` (Stage 638, 13 tests) guards: `createInitializeCryptoApiContract()` always fixed, pure and idempotent; the API Contract's fixed answers match across both diagnostics summaries; the API Contract source never writes `import()`/`require()`, never references the generated JS glue, `FedosRuntimeCryptoProvider`, `fedos_crypto_loader_facade.ts`, `fedos_crypto_provider_facade_boundary.ts`, or `fedos_wasm_loader.ts`, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the Provider Init Facade Contract legitimately references the API Contract but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full parked-chain surface through the API Contract; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new API Contract; `encrypt`/`decrypt` unchanged; `"Callable"`/`"Allowed"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 639 is this README update. Stage 640 verification is combined with Stage 648 below. **Still true throughout Stage 633–640**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/`"Callable"`/`"Loaded"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

641–648. "FedOS Crypto Initialization Result Contract — terminus of the Provider-side Planning arc, full target architecture extended, PlanningOnly/denied, no side effects" ([`docs/runtime_crypto_initialization_result.md`](docs/runtime_crypto_initialization_result.md), [`src/runtime/fedos_crypto_initialization_result.ts`](src/runtime/fedos_crypto_initialization_result.ts), [`src/runtime/fedos_initialize_crypto_api_contract.ts`](src/runtime/fedos_initialize_crypto_api_contract.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing RESULT CONTRACT DESIGN — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, no `WebAssembly`/generated JS glue reference, and no side effect of any kind; this stage is explicitly DESIGN ONLY, no real initialization ever runs or completes. New `docs/runtime_crypto_initialization_result.md` (Stage 641) is the TERMINUS of the Provider-side Planning arc begun at `docs/runtime_crypto_provider_initialization_request.md` (Stage 609): what a completed `initializeCrypto()` call would actually REPORT back — success/failure, and which backend (if any) ultimately served the request — distinct from `FedosInitializeCryptoApiContract.initialized` (Stage 634), which only answers whether a call has ever completed, not whether it succeeded; extends the target architecture by two more boxes — Crypto Provider -> Provider Initialization Request -> Provider Initialization Approval -> Provider Init Facade Contract -> Provider/Facade Boundary -> Crypto Loader Facade -> InitializeCrypto API Contract -> Crypto Initialization Result Contract -> STOP (CONCEPTUAL, every box naming a REAL file but every ARROW conceptual for the Provider/Request/Approval/Contract/Boundary/Facade segment, per the user's own instruction). New `src/runtime/fedos_crypto_initialization_result.ts` (Stage 642) adds `FedosCryptoInitializationResultState`/`FedosCryptoInitializationResultBackend`/`FedosCryptoInitializationResultReason`/`FedosCryptoInitializationResult` plus `createCryptoInitializationResult()` (ALWAYS fixed `{ state: "PlanningOnly", success: false, backend: "None", reason: "InitializationResultPending" }`, `"Completed"`/`"Wasm"`/`"Allowed"` RESERVED, unreachable), `cryptoInitializationResultState()` (`"PlanningOnly"`), `cryptoInitializationSuccess()` (`false`), `cryptoInitializationBackend()` (`"None"`), and `cryptoInitializationResultReason()` (`"InitializationResultPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file. Stage 643 wires `createInitializeCryptoApiContract()` (`fedos_initialize_crypto_api_contract.ts`) to CALL `createCryptoInitializationResult()`, discarding the result — `createInitializeCryptoApiContract()`'s own return value is UNCHANGED (`callable: false`, `initialized: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635's established "reach one link deeper, keep your own answer" pattern a seventeenth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 644) add `cryptoInitializationResultState`/`cryptoInitializationSuccess`/`cryptoInitializationBackend`/`cryptoInitializationResultReason` (fixed `"PlanningOnly"`/`false`/`"None"`/`"InitializationResultPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 645) revises the Stage 633–637 diagram, inserting Crypto Initialization Result Contract between initializeCrypto API Contract and the still-positional Dynamic Import box, still ending `→ STOP`, and separately presents the extended full target-architecture diagram named above; explicitly records that Runtime connection does not exist and Worker connection does not exist, and no initialization of any kind is ever run or completed. New `test/runtime_crypto_initialization_result.test.ts` (Stage 646, 13 tests) guards: `createCryptoInitializationResult()` always fixed, pure and idempotent; the Result Contract's fixed answers match across both diagnostics summaries; the Result Contract source never writes `import()`/`require()`, never references the generated JS glue, `FedosRuntimeCryptoProvider`, `fedos_crypto_loader_facade.ts`, `fedos_crypto_provider_facade_boundary.ts`, or `fedos_wasm_loader.ts`, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the API Contract legitimately references the Result Contract but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full parked-chain surface through the Result Contract; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new Result Contract; `encrypt`/`decrypt` unchanged; `"Success"`/`"Completed"`/`"Wasm"`/`"Allowed"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 647 is this README update. Stage 648 (and Stage 640 above) verification: `npm run typecheck` clean; `npm test` green (202 files / 3103 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean. **Still true throughout Stage 633–648**: no Runtime/Worker connection of any kind; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/`"Callable"`/`"Completed"`/`"Wasm"`/`"Loaded"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

649–656. "FedOS Runtime initializeCrypto Exposure Review — first Runtime-facing design layer, PlanningOnly/denied, no side effects, create_runtime.ts/worker.ts unmodified" ([`docs/runtime_initialize_crypto_exposure_review.md`](docs/runtime_initialize_crypto_exposure_review.md), [`src/runtime/fedos_initialize_crypto_exposure_review.ts`](src/runtime/fedos_initialize_crypto_exposure_review.ts), [`src/runtime/fedos_crypto_initialization_result.ts`](src/runtime/fedos_crypto_initialization_result.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing REVIEW DESIGN one level below Crypto Initialization Result Contract — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, no `WebAssembly`/generated JS glue reference, and no side effect of any kind; this stage is explicitly DESIGN ONLY, no real exposure or approval ever granted, and neither `create_runtime.ts` nor `src/worker.ts` is modified. New `docs/runtime_initialize_crypto_exposure_review.md` (Stage 649) is the FIRST layer in this arc that looks OUTWARD, toward Runtime, rather than downward into the parked chain: whether `initializeCrypto()` is currently exposed on `AppRuntime` in any way, and whether that exposure has ever been reviewed and approved — both independent of `FedosCryptoInitializationResult` (Stage 642), which only answers what a completed call would report. New `src/runtime/fedos_initialize_crypto_exposure_review.ts` (Stage 650) adds `FedosInitializeCryptoExposureReviewState`/`FedosInitializeCryptoExposureReviewReason`/`FedosInitializeCryptoExposureReview` plus `createInitializeCryptoExposureReview()` (ALWAYS fixed `{ state: "PlanningOnly", exposed: false, approved: false, reason: "RuntimeExposureReviewPending" }`, `"Reviewed"`/`"Allowed"` RESERVED, unreachable), `initializeCryptoExposureState()` (`"PlanningOnly"`), `initializeCryptoExposed()` (`false`), `initializeCryptoExposureApproved()` (`false`), and `initializeCryptoExposureReason()` (`"RuntimeExposureReviewPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file. Stage 651 wires `createCryptoInitializationResult()` (`fedos_crypto_initialization_result.ts`) to CALL `createInitializeCryptoExposureReview()`, discarding the result — `createCryptoInitializationResult()`'s own return value is UNCHANGED (`success: false`, `backend: "None"`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635/643's established "reach one link deeper, keep your own answer" pattern a seventeenth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 652) add `initializeCryptoExposureState`/`initializeCryptoExposed`/`initializeCryptoExposureApproved`/`initializeCryptoExposureReason` (fixed `"PlanningOnly"`/`false`/`false`/`"RuntimeExposureReviewPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 653... combined with the Stage 661 update below) revises the Stage 641–645 diagram, inserting Runtime initializeCrypto Exposure Review between Crypto Initialization Result Contract and the still-positional Dynamic Import box, still ending `→ STOP`; explicitly records that Runtime/Worker connection does not exist and neither file is modified. New `test/runtime_initialize_crypto_exposure_review.test.ts` (Stage 654, 13 tests) guards: `createInitializeCryptoExposureReview()` always fixed, pure and idempotent; the Review's fixed answers match across both diagnostics summaries; the Review source never writes `import()`/`require()`, never references the generated JS glue, `FedosRuntimeCryptoProvider`, `fedos_crypto_loader_facade.ts`, `fedos_crypto_provider_facade_boundary.ts`, or `fedos_wasm_loader.ts`, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the Result Contract legitimately references the Review but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full parked-chain surface through the Review; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new Review; `encrypt`/`decrypt` unchanged; `"Exposed"`/`"Approved"`/`"Reviewed"`/`"Allowed"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 655 is this README update. Stage 656 verification is combined with Stage 664 below. **Still true throughout Stage 649–656**: no Runtime/Worker connection of any kind, `create_runtime.ts`/`src/worker.ts` UNMODIFIED; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/`"Callable"`/`"Completed"`/`"Wasm"`/`"Exposed"`/`"Loaded"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

657–664. "FedOS Runtime initializeCrypto Wiring Plan — terminus of this Planning arc, full target architecture named including Explicit Crypto Initialization, PlanningOnly/denied, no side effects" ([`docs/runtime_initialize_crypto_wiring_plan.md`](docs/runtime_initialize_crypto_wiring_plan.md), [`src/runtime/fedos_initialize_crypto_wiring_plan.ts`](src/runtime/fedos_initialize_crypto_wiring_plan.ts), [`src/runtime/fedos_initialize_crypto_exposure_review.ts`](src/runtime/fedos_initialize_crypto_exposure_review.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing PLAN DESIGN — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, no `WebAssembly`/generated JS glue reference, and no side effect of any kind; this stage is explicitly DESIGN ONLY, no real wiring ever performed, and neither `create_runtime.ts` nor `src/worker.ts` is modified. New `docs/runtime_initialize_crypto_wiring_plan.md` (Stage 657) is the LAST layer before any real connection could ever be attempted: even IF exposure were someday approved, a Runtime connection and a Worker connection are two SEPARATE decisions, evaluated independently, never assuming one implies the other (`docs/runtime_worker_activation_boundary.md`); names the FULL target-architecture diagram, from Runtime through this Plan's own `STOP`, for the first time explicitly including `Explicit Crypto Initialization` (real since Stage 586, never previously named in a target diagram) — Crypto Provider -> Provider Initialization Request -> Provider Initialization Approval -> Provider Init Facade Contract -> Provider/Facade Boundary -> Crypto Loader Facade -> Explicit Crypto Initialization -> InitializeCrypto API Contract -> Crypto Initialization Result Contract -> Runtime initializeCrypto Exposure Review -> Runtime initializeCrypto Wiring Plan -> STOP (CONCEPTUAL, every box naming a REAL file but every ARROW conceptual for the Provider/Request/Approval/Contract/Boundary/Facade segment; Explicit Crypto Initialization's OWN real position in the parked chain is ABOVE Crypto Loader Facade, calling INTO it, the opposite of this diagram's reading order — see the doc's own explanation). New `src/runtime/fedos_initialize_crypto_wiring_plan.ts` (Stage 658) adds `FedosInitializeCryptoWiringPlanState`/`FedosInitializeCryptoWiringPlanReason`/`FedosInitializeCryptoWiringPlan` plus `createInitializeCryptoWiringPlan()` (ALWAYS fixed `{ state: "PlanningOnly", runtimeWiringAllowed: false, workerWiringAllowed: false, reason: "RuntimeWiringPlanPending" }`, `"Wired"`/`"Allowed"` RESERVED, unreachable), `initializeCryptoWiringPlanState()` (`"PlanningOnly"`), `initializeCryptoRuntimeWiringAllowed()` (`false`), `initializeCryptoWorkerWiringAllowed()` (`false`), and `initializeCryptoWiringPlanReason()` (`"RuntimeWiringPlanPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file. Stage 659 wires `createInitializeCryptoExposureReview()` (`fedos_initialize_crypto_exposure_review.ts`) to CALL `createInitializeCryptoWiringPlan()`, discarding the result — `createInitializeCryptoExposureReview()`'s own return value is UNCHANGED (`exposed: false`, `approved: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635/643/651's established "reach one link deeper, keep your own answer" pattern an eighteenth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 660) add `initializeCryptoWiringPlanState`/`initializeCryptoRuntimeWiringAllowed`/`initializeCryptoWorkerWiringAllowed`/`initializeCryptoWiringPlanReason` (fixed `"PlanningOnly"`/`false`/`false`/`"RuntimeWiringPlanPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 661) revises the Stage 649–653 diagram, inserting Runtime initializeCrypto Wiring Plan between the Exposure Review and the still-positional Dynamic Import box, still ending `→ STOP`, and separately presents the full extended target-architecture diagram named above; explicitly records that Runtime/Worker connection does not exist and neither file is modified. New `test/runtime_initialize_crypto_wiring_plan.test.ts` (Stage 663, 13 tests) guards: `createInitializeCryptoWiringPlan()` always fixed, pure and idempotent; the Plan's fixed answers match across both diagnostics summaries; the Plan source never writes `import()`/`require()`, never references the generated JS glue, `FedosRuntimeCryptoProvider`, `fedos_crypto_loader_facade.ts`, `fedos_crypto_provider_facade_boundary.ts`, or `fedos_wasm_loader.ts`, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the Exposure Review legitimately references the Plan but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full parked-chain surface through the Plan; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new Plan; `encrypt`/`decrypt` unchanged; `"Wired"`/`"Allowed"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts including the full target architecture. Stage 662 is this README update. Stage 664 (and Stage 656 above) verification: `npm run typecheck` clean; `npm test` green (204 files / 3129 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean; `git diff --stat -- src/runtime/create_runtime.ts src/worker.ts` confirmed EMPTY. **Still true throughout Stage 649–664**: no Runtime/Worker connection of any kind, `create_runtime.ts`/`src/worker.ts` UNMODIFIED; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/`"Callable"`/`"Completed"`/`"Wasm"`/`"Exposed"`/`"Wired"`/`"Loaded"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

665–672. "FedOS Runtime initializeCrypto Public API — design-only public surface shape, distinct from the internal Facade-level callable flag, PlanningOnly/denied, no side effects" ([`docs/runtime_initialize_crypto_public_api.md`](docs/runtime_initialize_crypto_public_api.md), [`src/runtime/fedos_initialize_crypto_public_api.ts`](src/runtime/fedos_initialize_crypto_public_api.ts), [`src/runtime/fedos_initialize_crypto_wiring_plan.ts`](src/runtime/fedos_initialize_crypto_wiring_plan.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing PUBLIC API DESIGN one level below Runtime initializeCrypto Wiring Plan — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, no `WebAssembly`/generated JS glue reference, and no side effect of any kind; this stage is explicitly DESIGN ONLY, no real public API ever exposed, and neither `create_runtime.ts` nor `src/worker.ts` is modified. New `docs/runtime_initialize_crypto_public_api.md` (Stage 665) fixes the SHAPE of what Runtime would actually expose to its own callers: whether `initializeCrypto()` is currently VISIBLE as a public member on `AppRuntime`, and whether that member is CALLABLE — distinct from `FedosInitializeCryptoWiringPlan.runtimeWiringAllowed` (Stage 658), a structurally earlier permission question. New `src/runtime/fedos_initialize_crypto_public_api.ts` (Stage 666) adds `FedosInitializeCryptoPublicApiState`/`FedosInitializeCryptoPublicApiReason`/`FedosInitializeCryptoPublicApi` plus `createInitializeCryptoPublicApi()` (ALWAYS fixed `{ state: "PlanningOnly", apiVisible: false, callable: false, reason: "PublicApiPending" }`, `"Visible"`/`"Allowed"` RESERVED, unreachable), `initializeCryptoPublicApiState()` (`"PlanningOnly"`), `initializeCryptoApiVisible()` (`false`), `initializeCryptoPublicApiCallable()` (`false`), and `initializeCryptoPublicApiReason()` (`"PublicApiPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file. This file's own `callable` field is DISTINCT from `FedosInitializeCryptoApiContract.callable` (Stage 634, the INTERNAL Facade-level answer) — its standalone diagnostics accessor is deliberately named `initializeCryptoPublicApiCallable()`, not `initializeCryptoCallable()`, to avoid colliding with Stage 636's pre-existing diagnostics field of that name; both remain permanently `false` and are never conflated. Stage 667 wires `createInitializeCryptoWiringPlan()` (`fedos_initialize_crypto_wiring_plan.ts`) to CALL `createInitializeCryptoPublicApi()`, discarding the result — `createInitializeCryptoWiringPlan()`'s own return value is UNCHANGED (`runtimeWiringAllowed: false`, `workerWiringAllowed: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635/643/651/659's established "reach one link deeper, keep your own answer" pattern a nineteenth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 668) add `initializeCryptoPublicApiState`/`initializeCryptoApiVisible`/`initializeCryptoPublicApiCallable`/`initializeCryptoPublicApiReason` (fixed `"PlanningOnly"`/`false`/`false`/`"PublicApiPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 669... combined with the Stage 677 update below) revises the Stage 657–661 diagram, inserting Runtime initializeCrypto Public API between the Wiring Plan and the still-positional Dynamic Import box, still ending `→ STOP`; explicitly records that Runtime/Worker connection does not exist, neither file is modified, and `initializeCrypto()` is not added as a member of `AppRuntime`. New `test/runtime_initialize_crypto_public_api.test.ts` (Stage 670, 13 tests) guards: `createInitializeCryptoPublicApi()` always fixed, pure and idempotent; the Public API's fixed answers match across both diagnostics summaries AND remain distinct from the pre-existing `initializeCryptoCallable` field; the Public API source never writes `import()`/`require()`, never references the generated JS glue, `FedosRuntimeCryptoProvider`, `fedos_crypto_loader_facade.ts`, `fedos_crypto_provider_facade_boundary.ts`, or `fedos_wasm_loader.ts`, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the Wiring Plan legitimately references the Public API but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full parked-chain surface through the Public API; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new Public API; `encrypt`/`decrypt` unchanged; `"Visible"`/`"Callable"`/`"Allowed"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts. Stage 671 is this README update. Stage 672 verification is combined with Stage 680 below. **Still true throughout Stage 665–672**: no Runtime/Worker connection of any kind, `create_runtime.ts`/`src/worker.ts` UNMODIFIED; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/`"Callable"`/`"Completed"`/`"Wasm"`/`"Exposed"`/`"Wired"`/`"Visible"`/`"Loaded"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

673–680. "FedOS Runtime initializeCrypto Invocation Contract — terminus of the Public API arc, full target architecture extended, PlanningOnly/denied, no side effects" ([`docs/runtime_initialize_crypto_invocation_contract.md`](docs/runtime_initialize_crypto_invocation_contract.md), [`src/runtime/fedos_initialize_crypto_invocation_contract.ts`](src/runtime/fedos_initialize_crypto_invocation_contract.ts), [`src/runtime/fedos_initialize_crypto_public_api.ts`](src/runtime/fedos_initialize_crypto_public_api.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Adds a standing INVOCATION CONTRACT DESIGN — design/contract/diagnostics/guard only, no `import()` (static or dynamic) ever happens, no `WebAssembly`/generated JS glue reference, and no side effect of any kind; this stage is explicitly DESIGN ONLY, no real invocation ever attempted or completed, and neither `create_runtime.ts` nor `src/worker.ts` is modified. New `docs/runtime_initialize_crypto_invocation_contract.md` (Stage 673) is the LAST layer in this arc: even IF `initializeCrypto()` were someday visible and callable, an actual INVOCATION — a real caller actually invoking it — is a further, separate, EVENT-level question, distinct from the STRUCTURAL question of callability. New `src/runtime/fedos_initialize_crypto_invocation_contract.ts` (Stage 674) adds `FedosInitializeCryptoInvocationContractState`/`FedosInitializeCryptoInvocationContractReason`/`FedosInitializeCryptoInvocationContract` plus `createInitializeCryptoInvocationContract()` (ALWAYS fixed `{ state: "PlanningOnly", invocationAllowed: false, completed: false, reason: "InvocationContractPending" }`, `"Invoked"`/`"Allowed"` RESERVED, unreachable), `initializeCryptoInvocationState()` (`"PlanningOnly"`), `initializeCryptoInvocationAllowed()` (`false`), `initializeCryptoInvocationCompleted()` (`false`), and `initializeCryptoInvocationReason()` (`"InvocationContractPending"`) — with NO side effects and NO `import()` of any kind (static or dynamic) written anywhere in this file. Stage 675 wires `createInitializeCryptoPublicApi()` (`fedos_initialize_crypto_public_api.ts`) to CALL `createInitializeCryptoInvocationContract()`, discarding the result — `createInitializeCryptoPublicApi()`'s own return value is UNCHANGED (`apiVisible: false`, `callable: false`), mirroring Stage 503/511/519/527/535/539/547/555/563/571/579/587/595/603/611/619/627/635/643/651/659/667's established "reach one link deeper, keep your own answer" pattern a twentieth time. `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage 676) add `initializeCryptoInvocationState`/`initializeCryptoInvocationAllowed`/`initializeCryptoInvocationCompleted`/`initializeCryptoInvocationReason` (fixed `"PlanningOnly"`/`false`/`false`/`"InvocationContractPending"`) to both activation summaries — three pre-existing exact-snapshot tests (`runtime_crypto_activation_boundary.test.ts`, `runtime_fedos_provider_boundary.test.ts`, `worker_crypto_boundary.test.ts`) are updated to include them. `docs/runtime_internal_execution_contract.md` (updated Stage 677) revises the Stage 665–669 diagram, inserting Runtime initializeCrypto Invocation Contract between the Public API and the still-positional Dynamic Import box, still ending `→ STOP`, and extends the Stage 657 full target-architecture diagram by two more boxes, through this arc's own `STOP` — Crypto Provider -> Provider Initialization Request -> Provider Initialization Approval -> Provider Init Facade Contract -> Provider/Facade Boundary -> Crypto Loader Facade -> Explicit Crypto Initialization -> InitializeCrypto API Contract -> Crypto Initialization Result Contract -> Runtime initializeCrypto Exposure Review -> Runtime initializeCrypto Wiring Plan -> Runtime initializeCrypto Public API -> Runtime initializeCrypto Invocation Contract -> STOP (CONCEPTUAL for the Provider/Request/Approval/Contract/Boundary/Facade/Explicit-Init segment; the Public API and Invocation Contract are the third and fourth boxes whose real wiring runs in the SAME direction as the diagram, continuing the deepest reach of the parked implementation chain); explicitly records that Runtime/Worker connection does not exist and neither file is modified. New `test/runtime_initialize_crypto_invocation_contract.test.ts` (Stage 679, 13 tests) guards: `createInitializeCryptoInvocationContract()` always fixed, pure and idempotent; the Contract's fixed answers match across both diagnostics summaries; the Contract source never writes `import()`/`require()`, never references the generated JS glue, `FedosRuntimeCryptoProvider`, `fedos_crypto_loader_facade.ts`, `fedos_crypto_provider_facade_boundary.ts`, or `fedos_wasm_loader.ts`, and never touches `WebAssembly`/`fetch`/`initSync`/`__wbg_init`/`fs`/`existsSync`/`statSync`/`child_process`/`process.env`/`create_runtime`/`AppRuntime`/`worker.ts`; the Public API legitimately references the Contract but never the generated JS glue/`WebAssembly`; the generated JS glue is never imported (code, not comments) anywhere in either source, static or dynamic; `WebAssembly.instantiate`/`compile` never invoked even when exercising the full parked-chain surface through the Contract; no `fetch` call happens; Runtime/Worker import none of the WASM chain including the new Contract; `encrypt`/`decrypt` unchanged; `"Invoked"`/`"Allowed"`/`"Completed"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record their required facts including the full target architecture. Stage 678 is this README update. Stage 680 (and Stage 672 above) verification: `npm run typecheck` clean; `npm test` green (206 files / 3155 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored, confirmed via `git status --ignored`) deleted as the final step; `git status --short` clean; `git diff --stat -- src/runtime/create_runtime.ts src/worker.ts` confirmed EMPTY. **Still true throughout Stage 665–680**: no Runtime/Worker connection of any kind, `create_runtime.ts`/`src/worker.ts` UNMODIFIED; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/`"Approved"`/`"Ready"`/`"Present"`/`"Reviewed"`/`"Committed"`/`"PrebuildRequired"`/`"OptionalLoader"`/`"Open"`/`"Granted"`/`"Active"`/`"WasmActive"`/`"Connected"`/`"Requested"`/`"Callable"`/`"Completed"`/`"Wasm"`/`"Exposed"`/`"Wired"`/`"Visible"`/`"Invoked"`/`"Loaded"`/`"FailOpen"` never reached; no `Cargo.toml`/`package.json` dependency added; Rust public API unchanged (27 `pub fn`). ✓

681–688. "Planning review / simplification checkpoint" ([`docs/runtime_initialize_crypto_planning_review.md`](docs/runtime_initialize_crypto_planning_review.md), [`docs/runtime_initialize_crypto_simplification_plan.md`](docs/runtime_initialize_crypto_simplification_plan.md), [`docs/runtime_initialize_crypto_first_wiring_plan.md`](docs/runtime_initialize_crypto_first_wiring_plan.md), [`test/`](test/)). A DELIBERATE PAUSE before any further `PlanningOnly` layer is added — no new layer, no new `src/runtime` module, no new diagnostics field, no code deletion, no Runtime/Worker connection, no `create_runtime.ts`/`src/worker.ts` modification. New `docs/runtime_initialize_crypto_planning_review.md` (Stage 681) inventories the TWELVE existing layers built across Stage 585–680, in target-architecture order — Provider Initialization Request, Provider Initialization Approval, Provider Init Facade Contract, Provider/Facade Boundary, Crypto Loader Facade, Explicit Crypto Initialization, InitializeCrypto API Contract, Crypto Initialization Result Contract, Runtime initializeCrypto Exposure Review, Runtime initializeCrypto Wiring Plan, Runtime initializeCrypto Public API, Runtime initializeCrypto Invocation Contract — recording each one's role, current fixed value, reason to keep, and whether it is a consolidation candidate. New `docs/runtime_initialize_crypto_simplification_plan.md` (Stage 682) classifies all twelve into four categories WITHOUT deleting, merging, or modifying any of them: 絶対残す/Must-keep (4 — Provider/Facade Boundary, Crypto Loader Facade, Explicit Crypto Initialization, Runtime initializeCrypto Wiring Plan), 将来統合可能/Future-consolidation-candidate (6, as three pairs — Request+Approval, API Contract+Result Contract, Public API+Invocation Contract), docs上だけ残せばよい/Docs-only-candidate (1 — Provider Init Facade Contract), and 実配線時に不要になる可能性あり/May-become-unnecessary-at-real-wiring-time (1 — Runtime initializeCrypto Exposure Review); no removal is scheduled or authorized by this classification. New `docs/runtime_initialize_crypto_first_wiring_plan.md` (Stage 683) names `initializeCrypto()` as the sole first Runtime-exposure candidate whenever a future, separate, explicitly-reviewed stage attempts a real connection — Worker, `encrypt`/`decrypt`, NIP-17/NIP-44/NIP-59, and any WASM import (static or dynamic) are all explicitly OUT OF SCOPE for that first wiring; only a future `allowed: false` public-facing CHECK (not a call) is named as potentially in scope for a near-term stage, with the actual load explicitly deferred. Stage 684 is this README update, moving "you are here" to this checkpoint. New `test/runtime_initialize_crypto_planning_review.test.ts` (Stage 685, 13 tests) guards: all three new docs exist and are non-empty; the planning review enumerates all twelve known layer names; the simplification plan uses all four required category labels and places none in an immediate-removal category; `initializeCrypto()` is named as the sole first-exposure candidate; Worker/`encrypt`-`decrypt`/NIP-17/NIP-44/NIP-59/`import()`/`WebAssembly.instantiate` are all documented as out of scope or prohibited; no new `PlanningOnly` runtime module was added — `src/runtime/fedos_*.ts` is confirmed to be EXACTLY the same known thirty-eight files as before this stage, by name; Runtime/Worker import none of the twelve layers; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; each new doc names itself non-implementing (review/analysis/policy only). Stage 686: existing diagnostics are UNCHANGED — `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` are not touched by this stage, confirmed via `git diff --stat` returning empty for both files (and for `create_runtime.ts`/`src/worker.ts`). Stage 687 verification: `npm run typecheck` clean; `npm test` green (207 files / 3168 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted as the final step. Stage 688: `git status --short` clean after commit. **Still true throughout Stage 681–688**: no new `PlanningOnly` layer, no new `src/runtime` module, no new diagnostics field, no code deletion; no Runtime/Worker connection of any kind, `create_runtime.ts`/`src/worker.ts` UNMODIFIED; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

689–696. "Prototype Phase 001: AppRuntime.initializeCrypto() — the first real, callable Runtime public API, allowed:false fixed" ([`docs/runtime_initialize_crypto_prototype.md`](docs/runtime_initialize_crypto_prototype.md), [`src/runtime/types.ts`](src/runtime/types.ts), [`src/runtime/create_runtime.ts`](src/runtime/create_runtime.ts), [`src/runtime/runtime_crypto_diagnostics.ts`](src/runtime/runtime_crypto_diagnostics.ts), [`test/`](test/)). Ends the pure-Planning arc (Stage 585–688, twelve `fedos_*.ts` `PlanningOnly` layers, none ever reachable from `AppRuntime`) and opens **Prototype Phase 001**: `AppRuntime` gains its first REAL, callable public member from this arc — `initializeCrypto()` — but calling it performs NO real work. No thirteenth `PlanningOnly` layer is added, and none of the twelve existing `fedos_*.ts` files is touched, called, imported, or referenced by the implementation. New `docs/runtime_initialize_crypto_prototype.md` (Stage 689) records the phase transition: Planning Phase ends, Prototype Phase 001 begins, `initializeCrypto()` is the first Runtime public API, Rust/WASM/Loader/generated JS glue remain unconnected, the return value is fixed `allowed: false`, and Worker/`encrypt`/`decrypt` are explicitly out of scope. `src/runtime/types.ts` (Stage 690) adds `RuntimeInitializeCryptoReason` (`"PrototypeDisabled"`, the only value produced), `RuntimeInitializeCryptoResult` (`{ allowed: false; initialized: false; reason: RuntimeInitializeCryptoReason }`, `allowed`/`initialized` typed as the literal `false`), and `AppRuntime.initializeCrypto: () => RuntimeInitializeCryptoResult` — the existing `cryptoProvider`/`crypto` fields are UNCHANGED. `src/runtime/create_runtime.ts` (Stage 691) adds `createRuntimeInitializeCryptoResult()` (ALWAYS returns `{ allowed: false, initialized: false, reason: "PrototypeDisabled" }`, pure/synchronous, no Facade/Loader/WASM/Rust call, no `import()` of any kind) and wires it into `createRuntime()`'s returned object as `initializeCrypto`. `src/runtime/runtime_crypto_diagnostics.ts` (Stage 692) adds `runtimeInitializeCryptoPrototypeExposed` (fixed `true` — the member IS really wired into `AppRuntime` now, unlike every `PlanningOnly` layer's own always-`false` exposure field), `runtimeInitializeCryptoPrototypeAllowed` (fixed `false`), and `runtimeInitializeCryptoPrototypeReason` (fixed `"PrototypeDisabled"`) to `RuntimeCryptoActivationStatus`/`runtimeCryptoActivationStatus()`, reading `create_runtime.ts`'s own `createRuntimeInitializeCryptoResult()` — `worker_crypto_diagnostics.ts` is intentionally NOT touched, since Worker exposure stays out of scope. New `test/runtime_initialize_crypto_prototype.test.ts` (Stage 693, 14 tests) guards: `createRuntime().initializeCrypto` exists and is callable; the return value is always the fixed object, including across repeated calls and fresh runtimes; the diagnostics summary reports exposed:true/allowed:false/reason; `create_runtime.ts`/`types.ts` never write `import()`/`require()` and never reference the generated JS glue, `WebAssembly`, `fedos_crypto_loader_facade.ts`, `fedos_crypto_provider_facade_boundary.ts`, or `fedos_wasm_loader.ts`; `WebAssembly.instantiate`/`compile` and `fetch` are never invoked when calling `initializeCrypto()`; `src/worker.ts` never references `initializeCrypto`; `encrypt`/`decrypt` are unchanged on both `FedosRuntimeCryptoProvider` and the default `AppRuntime.crypto`; the `fedos_*.ts` file set is still exactly the known thirty-eight; the pre-existing `cryptoProvider`/`crypto` selection is unaffected; the new doc records the required facts. Stage 694: two pre-existing exact-snapshot tests (`test/runtime_crypto_activation_boundary.test.ts`, `test/runtime_fedos_provider_boundary.test.ts`) are updated to include the three new diagnostics fields — no other Runtime test required a change, and no snapshot was updated beyond what the type change forced. Stage 695 is this README update, moving "you are here" to this checkpoint. Stage 696 verification: `npm run typecheck` clean; `npm test` green (208 files / 3182 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted as the final step; `git status --short` clean after commit. **Still true throughout Stage 689–696**: no thirteenth `PlanningOnly` layer, no new `fedos_*.ts` module; `src/worker.ts` UNMODIFIED and never references `initializeCrypto`; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added; `AppRuntime.initializeCrypto()` permanently resolves `allowed: false`. ✓

697–712. "Prototype Phase 002: Runtime reaches the Crypto Loader Facade (only) — result discarded, allowed:false unchanged" ([`src/runtime/create_runtime.ts`](src/runtime/create_runtime.ts), [`src/runtime/runtime_crypto_diagnostics.ts`](src/runtime/runtime_crypto_diagnostics.ts), [`test/`](test/)). Extends the Prototype Phase 001 door (Stage 689–696) ONE link deeper: `AppRuntime.initializeCrypto()`'s implementation now actually calls the pre-existing `fedos_crypto_loader_facade.ts`'s `createCryptoLoaderFacade()` — the SAME "reach one link deeper, discard the result, keep your own fixed answer" pattern already established thirteen-plus times across the `fedos_*.ts` Planning arc — but Runtime stops exactly there: it never calls the Provider/Facade Boundary, WASM Loader, `WebAssembly`, or Rust directly, and the Facade file itself is byte-for-byte unmodified. `src/runtime/create_runtime.ts` (Stage 697) adds a private `reachCryptoLoaderFacade()` helper that `createRuntimeInitializeCryptoResult()` calls before returning; the Facade's `{ state: "PlanningOnly", initialized: false, backend: "WasmPlanned", reason: "FacadeInitializationPending" }` answer is discarded in full — Runtime's own return value stays byte-for-byte `{ allowed: false, initialized: false, reason: "PrototypeDisabled" }`. `src/runtime/runtime_crypto_diagnostics.ts` (Stage 698) adds `runtimePrototypeFacadeReached` (fixed `true` — the Facade IS actually called now), `runtimePrototypeFacadeConnected` (reads the Facade's own pre-existing `cryptoLoaderFacadeInitialized()`, fixed `false`), and `runtimePrototypeFacadeReason` (mirrors the Runtime-level `"PrototypeDisabled"` reason) to `RuntimeCryptoActivationStatus`/`runtimeCryptoActivationStatus()` — `worker_crypto_diagnostics.ts` is intentionally NOT touched. New `test/runtime_initialize_crypto_prototype_facade.test.ts` (Stage 699–708, 14 tests) guards: the fixed Runtime return value is unaffected by reaching the Facade, and its three keys are never merged with the Facade's own `state`/`backend` fields (proof the result is discarded, not consumed); `create_runtime.ts` legitimately references `createCryptoLoaderFacade` but never the Provider/Facade Boundary, WASM Loader, Rust files, or the generated JS glue directly; no `import()`/`require()`/`WebAssembly`/`fetch`/`initSync`/`__wbg_init` anywhere in `create_runtime.ts`; the Facade file itself is unmodified — its code never references `AppRuntime`/`create_runtime.ts`/`src/worker.ts`/the WASM Loader; `WebAssembly.instantiate`/`compile` and `fetch` are never invoked when calling `initializeCrypto()` (now reaching the Facade); Worker remains untouched — `src/worker.ts` references neither `initializeCrypto` nor the Facade — and `workerCryptoActivationStatus()` carries none of the three new Facade-reached fields; Runtime diagnostics report `runtimePrototypeFacadeReached: true`/`runtimePrototypeFacadeConnected: false`/reason unchanged; `encrypt`/`decrypt` unchanged on both `FedosRuntimeCryptoProvider` and the default `AppRuntime.crypto`; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; the `fedos_*.ts` file set is still exactly the known thirty-eight; repeated calls and independent runtimes all agree. Stage 709: fourteen pre-existing guard tests across the `fedos_*.ts` Planning arc (`runtime_crypto_loader_facade.test.ts`, `runtime_crypto_provider_facade_boundary.test.ts`, `runtime_crypto_provider_initialization_request.test.ts`, `runtime_provider_initialization_approval.test.ts`, `runtime_provider_init_facade_contract.test.ts`, `runtime_initialize_crypto_api_contract.test.ts`, `runtime_crypto_initialization_result.test.ts`, `runtime_initialize_crypto_exposure_review.test.ts`, `runtime_initialize_crypto_wiring_plan.test.ts`, `runtime_initialize_crypto_public_api.test.ts`, `runtime_initialize_crypto_invocation_contract.test.ts`, `runtime_initialize_crypto_planning_review.test.ts`, plus Stage 689–696's own `runtime_initialize_crypto_prototype.test.ts`) had their "Runtime remains unconnected" regexes updated to drop `fedos_crypto_loader_facade` from the forbidden-pattern list — the ONLY change in each — since `create_runtime.ts` now legitimately references it; each file's Worker-side assertion is UNCHANGED (Worker still never references the Facade). `runtime_crypto_loader_facade.test.ts`'s own Runtime test (#8) is renamed to state the new, deliberate boundary explicitly and additionally asserts `create_runtime.ts` DOES reference the Facade while still excluding the Provider/Facade Boundary and everything past it. No snapshot was touched beyond this one regex edit per file. Stage 710 is this README update, moving "you are here" to this checkpoint. Stage 711–712 verification: `npm run typecheck` clean; `npm test` green (209 files / 3196 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted as the final step; `git status --short` clean after commit. **Still true throughout Stage 697–712**: no new `PlanningOnly` layer, no new `fedos_*.ts` module, no Facade/Loader/WASM internal change; `src/worker.ts` UNMODIFIED and never references `initializeCrypto` or the Facade; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`/`initSync`/default-init reference; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added; `AppRuntime.initializeCrypto()` permanently resolves `allowed: false`, now having reached — but stopped at — the Crypto Loader Facade. ✓

713–728. "Prototype Phase 003: Crypto Loader Backend Abstraction — the Facade becomes a thin, swappable entry point; Rust owns crypto only, Runtime never learns backend detail" ([`docs/runtime_crypto_loader_backend_abstraction.md`](docs/runtime_crypto_loader_backend_abstraction.md), [`src/runtime/fedos_crypto_loader_backend.ts`](src/runtime/fedos_crypto_loader_backend.ts), [`src/runtime/fedos_crypto_loader_facade.ts`](src/runtime/fedos_crypto_loader_facade.ts), [`src/runtime/runtime_crypto_diagnostics.ts`](src/runtime/runtime_crypto_diagnostics.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Extends the Prototype Phase 002 chain (Stage 697–712, Runtime→Facade) ONE more link deeper — Facade→Backend Abstraction — while still stopping short of the WASM Loader: `Runtime → initializeCrypto() → Crypto Loader Facade → Crypto Loader Backend Abstraction → STOP`. New `docs/runtime_crypto_loader_backend_abstraction.md` (Stage 713) names the seam that lets the Facade stay a THIN entry point for backend selection, fixes the Rust/Runtime/Facade division of responsibility (Rust owns crypto/keys/signatures/safety only; Runtime never learns backend detail; Facade asks-and-discards), and names three candidate kinds. New `src/runtime/fedos_crypto_loader_backend.ts` (Stage 714) adds `FedosCryptoLoaderBackendState`/`FedosCryptoLoaderBackendKind` (`"WasmPlanned"` — the first candidate, ONLY value ever produced — `"NativePlanned"` — a future native/desktop/mobile candidate — and `"PythonPlanned"` — a future experimentation/analysis-layer candidate, neither implemented)/`FedosCryptoLoaderBackendReason`/`FedosCryptoLoaderBackend` plus `createCryptoLoaderBackend()` (ALWAYS fixed `{ state: "PlanningOnly", backendKind: "WasmPlanned", backendReady: false, reason: "BackendAbstractionPending" }`) and four standalone accessors — a TERMINUS: unlike every other file in this arc it calls nothing further, matching the diagram's own `STOP`. `src/runtime/fedos_crypto_loader_facade.ts` (Stage 721) adds a SECOND, separate `reachCryptoLoaderBackend()` call inside `createCryptoLoaderFacade()` (alongside its pre-existing `reachProviderFacadeBoundary()` call) — the Backend Abstraction's result is discarded, and the Facade's own return value, `initializeCrypto()`'s own Facade-level return value, AND Runtime's own `AppRuntime.initializeCrypto()` return value all stay byte-for-byte unchanged (`{ allowed: false, initialized: false, reason: "PrototypeDisabled" }` at the Runtime level). This is the ONLY caller of `fedos_crypto_loader_backend.ts` anywhere in the repository — `create_runtime.ts` never references it directly. `src/runtime/runtime_crypto_diagnostics.ts` (Stage 725) adds `cryptoLoaderBackendState`/`cryptoLoaderBackendKind`/`cryptoLoaderBackendReady`/`cryptoLoaderBackendReason` (fixed `"PlanningOnly"`/`"WasmPlanned"`/`false`/`"BackendAbstractionPending"`) to `RuntimeCryptoActivationStatus`/`runtimeCryptoActivationStatus()` — `worker_crypto_diagnostics.ts` is intentionally NOT touched. `docs/runtime_internal_execution_contract.md` (Stage 726) adds a new "Prototype Phases 001–003" section distinguishing this arc's REAL function-call chain (every arrow a real call, unlike the conceptual `fedos_*.ts` target-architecture diagrams elsewhere in the document) from the pre-existing Planning chain, and explicitly records Worker as OUT OF SCOPE for the entire arc. New `test/runtime_crypto_loader_backend.test.ts` (Stage 713–720, 15 tests) and existing-suite updates guard: the fixed Backend Abstraction value never changes, including across repeated calls; diagnostics match, and Worker diagnostics carry NONE of the four new fields; the Backend Abstraction source never writes `import()`/`require()`/`WebAssembly`/`fetch`/`initSync`/`__wbg_init` and never references Runtime/Worker/the WASM Loader/the generated JS glue, and calls nothing further (true terminus); the Facade legitimately reaches the Backend Abstraction but its OWN return value and `initializeCrypto()`'s Facade-level return value are unchanged; Runtime's `initializeCrypto()` return value is unaffected; ONLY the Facade calls the Backend Abstraction — `create_runtime.ts` never references it directly; `WebAssembly.instantiate`/`compile` and `fetch` are never invoked exercising the full surface; Worker remains fully unconnected, including to the Backend Abstraction; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Active"`/`"Ready"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record the required facts. Six pre-existing tests are updated for the now-known thirty-nine `fedos_*.ts` files (`fedos_crypto_loader_backend.ts` added) and the two exact-diagnostics-snapshot tests gain the four new fields — the ONLY changes in each. Stage 727 is this README update, moving "you are here" to this checkpoint. Stage 728 verification: `npm run typecheck` clean; `npm test` green (210 files / 3211 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted as the final step; `git status --short` clean after commit. **Still true throughout Stage 713–728**: no direct Backend call from anywhere but the Facade; Runtime never learns backend detail; `src/worker.ts` UNMODIFIED and never references `initializeCrypto`/the Facade/the Backend Abstraction; `worker_crypto_diagnostics.ts` UNTOUCHED; no WASM Loader connection; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`/`initSync`/default-init reference; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/`"Active"`/`"Ready"` never reached; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

729–744. "Prototype Phase 004: WASM Backend Planning Layer — the Backend Abstraction's designated candidate describes its own readiness and loader-attachment state; Rust still owns crypto only, Runtime never learns loader detail" ([`docs/runtime_wasm_backend_planning.md`](docs/runtime_wasm_backend_planning.md), [`src/runtime/fedos_wasm_backend.ts`](src/runtime/fedos_wasm_backend.ts), [`src/runtime/fedos_crypto_loader_backend.ts`](src/runtime/fedos_crypto_loader_backend.ts), [`src/runtime/runtime_crypto_diagnostics.ts`](src/runtime/runtime_crypto_diagnostics.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Extends the Prototype Phase 003 chain (Stage 713–728, Facade→Backend Abstraction) ONE more link deeper — Backend Abstraction→WASM Backend Planning — while still stopping short of the real WASM Loader: `Runtime → initializeCrypto() → Crypto Loader Facade → Crypto Loader Backend Abstraction → WASM Backend Planning → STOP`. New `docs/runtime_wasm_backend_planning.md` (Stage 729) names the seam directly below the Backend Abstraction that lets its designated `"WasmPlanned"` candidate describe its own readiness and loader-attachment state, fixes the SAME Rust/Runtime/Facade/Backend-Abstraction division of responsibility one link further down, and names two loader-kind values (`"WasmLoaderPlanned"`, the only value ever produced, and `"WasmLoaderActive"`, reserved). New `src/runtime/fedos_wasm_backend.ts` (Stage 730) adds `FedosWasmBackendState`/`FedosWasmBackendLoaderKind`/`FedosWasmBackendReason`/`FedosWasmBackend` plus `createWasmBackend()` (ALWAYS fixed `{ state: "PlanningOnly", backendReady: false, loaderAttached: false, loaderKind: "WasmLoaderPlanned", reason: "WasmBackendPlanningPending" }`) and five standalone accessors — a TERMINUS: unlike the Backend Abstraction one link up, it calls nothing further, matching the diagram's own `STOP`. `src/runtime/fedos_crypto_loader_backend.ts` (Stage 737) adds a private `reachWasmBackend()` call inside `createCryptoLoaderBackend()` — the WASM Backend Planning layer's result is discarded, and the Backend Abstraction's own return value, the Facade's own return value, `initializeCrypto()`'s own Facade-level return value, AND Runtime's own `AppRuntime.initializeCrypto()` return value all stay byte-for-byte unchanged (`{ allowed: false, initialized: false, reason: "PrototypeDisabled" }` at the Runtime level). This is the ONLY caller of `fedos_wasm_backend.ts` anywhere in the repository — neither `create_runtime.ts`, `src/worker.ts`, nor `fedos_crypto_loader_facade.ts` references it directly. `src/runtime/runtime_crypto_diagnostics.ts` (Stage 741) adds `wasmBackendState`/`wasmBackendReady`/`wasmBackendLoaderAttached`/`wasmBackendLoaderKind`/`wasmBackendReason` (fixed `"PlanningOnly"`/`false`/`false`/`"WasmLoaderPlanned"`/`"WasmBackendPlanningPending"`) to `RuntimeCryptoActivationStatus`/`runtimeCryptoActivationStatus()` — `worker_crypto_diagnostics.ts` is intentionally NOT touched. `docs/runtime_internal_execution_contract.md` (Stage 742) adds a new "Prototype Phase 004" update section extending the Stage 689–728 diagram one link further, and explicitly records Worker as OUT OF SCOPE for the entire arc. New `test/runtime_wasm_backend.test.ts` (Stage 729–740, 15 tests) and existing-suite updates guard: the fixed WASM Backend Planning value never changes, including across repeated calls; diagnostics match, and Worker diagnostics carry NONE of the five new fields; the WASM Backend Planning source never writes `import()`/`require()`/`WebAssembly`/`fetch`/`initSync`/`__wbg_init` and never references Runtime/Worker/the real WASM Loader/the generated JS glue/the Backend Abstraction/the Facade, and calls nothing further (true terminus); the Backend Abstraction legitimately reaches WASM Backend Planning but its OWN return value, the Facade's own return value, and `initializeCrypto()`'s Facade-level return value are unchanged; Runtime's `initializeCrypto()` return value is unaffected; ONLY the Backend Abstraction calls WASM Backend Planning — `create_runtime.ts`/`src/worker.ts`/the Facade never reference it directly; `WebAssembly.instantiate`/`compile` and `fetch` are never invoked exercising the full surface; Worker remains fully unconnected, including to WASM Backend Planning; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Active"`/`"Ready"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record the required facts. Six pre-existing tests are updated for the now-known forty `fedos_*.ts` files (`fedos_wasm_backend.ts` added) and the two exact-diagnostics-snapshot tests gain the five new fields — the ONLY changes in each. Stage 743 is this README update, moving "you are here" to this checkpoint. Stage 744 verification: `npm run typecheck` clean; `npm test` green (211 files / 3226 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted as the final step; `git status --short` clean after commit. **Still true throughout Stage 729–744**: no direct WASM Backend Planning call from anywhere but the Backend Abstraction; Runtime never learns loader detail; `src/worker.ts` UNMODIFIED and never references `initializeCrypto`/the Facade/the Backend Abstraction/WASM Backend Planning; `worker_crypto_diagnostics.ts` UNTOUCHED; no real WASM Loader connection; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`/`initSync`/default-init reference; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/`"Active"`/`"Ready"` never reached; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

745–760. "Prototype Phase 005: Crypto Backend Interface — a common, backend-agnostic contract inserted between the Backend Abstraction and WASM Backend Planning; Rust still owns crypto only, Runtime never learns interface detail" ([`docs/runtime_crypto_backend_interface.md`](docs/runtime_crypto_backend_interface.md), [`src/runtime/fedos_crypto_backend_interface.ts`](src/runtime/fedos_crypto_backend_interface.ts), [`src/runtime/fedos_crypto_loader_backend.ts`](src/runtime/fedos_crypto_loader_backend.ts), [`src/runtime/runtime_crypto_diagnostics.ts`](src/runtime/runtime_crypto_diagnostics.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). INSERTS a new seam BETWEEN the Prototype Phase 004 chain's two existing links (Stage 729–744, Backend Abstraction→WASM Backend Planning directly) rather than extending past WASM Backend Planning: `Runtime → initializeCrypto() → Crypto Loader Facade → Crypto Loader Backend Abstraction → Backend Interface → WASM Backend Planning → STOP`. New `docs/runtime_crypto_backend_interface.md` (Stage 745) names a common, backend-agnostic CONTRACT that lets the Backend Abstraction eventually talk to WASM/Native/Python candidates through the SAME shape instead of ever branching on `backendKind`, fixes the SAME Rust/Runtime/Facade/Backend-Abstraction division of responsibility one link further down, and reuses `FedosCryptoLoaderBackendKind`'s own value set for `backendSelected`. New `src/runtime/fedos_crypto_backend_interface.ts` (Stage 746) adds `FedosCryptoBackendInterfaceState`/`FedosCryptoBackendInterfaceReason`/`FedosCryptoBackendInterface` plus `createCryptoBackendInterface()` (ALWAYS fixed `{ state: "PlanningOnly", backendSelected: "WasmPlanned", backendActivated: false, interfaceReady: false, reason: "BackendInterfacePending" }`) and five standalone accessors — this file ALSO calls `createWasmBackend()` (`fedos_wasm_backend.ts`, Stage 730, UNMODIFIED by this stage) and discards the result, becoming its new sole caller. `src/runtime/fedos_crypto_loader_backend.ts` (Stage 753) REPLACES its Stage 737 direct wire to `createWasmBackend()` with a call to `createCryptoBackendInterface()` instead — the Interface's result is discarded, and the Backend Abstraction's own return value, the Facade's own return value, `initializeCrypto()`'s own Facade-level return value, AND Runtime's own `AppRuntime.initializeCrypto()` return value all stay byte-for-byte unchanged (`{ allowed: false, initialized: false, reason: "PrototypeDisabled" }` at the Runtime level); `fedos_wasm_backend.ts`'s own fixed answer is UNCHANGED, just reached one link further down now. This is the ONLY caller of `fedos_crypto_backend_interface.ts` anywhere in the repository — neither `create_runtime.ts`, `src/worker.ts`, nor `fedos_crypto_loader_facade.ts` references it directly. `src/runtime/runtime_crypto_diagnostics.ts` (Stage 757) adds `cryptoBackendInterfaceState`/`cryptoBackendInterfaceReady`/`cryptoBackendSelected`/`cryptoBackendActivated`/`cryptoBackendInterfaceReason` (fixed `"PlanningOnly"`/`false`/`"WasmPlanned"`/`false`/`"BackendInterfacePending"`) to `RuntimeCryptoActivationStatus`/`runtimeCryptoActivationStatus()` — `worker_crypto_diagnostics.ts` is intentionally NOT touched. `docs/runtime_internal_execution_contract.md` (Stage 758) adds a new "Prototype Phase 005" update section revising the Stage 729–744 diagram to insert the Backend Interface, and explicitly records Worker as OUT OF SCOPE for the entire arc. New `test/runtime_crypto_backend_interface.test.ts` (Stage 745–756, 16 tests) and existing-suite updates guard: the fixed Backend Interface value never changes, including across repeated calls; diagnostics match, and Worker diagnostics carry NONE of the five new fields; the Backend Interface source never writes `import()`/`require()`/`WebAssembly`/`fetch`/`initSync`/`__wbg_init` and never references Runtime/Worker/the real WASM Loader/the generated JS glue/the Facade, and calls nothing further past WASM Backend Planning (true terminus for the Abstraction's own reach); the Backend Abstraction no longer references `fedos_wasm_backend.ts` in its own code (only historical doc-comment prose does) and now legitimately reaches the Backend Interface instead; Runtime's `initializeCrypto()` return value is unaffected; ONLY the Backend Abstraction calls the Backend Interface, and ONLY the Backend Interface calls WASM Backend Planning — `create_runtime.ts`/`src/worker.ts`/the Facade never reference either directly; `WebAssembly.instantiate`/`compile` and `fetch` are never invoked exercising the full surface; Worker remains fully unconnected, including to the Backend Interface; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Active"`/`"Ready"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record the required facts. `test/runtime_wasm_backend.test.ts`'s own tests #4/#6 are updated in place to reflect that the Backend Abstraction no longer directly calls `createWasmBackend()` — the ONLY changes in that file. Six other pre-existing tests are updated for the now-known forty-one `fedos_*.ts` files (`fedos_crypto_backend_interface.ts` added) and the two exact-diagnostics-snapshot tests gain the five new fields — the ONLY changes in each. Stage 759 is this README update, moving "you are here" to this checkpoint. Stage 760 verification: `npm run typecheck` clean; `npm test` green (212 files / 3242 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted as the final step; `git status --short` clean after commit. **Still true throughout Stage 745–760**: no direct Backend Interface call from anywhere but the Backend Abstraction; no direct WASM Backend Planning call from anywhere but the Backend Interface; Runtime never learns interface or loader detail; `src/worker.ts` UNMODIFIED and never references `initializeCrypto`/the Facade/the Backend Abstraction/the Backend Interface/WASM Backend Planning; `worker_crypto_diagnostics.ts` UNTOUCHED; no real WASM Loader connection; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`/`initSync`/default-init reference; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59 unimplemented; `"Allowed"`/`"Active"`/`"Ready"` never reached; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

761. "FedOS Runtime Positioning — Secure Runtime Platform, desktop-first, not an OS replacement" ([`docs/fedos_runtime_positioning.md`](docs/fedos_runtime_positioning.md), [`docs/runtime_crypto_backend_interface.md`](docs/runtime_crypto_backend_interface.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/runtime_crypto_backend_interface.test.ts`](test/runtime_crypto_backend_interface.test.ts)). A SCOPE/POSITIONING addition on top of the already-complete Prototype Phase 005 (Stage 745–760) — no code, no fixed value, and no diagnostics field changes; it fixes, in writing, what "FedOS" names in this repository before any further Backend Interface work builds on it. New `docs/fedos_runtime_positioning.md` states plainly that FedOS is NOT a Tails/Whonix-style OS replacement, but a desktop-first **Secure Runtime Platform** that runs on top of an existing, already-installed OS; names Mobile, Worker, and production activation as explicitly OUT OF SCOPE (not merely deprioritized); fixes the cross-language division — Rust owns cryptography/keys/signatures/safety boundaries only, TypeScript owns runtime glue/UI/orchestration, and Python is named as a FUTURE, unimplemented candidate for experimentation/EMSR/Ontology work (`"PythonPlanned"`, already named in `fedos_crypto_loader_backend.ts`/`fedos_crypto_backend_interface.ts`, never implemented); and restates, without changing, that Runtime never learns backend detail past the Facade→Backend Abstraction→Backend Interface→WASM Backend Planning chain. `docs/runtime_crypto_backend_interface.md` and `docs/runtime_internal_execution_contract.md` each gain a short cross-reference to this positioning document — no diagram, fixed value, or "Still true" guarantee in either file is altered. New test #17 in `test/runtime_crypto_backend_interface.test.ts` (17 tests total in that file now) guards: the positioning doc exists and states Secure Runtime Platform/desktop-first/Tails/Whonix/not-an-OS-replacement/Mobile/Worker/Production-out-of-scope/all three backend candidates/EMSR/Ontology; the doc itself writes no `import()`/`WebAssembly.instantiate`/`compile` (it is prose, not code); and the Backend Interface doc legitimately cross-references it by filename. Verification: `npm run typecheck` clean; `npm test` green (212 files / 3243 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind; no real backend created, selected, or activated; no `WebAssembly.instantiate`/`compile`/`initSync`/default-init reference; no static or dynamic `import()` of the generated JS glue; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59 unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

762–776. "Prototype Phase 006: Crypto Backend Resolver — a pure leaf answering ONLY 'which backend is planned', added as a second, separate reach below the Backend Interface; Rust still owns crypto only, Runtime never learns resolver detail" ([`docs/runtime_crypto_backend_resolver.md`](docs/runtime_crypto_backend_resolver.md), [`src/runtime/fedos_crypto_backend_resolver.ts`](src/runtime/fedos_crypto_backend_resolver.ts), [`src/runtime/fedos_crypto_backend_interface.ts`](src/runtime/fedos_crypto_backend_interface.ts), [`src/runtime/runtime_crypto_diagnostics.ts`](src/runtime/runtime_crypto_diagnostics.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). ADDS a new leaf below the Backend Interface as a SECOND, separate reach — NOT replacing the Interface's pre-existing reach into WASM Backend Planning (Stage 746) — the FIRST branching point in the Prototype Phase arc: `Runtime → initializeCrypto() → Crypto Loader Facade → Crypto Loader Backend Abstraction → Backend Interface → { WASM Backend Planning, Backend Resolver } → STOP`. New `docs/runtime_crypto_backend_resolver.md` (Stage 762) names a seam that answers "which backend is planned" as a concern SEPARATE from "is it ready to load", splitting `backendResolved` (has a decision been made) from `backendAvailable` (could that decision's target actually be loaded) — mirroring the same decision-vs-readiness split the Backend Abstraction and Backend Interface docs already used one and two levels up. New `src/runtime/fedos_crypto_backend_resolver.ts` (Stage 763) adds `FedosCryptoBackendResolverState`/`FedosCryptoBackendResolverReason`/`FedosCryptoBackendResolver` plus `createCryptoBackendResolver()` (ALWAYS fixed `{ state: "PlanningOnly", selectedBackend: "WasmPlanned", backendResolved: false, backendAvailable: false, reason: "BackendResolutionPending" }`) and five standalone accessors — a TERMINUS: it calls nothing further, matching the diagram's own `STOP`. `src/runtime/fedos_crypto_backend_interface.ts` (Stage 764) adds a SECOND, separate `reachCryptoBackendResolver()` call inside `createCryptoBackendInterface()` (alongside its pre-existing `reachWasmBackend()` call) — mirroring the SAME pattern `fedos_crypto_loader_facade.ts` already established for `reachProviderFacadeBoundary()`/`reachCryptoLoaderBackend()` (Stage 594/721); the Resolver's result is discarded, and the Interface's own return value, the Backend Abstraction's own return value, the Facade's own return value, AND Runtime's own `AppRuntime.initializeCrypto()` return value all stay byte-for-byte unchanged (`{ allowed: false, initialized: false, reason: "PrototypeDisabled" }` at the Runtime level); `fedos_wasm_backend.ts`'s own fixed answer is completely untouched. This is the ONLY caller of `fedos_crypto_backend_resolver.ts` anywhere in the repository — neither `create_runtime.ts`, `src/worker.ts`, `fedos_crypto_loader_facade.ts`, nor `fedos_crypto_loader_backend.ts` references it directly. `src/runtime/runtime_crypto_diagnostics.ts` (Stage 774) adds `cryptoBackendResolverState`/`cryptoBackendResolverSelected`/`cryptoBackendResolved`/`cryptoBackendAvailable`/`cryptoBackendResolverReason` (fixed `"PlanningOnly"`/`"WasmPlanned"`/`false`/`false`/`"BackendResolutionPending"`) to `RuntimeCryptoActivationStatus`/`runtimeCryptoActivationStatus()` — `worker_crypto_diagnostics.ts` is intentionally NOT touched. `docs/runtime_internal_execution_contract.md` (Stage 774) adds a new "Prototype Phase 006" update section with a BRANCHING diagram — the Interface's two independent leaves, WASM Backend Planning (unchanged) and Backend Resolver (new) — and explicitly records Worker as OUT OF SCOPE for the entire arc. `docs/runtime_crypto_backend_interface.md` gains a short cross-reference note on the second reach, without altering any of its own fixed values. New `test/runtime_crypto_backend_resolver.test.ts` (Stage 762–773, 15 tests) and existing-suite updates guard: the fixed Backend Resolver value never changes, including across repeated calls; diagnostics match, and Worker diagnostics carry NONE of the five new fields; the Backend Resolver source never writes `import()`/`require()`/`WebAssembly`/`fetch`/`initSync`/`__wbg_init` and never references Runtime/Worker/the real WASM Loader/the generated JS glue/the Interface/WASM Backend Planning, and calls nothing further (true terminus); the Backend Interface legitimately reaches the Resolver as a second, separate leaf while its pre-existing reach into WASM Backend Planning (and that layer's own fixed answer) stays completely unaffected; the Backend Abstraction, Facade, and Runtime return values are all unaffected; ONLY the Backend Interface calls the Resolver — `create_runtime.ts`/`src/worker.ts`/the Facade/the Backend Abstraction never reference it directly; `WebAssembly.instantiate`/`compile` and `fetch` are never invoked exercising the full surface; Worker remains fully unconnected, including to the Resolver; `encrypt`/`decrypt` unchanged and no NIP-17/NIP-44/NIP-59/Double Ratchet/Triple Ratchet reference exists anywhere in the Resolver source; `"Allowed"`/`"Active"`/`"Resolved"`/`"Available"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record the required facts. Six pre-existing tests are updated for the now-known forty-two `fedos_*.ts` files (`fedos_crypto_backend_resolver.ts` added) and the two exact-diagnostics-snapshot tests gain the five new fields — the ONLY changes in each. Stage 775 is this README update, moving "you are here" to this checkpoint. Stage 776 verification: `npm run typecheck` clean; `npm test` green (213 files / 3258 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true throughout Stage 762–776**: no direct Backend Resolver call from anywhere but the Backend Interface; Runtime never learns interface or resolver detail; `src/worker.ts` UNMODIFIED and never references `initializeCrypto`/the Facade/the Backend Abstraction/the Backend Interface/the Backend Resolver/WASM Backend Planning; `worker_crypto_diagnostics.ts` UNTOUCHED; no real WASM Loader connection; no `WebAssembly.instantiate`/`compile`/`instantiateStreaming`/`initSync`/default-init reference; no static `import` and no dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged, in Rust or TypeScript; NIP-17/NIP-44/NIP-59, Double Ratchet, and Triple Ratchet unimplemented; `"Allowed"`/`"Active"`/`"Resolved"`/`"Available"` never reached; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

793–808. "Prototype Phase 008: WASM Backend Planning reaches the real FedosWasmLoader — planLoad() actually called, BlockedByPolicy, a pre-existing call-graph cycle discovered and fixed" ([`src/runtime/fedos_wasm_backend.ts`](src/runtime/fedos_wasm_backend.ts), [`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`src/runtime/fedos_explicit_crypto_initialization.ts`](src/runtime/fedos_explicit_crypto_initialization.ts), [`src/runtime/runtime_crypto_diagnostics.ts`](src/runtime/runtime_crypto_diagnostics.ts), [`docs/runtime_wasm_backend_planning.md`](docs/runtime_wasm_backend_planning.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). The FIRST real connection from the Prototype Phase arc to a previously-"unwired" file: `Runtime → initializeCrypto() → Crypto Loader Facade → Crypto Loader Backend Abstraction → Backend Interface → WASM Backend Planning → FedosWasmLoader.planLoad() → BlockedByPolicy → STOP`. `src/runtime/fedos_wasm_backend.ts`'s `createWasmBackend()` (Stage 793) now constructs a `FedosWasmLoader` (`fedos_wasm_loader.ts`, Stage 489–492) and calls its `planLoad()` — DISCARDING the `{ operation: "load", state: "BlockedByPolicy", policy: "FailClosed", reason: "..." }` result and keeping its OWN return value byte-for-byte unchanged (`{ state: "PlanningOnly", backendReady: false, loaderAttached: false, loaderKind: "WasmLoaderPlanned", reason: "WasmBackendPlanningPending" }`). **Implementing this exposed a genuine pre-existing bug**: `planLoad()`'s own internal chain (the WASM Loader Activation arc, 13 files) terminates at `fedos_dynamic_loader_dev_approval.ts` calling `fedos_explicit_crypto_initialization.ts`, which — since Stage 595 — ALSO called `createCryptoLoaderFacade()`. That reach was harmless as long as nothing upstream of the Facade ever called back down into that arc; connecting `fedos_wasm_backend.ts` (reachable FROM the Facade) to `planLoad()` closed the loop into a cycle (Facade → Backend → Interface → WASM Backend → WASM Loader → … → Explicit Crypto Initialization → Facade → …), causing unbounded recursion and a stack overflow on every call to `createCryptoLoaderFacade()`/`AppRuntime.initializeCrypto()`. Caught before any commit via the new test suite; user confirmed the fix — **Stage 793 REMOVES the Stage 595 reach**: `fedos_explicit_crypto_initialization.ts` no longer imports or calls `fedos_crypto_loader_facade.ts`, and is now a TERMINUS calling nothing further, exactly as `docs/runtime_internal_execution_contract.md`'s own Stage 585–589 target diagram always depicted it (that diagram never showed the Stage 595 reach to begin with). `createExplicitCryptoInitialization()`'s own return value is unchanged. `src/runtime/runtime_crypto_diagnostics.ts` (Stage 793) adds `wasmBackendLoaderReached`/`wasmBackendLoaderLoaded`/`wasmBackendLoaderDecision` (fixed `true`/`false`/`"BlockedByPolicy"`) to `RuntimeCryptoActivationStatus`/`runtimeCryptoActivationStatus()` — `worker_crypto_diagnostics.ts` is intentionally NOT touched. `docs/runtime_wasm_backend_planning.md` gains a new §6 ("Loader reached, still blocked") and `docs/runtime_internal_execution_contract.md` gains a new "Prototype Phase 008" update section documenting both the real Loader connection AND the discovered-and-fixed cycle, plus a historical correction to its own Stage 593–597 section. New `test/runtime_wasm_backend_loader_connection.test.ts` (16 tests) and existing-suite updates guard: `FedosWasmLoaderSkeleton.planLoad()` is actually invoked (verified via spy) and its result discarded; `createWasmBackend()`'s own fixed value is unchanged, including across repeated calls; the new standalone accessors report reached/not-loaded/BlockedByPolicy; the real Loader's own behavior is completely unchanged; the FULL reach chain (Runtime→Facade→Backend→Interface→WasmBackend→WasmLoader) terminates normally with NO stack overflow, and `fedos_explicit_crypto_initialization.ts`'s source no longer references the Facade; diagnostics match and Worker diagnostics carry NONE of the three new fields; the WASM Backend source legitimately reaches only `fedos_wasm_loader.ts` itself (never `fedos_wasm_loader_plan.ts`/`fedos_wasm_loader_contract.ts` directly, never the generated JS glue, `WebAssembly`, or Rust); `WebAssembly.instantiate`/`compile` and `fetch` are never invoked exercising the full chain through the real Loader; Runtime/Worker remain fully unconnected to it; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Loaded"`/`"Active"` unreachable anywhere in the chain; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; both docs record the required facts. One pre-existing test (`test/runtime_wasm_backend.test.ts` #3) is updated in place to reflect that `fedos_wasm_backend.ts` now legitimately references `fedos_wasm_loader.ts` (previously forbidden, now Stage 793's own real wiring) while still never touching its downstream files directly — the ONLY change in that file. Two exact-diagnostics-snapshot tests gain the three new fields. Verification: `npm run typecheck` clean; `npm test` green (217 files / 3315 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind (`create_runtime.ts`/`src/worker.ts` reference neither `fedos_wasm_backend.ts` nor `fedos_wasm_loader.ts`); the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached (`planLoad()` stops at its own internal Loader Plan); no static or dynamic `import()` of the generated JS glue; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

809–817. "Prototype Phase 009–010: FedosWasmLoader gains a Loader State reader (`planningState()`) and a Loader Policy reader (`policy()`), both independent of `planLoad()`, no cycle" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`src/runtime/runtime_crypto_diagnostics.ts`](src/runtime/runtime_crypto_diagnostics.ts), [`test/`](test/)). Two back-to-back additions to the previously-489–492 Loader Skeleton, neither extending the real call chain past `FedosWasmLoader` itself — both are NEW, independent readers of the SAME fixed design, never calling `planLoad()` or each other. Stage 809 adds `planningState()` (fixed `{ state: "Planning", decision: "BlockedByPolicy", loaded: false }`, plus standalone `loaderPlanningState()`/`loaderPlanningDecision()`/`loaderLoaded()`) — separately named from the pre-existing, pinned `status()` to avoid colliding with its own `{ state, mode, policy, reason }` shape. Stage 817 adds `policy()` (fixed `{ allowed: false, decision: "BlockedByPolicy", reason: "PrototypePolicy" }`, plus standalone `loaderPolicyAllowed()`/`loaderPolicyDecision()`/`loaderPolicyReason()`) — separately named from the pre-existing, pinned standalone `loaderPolicy()` function (Stage 489, returns the bare label `"FailClosed"`) to avoid colliding with it. `src/runtime/runtime_crypto_diagnostics.ts` adds all six new fields to `RuntimeCryptoActivationStatus`/`runtimeCryptoActivationStatus()` for DISPLAY only — `worker_crypto_diagnostics.ts` is intentionally NOT touched by either stage. `planLoad()`'s own return value is byte-for-byte unchanged by both stages. New `test/runtime_wasm_loader_state.test.ts` (Stage 809, 12 tests) and `test/runtime_wasm_loader_policy.test.ts` (Stage 817, 14 tests) guard: both readers are always fixed constants; no cycle exists with `planLoad()` in either direction (verified via spy); `planLoad()`'s return value is unaffected; diagnostics match and Worker diagnostics carry none of the new fields; no `WebAssembly`/generated-JS-glue/Rust reference of any kind; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Active"`/`"Loaded"` unreachable. Two pre-existing exact-diagnostics-snapshot tests gain the six new fields across both stages. **Still true**: no Runtime/Worker connection change of any kind; the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`, and Rust remain completely unreached; no static or dynamic `import()` of the generated JS glue; `encrypt`/`decrypt` unchanged; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

825–840. "Prototype Phase 011: `FedosWasmLoader.planLoad()` reaches `policy()` — a read, not an obedience; result discarded, `planLoad()`'s own return value byte-for-byte unchanged" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`src/runtime/runtime_crypto_diagnostics.ts`](src/runtime/runtime_crypto_diagnostics.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Extends the Stage 817 Loader Policy reader (Phase 010) with a REAL, one-directional function call from `planLoad()` into `policy()` — `Runtime → initializeCrypto() → Crypto Loader Facade → Crypto Loader Backend Abstraction → Backend Interface → WASM Backend Planning → FedosWasmLoader.planLoad() → { FedosWasmLoaderPlan.planImport(), FedosWasmLoader.policy() } → BlockedByPolicy → STOP` — with the `STOP` left at EXACTLY the position the Stage 793 diagram already placed it; `policy()` is a new, parallel leaf `planLoad()` reaches, not an extension of the main chain past `BlockedByPolicy`. `src/runtime/fedos_wasm_loader.ts` (Stage 825) adds a PRIVATE `#reachLoaderPolicy()` helper — mirroring the pre-existing `#reachLoaderPlan()`'s own "reach one link deeper, discard the result" pattern (Stage 503) — that `planLoad()` now calls alongside `#reachLoaderPlan()`; the Policy answer (`{ allowed: false, decision: "BlockedByPolicy", reason: "PrototypePolicy" }`) is DISCARDED in full, never merged into `planLoad()`'s own `{ operation: "load", state: "BlockedByPolicy", policy: "FailClosed", reason: "..." }` return object, and never branched on — `planLoad()` was already fixed at `"BlockedByPolicy"` before this stage and stays fixed at `"BlockedByPolicy"` after it, for the same fail-closed reason as always, not because `policy()` told it to stop. `policy()` itself is UNCHANGED and still does not call `planLoad()`/`planningState()`/`status()`, so the new reach is strictly one-directional and no cycle exists. A new standalone accessor, `loaderPlanReachedPolicy()` (fixed `true`), lets diagnostics report the connection without constructing a `FedosWasmLoader` instance. `src/runtime/runtime_crypto_diagnostics.ts` (Stage 825) adds `loaderPlanReachedPolicy` (fixed `true`) to `RuntimeCryptoActivationStatus`/`runtimeCryptoActivationStatus()` — the pre-existing `loaderPolicyAllowed`/`loaderPolicyDecision`/`loaderPolicyReason` fields (Stage 817) are UNCHANGED, and `worker_crypto_diagnostics.ts` is intentionally NOT touched. `docs/runtime_internal_execution_contract.md` gains a new "Prototype Phase 011" update section diagramming the new `planLoad() -> policy()` reach without moving the pre-existing `STOP`. New `test/runtime_wasm_loader_plan_policy_connection.test.ts` (17 tests) guards: `planLoad()` calls `policy()` exactly once per call (verified via spy); `planLoad()`'s own return value is byte-for-byte unchanged, with exactly its own four keys — nothing from `policy()`'s shape merged in; Runtime/Facade/Backend Abstraction/Backend Interface/Backend Resolver return values are all unaffected; `planningState()`/`status()` are not interfered with by the new reach (neither is called by `planLoad()`, verified via spy); Worker remains fully unconnected, including `workerCryptoActivationStatus()` carrying none of the new field; `WebAssembly.instantiate`/`compile` and `fetch` are never invoked exercising the full reach chain; no Rust reference in the Loader source and Rust public API unchanged (27 `pub fn`, none `#[wasm_bindgen]`-annotated); no cycle exists (`policy()` never calls `planLoad()`, in either direction); diagnostics report `loaderPlanReachedPolicy: true`; `encrypt`/`decrypt` unchanged. Verification: `npm run typecheck` clean; `npm test` green; `cargo check` (native) green; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind (`create_runtime.ts`/`src/worker.ts` reference neither `policy()` nor `planLoad()` directly); the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached; no static or dynamic `import()` of the generated JS glue; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

833–848. "Prototype Phase 012: `FedosWasmLoader.planLoad()` EVALUATES `policy()` — a genuine `if (!policy.allowed)` branch, still always `BlockedByPolicy`, still `STOP`" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`src/runtime/runtime_crypto_diagnostics.ts`](src/runtime/runtime_crypto_diagnostics.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Extends the Stage 825 reach (Phase 011, which called `policy()` and discarded the answer) with a real EVALUATION of it: `Runtime → initializeCrypto() → Crypto Loader Facade → Crypto Loader Backend Abstraction → Backend Interface → WASM Backend Planning → FedosWasmLoader.planLoad() → policy() → Policy Evaluation → BlockedByPolicy → STOP` — the `STOP` left at EXACTLY the position the Stage 793/825 diagrams already placed it; this stage does NOT proceed to Load, Import, WebAssembly, or Rust. `src/runtime/fedos_wasm_loader.ts` (Stage 833) changes `#reachLoaderPolicy()` to RETURN the `FedosWasmLoaderPolicyDecision` it reads (previously discarded in full), and `planLoad()` now branches on it — `if (!policy.allowed) { return this.#blocked("load"); }` — followed by ONE reserved TODO comment marking the (never-implemented) `allowed: true` path for a future, separate, explicitly-reviewed stage, then the SAME `return this.#blocked("load")` as a fail-closed fallback. Because `policy().allowed` is fixed `false` in every stage that exists today, the branch is ALWAYS taken and `planLoad()`'s own return value — `{ operation: "load", state: "BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key order included — stays byte-for-byte unchanged; `policy()` itself, `planInitialize()`/`planUnload()`/`planningState()`/`status()`, and every upstream layer (`fedos_wasm_backend.ts`, Backend Interface, Backend Abstraction, Backend Resolver, the Facade, `AppRuntime.initializeCrypto()`) are all untouched, and no cycle exists (`policy()` still never calls `planLoad()`). A new standalone accessor, `loaderPolicyEvaluated()` (fixed `true`), lets diagnostics report the evaluation without constructing a `FedosWasmLoader` instance. `src/runtime/runtime_crypto_diagnostics.ts` (Stage 833) adds `loaderPolicyEvaluated` (fixed `true`) to `RuntimeCryptoActivationStatus`/`runtimeCryptoActivationStatus()` — every pre-existing field, including `loaderPlanReachedPolicy` (Stage 825), is UNCHANGED, and `worker_crypto_diagnostics.ts` is intentionally NOT touched. `docs/runtime_internal_execution_contract.md` gains a new "Prototype Phase 012" update section diagramming `planLoad() -> policy() -> Policy Evaluation -> BlockedByPolicy -> STOP`, explicitly noting the chain still does NOT proceed to Load/Import/WebAssembly/Rust. New `test/runtime_wasm_loader_policy_evaluation.test.ts` (20 tests) guards: `planLoad()` calls `policy()` exactly once per call; `policy().allowed` is genuinely evaluated (fixed `false`); the allowed:false branch always reaches `BlockedByPolicy`, repeatably; the allowed:true (else) path is structurally unreachable since `policy()` is a hand-fixed constant; `planLoad()`'s own return value is byte-for-byte unchanged with exactly its own four keys in order — nothing from `policy()`'s shape merged in; `planningState()`/`status()` are not interfered with; Runtime/Facade/Backend Abstraction/Backend Interface/Backend Resolver return values are all unaffected; Worker remains fully unconnected, including `workerCryptoActivationStatus()` carrying neither new field; `WebAssembly.instantiate`/`compile` and `fetch` are never invoked exercising the full evaluation chain; no Rust reference in the Loader source and Rust public API unchanged (27 `pub fn`, none `#[wasm_bindgen]`-annotated); no cycle exists; diagnostics report `loaderPolicyEvaluated: true`; `encrypt`/`decrypt` unchanged. The pre-existing Stage 825 guard test (`test/runtime_wasm_loader_plan_policy_connection.test.ts`) needed no change — it only asserted `policy()` is called once per `planLoad()` call, which remains true. Two pre-existing exact-diagnostics-snapshot tests gain the one new field. Verification: `npm run typecheck` clean; `npm test` green (221 files / 3378 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind (`create_runtime.ts`/`src/worker.ts` reference neither `policy()` nor `planLoad()` directly); the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached; no static or dynamic `import()` of the generated JS glue; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

841–856. "Prototype Phase 013: `FedosWasmLoader.planLoad()` builds an internal LOAD PLAN object (`#createLoadPlan()`) and confirms it, still always `BlockedByPolicy`, still `STOP`" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`src/runtime/runtime_crypto_diagnostics.ts`](src/runtime/runtime_crypto_diagnostics.ts), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Extends the Stage 833 Policy Evaluation (Phase 012) with one more internal step: `Runtime → initializeCrypto() → Crypto Loader Facade → Crypto Loader Backend Abstraction → Backend Interface → WASM Backend Planning → FedosWasmLoader.planLoad() → policy() → Policy Evaluation → Load Plan → BlockedByPolicy → STOP` — the `STOP` left at EXACTLY the position the Stage 793/825/833 diagrams already placed it; this stage does NOT proceed to Load, Import, WebAssembly, or Rust. `src/runtime/fedos_wasm_loader.ts` (Stage 841) adds a NEW, internal-only type, `FedosWasmLoaderLoadPlan` (`{ allowed: false, shouldLoad: false, backend: "Wasm", reason: "BlockedByPolicy" }`, its four fields typed with LITERAL `false`/`"Wasm"`/`"BlockedByPolicy"` values, not `boolean`/`string` — this Prototype stage can never construct any other value by the type system's own construction), built by a new PRIVATE `#createLoadPlan()` method (no argument, no `this.policy()` call — `policy()` still runs exactly ONCE per `planLoad()` call, inside the pre-existing `#reachLoaderPolicy()`, unchanged since Stage 833). `planLoad()`'s flow is now: (1) `policy()` via `#reachLoaderPolicy()`, (2) evaluate `policy.allowed` (`if (!policy.allowed)`, ALWAYS taken), (3) build the Load Plan via `#createLoadPlan()`, (4) confirm `loadPlan.shouldLoad` (`if (!loadPlan.shouldLoad)`, a SECOND, independent check, ALSO always taken), (5) return the SAME `#blocked("load")` answer as every prior stage. `planLoad()`'s own return value — `{ operation: "load", state: "BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key order included — stays byte-for-byte unchanged; the Load Plan's OWN fields are NEVER merged into it, and it is never part of the public `FedosWasmLoader` interface or returned to any caller. The `shouldLoad: true` path (like `policy.allowed: true` one level up) is a single reserved TODO comment, immediately followed by the SAME fail-closed fallback. `policy()` itself, `planInitialize()`/`planUnload()`/`planningState()`/`status()`, and every upstream layer are UNCHANGED, and no cycle exists — `#createLoadPlan()` calls nothing at all. Four new standalone accessors, `loaderLoadPlanCreated()`/`loaderLoadPlanAllowed()`/`loaderLoadPlanShouldLoad()`/`loaderLoadPlanBackend()` (fixed `true`/`false`/`false`/`"Wasm"`), let diagnostics report the Load Plan without constructing a `FedosWasmLoader` instance. `src/runtime/runtime_crypto_diagnostics.ts` (Stage 841) adds all four to `RuntimeCryptoActivationStatus`/`runtimeCryptoActivationStatus()` — every pre-existing field is UNCHANGED, and `worker_crypto_diagnostics.ts` is intentionally NOT touched. `docs/runtime_internal_execution_contract.md` gains a new "Prototype Phase 013" update section diagramming `planLoad() -> policy() -> Policy Evaluation -> Load Plan -> BlockedByPolicy -> STOP`, explicitly noting the chain still does NOT proceed to Load/Import/WebAssembly/Rust. New `test/runtime_wasm_loader_load_plan.test.ts` (22 tests) guards: a Load Plan is generated every `planLoad()` call; `allowed`/`shouldLoad`/`backend`/`reason` are fixed `false`/`false`/`"Wasm"`/`"BlockedByPolicy"`; `planLoad()`'s own return value is byte-for-byte unchanged with exactly its own four keys in order — nothing from the Load Plan's shape merged in; `policy()` is still called exactly once per `planLoad()` call, even with the new Load Plan step; `planningState()`/`status()` are not interfered with; Runtime/Facade/Backend Abstraction/Backend Interface/Backend Resolver return values are all unaffected; Worker remains fully unconnected, including `workerCryptoActivationStatus()` carrying none of the four new fields; `WebAssembly.instantiate`/`compile` and `fetch` are never invoked exercising the full Load Plan chain; no Rust reference in the Loader source and Rust public API unchanged (27 `pub fn`, none `#[wasm_bindgen]`-annotated); no cycle exists; no new public `load()`/`initialize()` member added; diagnostics report all four Load Plan fields. Two pre-existing exact-diagnostics-snapshot tests gain the four new fields. Verification: `npm run typecheck` clean; `npm test` green; `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind (`create_runtime.ts`/`src/worker.ts` reference neither the Load Plan, `policy()`, nor `planLoad()` directly); the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached; no static or dynamic `import()` of the generated JS glue; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

857. "Prototype Phase 014: WASM Loader Activation Readiness Review — a review-only checkpoint before any real WASM/Generated-JS-Glue connection" ([`docs/runtime_wasm_loader_activation_readiness_review.md`](docs/runtime_wasm_loader_activation_readiness_review.md), [`test/runtime_wasm_loader_activation_readiness_review.test.ts`](test/runtime_wasm_loader_activation_readiness_review.test.ts)). A REVIEW-ONLY checkpoint, no code change of any kind — no new `PlanningOnly` layer, no diagnostics field, no `src/runtime` change, no load. New `docs/runtime_wasm_loader_activation_readiness_review.md` documents (1) the current REAL reach chain now that Stage 841 landed — `Runtime → initializeCrypto() → Crypto Loader Facade → Crypto Loader Backend → Crypto Backend Interface → Crypto Backend Resolver → WASM Backend → FedosWasmLoader.planLoad() → policy() → Load Plan → BlockedByPolicy → STOP`, plus the discarded `FedosWasmLoaderPlan.planImport()` side-reach; (2) the NINE layers a future real connection would still need unchanged in role (Runtime `initializeCrypto()`, Crypto Loader Facade, Crypto Loader Backend, Crypto Backend Interface, Crypto Backend Resolver, WASM Backend, `FedosWasmLoader`, `policy()`, Load Plan); (3) consolidation candidates across three categories — the prior Chain 2 (10 files) and Chain 4 (13 files) Planning-review families (`docs/runtime_initialize_crypto_planning_review.md`/`docs/runtime_architecture_simplification_review.md`), docs-only candidates already flagged **B** (`fedos_wasm_loader_contract.ts`/`fedos_wasm_toolchain.ts`/`fedos_wasm_artifact.ts`/`fedos_generated_artifact_distribution.ts`), and the eleven remaining WASM Loader Activation arc files still structurally unreached from the Minimum Runtime Chain even after Stage 841 — plus a named FINDING that `docs/runtime_architecture_simplification_review.md`'s own Chain 3 "disconnected island" classification and `docs/runtime_minimum_runtime_chain.md`'s own `(future) WASM Loader` label are now partially stale as of Stage 793, flagged but NOT corrected by this review (out of scope for a review-only stage); (4) the next real connection candidates, in order — `FedosWasmLoader.planLoad() → JS Glue access plan → generated artifact check → dev-only gate → import()` — each named as its OWN future, separate, explicitly-reviewed stage, with `import()` explicitly still several stages out; (5) five Fail Closed conditions binding on every future stage (never load while `policy.allowed === false`; never load without confirming the generated artifact; never load from Worker; never load in Production; import failure must Fail Closed, never Fail Open); and (6) explicit prohibitions restated for this stage — no `import()`, `WebAssembly`, `initSync`, Rust call, NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, or onion routing. New `test/runtime_wasm_loader_activation_readiness_review.test.ts` (18 tests) guards: the review doc exists and is substantial; the reach chain is documented in the correct order (checked within its own diagram, not the whole doc, since the intro prose mentions terms out of sequence); all nine layers-to-keep are named; all three consolidation-candidate categories are named with cross-references to the prior reviews; the next-connection-candidate order is correct within its own diagram; all five Fail Closed conditions are stated; all six prohibited items are explicitly named; the doc never writes real `import()`/`WebAssembly` CODE (prose only); no file is claimed deleted/merged/modified; `create_runtime.ts`/`src/worker.ts`/both diagnostics files never reference the new doc; neither diagnostics file gained any new field; `fedos_wasm_loader.ts` still has exactly its one pre-existing import and its six-member public interface, untouched; NIP-17/NIP-44/NIP-59/Double Ratchet/Triple Ratchet/onion routing are named but not implemented; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; the staleness finding names both flagged docs without editing them; the Worker/Production exclusion cross-references the Wiring Plan's own guarantee; no dependency added and no generated artifact committed. Verification: `npm run typecheck` clean; `npm test` green (223 files / 3418 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) confirmed absent; `git status --short` clean after commit. **Still true**: zero `src/runtime` files changed by this stage; no Runtime/Worker connection change of any kind; no diagnostics field added, removed, or renamed; the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached; no static or dynamic `import()` of the generated JS glue; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

865. "Prototype Phase 015: `FedosWasmLoader.planLoad()` builds an internal JS GLUE ACCESS PLAN (`#createJsGlueAccessPlan()`) one step past the Load Plan, still always `BlockedByPolicy`, still `STOP`" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`docs/runtime_wasm_loader_js_glue_access_plan.md`](docs/runtime_wasm_loader_js_glue_access_plan.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Lands the FIRST of the four ordered next-connection candidates the Stage 857 Phase 014 readiness review named: `FedosWasmLoader.planLoad() → JS Glue access plan → generated artifact check → dev-only gate → import()` — ONLY the first. `src/runtime/fedos_wasm_loader.ts` (Stage 865) adds a NEW, internal-only type, `FedosWasmLoaderJsGlueAccessPlan` (`{ backend: "Wasm", shouldAccess: false, reason: "BlockedByLoadPlan", currentStage: "JsGlueAccessPlanning", nextRequiredCheck: "GeneratedArtifactCheck" }` — `reason` a three-member literal union, only one member ever produced), built by a new PRIVATE `#createJsGlueAccessPlan()` method (no argument, calls nothing, hand-fixed constant). `planLoad()`'s flow extends ONE step further, INSIDE the existing `if (!loadPlan.shouldLoad)` branch: build the Plan, confirm `jsGlueAccessPlan.shouldAccess` (a THIRD, independent check, ALWAYS taken since `shouldAccess` is fixed `false`), then return the SAME `#blocked("load")` answer as every prior stage — `planLoad()`'s own return value, key order included, stays byte-for-byte unchanged; the Plan's fields are never merged into it, never part of the public interface, never returned to any caller. `reason: "BlockedByLoadPlan"` names WHY (the Load Plan already said `shouldLoad: false`); `nextRequiredCheck: "GeneratedArtifactCheck"` NAMES, without PERFORMING, the very next gate — this stage does NOT check artifact existence, does NOT `import()`, does NOT reference `WebAssembly`, does NOT call Rust. Six new standalone accessors (`loaderJsGlueAccessPlanCreated()`/`...ShouldAccess()`/`...Backend()`/`...Reason()`/`...CurrentStage()`/`...NextRequiredCheck()`) let the Plan be inspected without constructing a `FedosWasmLoader` instance. **Diagnostics are deliberately NOT touched this stage** — `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` gain no new field, matching the requested "necessary minimum" scope. New `docs/runtime_wasm_loader_js_glue_access_plan.md` records the Plan's own shape, why now, `planLoad()`'s extended flow, what THIS stage deliberately does not do (Generated Artifact Check/JS glue presence confirmation/`import()`/`WebAssembly`/Rust, each its own future stage), and the restated Fail Closed invariants (`policy.allowed`/`Load Plan.shouldLoad`/`JS Glue Access Plan.shouldAccess` all `false`). `docs/runtime_internal_execution_contract.md` gains a matching Stage 865 diagram update, `STOP` left at its pre-existing position. New `test/runtime_wasm_loader_js_glue_access_plan.test.ts` (21 tests) guards: the Plan is generated every `planLoad()` call; `shouldAccess`/`backend`/`reason`/`nextRequiredCheck`/`currentStage` are fixed `false`/`"Wasm"`/`"BlockedByLoadPlan"`/`"GeneratedArtifactCheck"`/`"JsGlueAccessPlanning"`; `planLoad()`'s own return value is byte-for-byte unchanged with exactly its own four keys in order; the Plan's fields never leak into it; a structural source check confirms `#createJsGlueAccessPlan()` is nested strictly after `loadPlan.shouldLoad` is confirmed and strictly before the final blocked return; `policy()` still called exactly once per `planLoad()` call; `planningState()`/`status()` uninterfered; Runtime/Facade/Backend Abstraction/Backend Interface/Backend Resolver/WASM Backend return values all unaffected; Worker AND Production (`create_runtime.ts`) remain fully unconnected, and neither diagnostics file gained any field; `WebAssembly.instantiate`/`compile` and `fetch` never invoked exercising the full chain; no `import()`/`WebAssembly`/generated-JS-glue/Rust/artifact-existence-check reference anywhere in the Loader source; no cycle exists; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; pre-existing `policy()`/Load Plan fields unaffected; `encrypt`/`decrypt` unchanged. Verification: `npm run typecheck` clean; `npm test` green (224 files / 3439 tests, zero pre-existing tests touched — confirming diagnostics truly untouched); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind; no diagnostics field added, removed, or renamed; the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached; no generated-artifact existence check performed; no static or dynamic `import()` of the generated JS glue; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

873. "Prototype Phase 016: `FedosWasmLoader.planLoad()` builds an internal GENERATED ARTIFACT CHECK PLAN (`#createGeneratedArtifactCheckPlan()`) one step past the JS Glue Access Plan, still always `BlockedByPolicy`, still `STOP`" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`docs/runtime_wasm_loader_generated_artifact_check_plan.md`](docs/runtime_wasm_loader_generated_artifact_check_plan.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Lands the SECOND of the four ordered next-connection candidates the Stage 857 Phase 014 readiness review named: `FedosWasmLoader.planLoad() → JS Glue access plan → generated artifact check → dev-only gate → import()` — ONLY the second. `src/runtime/fedos_wasm_loader.ts` (Stage 873) adds a NEW, internal-only type, `FedosWasmLoaderGeneratedArtifactCheckPlan` (`{ backend: "Wasm", shouldCheck: false, reason: "BlockedByJsGlueAccessPlan", currentStage: "GeneratedArtifactCheckPlanning", nextRequiredCheck: "DevOnlyGate" }` — `reason` a three-member literal union, only one member ever produced), built by a new PRIVATE `#createGeneratedArtifactCheckPlan()` method (no argument, calls nothing, hand-fixed constant). `planLoad()`'s flow extends ONE step further, INSIDE the existing `if (!jsGlueAccessPlan.shouldAccess)` branch: build the Plan, confirm `artifactCheckPlan.shouldCheck` (a FOURTH, independent check, ALWAYS taken since `shouldCheck` is fixed `false`), then return the SAME `#blocked("load")` answer as every prior stage — `planLoad()`'s own return value, key order included, stays byte-for-byte unchanged; the Plan's fields are never merged into it, never part of the public interface, never returned to any caller. `reason: "BlockedByJsGlueAccessPlan"` names WHY (the JS Glue Access Plan already said `shouldAccess: false`); `nextRequiredCheck: "DevOnlyGate"` NAMES, without EVALUATING, the very next gate — this stage does NOT check whether the generated artifact exists, does NOT touch the filesystem, does NOT `import()`, does NOT reference `WebAssembly`, does NOT call Rust. Six new standalone accessors (`loaderGeneratedArtifactCheckPlanCreated()`/`...ShouldCheck()`/`...Backend()`/`...Reason()`/`...CurrentStage()`/`...NextRequiredCheck()`) let the Plan be inspected without constructing a `FedosWasmLoader` instance. **Diagnostics are deliberately NOT touched this stage** — `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` gain no new field, matching the requested "necessary minimum" scope. New `docs/runtime_wasm_loader_generated_artifact_check_plan.md` records the Plan's own shape, why now, `planLoad()`'s extended flow, what THIS stage deliberately does not do (real filesystem confirmation/Dev-only Gate evaluation/`import()`/`WebAssembly`/Rust, each its own future stage), and the restated Fail Closed invariants (`policy.allowed`/`Load Plan.shouldLoad`/`JS Glue Access Plan.shouldAccess`/`Generated Artifact Check Plan.shouldCheck` all `false`). `docs/runtime_internal_execution_contract.md` gains a matching Stage 873 diagram update, `STOP` left at its pre-existing position. New `test/runtime_wasm_loader_generated_artifact_check_plan.test.ts` (21 tests) guards: the Plan is generated every `planLoad()` call; `shouldCheck`/`backend`/`reason`/`nextRequiredCheck`/`currentStage` are fixed `false`/`"Wasm"`/`"BlockedByJsGlueAccessPlan"`/`"DevOnlyGate"`/`"GeneratedArtifactCheckPlanning"`; `planLoad()`'s own return value is byte-for-byte unchanged with exactly its own four keys in order; the Plan's fields never leak into it; a structural source check confirms `#createGeneratedArtifactCheckPlan()` is nested strictly after `jsGlueAccessPlan.shouldAccess` is confirmed and strictly before the final blocked return; `policy()` still called exactly once per `planLoad()` call; `planningState()`/`status()` uninterfered; Runtime/Facade/Backend Abstraction/Backend Interface/Backend Resolver/WASM Backend return values all unaffected; Worker AND Production (`create_runtime.ts`) remain fully unconnected, and neither diagnostics file gained any field; `WebAssembly.instantiate`/`compile` and `fetch` never invoked exercising the full chain; no `import()`/`WebAssembly`/generated-JS-glue/Rust/filesystem-access reference anywhere in the Loader source (`existsSync`/`readFileSync`/`statSync`/`fs.*`/`node:fs` all absent); no cycle exists; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; pre-existing `policy()`/Load Plan/JS Glue Access Plan fields unaffected; `encrypt`/`decrypt` unchanged. Verification: `npm run typecheck` clean; `npm test` green (225 files / 3460 tests, zero pre-existing tests touched — confirming diagnostics truly untouched); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind; no diagnostics field added, removed, or renamed; the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached; no generated-artifact existence check performed; no filesystem access of any kind; no static or dynamic `import()` of the generated JS glue; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

881. "Prototype Phase 017: `FedosWasmLoader.planLoad()` builds an internal DEV-ONLY GATE PLAN (`#createDevOnlyGatePlan()`) one step past the Generated Artifact Check Plan, still always `BlockedByPolicy`, still `STOP`" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`docs/runtime_wasm_loader_dev_only_gate_plan.md`](docs/runtime_wasm_loader_dev_only_gate_plan.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Lands the THIRD of the four ordered next-connection candidates the Stage 857 Phase 014 readiness review named: `FedosWasmLoader.planLoad() → JS Glue access plan → generated artifact check → dev-only gate → import()` — ONLY the third. `src/runtime/fedos_wasm_loader.ts` (Stage 881) adds a NEW, internal-only type, `FedosWasmLoaderDevOnlyGatePlan` (`{ backend: "Wasm", shouldEvaluate: false, reason: "BlockedByGeneratedArtifactCheckPlan", currentStage: "DevOnlyGatePlanning", nextRequiredCheck: "ImportPlanning" }` — `reason` a three-member literal union, only one member ever produced), built by a new PRIVATE `#createDevOnlyGatePlan()` method (no argument, calls nothing, hand-fixed constant). `planLoad()`'s flow extends ONE step further, INSIDE the existing `if (!artifactCheckPlan.shouldCheck)` branch: build the Plan, confirm `devOnlyGatePlan.shouldEvaluate` (a FIFTH, independent check, ALWAYS taken since `shouldEvaluate` is fixed `false`), then return the SAME `#blocked("load")` answer as every prior stage — `planLoad()`'s own return value, key order included, stays byte-for-byte unchanged; the Plan's fields are never merged into it, never part of the public interface, never returned to any caller. `shouldEvaluate: false` NAMES that a real Dev-only Gate would only ever evaluate `true` in a Development Runtime — never Production, never Worker — WITHOUT this stage ever reading `process.env`/`import.meta`/`NODE_ENV`: the field is a hand-fixed literal, not a computed answer. `reason: "BlockedByGeneratedArtifactCheckPlan"` names WHY (the Generated Artifact Check Plan already said `shouldCheck: false`); `nextRequiredCheck: "ImportPlanning"` NAMES, without PERFORMING, the very next gate — this stage does NOT determine Development/Production status, does NOT read any environment variable, does NOT `import()`, does NOT reference `WebAssembly`, does NOT call Rust. Six new standalone accessors (`loaderDevOnlyGatePlanCreated()`/`...ShouldEvaluate()`/`...Backend()`/`...Reason()`/`...CurrentStage()`/`...NextRequiredCheck()`) let the Plan be inspected without constructing a `FedosWasmLoader` instance. **Diagnostics are deliberately NOT touched this stage** — `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` gain no new field, matching the requested "necessary minimum" scope. New `docs/runtime_wasm_loader_dev_only_gate_plan.md` records the Plan's own shape, why now, `planLoad()`'s extended flow, what THIS stage deliberately does not do (real Development/Production determination/Dev-only Gate evaluation/Import Planning/`WebAssembly`/Rust, each its own future stage), and the restated Fail Closed invariants (`policy.allowed`/`Load Plan.shouldLoad`/`JS Glue Access Plan.shouldAccess`/`Generated Artifact Check Plan.shouldCheck`/`Dev-only Gate Plan.shouldEvaluate` all `false`, `shouldEvaluate` NEVER transitioned to `true` anywhere in this Prototype). `docs/runtime_internal_execution_contract.md` gains a matching Stage 881 diagram update, `STOP` left at its pre-existing position. New `test/runtime_wasm_loader_dev_only_gate_plan.test.ts` (22 tests) guards: the Plan is generated every `planLoad()` call; `shouldEvaluate`/`backend`/`reason`/`nextRequiredCheck`/`currentStage` are fixed `false`/`"Wasm"`/`"BlockedByGeneratedArtifactCheckPlan"`/`"ImportPlanning"`/`"DevOnlyGatePlanning"`; `planLoad()`'s own return value is byte-for-byte unchanged with exactly its own four keys in order across repeated calls; the Plan's fields never leak into it; a structural source check confirms `#createDevOnlyGatePlan()` is nested strictly after `artifactCheckPlan.shouldCheck` is confirmed and strictly before the final blocked return; `policy()` still called exactly once per `planLoad()` call; `planningState()`/`status()` uninterfered; NO `process.env`/`import.meta`/`NODE_ENV`/`isDevelopment`/`isProduction` reference anywhere in the Loader source; Runtime/Facade/Backend Abstraction/Backend Interface/Backend Resolver/WASM Backend return values all unaffected; Worker AND Production (`create_runtime.ts`) remain fully unconnected, and neither diagnostics file gained any field; `WebAssembly.instantiate`/`compile` and `fetch` never invoked exercising the full chain; no `import()`/`WebAssembly`/generated-JS-glue/Rust/filesystem-access reference anywhere in the Loader source; no cycle exists; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; pre-existing `policy()`/Load Plan/JS Glue Access Plan/Generated Artifact Check Plan fields unaffected; `encrypt`/`decrypt` unchanged. Verification: `npm run typecheck` clean; `npm test` green (226 files / 3482 tests, zero pre-existing tests touched — confirming diagnostics truly untouched); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind; no diagnostics field added, removed, or renamed; no Development/Production determination of any kind; the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached; no generated-artifact existence check performed; no filesystem access of any kind; no static or dynamic `import()` of the generated JS glue; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

889. "Prototype Phase 018: `FedosWasmLoader.planLoad()` builds an internal IMPORT PLAN (`#createImportPlan()`) one step past the Dev-only Gate Plan, still always `BlockedByPolicy`, still `STOP`" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`docs/runtime_wasm_loader_import_plan.md`](docs/runtime_wasm_loader_import_plan.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Lands the FOURTH of the four ordered next-connection candidates the Stage 857 Phase 014 readiness review named — `FedosWasmLoader.planLoad() → JS Glue access plan → generated artifact check → dev-only gate → import()` — but only AS A PLAN, not as a real `import()` call. `src/runtime/fedos_wasm_loader.ts` (Stage 889) adds a NEW, internal-only type, `FedosWasmLoaderImportPlan` (`{ backend: "Wasm", shouldImport: false, reason: "BlockedByDevOnlyGatePlan", currentStage: "ImportPlanning", nextRequiredCheck: "WebAssemblyPlanning" }` — `reason` a three-member literal union, only one member ever produced), built by a new PRIVATE `#createImportPlan()` method (no argument, calls nothing, hand-fixed constant). `planLoad()`'s flow extends ONE step further, INSIDE the existing `if (!devOnlyGatePlan.shouldEvaluate)` branch: build the Plan, confirm `importPlan.shouldImport` (a SIXTH, independent check, ALWAYS taken since `shouldImport` is fixed `false`), then return the SAME `#blocked("load")` answer as every prior stage — `planLoad()`'s own return value, key order included, stays byte-for-byte unchanged; the Plan's fields are never merged into it, never part of the public interface, never returned to any caller. `shouldImport: false` NAMES the future intent that a real Loader would eventually `import()` the generated JS glue — WITHOUT this stage ever calling `import()` in any form (static or dynamic) or loading the generated JS glue. `reason: "BlockedByDevOnlyGatePlan"` names WHY (the Dev-only Gate Plan already said `shouldEvaluate: false`); `nextRequiredCheck: "WebAssemblyPlanning"` NAMES, without PERFORMING, the very next gate — this stage does NOT call `import()`, does NOT reference `WebAssembly`, does NOT call `initSync`, does NOT call Rust. Six new standalone accessors (`loaderImportPlanCreated()`/`...ShouldImport()`/`...Backend()`/`...Reason()`/`...CurrentStage()`/`...NextRequiredCheck()`) let the Plan be inspected without constructing a `FedosWasmLoader` instance. **Diagnostics are deliberately NOT touched this stage** — `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` gain no new field, matching the requested "necessary minimum" scope. New `docs/runtime_wasm_loader_import_plan.md` records the Plan's own shape, why now, `planLoad()`'s extended flow, what THIS stage deliberately does not do (real `import()`/generated-JS-glue-load/WebAssembly Planning/Rust, each its own future stage), and the restated Fail Closed invariants (`policy.allowed`/`Load Plan.shouldLoad`/`JS Glue Access Plan.shouldAccess`/`Generated Artifact Check Plan.shouldCheck`/`Dev-only Gate Plan.shouldEvaluate`/`Import Plan.shouldImport` all `false`, `shouldImport` NEVER transitioned to `true` anywhere in this Prototype). `docs/runtime_internal_execution_contract.md` gains a matching Stage 889 diagram update, `STOP` left at its pre-existing position. New `test/runtime_wasm_loader_import_plan.test.ts` (23 tests) guards: the Plan is generated every `planLoad()` call; `shouldImport`/`backend`/`reason`/`nextRequiredCheck`/`currentStage` are fixed `false`/`"Wasm"`/`"BlockedByDevOnlyGatePlan"`/`"WebAssemblyPlanning"`/`"ImportPlanning"`; `planLoad()`'s own return value is byte-for-byte unchanged with exactly its own four keys in order across repeated calls; the Plan's fields never leak into it; a structural source check confirms `#createImportPlan()` is nested strictly after `devOnlyGatePlan.shouldEvaluate` is confirmed and strictly before the final blocked return; `policy()` still called exactly once per `planLoad()` call; `planningState()`/`status()` uninterfered; NO `import()`/dynamic-import/generated-JS-glue-load/filesystem-access/`WebAssembly`-API-usage/Rust-connection/Development-Production-judgement of any kind anywhere in the Loader source (the `"WebAssemblyPlanning"` naming literal itself is explicitly permitted — the check looks for real API usage, `WebAssembly\.`, not the bare word); Runtime/Facade/Backend Abstraction/Backend Interface/Backend Resolver/WASM Backend return values all unaffected; Worker AND Production (`create_runtime.ts`) remain fully unconnected, and neither diagnostics file gained any field; `WebAssembly.instantiate`/`compile` and `fetch` never invoked exercising the full chain; no cycle exists; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; pre-existing `policy()`/Load Plan/JS Glue Access Plan/Generated Artifact Check Plan/Dev-only Gate Plan fields unaffected; `encrypt`/`decrypt` unchanged. Eleven pre-existing guard tests across the Loader arc (`runtime_wasm_loader.test.ts`, `runtime_wasm_loader_plan.test.ts`, `runtime_wasm_loader_policy.test.ts`, `runtime_wasm_loader_state.test.ts`, `runtime_wasm_loader_plan_policy_connection.test.ts`, `runtime_wasm_loader_policy_evaluation.test.ts`, `runtime_wasm_loader_load_plan.test.ts`, `runtime_wasm_loader_js_glue_access_plan.test.ts`, `runtime_wasm_loader_generated_artifact_check_plan.test.ts`, `runtime_wasm_loader_dev_only_gate_plan.test.ts`, `runtime_wasm_backend_loader_connection.test.ts`) had their bare `/WebAssembly/` regex narrowed to `/WebAssembly\./` — the ONLY change in each — since the new `"WebAssemblyPlanning"` naming literal legitimately contains the substring "WebAssembly" without being a real API reference. Verification: `npm run typecheck` clean; `npm test` green (227 files / 3505 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step (one retry needed after a file-lock error); `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind; no diagnostics field added, removed, or renamed; no Development/Production determination of any kind; the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached; no static or dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

897. "Prototype Phase 019: `FedosWasmLoader.planLoad()` builds an internal WEBASSEMBLY PLAN (`#createWebAssemblyPlan()`) one step past the Import Plan, still always `BlockedByPolicy`, still `STOP`" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`docs/runtime_wasm_loader_webassembly_plan.md`](docs/runtime_wasm_loader_webassembly_plan.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Extends the Stage 857 Phase 014 readiness review's four-item next-connection list ONE link past where it ended — `import()` — naming the WebAssembly instantiation step a real import would eventually need before reaching Rust. `src/runtime/fedos_wasm_loader.ts` (Stage 897) adds a NEW, internal-only type, `FedosWasmLoaderWebAssemblyPlan` (`{ backend: "Wasm", shouldInstantiate: false, reason: "BlockedByImportPlan", currentStage: "WebAssemblyPlanning", nextRequiredCheck: "RustApiCallPlanning" }` — `reason` a three-member literal union, only one member ever produced), built by a new PRIVATE `#createWebAssemblyPlan()` method (no argument, calls nothing, hand-fixed constant). `planLoad()`'s flow extends ONE step further, INSIDE the existing `if (!importPlan.shouldImport)` branch: build the Plan, confirm `webAssemblyPlan.shouldInstantiate` (a SEVENTH, independent check, ALWAYS taken since `shouldInstantiate` is fixed `false`), then return the SAME `#blocked("load")` answer as every prior stage — `planLoad()`'s own return value, key order included, stays byte-for-byte unchanged; the Plan's fields are never merged into it, never part of the public interface, never returned to any caller. `shouldInstantiate: false` NAMES the future intent that a real Loader would eventually create and use a real WebAssembly instance — WITHOUT this stage ever calling `WebAssembly.instantiate`/`compile` or constructing `new WebAssembly.Module`/`new WebAssembly.Instance` in any form. `reason: "BlockedByImportPlan"` names WHY (the Import Plan already said `shouldImport: false`); `nextRequiredCheck: "RustApiCallPlanning"` NAMES, without PERFORMING, the very next gate — this stage does NOT call any WebAssembly API, does NOT call `initSync`, does NOT call Rust. Six new standalone accessors (`loaderWebAssemblyPlanCreated()`/`...ShouldInstantiate()`/`...Backend()`/`...Reason()`/`...CurrentStage()`/`...NextRequiredCheck()`) let the Plan be inspected without constructing a `FedosWasmLoader` instance. **Diagnostics are deliberately NOT touched this stage** — `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` gain no new field, matching the requested "necessary minimum" scope. New `docs/runtime_wasm_loader_webassembly_plan.md` records the Plan's own shape, why now, `planLoad()`'s extended flow, what THIS stage deliberately does not do (real `WebAssembly.instantiate`/`compile`/`new WebAssembly.Module`/`Instance`/`initSync`/Rust API Call Planning/Rust execution, each its own future stage), the restated Fail Closed invariants (`policy.allowed`/`Load Plan.shouldLoad`/`JS Glue Access Plan.shouldAccess`/`Generated Artifact Check Plan.shouldCheck`/`Dev-only Gate Plan.shouldEvaluate`/`Import Plan.shouldImport`/`WebAssembly Plan.shouldInstantiate` all `false`, `shouldInstantiate` NEVER transitioned to `true` anywhere in this Prototype), and an explicit note that the `"WebAssemblyPlanning"` naming literal is permitted while real API usage is not. `docs/runtime_internal_execution_contract.md` gains a matching Stage 897 diagram update, `STOP` left at its pre-existing position. New `test/runtime_wasm_loader_webassembly_plan.test.ts` (24 tests) guards: the Plan is generated every `planLoad()` call; `shouldInstantiate`/`backend`/`reason`/`nextRequiredCheck`/`currentStage` are fixed `false`/`"Wasm"`/`"BlockedByImportPlan"`/`"RustApiCallPlanning"`/`"WebAssemblyPlanning"`; `planLoad()`'s own return value is byte-for-byte unchanged with exactly its own four keys in order across repeated calls; the Plan's fields never leak into it; a structural source check confirms `#createWebAssemblyPlan()` is nested strictly after `importPlan.shouldImport` is confirmed and strictly before the final blocked return; `policy()` still called exactly once per `planLoad()` call; `planningState()`/`status()` uninterfered; NO real WebAssembly API usage (`WebAssembly.`/`WebAssembly.instantiate`/`WebAssembly.compile`/`new WebAssembly.Module`/`new WebAssembly.Instance`) while the `"WebAssemblyPlanning"` naming literal itself IS present and explicitly asserted as permitted; NO `import()`/dynamic-import/generated-JS-glue-load/filesystem-access/Rust-connection/Development-Production-judgement of any kind anywhere in the Loader source; Runtime/Facade/Backend Abstraction/Backend Interface/Backend Resolver/WASM Backend return values all unaffected; Worker AND Production (`create_runtime.ts`) remain fully unconnected, and neither diagnostics file gained any field; `WebAssembly.instantiate`/`compile` and `fetch` never invoked exercising the full chain; no cycle exists; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; pre-existing `policy()`/Load Plan/JS Glue Access Plan/Generated Artifact Check Plan/Dev-only Gate Plan/Import Plan fields unaffected; `encrypt`/`decrypt` unchanged. Verification: `npm run typecheck` clean; `npm test` green (228 files / 3529 tests, zero pre-existing tests required changes this time — Stage 889's own `WebAssembly\.`-narrowed regex precedent already covered the new naming literal); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind; no diagnostics field added, removed, or renamed; no Development/Production determination of any kind; the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached; no static or dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

905. "Prototype Phase 020: `FedosWasmLoader.planLoad()` builds an internal RUST API CALL PLAN (`#createRustApiCallPlan()`) one step past the WebAssembly Plan — the Planning Chain is now COMPLETE, still always `BlockedByPolicy`, still `STOP`" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`docs/runtime_wasm_loader_rust_api_call_plan.md`](docs/runtime_wasm_loader_rust_api_call_plan.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). Lands the LAST link in the internal Planning Chain `runtime_wasm_loader.ts`'s `planLoad()` has been building since Stage 841 (Prototype Phase 013) — `policy() → Policy Evaluation → Load Plan → JS Glue Access Plan → Generated Artifact Check Plan → Dev-only Gate Plan → Import Plan → WebAssembly Plan → Rust API Call Plan → BlockedByPolicy → STOP`, eight independent hand-fixed Plans in total. `src/runtime/fedos_wasm_loader.ts` (Stage 905) adds a NEW, internal-only type, `FedosWasmLoaderRustApiCallPlan` (`{ backend: "Wasm", shouldCall: false, reason: "BlockedByWebAssemblyPlan", currentStage: "RustApiCallPlanning", nextRequiredCheck: "PrototypeExecutionReadiness" }` — `reason` a three-member literal union, only one member ever produced), built by a new PRIVATE `#createRustApiCallPlan()` method (no argument, calls nothing, hand-fixed constant). `planLoad()`'s flow extends ONE step further, INSIDE the existing `if (!webAssemblyPlan.shouldInstantiate)` branch: build the Plan, confirm `rustApiCallPlan.shouldCall` (an EIGHTH, independent check, ALWAYS taken since `shouldCall` is fixed `false`), then return the SAME `#blocked("load")` answer as every prior stage — `planLoad()`'s own return value, key order included, stays byte-for-byte unchanged; the Plan's fields are never merged into it, never part of the public interface, never returned to any caller. `shouldCall: false` NAMES the future intent that a real Loader would eventually call a real Rust public function (one of the 27 `pub fn` in `packages/fedos-core-rust/src/lib.rs`, e.g. `version()`) — WITHOUT this stage ever calling one, referencing `#[wasm_bindgen]`, `__wbg_init`, or `initSync`. `reason: "BlockedByWebAssemblyPlan"` names WHY (the WebAssembly Plan already said `shouldInstantiate: false`); `nextRequiredCheck: "PrototypeExecutionReadiness"` deliberately NAMES a REVIEW of the now-complete eight-Plan chain, NOT a ninth internal Plan — that review is Phase 021's own future, separate responsibility. Six new standalone accessors (`loaderRustApiCallPlanCreated()`/`...ShouldCall()`/`...Backend()`/`...Reason()`/`...CurrentStage()`/`...NextRequiredCheck()`) let the Plan be inspected without constructing a `FedosWasmLoader` instance. **Diagnostics are deliberately NOT touched this stage** — `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` gain no new field, matching the requested "necessary minimum" scope. New `docs/runtime_wasm_loader_rust_api_call_plan.md` records the Plan's own shape, why now, `planLoad()`'s extended (now 23-step) flow, what THIS stage deliberately does not do (real Rust API call/`#[wasm_bindgen]`/`__wbg_init`/`initSync`, each its own future stage), the restated Fail Closed invariants across all eight Plans (`shouldCall` NEVER transitioned to `true` anywhere in this Prototype), and a dedicated §7 confirming the Planning Chain is COMPLETE — no ninth Plan is named or implied. `docs/runtime_internal_execution_contract.md` gains a matching Stage 905 diagram update, `STOP` left at its pre-existing position. New `test/runtime_wasm_loader_rust_api_call_plan.test.ts` (23 tests) guards: the Plan is generated every `planLoad()` call; `shouldCall`/`backend`/`reason`/`nextRequiredCheck`/`currentStage` are fixed `false`/`"Wasm"`/`"BlockedByWebAssemblyPlan"`/`"PrototypeExecutionReadiness"`/`"RustApiCallPlanning"`; `planLoad()`'s own return value is byte-for-byte unchanged with exactly its own four keys in order across repeated calls; the Plan's fields never leak into it; a structural source check confirms all EIGHT `#create*Plan()`/`should*` pairs appear in strict order inside `planLoad()`'s body; `policy()` still called exactly once per `planLoad()` call; `planningState()`/`status()` uninterfered; NO Rust API call of any kind (including `version()`), no `#[wasm_bindgen]`, no `__wbg_init`, no `initSync`; NO `import()`/dynamic-import/generated-JS-glue-load/real-WebAssembly-API-usage/filesystem-access anywhere in the Loader source; Runtime/Facade/Backend Abstraction/Backend Interface/Backend Resolver/WASM Backend return values all unaffected; Worker AND Production (`create_runtime.ts`) remain fully unconnected, and neither diagnostics file gained any field; `WebAssembly.instantiate`/`compile` and `fetch` never invoked exercising the full eight-Plan chain; no cycle exists; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; pre-existing fields across all seven prior Plans unaffected; `encrypt`/`decrypt` unchanged. Verification: `npm run typecheck` clean; `npm test` green (229 files / 3552 tests, zero pre-existing tests required changes); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind; no diagnostics field added, removed, or renamed; no Rust API call of any kind; the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached; no static or dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. **Planning Chain status: COMPLETE** — `policy() → Policy Evaluation → Load Plan → JS Glue Access Plan → Generated Artifact Check Plan → Dev-only Gate Plan → Import Plan → WebAssembly Plan → Rust API Call Plan → BlockedByPolicy → STOP`; the next stage's responsibility is reviewing this chain (Prototype Execution Readiness), not extending it. ✓

913. "Prototype Phase 021: WASM Loader Execution Readiness Review — confirms the eight-stage Planning Chain is complete, names the conversion order and its first candidate" ([`docs/runtime_wasm_loader_execution_readiness_review.md`](docs/runtime_wasm_loader_execution_readiness_review.md), [`test/runtime_wasm_loader_execution_readiness_review.test.ts`](test/runtime_wasm_loader_execution_readiness_review.test.ts)). A REVIEW-ONLY checkpoint, no code change of any kind — no eighth internal Plan (no ninth chain stage), no diagnostics field, no `src/runtime/fedos_wasm_loader.ts` execution-logic change, no load, import, or execution. New `docs/runtime_wasm_loader_execution_readiness_review.md` (1) confirms the Planning Chain — `policy()`/Policy Evaluation plus the SEVEN Plan objects `Load Plan` through `Rust API Call Plan` (Stage 841–905), eight stages total — is COMPLETE, and states no eighth Plan is added or recommended; (2) names the order a future stage would convert those seven Plans into real checks: `Generated Artifact Check → Dev-only Gate Evaluation → Import Readiness → Dev-only import() → WebAssembly Readiness → Minimal Rust API Call`, explicitly implementing NONE of them; (3) names **Generated Artifact Check** as the recommended FIRST candidate, with five reasons (safely checkable before `import()`, no WebAssembly execution, no Rust call, a precondition for Dev-only Gate, and Fail Closed expressible without a real load); (4) names future conditions a real Generated Artifact Check would need to satisfy — confirmation targets (Generated JS Glue, Generated WASM artifact), Development-Runtime-ONLY execution, Production stays Fail Closed, Worker stays unconnected, missing-artifact Fail Closed, and existing-artifact-still-no-immediate-`import()`; (5) restates all eight fixed `false` values unchanged; and (6) restates every prohibition (`import()`, `WebAssembly`, Rust API calls, Worker/Production connection, NIP-17/NIP-44/NIP-59, Double Ratchet/Triple Ratchet/onion routing, environment reads, `initSync`/`#[wasm_bindgen]`/`__wbg_init`, Cargo/package changes, generated-artifact commits). New `test/runtime_wasm_loader_execution_readiness_review.test.ts` (18 tests) guards: the review doc exists and is substantial; the seven-Plan chain is documented in the correct order (checked within its own diagram, not the whole doc); the no-eighth-Plan/no-ninth-stage policy is stated explicitly; the six-step conversion order is named, in order, and explicitly unimplemented; Generated Artifact Check is named as the first candidate with its reasons; all future conditions (targets/dev-only/Production/Worker/missing-artifact/no-immediate-import) are named; all eight Fail Closed fields are restated unchanged; all prohibited items are explicitly named; the doc never writes real `import()`/`WebAssembly` CODE (prose only); no ninth-stage/eighth-Plan, execution-logic, or file-deletion claim is made; `create_runtime.ts`/`src/worker.ts`/both diagnostics files never reference the new doc, and neither diagnostics file gained any field; `fedos_wasm_loader.ts` still has EXACTLY seven Plan interfaces and seven private `#create*Plan()` methods (no eighth of either) and its six-member public interface, untouched; no `import()`/dynamic-import/generated-JS-glue-load/real-WebAssembly-API-usage/filesystem-access/environment-read/Rust-reference of any kind in the Loader source; NIP-17/NIP-44/NIP-59/Double Ratchet/Triple Ratchet/onion routing named but not implemented; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; Worker/Production non-connection is named alongside the future candidate; the review cross-references and confirms (not contradicts) the prior Rust API Call Plan doc's own §7 finding. Verification: `npm run typecheck` clean; `npm test` green (230 files / 3570 tests, zero pre-existing tests required changes — confirming `fedos_wasm_loader.ts` truly untouched); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) confirmed absent; `git status --short` clean after commit. **Still true**: zero `src/runtime` files changed by this stage; no Runtime/Worker connection change of any kind; no diagnostics field added, removed, or renamed; no eighth Plan/ninth chain stage added; the generated JS glue, `WebAssembly.instantiate`/`compile`, `initSync`/the default init export, and Rust remain completely unreached; no static or dynamic `import()` of the generated JS glue anywhere in this repository; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. ✓

921. "Prototype EXECUTION Phase 001: `FedosWasmLoader.planLoad()` performs a REAL, read-only Generated Artifact Check — Planning ends, Execution begins, still always `BlockedByPolicy`, still `STOP`" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`docs/runtime_wasm_loader_generated_artifact_check_execution.md`](docs/runtime_wasm_loader_generated_artifact_check_execution.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). The FIRST real (non-fixed-constant) computation this whole Planning Chain arc has ever performed, implementing EXACTLY the one candidate `docs/runtime_wasm_loader_execution_readiness_review.md` (Stage 913) recommended: a live existence check of the two Generated Artifact files. `src/runtime/fedos_wasm_loader.ts` (Stage 921) adds `FedosWasmLoaderGeneratedArtifactName` (`"fedos_core_rust.js" | "fedos_core_rust_bg.wasm"`) and `FedosWasmLoaderGeneratedArtifactCheckResult` (`{ checkedArtifacts, missingArtifacts, artifactsExist }` — genuinely reflects live filesystem state, UNLIKE every Plan type in this arc), built by a new PRIVATE `#checkGeneratedArtifacts()` method that calls `existsSync` (`node:fs`) once per target file under `process.cwd()`, wrapped in a `try`/`catch` that Fails Closed (treats any check failure as "missing", never throws). `planLoad()` calls it EXACTLY once, immediately after `artifactCheckPlan.shouldCheck` is confirmed `false` — the SAME position the Planning Chain's own `Generated Artifact Check Plan` already occupies — storing the result on the instance (`#generatedArtifactCheckResult`, readable via the new PUBLIC `generatedArtifactCheckResult()` method) but NEVER reading it in any `if` condition: all SEVEN pre-existing Plans (`Load Plan` through `Rust API Call Plan`) still run, in the SAME order, and `planLoad()` still ALWAYS returns the SAME `#blocked("load")` answer — key order included — REGARDLESS of whether the artifacts are found or missing. Finding the artifacts present does NOT flip `shouldImport`/`shouldInstantiate`/`shouldCall`/any other Plan's own fixed `false` field anywhere in this file. A new standalone `loaderGeneratedArtifactCheckTargets()` names the two checked filenames without performing the check. Since this project's `tsconfig.json` carries no `@types/node` (`package.json` unmodified for this stage), the two Node built-ins used (`node:fs`'s `existsSync`, `node:path`'s `join`) are individually type-suppressed with `// @ts-expect-error`, matching this repository's own `?raw`-import convention. **Diagnostics are deliberately NOT touched this stage** — `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` gain no new field. New `docs/runtime_wasm_loader_generated_artifact_check_execution.md` records what is checked, what is permitted (existence confirmation only), the restated Fail Closed invariants, and what this Phase deliberately does not do (`import()`/`WebAssembly`/Rust API calls/content-reading filesystem access, each its own future stage). `docs/runtime_internal_execution_contract.md` gains a matching Stage 921 diagram update, `STOP` left at its pre-existing position. New `test/runtime_wasm_loader_generated_artifact_check_execution.test.ts` (23 tests) guards: the check targets are the two fixed filenames; `generatedArtifactCheckResult()` is `null` before `planLoad()` runs and populated after; the "missing" case (the real, uncompiled state of this repo) records both artifacts missing and still reaches `BlockedByPolicy`; the "present" case (`existsSync` mocked via `vi.mock("node:fs", ...)`, since `node:fs`'s own exports are non-configurable for `vi.spyOn`) records both artifacts present and STILL reaches the identical `BlockedByPolicy` answer; artifacts existing never flips any Plan's own fixed field; a thrown `existsSync` Fails Closed to "missing" rather than propagating; `planLoad()`'s own return value is byte-for-byte unchanged across repeated calls; the check result never leaks into it; a structural source check confirms all eight `#create*Plan()`/`should*`/`#checkGeneratedArtifacts()` steps appear in strict order inside `planLoad()`'s body; `policy()` still called exactly once per call; `planningState()`/`status()` uninterfered; NO `import()`/`require()`/real-WebAssembly-API-usage/Rust-API-call/`#[wasm_bindgen]` anywhere in the Loader source; only a read-only `existsSync` exists, no content-reading filesystem API (`readFileSync`/`statSync`/etc.); Worker AND Production (`create_runtime.ts`) remain fully unconnected, and neither diagnostics file gained any field; `WebAssembly.instantiate`/`compile` and `fetch` never invoked exercising the full chain with artifacts simulated present; no cycle exists; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; `encrypt`/`decrypt` unchanged. Fifteen pre-existing test files' own bare-word `/fedos_core_rust/` and blanket filesystem-access checks were narrowed (the SAME "naming literal vs. real API usage" precedent Stage 889 established for `WebAssemblyPlanning`) to permit naming the two artifact filenames and the new read-only existence check, while still forbidding any OTHER Rust-crate reference or any content-reading filesystem API — the ONLY change in each of those fifteen files. Verification: `npm run typecheck` clean; `npm test` green (231 files / 3593 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind; no diagnostics field added, removed, or renamed; no `import()`/`WebAssembly`/Rust API call of any kind; no CONTENT-reading filesystem access of any kind (only a read-only existence check); no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. **Planning ends, Execution begins** — the seven-Plan Planning Chain remains fully intact and unmodified; only ONE new, real step (Generated Artifact Check) was added past it. ✓

929. "Prototype EXECUTION Phase 002: `FedosWasmLoader.planLoad()` performs a REAL Dev-only Gate Evaluation — Development Runtime evaluation is NOT import permission, still always `BlockedByPolicy`, still `STOP`" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`docs/runtime_wasm_loader_dev_only_gate_evaluation_execution.md`](docs/runtime_wasm_loader_dev_only_gate_evaluation_execution.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). The SECOND real (non-fixed-constant) computation this Planning Chain arc has ever performed — one step past Stage 921's Generated Artifact Check — implementing the second candidate `docs/runtime_wasm_loader_execution_readiness_review.md` (Stage 913) named in its own conversion order: a live evaluation of `process.env.NODE_ENV`. `src/runtime/fedos_wasm_loader.ts` (Stage 929) adds `FedosWasmLoaderDevOnlyGateEvaluation` (`{ evaluated: true, developmentAllowed, reason: "DevelopmentRuntime" | "ProductionRuntime" | "UnknownRuntime" | "PrototypeStillClosed" }` — genuinely reflects the live `NODE_ENV` value, UNLIKE every Plan type in this arc), built by a new PRIVATE `#evaluateDevOnlyGate()` method that reads `process.env.NODE_ENV` — the ONLY environment key this method ever reads — wrapped in a `try`/`catch` that Fails Closed to `"PrototypeStillClosed"` on any read failure. `planLoad()` calls it EXACTLY once, immediately after `devOnlyGatePlan.shouldEvaluate` is confirmed `false` — the SAME position the Planning Chain's own `Dev-only Gate Plan` already occupies — storing the result on the instance (`#devOnlyGateEvaluation`, readable via the new PUBLIC `devOnlyGateEvaluation()` method) but NEVER reading it in any `if` condition: `Import Plan`/`WebAssembly Plan`/`Rust API Call Plan` still run, in the SAME order, and `planLoad()` still ALWAYS returns the SAME `#blocked("load")` answer — key order included — REGARDLESS of whether the runtime evaluates as Development, Production, or Unknown. **Evaluating Development Runtime is NOT import permission** — `developmentAllowed: true` does NOT flip `shouldImport`/`shouldInstantiate`/`shouldCall`/any other Plan's own fixed `false` field anywhere in this file. A new standalone `loaderDevOnlyGateEvaluationEnvKey()` names the one environment key read (`"NODE_ENV"`) without performing the read. **No new Node dependency**: Stage 921's ambient `process` declaration (`{ cwd(): string }`) is extended with an optional `env` property on the SAME single declaration — no NEW `@ts-expect-error` suppression was added (still exactly two, for `node:fs`/`node:path`), and `package.json`/`Cargo.toml` remain untouched. **Diagnostics are deliberately NOT touched this stage** — `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` gain no new field. New `docs/runtime_wasm_loader_dev_only_gate_evaluation_execution.md` records what is evaluated, what is permitted (Development Runtime evaluation only), why evaluating is not import permission, Production/Worker handling, and what this Phase deliberately does not do. `docs/runtime_internal_execution_contract.md` gains a matching Stage 929 diagram update, `STOP` left at its pre-existing position. New `test/runtime_wasm_loader_dev_only_gate_evaluation_execution.test.ts` (24 tests) guards: the evaluated key is `NODE_ENV` only; `devOnlyGateEvaluation()` is `null` before `planLoad()` runs and populated after; the Development (`NODE_ENV=development`), Production (`NODE_ENV=production`), and Unknown (unset/unrecognized) cases all reach the identical `BlockedByPolicy` answer; Development evaluation never flips any Plan's own fixed field; `planLoad()`'s own return value is byte-for-byte unchanged across repeated calls; the evaluation result never leaks into it; a structural source check confirms all nine `#create*Plan()`/`should*`/`#checkGeneratedArtifacts()`/`#evaluateDevOnlyGate()` steps appear in strict order inside `planLoad()`'s body; `policy()` still called exactly once per call; `planningState()`/`status()` uninterfered; NO `import()`/`require()`/real-WebAssembly-API-usage/Rust-API-call/`#[wasm_bindgen]` anywhere in the Loader source; only `process.env.NODE_ENV` is read, no other environment variable and no `import.meta`; exactly two `@ts-expect-error` directive lines and two `node:`-prefixed imports remain (no new Node built-in added); Worker AND Production (`create_runtime.ts`) remain fully unconnected, and neither diagnostics file gained any field; `WebAssembly.instantiate`/`compile` and `fetch` never invoked exercising the full chain with Development Runtime simulated; no cycle exists; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; `encrypt`/`decrypt` unchanged. Five pre-existing test files' own blanket `process.env`/`NODE_ENV`/`fedos_core_rust` checks were narrowed (the SAME "naming literal vs. real API usage" precedent Stage 889/921 established) to permit the narrowly-scoped `NODE_ENV` read while still forbidding any OTHER `process.env` key and `import.meta` — the ONLY change in each of those five files. Verification: `npm run typecheck` clean; `npm test` green (232 files / 3617 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind; no diagnostics field added, removed, or renamed; no `import()`/`WebAssembly`/Rust API call of any kind; no `process.env` key other than `NODE_ENV` read anywhere, no `import.meta` read; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. **Planning Chain remains fully intact** — only TWO new, real steps (Generated Artifact Check, Dev-only Gate Evaluation) have been added past it so far. ✓

937. "Prototype EXECUTION Phase 003: `FedosWasmLoader.planLoad()` performs a REAL Import Readiness evaluation and exposes an Execution Readiness Summary — Import Readiness is NOT import permission, still always `BlockedByPolicy`, still `STOP`" ([`src/runtime/fedos_wasm_loader.ts`](src/runtime/fedos_wasm_loader.ts), [`docs/runtime_wasm_loader_import_readiness_execution.md`](docs/runtime_wasm_loader_import_readiness_execution.md), [`docs/runtime_internal_execution_contract.md`](docs/runtime_internal_execution_contract.md), [`test/`](test/)). The THIRD real (non-fixed-constant) computation this Planning Chain arc has ever performed — one step past Stage 929's Dev-only Gate Evaluation — implementing the third candidate `docs/runtime_wasm_loader_execution_readiness_review.md` (Stage 913) named in its own conversion order. UNLIKE Stage 921/929, this new step reads NO new live external state of its own: `src/runtime/fedos_wasm_loader.ts` (Stage 937) adds `FedosWasmLoaderImportReadiness` (`{ evaluated: true, ready, reason: "ReadyForImport" | "MissingArtifacts" | "NotDevelopmentRuntime" | "PrototypeStillClosed" }`), built by a new PRIVATE `#evaluateImportReadiness()` method that is a PURE combination of the two prior real results already recorded earlier in the SAME `planLoad()` call (`this.#generatedArtifactCheckResult.artifactsExist`, `this.#devOnlyGateEvaluation.developmentAllowed`) — `MissingArtifacts` when the artifact check found either file missing, `NotDevelopmentRuntime` when artifacts are present but the runtime is not Development, `ReadyForImport` when BOTH conditions are satisfied, and a defensive `PrototypeStillClosed` fallback (never actually reached given `planLoad()`'s own fixed call order) if either prior result were somehow missing. `planLoad()` calls it EXACTLY once, immediately after `importPlan.shouldImport` is confirmed `false` — the SAME position the Planning Chain's own `Import Plan` already occupies — storing the result on the instance (`#importReadiness`, readable via the new PUBLIC `importReadiness()` method) but NEVER reading it in any `if` condition: `WebAssembly Plan`/`Rust API Call Plan` still run, in the SAME order, and `planLoad()` still ALWAYS returns the SAME `#blocked("load")` answer — key order included — REGARDLESS of whether readiness evaluates `true` or `false`. **Import Readiness is NOT import permission** — `ready: true` does NOT flip `shouldImport`/`shouldInstantiate`/`shouldCall`/any other Plan's own fixed `false` field anywhere in this file, even when BOTH the artifact and runtime conditions are satisfied. A new PUBLIC `executionReadinessSummary()` method combines all three real results recorded so far (`artifactsOk`/`runtimeOk`/`importReady`) with three permanently-fixed `false` flags (`importExecuted`/`webAssemblyExecuted`/`rustExecuted`) into one readable snapshot — itself performing no new check, purely reading already-recorded state; returns `null` before `planLoad()` has ever run. **No new Node dependency or type suppression**: this stage reads no new filesystem/environment state, so the `@ts-expect-error` count stays exactly two, and `package.json`/`Cargo.toml` remain untouched. **Diagnostics are deliberately NOT touched this stage** — `runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` gain no new field. New `docs/runtime_wasm_loader_import_readiness_execution.md` records the evaluation's two inputs, why readiness is not import permission, the Execution Readiness Summary's own shape, and what this Phase deliberately does not do. `docs/runtime_internal_execution_contract.md` gains a matching Stage 937 diagram update, `STOP` left at its pre-existing position. New `test/runtime_wasm_loader_import_readiness_execution.test.ts` (24 tests) guards: `importReadiness()` is `null` before `planLoad()` runs and populated after; missing artifacts reach `MissingArtifacts`/`ready: false` regardless of runtime kind; artifacts present but non-Development runtime reach `NotDevelopmentRuntime`/`ready: false`; BOTH conditions satisfied reach `ReadyForImport`/`ready: true` and planLoad() STILL returns `BlockedByPolicy`; `Import Plan.shouldImport` and every other Plan's own field stay `false` even when readiness is fully satisfied; `executionReadinessSummary()` correctly reflects both the fully-ready and the not-ready cases, and is `null` before any `planLoad()` call; `planLoad()`'s own return value is byte-for-byte unchanged across repeated calls; the readiness result never leaks into it; a structural source check confirms all ten `#create*Plan()`/`should*`/`#checkGeneratedArtifacts()`/`#evaluateDevOnlyGate()`/`#evaluateImportReadiness()` steps appear in strict order inside `planLoad()`'s body; `policy()` still called exactly once per call; `planningState()`/`status()` uninterfered; NO `import()`/`require()`/real-WebAssembly-API-usage/Rust-API-call/`#[wasm_bindgen]` anywhere in the Loader source; no new `process.env` key beyond `NODE_ENV`, no `import.meta`, exactly two `@ts-expect-error` directive lines remain; Worker AND Production (`create_runtime.ts`) remain fully unconnected, and neither diagnostics file gained any field; `WebAssembly.instantiate`/`compile` and `fetch` never invoked exercising the full chain with Import Readiness fully satisfied; no cycle exists; Rust public API unchanged (27 `pub fn`) and Cargo/package dependencies unchanged; `encrypt`/`decrypt` unchanged. Zero pre-existing test files required changes this time — this addition introduced no new bare-word-colliding literal. Verification: `npm run typecheck` clean; `npm test` green (233 files / 3641 tests); `cargo check` (native) green; `packages/fedos-core-rust/target`/`Cargo.lock`/`pkg` (all gitignored) deleted and confirmed absent as the final step; `git status --short` clean after commit. **Still true**: no Runtime/Worker connection change of any kind; no diagnostics field added, removed, or renamed; no `import()`/`WebAssembly`/Rust API call of any kind; no new filesystem/environment state read; no generated file edited or committed; `encrypt`/`decrypt` unchanged; NIP-17/NIP-44/NIP-59, Double Ratchet, Triple Ratchet, and onion routing unimplemented; Rust public API unchanged (27 `pub fn`); no `Cargo.toml`/`package.json` dependency added. **Planning Chain remains fully intact** — only THREE new, real steps (Generated Artifact Check, Dev-only Gate Evaluation, Import Readiness Evaluation) have been added past it so far. ✓ ← you are here

### Dual-Lock Activation Gate

**Two separate env vars must BOTH open before FedOS is even a
candidate — and even then, nothing activates.** `FEDOS_CRYPTO_PROVIDER`
("Lock #1") selects a provider NAME; `FEDOS_CRYPTO_ENABLED` ("Lock #2")
must equal the exact literal `"explicit-dev-only"` — every common
truthy spelling (`"true"`, `"1"`, `"on"`, `"enabled"`, ...) is rejected
on purpose, to make an accidental match effectively impossible. Setting
BOTH locks to their open values still does not start any cryptography:
`evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
report `"ProviderUnavailable"` (no real `FedosRuntimeCryptoProvider`
implementation exists), and the bridge files were not touched this
stage, so they never even look at `FEDOS_CRYPTO_ENABLED`. `"Allowed"`
remains structurally unreturnable.

### Activation Policy

**Choosing a provider name is not the same as activating it.** Setting
`FEDOS_CRYPTO_PROVIDER=fedos` only records an intent — it does not, by
itself, start any cryptography. FedOS crypto activation requires ALL
FIVE of: (1) `FEDOS_CRYPTO_PROVIDER=fedos`, (2) the separate `enabled`
gate set to `true` (still permanently `false` today, with no env path to
`true` anywhere in this repository), (3) a real `FedosRuntimeCryptoProvider`
implementation (still `encrypt`/`decrypt` → `"Unsupported"` unconditionally),
(4) Runtime actually calling it (still never automatic), and (5) Worker
actually importing the Worker crypto boundary (still not imported at
all). `evaluateRuntimeCryptoActivation`/`evaluateWorkerCryptoActivation`
(`src/runtime/runtime_crypto_activation_policy.ts`/
`worker_crypto_activation_policy.ts`) report WHY activation is not
allowed — `"DisabledByConfig"`, `"ProviderNotSelected"`, or
`"ProviderUnavailable"` — and, per `docs/runtime_crypto_threat_model.md`'s
fail-closed design, can never report `"Allowed"` in this repository as it
exists today.

### Execution Backend Architecture

**FedOS is not "WASM-only" — FedOS is Backend-swappable.** FedOS Core
(the Rust crate at `packages/fedos-core-rust`) is the ONE AND ONLY
core, and it stays completely unaware of how any Runtime eventually
reaches it. The **Execution Backend** (`src/runtime/fedos_execution_backend.ts`,
Stage 402) is the swappable interface in between:

```
FedOS Core (Rust)
        |
Execution Backend
        |
      Runtime
```

WASM (`src/runtime/fedos_wasm_boundary.ts`, Stage 386) is the FIRST
implementation candidate for this interface — it is the only
candidate with any real (still entirely inert) placeholder code today
— but it is explicitly **not** the only one the architecture allows.
Native/Desktop and Mobile backends are named as future candidates in
`docs/runtime_execution_backend.md` (Stage 401/405); neither has a
file, dependency, or line of code anywhere in this repository. Picking
up either would mean writing a NEW backend implementation behind the
SAME `FedosExecutionBackend` interface — it would require zero changes
to FedOS Core, the Provider, or any layer above the Execution Backend.

`packages/fedos-core-rust` itself has never referenced "backend,"
"WASM," "native," or "mobile" in any capacity, and this stage does not
change that — its 27 `pub fn`s and `Cargo.toml` are byte-for-byte
unchanged.

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
