# Secure Runtime Alpha 5481-5560: FedOS Direct Double Ratchet — Cryptographic Construction

This document is the closed, versioned suite specification the mission's own Phase B requires. It names a FedOS-specific construction — **it does not claim byte-level or state-machine compatibility with the Signal Double Ratchet or any other external protocol**, even though the underlying algorithmic shape (root/chain KDF, DH ratchet, bounded skipped keys) is the same well-known, published construction. No external interoperability of any kind is claimed.

## Suite identifier

`"fedos-direct-ratchet-v1"` (`FedosDirectRatchetSuite`, already defined by the Foundation Arc — reused, not redefined). Unknown suite labels fail closed at header-decode time (the header's own fixed suite-label field, `direct_ratchet_header.rs`).

## Primitives (all pre-existing, reviewed crates already in `Cargo.toml` — zero new dependencies)

| Purpose | Primitive | Notes |
|---|---|---|
| Root KDF | HKDF-SHA256 (`hkdf` crate, `Hkdf::extract` + two `expand` calls) | Salt = current root key bytes; IKM = raw ECDH output. Two independent expand labels, both prefixed with the full session-binding context. |
| Chain KDF | HKDF-SHA256 (`Hkdf::from_prk` + two `expand` calls) | Chain key treated as an already-extracted PRK; two independent expand labels (`message-key`, `next-chain`). |
| DH primitive | secp256k1 ECDH (`k256` crate, manual point arithmetic — same technique `crypto::conversation_key.rs` already uses and its own NIP-44 test vectors already verify) | x-only 32-byte public keys, even-Y SEC1 lift convention. Off-curve/malformed keys rejected before any scalar multiplication. |
| Message encryption | ChaCha20-Poly1305 AEAD (`chacha20poly1305` crate, same crate `crypto::aead_internal.rs` already uses) | Header bytes as Additional Authenticated Data. |
| Nonce strategy | Fixed, all-zero 12-byte nonce | Safe because each `message_key` seals exactly one message ever, then is discarded — key uniqueness alone provides AEAD safety (see below). |
| Header authentication | AEAD AAD (not a separate MAC) | No NIP-44-style separate HMAC layer — this fresh internal format does not inherit that legacy wire-format requirement. |
| Key sizes | 32 bytes (root, chain, message, private ratchet keys); secp256k1 keys (32-byte scalar, 32-byte x-only point) | Matches this codebase's own established 32-byte `SecretHandle` convention throughout. |
| CSPRNG | `getrandom` (`fedos_random_bytes_32()`, the crate's existing, real entropy boundary — never a fallback PRNG) | Used for fresh ephemeral DH keypairs only. |
| Version | `schemaVersion: 1` (header), `sealingSuite: "direct-ratchet-sealing-v1"` (Foundation Arc's own, unchanged, for at-rest sealing) | |

## Why a fixed all-zero nonce is safe here

AEAD security requires (key, nonce) uniqueness. The Conversation-level static-key encryption reuses ONE key across many messages, so a fresh random nonce per message is essential there. This Arc's `message_key` is different in kind: `direct_ratchet_chain_kdf_internal()` derives a NEW, cryptographically independent message key for every single message, and that key is used to seal EXACTLY ONE message, ever, then is either consumed (successful decrypt) or discarded (chain advance past it). Because the key itself is already unique per message, nonce variation is unnecessary — this is the same property real Double Ratchet designs (including Signal's own) rely on for their own per-message keys.

## Domain separation

- **HKDF labels** (compile-time fixed constants, never caller-supplied): `fedos-direct-ratchet-root-v1`, `fedos-direct-ratchet-chain-seed-v1` (root KDF outputs), `fedos-direct-ratchet-message-key-v1`, `fedos-direct-ratchet-next-chain-v1` (chain KDF outputs).
- **Context binding**: the root KDF's own `expand()` calls prefix BOTH labels with the full session-binding context (session id + generation) — session/Device-pair/Conversation/generation binding lives at the cryptographic layer itself, not merely in separate storage. Proven by dedicated tests: identical inputs are deterministic; a different context, or a different DH output, provably yields different root/chain output.
- **`AeadAadDomain::DirectRatchetMessage` was considered and explicitly NOT added** — message encryption uses a narrow, independent AEAD helper (`seal_direct_ratchet_message_internal`) rather than the shared `aead_internal::seal_internal`, because that shared primitive's AAD is a fixed per-domain label incompatible with this Arc's own requirement (the header itself, which varies per message, as AAD). No change was made to the shared `AeadAadDomain` enum for this purpose.
- **`SecretHandleKind`**: three new variants (`DirectRatchetRootKeyMaterial`, `DirectRatchetChainKeyMaterial`, `DirectRatchetPrivateKeyMaterial`), plus reuse of the EXISTING `AeadKeyMaterial` for message keys (immediately compatible with `seal_direct_ratchet_message_internal`'s own kind check).

## What this Arc does NOT claim

- **Not Signal-protocol interoperability.** The algorithmic shape is the same well-known published construction, used here with FedOS-specific KDF labels, header format, and sealing integration. No byte-level wire compatibility with Signal (or any libsignal implementation) is claimed or tested.
- **Not post-quantum or hybrid cryptography.** Pure classical secp256k1 ECDH + HKDF-SHA256 + ChaCha20-Poly1305.
- **Not MLS or Group Ratchet.** One independent ratchet session per (local account, local Device, remote account, remote Device, Conversation) tuple only — the Foundation Arc's own accepted Device-pair session model, unchanged.
- **Not a claim that live product messaging now has forward secrecy.** This is a standalone cryptographic core; nothing in this Arc wires it into `sendDirectMessage()`/`readDirectMessage()`, NIP-17, or Relay delivery.

## Bootstrap

The very first root key for a new session is seeded from the EXISTING, real `resolve_conversation_key()` computation (the current static per-conversation ECDH key), per the review's own explicit recommendation (`08_dh_session_ratchet.md` §4) — never a fresh/random seed, and never re-referenced once the first DH ratchet step completes. This is the ONE place this Arc's crypto core reads a value derived from the existing static-key mechanism; `encrypt()`/`decrypt()` themselves never reference it again (proven by a structural guard test scoping the search to those two method bodies).
