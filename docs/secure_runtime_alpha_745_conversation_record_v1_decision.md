# Secure Runtime Alpha 745 — Conversation Record V1 Decision

Stage 5. `src/conversation/fedos_conversation_record.ts`:

```ts
export interface FedosConversationRecord {
  readonly id: FedosConversationId;
  readonly mode: FedosConversationMode;
  readonly boardId: FedosBoardId;
  readonly rootThreadId: FedosThreadId;
  readonly rootPostId: FedosBoardPostId;
  readonly policyReference: FedosConversationPolicyReference;
  readonly createdAt: number;
}
```

Every field is justified by something already true today (see the
file's own header for the full per-field justification); nothing
speculative is included. Compared against the task's own candidate
shape: adopted as-is, with `policyReference` typed as the one V1
literal tag (see Alpha 746) rather than a bare `string`.

## Explicitly excluded, and why (see the file's own header for the full list)

Plaintext body/ciphertext, member list, invitation/secret, delivery
status, author profile, arbitrary metadata, and a mutable `deleted`/
`private` boolean are all excluded — each for a distinct, specific
reason (never merely "out of scope"), detailed in
`src/conversation/fedos_conversation_record.ts`'s own header comment.

**No lifecycle field.** Considered and rejected for V1: nothing in this
Arc's scope ever produces a lifecycle transition (no
`createConversation`/`closeConversation` command exists), so a stored
lifecycle field would have no writer — the same "no field without a
writer" objection this file's header raises against the excluded
encryption-key field. Lifecycle vocabulary belongs to a future Arc that
actually implements a transition; see the approved Conversation
Foundation V1 review's own `09_lifecycle_deletion.md` for the reasoning
this Stage inherits unchanged.

## Immutability

Every field `readonly`; no mutation method or setter — matching
`FedosBoardPost`/`FedosBoardOutboxIntent`'s own established discipline.
Only `validateFedosConversationRecord` (Alpha 748) may construct a
value of this type.
