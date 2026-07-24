# Secure Runtime Alpha 4341–4420: Desktop Unread Badge and Menu Bar Count Integration Arc — Completion Declaration

**Full completion.** All required features implemented and verified against
a real Runtime/Shell/Presentation Boundary/Window Registry stack, plus a
real Electron process. `npm run typecheck:core` / `npm run typecheck:electron`
both pass (the former modulo the SAME one pre-existing, unrelated failure
every recent Arc's own baseline documents —
`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`,
confirmed pre-existing and unrelated to this Arc's own files).

Base: `arc/desktop-notifications-tray-background-operation` at commit
`8b74dbc`, "Add Secure Runtime Alpha 4261-4340: Desktop Notifications,
System Tray, and Background Operation Arc" (the immediately-prior arc). See
`docs/secure_runtime_alpha_4341_4420_execution_spec.md` for the full plan
and the honest Phase A design finding that changed this Arc's own
architecture mid-flight.

## What was built

**Phase B — `src/desktop/badge/`** (new directory, 3 files):
- `fedos_desktop_badge_types.ts` — closed 5-state vocabulary
  (`none`/`count`/`attention`/`synchronizing`/`error`), `FedosDesktopBadgeView`
  (`state`/`count`/`reason`), and a structural equality helper
  (`fedosDesktopBadgeViewsEqual`) used for de-duplication.
- `fedos_desktop_badge_port.ts` — `FedosDesktopBadgePort`
  (framework-neutral `status()`/`render(view)`) + `NoopFedosDesktopBadgePort`
  (permanently `"unavailable"`, mirrors `NoopFedosDesktopTrayPort`'s own
  idea).
- `fedos_desktop_badge_coordinator.ts` — `FedosDesktopBadgeCoordinator`:
  reuses `FedosDesktopUnreadCounterViewModel.refresh(conversationId)`
  VERBATIM for every real per-conversation count (never reads
  `listMessages()`/any Shell method directly — "never compute unread
  independently" honored exactly), summed over
  `FedosDesktopConversationWindowRegistry.recentConversationIds` (see the
  honest design finding below for why NOT
  `FedosDesktopConversationListViewModel`). In-memory-only bookkeeping:
  previous per-conversation counts (drives "attention" — a real increase
  since THIS Coordinator instance last observed that conversation; a
  conversation's first-ever observation, including right after a process
  restart, is a baseline, never a false positive) and the last rendered
  view (drives "no duplicate badge updates" — `port.render()` fires only on
  an actual state change; `renderCount` exposes this for tests).
  `setSynchronizing(bool)` is an explicit, caller-driven signal — this
  boundary never infers device-sync activity on its own.

**Honest Phase A design finding (disclosed, not papered over):** the
initially planned design — aggregating over
`FedosDesktopConversationListViewModel`/`listConversations()` — was
implemented, run against a REAL Electron process, and found broken:
`listConversations()` only enumerates a Shell instance's own in-memory
`#knownConversationIds`, populated exclusively by that SAME Shell's own
`createDirectConversation()` calls, never rebuilt from persisted logs on
`start()`. Combined with `FedosDesktopApplicationShell.redeemInvitation()`
being permanently `"unavailable"` on this codebase's own base (Alpha
2841-2920, pre-existing), there is no way to reach an ACTIVATED,
Shell-visible conversation through the Shell's own officially exposed
surface at all — the exact situation a real multi-session desktop app is in
on every restart. The Coordinator was redesigned to aggregate over
`FedosDesktopConversationWindowRegistry.recentConversationIds` instead —
real, append-only-log persisted state that survives a restart, the SAME
choice `TrayCoordinator`'s own `"recent-conversations"` action already
made, for the identical reason. Full detail in the execution spec.

**Phase E — Electron Integration** (`packages/fedos-desktop-electron-spike/`,
8 new files, additive sibling of Packages A–D; none of those existing files
were modified):
- `fedos_electron_badge_adapter.ts` — `FedosElectronBadgeAdapter`. No
  business logic. Applies one badge view to: Dock badge
  (`app.dock?.setBadge()`), taskbar badge (`app.setBadgeCount()` +
  `BrowserWindow.setOverlayIcon()` on every open window, a tiny embedded
  solid-color 1×1 PNG, same technique as the existing Tray icon's own
  transparent PNG), Tray tooltip and Tray menu label (both via the SAME,
  already-existing `FedosElectronTrayAdapter` instance injected in —
  "reuse existing Tray layer, no duplicate state" honored: never
  constructs a second `Tray`, never adds/renames/removes a tray action —
  only amends the existing "Recent Conversations" item's own label with a
  `"(N)"` suffix).
- `fedos_electron_badge_main.cts` — Package F: constructs exactly ONE
  Boundary/Registry/Notification Coordinator/Tray Coordinator/Background
  Lifecycle Coordinator/Badge Coordinator, mirroring
  `fedos_electron_notifications_tray_main.cts`'s own "exactly one Boundary"
  discipline. Seeds one real, activated direct conversation through a
  temporary raw runtime before the real Boundary starts (see the Phase A
  finding), then registers it into the Registry's own
  `recentConversationIds` via `recordConversationOpened()` — pure Registry
  bookkeeping, never touches the unread watermark. Nine closed, validated
  `fedos-badge:*` IPC channels. Deliberately NO `window-all-closed` handler
  (keep-alive-in-background, restated from Alpha 4261-4340).
- `fedos_electron_badge_preload.cts` / `..._window.d.ts` / `..._page.html` /
  `..._renderer.ts` — the SAME `contextBridge`/frozen-object/plain-page-script
  pattern every prior package already established.
- `fedos_electron_badge_selftest.ts` — a main-process self-test sequence,
  gated behind `FEDOS_ELECTRON_BADGE_AUTOTEST=1`, exercising all 8 named
  Phase G scenarios against the SAME real objects wired into the real
  process, logging `FEDOS_BADGE_TEST:{...}` marker lines (mirrors
  `fedos_electron_notifications_tray_selftest.ts`'s own "MARKER"
  convention).

**Host Bridge reuse — investigated, NOT reused directly**: same conclusion
as Alpha 4261-4340, for the same reason — `FedosDesktopHostBridge` owns its
own private Boundary internally with no window concept; constructing it
alongside the Window Registry would race two divergent Runtime instances in
one process. Its Port+adapter PATTERN is restated in
`FedosDesktopBadgePort` instead.

Build wiring (all additive): `tsconfig.runtime.json` gained one new entry
point (`fedos_desktop_badge_coordinator.ts` — its own dependencies
`fedos_desktop_badge_types.ts`/`fedos_desktop_badge_port.ts` are compiled
transitively, matching every sibling Coordinator's own convention); the
Electron package's `tsconfig.json`/`tsconfig.browser-scripts.json` gained
the one new plain-script renderer/window.d.ts pair; `copy_static_assets.mjs`
gained one new page copy; the package's own `package.json` gained
`start:badge`; the root `package.json` gained `start:electron-badge`.

## Verification

- **11 new root unit/acceptance tests**
  (`test/secure_runtime_alpha_4341_4420_badge_coordinator.test.ts`, real
  `startFedosDesktopRuntime()`/Boundary/Registry fixture, same pattern as
  `secure_runtime_alpha_4261_4340_tray_coordinator.test.ts`): closed
  vocabulary, structural-equality/Noop-port checks, zero-recent-conversations
  baseline, unread increments (a real message via
  `FedosDesktopComposeMessageViewModel.send()` — never `boundary.shell`
  directly), unread clears (`unreadCounter.markViewed()`), multiple
  conversations (real sum), restart (fresh Coordinator instance over
  persisted Registry state never fabricates a false "attention"), no
  duplicate badge updates (`renderCount` unchanged across two identical
  refreshes, incremented on a real change), `setSynchronizing()`, and a
  genuine unread-refresh error (an unrecognized conversation id) failing
  closed to `"error"`/count 0. **11/11 passing.**
- **15 new real Electron acceptance tests**
  (`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_4341_4420_badge_electron_acceptance.test.ts`):
  build output, security baseline (contextIsolation/nodeIntegration/
  sandbox/webSecurity, no `eval`/`new Function`/`enableRemoteModule`,
  navigation/permission denial, local-files-only, one frozen
  `contextBridge` export, no business logic in the badge adapter file, no
  second `Tray` constructed), closed IPC vocabulary (exactly the 9
  documented `fedos-badge:*` channels, both sides), no `window-all-closed`
  handler, and FOUR real subprocess tests: successful launch (seeds a real
  activated conversation, starts the real Boundary/Registry/Badge
  Coordinator, shows a real tray icon) + clean exit; genuine startup
  failure (corrupt navigation log) failing closed with `app.quit()`; the
  `FEDOS_ELECTRON_BADGE_AUTOTEST=1` self-test sequence asserting on all 8
  named Phase G scenarios' own real, parsed marker output (unread
  increments reports a positive count in a closed-vocabulary state; unread
  clears reports `count: 0`/`state: "none"`; multiple windows opens 2 real
  extra `BrowserWindow`s and applies a real overlay icon to each without
  throwing; no-duplicate-badge-updates reports an unchanged `renderCount`
  across two identical refreshes; the real `"fedos-badge: shutdown clean"`
  line appears strictly after the self-test's own `"done"` marker); and a
  FIFTH test — "restart" proven at the strongest available depth: a genuine
  SECOND, independent OS process launched over the SAME on-disk data
  directory, re-seeding/re-discovering the persisted conversation cleanly,
  with no corrupted build output. **15/15 passing.**
- Existing `secure_runtime_alpha_3881_3940_electron_build_spike.test.ts`
  (26 tests, 22 run + 4 skip, unchanged),
  `secure_runtime_alpha_4101_4180_electron_host_adapter.test.ts` (21 tests)
  + `..._dispatch_translation.test.ts` (13 tests),
  `secure_runtime_alpha_4181_4260_navigation_electron_acceptance.test.ts`
  (13 tests), and
  `secure_runtime_alpha_4261_4340_notifications_tray_electron_acceptance.test.ts`
  (15 tests) — ALL still green, run together with this Arc's own new suite
  (`npx vitest run --config vitest.electron-spike.config.ts`): **6 files,
  99 passed / 4 skipped, 0 failed.**
- Regression, explicitly by name (Phase G's own required list plus the
  directly-prior Arc's own named suites), run together: Desktop Runtime
  (`..._1691_1760_desktop_runtime_wiring`, 7/7), Desktop Shell
  (`..._2841_2920_desktop_application_shell`, 20/20), Presentation
  (`..._3241_3320_presentation_boundary`, 13/13), Renderer
  (`..._3401_3480_renderer_boundary`, 11/11), Host Bridge
  (`..._3561_3640_host_bridge`, 17/17 — untouched, verified still
  correct), Navigation (`..._4181_4260_navigation_history`/`_state`/
  `_window_controller`/`_window_registry`/`_window_title`, 29/29),
  Notifications/Tray/Background (`..._4261_4340_notification_coordinator`/
  `_tray_coordinator`/`_background_lifecycle_coordinator`/
  `_notifications_tray_status_view_model`, 31/31 — the Arc this one builds
  directly on, verified still correct and untouched), Search
  (`..._2541_2560_search_index_incremental_and_delete`, 7/7), Archive
  (`..._1691_1760_archive_runtime` 24/24, `..._1921_1980_group_archive_runtime`
  9/9, `..._2561_2580_archive_index_and_large_dataset` 3/3), plus this
  Arc's own new file (11/11): **19 files, 182/182 passing, 0 failed.**
- Full root suite (`npx vitest run`, this worktree): **1011 files, 808
  passed / 203 failed; 13248 tests, 12988 passed / 260 failed.** This Arc's
  own two new test files appear ZERO times in the failure list (confirmed
  by direct grep of the full run's own output for `FAIL`/failing-file
  markers, filtered for `4341`/`badge`). Every failure sampled is either a
  `test/fedos_core_rust_*`/`test/runtime_crypto_*`/similar Rust
  dependency-count/pub-fn-surface check (this fresh worktree has no
  `packages/fedos-core-rust/pkg/` compiled artifact and never ran
  `cargo`/`wasm-bindgen` — the SAME pre-existing, disclosed
  "Worktree missing WASM artifact"/raw-import pattern every recent Arc's
  own completion declaration already documents) or a `test/reviews/**`
  boundary-invariant test asserting `git status --porcelain` is clean
  outside its own declared review scope (resolves on commit, the same
  previously-documented pattern). This Arc's own change surface is provably
  narrow by construction: every file this Arc touched outside
  `src/desktop/badge/` and the new Electron/test files is a build-config
  file only (`tsconfig.runtime.json`, the Electron package's
  `tsconfig*.json`, `copy_static_assets.mjs`, both `package.json` files) —
  none of which is imported by any other test, so this Arc cannot itself be
  the source of a collateral regression elsewhere; the named-regression and
  Electron suites above (281 tests total) are the direct, targeted proof.
- `npm run build:wasm` / a Rust `cargo test` run: **N/A, honestly.** This
  Arc is a pure TS/Electron-presentation-layer concern (unread badge/menu
  bar count integration) — it adds, reads, or changes no Rust/WASM code,
  and touches no file under `packages/fedos-core-rust/`. Not run; nothing
  to fabricate output for.

## Scope boundary — disclosed honestly

- The badge's aggregate is computed over
  `FedosDesktopConversationWindowRegistry.recentConversationIds` — every
  conversation this LOCAL process has ever opened a window on (real,
  persisted, survives restart) — NOT literally "every conversation this
  account has ever been part of, anywhere," since this codebase's own base
  has no Shell-level mechanism to rediscover an activated-but-never-opened
  conversation on a fresh Boundary instance (the Phase A finding, above).
  This is the SAME honest limitation `TrayCoordinator`'s own
  `"recent-conversations"` tray action already lives with, restated here,
  never fixed (fixing it would mean redesigning
  `FedosDesktopApplicationShell`'s own `#knownConversationIds`/
  `redeemInvitation()`, explicitly out of scope: "No Runtime redesign").
- "synchronizing" is a caller-driven signal only, never inferred from
  `FedosDesktopDeviceSyncStatusViewModel`/`BackgroundLifecycleCoordinator`
  automatically — this Arc's own Electron adapter does not currently call
  `setSynchronizing()` from anywhere (no Device Sync UI event fires it in
  this base), honestly disclosed as available-but-unwired, the same
  "Device Sync Foundation is real but wired into nothing on this base"
  precedent `FedosDesktopRuntimeStatusViewModel`'s own `deviceStatus()`
  already established.
- Phase G's 8 named scenarios are covered TWICE, at two real depths (root
  Coordinator fixture + genuine spawned Electron process via
  `FEDOS_ELECTRON_BADGE_AUTOTEST=1`), plus "restart" a THIRD time at the
  strongest depth (two independent real OS processes) — no
  browser-automation dependency added, the same disclosed choice every
  real-acceptance suite in this repository already makes.

## Recommend exactly one next Arc

**Desktop Device Sync Badge/Notification Wiring Arc** — this Arc's own
`FedosDesktopBadgeCoordinator.setSynchronizing()` and Alpha 4261-4340's own
`FedosDesktopNotificationCoordinator`'s `"device-sync"`/`"sync-complete"`/
`"sync-failed"` kinds both already exist but are never driven by a REAL
`FedosDesktopDeviceSyncStatusViewModel`/`FedosDeviceSyncScheduler` event on
this codebase's own base (Device Sync Foundation is real but wired into
nothing here, the same long-documented precedent). A narrow, additive
continuation — observe the real scheduler's own tick/status events and
drive `setSynchronizing()`/real notifications from them — requires no new
architecture, only wiring two already-real boundaries together for the
first time.
