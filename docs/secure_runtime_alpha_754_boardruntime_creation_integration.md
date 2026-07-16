# Secure Runtime Alpha 754 — BoardRuntime Creation Integration

Stage 14. `FedosBoardRuntime.createPublicThread()`
(`src/board/runtime/fedos_board_runtime.ts`) now durably records exactly
ONE `FedosConversationRecord` per new root post, via a new, injected
`conversationPersistence` dependency (defaulting to
`InMemoryFedosConversationPersistence`, Alpha 751).

## Compared

- **A. Conversation first, then Board.** Rejected — a Conversation
  record for a Board post that never durably existed would be an
  orphaned record with nothing to describe.
- **B. Board first, then Conversation.** ADOPTED. Only once
  `#assembleAndSubmit()` confirms the Board write itself succeeded
  (`"created"`/`"already-present"`/`"outbox-partial-failure"`, all of
  which already carry the durable `post`) does
  `#recordConversationForRootPost()` attempt the Conversation write.
- **C. Preview both, then write in a recoverable order.** Rejected as
  unnecessary complexity — unlike Board persistence (which has a real
  `previewRegistration()` predicting a genuine domain rejection), a
  Conversation record built from an already-durable, already-valid root
  post cannot itself be domain-invalid; the only failure this write can
  still produce is a `FedosConversationPersistence`-level one
  (`"conflict"`/`"failed"`), which Option B already surfaces explicitly.
- **D. A dedicated coordinator class.** Rejected as premature
  abstraction for one two-step sequence — `#recordConversationForRootPost()`
  IS the narrow coordinator this Stage's own instruction asks for, kept
  as a private method on `FedosBoardRuntime` rather than a new exported
  class.

## Atomicity, described honestly

NO transactional atomicity is claimed. `FedosBoardPersistence`/
`FedosConversationPersistence` are separate ports with no shared
commit — matching this codebase's own existing "no delete method, no
compensating transaction" discipline
(`FedosDesktopHost.submitPostWithOutbox()`'s own identical honesty
about Board-vs-Outbox writes, Alpha 419, unchanged). A process crash
between the two writes leaves a durable Board post with no Conversation
record — an honest, narrow, EXPLICIT partial failure surfaced via
`FedosConversationAssociationResult`'s `"conflict"`/`"persistence-failed"`
outcomes, never silently hidden and never described as atomic.

## Result shape

`FedosBoardRuntimeCommandResult`'s `"created"`/`"already-present"`/
`"outbox-partial-failure"` outcomes gain one new, REQUIRED field,
`conversation: FedosConversationAssociationResult`
(`fedos_board_runtime_command_types.ts`) — purely additive; every
existing caller/test matching on `.outcome`/`.post`/`.outbox` alone is
unaffected (confirmed: `test/secure_runtime_alpha_629_create_public_thread.test.ts`
and every other pre-existing Board Runtime test still pass unmodified).
Internally, `#assembleAndSubmit()`/`#mapResult()` produce a NEW,
module-private `FedosBoardRuntimeWriteResult` type (the exact
pre-Alpha-754 shape) — `createPublicThread()`/`replyToPublicThread()`
each attach their own `conversation` afterward, since the two methods
disagree on HOW it is computed (create vs. resolve, Alpha 755).
