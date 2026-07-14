# Secure Runtime Alpha 349 — Backend Selection

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind and implements NO backend.** Stage 9 of the Alpha 341–350 Board
Durable Backend Re-evaluation & Local Backend Selection Arc. Issues
the Arc's own Selection Decision.

## 1. Why now

Alpha 341 confirmed the Host can structurally own a durable backend.
Alpha 342 froze which persistence assumptions are backend-independent.
Alpha 343/344 reviewed SQLite and append-only on their own terms.
Alpha 345 compared their crash-recovery behavior directly. Alpha 346
fixed a backend-agnostic migration strategy. Alpha 347 reviewed a
backend-agnostic storage layout. Alpha 348 confirmed the Desktop Host
is the only environment where either backend has a real caller. This
Stage makes the Arc's own required choice.

## 2. Criteria, applied to each option

Evaluated against simplicity, recoverability, dependency footprint,
future migration, testability, and FedOS architecture consistency
(this Arc's own named criteria):

- **Option D — continue deferring.** REJECTED. Alpha 341/348 both
  confirm the exact prerequisite Alpha 329 named as missing —
  a real host caller — now exists. Deferring again would ignore this
  Arc's own explicit Objective and produce a THIRD consecutive Arc
  with no forward progress on durable Board state.
- **Option C — both simultaneously.** REJECTED. Doubles
  implementation, test, and maintenance surface (§ dependency
  footprint, testability) before EITHER backend is proven with a real
  caller — the same "no speculative shell" discipline this
  repository's own Arcs have applied consistently (Alpha 329 §2, Alpha
  338 §2 Option A rejection) applies here too. Simultaneous
  implementation also front-loads Alpha 346's own migration-path
  design before there is any migration TO perform yet.
- **Option B — SQLite first.** REJECTED for FIRST position, not for
  ALL time. Simplicity: lowest of all three real options — real
  transactions/indexes/SQL are more machinery than a first backend
  needs (Alpha 343 §5–§7). Recoverability: BEST of the three (Alpha
  345 §6) — the only criterion favoring SQLite outright. Dependency
  footprint: WORST — either a new native module or an undeclared
  Node-version floor (Alpha 343 §1), both beyond this Arc's own
  Absolute Prohibitions (and any future Arc's, without a
  separately-reviewed dependency decision). Future migration: fine as
  a DESTINATION (Alpha 346), poor as a FIRST step since it forecloses
  validating the Host→Persistence→Board pipeline with the simplest
  possible backend first. Testability: good, but gated on the same
  dependency question. FedOS architecture consistency: weak — this
  repository has never added a native dependency or an
  undeclared-Node-version requirement anywhere in its own history.
- **Option A — append-only first.** **ADOPTED.** Simplicity: highest
  (Alpha 344 §1) — no schema, no query planner, no migration runner,
  reuses `hydrateFedosBoardService` UNCHANGED. Recoverability: GOOD,
  with exactly one named, bounded, unsolved design problem (Alpha 345
  §6: distinguishing a trailing partial write from genuine corruption)
  — not a blocker, a next-Arc design task. Dependency footprint: ZERO
  — no `package.json` change, no Node-version floor beyond what this
  repository already assumes (Alpha 331 §3.8). Future migration:
  EXCELLENT as a FIRST step — Alpha 346's own Offline/One-shot
  strategy makes moving from append-only to SQLite later trivial,
  using only the existing port. Testability: excellent — a plain
  file, inspectable, diffable, and reproducible in a test's own temp
  directory with zero mocking. FedOS architecture consistency:
  STRONGEST — matches this repository's own recurring pattern (Alpha
  316's `InMemoryFedosBoardPersistence`, Alpha 318's hydration) of
  shipping the simplest correct implementation of a frozen interface
  first, deferring complexity until a real need is demonstrated.

## 3. Decision

**Option A: append-only file backend, selected as the first durable
backend.** Rejected, in order of closeness: Option B (SQLite) is the
strongest alternative, deferred to a LATER Arc as the natural
migration destination (Alpha 346), once the append-only backend has
proven the Host→Persistence→Board pipeline end to end AND the
trailing-partial-write design problem (Alpha 345 §6) has been solved.
Option C (both) and Option D (defer) are rejected outright, for the
reasons in §2.

## 4. What this Decision does NOT do

- **Does not implement anything.** Zero `node:fs` call, zero new file,
  zero backend code exists anywhere in this Arc's own deliverables (a
  doc and a test per Stage, per this Arc's own Expected Deliverables).
- **Does not resolve** the trailing-partial-write design problem
  (Alpha 345 §6) or the compaction problem (Alpha 344 §6) — both are
  explicitly named as the NEXT Arc's own required design work (Alpha
  350 §5).
- **Does not resolve** the storage-directory-location question (Alpha
  347 §3) — still Alpha 338 §5's own open configuration-sourcing gap.
- **Does not foreclose SQLite** — it is named, explicitly, as this
  Arc's own anticipated future migration destination (Alpha 346),
  not as a rejected dead end.

## 5. Conclusion

Append-only wins on four of six named criteria (simplicity, dependency
footprint, future migration, FedOS architecture consistency), ties on
testability, and loses only recoverability — and even there, loses by
exactly one bounded, nameable, solvable design gap rather than by any
structural limitation. SQLite remains the stronger backend on raw
engineering maturity, but is the wrong FIRST backend for this
repository's own actual constraints (Absolute Prohibitions against a
new dependency this Arc, and against any undeclared Node-version
floor).

## 6. See also

- `docs/secure_runtime_alpha_348_deployment_review.md`
- `docs/secure_runtime_alpha_345_crash_recovery_review.md`
- `docs/secure_runtime_alpha_344_append_only_backend_review.md`
- `docs/secure_runtime_alpha_343_sqlite_review.md`
- `docs/secure_runtime_alpha_346_migration_strategy.md`
- `docs/secure_runtime_alpha_329_first_durable_backend_selection.md`
