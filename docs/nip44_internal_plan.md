# NIP-44 Internal Implementation Plan (Stage 177) — binding, docs only

**Status: this document adds no code.** It fixes, in writing, the shape a
FUTURE NIP-44 v2 implementation stage must satisfy — naming the
conversation-key derivation, nonce, payload layout, padding scheme,
MAC/authentication step, failure labels, and `SecretHandle` connection
strategy — before any NIP-44 code exists in this crate. This is the same
"fix the shape before the implementation" discipline
`docs/ciphertext_envelope_plan.md`, `docs/secret_handle_api_shape.md`, and
`docs/hkdf_internal_plan.md` each used for their own eventual
implementations.

**No NIP-44 code is implemented by this document.** No `conversation_key`
derivation function, no NIP-44 padding function, no NIP-44 encrypt/decrypt
function, and no connection to `SecretHandle`/`aead_internal`/`kdf_core`
exists anywhere in this crate as of this stage. `test-vectors/nip44/nip44-v2.json`
(imported Stage 73, per that file's own provenance record) already exists
in this repository and is referenced throughout this plan, but is not yet
wired to any `cargo test`.

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

## 9. What this plan does NOT fix

- **No conversation-key derivation function, no message-key derivation
  function, no padding function, no NIP-44 encrypt/decrypt function.** No
  code of any kind.
- **No secp256k1/ECDH dependency adoption.** This crate has none today;
  adopting one is its own future, separate, reviewed decision.
- **No `cargo test` wiring of `test-vectors/nip44/nip44-v2.json`.** The
  file exists (imported Stage 73) but no test reads it yet — that is
  named as Stage 182 candidate work ("NIP-44 vector wiring
  review/update"), not done here.
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
- **No code, no dependency, no public API, no `Cargo.toml` change** is
  authorized or made by this document.
- **The actual implementation is Stage 182 candidate work** ("NIP-44
  vector wiring review/update" as a first step toward it), not made here.
