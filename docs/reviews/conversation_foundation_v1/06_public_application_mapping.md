# Review 6 — Public Application Mapping

## Current operation → Conversation concept mapping

Confirmed against `src/board/runtime/fedos_board_runtime.ts` (read
directly in this worktree, not from any prior review's summary):

| Operation | `FedosBoardRuntime` method | Conversation-concept mapping in V1 |
|---|---|---|
| `createPublicThread` | `createPublicThread(command)` — builds a root post, `threadId === id` | Implicitly creates the Conversation identity `toFedosConversationId(boardId, id)` from `03`. No explicit `createConversation` command exists or is added — the Conversation record (`04`) is derived from the same act that already creates the thread, never a separate step. |
| `replyToPublicThread` | `replyToPublicThread(command)` — reuses `FedosBoardService`'s existing thread-integrity precheck via `Host.submitPost()` | Adds to an existing Conversation; never mints a new `FedosConversationId`. No Conversation-record write occurs on reply — the record captured `createdAt` once, at thread-root time, per `04`. |
| `recentFeed` | `recentFeed(boardId, filter?, page?)` — delegates to `Host.query()` | Board-scoped, not Conversation-scoped; unchanged. A future Conversation-scoped feed (e.g. "list my conversations") is out of V1 scope — nothing in this spec adds one. |
| `thread query` | `thread(boardId, threadId, filter?, page?)` — delegates to `Host.query()` | This is, in V1, the read path for exactly one Conversation (`03`'s "each Thread is a Conversation" finding). No new query method is added; `(boardId, threadId)` is already sufficient to identify both the thread and its Conversation. |
| `outbound target request` | `#assembleAndSubmit()`'s eligibility loop, before `Host.submitPostWithOutbox()` | Unchanged in V1 — see `13_outbound_eligibility.md`. The Conversation Policy check this spec could add (mode readiness) is a no-op for V1 since every constructible Conversation is already `"public"`. |

No new command is added to `FedosBoardRuntime`'s public surface by this
spec. The Conversation record from `04` is a derived, read-adjacent fact
about existing operations, not a new write path a caller has to learn.

## Should `FedosBoardRuntime` remain the public API, or be wrapped?

**Remain.** No rename, and no wrapping `FedosConversationRuntime`, is
introduced by this spec.

Reasoning: AAR §14's own recommendation — *"`FedosBoardRuntime` is the
only thing a future GUI/CLI/agent caller should ever hold a reference
to"* — was written before the Policy Arc existed, and the Policy Arc
already extended `FedosBoardRuntime` itself (wiring
`FedosConversationPolicyAuthority`/`FedosOutboundEligibilityEvaluator`
into its own command handlers) rather than introducing a wrapper class.
That is the established precedent this spec follows: Conversation-aware
behavior grows *inside* `FedosBoardRuntime`, not beside it.

A rename to something like `FedosConversationRuntime` would only carry
measurable value once the class actually supports more than one mode —
today it supports exactly `"public"`, and a name implying general
Conversation support would overclaim relative to what a caller can
actually do with it. Per the task's own instruction not to propose a
rename without measurable value, this spec explicitly declines to
rename or wrap `FedosBoardRuntime`. Re-evaluate this decision only when
a real `direct`/`private-group` command is added to its surface — at
that point a rename would describe a real capability change, not just a
label change.
