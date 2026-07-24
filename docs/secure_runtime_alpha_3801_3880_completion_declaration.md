# Secure Runtime Alpha 3801–3880: Device Sync Operational Status and Desktop Shell Integration — Completion Declaration

## What this Arc proves

- Two previously-diverged lineages (Desktop UI stack, `arc/desktop-electron-host-boundary`; Device Sync stack, `arc/device-sync-scheduler`) are reconciled into one dedicated integration branch (`arc/device-sync-desktop-status`, merge commit `7014298`) with zero content lost from either side — proven directly via `git merge-tree` dry-run inspection before the real merge, and via the full pre-existing test suites of BOTH lineages passing unchanged against the merged tree (44 Desktop-lineage tests + 249 Device-Sync-lineage tests, all green).
- Real Device Sync operational state — Device inventory/trust, Scheduler status/control, Schedules, Transfer sessions, Conflicts — is now reachable from the Desktop Shell/ViewModel/Renderer stack through exactly one new, narrow `FedosDeviceSyncOperationalFacade`, proven by 50 new tests driving a REAL `startFedosDesktopRuntime()`/`FedosDesktopApplicationShell`/`FedosDesktopConversationUiPresentationBoundary`/`FedosDesktopRenderer` stack throughout — no mock of any layer this Arc itself owns.
- The Scheduler this Arc wires reuses the EXACT SAME `FedosDeviceRegistryPersistence`/`FedosSyncState` instances `FedosDeviceTrustRuntime` (Alpha 2921–3000, already wired, unmodified) already constructs — proven directly: registering/trusting/revoking a Device through `runtime.deviceTrust()` is immediately visible through `runtime.deviceSyncOperational()`, and vice versa, with no second Registry or Journal anywhere.
- `stop()` now genuinely waits for an in-flight Scheduler tick before the Host itself stops — proven with a real, artificially-blocked `attemptFn` and an explicit assertion that `runtime.stop()` has NOT resolved while the tick Promise is still pending, only resolving once the attempt itself completes.
- Relay-accepted and Device-imported are proven as two independently-observable facts on a Transfer Session view, never collapsed: a session with only a `"relay-accepted"` Observation reports `relayAccepted: true, deviceImported: false`; the SAME session after a separate `"imported"` Observation reports both `true` — proven directly against the real, durable `FedosDeviceRelaySyncObservationRepository`.
- A Scheduler tick with no `attemptFn` configured (this Arc's own honest default — no real Relay Sync graph is assembled, Phase A §20) never reports a `"delivered"` outcome for any schedule and never increments `completedCount` — proven directly.
- Conflict visibility and safe acknowledgment are proven end to end: a durably-observed `"require-operator"` conflict is visible through `listConflicts()`/Shell/ViewModel/Renderer with `operatorRequired: true`, resolved once via `acknowledgeConflict(id, "acknowledge")`, and a second acknowledgment attempt is rejected `"conflict"` (already resolved) rather than silently succeeding again. An unsupported action name (e.g. `"force-overwrite"`) is rejected `"invalid-input"` before any persistence lookup — there is no generic "resolve-any-conflict" anywhere in this Arc's own code.
- Restart durability is proven directly: Schedule count and Device trust state survive a fresh `startFedosDesktopRuntime()` instance constructed over the SAME durable log file paths as a prior, now-stopped instance.
- Fail-closed lifecycle is proven with a genuine two-layer defense: `runtime.deviceSyncOperational()` throws `"inaccessible after stop"` for a NEW caller after `stop()`, AND every method on a facade reference grabbed BEFORE `stop()` independently reports `"unavailable"` afterward — neither path returns stale data.
- Every facade/Shell result is proven JSON/structured-clone-safe and free of raw `Error` objects, raw signatures, or secret-bearing field names, via direct `JSON.stringify`/`JSON.parse` round-trips and case-insensitive keyword scanning across every new result shape.
- Source-inspection tests prove the layering guarantees directly against real, checked-out source: the Shell reaches Device Sync only through `deviceSyncOperational()`; no new Renderer imports the Shell, the Runtime, or a Device Registry/Scheduler/Persistence class; no Renderer calls a ViewModel's own mutating method; the facade itself imports no crypto authority and contains zero `throw` statements.

## What this Arc explicitly does NOT claim

- **No real, network-attached Relay Sync graph is assembled.** Constructing one requires a Device-scoped `FedosNostrSigningAuthority` and a `FedosDeviceSyncPackageEncryptionAuthority` (its own Master Seed sourcing) this Desktop Runtime does not assemble for Devices today — doing so here would be new production-crypto integration surface beyond this Arc's own "expose and map already-real state" objective, and arguably approaches redesigning Relay Sync's own integration boundary (an Absolute Prohibition). The Scheduler's `attemptFn` remains an explicit, caller-supplied injection point, exactly like `conversationTransportPublisher`/`conversationTransportSigningAuthority` already are for Conversations.
- **No Device Sync Runtime redesign, no second Device Runtime, no second Scheduler, no duplicate Sync Journal or Conflict persistence.** `FedosDeviceSyncRuntime` (Alpha 3321–3400, a separate, real, signature-verified registration facade) remains unwired — this Arc extends ONLY the already-wired `FedosDeviceTrustRuntime` graph, per Phase A §2/§20's own explicit decision.
- **No claim that a remote Device is online, that sync "completed" from a Relay accept alone, or that remote deletion/distributed consensus occurred.** Every status field this Arc surfaces is backed by a real, locally-observed fact (a Registry binding, a Schedule state, an Observation record) — never inferred remote state.
- **No cloud sync, push notification, OS service, Electron, or UI framework was added.** No new npm/Cargo dependency (2 production dependencies, unchanged). Sender-Key/Archive/Search source is untouched. `p2p/`/`.tmp_gen/` untouched.
- **Transfer protocol initiation (invite/challenge/approve/package) is not driven by this Arc.** Only READ access to whatever Transfer Session state already durably exists is exposed — this Arc's own stated target capability is "transfer session status," not transfer initiation.

## Baseline vs. final

| | Before this Arc | After this Arc |
| --- | --- | --- |
| `Shell.deviceStatus()` | always `{state:"unavailable"}` (`src/sync/*` wired into nothing) | unchanged — still honestly `"unavailable"` (a SEPARATE, pre-existing gap this Arc does not touch); 11 NEW commands added alongside it |
| Device inventory/trust from Desktop stack | none | `devicesList()`/`deviceDetail()` — real, durable, restart-safe |
| Scheduler control from Desktop stack | none | `deviceSyncStart()`/`Stop()`/`Now()`/`Status()` — real Scheduler, optional caller-supplied `attemptFn` |
| Conflict visibility/action from Desktop stack | none | `syncConflictsList()`/`Detail()`/`Acknowledge()` — 4 safe actions only |
| Transfer session status from Desktop stack | none | `syncTransfersList()` — read-only, Relay-accepted vs. imported distinguished |
| Desktop/Device Sync lineages | unmerged, diverged since `3eb9ead` | merged into one dedicated branch, `7014298`, zero content lost |
| `npm run typecheck` | clean (Desktop-alone) / 1 pre-existing failure (Device-Sync-alone) | unchanged — same 1 pre-existing failure, nothing new |
| New test files | — | 4 files, 50 tests, real Runtime/Shell/ViewModel/Renderer throughout |

## Verification run (this worktree, `C:\wt\device-sync-desktop-status`)

- `npm run typecheck` — clean except the one pre-existing failure named above.
- Targeted suites (Desktop Runtime/Shell/Presentation/Renderer, Device Trust/Registry, Device Sync Foundation, Local Transfer, Relay Sync, Scheduler/Conflict, this Arc's own 4 new files): **20 files, 343 tests, all passing.**
- Full `npm test`: **199 failed / 797 passed (996 total) files, ~255–257 failed / ~12849 passed (~13104 total) tests.** Failure RATE (≈20.0%) matches both source lineages' own independently-confirmed baselines (Desktop-alone ≈19.8%, Device-Sync-alone ≈19.9%) — grep-confirmed zero mentions of any `secure_runtime_alpha_3801_3880` file anywhere in the failure output. Every remaining failure is one of this session's own two independently-reconfirmed pre-existing environmental causes (fresh-worktree `?raw`-import artifact; missing compiled WASM `pkg/` artifact) — zero regression traceable to this Arc.

## Declaration

**Complete.** Real Device Sync operational status and controls flow through Runtime → Shell → ViewModels → Renderer while preserving trust, lifecycle, restart recovery, conflict visibility, secret isolation, and the Relay-accepted-versus-imported distinction, per this Arc's own stated completion bar.

**Recommended next Arc**: Desktop Device Management and Sync Operations UI Renderer Arc.
