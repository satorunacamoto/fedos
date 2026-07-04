# Public Opaque Crypto Handles (Stage 171–176) — implementation record

**Status: implemented.** This document records the design of
`FedosAeadKeyHandle` and `FedosCiphertextEnvelope`
(`packages/fedos-core-rust/src/lib.rs`) — the two new public OPAQUE
wrapper types that make `fedos_encrypt`/`fedos_decrypt`
(`docs/public_crypto_api.md`, Stage 166–170) genuinely callable from
outside this crate, without ever promoting `SecretHandle` or
`AeadCiphertextEnvelope` themselves to `pub`.

## 1. The problem this stage solves

Stage 166–170 shipped `fedos_encrypt`/`fedos_decrypt` as `pub fn`, but
both accepted/returned crate-private types directly (`SecretHandle`,
`AeadCiphertextEnvelope`) — Rust's `private_interfaces` lint fired on both
signatures, and an external crate could not construct a `SecretHandle` or
read an `AeadCiphertextEnvelope`'s fields to do anything useful. The
functions were `pub` in name only.

The obvious wrong fix is promoting `SecretHandle`/`AeadCiphertextEnvelope`
to `pub` directly — but `SecretHandle` wraps `secrecy::SecretBox` around
raw key bytes with zeroize-on-drop guarantees this crate's whole secret
lifecycle design depends on staying `pub(crate)`-only, and
`AeadCiphertextEnvelope` is an internal implementation detail this crate
may want to change shape on (e.g. a future wire-format/serialization
stage, `docs/ciphertext_envelope_plan.md` §8) without that being a public
breaking change. This was explicitly forbidden for this stage.

## 2. The fix: opaque public wrapper types

```rust
pub struct FedosAeadKeyHandle {
    inner: secret_handle::SecretHandle, // private field
}

pub struct FedosCiphertextEnvelope {
    inner: crate::crypto::ciphertext_envelope::AeadCiphertextEnvelope, // private field
}
```

Both structs are genuinely `pub` — nameable, constructible-by-return-value,
and passable across the crate boundary — but their `inner` field is a
private field with NO modifier, so no code outside this crate's own
defining module (and its descendants — see §5) can read or construct it.
The only ways to obtain a `FedosAeadKeyHandle` are:

- [`fedos_generate_aead_key_32`] (the only public constructor), or
- receiving one back from a prior call (e.g. cloning is not possible —
  see §3 — so a caller holds exactly the handles it was given).

The only way to obtain a `FedosCiphertextEnvelope` is:

- [`fedos_encrypt`]'s `FedosEncryptDecision::envelope` field.

## 3. What is deliberately NOT implemented on either type

| Prohibited | Why |
|---|---|
| `Clone` | Secret material (`FedosAeadKeyHandle`) is never silently duplicated; an envelope (`FedosCiphertextEnvelope`) gains no `Clone` either, keeping both types symmetric and equally minimal — a future stage can add it deliberately if a real caller need arises. |
| `Debug`/`Display` | No structural or raw-byte exposure through formatting/logging — matches `SecretHandle`'s own existing rule. |
| `Serialize` (serde or otherwise) | No JSON/CBOR/base64 encoding of key material or ciphertext — ciphertext wire-format serialization remains its own, future, separate, explicitly-reviewed stage (`docs/ciphertext_envelope_plan.md` §8). |
| `AsRef<[u8]>` | No implicit "treat me as bytes" conversion path. |
| Any public raw-byte getter (`as_bytes`, `to_vec`, `expose`, etc.) | The entire point of the wrapper — see §1. |

Neither struct derives anything at all. The only methods either type has
are `pub(crate)`-only `inner()` accessors (plus a `#[cfg(test)]`-only
`inner_mut()` on `FedosAeadKeyHandle`, used solely by this crate's own
`clear()`-based misuse-guard tests), confined to `fedos_encrypt`/
`fedos_decrypt`'s own bodies.

## 4. Public label enums: `FedosAeadAlgorithm` / `FedosAeadAadDomain`

`fedos_encrypt`/`fedos_decrypt` also needed a way to name an AEAD
algorithm and an AAD domain publicly. `crypto::aead_internal::AeadCipher`/
`AeadAadDomain` (the crate's real internal AEAD implementation labels)
stay `pub(crate)`-only, unchanged since Stage 152–154, and are explicitly
tested to never become `pub`
(`test/fedos_core_rust_aead_internal.test.ts`). Rather than break that
invariant, this stage adds two NEW, genuinely public label enums:

```rust
pub enum FedosAeadAlgorithm { ChaCha20Poly1305, Aes256Gcm }
pub enum FedosAeadAadDomain { RootKey, Identity, Storage, Conversation, TestOnly }
```

bridged to the internal enums by one small, reviewed conversion function
each (`fedos_aead_algorithm_to_internal`/`fedos_aead_aad_domain_to_internal`,
both crate-private). This is the same "separate label per boundary"
discipline this crate has followed at every previous crypto stage (e.g.
`crypto::ciphertext_envelope::AeadEnvelopeAlgorithm` is likewise separate
from `AeadCipher`) — applied here to the public/internal boundary
specifically.

## 5. Why the in-crate test suite can still build raw fixtures

`fedos_encrypt_decrypt_wiring`'s own tests (`src/lib.rs`) construct
`FedosAeadKeyHandle { inner: SecretHandle::new_from_32_bytes_for_internal_use(...) }`
and similar struct literals directly, reading/writing the private `inner`
field. This is ordinary Rust module privacy, not a special exemption: a
private field is visible in the module where it is declared AND in every
descendant module of that module. Since `FedosAeadKeyHandle`/
`FedosCiphertextEnvelope` are declared at the crate root and the test
module is a descendant of the crate root, the test module can see `inner`
— exactly the same reasoning `SecretHandle`'s own `#[cfg(test)] mod tests`
has always relied on. An ACTUAL external crate has no such descendant
relationship and cannot do this — proven by
`packages/fedos-core-rust/tests/public_crypto_api.rs` (see §6).

## 6. The integration test: proof, not just assertion

`packages/fedos-core-rust/tests/public_crypto_api.rs` is a Cargo
integration test — anything under a crate's `tests/` directory is compiled
by Cargo as its OWN separate crate, linked against `fedos-core-rust` only
through its public API, exactly as a real downstream consumer would be.
This file:

- generates a key via `fedos_generate_aead_key_32`,
- encrypts and decrypts via `fedos_encrypt`/`fedos_decrypt`,
- verifies a wrong key fails authentication,
- verifies two generated keys are independent,

and cannot name `SecretHandle`, `AeadCiphertextEnvelope`, `AeadCipher`, or
`AeadAadDomain` — those identifiers are simply not resolvable from outside
the crate. This is the concrete, executable proof (not just a string-scan
assertion) that the Stage 166–170 limitation is resolved. No
`[[test]]` entry or other `Cargo.toml` change was needed — `tests/*.rs`
integration tests are auto-discovered by Cargo by default.

## 7. What this stage does NOT do

- **No promotion of `SecretHandle` or `AeadCiphertextEnvelope` to `pub`.**
  Both remain `pub(crate)` forever; opaque wrapping is the permanent
  design, not a stepping stone to eventual promotion.
- **No promotion of `AeadCipher`/`AeadAadDomain` to `pub`.** Both remain
  `pub(crate)`-only; `FedosAeadAlgorithm`/`FedosAeadAadDomain` are
  separate, dedicated public types instead.
- **No raw key byte, raw nonce byte, or raw ciphertext byte is exposed
  publicly anywhere.**
- **No ciphertext envelope serialization** (JSON/CBOR/base64/wire format)
  — still its own, future, separate stage
  (`docs/ciphertext_envelope_plan.md` §8, named as a Stage 177+
  candidate).
- **No Runtime/Worker/Storage/Nostr/NIP-44/WASM connection.**
- **No new crate dependency, no `Cargo.toml` change** (the new
  `tests/` integration test is auto-discovered, no manifest entry
  needed).

## 8. Conclusion

- **`FedosAeadKeyHandle`/`FedosCiphertextEnvelope`** are new, genuinely
  `pub`, opaque wrapper types with no `Clone`/`Debug`/`Display`/
  `Serialize`/`AsRef<[u8]>` and no public raw-byte getter.
- **`fedos_generate_aead_key_32`** is a new public key-generation entry
  point, returning only an opaque handle.
- **`fedos_encrypt`/`fedos_decrypt`** are rewired to these opaque types
  plus two new public label enums (`FedosAeadAlgorithm`/
  `FedosAeadAadDomain`), and no longer carry `#[allow(private_interfaces)]`.
- **`SecretHandle`/`AeadCiphertextEnvelope`/`AeadCipher`/`AeadAadDomain`
  all remain `pub(crate)`-only, permanently.**
- **The public `pub fn` surface grows from twenty-six to twenty-seven.**
- A real Cargo integration test proves genuine external callability.
