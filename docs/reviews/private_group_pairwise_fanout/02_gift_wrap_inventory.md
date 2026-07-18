# Review 02 — Gift Wrap Inventory

## Reconfirmed: zero gift-wrap code exists anywhere in this repository

Same reconfirmation basis as `01`: Alpha 1111–1180 touched no
crypto/protocol files, so the prior review's own exhaustive finding
stands unchanged, reconfirmed directly at this commit:

- Zero hits for `giftwrap`/`gift_wrap`/`giftWrap` (any casing) anywhere
  in `src/` or `packages/fedos-core-rust/src/`.
- No NIP-59 (the general "wrapped event" spec gift wrap depends on)
  reference anywhere.
- No ephemeral-per-recipient-key generation code of any kind exists —
  the one real key-derivation primitive this repository has
  (`derive_conversation_key_via_ecdh_internal`,
  `packages/fedos-core-rust/src/crypto/conversation_key.rs:235`)
  derives a pairwise key from two long-term identity keys, not an
  ephemeral wrapping key.

## Relevance to pairwise fanout specifically

Gift wrap's own real-world purpose — hiding the true sender/recipient
pubkeys from the relay/observer layer, per NIP-17's own design the
prior review named as research-required
(`docs/reviews/private_protocol_delivery_group_v1/05_nostr_metadata_leakage.md`) —
is a **transport-layer** concern. Pairwise fanout (`04`) is a
**content-layer** decision: how many independently-encrypted copies of
a logical message exist, not how those copies are addressed on the
wire. The two concerns are independent: a future Arc could deliver
fanout's own N ciphertexts over gift-wrapped Nostr events, over
un-wrapped NIP-44 events, or over no Nostr transport at all (the
current reality) — this review's own recommendation (`20`) does not
presuppose gift wrap exists, and does not require it to be built before
fanout's own orchestration layer can be specified or even implemented
locally (send/read/list without transport, exactly as Alpha 1111–1180
itself already proves is a coherent, independently valuable
capability).

## Explicit refusal to invent

This review does not design a gift-wrap-equivalent mechanism, an
ephemeral-key scheme, or any new sender/recipient-hiding primitive —
doing so would be inventing cryptography, prohibited by this review's
own ground rules.

## See also

- `01_nip17_inventory.md`, `04_pairwise_fanout_architecture.md`
- `13_relay_trust_assumptions.md`
