# Secure Runtime Alpha 804 — Storage Port

Stage 14. `src/conversation/payload_storage/fedos_conversation_payload_storage.ts`:

```ts
type FedosConversationPayloadStorageWriteResult = "inserted" | "already-present" | "conflict" | "failed";

interface FedosConversationPayload {
  readonly descriptor: FedosConversationPayloadDescriptor;
  readonly bytes: Uint8Array;
}

interface FedosConversationPayloadStorage {
  putPayload(descriptor, bytes): FedosConversationPayloadStorageWriteResult;
  getPayload(id): FedosConversationPayload | null;
  getDescriptor(id): FedosConversationPayloadDescriptor | null;
  listConversationPayloads(conversationId): readonly FedosConversationPayloadDescriptor[];
}
```

No ambiguous boolean — the write-result vocabulary mirrors
`FedosConversationPersistenceWriteResult` verbatim (Alpha 749).

**Retention operations are DELIBERATELY NOT on this port.** Alpha
796/811's own instruction: tombstone/removal belong to
`FedosPayloadRetentionAuthority`, which wraps this port narrowly. This
port itself has NO delete method — matching every other append-only-backed
port in this codebase, and this Arc's own Absolute Prohibition on
automatic compaction.

`listConversationPayloads` returns DESCRIPTORS ONLY, never bulk bytes —
a caller who wants bytes must call `getPayload` per id, confirming
Alpha 813's Conversation-isolation discipline (a caller must already
know the specific payload id, not merely the conversation).
