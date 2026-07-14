# Secure Runtime Alpha 374 — Thread Query

**Status: this Stage implements code.** Stage 4 of the Alpha 371–380
Canonical Board Query Foundation Arc. Adds `thread()` to
`FedosBoardQuery` (`src/board/query/fedos_board_query.ts`).

## 1. Implementation

```ts
thread(
  boardId: FedosBoardId,
  threadId: FedosThreadId,
  filter?: FedosBoardQueryFilter,
  page?: FedosBoardQueryPageOptions,
): FedosBoardQueryResult {
  const matched = this.#source.listThreadPosts(boardId, threadId).filter((post) => matchesFilter(post, filter));
  const sorted = matched.sort(threadOrder);
  return paginate(sorted, page);
}
```

## 2. Ordering: `createdAt` ASC, `id` ASC tie-break — the OPPOSITE primary direction from the feed

**This is a NEW guarantee, not a restatement of an existing one.**
Alpha 371 §2 already found: `FedosBoardService.listThreadPosts()`
(Alpha 307) returns whatever order `FedosBoardIndex.listThreadPostIds()`'s
own backing `Set` happens to iterate — insertion order, in practice,
but NEVER documented as a contract anywhere in Alpha 305/307. This
method is the FIRST place in this repository's history that gives a
thread read a FIXED, deterministic order.

## 3. Why ASCENDING, not DESCENDING like the feed

A feed answers "what is newest" — DESC serves that directly. A thread
answers "what did this conversation say, in order" — a reader expects
the ROOT first, then each reply in the order it was actually posted,
top to bottom, exactly how every reply-view in this repository's own
render layer already presents a conversation (`src/render/html.ts`'s
own `renderThreadNode`, unmodified, unrelated to this Arc, but
confirming the same reading convention this Stage adopts
independently). Sorting a thread DESC — replies before the root they
reply to — would read backwards to a human, even though it would be
internally consistent.

## 4. Why the tie-break is `id` ASC, matching the feed's own tie-break direction

Even though the PRIMARY sort direction flips between `recentFeed()`
and `thread()`, the tie-break rule does not — `id` ASC is used
identically in both `feedOrder()` and `threadOrder()`. This is
deliberate: the tie-break's only job is to make the sort FULLY
deterministic when two posts share a `createdAt` (a real possibility
across four independent protocol sources with second-granularity
timestamps, per Alpha 359's own four-protocol fixtures) — which
DIRECTION it breaks ties in is arbitrary and carries no reader-facing
meaning, so there is no reason for it to differ between the two
methods, and every reason (consistency, one less thing to remember)
for it to stay the same.

## 5. Why replies out of causal order still sort correctly

A reply persisted (or replayed from an append-only log, Alpha 355)
BEFORE its own parent — a real, already-handled case
(`hydrateFedosBoardService`'s own bounded topological pass, Alpha
318) — sorts correctly here regardless: `threadOrder()` sorts PURELY
on `createdAt`/`id`, never on registration order or `replyTo`
structure, so causal/registration order has zero bearing on query
result order.

## 6. Conclusion

`thread()` gives every thread read a fixed, human-readable,
chronological order for the first time in this repository's history —
independent of storage/registration order, independent of which
protocol a post arrived from, and independent of the feed's own
opposite-direction convention, which it deliberately does not copy.

## 7. See also

- `docs/secure_runtime_alpha_373_recent_feed_query.md`
- `docs/secure_runtime_alpha_371_existing_read_path_inventory.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
- `docs/secure_runtime_alpha_305_board_thread_index.md`
