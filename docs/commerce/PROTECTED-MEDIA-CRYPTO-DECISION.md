# Protected Product Media Crypto Spike: `AeadAadDomain` Extension Decision

**Scope:** investigate-only. This document answers whether adding a
`Commerce`/`ProductMedia` variant to the AEAD AAD-domain hierarchy that
backs `src/os/commerce/catalog/product_media_encryption.ts`'s
`ProductMediaEncryptionPort` is safe to implement, and produces the exact
patch if so. No source file outside this new doc was modified. Worktree:
`C:/wt/fedos-commerce-e2e-completion-agent-crypto` on
`arc/fedos-commerce-e2e-completion-agent-crypto`, branched from
`arc/fedos-commerce-e2e-completion` at commit `cabd750a`.

**Verified in this environment (2026-08-11):** `cargo 1.95.0`,
`wasm-bindgen 0.2.126` (CLI), `rustup target list --installed` reports
both `wasm32-unknown-unknown` and `x86_64-pc-windows-gnu`. `cargo check
--offline` and a full `npm run build:wasm` (with `CARGO_NET_OFFLINE=true`)
both completed successfully with **zero network access** — every crate
(`chacha20poly1305`, `aes-gcm`, `hkdf`, `k256`, `wasm-bindgen`, etc.) was
already present in the local `~/.cargo/registry` cache. `cargo test
--offline` (in `packages/fedos-core-rust/`) produced **639 passed, 1
failed** — the failure is
`crypto::secp256k1_dependency_guard::cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`,
a pre-existing, already-documented dependency-count assertion that predates
this spike (the guard's fixed literal `10` has not been updated since
`wasm-bindgen` became an 11th production dependency; confirmed via `git
log`/prior-arc docs, e.g. `docs/secure_runtime_alpha_720_completion_declaration.md`
and the user's own persisted memory of this exact number). This is the
**baseline to re-verify unchanged** by any future implementation (Q7b).

---

## 1. Where `AeadAadDomain` is actually defined

It is not defined once, and not "mirrored in two places" — it is defined
**four separate times**, in four different types, by explicit design
(this crate's own "each layer gets its own label type" discipline, stated
repeatedly in the source comments cited below):

1. **`packages/fedos-core-rust/src/crypto/aead_internal.rs:76-99`** — the
   crate-private `pub(crate) enum AeadAadDomain` that the real AEAD
   seal/open functions consume. **Seven variants**: `RootKey`,
   `Identity`, `Storage`, `Conversation`, `TestOnly`,
   `MasterSeedSealing` (line 89), `DirectRatchetSealing` (line 98). Each
   variant's fixed AAD bytes are in `AeadAadDomain::as_aad()`,
   `aead_internal.rs:109-119` (e.g. `b"fedos-aead-aad-storage-v1"`,
   `b"fedos-aead-aad-conversation-v1"`).
2. **`packages/fedos-core-rust/src/lib.rs:10994-11002`** — the
   `#[wasm_bindgen] pub enum FedosAeadAadDomain`, the actual type that
   crosses the WASM boundary. **Only five variants**: `RootKey`,
   `Identity`, `Storage`, `Conversation`, `TestOnly` — `MasterSeedSealing`
   and `DirectRatchetSealing` are deliberately absent here because those
   two domains' own production callers (`FedosMasterSeedAuthority::seal`,
   the Direct Ratchet sealing path) call `aead_internal::seal_internal`/
   `open_internal` **directly**, never through the public
   `fedos_encrypt`/`fedos_decrypt` boundary (confirmed by
   `aead_envelope_bridge.rs:57-67`'s `aad_domain_to_envelope_domain`,
   which returns `None` for both). `lib.rs:11020-11032`
   (`fedos_aead_aad_domain_to_internal`) is the one reviewed conversion
   point from this public type to #1's crate-private type.
3. **`packages/fedos-core-rust/src/crypto/ciphertext_envelope.rs:118-124`**
   — `pub(crate) enum AeadEnvelopeAadDomain`, the envelope/serialization
   label. **Five variants**, same names as #2. Deliberately a THIRD,
   separate type from #1/#2 (`ciphertext_envelope.rs:33-37`: "The
   algorithm and AAD-domain labels here are deliberately NEW, SEPARATE
   enums from this crate's real AEAD implementation's own equivalents").
   `aead_envelope_bridge.rs:68-92` is the one reviewed conversion point
   between #1 and #3.
4. **`src/os/core/vault/wasm/fedos_wasm_loader.ts:1398-1408`** — the
   TypeScript mirror, a hand-declared union type: `export type
   AeadAadDomain = "RootKey" | "Identity" | "Storage" | "Conversation" |
   "TestOnly"`. **Five variants**, matching #2 exactly (never generated
   from a `.d.ts`; hand-mapped to #2's numeric discriminants at
   `fedos_wasm_loader.ts:1416-1424`,
   `AEAD_AAD_DOMAIN_DISCRIMINANTS: RootKey=0, Identity=1, Storage=2,
   Conversation=3, TestOnly=4`).

Grep confirms: `AeadAadDomain`/`FedosAeadAadDomain`/`AeadEnvelopeAadDomain`
appear in 70 files total across `src/`, `test/`, `packages/fedos-core-rust/`,
and `docs/` (full match list captured during this spike); the four
canonical *definitions* are the ones enumerated above.

There is a **fifth, independent** domain-separation enum that is easy to
confuse with the above but governs KEY DERIVATION, not AEAD: `HkdfDomain`
at `packages/fedos-core-rust/src/lib.rs:3508-3555`, discussed in §3-4
below.

## 2. How domain separation is actually encoded cryptographically

**Both** AAD-mixing and (for domains with a real production key-resolution
path) KDF-context separation are used, at two independent layers — never
just one:

### 2a. AAD mixing (the AEAD-call layer, applies uniformly to all 7 `aead_internal::AeadAadDomain` variants)

`aead_internal.rs:298` (`seal_internal`) and `:356` (`open_internal`) both
do `let aad = aad_domain.as_aad();` then pass `aad` as the AEAD `Payload`'s
`aad` field to `chacha20poly1305`/`aes-gcm`'s `.encrypt()`/`.decrypt()`
(`aead_internal.rs:199-206`, `237-242` for ChaCha20-Poly1305/AES-256-GCM
respectively). This is genuine Associated Data — authenticated but not
encrypted — so a ciphertext sealed under `Storage`'s AAD label fails
authentication if opened with `Conversation`'s label, **even under the
same key**. Proven directly by test:
`aead_internal.rs:453-477`
(`wrong_aad_domain_fails_authentication_for_both_ciphers` — seals under
`AeadAadDomain::Storage`, opens under `AeadAadDomain::Conversation`,
asserts `AuthenticationFailed`) and the envelope-layer equivalent
`aead_envelope_bridge.rs:331-356`
(`wrong_aad_domain_in_the_envelope_fails_authentication`).

### 2b. Full end-to-end trace, `Conversation` domain, TS → WASM → Rust

1. **TS call site** (production, not a test):
   `src/os/messenger/conversations/encryption/fedos_wasm_conversation_encryption_authority.ts:70`
   fixes `const FEDOS_CONVERSATION_ENVELOPE_AAD_DOMAIN: AeadAadDomain =
   "Conversation"`, passed into `encrypt()`
   (`src/os/core/vault/wasm/fedos_runtime_encrypt.ts:154-161`, parameter
   `aadDomain: AeadAadDomain`).
2. `encrypt()` calls `attemptDevOnlyRuntimeEncrypt()` →
   `attemptDevOnlyEncryptCall()` (`fedos_wasm_loader.ts`), which maps the
   string `"Conversation"` to the numeric discriminant `3`
   (`AEAD_AAD_DOMAIN_DISCRIMINANTS.Conversation`,
   `fedos_wasm_loader.ts:1423`) and calls the wasm-bindgen-generated
   `module.encrypt_aead(key, algorithm, aadDomain, plaintext)`.
3. WASM boundary: this reaches `lib.rs:11080`
   (`pub fn fedos_encrypt(algorithm: FedosAeadAlgorithm, key:
   &FedosAeadKeyHandle, aad_domain: FedosAeadAadDomain, plaintext:
   &[u8])`), the crate's public entry point.
4. `fedos_encrypt` converts `aad_domain` via
   `fedos_aead_aad_domain_to_internal` (`lib.rs:11020-11032`) to
   `crate::crypto::aead_internal::AeadAadDomain::Conversation`, draws a
   fresh nonce (`fedos_aead_nonce_96()`), and calls
   `aead_internal::seal_internal(algorithm, key.inner(), &nonce_decision,
   internal_aad_domain, plaintext)` (`lib.rs:11098-11104`).
5. `seal_internal` (§2a above) mixes `AeadAadDomain::Conversation.as_aad()`
   = `b"fedos-aead-aad-conversation-v1"` into the real
   `ChaCha20Poly1305`/`Aes256Gcm` AEAD call as `aad`.
6. The result is bridged into a real `AeadCiphertextEnvelope` (
   `aead_envelope_bridge::envelope_from_seal_decision_internal`,
   `lib.rs:11107-11114`), which — separately from the AAD byte string —
   also records `AeadEnvelopeAadDomain::Conversation` as a **structured
   field** in the envelope (its own type, §1 item 3), later serialized as
   the JSON string `"conversation"` by
   `ciphertext_serialization.rs:190-196`/`200-206`
   (`aad_domain_to_label`/`aad_domain_from_label`).

### 2c. Key derivation is domain-specific too, but only for domains with a real production keying path

The `Conversation` domain's **key itself** (not just the AAD) is already
domain-specific by construction: `FedosMasterSeedAuthority::resolve_conversation_key`
(`lib.rs:12518-12534`) derives it via a fixed chain — Master Seed →
Identity Root → Application Root → Nostr Root → per-account Nostr secret
key → secp256k1 ECDH with the counterparty's public key →
HKDF-extract (`crypto::conversation_key::derive_conversation_key_via_ecdh_internal`,
NIP-44-v2-vector-verified) — see `lib.rs:5853-5918`
(`derive_conversation_key_bytes_from_master_seed_internal`). This key
material cannot collide with any other domain's key even before AAD is
considered, because no other domain uses ECDH-with-a-counterparty at all.

**`Storage`, by contrast, has no equivalent production key-resolution
call site anywhere in `src/`.** Grep for `"Storage"` +
`aadDomain`/`AeadAadDomain` across `src/` returns only the type-union
declaration (`fedos_wasm_loader.ts:1408`) and this doc's own future
commerce file's comment quoting it — **zero real TS callers pass
`aadDomain: "Storage"` today.** `AeadAadDomain::Storage`/
`FedosAeadAadDomain::Storage` are exercised only inside `#[cfg(test)]`
modules (`aead_internal.rs:462`, `aead_envelope_bridge.rs:213-225`,
`lib.rs:15997-16002`) using an arbitrary test `SecretHandle`, never a
domain-derived one. So today, "Storage" separation is proven only at the
AAD layer (§2a), not (yet, in production) at the key-derivation layer —
this is a **pre-existing gap in the existing hierarchy**, not something a
new Commerce domain would introduce or need to fix.

## 3. How keys are actually derived per domain

Two entirely separate KDF-domain enums exist, and neither is the same
type as `AeadAadDomain`:

- **`HkdfDomain`** (`lib.rs:3508-3555`, `pub(crate)`) — the general-purpose
  per-purpose derivation-context enum for `derive_secret_handle_internal`
  (`kdf_core`, HKDF-SHA256). **Eleven variants** as of this commit:
  `RootKey`, `Identity`, `Storage`, `Conversation`, `Application`
  (Stage 1014), `Nostr` (Stage 1017), `Session`, `ATProto`, `Wallet`
  (all three Stage 1018), `DirectRatchetSealing` (Alpha 5401-5480),
  `TestOnly`. Each has its OWN fixed `salt()`/`info()` byte-string pair
  (`lib.rs:3564-3596`, e.g. `b"fedos-hkdf-salt-storage-v1"` /
  `b"fedos-hkdf-info-storage-v1"`, `b"fedos-hkdf-salt-wallet-v1"` /
  `b"fedos-hkdf-info-wallet-v1"`) — this is a genuinely **extensible,
  organically-grown hierarchy**: `Application`/`Nostr`/`Session`/
  `ATProto`/`Wallet`/`DirectRatchetSealing` were all added AFTER the
  original `RootKey`/`Identity`/`Storage`/`Conversation`/`TestOnly` five,
  each as a same-shaped new variant with its own new salt/info pair,
  with **zero change to any pre-existing variant's salt/info bytes** (per
  each addition's own doc comment, e.g. `lib.rs:3542-3551`'s
  `DirectRatchetSealing` comment: "Deliberately its own domain — this
  Arc's own secret class gets its own label, the same reason every other
  domain here has its own").
- **`AeadAadDomain`** (§1 item 1) — the AAD-context enum, deliberately a
  SEPARATE type from `HkdfDomain` even where their variant names overlap
  (`RootKey`/`Identity`/`Storage`/`Conversation`/`TestOnly`), per
  `aead_internal.rs:69-74`'s own comment: "AEAD's AAD domain and HKDF's
  salt/info domain are deliberately NOT the same type, so a future change
  to one never silently changes the other."

**Root key material**: everything ultimately traces to one Master Seed
(`FedosMasterSeedAuthority`, opaque `FedosMasterSeedHandle`), fanned out
through a fixed root hierarchy documented in
`docs/secure_runtime_alpha_142_root_hierarchy_decision.md`: Identity Root
→ Application Root → {Nostr Root, Session Root, ATProto Root, Wallet
Root, ...}. `Conversation` keys derive from the Nostr Root branch (via
ECDH, §2c). No dedicated "Storage Root" or "Commerce Root" branch exists
in this hierarchy today — `HkdfDomain::Storage`'s salt/info pair exists,
but nothing in `master_root` (the `mod master_root { ... }` block,
`lib.rs:4040`+) currently calls `derive_secret_handle_internal(..,
HkdfDomain::Storage)` from a real Root handle in production code (only
from an arbitrary test `SecretHandle` inside `#[cfg(test)]`, same pattern
as noted for the AAD side in §2c).

**Isolation vs. weaker separation**: per-domain key isolation (different
derived key, not just different AAD) is the norm for every domain that
HAS a real derivation call site (`Conversation` via ECDH+HKDF,
`DirectRatchetSealing` via `HkdfDomain::DirectRatchetSealing` +
session-tuple binding — `lib.rs:12536-12561`'s
`fedos_derive_direct_ratchet_session_sealing_key_internal`). For domains
that do NOT yet have a real production derivation call site (`Storage`,
and today's placeholder `RootKey`/`Identity`/`TestOnly` production
callers), only the AAD-level separation (§2a) is currently exercised in
production — a real key for those domains, when one exists, would come
from `AeadKeyHandle::from_random_32_bytes` fresh CSPRNG generation
(`lib.rs:11370`+, `generate_aead_key_handle`/`fedos_generate_aead_key_32`)
rather than a domain-derived key, meaning the SAME generated key COULD in
principle be reused with a different AAD domain by a caller mistake — AAD
mixing is what prevents that mistake from becoming a real cross-domain
ciphertext confusion, exactly the property AAD domain separation is
designed to guarantee even without key isolation.

## 4. What key material a new `ProductMedia`/`CommerceMedia` domain would need

The `HkdfDomain` hierarchy (§3) is **exactly** the "naturally extending,
per-purpose derivation path keyed by domain name/tag" the task asked
about — a new variant slots in the same way `Wallet`/`Session`/`ATProto`/
`DirectRatchetSealing` already did:

- Add `HkdfDomain::CommerceMedia` (or `ProductMedia`) with its own fixed
  `salt()`/`info()` pair (e.g. `b"fedos-hkdf-salt-commerce-media-v1"` /
  `b"fedos-hkdf-info-commerce-media-v1"`) — **zero change** to any
  existing variant's bytes, following the exact precedent of every prior
  addition cited in §3.
- No new ROOT key material is needed. The existing Master Seed →
  Identity Root → Application Root chain (`derive_identity_root_internal`
  / `derive_application_root_internal`, already used by every Protocol
  Root) is a ready parent; a `CommerceMedia` key would derive from
  Application Root (or directly from Identity Root, matching `Storage`'s
  existing shallow placement) exactly as `Wallet` derives from
  Application Root today (`docs/secure_runtime_alpha_153_session_atproto_wallet_root.md`'s
  own recorded precedent for a non-Protocol-Root sibling domain).
- The task's own background note is accurate as far as it goes
  ("intrinsically Conversation-shaped... keyed via
  `resolveConversationKey()`") but incomplete: `resolveConversationKey()`
  is ONE existing keying path (ECDH-pairwise), not the ONLY shape the
  hierarchy supports. `Storage`'s existing (if not yet production-wired)
  `HkdfDomain::Storage` — a plain single-input HKDF derivation, no ECDH,
  no counterparty — is the closer structural precedent for Product Media,
  since product media (like storage) has no counterparty/ratchet-session
  concept either. A `resolve_product_media_key(account_index)` function
  mirroring `Storage`'s shape (not `Conversation`'s ECDH shape) is the
  natural fit.

## 5. Does raw key material ever cross the WASM↔JS boundary?

**No, for every existing domain, and the pattern is already exactly
"opaque handle in, ciphertext out."** Evidence:

- `SecretHandle::expose_bytes_for_internal_aead` (`lib.rs:2050`) — the
  ONE accessor that ever exposes raw key bytes from a `SecretHandle` for
  AEAD use — is declared `pub(crate) fn`, never `pub`, never
  `#[wasm_bindgen]`-annotated, and is called only from
  `aead_internal.rs:173-178`'s `extract_key_bytes`, entirely inside the
  Rust crate. It is unreachable from JS/TS by construction (not by
  convention).
- `FedosAeadKeyHandle` (`lib.rs:10850-10854`) and its
  `#[wasm_bindgen]`-exported wrapper `AeadKeyHandle`
  (`lib.rs:11264-11310`) expose **no** `Clone`/`Debug`/byte-returning
  method — `AeadKeyHandle::inner()` (`lib.rs:11310`) is `pub(crate)`
  only, used solely inside `lib.rs` itself.
- `fedos_encrypt`'s own doc comment states the invariant explicitly
  (`lib.rs:11075-11076`): "Never exposes a raw key byte, a raw nonce
  byte, or any internal AEAD implementation type."
- `resolve_conversation_key` (`lib.rs:12518-12534`), the ECDH-based
  production key-resolution function, explicitly documents (comment,
  `lib.rs:12488-12490`) that it follows "the EXACT opaque-handle-in/
  opaque-handle-out pattern `generate_aead_key_handle`/`encrypt_aead`
  already establish... NO raw key byte crosses this boundary in either
  direction." Its one `String` parameter is the counterparty's
  already-public key, never secret.
- The ciphertext side is equally opaque on export: `AeadCiphertextWire`
  (`fedos_wasm_loader.ts:1435-1449`) is a branded `string`, never a raw
  key; `FedosCiphertextEnvelope` (the `pub` WASM wrapper,
  `lib.rs:11284`+) exposes ciphertext/nonce/algorithm/domain fields but
  never a key.

Since a hypothetical `resolve_product_media_key()` (§4) would follow the
exact same shape as `resolve_conversation_key()` — internal Root
derivation, then wrap the resulting 32 bytes directly into a
`SecretHandle`/`FedosAeadKeyHandle`/`AeadKeyHandle` without ever
returning them as a JS-visible value — a new domain inherits this "no raw
key crosses the boundary" property automatically; it is a structural
property of `AeadKeyHandle`'s own opacity, not something each new domain
must separately re-implement or could accidentally weaken.

## 6. Rebuild implications — verified live, this session

- **Build command** (root `package.json:19-20`):
  `cargo build --manifest-path packages/fedos-core-rust/Cargo.toml
  --target wasm32-unknown-unknown --release && wasm-bindgen --target web
  --out-dir packages/fedos-core-rust/pkg
  packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm`
  (`npm run build:wasm`), followed by `npm run build:wasm:manifest`
  (`scripts/generate_wasm_artifact_manifest.mjs`, records the WASM
  artifact's sha256).
- **Toolchain, verified installed and working in THIS environment,
  right now:**
  - `cargo --version` → `cargo 1.95.0 (f2d3ce0bd 2026-03-21)`.
  - `rustup target list --installed` → includes `wasm32-unknown-unknown`
    (and `x86_64-pc-windows-gnu`).
  - `wasm-bindgen --version` (CLI) → `wasm-bindgen 0.2.126`, exactly
    matching `Cargo.toml:284`'s pinned `wasm-bindgen = "0.2.126"`
    dependency version, per `BUILDING.md:26-30`'s stated requirement.
- **No pre-built `pkg/` artifact existed in this fresh worktree** (it is
  gitignored, per `BUILDING.md:53-58`'s documented "single most common
  false regression"). This spike performed a genuine **from-scratch
  build**: `npm run build:wasm` (with `CARGO_NET_OFFLINE=true` set)
  completed in ~36s (release profile) and produced real output —
  `packages/fedos-core-rust/pkg/fedos_core_rust.d.ts`,
  `fedos_core_rust.js`, `fedos_core_rust_bg.wasm` (385,565 bytes),
  `fedos_core_rust_bg.wasm.d.ts` — and
  `packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm`
  (475,001 bytes).
- **Zero network access required.** `cargo check --offline` (run first,
  as a fast sanity probe) and the full `npm run build:wasm` (run with
  `CARGO_NET_OFFLINE=true`) both completed successfully — every one of
  this crate's dependencies (`chacha20poly1305`, `hkdf`, `zeroize`,
  `secrecy`, `subtle`, `argon2`, `aes-gcm`, `getrandom`, `sha2`, `k256`,
  `wasm-bindgen`, plus their transitive graph) was already present in
  `~/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f`. No package
  download, no toolchain install, no model download occurred or would be
  needed to build a real `pkg/` for this repository right now.
- **`CARGO_TARGET_DIR`/OneDrive linker gotcha: NOT triggered, and not
  needed here.** This spike's worktree lives at
  `C:\wt\fedos-commerce-e2e-completion-agent-crypto\` — **not** inside
  the OneDrive-synced checkout — matching `BUILDING.md:67-70`'s own
  documented exemption: "worktrees under `C:\wt\` do not have this
  problem and don't need the override." No `CARGO_TARGET_DIR` override
  was set for either the `cargo check` or `npm run build:wasm` runs
  above, and both succeeded natively (no mingw/dlltool linker failure
  observed). This confirms the workaround is still needed only for
  OneDrive-backed paths, unchanged from every prior arc's own finding —
  it is irrelevant to this decision because this spike's (and any
  coordinator-applied) build already runs from a `C:\wt\` worktree.

## 7. Existing Rust tests for AEAD domains, and what new tests a Commerce domain would need

**Existing, found by direct inspection:**

- `packages/fedos-core-rust/src/crypto/aead_internal.rs:380-626` — 10
  `#[test]` functions, including
  `wrong_aad_domain_fails_authentication_for_both_ciphers` (line 453,
  seals under `Storage`, opens under `Conversation`, expects
  `AuthenticationFailed`) — the exact shape a new-domain cross-domain
  test would extend.
- `packages/fedos-core-rust/src/crypto/aead_envelope_bridge.rs:158-418` —
  10 `#[test]` functions, including
  `wrong_aad_domain_in_the_envelope_fails_authentication` (line 331).
- `packages/fedos-core-rust/src/lib.rs`'s own `encrypt_aead`/`decrypt_aead`
  public-API test module (from `lib.rs:15828` onward) — additional
  round-trip / wrong-key / wrong-domain coverage at the public
  `#[wasm_bindgen]` boundary, e.g. `lib.rs:14364-14419`
  (multi-account/multi-party `Conversation`-domain isolation tests).
- TypeScript-side coverage: `test/fedos_core_rust_aead_internal.test.ts`,
  `test/fedos_core_rust_aead_envelope_bridge.test.ts`,
  `test/fedos_core_rust_aead_diagnostics.test.ts`,
  `test/fedos_core_rust_public_crypto_api.test.ts`,
  `test/fedos_core_rust_public_opaque_crypto_api.test.ts`,
  `test/secure_runtime_alpha_009_encrypt_api_surface_review.test.ts`,
  `test/secure_runtime_alpha_011_encrypt_boundary_review.test.ts`,
  `test/secure_runtime_alpha_014_encrypt_opaque_handle_api.test.ts`,
  `test/secure_runtime_alpha_015_decrypt_opaque_handle_api.test.ts` (full
  list of 70 files referencing `AeadAadDomain` captured during this
  spike; these 9 are the ones directly exercising it).
- **Verified baseline this session:** `cargo test --offline` → **639
  passed, 1 failed** (the pre-existing `secp256k1_dependency_guard`
  count assertion, unrelated to AEAD — see the header of this document).
  This exact number is the regression baseline a future implementation
  must reproduce unchanged (modulo any new tests it adds, which should
  only ever ADD to the passed count, never touch the pre-existing
  failure).

**New tests a `CommerceMedia`/`ProductMedia` domain implementation would
need to add** (see §"Exact patch" below for the concrete diff):

1. **(a) Cross-domain rejection, byte-for-byte:** in
   `aead_internal.rs`'s test module, a new test seals under
   `AeadAadDomain::CommerceMedia` and attempts to open the SAME
   ciphertext under every one of the other 7 variants (`RootKey`,
   `Identity`, `Storage`, `Conversation`, `TestOnly`,
   `MasterSeedSealing`, `DirectRatchetSealing`), asserting
   `AuthenticationFailed` for every one — not just one arbitrary
   "other" domain, which is what the existing
   `wrong_aad_domain_fails_authentication_for_both_ciphers` test does
   (only `Storage`→`Conversation`). Symmetric: also seal under each of
   the 7 existing domains and confirm opening under `CommerceMedia`
   fails.
2. **(a, envelope layer)** the same test shape inside
   `aead_envelope_bridge.rs`'s test module, extending
   `wrong_aad_domain_in_the_envelope_fails_authentication`'s pattern to
   include the new `AeadEnvelopeAadDomain::CommerceMedia` variant (if the
   new domain is envelope-routed — see the patch's choice below).
3. **(b) Existing-domain regression, exact re-verification, not just
   "looks unchanged":** re-run `cargo test --offline` before and after
   the change and diff the full test name list (not just the pass
   count) — confirm the SAME 639 tests pass under the SAME names, the
   SAME 1 pre-existing failure (identical assertion message), and
   exactly the expected DELTA of new test names added, zero test names
   removed or renamed. This repo has no committed known-answer/test-vector
   file specifically for `AeadAadDomain`'s fixed AAD byte strings (they
   are plain `&'static [u8]` literals, not vector-derived) — so "exact
   re-verification" here means literal re-execution and full test-name
   diffing of the existing suite, which is achievable and is what should
   gate the change, not a "looks pre-existing" narrative.
4. A `wasm_bindgen`-boundary round-trip test (in `lib.rs`'s own
   `encrypt_aead`/`decrypt_aead` test module) using the new
   `FedosAeadAadDomain::CommerceMedia` variant, mirroring the existing
   `Storage`/`Identity` round-trip tests at `lib.rs:15990-16005`.

## 8. Compatibility/versioning

**No wire-format or persisted-data risk from appending a 6th (well,
8th/6th depending on layer) variant**, for two independent reasons:

1. **The type that is actually serialized/persisted uses STRING keys, not
   numeric discriminants.** `ciphertext_serialization.rs:190-206`
   (`aad_domain_to_label`/`aad_domain_from_label`) maps
   `AeadEnvelopeAadDomain` to/from fixed strings (`"root_key"`,
   `"identity"`, `"storage"`, `"conversation"`, `"test_only"`) as part of
   the canonical JSON + base64url wire format
   (`docs/ciphertext_serialization_format_decision.md`,
   `AeadCiphertextWire` in TS). Appending a new match arm (`"commerce_media"`
   or similar) is purely additive — insertion POSITION in the Rust enum
   declaration does not matter for this format, only the string label
   chosen, and any new label is guaranteed distinct from the 5 existing
   ones (never risk of colliding with `"storage"` etc. as long as the new
   label string is chosen deliberately).
2. **`AeadEnvelopeAadDomain` also has a numeric `as_tag()`/`from_tag()`
   pair** (`ciphertext_envelope.rs:126-140`, `RootKey=0`...`TestOnly=4`),
   which DOES fix wire order by declaration position — but this numeric
   path is used ONLY by `validate_envelope_internal`
   (`ciphertext_envelope.rs:304`+), which in turn is called ONLY from
   that module's own `#[cfg(test)]` block (confirmed by grep — zero
   production call sites anywhere in `lib.rs`, `aead_envelope_bridge.rs`,
   or `ciphertext_serialization.rs`). It is dead code on the real
   encode/decode path, so a new variant's numeric position is
   **irrelevant to any real persisted data** — but as a matter of
   discipline, any new variant should still be APPENDED at the end
   (`TestOnly` stays last, or the new variant is added after it) to
   avoid ever accidentally reordering `as_tag()` if this validator is
   ever wired up later.
3. **`FedosAeadAadDomain`** (`lib.rs:10994-11002`, the `#[wasm_bindgen]`
   type) is not itself persisted anywhere — it is a per-call function
   PARAMETER (`fedos_encrypt`/`fedos_decrypt`'s `aad_domain` argument),
   never stored, never round-tripped across a WASM-module-version
   boundary. Its declaration-order discriminant matters only within a
   single loaded WASM module's lifetime (TS calls it and Rust consumes it
   in the same call), so appending a new variant at the end changes
   nothing for the 5 existing ones' discriminants (`RootKey=0` through
   `TestOnly=4` stay fixed; the new variant becomes `5`). The TS-side
   hand-maintained `AEAD_AAD_DOMAIN_DISCRIMINANTS` object
   (`fedos_wasm_loader.ts:1420-1424`) must be updated in lockstep — this
   is a manual-sync risk (already true today, unrelated to this change:
   the file's own comment at `fedos_wasm_loader.ts:1394-1397` already
   flags this hand-mapping as "verified against the real generated
   `.d.ts` during this Stage's own build-and-inspect step," i.e. a known,
   already-accepted manual-verification discipline, not a new risk this
   change introduces).
4. **`aead_internal::AeadAadDomain`** (§1 item 1) is crate-private,
   never serialized, never crosses any boundary — pure internal
   plumbing. Zero compatibility risk from any variant-count or
   ordering change here.

**Conclusion: appending a domain variant is safe in every layer that
actually matters for wire/persisted compatibility** (the string-keyed
envelope serialization), and the one numeric-discriminant layer that
COULD matter (`AeadEnvelopeAadDomain::as_tag`) is provably unconnected
dead code today.

---

## Decision: READY TO IMPLEMENT

All required conditions are affirmatively confirmed by direct inspection
and live execution in this environment:

- Explicit domain separation is achievable (§2, §7) — AAD mixing is
  already the proven mechanism, verified by existing tests, and a new
  domain slots into the exact same mechanism.
- Zero existing-domain semantic change is required — every new variant
  is purely additive (fixed new AAD bytes, fixed new HKDF salt/info,
  appended enum arms) per the established precedent of `MasterSeedSealing`,
  `DirectRatchetSealing`, `Application`, `Nostr`, `Session`, `ATProto`,
  `Wallet` all being added this same way with zero change to prior
  variants' bytes (§3, §8).
- Byte-for-byte backward compatibility is preserved — the real
  persisted/wire format is string-keyed and purely additive (§8); the one
  numeric-discriminant path that could theoretically break is dead code
  (§8.2).
- No raw key material would reach the renderer/UI — this is a structural
  property of `AeadKeyHandle`'s existing opacity that a new domain
  automatically inherits (§5).
- Targeted Rust tests can prove separation — the exact new tests are
  specified in §7 and the diff below.
- Existing crypto tests remain green — verified baseline this session:
  639 passed / 1 pre-existing unrelated failure, reproducible right now
  in this environment (§0 header, §7).
- The WASM rebuild is achievable RIGHT NOW, deterministically, with the
  already-installed toolchain, zero network fetch, zero package/model
  download, zero system install — verified live in this session (§6).

### Exact minimal Rust diff (not applied — for the coordinator to review and apply)

This adds ONE new domain, `CommerceMedia`, following the `Storage`
precedent (no ECDH/counterparty concept, plain single-input HKDF-style
key, envelope-routed like `RootKey`/`Identity`/`Storage`/`Conversation`/
`TestOnly` — i.e. NOT following `MasterSeedSealing`/`DirectRatchetSealing`'s
"direct `seal_internal` call, no envelope" shape, since Product Media
ciphertext DOES need to be stored/transported via the normal envelope/
wire path, unlike an in-place-sealed secret).

```diff
--- a/packages/fedos-core-rust/src/crypto/aead_internal.rs
+++ b/packages/fedos-core-rust/src/crypto/aead_internal.rs
@@ pub(crate) enum AeadAadDomain {
     RootKey,
     Identity,
     Storage,
     Conversation,
     TestOnly,
     MasterSeedSealing,
     DirectRatchetSealing,
+    /// Secure Runtime [Arc TBD] — the Commerce/Product Media domain:
+    /// binds a sealed product-media ciphertext to exactly this purpose,
+    /// so it can never be swapped for, or confused with, a ciphertext
+    /// sealed under any OTHER domain even under an (implausible)
+    /// accidental key reuse. Deliberately its own domain, not a reuse
+    /// of `Storage`/`Conversation` — Product Media has no conversation,
+    /// no counterparty, and no ratchet session (closer structurally to
+    /// `Storage`), but is its own secret CLASS and gets its own label,
+    /// same reasoning as every domain above it.
+    CommerceMedia,
 }

 impl AeadAadDomain {
     const fn as_aad(self) -> &'static [u8] {
         match self {
             AeadAadDomain::RootKey => b"fedos-aead-aad-root-key-v1",
             AeadAadDomain::Identity => b"fedos-aead-aad-identity-v1",
             AeadAadDomain::Storage => b"fedos-aead-aad-storage-v1",
             AeadAadDomain::Conversation => b"fedos-aead-aad-conversation-v1",
             AeadAadDomain::TestOnly => b"fedos-aead-aad-test-only-v1",
             AeadAadDomain::MasterSeedSealing => b"fedos-aead-aad-master-seed-sealing-v1",
             AeadAadDomain::DirectRatchetSealing => b"fedos-aead-aad-direct-ratchet-sealing-v1",
+            AeadAadDomain::CommerceMedia => b"fedos-aead-aad-commerce-media-v1",
         }
     }
 }

--- a/packages/fedos-core-rust/src/crypto/ciphertext_envelope.rs
+++ b/packages/fedos-core-rust/src/crypto/ciphertext_envelope.rs
@@ pub(crate) enum AeadEnvelopeAadDomain {
     RootKey,
     Identity,
     Storage,
     Conversation,
     TestOnly,
+    CommerceMedia,
 }

 impl AeadEnvelopeAadDomain {
     const fn as_tag(self) -> u8 {
         match self {
             AeadEnvelopeAadDomain::RootKey => 0,
             AeadEnvelopeAadDomain::Identity => 1,
             AeadEnvelopeAadDomain::Storage => 2,
             AeadEnvelopeAadDomain::Conversation => 3,
             AeadEnvelopeAadDomain::TestOnly => 4,
+            AeadEnvelopeAadDomain::CommerceMedia => 5,
         }
     }

     const fn from_tag(tag: u8) -> Option<Self> {
         match tag {
             0 => Some(AeadEnvelopeAadDomain::RootKey),
             1 => Some(AeadEnvelopeAadDomain::Identity),
             2 => Some(AeadEnvelopeAadDomain::Storage),
             3 => Some(AeadEnvelopeAadDomain::Conversation),
             4 => Some(AeadEnvelopeAadDomain::TestOnly),
+            5 => Some(AeadEnvelopeAadDomain::CommerceMedia),
             _ => None,
         }
     }
 }

--- a/packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs
+++ b/packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs
@@ fn aad_domain_to_label(domain: AeadEnvelopeAadDomain) -> &'static str {
     match domain {
         AeadEnvelopeAadDomain::RootKey => "root_key",
         AeadEnvelopeAadDomain::Identity => "identity",
         AeadEnvelopeAadDomain::Storage => "storage",
         AeadEnvelopeAadDomain::Conversation => "conversation",
         AeadEnvelopeAadDomain::TestOnly => "test_only",
+        AeadEnvelopeAadDomain::CommerceMedia => "commerce_media",
     }
 }

 fn aad_domain_from_label(label: &str) -> Option<AeadEnvelopeAadDomain> {
     match label {
         "root_key" => Some(AeadEnvelopeAadDomain::RootKey),
         "identity" => Some(AeadEnvelopeAadDomain::Identity),
         "storage" => Some(AeadEnvelopeAadDomain::Storage),
         "conversation" => Some(AeadEnvelopeAadDomain::Conversation),
         "test_only" => Some(AeadEnvelopeAadDomain::TestOnly),
+        "commerce_media" => Some(AeadEnvelopeAadDomain::CommerceMedia),
         _ => None,
     }
 }

--- a/packages/fedos-core-rust/src/crypto/aead_envelope_bridge.rs
+++ b/packages/fedos-core-rust/src/crypto/aead_envelope_bridge.rs
@@ fn aad_domain_to_envelope_domain(aad_domain: AeadAadDomain) -> Option<AeadEnvelopeAadDomain> {
     match aad_domain {
         AeadAadDomain::RootKey => Some(AeadEnvelopeAadDomain::RootKey),
         AeadAadDomain::Identity => Some(AeadEnvelopeAadDomain::Identity),
         AeadAadDomain::Storage => Some(AeadEnvelopeAadDomain::Storage),
         AeadAadDomain::Conversation => Some(AeadEnvelopeAadDomain::Conversation),
         AeadAadDomain::TestOnly => Some(AeadEnvelopeAadDomain::TestOnly),
         AeadAadDomain::MasterSeedSealing => None,
         AeadAadDomain::DirectRatchetSealing => None,
+        AeadAadDomain::CommerceMedia => Some(AeadEnvelopeAadDomain::CommerceMedia),
     }
 }

 fn envelope_domain_to_aad_domain(aad_domain: AeadEnvelopeAadDomain) -> AeadAadDomain {
     match aad_domain {
         AeadEnvelopeAadDomain::RootKey => AeadAadDomain::RootKey,
         AeadEnvelopeAadDomain::Identity => AeadAadDomain::Identity,
         AeadEnvelopeAadDomain::Storage => AeadAadDomain::Storage,
         AeadEnvelopeAadDomain::Conversation => AeadAadDomain::Conversation,
         AeadEnvelopeAadDomain::TestOnly => AeadAadDomain::TestOnly,
+        AeadEnvelopeAadDomain::CommerceMedia => AeadAadDomain::CommerceMedia,
     }
 }

--- a/packages/fedos-core-rust/src/lib.rs
+++ b/packages/fedos-core-rust/src/lib.rs
@@ pub enum FedosAeadAadDomain {
     RootKey,
     Identity,
     Storage,
     Conversation,
     TestOnly,
+    CommerceMedia,
 }
 // ... fedos_aead_aad_domain_to_internal gains:
 //   FedosAeadAadDomain::CommerceMedia => crate::crypto::aead_internal::AeadAadDomain::CommerceMedia,

@@ pub(crate) enum HkdfDomain {
     RootKey, Identity, Storage, Conversation, Application, Nostr, Session,
     ATProto, Wallet, DirectRatchetSealing, TestOnly,
+    /// Secure Runtime [Arc TBD] — Commerce/Product Media key derivation.
+    /// No counterparty/ECDH concept (matches `Storage`'s shape, not
+    /// `Conversation`'s) — a plain per-account HKDF derivation from the
+    /// Application Root.
+    CommerceMedia,
 }
 // salt()/info() gain:
 //   HkdfDomain::CommerceMedia => b"fedos-hkdf-salt-commerce-media-v1",
 //   HkdfDomain::CommerceMedia => b"fedos-hkdf-info-commerce-media-v1",

+// New production key-resolution function, mirroring
+// `resolve_conversation_key` (lib.rs:12518-12534) but WITHOUT the ECDH
+// step (no counterparty) — mirrors `Storage`'s shape instead:
+// pub fn resolve_commerce_media_key(&self, account_index: u32) -> Option<AeadKeyHandle> {
+//     let key_bytes = self.with_master_seed(|handle| {
+//         crate::master_root::derive_commerce_media_key_bytes_from_master_seed_internal(handle, account_index)
+//     })?;
+//     let inner = secret_handle::SecretHandle::new_from_32_bytes_for_internal_use(
+//         secret_handle::SecretHandleKind::AeadKeyMaterial,
+//         key_bytes,
+//     );
+//     Some(AeadKeyHandle { inner: FedosAeadKeyHandle { inner } })
+// }
+// (derive_commerce_media_key_bytes_from_master_seed_internal itself:
+// Identity Root -> Application Root -> derive_secret_handle_internal(application_root, HkdfDomain::CommerceMedia)
+// -> expose bytes -> return, mirroring derive_conversation_key_bytes_from_master_seed_internal's
+// clear()-after-each-step discipline exactly, minus the ECDH/Nostr-root/counterparty steps.)
```

**TS-side companion diff** (not applied; `fedos_wasm_loader.ts`, once the
`.d.ts` is regenerated by the real build):

```diff
-export type AeadAadDomain = "RootKey" | "Identity" | "Storage" | "Conversation" | "TestOnly";
+export type AeadAadDomain = "RootKey" | "Identity" | "Storage" | "Conversation" | "TestOnly" | "CommerceMedia";

 const AEAD_AAD_DOMAIN_DISCRIMINANTS: Readonly<Record<AeadAadDomain, number>> = {
   RootKey: 0,
   Identity: 1,
   Storage: 2,
   Conversation: 3,
   TestOnly: 4,
+  CommerceMedia: 5,
 };
```

### Exact new Rust tests to add

In `packages/fedos-core-rust/src/crypto/aead_internal.rs`'s `mod tests`:

```rust
#[test]
fn commerce_media_domain_is_isolated_from_every_other_domain() {
    const ALL_DOMAINS: [AeadAadDomain; 8] = [
        AeadAadDomain::RootKey,
        AeadAadDomain::Identity,
        AeadAadDomain::Storage,
        AeadAadDomain::Conversation,
        AeadAadDomain::TestOnly,
        AeadAadDomain::MasterSeedSealing,
        AeadAadDomain::DirectRatchetSealing,
        AeadAadDomain::CommerceMedia,
    ];
    for algorithm in [AeadCipher::ChaCha20Poly1305, AeadCipher::Aes256Gcm] {
        let key = test_key();
        let nonce = ready_nonce();
        let sealed = seal_internal(
            algorithm, &key, &nonce, AeadAadDomain::CommerceMedia, TEST_PLAINTEXT,
        );
        let ciphertext = sealed.ciphertext.expect("Ready seal must carry ciphertext");
        for &other_domain in ALL_DOMAINS.iter().filter(|d| **d != AeadAadDomain::CommerceMedia) {
            let opened = open_internal(algorithm, &key, &nonce, other_domain, &ciphertext);
            assert_eq!(
                opened.status, AeadStatus::AuthenticationFailed,
                "CommerceMedia ciphertext must not authenticate under {other_domain:?}"
            );
        }
        // And the reverse: sealed under CommerceMedia opens ONLY under CommerceMedia.
        let reopened = open_internal(algorithm, &key, &nonce, AeadAadDomain::CommerceMedia, &ciphertext);
        assert_eq!(reopened.status, AeadStatus::Ready);
        assert_eq!(reopened.plaintext.as_deref(), Some(TEST_PLAINTEXT));
    }
}
```

In `packages/fedos-core-rust/src/crypto/aead_envelope_bridge.rs`'s `mod tests`
(envelope-layer equivalent, mirroring
`wrong_aad_domain_in_the_envelope_fails_authentication` but against
`CommerceMedia`):

```rust
#[test]
fn commerce_media_envelope_domain_fails_authentication_against_every_existing_domain() {
    let key = test_key();
    let nonce = ready_nonce();
    let nonce_bytes = nonce.nonce.expect("Ready nonce decision must carry bytes");
    let sealed = seal_internal(
        AeadCipher::ChaCha20Poly1305, &key, &nonce, AeadAadDomain::CommerceMedia, TEST_PLAINTEXT,
    );
    let envelope = envelope_from_seal_decision_internal(sealed, nonce_bytes, AeadAadDomain::CommerceMedia)
        .expect("Ready seal decision must bridge to an envelope");
    for other in [
        AeadEnvelopeAadDomain::RootKey,
        AeadEnvelopeAadDomain::Identity,
        AeadEnvelopeAadDomain::Storage,
        AeadEnvelopeAadDomain::Conversation,
        AeadEnvelopeAadDomain::TestOnly,
    ] {
        let tampered = AeadCiphertextEnvelope::new_with_ciphertext_for_internal_use(
            envelope.version(), envelope.algorithm(), envelope.nonce(), other, envelope.ciphertext().to_vec(),
        );
        let opened = open_decision_from_envelope_internal(&tampered, &key);
        assert_eq!(opened.status, AeadStatus::AuthenticationFailed);
    }
}
```

In `packages/fedos-core-rust/src/crypto/ciphertext_serialization.rs`'s
`mod tests` (round-trip the new string label):

```rust
#[test]
fn commerce_media_domain_label_round_trips() {
    assert_eq!(aad_domain_to_label(AeadEnvelopeAadDomain::CommerceMedia), "commerce_media");
    assert_eq!(aad_domain_from_label("commerce_media"), Some(AeadEnvelopeAadDomain::CommerceMedia));
}
```

Plus, as a mandatory gate (not a "new test" per se, but a required
verification step): `cargo test --offline` (full suite) re-run, diffed by
exact test NAME list against this document's recorded baseline (639
passed / 1 pre-existing failure) — confirm the same 639 names still pass,
the same 1 failure is still the identical
`secp256k1_dependency_guard` assertion, and the new tests above (plus any
`lib.rs`-level `encrypt_aead`/`decrypt_aead` round-trip test for
`FedosAeadAadDomain::CommerceMedia`, mirroring `lib.rs:15990-16005`'s
existing `Storage` case) are the ONLY new passing test names.

---

### What this document does NOT decide

This spike is scoped to the crypto/domain-separation question only. It
does not decide: whether `CommerceMedia` should be envelope-routed (this
document's diff assumes yes, matching `Storage`) or direct-sealed like
`MasterSeedSealing`/`DirectRatchetSealing`; the exact TS-side
`ProductMediaEncryptionPort` adapter implementation that would consume
`resolve_commerce_media_key`/`encrypt`/`decrypt`; or account-index
sourcing for a per-merchant/per-account commerce media key (the sketch
above takes `account_index: u32` as a parameter, mirroring every other
Root-derived key function, but does not resolve what value Commerce's
own domain code should pass). Those remain implementation-time decisions
for whoever picks up the patch above — this document only establishes
that the crypto primitive itself is safe to extend.

---

## Commerce Durability + Protected-Media Entitlement + Packaged-E2E FINAL Closure arc update (current, additive)

**The remaining "who is allowed to decrypt" question this document deliberately left open is now closed, one layer up.** `resolveCommerceMediaKey()` remains exactly what this document decided it should be: a real, per-PROFILE (not per-purchase) AEAD key — that has NOT changed, and a holder of the profile Master Seed can still, by itself, derive it. What is new: `src/os/commerce/media_grant/` adds a `MediaAccessGrant` layer strictly ABOVE this primitive, never modifying it — a real purchase-bound authorization gate (buyer+media+qualifying-Order+time-window, signed, revocable) that a caller must independently satisfy before the release path (`wrapMediaAccessGrantRelease()`/`unwrapMediaAccessGrantRelease()`) will hand over anything, reusing the codebase's existing NIP-44/ECDH primitive (`FedosMasterSeedAuthority.encryptNip44Wire`) — not a new cryptographic mechanism.

**Disclosed limitation, precisely scoped:** this pass could NOT implement the fully portable "separate per-media symmetric content key, wrapped for the buyer" design this document's own "what this document does NOT decide" section gestured at — `fedos_runtime_encrypt.ts`'s own hard guardrail (`encrypt()` never accepts a raw-byte key, only an opaque `AeadKeyHandle` derived from the Master Seed) makes a JS-generated content key unable to decrypt existing `CommerceMedia` ciphertext on a different device without new Rust/WASM surface. The wrap therefore currently covers the release payload directly (bounded to 64 KiB), not an independently portable content key — a real, disclosed, named follow-up, not a silent shortcut.

**No live IPC handler exists yet in the shipped app to consume this grant** — Product Media's own download/decrypt path was never reachable from the renderer before this arc either (same "real capability, not yet wired to a composition-root consumer" posture Order/Delivery/Reputation each had before their own respective wiring arcs).
