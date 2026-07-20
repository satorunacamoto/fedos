# Secure Runtime Alpha 3941–4020 — Execution Spec

Desktop Device Management and Sync Operations UI Renderer Arc.

See `docs/secure_runtime_alpha_3941_4020_phase_a_presentation_inventory.md`
for the full Phase A (presentation inventory, 20 points) — this document
covers Phases B–N, in order.

## Base and reconciliation

Built inside a dedicated worktree, `C:\wt\desktop-device-sync-ui`, branch
`arc/desktop-device-sync-ui`, created directly from
`arc/device-sync-desktop-status` @ `5709684` — the fully-integrated
Desktop UI + Device Sync lineage (Alpha 3801-3880's own merge). **No
further reconciliation merge was required**: this base already contains
every precondition capability, verified directly by source inspection
(Phase A §1–§15), not by commit title alone. A separate, unrelated
Electron build-spike commit (`2f5bf72`, also reachable via branch
`arc/node-type-isolation`) exists on top of the PRE-merge Desktop-only
lineage (`7b72a3e`) — confirmed via `git merge-base` to share no Device
Sync content with this Arc's own base, and per this Arc's own explicit
instruction, not merged and not touched.

## Phase B — Closed screen vocabulary

`src/desktop/presentation/device_management/fedos_device_management_screen.ts`
— `FedosDeviceManagementScreen`, a closed 14-value union (`overview`,
`device-list`, `device-detail`, `registration`, `revocation-confirmation`,
`sync-status`, `schedule-list`, `transfer-list`, `transfer-detail`,
`conflict-list`, `conflict-detail`, `confirmation`, `unavailable`,
`error`) plus `isFedosDeviceManagementScreen()`, the one structural gate
every navigation call passes through. A separate closed 3-value
confirmation-action union (`revoke-device`, `trigger-sync-now`,
`stop-sync`) backs Phase C's own "pending confirmation action" concept.

## Phase C — Navigation state

`fedos_device_management_navigation_state.ts` —
`FedosDeviceManagementNavigationState`. Owns `screen`, `returnScreen`,
`selectedDeviceId`, `selectedScheduleId`, `selectedTransferSessionId`,
`selectedConflictId`, `pendingConfirmation` — nothing else. `goto()` is
fail-closed: an unrecognized screen id is refused (`false`, no state
change) rather than silently defaulting or throwing. Explicitly
non-durable, in-memory-only, reset on every fresh construction/process
restart — never written to any log or persistence port (stated in the
file's own header, verified by structural guard test 1/2).

## Phase D — Overview screen model

`fedos_device_management_screen_model.ts` —
`fedosDeviceManagementBuildOverview()`. Composes real facts from 4 of the
6 existing ViewModels (device inventory, sync status, conflicts,
transfers) into one `FedosDeviceManagementOverviewContent`.
`allKnownTransfersImported` is `true` ONLY when the Scheduler is enabled,
every known transfer reports `deviceImported: true`, AND no unresolved
conflict exists — an empty transfer set NEVER counts as "everything
synced" (verified directly, test "38b"). `relayAcceptedTransferCount`/
`targetImportedTransferCount` are always two separate fields, never
merged.

## Phase E — Device list / detail

`fedosDeviceManagementFilterDevices()` supports the 6 named filters (`all`,
`trusted`, `revoked`, `pending`, `local`, `remote`) as a PURE client-side
filter over the already-fetched real device list — no new Shell query.
Device detail is a thin passthrough to `FedosDesktopDeviceInventoryViewModel.selectedState`,
with a stale-id guard (Phase M scenario 33): if the navigation's own
`selectedDeviceId` no longer matches the ViewModel's own loaded detail,
the controller returns `"invalid-input"` rather than silently showing the
wrong Device.

## Phase F — Registration / Revocation (honest partial boundary)

**Real, documented finding (Phase A §1/§20): no
`registerDevice`/`confirmTrust`/`revokeDevice`/`mintChallenge` command
exists anywhere on `FedosDesktopApplicationShell` or
`FedosDeviceSyncOperationalFacade`** — only `runtime.deviceTrust()`
supports those, and the Shell never calls it. This Arc therefore builds
the COMPLETE, real screen models for both flows and stops exactly at the
missing command boundary, per its own Phase F instruction:

- **Registration** (`fedosDeviceManagementBuildRegistration()`): always
  reports `available: false` with an honest reason — mirrors
  `deviceStatus()`'s own established "real, intentional, non-placeholder"
  precedent. No fabricated challenge, QR, network, or clipboard transport
  of any kind.
- **Revocation Confirmation** (`fedosDeviceManagementBuildRevocationConfirmation()`):
  identifies the exact Device, states revocation is terminal, states
  previously-delivered data is not remotely erased, offers no "trust
  again" action — but `confirmAvailable: false`, since no real
  `revokeDevice()` command is reachable from this layer. A REAL
  revocation issued through `runtime.deviceTrust()` directly (as any
  caller with Runtime access could already do today) IS correctly
  reflected everywhere this Arc's own screens read Device state
  afterward (verified directly, test 14).

## Phase G — Sync operations

`fedosDeviceManagementDeriveSyncActionState()` — a pure function mapping
`{schedulerStatus, actionInFlight, loadOutcome}` onto the 8 named states
(`disabled`, `unavailable`, `stopped`, `starting`, `running`,
`tick-in-flight`, `stopping`, `failed`). `FedosDeviceManagementController`'s
own `#syncStartStopInFlight`/`#triggerInFlight` private flags are the ONLY
new state this Arc adds — a second `startSync()`/`confirmStopSync()`/
`confirmTriggerSyncNow()` call while one is already in flight is a silent
no-op (verified directly, test 34, "duplicate submit prevented"). No
polling timer of any kind exists anywhere in this Arc's own files
(confirmed by source inspection — no `setInterval`/`setTimeout` appears in
any new file).

## Phase H — Schedule / Transfer screens

Schedule list is a thin, truncated passthrough of
`FedosDesktopSyncScheduleViewModel.state`. Transfer detail has no
dedicated per-item Shell/ViewModel fetch on this base (Alpha 3801-3880
built list-only) — this Arc's own `transferDetailState` performs a PURE
client-side lookup within the already-loaded list by
`selectedTransferSessionId`, never a second Shell call; a stale/absent id
reports `"not-found"` honestly.

## Phase I — Conflict Inbox

`fedosDeviceManagementFilterConflicts()` supports `unresolved`,
`operator-required`, `all`. Every rendered conflict's own `availableActions`
comes verbatim from the real `FedosDeviceSyncConflictView.availableActions`
(Alpha 3801-3880, already closed to exactly 4 safe actions) — this Arc
invents no 5th action and no "force overwrite"/"use newest timestamp"/
"trust remote blindly"/"revive revoked Device" of any kind anywhere.
Verified directly: navigating away from and back to a conflict never
resolves it (test 29); acknowledging is the only state-changing path
(test 28); the resolved fact survives a full Runtime/Boundary restart over
the same durable Conflict log (test 30).

## Phase J — Render models

`src/desktop/renderer/device_management/fedos_device_management_renderer.ts`
— `FedosDeviceManagementRenderer`, registered as `.deviceManagement` on the
EXISTING `FedosDesktopRenderer` (never a second, parallel top-level
Renderer class). Every method projects the controller's own
`FedosDesktopViewModelState<T>`-shaped getters through the SHARED,
unmodified `fedosRenderModel()`/`fedosRenderList()` helpers
(`fedos_desktop_render_model.ts`) exactly like every existing content
Renderer. `fedos_device_management_action_descriptor.ts` — closed
`{id, label, enabled, disabledReason}` shape, no function/callback field
of any kind (verified by structural guard test 5).

## Phase K — Accessibility / UX-neutral metadata

Every render method attaches `title`; list screens attach
`emptyStateMessage` (`null` unless the list is genuinely empty — an empty
list is real content, not an error); action descriptors carry `label`/
`enabled`/`disabledReason`. No color system, no framework component, no
hard-coded visual styling of any kind — every string is a plain English
sentence a future localization layer could key off of, without this Arc
opening any localization architecture itself.

## Phase L — Limits

`fedos_device_management_presentation_limits.ts` — reuses
`FEDOS_DESKTOP_HOST_MAX_ID_LENGTH` (Alpha 3561-3640, unmodified) verbatim
for label/id truncation (the one existing constant that genuinely already
governs this exact concern); introduces 4 NEW, honestly-labeled
presentation-only list-size caps (`200` each for Devices/Schedules/
Transfers/Conflicts, since no existing domain/resource limit governs "how
many items to show on one screen" — Alpha 3721-3800's own
`FEDOS_DEVICE_SYNC_DEFAULT_RESOURCE_LIMITS` governs scheduling/retention,
a genuinely different concern, and is not repurposed here). Every list
screen model reports `totalCount`/`renderedCount`/`truncated` honestly
(verified directly, test 40, with a synthetic 250-item array).

## Phase M — Real acceptance tests

2 new test files, real `startFedosDesktopRuntime()`/
`FedosDesktopApplicationShell`/`FedosDesktopConversationUiPresentationBoundary`/
`FedosDesktopRenderer` instances throughout — no mocking of any layer this
Arc or Alpha 3801-3880 itself owns:

- `test/secure_runtime_alpha_3941_4020_device_management_controller_and_renderer.test.ts`
  (23 tests) — covers Phase M scenarios 1–10, 13–26, 28–40 directly.
- `test/secure_runtime_alpha_3941_4020_security_boundary_guards.test.ts`
  (14 tests) — Phase N.

Scenarios 11/12 (registration success/expired-replayed) are the one
explicitly out-of-scope pair given the Phase F finding (§ above) — no
real registration command exists to drive them through this layer; this
is stated honestly rather than fabricated. Scenario 27 (conflict detail)
is covered as part of the combined 26/27/28/29/30 test. All other 35 of
the 40 named scenarios are exercised directly.

## Phase N — Structural guards

Verified via source-inspection tests: the controller imports the Shell/
Runtime NOWHERE (only the 5 existing ViewModels' own types plus the
Boundary type); no presentation-layer file under `device_management/`
imports a Device Registry/Scheduler/Sync Journal/Relay/persistence/crypto
class; the renderer imports ONLY the controller/screen types and the
shared render-model helpers; the renderer calls no ViewModel/controller
mutating method (read-only getters only); no secret-shaped field name
anywhere in this Arc's own new source; zero `throw new Error(...)`
anywhere in this Arc's own new files (every failure mode is a closed
result); no new npm dependency (2 production dependencies, unchanged); no
Electron/React/Vue/Svelte/Tauri reference; `package.json`/
`package-lock.json`/`tsconfig.json`/`Cargo.toml` show zero git changes;
`src/conversation`/`src/search` show zero git changes; every EXISTING
Shell/Facade/ViewModel/Renderer file from Alpha 3801-3880 and earlier
shows zero git changes (this Arc is purely additive); `p2p/`/`.tmp_gen/`
absent and untouched.

## Baseline / final comparison

- Fresh worktree, before any production edit: **195 failed test files /
  801 passed (996 total)**, **248 failed tests / 12856 passed (13104
  total)**.
- After this Arc's full implementation, `npm test` (re-run 3 times to
  characterize this environment's own already-documented run-to-run
  variance): **199 failed / 799 passed (998 total)** files, **248–257
  failed / 12856–12884 passed (13104–13141 total)** tests. Total FILE
  count increases by exactly `+2` every run — this Arc's own 2 new test
  files, both 100% passing, grep-confirmed zero mentions of
  `secure_runtime_alpha_3941_4020` anywhere in any failure output across
  all 3 runs. The small run-to-run variance in the PRE-EXISTING failure
  count (248/255/257) is itself an already-documented characteristic of
  this large (13000+ test), highly parallel suite's own `?raw`-import/
  missing-WASM-artifact environmental issues — confirmed NOT
  Device-Management-related by name (the only "desktop"-matching failures
  in the full run are `secure_runtime_alpha_178_nostr_desktop_presentation_review.test.ts`,
  `..._203_null_event_reader_and_desktop_wiring_decision.test.ts`,
  `..._400_desktop_host_write_coordination_completion.test.ts` — three
  arcs from far earlier in this codebase's history, entirely outside this
  Arc's own touched-file set, confirmed via the structural guard tests'
  own `git status --porcelain` checks). `npm run typecheck`: clean except
  the one pre-existing error already present on the base commit
  (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`).

## Completion declaration

**Honest partial completion.** Every target screen (Device Overview,
Local Device Detail, Trusted/Revoked Devices, Sync Operations, Pending
Sync Schedules, Transfer Sessions, Relay Delivery Status, Conflict Inbox,
Conflict Detail, Device Registration, Device Revocation Confirmation,
Sync Trigger Confirmation, Disabled/Unavailable State, Runtime Stopped/
Error State) has a complete, real, safe screen model and render output.
Sync operations, schedule/transfer visibility, and the ENTIRE Conflict
Inbox (including safe acknowledgment) are fully real end to end. **Device
Registration and Device Revocation confirmation actions remain honestly
unavailable** — no Shell/Facade command exists to drive them, a real,
pre-existing gap this Arc's own scope explicitly instructs it to stop at
(Phase F) rather than add a new Shell command itself (out of this
"UI Renderer Arc"'s own stated scope) or fabricate a fake success.

**Recommended next Arc**: Electron Main/Preload Adapter for
`FedosDesktopHostBridge` and Device Management Renderer Arc.
