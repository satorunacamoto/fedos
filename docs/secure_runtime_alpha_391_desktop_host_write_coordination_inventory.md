# Secure Runtime Alpha 391 — Existing Write Flow Inventory

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** This is Stage 1, the opening Stage, of the Alpha 391–400
Desktop Host Durable Write Coordination Arc.

## 1. Why now

Alpha 390 closed the Canonical Board Query Host Integration Arc with
one honestly-named, deliberately-unsolved gap (§4 of that Stage's own
completion doc): `host.board()?.registerPost(post)` mutates
`FedosBoardService`'s in-memory Repository, but `FedosBoardPersistence`
never learns about the write. This Stage inventories the actual
current write responsibilities of every file this Arc's Objective
names, by direct inspection, before any design decision is made.

## 2. `FedosDesktopHost` (`src/desktop/host/fedos_desktop_host.ts`)

Confirmed unchanged since Alpha 385 (Arc 381–390). Exposes exactly six
public methods plus the constructor: `state()`, `start()`, `stop()`,
`desktop()`, `board()`, `query()`. `board()` returns the live
`FedosBoardService` while `state() === "ready"`; its own doc comment
(§"stop()/desktop()/board()/query()") names `board()` as "the
canonical WRITE boundary (`registerPost()`/`findPost()`)". No
`submitPost()`, no write-coordination method of any kind exists today.
`#boardPersistence` is held as a `readonly` private field, passed to
`hydrateFedosBoardService()` during `start()`, and NEVER referenced
again afterward — confirmed by direct inspection, zero other read of
`#boardPersistence` anywhere in the file.

## 3. `FedosBoardRepository` (`src/board/repository/fedos_board_repository.ts`)

Confirmed unchanged since Alpha 302. The frozen contract:
`register()`/`findPost()`/`listPosts()`, synchronous, protocol-neutral.
Its own header still states "MUST NOT be redesigned" nowhere literally,
but Alpha 317's own header describes it as "the ALREADY-FROZEN
`FedosBoardRepository` contract". This Arc's Objective does not name
this file as one requiring a signature change, and direct inspection
confirms no write-coordination gap exists AT this layer specifically —
the gap is ONE LAYER UP, at `FedosBoardService`, which owns exactly one
concrete `FedosBoardRepository` (an `InMemoryFedosBoardRepository`,
via `hydrateFedosBoardService()`'s own unmodified default) and never a
persistence-backed one.

## 4. `PersistedFedosBoardRepository` (`src/board/persistence/persisted_fedos_board_repository.ts`)

Confirmed unchanged since Alpha 317. Bridges `FedosBoardPersistence` to
the `FedosBoardRepository` contract — `register()` calls
`this.#persistence.putPost()` directly. Confirmed, by direct search,
**zero construction site** anywhere in `src/` — this class exists,
compiles, and is exercised only by its own Alpha 317 test file. It is
NOT the repository `FedosBoardService` uses (that is always
`InMemoryFedosBoardRepository`, per `hydrateFedosBoardService()`'s own
`new FedosBoardService()` call with no repository argument). This
confirms `PersistedFedosBoardRepository` is NOT part of the Host's
actual write path today, despite its name suggesting it should be.

## 5. `FedosBoardPersistence` (`src/board/persistence/fedos_board_persistence.ts`)

Confirmed unchanged since Alpha 315. The frozen, synchronous port:
`putPost()`/`getPost()`/`listPosts()`. `AppendOnlyFedosBoardPersistence`
(Alpha 353) is the one real durable implementation; it has **no delete
method** — confirmed by direct inspection of the port itself (Alpha
315 §"No `delete` method — deliberately excluded this Arc"). This fact
is load-bearing for this Arc's own ordering decision (Alpha 393):
anything written here can never be un-written.

## 6. `FedosBoardQuery` (`src/board/query/fedos_board_query.ts`)

Confirmed unchanged since Alpha 385. Constructed once, in
`FedosDesktopHost.start()`, over the SAME `FedosBoardService` instance
`#boardService` holds. `recentFeed()`/`thread()` read
`#source.listBoardPosts()`/`#source.listThreadPosts()` — both delegate
to `FedosBoardService`'s own live in-memory Board/Thread Index. This
confirms (again, directly) Alpha 389 §12's own finding: any post
registered into `#boardService` is visible via `query()` IMMEDIATELY,
with no separate step — this Arc does not need to invent Query
visibility; it already exists as a structural consequence of Query and
write both operating on the same live object.

## 7. The exact write responsibility gap, restated precisely

Today, exactly ONE path exists to register a new post into a ready
Host: `host.board()!.registerPost(post)`. This path:

1. Runs `FedosBoardService`'s own thread-integrity and source-conflict
   pre-checks (pure reads).
2. Writes into `InMemoryFedosBoardRepository` (in-memory ONLY).
3. Writes into `FedosBoardSourceIndex`/`FedosBoardIndex` (in-memory
   ONLY).
4. Returns a `FedosBoardRegistrationResult` token.

At NO point does `#boardPersistence` — the object `hydrateFedosBoardService()`
itself was constructed from at `start()` — receive this post. A
process restart replays ONLY what `#boardPersistence.listPosts()`
returns; a post written via `board().registerPost()` and never
independently written to `#boardPersistence` is gone forever the
moment the process exits. This is not a new finding — Alpha 367 first
confirmed it (Arc 361–370), Alpha 389/390 re-confirmed it at the Host
layer — but this Stage is the first to name EXACTLY which write, at
which of the five layers, must change.

## 8. What must NOT change

- `FedosBoardRepository`'s own frozen contract (§3) — zero signature
  change.
- `FedosBoardPersistence`'s own frozen contract (§5) — zero signature
  change, no `delete` method added.
- `FedosBoardQuery` (§6) — zero change; visibility is already free.
- `board()`'s own existing signature and behavior — Alpha 390 §3
  already confirms `board()` "remains completely UNCHANGED" is this
  Arc's own inherited constraint, restated here: adding a NEW write
  boundary does not require removing or altering the old one.

## 9. Conclusion

The write-responsibility gap is precisely located: `FedosBoardService`
(reached via `host.board()`) mutates in-memory state only; nothing in
the current call graph ever reaches `FedosBoardPersistence.putPost()`
during a live write. `PersistedFedosBoardRepository` (§4) already
solves the BRIDGING problem in isolation but has no caller. Closing the
gap requires exactly one new coordinating write path that touches
BOTH `FedosBoardPersistence` and `FedosBoardService`'s own Repository
in the correct order — Alpha 392 decides WHERE that coordination lives.

## 10. See also

- `docs/secure_runtime_alpha_390_host_query_integration_completion.md`
- `docs/secure_runtime_alpha_389_four_protocol_host_query_verification.md`
- `docs/secure_runtime_alpha_367_host_restart_verification.md`
- `docs/secure_runtime_alpha_317_persisted_board_repository.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`
