# Secure Runtime Alpha 4981-5060 — Desktop Settings Runtime Application and Safe Reconfiguration — Completion Declaration

**FULL completion.** Persisted Settings now visibly affect REAL live
application behavior through accepted boundaries — theme and window layout
mutate a live presentation sink, `notificationsEnabled` gates real notification
presentation, and `backgroundSyncEnabled` starts/stops a REAL device-sync
scheduler — while relays/archive are honestly persisted-pending-runtime-restart
and language/autoStart/autoLock are honestly persisted-but-blocked. Zero
existing production source file was modified; the entire Arc is additive.

Commit title: **"Add Secure Runtime Alpha 4981-5060: Desktop Settings Runtime
Application and Safe Reconfiguration Arc."**

## Mandatory rules — honored

- **Not a generic remote-control surface.** No generic key-value application
  engine; each field maps to exactly one closed application class and one
  closed action. No reflection, no private-field casts, no monkey-patching —
  live subsystems are driven only through narrow injected ports and existing
  public methods (`FedosDeviceSyncOperationalFacade.startSync()/stopSync()`,
  the notification `Port`, a presentation sink).
- **No silent restarts / reconnects.** Runtime-restart-class settings are
  persisted and reported `pending-runtime-restart`; no hot reload is invented,
  no Runtime or Electron process is restarted silently, no relay is silently
  reconnected, no in-flight sync discarded, no archive moved, no profile path
  migrated.
- **Honest classification.** language / autoStart / autoLockTimeoutMinutes are
  UNSUPPORTED/BLOCKED because no accepted boundary exists — never falsely
  claimed applied.
- **No secret ever crosses the boundary.** The Host Bridge sends only sanitized
  effective-state VIEWS (statuses + non-secret summaries), never the raw
  descriptors (which could embed relay userinfo or a filesystem path). Proven
  by acceptance tests 15/42/46.
- Additive only: no new dependency, no Rust/Cargo change, `p2p/`/`.tmp_gen/`
  untouched, Electron security settings unchanged (untouched), no redesign of
  Relay transport / Device Sync Scheduler / Notification-Tray-Badge / Archive /
  Search / Conversation Runtime / Electron IPC.

## Phase-by-phase

- **A — Inventory/classification.** `docs/..._phase_a_inventory.md`. Table
  derived from real source ownership.
- **B — Application Planner.** `FedosSettingsApplicationPlanner` /
  `planFedosSettingsApplication` — pure, closed action vocabulary, non-secret
  value summaries, deterministic operation order.
- **C — Effective state.** `FedosSettingsEffectiveState` (rich, in-process) +
  `FedosSettingsEffectiveStateView` (sanitized, boundary-safe). Persisted /
  desired / effective / pending-restart / blocked / failed distinguished.
- **D — Coordinator.** `FedosDesktopSettingsApplicationCoordinator` — delegates
  all business truth to the controller and the injected ports.
- **E — Transaction semantics.** Chosen = persist-desired → apply supported
  actions → report effective delta. Closed outcome vocabulary; partially-applied
  is never called success.
- **F — Immediate settings.** Theme + window layout to a live presentation sink
  (closed vocabulary, no CSS injection); proven without Runtime recreation.
- **G — Relay reconfiguration.** No safe live replacement exists (relay set is
  construction-time); desired config persisted, `runtime-restart-required`
  reported. Validation reused from the existing validator; no transport redesign.
- **H — Background sync.** Applied through the existing facade/scheduler; one
  scheduler, no second timer; disable awaits the in-flight tick; distinguishes
  running / stopped / blocked / failure.
- **I — Notifications.** `notificationsEnabled` gates a decorator over the
  existing Port; presentation suppressed while the canonical event still flows
  (test 21); Device Sync/Tray/unread untouched.
- **J — Archive directory.** Construction-time only → `runtime-restart-required`;
  old archives never moved; path body never exposed (only "configured").
- **K — Auto-lock.** No accepted user-activity boundary → persisted-but-blocked;
  no global input monitoring invented.
- **L — Auto-start.** No OS registration boundary → persisted-but-blocked;
  persistence explicitly does not equal OS registration.
- **M — Host commands.** Four narrow, closed commands in a SEPARATE additive
  bridge; no generic set(key,value); returns only closed coarse outcomes /
  sanitized views.
- **N — Presentation/renderer.** Application ViewModel projects saved vs
  effective vs pending, application class, restart-required, blocked reason,
  last outcome, confirmation requirement — structured-clone-safe, no raw Error,
  no internal object.
- **O/P — Runtime/Electron restart.** No setting was force-applied via an
  invented restart; restart-class fields are reported honestly and left for a
  confirmed restart path a future Arc/integration owns. No restart coordinator
  fabricated.
- **Q — Startup application.** `initialize()` loads persisted settings, seeds
  the immediate live boundaries, and fails closed on a corrupt store (test 47).
- **R — Real acceptance tests.** 50/50, real boundaries (real file persistence,
  real notification coordinator + gate, REAL device-sync scheduler). Mocks used
  only for narrow failure injection (a failing presentation sink for rollback).
- **S — Security/structural guards.** Closed vocabulary; desired ≠ effective;
  no silent restart/reconnect; no secret in Settings or across the boundary; no
  generic filesystem IPC; no raw Relay/Scheduler object exposed; one Runtime /
  Scheduler / coordinator each; no new dependency; no crypto/protocol redesign.

## Verification

- `typecheck:core`: only the two documented pre-existing baseline errors (A/B).
- `typecheck:electron`: green (electron-spike deps installed in-worktree; no
  electron source touched).
- New suite: **50/50** (`test/secure_runtime_alpha_4981_5060_settings_runtime_application.test.ts`).
- Prior settings suite: 31/31 (unchanged). Scheduler suite: 19/19 (unchanged).
- Full `vitest run`: new suite green; the pre-existing failure set (fresh-
  worktree raw-import / source-alignment review / missing WASM `pkg/`) is
  unchanged — A/B confirmed 252 baseline failures with this Arc's files moved
  aside, and the new files add only passing tests with no existing test changing
  status. None of the failures involve the settings subsystem.

## Honest limits

- Live RELAY hot-reload and a confirmed Runtime/Electron restart flow are NOT
  implemented — they are honestly classified as runtime/application-restart and
  left to the integration/RC Arc, because the relay set and archive paths are
  construction-time-only in the current, frozen Runtime.
- The real packaged-Electron round trip remains environment-gated (same as the
  prior Arc); the settings-application layer is file-backed and fully verified
  without a launched Electron process.

## Recommended next Arc

**FedOS Desktop Beta 0.1 Integration, Release Candidate, and Acceptance Freeze
Arc** — wire the application coordinator into the real Electron main/preload
lifecycle, add the confirmed Runtime-restart path so relay/archive changes take
effect, and run the packaged-Electron settings-application round trip on an
environment with the Electron binary present.
