# Secure Runtime Alpha 310 — Canonical Board Repository, Index & Feed Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha 301–310
Canonical Board Repository, Index & Feed Foundation Arc.**

## 1. Why now

Alpha 301 inventoried and confirmed no Board Repository, index, or
protocol-neutral feed existed (and confirmed `p2p/` is a wholly
unrelated, separate repository); Alpha 302–303 fixed and implemented the
Repository contract; Alpha 304–305 built the Source and Board/Thread
indexes; Alpha 306 closed the thread-integrity gap Alpha 256 left open;
Alpha 307 assembled the atomic write-coordination service; Alpha 308
built the unranked chronological feed; Alpha 309 verified the whole
stack against all four real, unmodified Board Adapters. This Stage
issues the Arc's own closing Completion Declaration.

## 2. The architecture, frozen

```
FedosValidatedNostrEvent \
FedosValidatedActivityPubPost \      Protocol Adapters (Alpha 261-300,
FedosValidatedAtprotoPost     |->      unmodified this Arc)
FedosValidatedSessionPost    /
        |
        v
   FedosBoardPost   (Canonical Board Model, Alpha 251-260, unmodified)
        |
        v
FedosBoardRepository (Alpha 302/303) <--- keyed by FedosBoardPostId
        |         "inserted" / "already-present" / "conflict"
        |
        +--> FedosBoardSourceIndex (Alpha 304) <- keyed by protocol+reference
        |         "inserted" / "already-present" / "conflict"
        |
        +--> FedosBoardIndex (Alpha 305) <- keyed by (boardId, threadId)
                  "inserted" / "already-present" / "conflict"

   All three coordinated by FedosBoardService.registerPost() (Alpha 307)
   -- thread integrity (Alpha 306) checked BEFORE any mutation --
     "inserted" | "already-present" | "post-id-conflict" |
     "source-conflict" | "missing-parent" | "invalid-thread" |
     "cross-board-reply"

        |
        v
   FedosBoardFeed.listRecentPosts(boardId, limit)  (Alpha 308)
     createdAt DESC, id ASC tie-break, no ranking, [1, 100] clamped

-- verified against all four real adapters' own output, one shared
   FedosBoardService, one Board feed, source/id-conflict fail-closed
   confirmed, missing-parent/cross-board-reply rejection confirmed,
   p2p/ untouched (Alpha 309) --
```

Zero new Rust code, zero new Cargo dependency, zero new npm dependency —
`package.json`'s own `dependencies` count stays fixed at 2, unchanged
across this whole Arc.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. The first
protocol-independent Board Application layer now exists: an in-memory
`FedosBoardRepository`, a source-provenance deduplication index, a
board/thread index, a thread-integrity-checked atomic registration
service, and a deterministic unranked chronological feed — together
converting the four completed Protocol Adapters' own `FedosBoardPost`
output into a genuinely queryable board, without persistence, network,
ranking, or any dependency on `p2p/`.**

The following are now declared complete, exactly as this Arc's own
instruction requires:

- **In-memory Canonical Board Repository** — Alpha 302/303,
  `InMemoryFedosBoardRepository`, keyed by `FedosBoardPostId`, stores by
  reference (relying on the already-verified frozen boundary,
  Alpha 257), no `removePost` in this first contract.
- **Explicit write-result semantics** — Alpha 302, no boolean hides the
  reason; every write returns one of `"inserted"`/`"already-present"`/
  `"conflict"` at every layer (Repository, Source Index, Board Index),
  and one of seven outcomes at the Service layer.
- **Post-ID conflict protection** — Alpha 303, fail closed, the original
  post is always preserved, never overwritten.
- **Source-provenance deduplication index** — Alpha 304,
  `FedosBoardSourceIndex`, reusing `fedosBoardSourceKey` (Alpha 253)
  unmodified, ID conflict and source conflict kept as separate facts.
- **Board index** — Alpha 305, `FedosBoardIndex`, ID-only, strictly
  partitioned by `boardId`.
- **Thread index** — Alpha 305, the same class, composite
  `(boardId, threadId)` keying, root and replies sharing one entry, no
  cross-board contamination possible.
- **Thread integrity validation** — Alpha 306, the cross-post invariants
  Alpha 256 deferred are now enforced: root `threadId === id`, parent
  existence (missing parent rejected, Option A), same-board reply,
  same-thread reply, self-reply inherited for free from
  `validateFedosBoardPost` (never re-checked), cycles structurally
  impossible by the insertion rule.
- **Atomic synchronous Board registration service** — Alpha 307,
  `FedosBoardService`, no transaction framework needed because the check
  order itself guarantees consistency.
- **Deterministic unranked chronological feed** — Alpha 308,
  `FedosBoardFeed`, `createdAt` DESC / `id` ASC tie-break, `[1, 100]`
  clamped limit policy, zero ranking of any kind.
- **Four-protocol integration** — Alpha 309, all four real adapters'
  output flows through one `FedosBoardService` and appears correctly in
  one `FedosBoardFeed`.

## 4. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- Persistence, SQLite/D1/IndexedDB — no `import` from `src/storage/`
  anywhere in `src/board/repository/`.
- Distributed synchronization, P2P Ontology Engine integration,
  semantic relationships, ontology inference — no reference to `p2p/`
  anywhere in `src/board/repository/`; `p2p/` remains completely
  untouched (confirmed by `git status`/`git diff`, not merely by
  absence of import).
- Search, full-text indexing — `FedosBoardIndex` indexes IDs only, no
  text search method of any kind.
- Pagination cursors, ranking, recommendations — `FedosBoardFeed`
  exposes `limit` only, no cursor, no score field.
- Likes, reposts, notifications, moderation execution — no such field
  or function exists anywhere in this Arc's own code.
- Relay Pool, GUI — untouched; `src/desktop/*`/`src/render/*` carry zero
  reference to `src/board/repository/`.

## 5. Next Arc recommendation

**Board Persistence Boundary Arc.**

Reason (verbatim from this Arc's own required recommendation): "The
in-memory application semantics must be frozen before choosing a durable
storage backend." This Arc's own `FedosBoardRepository` CONTRACT (Alpha
302) is already storage-agnostic by design — a future persistent
implementation would satisfy the SAME interface — but choosing an actual
backend (SQLite, D1, IndexedDB, or otherwise) and defining its own
consistency/durability guarantees is real, separately-scoped work that
should not be improvised as an afterthought inside this foundation Arc.

**Direct `p2p`/Ontology integration is explicitly NOT recommended next.**
This Arc's own instruction states the precondition sequence directly:
(1) Board repository semantics complete — SATISFIED by this Arc; (2) a
persistence boundary explicit — NOT YET, the very next Arc's own job;
(3) a dedicated Board→Ontology projection contract reviewed — not
started. Skipping ahead to `p2p` integration before (2) and (3) would
risk exactly the outcome this Arc's own "P2P Ontology Engine Boundary"
section forbids: letting an unreviewed projection layer become an
implicit second source of truth for canonical post state before the
FIRST source of truth (this Arc's own Repository) even has a durable
backing store.

## 6. What this Stage does NOT do

- Does **not** modify `fedos_board_repository.ts`,
  `in_memory_fedos_board_repository.ts`, `fedos_board_source_index.ts`,
  `fedos_board_index.ts`, `fedos_board_service.ts`, or
  `fedos_board_feed.ts` beyond what Alpha 302–308 already landed — no
  further production code change.
- Does **not** implement persistence, a `p2p`/Ontology projection, or a
  GUI.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`,
  `src/runtime/*`, `src/desktop/*`, `src/identity/*`, `src/worker.ts`,
  any of the four Board Adapters, Storage, Observation, Relay transport,
  Nostr validation, or `p2p/`.

## 7. See also

- `docs/secure_runtime_alpha_309_four_protocol_board_integration.md`
- `docs/secure_runtime_alpha_308_chronological_board_feed.md`
- `docs/secure_runtime_alpha_307_board_application_service.md`
- `docs/secure_runtime_alpha_306_thread_integrity_boundary.md`
- `docs/secure_runtime_alpha_305_board_thread_index.md`
- `docs/secure_runtime_alpha_304_board_source_index.md`
- `docs/secure_runtime_alpha_303_in_memory_board_repository.md`
- `docs/secure_runtime_alpha_302_board_repository_contract.md`
- `docs/secure_runtime_alpha_301_existing_board_repository_inventory.md`
- `docs/secure_runtime_alpha_300_session_board_adapter_completion.md`
