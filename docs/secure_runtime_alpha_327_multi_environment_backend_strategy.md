# Secure Runtime Alpha 327 — Multi-Environment Backend Strategy

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind.** Stage 7 of the Alpha 321–330 Board Durable Backend Selection &
Architecture Arc.

## 1. Why now

Alpha 323–326 reviewed all four named candidates. This Stage compares
the five named multi-environment STRATEGIES — not individual
technologies — against Alpha 321's environment inventory.

## 2. Preferred principle

`FedosBoardPersistence`'s own semantics (Alpha 315: `putPost`/`getPost`/
`listPosts`, the four-way write-result discipline, no protocol/ontology
coupling) stay IDENTICAL across every environment. The PHYSICAL backend
behind that port may differ by environment — this is not a compromise,
it is what Alpha 315 built the port BACKEND-NEUTRAL to allow.

## 3. Comparing the five options

- **Option A — one universal backend for every environment.**
  Contradicted directly by Alpha 321 §3.10: no single physical backend
  reaches the Worker (no filesystem/native modules) AND Node AND a
  hypothetical Desktop/browser without contradiction. Rejected.
- **Option B — SQLite (Desktop) / D1 (Worker) / IndexedDB (browser
  shell).** The cleanest LONG-TERM shape, matching the Preferred
  Principle exactly — but it presumes all three hosts already exist.
  Alpha 321 confirms only the Worker is real today; no Desktop shell and
  no browser exist (§3.3/§3.1). Adopting this shape now would mean
  building two backends (SQLite, IndexedDB) against hosts that do not
  exist — the imaginary-environment error Alpha 329's Decision
  Constraints forbid.
- **Option C — IndexedDB everywhere possible, D1 hosted.** Presumes a
  browser-capable host is the primary local target; Alpha 321 found no
  browser or webview-based Desktop shell anywhere in this repository.
  Rejected for the same reason as Option B's IndexedDB half.
- **Option D — append-only file (Desktop), D1 (hosted).** Needs zero new
  dependency for its Desktop half (Alpha 326) and reuses this
  repository's own proven D1 wiring for its hosted half (Alpha 325) —
  the most implementation-ready STRATEGY of the four backend-committing
  options. Its remaining gap is not technical: no real Desktop host
  process exists to own the file (Alpha 321 §3.3), and Board has zero
  wiring into the Worker's `fetch` handler to make the D1 half real
  either (Alpha 321 §3.4). Both halves of this option would be built
  against callers that do not exist yet.
- **Option E — only one initial backend; defer all others.** Directly
  matches Alpha 321's own strongest finding: Board has **no real caller
  in any production runtime today** — not the Worker, not a Desktop
  process, not a browser (§3.4). Every backend-committing option (B/C/D)
  would require building at least one caller from scratch BEFORE its own
  backend could be exercised for real. Option E defers backend choice
  until a real host exists to make that choice meaningful.

## 4. Required evaluation criteria, applied

- **Current real environment** — Worker (deployed target) and Node
  (test/dev) only (Alpha 321 §3.1/§3.2).
- **User ownership** — no environment currently gives the user a
  locally-owned Board data file or database of any kind; this remains
  an open, unbuilt property regardless of which option is chosen.
- **Offline operation** — no offline-capable host exists yet (no
  Desktop shell, Alpha 321 §3.3).
- **Hosted federation** — D1/Worker is the only environment with any
  real, working wiring precedent (Alpha 321 §3.12), though for a
  different, non-authoritative concern (D1MetadataIndex).
- **Implementation cost** — lowest for Option E (zero — no backend
  built); Option D's file half is the lowest COST among backend-
  committing options (Alpha 326, zero new dependency).
- **Maintenance burden** — Option A/B/C all commit to maintaining
  backends for hosts that do not exist, an ongoing burden with no
  current payoff; Option E has none.
- **Portability** — N/A until a backend is chosen.
- **Test coverage** — every candidate is independently testable in
  isolation (Alpha 323–326 each confirm this); not a differentiator
  between strategies.
- **Migration compatibility** — every candidate can honor
  `schemaVersion` (Alpha 328); not a differentiator here either.
- **Persistence-port compatibility** — every candidate can implement
  `FedosBoardPersistence` (synchronous ones directly; D1/IndexedDB would
  need the separate async port Alpha 315 §6 already anticipated) — not a
  strategy-level differentiator.
- **Semantic equivalence** — guaranteed by the Preferred Principle (§2)
  regardless of which option is chosen.
- **Backup** — trivial for file/SQLite, tooling-based for D1
  (`wrangler d1 export`), awkward for IndexedDB (Alpha 324) — a real
  differentiator AMONG technologies, not among the five strategies.
- **Future sync** — out of scope; the Future Relationship diagram (this
  Arc's own instruction) keeps Ontology projection strictly downstream
  of whatever durable state eventually exists.
- **Security boundary** — unaffected by strategy choice; no encryption-
  at-rest decision is made by any option (Alpha 322 §4).
- **Operational deployment** — Option E requires none; every
  backend-committing option requires deployment work
  (packaging for SQLite/file, a client bundle for IndexedDB, a
  `wrangler.toml`/migrations pipeline for D1) that does not exist in
  this repository today.

## 5. Conclusion

Options A and C are rejected outright (no universal backend is
possible; no browser-first target is real). Options B and D describe
architecturally sound LONG-TERM shapes fully consistent with the
Preferred Principle, but both commit to backends whose real callers do
not exist yet. Option E is the only strategy that does not require
inventing a host — it defers the CHOICE, not the principle, until a
real runtime exists to make that choice meaningful. This is carried
forward as the adopted strategy in Alpha 329.

## 6. See also

- `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
- `docs/secure_runtime_alpha_323_sqlite_backend_review.md`
- `docs/secure_runtime_alpha_324_indexeddb_backend_review.md`
- `docs/secure_runtime_alpha_325_d1_backend_review.md`
- `docs/secure_runtime_alpha_326_append_only_backend_review.md`
