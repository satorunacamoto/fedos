# Secure Runtime Alpha 173 — Nostr Public Identifier Encoder

**Status: this Stage IMPLEMENTS. It modifies exactly one file,
`packages/fedos-core-rust/src/lib.rs`, and nothing else — no `src/`
file is touched. This is Stage 3 of the Alpha 171–175 Nostr Public
Identifier Encoding Arc, following Alpha 172's own adoption of
Option C.**

## 1. Why now

Alpha 172 decided the shape (`FedosNostrPublicKeyHex`/`FedosNostrNpub`,
Option C); this Stage implements the minimal Encoder Boundary that
produces them, per Alpha 171/172's own findings.

## 2. Placement — nested inside `master_root`, not a `crypto::` sibling

A NEW nested module, `nostr_identifier_encoding`, is added INSIDE
`mod master_root` (rather than a new `packages/fedos-core-rust/src/crypto/`
file). This is a deliberate accessor-visibility decision: the ONE new
accessor this Encoder needs onto `FedosNostrPublicKeyHandle`'s own
bytes (§4) can stay a genuinely PRIVATE `fn` — never `pub(crate)` —
because Rust's own privacy rules already grant a descendant module
visibility into its ancestor's private items, and `nostr_identifier_encoding`
is a descendant of `master_root`, the SAME module `FedosNostrPublicKeyHandle`
itself is defined in. Placing the Encoder in a sibling `crypto::` file
instead would have FORCED that accessor to be `pub(crate)` (crate-wide
visible) just to cross the module boundary — a strictly WIDER exposure
than this Stage's own "Public Key Handle Access Rule" calls for
("呼び出し元を最小化"). This nested placement is this Arc's own
"専用の内部Encoder Boundary" made concrete as an actual Rust module.

## 3. What was implemented

```rust
mod nostr_identifier_encoding {
    pub(crate) struct FedosNostrPublicKeyHex { value: String }
    pub(crate) struct FedosNostrNpub { value: String }

    pub(crate) fn encode_nostr_public_key_hex_internal(
        public_key: &FedosNostrPublicKeyHandle,
    ) -> Option<FedosNostrPublicKeyHex> { ... }

    pub(crate) fn encode_nostr_npub_internal(
        public_key: &FedosNostrPublicKeyHandle,
    ) -> Option<FedosNostrNpub> { ... }

    mod hex_encoding { pub(super) fn encode_lowercase_hex_32(bytes: &[u8; 32]) -> String { ... } }
    mod bech32_encoding { pub(super) fn bech32_encode(hrp: &str, data: &[u8]) -> String { ... } }
}
```

Both public entry points match the candidate signatures this Arc's
own Objective named EXACTLY (`&FedosNostrPublicKeyHandle` in,
`Option<...>` out) — Alpha 171/172's own findings did not require
deviating from either.

## 4. The Public Key Handle Access Rule — satisfied item by item

- **crate-private:** the new accessor,
  `FedosNostrPublicKeyHandle::expose_bytes_for_internal_public_identifier_encoding`,
  is a bare `fn` — never `pub(crate)`, never `pub` — the tightest
  visibility this crate's own convention offers.
- **Encoder専用 (Encoder-only):** its own doc comment names
  `nostr_identifier_encoding` as its ONLY reviewed caller; no other
  code path in this crate calls it.
- **呼び出し元を最小化 (minimize callers):** exactly ONE accessor
  serves BOTH encoder functions (hex and npub) — not two near-identical
  copies — since both belong to the SAME Encoder Boundary Alpha 171
  §3 names as one responsibility, not two.
- **Secret Key Handleから利用不能 (unreachable from the Secret Key
  Handle):** the accessor is defined on `FedosNostrPublicKeyHandle`
  ONLY — `FedosNostrSecretKeyHandle` has no method of this name, and
  cannot reach it (they are unrelated types).
- **wasm-bindgen非公開:** confirmed — the crate's own total
  `#[wasm_bindgen]` annotation count stays fixed at 13.
- **Desktop/TypeScript非公開:** confirmed — no `src/` file is touched
  by this Stage; `nostr_identifier_encoding` is nested inside a plain
  (non-`pub`) module.
- **汎用raw byte export APIではない (not a generic raw-byte export
  API):** the accessor's own return type is `[u8; 32]`, a fixed,
  Nostr-public-key-shaped value — it is not a generic
  `expose_bytes()`/`as_bytes()` callable for any purpose; its name and
  doc comment tie it to exactly one consumer, exactly one meaning.
- **docで公開鍵専用の例外であることを明記 (documented as a
  public-key-only exception):** the accessor's own doc comment states
  plainly it is "the ONE deliberate, documented exception this crate's
  'no raw byte getter' discipline makes" for this Handle specifically.

## 5. Hex — requirements confirmed

- **32 bytes → exactly 64 lowercase ASCII hex characters:** `encode_lowercase_hex_32`
  emits exactly two characters per input byte, `2 × 32 = 64`, drawn
  from the fixed lowercase table `"0123456789abcdef"`.
- **No uppercase, no `"0x"` prefix:** the fixed table contains no
  uppercase character; no prefix is ever pushed.
- **No panic:** the function is a bounded loop over a fixed `[u8; 32]`
  input with two fixed table lookups per byte — no indexing outside
  `0..16`, no arithmetic that can overflow or underflow.
- **No raw secret contact:** its own sole input is a
  `FedosNostrPublicKeyHandle`-derived `[u8; 32]`, which — per Alpha 168
  §4 — was never wrapped in `SecretHandle`/`secrecy`/`zeroize`
  machinery to begin with; there is no secret byte in this function's
  own reachable state at all.

## 6. `npub` — requirements confirmed

- **Exact NIP-19-compatible encoding, correct HRP:** `bech32_encode("npub", &bytes)`
  — the fixed literal `"npub"`, never caller-supplied.
- **32-byte public key payload only, no TLV:** the SAME `[u8; 32]` the
  hex path encodes, passed as `data` with no length/tag prefix of any
  kind — `nprofile`/`nevent`'s own TLV wrapping is not implemented
  (explicitly out of scope, matching Alpha 171 §2.6/§7).
- **Correct checksum:** `polymod`/`GENERATOR`/`BECH32_CONST = 1` (NOT
  Bech32m's `0x2bc830a3`) implement BIP-173's own published algorithm
  exactly — verified against BIP-173's own canonical `"a12uel5l"`
  vector by Alpha 174's own test (Alpha 171 §2.10).
- **Lowercase canonical output:** `CHARSET` (`"qpzry9x8gf2tvdw0s3jn54khce6mua7l"`)
  contains no uppercase character; the fixed HRP literal `"npub"` is
  already lowercase.
- **No panic:** every array index into `CHARSET`/`GENERATOR` is masked
  to `0..32`/`0..5` by construction (`& 0x1f`, `.enumerate()` over a
  fixed 5-element array) — no out-of-bounds access is reachable for
  any input.
- **No `nsec` generation:** this module contains no function that
  accepts or encodes a SECRET scalar of any kind — its own sole input
  type, `FedosNostrPublicKeyHandle`, cannot hold one (Alpha 168 §4).
- **No TLV format:** confirmed above — plain Bech32 only, matching
  this Arc's own explicit scope.

## 7. Reuse-first check — no existing codec to reuse

Alpha 171 §2.2/§2.3/§2.4/§2.5/§2.7 already confirmed, by direct
inspection, that no existing TypeScript OR Rust codec for hex-of-a-
Nostr-key or Bech32/`npub` exists anywhere in this repository or its
installed dependencies. Both encoders here are therefore NEW
implementations, not reimplementations of something already present —
consistent with "既存codecを再利用できる場合は再実装しない" (nothing
existed to reuse).

## 8. What this Stage does NOT do

- Does **not** implement a Decoder of any kind — encoding only.
- Does **not** implement `nsec`, Schnorr signing, Event construction,
  or Relay communication.
- Does **not** add a new Cargo dependency — `hex` stays
  `[dev-dependencies]`-only; no `bech32` crate is added.
- Does **not** modify `src/desktop/*`, `src/identity/*`,
  `src/nostr/*`, `create_runtime.ts`, `types.ts`, `worker.ts`, Storage,
  Observation, any Protocol Adapter, `Cargo.toml`, or `package.json`.

## 9. See also

- `docs/secure_runtime_alpha_172_nostr_identifier_representation_decision.md`
- `docs/secure_runtime_alpha_171_existing_nostr_identifier_inventory.md`
- `docs/secure_runtime_alpha_169_deterministic_nostr_public_key_derivation.md`
- `docs/ciphertext_serialization_format_decision.md`
