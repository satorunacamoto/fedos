# NIP-44 Internal Implementation Plan (Stage 177, §3 IMPLEMENTED Stage 198-201) — binding, docs only

**Status (as of Stage 177): this document adds no code.** It fixes, in
writing, the shape a FUTURE NIP-44 v2 implementation stage must satisfy —
naming the conversation-key derivation, nonce, payload layout, padding
scheme, MAC/authentication step, failure labels, and `SecretHandle`
connection strategy — before any NIP-44 code exists in this crate. This is
the same "fix the shape before the implementation" discipline
`docs/ciphertext_envelope_plan.md`, `docs/secret_handle_api_shape.md`, and
`docs/hkdf_internal_plan.md` each used for their own eventual
implementations.

**Update — Stage 198-201 implement §3 for real.** `crypto::conversation_key::derive_conversation_key_via_ecdh_internal`
implements exactly §3's pipeline (secp256k1 ECDH via `k256`'s `arithmetic`
feature, then HKDF-SHA256 extract-only with the fixed `"nip44-v2"` salt),
vector-verified against `test-vectors/nip44/nip44-v2.json`'s
`valid`/`invalid .get_conversation_key` categories (43 cases). `crypto::message_key`
and `crypto::hkdf_bridge` add a `MessageKey` type and a generic
`ConversationKey` → `MessageKey` bridge (reusing the pre-existing
`HkdfDomain::Conversation`) — see §4's note below for why this is
NOT yet §4's real per-message derivation.

**Update — Stage 202-208 implement §5 (padding) for real, and a GENERIC
(not byte-exact) version of §6/§7 (pad-then-encrypt / open-then-unpad,
with authentication).** `crypto::nip44_padding` implements
`calc_padded_len`/`pad_message`/`unpad_message` exactly as §5 specifies,
vector-verified against `valid.calc_padded_len` (24 cases) and
`invalid.encrypt_msg_lengths` (4 cases). `crypto::nip44_encrypt`/
`crypto::nip44_decrypt` implement a pad-then-seal / open-then-unpad
pipeline keyed by a `MessageKey`, but reuse this crate's PRE-EXISTING
ChaCha20-Poly1305 AEAD (`crypto::aead_internal`, Stage 152–154) rather
than §6/§7's byte-exact raw-ChaCha20-plus-HMAC-SHA256 construction — see
the updated §6/§7 notes below for exactly what this does and does not
achieve. `crypto::nip44_bridge` connects both to the pre-existing,
UNCHANGED `ciphertext_envelope::AeadCiphertextEnvelope` type. §4's real
per-message `chacha_key`/`chacha_nonce`/`hmac_key` derivation remains
unimplemented — Stage 202-208 deliberately did not need it, since the
generic `MessageKey` (Stage 200-201) is used as a single AEAD key
directly instead.

**No byte-exact NIP-44 encrypt/decrypt function** (matching
`test-vectors/nip44/nip44-v2.json`'s `valid.encrypt_decrypt`/
`invalid.decrypt` categories) exists anywhere in this crate as of Stage
208 — see §6/§7 below. `test-vectors/nip44/nip44-v2.json` (imported Stage
73, per that file's own provenance record) already exists in this
repository and is referenced throughout this plan; its
`get_conversation_key` (Stage 199) and `calc_padded_len`/
`encrypt_msg_lengths` (Stage 203) categories are now wired to `cargo
test`; `get_message_keys`, `encrypt_decrypt`, `encrypt_decrypt_long_msg`,
and `decrypt` remain unwired, since they require the byte-exact §4/§6/§7
pipeline this crate does not implement.

This complements, and does not renegotiate, `docs/hkdf_internal_plan.md`
(the HKDF-SHA256 implementation NIP-44's own key derivation would need to
either reuse or deliberately diverge from), `docs/aead_internal_implementation.md`
(this crate's ChaCha20-Poly1305 implementation, which NIP-44 v2 does
NOT use directly — see §3), `docs/secret_lifecycle_implementation_plan.md`
(the `SecretHandle` lifecycle a conversation key would need to follow),
and `docs/ciphertext_envelope_plan.md`/`docs/ciphertext_envelope_serialization_plan.md`
(this crate's OWN, separate ciphertext envelope — NOT the same format as
NIP-44's payload, per §6 of both documents). Where this document and any
of those disagree, the earlier binding docs win.

---

## 1. Purpose

- **Fix NIP-44 v2's cryptographic pipeline in writing**, against the
  spec (`nostr-protocol/nips` 44.md) and the vector categories already
  imported into `test-vectors/nip44/nip44-v2.json`, so a future
  implementing stage has a reviewed shape to build against.
- **Name the `SecretHandle` connection strategy** — how a NIP-44
  conversation key would be held, without inventing a new secret-handling
  discipline that diverges from `docs/secret_lifecycle_implementation_plan.md`.
- **Not an implementation.** No code, no `cargo test` wiring, no
  `Cargo.toml` change.
- **Explicitly separate from Chat/DM feature work.** Whether/how this
  crate's eventual NIP-44 primitive gets called by a chat or
  direct-message feature is its OWN, later, separate stage — see §8.

## 2. What NIP-44 v2 is (per the spec and the imported vectors)

NIP-44 v2 ("Encrypted Payloads (Versioned)") is Nostr's encrypted
direct-message payload scheme: `secp256k1 ECDH → HKDF-SHA256 → ChaCha20 +
HMAC-SHA256, padded` (per `test-vectors/nip44/nip44-v2.json`'s own
`"algorithm"` field). It is NOT the same construction as this crate's own
AEAD implementation (`docs/aead_internal_implementation.md`:
ChaCha20-Poly1305 / AES-256-GCM) — NIP-44 v2 uses unauthenticated
ChaCha20 (stream cipher, no built-in tag) PLUS a separate HMAC-SHA256 for
authentication, not an AEAD construction in the RustCrypto `Aead` trait
sense. This is a real, deliberate divergence a future implementing stage
must respect, not an oversight to "fix" by reusing `aead_internal`.

## 3. Conversation key derivation

**IMPLEMENTED Stage 199** — `crypto::conversation_key::derive_conversation_key_via_ecdh_internal`,
exactly as this section specifies below (manual `k256` `arithmetic`-only
point multiplication for ECDH, then `hkdf::Hkdf::extract` with the fixed
`"nip44-v2"` salt), verified against all 43
`valid`/`invalid .get_conversation_key` vector cases.

Per the imported vectors' `valid.get_conversation_key` category
(`sec1`/`pub2` → `conversation_key`, ECDH + HKDF-extract):

- **Input**: one party's secp256k1 secret key (`sec1`) and the other
  party's public key (`pub2`).
- **Step 1 — ECDH**: compute the shared secret point via secp256k1 ECDH
  (`sec1 * pub2`), take its X-coordinate (32 bytes) — the spec's
  "shared secret" input to HKDF.
- **Step 2 — HKDF-extract only (NOT extract-and-expand)**: NIP-44 v2 uses
  HKDF-SHA256's EXTRACT step alone, with the fixed salt `"nip44-v2"`
  (ASCII bytes), to derive the 32-byte `conversation_key` directly from
  the ECDH shared secret. This is narrower than this crate's own
  `kdf_core::derive_secret_handle_internal` (Stage 147), which performs
  full extract-AND-expand with a `HkdfDomain`-selected salt/info pair —
  a future NIP-44 stage needs its OWN extract-only call path, or a
  narrowly-scoped addition to `kdf_core` exposing extract alone; it must
  NOT silently reuse the existing expand-inclusive function with
  mismatched semantics.
- **`invalid.get_conversation_key` vectors exist** (malformed/invalid
  `sec1`/`pub2` inputs) — a future implementation must reject these with
  a fixed failure label (§7), never a panic.
- **This crate has no secp256k1 ECDH primitive today.** Whether this
  becomes a new production dependency (a `secp256k1`/`k256`-family crate)
  is its OWN, separate, explicitly-reviewed `Cargo.toml` decision per
  `docs/rust_dependency_adoption.md` — not pre-authorized by this
  document. (This repository's `packages/fedos-core-rust/Cargo.toml`
  currently has no secp256k1 dependency; Nostr identity/signing elsewhere
  in this repository, e.g. `src/nip07.ts`/signature modules, is
  TypeScript-side and outside this crate's scope.)

## 4. Message keys, nonce, and payload derivation

**NOT YET this section's real derivation.** Stage 200-201 add a
`crypto::message_key::MessageKey` type and a generic
`crypto::hkdf_bridge::derive_message_key_from_conversation_key_internal`
bridge, but that bridge reuses the crate's pre-existing, FIXED
`HkdfDomain::Conversation` (a compile-time salt/info pair) — it does NOT
accept a per-message, caller-supplied random nonce as HKDF-expand salt,
and does NOT produce the `chacha_key`/`chacha_nonce`/`hmac_key` triple
this section specifies below. That real, spec-accurate, nonce-salted
per-message derivation remains a future, separate, explicitly-reviewed
stage (naturally paired with the padding/encrypt work below, since
`chacha_nonce`/`hmac_key` have no use until then).

Per the imported vectors' `valid.get_message_keys` category:

- **Per-message keys are derived FROM `conversation_key`, not reused
  across messages.** NIP-44 v2 derives per-message `chacha_key`,
  `chacha_nonce` (12 bytes), and `hmac_key` via HKDF-expand, keyed by
  `conversation_key`, with a fresh random 32-byte `nonce` as HKDF salt for
  each message (distinct from this crate's own
  `fedos_aead_nonce_96`/`FedosAeadNonceDecision` shape — NIP-44's "nonce"
  here is the HKDF-expand salt, 32 bytes, not the 12-byte ChaCha stream
  nonce it derives).
- **This is a SECOND, NIP-44-specific expand step**, layered on top of
  §3's conversation-key extract — a future implementation needs both
  steps, in this exact order, not a single combined derivation.
- **The nonce (HKDF salt) MUST be freshly, randomly drawn per message** —
  same "CSPRNG-drawn, never deterministic, never a counter" discipline
  `docs/nonce_generation_policy.md` already fixes for this crate's own
  AEAD nonces. Whether NIP-44's future implementation reuses
  `fedos_random_bytes_32`/a sibling of `fedos_aead_nonce_96`, or needs its
  own dedicated 32-byte draw, is the implementing stage's own decision —
  either is consistent with this crate's existing "CSPRNG via
  `getrandom::fill`, no fallback" discipline.

## 5. Padding scheme

**IMPLEMENTED Stage 202-203** — `crypto::nip44_padding::calc_padded_len`/
`pad_message`/`unpad_message`, exactly as this section specifies below,
verified against all 24 `valid.calc_padded_len` cases and all 4
`invalid.encrypt_msg_lengths` cases.

Per the imported vectors' `valid.calc_padded_len` and
`invalid.encrypt_msg_lengths` categories:

- **NIP-44 v2 pads plaintext to a fixed schedule BEFORE encryption** — a
  custom logarithmic-bucket padding scheme (the spec defines
  `calc_padded_len(len)`: small messages round up to the next power-of-two
  bucket, larger messages use a coarser schedule) specifically designed to
  reduce plaintext-length leakage beyond what fixed-size AEAD tag overhead
  already reveals (the same "no additional side-channel field" principle
  `docs/ciphertext_envelope_serialization_plan.md` §4 fixes for this
  crate's own envelope format, applied here to length rather than to a
  metadata field).
- **A 2-byte big-endian length prefix precedes the padded plaintext**
  (the actual, unpadded length), so the receiver can recover the exact
  original message after removing padding.
- **Minimum and maximum plaintext length are both bounded** — the spec
  defines a minimum (1 byte) and maximum (65535 bytes) valid plaintext
  length; `invalid.encrypt_msg_lengths` vectors test both an
  under-minimum and an over-maximum length are REJECTED before any
  encryption is attempted, not silently truncated or wrapped.
- **This is a NIP-44-specific padding scheme, unrelated to any padding
  this crate's own AEAD/HKDF implementations use** (they use none — AEAD
  ciphertext length already equals plaintext length plus fixed tag
  overhead, with no additional padding). A future implementation must not
  conflate the two.

## 6. Payload structure and encoding

**Update — Stage 204-206 implement a GENERIC pad-then-seal pipeline, NOT
this section's byte-exact wire payload.** `crypto::nip44_encrypt`/
`crypto::nip44_decrypt` pad plaintext exactly per §5, then seal/open it
via this crate's own pre-existing ChaCha20-Poly1305 AEAD
(`crypto::aead_internal`) — which combines encryption and authentication
into ONE primitive, unlike this section's `ChaCha20 stream cipher +
separate HMAC-SHA256 tag` construction. Concretely, this means: no
`version_byte (0x02) ‖ nonce (32 bytes) ‖ ...` wire layout (the nonce this
crate's pipeline uses is the pre-existing 12-byte `FedosAeadNonceDecision`,
not a 32-byte HKDF-expand salt), no base64 encoding (ciphertext stays a
plain `Vec<u8>`, bridged into the crate's OWN pre-existing
`ciphertext_envelope::AeadCiphertextEnvelope` by `crypto::nip44_bridge`,
Stage 206 — itself UNCHANGED by this work), and the authentication tag is
Poly1305's (16 bytes, appended by the AEAD crate), not a 32-byte
HMAC-SHA256 tag. This is a deliberate, documented, zero-new-dependency
choice (`crypto::nip44_encrypt`'s own module-level doc comment) — the
same "generic bridge, not the real per-message wire format" choice
`crypto::hkdf_bridge` (Stage 201) already made for key derivation. Byte-
exact compatibility with this section's spec wire format remains a
future, separate, explicitly-reviewed stage that would need to adopt a
raw `chacha20` stream-cipher crate and a separate `hmac` crate.

Per the spec and the imported vectors' `valid.encrypt_decrypt` /
`valid.encrypt_decrypt_long_msg` categories:

- **NIP-44 v2's own wire payload is: `version_byte (0x02) ‖ nonce (32
  bytes) ‖ ciphertext (padded, length-prefixed) ‖ hmac_tag (32 bytes)`**,
  then base64-encoded as a single string — because NIP-44 payloads are
  embedded directly in a Nostr event's `content` field, which is itself a
  JSON string, base64 is not a candidate here, it is a SPEC REQUIREMENT.
  This is a fixed, external, upstream spec detail, not a choice this
  crate's own `docs/ciphertext_envelope_serialization_plan.md` gets to
  make — that document's own encoding comparison is for THIS crate's
  SEPARATE, own ciphertext envelope format, explicitly not for NIP-44
  (see that document's §6 and this document's §9, both cross-referencing
  each other on this exact point).
- **This is NOT the same wire format as `AeadCiphertextEnvelope`/
  `FedosCiphertextEnvelope`.** A future NIP-44 implementation produces its
  own, spec-defined payload bytes — it does not construct or consume this
  crate's own envelope type. Whether a future stage wraps a NIP-44 payload
  inside (or alongside) this crate's own envelope for some other purpose
  is explicitly not decided here.

## 7. MAC/authentication and failure labels

**Update — Stage 205-208 implement this section's FAILURE-LABEL
discipline for real, using ChaCha20-Poly1305's own Poly1305 tag rather
than a separate HMAC-SHA256 tag** (see the updated §6 note above for why).
`crypto::nip44_decrypt::Nip44DecryptStatus::AuthenticationFailed` is the
one fixed label covering every reachable cause post-key/nonce validation
— a wrong key, a wrong nonce, a tampered ciphertext, an invalid Poly1305
tag, AND a structurally malformed padded plaintext discovered by
`crypto::nip44_padding::unpad_message` AFTER authentication already
succeeded — verified by that module's own test suite
(`malformed_padding_after_successful_authentication_still_reports_authentication_failed`).
A separate `Nip44DecryptStatus::InvalidKey`/`InvalidNonce` pair covers
the structural preconditions this section's own last paragraph
anticipated needing a distinct label from the MAC/decrypt failure.
Constant-time comparison is inherited from the underlying
`chacha20poly1305` crate's own Poly1305 tag verification (already
`subtle`-based internally) — this crate's own `subtle` dependency is
still not directly imported by this pipeline, since it never implements
its own MAC comparison.

Per the imported vectors' `invalid.decrypt` category:

- **HMAC-SHA256 authenticates `nonce ‖ ciphertext` (NOT the plaintext
  directly)**, keyed by the per-message `hmac_key` (§4) — verified BEFORE
  decryption is attempted, mirroring this crate's own AEAD
  "authenticate-then-decrypt" discipline
  (`docs/aead_internal_implementation.md`) even though the underlying
  primitives differ (HMAC vs. an AEAD tag).
  A future implementation must use a CONSTANT-TIME comparison for the MAC
  check (this crate already depends on `subtle` for exactly this purpose,
  adopted Stage 76 but not yet connected to anything — see
  `docs/rust_dependency_adoption.md`).
- **A SINGLE fixed failure label should cover every decrypt failure
  cause** (wrong key, wrong nonce, tampered ciphertext, invalid MAC,
  invalid padding, invalid version byte) — mirroring
  `FedosDecryptStatus::AuthenticationFailed`'s existing "one label, never
  distinguishing WHY" discipline (`docs/public_crypto_api.md`), per
  RFC 8439/NIST AEAD guidance against side-channel-revealing error
  differentiation. The imported `invalid.decrypt` vectors cover several
  distinct tamper causes; a future implementation's OWN test suite proves
  they all collapse to the same label, exactly as this crate's existing
  `fedos_decrypt` tests already prove for its own AEAD envelope.
- **A separate, distinct failure label is needed for §3/§5's own failure
  cases** (invalid conversation-key input, invalid plaintext length) —
  these fail BEFORE any MAC check is even reached, so collapsing them into
  the same label as a MAC/decrypt failure would blur a structural
  precondition failure with a cryptographic authentication failure. The
  exact label set (how many distinct labels, their names) is the
  implementing stage's own decision — not fixed here beyond "at least
  these two categories are distinct."

## 8. `SecretHandle` connection strategy

**IMPLEMENTED Stage 198-201** — exactly the dedicated-variant choice this
section anticipated: `SecretHandleKind::ConversationKeyMaterial` and
`SecretHandleKind::MessageKeyMaterial` (not a reuse of `NostrKeyMaterial`/
`HkdfOutputMaterial`), each wrapped in its own opaque
`ConversationKey`/`MessageKey` type (`crypto::conversation_key`,
`crypto::message_key`) — no `Clone`, no `Debug`, no public raw-byte
accessor on either, mirroring `SecretHandle` itself.

- **A NIP-44 conversation key SHOULD be held as a `SecretHandle`**, using
  a NEW `SecretHandleKind` variant (this crate already reserves
  `SecretHandleKind::NostrKeyMaterial` — see `src/lib.rs`'s
  `secret_handle` module — which a future stage may reuse or replace with
  a more specifically-named variant, e.g. a dedicated
  `Nip44ConversationKey` kind, as its own reviewed choice) — never a bare
  `[u8; 32]` passed around as a conversation key. This follows
  `docs/secret_lifecycle_implementation_plan.md`'s standing discipline:
  every long-lived secret this crate derives or holds goes through
  `SecretHandle`'s `SecretBox`-backed, zeroize-on-clear lifecycle, exactly
  like `AeadKeyMaterial`/`HkdfOutputMaterial` already do.
- **Per-message derived keys (`chacha_key`/`hmac_key`, §4) are
  SHORTER-LIVED** than the conversation key itself — whether each ALSO
  gets its own `SecretHandle` (mirroring `expose_bytes_for_internal_aead`'s
  "narrowly-scoped accessor per reviewed call site" pattern,
  `docs/secret_handle_api_shape.md` §6) or is handled as a transient,
  immediately-zeroized local buffer (mirroring `seal_internal`'s own
  `key_bytes.zeroize()` pattern in `crypto::aead_internal`) is the
  implementing stage's own decision — either is consistent with this
  crate's existing secret-handling discipline; this document does not
  mandate one over the other.
- **This is entirely separate from `fedos_encrypt`/`fedos_decrypt`/
  `FedosAeadKeyHandle`** (`docs/public_crypto_opaque_handles.md`, Stage
  166–176) — those functions operate on this crate's OWN AEAD
  (`AeadCipher`), never on a NIP-44 conversation key. A future NIP-44
  public API (if one is ever built) would be its OWN, separate, later,
  explicitly-reviewed public boundary — not an overload or variant of the
  existing `fedos_encrypt`/`fedos_decrypt` functions.

## 9. What this plan does NOT fix (Stage 177 original; see Stage 198-208 updates in §3/§4/§5/§6/§7/§8 above)

- **As of Stage 208: padding IS implemented (§5, spec-exact); encrypt/
  decrypt/authentication ARE implemented, but as a GENERIC bridge onto
  this crate's pre-existing ChaCha20-Poly1305 AEAD, not §6/§7's
  byte-exact raw-ChaCha20-plus-HMAC-SHA256 wire format.** §3's
  conversation-key derivation and §4-adjacent generic bridge remain as
  they were at Stage 201 — see §3/§4/§8.
- **secp256k1/ECDH dependency IS now adopted** (`k256`, Stage 194) and
  used (Stage 199) — superseding this line's original Stage 177 framing.
- **`test-vectors/nip44/nip44-v2.json`'s `get_conversation_key` (Stage
  199, 43 cases) and `calc_padded_len`/`encrypt_msg_lengths` (Stage 203,
  28 cases) categories ARE now wired to `cargo test`** — the remaining
  three categories (`get_message_keys`, `encrypt_decrypt`/
  `encrypt_decrypt_long_msg`, `decrypt`) require the byte-exact §4/§6/§7
  pipeline this crate does not implement, and are not wired.
- **No public API.** Whether a future NIP-44 primitive is ever exposed
  publicly, and in what opaque-handle shape (mirroring
  `docs/public_crypto_opaque_handles.md`'s discipline), is not decided
  here.
- **No Chat/DM feature connection.** Whether/how a chat or direct-message
  feature calls into a future NIP-44 primitive is its own, later, separate
  stage — this document fixes the cryptographic primitive's shape only,
  not its eventual callers.
- **No Runtime/Worker/Storage/Nostr-relay connection of any kind.**

## 10. Conclusion

- **NIP-44 v2's full pipeline is fixed in writing**: secp256k1 ECDH →
  HKDF-extract (conversation key, §3) → HKDF-expand (per-message
  chacha_key/nonce/hmac_key, §4) → pad-then-ChaCha20-encrypt (§5) →
  version‖nonce‖ciphertext‖hmac_tag, base64-encoded (§6) →
  HMAC-then-decrypt with a single fixed failure label per class of
  failure (§7).
- **`SecretHandle` connection strategy named** (§8): conversation key as
  a `SecretHandle`, per-message keys either as narrowly-scoped
  `SecretHandle`s or zeroized transient buffers — implementing stage's
  choice between the two.
- **Explicitly separate from this crate's own AEAD/ciphertext-envelope
  work** (§2, §6) and from any Chat/DM feature (§8, §9) — no conflation.
- **§3 (conversation key), §5 (padding) ARE implemented spec-exactly
  (Stage 199, 202-203); §4 (real per-message chacha_key/nonce/hmac_key),
  §6 (byte-exact wire payload), and full byte-exact §7 remain
  unimplemented — Stage 204-208 instead implement a GENERIC pad-then-seal/
  open-then-unpad pipeline reusing this crate's pre-existing
  ChaCha20-Poly1305 AEAD, with §7's single-fixed-failure-label discipline
  implemented for real against that generic pipeline.** Zero new
  `Cargo.toml` dependency, no public API, no `Cargo.toml` change beyond
  what Stage 194 already adopted.
