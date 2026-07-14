# Secure Runtime Alpha 329 — First Durable Backend Selection

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind and implements NO backend.** Stage 9 of the Alpha 321–330 Board
Durable Backend Selection & Architecture Arc. This Stage issues the
Arc's own Selection Decision.

## 1. Why now

Alpha 321 inventoried real environments. Alpha 322 froze requirements.
Alpha 323–326 reviewed all four named candidates. Alpha 327 adopted
"defer backend choice" (Option E) as the multi-environment strategy.
Alpha 328 froze the schema/migration architecture any future choice
must inherit. This Stage makes the Arc's own required choice among the
five named options — following, not overriding, that inventory.

## 2. Decision Constraints, applied

A backend is selectable only if a real runtime can call it, tests can
execute meaningfully, no speculative shell is invented, dependency
implications are explicit, persistence semantics remain unchanged, and
Canonical Board state remains authoritative. Checked against each
candidate:

- **SQLite** — no real Desktop host process exists to call it
  (Alpha 321 §3.3); would require a new, currently-prohibited dependency
  (Alpha 323 §2). Fails the "real runtime can call it" constraint.
- **IndexedDB** — no browser or webview-based Desktop host exists
  (Alpha 321 §3.1/§3.3); meaningful testing would itself require a new,
  currently-prohibited polyfill dependency (Alpha 324 §2). Fails the
  same constraint, twice over.
- **D1** — the Worker environment IS real (Alpha 321 §3.2), and D1
  bindings ARE real code in this repository (Alpha 321 §3.6/§3.12) — but
  Board itself has ZERO wiring into `src/worker.ts` (Alpha 321 §3.4), no
  Board-specific D1 schema exists (Alpha 325 §2), and no
  `wrangler.toml`/migration pipeline exists to deploy it with
  (Alpha 321 §3.6). The BACKEND technology is real; its CALLER is not.
  Fails "a real runtime can call it" at the Board-integration level,
  even though the underlying Worker/D1 plumbing is proven for a
  different concern.
- **Append-only file** — needs zero new dependency (Alpha 326 §2) and is
  directly runnable under this repository's real Node test/dev
  environment — but no real Desktop PROCESS exists to own a Board data
  file as authoritative local state (Alpha 321 §3.3); building it today
  would mean its only real caller is its own test suite, which the
  Decision Constraints' own "no speculative shell is invented" language
  is written to prevent.

**Every one of the four backend-committing candidates fails the "real
runtime can call it" constraint at the Board-integration level** — not
because any candidate is technically deficient (Alpha 323–326 found real
strengths in each), but because Board itself, as Alpha 321 §3.4
establishes, has no wiring into ANY production runtime today: not the
Worker's `fetch` handler, not a Desktop process, not a browser.

## 3. Selection

**Option E: no backend yet, because no real host runtime exists for
Board persistence to be wired into.**

This is not "no environment exists" in the abstract (the Worker is
real, Node is real) — it is that **Board specifically has no real
caller in either real environment today**. Choosing D1 would mean
building the Worker-Board integration from scratch; choosing SQLite,
IndexedDB, or an append-only file would each mean building an entirely
new Desktop or browser host from scratch first. Every path routes
through the same missing prerequisite: a real host that actually calls
Board persistence in production.

## 4. State clearly

- **Selected first backend:** none — explicitly deferred.
- **Environments it serves:** none (nothing is implemented).
- **Environments it does not serve:** all of them, equally, by design —
  this is a deferral of the CHOICE, not an implicit default to any one
  candidate.
- **Why alternatives are deferred:**
  - SQLite (Alpha 323) — no Desktop host process; would need a new,
    prohibited dependency.
  - IndexedDB (Alpha 324) — no browser/webview host; would need a new,
    prohibited polyfill dependency even to test.
  - D1 (Alpha 325) — real technology, but Board has no wiring into the
    Worker that would call it, and no deployment manifest exists to
    ship it with.
  - Append-only file (Alpha 326) — needs no new dependency, but no real
    Desktop process exists to own it as authoritative state; its only
    real caller today would be its own test suite.
- **What must exist before each deferred backend can be implemented:**
  - SQLite — a real Desktop host process (Alpha 330 §3's recommended
    next Arc) PLUS a separately-reviewed dependency-addition decision.
  - IndexedDB — a real browser or Desktop-webview host PLUS a
    separately-reviewed test-polyfill decision.
  - D1 — a Board-aware Worker route (its own, separately-reviewed
    Runtime/Worker change, out of THIS Arc's scope) PLUS a
    `wrangler.toml`/migration pipeline PLUS a Board-specific schema.
  - Append-only file — the SAME real Desktop host process SQLite would
    need, since both target the identical missing prerequisite: a
    process that actually owns Board data locally.

## 5. Selection criteria, confirmed

- Real caller exists — **fails for all four**, confirming Option E.
- Real runtime exists — true for Worker/Node in the abstract, but not
  wired to Board (§2).
- Minimal dependency burden — Option E adds none; SQLite/IndexedDB would
  each add a new, currently-prohibited dependency.
- Local-first compatibility — undecided; correctly left open rather than
  foreclosed by a premature D1-first or SQLite-first commitment.
- Recovery, testability, deployment usefulness, future backend parity —
  all deferred alongside the backend choice itself; none is compromised
  by waiting.
- No architectural contradiction — Option E is the only option that adds
  none: it commits to nothing this Arc's own inventory cannot support.

## 6. Conclusion

No durable backend is selected. The correct next step is not a database
implementation Arc for any of the four candidates, but a Stage that
builds the one thing every candidate's own review named as the actual
missing piece: a real host runtime for Board to be wired into.

## 7. See also

- `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
- `docs/secure_runtime_alpha_322_durable_backend_requirements.md`
- `docs/secure_runtime_alpha_323_sqlite_backend_review.md`
- `docs/secure_runtime_alpha_324_indexeddb_backend_review.md`
- `docs/secure_runtime_alpha_325_d1_backend_review.md`
- `docs/secure_runtime_alpha_326_append_only_backend_review.md`
- `docs/secure_runtime_alpha_327_multi_environment_backend_strategy.md`
- `docs/secure_runtime_alpha_328_board_schema_migration_architecture.md`
