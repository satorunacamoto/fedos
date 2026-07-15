# Secure Runtime Alpha 542 — Whole-Stack Dependency Graph

Stage 2 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only. Extends the prior review's own Alpha 489 audit (Outbox/
Publisher/Observation/Scheduler only) to include Board/Persistence/
Query/Repository/Host.

## Graph

```
Board core (fedos_board_post.ts, identifiers, author, source, moderation)
   ^ (no outgoing edge except to itself)
   |
   +-- FedosBoardRepository (contract, Alpha 302)
   |      ^
   |      +-- InMemoryFedosBoardRepository (Alpha 303) -- WIRED (default of FedosBoardService)
   |      +-- PersistedFedosBoardRepository (Alpha 317) -- BUILT, NEVER WIRED (Alpha 555)
   |
   +-- FedosBoardSourceIndex / FedosBoardIndex (Alpha 304/305)
   |
   +-- FedosBoardService (implements FedosBoardReader)
   |      -- depends on: FedosBoardRepository (default: in-memory), SourceIndex, BoardIndex
   |      ^
   |      +-- FedosBoardServiceReader (wraps ANY FedosBoardReader, Alpha 403)
   |
   +-- FedosBoardPersistence (contract, Alpha 315)
          ^
          +-- InMemoryFedosBoardPersistence (Alpha 316)
          +-- AppendOnlyFedosBoardPersistence (Alpha ~319)
                 ^
                 |
          hydrateFedosBoardService(persistence) -- Alpha 318
                 -- reads Persistence, constructs a FRESH FedosBoardService
                    (DEFAULT in-memory Repository -- never PersistedFedosBoardRepository)
                 ^
                 |
          FedosBoardQuery (Alpha 373-376) -- constructed FROM hydration.service
                 ^
                 |
          FedosDesktopHost -- constructs FedosBoardQuery itself, holds
          #boardPersistence + #boardService + #boardQuery + #boardReader,
          owns #outboxPersistence (FedosBoardOutboxPersistence, Alpha 417)
                 |
                 v
          Outbox (types/codec/persistence, Alpha 411-420)
          -- depends on Board core (FedosBoardPostId) ONLY
                 ^        ^                    ^
                 |        |                    |
      Generic Publisher  Outbox Observation   FedosPublishScheduler
      (Alpha 473)         (Alpha 475)          -- depends on Outbox persistence/
      -- Outbox codec                          codec/Publisher/Observation,
      only                                      ALL siblings under src/board/outbox/

   Nostr-specific Publisher (src/board/publish/nostr/*, Alpha 451-460)
   -- depends on Outbox TYPES, Desktop (FedosRelay, FedosNostrWireEvent) --
      Desktop depends on Runtime -> WASM -> Rust (Alpha 431-450, untouched)

   FedosDeliveryObservation (src/board/observation/*, Alpha 461-470)
   -- an ISLAND, zero incoming/outgoing edges to anything above (re-confirmed, Alpha 550)
```

## New findings versus the prior Alpha 489 audit

1. **`FedosBoardRepository` has TWO implementations, only one reachable
   from any real construction path.** `InMemoryFedosBoardRepository` is
   the ONLY one `FedosBoardService`'s own default constructor argument
   ever resolves to, and `hydrateFedosBoardService` always constructs
   `FedosBoardService` with ZERO arguments (`fedos_board_hydration.ts:124`)
   — so `PersistedFedosBoardRepository` has NO live edge into the graph
   at all, despite implementing the same contract. See Alpha 555 for
   the full analysis.
2. **Board core has no outgoing edge to anything** — confirmed
   (`fedos_board_post.ts` imports only sibling Board-core files) —
   matching the SAME "no outgoing edge except Board core" pattern the
   Outbox layer already has (prior review's own Alpha 489 finding),
   extended one layer up.
3. **`FedosDesktopHost` is the ONE node in this entire graph with the
   highest in-degree from "real, owned, non-optional" dependencies**
   (`DesktopApplication`, `FedosBoardPersistence`, `FedosBoardOutboxPersistence`)
   — and, per Alpha 541, the ONE node with ZERO incoming edges from any
   production caller. It is both the top of the OWNED graph and a dead
   end from the PRODUCTION-REACHABILITY graph — two different graphs
   this Stage deliberately distinguishes, since "who Host depends on"
   and "who depends on Host" answer different questions.

## No cycle found

Re-confirmed, extending Alpha 489's own method (import-direction
inspection) to every file table §1 of Alpha 541 names: no file anywhere
in the reviewed nine systems imports, directly or transitively, a file
that (transitively) imports it back. `test/secure_runtime_alpha_542_...test.ts`
mechanically re-confirms the specific edges/non-edges listed above.

## See also

- `docs/secure_runtime_alpha_489_publish_pipeline_boundary_dependency_audit.md`
- `docs/secure_runtime_alpha_555_publish_runtime_unnecessary_repository_review.md`
