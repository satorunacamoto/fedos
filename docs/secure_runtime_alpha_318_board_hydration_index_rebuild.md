# Secure Runtime Alpha 318 — Board Hydration and Index Rebuild

**Status: this Stage IMPLEMENTS. It adds exactly one new file,
`src/board/persistence/fedos_board_hydration.ts`.** Stage 8 of the
Alpha 311–320 Canonical Board Persistence Boundary Arc.

## 1. Why now

Alpha 315–317 built a persistence port, an in-memory backend, and a
persistence-backed Repository adapter. This Stage answers the question
none of those three answer alone: given ONLY a `FedosBoardPersistence`
(possibly populated across many prior, out-of-order writes), how does
the application get back a fully-populated, fast, IN-MEMORY
`FedosBoardService` — Repository, Source Index, and Board/Thread Index
all rebuilt and mutually consistent — ready to serve `FedosBoardFeed`
queries?

## 2. The shape

```ts
export type FedosBoardHydrationOutcome =
  | "hydrated"
  | "rejected-corrupt-record"
  | "rejected-unresolvable-thread-integrity";

export interface FedosBoardHydrationResult {
  readonly outcome: FedosBoardHydrationOutcome;
  readonly service: FedosBoardService | null;
  readonly registeredCount: number;
  readonly corruptRecordCount: number;
  readonly unresolvedCount: number;
}

export function hydrateFedosBoardService(
  persistence: FedosBoardPersistence,
): FedosBoardHydrationResult
```

## 3. The target is a plain, fresh, IN-MEMORY `FedosBoardService` — never
a persistence-backed one

`hydrateFedosBoardService` constructs `new FedosBoardService()` using
its OWN DEFAULT components — `InMemoryFedosBoardRepository`,
`FedosBoardSourceIndex`, `FedosBoardIndex` (all from Alpha 301–310,
UNMODIFIED) — never a `PersistedFedosBoardRepository` (Alpha 317). This
is deliberate: hydration's whole PURPOSE is to load persisted data BACK
INTO the fast, in-memory structures the application actually queries at
runtime; wiring the resulting service to keep reading through the
persistence layer would defeat that purpose entirely, turning every
`listBoardPosts`/`listThreadPosts` call into a persistence read.

## 4. Required flow, confirmed step by step

```
Persistence.listPosts()
        |
        v
deserializeFedosBoardPost() on EVERY record   (Alpha 314, reuses
        |                                       validateFedosBoardPost,
        |                                       Alpha 257, unmodified)
        v
ANY record fails to deserialize?  --------->  outcome: "rejected-corrupt-record"
        | no                                   service: null (§5)
        v
new FedosBoardService()   (Alpha 307, unmodified default components)
        |
        v
registerPost() each post, roots first, then    (§6 -- Source Index and
replies in dependency order                     Board/Thread Index are
        |                                        rebuilt AUTOMATICALLY
        |                                        as a side effect of
        |                                        FedosBoardService's own
        |                                        UNMODIFIED coordination
        |                                        logic, Alpha 307 --
        |                                        this Stage adds NO
        |                                        separate index-rebuild
        |                                        code of any kind)
        v
ANY post unresolvable?  ------------------->  outcome: "rejected-unresolvable-thread-integrity"
        | no                                   service: null (§5)
        v
outcome: "hydrated", service: <ready>
```

**No persisted index snapshots** — confirmed: this file never reads or
writes anything index-shaped; `Source Index rebuild`/`Board/Thread Index
rebuild` in the flow above happen ENTIRELY as a side effect of calling
the SAME `FedosBoardService.registerPost` (Alpha 307) every other caller
already uses — this Stage reuses it, never reimplements it.

## 5. No partial service returned on corruption under strict policy —
extended to unresolvable thread integrity too

This Arc's own instruction requires "no partial service returned on
corruption under strict policy." This Stage applies the IDENTICAL
strictness to BOTH failure classes this file can encounter:

- **Any corrupt/unrecognized-schema record** (`deserializeFedosBoardPost`
  returns `null` for at least one persisted record) → the ENTIRE
  hydration is rejected (`service: null`), even if every OTHER record
  would have deserialized cleanly. Matches `PersistedFedosBoardRepository
  .listPosts()`'s own Option B policy (Alpha 317 §5) — the SAME
  "any corruption voids the whole read" discipline, applied at
  hydration time instead of query time.
- **Any post left unresolvable after the topological pass converges**
  (§6) → the ENTIRE hydration is rejected (`service: null`) too — even a
  single genuinely-inconsistent persisted set (e.g. a reply whose
  claimed parent can never become available, or a cross-post conflict
  the persisted set should never have contained under normal operation)
  voids the whole hydration, rather than silently serving an
  incomplete board.

## 6. Hydration ordering — a bounded, deterministic topological pass

Per this Arc's own required ordering:

```
1. roots
2. replies whose parents are available
3. repeat only if bounded and justified
```

Implemented as:

1. Sort ALL deserialized posts by `id` ascending — a fixed,
   deterministic order INDEPENDENT of `persistence.listPosts()`'s own
   (insertion-history-dependent) iteration order. **Order-independent
   hydration** is achieved this way: two persistence backends holding
   the SAME set of posts, populated in DIFFERENT historical orders,
   hydrate identically.
2. Partition into roots (`replyTo === null`) and replies (`replyTo !==
   null`). Register every root first — **"root posts may need
   registration before replies"** is handled exactly this way, always,
   not merely "considered."
3. Repeatedly pass over the remaining replies, registering any whose
   parent has become available (`FedosBoardService.registerPost`
   returns `"inserted"`/`"already-present"`) and re-queueing any still
   rejected specifically as `"missing-parent"`. A reply rejected for ANY
   OTHER reason (`"invalid-thread"`, `"cross-board-reply"`,
   `"post-id-conflict"`, `"source-conflict"`) is NEVER re-queued — it
   indicates a genuine, unfixable inconsistency in the persisted set,
   not a temporary ordering problem.
4. The pass terminates the moment a FULL sweep over the remaining
   replies makes ZERO progress — this is the BOUND: each iteration
   either registers at least one more post (bounded by the total number
   of replies) or the loop exits immediately. **No unbounded retry** —
   confirmed by construction: the loop's own termination condition
   guarantees at most `|replies|` iterations, never an open-ended retry
   count.
5. **"Preferred simpler candidate: reject a persisted set whose parent
   ordering/integrity cannot be resolved by a deterministic topological
   pass."** Adopted exactly: anything still unresolved once the pass
   converges (§4) contributes to `unresolvedCount`, which triggers the
   whole-hydration rejection named in §5 — no partial acceptance, no
   guessing at a "best effort" partial thread.

## 7. No network, no Relay, no ontology inference, no background task

Confirmed structurally: this file's only imports are
`FedosBoardService` (Alpha 307), `FedosBoardPersistence` (Alpha 315),
`deserializeFedosBoardPost` (Alpha 314), and `FedosBoardPost` (Alpha
255) — no `fetch`, no `WebSocket`, no reference to `p2p/`, no
`setTimeout`/`setInterval`/async function of any kind. Hydration is a
single, synchronous, in-memory pass.

## 8. See also

- `docs/secure_runtime_alpha_317_persisted_board_repository.md`
- `docs/secure_runtime_alpha_307_board_application_service.md`
- `docs/secure_runtime_alpha_306_thread_integrity_boundary.md`
- `docs/secure_runtime_alpha_314_board_serialization_boundary.md`
- `docs/secure_runtime_alpha_319_four_protocol_persistence_verification.md`
