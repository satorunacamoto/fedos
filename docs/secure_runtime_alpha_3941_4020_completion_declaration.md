# Secure Runtime Alpha 3941–4020: Desktop Device Management and Sync Operations UI Renderer Arc (honest partial — Device registration/revocation commands unavailable) — Completion Declaration

## What this Arc proves

- A complete, closed, framework-neutral Device Management screen/navigation
  layer sits ONE level above the existing 6 Device Sync ViewModels
  (Alpha 3801-3880, unmodified): 14 named screens, fail-closed navigation
  (`goto()`/`requestConfirmation()` reject any unrecognized id with no
  state change), a single ONE-class controller composing everything —
  proven directly by 23 real acceptance tests driving a real Runtime/
  Shell/Boundary/Renderer stack.
- The Overview screen composes 4 separate ViewModels' own current state
  into one honest fact set — proven with zero Devices, one local Device,
  three trusted Devices, and one revoked Device, each producing the
  correctly-counted real result.
- Relay-accepted and Device-imported remain two independently-observable
  facts all the way to the rendered Transfer Detail screen, and the
  Overview's own `allKnownTransfersImported`/`syncSummaryLabel` never
  claims "everything synced" for a partial import OR for an empty
  transfer set — proven directly against real, durable Relay Sync
  Observation facts (relay-accepted-only, then also imported).
- Sync Operations state (`disabled`/`unavailable`/`stopped`/`starting`/
  `running`/`tick-in-flight`/`stopping`/`failed`) is derived purely from
  real Scheduler facts plus two local, non-persisted in-flight flags —
  proven end to end: stopped → start → running → confirm-trigger →
  in-flight (with a real, artificially-blocked `attemptFn`) → stop, all
  through the controller/renderer, never a raw Shell call bypassing this
  layer.
- Duplicate submission is proven prevented: two concurrent `startSync()`
  calls through the controller result in exactly one real Scheduler
  start, never two.
- The Conflict Inbox is proven fully real end to end: an
  operator-required conflict is visible via the `"operator-required"`
  filter, its detail exposes exactly the 4 real safe actions the
  underlying Conflict Authority itself supports, navigating away and back
  never resolves it, acknowledging it does, and the resolved fact SURVIVES
  a full Runtime/Boundary restart over the same durable Conflict log — all
  proven directly, not asserted.
- A stale selected id (a Device detail selected, then the navigation's own
  `selectedDeviceId` changed out from under the loaded ViewModel state) is
  proven to render `"invalid-input"`, never the wrong Device's data.
- Every rendered screen is proven JSON/structured-clone-safe (a real
  `JSON.stringify`/`JSON.parse` round-trip on 6 different screen renders),
  free of any function-typed field, free of `Error` instances, and free of
  secret/signature/package-shaped field names by case-insensitive keyword
  scan.
- Independent Runtime isolation is proven directly: two Boundaries over
  two separate accounts/log directories never share Device Management
  state.
- Source-inspection tests prove the layering guarantees directly against
  real, checked-out source: the controller imports the Shell/Runtime
  nowhere; no presentation-layer file imports a Device Registry/
  Scheduler/Sync Journal/Relay/persistence/crypto class; the renderer
  calls no mutating ViewModel/controller method; the action descriptor
  type carries no function field; zero `throw new Error(...)` exists
  anywhere in this Arc's own new files.

## What this Arc explicitly does NOT claim (the one honest partial boundary)

- **Device Registration and Device Revocation confirmation are NOT real
  actions on this base.** `FedosDesktopApplicationShell` and
  `FedosDeviceSyncOperationalFacade` (Alpha 3801-3880) expose NO
  `registerDevice`/`confirmTrust`/`revokeDevice`/`mintChallenge` command —
  only `runtime.deviceTrust()` supports those, and the Shell never calls
  it. This Arc's own scope ("UI Renderer Arc," not "Shell command Arc")
  explicitly instructs stopping at this exact boundary rather than adding
  a new Shell command itself. The Registration screen therefore always
  reports `available: false`; the Revocation Confirmation screen
  correctly identifies the Device and states the real terminality/
  non-erasure facts, but its own confirm action reports
  `confirmAvailable: false` — honestly, never a fabricated success.
  Phase M scenarios 11/12 (registration success/expired-replayed) are
  consequently not exercised — there is no real flow to exercise.
- **No polling of any kind exists.** Every state update in this Arc's own
  files happens only in direct response to an explicit refresh/action
  call — no `setInterval`/`setTimeout` appears anywhere in this Arc's own
  new source.
- **No second operational facade, Shell, Device Runtime, Scheduler, or
  Conflict Authority was created.** Every fact this Arc's own controller
  surfaces comes from the SAME 6 existing ViewModels every earlier Arc
  already built and tested — this file's own controller constructs
  nothing new beneath that layer.
- **No Electron, no React/Vue/Svelte/Tauri, no new dependency.**
  `package.json`/`package-lock.json`/`tsconfig.json`/`Cargo.toml` are
  untouched (verified by git status). Sender-Key/Archive/Search source is
  untouched. `p2p/`/`.tmp_gen/` untouched.

## Baseline vs. final

| | Before this Arc | After this Arc |
| --- | --- | --- |
| Device Overview screen | none | real, composed, honest "everything synced" gating |
| Device list/detail with filters | none | real, 6 filters, stale-id-safe |
| Device Registration screen | none | real screen model; confirm action honestly unavailable (no Shell command) |
| Device Revocation Confirmation screen | none | real screen model; confirm action honestly unavailable (no Shell command) |
| Sync Operations screen (start/stop/trigger with confirmation + duplicate-submit guard) | raw Shell/facade calls only, no screen/confirmation layer | real, full screen + confirmation flow |
| Pending Schedules / Transfer Sessions / Relay Delivery Status screens | raw ViewModel state only, no screen composition | real, truncated, honestly-limited screens |
| Conflict Inbox (list/detail/acknowledge, filtered) | raw ViewModel state only | real, filtered, full screen + restart-durable |
| Navigation/screen model | none anywhere in presentation | one closed, fail-closed `FedosDeviceManagementNavigationState` |
| `npm run typecheck` | clean except pre-existing `alpha_477` failure | unchanged — same one pre-existing failure, nothing new |
| New test files | — | 2 files, 37 tests, real Runtime/Shell/Boundary/Renderer throughout |

## Verification run (this worktree, `C:\wt\desktop-device-sync-ui`)

- `npm run typecheck` — clean except the one pre-existing failure named above.
- Targeted suites (Desktop Runtime/Shell/Presentation/Renderer, Device
  Trust/Registry, Device Sync, this Arc's own 2 new files): **13 files,
  227 tests, all passing.**
- Full `npm test` (run 3 times to characterize this environment's own
  documented run-to-run variance): total file count increases by exactly
  `+2` every run (this Arc's own 2 new files, 100% passing every run);
  grep-confirmed zero mentions of `secure_runtime_alpha_3941_4020`
  anywhere in any failure output across all 3 runs. The only
  "desktop"-named failures in the full suite are three arcs from far
  earlier in this codebase's own history (Alpha 178/203/400), confirmed
  outside this Arc's own touched-file set by the structural guard tests'
  own `git status --porcelain` checks — zero regression traceable to this
  Arc.

## Declaration

**Honest partial completion**, per this Arc's own explicit "use an honest
partial title if Device registration or conflict action commands remain
unavailable" instruction. Conflict actions ARE fully real; Device
registration and revocation confirmation ARE NOT — a real, documented,
pre-existing gap in the Shell/Facade layer this Arc's own scope does not
extend. Every other target screen and interaction is complete and real.

**Recommended next Arc**: Electron Main/Preload Adapter for
`FedosDesktopHostBridge` and Device Management Renderer Arc.
