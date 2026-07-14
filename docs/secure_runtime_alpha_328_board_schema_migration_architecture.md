# Secure Runtime Alpha 328 — Board Schema and Migration Architecture

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind and implements NO migration.** Stage 8 of the Alpha 321–330 Board
Durable Backend Selection & Architecture Arc.

## 1. Why now

Alpha 327 adopted "defer backend choice" (Option E) as the strategy.
Before that deferral is finalized (Alpha 329), this Stage freezes HOW
schema and migration responsibility will be structured once a backend
IS chosen — so the eventual choice inherits a fixed architecture rather
than improvising one per backend.

## 2. Frozen decisions

- **`FedosPersistedBoardPostRecordV1` remains the application wire
  schema**, regardless of physical backend (Alpha 313, unmodified).
- **Physical storage schema may differ from the wire schema**, but MUST
  round-trip byte-for-byte equivalent to
  `FedosPersistedBoardPostRecordV1` when read back through the
  persistence port — exactly the guarantee
  `serializeFedosBoardPost`/`deserializeFedosBoardPost` already provide
  (Alpha 314) and that guarantee MUST survive any future backend
  swap unchanged.
- **Migrations are explicit and versioned.** A future `schemaVersion: 2`
  would require an explicit, reviewed migration path — never inferred.
- **Unknown schema versions fail closed.** Already true today:
  `deserializeFedosBoardPost`'s exact `schemaVersion` check (Alpha 314)
  rejects anything but the literal `1`. Every future backend MUST
  preserve this — a backend must never "helpfully" coerce an unknown
  version into a known one.
- **No silent migration.** A migration, once one exists, must be an
  explicit, logged, reviewable operation — never a side effect of a
  normal read/write path.
- **No destructive overwrite.** A migration must never overwrite
  original records in place without a prior backup step succeeding
  first.
- **Backup before destructive migration.** Any migration that rewrites
  stored records in place MUST be preceded by a verified backup/export
  step (Alpha 322 §2, "backup feasibility" is a MUST for exactly this
  reason).
- **Indexes remain rebuildable.** Source/Board/Thread Index are already
  a pure function of replaying persisted records
  (`FedosBoardService.registerPost`, Alpha 318 §3/§4) — no future
  backend may make itself the sole owner of index state; a full index
  rebuild from stored records must always remain possible.
- **Feed order remains derived.** `FedosBoardFeed.listRecentPosts`
  (Alpha 308) computes order from the in-memory service after
  hydration — no backend may cache or pre-compute feed order as its own
  authoritative structure.
- **Source index remains rebuildable.** Same reasoning as Board/Thread
  Index — `FedosBoardSourceIndex` (Alpha 304) is rebuilt entirely via
  `registerPost` replay, never backend-owned.
- **Ontology projection remains rebuildable.** Per this Arc's own Future
  Relationship diagram (`Durable Canonical Board State → Board Ontology
  Projection Adapter → P2P Ontology Engine`): whatever future adapter
  reads durable Board state must treat it as a pure, rebuildable
  projection source — never itself a place migrations or writes
  originate from.

## 3. Migration ownership

Three ownership models were named for comparison:

- **A. Backend implementation owns migrations.** Rejected: would let
  each future backend (SQLite/D1/IndexedDB/file) invent its own
  `schemaVersion` check independently, risking silent divergence between
  backends — exactly the kind of duplicated authority Alpha 322 §2's
  "no protocol-specific logic"/"no ontology coupling" MUSTs already warn
  against by analogy (logic that should live in ONE neutral layer
  leaking into per-backend implementations).
- **B. Board persistence layer owns migrations.** **Adopted.** The
  `schemaVersion` check and fail-closed behavior already live one layer
  ABOVE any physical backend, inside `fedos_board_post_codec.ts`
  (Alpha 314) — a backend-neutral module every future backend sits
  BELOW. Extending this SAME layer to own any future migration transform
  keeps exactly one place responsible for "is this record's schema
  acceptable, and if not, how does it become acceptable" — never
  duplicated per backend.
- **C. Separate migration coordinator.** Rejected FOR NOW as premature
  abstraction: with exactly one `schemaVersion` (`1`) in existence and
  nothing yet to migrate FROM, a dedicated coordinator module has no
  real logic to coordinate. Revisit only once a SECOND `schemaVersion`
  genuinely exists — introducing the module before then would violate
  the same "don't design for hypothetical future requirements" discipline
  this Arc's own instruction already applies to backend selection itself.

## 4. How each backend would express the same migration contract

- **SQLite** — a `schema_version` column or `PRAGMA user_version` may
  exist at the physical level, but the AUTHORITATIVE `schemaVersion`
  check still happens in the persistence layer (§3B), never trusted to
  SQLite's own PRAGMA alone.
- **D1** — identical shape: `schemaVersion` maps to an ordinary SQL
  column, checked by the persistence layer on read, not enforced via a
  SQL constraint as the sole guard.
- **IndexedDB** — the object-store's own DB-version integer
  (`onupgradeneeded`) governs PHYSICAL object-store shape changes only;
  it is a DIFFERENT number from the wire record's `schemaVersion` field
  and the two must never be conflated (Alpha 324 §2 already flags this
  distinction).
- **Append-only file** — each frame carries the record's own
  `schemaVersion` field; a separate, lower-level FILE-FORMAT version
  (e.g. a frame-header magic byte) would be its own, distinct concern
  from the wire record's `schemaVersion` — the persistence layer, not
  the raw file reader, decides whether a given record's `schemaVersion`
  is acceptable.

## 5. Conclusion

Regardless of which candidate a future Arc selects, `schemaVersion`
authority stays fixed in the persistence layer (Option B), the wire
schema stays `FedosPersistedBoardPostRecordV1`, and every rebuildable
structure (Source/Board/Thread Index, Feed, Ontology projection) stays
a pure function of stored records — no backend, once chosen, may
quietly become authoritative over any of these.

## 6. See also

- `docs/secure_runtime_alpha_313_persisted_board_record_v1.md`
- `docs/secure_runtime_alpha_314_board_serialization_boundary.md`
- `docs/secure_runtime_alpha_318_board_hydration_index_rebuild.md`
- `docs/secure_runtime_alpha_327_multi_environment_backend_strategy.md`
