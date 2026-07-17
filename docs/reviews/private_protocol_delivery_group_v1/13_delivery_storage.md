# Review 13 — Private Delivery Storage

## What remains durable, mapped to what already exists

| Item | Status | Where |
|---|---|---|
| Internal Envelope | **Already durable, real** | `FedosConversationMessageEnvelopePersistence` — in-memory + append-only NDJSON (`src/conversation/envelope/persistence/`) |
| Opaque payload (ciphertext) | **Already durable, real** | `FedosConversationPayloadStorage` (`src/conversation/payload_storage/`) — `getPayload` returns a defensive copy, never the ciphertext logged elsewhere |
| Outbox intent | **Not built** | `10`'s recommended `FedosConversationOutboxIntent` — by-reference only (`envelopeId`), mirroring `FedosBoardOutboxIntent`'s own discipline |
| Protocol-native identifier | **Not built** | Recorded once known (e.g. a Nostr event id post-signing) — this review recommends storing it on the Observation record's own `reason`/a dedicated field, never inventing a second source of truth for it separate from the Outbox intent |
| Observation | **Reusable as-is** | `FedosDeliveryObservation` (`10`/`12`) |

## No plaintext duplication into transport logs — the existing discipline this must not regress

Confirmed precedent this review's own recommendation must preserve:
`FedosBoardOutboxIntent`'s own header (`src/board/outbox/fedos_board_outbox_types.ts:25-32`)
states it carries a post "BY REFERENCE ONLY... never a body duplicate."
`FedosConversationPayloadStorage.getPayload()`'s own comment
(`fedos_conversation_payload_storage.ts:23-24`) already returns a
defensive copy specifically so callers cannot mutate the stored
ciphertext by holding a shared reference — a security-adjacent
discipline this review's own recommended Outbox/Observation additions
must not break by, for example, logging a Publisher's own transport
payload verbatim for debugging. Any future transport-layer logging
(HTTP request/response bodies, WebSocket frames) must log **identifiers
only** (`envelopeId`, `payloadId`, the protocol-native id once known) —
never the plaintext, never the ciphertext bytes, never key material.
This applies even though the ciphertext is already opaque —
unnecessary duplication of even ciphertext across storage locations
widens the set of places a future retention/erasure decision (`17`)
would need to reach.

## See also

- `10_outbox_intent.md`, `12_retry_duplicates.md`
- `01_source_inventory.md`
