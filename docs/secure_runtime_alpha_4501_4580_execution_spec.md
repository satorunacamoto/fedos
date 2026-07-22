# Secure Runtime Alpha 4501–4580: Desktop Device Sync Electron Main Integration Arc — Execution Spec

Base: `arc/desktop-device-sync-badge-notification-wiring` at commit `f77d525`
("Add Secure Runtime Alpha 4421-4500: Desktop Device Sync Badge,
Notification, and Operational Event Wiring Arc" — the immediately-prior
arc), branched as `arc/desktop-device-sync-electron-main-integration`.

## Objective (restated from the brief)

Complete the final Electron integration for the existing Device Sync
Presentation Wiring. No Runtime/Scheduler/Notification/Tray/Badge/Electron
redesign. Everything additive.

## Two naming corrections verified against real source (per this Arc's own
instruction, disclosed rather than assumed)

1. The brief says "FedosElectronHostBridge" — the real class is
   `FedosDesktopHostBridge` (`src/desktop/host_boundary/fedos_desktop_host_bridge.ts`).
   Read in full, plus every one of its own usages (there are none outside
   `fedos_electron_host_adapter_main.cts`, Package C, Alpha 4101-4180).
   `FedosDesktopHostBridge` owns a PRIVATE `#boundary`/`#renderer` pair,
   never exposed to a caller, with no concept of "window" and no way to
   reach the Notification/Tray/Badge Coordinators this Arc needs — exactly
   the same reason `fedos_electron_navigation_main.cts` (Alpha 4181-4260)
   and `fedos_electron_notifications_tray_main.cts` (Alpha 4261-4340)
   already gave, in their own headers, for constructing their OWN Boundary
   directly instead of reusing it. **Not constructed anywhere by this
   Arc** — doing so would mean a second, divergent Runtime instance,
   exactly the "never duplicate ownership" violation this Arc's own hard
   rules forbid.
2. `FedosDesktopBadgeCoordinator`'s real, current public surface is
   `setSynchronizing()` + `refresh()` — not `setAttention()`/
   `setCount()`/`setNone()`. Already corrected by the immediately-prior
   Arc's own Phase A finding; restated here because
   `FedosDesktopDeviceSyncPresentationWiring` (reused verbatim by this
   Arc) is what actually calls those two real methods.

## Phase A — Inventory (real source, read in full before writing any code)

All five candidate Electron main files' own headers were read:

- `fedos_electron_spike_main.cts` (Package A, Alpha 3881-3940) — proves
  only that Electron installs/builds/launches; imports nothing from
  `src/`. Not relevant.
- `fedos_electron_host_adapter_main.cts` (Package C, Alpha 4101-4180) —
  the ONLY file that constructs `FedosDesktopHostBridge`. Owns no
  Notification/Tray/Badge Coordinator of any kind.
- `fedos_electron_navigation_main.cts` (Package B, Alpha 4181-4260) —
  constructs its own Boundary directly (documented rationale: Host Bridge
  has no per-window concept). Owns Navigation only, no Notification/Tray/
  Badge.
- `fedos_electron_notifications_tray_main.cts` (Package D, Alpha
  4261-4340) — constructs its own Boundary; owns Notification/Tray/
  Background, but NOT Badge (Badge did not exist yet at that Arc's base).
- `fedos_electron_badge_main.cts` (Package F, Alpha 4341-4420) — the ONLY
  file that constructs `FedosDesktopNotificationCoordinator`/
  `TrayCoordinator`/`FedosDesktopBadgeCoordinator` TOGETHER, over one
  shared `FedosElectronTrayAdapter`, in one process. Confirmed by reading
  its own full source (not just its header), not merely trusting the
  immediately-prior arc's own recommendation.

**Conclusion, independently verified:** `fedos_electron_badge_main.cts` is
the one, correct extension point — the ONLY file where attaching Device
Sync presentation routing does not require constructing a second,
competing set of Coordinators. Extended **in place**, not as a new sibling
package. Every prior arc in this lineage added a NEW sibling `*_main.cts`
file; this Arc deliberately does not, because a new sibling would have to
construct its OWN Boundary/Shell/Runtime/Coordinators to reach the same
three Coordinators — exactly the duplicate-ownership violation this Arc's
own hard rules forbid. This is the first Arc in this lineage to modify an
existing Electron main file rather than add a sibling, and it is the
correct call given the "never duplicate ownership" hard rule.

## Phase B — construct the Wiring exactly once

`fedos_electron_badge_main.cts` gains:

- Two more dynamically-imported compiled modules in `loadRootModules()`
  (mirrors every existing module load in that function): `FedosDeviceSyncEventBridge`
  (`dist/device/sync_events/fedos_device_sync_event_bridge.js`) and
  `FedosDesktopDeviceSyncPresentationWiring`
  (`dist/desktop/runtime/fedos_desktop_device_sync_presentation_wiring.js`).
  Both Alpha 4421-4500, UNMODIFIED.
- `deviceSyncRuntimeConfigFields(attemptFn)` — a new helper appended to
  `runtimeConfig()`'s own output ONLY for the real, long-lived Boundary
  start (never for the temporary `seedDirectConversation()` raw runtime,
  which has no need for Device Sync). Turns on `deviceTrustEnabled`,
  `localDeviceId`, `localAccountRef` (reuses the existing `LOCAL_VIEWER`
  constant — its `{authority, publicIdentifier, identityId}` shape already
  matches `FedosDeviceBindingAccountRef` exactly, and it IS the same real
  local identity), `deviceSyncSchedulerEnabled`, a fixed
  `deviceSyncAbandonmentPolicy` (`{maxAttempts: 5, laterDelaySeconds:
  30}`), and `deviceSyncAttemptFn: eventBridge.wrapAttemptFn()`, plus
  explicit, durable log paths for the Device Registry/Schedule/Conflict/
  Transfer Session (mirrors every other `*LogPath` field's own "explicit,
  caller-supplied path, no default" discipline).
- `startBadgeHost()`: constructs `eventBridge` BEFORE the real Boundary
  starts (its `wrapAttemptFn()` must exist to thread into the Boundary's
  own start config); its `listener` forwards into `wiring` via a captured,
  reassignable module-level reference (`wiring` is `null` for the brief
  window before the three Coordinators it depends on exist — a safe
  no-op window, since no real Scheduler attempt is in flight yet).
  `wiring` is constructed immediately AFTER `notificationCoordinator`/
  `badgeCoordinator`/the shared `trayAdapter` all exist, exactly once,
  reusing the SAME shared `trayAdapter` instance as its own tray status
  sink — never a second Tray.
- Both `eventBridge`/`wiring` are ordinary module-level `let` bindings,
  scoped to one real process's own single startup — the SAME pattern
  every other Coordinator in this file already uses (`badgeCoordinator`/
  `trayCoordinator`/...), never a global singleton in any stronger sense.

A welcome, real side effect of finally turning `deviceSyncSchedulerEnabled`
on: `TrayCoordinator`'s existing `"pause-sync"`/`"resume-sync"`/
`"device-sync-status"` actions (Alpha 4261-4340, UNMODIFIED) were WIRED but
INERT on every real launch before this Arc (the Scheduler they call into
was never constructed). They are now genuinely functional, with zero
changes to `TrayCoordinator` itself.

## Phase C — Lifecycle

- **Startup:** as above.
- **Shutdown:** `performCleanShutdown()` nulls `wiring`/`eventBridge`
  BEFORE `app.quit()` — neither owns a timer or external subscription of
  its own to unwind (the real Scheduler's own timer is already stopped one
  line above, via `runtimeStatus.stop()` → `FedosRunningDesktopRuntime.stop()`
  → `scheduler.stopSync()`); "destroy" here means dropping the reference so
  no post-shutdown code path can ever route a stray event into a torn-down
  Coordinator.
- **Idempotent startup:** `hostStarted` guard — a second `startBadgeHost()`
  call is a safe, logged no-op, never a second Boundary/Registry/
  Coordinator/Wiring/Bridge construction.
- **Idempotent shutdown:** `shutdownInitiated` guard — a second
  `performCleanShutdown()` call (tray "Exit", the `fedos-badge:shutdown`
  IPC channel, and this Arc's own AUTOTEST self-test can all race to call
  it) is a safe, logged no-op, never a second `runtimeStatus.stop()`/
  `app.quit()`.
- **Restart:** always a brand-new OS process in this package (unchanged
  from every prior arc in this lineage) — `eventBridge`/`wiring` are never
  reused across a restart, matching `FedosDeviceSyncEventBridge`'s own
  documented "reset on every fresh instance" connectivity-belief
  discipline.
- **Window close:** unaffected — `wiring` routes Device Sync events into
  Notification/Badge/Tray regardless of window count; the existing
  `window.on("closed", ...)` handler is untouched.
- **Background mode:** unaffected — `BackgroundLifecycleCoordinator`
  itself is untouched; the Scheduler's own `canRunBackgroundSync()` gate
  (Alpha 3801-3880) already exists and is orthogonal to this Arc's own
  wiring.

## Honest, disclosed scope boundary (Phase A finding, found by reading real
source, not assumed)

`FedosDesktopApplicationShell` exposes Device Sync OPERATIONAL commands
only (`deviceSyncStatus()`/`deviceSyncStart()`/`deviceSyncStop()`/
`deviceSyncNow()`/list\*) — it has NO device REGISTRATION surface at all.
`registerDevice()`/`confirmTrust()`/`recordLocalChange()` exist only on the
raw `FedosRunningDesktopRuntime.deviceTrust()`, which Shell/Boundary never
expose to any caller, this file included (confirmed by grepping the full
Shell source for those three method names — zero matches). Separately,
`FedosSyncState` (the Sync Journal `recordLocalChange()` writes into) is
constructed fresh, in-memory, on every `startFedosDesktopRuntime()` call —
`FedosDesktopRuntimeConfig` has no durable-path field for it anywhere
(unlike `deviceRegistryLogPath`), so even this file's own established
`seedDirectConversation()` "temporary raw runtime, same log files"
technique could not carry a seeded Sync Journal entry into the real,
long-lived Boundary runtime, because there is no log file to share for it.

Net effect, verified by reading `fedos_device_sync_target_planning.ts` in
full: `planFedosDeviceSyncTargets()` skips any target device whose pending
range is empty (`fromSequence > latestSequence`), and with zero Sync
Journal entries `latestSequence` is always `0` — so this real process's own
real Scheduler, with real Device Trust enabled, has no reachable way to
ever have a real, trusted, in-range target device today. Every real
`triggerSyncNow()` in this Arc's own self-test honestly reports its own
real, loaded status with `scheduleCount: 0`/`pendingCount: 0` — never a
fabricated attempt.

To still prove the real, live Notification/Badge/Tray Coordinators this
process constructs correctly receive and process Device Sync events
end-to-end, `runFedosBadgeDeviceSyncSelftest()`
(`packages/fedos-desktop-electron-spike/src/fedos_electron_badge_device_sync_selftest.ts`)
drives `wiring.handleEvent()` directly with hand-built, schema-valid
`FedosDeviceSyncEvent` objects — the IDENTICAL method, and the IDENTICAL
code path, a genuine Scheduler-sourced event would take
(`FedosDeviceSyncEventBridge` itself only ever calls
`this.#listener(event)`, i.e. this exact `wiring.handleEvent`, to deliver a
real one). Closing this gap for real — a device-pairing/registration flow
reachable from Electron — is out of THIS Arc's own scope ("No Sync
protocol changes") and is this Arc's own recommended next Arc (see the
Completion Declaration).

A second, smaller, honestly-verified finding while checking
`isTargetBelievedOffline()`: that method lives on the BRIDGE, not the
Wiring — it is populated only by the Bridge's own real `wrapAttemptFn()`
observation, never by a directly-driven Wiring event. The self-test checks
it stays honestly `false` even after a hand-fed `"device-offline"` event,
proving genuine isolation between the two rather than a false positive.

## Phase D — Acceptance tests

New file:
`packages/fedos-desktop-electron-spike/src/fedos_electron_badge_device_sync_selftest.ts`
(test-support, mirrors `fedos_electron_badge_selftest.ts`'s own
`FEDOS_BADGE_TEST:` marker convention under its own `FEDOS_DEVICE_SYNC_TEST:`
prefix), invoked from `fedos_electron_badge_main.cts`'s own
`FEDOS_ELECTRON_BADGE_AUTOTEST=1` path, AFTER the pre-existing badge
selftest completes. Six real steps: `scheduler-enabled` (real Scheduler
construction proof, `enabled: true`), `resume-sync` (the real, previously-
inert Tray action, now functional), `trigger-now-zero-targets` (a real,
honest zero-target tick), `event-routing` (hand-fed `sync-started`/
`sync-completed` events through the real, live Coordinators), `device-
connectivity-routing` (hand-fed `device-offline`/`device-online`, proving
Bridge/Wiring isolation), `pause-sync` (real, clean Scheduler stop).

New file:
`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_4501_4580_device_sync_electron_acceptance.test.ts`
(9 tests): build/dist-presence checks; structural proof of "no redesign, no
duplicate ownership" (exactly one `createBoundary()`/`DeviceSyncEventBridge`/
`DeviceSyncPresentationWiring` construction site each, zero
`FedosDesktopHostBridge` reference, the SAME nine `fedos-badge:*` IPC
channels — zero new IPC surface — and the same security baseline); a real,
ordinary (non-AUTOTEST) subprocess launch proving Device Sync being enabled
does not change ordinary startup behavior; and a real AUTOTEST subprocess
run asserting the double-startup-idempotent marker, every Device Sync
selftest step's own real result shape, and that `"shutdown clean"` appears
EXACTLY once even though `performCleanShutdown()` is called twice.

Named Phase D scenarios and where each is proven:

| Scenario | Proof |
|---|---|
| startup | test 8 (plain launch), test 9 (`host started` + `scheduler-enabled`) |
| sync | test 9 `resume-sync`/`trigger-now-zero-targets` (real Scheduler, honestly zero targets) |
| notification | test 9 `event-routing` (`notificationDelta >= 1`, real `FedosDesktopNotificationCoordinator`) |
| tray update | test 9 `event-routing`/`device-connectivity-routing` (real `FedosElectronTrayAdapter.setTooltip()`) |
| badge update | test 9 `event-routing` (`badgeRenderDelta >= 1`, real `FedosDesktopBadgeCoordinator`) |
| restart | pre-existing test 15 (badge suite) — same main file, unaffected by this Arc's own additive changes; `eventBridge`/`wiring` correctly reconstructed fresh on the second process |
| window close | pre-existing `window.on("closed", ...)` path, untouched; exercised by every multi-window scenario in the pre-existing badge selftest, which still runs and passes unmodified after this Arc's own change |
| shutdown | test 9 (`shutdown clean` appears, `pause-sync` stops the real Scheduler first) |
| double startup | test 9 (`double-startup-idempotent=true`, proven via real object-identity comparison, not merely absence of a crash) |
| double shutdown | test 9 (`shutdown clean` occurs EXACTLY once across two real calls) |

## Verification

- `npm run typecheck:core` — passes, modulo the SAME one pre-existing,
  unrelated, documented failure every recent Arc's own baseline carries
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`).
- `npm run typecheck:electron` — passes, zero errors.
- `npm run build:runtime` / `npm run build:host-bridge` / `npm run
  build:electron-spike` — all three succeed.
- Full real Electron subprocess suite
  (`npx vitest run --config vitest.electron-spike.config.ts`) — **7 files
  (the pre-existing 6, plus this Arc's own new file), 108 passed / 4
  skipped, 0 failed** (the pre-existing 6 files' own 99/4/0 numbers,
  unchanged, plus this Arc's own new file's 9/0/0).
- Focused Device Sync regression (root `test/`, run together): 107/107
  passing — the immediately-prior arc's own 21 (Event Bridge + Wiring),
  plus Scheduler/Conflict/Import Coordinator/Operational Facade/Shell
  Device Sync Commands (86), all untouched, all still correct.
- Named regression suites (Desktop Runtime, Shell, Presentation, Renderer,
  Host Bridge, Navigation ×5, Notifications/Tray/Background ×4, Unread
  Badge, Search, Archive ×3), run together: 182/182 passing.
- Full root suite (`npx vitest run`): **1013 files, 810 passed / 203
  failed; 13269 tests, 13009 passed / 260 failed** — the EXACT SAME numbers
  the immediately-prior arc's own completion declaration documented. This
  Arc adds zero files under root `test/` (its own new files live entirely
  under `packages/fedos-desktop-electron-spike/`), so this number is
  expected to be, and is, byte-for-byte unchanged.
- `npm run build:wasm` / a Rust `cargo test` run: N/A, honestly — this Arc
  is pure Electron/TS wiring, touches no file under
  `packages/fedos-core-rust/`. The spec's own Verification section for
  this Arc does not list these either.
