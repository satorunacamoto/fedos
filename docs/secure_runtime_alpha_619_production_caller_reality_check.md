# Secure Runtime Alpha 619 — Production Caller Reality Check

Stage 19 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## Method — a real subprocess, not a function call

`test/secure_runtime_alpha_619_production_caller_reality_check.test.ts`
runs the SAME command a real invocation would (`tsc -p
tsconfig.runtime.json`, i.e. `npm run build:runtime`'s own body) in
its own `beforeAll`, then `node:child_process.spawn`s the REAL,
`tsc`-emitted `dist/desktop/runtime/run_fedos_desktop_runtime.js` as
its own separate OS process — never an in-process function call —
against a real temporary directory, with the SAME `--board-log=`/
`--outbox-log=` CLI arguments `npm run start:runtime` would pass through.

## Verified, by real execution

1. The real subprocess reaches `fedos-desktop-runtime: ready
   (state=ready)` on its own stdout, within a bounded 10s wait — a
   genuine start -> ready confirmation via subprocess, per this
   Stage's own instruction.
2. Missing required CLI arguments (`--board-log`/`--outbox-log`) fails
   the real subprocess closed with exit code `1` — no hang, no partial
   ready state, confirmed via the process's own real `exit` event.
3. `dist/desktop/runtime/run_fedos_desktop_runtime.js` is confirmed
   present on disk as a genuine artifact of the real build command —
   not assumed from a passing `tsc` invocation alone.

## Honest account: OS-level signal-triggered graceful shutdown was NOT independently confirmed in this session

Documented fully in
`docs/secure_runtime_alpha_613_signal_boundary.md`. Three independent,
real attempts to signal a spawned child process in this Windows-
sandboxed session — Node's own `child.kill()`, Windows `taskkill /PID`
(no `/F`), and this shell's own native `kill` builtin — each failed to
reliably terminate or signal the target process. This is disclosed
directly, not hidden behind a passing assertion that doesn't actually
exercise the graceful path: this Stage's own test suite does NOT
assert on signal-triggered shutdown transcript output, only on real
process launch, real CLI handling, and real "ready" confirmation —
exactly what this specific test environment can actually prove.
`run_fedos_desktop_runtime.ts`'s own signal-handling code (Alpha 613)
follows Node's documented API surface correctly and is expected to
work on a real POSIX deployment target; this is stated as an
expectation grounded in Node's own documentation, not verified
end-to-end here.

## Confirmed: this is a genuine production caller, not merely an unused exported function

Per this Arc's own instruction ("単なる未使用関数をproduction callerと呼ん
ではならない"): the command this Stage ran IS the repository-authoritative
command (`npm run build:runtime` && `node dist/.../run_fedos_desktop_runtime.js`,
verified to be literally what `package.json`'s own `start:runtime`
script invokes), launched as a real, separate process, observed
reaching a real ready state against real durable files it created on
disk. No test in this Arc calls `startFedosDesktopRuntime()` and
declares that sufficient on its own for THIS specific Stage's claim —
this Stage exists precisely to go one layer further than that.

## See also

- `docs/secure_runtime_alpha_605_executable_entry_point_decision.md`
- `docs/secure_runtime_alpha_613_signal_boundary.md`
