# NIP-44 v2 wire nonce planning (Stage 215) — docs only, no code

**Status: this document adds no code.** It fixes, in writing, everything
about NIP-44 v2's 32-byte per-message `nonce` — what it is for, who must
generate it, why it must never repeat, and how it differs from BOTH the
per-message `chacha_nonce` `docs/nip44_message_key_review.md` (Stage 214)
already reviewed AND this crate's own pre-existing 12-byte AEAD nonce —
before any wire-compatible encrypt/decrypt code is written.

## What the 32-byte nonce is

Per `docs/nip44_message_key_review.md`'s confirmed derivation:

```
message_keys = HKDF-Expand(PRK = conversation_key, info = nonce, L = 76)
```

The 32-byte `nonce` is the HKDF-expand **`info`** parameter (RFC 5869
§2.3) — it is NOT itself used as a ChaCha20 stream-cipher nonce anywhere.
The actual 12-byte value ChaCha20 encryption uses is `chacha_nonce`, ONE
OF THE THREE OUTPUTS the expand step derives FROM this 32-byte value (see
`docs/nip44_message_key_review.md` §1's byte-offset table). This 32-byte
value's only two uses in the whole NIP-44 v2 payload are:

1. As the HKDF-expand `info` input that determines `chacha_key`/
   `chacha_nonce`/`hmac_key` for this one message.
2. Prepended, in the clear (unencrypted), as the second field of the wire
   payload — `version_byte ‖ nonce (32 bytes) ‖ ciphertext ‖ hmac_tag` (see
   `docs/nip44_wire_payload_layout.md`, Stage 216) — so the receiver can
   recompute the SAME `chacha_key`/`chacha_nonce`/`hmac_key` triple from
   their own copy of `conversation_key`.

## Generation responsibility

- **The SENDER draws this nonce, fresh, for every single message.** There
  is no shared nonce-generation state between sender and receiver, and no
  nonce is ever negotiated in advance — the receiver only ever reads the
  nonce the sender already chose, off the wire payload itself.
- **CSPRNG-drawn, never deterministic, never a counter** — the same
  discipline `docs/nonce_generation_policy.md` already fixes for this
  crate's own AEAD nonces, and the same discipline
  `docs/nip44_internal_plan.md` §4 already named for this exact value.
  Whether a future implementation reuses `fedos_random_bytes_32` directly,
  or a new sibling of `fedos_aead_nonce_96` sized for 32 bytes instead of
  12, is the implementing stage's own decision (`docs/nip44_internal_plan.md`
  §4 already left this open) — this document does not pick one.
- **Not derived from the plaintext, the conversation key, or any counter
  value.** Any deterministic derivation would defeat the "fresh, random,
  unpredictable" property the reuse-prohibition below depends on.

## Reuse prohibition — why it matters here specifically

**The SAME `nonce` value MUST NEVER be reused under the SAME
`conversation_key`.** Unlike a typical AEAD nonce (where reuse breaks
confidentiality/integrity for that one ciphertext), reusing this 32-byte
value has a COMPOUND failure mode, because of what it feeds:

- `HKDF-Expand` is a deterministic function of `(PRK, info)` — the SAME
  `(conversation_key, nonce)` pair ALWAYS produces the exact SAME
  `chacha_key`/`chacha_nonce`/`hmac_key` triple, every time, with zero
  randomness (confirmed directly by `docs/nip44_message_key_review.md`'s
  own byte-for-byte re-derivation).
- A repeated nonce under the same conversation therefore means a repeated
  `chacha_key`+`chacha_nonce` pair feeding an UNAUTHENTICATED ChaCha20
  stream cipher (`docs/nip44_internal_plan.md` §2/§6) — this is the
  textbook stream-cipher keystream-reuse failure: XOR-ing two ciphertexts
  encrypted under the same keystream cancels the keystream and leaks the
  XOR of the two plaintexts, with NO tag-verification step able to catch
  it beforehand (`hmac_key` would also repeat, so even a forged/matching
  tag on attacker-crafted ciphertext under a repeated nonce is a real
  risk, not just a theoretical one).
- This is a STRICTLY WORSE failure mode than reusing this crate's own
  12-byte AEAD nonce under `crypto::aead_internal` (Stage 152–154) —
  ChaCha20-Poly1305 is at least an authenticated construction end-to-end;
  NIP-44 v2's raw ChaCha20-plus-separate-HMAC split means nonce reuse
  compromises confidentiality via the unauthenticated stream cipher
  independent of the (also compromised) MAC.
- **Conclusion**: a future wire-compatible implementation's nonce
  generator must be held to AT LEAST this crate's existing CSPRNG
  discipline (`getrandom::fill`, no fallback, no deterministic path) —
  see `docs/nonce_generation_policy.md` — with NO exception for
  "convenience" or "performance" reasons of any kind.

## Difference from this crate's own internal nonce helper

| | This crate's `fedos_aead_nonce_96`/`FedosAeadNonceDecision` (Stage 138) | NIP-44 v2's wire `nonce` (this document) |
| --- | --- | --- |
| Size | 12 bytes (96 bits) | 32 bytes (256 bits) |
| Feeds | `crypto::aead_internal::seal_internal`/`open_internal` directly, as the AEAD nonce for ChaCha20-Poly1305/AES-256-GCM | HKDF-Expand's `info` parameter — never fed directly to any cipher |
| Consumer today | This crate's OWN, unrelated `fedos_encrypt`/`fedos_decrypt` public API (Stage 166–176), AND (as a stand-in, see below) the Stage 204–206 "FedOS internal NIP-44-like bridge" | Not consumed anywhere in this crate yet — no wire-compatible pipeline exists |
| Generation | `getrandom::fill`, CSPRNG, one draw per `seal_internal`/`open_internal` call | Would need the SAME CSPRNG discipline, but its own 32-byte draw — this document does not mandate reusing `fedos_aead_nonce_96`'s own type (wrong size) |

## Difference from the CURRENT bridge's nonce (Stage 204–206)

`crypto::nip44_encrypt`/`crypto::nip44_decrypt` (the "FedOS internal
NIP-44-like bridge", `docs/nip44_wire_compatibility_gap.md`) take a
`&FedosAeadNonceDecision` parameter — this crate's own PRE-EXISTING
12-byte AEAD nonce, reused as a stand-in because that bridge never
implements the real 76-byte HKDF-expand step this document's 32-byte
value would feed. **This is not an oversight to reconcile here**: the
existing bridge's 12-byte nonce and NIP-44 v2's real 32-byte nonce serve
completely different roles (one is a direct AEAD nonce; the other is an
HKDF `info` parameter that itself PRODUCES a 12-byte value for the same
purpose) and are never meant to be the same value or the same type. A
future wire-compatible implementation introduces its OWN, separate
32-byte nonce type — it does not extend, resize, or repurpose
`FedosAeadNonceDecision`.

## What this document does NOT do

- No new nonce-generation function of any kind (not `fedos_random_bytes_32`-
  based, not a new `fedos_aead_nonce_256`, nothing) — this is planning
  only.
- No change to `crypto::nip44_encrypt`/`nip44_decrypt`'s existing
  `FedosAeadNonceDecision` parameter.
- No change to `fedos_aead_nonce_96`/`FedosAeadNonceDecision` itself.
- No `Cargo.toml` change, no public API addition, no Runtime/Worker/
  Storage/Nostr/Relay connection.

## See also

- `docs/nip44_message_key_review.md` (Stage 214) — confirms this nonce's
  exact role as HKDF-expand's `info` parameter.
- `docs/nip44_wire_payload_layout.md` (Stage 216) — where this nonce sits
  in the wire payload's field order.
- `docs/nonce_generation_policy.md` — this crate's existing CSPRNG
  discipline, which any future 32-byte nonce generator must meet.
- `docs/nip44_wire_implementation_roadmap.md` step 3 — where real 32-byte
  nonce handling is proposed to land (candidate Stage 216 in that
  roadmap's original numbering, folded into this Stage 215 planning
  document instead).
