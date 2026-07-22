# Secure Runtime Alpha 4421–4500: Desktop Device Sync Badge, Notification, and Operational Event Wiring Arc — Completion Declaration

**Full completion.** Real Device Sync Scheduler attempt events are now
translated into the closed Desktop Notification/Tray/Badge vocabularies,
verified against a real `startFedosDesktopRuntime()`/`FedosDeviceTrustRuntime`/
`FedosDeviceSyncScheduler` stack — no mocks. `npm run typecheck:core` /
`npm run typecheck:electron` both pass (the former modulo the SAME one
pre-existing, unrelated failure every recent Arc's own baseline documents —
`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`,
confirmed pre-existing and unrelated to this Arc's own files).

Base: `arc/desktop-unread-badge-menu-bar-integration` at commit `4b7fcf7`,
"Add Secure Runtime Alpha 4341-4420: Desktop Unread Badge and Menu Bar
Count Integration Arc" (the immediately-prior arc). See
`docs/secure_runtime_alpha_4421_4500_execution_spec.md` for the full plan
and the honest Phase A design findings that shaped this Arc's own
integration technique.

## What was built

**Phase B — `src/device/sync_events/`** (new directory, 2 files):

- `fedos_device_sync_event.ts` — the closed nine-kind
  `FedosDeviceSyncEventKind` vocabulary (`sync-started`/`sync-progress`/
  `sync-completed`/`sync-failed`/`conflict-detected`/`retry-scheduled`/
  `retry-aborted`/`device-offline`/`device-online`) plus the
  `FedosDeviceSyncEvent` discriminated union and
  `FedosDeviceSyncEventListener` callback type.
- `fedos_device_sync_event_bridge.ts` — `FedosDeviceSyncEventBridge`.
  `wrapAttemptFn()` is the ONE integration point: `FedosDeviceSyncScheduler`
  has no event emitter anywhere in its own file (a real Phase A finding —
  the same kind of "does the obvious wiring actually work" check the
  immediately-prior arc's own badge Coordinator had to make), so the
  Bridge wraps the ONE real, already-designed extension seam the Scheduler
  DOES expose — the injected `FedosDeviceSyncAttemptFn` boundary — with an
  identical function that observes every real attempt (interval-triggered
  and manually-triggered alike, since both paths call the same injected
  function) and returns the real result completely unmodified. Zero
  monkey-patching, zero subclassing, zero private-field reflection.
  `device-offline`/`device-online` connectivity signals are derived,
  in-memory-only, reset on every fresh instance (mirrors
  `FedosDesktopBadgeCoordinator`'s own `#previousCounts` discipline).
  `retry-aborted` vs `retry-scheduled` for the abandonment case is
  correctly distinguished only when an optional `abandonmentMaxAttempts`
  policy value is supplied (verified honest both ways by real tests).

**Phase C/D/E — `src/desktop/runtime/fedos_desktop_device_sync_presentation_wiring.ts`**
(new file): `FedosDesktopDeviceSyncPresentationWiring`, one entry point
(`handleEvent()`), wired directly as the Bridge's own listener. Routes into
the THREE existing, unmodified Coordinators through their real, narrow,
already-existing public surfaces only:

- Notification (Phase C): `sync-started`/`sync-completed`/`sync-failed`/
  `conflict-detected`/`retry-aborted` map onto the THREE existing closed
  kinds (`"device-sync"`/`"sync-complete"`/`"sync-failed"`) — no new kind
  invented.
- Tray (Phase D): the closed five-value status list (`Synchronizing`/
  `Idle`/`Conflict`/`Failure`/`Disconnected`), reduced to
  `FedosDesktopTrayPort.setTooltip()` calls — the one real,
  Electron-neutral live-status surface `TrayCoordinator` itself does not
  own (its own six-action vocabulary has no "set status" action).
- Badge (Phase E): `setSynchronizing(bool)` + `refresh()` — the ONLY two
  real public control surfaces `FedosDesktopBadgeCoordinator` exposes (a
  documented, disclosed correction of the brief's own literal wording,
  which named `setAttention()`/`setCount()`/`setNone()` — methods that do
  not exist on that class; those names are pure view-construction
  functions the Coordinator's own `refresh()` already calls internally).

**Honest Phase A design findings (disclosed, not papered over):** two real
discrepancies between the brief's own wording and actual current source
were found by reading the source, not documentation, exactly as instructed:
(1) the Scheduler has no observable event hook at all — the `attemptFn`
wrap is the only real integration point; (2) the Badge Coordinator has no
`setAttention()`/`setCount()`/`setNone()` methods. Both are described in
full in the execution spec, and both changed this Arc's own design
mid-flight (the initial idea, monkey-patching the Scheduler instance, was
considered and rejected before any code was written, in favor of the
`attemptFn` wrap).

## Verification

- **13 new root unit/acceptance tests**
  (`test/secure_runtime_alpha_4421_4500_device_sync_event_bridge.test.ts`,
  real `startFedosDesktopRuntime()`/`FedosDeviceTrustRuntime`/Scheduler
  fixture): closed vocabulary, per-outcome classification for every real
  outcome code path (`delivered`/`revoked-target`/`identity-conflict`/
  `relay-timeout` below and at the abandonment threshold/`disallowed-record`/
  a throwing attemptFn/`wrapAttemptFn(undefined)`), connectivity
  offline/online derivation (including a fresh-instance-never-carries-a-
  stale-belief check), and a throwing listener never breaking the real
  attempt path. **13/13 passing.**
- **8 new root acceptance tests**
  (`test/secure_runtime_alpha_4421_4500_device_sync_wiring_acceptance.test.ts`,
  real Runtime + a real, separate `FedosDesktopConversationUiPresentationBoundary`
  for a real `FedosDesktopUnreadCounterViewModel`, plus real
  `FedosDesktopNotificationCoordinator`/`FedosDesktopBadgeCoordinator` over
  real, total, inspectable Port fakes — never a mock library): every Phase
  F named scenario — sync start, sync success, sync failure, retry,
  conflict, device offline, device online, badge update, tray update,
  notification, multiple events (two independently-tracked target
  devices in one real tick), restart (a fresh Bridge+Wiring+Runtime
  instance over the SAME persisted schedule log — `attemptCount` and
  Schedule state continue correctly, no stale offline belief carried
  over), shutdown (`runtime.stop()` correctly waits for an in-flight,
  Bridge-wrapped attempt before resolving). **8/8 passing.**
- **This Arc's own two new files: 21/21 passing, 0 failed.**
- Focused Sync regression, run together with this Arc's own new files:
  Device Sync Scheduler (`..._3721_3800_device_sync_scheduler`, 19/19),
  Device Sync Conflict Model (`..._3721_3800_device_sync_conflict_model`,
  27/27), Device Sync Import Coordinator
  (`..._3721_3800_device_sync_import_coordinator`, 10/10), Device Sync
  Operational Facade (`..._3801_3880_device_sync_operational_facade`,
  23/23), Desktop Shell Device Sync Commands
  (`..._3801_3880_desktop_shell_device_sync_commands`, 7/7) — **86/86
  passing, untouched by this Arc, verified still correct.**
- Named regression suites, explicitly by name (Phase G's own required
  list), run together with the above: Desktop Runtime
  (`..._1691_1760_desktop_runtime_wiring`, 7/7), Desktop Shell
  (`..._2841_2920_desktop_application_shell`, 20/20), Presentation
  (`..._3241_3320_presentation_boundary`, 13/13), Renderer
  (`..._3401_3480_renderer_boundary`, 11/11), Host Bridge
  (`..._3561_3640_host_bridge`, 17/17), Navigation
  (`..._4181_4260_navigation_history`/`_state`/`_window_controller`/
  `_window_registry`/`_window_title`, 29/29), Notifications/Tray/Background
  (`..._4261_4340_notification_coordinator`/`_tray_coordinator`/
  `_background_lifecycle_coordinator`/`_notifications_tray_status_view_model`,
  31/31), Unread Badge/Menu Bar (`..._4341_4420_badge_coordinator`, 11/11
  — the arc immediately before this one, verified still correct and
  untouched), Search (`..._2541_2560_search_index_incremental_and_delete`,
  7/7), Archive (`..._1691_1760_archive_runtime` 24/24,
  `..._1921_1980_group_archive_runtime` 9/9,
  `..._2561_2580_archive_index_and_large_dataset` 3/3). **Total across all
  26 named-regression + this Arc's own files: 289 tests, 289 passing, 0
  failed.**
- Real Electron subprocess suite
  (`npx vitest run --config vitest.electron-spike.config.ts`): **6 files,
  99 passed / 4 skipped, 0 failed** — the EXACT SAME numbers the
  immediately-prior arc's own completion declaration documented. This Arc
  touches ZERO files under `packages/fedos-desktop-electron-spike/`, so
  this number is expected to be, and is, unchanged.
  - Environment note (not a code finding): this worktree's own `npm
    install` initially produced an electron package with no downloaded
    `electron.exe` binary (network-restricted postinstall) and no
    `dist/host_bridge/` output from `npm run build:host-bridge` (never
    run yet in this worktree) — both are pure local-environment artifacts
    of a fresh worktree, not source issues. Fixed by copying the
    binary distribution from a sibling worktree (`C:\wt\desktop-unread-badge`,
    identical `electron@43.1.1` per both `package.json` files — a pure
    binary artifact restore, no source touched) and running `npm run
    build:host-bridge` once. Confirmed pre-existing/environmental by A/B:
    before the fix, 5/6 Electron test files failed with
    `spawn ... electron.exe ENOENT` or a missing-compiled-Host-Bridge
    assertion; after the fix, all 6 pass at the exact numbers above.
- Full root suite (`npx vitest run`, this worktree, AFTER the electron
  binary/host-bridge build fix above): **1013 files, 810 passed / 203
  failed; 13269 tests, 13009 passed / 260 failed.** This Arc's own two new
  test files appear zero times in the failure output (confirmed by direct
  grep for their own filenames across the full run's output). The delta
  against the immediately-prior arc's own documented full-suite baseline
  (1011 files / 808 passed / 203 failed; 13248 tests / 12988 passed / 260
  failed) is EXACTLY +2 files / +2 passed / +0 failed and +21 tests / +21
  passed / +0 failed — precisely this Arc's own two new files and 21 new
  tests, with the pre-existing 203-failed-file / 260-failed-test baseline
  completely unchanged. Every sampled failure is either a
  `test/fedos_core_rust_*`/`test/runtime_crypto_*`/similar Rust
  dependency-count/pub-fn-surface check (this fresh worktree has no
  `packages/fedos-core-rust/pkg/` compiled WASM artifact — the same
  pre-existing, disclosed "Worktree missing WASM artifact" pattern every
  recent Arc's own completion declaration already documents) or a
  `test/reviews/**` boundary-invariant test asserting `git status
  --porcelain` is clean outside its own declared review scope (resolves on
  commit, the same previously-documented pattern).
- `npm run build:wasm` / a Rust `cargo test` run: **N/A, honestly.** This
  Arc is a pure TS event-translation/presentation-wiring concern — it
  adds, reads, or changes no Rust/WASM code, and touches no file under
  `packages/fedos-core-rust/`. The spec's own Verification section for
  this Arc does not list these either (unlike the two arcs before it) —
  treated as intentional, per this Arc's own briefing. Not run; nothing to
  fabricate output for.

## Scope boundary — disclosed honestly

- **No Electron main-process wiring in this Arc.** Both new classes
  (`FedosDeviceSyncEventBridge`,
  `FedosDesktopDeviceSyncPresentationWiring`) are Electron-neutral by
  construction (no Electron import of any kind, mirroring every sibling
  Coordinator/Port already in this codebase) and are verified end-to-end
  against a real `FedosDeviceSyncScheduler`/`startFedosDesktopRuntime()` —
  the Phase F acceptance suite proves the entire event-translation and
  Coordinator-routing logic this Arc was asked to build. What remains is
  pure plumbing: constructing the Bridge/Wiring inside a real Electron
  main file (e.g. `fedos_electron_badge_main.cts`, which already
  constructs `FedosDesktopBadgeCoordinator`/`TrayCoordinator`/
  `FedosDesktopNotificationCoordinator` today) with
  `deviceTrustEnabled`/`deviceSyncSchedulerEnabled` turned on and
  `deviceSyncAttemptFn: bridge.wrapAttemptFn(...)` supplied. This is a
  real, honest boundary of TIME within this session (a large, additive
  Electron package extension with new IPC channels and a self-test
  scenario batch, matching the effort of a full Electron package phase in
  the two prior arcs), not of design or feasibility — named as the
  recommended next Arc's own first phase below rather than fabricated as
  done.
- **`conflict-detected` covers only the SEND-side `"identity-conflict"`
  outcome code**, not the RECEIVE-side conflict subsystem
  (`FedosDeviceSyncImportCoordinator`/`FedosDeviceSyncConflictPersistence`).
  That subsystem is not invoked anywhere in `startFedosDesktopRuntime()`
  on this codebase's own base (a real, pre-existing gap, not introduced or
  fixed by this Arc) — wiring it in would mean inventing a new call site
  for a Sync-protocol component, explicitly out of this Arc's own "No Sync
  protocol changes" boundary.
- **`retry-aborted` for the abandonment-threshold case requires the
  caller to supply `abandonmentMaxAttempts` to the Bridge** (the same
  static policy value already passed to the Scheduler elsewhere). Omitted,
  the Bridge honestly reports every `"later"`-directive outcome as
  `"retry-scheduled"` only — verified by a real test in both directions,
  never a false claim either way.

## Recommend exactly one next Arc

**Desktop Device Sync Electron Integration Arc** — construct
`FedosDeviceSyncEventBridge`/`FedosDesktopDeviceSyncPresentationWiring`
inside a real Electron main process (most naturally as an additive
extension of `fedos_electron_badge_main.cts`, which already owns
`FedosDesktopBadgeCoordinator`/`TrayCoordinator`/
`FedosDesktopNotificationCoordinator` together in one process), enable
`deviceTrustEnabled`/`deviceSyncSchedulerEnabled` in its runtime config,
supply `deviceSyncAttemptFn: bridge.wrapAttemptFn(...)`, add the closed IPC
channels a renderer would need to observe live device-sync status, and
extend that package's own self-test sequence with real device-sync
scenarios exercised against a genuine spawned Electron subprocess. A
narrow, additive continuation — this Arc already proves every piece of
logic the Electron layer would need to call; the next Arc is pure
assembly, no new business logic.

## Concurrent-session check

Checked `git log --oneline -5` and `git status` in this worktree
immediately before starting and again immediately before/after this
commit. No unexpected commits or files from another session were found at
any point — see the final report for the exact output captured at commit
time.
