# Secure Runtime Alpha 377 — Deterministic Ordering Verification

**Status: this Stage verifies existing, unmodified behavior by real
execution — no production code change.** Stage 7 of the Alpha
371–380 Canonical Board Query Foundation Arc.

## 1. Why now

Alpha 373/374 each implement their own comparator, independently of
`FedosBoardFeed`'s own Alpha 308 comparator and of each other. This
Stage proves, by execution, that the independence is safe — no
implementation silently drifted from what it was supposed to match or
oppose.

## 2. What is verified

- **`recentFeed()`'s own default (unfiltered, unpaginated-beyond-total)
  order is IDENTICAL to `FedosBoardFeed.listRecentPosts()`'s own
  order**, for the same fixture set — confirming Alpha 373's own
  independent reimplementation never actually diverged from the
  established feed ordering it was designed to match.
- **`recentFeed()` and `thread()` sort in OPPOSITE primary
  directions**, confirmed directly: the SAME two posts with different
  `createdAt` values appear in reversed relative order between a feed
  query and a thread query over data containing them both.
- **Both orderings are STABLE under a tie** — two posts sharing the
  identical `createdAt` always resolve their relative order via `id`
  ASC, verified by constructing fixtures with intentionally identical
  timestamps and confirming the tie-break is deterministic across
  repeated calls.
- **Both orderings are independent of REGISTRATION order** — the same
  set of posts, registered into two separate `FedosBoardService`
  instances in two different (fully shuffled) orders, produce
  IDENTICAL query results from both `recentFeed()` and `thread()`.
- **Both orderings are independent of PROTOCOL** — mixing fixtures
  from all four Board Adapters into one thread/feed produces the SAME
  deterministic order a single-protocol fixture set would, confirming
  protocol origin never influences sort position (matching
  `FedosBoardFeed`'s own Alpha 308 regression coverage, extended here
  to `thread()` for the first time).
- **Repeated calls to the SAME query are byte-for-byte identical** —
  calling `recentFeed()`/`thread()` twice in a row, with no mutation
  in between, returns `posts` arrays with identical `id` sequences
  every time.

## 3. Why this matters specifically for `thread()`

`recentFeed()`'s own ordering already had a proven precedent
(`FedosBoardFeed`) to verify against. `thread()`'s own ordering
(Alpha 374) has NO precedent anywhere in this repository — it is a
brand NEW guarantee. This Stage is therefore the FIRST and ONLY place
`thread()`'s own determinism claim is actually tested, not merely
asserted in its own design doc.

## 4. Conclusion

Every ordering claim made across Alpha 373/374/375/376 is confirmed
true by direct execution, not merely by code review — including the
one genuinely new guarantee (`thread()`'s own fixed chronological
order) this Arc introduces to this repository for the first time.

## 5. See also

- `docs/secure_runtime_alpha_374_thread_query.md`
- `docs/secure_runtime_alpha_373_recent_feed_query.md`
- `docs/secure_runtime_alpha_308_chronological_board_feed.md`
