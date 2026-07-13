# Secure Runtime Alpha 306 — Thread Integrity Boundary

**Status: this Stage is a DESIGN DECISION Stage — it adds NO new
production file this Stage; the decisions here are implemented inside
`FedosBoardService.registerPost` at Alpha 307.** Stage 6 of the Alpha
301–310 Canonical Board Repository, Index & Feed Foundation Arc.

## 1. Why now

Alpha 256 (Canonical Board Model Foundation Arc) formally named several
cross-post invariants — same-board reply, cycle detection, missing-parent
handling — and explicitly assigned them to "a future Board Application
Logic layer," because `validateFedosBoardPost` (Alpha 257) validates
ONE post in isolation and cannot see the rest of the board's post set.
This Arc's own Repository/Index (Alpha 302–305) is the FIRST component
in this repository with that visibility. This Stage names the minimum
application-level integrity check that layer must perform, closing the
loop Alpha 256 opened.

## 2. Root — checked

```
post.replyTo === null
  -> post.threadId MUST equal post.id
```

Alpha 256 §1 already fixed the CONVENTION ("a root's `threadId` equals
its own `id`") but `validateFedosBoardPost` never enforced it (Alpha 257
validates fields in isolation; it cannot tell "this post claims to be a
root with a mismatched `threadId`" from any other combination, since
both are just non-null strings to it). This Stage's own service layer
enforces it for the first time: a `replyTo === null` post whose
`threadId !== id` is rejected as `"invalid-thread"` (Alpha 307).

## 3. Reply — checked, field by field

```
post.replyTo !== null:
  1. parent = repository.findPost(post.replyTo)
     parent === null                    -> "missing-parent"        (§4)
  2. parent.boardId !== post.boardId     -> "cross-board-reply"
  3. parent.threadId !== post.threadId   -> "invalid-thread"
```

- **"parent exists"** — checked via a `findPost` lookup against the
  Repository (Alpha 303) BEFORE any mutation (§6).
- **"parent.boardId === child.boardId"** — checked directly; a mismatch
  is `"cross-board-reply"`, a distinct outcome from `"invalid-thread"`
  (this Arc's own instruction lists both as separate required outcomes,
  Alpha 307).
- **"parent.threadId === child.threadId"** — checked directly; a reply
  whose own `threadId` disagrees with its real parent's `threadId` is
  internally inconsistent, `"invalid-thread"`.
- **"post does not reply to itself"** — NOT re-checked here. This
  invariant is INHERITED FOR FREE: `validateFedosBoardPost` (Alpha 257)
  already rejects `replyTo === id` at construction time — a
  `FedosBoardPost` value with `replyTo === id` cannot exist in the first
  place, so there is nothing for this Arc's own service layer to check.
  Re-implementing it here would violate "do not duplicate Board
  validation," the same discipline every one of the four Board Adapters
  already followed (Alpha 266 §4, Alpha 277 §6, Alpha 287 §6, Alpha 297
  §6) for this exact invariant.

## 4. Missing parent — the three options and the adopted one

- **Option A — reject the reply.** **Adopted**, exactly this Arc's own
  preferred candidate for this foundation.
- Option B — store as unresolved. Rejected: would require a THIRD
  repository state ("pending"/"unresolved") this Arc's own instruction
  never asks for, and defers a decision (when does an unresolved post
  get reconciled? by what trigger?) with no answer given.
- Option C — store in a separate pending repository. Rejected: same
  reasoning as B, plus it would require designing an entirely new
  container this Arc's own Expected Production Location does not name.

**Reason (verbatim from this Arc's own instruction): "Fail closed and
keep the repository internally consistent."** A stored reply whose
parent does not (yet) exist would be an inconsistent state the
Repository/Index could never fully answer queries about (what thread
does it belong to, really?) — rejecting it outright keeps every
successfully-registered post fully resolvable.

**Do not fetch missing parents from the network. Do not perform Relay
queries. Do not ask the Ontology Engine to infer the parent.** Confirmed
by construction: `FedosBoardService` (Alpha 307) performs a single
synchronous `Repository.findPost` lookup and nothing else — no `fetch`,
no Relay import, no `p2p` import exists anywhere in
`src/board/repository/`.

## 5. Cycles — structurally impossible by the insertion rule, not
separately detected

Per this Arc's own instruction: "A newly inserted immutable post may
only point to an already-existing parent. This insertion rule should
make new cycles structurally impossible." The argument: every edge this
Arc's own Repository ever records is `(new post) -> (already-registered
parent)`, added exactly once, and a `FedosBoardPost` is immutable —
`replyTo` can never be reassigned after registration (Alpha 255, Alpha
302 §6: "the repository never edits a `FedosBoardPost` in place"). A
graph built by only ever adding an edge from a BRAND NEW node to an
ALREADY-PRESENT node can never close a cycle back to an earlier node:
the new node cannot, by definition, already be an ancestor of anything
(it did not exist a moment ago). No separate cycle-detection pass is
implemented — the insertion discipline itself is the proof, matching
this Arc's own instruction not to add speculative machinery.

## 6. All checks run before any mutation

Every check in §2–§4 is a PURE READ (`repository.findPost`, field
comparison) — none mutates the Repository, Source Index, or Board Index.
This ordering is what lets `FedosBoardService.registerPost` (Alpha 307)
guarantee "no partial writes" without any transaction/rollback framework:
if any check fails, execution returns before the FIRST mutating call is
ever made.

## 7. See also

- `docs/secure_runtime_alpha_256_thread_reply_semantics.md`
- `docs/secure_runtime_alpha_257_board_validation_boundary.md`
- `docs/secure_runtime_alpha_301_existing_board_repository_inventory.md`
- `docs/secure_runtime_alpha_307_board_application_service.md`
