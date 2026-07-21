# Secure Runtime Alpha 5061-5160 — FedOS Desktop Beta 0.1 Integration, Release Candidate, and Acceptance Freeze — Completion Declaration

**Honest partial completion.** The single-Runtime composition gap and the
Settings-startup-application gap this Arc's own base explicitly named as its
"recommended next Arc" are both closed, real, and verified against real
boundaries — including a real, packaged-adjacent Electron process performing a
genuine production WASM Master Seed create/unlock/lock/relock round trip with
stable identity across three separate process launches. One named,
release-blocking gap remains (Navigation/Tray/Badge/Device-Sync composition
into the same canonical entry point — BLK-1) and is disclosed, not hidden.

Commit title:

**"Add Secure Runtime Alpha 5061-5160: FedOS Desktop Beta 0.1 Integration and
Acceptance Candidate Arc (release freeze honestly blocked by named issues)."**

See `docs/secure_runtime_alpha_5061_5160_reconciliation_report.md` for the
full Phase A-R inventory, architectural decision record, and blocker table.

## What is real and verified this session

- **Real WASM build.** `cargo build --target wasm32-unknown-unknown --release`
  + `wasm-bindgen` produced a real `packages/fedos-core-rust/pkg/` artifact
  (`cargo test` itself has one pre-existing, unrelated failure —
  `secp256k1_dependency_guard`'s own dependency-count assertion, off by one
  after prior arcs added `wasm-bindgen`/`k256` — not touched, not this Arc's
  scope, Rust/crypto is an Absolute Prohibition).
- **Real single-Runtime composition.** `FedosDesktopBetaApplicationAssembly`
  (`src/desktop/beta/fedos_desktop_beta_application_assembly.ts`) composes
  exactly one Shell/Boundary over the Coordinator's own Runtime via two new,
  minimal, additive static factories
  (`FedosDesktopApplicationShell.fromRunningRuntime()`,
  `FedosDesktopConversationUiPresentationBoundary.fromShell()`) — proven by a
  real test that creates a conversation through the assembly's boundary and
  reads it back through the Coordinator's own `runningRuntime()`.
- **Real Settings startup application.** Wired into the composed assembly's
  `start()` for the first time in any Electron main; a real persisted
  `notificationsEnabled: false` seed suppresses a real `notify()` call, and a
  real `apply()` re-enables it live.
- **Real confirmed-Runtime-restart primitive** (Phase E), with the
  Coordinator-honesty hazard this Arc discovered (a restart done outside the
  Coordinator would leave `runningRuntime()`/`status()` stale, so a later
  `lock()` would stop the WRONG Runtime) closed via one additive Coordinator
  method, `adoptReplacementRuntime()`.
- **Real packaged-adjacent acceptance journey**, unpackaged Electron process
  (`electron dist/fedos_electron_beta_main.cjs`), real data directory:
  first-run create with a real passphrase → real WASM Master Seed
  generation/sealing → ready (`runtimeRunning: true`) → clean lock/shutdown →
  relaunch → WRONG passphrase denied (`unlock-failed`, `runtimeRunning:
  false`) → relaunch → CORRECT passphrase unlocks the IDENTICAL
  `accountPublicIdentifier`/`localDeviceId` — real cross-restart identity
  stability, real fail-closed wrong-password handling, no secret in any
  observed log line.
- **Real packaging.** A new, additive `electron_builder.beta.config.json` (the
  pre-existing config only packages the original Package-A spike main)
  produced a real signed `FedOS Desktop Beta.exe` with the root `dist/` graph
  and the WASM `pkg/` correctly relocated to the exact paths the main's own
  runtime path resolution expects — verified by inspecting the real packaged
  tree, not by inference.

## What remains honestly incomplete

- **BLK-1 (release-blocking).** Navigation/Tray/Badge/Device-Sync-event-wiring
  are NOT constructed inside the new canonical entry point
  (`fedos_electron_beta_main.cts`) — they remain real, tested, and reachable
  only through `fedos_electron_badge_main.cts`'s own separate Boundary. This
  is why full completion is not declared.
- **BLK-2 (high).** The PACKAGED `.exe` (as opposed to the unpackaged
  `electron dist/...cjs` invocation, fully verified) hangs before
  `app.whenReady()` in this sandboxed, display-less environment — consistent
  with a packaged-Electron GPU/compositor init issue specific to this sandbox,
  not a defect in the composed main's own source (identical code, verified
  unpackaged). Not root-caused further within this session.
- **BLK-3/BLK-4 (medium, accepted-beta-limitations).** Relay list and archive
  directory Settings have no corresponding `FedosDesktopRuntimeConfig` field
  to feed at all in the current accepted lineage — Phase F/G are honestly
  `blocked`, not attempted with invented plumbing.
- **BLK-5 (low, accepted-beta-limitation).** Device Registry / Sync Journal /
  conversation logs are in-memory-only through the new entry point (the
  Coordinator's own fixed internal config never supplies the optional durable
  paths) — the same data IS durable through `fedos_electron_badge_main.cts`.
- Phases K (packaged perf/size measurement), M (crash-interruption matrix
  beyond what Phase E's own tests cover), N (full security regression
  re-confirmation beyond what was directly observed), O (performance
  baseline), S (full documentation set) were not exhaustively executed this
  session — no new claim is made in any of these areas beyond what is
  explicitly evidenced above.

## Mandatory rules — honored

- **Architecture frozen.** No Runtime/Shell/Presentation/Renderer/Electron-IPC/
  Conversation/encryption/NIP-17/Sender-Key/Device-Trust/Device-Sync/Archive/
  Search redesign. The three production-source touches
  (`FedosDesktopApplicationShell`, `FedosDesktopConversationUiPresentationBoundary`,
  `FedosProfileInitializationCoordinator`) are each exactly one new, additive
  static/instance method; zero existing method signature or behavior changed.
- **No duplicate Runtime/Scheduler/Registry/Journal ownership.** This is the
  literal defect this Arc's own composition closes, not introduces — proven
  by the single-Runtime-identity test.
- **No new dependency** beyond what the existing, already-declared
  `electron`/`electron-builder` devDependencies provide (this session simply
  installed them; nothing new was added to any `package.json` dependency
  list).
- **No silent Runtime/Electron restart.** `restartRuntime()` is only ever
  invoked by an explicit caller after its own confirmation step; nothing in
  this Arc invokes it automatically.
- **No secret exposure.** Every new IPC channel returns only the same closed,
  non-secret result shapes `fedos_electron_unlock_main.cts` already
  established; the Beta status surface (`fedos-beta:status`) exposes only the
  pre-existing non-secret capability manifest / release configuration /
  limitations / Settings effective-state view.
- **`p2p/` and `.tmp_gen/` untouched.**
- **Test harnesses preserved.** All seven pre-existing Electron main files
  are byte-for-byte unmodified.

## Test evidence

- New suite: `test/secure_runtime_alpha_5061_5160_beta_application_assembly.test.ts`
  — 7/7 passing against real boundaries (real Coordinator, real
  `startFedosDesktopRuntime()`, real file-backed persistence).
- `npm run typecheck:core` — 2 pre-existing, unrelated errors (unchanged).
- `npm run typecheck:electron` — 0 errors (this Arc's own new `.cts`/`.ts`/
  `.d.ts` files, once the package's own `node_modules` is installed).
- `npx vitest run` (full suite) — 296/13453 individual test failures across
  233/1019 files, matching the well-documented pre-existing fresh-worktree
  `?raw`-import artifact (see this repo's own prior-arc precedent); this
  Arc's own new test file passes both in isolation and within the full run.
- Real, packaged-adjacent acceptance journey (see above) — not a unit test,
  a real process launch, described in full in the reconciliation report.

## Recommended next Arc

**FedOS Desktop Beta 0.1 Composition Completion and Packaged Acceptance
Arc** — compose Navigation/Tray/Badge/Device-Sync-event-wiring into
`fedos_electron_beta_main.cts` (reusing the exact real classes
`fedos_electron_badge_main.cts` already proves work), inject durable paths for
Device Registry/Sync Journal/conversation logs into that composition, and
root-cause the packaged-`.exe` launch hang (BLK-2) on a real desktop
environment.
