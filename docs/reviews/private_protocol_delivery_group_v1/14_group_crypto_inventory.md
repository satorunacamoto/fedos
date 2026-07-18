# Review 14 — Group Encryption Strategy Inventory

## Confirmed: no implemented standard group protocol exists

A grep for `Sender Key|SenderKey|MLS|sender_key` (case-insensitive)
across `packages/fedos-core-rust/src/` returns exactly one file
(`lib.rs`) and zero matches for the terms themselves within it — the
hit is incidental (a substring match unrelated to group cryptography).
**No Sender Key, MLS, or any other standard group-messaging scheme
exists anywhere in this codebase**, confirmed directly, not assumed.

## What does exist, separated by category

- **Pairwise direct key.** Real, exported: `resolve_conversation_key`
  (`packages/fedos-core-rust/src/lib.rs`) -> `derive_conversation_key_via_ecdh_internal`
  (`conversation_key.rs:235`) — secp256k1 ECDH + HKDF-SHA256
  extract-only, NIP-44-vector-verified. This is the **only** real
  key-derivation primitive that exists.
- **Shared group symmetric key.** Does not exist — no type, no
  generation function, no distribution mechanism anywhere in
  `src/conversation/` or `packages/fedos-core-rust/src/`.
- **Pairwise key wrapping.** Does not exist as a distinct primitive —
  the pairwise ECDH key itself is the only "wrapping"-adjacent
  construction present, and it wraps nothing; it derives a shared
  secret directly.
- **Sender Keys.** Does not exist — no per-sender symmetric key type,
  no distribution mechanism, no reference to the pattern in code
  (confirmed by the grep above).
- **MLS.** Does not exist — no TreeKEM, no epoch/ratchet tree, no
  RFC 9420 reference anywhere in this codebase.

## The structural fact that changes since the prior Security review

The prior review (`docs/reviews/private_conversation_security/`)
evaluated these options against a codebase where the pairwise ECDH
primitive existed but was **entirely unwired** — no Membership, no
Coordinator, no participant resolution connected it to anything. As of
this review's own base commit (`01`), the pairwise primitive is now
**fully wired end-to-end** for exactly one counterparty via
`FedosConversationKeyResolver`/`MembershipFedosConversationParticipantResolver`
— but that same wiring **actively rejects** more than one other active
member (`"ambiguous-counterparty"`,
`fedos_conversation_participant_resolver.ts:74`). This is a stronger,
more specific fact than "group key management is unsolved": group
encryption today is not an open question the Coordinator is silent on
— it is a case the Coordinator's own real code explicitly refuses to
guess at, by design, per that file's own header (lines 16-23: "a
deliberate, honest refusal to guess which of several private-group
members the pairwise key should be derived against, never a silent
'pick the first one'").

## See also

- `01_source_inventory.md`
- `15_group_strategy.md`
- `docs/reviews/private_conversation_security/01_existing_crypto_inventory.md`,
  `05_key_distribution.md`
