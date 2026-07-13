# Secure Runtime Alpha 320 — Canonical Board Persistence Boundary Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha 311–320
Canonical Board Persistence Boundary Arc.**

## 1. Why now

Alpha 311 inventoried and confirmed no Board persistence existed (and
confirmed exactly why Secure Runtime ciphertext storage, `D1MetadataIndex`,
and `p2p/` are all the wrong layer); Alpha 312 adopted Option A against
fifteen evaluation criteria; Alpha 313–314 fixed the persisted record
shape and its codec; Alpha 315–316 built the backend-neutral port and
its in-memory implementation; Alpha 317 bridged persistence to the
already-frozen `FedosBoardRepository` contract; Alpha 318 built
deterministic hydration; Alpha 319 verified the whole stack against all
four real, unmodified Board Adapters. This Stage issues the Arc's own
closing Completion Declaration.

## 2. The architecture, frozen

```
FedosBoardPost   (Canonical Board Model, Alpha 251-260, unmodified)
        |
        v
serializeFedosBoardPost()  (Alpha 314)
        |
        v
FedosPersistedBoardPostRecordV1   (Alpha 313, schemaVersion: 1,
        |                          plain serializable data only)
        v
FedosBoardPersistence.putPost()   (Alpha 315, backend-neutral port)
        |         "inserted" / "already-present" / "conflict" / "failed"
        v
InMemoryFedosBoardPersistence   (Alpha 316, this Arc's only backend)

        |  (read path)
        v
deserializeFedosBoardPost()   (Alpha 314, reuses validateFedosBoardPost,
        |                      Alpha 257, unmodified; fails closed to
        |                      null on any corrupt/unrecognized record)
        v
PersistedFedosBoardRepository   (Alpha 317, implements the frozen
        |                        FedosBoardRepository contract, Alpha
        |                        302, unmodified)

        |  (application startup)
        v
hydrateFedosBoardService()   (Alpha 318, bounded deterministic
        |                     topological pass: roots first, then
        |                     replies as parents become available;
        |                     rebuilds a FRESH in-memory
        |                     FedosBoardService, Alpha 307, unmodified
        |                     -- Source/Board/Thread Index rebuilt
        |                     entirely as a side effect)
        v
FedosBoardService (in-memory) -> FedosBoardFeed.listRecentPosts()
                                   (Alpha 308, unmodified)

-- verified end-to-end against all four real, unmodified Board
   Adapters: round-trip equality, provenance/author preservation,
   thread grouping preservation, feed-order preservation, idempotent
   writes, ID/source conflict detection surviving hydration, corrupt-
   record rejection, p2p/ untouched (Alpha 319) --
```

Zero new Rust code, zero new Cargo dependency, zero new npm dependency —
`package.json`'s own `dependencies` count stays fixed at 2, unchanged
across this whole Arc.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE. The protocol-independent
persistence boundary for the Canonical Board Application now exists: a
V1 persisted record shape, a deterministic fail-closed codec, a
backend-neutral persistence port, an in-memory implementation, a
persistence-backed Repository adapter satisfying the already-frozen
`FedosBoardRepository` contract without modifying it, and a bounded
deterministic hydration algorithm that rebuilds a fully-consistent
in-memory `FedosBoardService` — all without choosing or implementing any
real durable backend, and without touching `p2p/`, Secure Runtime
Storage, or any of the four Protocol Adapters.**

The following are now declared complete, exactly as this Arc's own
instruction requires:

- **Board persistence responsibility boundary** — Alpha 312, Option A
  adopted against all fifteen required evaluation criteria; Options B–E
  explicitly rejected, including the two this Arc's own instruction
  names by name (Secure Runtime Storage as an arbitrary object store;
  Ontology Engine as canonical storage; Feed/Index snapshots as
  authoritative state).
- **V1 persisted post schema** — Alpha 313,
  `FedosPersistedBoardPostRecordV1`, plain serializable data only, no
  branded-type leakage, moderation persistence deliberately deferred.
- **Deterministic serialization** — Alpha 314, `serializeFedosBoardPost`,
  a straight deep field copy, no JSON step hidden inside it.
- **Fail-closed deserialization** — Alpha 314, `deserializeFedosBoardPost`,
  exact `schemaVersion` check, unknown top-level AND nested fields
  rejected, `validateFedosBoardPost` (Alpha 257) reused on every read.
- **Backend-neutral persistence port** — Alpha 315,
  `FedosBoardPersistence`, no `delete` this Arc, a documented future
  async-port strategy that avoids silently mutating this contract.
- **In-memory persistence backend** — Alpha 316,
  `InMemoryFedosBoardPersistence`, structurally distinct from
  `InMemoryFedosBoardRepository` (persisted records vs. validated
  application objects), the identical `"inserted"`/`"already-present"`/
  `"conflict"` discipline.
- **Persistence-backed Board Repository** — Alpha 317,
  `PersistedFedosBoardRepository`, satisfying the frozen
  `FedosBoardRepository` contract unmodified, Option B strict
  `listPosts()` plus an Option C diagnostic supplement.
- **Hydration** — Alpha 318, `hydrateFedosBoardService`, a bounded
  topological pass with a proven termination bound, no partial service
  on corruption or unresolvable thread integrity.
- **Source/board/thread index rebuild** — Alpha 318 §3/§4, achieved
  entirely as a side effect of `FedosBoardService.registerPost` (Alpha
  307, unmodified) — no separate index-rebuild code exists anywhere.
- **Feed rebuild** — confirmed via `FedosBoardFeed` (Alpha 308,
  unmodified) operating identically against a hydrated service.
- **Four-protocol round-trip verification** — Alpha 319, all four real
  adapters' output survives serialization, persistence, and hydration
  with canonical equality, provenance, author identity, thread grouping,
  and feed order all preserved.

## 4. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- Real durable backend, SQLite, D1, IndexedDB, filesystem — no such
  code exists anywhere in `src/board/persistence/`.
- Encryption at rest — no cryptographic operation of any kind is
  performed anywhere in `src/board/persistence/`.
- Database migration execution — no migration-application code exists;
  `deserializeFedosBoardPost` only ever REJECTS an unrecognized
  `schemaVersion`, never attempts to upgrade one.
- Moderation persistence, delete/tombstone persistence — no such record
  shape or write path exists (Alpha 313 §5).
- Search, full-text index — `FedosBoardPersistence` exposes
  `putPost`/`getPost`/`listPosts` only, no query method of any kind.
- Ontology projection, P2P synchronization — no reference to `p2p/`
  anywhere in `src/board/persistence/`; `p2p/` remains completely
  untouched (confirmed by `git status`/`git diff`, not merely by absence
  of import).
- Relay Pool, GUI — untouched; `src/desktop/*`/`src/render/*` carry
  zero reference to `src/board/persistence/`.

## 5. Next Arc recommendation

**Board Durable Backend Selection & Review Arc.**

Reason (verbatim from this Arc's own required recommendation): this Arc
deliberately introduced "a persistence SEAM only" — `FedosBoardPersistence`
(Alpha 315) is backend-neutral BY DESIGN specifically so backend
selection could be deferred to its own, properly-scoped Arc rather than
improvised here. That future Arc must COMPARE, not merely pick:

- **SQLite** — a real embedded relational database; would need its own
  schema-migration story building on (not replacing) this Arc's own
  `schemaVersion` discipline (Alpha 313).
- **IndexedDB** — browser-native; relevant if a browser deployment
  target is in scope; async by nature, requiring the SEPARATE async
  port this Arc already named (Alpha 315 §6), never a silent mutation
  of the synchronous one.
- **D1** — Cloudflare's managed SQLite; this repository already has ONE
  real, working D1 integration (`D1MetadataIndex`, Alpha 311 §3.7) to
  learn deployment/binding lessons from, though that integration solves
  a DIFFERENT (non-authoritative index) problem and is not itself
  reused for canonical persistence.
- **Append-only file** — the simplest possible durable option, worth
  comparing for its own recovery/corruption-detection properties against
  the other three.
- **Other repository-supported options** — the future Arc's own scope to
  name, not preempted here.

**The Ontology Engine (`p2p/`) must NOT be recommended as a storage
backend** — this Arc's own instruction states this directly, and Alpha
312's own evaluation (§3, "Ontology separation" row) already showed WHY:
treating a separate, semantically-distinct repository as canonical
storage would violate the "P2P Ontology Engine Boundary" this Arc (and
Alpha 301–310 before it) has consistently upheld. **A durable backend
must not be implemented until selection is complete** — this Arc ships
the seam, deliberately not the choice.

## 6. What this Stage does NOT do

- Does **not** modify `fedos_persisted_board_post_v1.ts`,
  `fedos_board_post_codec.ts`, `fedos_board_persistence.ts`,
  `in_memory_fedos_board_persistence.ts`,
  `persisted_fedos_board_repository.ts`, or `fedos_board_hydration.ts`
  beyond what Alpha 313–318 already landed — no further production code
  change.
- Does **not** implement a durable backend, an Ontology projection, or a
  GUI.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs`, `Cargo.toml`,
  `src/runtime/*`, `src/desktop/*`, `src/identity/*`, `src/worker.ts`,
  any of the four Board Adapters, `src/board/repository/*`, Secure
  Runtime Storage, Observation, Relay transport, Nostr validation, or
  `p2p/`.

## 7. See also

- `docs/secure_runtime_alpha_319_four_protocol_persistence_verification.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
- `docs/secure_runtime_alpha_317_persisted_board_repository.md`
- `docs/secure_runtime_alpha_316_in_memory_board_persistence.md`
- `docs/secure_runtime_alpha_315_board_persistence_port.md`
- `docs/secure_runtime_alpha_314_board_serialization_boundary.md`
- `docs/secure_runtime_alpha_313_persisted_board_record_v1.md`
- `docs/secure_runtime_alpha_312_board_persistence_responsibility_decision.md`
- `docs/secure_runtime_alpha_311_existing_board_persistence_inventory.md`
- `docs/secure_runtime_alpha_310_board_repository_completion.md`
