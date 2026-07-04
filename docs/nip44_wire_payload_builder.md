# NIP-44 v2 wire payload builder + validator (Stage 225–226) — implementation record

**Status: this document records real code.** Unlike
`docs/nip44_wire_payload_layout.md` (Stage 216, planning only — field
order, lengths, base64, no code), this document describes the ACTUAL
skeleton Stage 225–226 landed:
[`crypto::nip44_wire_payload`](../packages/fedos-core-rust/src/crypto/nip44_wire_payload.rs).

**This is a SKELETON only — ChaCha20 stream encryption and HMAC-SHA256
are NOT connected.** `ciphertext`/`mac` stay `None` (placeholder) in
every payload this stage can build; no function anywhere in this crate
turns plaintext into `ciphertext` or computes a real `mac` yet.

## What exists

### The builder (Stage 225)

- `Nip44WirePayload { version, nonce, ciphertext, mac }` — the fixed
  field order `docs/nip44_wire_payload_layout.md` already fixed.
  - `version: Nip44WireVersion` — always `V2`.
  - `nonce: [u8; 32]` — REAL, freshly drawn via
    `crypto::nip44_wire_nonce::generate_wire_nonce_internal` (Stage 224).
  - `ciphertext: Option<Vec<u8>>` — **always `None`** at this stage
    (placeholder; no ChaCha20 stream cipher exists).
  - `mac: Option<[u8; 32]>` — **always `None`** at this stage
    (placeholder; no HMAC-SHA256 exists).
- `Nip44WirePayloadBuilder::build_placeholder() -> Nip44WirePayloadDecision`
  — the ONE constructor. Takes NO ciphertext, plaintext, key, or MAC
  input of any kind. Returns `Nip44WirePayloadStatus::Placeholder` with a
  real payload on success, or `Nip44WirePayloadStatus::InternalFailure`
  (nonce draw failed — no degraded payload) on failure.

### The validator (Stage 226)

- `validate_wire_payload_placeholder(version_tag: u8, nonce: &[u8],
  ciphertext_present: bool, mac_present: bool) ->
  Nip44WirePayloadValidationDecision` — validates an UNTRUSTED CANDIDATE
  set of wire payload field values STRUCTURALLY ONLY, mirroring
  `crypto::ciphertext_envelope::validate_envelope_internal`'s own
  "untrusted candidate, structural checks only" shape. Checks, in order:
  1. `version_tag` must equal `NIP44_WIRE_VERSION_TAG_V2` (`0x02`) — else
     `InvalidVersion`.
  2. `nonce.len()` must be exactly 32 — else `InvalidNonceLength`.
  3. Both `ciphertext_present` and `mac_present` must be `true` — else
     `MissingField`.
  4. Otherwise, `Valid`.
- **Performs NO authentication, NO decryption, NO HMAC verification, and
  NO base64 decoding of any kind.** `ciphertext_present`/`mac_present`
  report PRESENCE only — the function never inspects, decodes, or
  authenticates the underlying bytes.

## The honest result: today's skeleton is not yet "wire-valid"

Calling `validate_wire_payload_placeholder` against
`Nip44WirePayloadBuilder::build_placeholder`'s own output reports
`MissingField` — `ciphertext`/`mac` are still `None`. This is INTENTIONAL
and verified by this module's own
`a_freshly_built_placeholder_payload_is_not_yet_wire_valid` test: the
validator names what "wire-valid" WILL mean once a later stage wires real
ChaCha20 stream encryption and HMAC-SHA256 (`docs/nip44_wire_implementation_roadmap.md`
steps 4–5), it does not pretend today's skeleton already satisfies that
bar.

## What this stage does NOT do

- **No ChaCha20 stream cipher, no HMAC-SHA256 computation.**
- **No wire encode/decode** — no function anywhere in this module turns
  a `Nip44WirePayload` into bytes (base64 or otherwise) or back; there is
  no serializer/deserializer.
- **No connection to `crypto::nip44_encrypt`/`nip44_decrypt`/
  `nip44_bridge`** (the Stage 202–206 "FedOS internal NIP-44-like
  bridge") — that pipeline is entirely untouched and unrelated.
- **No connection to `crypto::conversation_key`/`crypto::message_key`/
  `crypto::hkdf_bridge`.**
- **No public API, no Runtime/Worker/Storage/Relay connection, no new
  `Cargo.toml` dependency.**

## See also

- `docs/nip44_wire_payload_layout.md` (Stage 216) — the planning document
  this stage implements the field shape of.
- `docs/nip44_wire_nonce_generation.md` (Stage 224) — the nonce generator
  this module's builder calls.
- `docs/nip44_wire_compatibility_gap.md` — why this skeleton must never
  be described as "wire-compatible" or "NIP-44 compatible" until real
  encryption/authentication exist.
- `docs/nip44_wire_implementation_roadmap.md` steps 4–6 — where the real
  ChaCha20 stream cipher, HMAC-SHA256 tag, and base64 payload encoding
  this skeleton's `ciphertext`/`mac` fields anticipate are proposed to
  land.
