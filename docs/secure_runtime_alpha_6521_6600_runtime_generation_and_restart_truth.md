# Secure Runtime Alpha 6521–6600 — Runtime Generation and Restart Truth Document

**FedOS Desktop Beta Production Runtime Configuration Unification Arc.**

## What this Arc proves about restart

The real production vertical slice
(`test/secure_runtime_alpha_6521_6600_real_production_vertical_slice.test.ts`)
proves a genuine lock → relaunch → unlock cycle:

1. `coordinator.lock()` — the real, unmodified
   `FedosProfileInitializationCoordinator.lock()` stops the underlying
   `FedosRunningDesktopRuntime` (scheduler stopped, transport stopped,
   production crypto authority cleared, Host stopped — the SAME
   pre-existing `stop()` sequence, unmodified by this Arc).
2. A FRESH `FedosProfileInitializationCoordinator` instance (a new JS
   object, simulating an application relaunch) is constructed, pointed at
   the SAME durable profile root.
3. `unlockProfile()` with the REAL, correct secret succeeds, resolving
   the SAME persisted account identity and rebuilding a NEW Runtime
   generation from the SAME durable append-only logs.
4. An Identity Transition decision recorded BEFORE the lock is still
   `"accepted"` after the relaunch — proving durable state survives a
   genuine restart through the real production path, not merely through a
   hand-built test Runtime.

## A genuine, narrow finding: `fromRunningRuntime()`'s own scope

`FedosDesktopApplicationShell.fromRunningRuntime(runtime)` constructs a
THIN wrapper around an already-running `FedosRunningDesktopRuntime`
reference. This Arc's own vertical slice discovered, directly, that:

- `shell.status()` tracks only whether `.start()`/`.stop()` was called ON
  THAT SHELL OBJECT — it does NOT reflect the underlying Runtime being
  stopped by an EXTERNAL owner (e.g. `coordinator.lock()`). A Shell built
  via `fromRunningRuntime()` and never explicitly stopped itself will
  continue reporting `"running"` even after its own underlying Runtime is
  genuinely locked.
- Calling a Shell method that reaches into the Runtime (e.g.
  `identityTransitionList()`) AFTER the underlying Runtime was externally
  stopped throws (`"inaccessible after stop()"`) rather than gracefully
  returning `{outcome: "unavailable"}` — because `#identityTransitionRuntime()`
  (and its siblings for Direct Ratchet/Peer Capability/Signed Deletion)
  does not wrap `this.#runtime.conversationRuntime()` in its own
  try/catch, unlike `devicesList()`/`deviceSyncStatus()`, which DO.

**This is not a defect this Arc fixes** (architecture-frozen; no Shell
redesign). It is the SAME class of finding the prior Release Freeze Arc's
own verification report already noted for `archive()`. The real,
production-safe pattern — already followed by this Arc's own vertical
slice — is: a caller ALWAYS constructs a FRESH Shell after a relaunch,
never continues using a Shell tied to an already-locked Runtime
generation. Named here explicitly as a candidate for a future, narrow
Shell-hardening Arc, not silently worked around.

## What this Arc does NOT prove

- The full 10-step Runtime generation/rebuild model (Phase K's own
  complete specification: reject-new-operations, finish-or-classify
  in-flight work, recreate a Runtime-bound presentation subset while
  preserving Electron-global coordinators, etc.) — this Arc's own real
  vertical slice proves a real, working, simpler lock→relaunch→unlock
  cycle, which is the ACTUAL mechanism this codebase has today. Building
  the full 10-step generation model would be a genuine Runtime redesign,
  explicitly prohibited by this Arc's own mission.
- A live "restart-required setting is applied after an in-place Runtime
  restart" proof (Phase J/K's own combined requirement) — no in-place
  restart-without-relock mechanism exists in this codebase; the only real
  mechanism is lock→relaunch→unlock, which this Arc's own slice does
  prove.
