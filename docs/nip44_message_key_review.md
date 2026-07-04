# NIP-44 v2 exact message key derivation review (Stage 214; IMPLEMENTED Stage 219-220) — docs only at Stage 214, now backed by real code

**Status at Stage 214: this document added no code.** It reviewed, against
the NIP-44 v2 spec and `test-vectors/nip44/nip44-v2.json`'s
`valid.get_message_keys` category (byte-for-byte re-derived below, not
just read from the spec prose), EXACTLY how `chacha_key`/`chacha_nonce`/
`hmac_key` are produced from a `conversation_key`, and listed every
difference from what this crate implemented at the time (Stage 198–201's
`crypto::hkdf_bridge`).

**Update — Stage 219–220: this review's own derivation IS now
implemented and vector-verified.**
[`crypto::nip44_message_keys::derive_message_keys_exact_internal`](../packages/fedos-core-rust/src/crypto/nip44_message_keys.rs)
(`&ConversationKey`-facing) and
[`derive_message_keys_exact_from_bytes_internal`](../packages/fedos-core-rust/src/crypto/nip44_message_keys.rs)
(a lower-level pure-bytes engine) implement §1's exact schedule below
byte-for-byte: `Hkdf::<Sha256>::from_prk(conversation_key)` (NEVER
`Hkdf::extract` — `conversation_key` is treated as the PRK directly, per
§1) then `.expand(nonce, &mut okm[76])`, split into `chacha_key`
(`okm[0..32]`), `chacha_nonce` (`okm[32..44]`), `hmac_key`
(`okm[44..76]`). ALL 32 `valid.get_message_keys` cases match exactly (the
sibling `#[cfg(test)]`-only `nip44_message_key_vectors` module, Stage
220). §2's terminology correction (`nonce` is HKDF's `info`, not `salt`)
is now embodied directly in the code: the parameter is named `nonce` and
passed as `expand`'s `info` argument, never anywhere near a `salt`
parameter. §3's diff table is now HISTORICAL — it describes the Stage
200–201 `hkdf_bridge` gap as it stood before this update; `hkdf_bridge`
itself remains completely UNCHANGED (this stage deliberately did not
touch it — see this module's own doc comment), and the exact derivation
instead lives in the separate `nip44_message_keys` module. Still true,
unchanged: no wire encrypt/decrypt, no ChaCha20 stream-cipher call, no
HMAC-SHA256 computation, no base64, no wire serialization, no public API,
no Runtime/Worker/Storage/Relay connection — see
`docs/nip44_wire_implementation_roadmap.md` for what remains (steps
2–8: wire nonce generation, ChaCha20 stream encryption, the HMAC tag
itself, base64 payload encoding, invalid vectors, and only then a Nostr
DM bridge).

## 1. The exact derivation order (RFC 5869 roles, verified against the vectors)

```
conversation_key (32 bytes)
   — already produced by §3's HKDF-EXTRACT-ONLY step
   — (secp256k1 ECDH shared-X ‖ salt "nip44-v2" → Hkdf::extract → PRK)
   — this PRK is reused AS-IS below; there is NO second extract.
        │
        ▼
HKDF-EXPAND (RFC 5869 §2.3), keyed by the SAME conversation_key as PRK:
   PRK  = conversation_key                (32 bytes — the Stage 199 output)
   info = nonce                           (32 bytes — FRESH, RANDOM, PER MESSAGE)
   L    = 76                              (bytes of output key material, OKM)
        │
        ▼
OKM (76 bytes), split by fixed byte offset — NOT three separate HKDF calls:
   chacha_key    = OKM[ 0..32]  (32 bytes)
   chacha_nonce  = OKM[32..44]  (12 bytes)
   hmac_key      = OKM[44..76]  (32 bytes)
```

This was re-derived and confirmed byte-for-byte against
`test-vectors/nip44/nip44-v2.json`'s `valid.get_message_keys` category
(first case) using a standalone RFC 5869 HKDF-expand implementation,
independent of this crate's own `kdf_core`: given `conversation_key =
a1a3d60f...b54` and `nonce = e1e6f880...d72`, `hkdf_expand(conversation_key,
nonce, 76)` reproduces that vector's exact `chacha_key`/`chacha_nonce`/
`hmac_key` triple. All entries in the category follow the same rule.

## 2. Correcting `docs/nip44_internal_plan.md` §4's own terminology

§4 (written at Stage 177, still accurate on substance) describes the
per-message `nonce` as "a fresh random 32-byte `nonce` as HKDF salt for
each message." **This mixes up RFC 5869's two distinct roles.** Per RFC
5869:

- §2.2 **Extract**: `PRK = HMAC-Hash(salt, IKM)` — `salt` is extract's
  own parameter, already consumed and finished at §3 (`Hkdf::extract(Some(b"nip44-v2"),
  shared_x)`); there is no second salt/extract step for message keys.
- §2.3 **Expand**: `OKM = HKDF-Expand(PRK, info, L)` — the per-message
  `nonce` plays the role of **`info`** here, not `salt`. `salt` has no
  meaning in an expand-only call; this derivation never calls
  `Hkdf::extract` a second time.

This is a **terminology correction only** — the substantive claims in §4
("per-message keys are derived FROM `conversation_key`, not reused",
"this is a SECOND, NIP-44-specific expand step, layered on top of §3's
extract", "the nonce MUST be freshly, randomly drawn per message") were
already correct and remain unchanged. A future edit to
`docs/nip44_internal_plan.md` §4 may replace "HKDF salt" with "HKDF
`info`" for precision; this document does not make that edit itself (no
code OR doc-content change beyond this new file is authorized by
Stage 214 — see `docs/nip44_wire_implementation_roadmap.md` step 1 for
where §4 itself would be touched, if ever, alongside the real
implementation).

## 3. Diff: real spec vs. this crate's CURRENTLY IMPLEMENTED bridge

| Aspect | NIP-44 v2 real spec (§4, confirmed above) | `crypto::hkdf_bridge` (Stage 200–201, currently implemented) |
| --- | --- | --- |
| PRK source | `conversation_key` reused AS-IS (no new extract) | `conversation_key`'s raw bytes, fed as fresh `HkdfInputMaterial` IKM into `derive_secret_handle_internal`, which runs its OWN `Hkdf::new(salt, ikm)` — i.e. a SECOND extract happens, using a FIXED salt, not none |
| `info`/context | The per-message, FRESH, RANDOM 32-byte `nonce` — different every call | `HkdfDomain::Conversation`'s FIXED, compile-time `info` (`b"fedos-hkdf-info-conversation-v1"`) — identical every call, never caller-supplied |
| Output length | 76 bytes (`chacha_key` 32 + `chacha_nonce` 12 + `hmac_key` 32) | 32 bytes (one `MessageKey`) |
| Output shape | THREE distinct values, each with its own purpose (stream cipher key, stream cipher nonce, MAC key) | ONE combined value, reused directly as a single ChaCha20-Poly1305 AEAD key by `crypto::nip44_encrypt`/`nip44_decrypt` (Stage 204–205) |
| Per-message freshness | A NEW `nonce` (and therefore a NEW `chacha_key`/`chacha_nonce`/`hmac_key` triple) every message | `MessageKey` derivation is nonce-FREE — the same `ConversationKey` input always derives the same `MessageKey` (confirmed by `crypto::hkdf_bridge`'s own `is_deterministic_for_the_same_conversation_key` test); message-to-message freshness instead comes from `crypto::nip44_encrypt`'s separately-drawn 12-byte AEAD nonce (`fedos_aead_nonce_96`) |
| Vector coverage | `valid.get_message_keys` (this category) | NOT wired to `cargo test` — `crypto::hkdf_bridge` has no vector-verification test against this category, only its own internal round-trip tests |

This is exactly the gap `docs/nip44_internal_plan.md` §4 already flagged
("NOT YET this section's real derivation") and
`docs/nip44_wire_compatibility_gap.md` already named as part of the
broader "FedOS internal NIP-44-like bridge, not NIP-44 v2 wire-compatible"
distinction — this document adds the byte-level confirmation and the
precise RFC 5869 role correction, nothing more.

## 4. What this review did NOT do at Stage 214 (superseded in part by Stage 219–220)

- **As of Stage 214: no code change.** `crypto::hkdf_bridge`/
  `crypto::message_key`/`crypto::conversation_key` were untouched.
  `crypto::nip44_message_keys` (Stage 217, a separate new file) added
  LABEL-ONLY types — no HKDF call, no real derivation.
- **As of Stage 219–220: the real derivation and its vector wiring EXIST**
  — `crypto::nip44_message_keys::derive_message_keys_exact_internal`/
  `derive_message_keys_exact_from_bytes_internal`, and the sibling
  `#[cfg(test)]`-only `nip44_message_key_vectors` module wires all 32
  `valid.get_message_keys` cases to `cargo test` — see this document's
  own update note above. `crypto::hkdf_bridge`/`crypto::message_key`/
  `crypto::conversation_key` remain UNCHANGED even now — the real
  derivation lives entirely in the new, separate `nip44_message_keys`
  module, per this stage's own explicit scope limit.
- **No `SecretHandle`/`ConversationKey`/`MessageKey` type change** — still
  true at Stage 219–220.
- **No Encrypt/Decrypt, no ChaCha20 stream cipher, no HMAC-SHA256
  computation, no base64, no wire payload/serialization, no Runtime/
  Worker/Storage/Relay connection** — see
  `docs/nip44_wire_implementation_roadmap.md` steps 2–8 for what remains.

## See also

- `docs/nip44_internal_plan.md` §3 (conversation key, spec-exact,
  implemented) and §4 (message keys, this review's subject).
- `docs/nip44_wire_compatibility_gap.md` — the broader terminology split
  this review's findings feed into.
- `docs/nip44_wire_implementation_roadmap.md` step 1 — where the real
  derivation is proposed to land (candidate Stage 219).
- `docs/nip44_wire_nonce.md` (Stage 215) — the 32-byte `nonce` this
  review's `info` parameter names, reviewed in its own right (generation
  responsibility, reuse prohibition, and how it differs from this crate's
  own 12-byte AEAD nonce).
