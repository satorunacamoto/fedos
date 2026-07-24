# Secure Runtime Alpha 3941–4020 — Phase A: Presentation Inventory

Desktop Device Management and Sync Operations UI Renderer Arc. Written
BEFORE any production edit in this worktree, per this Arc's own Phase A
instruction.

## Base and reconciliation

Worktree `C:\wt\desktop-device-sync-ui`, branch `arc/desktop-device-sync-ui`,
created directly from `arc/device-sync-desktop-status` @ `5709684` — the
fully-integrated Desktop UI + Device Sync lineage (Alpha 3801-3880's own
merge, `7014298`). **No further reconciliation merge is required**: this
base already contains every precondition capability (Desktop Runtime,
Shell, Presentation, Renderer, Host Boundary Foundation, Device Trust,
Device Registration, Device Sync Foundation, Relay-Assisted
Synchronization, Scheduling/Conflict Resolution, and the Device Sync
Operational Status integration itself), verified directly by source
inspection below, not by commit title alone.

A separate, later commit exists on `main`/other branches — `2f5bf72`
("Electron Dependency and Development Build Spike Arc", also reachable via
branch `arc/node-type-isolation`) — built on TOP of `7b72a3e` (the
Desktop-only lineage, pre-dating the Device Sync merge), entirely
independent of `5709684`. Per this Arc's own explicit instruction, it is
NOT merged and NOT touched; confirmed its merge-base with `5709684` is
`7b72a3e`, i.e. it shares no Device Sync content with this Arc's own base
and carries no Electron dependency into this worktree.

## 1. Current Device Sync Shell commands

`src/desktop/shell/fedos_desktop_application_shell.ts` exposes exactly 11
Device Sync commands (Alpha 3801-3880): `devicesList()`, `deviceDetail(id)`,
`deviceSyncStatus()`, `deviceSyncStart()`, `deviceSyncStop()`,
`deviceSyncNow()`, `syncSchedulesList()`, `syncTransfersList()`,
`syncConflictsList(includeResolved?)`, `syncConflictDetail(id)`,
`syncConflictAcknowledge(id, action)`, plus the pre-existing, unrelated
`deviceStatus()` (always `"unavailable"`, Alpha 2841-2920, unmodified).
**No `registerDevice`/`confirmTrust`/`revokeDevice`/`mintChallenge` command
exists anywhere on the Shell** — confirmed by a full method-name listing of
the class. `runtime.deviceTrust()` itself (the accessor that DOES support
registration/confirmation/revocation) is never called from
`fedos_desktop_application_shell.ts` — the Shell only ever reaches Device
Sync through `runtime.deviceSyncOperational()`.

## 2. Current Device operational facade

`src/desktop/runtime/fedos_device_sync_operational_facade.ts` —
`FedosDeviceSyncOperationalFacade`. Methods: `listDevices()`,
`deviceDetail(id)`, `syncStatus()`, `startSync()`, `stopSync()`,
`triggerSyncNow()`, `listSchedules()`, `listConflicts(includeResolved?)`,
`conflictDetail(id)`, `acknowledgeConflict(id, action)`,
`listTransferSessions()`. Returns
`FedosDeviceSyncOperationalResult<T> = {outcome:"ok",value} |
{outcome,reason}` with
`outcome ∈ {disabled, unavailable, not-found, invalid-input, conflict, failed}`.
**No registration or revocation method exists on the facade either** — it
wraps `FedosDeviceTrustRuntime` for read-only device facts only. This Arc
introduces no second facade (Absolute Prohibition) and adds no method to
this file.

## 3. Existing Device/Sync ViewModels

`src/desktop/presentation/`: `FedosDesktopRuntimeStatusViewModel`
(pre-existing, Alpha 3241-3320, holds `{runtimeStatus, deviceStatus}` —
the OLD, always-`"unavailable"` `deviceStatus`, unrelated to this Arc's own
concern), `FedosDesktopDeviceInventoryViewModel` (list + selected detail),
`FedosDesktopDeviceSyncStatusViewModel` (aggregate status +
start/stop/triggerNow + last-tick state), `FedosDesktopSyncScheduleViewModel`
(read-only list), `FedosDesktopTransferSessionViewModel` (read-only list),
`FedosDesktopSyncConflictViewModel` (list + selected detail + acknowledge).
All registered on `FedosDesktopConversationUiPresentationBoundary`. None
owns a screen/navigation concept — each is a narrow, single-concern
ViewModel with no relation to any other (no "current screen" state
anywhere).

## 4. Existing Device/Sync renderers

`src/desktop/renderer/`: `FedosDesktopStatusRenderer` (pre-existing,
projects the OLD `runtimeStatus`/`deviceStatus` pair unreshaped),
`FedosDesktopDeviceListRenderer` (list + detail),
`FedosDesktopDeviceSyncStatusRenderer` (status + last-tick),
`FedosDesktopSyncScheduleRenderer`, `FedosDesktopTransferSessionRenderer`,
`FedosDesktopSyncConflictRenderer` (list + detail). All registered on
`FedosDesktopRenderer`. Each is independent — no composed "screen" output
exists; a future UI would need to manually assemble 6 separate renderer
calls with no shared navigation/selection state to know WHICH device/
schedule/transfer/conflict is "current."

## 5. Closed Shell outcome vocabulary

`fedos_desktop_shell_result.ts` — `FedosDesktopShellOutcomeKind =
"unavailable" | "unauthorized" | "not-found" | "invalid-input" | "conflict" |
"requires-activation" | "requires-unlock" | "unsupported" | "failed"`,
`FedosDesktopShellResult<T> = {outcome:"ok",value} | {outcome,reason}`.
UNMODIFIED by Alpha 3801-3880 (which mapped the facade's own `"disabled"`
onto the Shell's existing `"unsupported"`). This Arc reuses this
vocabulary unchanged, never widens it.

## 6. Closed Renderer output vocabulary

`fedos_desktop_render_model.ts` — `FedosDesktopRenderModel<T> =
{kind:"idle"} | {kind:"loading"} | {kind:"error",outcome,message} |
{kind:"content",content:T}`, plus the shared `fedosRenderList()` helper
producing `{items,count,isEmpty}`. UNMODIFIED. This Arc's own screen-level
render model (Phase J) is a NEW, separate, ADDITIVE composition one layer
above this — it does not replace or widen this shared primitive.

## 7. Device trust states

`FedosDeviceTrustState = "pending" | "trusted" | "revoked" | "unavailable"`
(`src/device/fedos_device_binding.ts`, Alpha 2921-3000, unmodified).
`"revoked"` is terminal (no outgoing transition).

## 8. Scheduler states

Facade-level `FedosDeviceSyncSchedulerStatusView`: `enabled` (`false` when
`deviceSyncSchedulerEnabled` was never configured — a CONFIGURATION fact,
distinct from live state), `running`, `tickInFlight`, `scheduleCount`,
`pendingCount`, `inProgressCount`, `completedCount`, `failedCount`,
`operatorRequiredCount`, `targetDeviceCount`. This Arc's own presentation
layer must additionally represent transient UI-only states an action
button needs (`starting`/`stopping`, per Phase G) that the facade itself
has no notion of — these are PURELY local navigation/action-pending state
(Phase C), never persisted, never claimed as a real domain state.

## 9. Schedule states

`FedosDeviceSyncScheduleState = "pending" | "in-progress" | "completed" |
"failed" | "operator-required"` (`src/device/sync_scheduler/fedos_device_sync_schedule.ts`,
Alpha 3721-3800, unmodified). View shape
(`FedosDeviceSyncScheduleView`): `scheduleId`, `sourceDeviceId`,
`targetDeviceId`, `state`, `attemptCount`, `nextEligibleAt`,
`lastCoarseOutcome`, `createdAt`, `updatedAt`.

## 10. Transfer states

`FedosDeviceTransferState = "invited" | "challenged" | "approved" |
"package-sent" | "verified" | "completed" | "aborted" | "failed"`
(`src/device/transfer/fedos_device_transfer_session.ts`, Alpha 3481-3560,
unmodified). Facade view (`FedosDeviceSyncTransferSessionView`):
`transferSessionId`, `sourceDeviceId`, `targetDeviceId`, `state`,
`relayAccepted`, `deviceImported`, `createdAt` — the two booleans are
independently sourced (never collapsed), per Alpha 3801-3880's own
guarantee.

## 11. Relay delivery states

`FedosDeviceRelaySyncObservationState` (9 values, `src/device/relay_sync/fedos_device_relay_sync_observation.ts`,
Alpha 3641-3720, unmodified): `"queued" | "publishing" | "relay-accepted" |
"relay-rejected" | "relay-failed" | "received" | "imported" | "denied" |
"expired"`. Not directly exposed by the facade (which pre-derives only the
two booleans above) — this Arc's own render/screen models consume ONLY
those two booleans, never the raw 9-value Observation state (Absolute
Prohibition: no raw Relay events).

## 12. Import states

`FedosSyncApplyOutcome = "applied" | "duplicate" | "conflict" |
"archived-skip"` (`src/sync/fedos_sync_state.ts`, Alpha 2421-2500,
unmodified) — an internal Journal-apply outcome, NOT directly exposed by
the facade or any existing ViewModel/Renderer. This Arc's own screen
models do not surface this internal vocabulary directly; "imported" at the
presentation layer means `FedosDeviceSyncTransferSessionView.deviceImported
=== true` only (§10/§11).

## 13. Conflict states

`FedosDeviceSyncConflictKind` (11 values, `fedos_device_sync_conflict.ts`),
`FedosDeviceSyncResolutionDecision` (7 values,
`fedos_device_sync_conflict_authority.ts`),
`FedosDeviceSyncConflictResolutionAction` (4 values,
`fedos_device_sync_conflict_persistence.ts`) — all Alpha 3721-3800,
unmodified. Facade view (`FedosDeviceSyncConflictView`): `conflictId`,
`recordType`, `conversationId`, `sourceDeviceId`, `targetDeviceId`,
`conflictKind`, `decision`, `reason`, `operatorRequired`, `firstObservedAt`,
`lastObservedAt`, `resolved`, `resolutionAction`, `availableActions`.

## 14. Supported safe conflict actions

Exactly 4, closed: `"accept-identical" | "discard-invalid" |
"refresh-missing-dependency" | "acknowledge"` — already enforced by both
the facade (`acknowledgeConflict()` validates against this exact list
before any persistence lookup) and the Shell
(`syncConflictAcknowledge()`, a thin passthrough). This Arc's own
Conflict Inbox screen (Phase I) exposes ONLY these 4 as button-shaped
action descriptors — never a 5th, generic action.

## 15. Disabled/unavailable behavior

Shell: every Device Sync method returns `{outcome:"unavailable"}` before
`start()`/after `stop()`; `{outcome:"unsupported"}` when
`deviceTrustEnabled` was never configured (facade `"disabled"` mapped).
Facade: every method independently re-checks `isRuntimeRunning()` (a
SECOND, closure-level gate — a reference grabbed before `stop()` still
fails closed afterward). This Arc's own screen models must render BOTH
"the whole Runtime is stopped" (a single top-level state, Phase M scenario
2) and "this specific optional capability was never configured"
(`"unsupported"`, Phase M scenario 1) as textually DISTINCT presentation
states, never conflated into one generic "error."

## 16. Current missing screen composition

No file anywhere composes more than one ViewModel's state into a single
screen-shaped model. There is no "Overview" that combines local Device
identity + trust counts + scheduler status + conflict/transfer counts into
one glance-able fact set (Phase D). There is no Device Registration or
Device Revocation screen model of any kind (no such ViewModel/Renderer
exists at all today — Phase F starts from nothing). There is no
Confirmation screen concept (start/stop/trigger/revoke all execute
immediately today with no "are you sure" state anywhere in presentation).

## 17. Current missing navigation model

No file anywhere tracks "which screen is currently shown," "which
deviceId/scheduleId/transferSessionId/conflictId is selected," or "what
screen to return to." Every existing ViewModel is independently
addressable only by a caller holding a direct reference to it (e.g. a test
calling `boundary.syncConflict.selectConflict(id)` directly) — there is no
single owner of "the user's current place in the UI." Phase C starts from
nothing.

## 18. Exact source files expected to change

New, under `src/desktop/presentation/device_management/` (a new
subdirectory, mirroring no existing precedent exactly but consistent with
this codebase's own "one concern, one file" discipline — every existing
presentation file lives flat under `src/desktop/presentation/`, but this
Arc's own scope, screen vocabulary + navigation state + 15 screen models +
limits, is large enough to warrant its own subdirectory rather than 15+
more flat files crowding the existing directory; this is a pure additive
choice, not a restructuring of any existing file):

- `fedos_device_management_screen.ts` (Phase B — closed screen vocabulary)
- `fedos_device_management_navigation_state.ts` (Phase C)
- `fedos_device_management_presentation_limits.ts` (Phase L)
- `fedos_device_management_controller.ts` (Phases D–I — the ONE class
  owning navigation state + composing the 6 existing ViewModels into
  screen models on demand; registered as a NEW `.deviceManagement`
  property on the EXISTING `FedosDesktopConversationUiPresentationBoundary`,
  the SAME additive-registration pattern Alpha 3801-3880 already used for
  its own 5 ViewModels — never a second, parallel top-level boundary
  class)

New, under `src/desktop/renderer/device_management/`:

- `fedos_device_management_renderer.ts` (Phase J — consumes ONLY the
  controller above; registered as a NEW `.deviceManagement` property on
  the EXISTING `FedosDesktopRenderer`)

New, under `test/`: 1 or more
`secure_runtime_alpha_3941_4020_*.test.ts` files (Phase M/N).

New, under `docs/`: this file plus `..._execution_spec.md` and
`..._completion_declaration.md`.

Modified: `README.md` only (chronological status blurb). **No existing
Shell, Facade, ViewModel, or Renderer file is modified** — this Arc is
purely additive on top of the existing presentation/renderer layer,
confirmed achievable without touching any of them (every fact this Arc
needs is already reachable through the EXISTING 6 ViewModels' own public
getters/actions).

## 19. Baseline failures (this worktree, before any production edit)

`npm run typecheck`: clean except the one pre-existing
`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`
error (confirmed present on the base commit before this Arc). `npm test`:
**195 failed test files / 801 passed (996 total)**, **248 failed tests /
12856 passed (13104 total)** — consistent with this session's own
established, independently-reconfirmed environmental pattern
(`?raw`-import artifact in fresh worktrees; missing compiled WASM `pkg/`
artifact), not a regression.

## 20. Exact no-new-authority / no-second-command plan

This Arc constructs zero new Shell commands, zero new facade methods, zero
new ViewModels beyond composition, and zero new business logic:

- Every screen model is a PURE, synchronous projection of the 6 EXISTING
  ViewModels' own already-public `.state`/`.listState`/`.selectedState`/
  `.lastTickState` getters — never a second call path to the Shell.
- Registration and Revocation screen models (Phase F) represent ONLY what
  is REAL: the closed `FedosDeviceTrustState` vocabulary, a confirmation
  flow structure, and honest copy about terminality/non-erasure. Because
  **no Shell/Facade command exists to actually mint a challenge, register,
  confirm, or revoke a Device**, this Arc's own confirmation actions for
  those two screens resolve to a `"not-implemented"`-shaped, honestly
  labeled outcome (mirroring `deviceStatus()`'s own established "real,
  intentional, not a placeholder" `"unavailable"` precedent) rather than
  either fabricating success or silently doing nothing. This is the one
  honest, documented boundary this Arc stops at (per its own Phase F
  instruction and the "honest partial title" allowance in COMMIT).
- The Conflict Inbox's own `acknowledge` action IS fully real (§14) — no
  gap there.
- Navigation state (Phase C) is explicitly documented as non-durable,
  in-memory-only, reset on process restart — never written to any log,
  never treated as canonical Device/Sync truth.
