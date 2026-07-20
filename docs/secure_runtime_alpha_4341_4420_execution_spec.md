# Secure Runtime Alpha 4341–4420: Desktop Unread Badge and Menu Bar Count Integration Arc — Execution Spec

## Objective

Implement Desktop unread-count integration: a real OS taskbar/dock badge and
menu-bar count reflecting the SAME unread fact `FedosDesktopUnreadCounterViewModel`
(Alpha 3241-3320, frozen) already computes. No persistence changes, no
Runtime redesign, no Search redesign, no Conversation redesign. Everything
additive.

Base: `arc/desktop-notifications-tray-background-operation` at commit
`8b74dbc` ("Add Secure Runtime Alpha 4261-4340: Desktop Notifications,
System Tray, and Background Operation Arc" — the immediately-prior arc).

## Phase A — Precondition verification (real source review, not assumption)

Read in full before writing anything:
- `src/desktop/presentation/fedos_desktop_unread_counter_view_model.ts` —
  confirmed current public API: `state` getter, `refresh(conversationId)`,
  `markViewed(conversationId)`. Local, in-memory-only "last viewed"
  watermark per conversation; counts messages newer than the watermark.
  Never persisted, never a multi-device fact.
- `src/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.ts` —
  confirmed `unreadCounter` is already constructed and exposed; frozen,
  untouched by this Arc.
- `src/desktop/renderer/fedos_desktop_message_renderer.ts` — confirmed
  existing consumer (per-conversation unread badge inside the message pane
  render model). This Arc does not touch it.
- `src/desktop/notification/`, `src/desktop/tray/`, `src/desktop/background/`
  (Alpha 4261-4340) — read in full to establish the Port/Coordinator/
  Electron-adapter pattern this Arc reuses verbatim.
- `docs/secure_runtime_alpha_4261_4340_completion_declaration.md` — Host
  Bridge reuse investigated and rejected there (would race a second,
  divergent Boundary/Runtime against the Window Registry's own). This Arc
  reaches the SAME conclusion for the SAME reason — see below.

### Honest, independently-verified design finding (the one real surprise)

The obvious design — aggregate unread counts over
`FedosDesktopConversationListViewModel`/`FedosDesktopApplicationShell.listConversations()`
— was tried FIRST and rejected after real, running-process testing exposed
a genuine, pre-existing architectural limitation:

`listConversations()` enumerates ONLY a `FedosDesktopApplicationShell`
instance's own in-memory `#knownConversationIds` `Set`, populated
EXCLUSIVELY by that SAME Shell instance's own `createDirectConversation()`/
`createPrivateGroup()` calls. It is never rebuilt from the persisted
draft/membership/capability logs on `start()`. Meanwhile
`FedosDesktopApplicationShell.redeemInvitation()` is permanently
`"unavailable"` on this codebase's own base (Alpha 2841-2920, pre-existing,
disclosed) — there is NO way to reach a real, ACTIVATED conversation
through the Shell's own officially exposed surface at all. Every real
acceptance test in this repository that needs an activated conversation
(e.g. `secure_runtime_alpha_4261_4340_tray_coordinator.test.ts`'s own
`activateDirectConversation()` helper) does so through a SEPARATE, temporary
`FedosRunningDesktopRuntime` instance, calling `conversationRuntime()`
directly — which writes to the SAME persisted log files a later Boundary's
Shell re-reads, but does NOT populate that later Shell's own in-memory
`#knownConversationIds`.

Net effect: a conversation activated in one process/session (or by a
temporary seeding runtime) is real and durable, but INVISIBLE to
`conversationList.load()` in a DIFFERENT Shell instance — exactly the
situation a real multi-session desktop app is in on every restart.

`FedosDesktopBadgeCoordinator` therefore aggregates over
`FedosDesktopConversationWindowRegistry.recentConversationIds`
(`src/desktop/navigation/`, Alpha 4181-4260, append-only-log persisted,
survives restart, populated by `recordConversationOpened()` after any real,
successful open regardless of which Shell/runtime instance originally
created the conversation) instead — the SAME, already-proven choice
`TrayCoordinator`'s own `"recent-conversations"` action already made for the
identical reason. This is disclosed here as a real design decision, not
papered over.

## Phase B — `src/desktop/badge/` (root, framework-neutral)

- `fedos_desktop_badge_types.ts` — closed vocabulary
  (`none`/`count`/`attention`/`synchronizing`/`error`), `FedosDesktopBadgeView`
  (`state`/`count`/`reason`), structural equality helper
  (`fedosDesktopBadgeViewsEqual`) for de-duplication.
- `fedos_desktop_badge_port.ts` — `FedosDesktopBadgePort`
  (`status()`/`render(view)`) + `NoopFedosDesktopBadgePort`. Mirrors
  `FedosDesktopTrayPort`'s own framework-neutral split exactly.
- `fedos_desktop_badge_coordinator.ts` — `FedosDesktopBadgeCoordinator`.
  Constructor takes a narrow `Pick<FedosDesktopConversationWindowRegistry, "recentConversationIds">`
  view (mirrors `FedosDesktopTrayRegistryView`), the real
  `FedosDesktopUnreadCounterViewModel`, and a `FedosDesktopBadgePort`.
  `refresh()` sums `unreadCounter.refresh(id)` verbatim over every recent
  conversation id — NEVER reads `listMessages()`/any Shell method directly.
  In-memory-only bookkeeping: previous per-conversation counts (for
  "attention" — a count that increased since THIS Coordinator instance last
  observed it; a conversation's first-ever observation is a baseline, never
  a false positive) and the last rendered view (for de-duplication —
  `port.render()` is called only when the view actually changed;
  `renderCount` exposes this for tests). `setSynchronizing(bool)` is an
  explicit, caller-driven signal — this boundary never infers sync activity
  on its own.

## Phase E — Electron (`packages/fedos-desktop-electron-spike/`, new additive sibling)

- `fedos_electron_badge_adapter.ts` — `FedosElectronBadgeAdapter`. No
  business logic. Applies one `FedosDesktopBadgeView`-shaped object to:
  Dock badge (`app.dock?.setBadge()`), taskbar badge
  (`app.setBadgeCount()` + `BrowserWindow.setOverlayIcon()` on every open
  window, a small embedded solid-color 1×1 PNG, same embedding technique as
  `FedosElectronTrayAdapter`'s own transparent icon), Tray tooltip (via the
  SAME, already-existing `FedosElectronTrayAdapter` instance — never a
  second `Tray`), and Tray menu label (amends the existing
  `"recent-conversations"` item's own label with a `"(N)"` suffix — never
  adds/renames/removes a tray action; the closed six-action vocabulary is
  untouched).
- `fedos_electron_badge_main.cts` — new sibling main-process entry point
  (Package F). Constructs exactly ONE Boundary/Registry/Notification
  Coordinator/Tray Coordinator/Background Lifecycle Coordinator/Badge
  Coordinator, mirroring `fedos_electron_notifications_tray_main.cts`'s own
  construction discipline. SEEDS one real, activated direct conversation
  through a temporary raw runtime before the real Boundary starts (see
  Phase A finding above), then registers it into the Registry's own
  `recentConversationIds` via `recordConversationOpened()` (pure Registry
  bookkeeping — never touches the unread watermark). Nine closed,
  validated `fedos-badge:*` IPC channels (seven reused-layer channels
  renamed into this file's own namespace, since this is a wholly separate
  process/preload pair, plus two new ones: `badge-status`, `mark-viewed`).
  Deliberately NO `window-all-closed` handler (keep-alive-in-background,
  restated from Alpha 4261-4340).
- `fedos_electron_badge_preload.cts` / `..._window.d.ts` / `..._page.html` /
  `..._renderer.ts` — the SAME `contextBridge`/frozen-object/plain-page-script
  pattern every prior package already established.
- `fedos_electron_badge_selftest.ts` — main-process self-test sequence,
  gated behind `FEDOS_ELECTRON_BADGE_AUTOTEST=1`, exercising all 8 named
  Phase G scenarios against real objects, logging `FEDOS_BADGE_TEST:{...}`
  marker lines (mirrors `fedos_electron_notifications_tray_selftest.ts`'s
  own convention).

Host Bridge reuse: investigated, same conclusion as Alpha 4261-4340 (see
that Arc's own completion declaration) — not reused directly for the same
"single runtime ownership" reason; its Port+adapter PATTERN is restated.

## Phase G — Acceptance scenarios (required, real objects, two depths)

unread increments, unread clears, multiple windows, restart, notification
interaction, tray interaction, no duplicate badge updates, shutdown
cleanup — each proven once at the root-level Coordinator (real Runtime/
Shell/Boundary/Registry fixture) and once inside a genuinely spawned
Electron process (`FEDOS_ELECTRON_BADGE_AUTOTEST=1`); "restart" is
additionally proven at the strongest depth available — a genuine SECOND OS
process over the same on-disk data directory.

## Verification

`npm run typecheck` (core + electron), the new root/Electron test suites,
named regression suites, and a full-suite run — see the Completion
Declaration for real numbers. `cargo test`/`npm run build:wasm`: N/A,
honestly — this Arc touches no file under `packages/fedos-core-rust/`.
