# Secure Runtime Alpha 757 — Read API

Stage 17. `FedosBoardRuntime` gains exactly three new public read
methods, mirroring `findPost`/`recentFeed`/`thread`'s own established
"raw string params, branding internally, `null` on invalid" style
(Alpha 632):

```ts
findConversation(id: string): FedosConversationRecord | null;
conversationForThread(boardId: string, threadId: string): FedosConversationRecord | null;
listBoardConversations(boardId: string): readonly FedosConversationRecord[];
```

Each delegates to a private `FedosConversationReader`
(`src/conversation/fedos_conversation_reader.ts`, Alpha 753), which
itself wraps the injected `FedosConversationPersistence` — never
returned to a caller directly, matching `FedosBoardReader`'s own
identical role for `FedosBoardPersistence`
(`src/board/repository/fedos_board_reader.ts`).

## Confirmed

- **Does not expose the persistence object** — `FedosConversationReader`'s
  own constructor stores the injected persistence privately; no public
  accessor returns it. `FedosBoardRuntime`'s own `#conversationPersistence`
  field is likewise private (`#`-prefixed), never exposed by any public
  method.
- **No membership/private method of any kind** — confirmed by direct
  inspection of every method added this Stage; none accepts or exposes
  a participant/member/capability concept (none exists in this Arc's
  scope at all).
- **Closed public surface** — `test/secure_runtime_alpha_632_read_boundary.test.ts`'s
  own exhaustive method-name assertion (updated this Arc) confirms
  `FedosBoardRuntime`'s complete public surface is exactly eight
  methods, the five pre-existing ones plus these three — never `board`/
  `query`/any raw Host accessor.
