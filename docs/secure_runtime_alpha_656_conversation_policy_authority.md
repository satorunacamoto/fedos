# Secure Runtime Alpha 656 — Conversation Policy Authority

Stage 6. Interface (`src/board/runtime/policy/fedos_conversation_policy_authority.ts`):

```ts
export interface FedosConversationPolicyAuthority {
  resolvePolicy(input: {
    readonly boardId: FedosBoardId;
    readonly threadId: FedosThreadId | null;
  }): Promise<FedosConversationPolicyResolution>;
}
```

`StaticFedosConversationPolicyAuthority` is the one production
implementation — sufficient for V1 (Alpha 654). No command caller ever
reaches this interface directly; only `FedosBoardRuntime` (Phase C's
Alpha 667 wiring) consults it, mirroring
`FedosPublicAuthorAuthority`'s own caller-unreachable shape exactly. No
Relay import, no protocol adapter import, and no Publisher import
anywhere in this file or its implementation.
