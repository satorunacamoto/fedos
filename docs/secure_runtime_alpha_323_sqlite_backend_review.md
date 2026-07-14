# Secure Runtime Alpha 323 — Candidate A: SQLite Backend Review

**Status: this Stage is REVIEW ONLY — it makes NO code change of any
kind, and adds NO SQLite dependency of any kind.** Stage 3 of the Alpha
321–330 Board Durable Backend Selection & Architecture Arc.

## 1. Why now

Alpha 322 froze the requirement set. This Stage evaluates SQLite as the
candidate Desktop/local durable backend against it — comparison only,
no implementation, no dependency addition.

## 2. Findings

- **Runtime availability.** Not available in ANY environment this
  repository actually runs in today (Alpha 321): Cloudflare Workers'
  V8 isolate has no native module loading and no filesystem, ruling
  SQLite out there completely; Node COULD load a native or WASM SQLite
  binding, but none is present today, and Node is this repository's test
  harness, not a deployed host.
- **Dependency requirements.** A real SQLite backend needs either a
  native addon (`better-sqlite3`, `node:sqlite`) or a WASM build
  (`sql.js`) — either way, a NEW dependency this Arc's own Absolute
  Prohibitions forbid adding.
- **Native build burden.** A native addon requires a compiled binary per
  OS/architecture combination (`node-gyp` or prebuilt binaries) — a
  packaging burden with no existing pipeline in this repository to carry
  it (no Electron/Tauri packaging config exists, Alpha 321 §3.3).
- **Windows path behavior.** This exact checkout already demonstrates
  Windows path fragility unrelated to SQLite: `cargo test`'s MinGW
  `dlltool` step fails specifically because the checkout path contains
  spaces and non-ASCII characters (confirmed by this Arc's own baseline
  run). A native SQLite addon's own build step (also typically MinGW/MSVC
  on Windows) would face the identical class of risk — not a reason to
  reject SQLite outright, but a concrete, already-observed hazard any
  future native-addon adoption on this checkout must budget for.
- **Transaction support.** Excellent — real ACID transactions, native
  multi-statement atomicity, well beyond what Alpha 322's MUST list
  requires (single-record atomic writes only).
- **Corruption recovery.** Mature (WAL mode, `PRAGMA integrity_check`,
  well-documented recovery tooling).
- **Schema migration.** Mature ecosystem tooling exists, but none is
  bundled with SQLite itself — a migration library or hand-rolled runner
  would be a further dependency or a nontrivial in-house artifact.
- **Backup/export.** Trivial (`.dump`, file copy, `VACUUM INTO`).
- **Testability.** Good — an in-memory `:memory:` database gives fast,
  isolated tests once a driver exists.
- **Concurrent access.** Single-writer/multi-reader with WAL is
  well-suited to one local process; not designed for true multi-process
  concurrent writers without external coordination — matches this Arc's
  own NOT YET requirement (Alpha 322 §4), not a rejection reason.
- **Binary distribution.** The single largest concrete burden: prebuilt
  binaries per platform/arch, or a build step, with no existing
  Electron/Tauri/native packaging target in this repository to embed
  them in.
- **Electron/Tauri/Node compatibility.** Would work under Node in
  principle; Electron/Tauri do not exist in this repository at all
  (Alpha 321 §3.3) — there is no host process to embed a native addon
  into today.
- **Browser incompatibility.** Complete — no filesystem, no native
  binding path exists in a browser (and no browser environment exists
  here regardless, Alpha 321 §3.1).
- **Worker incompatibility.** Complete — Cloudflare Workers' V8 isolate
  supports neither native modules nor a local filesystem; SQLite is
  unreachable there directly (D1, a separate managed service, is
  Cloudflare's own answer to this — Alpha 325).
- **Operational maturity.** Extremely mature as a technology in the
  wider ecosystem; **zero** operational history inside this repository
  specifically.

## 3. What concrete shell/runtime would be required before implementation

1. A real Desktop host PROCESS (Electron, Tauri, or a plain packaged
   Node executable) — none exists today (Alpha 321 §3.3).
2. An explicit, separately-reviewed dependency-addition decision for a
   native or WASM SQLite driver — prohibited this Arc regardless.
3. A per-platform binary distribution or build story, since no packaging
   pipeline exists in this repository today.
4. A real caller — Board is wired into no production runtime yet (Alpha
   321 §3.4), so even a working SQLite backend would have nothing
   calling it in production.

## 4. Conclusion

SQLite is a mature, capable embedded database with real transactional
guarantees well beyond this Arc's own MUST requirements — but every one
of its real strengths (native transactions, WAL concurrency, mature
backup tooling) presumes a local host PROCESS this repository does not
have, and its adoption would require BOTH a new dependency (prohibited)
AND a Desktop shell that does not exist (Alpha 321 §3.3). Not rejected
on technical merit — deferred on the same "no real host" grounds
Alpha 321 already established.

## 5. See also

- `docs/secure_runtime_alpha_321_board_deployment_runtime_inventory.md`
- `docs/secure_runtime_alpha_322_durable_backend_requirements.md`
