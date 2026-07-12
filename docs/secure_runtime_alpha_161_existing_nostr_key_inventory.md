# Secure Runtime Alpha 161 — Existing secp256k1 / Nostr Key Inventory

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 1 of the Alpha 161–165 Deterministic Nostr Secret Key
Derivation Arc, following the completed Nostr Root Foundation Arc
(Alpha 156–160), which confirmed `FedosProtocolRootHandle`/
`derive_nostr_root_internal` already provide a real, deterministic
Nostr Root.**

## 1. Why now

Before deriving a Nostr secret key FROM the Nostr Root, this Stage
inventories what ALREADY EXISTS in the actual source — no assumption,
no guess. Every claim below is grounded in a concrete file path and
line reference, verified directly against the current repository
state.

## 2. Inventory

### 2.1 secp256k1 crate — `k256`, already adopted, `arithmetic`-only

`packages/fedos-core-rust/Cargo.toml` — `k256 = { version = "0.13",
default-features = false, features = ["arithmetic"] }` (Stage 194).
No `ecdsa`, `schnorr`, `serde`, `pem`, or `pkcs8` feature is enabled.
`crypto::secp256k1_dependency_guard` (`#[cfg(test)]`-only) asserts this
exact shape stays fixed. No `rust-secp256k1`/C-FFI dependency exists.

### 2.2 Reusable secp256k1 types

`packages/fedos-core-rust/src/crypto/conversation_key.rs` already
imports and uses:

- `k256::SecretKey` — via `SecretKey::from_slice(&bytes)`
  (`conversation_key.rs:257`), the crate's existing constant-time
  validation that 32 candidate bytes form a valid, non-zero,
  in-range secp256k1 scalar. `Ok(key)` yields `key.to_nonzero_scalar()`;
  `Err(_)` is the crate's existing rejection path.
- `k256::{AffinePoint, EncodedPoint, ProjectivePoint}` — used only for
  ECDH shared-point arithmetic (public-key lifting/multiplication), not
  needed for a secret-key-only derivation.

No `k256::Scalar` type is imported directly anywhere in this crate —
`SecretKey`/`NonZeroScalar` (via `SecretKey::to_nonzero_scalar()`) is
the ONLY secp256k1 scalar-shaped type this crate's existing code
touches. This is the type this Arc reuses.

### 2.3 `SigningKey`/`Scalar`-equivalent — none beyond `SecretKey`

No `k256::ecdsa::SigningKey`, `k256::schnorr::SigningKey`, or manual
`Scalar::from_repr` call exists anywhere in `packages/fedos-core-rust/src`
— confirmed by `grep`. `k256::SecretKey::from_slice` (2.2) is the one
and only existing scalar-validation entry point.

### 2.4 `src/nostr/crypto.ts` — hashing only, no keygen

Hashes (`webCryptoSha256Hex`, WebCrypto SHA-256) and a length-constant
hex compare (`constantTimeHexEqual`). No key generation, no signing, no
private-key handling of any kind.

### 2.5 `src/nostr/noble_signature.ts` — verification only, no signing

`NobleSignatureVerifier` uses `@noble/curves/secp256k1`'s `schnorr.verify`
to check a NIP-01 event's Schnorr signature against its `pubkey`. Its
own header comment states plainly: "This module verifies only; it
never signs. No private keys are involved." No `schnorr.sign`, no
`utils.randomPrivateKey`, no key generation call exists in this file
or anywhere else in `src/nostr/`.

### 2.6 Rust-side signing/keygen code — does not exist

No `sign`, `schnorr`, `generateSecretKey`-equivalent, or keypair-
generation function exists anywhere in
`packages/fedos-core-rust/src/`. `crypto::conversation_key`'s ECDH
pipeline (Stage 199) consumes externally-supplied
`SecretHandleKind::NostrKeyMaterial` input — it never generates a key
itself.

### 2.7 Existing Nostr secret-key generation — does not exist

Confirms and extends Alpha 141 §2.10's own finding, unchanged since:
no Nostr secret-key generation exists anywhere in this repository. The
Nostr Root chain added since Alpha 141 (`FedosProtocolRootHandle`,
`derive_nostr_root_internal`, Alpha 151–160) stops at the Root level —
none of those five Arcs' Stages derives a secret key FROM the Root.

### 2.8 Existing public-key generation — does not exist

No secp256k1 public-key derivation (point multiplication of a secret
scalar by the generator point) exists in production code anywhere in
this crate. `crypto::conversation_key` computes a *shared* ECDH point
from an EXTERNALLY-supplied public key input — it never derives a
public key FROM a secret key.

### 2.9 `nsec`/`npub` codec — does not exist

No bech32, `nsec`, or `npub` encode/decode function exists anywhere in
`src/` or `packages/fedos-core-rust/src/`. Confirms Alpha 141's own
finding, unchanged.

### 2.10 `SecretHandle`/Opaque Handle convention

`secret_handle::SecretHandle` (`lib.rs:1888`, unchanged position class)
— `pub(crate)` only, no `Clone`, no `Debug`-over-raw-bytes, no public
raw-byte getter; every consumer stage adds its OWN narrowly-named
`expose_bytes_for_internal_*` accessor
(`expose_bytes_for_internal_derivation`,
`expose_bytes_for_internal_aead`, `expose_bytes_for_internal_ecdh`).
Every Root Handle in `master_root` (`FedosMasterSeedHandle`,
`FedosIdentityRootHandle`, `FedosApplicationRootHandle`,
`FedosProtocolRootHandle`) wraps exactly one `SecretHandle` field and
exposes `kind()`/`is_cleared()`/`clear()`/
`matches_for_internal_verification()` only — this Arc's own
`FedosNostrSecretKeyHandle` (Alpha 163) follows this exact convention.

### 2.11 `zeroize` convention

Every real secret buffer in this crate is either wrapped in
`secrecy::SecretBox` (`SecretHandle`'s own payload) or an explicit
`[u8; 32]` local that is `.zeroize()`-d on every return path
(`derive_identity_root_internal`, `derive_protocol_root_internal`,
`derive_conversation_key_via_ecdh_internal`, etc.) — this Arc's own
`derive_nostr_secret_key_internal` (Alpha 164) follows this exact
convention for its own transient root-bytes copy and HKDF-candidate
buffer.

### 2.12 Constant-time comparison convention

`subtle::ConstantTimeEq` (`.ct_eq(...)`), confined to the `master_root`
module for Root Handle comparison (`matches_for_internal_verification`)
and to `crypto::nip44_hmac` for MAC verification — never a plain `==`
over secret bytes. This Arc's own
`FedosNostrSecretKeyHandle::matches_for_internal_verification`
(Alpha 163) reuses this exact pattern, in `master_root`.

### 2.13 Account Index — no existing representation

No `AccountIndex` type, and no `.to_be_bytes()`-encoded index of any
kind, exists anywhere in `packages/fedos-core-rust/src/` today — `grep`
confirms zero matches. `docs/secure_runtime_alpha_143_domain_separation_decision.md`
§3 already fixed the RULE (fixed-width big-endian `u32`, never ASCII
decimal) for whenever this gap is filled; this Arc is the first Stage
to actually fill it, for the Nostr Secret Key level specifically.

### 2.14 `HkdfDomain`/domain separation convention

`HkdfDomain` (`lib.rs`, `kdf_core` module) is a closed, ten-variant
enum, each with its own fixed, compile-time `&'static [u8]` salt/info
pair, in the form `b"fedos-hkdf-salt-{domain}-v1"` /
`b"fedos-hkdf-info-{domain}-v1"`. Its `info()` is a FIXED constant per
variant — there is no parameter slot for a caller-varying suffix (e.g.
an Account Index), so `kdf_core::derive_secret_handle_internal` cannot,
by itself, express an Account-Index-separated derivation.
`crypto::conversation_key::derive_conversation_key_via_ecdh_internal`
(Stage 199) already establishes the existing precedent for bypassing
this fixed-domain bridge: it calls `Hkdf::<Sha256>::extract` directly,
with its own fixed `"nip44-v2"` salt, rather than going through
`HkdfDomain`. This Arc's own `derive_nostr_secret_key_internal`
(Alpha 164) follows that SAME precedent — a direct `Hkdf::<Sha256>`
call with its own fixed salt and an Account-Index-appended `info` — the
minimal way to add index parameterization without modifying the shared
`kdf_core`/`HkdfDomain` bridge every other Root derivation in this
crate already depends on.

## 3. Answers to the five required questions

1. **Which reusable secp256k1 type?** `k256::SecretKey`, via
   `SecretKey::from_slice(&candidate_bytes)` — the exact validation
   `crypto::conversation_key` already performs on its own `sec1` input
   (2.2/2.3).
2. **Is a new dependency needed?** No.
3. **Is this implementable with existing dependencies alone?** Yes —
   `k256` (already `arithmetic`-featured), `hkdf`, `sha2`, `zeroize`,
   `subtle` are all already production dependencies and already used
   for structurally identical purposes elsewhere in this crate.
4. **Existing policy when a secret-key candidate is an invalid
   scalar?** `crypto::conversation_key::derive_conversation_key_via_ecdh_internal`
   already establishes the ONLY existing precedent: attempt
   `SecretKey::from_slice`, and on `Err(_)`, fail closed to a dedicated
   `InvalidKey`-shaped status with `output: None` — never a panic,
   never a retry, never a hand-rolled modular reduction. This Arc's own
   Alpha 164 Stage adopts this exact policy (see Alpha 162 §5 and
   Alpha 164 §4 for the formal comparison).
5. **Is the current Nostr code verification-only, or does it also hold
   keys?** Verification-only, confirmed by 2.4/2.5/2.6/2.7 above — no
   file anywhere in this repository generates, holds, imports, or
   exports a Nostr secret key today.

## 4. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind.
- Does **not** decide the Nostr Account Derivation approach — that is
  Alpha 162's own deliverable.
- Does **not** implement Nostr secret-key derivation, public-key
  derivation, `npub`/`nsec` encoding, or any cryptography.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, Storage, Observation, Rust,
  `Cargo.toml`, or `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_141_existing_secret_kdf_inventory.md`
- `docs/secure_runtime_alpha_143_domain_separation_decision.md`
- `docs/secure_runtime_alpha_144_recovery_threat_model_decision.md`
- `docs/secure_runtime_alpha_160_integration_completion.md`
- `docs/nip44_internal_plan.md`
