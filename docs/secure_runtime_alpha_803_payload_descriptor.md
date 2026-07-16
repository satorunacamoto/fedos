# Secure Runtime Alpha 803 — Payload Descriptor

Stage 13. `src/conversation/payload_storage/fedos_conversation_payload_descriptor.ts`
+ `fedos_conversation_payload_descriptor_validator.ts`:

```ts
type FedosConversationPayloadMediaType = "application/octet-stream"; // closed vocabulary of exactly one

interface FedosConversationPayloadDescriptor {
  readonly id: FedosConversationPayloadId;
  readonly conversationId: FedosConversationId;
  readonly mediaType: FedosConversationPayloadMediaType;
  readonly byteLength: number;
  readonly createdAt: number;
}
```

Exactly 5 fields, confirmed structurally
(`test/secure_runtime_alpha_803_conversation_payload_descriptor.test.ts`
item 4). Validated fail-closed by `validateFedosConversationPayloadDescriptor`,
mirroring `validateFedosConversationRecord`'s own "sole constructor,
never throws" discipline (Alpha 748) — `createdAt` reuses
`FedosBoardPost`'s own accepted range rather than inventing a second
timestamp policy.

## Explicitly excluded, and why

- **Plaintext body** — a byte-length/metadata record, never content.
- **Cryptographic algorithm / key epoch** — belong to a future Envelope
  layer that does not exist in this Arc (Alpha 814).
- **Author / membership / invitation** — no identity/membership/
  capability concept exists in this Arc's scope.
- **Arbitrary metadata bag** — matches `FedosConversationRecord`'s own
  "no speculative fields" discipline (Alpha 745).

`conversationId` is accepted as a non-empty string and branded directly
— this boundary does not re-validate `FedosConversationId`'s own exact
shape, since Alpha 743's module remains the sole authority for that
(this Arc's own "architecture-frozen, do not redesign accepted layers"
rule means no new export is added there for this file to call).
