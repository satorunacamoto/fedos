# NIP-44 v2 wire implementation roadmap (Stage 209–213; steps 1/3/4/5 IMPLEMENTED Stage 219/224/229/231) — docs only originally, now partly real code

**Status at Stage 209–213: this document added no code.** It proposed a
stage order for closing the gap `docs/nip44_wire_compatibility_gap.md`
documents — from the "FedOS internal NIP-44-like bridge" (Stage 198–208)
to a real "NIP-44 v2 wire-compatible implementation" that passes every
category in `test-vectors/nip44/nip44-v2.json`. Stage numbers below were
CANDIDATES, not commitments.

**Update — Stage 219–233: steps 1, 3, 4, and 5 are now REAL, vector-verified
code** (`crypto::nip44_message_keys`, `crypto::nip44_wire_nonce`,
`crypto::nip44_stream_cipher`, `crypto::nip44_hmac`/`crypto::nip44_wire_decrypt`
— see each step's own note below and `docs/nip44_wire_crypto_completion.md`
for the full implementation record). Steps 2 (already spec-exact before
this roadmap existed), 6, 7, and 8 remain as originally planned — see
each step below.

## Ordering principle

Each step below is chosen so that:

1. It is independently vector-verifiable against
   `test-vectors/nip44/nip44-v2.json` before the next step begins.
2. It adds no public API, no Runtime/Worker/Storage/Nostr/Relay
   connection, and no new `Cargo.toml` dependency unless that step's own
   explicit review says otherwise. **Update — steps 4/5 originally
   expected needing a `chacha20` crate and a separate `hmac` crate
   respectively; both were actually hand-implemented instead (Stage
   229/231), needing zero new dependency in either case** — see each
   step's own note below.
3. Nothing is wired to a real Nostr direct-message flow until EVERY vector
   category passes — see step 8.

## Steps

### 1. Message key exact derivation (`get_message_keys`) — IMPLEMENTED Stage 219–220

Implement NIP-44 v2 §4's real per-message derivation: HKDF-expand (not
extract) from the `ConversationKey`, salted by a FRESH random 32-byte
nonce, producing `chacha_key` (32B) / `chacha_nonce` (12B) / `hmac_key`
(32B) as three SEPARATE values — not the single `MessageKey` Stage
200–201's generic bridge produces today. Vector-verify against
`valid.get_message_keys`. Candidate was Stage 214; ACTUALLY landed as
`crypto::nip44_message_keys::derive_message_keys_exact_internal`/
`derive_message_keys_exact_from_bytes_internal` at **Stage 219**, vector-
verified against all 32 `valid.get_message_keys` cases at **Stage 220**.

### 2. Padding exact v2 re-confirmation

`crypto::nip44_padding` (Stage 202–203) is already spec-exact and
vector-verified — this step is a re-confirmation/no-op checkpoint before
building the real encrypt pipeline on top of it, not new padding code.
Candidate: **Stage 215** (may be folded into step 3's own review instead
of a standalone stage).

### 3. Nonce: 32-byte handling — IMPLEMENTED Stage 224

Introduce the NIP-44 v2 32-byte random nonce as its own distinct type
from this crate's pre-existing 12-byte `FedosAeadNonceDecision` (per this
crate's "separate label per boundary" discipline — see
`crypto::ciphertext_transport`'s own doc comment for the precedent).
Candidate was Stage 216; ACTUALLY landed as
`crypto::nip44_wire_nonce::generate_wire_nonce_internal` at **Stage 224**,
completely independent of `fedos_aead_nonce_96` as planned.

### 4. ChaCha20 stream encryption (raw, unauthenticated) — IMPLEMENTED Stage 229–230

Implement unauthenticated encrypt/decrypt over the padded plaintext from
step 2, keyed/nonced by step 1/3's real values. Candidate was Stage 217
(which expected adopting a raw `chacha20` stream-cipher crate as an
explicitly reviewed new dependency); ACTUALLY landed at **Stage 229** as
`crypto::nip44_stream_cipher::encrypt_stream_internal`/
`decrypt_stream_internal` — HAND-IMPLEMENTED against RFC 8439 §2.3–2.4
directly (pure `u32` arithmetic needs no dependency at all), so **NO new
`Cargo.toml` dependency was actually needed**, superseding this step's
original expectation. Vector-verified against all 10
`valid.encrypt_decrypt` cases' ciphertext bytes at **Stage 230**.

### 5. HMAC-SHA256 authentication tag — IMPLEMENTED Stage 231

Implement the real `hmac_sha256(hmac_key, nonce ‖ ciphertext)` tag,
computed and verified independently of step 4's stream cipher — NOT
folded into a single AEAD call the way `crypto::nip44_encrypt`/
`nip44_decrypt` (Stage 204–205) do. Candidate was Stage 218 (which
expected adopting a separate `hmac` crate as an explicitly reviewed new
dependency); ACTUALLY landed at **Stage 231** as
`crypto::nip44_hmac::compute_hmac_internal`/`verify_hmac_internal` — HAND-
IMPLEMENTED against RFC 2104 using this crate's already-adopted
`sha2::Sha256`, so **NO new `Cargo.toml` dependency was actually
needed**, superseding this step's original expectation. Tag computation
is vector-verified indirectly via `crypto::nip44_wire_decrypt`'s own
Stage 232 end-to-end vector test (a wrong tag byte fails every one of
the 10 `valid.encrypt_decrypt` cases). Also implemented at Stage 232: the
complete verify-HMAC → decrypt-stream → unpad DECRYPT pipeline
(`crypto::nip44_wire_decrypt`), collapsing every reachable failure into
a single fixed `AuthenticationFailed` label — this was not its own
roadmap step originally, but naturally follows once steps 1/3/4/5 all
exist.

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

- **As of Stage 209–213: no code.** Every step above was a plan entry,
  not an implementation. **As of Stage 219–233: steps 1, 3, 4, and 5 ARE
  real code** — see each step's own "IMPLEMENTED" note above and
  `docs/nip44_wire_crypto_completion.md` for the full record. Steps 6–8
  remain plan entries only.
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
