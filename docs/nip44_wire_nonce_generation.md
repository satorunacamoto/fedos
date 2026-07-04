# NIP-44 v2 wire nonce generation (Stage 224) — implementation record

**Status: this document records real code.** Unlike
`docs/nip44_wire_nonce.md` (Stage 215, planning only — role, generation
responsibility, reuse prohibition, no code), this document describes the
ACTUAL implementation Stage 224 landed:
[`crypto::nip44_wire_nonce::generate_wire_nonce_internal`](../packages/fedos-core-rust/src/crypto/nip44_wire_nonce.rs).

## What exists

- `generate_wire_nonce_internal() -> Nip44WireNonceDecision` — draws
  exactly 32 bytes from the OS CSPRNG via `getrandom::fill`. Takes no
  parameter of any kind (no length, no seed, no counter, no
  `conversation_key`/`MessageKey` input).
- `Nip44WireNonceStatus` — exactly two variants: `Ready` (the CSPRNG
  succeeded; `Nip44WireNonceDecision::nonce` is `Some([u8; 32])`) and
  `InternalFailure` (the CSPRNG failed; `nonce` is `None` — no fallback
  PRNG, no zeroed/truncated/degraded substitute, no panic).
- `Nip44WireNonceDecision { status, nonce }` — plain returned data, not
  `SecretHandle`-wrapped (this nonce is not a secret; it travels in the
  clear as the wire payload's own second field, per
  `docs/nip44_wire_payload_layout.md`).

## Independence from `fedos_aead_nonce_96` (by design, not oversight)

`generate_wire_nonce_internal` shares **zero code** with this crate's
pre-existing `fedos_aead_nonce_96`/`FedosAeadNonceDecision`/
`FedosAeadNonceKind`/`FedosNonceState` (Stage 138) — no common helper, no
shared type, no length parameter selecting between them. Both call
`getrandom::fill` (the crate's one, already-adopted CSPRNG dependency,
Stage 104), but at different sizes for different purposes:

| | `fedos_aead_nonce_96` (Stage 138) | `generate_wire_nonce_internal` (Stage 224) |
| --- | --- | --- |
| Size | 12 bytes (96 bits) | 32 bytes (256 bits) |
| Feeds | `crypto::aead_internal::seal_internal`/`open_internal` directly, as the AEAD nonce | Nothing yet — a future NIP-44 v2 wire encrypt step's HKDF-expand `info` parameter (`docs/nip44_message_key_review.md`) |
| Status labels | `FedosNonceState::Ready`/`EntropySourceUnavailable` | `Nip44WireNonceStatus::Ready`/`InternalFailure` — a SEPARATE enum, not reused |

`docs/nip44_wire_nonce.md` (Stage 215) already named this as a planned
separation; this document confirms the real code honors it exactly — no
generalized "draw N random bytes" helper was introduced, mirroring how
`fedos_random_bytes_32` and `fedos_aead_nonce_96` themselves already stay
two separate functions rather than one parameterized by length.

## What this stage does NOT do

- **No wire payload construction** — see
  `docs/nip44_wire_payload_builder.md` (Stage 225–226) for
  `crypto::nip44_wire_payload`, the sibling module that actually calls
  this function.
- **No ChaCha20 stream cipher, no HMAC-SHA256, no base64, no wire
  encode/decode.**
- **No connection to `crypto::conversation_key`/`crypto::message_key`/
  `crypto::hkdf_bridge`** — this function takes no key input of any
  kind.
- **No public API, no Runtime/Worker/Storage/Relay connection, no new
  `Cargo.toml` dependency** (`getrandom` is already a production
  dependency since Stage 104).

## See also

- `docs/nip44_wire_nonce.md` (Stage 215) — the planning document this
  stage implements.
- `docs/nip44_wire_payload_builder.md` (Stage 225–226) — the wire payload
  skeleton that consumes this function's output.
- `docs/nip44_wire_implementation_roadmap.md` step 3 — where real
  32-byte nonce handling was originally proposed to land.
