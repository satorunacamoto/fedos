# 13 — Conversation and Membership Continuity

Scope: **Direct Conversations only.** Group behavior is explicitly
deferred (see below) — the current Group identity/membership model
(Sender-Key epochs, a separate unmerged lineage per `01`/`02`) cannot
safely absorb an account-identity transition without its own dedicated
review, which is out of scope here.

## Options compared (Direct)

- **A. Preserve existing Conversation ID and add identity-transition
  history** — **CHOSEN.**
- **B. Create a new Conversation ID** — REJECTED: `fedos_conversation_id.ts`
  proves the id is a pure `(boardId, threadId)` function with zero pubkey
  dependency (`01`, `03`) — there is no cryptographic reason to mint a
  new id, and doing so would break reply-reference/thread continuity for
  no security benefit.
- **C. Preserve the user-facing thread but create a new cryptographic
  conversation generation** — REJECTED as unnecessary: Direct Conversation
  encryption keys are resolved per-message from the CURRENT participant
  reference at send/receive time (via `FedosConversationKeyResolver`),
  not frozen at Conversation-creation time — there is no "conversation
  generation" concept to bump; the Ratchet SESSION is already the layer
  that resets (`12`), and duplicating that concept at the Conversation
  layer would be redundant, not safer.
- **D. Require explicit user migration** — folded into A: the "explicit"
  part is the identity-transition acceptance step (`10`), not a separate
  Conversation-level migration action.

## The chosen model, precisely

1. **`FedosConversationId` never changes.** No code touches it; nothing
   in this review requires it to.
2. **The OLD `FedosConversationMembership` record (keyed on the old
   `participant` reference) is preserved, immutable, exactly as
   historical fact** — never rewritten, never deleted (matching `14`).
3. **A NEW Membership record is created for the new participant
   reference**, but **only once the local peer's own acceptance policy
   reaches `"locally-accepted"`** (`10`) — never automatically from
   `"signature-valid"` alone. Until then, the Conversation continues to
   show only the OLD Membership as active; the new identity is simply
   unknown to this Conversation.
4. **The 3-value Membership state vocabulary (`active`/`revoked`/`left`)
   is insufficient to express "superseded by an accepted identity
   transition" distinctly from a plain `"left"`/`"revoked"`.** This
   review names an explicit, additive 4th state (e.g.
   `"superseded-by-transition"`) as REQUIRED for the Implementation Arc —
   it is not built here, and the existing 3-value union is not silently
   widened by this review itself.
5. **No automatic role/authorization inheritance.** The new Membership
   starts with whatever role a fresh join would normally receive for a
   Direct Conversation (in Direct, both participants are symmetric, so
   this is a narrower question than in Group) — it never inherits an
   "owner"/"moderator"-equivalent role from the old Membership without an
   explicit grant, which for Direct Conversations is moot (no
   role hierarchy exists) but is stated here explicitly so the
   Implementation Arc does not assume otherwise if it later extends this
   model toward Group.
6. **Reply references remain valid.** Since the Conversation id and
   Envelope persistence never change, replies to historical messages
   continue to resolve correctly regardless of which participant
   reference (old or new) sent them.
7. **Deletion-request authorship** (unmerged `22f9277`, inspected
   read-only) is NOT addressed by this review's own recommendation —
   it lives on a separate, unmerged branch and is out of scope; this
   review only notes (per `01`) that its authorship model has the exact
   same old-identity-orphaning exposure as Membership, for whichever
   future review integrates it.

## Group: explicitly deferred

The current Group/Sender-Key identity model is a structurally different
layer (`02`, per `d62090f`'s own findings) with its own unmerged rotation
lineage (`review/sender-key-rotation-v1`). This review does not extend
its Direct-Conversation continuity model to Group Conversations; doing
so safely requires its own dedicated review once Group's own identity
model is itself settled.
