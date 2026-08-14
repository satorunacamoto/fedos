# Packaged Binary Startup Error — Coordinator Finding (root cause NOT identified)

**Status: DOCUMENTED, UNRESOLVED. The release build/NSIS pipeline itself is
fully fixed and reliably produces a real, correctly-signed, checksum-verified
installer (see `PROTECTED-MEDIA-BYTE-DURABILITY-GAP.md`'s sibling commits for
the two pipeline fixes). This is a SEPARATE, downstream problem: the packaged
binary the pipeline produces does not reach a usable state when launched,
in either the automated test harness or a manual diagnostic launch.**

## What was actually observed

`packages/fedos-desktop-electron-spike/test/commerce_e2e_packaged_binary_real_electron.test.ts`
(a pre-existing test, not written by this arc) silently installs the real
NSIS package into an isolated temp directory and launches it under
`AUTOTEST_MODE` to drive a full Bob+Alice happy-path commerce flow. Result:

- NSIS silent install genuinely succeeds (`/S` flag, isolated install dir).
- The installed EXE's on-disk SHA-256 matches the installer's own embedded
  contents.
- `Win32_Process` confirms the SAME running process is the launched EXE
  (`ExecutablePath` matches, parent-PID matches the test's own PID) — not a
  stale/pre-existing binary, not dev Electron.
- Electron's own multi-process architecture DOES start (gpu-process and
  network-service utility child processes both spawn under the main
  process — Chromium's bootstrap gets meaningfully far).
- The app NEVER reaches the point of writing even one byte to the
  `FEDOS_BETA_UI_STEP_LOG_FILE` disk log across the test's full 4-minute
  timeout — the test fails on `existsSync(stepLogFile)` being `false`.
- A manual, isolated diagnostic launch (same env vars, outside the test
  harness) reproduced this independently and additionally showed: a native
  window titled exactly **"Error"** appears briefly, then disappears,
  leaving the process alive (`Responding: True`) with zero visible windows
  and an untouched, empty `FEDOS_ELECTRON_BETA_DATA_DIR` directory (nothing
  was ever written there — the app fails before touching its own profile
  storage).
- The exact error dialog TEXT was not successfully captured (it closed/
  changed state faster than the diagnostic tooling could read its child
  static-text controls); this is the biggest remaining gap in this finding.

## What was ruled out

- **Not the env-var-driven data-dir override.** Initially suspected a
  dev-vs-packaged mismatch in `FEDOS_ELECTRON_BETA_DATA_DIR` handling
  (`fedos_electron_beta_main.cts`'s `dataDir()`/`profileDir()`-style
  functions, lines ~391-398/3104-3105). Confirmed this is a red herring:
  the `--user-data-dir=...` flag visible in the child processes'
  `Win32_Process` command line is Electron/Chromium's OWN internal
  userData path (derived from `app.getName()`/`package.json`'s `name`),
  completely separate from this app's own `FEDOS_ELECTRON_BETA_DATA_DIR`
  override, which only affects this app's OWN `dataDir()`/profile-storage
  logic, never Electron's internal Chromium path. Both dev and packaged
  builds would show a similar-looking internal flag regardless.
- **Not a `node_modules` packaging omission in the sense Agent R/prior
  arcs already fixed** — `dist-package-beta/win-unpacked/dist/node_modules`
  does contain real package directories (`@esbuild`, `@noble`, `@rollup`,
  `@vitest`, etc.) post-build; a full content-completeness audit was NOT
  performed (out of scope for this pass), so a missing-at-runtime dependency
  specific to production/packaged code paths (vs. the equivalent dev-mode
  `node_modules` resolution) has NOT been ruled out and remains a live
  candidate root cause.
- **Not a Defender/environment-flakiness repeat of the build-pipeline
  issue** — that issue manifested as intermittent `STATUS_ACCESS_VIOLATION`
  crashes of DIFFERENT build-tool child processes (`tsc`, `7za.exe`,
  `makensis.exe`) during the BUILD itself, and resolved on retry. This is
  the RUNNING packaged app itself failing consistently (reproduced twice,
  independently, both via the vitest harness and a raw manual launch)
  after a successful build — a different failure class.

## Live candidate root causes (not yet distinguished)

1. A genuine uncaught exception in packaged-mode-specific startup code
   (Electron's default behavior for an uncaught main-process exception is
   exactly a native dialog titled "Error" with the exception text) — most
   consistent with the observed evidence.
2. A packaged-mode-specific missing runtime dependency (module resolution
   difference between `app.asar`/unpacked-dist and dev `ts-node`/direct
   `dist/` execution) that throws during the earliest part of module
   loading, before any FedOS-specific logging/profile-storage code runs.
3. Something related to the `package.json` `name` field being the raw
   monorepo scoped name (`@nostr-window/fedos-desktop-electron-spike`,
   visible in the `author is missed in the package.json` electron-builder
   warning and the internal `--user-data-dir` path) rather than a proper
   product identifier — plausible contributing factor for path-related
   issues, not confirmed as causal.

## What would be needed to actually root-cause this

- Capture the exact error dialog text (a `MessageBoxTimeout`-based or
  Win32 `WM_GETTEXT`-on-first-paint capture, faster than this pass's
  polling, or enabling Electron's crash reporter / a
  `process.on('uncaughtException', ...)` handler that writes to a file
  before any dialog shows).
- Diff the exact `require()`/module-resolution behavior between the dev
  launch path (this session's own, extensively-proven-reliable dev-mode
  E2E harness) and the packaged `app.asar`-adjacent `dist/` layout.

## Why this was not pursued further in this pass

Real, substantial diagnostic effort was spent (isolated manual launches,
live `Win32_Process`/window-enumeration probes, ruling out the two most
plausible initial hypotheses) without reaching a definitive root cause.
Continuing would require either modifying application startup code to add
diagnostic instrumentation (a source change beyond this pass's own
scope/authorization) or substantially more live-debugging time. Per this
arc's own Coordinator stop conditions, this is documented and deferred
rather than guessed at or silently reported as passing.

## Impact on this arc's classification

- **RELEASE / PACKAGE / NSIS: genuinely PASS** — the pipeline itself,
  independent of this finding, was proven to work (real signed installer +
  zip, verified checksums, clean secret scan).
- **INSTALLED TWO-PROCESS E2E: NOT COMPLETED** — blocked by this finding,
  not attempted further.
- **FRESH BUYER/SELLER TABLETOP: cannot exercise the installed binary** —
  would need to run against the dev-mode build instead (a materially
  different, clearly-disclosed substitution) or be deferred alongside this
  finding.
