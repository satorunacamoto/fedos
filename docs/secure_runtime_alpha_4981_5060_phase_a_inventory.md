# Secure Runtime Alpha 4981-5060 — Phase A: Settings-to-Runtime Inventory & Classification

**Desktop Settings Runtime Application and Safe Reconfiguration Arc.** This is
the mandatory Phase A reconciliation, written BEFORE any production edit. Every
classification below was derived by reading the REAL source in this worktree
(`C:\wt\desktop-settings-runtime-application`, branch
`arc/desktop-settings-runtime-application-safe-reconfiguration`, base
`152d05a`), not assumed from the spec's examples or from docs/commit messages.

## Branch / source reconciliation

- Base tip verified: `152d05a` ("Add Secure Runtime Alpha 4901-4980: Desktop
  Settings, Relay Configuration, and User Preferences Arc"). Clean worktree.
- Settings persistence round-trip: confirmed passing — the prior Arc's
  `test/secure_runtime_alpha_4901_4980_desktop_settings.test.ts` is **31/31**
  green against real temp-directory JSON files.
- No unrelated branch merged. Only additive files created.

## Ownership graph (read from real source)

- `FedosSettingsDescriptorV1` — `src/settings/fedos_settings_descriptor.ts`.
  Ten closed fields + `schemaVersion`. Deep-frozen, non-secret, closed
  vocabulary; validator enforces exact key count.
- Settings persistence/authority/controller — `src/settings/*`,
  `src/desktop/settings/fedos_desktop_settings_controller.ts`. File-backed,
  fail-closed, entirely INDEPENDENT of the running Runtime.
- `startFedosDesktopRuntime()` — `src/desktop/runtime/fedos_desktop_runtime.ts`.
  Constructs the Host, `FedosConversationRelaySet`
  (from `config.conversationTransportRelays`), archive runtime (from
  construction-time paths), and the device-sync facade — ALL at construction.
- `FedosConversationRelaySet` — constructed once from config; no live
  "replace relays" method exists on `FedosPrivateTransport`. **Immutable after
  construction.**
- Archive runtime — `assembleFedosConversationArchiveRuntime`, wired from
  construction-time log paths. **Directory bound at construction.**
- `FedosDeviceSyncOperationalFacade` — `deviceSyncOperational()` exposes
  `startSync()` / `stopSync()` / `syncStatus()`. **A real, exposed live
  boundary** over the ONE `FedosDeviceSyncScheduler` (which owns the single
  interval timer; `stopSync()` awaits the in-flight tick).
- `FedosDesktopNotificationCoordinator` — `src/desktop/notification/`.
  Orchestration over a `FedosDesktopNotificationPort`; has NO enabled/suppress
  toggle. Presentation can be gated ADDITIVELY by decorating the port (this
  Arc's `GatedFedosDesktopNotificationPort`), never by mutating the coordinator.
- Notification / Tray / Badge / Background lifecycle coordinators — pure
  decision/orchestration; presentation preference is a renderer/shell concern.
- Auto-lock: **no** idle/user-activity boundary exists anywhere in `src/`
  (grep confirms `autoLock` appears only in the settings descriptor/validator/
  codec/renderer — i.e. persisted but no live caller).
- Auto-start: **no** OS auto-start boundary exists anywhere (`setLoginItem` /
  `openAtLogin` absent from `src/` and `packages/*` except unrelated meshkv).
- Localization: no i18n framework exists; `language` is a closed `en`/`ja`
  vocabulary with no consumer.

## Classification table (the evidence-derived answer)

| Setting | Persisted? | Live effect before this Arc? | Application class | Target authority | Safe rollback? | Confirmation? | Implemented live this Arc? |
|---|---|---|---|---|---|---|---|
| theme | yes | none | A IMMEDIATE | presentation sink | yes | no | **yes** |
| windowLayout | yes | none | A IMMEDIATE | presentation sink | yes | no | **yes** |
| notificationsEnabled | yes | none | A IMMEDIATE | notification presentation gate | yes | no | **yes** |
| backgroundSyncEnabled | yes | none | B SUBSYSTEM | `FedosDeviceSyncOperationalFacade` start/stop | yes | yes | **yes** |
| relays | yes | none | C RUNTIME-RESTART | Runtime reconstruction | no | yes | persisted + pending-restart (honest) |
| defaultRelay | yes | none | C RUNTIME-RESTART | Runtime reconstruction | no | yes | persisted + pending-restart (honest) |
| archiveDirectory | yes | none | C RUNTIME-RESTART | Runtime reconstruction | no | yes | persisted + pending-restart (honest) |
| language | yes | none | E UNSUPPORTED | — (no localization boundary) | no | no | blocked (honest) |
| autoStart | yes | none | E UNSUPPORTED | — (no OS auto-start boundary) | no | no | blocked (honest) |
| autoLockTimeoutMinutes | yes | none | E UNSUPPORTED | — (no idle/activity boundary) | no | no | blocked (honest) |

`schemaVersion` is a structural marker, not an applicable field.

## Expected production files (all additive)

- `src/settings/application/fedos_settings_application_class.ts`
- `src/settings/application/fedos_settings_application_plan.ts`
- `src/settings/application/fedos_settings_effective_state.ts`
- `src/desktop/settings/fedos_desktop_settings_application_ports.ts`
- `src/desktop/settings/fedos_desktop_settings_application_coordinator.ts`
- `src/desktop/settings/fedos_desktop_settings_application_host_command.ts`
- `src/desktop/settings/fedos_desktop_settings_application_host_bridge.ts`
- `src/desktop/presentation/fedos_desktop_settings_application_view_model.ts`

## Baseline failures (A/B)

- `typecheck:core`: exactly TWO pre-existing errors, both in untouched prior
  test files (`...4741_4820_production_master_seed_activation.test.ts:189`,
  `...477_scheduler_lifecycle_model.test.ts:121`). Zero new errors from this Arc.
- Full `vitest run`: ~252–260 pre-existing failures (fresh-worktree raw-import /
  source-alignment review / missing compiled WASM `pkg/`), fluctuating with
  concurrency. A/B measured with this Arc's files moved aside: **252 failed**;
  with them present the new suite is **50/50 green** and no existing test
  changes status.

## Rollback strategy

- IMMEDIATE fields: reversible on the live sink (re-assert prior value).
- SUBSYSTEM: re-assert prior scheduler run state.
- RUNTIME-RESTART / UNSUPPORTED: no in-process rollback; the desired value is
  durably persisted and reported honestly as pending/blocked (never a false
  "applied", so nothing to roll back).

## One reproduced "persisted-but-no-effect" setting

Before this Arc, saving `theme: "dark"` through the Settings controller
persisted the value to the JSON file, but nothing in the running process ever
read it — the renderer projection is a pure read-model with no live presentation
sink. This Arc closes that: `initialize()` seeds a live presentation sink and
`apply()` mutates it, so the running process reflects the theme immediately.
