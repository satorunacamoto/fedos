# Secure Runtime Alpha 256 — Thread and Reply Semantics

**Status: this Stage is a DESIGN DECISION Stage. It adds NO new
production file — it formally fixes the semantics `FedosBoardPost`
(Alpha 255) already structurally supports via its `threadId`/`replyTo`
fields, and the invariants `validateFedosBoardPost` (Alpha 257) checks
against them.** Stage 6 of the Alpha 251–260 Canonical Board Model
Foundation Arc.

## 1. New thread root

- `replyTo === null`.
- `id` and `threadId` are DIFFERENT branded types (Alpha 252: "no free
  interchange between BoardId/ThreadId/PostId") — a root post's
  `threadId` is never implicitly the same VALUE typed as its `id` by
  language-level coercion. By convention, a Protocol Adapter constructing
  a root post's `FedosBoardPostInput` (Alpha 257) supplies the SAME
  underlying string for both `id` and `threadId` — "the thread's identity
  is its root post's identity" — but this is a construction-time
  CONVENTION enforced by whoever builds the input, not a type-system
  guarantee and not checked by `validateFedosBoardPost` itself (which
  cannot tell a root's `threadId` from a coincidentally-matching value on
  any other post — see §5).
- **Title policy: no title field this Arc.** `FedosBoardPost` (Alpha 255
  §3) carries no `subject`/`title` field at all — not even on a root.
  Rationale: several of this Arc's own four target protocols have no
  native title concept for a board post (Nostr kind:1 text notes,
  ActivityPub `Note` objects, and Session gateway messages are all
  titleless; only some ATProto/forum-shaped content and a subset of
  long-form Nostr kinds carry one) — adding a `title?: string` field
  now, before any adapter exists to populate it consistently, would be
  exactly the "speculative field... merely because one source protocol
  supports it" this Arc's own instruction forbids. A future Stage may add
  an optional `title` once a real adapter needs one.

## 2. Reply

- `replyTo` references one existing post (checked for well-formedness,
  not existence — see §5).
- `threadId` references the root thread (required on EVERY post, root or
  reply — non-nullable field, Alpha 255).
- **Nested replies are explicitly ALLOWED.** `replyTo` may point at ANY
  post in the same thread, not only the root — matching "Option B" of
  this Arc's own instruction's thread-shape comparison, folded into the
  adopted "Option C" combined model (§3).

## 3. Root + direct-parent: the adopted model ("Option C")

This Arc's own instruction compares three thread-shape options:

- **Option A — flat thread.** Every reply points only at the root.
  Rejected: loses genuine reply-to-reply structure entirely (no
  "distance from root" or "who replied to whom directly" is
  recoverable).
- **Option B — nested replies.** `replyTo` may point at any post.
  Necessary but, alone, does not name the thread's own root efficiently
  — recovering "which thread is this in" would require walking the
  `replyTo` chain to its end on every query.
- **Option C — store both root and parent references.** **Adopted**,
  exactly this Arc's own preferred candidate, and — per the instruction's
  own observation — `FedosBoardPost`'s shape (Alpha 255) ALREADY supports
  it without any further change:
  - `threadId` = root identity (O(1) "which thread" lookup, no chain
    walk).
  - `replyTo` = direct parent (nested-reply structure, matching Option
    B's own flexibility).

## 4. Required invariants — which layer enforces each

This Arc's own instruction lists six invariants plus one open handling
question. Each is assigned to the layer that can actually check it:

| Invariant | Enforced by | Why |
| --- | --- | --- |
| Post cannot reply to itself | `validateFedosBoardPost` (Alpha 257) | Checkable from ONE post's own fields (`replyTo !== id`) — implemented and tested. |
| Root cannot have a non-null `replyTo` | Definitional (§1) | "Root" IS DEFINED as `replyTo === null` — there is no separate state to check; a post with a non-null `replyTo` is, by definition, not a root. |
| Reply must have a `threadId` | Type system + `validateFedosBoardPost` | `threadId` is a required (non-nullable) field on EVERY `FedosBoardPost` — a value literally cannot exist without one, root or reply. |
| Parent and child must belong to the same board | Board Application Logic (future) | Requires looking up the PARENT post's own `boardId` — information `validateFedosBoardPost` does not have access to (it validates one post's fields in isolation, per Alpha 257's own "Option B: typed builder" decision — see that Stage's doc §"invariants checked"). |
| Cross-board replies invalid | Board Application Logic (future) | Same reasoning — the check is the same invariant stated twice in this Arc's own instruction. |
| Cycles invalid | Board Application Logic (future) | Requires the FULL post graph for the thread, which a single-post validator structurally cannot see. This Arc's own instruction says plainly: "Do not implement a graph database" — `src/thread/thread.ts`'s own `buildThreads` (Stage 2, Nostr-specific, unmodified by this Arc) already demonstrates the general technique (color-marking a walk to detect and cut a cycle) a future Board Application Logic layer could reuse or reimplement over `FedosBoardPost`. |
| Missing parent handling | Board Application Logic (future), explicitly defined here | See §5. |

## 5. Missing parent handling — explicitly defined

A `FedosBoardPost` whose `replyTo` names an id NOT present in whatever
post set the Board Application Logic layer currently holds is an
**orphan reply**: it is NOT rejected by `validateFedosBoardPost` (a
single post is always structurally valid on its own, regardless of
whether its parent happens to be present in the caller's current working
set — the validator has no such set to check against), and the Board
Application Logic layer decides at query/render time how to treat it —
e.g. promoting it to a synthetic root within its own `threadId`, exactly
the choice `src/thread/thread.ts`'s own `buildThreads` already makes for
an `orphan_reply` warning (Stage 2, unmodified). This Arc does not
implement that promotion logic itself; it only names which layer owns
the decision and points at the existing precedent.

## 6. What this Stage does NOT do

- Does not implement a graph database, cycle detector, or same-board
  check — all three are named as future Board Application Logic
  responsibilities (§4), not built here.
- Does not add a `title` field (§1).
- Does not modify `src/thread/thread.ts` or `src/thread/types.ts` — the
  existing Nostr-specific thread builder is untouched and remains a
  separate, working precedent for a future Board Application Logic
  layer to draw on, not a dependency of the Canonical Board Model.

## 7. See also

- `docs/secure_runtime_alpha_255_canonical_board_post_model.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
