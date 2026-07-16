# Secure Runtime Alpha 748 — Conversation Record Validation

Stage 8. `src/conversation/fedos_conversation_record_validator.ts` —
the ONLY place in this repository that constructs a
`FedosConversationRecord`, mirroring `validateFedosBoardPost`'s own
"typed builder, sole constructor" discipline (Alpha 257, unmodified).

## Requirements, checked in order

1. **Exact field set** — `Object.keys(input)` compared against exactly
   seven expected keys; any extra or missing field fails closed.
2. **`mode` public only** — `input.mode !== "public"` fails closed,
   including the two recognized-but-unsupported
   `FedosConversationMode` literals (Alpha 744).
3. **Valid IDs** — `boardId`/`rootThreadId`/`rootPostId` each pass
   through their own existing branding function
   (`toFedosBoardId`/`toFedosThreadId`/`toFedosBoardPostId`, Alpha 252,
   unmodified); a malformed/empty value fails closed.
4. **Root Mapping Contract** — `rootPostId === rootThreadId` (Alpha
   747); a mismatch fails closed.
5. **`createdAt` Unix seconds** — reuses `FedosBoardPost`'s own already-
   decided accepted range
   (`FEDOS_BOARD_POST_MIN_CREATED_AT`/`MAX_CREATED_AT`,
   `src/board/fedos_board_post_validator.ts`, Alpha 257, unmodified)
   rather than inventing a second timestamp policy.
6. **`policyReference`** — `"public-v1"` only (Alpha 746); any other
   value fails closed.

## Fail-closed discipline

Every rejection returns `null`; nothing here throws. No network, no
storage mutation, no identity resolution, and no Board/Thread existence
check — confirming a record's root ACTUALLY exists in the durable Board
log is `FedosBoardRuntime`'s own Alpha 754/755 integration
responsibility (a genuinely new post durably written before this
validator ever runs) and `hydrateFedosConversations`'s own Alpha 756
restart-time responsibility, not this pure boundary's. The result is
deep-copied and `Object.freeze`d, never the caller's own reference,
matching `validateFedosBoardPost`'s convention exactly.
