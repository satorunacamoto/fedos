# Secure Runtime Alpha 371 — Existing Read Path Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 371–380
Canonical Board Query Foundation Arc, following exactly the pattern
every prior Board-layer Arc's own opening Stage already used (Alpha
251, 261, 271, 281, 291, 301, 311, 321, 331, 341, 351, 361).

## 1. Why now

The Repository (`FedosBoardRepository`, Alpha 302) and the Service
(`FedosBoardService`, Alpha 307) already own storage and thread
integrity. This Arc's own Goal is narrower and different: define HOW
clients READ Board data — not redesign how it is stored. Before
writing a single query type, this Stage inventories every existing
read path, so the new layer adds exactly what is missing and
duplicates nothing.

## 2. Every existing Board read path, inventoried

| Path | Signature | Ordering guarantee | Filtering | Pagination |
|---|---|---|---|---|
| `FedosBoardService.findPost` (Alpha 307) | `(id) => FedosBoardPost \| null` | N/A (single record) | N/A | N/A |
| `FedosBoardService.listBoardPosts` (Alpha 307) | `(boardId) => readonly FedosBoardPost[]` | **NONE documented** — `FedosBoardIndex.listBoardPostIds` (Alpha 305) returns `Set` insertion order | None | None |
| `FedosBoardService.listThreadPosts` (Alpha 307) | `(boardId, threadId) => readonly FedosBoardPost[]` | **NONE documented** — same `Set` insertion order | None | None |
| `FedosBoardFeed.listRecentPosts` (Alpha 308) | `(boardId, limit) => readonly FedosBoardPost[]` | `createdAt` DESC, `id` ASC tie-break — FIXED | None | `limit` only, no offset, no cursor (Alpha 308's own explicit guardrail) |

## 3. The unrelated, pre-existing query layer this Arc must not touch or reuse

`src/query/thread_query.ts` (Stage 4, pre-dating the Board Alpha
numbering entirely) already implements `queryThreads()` — filtering,
sorting (`new`/`old`/`top`/`hot`), and offset/limit pagination — but
operates ENTIRELY on `ThreadNode`/`ThreadBuildResult`
(`src/thread/types.ts`), the ORIGINAL Nostr-only ingest pipeline's own
data shape, never `FedosBoardPost`. `FedosBoardFeed`'s own Alpha 308
doc comment already states this directly: "deliberately NOT the same
as, and NOT reusing any code from, `src/query/thread_query.ts`." This
Arc's own new query layer follows the SAME precedent — it may mirror
`thread_query.ts`'s own PROVEN numeric conventions
(`DEFAULT_LIMIT`/`MAX_LIMIT`/offset-clamping, confirmed unchanged by
direct inspection this Stage) as prior art, but imports nothing from
it and modifies nothing in it.

## 4. What is missing, precisely

- **No filtering exists anywhere in the Board layer** — neither
  `FedosBoardService` nor `FedosBoardFeed` accepts any filter
  parameter of any kind.
- **No offset pagination exists anywhere in the Board layer** —
  `FedosBoardFeed` accepts only `limit`; `FedosBoardService`'s own two
  list methods accept no page parameter at all.
- **Thread reads have no deterministic order** — unlike the feed
  (Alpha 308's own fixed `createdAt` DESC rule), a caller of
  `listThreadPosts()` today receives posts in whatever order the
  underlying `Set` happens to iterate them (insertion order, in
  practice, but never DOCUMENTED as a guarantee anywhere in Alpha
  305/307's own contracts).
- **No unified result shape** — `findPost` returns `| null`,
  `listBoardPosts`/`listThreadPosts` return a bare array, `listRecentPosts`
  returns a bare array with no `total`/`hasMore` — three different
  shapes for three related reads, with no shared vocabulary for "how
  many matched" or "is there more."

## 5. Conclusion

The Repository and Service layers are confirmed untouched and
sufficient as READ SOURCES — this Arc adds a NEW layer on top,
depending on their existing `listBoardPosts`/`listThreadPosts` methods
structurally, changing neither. Four concrete gaps are named: no
filtering, no offset pagination, no deterministic thread order, and no
unified result shape — Alpha 372–376 close exactly these four gaps,
nothing more.

## 6. See also

- `docs/secure_runtime_alpha_370_recovery_robustness_completion.md`
- `docs/secure_runtime_alpha_308_chronological_board_feed.md`
- `docs/secure_runtime_alpha_307_board_application_service.md`
- `docs/secure_runtime_alpha_305_board_thread_index.md`
- `docs/secure_runtime_alpha_302_board_repository_contract.md`
