# Secure Runtime Alpha 801 — Private Payload Model Decision

Stage 11. This Arc does NOT define a Private Message. It defines only
an opaque stored payload — confirmed structurally
(`test/secure_runtime_alpha_803_conversation_payload_descriptor.test.ts`
item 1: no `FedosConversationMessage`/`PrivateMessage` type anywhere).

The task's own candidate (`FedosStoredConversationPayload` with a
`bytes: Uint8Array` field inline) was reconsidered per its own
instruction to weigh keeping bytes behind the persistence port instead:

**Adopted shape** — a `FedosConversationPayloadDescriptor` (metadata
only, Alpha 803) plus bytes passed through `putPayload`/returned
through `getPayload` as a SEPARATE parameter/field
(`FedosConversationPayload = { descriptor, bytes }`, Alpha 804) —
bytes are never embedded inside the metadata-only descriptor type
itself. Both write and read make defensive, immutable copies (Alpha
805).

**Neutral terminology.** Bytes are called "opaque payload" throughout —
never "ciphertext," since nothing in this Arc proves or requires the
caller's bytes to be encrypted (confirmed,
`test/secure_runtime_alpha_803_conversation_payload_descriptor.test.ts`
item 3, and Alpha 814's own honesty review).
