# Secure Runtime Alpha 3801–3880 — Execution Spec

Device Sync Operational Status and Desktop Shell Integration Arc.

See `docs/secure_runtime_alpha_3801_3880_phase_a_reconciliation.md` for the
full Phase A (source/ownership reconciliation, 20 points) — this document
covers Phases B–K, in order.

## Base and reconciliation summary

Built inside a dedicated worktree, `C:\wt\device-sync-desktop-status`,
branch `arc/device-sync-desktop-status`, created from
`arc/desktop-electron-host-boundary` @ `7b72a3e` (the completed Desktop UI
lineage) and merged with `arc/device-sync-scheduler` @ `24ca375` (the
completed Device Sync lineage) via `git merge --no-ff`, commit `7014298`.
Exactly 3 files conflicted (`README.md`,
`src/desktop/runtime/fedos_desktop_runtime.ts`,
`src/desktop/runtime/fedos_desktop_runtime_config.ts`) — all purely
mechanical (both lineages appended distinct, non-overlapping optional
capabilities at the same textual anchor points) and resolved as a literal
union of both sides, dropping nothing. No architecture-selection conflict
occurred (Phase A's own point 6 stop-condition did not trigger). Full
detail in the Phase A reconciliation doc §19.

## Phase B — Runtime Operational Facade

`src/desktop/runtime/fedos_device_sync_operational_facade.ts` —
`FedosDeviceSyncOperationalFacade`. Delegates entirely to:

- `FedosDeviceTrustRuntime` (already wired, Alpha 2921–3000) for device
  inventory/trust.
- An injected `FedosDeviceSyncScheduler` (Alpha 3721–3800), constructed
  ONLY when `config.deviceSyncSchedulerEnabled` — reuses the SAME
  `FedosDeviceRegistryPersistence`/`FedosSyncState` instances
  `FedosDeviceTrustRuntime` already owns (no second Registry, no second
  Journal).
- An injected `FedosDeviceSyncConflictPersistence` for conflict
  visibility/safe acknowledge.
- An injected `FedosDeviceTransferSessionPersistence` (read-only — this
  Arc does not drive the Transfer protocol) for transfer session status.
- An injected `FedosDeviceRelaySyncObservationRepository`, queried via the
  existing `queryFedosDeviceRelaySyncStatusForSession()` to derive two
  INDEPENDENT booleans, `relayAccepted`/`deviceImported` — never collapsed.

Returns a closed `FedosDeviceSyncOperationalResult<T>` —
`{outcome:"ok",value}` or `{outcome,reason}` with
`outcome ∈ {disabled, unavailable, not-found, invalid-input, conflict,
failed}`. Every method checks `isRuntimeRunning()` first (two-layer
defense, mirrors `FedosDesktopConversationContentAccessor`).

**No new authority is constructed** (Phase A §20): this Arc does not
assemble a real, network-attached Relay Sync graph (that needs a
Device-scoped signing authority and Sync Package encryption authority this
Runtime does not source today). The Scheduler's `attemptFn` is an
OPTIONAL, entirely caller-supplied `FedosDeviceSyncAttemptFn`; omitted,
every tick's own attempt fails closed to `"failed"` — never fabricating
`"delivered"`.

## Phase C — Desktop Runtime wiring

`fedos_desktop_runtime.ts`/`fedos_desktop_runtime_config.ts` extended
additively (union-merged per the reconciliation above, then further
extended by this Arc): 9 new optional config fields
(`deviceSyncSchedulerEnabled`, `deviceSyncAbandonmentPolicy`,
`deviceSyncResourceLimits`, `deviceSyncIntervalMs`, `deviceSyncAttemptFn`,
`deviceSyncScheduleLogPath`, `deviceSyncConflictLogPath`,
`deviceSyncTransferSessionLogPath`, `deviceSyncRelaySyncObservationLogPath`),
one new accessor, `deviceSyncOperational(): FedosDeviceSyncOperationalFacade`
(same two-state fail-closed contract as every other accessor). Exactly one
facade per running Runtime, gated by the SAME `deviceTrustEnabled` flag
`deviceTrust()` itself uses (the facade composes that same instance).
`stop()` now awaits `deviceSyncSchedulerInstance.stopSync()` BEFORE the
Host itself stops — the Scheduler's own "wait for in-flight tick" contract,
unmodified, now reachable from Runtime shutdown. Existing callers compile
unchanged when every new field is omitted (verified by the full pre-Arc
Desktop-lineage test suite passing unchanged post-wiring).

## Phase D — Shell commands

`fedos_desktop_application_shell.ts` — 11 new methods:
`devicesList()`, `deviceDetail(id)`, `deviceSyncStatus()`,
`deviceSyncStart()`, `deviceSyncStop()`, `deviceSyncNow()`,
`syncSchedulesList()`, `syncTransfersList()`, `syncConflictsList(includeResolved?)`,
`syncConflictDetail(id)`, `syncConflictAcknowledge(id, action)`. Each is a
thin delegation to `runtime.deviceSyncOperational()`, mapped onto the
Shell's EXISTING, unmodified `FedosDesktopShellOutcomeKind` union via
`mapDeviceSyncFacadeResult()` (facade `"disabled"` → Shell `"unsupported"`;
every other outcome name is shared verbatim) — no widening of the shared
Shell result vocabulary. No generic `execute-device-command`/`invoke-sync`/
`resolve-any-conflict` exists.

## Phase E — ViewModels

5 new files under `src/desktop/presentation/`:
`FedosDesktopDeviceInventoryViewModel` (list + selected detail),
`FedosDesktopDeviceSyncStatusViewModel` (aggregate status + start/stop/
triggerNow, each refreshing afterward, + last-tick outcome state),
`FedosDesktopSyncScheduleViewModel` (read-only list),
`FedosDesktopTransferSessionViewModel` (read-only list),
`FedosDesktopSyncConflictViewModel` (list + selected detail +
`acknowledge()`, refreshing the list afterward). All 5 registered on
`FedosDesktopConversationUiPresentationBoundary`, constructed over the SAME
Shell instance every other ViewModel already shares. Every fact/mutation
delegates to the Shell only.

## Phase F — Renderer

5 new files under `src/desktop/renderer/`:
`FedosDesktopDeviceListRenderer`, `FedosDesktopDeviceSyncStatusRenderer`,
`FedosDesktopSyncScheduleRenderer`, `FedosDesktopTransferSessionRenderer`,
`FedosDesktopSyncConflictRenderer` — each composes the shared
`fedosRenderModel()`/`fedosRenderList()` helpers
(`fedos_desktop_render_model.ts`, unmodified) exactly like every existing
content renderer. All 5 registered on `FedosDesktopRenderer`. No renderer
imports the Shell, Runtime, or a Device Registry/Scheduler/Persistence
class (Phase K guard test 1/2).

## Phase G — Operational semantics

Honest state distinctions preserved end to end:

- Device: `trusted`/`revoked`/`unavailable`/`pending` reported verbatim
  from `FedosDeviceBindingV1.trustState` — never hidden or relabeled.
- Scheduler: `enabled` (facade-level — `false` when never configured) vs.
  `running`/`tickInFlight` (live Scheduler state) are separate fields.
- Transfer/Relay: `relayAccepted` and `deviceImported` are two
  INDEPENDENT booleans on `FedosDeviceSyncTransferSessionView`, sourced
  from two separate Observation states (`"relay-accepted"` vs.
  `"imported"`) — never merged into one "synced" flag (verified directly,
  test 12/13 in the facade suite: accepted-but-not-imported and
  imported-after-accepted are both independently observable).
- A tick's own per-target outcome (`FedosDeviceSyncTickEntry.outcome`) is
  never reported as `"delivered"` unless the (optional, caller-supplied)
  `attemptFn` itself returned it — with no `attemptFn` configured, every
  attempt fails closed (verified: facade test 29, "no false synced label").
- Conflict `operatorRequired` is derived directly from
  `decision === "require-operator"` — never invented independently of the
  real Conflict Authority's own classification.

## Phase H — Conflict actions

`FedosDeviceSyncOperationalFacade.acknowledgeConflict(id, action)` accepts
ONLY the 4 actions `FedosDeviceSyncConflictPersistence.resolve()` itself
already supports (`accept-identical`/`discard-invalid`/
`refresh-missing-dependency`/`acknowledge`) — validated against a closed
list before ever touching persistence; an unsupported action (e.g.
`"force-overwrite"`) is rejected `"invalid-input"` before any lookup runs.
An unresolved conflict remains visible (`listConflicts()`) until acted on;
resolving twice returns `"conflict"`, not a silent no-op.

## Phase I — Restart and lifecycle

Verified directly (facade test 19, restart preserves conflict/status):
Schedule/Conflict persistence durability across a fresh
`startFedosDesktopRuntime()` instance over the SAME log file paths;
revoked/trusted Device state likewise durable via the existing Device
Registry log. `stop()` now waits for an in-flight tick (facade test 8) —
verified with a real, artificially-blocked `attemptFn` and an explicit
assertion that `stop()` has NOT resolved while the tick is still pending.
No automatic scheduler restart is claimed or implemented — a fresh Runtime
instance requires its own explicit `startSync()` call, exactly like every
other optional capability in this file (`archiveEnabled`,
`privateTransportEnabled`).

## Phase J — Real acceptance tests

4 new test files, real `startFedosDesktopRuntime()`/`FedosDesktopApplicationShell`/
`FedosDesktopConversationUiPresentationBoundary`/`FedosDesktopRenderer`
instances throughout, no mocking of any layer this Arc itself owns:

- `test/secure_runtime_alpha_3801_3880_device_sync_operational_facade.test.ts` (23 tests)
- `test/secure_runtime_alpha_3801_3880_desktop_shell_device_sync_commands.test.ts` (7 tests)
- `test/secure_runtime_alpha_3801_3880_presentation_and_renderer.test.ts` (7 tests)
- `test/secure_runtime_alpha_3801_3880_security_boundary_guards.test.ts` (13 tests)

50 new tests total, covering (numbering follows this Arc's own Phase J
scenario list): disabled/gated states (1–2), start/stop/trigger through
Shell and ViewModel (3–7), trusted/revoked Device listing (8–10),
pending/completed schedule visibility (10–11), Relay-accepted-vs-imported
independence (12–13), transient/permanent failure outcomes (14–15),
unresolved/operator-required conflict visibility and safe acknowledge
(16–18), restart preservation (19), source/target Device distinction and
wrong-account isolation (20–21), independent Runtime isolation (22),
before-start/after-stop denial (23–24), malformed command rejection (25),
JSON-safety/no-raw-Error/no-raw-secret (26–28), no false "synced" label
(29), existing Conversation UI unaffected (30).

## Phase K — Security and structural guards

Verified via source-inspection tests
(`secure_runtime_alpha_3801_3880_security_boundary_guards.test.ts`):
Shell accesses Device Sync only through `deviceSyncOperational()`;
presentation imports only the Shell; renderer imports only its own
ViewModel/render-model helpers; no persistence class import in
presentation/renderer; no crypto/`Persistence` import in any Renderer; the
facade itself imports no crypto authority and constructs no
`MasterSeedAuthority`; the facade contains zero `throw` statements (every
failure mode is a closed result); no raw secret/signature/package field
name anywhere in the facade's safe view shapes; no new npm dependency (2
production dependencies, unchanged); no Electron/React/Vue/Svelte/Tauri
reference in any of this Arc's own new files; `src/desktop/fedos_sender_key`
untouched; `p2p/`/`.tmp_gen/` absent and untouched;
`src/conversation`/`src/search` show zero git changes from this Arc.

## Baseline / final comparison

- Desktop lineage alone, fresh worktree, before merge: **194 failed test
  files / 786 passed (980 total)**, **247 failed tests / 12568 passed
  (12815 total)**.
- Device Sync lineage alone (`C:\wt\device-sync-scheduler`), independently
  re-checked: **189 failed test files / 763 passed (952 total)**, **233
  failed tests / 12369 passed (12602 total)**.
- After merge + this Arc's full implementation, `npm test`: **199 failed
  test files / 797 passed (996 total)**, **~255–257 failed tests / ~12849
  passed (~13104 total)**.

Failure RATE is consistent across all three (≈19.8–20.0%), and grep-
confirmed zero mentions of any `secure_runtime_alpha_3801_3880` test file
anywhere in the failed-test output — every failure remaining is one of
this session's own two independently-reconfirmed, pre-existing
environmental causes (a `?raw`-import artifact in fresh linked worktrees;
a missing compiled WASM `pkg/` artifact), never a regression traceable to
this Arc's own new or modified files. `npm run typecheck`: clean except
one PRE-EXISTING error (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`),
confirmed present on `arc/device-sync-scheduler` alone before this Arc
touched anything.

## Completion declaration

**Complete.** Real Device Sync operational status and controls flow
through Runtime → Shell → ViewModels → Renderer, while preserving: trust
(Device trust/revocation state reported verbatim), lifecycle (fail-closed
before start / after stop, two-layer defense), restart recovery (durable
Schedule/Conflict/Registry state), conflict visibility (unresolved and
operator-required conflicts remain visible until acted on), secret
isolation (zero raw secret/signature/package/Error exposure, verified by
source inspection and JSON round-trip), and the Relay-accepted-versus-
Device-imported distinction (two independent booleans, never merged).

No Device Registry/Trust/Transfer/Relay Sync/Scheduler/Conflict Resolver
was redesigned; no second Device Runtime or scheduler was created; no
Sync Journal or Conflict persistence was duplicated; no secret of any
kind is exposed; no cloud sync, push notification, OS service, Electron,
or UI framework was added; no dependency was added; Sender-Key/Archive/
Search source is untouched; `p2p/`/`.tmp_gen/` untouched.

**Recommended next Arc**: Desktop Device Management and Sync Operations UI
Renderer Arc.
