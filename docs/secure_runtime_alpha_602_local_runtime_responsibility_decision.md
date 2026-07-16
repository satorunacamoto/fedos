# Secure Runtime Alpha 602 — Local Runtime Responsibility Decision

Stage 2 of the Alpha 601–620 Desktop Local Runtime Entry Point &
Publish Pipeline Ownership Arc.

## Options compared

- **A. `package.json` `bin`-only CLI.** Rejected as the SOLE mechanism
  — a `bin` field alone gives no testable, importable surface; every
  test in this repository drives real classes/functions directly, never
  a subprocess, and this Arc's own "testable from test" requirement
  would be unmet without a separate exported function anyway.
- **B. `exported runFedosDesktopRuntime()` only, no executable.**
  Rejected as the SOLE mechanism — Alpha 619 requires an ACTUAL,
  repository-authoritative, subprocess-launchable command; a function
  only `import`able from a test is not a "production caller," it is an
  untested capability (this Arc's own instruction: "単なる未使用関数を
  production callerと呼んではならない").
- **D. Called from the Worker.** Absolutely prohibited by this Arc's
  own instruction — not compared further.
- **E. Electron/Tauri shell.** Absolutely prohibited — not compared
  further.
- **C. A dedicated `src/desktop/runtime/` module, exposing a testable
  exported function AND a thin executable entry point built from it** —
  chosen, combining what A and B each got half right.

## Decision: C, verified against real build/run behavior before adoption

Three new files:

- `src/desktop/runtime/fedos_desktop_runtime_config.ts` — the config
  type (Alpha 603).
- `src/desktop/runtime/fedos_desktop_runtime.ts` — `startFedosDesktopRuntime(config)`,
  a pure, testable, `async` function returning a `FedosRunningDesktopRuntime`
  handle. Imports NOTHING process-lifecycle-related (no `process.on`,
  no `process.exit`) — directly `import`able and callable from a test,
  exactly like every other constructor/factory in this repository.
- `src/desktop/runtime/run_fedos_desktop_runtime.ts` — the ONE file
  that owns `process` (signal registration, `process.exit`), built and
  run via a new, minimal `npm` script (Alpha 605).

This is NOT `package.json` `bin` (Option A) — a `bin` field publishes a
GLOBAL command for package consumers, which is meaningless for a
`"private": true` prototype with no consumers; an `npm run` script,
invoking the SAME built file `node` would run via `bin`, is the
honest, minimal equivalent for THIS repository's own current stage,
without implying a packaging promise this Arc does not make.

## Confirmed viable before being adopted, not assumed

`tsc`, run against the EXISTING `tsconfig.json` (Bundler resolution)
with `noEmit: false` and a scoped `outDir`, was tested directly this
Stage against a real file (`fedos_desktop_host.ts`) and produced
genuinely `node`-importable ESM output — see Alpha 601 §2 and Alpha
605 for the full build-config decision this finding enables.

## See also

- `docs/secure_runtime_alpha_601_current_runtime_caller_inventory.md`
- `docs/secure_runtime_alpha_605_executable_entry_point_decision.md`
- `docs/secure_runtime_alpha_613_signal_boundary.md`
