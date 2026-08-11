# Commerce E2E — Packaged Binary Reachability Closure (Agent X)

**Arc:** FedOS Commerce FINAL Closure Mega-Arc (`arc/fedos-commerce-final-closure-agent-x`)
**Starting point:** EvidenceHead `50f81e069c381dce476a8eb1a2a3f9da647401a5` (Commerce E2E Completion arc's own final validation-evidence commit)

This document records what this arc actually proved about the packaged-binary
autotest reachability gap the Commerce E2E Completion arc's own final report
(`docs/commerce/COMMERCE-E2E-COMPLETION-FINAL-REPORT.md`) left open, what was
fixed, and what remains open — honestly, not as a bare "done" claim.

---

## Correction to a prior claim: the artifact is UNSIGNED, not "code-signed"

`COMMERCE-E2E-COMPLETION-FINAL-REPORT.md` states `npm run package:beta`
produces artifacts "code-signed by the local dev signtool." This is a
misreading, independently re-confirmed this arc (`Get-AuthenticodeSignature`
against the freshly-built installer and `win-unpacked` exe both this session):

```
Status: NotSigned
StatusMessage: The file ... is not digitally signed.
```

This exact misreading was already documented and corrected once before, in
`docs/secure_runtime_alpha_8441_8520_code_signing_distribution_truth.md`:
`electron-builder`'s build log always prints `signing with signtool.exe` as a
generic pipeline step name (it runs unconditionally, real signing or not) —
it does not by itself mean a valid signature was produced. This package's own
`package.json` description also states plainly: "The pipeline produces
UNSIGNED Windows artifacts." The Commerce E2E Completion arc's final report
re-introduced the same misreading; flagged here so it is not repeated again.

---

## Root cause of the original reachability gap — two distinct, both reproduced live

### Part 1 (SOLVED): stdio handle redirection hangs the packaged binary before Chromium's multi-process bootstrap

Reproduced via controlled A/B spawns, same machine, same command, only the
target binary or the `stdio` option changed:

| Launch target | `stdio` mode | Result |
|---|---|---|
| dev `node_modules/electron/dist/electron.exe` + `dist/fedos_electron_beta_main.cjs` | `["ignore","pipe","pipe"]` | Works — full console output, clean exit |
| dev electron.exe (same) | `"ignore"` | Works — file-based step log written, clean exit |
| packaged `win-unpacked\FedOS Desktop Beta.exe` | `["ignore","pipe","pipe"]` (anonymous pipe) | **Hangs** — zero GPU/utility child processes ever spawn (confirmed via live `Win32_Process` polling over 40s) |
| packaged exe (same) | `["ignore", <file fd>, <file fd>]` (real file handles) | **Hangs**, identical symptom |
| packaged exe (same) | `["ignore","inherit","inherit"]` | **Hangs**, identical symptom |
| packaged exe (same) | `"ignore"` (true NUL, matches `Start-Process`/double-click) | **Proceeds** — GPU/utility child processes spawn normally |

Conclusion: any non-NUL stdout/stderr handle (pipe, file, or inherited
console) causes the packaged binary's browser process to stall before
completing Chromium's multi-process bootstrap. This is specific to the
`electron-builder`-produced/renamed executable — the raw dev `electron.exe`
is unaffected by identical redirection. No `app.isPackaged` branch exists
anywhere near this code path in `fedos_electron_beta_main.cts`; this is an
environment/Chromium-sandbox interaction with inherited stdio handles, not a
bug in this file's own logic.

**Fix (harness-side + one minimal, gated product addition):** the harness
must launch with `stdio: "ignore"`, which makes stdout capture — the ONLY
existing evidence channel for `AUTOTEST_MODE=ui-script` — categorically
unavailable. `fedos_electron_beta_main.cts` gained a new, additive,
`AUTOTEST`-only environment variable, `FEDOS_BETA_UI_STEP_LOG_FILE`: when
set, the exact same step-result line already logged via `console.log` is
ALSO appended to that file, plus a small number of coarse lifecycle
checkpoints (`FEDOS_ELECTRON_BETA_CHECKPOINT:<label>:<timestamp>`) so a
harness with zero console access can still observe progress. Empty by
default; never read/set on a real production launch (`scripts/build_release.mjs`
/`run_electron_builder_package_beta.mjs` launch nothing and set no such env
var — this is read only at runtime, by whoever spawns the already-built
exe). See that env var's own doc comment in `fedos_electron_beta_main.cts`
for the full record. **Flagged for coordinator review per the mandate's own
instruction** — this is the one product-file change made this arc.

### Part 2 (NOT SOLVED — disclosed, not claimed as fixed): packaged binary startup is dramatically slower / sometimes does not complete even step 0 within a generous window, in THIS shared environment

Even after fixing Part 1 (`stdio: "ignore"` + file-based step/checkpoint
log), repeated live runs against both a real NSIS-silent-installed copy and
the `win-unpacked` binary showed:

- One run (the NSIS-installed copy) reached a live, OS-confirmed running
  process with 2 real GPU/utility child processes spawned, but never wrote
  even the FIRST lifecycle checkpoint (`host-started` — one of the very
  first lines of this file's own JS, executed within single-digit
  milliseconds in the dev-launch form) within 100 seconds, and was killed by
  the harness's own timeout.
- A second run (`win-unpacked`, no reinstall) spawned 2 child processes at
  one point, then a THIRD independent run spawned zero child processes for
  90 full seconds and still wrote no checkpoint.
- A dev-launch timing baseline, same machine, same session, immediately
  before/after these runs: the FULL 67-step happy-path test consistently
  completes in **~11 seconds** end to end.

**Live-measured, concrete, non-speculative context found while investigating:**
this machine was running dozens of concurrent sibling Arc worktrees'
builds/tests at the time (`cargo`/`tsc`/`vitest`/`electron` processes
observed directly via `Get-CimInstance Win32_Process` — over 280
system-wide processes). System memory was measured under **severe
pressure during these very runs: free physical memory measured at 1.36 GB,
then 0.79 GB, then 0.70 GB out of 15.18 GB total** while the packaged binary
attempts were in flight. A fresh ~225 MB Electron/Chromium process (multiple
resident sub-processes, no OS page-cache warmth for its uniquely-hashed
binary/DLLs, unlike the dev `electron.exe` which sibling worktrees' own dev
launches keep hot in cache) under that level of contention is a fully
plausible, non-product explanation for both the extreme slowness and its
run-to-run inconsistency.

**Honest verdict:** Part 2 is disclosed, not root-caused to a single
definitive mechanism, and NOT claimed as fixed. It may be pure host
resource contention (most likely, given the measured memory pressure), or a
second, independent packaged-binary-specific startup issue this arc did not
fully isolate. The harness fix from Part 1 is real and independently
verified (see evidence below); completing the FULL Commerce happy-path
script end to end against the packaged binary was not achieved within this
arc's session under the machine's actual, measured load conditions.

A final, longer-budget diagnostic run (`win-unpacked`, `stdio: "ignore"`,
the same 2-step diagnostic script, 5-minute budget) was let run to its own
full internal timeout: **zero lifecycle checkpoints were written across the
entire ~294 seconds** before the harness itself terminated it by PID. This
rules out "just needs 30-60 more seconds" as the explanation and is
consistent with either severe, sustained host contention for the full
window (plausible — this machine's free memory was independently observed
falling from 1.36 GB to 0.70 GB across these same minutes, i.e. still
declining, not recovering) or a real hang independent of elapsed time. This
arc could not distinguish between those two within its own remaining
budget; recommending a clean/idle-machine re-run as the concrete next step
rather than guessing further.

---

## Evidence gathered (this arc, live, this session)

- NSIS installer: `packages/fedos-desktop-electron-spike/dist-package-beta/FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe`
  (not committed — `.gitignore`d build output).
  Final build (including this arc's own `FEDOS_BETA_UI_STEP_LOG_FILE`/
  checkpoint harness-evidence fix), built from commit `ab4354e9af773cea4507fcfccbe8773dc2edb366`
  on `arc/fedos-commerce-final-closure-agent-x`:
  - installer SHA-256: `d3fc0d98d7d39fe4aadcf7586ade56826c3153a5800a0293fc9afb2eb8032d49`
  - `win-unpacked\FedOS Desktop Beta.exe` SHA-256: `788655e478f291f6ae128f8f633d231b47e0153e187bc18ffee8ab43555c004d`
  - `Get-AuthenticodeSignature`: `NotSigned` (confirms the correction above)
  Note: the evidence file linked below was captured against an EARLIER
  build in this same session (before the checkpoint-logging addition),
  built from the same HEAD content prior to that specific addition — its
  hashes will not match the two above; both builds share the same proven
  process-identity methodology, only the checkpoint instrumentation
  differs.
- Built from worktree HEAD commit (plus this arc's own harness-evidence
  commit) — see the final commit hash in this arc's own PR/commit history.
- Real NSIS **silent, custom-directory** install (`/S /D=<isolated temp dir>`)
  succeeded into a scratch directory under `%TEMP%`, never the real
  per-user default install location. `allowToChangeInstallationDirectory`
  and non-`oneClick` are both already true in `electron_builder.beta.config.json`,
  which is what makes this supported (confirmed by reading
  `node_modules/app-builder-lib/templates/nsis/multiUser.nsh`).
- The installer's own template (`installSection.nsh`) unconditionally
  creates a per-user (`HKCU`, `perMachine: false`) Desktop shortcut, Start
  Menu entry, and Add/Remove-Programs registry key even under `/S /D=`
  (no CLI flag suppresses them). The harness's own `afterAll` runs the
  real, installer-provided silent uninstaller (`Uninstall FedOS Desktop
  Beta.exe /S`) to remove all three, then deletes the install directory.
  No pre-existing FedOS shortcuts/registry entries existed on this machine
  before this arc's install (checked first); none remain after.
- Independent OS-level process identity, captured live via
  `Get-CimInstance Win32_Process` while the packaged/installed binary was
  actually running:
  - `ExecutablePath` matched the exact installed exe path
  - `ParentProcessId` matched the harness's own process PID (direct
    parent, not an unrelated launcher)
  - SHA-256 of the executable, re-read from the live `ExecutablePath`
    WHILE the process was running, matched the pre-launch on-disk hash
  - `VersionInfo`: `ProductName=FedOS Desktop Beta`,
    `FileVersion=0.1.0-beta.1`, `ProductVersion=0.1.0.0`
- Full evidence dump (this exact run):
  `docs/commerce/evidence/commerce_e2e_packaged_binary/packaged_binary_e2e_evidence.md`

## New harness test

`packages/fedos-desktop-electron-spike/test/commerce_e2e_packaged_binary_real_electron.test.ts`
— attempts a real NSIS silent install into an isolated directory (falls back
to `win-unpacked` if install fails), launches the resulting binary with
`stdio: "ignore"`, gathers independent OS process-identity evidence, runs
the same 67-step Commerce happy-path script as
`commerce_e2e_full_happy_path_real_electron.test.ts` via the new
`FEDOS_BETA_UI_STEP_LOG_FILE` disk channel, asserts on it identically, and
cleans up (process tree by PID only, real silent uninstall, install-dir
removal) in `afterAll` regardless of pass/fail.

**Current status of this test in this environment: FAILING** — the
happy-path script does not complete within the window tried (up to 5
minutes in a standalone diagnostic run), per the Part 2 finding above. The
test is committed as real, working infrastructure (it DID reach a real,
OS-identity-proven running instance of the packaged binary — that part is
proven) but does not yet demonstrate a full green happy-path run against
the packaged binary. Re-running on a machine without the concurrent
resource contention this session measured is the recommended next step
before concluding whether Part 2 has a product-relevant cause at all.

---

## Process safety

Every process spawned by this arc's own diagnostics and the new test's own
`afterAll` was tracked by PID and terminated by PID only (`taskkill /PID
<n> /F /T`), never by image name. One stray diagnostic `find.exe` (this
agent's own earlier, unrelated command) was also cleaned up by PID after a
`TaskStop` call reported success but left it running (a known, documented
Windows-orphan-process artifact). No other agents' or the user's processes
on this shared machine were touched at any point.

---

## Commerce FINAL P1 Closure arc update — Part 2 SOLVED

**Part 2 is closed.** The "sometimes never writes even its first checkpoint" hang described above was never actually host-contention-only, as this document's own honest disclosure above suspected but did not prove. Agent X (this arc) checked the one thing no prior arc had: whether the hung packaged-binary PID owned a real, visible native window. It did — a real Electron default uncaught-exception "Error" dialog, invisible to every prior arc because `stdio:"ignore"` meant no one was ever watching the screen during a headless CI-style run. Extracted via UI Automation (`System.Windows.Automation`, not a screenshot crop): `Cannot find module './fedos_electron_notification_adapter.js'`.

Root cause: two real, deterministic `electron_builder.beta.config.json` packaging defects, not a Chromium/environment/host-contention issue —

1. The `files` allowlist covered only 4 of the 5 sibling `.js` modules `fedos_electron_beta_main.cjs` actually `require()`s at module-load time (before `app.whenReady()`'s own try/catch, hence before the crash-visibility diagnostic added by the prior arc could ever fire).
2. With (1) fixed, a second defect surfaced: `extraFiles` copied the root-compiled `dist/` to a location that is a sibling of, not an ancestor of, `resources/app.asar` (where `node_modules` actually lives) — Node's module-resolution walk-up never reaches it.

Both fixed. Re-ran `commerce_e2e_packaged_binary_real_electron.test.ts` three times this session: pre-fix (FAIL, reproducing every prior arc's finding exactly), bug-1-fixed-only (FAIL, but the first-ever `startup-failed` diagnostic fire — genuine forward progress, proving the crash-visibility diagnostic itself works correctly), both-fixed (PASS — full happy-path E2E green against the real NSIS-installed binary). First time ever, across this repo's documented history, that the real packaged/installed binary has completed the full E2E.

**Independently re-verified by the coordinator, twice, on the fully-merged tree** (not narrative trust — a direct `npx asar list` inspection each time): the coordinator's first re-run of `npm run package:electron-beta` after merging Agents K1/K2/X/T together found a THIRD instance of this same defect class that Agent X's own fix did not cover — `qrcode`'s own transitive runtime dependencies, `dijkstrajs` and `pngjs` (both `require()`d eagerly, at module-load time, by `qrcode/lib/server.js` and `qrcode/lib/core/segments.js` respectively — confirmed by direct source inspection, not assumed), were silently absent from the packaged `app.asar` despite `qrcode` itself, `@noble/curves`, and `@noble/hashes` all being correctly present. This would have reproduced the exact same crash class, for a different reason. Fixed by declaring `dijkstrajs`/`pngjs` as direct dependencies in `packages/fedos-desktop-electron-spike/package.json` (this made electron-builder's own node_modules dependency-graph collector include them; a transitive resolution through `qrcode`'s own declared `package.json` dependencies was, for reasons not further root-caused within this fix's own scope, insufficient in this environment for these two specific packages while sufficient for `qrcode`'s OTHER transitive tree, e.g. `yargs` and its own dependents). Re-ran the full packaged-binary E2E test again after this fix: **PASS**, 45 observed steps, full happy path including a real signed+QR-encoded receipt issuance and independent re-verification (the exact code path that needs `dijkstrajs`/`pngjs` at runtime, not just at `require()` time — genuinely exercised, not just import-resolved).

**Current status of `commerce_e2e_packaged_binary_real_electron.test.ts` in this environment: PASSING**, confirmed via two independent real runs (Agent X's own worktree, and the coordinator's fully-merged tree) with two different, real root causes found and fixed between them.

**Not attempted this pass:** a literal installed-binary + restart combined test (install once, launch twice against the same profile, prove Persona/Receipt identity continuity through the INSTALLED form specifically, not just the dev-`dist/`-launch form `commerce_e2e_restart_persistence_real_electron.test.ts` already proves). Disclosed as a real, bounded scope gap, not silently assumed — see `docs/commerce/FEDOS-COMMERCE-END-TO-END.md`'s own "Commerce FINAL P1 Closure arc update" for the equivalence argument this arc relies on instead (identical compiled entrypoint file, proven separately for boot+happy-path via the installed launch and separately for restart persistence via the dev launch).
