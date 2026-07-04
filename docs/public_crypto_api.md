# Public Crypto API (Stage 166–176) — implementation record

**Status: implemented, and superseded in one respect by Stage 171–176 (see
§6).** `pub fn fedos_encrypt` and `pub fn fedos_decrypt`
(`packages/fedos-core-rust/src/lib.rs`) are this crate's first public
crypto-OPERATION functions — every prior public function was a status/
label/placeholder (`fedos_core_status`, `fedos_random_boundary_status`,
etc.) or a raw-byte-drawing primitive (`fedos_random_bytes_32`,
`fedos_aead_nonce_96`), never a function that seals or opens data. This
document records what actually shipped, against the shape
`docs/public_encrypt_decrypt_api_plan.md` fixed in writing beforehand, and
names the one deliberate scope limitation Stage 166–170 chose — then §6
records how Stage 171–176 ("Public opaque crypto API completion")
resolved it. See `docs/public_crypto_opaque_handles.md` for the Stage
171–176 opaque-handle design in full.

This complements, and does not renegotiate,
`docs/public_encrypt_decrypt_api_plan.md` (the binding planning document
this implementation satisfies), `docs/ciphertext_envelope_plan.md` §11
(the AEAD↔envelope bridge this API calls into), and
`docs/aead_internal_implementation.md` (the real AEAD seal/open this API
is ultimately built on).

---

## 1. What shipped

```rust
pub fn fedos_encrypt(
    algorithm: crate::crypto::aead_internal::AeadCipher,
    key: &secret_handle::SecretHandle,
    aad_domain: crate::crypto::aead_internal::AeadAadDomain,
    plaintext: &[u8],
) -> FedosEncryptDecision;

pub fn fedos_decrypt(
    key: &secret_handle::SecretHandle,
    envelope: &crate::crypto::ciphertext_envelope::AeadCiphertextEnvelope,
) -> FedosDecryptDecision;
```

- **`fedos_encrypt`** draws its own fresh nonce internally (via
  `fedos_aead_nonce_96`), seals `plaintext` under `key` using `algorithm`
  with `aad_domain` bound as Associated Data (via
  `crypto::aead_internal::seal_internal`), and bridges the result into a
  real ciphertext envelope (via
  `crypto::aead_envelope_bridge::envelope_from_seal_decision_internal`).
  Returns `FedosEncryptDecision { status: FedosEncryptStatus, envelope:
  Option<AeadCiphertextEnvelope> }` — `status` is `pub`; `envelope` is
  `pub(crate)` (see §3).
- **`fedos_decrypt`** extracts the algorithm/nonce/AAD-domain/ciphertext
  already carried by `envelope` and opens it under `key` (via
  `crypto::aead_envelope_bridge::open_decision_from_envelope_internal`).
  Returns `FedosDecryptDecision { status: FedosDecryptStatus, plaintext:
  Option<Vec<u8>> }` — both fields `pub` (see §3 for why `plaintext`
  differs from `fedos_encrypt`'s `envelope` field).
- **`FedosEncryptStatus`**: `Ready` / `InvalidKey` / `NonceUnavailable` /
  `InternalFailure`.
- **`FedosDecryptStatus`**: `Ready` / `InvalidKey` /
  `AuthenticationFailed` / `InternalFailure`. `AuthenticationFailed` is a
  SINGLE fixed label covering every decryption failure cause (wrong key,
  wrong nonce, wrong AAD domain, tampered ciphertext, or a Stage 157–158
  skeleton/placeholder envelope) uniformly — this function never
  distinguishes WHY, per RFC 8439/NIST AEAD guidance against
  side-channel-revealing error differentiation.

## 2. What this plan's constraints look like, satisfied

Every constraint `docs/public_encrypt_decrypt_api_plan.md` §3/§4 fixed is
satisfied exactly:

| Constraint | Satisfied by |
|---|---|
| Key: `SecretHandle` only, never a raw byte | `key: &SecretHandle` — no `[u8; 32]`, no password, no seed parameter exists on either function. |
| No caller-supplied nonce | `fedos_encrypt` calls `fedos_aead_nonce_96()` internally; `fedos_decrypt` reads the nonce from `envelope.nonce()`. Neither function has a `nonce` parameter. |
| Ciphertext: an envelope type, not raw bytes | `fedos_encrypt` returns (inside its Decision) an `AeadCiphertextEnvelope`; `fedos_decrypt` accepts one by reference. Neither function's public signature exposes a bare `Vec<u8>` ciphertext parameter. |
| AAD: a fixed domain-label selection | `aad_domain: AeadAadDomain` — a label enum, never a free-form string/byte slice. |
| No public raw key/nonce/AEAD-implementation-type exposure | `SecretHandle`/`AeadCiphertextEnvelope` stay `pub(crate)` (§3); no `Vec<u8>` key/nonce parameter or return exists. |

## 3. The one deliberate scope limitation: types stay `pub(crate)`

`docs/public_encrypt_decrypt_api_plan.md` §3 left open whether the key
input would be `SecretHandle` itself or "a future public-facing handle
type wrapping one." Stage 166–170 resolved this by choosing **literal
minimal scope**, confirmed explicitly by the user during this stage's
review:

- **Only `fedos_encrypt`, `fedos_decrypt`, and their four supporting
  types (`FedosEncryptStatus`, `FedosEncryptDecision`, `FedosDecryptStatus`,
  `FedosDecryptDecision`) become new `pub` items.**
- **`SecretHandle` and `AeadCiphertextEnvelope` remain `pub(crate)`** —
  neither is promoted to `pub`, and neither gains a new opaque
  public-facing wrapper this stage.
- **Practical consequence**: `fedos_encrypt`/`fedos_decrypt` are `pub` in
  NAME — a `cargo doc` listing or `cargo check` from outside this crate
  would show them as public functions — but no code outside this crate
  can actually construct a `SecretHandle` to pass as `key`, nor read the
  fields of the `AeadCiphertextEnvelope` `fedos_encrypt` returns (its
  `envelope` field is `pub(crate)`) or construct one to pass to
  `fedos_decrypt`. Both functions are, as of this stage, **practically
  callable only from within this crate** — its own `cargo test` suite
  (see `fedos_encrypt_decrypt_wiring` in `src/lib.rs`) is the only
  current caller.
- **This is intentional, not an oversight.** Rust's `private_interfaces`
  lint fires a warning on both functions for exactly this reason; both
  carry an `#[allow(private_interfaces)]` with a doc comment explaining
  why, rather than silently suppressing or hiding the signal.
- **Why choose this over promoting the types**: it keeps this stage's
  diff to EXACTLY the two named functions (per the stage's explicit
  instructions), avoids deciding — under this stage's time pressure —
  what an opaque, no-raw-byte-exposing public `SecretHandle`/envelope
  wrapper should look like (a real design question deserving its own
  reviewed stage), and leaves the door open for a future stage to design
  that public-facing surface deliberately.
- **Follow-up work, not done here**: promoting `SecretHandle`/
  `AeadCiphertextEnvelope` (or introducing narrowly-scoped public wrapper
  types around them) so `fedos_encrypt`/`fedos_decrypt` become genuinely
  externally callable is named as a Stage 171+ candidate.

## 4. What this stage does NOT do

- **No Runtime/Worker/Storage/Nostr connection.** Neither function is
  imported by, referenced from, or wired into
  `src/runtime/create_runtime.ts`, `src/worker.ts`, or any storage/Nostr
  module.
- **No NIP-44.** No NIP-44-specific type, padding, or conversation-key
  derivation is added or referenced.
- **No serialization.** No JSON, CBOR, or base64 encoding of any kind
  exists in either function's implementation.
- **No new crate dependency, no `Cargo.toml` change.**
- **No change to any Stage 103 "frozen" public-boundary status
  function** (`fedos_crypto_boundary_status`,
  `fedos_random_boundary_status`, etc.) — those remain permanently
  `Unavailable`, exactly as every prior real-implementation stage has
  left them.

## 5. Conclusion (Stage 166–170, as originally shipped)

- **The public API planned in `docs/public_encrypt_decrypt_api_plan.md`
  is now implemented**, satisfying every constraint that document fixed.
- **The crate's public `pub fn` surface grows from twenty-four to
  twenty-six** — `fedos_encrypt` and `fedos_decrypt`.
- **`SecretHandle`/`AeadCiphertextEnvelope` staying `pub(crate)` is a
  deliberate, reviewed, user-confirmed scope limitation**, not an
  oversight — making the new API genuinely externally callable is
  explicitly deferred to a future stage (Stage 171+ candidate).
- No Runtime/Worker/Storage/Nostr/NIP-44/WASM connection, no
  serialization, no new dependency, no `Cargo.toml` change.

## 6. Stage 171–176 — "Public opaque crypto API completion" (resolves §3)

The Stage 171+ follow-up named in §3/§5 above shipped as Stage 171–176.
**`fedos_encrypt`/`fedos_decrypt` are now genuinely callable from OUTSIDE
this crate** — not just `pub` in name. This section records what changed;
`docs/public_crypto_opaque_handles.md` records the opaque-handle design in
full detail.

- **Two new public OPAQUE wrapper types** replace direct use of the
  crate-private secret/payload-carrying types in the public signature:
  - `FedosAeadKeyHandle` wraps a `SecretHandle(AeadKeyMaterial)`.
  - `FedosCiphertextEnvelope` wraps an `AeadCiphertextEnvelope`.
  - **`SecretHandle` and `AeadCiphertextEnvelope` themselves are NEVER
    promoted to `pub`** — they stay `pub(crate)` forever. Opaque wrapping,
    not promotion, is how this crate resolves the §3 limitation.
- **A new key-generation entry point**, `fedos_generate_aead_key_32`,
  draws a fresh 32-byte key from the OS CSPRNG (`getrandom::fill`, no
  fallback PRNG) and returns it wrapped in a `FedosAeadKeyHandle` — never
  a raw `[u8; 32]`. This is the only way to obtain one from outside the
  crate.
- **Two new public label enums**, `FedosAeadAlgorithm`/
  `FedosAeadAadDomain`, replace `crate::crypto::aead_internal::AeadCipher`/
  `AeadAadDomain` in the public signature — deliberately SEPARATE types,
  bridged internally by one reviewed conversion function each. `AeadCipher`/
  `AeadAadDomain` themselves stay `pub(crate)`-only, exactly as they have
  since Stage 152–154 — this crate's established "separate label per
  boundary" discipline, applied here too rather than promoting the
  internal enums directly.
- **`fedos_encrypt`/`fedos_decrypt`'s signatures**:
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
  Neither function carries `#[allow(private_interfaces)]` any more — every
  parameter and return type is genuinely `pub`.
- **`FedosEncryptDecision::envelope` changes from `pub(crate)` to `pub`**
  — the concrete fix that makes the Stage 166–170 "practically
  internal-only" situation resolved: an external caller can now hold,
  store, and pass this value straight into `fedos_decrypt`.
- **Neither opaque wrapper is `Clone`/`Debug`/`Display`/`Serialize`, and
  neither implements `AsRef<[u8]>` or exposes any public raw-byte getter.**
  The only accessors are `pub(crate)`-only `inner()` methods, confined to
  `fedos_encrypt`/`fedos_decrypt`'s own bodies.
- **A real Cargo integration test**,
  `packages/fedos-core-rust/tests/public_crypto_api.rs` (compiled by
  Cargo as its own separate crate, per the standard meaning of anything
  under `tests/`), proves the whole surface is genuinely usable from
  outside the crate: it reaches `fedos_core_rust` ONLY through
  `fedos_generate_aead_key_32`/`fedos_encrypt`/`fedos_decrypt` and the two
  opaque types, and cannot even name `SecretHandle`/
  `AeadCiphertextEnvelope`/`AeadCipher`/`AeadAadDomain`.
- **The public `pub fn` surface grows from twenty-six to twenty-seven** —
  `fedos_generate_aead_key_32`.
- No Runtime/Worker/Storage/Nostr/NIP-44/WASM connection, no
  serialization, no new dependency, no `Cargo.toml` change.

## 7. Conclusion (current, Stage 171–176)

- **`fedos_encrypt`/`fedos_decrypt` are genuinely usable from outside this
  crate**, proven by a real Cargo integration test — resolving the one
  scope limitation §3/§5 named.
- **`SecretHandle`/`AeadCiphertextEnvelope` remain `pub(crate)` forever**;
  opaque wrapper types, not promotion, are how external callers reach
  them.
- **The public `pub fn` surface is now twenty-seven**: `fedos_encrypt`,
  `fedos_decrypt`, `fedos_generate_aead_key_32`.
- No Runtime/Worker/Storage/Nostr/NIP-44/WASM connection, no
  serialization, no new dependency, no `Cargo.toml` change.
