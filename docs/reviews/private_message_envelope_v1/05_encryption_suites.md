# 05 — Encryption Suites

This review invents no cipher and adopts no scheme not already present
in this codebase's own real or aspirational vocabulary. Every candidate
below is named because it already appears somewhere in `src/` or
`packages/fedos-core-rust/` — this section only classifies each as real,
placeholder-aspirational, or requiring external research.

## AEAD cipher — a real gap between the placeholder and real unions, found this pass

Two `AeadAlgorithm`-shaped unions exist in this codebase, and they
**do not match**:

```ts
// src/crypto/types.ts — Seam 1, placeholder, aspirational
export type AeadAlgorithm =
  | "chacha20poly1305"
  | "xchacha20poly1305"
  | "aes_gcm"
  | "other";

// src/runtime/fedos_wasm_loader.ts — Seam 2, real, Rust-backed
export type AeadAlgorithm = "ChaCha20Poly1305" | "Aes256Gcm";
```

**`xchacha20poly1305` is named in the placeholder union but has no real
counterpart anywhere in Seam 2 or in `packages/fedos-core-rust/`** —
confirmed by grep: no `XChaCha` hit anywhere in
`packages/fedos-core-rust/src/`. Only regular (96-bit-nonce) ChaCha20-
Poly1305 and AES-256-GCM are real, vector-tested, and reachable (once
Seam 2's gate opens). A future Arc must not assume XChaCha20-Poly1305 is
available merely because Seam 1's placeholder union names it — that
union is explicitly aspirational (Seam 1's own header: *"NO real
encryption... NO AEAD"*) and this review finds no work has begun on
adding it to the real Rust core. This matters because XChaCha20's larger
(192-bit) nonce is the standard mitigation for random-nonce-collision
risk at high message volumes (see `15_nonce_replay.md`) — its absence is
a real, named gap, not a naming inconsistency to paper over.

**Recommendation: the V1 Envelope's `algorithm` field (`04_envelope_v1.md`)
must be typed against Seam 2's real union (`"ChaCha20Poly1305" | "Aes256Gcm"`),
never Seam 1's aspirational one.** Choosing between the two real options
for Direct-mode V1 is not resolved here — both are real, vector-tested,
and reachable once the export gap (`12_wasm_export_gap.md`) closes; a
future Arc may pick either or expose both, at its own discretion,
without needing new cryptography.

## Conversation-key derivation — real, NIP-44-compatible, unexported

`derive_conversation_key_via_ecdh_internal` (`conversation_key.rs:235`) —
real secp256k1 ECDH → X-coordinate → HKDF-SHA256 extract-only with fixed
salt `"nip44-v2"`, vector-verified against
`test-vectors/nip44/nip44-v2.json` (confirmed present in
`packages/fedos-core-rust/`, re-checked this pass). This is NIP-44 v2's
own real conversation-key algorithm — not a FedOS-invented derivation.
**This review adopts it unchanged as the Direct-mode key-derivation
primitive** (see `09_direct_key_strategy.md`), consistent with SEC §05's
own Option D recommendation and refusal-to-invent discipline. The full
NIP-44 v2 wire pipeline (padding, ChaCha20 stream cipher, HMAC-SHA256,
base64) also exists in full in `packages/fedos-core-rust/src/crypto/nip44_*.rs`
— but see the note below on why this review does **not** recommend
adopting NIP-44's own *wire format* for the Envelope's ciphertext
directly.

## Why the Envelope should use Seam 2's generic AEAD wire format, not NIP-44's own wire format

Two real, complete pipelines exist side by side in
`packages/fedos-core-rust/src/crypto/`: the generic
`aead_internal.rs`/`ciphertext_transport.rs` pipeline (feeding
`AeadCiphertextWire`, Seam 2, `#[wasm_bindgen]`-exported once the gate
opens) and the NIP-44-specific `nip44_wire*.rs` pipeline (feeding a
NIP-44 wire payload, still entirely `pub(crate)`-only, per
`nip44_public_api.rs`). This review recommends the Envelope's
`ciphertext` field (`04_envelope_v1.md`) carry the **generic**
`AeadCiphertextWire` format — using NIP-44's own *key derivation*
(above) but not its *wire encoding* — for one reason SEC §02 already
established structurally: **the canonical Envelope must not be
protocol-dependent** (SEC §02 Option E rejection, `03_envelope_boundary.md`).
NIP-44's wire format is Nostr-specific by name and by its own padding/
HMAC scheme's design intent; using it as the canonical, protocol-neutral
Envelope's ciphertext encoding would make the FedOS-internal Envelope
format inherit a Nostr-shaped wire layout even for a message that may
never be sent over Nostr at all. A future Nostr protocol adapter
(`18_protocol_mapping.md`) can still re-wrap or re-derive a NIP-44 wire
event *from* the canonical Envelope at delivery time — the same
"adapters map INTO/OUT OF the canonical shape, never the other way"
discipline this codebase already applies to `FedosBoardPost` (SEC §02).

## Nonce, KDF, group suite — named, not chosen

- **Nonce scheme**: real (96-bit, freshly drawn per call, Rust-internal
  only) — see `15_nonce_replay.md` for the full grounding and its
  limits.
- **KDF for Direct mode**: HKDF-SHA256 extract-only with NIP-44's fixed
  salt (above) — real, adopted unchanged.
- **KDF/suite for Private Group**: **no real primitive exists** for
  multi-recipient encryption anywhere in this codebase (SEC §01 item 8,
  reconfirmed this pass — zero group/multi-recipient encryption code
  found). SEC §05's own comparison (Group Key / per-recipient fan-out /
  Sender Key / pairwise+group-distribution) remains the authoritative
  option space; this review does not add or remove an option. See
  `10_group_key_strategy.md`.
- **Standards requiring external research**: a Sender-Key or MLS-style
  (RFC 9420) scheme, if a future Arc adopts one for Private Group, per
  SEC §05's own explicit statement: *"should not be hand-designed by a
  future FedOS Arc from scratch — it requires adopting an existing,
  formally-specified scheme... not inventing one."* This review defers
  to that finding unmodified — **requires official protocol/standards
  research**, not resolvable from this repository's own source.

## See also

- `docs/reviews/private_conversation_security/05_key_distribution.md`
- `01_crypto_inventory.md`, `09_direct_key_strategy.md`, `10_group_key_strategy.md`
