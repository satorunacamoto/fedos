# Secure Runtime Alpha 753 — Conversation Repository / Index Decision

Stage 13. Compares:

**A. a full, separate in-memory repository/index**, mirroring
`FedosBoardService`'s own Source/Board/Thread index rebuild at
hydration time. REJECTED. `FedosBoardService` exists because
`FedosBoardPost` has real cross-post integrity to maintain (thread/reply
graphs, missing-parent detection) that is expensive to recompute per
read. A Conversation record has no such graph: `FedosConversationId` is
DETERMINISTIC from `(boardId, threadId)` (Alpha 743) and every V1
record already satisfies `rootPostId === rootThreadId` (Alpha 747/748)
by construction — there is nothing a second in-memory index would
compute that a direct persistence lookup does not already give for
free.

**B. read straight through to `FedosConversationPersistence`**, with a
thin lookup helper for the one query the port does not expose directly
(`listBoardConversations`, a filter over `listConversations()`).
ADOPTED. Matches `AppendOnlyFedosBoardPersistence`'s own "no side index
yet" precedent (Alpha 355) exactly, extended here to the read layer
too, not merely the storage layer.

## Minimum needed queries, and how each is answered

- **Find by Conversation ID** — `FedosConversationPersistence.getConversation(id)`
  directly.
- **Find by Thread ID** — `toFedosConversationId(boardId, threadId)`
  (Alpha 743) then the same `getConversation` lookup; no separate index
  (Alpha 747's own finding).
- **List by Board ID** — a filter over `listConversations()`, since no
  Board-keyed index exists or is needed at V1's expected record volume.

## No duplicate storage

`FedosConversationReader` (Alpha 757) stores IDS/REFERENCES to nothing
extra — it holds only the injected `FedosConversationPersistence`
reference itself, deserializing on read via
`deserializeFedosConversationRecord` (Alpha 750). No mutable record
copy is cached anywhere in the reader.
