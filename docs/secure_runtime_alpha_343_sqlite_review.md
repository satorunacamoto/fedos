# Secure Runtime Alpha 343 — SQLite Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind, and implements NO SQLite backend.** Stage 3 of the Alpha
341–350 Board Durable Backend Re-evaluation & Local Backend Selection
Arc. Evaluates SQLite ONLY, now that a real Host caller exists
(Alpha 341) — this Stage re-examines Alpha 323's own prior review
under that new fact, rather than repeating it unchanged.

## 1. Dependency impact

Two real paths exist, neither free:

- **A native module** (e.g. `better-sqlite3`) — synchronous, mature,
  the closest fit to the frozen synchronous port (Alpha 342 §2), but a
  compiled native addon: platform/architecture-specific prebuilds,
  a `node-gyp` fallback path, and genuine Windows-toolchain risk this
  repository already has direct, painful evidence of (the `dlltool`
  MinGW failure this Arc's own Verification section reproduces on
  EVERY run, unrelated to any code in this repository). Adding a
  native module before that toolchain issue is resolved would be
  adding risk on top of a KNOWN-broken local build path.
- **Node's built-in `node:sqlite`** — synchronous, zero new
  dependency, but gated on a specific Node major version (stable no
  earlier than Node 22) and, per Alpha 321 §3.5 (re-confirmed
  unchanged this Arc), this repository's own `tsconfig.json` carries
  NO `@types/node` — `node:sqlite` would be reached exactly the same
  untyped way `fedos_windows_dpapi_helper.ts` already reaches
  `node:child_process` (a `// @ts-expect-error` escape hatch), not a
  clean, fully-typed integration.

**Either path is a real dependency-impact decision this Arc's own
Absolute Prohibitions explicitly forbid making today** ("package.json
dependency changes" — even the zero-`package.json`-change
`node:sqlite` path still requires a Node-version floor this repository
has never declared anywhere).

## 2. Deployment

SQLite (either path) requires a real filesystem and a real, long-lived
process — exactly what `FedosDesktopHost` now is (Alpha 341), and
exactly what the Cloudflare Worker (V8 isolate, no filesystem) can
never be (Alpha 321 §3.10, unchanged). SQLite is therefore Desktop
Host-only, permanently, regardless of which Node-SQLite path is
eventually chosen.

## 3. Schema evolution / migrations

SQLite supports `ALTER TABLE ADD COLUMN` and versioned migration
scripts natively, well beyond what `FedosPersistedBoardPostRecordV1`'s
own single `schemaVersion: 1` field needs today — but this repository
has NO migration-runner pattern anywhere yet (Alpha 328's own
Alpha 321–330 schema/migration architecture review fixed only
PERSISTENCE-LAYER `schemaVersion` ownership, never wrote a runner).
Building one is real, additional scope beyond a bare backend
implementation.

## 4. Crash recovery

SQLite in WAL (Write-Ahead Log) mode is genuinely strong here: a
half-committed transaction never corrupts the database file — the WAL
is replayed or discarded atomically on next open, and the file remains
in its last fully-consistent state. See Alpha 345 for a full
side-by-side with append-only's own crash behavior.

## 5. Transaction semantics

Full ACID transactions, real `BEGIN`/`COMMIT`/`ROLLBACK` — strictly
more than `FedosBoardPersistence`'s own port requires (single-record
`putPost`/`getPost`/`listPosts`, Alpha 322 §"MUST": "atomic
single-record writes" only, NOT multi-record transactions). SQLite
would satisfy that MUST requirement trivially, with substantial
unused capability left over.

## 6. Indexes

Real B-tree indexes on `boardId`/`threadId`/`replyTo` would make
`listBoardPosts`/`listThreadPosts`-shaped queries genuinely faster at
scale than `FedosBoardIndex`'s own in-memory `Map`-of-arrays (Alpha
305) — but Alpha 322 §"NOT YET" already excludes "secondary indexes"
from this repository's own MUST/SHOULD requirement set for a first
backend; this is capability SQLite has that nothing here currently
asks for.

## 7. Query capability

Full SQL — dramatically more expressive than
`FedosBoardPersistence`'s own three-method port. This is a genuine
RISK, not just a strength: a naive SQLite-backed implementation could
be tempted to expose SQL-shaped operations through
`FedosBoardPersistence` or `FedosBoardService`, which Alpha 315's own
"no database-specific vocabulary" guardrail explicitly forbids. Any
future SQLite backend must be disciplined to the SAME three-method
synchronous port everything else already respects — SQL stays
strictly BEHIND that port, never above it.

## 8. Maintenance

`VACUUM`, WAL checkpointing, and file-growth management are real,
ongoing operational concerns a single-user local Board would need
someone (or something) to run — none of which this repository has any
existing pattern for (no scheduled task, no background worker of any
kind exists anywhere in this Arc's own scope).

## 9. Portability

A SQLite database is a single, portable file — but the NATIVE MODULE
path (§1) is not portable across platform/architecture without
per-target prebuilds, and the `node:sqlite` path is not portable
across Node versions below the feature's stabilization. Portability of
the DATA is strong; portability of the BACKEND CODE itself is
conditional either way.

## 10. Conclusion

SQLite is the most capable candidate reviewed in this Arc — real
transactions, real crash safety via WAL, real indexes, real SQL — but
every one of those capabilities exceeds what this repository's own
frozen requirements (Alpha 322) actually ask a first backend to
provide, and adopting it TODAY would require either a new native
dependency (this Arc's own Absolute Prohibition) or an undeclared
Node-version floor plus an as-yet-nonexistent migration-runner
pattern. SQLite remains a strong SECOND backend candidate (Alpha 350's
own migration path), not a strong FIRST one.

## 11. See also

- `docs/secure_runtime_alpha_342_current_persistence_review.md`
- `docs/secure_runtime_alpha_323_sqlite_backend_review.md`
- `docs/secure_runtime_alpha_322_durable_backend_requirements.md`
- `docs/secure_runtime_alpha_328_board_schema_migration_architecture.md`
