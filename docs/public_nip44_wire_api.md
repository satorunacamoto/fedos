# Public NIP-44 wire API planning (Stage 241) — docs only, no code

**Status: this document adds no code.** The NIP-44 v2 wire-compatible
internal implementation is complete (`docs/nip44_wire_crypto_completion.md`,
Stage 229–240): ConversationKey derivation, exact per-message key
derivation, padding, ChaCha20 stream encrypt/decrypt, HMAC-SHA256, base64
wire payload encode/decode, and the full encrypt/decrypt pipelines all
exist and are vector-verified — but every one of them is `pub(crate)`-only.
This document fixes, in writing, the boundary a FUTURE public API would
sit behind, BEFORE any `pub` item is added — the same "fix the shape
before the implementation" discipline `docs/public_crypto_opaque_handles.md`
(Stage 171–176) already used for this crate's existing AEAD API.

**No `pub` item is added by this document or by Stage 241.** This is a
plan only.

## 1. The current internal pipeline

```
ConversationKey (crypto::conversation_key, Stage 198-199)
   │  derive_message_keys_exact_internal (crypto::nip44_message_keys, Stage 219)
   ▼
MessageKey (chacha_key / chacha_nonce / hmac_key)
   │  encrypt_wire_internal (crypto::nip44_wire_encrypt, Stage 236)
   ▼
Wire Encrypt (pad → ChaCha20 → HMAC-SHA256)
   │  encode_wire_payload_internal (crypto::nip44_wire_encoding, Stage 234)
   ▼
Wire Payload (base64 string)
   │  decode_wire_payload_internal (crypto::nip44_wire_encoding, Stage 234)
   ▼
Wire Decode (structural validation only)
   │  decrypt_wire_payload_internal (crypto::nip44_wire_decrypt, Stage 235)
   ▼
Decrypt (verify HMAC → ChaCha20 decrypt → unpad → plaintext)
```

Every box above is `pub(crate)`-only today. `ConversationKey` is
`SecretHandle`-backed (no `Clone`/`Debug`/raw-byte getter); `MessageKey`
mirrors it; `Nip44WirePayload` is a crate-private struct carrying
`nonce`/`ciphertext`/`mac` fields directly.

## 2. The rule: internal types are never exposed; only an opaque handle is

Mirroring `docs/public_crypto_opaque_handles.md` §1–2's exact reasoning
for `FedosAeadKeyHandle`/`FedosCiphertextEnvelope`, a future public NIP-44
wire API MUST NOT promote any of the following to `pub`:

| Internal type | Module | Why it must stay `pub(crate)` |
|---|---|---|
| `ConversationKey` | `crypto::conversation_key` | `SecretHandle`-backed; the whole point of `SecretHandle`'s zeroize-on-drop, no-`Clone`/no-`Debug` design is that it never leaves the crate's own lifecycle management. |
| `MessageKey` | `crypto::message_key` | Same reasoning — derived per-message secret key material. |
| `SecretHandle` | `crate::secret_handle` | The crate-wide secret-lifetime primitive every key type above is built on; promoting it would leak every other secret type transitively. |
| `Nip44WirePayload` | `crypto::nip44_wire_payload` | An internal decode/encode intermediate shape (`nonce`/`ciphertext`/`mac` as bare fields) — a future stage may want to change its shape (e.g. borrow instead of own, add a lifetime) without that being a breaking public change, exactly as `docs/public_crypto_opaque_handles.md` §1 argued for `AeadCiphertextEnvelope`. |

**The only thing a future public NIP-44 wire API may expose is an
OPAQUE HANDLE** — a `pub` wrapper struct with a private `inner` field,
exactly `FedosAeadKeyHandle`/`FedosCiphertextEnvelope`'s own shape
(`docs/public_crypto_opaque_handles.md` §2):

```
pub struct FedosNip44ConversationHandle {
    inner: crate::crypto::conversation_key::ConversationKey, // private field
}

pub struct FedosNip44WirePayloadHandle {
    inner: String, // private field — the base64 wire payload string
}
```

(Illustrative only — no such type exists yet; see §4 for what Stage 242
actually adds, which is a `pub(crate)`-only skeleton, not this.)

Neither hypothetical handle would derive `Clone`/`Debug`/`Display`/
`Serialize`/`AsRef<[u8]>`, and neither would expose a public raw-byte
getter — the same prohibited list `docs/public_crypto_opaque_handles.md`
§3 fixed for the AEAD handles, carried over verbatim.

## 3. What a future public API would need (not built yet)

A future, separate, explicitly-reviewed stage would need to decide:

- A public constructor for a conversation handle (mirroring
  `fedos_generate_aead_key_32`'s shape) — likely accepting two public
  key-material handles and performing the ECDH internally, never
  exposing raw key bytes at the boundary.
- Public `fedos_nip44_wire_encrypt`/`fedos_nip44_wire_decrypt`-shaped
  functions (naming TBD) that accept/return only opaque handles and
  plain `&[u8]`/`String` plaintext/payload — never a `ConversationKey`,
  `MessageKey`, or `Nip44WirePayload` directly.
- Public label enums for anything the wire status needs to communicate
  (e.g. an `AuthenticationFailed`/`InvalidPayload`-shaped public status),
  mirroring `FedosAeadAlgorithm`/`FedosAeadAadDomain`'s "separate label
  per boundary" discipline (`docs/public_crypto_opaque_handles.md` §4) —
  never reusing `crypto::nip44_wire_decrypt::Nip44WireDecryptStatus`
  directly as a public type.

None of this is decided or implemented here. Stage 242 (see
`docs/public_nip44_wire_api.md`'s companion skeleton) adds ONLY
crate-private placeholder types naming the shape of a future opaque
handle and decision — no public constructor, no public encrypt/decrypt
function, no public status enum.

## 4. Explicit non-goals of this planning document

- **No `pub` item is added.** `pub fn` surface stays twenty-seven.
- **No connection to `fedos_encrypt`/`fedos_decrypt`.** Those remain this
  crate's existing, unrelated, opaque-handle AEAD API (Stage 166–176) —
  a NIP-44 wire API would be a SEPARATE set of public functions/types,
  never a NIP-44 mode bolted onto the AEAD ones.
- **No Runtime/Worker/Storage/Relay/Nostr/NIP-17 connection** — see
  `docs/runtime_crypto_bridge.md` (Stage 243) and
  `docs/nostr_dm_bridge.md` (Stage 244) for those, still planning-only.
- **No WASM/FFI.**
- **No new `Cargo.toml` dependency.**

## See also

- `docs/public_crypto_opaque_handles.md` — the precedent this document's
  entire opaque-handle design borrows from.
- `docs/nip44_wire_crypto_completion.md` — the complete internal
  implementation record this document's boundary sits in front of.
- `docs/nip44_wire_compatibility_gap.md` — the terminology discipline
  (never call anything here "NIP-44 compatible" beyond the wire-payload
  byte-exactness already proven) that continues to apply.
- `packages/fedos-core-rust/src/crypto/nip44_public_api.rs` (Stage 242) —
  the crate-private skeleton naming this boundary's future shape.
