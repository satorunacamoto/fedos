# Secure Runtime Alpha 3801–3880 — Phase A: Source and Ownership Reconciliation

Device Sync Operational Status and Desktop Shell Integration Arc. Written
BEFORE any production edit in this worktree, per this Arc's own Phase A
instruction. Covers all 20 required points.

## 1. Desktop Runtime ownership graph

`src/desktop/runtime/fedos_desktop_runtime.ts` (`startFedosDesktopRuntime()` /
`FedosRunningDesktopRuntime`) owns exactly one instance each of:
`FedosBoardRuntime`, `FedosConversationRuntime`, `FedosPrivateTransport`
(optional), `FedosConversationArchiveRuntime` (optional),
`FedosDesktopConversationContentAccessor` (always), and — after this Arc's own
merge (§19) — `FedosDeviceTrustRuntime` (optional, `config.deviceTrustEnabled`).
Every accessor follows the identical two-state fail-closed contract: throws
`"not enabled"` if the owning config flag was never set, throws
`"inaccessible after stop"` once `stop()` ran. No accessor returns a second,
divergent instance across calls while running.

## 2. Device Runtime ownership graph

Two INDEPENDENT, NON-OVERLAPPING facades exist over Device Binding data today:

- **`FedosDeviceTrustRuntime`** (`src/desktop/runtime/fedos_device_trust_runtime.ts`,
  Alpha 2921–3000) — ALREADY wired into `FedosRunningDesktopRuntime.deviceTrust()`.
  Owns `PersistedFedosDeviceTrustAuthority` (over an injected
  `FedosDeviceRegistryPersistence`) plus the OLD `FedosSyncState` Journal
  (`src/sync/fedos_sync_state.ts`, Alpha 2421–2500, unmodified). Registration
  here always resolves through `UnavailableFedosDeviceRegistrationAuthority`
  by default (or a caller-supplied `FedosDeviceRegistrationAuthority`) — no
  real cryptographic account-to-device verification wired at the Desktop
  Runtime layer by default.
- **`FedosDeviceSyncRuntime`** (`src/device/runtime/fedos_device_sync_runtime.ts`,
  Alpha 3321–3400) — NOT wired into `FedosRunningDesktopRuntime` anywhere.
  Wraps `FedosDeviceBindingBoundary` (`createFedosDeviceBindingBoundary()`),
  which uses the REAL, signature-verified registration path from Alpha
  3161–3240 (`FedosDeviceBindingRegistrationAuthority`,
  `AlreadyVerifiedFedosDeviceRegistrationAuthority`). Also owns Sync Session
  prepare/validate (`src/device/sync_session/`).

**Both read/write the SAME underlying `FedosDeviceRegistryPersistence` type**
(different instances if both were constructed independently), but are
otherwise two parallel, non-communicating facades over Device registration.
This Arc does not merge them (that would be a redesign) and does not wire
`FedosDeviceSyncRuntime` into the Desktop Runtime (that would create a SECOND
Device Runtime alongside the already-wired `FedosDeviceTrustRuntime` —
an Absolute Prohibition). **Decision (see §20): this Arc's operational facade
extends `FedosDeviceTrustRuntime`'s own already-wired graph only.**
`FedosDeviceSyncRuntime` remains an inert, valid, unwired alternative — an
existing fact, not something this Arc changes.

## 3. Device Sync Scheduler ownership

`FedosDeviceSyncScheduler` (`src/device/sync_scheduler/fedos_device_sync_scheduler.ts`,
Alpha 3721–3800) owns: schedule state (injected
`FedosDeviceSyncSchedulePersistence`), single-flight tick guard, interval
timer (default disabled, `startSync()`/`stopSync()`/`tickSync()`/
`triggerSyncNow()`), target planning, retry policy. It explicitly does NOT
own Device trust truth (reads `FedosDeviceRegistryPersistence`, injected,
read-only), Sync Journal truth (reads `FedosSyncState`, injected, read-only —
**the SAME type `FedosDeviceTrustRuntime` already holds internally**), or
Relay identity (delegates to an injected `FedosDeviceSyncAttemptFn`
boundary — the Scheduler never imports Relay Sync directly). Not
constructed anywhere in the Desktop Runtime today.

## 4. Relay Sync ownership

`FedosDeviceRelaySyncOutboundCoordinator` / `...InboundHandler`
(`src/device/relay_sync/`, Alpha 3641–3720) own per-Relay publish/receive,
Outbox/Inbound-dedup persistence, and Observation recording
(`FedosDeviceRelaySyncObservationRepository` — a durable, append-only fact
log distinguishing `"relay-accepted"` from `"received"`/`"imported"`, never
collapsing the two). Constructing a REAL, network-attached instance requires
a `FedosNostrSigningAuthority` for the local Device, a
`FedosDeviceSyncPackageEncryptionAuthority` (its own `FedosMasterSeedAuthority`
sourcing), a `FedosDeviceRelaySyncPublisher`, and a completed
`FedosDeviceTransferCoordinator` session — none of which the Desktop Runtime
assembles for Devices today (only for Conversations, via
`conversationProductionCrypto`). Not constructed anywhere in the Desktop
Runtime today. This Arc does not construct this graph either (§20).

## 5. Sync Journal ownership

`FedosSyncState` (`src/sync/fedos_sync_state.ts`, Alpha 2421–2500) is the one
Journal/Cursor/Queue implementation in this codebase — unmodified,
UNDUPLICATED by this Arc. `FedosDeviceTrustRuntime` already holds one
instance (constructed inline inside `startFedosDesktopRuntime()`, keyed by
`localAccountRef`). `FedosDeviceSyncScheduler` and
`FedosDeviceSyncImportCoordinator` both accept a `FedosSyncState` instance by
injection — this Arc reuses `FedosDeviceTrustRuntime`'s own instance for
both, never constructs a second one.

## 6. Conflict Query ownership

`FedosDeviceSyncConflictPersistence` (durable, `observe()`/`resolve()`/`get()`/
`listUnresolved()`/`listAll()`, "snapshot per write, last-write-wins by
conflictId") is populated exclusively by `FedosDeviceSyncImportCoordinator`
(Alpha 3721–3800), which classifies every `FedosSyncState.applyPendingChanges()`
result through `fedos_device_sync_conflict.ts` +
`planFedosDeviceSyncResolution()` and durably records anything not a clean
apply/skip. Not constructed anywhere in the Desktop Runtime today.

## 7. Current Runtime accessors

`boardRuntime()`, `conversationRuntime()`, `privateTransport()`,
`conversationArchiveRuntime()`, `conversationContentAccessor()`,
`conversationProductionCryptoCapability()`, and (after this Arc's own merge)
`deviceTrust()`. No `deviceSync()`/`deviceSyncScheduler()`/
`deviceSyncOperational()`-shaped accessor exists yet — this Arc's own gap to
close (Phase B/C).

## 8. Current Shell `deviceStatus()` implementation

`src/desktop/shell/fedos_desktop_application_shell.ts:324` —
`deviceStatus()` ALWAYS returns `fedosDesktopShellOk({state: "unavailable",
reason: DEVICE_SYNC_UNAVAILABLE_REASON})` while running (`"unavailable"`
Shell-outcome, not error, while stopped). `DEVICE_SYNC_UNAVAILABLE_REASON`
(line 112) hard-codes: *"src/sync/* (Device Sync Foundation) is not wired
into any running Desktop Runtime on this base ... see Alpha 2841-2920
execution spec Phase A/A7"*. **Reproduced** (§18): the existing 20-test
`test/secure_runtime_alpha_2841_2920_desktop_application_shell.test.ts` suite
passes 20/20 confirming this exact behavior, run in this worktree before any
merge/edit.

## 9. Current Device-related ViewModels

`FedosDesktopRuntimeStatusViewModel`
(`src/desktop/presentation/fedos_desktop_runtime_status_view_model.ts`)
exposes `deviceStatus: FedosDeviceStatusView | null` re-read from
`shell.deviceStatus()` on every `refresh()` — always `null` while stopped,
always `{state: "unavailable", reason}` while running, per §8. No dedicated
Device Inventory / Device Detail / Sync Status / Sync Schedule / Transfer
Session / Conflict List / Conflict Detail ViewModel exists yet.

## 10. Current Renderer support

`FedosDesktopStatusRenderer` (`src/desktop/renderer/fedos_desktop_status_renderer.ts`)
renders `{runtimeStatus, deviceStatus}` — the ONLY Device-related render
surface today, and it only ever has one `deviceStatus` shape to show
(`"unavailable"`) on this base. No Device list/detail, Sync schedule,
Transfer session, or Conflict renderer exists yet.

## 11. Exact lifecycle states

Device Binding (`FedosDeviceTrustState`): `"pending" | "trusted" | "revoked" |
"unavailable"` — `"revoked"` terminal, `isFedosDeviceTrustTransitionAllowed()`
enforced. Desktop Runtime: `stopped` boolean flag; every accessor fails
closed after `stop()`.

## 12. Exact scheduler states

`FedosDeviceSyncSchedulerStatus`: `running`, `tickInFlight`, `scheduleCount`,
`pendingCount`, `inProgressCount`, `completedCount`, `failedCount`,
`operatorRequiredCount` — always readable, even while stopped (read-only
query, never gated). Per-schedule state
(`FedosDeviceSyncScheduleV1.state`): `"pending" | "in-progress" | "completed" |
"failed" | "operator-required"` (from `fedos_device_sync_schedule.ts`).

## 13. Exact transfer states

`FedosDeviceTransferState`: `"invited" | "challenged" | "approved" |
"package-sent" | "verified" | "completed" | "aborted" | "failed"` — closed
transition table, `"completed"`/`"aborted"`/`"failed"` terminal
(`src/device/transfer/fedos_device_transfer_session.ts`).

## 14. Exact conflict states

`FedosDeviceSyncConflictKind` (11 values, `fedos_device_sync_conflict.ts`):
`"none" | "identical-duplicate" | "missing-dependency" |
"immutable-record-conflict" | "cursor-divergence" | "invalid-transition" |
"revoked-device-contribution" | "unknown-record-type" | "stale-projection" |
"safe-concurrent-append" | "operator-decision-required"`.
`FedosDeviceSyncResolutionDecision` (7 values): `"apply" | "skip-identical" |
"defer-missing-dependency" | "reject-invalid" | "record-conflict" |
"require-operator" | "retry-after-refresh"`. Persisted resolution actions
(`FedosDeviceSyncConflictResolutionAction`, 4 values): `"accept-identical" |
"discard-invalid" | "refresh-missing-dependency" | "acknowledge"`.
Relay/import observation states (9 values,
`FedosDeviceRelaySyncObservationState`): `"queued" | "publishing" |
"relay-accepted" | "relay-rejected" | "relay-failed" | "received" |
"imported" | "denied" | "expired"` — `"relay-accepted"` and `"imported"` are
NEVER collapsed (Phase L of Alpha 3641–3720, unmodified).

## 15. Existing read-only query APIs

`FedosDeviceTrustRuntime`: `listDevices()`, `listTrustedDevices()`,
`getDevice(id)`, `isDeviceTrusted(id)`, `syncReadiness(id)`,
`listPendingChanges(deviceRef)`, `journalEntries()`. `FedosDeviceSyncScheduler`:
`syncStatus()` (always available). `FedosDeviceSyncConflictPersistence`:
`get()`, `listUnresolved()`, `listAll()`. `FedosDeviceTransferSessionPersistence`:
`getSession()`, `listSessionsForAccount()`. `FedosDeviceRelaySyncObservationRepository`
+ `queryFedosDeviceRelaySyncStatusForSession()`: per-transfer-session,
per-Relay observation history, oldest first.

## 16. Currently missing boundaries

No accessor on `FedosRunningDesktopRuntime` for Scheduler/Conflict/Transfer/
Relay-Sync-observation state. No Shell commands beyond `deviceStatus()`
(always `"unavailable"`). No ViewModels or Renderers beyond §9/§10. No
config fields threading Schedule/Conflict/Transfer/Relay-Sync-observation
persistence paths, an `attemptFn`, an abandonment policy, or resource limits
through `FedosDesktopRuntimeConfig`. A real, network-attached Relay Sync
Outbound/Inbound graph is NOT assembled anywhere in the Desktop Runtime
(§4) — out of this Arc's scope to assemble (§20).

## 17. Expected production files (this Arc's own additions)

- `src/desktop/runtime/fedos_device_sync_operational_facade.ts` (Phase B) —
  new, narrow facade wrapping the already-wired `FedosDeviceTrustRuntime`
  plus a Scheduler/Conflict/Transfer/Relay-observation view, all injected.
- Edits to `fedos_desktop_runtime.ts` / `fedos_desktop_runtime_config.ts`
  (Phase C) — additive fields/accessor only, mirroring `deviceTrustEnabled`'s
  own pattern exactly.
- Edits to `fedos_desktop_application_shell.ts` (Phase D) — new commands.
- New ViewModel file(s) under `src/desktop/presentation/` (Phase E).
- New Renderer file(s) under `src/desktop/renderer/` (Phase F).
- New test file(s) under `test/` (Phase J).
- `docs/secure_runtime_alpha_3801_3880_execution_spec.md` +
  `..._completion_declaration.md` (this doc is the Phase A component).

## 18. Baseline failures in this worktree

Captured in a fresh worktree BEFORE the merge (§19), on the Desktop lineage
alone (`arc/desktop-electron-host-boundary` @ `7b72a3e`, after `npm install`):
`npm test` → **194 failed test files / 786 passed (980 total)**, **247 failed
tests / 12568 passed (12815 total)** — matching this session's own
established, independently-reconfirmed pattern of ~194-200 failing files from
exactly two pre-existing environmental causes (a `?raw`-import artifact in
fresh linked worktrees, and a missing compiled WASM `pkg/` artifact), never a
regression traceable to any Arc's own new files. `deviceStatus()` reproduced
directly: `test/secure_runtime_alpha_2841_2920_desktop_application_shell.test.ts`
— 20/20 pass, confirming the exact `"unavailable"` behavior in §8 before any
change. `npm run typecheck` on this base: clean (no errors).

## 19. Branch merges/conflicts

`arc/desktop-electron-host-boundary` (`7b72a3e`) and
`arc/device-sync-scheduler` (`24ca375`) share merge-base `3eb9ead`; neither is
an ancestor of the other (genuinely diverged). Unique commit ranges are
disjoint Alpha numbers on each side (no double-implementation risk). Full
`--name-only` diff comparison against the merge-base found overlap in
EXACTLY 3 files: `README.md` (expected — status-blurb stacking, see
[[project-secure-runtime-arc-conventions]]), `src/desktop/runtime/fedos_desktop_runtime.ts`,
`src/desktop/runtime/fedos_desktop_runtime_config.ts`. A `git merge-tree`
dry run (no working-tree/index mutation) confirmed all 3 as real but
PURELY MECHANICAL conflicts: both lineages append distinct, non-overlapping
optional capabilities at the SAME textual anchor points (end of the import
block, end of the interface, end of the config object, end of the
accessor-construction region) — the Desktop lineage added
`conversationArchiveRuntime()`/`conversationContentAccessor()`/
`conversationProductionCryptoCapability()`, the Device Sync lineage added
`deviceTrust()`; neither touches a line the other side also touches. Created
`arc/device-sync-desktop-status` (this Arc's own dedicated worktree branch)
from `arc/desktop-electron-host-boundary`, then `git merge --no-ff
arc/device-sync-scheduler`. Resolved all 3 conflicts as a literal UNION of
both sides (no line dropped from either lineage), plus one accompanying
README reconciliation (Device Sync's own newest blurb, Alpha 3721–3800,
placed above the Desktop lineage's own newest blurb, Alpha 3561–3640 — no
true cross-lineage landing order exists between two diverged branches, so
the numerically newer blurb was placed on top, consistent with
[[project-secure-runtime-arc-conventions]]'s "newest always pushed to top"
rule applied to the one point of ambiguity a genuine two-lineage merge
introduces). Verified post-merge: `npm run typecheck` — one PRE-EXISTING
error (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`,
confirmed present on `arc/device-sync-scheduler` alone, unrelated to this
merge); all 3 Desktop-lineage test files (Shell/Presentation/Renderer, 44
tests) and all 13 Device-Sync-lineage test files (249 tests) pass 100%
against the merged tree. Merge commit: `7014298`. No conflict required
choosing one accepted architecture over another (§6 of this Arc's own
instructions does not trigger) — this is a pure integration base, not an
architecture decision.

## 20. Exact no-new-authority plan

This Arc constructs **zero** new cryptographic authorities, zero new Relay
connections, and zero new Device Runtimes:

- Device trust/registration/revocation truth: delegated ENTIRELY to the
  already-wired `FedosDeviceTrustRuntime` (§2) — no second Device Runtime.
- Scheduler: exactly ONE `FedosDeviceSyncScheduler` constructed inside
  `startFedosDesktopRuntime()`, reusing the SAME `FedosDeviceRegistryPersistence`
  and `FedosSyncState` instances already constructed for
  `FedosDeviceTrustRuntime` in the SAME `if (config.deviceTrustEnabled)`
  branch (hoisted into local variables so both consumers share them) — no
  second Journal, no second Registry.
- Relay Sync / real network attempts: this Arc does **not** assemble a real,
  network-attached `FedosDeviceRelaySyncOutboundCoordinator` graph (§4/§16) —
  that requires a Device-scoped signing authority and Sync Package
  encryption authority this Desktop Runtime does not source today, and
  assembling one would be new production-crypto integration surface beyond
  "expose and map already-real state" (this Arc's own explicit Objective),
  arguably approaching a redesign of Relay Sync's own integration boundary.
  Instead, mirroring `conversationTransportPublisher`'s and
  `conversationTransportSigningAuthority`'s own established "this runtime
  constructs no X of its own" discipline: the Scheduler's `attemptFn` is an
  OPTIONAL, entirely caller-supplied `FedosDeviceSyncAttemptFn`. Omitted, the
  Scheduler still starts/stops/reports honest status
  (`scheduleCount`/`pendingCount`/etc. reflect whatever the durable Schedule
  persistence already contains — genuinely `0` until a caller external to
  this Arc's own scope ever calls `triggerSyncNow()` against real targets),
  but every tick's own attempt naturally fails closed to `"failed"` outcomes
  if no real attemptFn is supplied and none is required for this Arc's own
  target capabilities (schedule/status/conflict/transfer visibility, not
  Relay wiring). This is declared as an honest, precise boundary, not a
  silent gap.
- Conflict/Transfer/Relay-observation persistence: constructed via the
  EXISTING `AppendOnly*`/`InMemory*` port pairs already in `src/device/*`,
  following the identical "log path supplied → durable, else in-memory"
  discipline every other backend in `fedos_desktop_runtime.ts` already uses
  — no new persistence shape invented.
