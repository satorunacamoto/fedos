# Secure Runtime Alpha 802 — Payload Identifier

Stage 12. `src/conversation/payload_storage/fedos_conversation_payload_id.ts`:

```ts
type FedosConversationPayloadId = string & { readonly __brand: "FedosConversationPayloadId" };
function toFedosConversationPayloadId(value: string): FedosConversationPayloadId | null;
interface FedosConversationPayloadIdGenerator { generatePayloadId(): string; }
class FedosSecureRandomConversationPayloadIdGenerator implements FedosConversationPayloadIdGenerator { ... }
```

## Requirements, checked

- **Protocol-neutral** — FedOS's own application-level identifier,
  never a Nostr/ActivityPub/AT Protocol/Session native id.
- **No path characters** — `toFedosConversationPayloadId` rejects any
  value containing `/`, `\`, or `..` (defends the append-only backend
  against a path-derived id, even though Alpha 808's own chosen design
  never constructs a per-payload filename from it anyway — defense in
  depth, checked at the type boundary regardless of backend choice).
- **No secret-bearing value** — an already-public application id, like
  every other Canonical id in this codebase.
- **Generation decision: INJECTED, not deterministic.** Unlike
  `FedosConversationId` (deterministic from an already-existing
  `(boardId, threadId)` pair, Alpha 743), a payload has no natural
  deterministic key — many payloads legitimately belong to the same
  Conversation. Mirrors `FedosBoardRuntimeIdGenerator`'s own
  established pattern (Alpha 626) exactly: default is cryptographic
  random (`@noble/hashes/utils.js`, already a dependency, zero new
  one), injectable for deterministic tests.
- **No content-hash claim** — confirmed,
  `test/secure_runtime_alpha_802_conversation_payload_identity.test.ts`
  item 7: two calls with no input at all yield different ids,
  structurally incapable of being a content hash.
- **Collision behavior: explicit** — a colliding id is a genuine
  `FedosConversationPayloadStorage`-level `"conflict"` or
  `"already-present"`, never silently overwritten (Alpha 804).
