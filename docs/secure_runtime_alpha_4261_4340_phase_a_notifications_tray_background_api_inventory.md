# Secure Runtime Alpha 4261–4340: Desktop Notifications, System Tray, and Background Operation Arc — Phase A: API Inventory

Verified against actual checked-out source in this worktree
(`arc/desktop-notifications-tray-background-operation`, based on merge
commit `7b373e7`, which integrates `6b47730` "Add Secure Runtime Alpha
4181-4260: Desktop Conversation Window and Navigation Arc"). Not trusted
from documentation alone — every claim below was checked by reading the
named source file directly.

## Preconditions — verified against source

| Layer | Exists? | Where |
| --- | --- | --- |
| Desktop Runtime | Yes | `src/desktop/runtime/fedos_desktop_runtime.ts` (`startFedosDesktopRuntime`) |
| Desktop Shell | Yes | `src/desktop/shell/fedos_desktop_application_shell.ts` |
| Presentation Boundary | Yes | `src/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.ts` — 16 ViewModels/controllers composed, including `deviceSyncStatus`/`syncSchedule` (Alpha 3801-3880) and `deviceManagement` (Alpha 3941-4020) |
| Renderer Boundary | Yes | `src/desktop/renderer/fedos_desktop_renderer.ts` + 16 content renderers |
| Navigation (Window Controller/Registry) | Yes | `src/desktop/navigation/` (6 files, Alpha 4181-4260) — `FedosDesktopConversationWindowController` (one window's orchestration, own ViewModel/Renderer instances over the Boundary's shared `.shell`) and `FedosDesktopConversationWindowRegistry` (multi-window lifecycle + pin state + recent list + last-opened restoration, backed by `append_only_fedos_desktop_navigation_persistence.ts`) |
| Host Boundary (`FedosDesktopHostPort`/`FedosDesktopHostBridge`) | Yes | `src/desktop/host_boundary/` (Alpha 3561-3640) — `status()/start()/stop()/dispatch()/render()`, serialized dispatch queue, constructs its OWN private `FedosDesktopConversationUiPresentationBoundary`/`FedosDesktopRenderer` internally (never exposed) |
| Electron Main/Preload/Renderer | Yes, THREE independent packages | `packages/fedos-desktop-electron-spike/src/fedos_electron_spike_*` (Package A, Alpha 3881-3940, untouched build spike, no business IPC); `fedos_electron_host_adapter_*` (Package B, Alpha 4101-4180, wires `FedosDesktopHostBridge` via `ipcMain`/`window.fedos.invoke()`); `fedos_electron_navigation_*` (Package C, Alpha 4181-4260, wires the Window Registry directly, bypassing Host Bridge — see "Host Bridge reuse" below) |
| Existing generic Notification boundary | Yes, but UNRELATED | `src/notification/` (Stage 39) — see "Relationship to `src/notification/`" below |
| Desktop-specific Notification/Tray/Background boundary | **No** | Missing — this Arc's own job (Phase B/C/D) |

## Reusable APIs

- `FedosDesktopConversationWindowRegistry` (`src/desktop/navigation/fedos_desktop_conversation_window_registry.ts`) — `createWindow`/`disposeWindow`/`getWindow`/`recentConversationIds`/`lastOpenedConversationId`/`isPinned` — exactly what a tray icon needs to "show/hide/focus a specific window on a specific conversation" (the reason this Arc was recommended next).
- `FedosDesktopConversationUiPresentationBoundary.deviceSyncStatus`
  (`FedosDesktopDeviceSyncStatusViewModel`, `src/desktop/presentation/fedos_desktop_device_sync_status_view_model.ts`) — `refresh()`/`start()`/`stop()`/`triggerNow()`, thin wrappers over `FedosDesktopApplicationShell.deviceSyncStatus()`/`deviceSyncStart()`/`deviceSyncStop()`/`deviceSyncNow()`. This IS the real backing for the Tray's "Device Sync Status"/"Pause Sync"/"Resume Sync" actions — verified: on a `FedosDesktopRuntimeConfig` without `deviceTrustEnabled: true`, `FedosDesktopApplicationShell.deviceSyncOperational()` throws internally and every one of these Shell methods catches it and returns a closed `"unsupported"` error result (honest, not fabricated — mirrors `deviceStatus()`'s own long-documented "always unavailable on this base" precedent). This Arc's own tests exercise both codepaths honestly (see completion declaration).
- `src/notification/policy.ts`'s `isSensitiveNotificationField` — a PURE, already-reviewed marker-substring check (`"secret"`, `"password"`, `"token"`, etc.) — reused (not re-implemented) by this Arc's own `src/desktop/notification/fedos_desktop_notification_types.ts` for its one caller-suppliable `detail` field.
- `fedos_electron_navigation_main.cts`'s own dynamic-import-from-`dist/` pattern (`distUrl()`, `loadNavigationRootModules()`) — reused verbatim in this Arc's own `fedos_electron_notifications_tray_main.cts` to load the new root Notification/Tray/Background modules the same way.
- The FakeEncryptionAuthority/FakeDecryptionAuthority test-double pattern every real-acceptance suite in this repository already uses (no compiled WASM artifact exists in this checked-out tree) — reused verbatim, not reinvented.

## Missing APIs (this Arc adds, narrowly)

- No desktop-specific Notification boundary (`FedosDesktopNotificationPort`/`FedosDesktopNotificationCoordinator`) existed anywhere.
- No System Tray boundary (`FedosDesktopTrayPort`/`TrayCoordinator`) existed anywhere.
- No Background Operation lifecycle state machine existed anywhere.
- No Electron `Notification`/`Tray` API wiring existed anywhere (`packages/fedos-desktop-electron-spike/src/` had no file referencing either API before this Arc).

## Relationship to `src/notification/` (verified, NOT reused structurally)

`src/notification/` (Stage 39 — `types.ts`/`policy.ts`/`bridge.ts`/`bridge_helpers` under a different name) is a GENERIC, desktop-agnostic seam for a FUTURE EXTERNAL push transport (Telegram/LINE/APNs/FCM/Email), carrying coarse `chat_activity`/`space_activity`/`product_update`/`moderation_notice`/`payment_status_placeholder`/`system_notice` signals. It has:
- Its own closed `NotificationKind`/`NotificationChannel` vocabulary — entirely unrelated to this Arc's own desktop kinds (`conversation-message`/`device-sync`/`device-transfer`/`sync-complete`/`sync-failed`/`archive-complete`/`archive-failed`/`warning`/`error`).
- No Electron/OS-notification-tray concept anywhere in it — `NoopNotificationBridge`/`PlaceholderNotificationBridge` model an EXTERNAL API call (Bot API/APNs/FCM), never a local OS toast.
- No wiring into the Runtime or Worker (documented in its own file headers as intentionally unwired).

This Arc's own `src/desktop/notification/` boundary is a SEPARATE, desktop-specific boundary for real, local OS notification-tray output (Electron's own `Notification` API, Phase E) — never merged with `src/notification/`. The one deliberate point of reuse is the pure `isSensitiveNotificationField` policy helper (see above); no import of `NotificationBridge`/`NotificationPayload`/`NotificationChannel` exists anywhere under `src/desktop/notification/`. A future Arc MAY choose to fan this boundary's events out to that one; this Arc names no such wiring.

## Host Bridge reuse — investigated honestly (Phase E requirement)

`FedosDesktopHostBridge` (`src/desktop/host_boundary/fedos_desktop_host_bridge.ts`, Alpha 3561-3640, UNTOUCHED) is a complete, valid `FedosDesktopHostPort` implementation — but it constructs and OWNS its own private `FedosDesktopConversationUiPresentationBoundary`/`FedosDesktopRenderer` internally (`#boundary`/`#renderer`, never exposed), and its `dispatch()`/`render()` model has no concept of "which window" a call is for at all.

The Navigation Arc (4181-4260) already investigated this exact question for itself and concluded, in its own main file's header, that Host Bridge is NOT the right integration point for anything window-aware, and constructed the Presentation Boundary + Window Registry directly instead. This Arc's own needs (Tray's "Open Window"/"Recent Conversations" need the SAME Window Registry; Tray's "Device Sync Status"/"Pause Sync"/"Resume Sync" need the SAME Presentation Boundary's `deviceSyncStatus` ViewModel Navigation already shares) are a direct continuation of that same shape, not a new one — so the same conclusion applies, for the same reason: constructing a `FedosDesktopHostBridge` ALONGSIDE a `FedosDesktopConversationWindowRegistry` in one process would mean TWO independent, divergent Boundary/Shell/Runtime instances racing inside one process, a direct violation of this Arc's own Phase D "single runtime ownership" requirement.

**Decision**: `FedosDesktopHostBridge` is NOT constructed by this Arc's Electron adapter. What IS reused is its own PATTERN — a framework-neutral Port interface (`status()`/`notify()`/`dispatch()`-shaped), a concrete adapter implementing it, structural input validation before any candidate reaches decision logic, and "never a raw `Error` crosses this boundary." This Arc's own `FedosDesktopNotificationPort`/`FedosDesktopTrayPort` (Phase B/C) restate that exact pattern for two new, narrow domains. This is documented honestly here rather than silently contradicting the spec's "Reuse Host Bridge" instruction or silently ignoring it — the SAME honest call the Navigation Arc already made and disclosed for itself.

## Electron adapter naming — a disclosed anomaly (stray, untrusted `dist/` build output)

Before this Arc's own first commit, `packages/fedos-desktop-electron-spike/dist/` (gitignored, untracked) already contained compiled files `fedos_electron_notifications_tray_main.cjs`, `fedos_electron_notification_adapter.cjs`, `fedos_electron_tray_adapter.cjs`, `fedos_electron_notifications_tray_page.html`, `fedos_electron_notifications_tray_selftest.js` — with NO corresponding source file anywhere in `src/` at that time. Confirmed by file mtime: these predate this Arc's own work session (~01:2x-01:3x vs. this session's own ~02:1x-02:2x). Per this Arc's own instructions, `src/` (not `dist/`) is ground truth, and these were treated as a disclosed observation only, never as evidence of completed work. This Arc's own real source files happen to use very similar names (`fedos_electron_notification_adapter.ts`, `fedos_electron_tray_adapter.ts`, `fedos_electron_notifications_tray_main.cts`, `fedos_electron_notifications_tray_selftest.ts`) — chosen independently, before noticing the stray artifacts, simply because they are the natural, obvious names following this package's own established `fedos_electron_<domain>_<role>` convention; the coincidence is expected, not copied. The same anomaly pattern was ALSO found in the ROOT `dist/` (not just the Electron package's): `dist/desktop/notification/fedos_desktop_notification.js`, `dist/desktop/tray/fedos_desktop_tray_action.js`, `dist/desktop/tray/fedos_desktop_tray_model.js` — again untracked, gitignored, no corresponding `src/` file, predating this session. Neither anomaly was manually cleaned up (not required — `dist/` is gitignored and a real build naturally coexists with or overwrites stray same-named output).

## Root package.json scripts actually used by this Arc

- `build:runtime` (`tsc -p tsconfig.runtime.json`) — extended with 4 new entry points (see Phase E/build wiring in the completion declaration).
- `typecheck:core` / `typecheck:electron` / `typecheck` — unchanged commands, now covering this Arc's own new files too.
- `test` (root `vitest run`) / `test:electron-spike` (`vitest run --config vitest.electron-spike.config.ts`) — unchanged.
- New: `start:electron-notifications-tray` (root) → `start:notifications-tray` (package) — mirrors `start:electron-navigation` → `start:navigation`'s own existing convention exactly.

## Recommended next Arc (stated up front, per this Arc's own instructions)

See the completion declaration's own final section.
