# NIP-44 v2 wire payload layout planning (Stage 216) — docs only, no code

**Status: this document adds no code.** It fixes, in writing, EVERY field
of NIP-44 v2's real wire payload — order, length, encoding, and exactly
where padding sits relative to encryption — before any serialize/
deserialize function is written. This is the same "fix the shape before
the implementation" discipline `docs/ciphertext_envelope_plan.md` and
`docs/ciphertext_serialization_format_decision.md` already used for this
crate's OWN, separate envelope format.

## The fixed field layout

```
wire_payload (before base64) =

  version_byte  ‖  nonce  ‖  ciphertext  ‖  hmac_tag

  version_byte : 1 byte,  fixed value 0x02  (NIP-44 "v2")
  nonce        : 32 bytes (docs/nip44_wire_nonce.md, Stage 215 — the
                 HKDF-expand `info` parameter, prepended in the CLEAR)
  ciphertext   : variable length — raw ChaCha20 stream-cipher output over
                 the PADDED plaintext (see "Where padding sits" below);
                 length = calc_padded_len(plaintext_len) + 2 (the 2-byte
                 big-endian length prefix `crypto::nip44_padding` already
                 implements spec-exactly, Stage 202–203)
  hmac_tag     : 32 bytes, HMAC-SHA256(hmac_key, nonce ‖ ciphertext)
                 (docs/nip44_internal_plan.md §7)

wire_string = base64_standard_encode(wire_payload)
```

Then `wire_string` is what actually appears in a Nostr event's `content`
field — a single string, no surrounding JSON structure of its own (the
JSON structure is the Nostr event itself; NIP-44's payload is just one
string value inside it).

## Field-by-field: order, length, and WHY it's fixed this way

| Field | Position | Length | Fixed because |
| --- | --- | --- | --- |
| `version_byte` | 1st | 1 byte (constant `0x02`) | Lets a receiver reject an unsupported future NIP-44 version BEFORE attempting any HKDF/HMAC/decrypt work — same "fail fast on a structural mismatch" principle `crypto::ciphertext_envelope::validate_envelope_internal` already applies to THIS crate's own, separate envelope format |
| `nonce` | 2nd | 32 bytes (constant) | Must be readable BEFORE decryption starts — the receiver needs it to re-derive `chacha_key`/`chacha_nonce`/`hmac_key` (`docs/nip44_message_key_review.md`) before it can even attempt to verify the tag or decrypt |
| `ciphertext` | 3rd | variable (per `calc_padded_len`, Stage 202–203) | The only variable-length field — its length is intentionally COARSE-GRAINED (the logarithmic-bucket schedule) specifically so it leaks LESS about the true plaintext length than a byte-exact length would (`docs/nip44_internal_plan.md` §5) |
| `hmac_tag` | 4th, LAST | 32 bytes (constant) | Authenticates `nonce ‖ ciphertext` (`docs/nip44_internal_plan.md` §7) — placed last so it can be computed/verified over every byte that precedes it in a single pass, mirroring the "authenticate the whole prior payload" shape (though NOT the same primitive) this crate's own AEAD tag placement already follows in `crypto::aead_internal` |

Total fixed overhead (excluding the variable `ciphertext`): `1 + 32 + 32 =
65` bytes, before base64 expansion (~4/3 blow-up).

## Where padding sits (relative to encryption — NOT a separate wire field)

**Padding is NOT its own wire-payload field.** It happens strictly
BEFORE encryption, entirely INSIDE what becomes the `ciphertext` field:

```
plaintext (1..=65535 bytes)
   │
   ▼  crypto::nip44_padding::pad_message (Stage 202-203, ALREADY spec-exact)
2-byte big-endian length prefix ‖ plaintext ‖ zero-fill
   = padded buffer, length = 2 + calc_padded_len(plaintext.len())
   │
   ▼  raw ChaCha20 stream-cipher encrypt (keyed by chacha_key/chacha_nonce)
   = the wire payload's `ciphertext` field, byte-for-byte the same length
     as the padded buffer above (a stream cipher never changes length)
```

Consequently: **the wire payload carries no visible "padding" marker of
any kind** — from the outside, a padded-and-encrypted message is
indistinguishable byte-for-byte from an unpadded one of the same
ciphertext length. Only `ciphertext`'s TOTAL length (a multiple of
`calc_padded_len`'s bucket schedule) is observable; the length prefix and
zero-fill inside it are invisible once encrypted. This is exactly why
`crypto::nip44_padding` (Stage 202–203) already lives as its OWN module,
separate from any future wire-serialization code — padding is a
plaintext-shaping step that happens once, before the wire payload's
`ciphertext` field is even computed, not a wire-format concern of its
own.

## Base64: standard, not base64url — and NOT this crate's own encoding

- **Standard base64** (`+`/`/`, `=` padding) — NOT base64url (`-`/`_`, no
  padding), and NOT the SAME choice
  `docs/ciphertext_serialization_format_decision.md` made for THIS
  crate's own, separate ciphertext envelope format (`ciphertext_serialization`,
  Stage 186, uses base64url for `n`/`ct`/`tag` fields inside a canonical
  JSON document). These are two independent encoding decisions for two
  independent wire formats — conflating them would be exactly the kind
  of mistake `docs/nip44_wire_compatibility_gap.md` exists to prevent.
- Base64 (not raw bytes, not hex) is a SPEC REQUIREMENT, not a choice this
  crate gets to reconsider — NIP-44 payloads are embedded directly inside
  a Nostr event's `content` field, which is itself a JSON string; raw
  binary cannot be a JSON string value, so an encoding step is mandatory
  (`docs/nip44_internal_plan.md` §6 already fixed this).
- **No canonical-JSON wrapper** — unlike `ciphertext_serialization`'s
  `{v, alg, aad, n, ct, tag}` document shape, NIP-44's wire payload is
  ONE base64 string with no field names of its own; the field order
  above IS the only "schema" — there is no JSON object, no key names, no
  reordering possible.

## Explicit non-goals of this planning document

- **No `encode`/`decode` function is implemented here** — `crypto::nip44_wire`
  (Stage 209–213) stays a label-only skeleton; this document only fixes
  what such a future function's INPUT/OUTPUT byte layout would be.
- **No base64 dependency is adopted** — `Cargo.toml` is unchanged; a
  future implementing stage would need to either hand-write standard
  base64 (mirroring `crypto::ciphertext_serialization`'s own hand-written
  base64url, Stage 186, which added no dependency either) or explicitly
  review adopting a `base64` crate.
- **Not the same format as `AeadCiphertextEnvelope`.** No field of this
  layout is renamed, reused, or merged into that type — see
  `docs/nip44_internal_plan.md` §6's own cross-reference on this exact
  point.

## See also

- `docs/nip44_message_key_review.md` (Stage 214) — where `chacha_key`/
  `chacha_nonce`/`hmac_key` (this layout's cipher/MAC inputs) come from.
- `docs/nip44_wire_nonce.md` (Stage 215) — the 32-byte `nonce` field this
  layout places second.
- `docs/nip44_internal_plan.md` §5 (padding, spec-exact and implemented),
  §6 (payload structure — this document's source material), §7 (MAC).
- `docs/nip44_wire_implementation_roadmap.md` steps 4–6 — where the real
  ChaCha20 stream cipher, HMAC-SHA256 tag, and base64 encoding steps this
  layout depends on are proposed to land.
