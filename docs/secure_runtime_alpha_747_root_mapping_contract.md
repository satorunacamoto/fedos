# Secure Runtime Alpha 747 — Root Mapping Contract

Stage 7. Defines the exact relationship between a Conversation record
and the Board data it describes.

- **One root Board Post, one Thread ID, one Conversation Record.**
  Every V1 Conversation record is anchored at exactly the root post
  that also defines its Thread — only
  `FedosBoardRuntime.createPublicThread()` ever constructs one (Alpha
  754); a root post already satisfies `id === threadId` (Alpha 631,
  unchanged).
- **Replies belong to the root Conversation.** `replyToPublicThread()`
  never creates a second Conversation record for the same
  `(boardId, threadId)` (Alpha 755) — it only resolves the existing
  one.
- **Same-board requirement.** A Conversation's `boardId` is fixed at
  creation from its root post's own `boardId`; `FedosBoardService`'s
  own existing cross-board-reply rejection (Alpha 256/307, unmodified)
  already guarantees every reply in the thread shares that same board
  before this Arc's own code ever runs.
- **Missing-root / cross-board failure.** Both are pre-existing Board
  Application Logic failures (`"missing-parent"`/`"cross-board-reply"`,
  Alpha 256/307) that already reject a post BEFORE
  `FedosBoardRuntime`'s own Conversation-recording step ever runs — no
  Conversation record can be constructed FOR a post that never
  durably existed.

## The enforceable invariant

`rootPostId === rootThreadId` is a real, checked V1 invariant —
enforced by `validateFedosConversationRecord` (Alpha 748) — not an
incidental coincidence: since only a root-post-creating command ever
constructs a Conversation record (Alpha 754), and a root post's own id
always equals its thread id (Alpha 631), every valid V1
`FedosConversationRecord` satisfies this by construction. A record
where the two disagree is therefore a genuine invariant violation
(storage corruption, or a future Arc's own bug), never a normal input —
`validateFedosConversationRecord` fails it closed rather than silently
accepting or repairing it.

## Is a separate index needed to look up a Conversation by Thread ID?

**No.** `toFedosConversationId(boardId, threadId)` (Alpha 743) alone
resolves the same record a hypothetical separate Thread-ID index would
— the id IS deterministically derived from exactly the pair a lookup
would key by. `FedosConversationReader.conversationForThread()` (Alpha
753/757) implements this directly, with zero additional storage.
