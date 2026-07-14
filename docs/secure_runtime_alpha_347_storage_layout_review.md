# Secure Runtime Alpha 347 — Storage Layout Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind. No implementation. No filesystem API of any kind is called by
this Stage.** Stage 7 of the Alpha 341–350 Board Durable Backend
Re-evaluation & Local Backend Selection Arc.

## 1. Why now

Alpha 344/346 both assume a durable backend eventually needs SOME
on-disk location for its data. This Stage reviews a NAME-level
directory layout a future implementation could adopt — deliberately
NOT deciding an actual path, since Alpha 338 §5 already named "how a
future entry point sources configuration" (including a data
directory) as unresolved, and this Arc does not resolve it either.

## 2. Proposed layout (names only, not implemented)

```
<host-data-dir>/
  board/
    posts/          -- the durable record log/database file(s)
    metadata/        -- schemaVersion, backend identifier, migration state
    snapshots/        -- future compaction output (Alpha 344 §6), if ever built
    tmp/               -- future atomic-write staging area, if ever needed
```

- **`board/`** — a single top-level namespace, matching this
  repository's own convention of naming subsystems after the concept
  they own (`src/board/`, `src/identity/`, `src/runtime/`) rather than
  the technology behind them — `board/` says nothing about SQLite vs.
  append-only, deliberately, so switching backends (Alpha 346) never
  implies renaming the directory.
- **`posts/`** — where `FedosPersistedBoardPostRecordV1` records
  physically live, regardless of backend: one SQLite file, or one (or
  several, if ever segmented) append-only log file.
- **`metadata/`** — separate from `posts/` so a future migration step
  (Alpha 346) can read/write backend-identification and
  migration-progress state WITHOUT touching the record data itself,
  and so a corrupt metadata file can never be conflated with a corrupt
  record (Alpha 344 §4's own corruption-shape distinction, extended
  one level up).
- **`snapshots/`** — reserved, unused until a compaction strategy
  (Alpha 344 §6) is actually designed; named here only so a future
  Stage has an obvious place to put compaction OUTPUT without
  colliding with `posts/`.
- **`tmp/`** — reserved for a possible future atomic-write pattern
  (write to a temp file, then rename over the target) — NOT decided or
  required by this Stage; named only so the layout does not need
  retrofitting if a future Stage adopts that pattern.

## 3. What this Stage explicitly does NOT decide

- The actual filesystem ROOT (`<host-data-dir>`) — whether it is a
  fixed relative path, an OS-conventional app-data directory, or an
  explicitly-configured location, is Alpha 338 §5's own still-open
  "configuration sourcing" question, unresolved by this Arc.
- Whether `snapshots/`/`tmp/` are ever built at all — they are named
  for FUTURE reservation only, not committed future work.
- Any actual `node:fs`/`node:path` call — none exists anywhere in this
  Stage's own deliverables (a doc and a test, per this Arc's own
  Expected Deliverables).
- File permissions, encryption at rest, or any Secure Runtime Storage
  integration — all explicitly out of this Arc's own scope
  (unchanged from Alpha 322 §"NOT YET": "encryption at rest").

## 4. Why a layout review matters even without implementation

Reviewing directory SHAPE now — without committing to a path or
writing any code — lets Alpha 349's own backend selection proceed
without a hidden assumption that "append-only" or "SQLite" implies a
particular filesystem shape neither actually requires. Both candidate
backends (Alpha 343/344) fit the SAME `board/posts/` + `board/metadata/`
shape equally well: SQLite would put one file under `posts/`;
append-only would put one (or several) log files there instead. The
layout is backend-agnostic BY DESIGN, mirroring `FedosBoardPersistence`
itself (Alpha 342 §2).

## 5. Conclusion

A proposed, backend-agnostic, four-directory layout is reviewed and
named for future reference — `board/posts/`, `board/metadata/`,
`board/snapshots/`, `board/tmp/` — with zero actual path decided, zero
filesystem call made, and zero implementation committed. This
deliberately leaves Alpha 338's own open configuration-sourcing
question, and any future compaction/atomic-write design, fully open
for the Arc that eventually implements a real backend.

## 6. See also

- `docs/secure_runtime_alpha_344_append_only_backend_review.md`
- `docs/secure_runtime_alpha_346_migration_strategy.md`
- `docs/secure_runtime_alpha_338_local_process_entrypoint_review.md`
- `docs/secure_runtime_alpha_328_board_schema_migration_architecture.md`
