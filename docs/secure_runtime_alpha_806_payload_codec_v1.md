# Secure Runtime Alpha 806 — Payload Codec V1

Stage 16. `FedosPersistedConversationPayloadV1` (wire type) +
`serializeFedosConversationPayload`/`deserializeFedosConversationPayload`
(`src/conversation/payload_storage/fedos_persisted_conversation_payload_v1.ts`/
`fedos_conversation_payload_codec.ts`) — mirrors
`FedosPersistedConversationRecordV1`/its codec exactly (Alpha 750).

```ts
interface FedosPersistedConversationPayloadV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly conversationId: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly createdAt: number;
  readonly bytesBase64: string;
}
```

- **`schemaVersion` exactly `1`** — an unrecognized value is rejected,
  never guessed at or migrated.
- **Exact fields, unknown fields rejected.**
- **Invalid base64 rejected.** Node's own `Buffer.from(str, "base64")`
  is LENIENT — it silently drops invalid characters rather than
  throwing. This codec independently validates the base64
  alphabet/padding shape via regex BEFORE ever decoding (confirmed,
  `test/secure_runtime_alpha_809_append_only_payload_storage.test.ts`
  item 2).
- **`byteLength` cross-checked** against the actual decoded byte count
  — a mismatch is rejected (item 3), catching corruption a bare schema
  check would miss.
- **No silent repair, never throws** — every rejection returns `null`.
- **Base64 is never exposed as the Application API** — confirmed, item
  5: the runtime `FedosConversationPayload` type carries a real
  `Uint8Array`, no `bytesBase64` field.
