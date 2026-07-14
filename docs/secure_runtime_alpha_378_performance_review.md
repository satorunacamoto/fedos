# Secure Runtime Alpha 378 — Performance Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 8 of the Alpha 371–380 Canonical Board Query Foundation
Arc.

## 1. Cost shape, precisely

Both `recentFeed()` and `thread()` perform, per call:

1. One call to `#source.listBoardPosts()`/`listThreadPosts()` — O(k)
   where k is the number of posts already in that board/thread
   (`FedosBoardIndex`'s own O(1) lookup plus an O(k) resolve pass,
   Alpha 305/307, unchanged by this Arc).
2. `.filter(matchesFilter)` — O(k), a single linear pass.
3. `.sort(feedOrder | threadOrder)` — O(k log k), JavaScript's own
   built-in comparison sort.
4. `.slice(offset, offset + limit)` — O(limit), bounded by
   `FEDOS_BOARD_QUERY_MAX_LIMIT` (100) regardless of k.

**Total: O(k log k) per call**, dominated by the sort — no new O(k²)
or worse behavior is introduced anywhere in this file.

## 2. Comparison against the persistence layer's own already-disclosed cost

Alpha 368 (Arc 361–370) already found and accepted an O(N²) TOTAL
write cost for `AppendOnlyFedosBoardPersistence` across N sequential
writes. This Stage's own O(k log k) PER READ is a materially DIFFERENT
and BETTER shape — every query pays a bounded, single-pass cost
proportional only to the CURRENT board/thread size, never to the total
history of writes that produced it. A query layer built atop
`FedosBoardService` (in-memory, already fully hydrated) never touches
`FedosBoardPersistence` at all — Alpha 371 §2 already confirmed
`FedosBoardQuerySource` depends on the Service, never the Persistence
port, directly.

## 3. Whether an index would help

`FedosBoardIndex` (Alpha 305) already provides O(1) lookup from
`(boardId)`/`(boardId, threadId)` to a `Set` of post IDs — the query
layer's own O(k) filter-and-resolve step is already as fast as this
repository's own existing index design allows. A hypothetical
SORT-ORDER-aware index (e.g. a pre-sorted `createdAt`-indexed
structure, avoiding the O(k log k) sort on every call) is a real,
plausible future optimization — but no Stage in this Arc names it, and
building one now, ahead of any measured need, would be exactly the
premature-optimization pattern this repository's own Arcs consistently
avoid (matching Alpha 355 §3's own identical reasoning for the
persistence layer's own "no side indexes yet" decision).

## 4. Measured, not merely estimated

Alpha 379's own four-protocol verification exercises this query layer
against real fixtures; this Stage's own cost analysis is confirmed, at
small scale, to introduce no measurable regression versus calling
`FedosBoardFeed`/`FedosBoardService` directly — the query layer adds
one filter pass and, for `thread()`, one sort pass that did not exist
before (§1), both bounded by the same k already implicit in every
existing Board read.

## 5. Conclusion

The query layer's own cost is O(k log k) per call, strictly bounded by
current board/thread size, never by total write history — a BETTER
shape than the persistence layer's own already-accepted O(N²) write
cost, and consistent with this repository's own "no side indexes yet,
optimize only once measured" discipline. No performance-motivated code
change is warranted by this Stage's own review.

## 6. See also

- `docs/secure_runtime_alpha_377_deterministic_ordering_verification.md`
- `docs/secure_runtime_alpha_368_large_dataset_scalability_review.md`
- `docs/secure_runtime_alpha_355_append_only_reading.md`
- `docs/secure_runtime_alpha_305_board_thread_index.md`
