# Secure Runtime Alpha 758 — Local Runtime Ownership

Stage 18. `startFedosDesktopRuntime()`
(`src/desktop/runtime/fedos_desktop_runtime.ts`) now owns and injects
Conversation persistence for the running runtime, and exposes
Conversation reads entirely through `runtime.boardRuntime()`'s own new
methods (Alpha 757) — no new accessor is added to
`FedosRunningDesktopRuntime` itself, matching Alpha 671's own
"`FedosBoardRuntime` is the one thing a caller holds a reference to"
precedent.

## Wiring

- `AppendOnlyFedosConversationPersistence(config.conversationLogPath)`
  when a path is supplied; otherwise an explicit, freshly-constructed
  `InMemoryFedosConversationPersistence()` — constructed HERE, not left
  to `FedosBoardRuntime`'s own internal default, so this function
  always holds a concrete reference to hydrate (Alpha 756) and pass
  through explicitly to `createFedosBoardRuntime()`.
- `ensureParentDirectoryExists(config.conversationLogPath)` runs
  alongside the existing Board/Outbox/Observation calls, only when a
  path is actually supplied.
- After `await host.start()` succeeds (Board state is hydrated,
  `host.board()` is real) and BEFORE `createFedosBoardRuntime()` is
  called, `hydrateFedosConversations(conversationPersistence,
  host.board()!)` runs; a non-`"hydrated"` outcome throws, mirroring
  `host.start()`'s own thrown-error convention for a corrupt Board log.

## Additive configuration

`FedosDesktopRuntimeConfig` gains exactly one new, OPTIONAL field —
`conversationLogPath` — following the same "explicit, caller-supplied
path, no default, no `cwd`-relative implicit path" discipline as
`boardLogPath`/`outboxLogPath`/`observationLogPath` (Alpha 604/609). No
default repository-relative path is ever assumed; omitted, the
explicit in-memory construction above applies.

## No filesystem internal exposed

Neither the `FedosConversationPersistence` object nor any raw file
handle/path is ever returned to a caller — Conversation reads are
reachable only via `runtime.boardRuntime().findConversation()`/
`conversationForThread()`/`listBoardConversations()` (Alpha 757).
