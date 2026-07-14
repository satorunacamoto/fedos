# Secure Runtime Alpha 350 — Backend Re-evaluation Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change
of any kind. This is Stage 10, the closing Stage, of the Alpha
341–350 Board Durable Backend Re-evaluation & Local Backend Selection
Arc.**

## 1. Why now

Alpha 341 confirmed `FedosDesktopHost` is a real, structurally
durable-backend-capable ownership boundary. Alpha 342 froze which
persistence assumptions are backend-independent. Alpha 343/344
reviewed SQLite and append-only against that re-confirmed reality.
Alpha 345 compared their crash-recovery behavior directly, finding one
bounded, unsolved design gap in append-only's own power-loss handling.
Alpha 346 fixed an Offline/One-shot migration strategy usable for any
backend pair. Alpha 347 reviewed a backend-agnostic storage layout,
without deciding an actual path. Alpha 348 confirmed the Desktop Host
is the only environment where either backend has a real caller. Alpha
349 issued the formal Decision: append-only, first. This Stage freezes
that Decision and issues the Arc's own closing Completion Declaration.

## 2. Why append-only was selected

Zero new dependency (`package.json`'s own `dependencies` count stays
fixed at 2, unchanged across this whole Arc); reuses
`hydrateFedosBoardService` and every other Alpha 311–320 persistence
component completely UNCHANGED; the SIMPLEST correct implementation of
the already-frozen, backend-independent `FedosBoardPersistence` port
(Alpha 342); the best testability of any candidate (a plain,
inspectable, diffable file); and the strongest match to this
repository's own recurring "simplest correct implementation first"
pattern (Alpha 316, Alpha 318). It wins four of six named criteria
outright (Alpha 349 §5) and ties on testability.

## 3. Why others were rejected

- **SQLite (Option B):** the strongest alternative on raw crash-safety
  and query capability, but requires either a new native dependency or
  an undeclared Node-version floor (Alpha 343 §1) — both beyond this
  Arc's own Absolute Prohibitions. Deferred, not dismissed: it is
  append-only's own anticipated MIGRATION DESTINATION (Alpha 346),
  once append-only has proven the Host→Persistence→Board pipeline end
  to end and its one open crash-recovery design gap (§4 below) is
  solved.
- **Both simultaneously (Option C):** doubles implementation/test/
  maintenance surface before either backend has a real caller proving
  it out — the same "no speculative shell" discipline this
  repository's own Arcs have applied consistently (Alpha 329 §2).
- **Continue deferring (Option D):** rejected outright — Alpha
  341/348 both directly confirm the exact missing prerequisite Alpha
  329 named (a real host caller) now exists; deferring again would be
  a THIRD consecutive Arc with no forward progress.

## 4. Migration path, frozen

```
InMemoryFedosBoardPersistence   (Alpha 316, TODAY's default,
        |                        FedosDesktopHost's own current
        |                        createFedosDesktopHost() default,
        |                        UNCHANGED by this Arc)
        v
Append-only file                (Alpha 349's own Decision — NOT YET
        |                        implemented; next Arc's own scope)
        v
SQLite                          (anticipated future migration
        |                        destination — NOT YET reviewed for
        |                        implementation; requires its own
        |                        separately-reviewed dependency
        |                        decision first, per Alpha 343 §1)
        v
[future backend]                 (unnamed, unneeded until a real
                                   requirement — e.g. multi-process
                                   concurrent writers, or a browser
                                   host — actually exists)
```

Migration between any two stages is Offline and One-shot (Alpha 346),
safe to re-run, using only the existing `putPost`/`getPost`/
`listPosts` port — no new interface, no new dependency, at any step.

## 5. Remaining unknowns, named explicitly for the next Arc

- **Trailing partial-write detection** (Alpha 345 §6): how to
  distinguish a crash-truncated tail record from a genuinely corrupt
  complete one, so a power-loss event does not void the entire Board
  on next hydration. The single most important open design question
  this Arc identifies.
- **Compaction** (Alpha 344 §6): how superseded copies of the same
  `id` (from a re-`putPost` of an already-present record) are
  eventually reclaimed, so the log does not grow unboundedly with zero
  new content.
- **Storage directory location** (Alpha 347 §3): still gated on Alpha
  338 §5's own open "configuration sourcing" question — no path is
  decided by this Arc.
- **Where the migration step itself is invoked from** (Alpha 346 §5) —
  gated on the same unresolved local-process entry-point question
  (Alpha 338).

## 6. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE.** Backend selection
has been re-evaluated using the actual, now-real `FedosDesktopHost`
architecture rather than assumptions: the Host capability inventory is
re-confirmed (Alpha 341), the backend-independent persistence
assumptions are frozen (Alpha 342), SQLite and append-only are each
reviewed on their own current terms (Alpha 343/344), their
crash-recovery behavior is compared directly (Alpha 345), a
backend-agnostic migration strategy is fixed (Alpha 346), a
backend-agnostic storage layout is reviewed without deciding a path
(Alpha 347), deployment reachability is re-confirmed (Alpha 348), and
the Arc's own required choice is made explicit, reasoned, and NOT an
unexamined default (Alpha 349): **append-only, first.**

## 7. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- SQLite, append-only backend, filesystem persistence, IndexedDB, D1,
  browser storage implementation — no such code exists anywhere in
  `src/`; this Arc added none.
- Ontology integration, Relay Pool, GUI, Electron, Tauri — no
  reference anywhere in this Arc's own docs/tests beyond confirming
  the boundary.
- New dependency of any kind — `package.json`'s `dependencies` count
  stays fixed at 2 (`@noble/curves`, `@noble/hashes`); no `Cargo.toml`
  change of any kind.
- `src/runtime/*`, `src/desktop/*` (production code — this Arc's own
  new `docs/`/`test/` files carry the only diff), `src/identity/*`,
  `src/worker.ts`, Rust — none carry a diff from this Arc.

## 8. Next Arc recommendation

**Secure Runtime Alpha 351–360: Append-only Durable Board Backend
Arc.**

Reason: this Arc's own required recommendation, matching its own
instruction verbatim. The append-only backend selected in Alpha 349
is ready to be IMPLEMENTED — the port is frozen (Alpha 315/342), the
migration strategy is fixed (Alpha 346), the storage layout is
reviewed (Alpha 347), and the one genuinely open design question
(trailing partial-write detection, §5) is precisely scoped for that
Arc to solve, not left as a surprise.

## 9. See also

- `docs/secure_runtime_alpha_349_backend_selection.md`
- `docs/secure_runtime_alpha_348_deployment_review.md`
- `docs/secure_runtime_alpha_347_storage_layout_review.md`
- `docs/secure_runtime_alpha_346_migration_strategy.md`
- `docs/secure_runtime_alpha_345_crash_recovery_review.md`
- `docs/secure_runtime_alpha_344_append_only_backend_review.md`
- `docs/secure_runtime_alpha_343_sqlite_review.md`
- `docs/secure_runtime_alpha_342_current_persistence_review.md`
- `docs/secure_runtime_alpha_341_host_capability_inventory.md`
- `docs/secure_runtime_alpha_340_desktop_host_foundation_completion.md`
