# Secure Runtime Alpha 810 — Storage Read Semantics

Stage 20. Defined behavior, verified for both backends:

| Case | Behavior |
|---|---|
| Missing descriptor | `getDescriptor`/`getPayload` return `null`, never throw. |
| Missing bytes (descriptor exists, bytes absent) | Structurally unreachable in this Arc's design — Option A (Alpha 808) writes descriptor and bytes as ONE atomic JSON line; there is no code path that persists a descriptor without its bytes. |
| Corrupt bytes (invalid base64 on disk) | `deserializeFedosConversationPayload` rejects (`null`); the backend's own replay throws rather than returning a partial/corrupt `FedosConversationPayload` (Alpha 806/809). |
| Corrupt descriptor (unknown field, invalid mediaType, etc.) | Same rejection path — the codec reuses `validateFedosConversationPayloadDescriptor` (Alpha 803) for every descriptor-shaped check. |
| Tombstoned | The PORT itself still returns the bytes (it has no retention concept) — `FedosPayloadRetentionAuthority.readPayload()` is what denies access (Alpha 796/811); calling `getPayload` directly, bypassing the Authority, is the caller's own choice and not gated by this Arc. |
| Payload removed | Same as tombstoned — gating is the Authority's job, not the port's. |
| Duplicate records (same id, identical content) | Collapse to one on replay — idempotent, not corruption. |
| Conflicting records (same id, different content) | Replay THROWS — never silently picks a winner (Alpha 809). |

**Never returns partial/corrupt bytes as valid** — every failure mode
above either returns `null` (a clean absence) or throws (a detected
corruption); there is no third "here are some bytes, maybe correct"
outcome anywhere in this Arc's own code.
