# Secure Runtime Alpha 741 — Current Conversation and Board Inventory

Stage 1 of the Alpha 741–760 Canonical Conversation Identity and Record
Foundation Arc. Implements Package A from the approved Conversation
Foundation V1 review (`docs/reviews/conversation_foundation_v1/`, read
via `git show worktree-conversation-foundation-v1-review:...` — never
merged into this branch's own history). Read-only inventory; no
production change in this Stage.

## Findings

1. **Board or Thread is the closest Conversation aggregate?** Thread.
   `FedosBoardId` names a discoverable, queryable grouping
   (`FedosBoardQuery.recentFeed()` spans an entire board, many
   unrelated threads/authors); a `FedosThreadId` already uniquely
   identifies one root post and everything replying to it. A
   Conversation is, in V1, exactly the set of posts sharing one
   `(boardId, threadId)` pair.

2. **Does every root post currently define one Thread?** Yes —
   confirmed directly: `FedosBoardRuntime.createPublicThread()`
   (`src/board/runtime/fedos_board_runtime.ts`) sets `threadId: id` for
   every root post it assembles, and `FedosBoardService`'s own
   thread-integrity precheck already enforces this for every entry path
   (Alpha 256/307, unmodified).

3. **Can a Board ID contain multiple Conversations?** Yes, always —
   this is precisely why Conversation cannot equal Board (Option C,
   Alpha 742, rejected).

4. **Can Conversation ID equal Thread ID?** Structurally yes (a
   `FedosThreadId` is already unique per Board), but Alpha 742 adopts a
   new, distinct opaque type instead (Option B) rather than reusing
   `FedosThreadId` directly — see that Stage's own doc for why.

5. **Why may direct/group conversations differ later?** A `direct`
   conversation has no Board at all (two participants, no discoverable
   grouping, no thread-integrity precheck to reuse) — confirmed absent
   from every source read this Stage; `FedosConversationMode` (Policy
   Arc, `src/board/runtime/policy/fedos_conversation_mode.ts`) already
   names `"private-group"`/`"direct"` as recognized-but-unconstructable
   vocabulary for exactly this reason.

6. **Policy ownership today.** `FedosConversationPolicyAuthority`
   (`src/board/runtime/policy/fedos_conversation_policy_authority.ts`,
   Alpha 656) — consulted only by `FedosBoardRuntime`, resolving the
   ONE fixed `FEDOS_CONVERSATION_POLICY_PUBLIC_V1` value for every
   `(boardId, threadId)` input via `StaticFedosConversationPolicyAuthority`.
   No persistence, no per-conversation divergence exists.

7. **Persistence gap.** No `FedosConversationId`, `FedosConversationRecord`,
   or Conversation persistence port exists anywhere in this branch's
   `src/`. Confirmed by direct recursive read of `src/board/` and
   `src/conversation/` (absent before this Arc) — grep for
   `FedosConversationRecord`/`FedosConversationPersistence` returns zero
   hits prior to this Stage's own work.

8. **Exact ripple scope.** New: `src/conversation/**` (nine new files).
   Modified: `src/board/runtime/fedos_board_runtime.ts` (Conversation
   persistence dependency + integration), `fedos_board_runtime_command_types.ts`
   (additive `conversation` field), `src/desktop/runtime/fedos_desktop_runtime.ts`/
   `fedos_desktop_runtime_config.ts` (Conversation persistence
   ownership). Zero change to `FedosBoardPost`, `FedosBoardPersistence`,
   `FedosBoardOutboxPersistence`, `FedosDeliveryObservationPersistence`,
   or any Rust/Cargo file.

Confirmed absent (not assumed): Alpha 721–740 does not exist as a
merged commit anywhere in this repository's history as of this Stage;
this Arc assumes nothing about its content, per this Arc's own
precondition.
