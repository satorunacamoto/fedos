# NIP-44 v2 wire implementation roadmap (Stage 209–213) — docs only, no code

**Status: this document adds no code.** It proposes a stage order for
closing the gap `docs/nip44_wire_compatibility_gap.md` documents — from
the current "FedOS internal NIP-44-like bridge" (Stage 198–208) to a real
"NIP-44 v2 wire-compatible implementation" that passes every category in
`test-vectors/nip44/nip44-v2.json`. Stage numbers below are CANDIDATES,
not commitments — each numbered step is its own future, separate,
explicitly-reviewed stage, following this crate's existing discipline of
fixing a shape or a skeleton before writing the real implementation (the
same discipline `docs/nip44_internal_plan.md`, `docs/ciphertext_envelope_plan.md`,
and `docs/hkdf_internal_plan.md` each already followed).

## Ordering principle

Each step below is chosen so that:

1. It is independently vector-verifiable against
   `test-vectors/nip44/nip44-v2.json` before the next step begins.
2. It adds no public API, no Runtime/Worker/Storage/Nostr/Relay
   connection, and no new `Cargo.toml` dependency unless that step's own
   explicit review says otherwise (a raw `chacha20` stream-cipher crate
   and a separate `hmac` crate are the two dependencies this roadmap
   currently expects it will eventually need — see step 4/5).
3. Nothing is wired to a real Nostr direct-message flow until EVERY vector
   category passes — see step 8.

## Steps

### 1. Message key exact derivation (`get_message_keys`)

Implement NIP-44 v2 §4's real per-message derivation: HKDF-expand (not
extract) from the `ConversationKey`, salted by a FRESH random 32-byte
nonce, producing `chacha_key` (32B) / `chacha_nonce` (12B) / `hmac_key`
(32B) as three SEPARATE values — not the single `MessageKey` Stage
200–201's generic bridge produces today. Vector-verify against
`valid.get_message_keys`. Candidate: **Stage 214**.

### 2. Padding exact v2 re-confirmation

`crypto::nip44_padding` (Stage 202–203) is already spec-exact and
vector-verified — this step is a re-confirmation/no-op checkpoint before
building the real encrypt pipeline on top of it, not new padding code.
Candidate: **Stage 215** (may be folded into step 3's own review instead
of a standalone stage).

### 3. Nonce: 32-byte handling

Introduce the NIP-44 v2 32-byte random nonce as its own distinct type
from this crate's pre-existing 12-byte `FedosAeadNonceDecision` (per this
crate's "separate label per boundary" discipline — see
`crypto::ciphertext_transport`'s own doc comment for the precedent).
Candidate: **Stage 216**.

### 4. ChaCha20 stream encryption (raw, unauthenticated)

Adopt a raw `chacha20` stream-cipher crate (NOT `chacha20poly1305`, which
this crate already depends on for `aead_internal` but which is an AEAD
construction, not the bare stream cipher NIP-44 v2 uses) and implement
unauthenticated encrypt/decrypt over the padded plaintext from step 2,
keyed/nonced by step 1/3's real values. Explicitly reviewed new
`Cargo.toml` dependency. Candidate: **Stage 217**.

### 5. HMAC-SHA256 authentication tag

Adopt a separate `hmac` crate and implement the real
`hmac_sha256(hmac_key, nonce ‖ ciphertext)` tag, computed and verified
independently of step 4's stream cipher — NOT folded into a single AEAD
call the way `crypto::nip44_encrypt`/`nip44_decrypt` (Stage 204–205) do
today. Vector-verify tag computation against `valid.encrypt_decrypt`.
Explicitly reviewed new `Cargo.toml` dependency. Candidate: **Stage 218**.

### 6. Base64 payload encoding

Implement the real wire payload: `version_byte (0x02) ‖ nonce (32B) ‖
ciphertext ‖ hmac_tag (32B)`, base64-encoded (standard base64, not the
base64url this crate's OWN `ciphertext_serialization`, Stage 186, already
uses for its unrelated envelope format — see
`docs/nip44_wire_compatibility_gap.md`'s field-by-field table for why
these must not be conflated). Candidate: **Stage 219**.

### 7. Invalid vectors

Wire `invalid.decrypt`'s full category (tampered version byte, invalid
HMAC, truncated payload, invalid padding, etc.) to `cargo test`, matching
NIP-44 v2's spec-defined failure modes while still collapsing them into
this crate's own single fixed decrypt-failure label at the PUBLIC
boundary (mirroring `crypto::nip44_decrypt::Nip44DecryptStatus::AuthenticationFailed`'s
existing "one label, never distinguishing why" discipline — see
`docs/nip44_internal_plan.md` §7). Candidate: **Stage 220**.

### 8. Bridge to Nostr DM — only after every vector category passes

Only once steps 1–7 collectively pass EVERY category in
`test-vectors/nip44/nip44-v2.json` (`get_conversation_key`,
`get_message_keys`, `calc_padded_len`, `encrypt_msg_lengths`,
`encrypt_decrypt`, `encrypt_decrypt_long_msg`, `decrypt`, and any padding
category not already covered) does a future, separate, explicitly-reviewed
stage connect this pipeline to a real Nostr encrypted-direct-message flow
— NOT before. This step is intentionally the ONLY one in this roadmap
that touches Runtime/Worker/Storage/Nostr/Relay; every step above it stays
exactly as internal/`pub(crate)`-only as Stage 198–208's own bridge is
today. Candidate: **Stage 221+** (exact number depends on how many stages
1–7 actually take).

## What this roadmap does NOT do

- **No code.** Every step above is a plan entry, not an implementation —
  see `docs/nip44_wire_compatibility_gap.md` and
  `crypto::nip44_wire`'s own module-level doc comment (Stage 209–213) for
  the current label-only skeleton this roadmap builds toward.
- **No commitment to the exact Stage numbers above.** They are sequential
  placeholders assuming no step splits into two; a future step that turns
  out to need its own sub-stages renumbers everything after it, exactly
  as Stage 198–208 itself absorbed Stage 202's original single-stage
  estimate into 202–208's eventual seven.
- **No change to the existing `crypto::nip44_encrypt`/`nip44_decrypt`
  bridge.** Steps 1–7 land as NEW, separate modules/types (mirroring how
  `crypto::nip44_wire`, Stage 209–213, is itself new and separate from
  `crypto::nip44_encrypt`/`nip44_decrypt`) — the existing generic bridge
  is not deleted, renamed, or repurposed by this roadmap; whether it is
  ever retired in favor of the wire-compatible pipeline is its own future
  decision, not made here.
