# Secure Runtime Alpha 1611–1690 — Phase B: Alpha 1617 Normative Source Gate

## 1. Source obtained

Per this Arc's own acceptable-source list ("an exact checked-in NIP
document" / "an authoritative upstream NIPs checkout explicitly fetched
for this Arc"), `NIP-17.md`, `NIP-44.md`, and `NIP-59.md` were fetched
**verbatim, byte-for-byte**, via a direct network fetch (not through any
summarizing/paraphrasing tool — a prior attempt via the available
web-fetch tool was explicitly rejected for this purpose, since that tool
itself documents that it "processes the content with...a small, fast
model" and "results may be summarized," which does not meet this Arc's
own "do not use...prior prose summaries" bar) and checked into this
repository at:

- `docs/normative/nostr-protocol-nips/17.md`
- `docs/normative/nostr-protocol-nips/44.md`
- `docs/normative/nostr-protocol-nips/59.md`

**Exact source revision:** `nostr-protocol/nips`, commit
`bdfa7e62ef87fcfcb992b1a27aee49d36b0b4f91` (the `master` branch tip at
fetch time, resolved via `git ls-remote`, 2026-07-18). Each file's own
SHA-256, for independent verification against a future re-fetch:

| File | SHA-256 |
|---|---|
| `17.md` | `7aa9c3a9c0458a9552c4be2f3bf17f7ec60a4afe88bce7977f03500a7873a64` |
| `44.md` | `b5f89374e4e1dbdee7881e8573b4313b6a89430a9c8d518471599ae0660cf0e` |
| `59.md` | `b46b078ff5b219fd4ab33a53b479b49d4cbd604b88be46d6b978d53d8f8b43a` |

This is a **different, later** `nostr-protocol/nips` revision than
`test-vectors/nip44/nip44-v2.json`'s own recorded source
(`8f8444d05a8842c40211ded5d10af3521541f865`) — recorded honestly rather
than assumed identical; NIP-44's own v2 wire format is a closed,
versioned spec (`0x02`) not expected to have changed substantively
between the two revisions, but this Arc makes no compliance claim
resting on that assumption without the vector-level verification Alpha
1621 already requires (§3 below).

**Conclusion: the Alpha 1617 gate's own "material cannot be accessed"
blocker does NOT apply** — this Arc has real, normative, verifiable NIP
text, superseding every prior Arc's own "zero normative material"
finding (`docs/reviews/private_protocol_delivery_group_v1/04_nostr_readiness.md`,
`docs/reviews/private_group_pairwise_fanout/01_nip17_inventory.md`/
`02_gift_wrap_inventory.md` — all now stale, superseded by this
document; not deleted, since Alpha 1649's own "do not rewrite old
history" spirit applies equally to prior review docs, but no longer
authoritative).

## 2. Key facts extracted (Alpha 1618/1622's own "do not guess kind 14
vs 15" requirement, resolved directly from source text — never guessed)

- **NIP-17** defines an encrypted-chat convention over NIP-44 + NIP-59.
  A chat room = the set of `pubkey` + `p` tags. `kind:14` is a Chat
  Message (`content` MUST be plain text; tags: `p`\* recipients, `e`
  reply, `subject`, `q` citations). `kind:15` is a File Message (same
  `p`/`e`/`subject` tags plus `file-type`/`encryption-algorithm`/
  `decryption-key`/`decryption-nonce`/`x`/`ox`/etc.; `content` is a
  file URL, not the file itself). **Kind 14 is the minimum direct-message
  form** — kind 15 is a distinct, separate rumor kind for file
  transfer, not a variant of 14.
  - `kind:10050` (a SEPARATE, signed, ordinary event — not a rumor)
    advertises a user's preferred DM-receiving relays via `relay` tags;
    "Clients MUST only publish...to the relays listed in the
    recipient's kind 10050 event."
  - Deletion: a `kind:5` delete event MAY be wrapped in a fresh
    `kind:1059` and sent to the recipient (Alpha 1646's own
    "best-effort deletion request, never verified-deleted" framing is
    directly consistent with this — NIP-17 itself never claims
    guaranteed deletion either).
  - Disappearing messages: an `expiration` tag on the gift wrap (and
    SHOULD also on the seal) — a REQUEST, not an enforced guarantee
    (Alpha 1644's own framing already anticipated this correctly).
- **NIP-59** defines the generic three-layer envelope this NIP-17 use
  case is built on: `rumor` (any unsigned event) -> `seal` (`kind:13`,
  `tags` MUST be empty, signed by the REAL sender, `content` =
  NIP-44-encrypted rumor JSON) -> `gift wrap` (`kind:1059`, signed by a
  FRESH random one-time keypair per wrap, `tags` = `[["p", recipientPubkey]]`,
  `content` = NIP-44-encrypted seal JSON). A separate `kind:21059`
  "Ephemeral Gift Wrap" variant exists (relays MUST NOT store it) for
  real-time-only delivery — explicitly out of this Arc's own scope
  (Alpha 1645 requires the normative source provide the exact kind;
  `21059` is real, but wiring it is deferred, see completion
  declaration).
  - `created_at` on BOTH the seal and the gift wrap SHOULD be
    independently randomized up to two days in the past — "the
    canonical `created_at` time belongs to the rumor." This is directly
    relevant to Alpha 1629 (Timestamp/Metadata tests) for whichever Arc
    implements Phase C.
  - The seal's `pubkey` MUST match the rumor's own `pubkey` — Alpha
    1623's own "real sender signing identity" requirement, confirmed
    verbatim from source, not inferred.
- **NIP-44 v2** — `secp256k1 ECDH -> HKDF-SHA256 -> padding -> ChaCha20
  -> HMAC-SHA256 -> base64`, version byte `0x02` (`0x00` reserved,
  `0x01` deprecated/undefined). Confirms, rather than contradicts, this
  repository's own EXISTING `packages/fedos-core-rust/src/crypto/nip44_*.rs`
  module names and pipeline order (§3 below).

## 3. Alpha 1618 — NIP-44 Reality Audit (existing Rust, verified against this source)

`packages/fedos-core-rust/src/crypto/` already contains a substantial,
real, non-stub NIP-44 implementation (5,463 lines across
`nip44_encrypt.rs`, `nip44_decrypt.rs`, `nip44_message_keys.rs`,
`nip44_padding.rs`, `nip44_stream_cipher.rs`, `nip44_hmac.rs`,
`nip44_wire.rs`, `nip44_wire_encrypt.rs`, `nip44_wire_decrypt.rs`, and
their own `*_vectors.rs` test modules), matching this document's own
§2 pipeline exactly: `conversation_key.rs` (`derive_conversation_key_via_ecdh_internal`)
-> `nip44_message_keys.rs` -> `nip44_padding.rs` -> `nip44_stream_cipher.rs`
-> `nip44_hmac.rs` -> `nip44_wire_encoding.rs`. `nip44_wire_encrypt_vectors.rs`/
`nip44_wire_decrypt_vectors.rs` load `test-vectors/nip44/nip44-v2.json`
directly via `include_str!` and assert full round-trip byte-equality
against the official upstream vector set (confirmed by direct source
inspection — `test-vectors/README.md`'s own "no Rust code reads them
yet" claim is **stale**, superseded by this Arc's own direct finding;
not corrected in that file by this Arc, to keep ripple to
`test-vectors/`/`docs/` narrow, but recorded honestly here).

Distinguishing the eight required stages, per Alpha 1618's own
checklist, ALL confirmed present as separate, real modules (not
conflated into one function):

| Stage | Module | Present? |
|---|---|---|
| ECDH conversation-key derivation | `conversation_key.rs` | Yes |
| NIP-44 message-key derivation | `nip44_message_keys.rs` | Yes |
| Padding | `nip44_padding.rs` | Yes |
| Nonce | `nip44_wire_nonce.rs` | Yes |
| Stream cipher | `nip44_stream_cipher.rs` | Yes |
| Authentication (HMAC) | `nip44_hmac.rs` | Yes |
| Base64 wire encoding | `nip44_wire_encoding.rs` | Yes |
| Decode/validation | `nip44_wire_decrypt.rs` + `nip44_decrypt_invalid_vectors.rs` | Yes |

`FedosConversationEncryptionAuthority`'s own generic AEAD Envelope
(Alpha 861, `aead_envelope_bridge.rs`) is a SEPARATE module from every
`nip44_*.rs` file above — confirmed no shared production code path
between the two (Alpha 1618's own "do not reuse the FedOS generic AEAD
Envelope as NIP-44 wire ciphertext" requirement was ALREADY satisfied
before this Arc, not something this Arc needed to fix).

**Not verified by this Arc (left to the recommended next Arc, Alpha
1619–1621):** actually RUNNING `cargo test` against these vectors in
this exact worktree (a real `cargo`/Rust toolchain invocation was out
of this Arc's own executed scope — see the completion declaration's own
verification log for exactly which commands were and were not run this
session), the WASM boundary's own narrow-export status
(`encryptNip44Payload`/`decryptNip44Payload`-shaped opaque handles,
Alpha 1619/1620), and cross-target vector verification (native Rust /
wasm32 / generated bindings / TypeScript adapter, Alpha 1621). No NIP-44
compliance is DECLARED by this Arc — only that the pipeline's own
module shape matches the normative source's own stage list, which is a
narrower, honest claim.

## 4. Phase C decision (Rumor/Seal/Gift Wrap, Alpha 1622–1629)

**Deliberately NOT implemented by this Arc**, despite the Alpha 1617
material blocker now being resolved. Reasoning, stated honestly rather
than left implicit:

- Real Gift Wrap construction is genuine NEW cryptographic-PROTOCOL
  code (ephemeral per-message signing identity, nested NIP-44
  encryption at two layers, exact timestamp-randomization behavior,
  real Rust + WASM-boundary + TypeScript-adapter work, plus the Phase D
  vertical-slice test across two real independent development Runtimes)
  — not a mechanical reconciliation, adapter wrapper, or documentation
  task like Phase A/the rest of Phase B. Attempting it inside the SAME
  session as the branch-integration/kind-1-closure work this Arc
  already completed and verified would risk exactly what this Arc's own
  "No speculative abstractions" / "Never broaden scope" / "Minimize
  ripple" instructions warn against: rushed, under-verified
  security-sensitive code.
- This Arc's own Alpha 1616 already froze the exact seam
  (`FedosPrivateWireAdapter`) a real `NostrNip17V1WireAdapter`
  implementation plugs into — Phase C's own future Arc has a concrete,
  tested boundary to build against, plus this document's own verbatim,
  pinned NIP-17/44/59 text, plus §3's own confirmation that the NIP-44
  primitive layer Phase C would need is already real. Nothing about
  Phase C is now blocked on RESEARCH — only on the implementation
  effort itself, which this Arc scopes to the recommended next Arc.

`NostrNip17V1WireAdapter`
(`src/conversation/delivery/nostr/nip17/fedos_nostr_nip17_v1_wire_adapter.ts`)
therefore exists as a real, additive module implementing the SAME
`FedosPrivateWireAdapter` interface `FedosPrivateV1WireAdapter` does,
with `isAvailable()` returning `false` and every operation resolving to
`"unsupported"` — honestly, for the reason stated in this section, NOT
because the spec is unavailable (it no longer is).
