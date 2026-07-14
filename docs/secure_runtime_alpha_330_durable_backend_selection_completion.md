# Secure Runtime Alpha 330 — Durable Backend Selection Completion

**Status: this Stage is REVIEW ONLY — it makes NO further code change of
any kind. This is Stage 10, the closing Stage, of the Alpha 321–330
Board Durable Backend Selection & Architecture Arc.**

## 1. Why now

Alpha 321 inventoried real environments and found no browser and no real
Desktop shell, and — more importantly — that Board itself has no real
caller in any production runtime today. Alpha 322 froze requirements.
Alpha 323–326 reviewed SQLite, IndexedDB, D1, and append-only file
against them. Alpha 327 adopted "defer backend choice" as the
multi-environment strategy. Alpha 328 froze the schema/migration
architecture any future backend must inherit. Alpha 329 issued the
formal selection: Option E, no backend yet. This Stage issues the Arc's
own closing Completion Declaration.

## 2. The architecture, frozen

```
FedosBoardPersistence            (Alpha 315, port — UNCHANGED, still the
        |                         only frozen contract a future backend
        |                         must satisfy)
        |
        +-- InMemoryFedosBoardPersistence   (Alpha 316, still the only
        |                                    implementation that exists)
        |
        +-- [durable backend]     NOT YET SELECTED (this Arc's own
                                   Decision: Option E)

Requirements (Alpha 322): MUST / SHOULD / NOT YET, frozen ahead of any
technology comparison, derived only from already-frozen contracts.

Candidates reviewed (Alpha 323-326): SQLite, IndexedDB, D1, append-only
file -- each has real strengths; each fails the SAME constraint, "a real
runtime can call it," at the Board-integration level (Alpha 321 SS3.4:
Board has zero wiring into the Worker, a Desktop process, or a browser).

Strategy (Alpha 327): defer backend choice (Option E) rather than force
Option A (one universal backend, impossible per Alpha 321 SS3.10) or
commit early to Option B/C/D against hosts that do not exist.

Schema/migration architecture (Alpha 328): schemaVersion authority stays
in the persistence layer (Option B ownership), regardless of whichever
backend a future Arc eventually selects; every index/feed/projection
stays a rebuildable pure function of stored records.

Selection (Alpha 329): Option E -- no backend selected. Every
backend-committing option requires building, from scratch, the SAME
missing prerequisite: a real host that actually calls Board persistence
in production.
```

Zero new Rust code, zero new Cargo dependency, zero new npm dependency —
`package.json`'s own `dependencies` count stays fixed at 2, unchanged
across this whole Arc.

## 3. Completion Declaration

**This Arc's own Objective is CONFIRMED COMPLETE.** The durable
persistence architecture for the Canonical Board Application is now
frozen: the execution-environment inventory is complete, the durable
backend requirement set (MUST/SHOULD/NOT YET) is frozen, all four named
candidate technologies are reviewed against it, the multi-environment
strategy is adopted, the schema/migration ownership model is fixed, and
the first-backend selection is made explicit — as a documented,
reasoned DEFERRAL, not an unexamined default.

The following are now declared complete:

- **Execution-environment inventory** — Alpha 321: Cloudflare Workers
  (primary, real, deployed target) and Node (real, test/dev harness
  only) exist; no browser and no real Desktop shell exist; Board has no
  wiring into any production runtime today.
- **Durable backend requirements** — Alpha 322: MUST (port shape,
  conflict detection, no-overwrite-on-conflict, schemaVersion
  preservation, fail-closed corruption detection, independent instances,
  atomic single-record writes, bounded hydration, backup/migration
  feasibility, test isolation, no protocol/ontology coupling); SHOULD
  (batch insert, ordered iteration, Worker support); NOT YET
  (transactions, secondary indexes, encryption at rest, concurrent
  writers, multiple processes, browser support, hard Worker/Desktop
  requirements).
- **SQLite review** — Alpha 323: mature, transactional, but needs a new
  dependency and a Desktop host process, neither of which exists.
- **IndexedDB review** — Alpha 324: a natural schema fit, but needs a
  browser/webview host and a test polyfill dependency, neither of which
  exists; the Cloudflare "Worker" name-collision explicitly clarified.
- **D1 review** — Alpha 325: this repository's most operationally
  proven backend technology, but Board has zero wiring into the Worker
  that would call it, and no deployment manifest exists; appropriate for
  a future HOSTED role, not forced into the authoritative local role.
- **Append-only file review** — Alpha 326: zero new dependency, directly
  testable today, but no real Desktop process exists to own it as
  authoritative state; explicit warning against mistaking a naive
  JSON-overwrite for genuine append-only durability.
- **Multi-environment strategy** — Alpha 327: Option A (universal
  backend) and Option C (IndexedDB-first) rejected outright; Option E
  (defer) adopted over Option B/D because Board's real caller gap, not
  any backend's technical limitation, is the actual blocker.
- **Migration architecture** — Alpha 328: persistence-layer ownership
  (Option B) of `schemaVersion` checks, fail-closed on unknown versions,
  backup-before-destructive-migration, indexes/feed/ontology projection
  all remain rebuildable regardless of eventual backend.
- **First-backend selection** — Alpha 329: Option E, explicit deferral,
  with a stated prerequisite for each of the four candidates.

## 4. Still out of scope (verbatim from this Arc's own instruction,
confirmed by direct inspection)

- Ontology integration — no reference to `p2p/` anywhere in this Arc's
  own docs/tests beyond confirming the boundary; `p2p/` remains
  completely untouched (confirmed by `git status`, not merely absence of
  import).
- SQLite/IndexedDB/D1/filesystem implementation — no such code exists
  anywhere in `src/`; this Arc added none.
- New dependency of any kind — `package.json`'s `dependencies` count
  stays fixed at 2 (`@noble/curves`, `@noble/hashes`); no `Cargo.toml`
  change of any kind.
- Protocol adapter changes, Board model changes, Board repository
  semantic changes — `src/board/*` (excluding this Arc's own new
  `docs/`/`test/` files) carries zero diff.
- Runtime, Desktop, Worker, Storage, Observation, GUI, Relay Pool
  changes — none; `src/runtime/*`, `src/desktop/*`, `src/worker.ts`
  carry zero diff from this Arc.

## 5. Next Arc recommendation

**Desktop Host Runtime Foundation Arc.**

Reason: Alpha 321 through Alpha 329 converge on one finding, restated
five separate ways across four candidate reviews and one strategy
comparison — Board persistence has no real host to be authoritative
FOR. Of the two theoretically-real environments (Worker, Node), the
Worker is this repository's primary deployed target but Board has zero
wiring into it, and building that wiring commits prematurely to a
hosted-first, D1-backed architecture without a decided local/offline
story. This Arc's own Future Relationship diagram (`Durable Canonical
Board State → Board Ontology Projection Adapter → P2P Ontology Engine`)
places the eventual Ontology projection downstream of a LOCAL, user-owned
durable state — consistent with treating a real Desktop host process
(not a hosted Worker route) as Board's first authoritative home. A
Desktop Host Runtime Foundation Arc — building the actual host PROCESS
`DesktopApplication` (Alpha 096–140) never became (no window, no OS
lifecycle, no packaging, confirmed inert per Alpha 321 §3.3) — unblocks
SQLite, append-only file, and (if ever webview-based) IndexedDB all at
once, without committing to any one of them yet, and without touching
Board, persistence, or Worker code in the process.

**Ontology integration is explicitly NOT the next recommended Arc** —
this Stage names Desktop Host Runtime Foundation instead, per this Arc's
own instruction.

## 6. What this Stage does NOT do

- Does **not** modify `fedos_board_persistence.ts`,
  `in_memory_fedos_board_persistence.ts`,
  `persisted_fedos_board_repository.ts`, `fedos_board_hydration.ts`,
  `fedos_persisted_board_post_v1.ts`, or `fedos_board_post_codec.ts` —
  no further production code change of any kind.
- Does **not** implement a durable backend, a Desktop host runtime, an
  Ontology projection, or a GUI.
- Does **not** modify `packages/fedos-core-rust/src/lib.rs`,
  `Cargo.toml`, `src/runtime/*`, `src/desktop/*`, `src/identity/*`,
  `src/worker.ts`, any of the four Board Adapters,
  `src/board/repository/*`, `src/board/persistence/*`, Secure Runtime
  Storage, Observation, Relay transport, Nostr validation, or `p2p/`.

## 7. See also

- `docs/secure_runtime_alpha_329_first_durable_backend_selection.md`
- `docs/secure_runtime_alpha_328_board_schema_migration_architecture.md`
- `docs/secure_runtime_alpha_327_multi_environment_backend_strategy.md`
- `docs/secure_runtime_alpha_326_append_only_backend_review.md`
- `docs/secure_runtime_alpha_325_d1_backend_review.md`
- `docs/secure_runtime_alpha_324_indexeddb_backend_review.md`
- `docs/secure_runtime_alpha_323_sqlite_backend_review.md`
- `docs/secure_runtime_alpha_322_durable_backend_requirements.md`
- `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
- `docs/secure_runtime_alpha_320_board_persistence_completion.md`
