# Secure Runtime Alpha 812 — Restart and Recovery

Stage 22. Verified end to end
(`test/secure_runtime_alpha_819_end_to_end_storage_verification.test.ts`
item 1, steps 4/9): a fresh `AppendOnlyFedosConversationPayloadStorage`/
`AppendOnlyFedosPayloadRetentionPersistence` pair constructed over the
SAME durable file paths preserves:

- the descriptor,
- the payload bytes (while active),
- the tombstone decision,
- the payload-removal decision,
- conflict detection (a conflicting write after restart is still
  rejected, since replay reconstructs the exact same state).

**Corruption fails closed** — confirmed
(`test/secure_runtime_alpha_819_end_to_end_storage_verification.test.ts`
item 11): a corrupt payload log throws on the very first read after
restart, never silently drops the bad record and continues.

**No in-memory-only hidden authority for persisted facts** — both the
payload bytes and every retention decision live entirely in their own
durable log; `FedosPayloadRetentionAuthority` itself holds no state of
its own beyond the two injected ports (confirmed by its own
constructor, which stores only the two dependencies plus an optional
clock — no cache, no in-memory index).
