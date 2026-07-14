# Secure Runtime Alpha 373 — Recent Feed Query

**Status: this Stage implements code.** Stage 3 of the Alpha 371–380
Canonical Board Query Foundation Arc. Adds
`src/board/query/fedos_board_query.ts`, exporting `FedosBoardQuery`
with its first method, `recentFeed()`.

## 1. Implementation

```ts
recentFeed(
  boardId: FedosBoardId,
  filter?: FedosBoardQueryFilter,
  page?: FedosBoardQueryPageOptions,
): FedosBoardQueryResult {
  const matched = this.#source.listBoardPosts(boardId).filter((post) => matchesFilter(post, filter));
  const sorted = matched.sort(feedOrder);
  return paginate(sorted, page);
}
```

## 2. Ordering: `createdAt` DESC, `id` ASC tie-break

The EXACT SAME rule `FedosBoardFeed.listRecentPosts()` already
established (Alpha 308 §4) — newest posts first, with a deterministic
tie-break on the branded `id` (never insertion order, never object
identity) when two posts share a `createdAt` value.

## 3. Why this reimplements the comparator rather than importing `FedosBoardFeed`'s own

Reviewed directly: `FedosBoardFeed.listRecentPosts(boardId, limit)`
accepts ONLY a `limit` — no filter parameter, no offset. Making
`recentFeed()` filter-and-paginate-aware by CALLING `FedosBoardFeed`
first would require requesting up to `FEDOS_BOARD_FEED_MAX_LIMIT`
(100) unfiltered posts, THEN filtering and re-paginating the result in
this file anyway — silently capping any query at 100 pre-filter
candidates regardless of how many actually match, a real correctness
bug for a board with more than 100 posts where the desired filtered
result lives beyond that cutoff. Reimplementing the (four-line)
comparator directly against the FULL unfiltered set, matching
`FedosBoardFeed`'s own Alpha 308 precedent of writing a fresh
comparator rather than reusing an unrelated-scoped one
(`src/query/thread_query.ts`), avoids this bug entirely, at the cost
of two functions existing with identical logic rather than one being
called by the other — a deliberate, reasoned tradeoff, not an
oversight. Alpha 377 verifies the two independent implementations
never actually diverge.

## 4. What `recentFeed()` adds beyond `FedosBoardFeed`

- **Filtering** (Alpha 376) — `FedosBoardFeed` has none.
- **Offset pagination** (Alpha 375) — `FedosBoardFeed` has `limit`
  only.
- **A `total`/`hasMore` result shape** — `FedosBoardFeed` returns a
  bare array; a caller cannot tell from its return value alone whether
  more posts exist beyond the requested `limit`.

## 5. What `recentFeed()` deliberately does NOT add

No ranking, no personalization, no engagement score, no
protocol/author priority boost, no random order — identical to
`FedosBoardFeed`'s own Alpha 308 guardrail, extended unmodified to
this method.

## 6. Conclusion

`recentFeed()` is a strict superset of `FedosBoardFeed.listRecentPosts()`'s
own capability — same ordering guarantee, plus filtering and real
offset pagination — implemented as an independent, self-contained
comparator to avoid a correctness bug a naive delegation would
introduce.

## 7. See also

- `docs/secure_runtime_alpha_372_canonical_board_query_contract.md`
- `docs/secure_runtime_alpha_308_chronological_board_feed.md`
- `docs/secure_runtime_alpha_371_existing_read_path_inventory.md`
