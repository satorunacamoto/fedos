# Secure Runtime Alpha 742 — Conversation Identity Decision

Stage 2. Compares the four candidate identity models named by this
Arc's own instruction.

**Option A — Conversation ID equals Thread ID (no new type).** Rejected
as the primary choice: reusing `FedosThreadId` directly would work for
V1's one constructible mode, but gives Membership/Capability/Private
Envelope Arcs (Package B/C, per the approved Conversation Foundation V1
review) no distinct identity to grow into for `direct` conversations,
which have no Thread/Board at all. Confirmed by direct inspection this
Stage: nothing in `src/board/` gives a `direct` conversation anywhere
to anchor a `FedosThreadId`.

**Option B — new opaque Conversation ID with explicit Thread mapping.**
ADOPTED — this Arc's own preferred candidate, and the review found no
"pure duplication with no value": Option B gives every future Arc
(Membership §10, Capability §12, Private Envelope §11 of
`docs/reviews/conversation_foundation_v1/`) a stable foreign key that
does not change shape when `direct`/`private-group` eventually gain
their own, non-Thread-based construction path. See
`docs/secure_runtime_alpha_743_conversation_id_type.md` for the exact
type.

**Option C — Conversation ID equals Board ID.** Rejected outright — a
Board routinely contains many independent Conversations (Alpha 741
finding 3); this would collapse them all into one identity.

**Option D — different identity per mode.** Rejected: would require
three incompatible id types today for a system that can only construct
one of them, and no concrete need for per-mode divergence was found —
`FedosConversationId`'s own opacity (Option B) already accommodates a
future non-Thread-based construction path for `direct` without a
different TYPE, only a different construction FUNCTION.

## Evaluated against

- **Future direct conversations**: no Board/Thread exists to anchor
  one; Option B's opacity accommodates a future
  `toFedosConversationId`-sibling construction path with no type
  change.
- **Group conversations**: same reasoning as direct — group membership
  is a Package B concern, not an identity-shape concern.
- **Board containing multiple threads**: confirmed (Alpha 741 #3) —
  ruled out Option C.
- **Imported protocol IDs**: `FedosConversationId` is FedOS's own
  application-level identifier, never a Nostr/ActivityPub/AT
  Protocol/Session native id — mirrors `FedosBoardId`/`FedosThreadId`'s
  own existing discipline.
- **Migration**: Option B requires no migration of existing Board data
  — a Conversation record is a new, additive fact recorded going
  forward (see `docs/secure_runtime_alpha_756_hydration_and_migration.md`).
- **Query**: `toFedosConversationId(boardId, threadId)` alone resolves
  a lookup with no separate index (Alpha 747/753).
- **Persistence**: a dedicated `FedosConversationPersistence` port
  (Alpha 749) stores it — see that Stage's own doc.

Avoided speculative complexity per this Stage's own instruction: no
`FedosDirectConversationId`/`FedosGroupConversationId` variant is
introduced; `FedosConversationId` stays one opaque type for every mode.
