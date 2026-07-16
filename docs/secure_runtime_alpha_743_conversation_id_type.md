# Secure Runtime Alpha 743 — Conversation ID Type

Stage 3. Implements Option B from Alpha 742. `src/conversation/fedos_conversation_id.ts`:

```ts
export type FedosConversationId = string & { readonly __brand: "FedosConversationId" };

export function toFedosConversationId(boardId: FedosBoardId, threadId: FedosThreadId): FedosConversationId {
  return `${boardId}::${threadId}` as FedosConversationId;
}
```

## Requirements, checked

- **No random generation inside the type** — `toFedosConversationId` is
  a pure, deterministic function of its two inputs; nothing here calls
  `Math.random`/`randomUUID`/`randomBytes`.
- **No protocol-native ID** — never a Nostr event id, ActivityPub URI,
  AT Protocol record key, or Session id; always FedOS's own
  `(boardId, threadId)` pair.
- **No secret** — a Conversation id is, like `FedosBoardId`/
  `FedosThreadId`, an already-public application identifier.
- **No mutable object** — a branded primitive string, matching
  `FedosBoardId`/`FedosThreadId`/`FedosBoardPostId`'s own construction
  exactly.
- **Empty/oversized invalid** — inherited for free: `boardId`/`threadId`
  are already non-empty by construction (`toFedosBoardId`/
  `toFedosThreadId`, Alpha 252, unchanged) before ever reaching this
  function; there is no separate "empty Conversation id" input path to
  reject, since nothing constructs one from a raw caller string
  directly (only `FedosConversationRecordValidator`, Alpha 748, accepts
  a raw `id` string, and it applies its own non-empty check there).

## Deterministic mapping policy

`::`-joined, mirroring `makeFedosBoardOutboxId()`'s own established
convention (`src/board/outbox/fedos_board_outbox_types.ts`, Alpha 413)
rather than inventing a second id-construction idiom. Two calls with
the same `(boardId, threadId)` pair always produce the identical id; no
two different pairs can collide, since `boardId`/`threadId` are
themselves guaranteed non-empty and `::`-free by their own branding
functions.
