# Secure Runtime Alpha 4501–4580: Desktop Device Sync Electron Main Integration Arc — Completion Declaration

**Full completion.** `FedosDeviceSyncEventBridge`/`FedosDesktopDeviceSyncPresentationWiring`
(Alpha 4421-4500, both reused UNMODIFIED) are now constructed inside a real
Electron main process — `packages/fedos-desktop-electron-spike/src/fedos_electron_badge_main.cts`,
extended IN PLACE — attached during startup, destroyed during shutdown,
with idempotent double-startup and double-shutdown guards, verified against
a real, spawned Electron subprocess with a real
`startFedosDesktopRuntime()`/`FedosDeviceSyncScheduler`/`FedosDesktopNotificationCoordinator`/
`TrayCoordinator`/`FedosDesktopBadgeCoordinator` stack.

Base: `arc/desktop-device-sync-badge-notification-wiring` at commit
`f77d525`, "Add Secure Runtime Alpha 4421-4500: Desktop Device Sync Badge,
Notification, and Operational Event Wiring Arc" (the immediately-prior
arc). See `docs/secure_runtime_alpha_4501_4580_execution_spec.md` for the
full plan, the Phase A inventory of all five Electron main files, and the
honest Phase A design findings that shaped this Arc's own integration
technique.

## Two naming corrections verified against real source (disclosed)

1. The brief's "FedosElectronHostBridge" is really `FedosDesktopHostBridge`
   (`src/desktop/host_boundary/fedos_desktop_host_bridge.ts`) — read in
   full, along with every one of its own usages, and NOT constructed
   anywhere by this Arc: it owns a private Boundary/Renderer pair with no
   concept of "window" and no way to reach the Notification/Tray/Badge
   Coordinators this Arc needs, the same reason two prior Electron main
   files already gave for constructing their own Boundary instead.
2. `FedosDesktopBadgeCoordinator`'s real public surface is
   `setSynchronizing()` + `refresh()`, not `setAttention()`/`setCount()`/
   `setNone()` — already corrected by the immediately-prior arc, restated
   here since the reused Wiring class is what actually calls those two
   real methods.

## What was built

**Phase A — Inventory, independently verified.** All five Electron main
files' own headers (and, for the two most relevant, their full source)
were read before writing any code. Confirmed: `fedos_electron_badge_main.cts`
(Package F, Alpha 4341-4420) is the ONLY file that already constructs
`FedosDesktopNotificationCoordinator`/`TrayCoordinator`/`FedosDesktopBadgeCoordinator`
together, over one shared `FedosElectronTrayAdapter`, in one process — the
one, correct extension point. Extended IN PLACE, not as a new sibling
package (the first Arc in this lineage to do so, and correctly so — a new
sibling would require constructing a second, competing Boundary/Shell/
Runtime/Coordinator set to reach the same three Coordinators, exactly the
duplicate-ownership violation this Arc's own hard rules forbid).

**Phase B — construct the Wiring exactly once.** `fedos_electron_badge_main.cts`
gains two more dynamically-imported compiled modules (`FedosDeviceSyncEventBridge`,
`FedosDesktopDeviceSyncPresentationWiring`, both UNMODIFIED), a
`deviceSyncRuntimeConfigFields()` helper that turns `deviceTrustEnabled`/
`deviceSyncSchedulerEnabled` on for the real, long-lived Boundary start
(never the temporary conversation-seeding raw runtime), and threads
`eventBridge.wrapAttemptFn()` into `deviceSyncAttemptFn`. `wiring` is
constructed exactly once, immediately after its three real Coordinator
deps exist, reusing the SAME shared Tray adapter — never a second Tray, a
second Boundary, or a second Scheduler. Both `eventBridge`/`wiring` are
ordinary module-level `let` bindings, the SAME pattern every other
Coordinator in this file already uses — not a global singleton in any
stronger sense.

A real, disclosed side effect: `TrayCoordinator`'s existing `"pause-sync"`/
`"resume-sync"`/`"device-sync-status"` actions (Alpha 4261-4340,
UNMODIFIED) were wired but inert on every real launch before this Arc (the
Scheduler they call into was never constructed). They are now genuinely
functional, with zero changes to `TrayCoordinator` itself.

**Phase C — Lifecycle.** `hostStarted`/`shutdownInitiated` module-level
guards make `startBadgeHost()`/`performCleanShutdown()` real, safe,
logged no-ops on a second call — proven, not merely asserted, via a real
object-identity comparison (`badgeCoordinator`/`wiring`/`eventBridge`
before vs. after a deliberate second `startBadgeHost()` call) and a real
count of how many times `"shutdown clean"` appears in a real process's own
stdout after two real `performCleanShutdown()` calls. `wiring`/`eventBridge`
are nulled before `app.quit()` (neither owns a timer of its own — the real
Scheduler's own timer is already stopped one line above, via the existing
`runtimeStatus.stop()` chain). Restart/window-close/background-mode are
unaffected by this Arc (restart is always a fresh OS process; window close
and background-mode paths are untouched code, still exercised by the
pre-existing badge selftest, which still passes unmodified).

**Honest, disclosed Phase A finding (found by reading real source, not
assumed):** `FedosDesktopApplicationShell` exposes Device Sync OPERATIONAL
commands only — it has NO device REGISTRATION surface reachable from
Electron (`registerDevice()`/`confirmTrust()`/`recordLocalChange()` exist
only on the raw `FedosRunningDesktopRuntime.deviceTrust()`, never exposed
by Shell/Boundary). Separately, the Sync Journal (`FedosSyncState`) has no
durable-path config field anywhere in this codebase — constructed fresh,
in-memory, on every `startFedosDesktopRuntime()` call — so even this
file's own established "temporary raw seed runtime over the same log
files" technique (already used for the seeded conversation) cannot carry a
seeded Sync Journal entry into the real, long-lived Boundary runtime.
Verified by reading `fedos_device_sync_target_planning.ts` in full: a
target device with an empty pending range is skipped from every plan.
**Net effect: this real process's own real Scheduler, with real Device
Trust enabled, has no reachable way to ever have a real, trusted,
in-range target device today.** Every real `triggerSyncNow()` in this
Arc's own self-test honestly reports its own real, loaded status with
`scheduleCount: 0`/`pendingCount: 0` — never a fabricated attempt. To still
prove the real, live Notification/Badge/Tray Coordinators this process
constructs correctly receive and process Device Sync events end-to-end,
the new Device Sync selftest drives `wiring.handleEvent()` directly with
hand-built, schema-valid `FedosDeviceSyncEvent` objects — the identical
method, and identical code path, a genuine Scheduler-sourced event would
take. A second, smaller finding: `isTargetBelievedOffline()` lives on the
Bridge, not the Wiring, and is never populated by a directly-driven Wiring
event — the selftest checks it stays honestly `false`, proving isolation
rather than a false positive.

**Phase D — Acceptance tests.** New file
`packages/fedos-desktop-electron-spike/src/fedos_electron_badge_device_sync_selftest.ts`
(6 real steps: `scheduler-enabled`, `resume-sync`, `trigger-now-zero-targets`,
`event-routing`, `device-connectivity-routing`, `pause-sync`), invoked from
`fedos_electron_badge_main.cts`'s own `FEDOS_ELECTRON_BADGE_AUTOTEST=1` path
after the pre-existing badge selftest. New file
`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_4501_4580_device_sync_electron_acceptance.test.ts`
(9 tests): build/dist-presence, "no redesign/no duplicate ownership"
structural proofs (exactly one construction site each for the Boundary/
Bridge/Wiring, zero `FedosDesktopHostBridge` reference, the identical nine
`fedos-badge:*` IPC channels — zero new IPC surface added), a real,
ordinary (non-AUTOTEST) subprocess launch, and a real AUTOTEST subprocess
run asserting every Device Sync selftest step's own real result shape plus
the double-startup/double-shutdown idempotency proofs.

## Verification

- `npm run typecheck:core` — passes, modulo the SAME one pre-existing,
  unrelated, documented failure every recent Arc's own baseline carries
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`).
- `npm run typecheck:electron` — passes, zero errors.
- `npm run build:runtime` / `npm run build:host-bridge` / `npm run
  build:electron-spike` — all three succeed.
- **Full real Electron subprocess suite**
  (`npx vitest run --config vitest.electron-spike.config.ts`): **7 files,
  108 passed / 4 skipped, 0 failed** — the pre-existing 6 files' own
  99/4/0 numbers unchanged, plus this Arc's own new file, 9/9 passing (one
  transient timing flake on the FIRST run of the plain-launch subprocess
  test — empty captured stdout within the 8s wait window, not a real
  crash; the manually-spawned same binary produced the expected output
  immediately — confirmed non-deterministic/environmental, not a code
  defect, by two subsequent clean 9/9 runs: once standalone, once again
  inside the full 7-file/108-test suite run below; disclosed here rather
  than silently re-run until green without comment).
- **Focused Device Sync regression** (root `test/`, run together): the
  immediately-prior arc's own 21 tests (Event Bridge + Wiring, Alpha
  4421-4500) plus Scheduler (19)/Conflict Model (27)/Import Coordinator
  (10)/Operational Facade (23)/Desktop Shell Device Sync Commands (7) —
  **107 tests, 107 passing, 0 failed**, all untouched by this Arc,
  verified still correct.
- **Named regression suites**, run together: Desktop Runtime Wiring (7),
  Desktop Application Shell (20), Presentation Boundary (13), Renderer
  Boundary (11), Host Bridge (17), Navigation ×5 (History/State/Window
  Controller/Window Registry/Window Title, 29 total), Notifications/Tray/
  Background ×4 (Notification Coordinator/Tray Coordinator/Background
  Lifecycle/Status ViewModel, 31 total), Unread Badge/Menu Bar (Badge
  Coordinator, 11), Search (7), Archive ×3 (Archive Runtime/Group Archive
  Runtime/Archive Index, 36 total) — **182 tests, 182 passing, 0 failed.**
- **Full root suite** (`npx vitest run`): **1013 files, 810 passed / 203
  failed; 13269 tests, 13009 passed / 260 failed** — the EXACT SAME
  numbers the immediately-prior arc's own completion declaration
  documented. This Arc adds zero files under root `test/` (its own two new
  files live entirely under `packages/fedos-desktop-electron-spike/`), so
  this number was expected to be, and is, byte-for-byte unchanged — every
  one of the 203/260 pre-existing failures is the same disclosed,
  pre-existing "Worktree missing WASM artifact"/`test/reviews/**`
  git-status-clean pattern every recent arc's own completion declaration
  already documents.
- `npm run build:wasm` / a Rust `cargo test` run: N/A, honestly — this Arc
  is a pure TS Electron-wiring concern, adds/reads/changes no Rust/WASM
  code, touches no file under `packages/fedos-core-rust/`. Not run;
  nothing to fabricate output for.
- **Environment note (not a code finding):** this fresh worktree's own
  `npm install` had not been run at all (no `node_modules` anywhere,
  including no `electron.exe`, and no compiled `dist/`). Fixed by copying
  the `node_modules` binary distributions (root and
  `packages/fedos-desktop-electron-spike/`) from a sibling worktree at the
  SAME base commit with the identical `electron@43.1.1`
  (`C:\wt\desktop-device-sync-badge-wiring`) via `robocopy`, then running
  `npm run build:runtime`/`build:host-bridge`/`build:electron-spike`
  fresh from THIS worktree's own (modified) source — a pure
  dependency-binary restore, no source touched, no shortcuts taken on the
  actual build. Confirmed correct by the clean typecheck/build/test runs
  above.

## Scope boundary — disclosed honestly

- **No device-pairing/registration flow reachable from Electron.** This
  Arc's own real Scheduler, inside the real Electron process, has zero
  reachable path to a real, trusted, in-range target device (see the
  Phase A finding above) — this is a pre-existing architectural gap
  (Shell/Boundary never exposed a registration surface, and the Sync
  Journal has no durable-path config anywhere in this codebase), not
  introduced or masked by this Arc, and explicitly out of this Arc's own
  scope ("No Sync protocol changes"). The event-translation and
  Coordinator-routing logic itself is fully proven, twice over: once by
  the immediately-prior arc's own 21 tests against a real, directly-driven
  Scheduler, and once by this Arc's own selftest driving the SAME real,
  live, Electron-hosted Coordinators directly.
- **Device Registry persists (`deviceRegistryLogPath`), Sync Journal does
  not.** A future arc that adds a real device-pairing flow would only need
  to reach `runtime.deviceTrust()` from Electron (currently unreachable
  through Shell) — the Sync Journal's own "always fresh, in-memory"
  behavior on every runtime start is a separate, deeper, pre-existing
  architectural fact, unrelated to Electron wiring, and would need its own
  disclosed design decision in whatever arc addresses it.
- **`deviceSyncIntervalMs`/`deviceSyncAbandonmentPolicy` use fixed,
  reasonable literals** (`30_000`ms default interval, unchanged;
  `{maxAttempts: 5, laterDelaySeconds: 30}`) — this Arc makes no UX
  decision about whether Device Sync should start automatically on every
  real launch (it does not; `deviceSyncStatus.start()` is only ever called
  via the pre-existing Tray "resume-sync" action or this Arc's own
  self-test, never unconditionally at startup) — a deliberate,
  conservative choice matching this Arc's own "pure plumbing, no new UX
  decision" scope.

## Recommend exactly one next Arc

**Desktop Device Sync Registration and Pairing Arc** — the ONE remaining
piece this Arc's own Phase A finding surfaced: expose a real, narrow
pass-through from `FedosDesktopApplicationShell` (mirroring its own
existing "delegates entirely to `FedosRunningDesktopRuntime.deviceSyncOperational()`"
idiom, already used for 10 Operational commands) to
`FedosRunningDesktopRuntime.deviceTrust()`'s `registerDevice()`/
`confirmTrust()`/`recordLocalChange()`, reachable from Electron — plus,
separately, a disclosed design decision on whether/how the Sync Journal
should gain a durable-path config field so a registered device's pending
changes survive a real process restart. This is the true remaining
blocker to a real, trusted, in-range target device ever existing inside a
real Electron process — everything downstream of it (event translation,
Coordinator routing, Electron construction/lifecycle) is now fully built
and verified by this Arc and the one before it.

## Concurrent-session check

Checked `git log --oneline -5` and `git status` in this worktree
immediately before starting and again immediately before/after this
commit. No unexpected commits or files from another session were found at
any point — see the final report for the exact output captured at commit
time.
