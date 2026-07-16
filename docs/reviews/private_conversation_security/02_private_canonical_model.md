# 02 — Private Canonical Model Decision

## Options compared

**A. `FedosBoardPost.body` holds a ciphertext string.** REJECTED —
unchanged from the prior review's own §09 finding, reconfirmed this
pass against the current 8-field shape
(`src/board/fedos_board_post.ts:41-54`, re-verified unmodified): `body`
is documented "plain text ONLY," consumed uniformly by
`FedosBoardQuery`'s filters and every protocol adapter's mapping
function. Storing ciphertext there reintroduces a de facto boolean (a
hidden "is this body ciphertext" flag every reader must learn) and
routes private ciphertext through the same durable, un-deletable,
plaintext-metadata-leaking `FedosBoardPersistence` path public posts
use (§07).

**B. A dedicated, private-only `FedosConversationMessage` type.**
Structurally separate from `FedosBoardPost`.

**C. A canonical Message Envelope, public/private payload variants
under one discriminated type.** REJECTED for the same reason the prior
review's own §09 rejected it: `FedosBoardPost` itself exists BECAUSE a
prior, unified label-only model (`SocialEventDescriptor`) could not
serve both shapes without forcing every consumer to branch on a
discriminant — repeating that decision in reverse gains nothing a
two-type split (B) doesn't already give more cleanly, and §01's finding
that no `Envelope` concept exists anywhere in `src/` today means this
option would build a brand-new abstraction with no reuse benefit,
unlike B which slots next to the existing type without touching it.

**D. Board carries metadata only; ciphertext lives in a dedicated
Storage boundary.** Not a rival to B — a STORAGE decision, layered atop
whichever canonical type (B) holds the metadata. See §07.

**E. A protocol-native encrypted message (e.g. a NIP-44 wire event) as
the canonical form itself — no FedOS-native private type at all.**
REJECTED, newly evaluated this pass with §01's real crypto inventory in
hand: this would make the Canonical Conversation model **protocol-
dependent by construction** — a NIP-44 wire event has no meaning on
ActivityPub/AT Protocol/Session, so "the canonical record IS the Nostr
wire format" would force every non-Nostr protocol's private message
into a lossy translation FROM Nostr's own wire shape, inverting the
entire Canonical-Board discipline this codebase already established
(protocol adapters map INTO the canonical shape, never the other way).
It would also mean the canonical private message can never exist until
the sender has already chosen a delivery protocol — impossible for a
locally-composed message not yet routed anywhere, and incompatible with
`FedosBoardOutboxIntent`'s own "post exists durably before any outbound
target is chosen" discipline (prior review's own §10, re-confirmed §11
below).

## Recommendation: **B, with D as its storage backing (§07)**

A dedicated `FedosConversationMessage` type — metadata fields
(conversation id, sender ref, timestamp, message id) held the same way
`FedosBoardPost` holds its own metadata, and a `ciphertext:
AeadCiphertextWire`-shaped field (reusing §01's own already-real,
already-typed wire-string format — not a bespoke encoding) whose bytes
are opaque to every reader that isn't a conversation participant. Not
implemented by this review; the shape below is illustrative only.

```ts
// Design shape only. Not implemented by this review.
interface FedosConversationMessage {
  readonly id: FedosConversationMessageId;        // §03
  readonly conversationId: FedosConversationId;    // §03
  readonly sender: FedosConversationParticipantRef; // prior review's own §06.1 union
  readonly createdAt: number;
  readonly ciphertext: AeadCiphertextWire;          // §01's own real, already-typed wire format
  readonly keyEpoch: FedosConversationKeyEpoch;     // §06 — WHICH epoch's key this was sealed under
}
```

## Evaluation against every named axis

- **Plaintext exposure.** A dedicated type makes "can this ever legally
  hold plaintext" a type-level question — `FedosBoardPost` never gains
  a ciphertext-shaped field (Option A's own rejection), and
  `FedosConversationMessage.ciphertext` is typed as
  `AeadCiphertextWire` (§01's own real branded-string wire type, not a
  bare `string`) — a type-level signal, though not a runtime guarantee,
  that this field is expected to already be encrypted.
- **Protocol neutrality.** B holds no protocol-specific wire shape at
  all (Option E's own rejection reason) — a future Nostr/ActivityPub/
  AT Protocol/Session mapping (§18) reads FROM this type, exactly
  mirroring how the four existing inbound Board Adapters already map
  INTO `FedosBoardPost` (prior review's own §01/§13).
- **Query/search.** `FedosBoardQuery` (unmodified) stays scoped to
  `FedosBoardPost` only. A separate, much narrower query surface
  (participant-scoped, never cross-conversation) would be needed for
  `FedosConversationMessage` — out of this review's scope to design,
  but the type separation is what makes that narrower surface possible
  to build safely later without touching the public Query path at all.
- **Persistence.** See §07 in full — `FedosBoardPersistence`'s
  append-only, no-delete, plaintext-metadata discipline is appropriate
  for public posts and very likely wrong by DEFAULT for private
  messages; a separate type is the precondition for giving it a
  separate, deliberately-chosen persistence policy.
- **Moderation.** `FedosBoardModerationRecord`'s `postId`-only linkage
  generalizes in principle to a `messageId`-only linkage for
  `FedosConversationMessage`, but §16 names a real, unresolved tension:
  a moderator cannot review ciphertext content without either
  possessing the conversation key (breaking E2EE) or relying entirely
  on participant-side reporting.
- **Deletion.** See §08 in full — deliberately not solved here; a
  separate type is what makes a DIFFERENT retention policy from public
  posts even possible to express.
- **Backup.** See §17 — a separate storage boundary (D) for
  `FedosConversationMessage` can legitimately have a different
  backup/export policy than public Board posts without special-casing
  inside one shared table.
- **Key rotation.** The `keyEpoch` field above exists specifically so a
  re-keyed conversation's history remains readable under its OWN
  historical key (§06) — a property `FedosBoardPost`'s single-shot,
  never-rekeyed model has no analog for and would need to invent from
  scratch if Option A/C were chosen instead.
- **Multi-device.** A separate storage boundary (D, §07) is the correct
  seam for a future multi-device sync mechanism `FedosBoardPost`'s
  existing single-writer, federation-based "sync" (by being public)
  was never designed to need.
- **Bridge/federation.** `FedosConversationMessage` is never itself
  published to a public relay/inbox — §11's Outbound Eligibility gate
  is the only path any conversation content reaches an outbound
  Protocol, and it operates on the SAME gate this codebase already has
  for public posts, extended rather than duplicated.
- **Future group chat.** B's `conversationId`+`sender` shape already
  generalizes to N participants without change — the type says nothing
  about participant count; §12 covers where DM and group genuinely
  diverge (membership, key distribution), never in this base message
  shape.
- **DM.** Same type as group — DM is a `FedosConversationMode` value
  (prior review's own §04), not a different message type; a 1:1
  conversation and an N:N conversation both produce
  `FedosConversationMessage` records identically shaped.

## Explicit non-decision carried forward

This review does not choose a concrete AEAD algorithm/key-derivation
scheme for `FedosConversationMessage.ciphertext` beyond noting that
§01's own real primitives (ChaCha20-Poly1305/AES-256-GCM AEAD, real
NIP-44-compatible ECDH conversation-key derivation) are available in
principle — see §05 for the full key-distribution comparison this
still requires before any scheme is finalized.

## See also

- `docs/reviews/private_conversation_security/01_existing_crypto_inventory.md`
- `docs/reviews/private_conversation_security/07_at_rest_storage.md`
- `docs/reviews/private_conversation_security/08_deletion_retention.md`
