# Secure Runtime Alpha 375 — Pagination Policy

**Status: this Stage fixes the pagination Decision, refining
`paginate()`'s own implementation inside `fedos_board_query.ts` (Alpha
373/374's own shared helper) — no new public method.** Stage 5 of the
Alpha 371–380 Canonical Board Query Foundation Arc.

## 1. Candidates compared

- **Cursor-based pagination** (an opaque token encoding "resume after
  this post"). REJECTED for this Arc: `FedosBoardFeed`'s own Alpha
  308 guardrail already excludes it explicitly ("No pagination
  cursor"), and this Arc's own query layer inherits that same
  discipline for consistency — a cursor requires deciding an encoding
  (the post `id`? a composite `createdAt`+`id`? something opaque and
  versioned?), a real design surface this Foundation Arc does not open.
- **Offset/limit pagination.** **ADOPTED.** Matches
  `src/query/thread_query.ts`'s own already-proven, already-shipped
  convention (Stage 4, unmodified) for an analogous concern, and is
  trivially correct given the query layer ALREADY fully materializes
  and sorts the matching set before pagination — there is no
  streaming/cursor state to maintain because the whole filtered,
  sorted result already exists in memory the moment pagination is
  applied.

## 2. Limits, exactly matching `FedosBoardFeed`'s own established numbers where applicable

```ts
export const FEDOS_BOARD_QUERY_MIN_LIMIT = 1;
export const FEDOS_BOARD_QUERY_MAX_LIMIT = 100;
export const FEDOS_BOARD_QUERY_DEFAULT_LIMIT = 20;
```

`MIN_LIMIT`/`MAX_LIMIT` mirror `FedosBoardFeed`'s own
`FEDOS_BOARD_FEED_MIN_LIMIT`/`FEDOS_BOARD_FEED_MAX_LIMIT` (Alpha 308)
exactly — `1`/`100` — for consistency across the whole Board query
surface, though defined independently rather than imported (Alpha 373
§3's own reasoning applies identically here: reuse would require
depending on `FedosBoardFeed`'s own narrow module). `DEFAULT_LIMIT =
20` matches `src/query/thread_query.ts`'s own `DEFAULT_LIMIT` (Stage
4) — a number ALREADY proven reasonable in this exact repository for
an analogous "how many items per page, by default" question.

## 3. Normalization rules

- **`limit`**: `undefined` or non-finite → `FEDOS_BOARD_QUERY_DEFAULT_LIMIT`
  (20); otherwise floored and clamped into `[1, 100]`. A caller can
  never request zero, a negative count, or an unbounded result — the
  SAME fail-safe clamping `FedosBoardFeed.listRecentPosts()` and
  `queryThreads()` (Stage 4) both already apply independently, for the
  same reason: an unclamped limit is a resource-exhaustion surface.
- **`offset`**: `undefined`, non-finite, or negative → `0`; otherwise
  floored. An offset beyond the total matching count is explicitly
  VALID, not an error — it yields an empty `posts` array.

## 4. `total`/`hasMore` semantics

`total` is the matching count AFTER filtering, BEFORE pagination —
answering "how many posts match this query in total," not "how many
are on this page." `hasMore` is `offset + posts.length < total` —
`true` iff strictly more matching posts exist beyond the current page.
Both fields are computed identically for `recentFeed()` and `thread()`,
via the ONE shared `paginate()` function — no duplicate arithmetic.

## 5. Why pagination happens AFTER filtering, never before

Filtering narrows WHAT counts as a match; pagination narrows WHICH
page of matches is returned. Applying them in the opposite order (page
first, THEN filter) would make `limit`/`offset` describe a window over
the UNFILTERED set, silently returning fewer results than requested
whenever a filter excludes any post inside that window — a correctness
bug `queryThreads()` (Stage 4) already avoids the same way (filter,
then sort, then paginate, in that fixed order) — this Stage adopts the
identical ordering for the identical reason.

## 6. Conclusion

Offset/limit pagination, no cursor, with numeric bounds matching this
repository's own two existing precedents (`FedosBoardFeed`'s
`1`/`100`, `thread_query.ts`'s `20` default) — applied uniformly,
after filtering, in exactly one shared helper function both query
methods call.

## 7. See also

- `docs/secure_runtime_alpha_374_thread_query.md`
- `docs/secure_runtime_alpha_373_recent_feed_query.md`
- `docs/secure_runtime_alpha_308_chronological_board_feed.md`
- `docs/secure_runtime_alpha_371_existing_read_path_inventory.md`
