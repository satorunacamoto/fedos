# Secure Runtime Alpha 749 — Conversation Persistence Port

Stage 9. `src/conversation/persistence/fedos_conversation_persistence.ts` —
a DEDICATED port, mirroring `FedosBoardPersistence`'s own shape (Alpha
315) exactly:

```ts
export interface FedosConversationPersistence {
  putConversation(record: FedosPersistedConversationRecordV1): FedosConversationPersistenceWriteResult;
  getConversation(id: FedosConversationId): FedosPersistedConversationRecordV1 | null;
  listConversations(): readonly FedosPersistedConversationRecordV1[];
}
```

`FedosConversationPersistenceWriteResult` mirrors
`FedosBoardPersistenceWriteResult` verbatim: `"inserted" |
"already-present" | "conflict" | "failed"`. No `delete` this Arc — this
Arc's own Absolute Prohibitions forbid deletion/compaction outright,
not merely "not yet."

## Why not fold into Board persistence

A Conversation record and a Board post are different durable facts
with different lifecycles and different owners:

- `FedosBoardPersistence` is Host-private — `FedosBoardRuntime` never
  receives it directly (Alpha 622's own ownership boundary, unchanged).
  Conversation Policy/Mode resolution, by contrast, already lives
  ENTIRELY inside `FedosBoardRuntime` (Alpha 656) — Host has no concept
  of Conversation at all. Folding Conversation persistence into
  Board persistence would force Host to gain Conversation-aware write
  logic it has no other reason to know about.
- Every other durable concern in this codebase already gets its own
  port the moment it is a distinct fact — Board / Outbox / Observation
  are three separate ports today, never merged for convenience. A
  fourth, Conversation, follows the same established discipline.
- `docs/secure_runtime_alpha_638_structural_guards.md`-style guard
  tests already assume `FedosBoardRuntime` never imports a
  Board/Outbox/Observation persistence directly; `test/secure_runtime_alpha_638_structural_guards.test.ts`
  was updated (Alpha 754) to confirm Conversation persistence is the
  ONE sanctioned, reasoned exception — never a general loosening of
  that guard.

`fedosPersistedConversationRecordsAreEqual` plays the identical role
`fedosPersistedBoardPostRecordsAreEqual` does for Board persistence
(Alpha 315 §"already-present") — a port-level equality rule, not one
backend's private detail.
