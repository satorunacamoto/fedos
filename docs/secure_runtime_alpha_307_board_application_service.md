# Secure Runtime Alpha 307 — Board Repository Application Service

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/repository/fedos_board_service.ts`.** Stage 7 of the Alpha
301–310 Canonical Board Repository, Index & Feed Foundation Arc.

## 1. Why now

Alpha 302–306 fixed every component (Repository, Source Index, Board
Index) and every integrity rule. This Stage assembles them into the ONE
write boundary that coordinates all four, so no caller ever needs to
call the three underlying components in the right order itself (or
risk calling them in the WRONG order and leaving them mutually
inconsistent).

## 2. The shape

```ts
export type FedosBoardRegistrationResult =
  | "inserted"
  | "already-present"
  | "post-id-conflict"
  | "source-conflict"
  | "missing-parent"
  | "invalid-thread"
  | "cross-board-reply";

export class FedosBoardService {
  registerPost(post: FedosBoardPost): FedosBoardRegistrationResult;
  findPost(id: FedosBoardPostId): FedosBoardPost | null;
  listBoardPosts(boardId: FedosBoardId): readonly FedosBoardPost[];
  listThreadPosts(boardId: FedosBoardId, threadId: FedosThreadId): readonly FedosBoardPost[];
}
```

`FedosBoardRegistrationResult` is a FIXED TOKEN UNION (matching this
Arc's own "discriminated union or fixed token union" instruction) — all
seven outcomes are flat string literals, exactly the candidate outcomes
this Arc's own instruction names, in the order named.

## 3. `registerPost` — the exact check order, and why it guarantees
atomicity without a transaction framework

```
1. Thread integrity (Alpha 306) -- PURE READS ONLY:
   a. post.replyTo === null  -> require post.threadId === post.id
                                  else "invalid-thread"
   b. post.replyTo !== null  -> parent = repository.findPost(post.replyTo)
        parent === null                  -> "missing-parent"
        parent.boardId !== post.boardId  -> "cross-board-reply"
        parent.threadId !== post.threadId -> "invalid-thread"

2. Source provenance pre-check -- PURE READ ONLY:
   existing = sourceIndex.findBySource(post.source)
   existing !== null && existing !== post.id  -> "source-conflict"

3. Repository write -- the FIRST mutating call:
   result = repository.register(post)
   result === "conflict"  -> "post-id-conflict"

4. Source Index + Board Index writes -- GUARANTEED consistent by
   construction (see §4):
   sourceIndex.register(post)
   boardIndex.register(post)

5. return result   (either "inserted" or "already-present")
```

## 4. Why steps 4 can never fail, given steps 1–3 already passed

Once `repository.register(post)` (step 3) returns something OTHER than
`"conflict"`, `sourceIndex.register`/`boardIndex.register` (step 4) are
GUARANTEED to return a non-`"conflict"` result too, without any
rollback logic:

- If `repository.register` returned `"inserted"` (a genuinely new id),
  neither `sourceIndex` nor `boardIndex` has ever seen this id before
  either — both will also return `"inserted"`.
- If `repository.register` returned `"already-present"` (an idempotent
  re-registration of a STRUCTURALLY IDENTICAL post,
  `fedosBoardPostsAreStructurallyEqual`, Alpha 302 §5), the FIRST time
  this exact post was registered, `sourceIndex`/`boardIndex` recorded
  the SAME `source`/`(boardId, threadId)` this call is about to submit
  again (since the post is structurally identical) — both will also
  return `"already-present"`.
- Step 2's own pre-check already ruled out a source conflict BEFORE step
  3 ever ran; since this whole method is synchronous and single-threaded,
  nothing could have changed the Source Index's state between step 2
  and step 4.

This is why NO transaction framework is needed: the ORDER of checks
(pure reads first, source pre-check before the first write, then a
write sequence that is provably consistent by construction) delivers
atomicity directly.

## 4a. Comparing `threadId` against `id` requires an explicit unbranding
cast

`FedosThreadId` and `FedosBoardPostId` are deliberately distinct branded
types with "no free interchange" (Alpha 252) — `tsc` itself rejects a
direct `post.threadId !== post.id` comparison as a type error (no
overlap between the two brands), confirming the branding discipline
works exactly as designed. The root check (§3 step 1a) therefore casts
BOTH sides to their shared underlying representation explicitly —
`(post.threadId as string) !== (post.id as string)` — comparing the
opaque string VALUES only, never treating one brand as interchangeable
with the other by convention or accident. Every OTHER comparison in this
file (`parent.boardId !== post.boardId`, `parent.threadId !==
post.threadId`) compares two values of the SAME brand and needs no cast.

## 5. Rules confirmed, per this Arc's own instruction, verbatim

- **No exceptions for normal rejection** — every rejection is a
  RETURNED token; `registerPost` never throws for a normal validation
  failure (confirmed structurally: zero `throw` statements in the
  file).
- **No partial writes** — confirmed by §3–§4's own ordering: the first
  mutating call is step 3, and every check that could reject already ran
  in steps 1–2.
- **Validation occurs before mutation** — confirmed, same reasoning.
- **Repository/SourceIndex/BoardIndex stay mutually consistent** —
  confirmed by §4's own argument.
- **If any condition fails, no component mutates** — for every
  rejection outcome (`"invalid-thread"`, `"missing-parent"`,
  `"cross-board-reply"`, `"source-conflict"`, `"post-id-conflict"`), the
  method returns at or before the point where the corresponding
  component would have mutated.
- **No transaction framework** — confirmed; no rollback/undo logic
  exists anywhere in this file, because none is needed (§4).
- **No Storage, no Runtime, no Desktop** — confirmed structurally: no
  import from `src/storage/`, `src/runtime/`, or `src/desktop/`.
- **No protocol adapter imports** — confirmed: no import from
  `src/board/fedos_board_nostr_adapter.ts`,
  `src/board/activitypub/*`, `src/board/atproto/*`, or
  `src/board/session/*`.
- **No `p2p` imports** — confirmed: no import referencing `p2p/`
  anywhere in this file.

## 6. Construction — dependency injection, defaulting to fresh
in-memory components

```ts
constructor(
  repository: FedosBoardRepository = new InMemoryFedosBoardRepository(),
  sourceIndex: FedosBoardSourceIndex = new FedosBoardSourceIndex(),
  boardIndex: FedosBoardIndex = new FedosBoardIndex(),
)
```

`new FedosBoardService()` alone is a complete, ready-to-use, fully
in-memory service — matching every prior default-constructible class
this repository already ships. The three parameters remain overridable
so tests can inject and directly inspect the underlying components
(confirming, e.g., that a rejected registration truly left the
Repository/Index untouched) without weakening the default, zero-config
path.

## 7. See also

- `docs/secure_runtime_alpha_302_board_repository_contract.md`
- `docs/secure_runtime_alpha_303_in_memory_board_repository.md`
- `docs/secure_runtime_alpha_304_board_source_index.md`
- `docs/secure_runtime_alpha_305_board_thread_index.md`
- `docs/secure_runtime_alpha_306_thread_integrity_boundary.md`
