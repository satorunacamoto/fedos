# Secure Runtime Alpha 295 — Session Thread Mapping

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decision is implemented by
`mapValidatedSessionPostToBoardPostInput` at Alpha 297.** Stage 5 of the
Alpha 291–300 Session Canonical Board Gateway Adapter Arc.

## 1. Why now

`FedosBoardPost.threadId`/`.replyTo` (Alpha 256, "Option C": `threadId`
= root, `replyTo` = direct parent) are fixed and MUST NOT be redesigned.
This Stage decides how `FedosValidatedSessionPost.replyTo` (Alpha 292)
populates both — the FOURTH and final time this decision is made for a
protocol, and the SIMPLEST of the four, because Session carries no root
concept at all.

## 2. Session carries no root information — the Gateway contract

Unlike Nostr (which requires reconstructing root/reply from `e`-tag
markers, Alpha 264), ActivityPub (which requires an upstream-resolved
`conversationRoot`, Alpha 276), and AT Protocol (which supplies BOTH
root and parent explicitly, Alpha 286), Session's own normalized shape
(Alpha 292) carries only ONE reply-relevant field: `replyTo`, naming the
direct parent message, and nothing else. There is no protocol-level
concept of a thread root at all in this Arc's own normalized input.

This Arc's own instruction fixes the ADOPTED Gateway contract exactly,
explicitly forbidding any inference:

```
replyTo === null   ->  Root
replyTo !== null   ->  threadId = replyTo
```

**"推測禁止" ("no inference/guessing")** — this Arc's own instruction,
verbatim. No attempt is made to walk further back to find a "true," more
distant root; `threadId` for a reply is simply, always, and only its own
`replyTo` value.

## 3. The mapping

```
replyTo === null
  -> FedosBoardPost.replyTo = null
  -> FedosBoardPost.threadId = messageId   (this post's own id — Alpha
                                             256 §1's established root
                                             convention, identical to
                                             all three prior adapters)

replyTo !== null
  -> FedosBoardPost.replyTo = replyTo
  -> FedosBoardPost.threadId = replyTo     (the SAME value, per the
                                             adopted Gateway contract)
```

## 4. A named, honest limitation — not a silent one

For every OTHER protocol this series of Arcs has handled, `threadId`
names the conversation's ULTIMATE root, consistent across every message
in the thread (Nostr's resolved root tag, ActivityPub's
`conversationRoot`, AT Protocol's `replyRootUri`). Under this Arc's own
adopted Gateway contract, a Session reply's `threadId` names only its
OWN DIRECT PARENT — meaning a three-level-deep reply chain (A ← B ← C)
produces THREE DIFFERENT `threadId` values (A's own id for A, A's id for
B, B's id for C), not one shared value across the whole chain. This is
NOT a bug or an oversight: it is the exact, explicit consequence of
"replyToあり → threadId=replyTo" being applied uniformly, and of this
Arc's own instruction forbidding inference of anything beyond it. The
`replyTo` field alone still preserves the FULL direct-parent chain (B
knows its parent is A; C knows its parent is B) — a future layer with
access to the complete stored post set (this Arc's own recommended next
Arc, a Board Repository/Index, Alpha 300 §5) could reconstruct the true
root by walking `replyTo` links, exactly the kind of cross-post
reconciliation Alpha 256 §4/§5 already assigned to a future Board
Application Logic layer for every protocol, not invented new here.

## 5. Required invariants — which layer enforces each

| Invariant | Enforced by | Why |
| --- | --- | --- |
| No self-reply | `validateFedosBoardPost` (Alpha 257), reused, NOT duplicated | The SAME composed boundary every prior adapter already relies on (Alpha 266 §4, Alpha 277 §6, Alpha 287 §6) — `replyTo === messageId` collapses to the existing `replyTo === id` check once assembled; not re-implemented here. |
| No cross-board assumption | Trivial, by construction | `boardId` is a caller-supplied parameter (§6), never derived from `post`. |
| No cycle construction | Trivial, by construction | The adapter processes exactly ONE post per call, with no access to any other post — the same per-message scope limit every prior adapter already carries. |
| No inferred root from string shape | Confirmed structurally | The mapper never inspects `messageId`/`replyTo` beyond `typeof`/non-empty/equality checks — no parsing of any kind. |

## 6. `boardId` — same policy as every prior adapter, restated

Session, like Nostr, ActivityPub, and AT Protocol, has no native "which
local board" concept. `boardId` remains a required, caller-supplied
parameter to both `mapValidatedSessionPostToBoardPostInput` and
`validateSessionBoardPost` (Alpha 297) — the identical policy every
prior Arc already fixed, restated here rather than re-decided.

## 7. See also

- `docs/secure_runtime_alpha_292_normalized_session_post_model.md`
- `docs/secure_runtime_alpha_256_thread_reply_semantics.md`
- `docs/secure_runtime_alpha_264_nostr_thread_mapping.md`
- `docs/secure_runtime_alpha_286_atproto_thread_reply_mapping.md`
- `docs/secure_runtime_alpha_297_session_board_adapter.md`
