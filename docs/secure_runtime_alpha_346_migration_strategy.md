# Secure Runtime Alpha 346 — Migration Strategy

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 6 of the Alpha 341–350 Board Durable Backend
Re-evaluation & Local Backend Selection Arc. **No code in this Stage.**

## 1. Why now

Alpha 344 §7 already observed that migration between
`FedosBoardPersistence` implementations is trivial BY CONSTRUCTION —
`listPosts()` on the source, `putPost()` on the destination, using
only the existing port. This Stage fixes WHEN and HOW that copy should
run, for the anticipated path:

```
Append-only  →  SQLite  →  future backend
```

(Alpha 349's own selection, anticipated ahead of that Stage's formal
Decision — see that Stage for the actual choice.)

## 2. Candidates compared

- **Online migration** — old and new backends both live and
  write-reachable during the copy, with writes reconciled between
  them. REJECTED: this would require `FedosDesktopHost` (or some
  migration-specific caller) to hold TWO `FedosBoardPersistence`
  instances and duplicate every write to both for some window — a
  concurrent-writer shape Alpha 322 §"NOT YET" explicitly excludes
  from this repository's own requirement set, and a coordination
  problem with no existing precedent anywhere in this codebase.
- **Offline migration** — the Host is stopped (or not yet started);
  migration runs as its own separate step, with neither backend
  serving live traffic during the copy. **ADOPTED.**
- **One-shot** — the entire `listPosts()` result is copied in a single
  pass, then the old backend is retired. **ADOPTED**, paired with
  Offline.
- **Streaming** — records copied incrementally, backend swapped
  mid-stream, or copied in bounded batches to bound memory use.
  REJECTED for a first migration design: Alpha 322 §"NOT YET"
  excludes "transactions"/"multiple processes" scale concerns this
  repository has no evidence of needing yet — a single local user's
  Board is not expected to hold a record count where a single-pass,
  in-memory `listPosts()` copy is impractical. Streaming remains a
  reasonable FUTURE refinement if that assumption is ever falsified,
  not a requirement for the first migration.

## 3. Decision: Offline, One-shot

**Migration is Offline and One-shot.** Concretely, as a DESIGN
description only (no code in this Stage):

1. `FedosDesktopHost` is stopped (or never started against the OLD
   backend for this run).
2. A migration step constructs the OLD `FedosBoardPersistence`
   (e.g. the append-only backend) and the NEW one (e.g. SQLite)
   directly — NOT through `FedosDesktopHost` at all; migration is a
   PERSISTENCE-layer concern, never a Host-lifecycle concern.
3. For every record in `old.listPosts()`, call `new.putPost(record)`.
   The port's own `"already-present"`/`"conflict"` semantics (Alpha
   315) already define correct behavior if the step is interrupted and
   re-run — RE-RUNNING THE SAME MIGRATION STEP TWICE IS SAFE BY
   CONSTRUCTION, with no bespoke idempotency logic needed.
4. Once every record is confirmed present in the new backend (e.g. by
   comparing `old.listPosts().length` against a fresh
   `new.listPosts().length`, or per-record via `new.getPost(id)`), the
   Host is reconfigured (via `FedosDesktopHostDependencies.boardPersistence`,
   Alpha 334, unmodified) to use the NEW backend going forward.
5. The OLD backend's own on-disk state is retained until an operator
   explicitly discards it — no automatic deletion is proposed by this
   Stage, matching this Arc's own Absolute Prohibition against any
   filesystem-API implementation.

## 4. Why this fits the actual architecture

- `hydrateFedosBoardService` (Alpha 318) is reused UNCHANGED to verify
  the migrated Board hydrates correctly post-migration — the SAME
  fail-closed guarantee that protects normal startup also protects a
  migration's own correctness check.
- No new port, no new interface, no new dependency — migration is
  expressible ENTIRELY in terms of the three methods
  `FedosBoardPersistence` already has.
- `FedosDesktopHost`'s own construct-only, no-hidden-startup discipline
  (Alpha 334) means a migration script can safely construct EITHER
  backend directly, without accidentally triggering a live Host
  lifecycle side effect.

## 5. What remains unresolved (named, not solved)

- Where the migration step itself lives (a dedicated script? a Host
  subcommand?) — unresolved precisely because Alpha 338 §5 already
  named "how a future entry point is invoked" as unresolved; migration
  inherits the same gap.
- Whether a migration failure mid-copy should retry automatically or
  require operator intervention — this Stage's own "safe to re-run"
  property (§3.3) makes EITHER answer viable, but does not choose one.
- How the OLD backend's data is eventually discarded, if ever.

## 6. Conclusion

Migration between any two `FedosBoardPersistence` implementations is
Offline and One-shot, safe to re-run, and requires no new port, no new
dependency, and no Host-lifecycle change — it is fully expressible
using the existing `putPost`/`getPost`/`listPosts` contract alone.
This holds for Append-only → SQLite specifically, and for any future
backend pair equally.

## 7. See also

- `docs/secure_runtime_alpha_344_append_only_backend_review.md`
- `docs/secure_runtime_alpha_342_current_persistence_review.md`
- `docs/secure_runtime_alpha_328_board_schema_migration_architecture.md`
- `docs/secure_runtime_alpha_334_desktop_host_dependency_assembly.md`
