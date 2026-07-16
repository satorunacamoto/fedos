# 17 — Retention and Erasure

## Reconciling SEC §08 (eight meanings of "deleted") and CFv1 §09 (lifecycle vs. deletion)

CFv1 §09's own split is adopted unmodified as the frame for this
document: **Conversation lifecycle** (`active`/`closed`) governs whether
new messages may be written; **message/content deletion** (SEC §08's
eight meanings) governs whether a specific message's content remains
readable. CFv1 §09 confirms neither is implemented anywhere in `src/`
today — `fedos_board_moderation.ts` remains types-only, no `deleted`
boolean, `postId`-only linkage. This review's own reading confirms this
is still true at this commit (re-grepped: no `deleted\s*:\s*boolean`
anywhere in `src/board/`).

## What changes when the content is an encrypted Envelope, specifically

SEC §08's eight meanings were designed generically for "a private
message," before `04_envelope_v1.md` existed as a concrete shape. Two of
the eight meanings interact with the Envelope's own concrete fields in a
way worth making explicit:

- **Meaning 4 (local ciphertext deletion)** now has a concrete target:
  the `ciphertext: AeadCiphertextWire` field specifically, stored
  wherever `02_storage_alignment.md`'s still-undesigned dedicated private
  backend eventually places it — never the routing metadata
  (`conversationId`/`senderRef`/`createdAt`/`source`), which SEC §07's
  own finding already establishes stays plaintext regardless.
- **Meaning 8 (cryptographic erasure)** now has a concrete mechanism to
  point at: destroying the `AeadKeyHandle` a given `keyEpoch` resolves to
  (via `06_encryption_authority.md`'s `resolveConversationKey()`, once
  real) renders every `FedosConversationMessageEnvelopeV1` whose
  `keyEpoch` field matches that epoch permanently unreadable to anyone
  who does not already hold a separate copy of the key. SEC §08's own
  framing — *"NOT the same as 'the specific message the user clicked
  delete on is now gone' ... a coarser-grained tool"* — applies exactly:
  because `04_envelope_v1.md`'s `keyEpoch` is conversation-and-epoch-scoped,
  not per-message, cryptographic erasure of one epoch's key erases every
  message sealed under it, never a single message in isolation.

## The V1 honest contract, restated for the Envelope specifically

CFv1 §09's own conclusion — no physical or remote deletion is promised
by anything this lineage of reviews has designed — is unchanged and
applies to the Envelope without modification. **This review adds no
delete/truncate/compact capability to any type it proposes.**
`04_envelope_v1.md`'s `FedosConversationMessageEnvelopeV1` has no
`deletedAt`/`tombstoned` field, consistent with SEC §02's own decision
to keep such state in a separate, `messageId`-linked record (mirroring
`FedosBoardModerationRecord`'s own `postId`-only linkage), never a
boolean on the canonical message/envelope type itself.

## What remains a product decision, not resolved here

Per SEC §20's own classification (unchanged): which of the eight
meanings a future "Delete" button performs for an Envelope-backed
message, and whether cryptographic erasure is offered as its own,
honestly-named, distinct tool, remain **product decisions this review
cannot make** — restated, not re-argued, because nothing in this
review's own additional source reading (Envelope concreteness, storage
seam findings) changes the nature of that decision.

## See also

- `docs/reviews/private_conversation_security/08_deletion_retention.md`
- `docs/reviews/conversation_foundation_v1/09_lifecycle_deletion.md`
- `02_storage_alignment.md`, `04_envelope_v1.md`, `11_key_epochs.md`
