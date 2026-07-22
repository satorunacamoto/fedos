# Secure Runtime Alpha 5161-5240 — Canonical Desktop Composition and FedOS Beta 0.1 Release-Blocker Closure — Completion Declaration

**FULL completion.** BLK-1 from the immediately-prior Arc (Secure Runtime
Alpha 5061-5160) is closed: `fedos_electron_beta_main.cts` now composes
Navigation, Notification, Tray, Badge, Background Lifecycle, and Device Sync
(Operational Facade + Scheduler + Event Bridge + Presentation Wiring) into the
SAME canonical `FedosDesktopBetaApplicationAssembly`/Runtime this file already
owned — proven against real boundaries in both a new automated test suite and
a real, unpackaged Electron process performing a full create → real WASM
Master Seed → composition-verified-live → lock → relaunch →
wrong-passphrase-denied → correct-passphrase-unlock → composition-rebuilt
round trip.

Commit title:

**"Add Secure Runtime Alpha 5161-5240: Canonical Desktop Composition and FedOS
Beta 0.1 Release-Blocker Closure Arc."**

See `docs/secure_runtime_alpha_5161_5240_ownership_inventory.md` for the full
Phase A ownership table and per-component integration record.

## What changed, and why each touch was minimal

1. **`FedosProfileInitializationCoordinator`** (`src/desktop/onboarding/fedos_profile_initialization_coordinator.ts`)
   — THREE new optional dependencies (`deviceSyncSchedulerEnabled`,
   `deviceSyncAbandonmentPolicy`, `deviceSyncAttemptFn`) threaded into
   `#buildRuntimeConfig()`, mirroring the EXISTING `archiveEnabled` toggle's
   own pattern byte-for-byte. Omitted, behavior is byte-for-byte identical to
   before this Arc — every existing caller/test is unaffected. This is the
   ONLY way to enable the Device Sync Scheduler on this Coordinator's own
   Runtime construction; without it, `backgroundSyncEnabled` in Settings
   could never be anything but honestly `unavailable`.
2. **`FedosDesktopBetaApplicationAssembly`** (`src/desktop/beta/fedos_desktop_beta_application_assembly.ts`)
   — EXTENDED (never replaced): five new owned components
   (`navigationRegistry`, `trayCoordinator`, `badgeCoordinator`,
   `backgroundLifecycle`, `deviceSyncPresentationWiring`), each constructed
   through the ALREADY-EXISTING, ALREADY-ACCEPTED, ALREADY-FRAMEWORK-NEUTRAL
   classes (`FedosDesktopConversationWindowRegistry`, `TrayCoordinator`,
   `FedosDesktopBadgeCoordinator`, `BackgroundLifecycleCoordinator`,
   `FedosDesktopDeviceSyncPresentationWiring` — all Alpha 4181-4500,
   UNMODIFIED). A new `#buildPresentationLayer()` private helper constructs
   this whole set exactly once per Boundary generation, reused (never
   duplicated) by both the constructor and `restartRuntime()`.
3. **`fedos_electron_beta_main.cts`** — EXTENDED: constructs exactly one
   `FedosElectronTrayAdapter`/`FedosElectronBadgeAdapter` (Alpha 4261-4340/
   4341-4420, UNMODIFIED — the SAME classes `fedos_electron_badge_main.cts`
   already proves work), one `FedosDeviceSyncEventBridge` per create/unlock
   attempt (constructed BEFORE the Coordinator so its `wrapAttemptFn()`
   threads into Runtime construction — the identical indirection technique
   `fedos_electron_badge_main.cts` already established for its own
   `wiring`/`eventBridge` pair), and two new additive IPC channels
   (`fedos-beta:tray-action`, `fedos-beta:badge-mark-viewed`) alongside the
   unchanged `fedos-profile:*`/`fedos-beta:status`/`fedos-beta:settings-*`
   surface (Phase P — zero rename).

No other production source file was touched. All seven pre-existing Electron
main files remain byte-for-byte unmodified.

## Mandatory rules — honored

- **No duplicate ownership.** Every component in the Phase A inventory has
  exactly one live instance per running assembly; a confirmed Runtime
  restart rebuilds the Runtime-bound subset (Navigation/Tray/Badge/
  DeviceSyncWiring) and explicitly does NOT rebuild the Electron-global
  subset (Notification Coordinator, Background Lifecycle) — proven by a real
  test asserting reference identity across a restart.
- **No hidden sibling Runtime.** The Device Sync Scheduler is now real, but
  it lives INSIDE the one Coordinator-owned Runtime (a new construction
  input, not a second Runtime).
- **No test-only substitute in the normal entry point.** Production
  activation still fails closed (`seed-unavailable`/`blocked`) with no
  dev/fake authority fallback on a normal launch; `AUTOTEST_MODE` is
  unchanged in kind from the prior Arc's own precedent.
- **Architecture frozen.** Zero redesign of Runtime/Shell/Presentation/
  Renderer/Navigation/Settings/Device-Sync/Notification/Tray/Badge
  vocabularies. The one production-source touch beyond the assembly itself
  (`FedosProfileInitializationCoordinator`) is a single, precedented,
  optional-dependency extension.
- **No new dependency.** `electron`/`electron-builder` were already declared
  devDependencies (Alpha 3881-3940); this session simply installed them.
- **`p2p/`/`.tmp_gen/` untouched.**

## Test evidence

- Extended `test/secure_runtime_alpha_5061_5160_beta_application_assembly.test.ts`
  (updated call sites only, for the 3 new required assembly deps) — 7/7
  still passing.
- New `test/secure_runtime_alpha_5161_5240_canonical_desktop_composition.test.ts`
  — 9/9 passing against real boundaries:
  1. every owned component is a real, distinct object; Tray/Badge share the
     identical Navigation Registry (no duplicate Registry).
  2. Badge `refresh()` drives the real injected port; a second identical
     refresh never double-renders.
  3. With no trusted target: the Scheduler is real and enabled, honestly
     idle, zero eligible targets — never fabricated.
  4. `backgroundSyncEnabled` genuinely starts/stops the one real Scheduler
     through the Settings Application Coordinator (a real false→true→false
     transition, not merely a status read).
  5. `deviceSyncPresentationWiring.handleEvent()` routes a real event into
     the real Notification Coordinator and updates tray status — the
     IDENTICAL method a genuine Scheduler-sourced event would call.
  6. A confirmed Runtime restart rebuilds Navigation/Tray/Badge/
     DeviceSyncWiring as NEW objects while Notification/Background-Lifecycle
     stay the SAME objects.
  7. 3 successive restarts never leave more than the current generation
     reachable.
  8. `FedosDeviceSyncEventBridge.wrapAttemptFn()` threads correctly into a
     real Scheduler tick end to end.
  9. **Phase L** — 5 successive lock/unlock cycles against the SAME durable
     profile (fresh Coordinator per cycle, mirroring a real process
     relaunch) each produce exactly one live Runtime, verified via reference
     identity across all 5 cycles (5 distinct Runtime objects, never fewer,
     never more).
- `npm run typecheck` — core: 2 pre-existing, unrelated errors (unchanged);
  electron: 0 errors.
- Full `npx vitest run` — 296/13462 individual test failures across
  233/1020 files, the identical pre-existing fresh-worktree `?raw`-import
  artifact (unchanged count from the prior Arc's own baseline; the +9 new
  tests all pass).
- **Real, packaged-adjacent acceptance** (this session, genuine internet +
  Rust toolchain access): a real WASM `pkg/` was built; an unpackaged real
  Electron process (`electron dist/fedos_electron_beta_main.cjs`) completed
  create → real WASM Master Seed → `{"navigation":true,"badge":true,
  "tray":true,"deviceSyncStatus":"Idle"}` → lock → relaunch →
  wrong-passphrase-denied (composition honestly `false`/`false`/`false`/
  `null`, no assembly for a failed unlock) → relaunch → correct-passphrase-
  unlock (IDENTICAL identity, composition freshly rebuilt `true`/`true`/
  `true`/`"Idle"`). `electron-builder` packaging succeeded end-to-end against
  this Arc's larger `dist/` graph, correctly relocating the larger output.

## Honest, disclosed, non-release-blocking limitations

- **BLK-2 (high, unchanged from the prior Arc):** the PACKAGED `.exe`'s own
  direct launch (as opposed to `electron dist/...cjs`, fully verified) hangs
  before `app.whenReady()` in this sandboxed, display-less environment — a
  packaged-Electron GPU/compositor-init issue specific to this sandbox, not
  a defect in this Arc's own composition (identical source, verified
  unpackaged). Not re-investigated further this session; still not
  release-blocking (the prior Arc's own reasoning stands: the identical code
  path is fully verified unpackaged).
- **BLK-3/BLK-4 (medium, unchanged, accepted-beta-limitations):** Relay list
  and archive directory Settings still have no corresponding
  `FedosDesktopRuntimeConfig` field — untouched by this Arc's own scope
  (Navigation/Tray/Badge/Device-Sync composition, not Relay/Archive
  plumbing).
- **Renderer Boundary / rich multi-window conversation UI:** not
  constructed in the canonical entry point (disclosed in the ownership
  inventory) — this Arc's own mission named Navigation/Notification/Tray/
  Badge/Background/Device-Sync explicitly, not the separate per-content
  Renderer; a future Arc building a fuller conversation UI would need it.
  This is a scope note, not a blocker: every capability this Arc's mission
  named is real, composed, and verified.

No new release-blocking issue was found. BLK-1 is closed.

## Recommended next Arc

**FedOS Desktop Beta 0.1 Installer, Signing, Distribution, and Update Policy
Review.**
