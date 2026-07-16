# 09 — Direct Key Strategy

## SEC §05 Option D, degenerate case — adopted unchanged

SEC §05 compared five key-distribution options (Group Key,
per-recipient fan-out, Sender Key, pairwise+group-distribution,
protocol delegation) and recommended Option D for Direct specifically,
because it "degenerates to a SINGLE pairwise channel — the SAME real,
already-implemented ECDH conversation-key primitive §01 found, requiring
**zero new key-distribution logic**." This review's own source reading
(`01_crypto_inventory.md`, `05_encryption_suites.md`) reconfirms the
underlying primitive (`derive_conversation_key_via_ecdh_internal`,
`conversation_key.rs:235`) is unchanged, real, and still `pub(crate)`-only
at this commit. No new comparison is needed — SEC §05's own conclusion
stands, and this review adopts it as the Direct-mode strategy without
modification.

## Concrete Direct-mode key resolution, given the real primitive's actual signature

`derive_conversation_key_via_ecdh_internal(secret_key, public_key)` —
real secp256k1 ECDH between exactly two parties' key material, real
HKDF-SHA256 extract with NIP-44's own fixed salt. For a two-participant
Direct conversation, `06_encryption_authority.md`'s
`resolveConversationKey(conversationId, keyEpoch)` reduces, once
exported (`12_wasm_export_gap.md`), to: identify the conversation's
*other* participant's public key (from the — not-yet-real —
`FedosConversationMembership` record, `08_membership_readiness.md`),
and call the ECDH primitive with the local Master Seed-derived secret
key. **No group-key distribution, no per-message fan-out, and no
Sender-Key infrastructure is needed for Direct mode at all** — this
matches SEC §05's own "zero new key-distribution logic" framing exactly.

## Key epoch for Direct — the one open question this strategy surfaces

SEC §12 already found Direct has no removal concept and therefore no
membership-driven epoch-rotation trigger (contrast Private Group, where
removal *requires* rotation per SEC §06). This raises a question neither
SEC nor CFv1 poses directly, because neither designs Direct-mode
encryption to this level of concreteness: **does a Direct conversation's
`keyEpoch` ever need to increment at all?** See `11_key_epochs.md` for
the full treatment — named here only because it is a direct consequence
of adopting Option D's degenerate case, not a pre-existing design
decision this review found already made.

## Backup — reused from SEC §17 unmodified

SEC §17's own table already answers this for Direct: *"A DM's own
pairwise conversation key... Yes, in principle — if both counterparties'
own public keys are independently known/recorded, the pairwise ECDH key
is re-derivable from the Master Seed + the counterparty's public key
alone, with no separate backup needed for the KEY itself."* This review
adds nothing to that finding — it is unchanged and directly applicable
once `resolveConversationKey()` is real.

## What this document does not do

It does not choose which participant's public key is used when more
than one exists for a given counterparty (multi-device — SEC §04's own
device-identity addition, out of V1 per CFv1 §03), and it does not
design the actual lookup mechanism that resolves "the other
participant's public key" from a `FedosConversationId` — both require
the real `FedosConversationMembership` record (`08_membership_readiness.md`)
to exist first.

## See also

- `docs/reviews/private_conversation_security/05_key_distribution.md`
- `docs/reviews/private_conversation_security/17_backup_multi_device.md`
- `05_encryption_suites.md`, `06_encryption_authority.md`, `11_key_epochs.md`
