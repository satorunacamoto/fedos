# Secure Runtime Alpha 744 — Conversation Mode Vocabulary

Stage 4. Reuses the existing `FedosConversationMode` vocabulary
unchanged — `src/board/runtime/policy/fedos_conversation_mode.ts`
(Policy Arc, Alpha 652):

```ts
export type FedosConversationMode = "public" | "private-group" | "direct";
export const FEDOS_CONVERSATION_MODE_V1_SUPPORTED: FedosConversationMode = "public";
```

No second mode enum is introduced anywhere in `src/conversation/` — the
new `FedosConversationRecord` (Alpha 745) imports this exact type.

## Rules, confirmed unchanged and still honored

- **Unsupported modes cannot be constructed by the production
  factory** — `validateFedosConversationRecord` (Alpha 748) rejects
  `mode !== "public"`, mirroring `validateFedosConversationPolicy`'s
  own identical rejection (Alpha 657, unmodified).
- **No allow-all fallback** — no code path anywhere in this Arc treats
  an unrecognized/unsupported mode as if it were `"public"`; rejection
  is explicit and closed.
- **No `isPrivate` boolean** — confirmed absent from
  `FedosConversationRecord` and every new type this Arc adds; `mode`
  remains the single source of truth.
- **Mode does not imply encryption** — this Arc implements no
  encryption of any kind (Absolute Prohibitions); nothing in
  `FedosConversationRecord` even names a cipher/key concept.
- **Mode does not imply discoverability by itself** — `discoverability`
  remains its own, independent `FedosConversationPolicy` axis (Alpha
  653, unchanged); this Arc's Conversation record carries a
  `policyReference` (Alpha 746), never a duplicated discoverability
  field of its own.

Reusing this vocabulary (rather than defining a parallel one under
`src/conversation/`) is precisely what lets `FedosConversationRecord.mode`
and `FedosConversationPolicy.mode` (Policy Arc) always agree by
construction — there is exactly one `FedosConversationMode` type in
this codebase, imported by both.
