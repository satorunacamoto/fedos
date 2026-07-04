# NIP-44 v2 wire compatibility gap (Stage 209–213) — docs only

**Status: this document adds no code.** It exists to state, in one place,
in writing, exactly what Stage 202–208's `crypto::nip44_padding`/
`crypto::nip44_encrypt`/`crypto::nip44_decrypt`/`crypto::nip44_bridge`
implementation IS and IS NOT, so that no future stage, docs page, commit
message, UI string, or diagnostics label ever describes it as something it
is not.

## Terminology (binding for this crate)

Two distinct things must never be conflated, in code comments, docs, or
any future user-facing string:

- **"FedOS internal NIP-44-like bridge"** — what Stage 198–208 actually
  built: a generic key-derivation bridge (`ConversationKey`/`MessageKey`)
  and a generic pad-then-seal/open-then-unpad pipeline
  (`nip44_padding`/`nip44_encrypt`/`nip44_decrypt`/`nip44_bridge`), reusing
  this crate's PRE-EXISTING ChaCha20-Poly1305 AEAD
  (`crypto::aead_internal`, Stage 152–154). It is NIP-44-*shaped*
  (conversation key → message key → pad → encrypt-with-authentication),
  but it does not produce or consume NIP-44 v2's actual wire bytes.
- **"NIP-44 v2 wire-compatible implementation"** — a FUTURE, not-yet-built
  pipeline that produces and consumes byte-for-byte the same ciphertext a
  real NIP-44 v2 client (or `test-vectors/nip44/nip44-v2.json`'s
  `valid.encrypt_decrypt`/`valid.encrypt_decrypt_long_msg`/`invalid.decrypt`
  vectors) would accept — see
  `docs/nip44_wire_implementation_roadmap.md` for the stage-by-stage path
  there.

**Forbidden phrasing, anywhere in this crate's docs, code comments, commit
messages, or diagnostics labels, for the Stage 198–208 bridge:**

- "NIP-44 compatible"
- "NIP-44 v2 compatible" / "NIP-44-compliant"
- "NIP-44-ready" (without the word "internal bridge" immediately
  attached)
- Any phrasing that implies a real NIP-44 v2 client could decrypt this
  crate's `nip44_encrypt` output, or that this crate's `nip44_decrypt`
  could open a real NIP-44 v2 client's ciphertext.

**Required phrasing** when referring to the Stage 198–208 work: "FedOS
internal NIP-44-like bridge" (or the equivalent "generic bridge, not
NIP-44 v2's byte-exact wire format", already used throughout
`docs/nip44_internal_plan.md` and every Stage 202–208 module's own doc
comment).

## The gap, field by field

| NIP-44 v2 spec (real wire format) | This crate's Stage 198–208 bridge |
| --- | --- |
| `chacha_key` (32B) / `chacha_nonce` (12B) / `hmac_key` (32B) — three separate values, HKDF-expanded per-message from the conversation key salted by a FRESH random 32-byte nonce (§4 of `docs/nip44_internal_plan.md`) | One `MessageKey` (32 bytes), derived once via the pre-existing, fixed `HkdfDomain::Conversation` — reused directly as a single ChaCha20-Poly1305 AEAD key. No per-message nonce-salted expand exists. |
| A 32-byte random nonce, generated fresh per message and prepended to the wire payload | A 12-byte `FedosAeadNonceDecision` (`fedos_aead_nonce_96`) — this crate's own pre-existing AEAD nonce convention, not NIP-44 v2's 32-byte nonce |
| Unauthenticated ChaCha20 stream cipher (no built-in tag) | This crate's pre-existing ChaCha20-Poly1305 AEAD (`crypto::aead_internal`) — encryption and authentication folded into ONE primitive |
| A separate HMAC-SHA256 tag (32 bytes) over `nonce ‖ ciphertext`, computed and verified independently of the cipher | Poly1305's 16-byte tag, computed and verified as part of the SAME AEAD call — no standalone HMAC-SHA256 step exists anywhere in this crate's NIP-44 code |
| Wire payload = `version_byte (0x02) ‖ nonce (32B) ‖ ciphertext ‖ hmac_tag (32B)`, base64-encoded | `Vec<u8>` ciphertext‖tag (from `aead_internal::seal_internal`), optionally bridged into this crate's OWN, pre-existing, UNCHANGED `ciphertext_envelope::AeadCiphertextEnvelope` — no base64 encoding step, no NIP-44 wire byte layout |
| Distinct decrypt failure modes are spec-defined per step (invalid version byte, invalid HMAC, invalid padding, etc.), collapsed by implementations into one public error | `Nip44DecryptStatus::AuthenticationFailed` — this crate's own single fixed label, already matching the *spirit* of NIP-44 v2's "one opaque failure" discipline, but computed over a DIFFERENT cipher/MAC construction |

## Why this gap exists (not an oversight)

Stage 202–208's own module doc comments (`crypto::nip44_encrypt`,
`crypto::nip44_decrypt`, `crypto::nip44_bridge`) and
`docs/nip44_internal_plan.md`'s §6/§7 updates already recorded this as a
DELIBERATE choice: reusing already-tested, already-audited code
(`aead_internal`, Stage 152–154) costs zero new `Cargo.toml` dependency
and zero new cryptographic primitive to review, at the cost of NOT being
byte-exact NIP-44 v2. This document does not change that choice — it only
makes the gap impossible to miss for anyone reading forward from here.

## What does NOT change because of this document

- No code changes. No `pub fn` addition, no `Cargo.toml` change, no
  Runtime/Worker/Storage/Nostr/Relay connection.
- No rename of any existing `pub(crate)` type or function — `MessageKey`,
  `nip44_encrypt_internal`, `nip44_decrypt_internal`, etc. all keep their
  Stage 198–208 names. This document defines TERMINOLOGY for docs/comments
  going forward; it does not require touching working code identifiers.
- `crypto::nip44_padding`'s `calc_padded_len`/`pad_message`/
  `unpad_message` ARE spec-exact (§5) — this is the one piece of the
  Stage 198–208 bridge that already matches the real NIP-44 v2 wire
  format byte-for-byte, vector-verified. It is called out here so it is
  not lumped in with the parts that are NOT byte-exact.

## See also

- `docs/nip44_internal_plan.md` — the original binding shape document
  (§3–§9), updated in place across Stage 198–208 with "Update —" notes
  recording exactly this gap section by section.
- `docs/nip44_wire_implementation_roadmap.md` — the proposed stage order
  for closing this gap, a piece at a time, ending only once every
  `test-vectors/nip44/nip44-v2.json` vector category passes.
