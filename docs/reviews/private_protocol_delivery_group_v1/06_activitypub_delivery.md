# Review 06 — ActivityPub Private Delivery

## What exists today, confirmed by direct source read

`src/board/activitypub/` contains exactly three files, all **inbound,
public-post-shaped, and unwired to any outbound path**:

- `fedos_validated_activitypub_post.ts` — `FedosValidatedActivityPubPost`,
  six fields only: `objectId, actorId, content, published, inReplyTo,
  conversationRoot`. No raw Activity object, no HTTP headers, no
  HTTP-Signature object, no OAuth/session data.
- `fedos_activitypub_board_adapter.ts` — pure mapping to
  `FedosBoardPostInput`/`FedosBoardPost`; the file's own header states
  explicitly "no HTTP, no signature verification, no Actor resolution,
  no JSON-LD parsing."
- `fedos_activitypub_mutation_boundary.ts` — **types only**:
  `FedosActivityPubObservedMutationKind` and
  `FedosActivityPubMutationObservation`; the file's own header states
  "no function, no class, no enforcement, no storage call" and
  confirms it is "NOT wired into `fedos_activitypub_board_adapter.ts`
  or any other file."

**No outbound Publisher of any kind exists anywhere in
`src/board/publish/`** for ActivityPub — confirmed by directory listing
(`01`). There is nothing to adapt for private delivery; ActivityPub
support in this repository today is read-only, and even that read path
performs no cryptographic or authorization verification of its own.

## Required missing facts — official specification research, not guessed at here

- **Addressing** (`to`/`cc`/`bto`/`bcc` semantics, how a private,
  addressed-only Activity actually differs from a public one at the
  protocol level).
- **Inbox delivery** — the actual HTTP POST-to-inbox mechanics,
  including shared-inbox vs. per-actor inbox selection.
- **HTTP Signatures** — the exact signing scheme (draft-cavage vs. newer
  RFC-track HTTP Message Signatures) implementations in the wild
  actually require, and how a signing key would map onto this
  repository's own Nostr-keyed identity model (`04`'s counterparty-key
  finding: this repository's pairwise key derivation is Nostr-keyed
  only).
- **Recipient authorization** — how a server verifies the addressed
  actor is actually a legitimate recipient before inbox delivery
  succeeds.
- **Delete/Undo** — the Activity-level retraction mechanism, relevant
  to any future retention/erasure story for federated content.
- **Server/operator visibility** — whether/how an intermediary server
  (not just the two endpoints) can observe addressed-private content
  in transit or at rest, given ActivityPub has no ratified end-to-end
  encryption standard.
- **Encrypted payload interoperability** — whether any real-world
  ActivityPub implementation a counterparty might run would even
  recognize an encrypted payload embedded in an Activity's `content`,
  or would treat it as opaque/unrenderable text.

## Explicit refusal to claim

**This review does not claim ActivityPub provides, or could easily be
made to provide, end-to-end encryption interoperability.** No ratified,
widely-implemented ActivityPub E2EE standard is known to this review's
own repository-only reading (which is the only reading this review is
authorized to perform), and inventing an interoperability claim without
official specification research would violate this review's own
prohibition on protocol claims not supported by repository source.
`03`'s own verdict for ActivityPub (Option D — unsupported) follows
directly from the complete absence of any outbound Publisher, not from
a judgment about the protocol's crypto properties.

## See also

- `01_source_inventory.md`, `03_internal_vs_wire_envelope.md`
- `07_atproto_delivery.md`, `08_session_delivery.md`
- `docs/reviews/private_conversation_construction_v1/18_protocol_delivery.md`
