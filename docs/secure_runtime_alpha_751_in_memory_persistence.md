# Secure Runtime Alpha 751 — In-Memory Persistence

Stage 11. `InMemoryFedosConversationPersistence`
(`src/conversation/persistence/in_memory_fedos_conversation_persistence.ts`) —
mirrors `InMemoryFedosBoardPersistence`'s own private-field `Map`-backed
convention exactly (Alpha 316). `FedosBoardRuntime`'s own default when
no `conversationPersistence` dependency is injected (Alpha 754).

## Verified

- **Insert** — a genuinely new `id` is accepted, returns `"inserted"`.
- **Idempotent duplicate** — the same `id` written again with a
  structurally IDENTICAL record returns `"already-present"`, no
  mutation.
- **Conflict never overwrites** — the same `id` written again with a
  DIFFERENT record returns `"conflict"`; the original stored record is
  preserved unchanged (confirmed by re-reading via `getConversation`
  after the conflicting write).
- **Independent instances** — two `new InMemoryFedosConversationPersistence()`
  instances never share state; no module-level mutable state exists in
  this file.
- **Returned values immutable in practice** — `listConversations()`
  returns a NEW array every call (mutating the returned array never
  affects the backing `Map`); the persisted records themselves are
  plain wire objects, not shared mutable references a caller could
  corrupt back into the store.
- **Malformed record cannot enter through the public boundary** — this
  class itself performs no validation (matching
  `InMemoryFedosBoardPersistence`'s own identical division of labor:
  the PORT stores whatever it is given; `FedosBoardRuntime`'s own
  `#recordConversationForRootPost()` (Alpha 754) is what guarantees
  only an already-`validateFedosConversationRecord`-accepted,
  `serializeFedosConversationRecord`-produced value ever reaches
  `putConversation()` in practice).
