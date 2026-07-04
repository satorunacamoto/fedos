# AEAD Internal Implementation Record (Stage 152–156)

**Status: this document records a real implementation.** Alongside
`docs/hkdf_internal_plan.md` (Stage 147–149), this document records
`packages/fedos-core-rust/src/crypto/aead_internal.rs` — this crate's
first real AEAD implementation, consuming `SecretHandle(AeadKeyMaterial)`
and the 96-bit nonce helper (`fedos_aead_nonce_96`, Stage 138), and
`src/crypto/aead_diagnostics.rs` — a fixed, display-only per-algorithm
readiness preview.

This complements, and does not renegotiate,
`docs/hkdf_internal_plan.md` (§10's AEAD staging preparation, which this
document fulfills), `docs/secret_lifecycle_implementation_plan.md`/
`docs/secret_handle_api_shape.md` (`SecretHandle`),
`docs/nonce_generation_policy.md` (the nonce discipline this
implementation depends on), and `docs/crypto_capability_matrix.md`/
`docs/crypto_diagnostics.md` (the coarser capability preview this
implementation's `Aead` row now flips to `Ready`). Where this document and
any of those disagree, the earlier binding docs win.

---

## 1. Purpose

- **Record the internal AEAD implementation** landed Stage 152–154: what
  it is, what it deliberately is not, and why.
- **Record the AEAD diagnostics addition** (Stage 155): a fixed,
  hand-maintained, per-algorithm preview.
- **Fix, in writing, that a ciphertext envelope format is NOT part of this
  stage** — `docs/ciphertext_envelope_plan.md` is the separate, docs-only
  planning record for that future stage.

## 2. AEAD specification

- **Key input: `SecretHandle(AeadKeyMaterial)` only.** `seal_internal`/
  `open_internal` take a `&SecretHandle` and reject (returns
  `AeadStatus::InvalidKey`) any handle whose `kind()` is not
  `SecretHandleKind::AeadKeyMaterial` — a placeholder handle, any other
  kind, or an already-`clear()`-ed handle are all rejected. There is no
  second key input type — no raw `[u8; 32]`, no `Vec<u8>`, no `String`.
- **Nonce input: a `Ready` `FedosAeadNonceDecision` only.** Both functions
  take a `&FedosAeadNonceDecision` (the return type of
  `fedos_aead_nonce_96()`, Stage 138) and reject
  (`AeadStatus::InvalidNonce`) any decision whose `state` is not
  `FedosNonceState::Ready` — an `EntropySourceUnavailable` decision (or
  any hand-constructed non-`Ready` value) never reaches the cipher. There
  is no raw `[u8; 12]` nonce parameter anywhere — the nonce always arrives
  wrapped in its own decision type, matching Stage 138's own "nonce is not
  a secret, but its provenance still matters" design.
- **Algorithm: `ChaCha20Poly1305` or `Aes256Gcm` only.** `AeadCipher` has
  exactly two variants — no third cipher, no algorithm-agility escape
  hatch, no caller-chosen cipher string.
- **AAD: a fixed `AeadAadDomain` label only.** Five variants
  (`RootKey`/`Identity`/`Storage`/`Conversation`/`TestOnly`), each with its
  own fixed `&'static [u8]` literal — never caller-supplied text, mirroring
  `kdf_core::HkdfDomain`'s shape (Stage 147) as its OWN, separate enum (not
  a shared type — AEAD's AAD domain and HKDF's salt/info domain are
  deliberately decoupled, so a future change to one never silently changes
  the other).
- **Plaintext/ciphertext: the only variable-length inputs.** Both are
  plain `&[u8]`/`Vec<u8>`, `pub(crate)`-at-most throughout — never
  returned across this crate's public API boundary (there is no public API
  boundary for either function to cross: both stay `pub(crate)`).

## 3. Types

All `pub(crate)`, living in the new `crypto::aead_internal` module:

| Type | Role |
|---|---|
| `AeadCipher` | Which algorithm — `ChaCha20Poly1305` / `Aes256Gcm`. Distinct from the pre-existing, still-unconnected `aead_core::AeadAlgorithm` (Stage 80 skeleton, untouched). |
| `AeadAadDomain` | Which fixed AAD context — `RootKey` / `Identity` / `Storage` / `Conversation` / `TestOnly`. |
| `AeadStatus` | Coarse outcome — `Ready` / `InvalidKey` / `InvalidNonce` / `AuthenticationFailed` / `InternalFailure`. |
| `AeadSealDecision` | `algorithm`, `status`, `ciphertext: Option<Vec<u8>>`. |
| `AeadOpenDecision` | `algorithm`, `status`, `plaintext: Option<Vec<u8>>`. |

`AeadStatus::AuthenticationFailed` is a SINGLE fixed label covering every
decryption failure cause (wrong key, wrong nonce, wrong AAD, tampered
ciphertext) uniformly — per RFC 8439/NIST AEAD guidance, an AEAD
implementation must never distinguish WHY authentication failed; doing so
is itself a side channel an attacker could use to probe for valid
(key, nonce, AAD) combinations.

## 4. `seal_internal` / `open_internal`

```rust
pub(crate) fn seal_internal(
    algorithm: AeadCipher,
    key: &SecretHandle,
    nonce: &FedosAeadNonceDecision,
    aad_domain: AeadAadDomain,
    plaintext: &[u8],
) -> AeadSealDecision

pub(crate) fn open_internal(
    algorithm: AeadCipher,
    key: &SecretHandle,
    nonce: &FedosAeadNonceDecision,
    aad_domain: AeadAadDomain,
    ciphertext: &[u8],
) -> AeadOpenDecision
```

- **Misuse guards run BEFORE any cipher is touched**: key kind/holding
  check, then nonce readiness check. Either failure short-circuits with a
  fixed status and no cipher call at all.
- **Reads key bytes via exactly one accessor**:
  `SecretHandle::expose_bytes_for_internal_aead()` (new this stage — see
  §5). No other path into a key `SecretHandle`'s bytes exists in this
  module.
- **Dispatches to per-cipher helpers** (`seal_chacha20poly1305`/
  `seal_aes256gcm`, and their `open_*` counterparts) using the
  already-adopted `chacha20poly1305` (Stage 74) and `aes-gcm` (Stage 101)
  crates via their re-exported `aead` crate traits (`Aead`/`KeyInit`/
  `Payload`) — the exact same pattern the pre-existing `#[cfg(test)]`-only
  `rfc8439_vectors`/`aes256gcm_vectors` modules already use, just fed real
  `SecretHandle`/nonce-decision bytes instead of test-vector bytes.
- **`chacha20poly1305` and `aes-gcm` depend on DIFFERENT major versions of
  the `aead` crate** (`0.6` and `0.5` respectively) — their `Error`/`Aead`/
  `KeyInit`/`Payload` types are NOT interchangeable at the type level, so
  each cipher's helper functions are written against its own crate's
  re-exported types, with the two `Result` error types normalized to `()`
  before the two `match` arms are unified in `seal_internal`/
  `open_internal`.
- **Local key-byte copies are zeroized immediately after use** — `key_bytes:
  [u8; 32]` is zeroized right after the cipher call returns (success or
  failure), narrowing (not eliminating — `docs/secret_lifecycle_implementation_plan.md`
  §10's standing limitation applies here too) the exposure window.
- **Never panics.** Both cipher crates' `Result`s are matched exhaustively;
  no `.unwrap()`/`.expect()`/`panic!` anywhere in production code.

## 5. `SecretHandle::expose_bytes_for_internal_aead`

- **A SECOND narrowly-scoped raw-byte accessor**, a sibling of Stage 147's
  `expose_bytes_for_internal_derivation` — NOT a reuse of it.
  `docs/secret_handle_api_shape.md` §6 anticipated exactly this shape: each
  future connection stage needing the bytes adds its OWN accessor, never a
  generic one shared across every future consumer.
- **Identical rules**: returns `None` for the Stage 79 placeholder path and
  after `clear()`; returns a COPY, never a reference; the caller
  (`aead_internal`) zeroizes its own copy.
- **`SecretHandle`'s method count grows from seven to eight** as a direct,
  reviewed consequence of this stage's own AEAD connection decision.

## 6. Nonce reuse — a documented caller obligation, not runtime-tracked

- **This module cannot, and does not, track whether a `(key, nonce)` pair
  has been used before.** Doing so would require persistent, cross-call
  state (a registry of every nonce ever used per key) this crate does not
  have and this stage does not add.
- **Every caller MUST draw a fresh nonce via `fedos_aead_nonce_96()` for
  EVERY `seal_internal` call under the same key.** Reusing a nonce with
  ChaCha20-Poly1305 or AES-256-GCM catastrophically breaks BOTH
  confidentiality (XORing two ciphertexts under the same keystream leaks
  the XOR of the two plaintexts) AND authenticity (for GCM specifically,
  nonce reuse can allow full key/tag forgery) — this is a well-known,
  severe AEAD misuse class, not a theoretical concern.
- **This is fixed here as a binding, documented guard label**
  (`docs/nonce_generation_policy.md` already establishes the underlying
  nonce-drawing discipline this obligation depends on) — a FUTURE stage
  that wants runtime-enforced reuse detection (e.g. a per-key nonce
  registry) does so as its own, separate, explicitly-reviewed stage; this
  one does not claim to solve it.

## 7. Forbidden (all verified by dedicated guard tests)

- Public `encrypt()`/`decrypt()` — none added; `seal_internal`/
  `open_internal` stay `pub(crate)`.
- Public raw key getter — `expose_bytes_for_internal_aead` stays
  `pub(crate)`; no `pub` accessor exists anywhere.
- Runtime/Worker/Storage/Nostr/NIP-44/WASM connection — none.
- `Cargo.toml` change or new dependency — none; `chacha20poly1305`/
  `aes-gcm` were already production dependencies since Stage 74/101.
- `Vec<u8>` exposed publicly — `ciphertext`/`plaintext` fields stay
  `pub(crate)`-at-most; `AeadSealDecision`/`AeadOpenDecision` never cross
  a public function boundary (there is none for them to cross).
- `panic!`/`.unwrap()`/`.expect()` — none in production code.
- Fallback crypto — no third cipher, no degraded mode.
- Deterministic nonce — the nonce is always drawn via
  `fedos_aead_nonce_96()`'s real CSPRNG path; this module accepts, but
  never generates, a nonce decision.
- Caller-supplied raw nonce bytes from a public API — there is no public
  API surface here at all; the nonce always arrives as a typed,
  already-validated `FedosAeadNonceDecision`.

## 8. AEAD diagnostics (Stage 155)

- **`crypto::aead_diagnostics::aead_diagnostics_preview() -> [AeadAlgorithmReport; 2]`**
  — a FIXED, hand-maintained, display-only two-row table: `ChaCha20Poly1305`
  then `Aes256Gcm`, both `Ready`. Same discipline as
  `crypto::diagnostics::crypto_diagnostics_preview` (Stage 151): never a
  live probe, never calling `seal_internal`/`open_internal`/`SecretHandle`/
  `fedos_aead_nonce_96` to compute its answer.
- **`crypto::diagnostics::crypto_diagnostics_preview`'s own `Aead` row**
  flips from `NotConnected` to `Ready` this stage — the coarse, crate-wide
  preview and the AEAD-specific, per-algorithm preview are updated
  together, kept consistent by this same stage's review (not
  automatically derived from one another).
- **No secret byte, key, nonce, plaintext, or ciphertext** is ever held or
  displayed by either diagnostics module.

## 9. Test strategy (implemented, all passing)

- ChaCha20-Poly1305 seal → open round-trip.
- AES-256-GCM seal → open round-trip.
- Wrong AAD domain (seal under one domain, open under another) fails
  `AuthenticationFailed` for both ciphers.
- Wrong nonce (seal under one nonce, open under a different, independently
  drawn one) fails `AuthenticationFailed` for both ciphers.
- Tampered ciphertext (flip one byte after sealing) fails
  `AuthenticationFailed` for both ciphers.
- Wrong key kind (e.g. `HkdfInputMaterial` presented where
  `AeadKeyMaterial` is required) is rejected with `InvalidKey` BEFORE
  touching the cipher, for both seal and open.
- Cleared key is rejected with `InvalidKey`.
- A non-`Ready` nonce decision (`EntropySourceUnavailable`) is rejected
  with `InvalidNonce`.
- Sealing is deterministic for the same (key, nonce, AAD, plaintext) —
  confirming no hidden per-call randomness beyond the nonce itself.
- `AeadCipher` has no variant beyond the two specified — an exhaustive
  match with no wildcard arm.
- `AeadAlgorithmReport`/`aead_diagnostics_preview` — exactly two rows,
  both `Ready`, in a fixed order, stable across repeated calls.
- Every pre-existing RFC 8439/NIST-CAVP vector test passes UNMODIFIED —
  this stage did not touch `rfc8439_vectors` or `aes256gcm_vectors`.
- Public API surface unchanged — still twenty-four `pub fn`s.

## 10. What Stage 152–156 deliberately does NOT do

- Does not implement a public `encrypt`/`decrypt` API.
- Does not define a ciphertext envelope or serialization format —
  `docs/ciphertext_envelope_plan.md` fixes the future field list in
  writing only, no code.
- Does not implement NIP-44 or any Nostr encrypted-message scheme.
- Does not wire anything into the Runtime, Worker, or WASM.
- Does not connect to storage.
- Does not add or change any `Cargo.toml` dependency.
- Does not implement runtime nonce-reuse detection (§6) — a documented
  caller obligation, not a solved problem.

## 11. Conclusion

- **AEAD is now a real, `cargo test`-verified implementation** for both
  ChaCha20-Poly1305 and AES-256-GCM, consuming
  `SecretHandle(AeadKeyMaterial)` and a `Ready` `FedosAeadNonceDecision`
  only, with a fixed AAD domain label and a single, non-distinguishing
  `AuthenticationFailed` failure status.
- **`SecretHandle` gains exactly one new, narrowly-scoped accessor**
  (`expose_bytes_for_internal_aead`) — still no public raw-byte exposure
  anywhere.
- **`Cargo.toml` is completely unchanged** — no dependency added.
- **No public API change**: still twenty-four `pub fn`s, `pub(crate)`
  throughout for everything new.
- **The ciphertext envelope format remains unfixed** — its own, separate,
  docs-only planning stage (`docs/ciphertext_envelope_plan.md`), which
  this batch also includes.

## 12. Stage 161–163 update — bridged to a real ciphertext envelope

`seal_internal`/`open_internal` are now connected to
`crypto::ciphertext_envelope::AeadCiphertextEnvelope` via a new,
dedicated, `pub(crate)`-only bridge module,
`crypto::aead_envelope_bridge` — see `docs/ciphertext_envelope_plan.md`
§11 for the full record. This section's own scope (real AEAD seal/open)
is otherwise unchanged by that bridge: `seal_internal`/`open_internal`
themselves are not modified, still accept exactly the same five
parameters, and still return the same `AeadSealDecision`/
`AeadOpenDecision` shapes. Stage 166–167 (`docs/public_crypto_api.md`)
builds this crate's first public crypto-operation functions,
`fedos_encrypt`/`fedos_decrypt`, on top of that bridge.
