# Secure Runtime Alpha 4421–4500: Desktop Device Sync Badge, Notification, and Operational Event Wiring Arc — Execution Spec

Base: `arc/desktop-unread-badge-menu-bar-integration` at commit `4b7fcf7`
("Add Secure Runtime Alpha 4341-4420: Desktop Unread Badge and Menu Bar
Count Integration Arc" — the immediately-prior arc), branched as
`arc/desktop-device-sync-badge-notification-wiring`.

## Objective (restated from the brief)

Connect the real Device Sync Runtime events to the Desktop Notification,
Tray, and Badge layers. Not a redesign — reuse every existing Runtime,
Scheduler, Notification, Tray, Badge, Presentation, and Shell component.
Everything additive.

## Phase A — Read actual source (findings)

Every file named in the task's own "verified locations" list was re-read in
full before any code was written. Two real, load-bearing discrepancies
between the brief's own wording and actual current source were found and
had to be designed around — this is the SAME kind of "does the obvious
wiring actually work" check the immediately-prior (badge) arc's own Phase A
had to make, and it recurred here in a different shape:

1. **`FedosDeviceSyncScheduler` has NO event emitter of any kind.** No
   `on()`, no `addListener()`, no observable hook on
   `startSync()`/`stopSync()`/`tickSync()`/`triggerSyncNow()`. Its own
   interval timer calls `this.tickSync()` directly, entirely internal to
   that file, unreachable from any external wrapper without
   monkey-patching the instance (rejected — too fragile, and arguably a
   Scheduler behavior change by stealth). The ONE real, already-designed
   extension seam it DOES expose is the injected
   `FedosDeviceSyncSchedulerDeps.attemptFn` boundary
   (`fedos_device_sync_attempt.ts`'s own header: "the Scheduler depends on
   this NARROW interface only"). `FedosDeviceSyncEventBridge.wrapAttemptFn()`
   wraps whatever real (or omitted) `FedosDeviceSyncAttemptFn` a caller
   would otherwise pass to `startFedosDesktopRuntime({ deviceSyncAttemptFn })`
   with an IDENTICAL function that observes every real attempt —
   interval-triggered AND manually-triggered alike, since BOTH paths call
   the SAME injected `attemptFn` — and returns the SAME result,
   byte-for-byte, to the real caller. Zero monkey-patching, zero
   subclassing, zero reflection into private fields.

2. **`FedosDesktopBadgeCoordinator` has no `setAttention()`/`setCount()`/
   `setNone()` public methods.** The brief's own Phase E wording ("Wire
   `setSynchronizing()`, `setAttention()`, `setCount()`, `setNone()`.") does
   not match real, current source. Those three names are pure
   VIEW-CONSTRUCTION functions in `fedos_desktop_badge_types.ts`
   (`fedosDesktopBadgeAttention()`/`fedosDesktopBadgeCount()`/
   `fedosDesktopBadgeNone()`), called ONLY from inside the Coordinator's own
   `refresh()`, based on its own real unread-count computation —
   "attention"/"count"/"none" are DERIVED, never externally settable, by
   that Coordinator's own explicit "never compute unread independently"
   design. The wiring built here calls the TWO real public control
   surfaces that exist — `setSynchronizing(bool)` + `refresh()` — and lets
   `refresh()` itself naturally re-derive "attention"/"count"/"none" from
   real, current unread state, so every Device Sync event that should
   visibly change the badge still does, through the Coordinator's own
   real, unmodified decision logic.

A third, smaller finding: `TrayCoordinator` has no "set overall status"
action in its own closed six-action vocabulary (`open-window` /
`recent-conversations` / `device-sync-status` / `pause-sync` /
`resume-sync` / `exit`) — it only dispatches discrete actions. The one
real, Electron-neutral surface for showing a short live status string that
DOES already exist is `FedosDesktopTrayPort.setTooltip(text)` (Alpha
4261-4340, unmodified) — the wiring drives that, reducing the brief's own
five-value "Synchronizing, Idle, Conflict, Failure, Disconnected"
vocabulary into one short tooltip sentence, never touching
`TrayCoordinator`'s own six actions.

## Phase B — `src/device/sync_events/`

Two new files:

- `fedos_device_sync_event.ts` — the CLOSED nine-kind
  `FedosDeviceSyncEventKind` vocabulary (`sync-started`/`sync-progress`/
  `sync-completed`/`sync-failed`/`conflict-detected`/`retry-scheduled`/
  `retry-aborted`/`device-offline`/`device-online`), the
  `FedosDeviceSyncEvent` discriminated union (coarse, non-sensitive fields
  only — scheduleId, deviceId, attempt number, coarse outcome code — never
  Journal content), and `FedosDeviceSyncEventListener` (a plain injected
  callback, mirroring this codebase's own established
  `FedosConversationInboundEnvelopeListener` idiom — never an
  `EventEmitter`).
- `fedos_device_sync_event_bridge.ts` — `FedosDeviceSyncEventBridge`. Bridge
  only, owns no business logic. `wrapAttemptFn()` is the ONE integration
  point (see Phase A finding #1). Every real attempt produces a
  `started -> progress -> (completed|failed|retry-scheduled|
  retry-aborted|conflict-detected)` sequence, THEN (last) a
  `device-offline`/`device-online` connectivity signal if the outcome
  changed this Bridge's own in-memory belief about that target device's
  reachability. `device-offline`/`device-online` are deliberately emitted
  LAST (after the primary classification event) so a listener that reduces
  the event stream to "one current status" (the Presentation Wiring's own
  tray tooltip) lands on the more specific "this Device appears offline"
  fact as the final word, not a generic "still retrying" status.

### Honest scope boundaries inside the Bridge (disclosed, not papered over)

- **`retry-aborted` vs `retry-scheduled` for a `"later"`-directive
  outcome.** `FedosDeviceSyncTickEntry.directive` (the Scheduler's own
  PUBLIC return shape) does not distinguish "still retrying" from "this WAS
  the abandoning attempt" — both classify identically via
  `classifyFedosDeviceSyncRetryDirective()`; the real abandonment decision
  (`attemptCount >= abandonmentPolicy.maxAttempts`) is entirely internal to
  `#attemptSchedule()` and never reaches the returned entry. Reading
  `FedosDeviceSyncSchedulePersistence` after the fact would be a STALE read
  (the Scheduler has not yet persisted this attempt's own outcome event
  when `attemptFn` itself resolves). Instead, the Bridge accepts an
  OPTIONAL `abandonmentMaxAttempts` — the SAME static policy value a caller
  already passes to the Scheduler elsewhere — and replicates the identical
  arithmetic. Omitted, every `"later"` directive is honestly reported as
  `"retry-scheduled"` only, never a false `"retry-aborted"` claim. Verified
  by a real test in both directions (with and without the value supplied).
- **`conflict-detected` is scoped to the SEND-side `"identity-conflict"`
  attempt outcome code only.** The RECEIVE-side conflict subsystem
  (`FedosDeviceSyncImportCoordinator`/`FedosDeviceSyncConflictPersistence`)
  is a separate, currently entirely unwired concern —
  `startFedosDesktopRuntime()` never constructs or calls
  `FedosDeviceSyncImportCoordinator` anywhere on this codebase's own base.
  Wiring it in would mean inventing a new call site for a Sync-protocol
  component, explicitly out of this Arc's own scope ("No Sync protocol
  changes"). Disclosed here, not silently glossed over.
- **`device-offline`/`device-online` are DERIVED, in-memory-only
  presentation signals**, never a fact the Scheduler itself persists —
  mirrors `FedosDesktopBadgeCoordinator`'s own `#previousCounts` "local
  presentation state is never durable" discipline exactly. Reset on every
  fresh Bridge instance; verified by a real restart test that a fresh
  instance never carries over a stale offline belief.

## Phase C/D/E — `src/desktop/runtime/fedos_desktop_device_sync_presentation_wiring.ts`

`FedosDesktopDeviceSyncPresentationWiring` — orchestration only, one entry
point (`handleEvent(event)`), wired directly as a
`FedosDeviceSyncEventListener`:

- **Phase C (Notification):** `sync-started`/`sync-completed`/
  `sync-failed`/`conflict-detected` (plus `retry-aborted`, a real failure
  a user should see) map to exactly the THREE existing closed kinds —
  `"device-sync"`/`"sync-complete"`/`"sync-failed"` — never a new kind.
  `conflict-detected` reuses `"device-sync"` with an explicit "conflict
  detected" `detail` (the vocabulary has no dedicated conflict kind).
  Every `detail` string is a short, non-sensitive device id or coarse
  outcome code, verified against the real `isSensitiveNotificationField`
  policy (none of the closed outcome-code vocabulary or device ids used in
  this Arc's own tests trip it).
- **Phase D (Tray):** the closed five-value `Synchronizing`/`Idle`/
  `Conflict`/`Failure`/`Disconnected` vocabulary, reduced to
  `FedosDesktopTrayPort.setTooltip()` calls (`"Device sync: <status>"`).
  `retry-scheduled` keeps the tray at `Synchronizing` (more attempts
  coming); `device-online` restores either `Synchronizing` (if a sync is
  still active) or `Idle`.
- **Phase E (Badge):** `setSynchronizing(true/false)` + `refresh()` only —
  the two real public control surfaces that exist (see Phase A finding
  #2). Badge state (`none`/`count`/`attention`/`synchronizing`/`error`) is
  entirely re-derived by the Coordinator's own unmodified `refresh()`.

## Phase F — Acceptance tests

Two new root test files, both against a REAL `startFedosDesktopRuntime()`
(`deviceTrustEnabled`/`deviceSyncSchedulerEnabled`), a REAL
`FedosDeviceTrustRuntime` (register/confirm/recordLocalChange), and the
REAL `FedosDeviceSyncOperationalFacade`/`FedosDeviceSyncScheduler` via
`runtime.deviceSyncOperational()` — the SAME facade production code uses.
No mocks: every Port fake (`FakeTrackingNotificationPort`/
`FakeTrackingTrayStatusPort`/`FakeTrackingBadgePort`) is a real, total,
inspectable implementation of an existing interface, mirroring this
codebase's own established `FakeTrackingBadgePort`/
`StubVerifiedFedosDeviceRegistrationAuthority` convention.

- `test/secure_runtime_alpha_4421_4500_device_sync_event_bridge.test.ts`
  (13 tests) — the Bridge's own per-outcome classification, verified
  against the real Scheduler's real classification table (including the
  non-obvious finding that a bare `"failed"` outcome is NOT in the Retry
  Policy's `TERMINAL_NEVER` set and classifies as `"operator-required"` →
  `"retry-aborted"`, not `"sync-failed"` — corrected mid-writing after a
  real test run disagreed with an initial assumption), connectivity
  offline/online derivation, a throwing listener never breaking the real
  attempt path.
- `test/secure_runtime_alpha_4421_4500_device_sync_wiring_acceptance.test.ts`
  (8 tests) — every Phase F named scenario: sync start, sync success, sync
  failure, retry, conflict, device offline, device online, badge update,
  tray update, notification, multiple events (two target devices, one
  tick, independently correlated event sequences), restart (a fresh
  Bridge+Wiring+Runtime instance over the SAME persisted schedule log,
  `attemptCount` continuing from where it left off, no stale offline
  belief carried over), shutdown (`runtime.stop()` waiting for an
  in-flight, Bridge-wrapped attempt before resolving).

Both files: **21/21 passing.**

## Verification

- `npm run typecheck:core` / `npm run typecheck:electron` — both pass
  (core modulo the same one pre-existing, unrelated, documented failure
  every recent Arc's own baseline carries:
  `test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`).
- `npm run build:runtime` / `npm run build:host-bridge` — both succeed.
- Focused Sync tests (Device Sync Scheduler/Conflict/Import Coordinator/
  Operational Facade/Shell commands) — all still green.
- Named regression suites (Desktop Runtime, Shell, Presentation, Renderer,
  Host Bridge, Navigation, Notifications/Tray/Background, Unread
  Badge/Menu Bar, Search, Archive) — all still green.
- Full real Electron subprocess suite
  (`npx vitest run --config vitest.electron-spike.config.ts`) — **6 files,
  99 passed / 4 skipped, 0 failed** (the SAME numbers the immediately-prior
  arc's own completion declaration documented — this Arc touches zero
  files under `packages/fedos-desktop-electron-spike/`).
- Full root suite (`npx vitest run`) — numbers and the honest reasons for
  the pre-existing failure baseline are in the Completion Declaration.

## Scope boundary — Electron integration NOT built in this Arc (disclosed)

This Arc deliberately does NOT wire `FedosDeviceSyncEventBridge`/
`FedosDesktopDeviceSyncPresentationWiring` into a NEW or existing Electron
main-process file (e.g. extending `fedos_electron_badge_main.cts` with a
real, network-attached `deviceSyncAttemptFn` and real device-sync IPC
channels). Both new classes are Electron-NEUTRAL by construction (no
Electron import of any kind, mirroring every sibling Coordinator/Port in
this codebase) and are verified end-to-end against a real
`FedosDeviceSyncScheduler`/`startFedosDesktopRuntime()` — the Phase F
acceptance suite proves the ENTIRE event-translation and Coordinator-
routing logic this Arc was asked to build, with zero fabrication. What
remains is pure plumbing: constructing the Bridge/Wiring inside a real
Electron main file the same way `fedos_electron_badge_main.cts` already
constructs `FedosDesktopBadgeCoordinator`/`TrayCoordinator`/
`FedosDesktopNotificationCoordinator` today. This is named as the
recommended next Arc's own first, narrowest phase in the Completion
Declaration — a real blocker of TIME within this session, not of design or
feasibility, stated honestly rather than fabricated as "done."
