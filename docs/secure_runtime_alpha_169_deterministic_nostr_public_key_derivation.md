# Secure Runtime Alpha 169 — Deterministic Nostr Public Key Derivation

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 4 of the Alpha 166–170 Deterministic
Nostr Public Key Derivation Arc, following Alpha 168's own addition of
`FedosNostrPublicKeyHandle`.**

## 1. Why now

Alpha 168 added the Handle type; this Stage adds the one function that
actually constructs a real one — `derive_nostr_public_key_internal`,
implementing Alpha 167's own adopted Option C representation.

## 2. What was implemented

```rust
pub(crate) fn derive_nostr_public_key_internal(
    secret_key: &FedosNostrSecretKeyHandle,
) -> Option<FedosNostrPublicKeyHandle> {
    let mut secret_bytes = secret_key.expose_bytes_for_internal_public_key_derivation()?;

    let x_only_bytes = match SecretKey::from_slice(&secret_bytes) {
        Ok(sk) => {
            let encoded = sk.public_key().to_encoded_point(true);
            encoded.x().map(|x| {
                let mut bytes = [0u8; 32];
                bytes.copy_from_slice(x.as_slice());
                bytes
            })
        }
        Err(_) => None,
    };
    secret_bytes.zeroize();

    x_only_bytes.map(FedosNostrPublicKeyHandle::new_from_32_bytes_for_internal_use)
}
```

The signature matches the candidate this Arc's own Objective named
EXACTLY: `derive_nostr_public_key_internal(secret_key:
&FedosNostrSecretKeyHandle) -> Option<FedosNostrPublicKeyHandle>` — a
plain `Option`, not a multi-variant `*Decision` struct like Alpha
164's own `derive_nostr_secret_key_internal`. This is a deliberate,
reviewed difference: Alpha 164 needed to distinguish THREE distinct
failure causes (cleared input, HKDF-internal failure, invalid scalar);
this function has only ONE meaningful failure cause (the input Handle
already `clear()`-ed) plus one practically-unreachable one
(`SecretKey::from_slice` rejecting bytes that
`FedosNostrSecretKeyHandle` can only ever hold already-validated) — a
plain `Option` already expresses that shape without an unused status
enum.

## 3. Derivation — the exact operation

- **Input:** `&FedosNostrSecretKeyHandle` — borrowed, never consumed,
  left exactly as it was after this call returns.
- **Secret access:** the ONE new, narrowly-scoped accessor
  `FedosNostrSecretKeyHandle::expose_bytes_for_internal_public_key_derivation`
  (private to `master_root`, named for its own sole caller — this
  function — mirroring the EXISTING minimal-accessor discipline
  exactly: crate-private, one caller, not a byte-export API, public-
  key-derivation-only). Returns `None` immediately (via `?`) if the
  input Handle is already `clear()`-ed.
- **Scalar reconstruction:** `SecretKey::from_slice(&secret_bytes)` —
  the SAME validation `crypto::conversation_key` and
  `derive_nostr_secret_key_internal` already use. Practically always
  `Ok`, since `FedosNostrSecretKeyHandle` can only ever be constructed
  from bytes ALREADY confirmed a valid scalar (Alpha 164) — the `Err`
  arm exists ONLY for exhaustive matching, matched to `None`, never a
  panic.
- **Public key computation:** `SecretKey::public_key()` — `k256`'s own
  existing "scalar × generator point" operation (Alpha 166 §2.7),
  confirmed to require ZERO new Cargo feature.
- **x-only extraction:** `.to_encoded_point(true)` (SEC1 compressed,
  33 bytes) then `.x()` (discards the leading parity-tag byte,
  yielding the 32-byte X coordinate) — Alpha 166 §2.3/§2.4's own
  confirmed Nostr-required shape.
- **Zeroize:** `secret_bytes.zeroize()` runs on EVERY path — success
  or failure — before the function returns, mirroring the exact
  pattern `derive_nostr_secret_key_internal`'s own `candidate.zeroize()`
  already uses.

## 4. Determinism and separation — the required properties

- **Same secret key content → same public key:** `SecretKey::public_key()`
  is a pure function of the scalar; the same 32 input bytes always
  produce the same point, hence the same x-only bytes.
- **Different secret key content → different public key:** distinct
  scalars produce distinct curve points (the discrete-log map is
  injective) — different Account Indices (Alpha 164) always yield
  different secret keys, hence different public keys.
- **Master Seed separation carries through:** since a different Master
  Seed already yields a different Nostr Secret Key (Alpha 165 §2), and
  this function is a pure, deterministic map from secret key to public
  key, a different Master Seed necessarily yields a different Nostr
  Public Key too, for the same Account Index.

## 5. Panic and boundary discipline

- **No panic anywhere in this function's own body:** no `.unwrap()`,
  `.expect()`, or `panic!()` on any path — confirmed by direct source
  inspection. The one `Err(_) => None` arm and the `?` early-return
  both resolve cleanly to `None`, never propagate a Rust `panic!`
  outside this crate's own boundary.
- **`npub`/`nsec`/signature generation:** none — this function's own
  sole output is an opaque `FedosNostrPublicKeyHandle`; no bech32
  encoding, no Schnorr signing function, is called or defined here.
- **WASM export:** none — no `#[wasm_bindgen]` attribute is applied to
  this function or to `FedosNostrPublicKeyHandle`; the crate's own
  total count of such annotations stays fixed at 13.

## 6. What this Stage does NOT do

- Does **not** derive, return, or log `npub`, `nsec`, or a Schnorr
  signature.
- Does **not** implement a counter-based retry, since — unlike Alpha
  164's own HKDF-candidate validation — there is no meaningfully
  retriable failure mode here: an already-validated scalar's own
  public key ALWAYS exists.
- Does **not** modify `crypto::conversation_key`,
  `derive_nostr_secret_key_internal`, or any other pre-existing
  function — all remain byte-for-byte UNCHANGED.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `create_runtime.ts`, `types.ts`, `worker.ts`, Storage, Observation,
  any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 7. See also

- `docs/secure_runtime_alpha_168_nostr_public_key_handle.md`
- `docs/secure_runtime_alpha_167_nostr_public_key_representation_decision.md`
- `docs/secure_runtime_alpha_166_existing_nostr_public_key_inventory.md`
- `docs/secure_runtime_alpha_164_deterministic_nostr_secret_key_derivation.md`
