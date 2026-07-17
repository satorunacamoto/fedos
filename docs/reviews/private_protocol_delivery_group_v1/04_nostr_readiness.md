# Review 04 — Nostr Delivery Readiness

## Inventory of what is real vs. stub, by exact capability

| Capability | Status | Evidence |
|---|---|---|
| NIP-01 event signing | **Real** | `FedosWasmNostrSigningAuthority` (`src/sign/fedos_wasm_nostr_signing_authority.ts:96`) — real WASM-backed signing; `NobleSignatureVerifier` (`src/nostr/noble_signature.ts:38-55`) — real schnorr verification. |
| Relay publish (transport) | **Real, public-post-shaped only** | `WebSocketRelayPublisher` (`src/nostr/publish.ts:154`) sends `["EVENT", event]`, waits for `OK`; `FedosRelayNostrBoardPublisher` (`src/board/publish/nostr/fedos_relay_nostr_board_publisher.ts:61`) wires this into the board Outbox pipeline for public kind-1 notes only. |
| ACK/OK correlation | **Real** | `FedosRelayOkCorrelatedNostrBoardPublisher` (`src/board/publish/nostr/fedos_relay_ok_correlated_nostr_board_publisher.ts:82-140`) keys pending publishes by event id, resolves on a matching NIP-20 `OK`, times out after 10s (`DEFAULT_OK_CORRELATION_TIMEOUT_MS`, line 79). This is the one place true relay-ACK correlation exists; the simpler `FedosRelayNostrBoardPublisher` does not have it. |
| Recipient identity resolution to a Nostr pubkey | **Real for the Conversation counterparty; noop for the generic identity layer** | `MembershipFedosConversationParticipantReference.publicIdentifier` already carries the counterparty's raw pubkey once admitted as a member (`fedos_conversation_participant_reference.ts:47-53`) — no lookup needed. The generic `NostrIdentityProvider`/`FedosNostrPublicIdentitySource` layer (`src/identity/`), by contrast, is a pure noop: `NullNostrPublicIdentitySource.readPublicIdentity()` always resolves `null` (`fedos_null_nostr_public_identity_source.ts:20-23`), the sole implementation shipped. |
| Conversation-key (pairwise ECDH) derivation | **Real, exported** | `resolve_conversation_key` (`packages/fedos-core-rust/src/lib.rs`) reuses vector-verified `derive_conversation_key_via_ecdh_internal` (`conversation_key.rs:235`). |
| NIP-44 per-message key schedule | **Real, but `pub(crate)`-only, not exported** | `derive_message_keys_exact_internal`/`derive_message_keys_exact_from_bytes_internal` (`packages/fedos-core-rust/src/crypto/nip44_message_keys.rs:150,193`) implement the real HKDF-based per-message key split (chacha key/nonce/hmac key). `nip44_public_api.rs`'s `Nip44OpaqueStatus` has exactly one variant, `Unimplemented` — no public surface. |
| NIP-44 padding/wire encrypt-decrypt | **Real internally, not exported** | Confirmed present under `packages/fedos-core-rust/src/crypto/` (`nip44_padding.rs`, `nip44_wire.rs`, `nip44_wire_encrypt.rs`, `nip44_wire_decrypt.rs`, etc.), none reachable from `src/`. |
| NIP-17 gift wrap / NIP-59 seal | **Does not exist** | Zero hits for `NIP-17`, `NIP-59`, `giftwrap`/`gift_wrap`/`giftWrap` (any casing) anywhere in `src/` or `packages/fedos-core-rust/src/`. `src/federation/capability_matrix.ts:161-167` explicitly rejects `private_message_placeholder` for the Nostr adapter with the stated reason "private messages must never ride on a public Nostr relay event (NIP-17/NIP-44 out of scope)." |

## Can this repository support NIP-44 direct messages, NIP-17/NIP-59 gift wrap, or neither, today?

**Neither, as a shipped, callable capability.** The pieces needed for a
NIP-44-encrypted direct message exist at the Rust layer (conversation
key derivation is exported; per-message key schedule and wire
padding/encrypt exist but are not exported), but nothing in `src/`
calls the NIP-44 message-key/wire-encrypt functions, and the currently-
exported `FedosMasterSeedAuthority.resolveConversationKey()` returns an
opaque `AeadKeyHandle` consumed by this repository's own general
AEAD pipeline (`ChaCha20Poly1305`/`Aes256Gcm`), not by the NIP-44 wire
format specifically — the two paths are parallel, not the same pipeline
(confirmed: `conversation_key.rs`'s own doc names its HKDF-extract as
"NIP-44-vector-verified" for the *key*, but nothing wires that key into
`nip44_message_keys.rs`'s own schedule from the TypeScript side). NIP-17
gift wrap does not exist in any form.

## Official-spec research this review names, does not perform

- The exact NIP-17 (`kind:14`/`kind:1059`) rumor/seal/gift-wrap
  three-layer structure and its precise key-derivation-per-layer
  requirements.
- Whether NIP-44's per-message key schedule this crate already
  implements (`nip44_message_keys.rs`) is the correct schedule for a
  gift-wrap rumor layer specifically, or only for a flat NIP-44 DM.
- Nostr's own relay-side group-DM conventions (if any beyond NIP-17),
  relevant to `15`/`16`.

This review does not guess at any of the above, per its own "no
external web research" ground rule.

## See also

- `01_source_inventory.md`, `03_internal_vs_wire_envelope.md`
- `05_nostr_metadata_leakage.md`
- `docs/reviews/private_message_envelope_v1/12_wasm_export_gap.md`
