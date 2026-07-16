# Secure Runtime Alpha 807 — In-Memory Payload Storage

Stage 17. `InMemoryFedosConversationPayloadStorage`
(`src/conversation/payload_storage/in_memory_fedos_conversation_payload_storage.ts`) —
mirrors `InMemoryFedosConversationPersistence`'s own private-field
`Map`-backed convention (Alpha 751).

Verified (`test/secure_runtime_alpha_807_in_memory_payload_storage.test.ts`,
12 tests): insertion; idempotency; conflict (rejected, original
preserved); immutable byte copies on both write and read; independent
instances never share state; list by Conversation returns descriptors
only, no `bytes` field; no cross-conversation lookup leak;
`getDescriptor` matches `getPayload`'s own descriptor; malformed
lookups return `null`/`[]`, never throw; type-level conformance with no
delete method; correctness holds at 100 payloads.
