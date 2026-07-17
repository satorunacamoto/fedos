# Review 07 — AT Protocol Private Delivery

## What exists today, confirmed by direct source read

`src/board/atproto/` mirrors the ActivityPub cluster exactly in shape
and in absence of any outbound path:

- `fedos_validated_atproto_post.ts` — `FedosValidatedAtprotoPost`, seven
  fields: `uri, cid, authorDid, text, createdAt, replyRootUri,
  replyParentUri`. `cid` is retained on the validated type but never
  propagated onto `FedosBoardPost`.
- `fedos_atproto_board_adapter.ts` — pure mapping only; the file's own
  header states "no XRPC call, no DID resolution, no repository/CAR
  access, no Lexicon parsing."
- `fedos_atproto_mutation_boundary.ts` — **types only**, explicitly "no
  enforcement function, NO storage/network call," never wired anywhere.

**No outbound Publisher exists** for AT Protocol anywhere in
`src/board/publish/`.

## Required missing facts — official specification research

- **Account authentication** — the actual OAuth/App Password/session
  mechanics AT Protocol requires for any write operation.
- **Repository write** — the real `com.atproto.repo.*` XRPC call shape
  needed to create any record at all, private or public.
- **Lexicon** — this repository defines no Lexicon schema of any kind;
  any private-message record would need one, and this review does not
  invent it.
- **Recipient model** — AT Protocol's own account/identity model (DIDs,
  handles, PDS hosting) and how a recipient's encryption-capable public
  key (if any standard even defines one) would be discovered.
- **Encrypted-message standard** — whether any ratified or
  widely-adopted AT Protocol private-messaging Lexicon exists at all.
- **Moderation/service visibility** — the PDS/relay/AppView layers'
  own visibility into repository content, relevant to any confidentiality
  claim.

## Explicit refusal to assume

**This review does not assume Bluesky (or any AT Protocol
implementation) provides direct-message protocol support through feed
posts, or through any other mechanism** — this repository's own source
contains no evidence either way (only an inbound, public-feed-shaped
adapter), and the task's own instruction is explicit on this point. Any
future Arc must treat AT Protocol private delivery as **fully
research-gated**, not as "a variant of what the feed-post adapter
already does."

## Verdict

Same as ActivityPub (`06`): **Option D (unsupported) today**, following
directly from the complete absence of any outbound Publisher, Lexicon,
or authenticated-write path in this repository — not from a judgment
about AT Protocol's own cryptographic capabilities, which this review
does not evaluate without the named research.

## See also

- `01_source_inventory.md`, `03_internal_vs_wire_envelope.md`
- `06_activitypub_delivery.md`, `08_session_delivery.md`
