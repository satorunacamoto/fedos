# 08 — Deletion and Retention Semantics

## Seven distinct meanings of "deleted," never conflated

1. **Hidden from the UI.** A purely presentational filter — the
   underlying record is untouched, everywhere it exists. Already has a
   real precedent: `FedosBoardModerationRecord`'s own `"hidden_placeholder"`
   state (`src/board/fedos_board_moderation.ts`, re-verified unmodified
   this pass) — "FedOS's own local visibility state... never a claim
   about whether the content still exists at its source."
2. **Made inaccessible via membership.** Revoking a member's own
   `FedosConversationMembership` (§04/§06) removes THEIR future ability
   to fetch/decrypt — the record itself is untouched for every other
   still-current member.
3. **Logical tombstone.** An explicit, durable "this message is
   withdrawn" marker recorded ALONGSIDE the original (append-only,
   never overwriting it) — mirrors `FedosBoardModerationRecord`'s own
   "separate record, never a boolean on the original" discipline,
   applied to conversation messages.
4. **Local ciphertext deletion.** The actual ciphertext bytes are
   removed from THIS device's own local storage (§07's Option B
   backend) — recoverable only if another participant's device, or a
   backup (§17), still holds a copy.
5. **Physical deletion after compaction.** Requires the storage backend
   to support rewriting the log with the deleted record's bytes
   genuinely absent — confirmed by §07: **neither existing append-only
   class supports this today**; a future Private Storage backend (§07
   Option B) would need to ADD compaction, which is a real, nontrivial
   feature this review does not design, only names as required for (5)
   specifically.
6. **Deletion from a remote peer/relay.** Entirely outside this
   repository's own control — a message already delivered to another
   participant's device, or relayed through a public/federated
   protocol (§11/§18), cannot be un-sent by any local action; at best,
   a "please delete" REQUEST can be sent (a protocol-level convention,
   not a guarantee any peer honors it).
7. **Deletion from backup.** A separate, independent action from (4)/(5)
   — §17's own backup mechanism, whichever shape it takes, must be
   separately purged, or the "deleted" content persists indefinitely in
   the backup regardless of what happens to the live store.
8. **Cryptographic erasure.** Destroying the KEY (not the ciphertext)
   such that any remaining ciphertext copies become permanently
   unreadable — the one meaning of "deleted" that this codebase's own
   real primitives (§01: `FedosMasterSeedAuthority.clear()`,
   irreversible zeroization) already demonstrate is achievable in
   principle for KEY material specifically, though not yet wired to any
   conversation-key concept.

(Eight meanings named, one more than this review's own instruction
listed — cryptographic erasure is distinct enough from "local
ciphertext deletion" (4) to warrant its own entry, since it achieves a
DIFFERENT, potentially stronger guarantee — see below.)

## Do not promise "complete deletion"

No combination of (1)-(8) above adds up to a guarantee that a message,
once sent into a multi-participant or federated conversation, can be
made to have never existed anywhere. This review explicitly forbids any
future product surface from claiming "delete" without specifying WHICH
of the eight meanings above it actually performs — an unqualified
"Delete" button is, by default, only ever guaranteed to be (1) unless a
specific future Arc's own design doc states otherwise for a specific,
narrower scope.

## The honest V1 contract this append-only architecture can actually make

Given §07's own confirmed finding (neither existing append-only backend
supports (5) physical deletion, and a future Private Storage backend
would need to ADD compaction to support it):

**V1 contract (design-level only, not implemented by this review):** a
"delete" action produces (3) a durable, append-only tombstone record
—linked by `messageId` only, mirroring `FedosBoardModerationRecord`'s
own `postId`-only linkage — that causes the message to become (1)
hidden from every conforming reader's UI and (2) excluded from any
future read a member without pre-tombstone access could otherwise make.
It does **not**, in V1, perform (4) local ciphertext removal, (5)
physical log compaction, (6) remote/peer deletion, or (7) backup
purge — each of these is named explicitly as future, opt-in, and
separately-scoped work, never silently implied by the word "delete."

**Cryptographic erasure (8) is the one meaning worth flagging as a
realistic NEAR-TERM addition**, distinct from physical deletion (5):
because §05 recommends per-epoch keys (§06), destroying a SPECIFIC
epoch's own key (once every message sealed under it has either been
independently re-encrypted forward or is considered acceptably
lost) renders that epoch's ciphertext permanently unreadable to anyone
who does not already hold a copy of the destroyed key — a real,
achievable guarantee for "this OLD epoch's content becomes
unreadable going forward," without requiring physical log compaction at
all. This is NOT the same as "the specific message the user clicked
delete on is now gone" (that message may share an epoch with many other
still-wanted messages) — it is named here as a distinct, coarser-grained
tool a future Arc could offer under an honestly-scoped name (e.g. "wipe
this conversation's oldest key epoch"), never marketed as
message-level deletion.

## See also

- `docs/reviews/private_conversation_security/06_key_epochs.md`
- `docs/reviews/private_conversation_security/07_at_rest_storage.md`
- `docs/reviews/private_conversation_security/16_moderation_encryption.md`
