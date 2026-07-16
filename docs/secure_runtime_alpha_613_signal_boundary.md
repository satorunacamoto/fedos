# Secure Runtime Alpha 613 — Signal Boundary

Stage 13 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## Decision: Option B — the executable main owns signals, the testable runner does not

`src/desktop/runtime/run_fedos_desktop_runtime.ts` is the ONLY file in
this repository that calls `process.on(`/`process.exit(` for this
runtime. `fedos_desktop_runtime.ts` (Alpha 606) knows nothing about
`process` at all — confirmed structurally,
`test/secure_runtime_alpha_617_...test.ts` §3. This is Option B from
this Stage's own comparison ("executable mainだけがsignalを所有"),
chosen over Option A (the testable runner registering its own
listeners, which would make every test importing it pick up global
process state) and Option C (leaving signal-ownership to an
unspecified caller, which would leave the ONE real executable this Arc
adds with no actual shutdown path at all).

## Listener cleanup — mandatory, implemented

Both `SIGINT`/`SIGTERM` listeners are removed (`process.off(...)`)
inside the shared `shutdown()` closure, BEFORE `runtime.stop()` is
awaited — a repeat signal during shutdown cannot re-enter the handler.

## `process.exit()` — confined to genuine startup failure only

The ONE `process.exit(1)` call in this file sits at the top-level
`main().catch(...)`, for a startup error only (e.g. missing required
CLI flags) — never inside `fedos_desktop_runtime.ts` or any Host/
Scheduler/Controller file (all pre-existing, all already forbidden
from doing so by their own HARD GUARDRAILS). A graceful shutdown does
NOT call `process.exit()` — the process is allowed to exit naturally
once the `await new Promise(...)` this file's own `main()` holds
resolves and no further timer/handle keeps the event loop alive
(delivery disabled leaves no Scheduler timer running by construction).

## Honest limitation: OS-level signal delivery could not be independently verified in this session's own sandboxed test environment

Found by direct, repeated experimentation during Alpha 619's own
verification work, not assumed: sending `SIGINT`/`SIGTERM`/`SIGKILL`
to a spawned child process — via Node's own `child.kill()`, Windows
`taskkill /PID`, and this shell's own native `kill` builtin — was NOT
reliably observed to terminate or signal the target process within
this specific Windows-sandboxed session. Windows has no real POSIX
signals; Node emulates a subset only under specific console-attachment
conditions this sandbox does not appear to provide. This is a
testing-ENVIRONMENT limitation, disclosed directly rather than
papered over (matching this repository's own established practice,
e.g. Alpha 357's disclosed `fsync` gap) — NOT a defect in this file's
own signal-handling code, which follows Node's documented
`process.on('SIGINT'|'SIGTERM', ...)` API exactly and is the correct,
standard pattern for a real POSIX deployment target (Linux/macOS).
Process-cleanup for THIS repository's own test suite (Alpha 619) uses
`taskkill /PID <pid> /T /F` specifically because it was the one
mechanism confirmed, empirically, to reliably terminate a spawned
child in this session — a test-hygiene choice, not a statement about
production shutdown behavior.

## See also

- `docs/secure_runtime_alpha_602_local_runtime_responsibility_decision.md`
- `docs/secure_runtime_alpha_619_production_caller_reality_check.md`
