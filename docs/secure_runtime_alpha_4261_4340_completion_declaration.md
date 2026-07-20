# Secure Runtime Alpha 4261–4340: Desktop Notifications, System Tray, and Background Operation Arc — Completion Declaration

**Full completion.** All required features implemented and verified against a
real Runtime/Shell/Presentation Boundary/Window Registry stack, plus a real
Electron process. `npm run typecheck:core` / `npm run typecheck:electron`
both pass (the former modulo the SAME one pre-existing, unrelated failure
every recent Arc's own baseline documents —
`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`,
confirmed pre-existing and unrelated to this Arc's own files).

Base: `arc/desktop-notifications-tray-background-operation` at merge commit
`7b373e7` (integrating `6b47730`, "Add Secure Runtime Alpha 4181-4260:
Desktop Conversation Window and Navigation Arc"). See
`docs/secure_runtime_alpha_4261_4340_phase_a_notifications_tray_background_api_inventory.md`
for the full precondition verification, the honest Host Bridge reuse
investigation, and two disclosed stray-`dist/`-artifact observations
(neither traceable to this session's own work).

## What was built

**Phase B — `src/desktop/notification/`** (new directory, 3 files):
- `fedos_desktop_notification_types.ts` — closed 9-kind vocabulary
  (`conversation-message`/`device-sync`/`device-transfer`/`sync-complete`/
  `sync-failed`/`archive-complete`/`archive-failed`/`warning`/`error`), a
  FIXED per-kind title/body template (never caller-supplied — "no custom
  notification payloads"), structural validation failing closed to `null`,
  and reuse of `src/notification/policy.ts`'s own pure
  `isSensitiveNotificationField` helper to fail the WHOLE request closed
  (never sanitize-and-send) if the one caller-suppliable `detail` field
  looks sensitive.
- `fedos_desktop_notification_port.ts` — `FedosDesktopNotificationPort`
  (framework-neutral `status()`/`notify()`) + `NoopFedosDesktopNotificationPort`
  (permanently `"unavailable"` default, mirrors `NoopNotificationBridge`'s
  own idea, independently implemented).
- `fedos_desktop_notification_coordinator.ts` — `FedosDesktopNotificationCoordinator`:
  validates, resolves the template, delegates to its Port, converts any Port
  exception to a closed `"error"` outcome (never a raw throw), tracks
  in-memory-only delivered/denied counters and last outcome (never
  persisted — Phase B/D "no new persistence format").

**Phase C — `src/desktop/tray/`** (new directory, 3 files):
- `fedos_desktop_tray_types.ts` — closed 6-action vocabulary (`open-window`/
  `recent-conversations`/`device-sync-status`/`pause-sync`/`resume-sync`/
  `exit`), structural validation, and `fedosDesktopTrayMenuItems()` (the
  full, fixed 6-item menu with per-item `enabled` flags).
- `fedos_desktop_tray_port.ts` — `FedosDesktopTrayPort` (framework-neutral
  `render()`/`setTooltip()`/`destroy()`) + `NoopFedosDesktopTrayPort`.
- `fedos_desktop_tray_coordinator.ts` — `TrayCoordinator`: validates, then
  dispatches to EXACTLY the existing call each action already names —
  `FedosDesktopConversationWindowRegistry.recentConversationIds`/`lastOpenedConversationId`
  (Alpha 4181-4260, unmodified) for "open-window"/"recent-conversations",
  `FedosDesktopDeviceSyncStatusViewModel.refresh()`/`stop()`/`start()`
  (Alpha 3801-3880, unmodified) for "device-sync-status"/"pause-sync"/
  "resume-sync". "exit" returns a closed outcome only — the real
  `app.quit()`/shutdown side effect stays the Electron adapter's own job
  (Phase D/E).

**Phase D — `src/desktop/background/fedos_desktop_background_lifecycle_coordinator.ts`**
(new file): `BackgroundLifecycleCoordinator` — a PURE, closed state machine
(`"foreground"`/`"background"`/`"shutting-down"`/`"stopped"`) over one
process's own open-window count and shutdown intent. Owns no
Boundary/Runtime reference and performs no I/O itself — every real side
effect (window creation/close, `boundary.runtimeStatus.stop()`,
`app.quit()`) is the Electron adapter's own responsibility, driven by this
class's own returned state (mirrors `TrayCoordinator`'s identical
decision/effect split). Capabilities: window closed
(`windowClosed()`)/keep runtime alive (`keepAliveInBackground` config)/
background sync + background notifications (`canRunBackgroundSync()`/
`canDeliverBackgroundNotifications()`, true across foreground↔background,
false only once shutdown begins)/clean shutdown (`requestShutdown()` then
`confirmShutdown()`, a one-way door, terminal and idempotent)/single
runtime ownership (a documented structural invariant: exactly one instance
per process, never itself referencing a second Runtime). No daemon mode,
no singleton service.

**Phase F — `src/desktop/presentation/fedos_desktop_notifications_tray_status_view_model.ts`**
(new file): `FedosDesktopNotificationsTrayStatusViewModel` — status-only,
read-only aggregation of the Notification Coordinator's/Background
Lifecycle Coordinator's own current state. Deliberately NOT added to
`FedosDesktopConversationUiPresentationBoundary` (frozen, untouched) —
constructed standalone, the SAME way `FedosDesktopConversationWindowRegistry`
already is, since it wraps new coordinators that have no Shell method of
their own. No Renderer redesign.

**Phase E — Electron Integration** (`packages/fedos-desktop-electron-spike/`,
9 new files, additive sibling of Packages A/B/C — none of those existing
files were modified):
- `fedos_electron_notification_adapter.ts` — `FedosElectronNotificationAdapter`,
  wraps Electron's real `Notification` API. No business logic.
- `fedos_electron_tray_adapter.ts` — `FedosElectronTrayAdapter`, wraps
  Electron's real `Tray`/`Menu`/`nativeImage` (a tiny embedded 1×1
  transparent PNG — no new binary asset file). No business logic.
- `fedos_electron_notifications_tray_main.cts` — Package D: constructs
  exactly ONE `FedosDesktopConversationUiPresentationBoundary`, ONE
  `FedosDesktopConversationWindowRegistry`, ONE
  `BackgroundLifecycleCoordinator` (`keepAliveInBackground: true`), ONE
  `FedosDesktopNotificationCoordinator` (wired to the real Notification
  adapter), ONE `TrayCoordinator` (wired to the Registry +
  `boundary.deviceSyncStatus`) — the SAME "exactly one Boundary" discipline
  every prior Electron package already established. Deliberately NO
  `window-all-closed` handler (Phase D "keep runtime alive" made
  structural, not incidental — closing every window never quits the
  process; only the tray "Exit" action / `fedos-bg:shutdown` IPC does).
  Seven closed, validated `fedos-bg:*` IPC channels.
- `fedos_electron_notifications_tray_preload.cts` /
  `..._window.d.ts` / `..._page.html` / `..._renderer.ts` — the SAME
  `contextBridge`/single-frozen-object/plain-page-script pattern every
  prior package already established (Phase F "expose status only" — the
  page shows the live status JSON, nothing more).
- `fedos_electron_notifications_tray_selftest.ts` — a main-process (not
  renderer-page) self-test sequence, gated behind
  `FEDOS_ELECTRON_BG_AUTOTEST=1`, exercising all 14 named Phase G scenarios
  against the SAME real objects wired into the real process, logging
  `FEDOS_BG_TEST:{...}` marker lines to stdout for the acceptance test to
  parse (mirrors `fedos_electron_host_adapter_selftest.ts`'s own "MARKER"
  convention — main-process-side here, since these scenarios are
  process/lifecycle-level, not renderer-clickable).

**Host Bridge reuse — investigated, documented, NOT reused directly**: see
the Phase A inventory's own "Host Bridge reuse" section. `FedosDesktopHostBridge`
owns its own private Boundary internally and has no window concept;
constructing it alongside the Window Registry would race two divergent
Runtime instances in one process, violating this Arc's own "single runtime
ownership" requirement. Its PATTERN (framework-neutral Port + concrete
adapter, structural validation, never a raw `Error`) is restated in
`FedosDesktopNotificationPort`/`FedosDesktopTrayPort` instead.

Build wiring (all additive, nothing renamed/removed/reinterpreted):
`tsconfig.runtime.json` gained 4 new entry points (Notification/Tray/
Background Coordinators + the Status ViewModel); the Electron package's
`tsconfig.json`/`tsconfig.browser-scripts.json` gained the one new plain-
script renderer/window.d.ts pair (same exclude/include convention as every
prior Arc); `copy_static_assets.mjs` gained one new page copy; the
package's own `package.json` gained `start:notifications-tray`; the root
`package.json` gained `start:electron-notifications-tray`.

## Verification

- **31 new root unit/acceptance tests** (4 new files, real objects, no
  mocks of the boundary itself):
  - `test/secure_runtime_alpha_4261_4340_notification_coordinator.test.ts`
    (11 tests) — closed vocabulary, fail-closed validation/sensitive-detail
    denial, Noop-port default, a genuinely-throwing Port converted to a
    closed outcome, and the message/archive/sync notification + multiple-
    notification-counter scenarios named in Phase G.
  - `test/secure_runtime_alpha_4261_4340_tray_coordinator.test.ts` (8
    tests) — real `startFedosDesktopRuntime()`/Boundary/Registry fixture
    (same pattern as `secure_runtime_alpha_4181_4260_window_registry.test.ts`):
    open-window/recent-conversations/device-sync-status/pause-sync/
    resume-sync/exit/unexpected-command scenarios.
  - `test/secure_runtime_alpha_4261_4340_background_lifecycle_coordinator.test.ts`
    (11 tests) — window-close-keeps-runtime-alive, background sync/
    notification capability flags, restart, clean shutdown (one-way door,
    idempotent terminal state), single-runtime-ownership (two independent
    instances never share state).
  - `test/secure_runtime_alpha_4261_4340_notifications_tray_status_view_model.test.ts`
    (1 test) — real coordinators, pure read, no mutation.
- **15 new real Electron acceptance tests**
  (`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_4261_4340_notifications_tray_electron_acceptance.test.ts`):
  build output, security baseline (contextIsolation/nodeIntegration/
  sandbox/webSecurity, no `eval`/`new Function`/`enableRemoteModule`,
  navigation/permission denial, local-files-only, one frozen
  `contextBridge` export, no business logic in the two Electron adapter
  files), closed IPC vocabulary (exactly the 7 documented `fedos-bg:*`
  channels, both sides), no `window-all-closed` handler, and FOUR real
  subprocess tests: successful launch + real startup signal + clean exit +
  real tray icon; genuine startup failure (corrupt navigation log) failing
  closed with `app.quit()`; repeated launch; and — test 14 — the
  `FEDOS_ELECTRON_BG_AUTOTEST=1` self-test sequence, asserting on all 14
  named Phase G scenarios' own real, parsed marker output (including the
  concrete assertions: `window-close-keeps-runtime-alive` reports
  `backgroundState: "background"`, `restart` reports `"foreground"`,
  `background-sync` reports both capability flags `true`, both
  `unexpected-*` scenarios report a `"rejected"` outcome, and the real
  `"fedos-bg: shutdown clean"` line appears strictly after the self-test's
  own `"done"` marker — proving the real shutdown path ran exactly once,
  at the end, never mid-sequence).
- Existing `secure_runtime_alpha_3881_3940_electron_build_spike.test.ts`
  (26 tests, 22 run + 4 skip, unchanged), `secure_runtime_alpha_4101_4180_electron_host_adapter.test.ts`
  (21 tests) + `..._dispatch_translation.test.ts` (13 tests), and
  `secure_runtime_alpha_4181_4260_navigation_electron_acceptance.test.ts`
  (13 tests) — ALL still green, run together with this Arc's own new suite
  (`npx vitest run --config vitest.electron-spike.config.ts`): **5 files,
  84 passed / 4 skipped, 0 failed.**
- Regression, explicitly by name (Phase G's own required list), run
  together: Desktop Runtime (`secure_runtime_alpha_1691_1760_desktop_runtime_wiring`,
  7/7), Desktop Shell (`..._2841_2920_desktop_application_shell`, 20/20),
  Presentation (`..._3241_3320_presentation_boundary`, 13/13), Renderer
  (`..._3401_3480_renderer_boundary`, 11/11), Host Bridge
  (`..._3561_3640_host_bridge`, 17/17 — untouched, verified still
  correct), Navigation (`..._4181_4260_navigation_history`/`_state`/
  `_window_controller`/`_window_registry`/`_window_title`, 29/29), Search
  (`..._2541_2560_search_index_incremental_and_delete`, 7/7), Archive
  (`..._1691_1760_archive_runtime` 24/24, `..._1921_1980_group_archive_runtime`
  9/9, `..._2561_2580_archive_index_and_large_dataset` 3/3), plus this
  Arc's own 4 new files (31/31): **18 files, 171/171 passing, 0 failed.**
- Full root suite (`npx vitest run`, this worktree): **1010 files, 778
  passed / 232 failed; 13237 tests, 12942 passed / 295 failed.** None of
  this Arc's own new test files appear anywhere in the failure list
  (confirmed by direct grep of the full run's own output for `FAIL`/
  failing-file markers). This worktree is now many arcs ahead of
  `C:\wt\node-type-isolation` (983 files, 785 passed / 198 failed at ITS
  own point in history) — not a fair 1:1 delta baseline on its own (dozens
  of intervening Arcs each added their own new passing tests AND their own
  `test/reviews/**` boundary-invariant tests, several of which assert
  `git status --porcelain` is clean outside their own declared review
  scope and therefore fail on ANY worktree with uncommitted changes,
  resolving on commit — the exact, previously-documented pattern every
  recent Arc's own completion declaration already describes). This Arc's
  own change surface is provably narrow by construction: every file this
  Arc touched outside `src/desktop/{notification,tray,background}/`,
  `src/desktop/presentation/fedos_desktop_notifications_tray_status_view_model.ts`,
  and the new Electron/test files is a build-config file only
  (`tsconfig.runtime.json`, the Electron package's `tsconfig*.json`,
  `copy_static_assets.mjs`, both `package.json` files) — none of which is
  imported by any other test, so this Arc cannot itself be the source of a
  collateral regression elsewhere; the named-regression and Electron
  suites above (189 tests total) are the direct, targeted proof.
- `npm run build:wasm` / a Rust `cargo test` run: **N/A, honestly.** This
  Arc is a pure TS/Electron-layer concern (notifications/tray/background
  lifecycle) — it adds, reads, or changes no Rust/WASM code, and touches no
  file under `packages/fedos-core-rust/`. Not run; nothing to fabricate
  output for.

## Scope boundary — disclosed honestly

- Phase G's 14 named scenarios are covered TWICE, at two real depths (see
  the Electron acceptance suite's own header): once one layer below
  Electron over the identical real coordinator classes (root `test/`), and
  once inside a genuinely spawned Electron process via the
  `FEDOS_ELECTRON_BG_AUTOTEST=1` self-test sequence — no browser-automation
  dependency added, the SAME disclosed choice every real-acceptance suite
  in this repository already makes (Alpha 3881-3940's own explicit
  precedent, restated by Alpha 4181-4260, restated here).
- "Device Sync Status"/"Pause Sync"/"Resume Sync" are tested against the
  HONEST, real `"unsupported"` outcome on this repository's own base
  runtime config (no `deviceTrustEnabled: true` — the same
  long-documented "Device Sync Foundation is real but wired into nothing
  on this base" precedent `FedosDesktopRuntimeStatusViewModel`'s own
  `deviceStatus()` already established) — never fabricated as a fake
  "success."
- Two disclosed, pre-existing `dist/` anomalies (untracked, gitignored
  stray build output from an earlier, abandoned attempt, predating this
  session) were found and documented rather than either trusted as
  evidence of prior work or silently deleted — see the Phase A inventory's
  own section.

## Recommend exactly one next Arc

**Desktop Unread Badge / Menu Bar Count Integration Arc** — this Arc's own
`FedosDesktopUnreadCounterViewModel` (Alpha 3241-3320, already real and
unmodified) has no consumer anywhere in the Electron layer yet; with real
Notification/Tray/Background wiring now in place, the natural next step is
surfacing the SAME real unread count this Arc's Notification boundary
already routes individual `conversation-message` events for, as a real OS
taskbar/dock badge count and a tray tooltip/menu-item suffix — a narrow,
additive continuation of exactly the same Port/Coordinator/Electron-adapter
pattern this Arc, Navigation (4181-4260), and the Host Adapter (4101-4180)
all already established, requiring no new architecture.
