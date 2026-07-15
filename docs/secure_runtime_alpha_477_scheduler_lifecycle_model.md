# Secure Runtime Alpha 477 — Scheduler Lifecycle Model

Stage 7 of the Alpha 471–480 Canonical Publish Scheduler Foundation Arc.

## 1. Candidates compared for `start()`/`stop()`

- **Option A — idempotent no-op on double-`start()`/double-`stop()`.**
  REJECTED for `start()`: silently ignoring a second `start()` call
  would hide a caller bug (e.g. two independent code paths each
  believing they own starting the Scheduler) behind a leaked, orphaned
  timer handle nothing then owns.
- **Option B — `start()` throws if already running (mirrors
  `FedosDesktopHost.start()`'s own "may only be called once" state-guard
  convention, `src/desktop/host/fedos_desktop_host.ts`, Alpha 400);
  `stop()` is an idempotent no-op if not running.** ADOPTED.
- **Option C — `stop()` also throws if not running.** REJECTED: `stop()`
  is commonly called from unconditional cleanup paths (e.g. a shutdown
  handler that doesn't track whether `start()` ever ran); making it
  throw would force every caller to track redundant state the Scheduler
  itself already tracks internally.

## 2. Constructor discipline

The constructor validates `intervalMs` (must be a positive, finite
integer — a zero or negative interval, or a non-integer, throws
immediately) but performs NO side effect: no timer started, no
`Publisher` called, no Outbox read. This matches this repository's own
established "no auto-load at startup" construction discipline
(`docs/runtime_explicit_crypto_initialization.md` Rule #1, and Alpha
056's own identical finding for `createRuntime()`) — confirmed by direct
re-read of `fedos_publish_scheduler.ts`'s own constructor body, which
assigns dependencies and validates `intervalMs` only.

## 3. Timer injection

`setIntervalFn`/`clearIntervalFn` are optional constructor dependencies,
defaulting to the global `setInterval`/`clearInterval`. This exists
SOLELY so this Arc's own tests (and any future test suite) can drive
`start()`/`stop()` without depending on a real wall-clock timer —
mirroring the general dependency-injection convention this repository
already uses throughout (`FedosDesktopHostDependencies`,
`FedosPublishSchedulerDependencies`'s own sibling shape). No test in
this Arc waits on a real interval to fire.

## 4. `tick()` is independent of `start()`/`stop()`

`tick()` may be called directly at any time, running or not — this
Arc's own instruction requires `tick()` be its own Public method, and
the most useful reading of that requirement is that manual, single-pass
triggering (e.g. from a future "publish now" GUI action, out of this
Arc's own scope to build) never requires the periodic timer to be
running at all.

## 5. See also

- `docs/secure_runtime_alpha_472_scheduler_responsibility_decision.md`
- `docs/secure_runtime_alpha_476_publish_scheduler_tick_design.md`
