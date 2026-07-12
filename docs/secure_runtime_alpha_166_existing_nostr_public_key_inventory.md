# Secure Runtime Alpha 166 — Existing Nostr Public Key Inventory

**Status: this Stage is DESIGN / DECISION ONLY. It makes NO code
change of any kind — no `src/` file, no `packages/` file, is modified.
This is Stage 1 of the Alpha 166–170 Deterministic Nostr Public Key
Derivation Arc, following the completed Deterministic Nostr Secret Key
Derivation Arc (Alpha 161–165), which confirmed
`FedosNostrSecretKeyHandle`/`derive_nostr_secret_key_internal` already
provide a real, deterministic, Account-indexed Nostr secret key.**

## 1. Why now

Before deriving a Nostr public key FROM the Nostr Secret Key, this
Stage inventories what ALREADY EXISTS in the actual source — no
assumption, no guess. Every claim below is grounded in a concrete file
path, verified directly against the current repository state,
including one EMPIRICAL compile-time probe (§2.7) rather than
documentation alone.

## 2. Inventory

### 2.1 Reusable `k256` types

`packages/fedos-core-rust/src/crypto/conversation_key.rs` already
imports and uses `k256::{AffinePoint, EncodedPoint, ProjectivePoint,
SecretKey}` under this crate's existing `default-features = false,
features = ["arithmetic"]` `k256` dependency (Alpha 161 §2.1,
unchanged). `k256::PublicKey` is NOT imported anywhere in this crate
today, but — confirmed by §2.7's compile probe — is fully available
under the SAME `arithmetic`-only feature set, no `Cargo.toml` change
required.

### 2.2 `k256::schnorr::VerifyingKey` — gated behind an UNENABLED feature

`k256::schnorr` requires `k256`'s own `schnorr` Cargo feature, which
`Cargo.toml`'s own comment record (Stage 194) explicitly and
deliberately excludes: "`schnorr` (BIP-340, a separate future
Nostr-signing candidate, not this one)". Enabling it would be a
`Cargo.toml` feature-shape change — the SAME category of change this
crate's own "one dependency/feature change per reviewed Stage"
discipline (`docs/rust_dependency_adoption.md` §12) gates — and is
therefore OUT OF SCOPE for this Arc, which this Stage flags rather
than silently works around.

### 2.3 SEC1 compressed public key vs. x-only public key

A SEC1 COMPRESSED public key is 33 bytes: a 1-byte parity tag
(`0x02`/`0x03`) followed by the 32-byte X coordinate. An X-ONLY public
key (BIP-340's own convention) is JUST the 32-byte X coordinate — no
parity tag, no Y coordinate — with verification implicitly assuming an
EVEN-Y point (the "lift_x" convention). The two are trivially related:
compress the full point, then discard the leading parity-tag byte.

### 2.4 Nostr's own required public key format — CONFIRMED x-only

`src/nostr/types.ts`'s own `NostrEvent.pubkey` field doc comment states
verbatim: "32-byte lowercase hex secp256k1 **x-only** public key of
the author." `src/nostr/event.ts`'s `validateEventStructure` enforces
exactly 64 hex characters (32 bytes) for `pubkey`. This is definitive,
first-party confirmation — Nostr requires the x-only 32-byte form, NOT
the 33-byte SEC1 compressed form.

### 2.5 `src/nostr/crypto.ts` / `src/nostr/noble_signature.ts` — unchanged since Alpha 161

Both remain hashing/verification-only (Alpha 161 §2.4/§2.5,
reconfirmed here): no key generation, no public-key derivation, no
signing, anywhere in `src/nostr/`.

### 2.6 Existing Rust public-key generation / verification code

No production code anywhere in `packages/fedos-core-rust/src/`
generates a NEW public key FROM a secret key today.
`crypto::conversation_key::derive_conversation_key_via_ecdh_internal`
CONSUMES an externally-supplied public key (lifting a 32-byte x-only
`pub2` to a full curve point via a `0x02` SEC1 tag, Alpha 161 §2.14) —
the REVERSE direction of what this Arc needs, but it confirms the
EXACT SAME even-Y/x-only convention this Arc's own derivation must
follow for symmetry (a key this crate itself produces must be liftable
by that same existing consumer code).

### 2.7 Empirical compile probe — `SecretKey::public_key()` under `arithmetic`-only

A temporary `#[cfg(test)]` module (never committed) was added to and
compiled against this crate's ACTUAL, unmodified `Cargo.toml`,
confirming — by real `cargo check --tests` success, not documentation
— that ALL of the following compile under the existing
`arithmetic`-only `k256` feature set, with ZERO `Cargo.toml` change:

```rust
let sk = SecretKey::from_slice(&bytes).unwrap();
let pk: PublicKey = sk.public_key();
let encoded = pk.to_encoded_point(true); // SEC1 compressed, 33 bytes
let x_only: [u8; 32] = encoded.x().unwrap().as_slice().try_into().unwrap();
```

`SecretKey::public_key()` performs exactly "scalar × generator point"
— the manual `ProjectivePoint::GENERATOR * scalar` equivalent was ALSO
confirmed to compile identically, confirming `.public_key()` is not a
disguised additional-feature convenience wrapper, just this crate's
own already-available arithmetic, packaged.

### 2.8 `SecretHandle` internal-value access pattern

Every Root/Key Handle type in `master_root` reaches its own
`SecretHandle`'s bytes via exactly ONE narrowly-named, crate-private
accessor per NEW consuming stage (Alpha 161 §2.10, unchanged):
`expose_bytes_for_internal_derivation` /
`expose_bytes_for_internal_aead` / `expose_bytes_for_internal_ecdh` /
`expose_bytes_for_internal_nostr_secret_key_derivation`. This Arc adds
ONE more, named for its own sole caller, following the identical
pattern (Alpha 169).

### 2.9 `zeroize` and constant-time comparison — confirmed required only for the SECRET side

The transient secret-scalar bytes THIS Arc's own derivation copies out
of `FedosNostrSecretKeyHandle` must be `zeroize()`-d, exactly like
every prior transient secret copy in this crate. The resulting PUBLIC
key bytes are, definitionally, not secret — `docs/crypto_test_vectors.md`
and `docs/secret_lifecycle_implementation_plan.md` scope `zeroize`
strictly to SECRET material; no existing convention in this crate
zeroizes non-secret data. Constant-time comparison
(`subtle::ConstantTimeEq`) is likewise not a SECURITY requirement for
public data (no timing side-channel exists to protect), but Alpha 168
§4 records the decision to reuse it anyway, for ONE uniform
comparison convention across every Handle type in this module.

### 2.10 Existing Nostr Public Key type / codec — does not exist

No `FedosNostrPublicKeyHandle`, no public-key-shaped type, and no hex/
bech32/`npub` codec of any kind exists anywhere in this crate or in
`src/` today — confirmed by `grep`.

## 3. Answers to the seven required questions

1. **Reusable `k256` types?** `k256::SecretKey` (already used),
   `k256::PublicKey` (new use, zero `Cargo.toml` change, confirmed
   §2.7), `k256::EncodedPoint`'s `.x()` accessor for x-only extraction.
2. **Final type Nostr requires?** A 32-byte x-only public key (§2.4) —
   definitively NOT the 33-byte SEC1 compressed form.
3. **SEC1 → x-only conversion?** `PublicKey::to_encoded_point(true)`
   (compressed SEC1) then `.x()`, discarding the leading parity-tag
   byte (§2.3/§2.7).
4. **Is a new dependency needed?** No — confirmed empirically (§2.7),
   not merely asserted. `k256::schnorr` (§2.2) would need a NEW
   Cargo feature, but this Arc does not use it.
5. **Can the public key be derived without exposing secret bytes
   outside `master_root`?** Yes — the SAME narrow-accessor-plus-
   transient-zeroize pattern every prior stage already uses (§2.8/§2.9).
6. **Does existing Nostr TypeScript code generate or verify?**
   Verify only (§2.5), unchanged since Alpha 161.
7. **Does the public key need to be held as an internal Rust Handle?**
   Per this Arc's own Objective (Alpha 168), yes — an Opaque Handle,
   for boundary-design consistency, even though the value itself is
   not secret.

No new dependency is needed — this Stage does NOT halt implementation.

## 4. What this Stage does NOT do

- Does **not** modify any `src/` or `packages/` file — zero code
  change of any kind. The §2.7 compile probe was added, compiled,
  observed, and then fully reverted (`git checkout --`) before this
  Stage's own doc was written — confirmed by zero diff.
- Does **not** decide the Nostr Public Key Representation approach —
  that is Alpha 167's own deliverable.
- Does **not** implement public-key derivation, `npub`/`nsec` encoding,
  Schnorr signing, or any Relay/Event code.
- Does **not** modify `create_runtime.ts`, `types.ts`, `AppRuntime`,
  `worker.ts`, `src/identity/*`, Storage, Observation, Rust,
  `Cargo.toml`, or `package.json`.

## 5. See also

- `docs/secure_runtime_alpha_161_existing_nostr_key_inventory.md`
- `docs/secure_runtime_alpha_165_nostr_secret_key_derivation_completion.md`
- `docs/nip44_internal_plan.md`
