# Secure Runtime Alpha 620 — Desktop Local Runtime Entry Point & Publish Pipeline Ownership Arc Completion

Stage 20 (completion) of the Alpha 601–620 Arc.

## Objective, restated, and closed

Alpha 601's own inventory confirmed: no Node entry point, no build
output, no production caller of `FedosDesktopHost` existed anywhere in
this repository. **Closed**: `src/desktop/runtime/` (Alpha 606) gives
`FedosDesktopHost` — Board Persistence/Hydration, Board Query, Durable
Outbox, Nostr Publisher (caller-injected), Delivery Observation,
Scheduler, Retry/Abandonment, Recovery Hydration, ALL pre-existing and
UNCHANGED — its first real, callable, subprocess-launchable local
runtime, without touching `src/worker.ts` or Cloudflare Worker
infrastructure of any kind.

## Completion checklist, per this Arc's own instruction

- **Real local Node caller:** `npm run start:runtime` (built via
  `tsc -p tsconfig.runtime.json`, no new dependency) launches
  `run_fedos_desktop_runtime.js` as a genuine, separate OS process —
  confirmed by real `child_process.spawn` execution, Alpha 619.
- **Explicit config/path authority:** `FedosDesktopRuntimeConfig` — no
  default path, no secret field, no `process.env` read (Alpha 603/604).
- **Durable Board/Outbox wiring:** real `AppendOnlyFedosBoardPersistence`/
  `AppendOnlyFedosBoardOutboxPersistence` (Alpha 353/418, UNCHANGED),
  used by a real caller for the first time (Alpha 607/608).
- **Honest Observation durability policy:** a NEW, minimal
  `AppendOnlyFedosDeliveryObservationPersistence` (Alpha 609) closes
  the gap the Alpha 581–600 Arc's own recovery machinery needed to be
  genuinely durable, rather than shipping delivery against a backend
  known to lose everything on restart.
- **Host lifecycle ownership:** `start()`/`startDelivery()`/`stopDelivery()`/
  `stop()` all called in the correct, pre-existing order; ownership
  never duplicated, only sequenced (Alpha 606/611/612).
- **Optional delivery activation:** `deliveryEnabled` gates
  `startDelivery()` entirely; disabled is the only path a bare CLI
  invocation can reach (Alpha 610/611).
- **Graceful shutdown:** `FedosRunningDesktopRuntime.stop()`, correctly
  ordered, non-idempotent by design (Alpha 612); `run_fedos_desktop_runtime.ts`
  owns `SIGINT`/`SIGTERM` per Node's documented API (Alpha 613).
- **No implicit startup:** verified structurally — no top-level
  statement in the testable module calls anything (Alpha 617).
- **No Worker coupling:** verified structurally — zero cross-references
  either direction (Alpha 616).
- **Restart verification:** the full ten-step scenario, real files,
  real second instance, real recovery (Alpha 615).

## Files changed

One modified file: `package.json` (+2 scripts, `build:runtime`/
`start:runtime` — zero new `dependencies`/`devDependencies`). One new
config: `tsconfig.runtime.json`. Three new runtime files:
`src/desktop/runtime/{fedos_desktop_runtime_config,fedos_desktop_runtime,run_fedos_desktop_runtime}.ts`.
One new durable backend: `src/board/observation/append_only_fedos_delivery_observation_persistence.ts`.
Nine new test files (Alpha 606/611/612/614/615/616/617/618/619), 36
new test cases. 19 new docs (Alpha 601–619, this file the 20th).
`p2p/`, Ontology, Humanizer, AI, `src/worker.ts`, Runtime crypto, Rust/
Cargo: untouched — confirmed by `git status --porcelain` and targeted
regex/`?raw`-source guards (Alpha 616/618), not merely by intent.

## Verification

- `npm run typecheck`: zero new errors (the one pre-existing,
  unrelated error, unchanged since Alpha 560/580/600).
- New tests: 9 files, 36/36 passing.
- Package.json-adjacent regression check
  (`test/runtime_wasm_*`/`worker_crypto_boundary.test.ts`): the SAME
  pre-existing, environment-level (this worktree's own CRLF checkout
  artifact) failures already characterized in the Alpha 561–580 and
  581–600 Arcs' own compatibility reviews, unrelated to and unaffected
  by this Arc's own `package.json` change (which touched only
  `scripts`, never `dependencies`/`devDependencies`) — zero new
  regressions.
- `git diff -- Cargo.toml`: empty — `cargo check` correctly not run.
- No generated artifact committed — `dist/` is already `.gitignore`d
  (unchanged, no new ignore rule needed); confirmed absent from `git
  status --porcelain`.
- `p2p/` untouched — confirmed absent from `git status --porcelain`.
- Main worktree untouched — all work performed in
  `../OS-worktrees/desktop-local-runtime` (`arc/desktop-local-runtime`).

## Remaining limitations, honestly recorded

- **GUI / packaging / OS service / native secret store:** none exist;
  none were in scope (this Arc's own Absolute Prohibitions: no
  Electron/Tauri).
- **ActivityPub/ATProto/Session Publisher:** still unimplemented —
  this Arc's own runtime fails closed by omission (Alpha 610), it adds
  no new Publisher for any protocol.
- **Full OS-process-crash test:** not performed — "real restart"
  verification (Alpha 615/589) uses the established "fresh instance,
  same durable backend" definition, not a literal `SIGKILL`-then-relaunch
  test.
- **OS-level SIGINT/SIGTERM delivery to the built executable:** NOT
  independently verified end-to-end in this session's own Windows-
  sandboxed test environment — three real, independent attempts
  (Node's `child.kill()`, `taskkill /PID`, this shell's native `kill`)
  each failed to reliably signal a spawned child process here. The
  handler code itself follows Node's documented API and is expected to
  work on a real POSIX target; this is disclosed as an unverified
  expectation, not a proven fact (Alpha 613/619).
- **Relay ACK semantics:** unchanged, out of scope — this Arc injects
  a caller-supplied Publisher; it does not construct or modify one.
- **CLI-reachable delivery activation:** the bare `run_fedos_desktop_runtime.js`
  executable can only start with `deliveryEnabled: false` — enabling
  delivery requires calling `startFedosDesktopRuntime()` directly, with
  a caller-injected Publisher object a CLI argument vector cannot carry
  (Alpha 610/613, a deliberate, disclosed boundary, not an oversight).

## Next Arc recommendation — ONE

**A. Durable Delivery Observation Backend Arc — already substantially
addressed by this Arc's own Alpha 609**, so re-ranked: the two
REMAINING named candidates are compared instead.

Between **B. Board Runtime Public Application API Arc** and
**C. Nostr Publisher ACK Correlation Arc**: **B is recommended.** This
Arc gives `FedosDesktopHost` a real local CALLER, but that caller is
still a bare process with no application-level API surface (HTTP,
IPC, or otherwise) for anything OTHER than the Board/Outbox/Delivery
primitives this runtime wires directly — `docs/secure_runtime_alpha_580_publish_scheduler_completion.md`'s
own Candidate C (named, not yet started) is the natural next step now
that a real process EXISTS to host such an API. Candidate C (Relay ACK
correlation) remains a real, valid gap, but is lower urgency: this
Arc's own Alpha 619 already confirms the Publisher boundary works
correctly with WHATEVER outcome a caller's Publisher reports, whether
or not that outcome is ACK-correlated upstream — ACK correlation
improves ACCURACY of an already-functioning boundary, while an
Application API is the difference between "a process exists" and
"anything outside a test can actually use it."

## Commit

One commit, per this Arc's own instruction:
`Add Secure Runtime Alpha 601-620: Desktop Local Runtime Entry Point Arc`.
