# Secure Runtime Alpha 372 — Canonical Board Query Contract

**Status: this Stage implements code.** Stage 2 of the Alpha 371–380
Canonical Board Query Foundation Arc. Adds
`src/board/query/fedos_board_query_types.ts`, exporting
`FedosBoardQueryFilter`, `FedosBoardQueryPageOptions`,
`FedosBoardQueryResult`, and `FedosBoardQuerySource`.

## 1. Location

`src/board/query/` — a NEW directory, sibling to `src/board/repository/`
and `src/board/persistence/`, matching this Arc's own conceptual scope
(read/query, distinct from storage and durability). Deliberately NOT
`src/query/` (the pre-existing, unrelated Nostr-ingest query directory,
Alpha 371 §3) — the two never share a directory, a symbol name, or a
line of code.

## 2. The contract

```ts
export interface FedosBoardQueryFilter {
  readonly protocol?: FedosBoardSourceProtocol;
  readonly authorPublicIdentifier?: string;
  readonly since?: number;
  readonly until?: number;
}

export interface FedosBoardQueryPageOptions {
  readonly limit?: number;
  readonly offset?: number;
}

export interface FedosBoardQueryResult {
  readonly posts: readonly FedosBoardPost[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

export interface FedosBoardQuerySource {
  listBoardPosts(boardId: FedosBoardId): readonly FedosBoardPost[];
  listThreadPosts(boardId: FedosBoardId, threadId: FedosThreadId): readonly FedosBoardPost[];
}
```

## 3. Why `FedosBoardQuerySource` is structural, not a direct `FedosBoardService` dependency

Mirrors `FedosBoardFeedSource`'s own identical pattern
(`src/board/repository/fedos_board_feed.ts`, Alpha 308) exactly: a
minimal, two-method shape that `FedosBoardService` already satisfies
without any explicit `implements` declaration, TypeScript's own
structural typing doing the work. This keeps the query layer
decoupled from the Service's own concrete implementation — a future
caller could satisfy `FedosBoardQuerySource` with any object exposing
those two methods, including a test fake, with zero coupling to
`FedosBoardRepository`, `FedosBoardSourceIndex`, or `FedosBoardIndex`.

## 4. Why the filter model is exactly four fields, no more

Reviewed against `FedosBoardPost`'s own actual fields (Alpha 255):
`protocol` (from `source.protocol`) and `authorPublicIdentifier`
(from `author.publicIdentifier`) are both ALREADY-INDEXED-ADJACENT,
directly-comparable primitive fields; `since`/`until` bound the
already-primitive `createdAt`. NO text-search filter exists — no
search index exists anywhere in the Board layer (`FedosBoardIndex`'s
own Alpha 305 guardrail: "no search engine"), and adding one would be
exactly the kind of speculative capability this repository's own Arcs
consistently refuse to build ahead of a real, evidenced need. NO
reply-count/engagement filter exists — no such aggregation exists
anywhere in the Board layer either, and `FedosBoardFeed`'s own Alpha
308 guardrail ("no ranking, no personalization... no engagement
score") already forbids exactly this shape of filter for the SAME
underlying reason this Stage extends to the whole query layer.

## 5. Why pagination is offset/limit only, no cursor

Alpha 375 issues the full Decision; this Stage's own type shape
(`FedosBoardQueryPageOptions`) commits to it structurally now, so
Alpha 373/374's own implementations have a fixed contract to build
against. See Alpha 375 for the reasoning.

## 6. Why this is TYPE-ONLY, no implementation

Matches `fedos_persisted_board_post_v1.ts`'s own Alpha 313 precedent
("This file defines a TYPE ONLY — no function, no class, no
construction logic") and `fedos_board_persistence.ts`'s own interface
half (Alpha 315) — fixing the CONTRACT before any implementation
exists lets Alpha 373 (Recent Feed), Alpha 374 (Thread), Alpha 375
(Pagination), and Alpha 376 (Filter) each build against a stable,
already-reviewed shape, never inventing their own ad hoc parameter
list.

## 7. Conclusion

Four exported types fix the entire vocabulary the query layer speaks
— filter, page options, result shape, and minimal read source — with
zero implementation and zero dependency on any concrete storage or
service type. Alpha 373–376 implement against this contract
unchanged.

## 8. See also

- `docs/secure_runtime_alpha_371_existing_read_path_inventory.md`
- `docs/secure_runtime_alpha_313_persisted_board_record_v1.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`
- `docs/secure_runtime_alpha_308_chronological_board_feed.md`
