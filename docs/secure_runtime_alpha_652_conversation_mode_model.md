# Secure Runtime Alpha 652 — Conversation Mode Model

Stage 2. `FedosConversationMode` (`src/board/runtime/policy/fedos_conversation_mode.ts`):

```ts
export type FedosConversationMode = "public" | "private-group" | "direct";
```

Only `"public"` is constructible/accepted by this Arc's Application
Runtime. `"private-group"`/`"direct"` are inert vocabulary — named so a
future Arc has a fixed enum to implement against, not fake support.
`validateFedosConversationPolicy()` (Alpha 657) rejects any `mode`
other than `"public"`, fail closed. No boolean `isPrivate` exists
anywhere; "invite-only," "encrypted," and "discoverable" are each their
own independent axis (Alpha 653), never folded into `mode`.
