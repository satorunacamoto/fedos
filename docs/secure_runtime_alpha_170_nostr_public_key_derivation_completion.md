# Secure Runtime Alpha 170 — Nostr Public Key Derivation Completion

**Status: this Stage is REVIEW ONLY — it adds test coverage
(`packages/fedos-core-rust/src/lib.rs`'s own `#[cfg(test)]` module,
landed alongside Alpha 168/169's implementation in the same file edit)
but makes NO further production-code change. This is Stage 5, the
closing Stage, of the Alpha 166–170 Deterministic Nostr Public Key
Derivation Arc.**

## 1. Why now

Alpha 166 inventoried, Alpha 167 decided, Alpha 168 added the Handle,
Alpha 169 added the derivation function. This Stage verifies, by real
execution, that every property this Arc's own Objective required
actually holds, reviews this Arc's own Protocol Extensibility
question, and issues the Arc's own closing Completion Declaration.

## 2. Verification performed (real execution, `master_root::tests`)

- **Same Master Seed + same Account Index → same Nostr Secret Key →
  same Nostr Public Key:**
  `same_secret_key_content_derives_matching_public_keys` derives the
  SAME Account Index twice under the SAME Nostr Root and confirms the
  resulting public keys match via
  `matches_for_internal_verification`.
- **Same Master Seed + different Account Index → different Nostr
  Public Key:**
  `different_account_indices_derive_non_matching_public_keys` confirms
  account `0` and account `1` under the SAME Nostr Root produce
  non-matching public keys.
- **Different Master Seed + same Account Index → different Nostr
  Public Key:**
  `different_master_seeds_and_same_account_index_derive_non_matching_public_keys`
  builds two independent `Master Seed → Identity Root → Application
  Root → Nostr Root → Nostr Secret Key` chains from two different
  Master Seed byte patterns, derives account `0` public keys under
  each, and confirms they never match.
- **Account 0 / 1 / `u32::MAX`:**
  `account_index_zero_one_and_u32_max_all_derive_public_keys_successfully_and_distinctly`
  confirms all three derive successfully and are pairwise
  non-matching.
- **No panic in public key derivation:** confirmed by direct source
  inspection of `derive_nostr_public_key_internal`'s own body — no
  `.unwrap()`, `.expect()`, or `panic!()` on any path (Alpha 169 §5).
- **No Secret Key raw byte getter exists:** confirmed by direct source
  inspection — `FedosNostrSecretKeyHandle`'s own public(crate) method
  set is UNCHANGED from Alpha 163/165's own closing state (`kind()`,
  `is_cleared()`, `clear()`, `matches_for_internal_verification()`);
  this Arc adds exactly one crate-private (never `pub(crate)`)
  accessor, `expose_bytes_for_internal_public_key_derivation`, with a
  single caller.
- **No `wasm_bindgen` on the Public Key Handle:** the crate's own
  total `#[wasm_bindgen]` annotation count remains fixed at **13** —
  zero added by this whole Arc.
- **Unreachable from TypeScript/Desktop/Runtime:** `master_root`
  remains a plain (non-`pub`) module; this Arc touches ONLY
  `packages/fedos-core-rust/src/lib.rs` — no `src/` file is modified by
  any of its five Stages.
- **`npub`/`nsec`/signature/Event/Relay remain unimplemented:**
  confirmed by direct source inspection — no bech32 codec, no Schnorr
  signing function, no Nostr event construction, no WebSocket/Relay
  connection exists anywhere in this crate.

## 3. The Foundation, confirmed complete

```rust
FedosMasterSeedHandle       (Alpha 146)
        │  derive_identity_root_internal        (Alpha 147, HkdfDomain::Identity)
        ↓
FedosIdentityRootHandle     (Alpha 147)
        │  derive_application_root_internal      (Alpha 148, HkdfDomain::Application)
        ↓
FedosApplicationRootHandle  (Alpha 148)
        │  derive_nostr_root_internal             (Alpha 152, HkdfDomain::Nostr)
        ↓
FedosProtocolRootHandle     (the Nostr Root instance — Alpha 151/152)
        │  derive_nostr_secret_key_internal(account_index)   (Alpha 164, direct HKDF)
        ↓
FedosNostrSecretKeyHandle   (Account-indexed Nostr Secret Key — Alpha 163/164)
        │  derive_nostr_public_key_internal                  (Alpha 169, k256 SecretKey::public_key())
        ↓
FedosNostrPublicKeyHandle   (32-byte x-only Nostr Public Key — Alpha 168/169)
```

Zero new cryptographic algorithm across the whole chain: HKDF-SHA256
(RFC 5869) through the Secret Key, then `k256`'s own existing
"scalar × generator point" operation (`SecretKey::public_key()`) for
the Public Key — the SAME `k256` `arithmetic`-feature primitive
`crypto::conversation_key` already uses for its own ECDH computation,
confirmed to require zero new Cargo dependency or feature (Alpha 166
§2.7, an empirical compile probe, not a documentation claim).

## 4. Protocol Extensibility Review

Per this Arc's own instruction, the COMMON derivation pattern and the
Nostr-SPECIFIC key type are explicitly reviewed for what generalizes
and what must not:

**Common across any future protocol** (Session/ATProto/Wallet): Master
Seed, Identity Root, Application Root, Protocol Root, Account Index
encoding (fixed-width big-endian `u32`, Alpha 143), the Opaque
Secret-Handle-wrapping pattern, the "deterministic function of Root +
Account Index" derivation shape, and the Recovery/Threat-Model
guarantees Alpha 144 already established for this ENTIRE hierarchy —
none of these are Nostr-specific; every one of them was already
protocol-agnostic before this Arc began.

**Nostr-specific, NOT reusable as-is by a different protocol:** the
secp256k1 X-ONLY (32-byte) public key representation
`FedosNostrPublicKeyHandle` holds is BIP-340's own convention,
meaningful only for a curve/signature scheme that uses it. A future
Session key (if Ed25519/X25519-shaped) or ATProto key (DID-method-
dependent) or Wallet key (per-chain HD-derivation-shaped) would need
its OWN dedicated type, with its OWN wire format, NEVER
`FedosNostrPublicKeyHandle` reused or genericized to fit. This Arc's
own Alpha 167 §3 comparison table's own "Session/ATProto separation"
row already reached this same conclusion structurally — this Stage
reconfirms it as an explicit, Arc-closing design commitment: **the
derivation PATTERN generalizes; the Protocol Key TYPE never does.**

## 5. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. A Nostr Secret Key
now deterministically derives its own Nostr Public Key, entirely
`pub(crate)`, via `FedosNostrPublicKeyHandle`/
`derive_nostr_public_key_internal` (Alpha 168/169), with ZERO new
Cargo dependency, ZERO new cryptographic algorithm, ZERO WASM
exposure (`#[wasm_bindgen]` count fixed at 13), ZERO Desktop access,
and ZERO Runtime/Worker/Storage/Observation/Identity-Layer exposure.**

**The following do NOT exist yet, exactly as this Arc's own Objective
requires:**

- **Public key byte Public Boundary** — no path exists to read
  `FedosNostrPublicKeyHandle`'s own bytes from outside `master_root`.
- **hex public key** — no hex encoding of the public key exists.
- **`npub`** — no bech32 public-key encoding exists.
- **`nsec`** — no bech32 secret-key encoding exists.
- **Schnorr signature** — no BIP-340 signing function exists.
- **Nostr Event** — no event construction/signing exists.
- **Relay communication** — no WebSocket/Relay connection exists.
- **DM** — no NIP-04/NIP-44-based direct-message send path exists.
- **Secret export/import** — no path exists to export or import a raw
  secret byte anywhere in this crate.

**The NEXT Arc begins Nostr Public Identifier Encoding Review —
reviewing how (and whether) `FedosNostrPublicKeyHandle`'s own 32-byte
value becomes a hex string and/or `npub`, still without implementing
Schnorr signing, Events, or Relay communication. This is explicitly
the next Arc's own scope, not this one's.**

## 6. What this Stage does NOT do

- Does **not** modify `packages/fedos-core-rust/src/lib.rs` beyond the
  `#[cfg(test)]`-only test module landed alongside Alpha 168/169's own
  implementation — no further production code change.
- Does **not** derive, encode, or expose a `npub`, `nsec`, hex public
  key, or Schnorr signature.
- Does **not** add a new Rust type, function, or dependency beyond
  Alpha 168/169's own two additions (`FedosNostrPublicKeyHandle`,
  `derive_nostr_public_key_internal`).
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_169_deterministic_nostr_public_key_derivation.md`
- `docs/secure_runtime_alpha_168_nostr_public_key_handle.md`
- `docs/secure_runtime_alpha_167_nostr_public_key_representation_decision.md`
- `docs/secure_runtime_alpha_166_existing_nostr_public_key_inventory.md`
- `docs/secure_runtime_alpha_165_nostr_secret_key_derivation_completion.md`
