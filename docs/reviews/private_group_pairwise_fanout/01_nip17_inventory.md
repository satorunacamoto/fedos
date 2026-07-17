# Review 01 — Current NIP-17 Inventory

## Reconfirmed, not re-derived: zero NIP-17 code exists anywhere in this repository

This review's own base commit (`d8f01cf`, `arc/private-conversation-activation-direct-messaging`)
adds the Private Conversation Activation and Direct Messaging Runtime
Arc (Alpha 1111–1180) — confirmed by its own commit's `--stat` to touch
only `src/conversation/activation/`, `src/conversation/messaging/`,
`src/conversation/runtime/`, `src/desktop/runtime/`, and their tests.
**Zero files under `src/nostr/`, `src/board/publish/nostr/`, or
`packages/fedos-core-rust/src/crypto/` changed.** The prior review's
own exhaustive grep-based finding
(`docs/reviews/private_protocol_delivery_group_v1/04_nostr_readiness.md`)
is therefore unchanged at this later commit, reconfirmed directly
rather than assumed carried forward:

- Zero hits for `NIP-17` (any casing) anywhere in `src/` or
  `packages/fedos-core-rust/src/`.
- No `kind:14`/`kind:1059` (NIP-17's own rumor/gift-wrap event kinds)
  reference anywhere.
- No rumor/seal/gift-wrap three-layer structure of any kind exists.

## Why this matters specifically for a pairwise-fanout group design

A future Arc adopting this review's own recommendation (pairwise
fanout, `04`) does **not** need NIP-17 to exist first — fanout is a
FedOS-internal orchestration decision (N independent Direct-mode sends,
`04`) that reuses the existing pairwise AEAD Envelope, never NIP-17's
own wire format. NIP-17 only becomes relevant once **protocol
delivery** (transporting an Envelope over Nostr specifically) is
attempted — a separate, deliberately out-of-scope concern per both this
review's own instructions ("do not redesign Conversation Runtime") and
the completion declaration for Alpha 1111–1180 itself, which names
"Private Conversation Protocol Delivery Boundary Arc" as its own
explicitly deferred next step (`docs/secure_runtime_alpha_1111_1180_completion_declaration.md`,
§16).

## Explicit refusal to perform official NIP-17 specification research

Consistent with the prior review's own ground rule (no external web
research), this document does not describe NIP-17's real wire
semantics beyond what the prior review already characterized
structurally (rumor/seal/gift-wrap layering, per-recipient ephemeral
keys) — it restates that prior finding's own scope and marks it as
still-required research for whichever future Arc attempts Nostr
protocol delivery for either Direct or fanout-group messages.

## See also

- `docs/reviews/private_protocol_delivery_group_v1/04_nostr_readiness.md`,
  `05_nostr_metadata_leakage.md`
- `02_gift_wrap_inventory.md`, `03_runtime_compatibility.md`
