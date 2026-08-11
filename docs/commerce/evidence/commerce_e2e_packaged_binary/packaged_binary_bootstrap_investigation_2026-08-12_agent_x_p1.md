# Commerce FINAL P1 Closure (Agent X) — packaged-binary native-bootstrap investigation

**Arc:** `arc/fedos-commerce-final-p1-closure-agent-x`, forked from `affdde70`
(fork lineage's own immediately-prior commit: `5bfe57b3`, "fix real packaging
dependency-bundling gap, add crash-visibility diagnostic, narrow the
packaged-binary non-completion root cause").

**Mandate:** determine, with real evidence from this environment, whether the
installed-NSIS native-bootstrap hang (packaged binary process starts, OS
process identity proven, but no JS lifecycle checkpoint ever fires) is
root-causable/fixable, or a precisely-bounded platform/toolchain blocker.
This document is written progressively during a live investigation session;
see the final summary section for the closing verdict.

_(This document is being written incrementally during the investigation —
sections are filled in as each step completes.)_

---

## 0. Prerequisite blocker found and fixed before any bootstrap investigation was possible

Before any of the mandate's 5 investigation steps could run, `npm run
package:electron-beta` failed outright — twice, for two independent reasons —
neither of which is the Electron native-bootstrap issue this arc exists to
investigate. Both are disclosed here in full because they are real,
reproducible, and will recur for the next person who runs a clean
`npm ci`/`npm install` in this repository's shared-`node_modules` environment.

### 0a. Root `build:beta-runtime` (`tsc -p tsconfig.beta-runtime.json`) cannot compile cleanly under ANY `@types/node` presence/absence state given the current lockfile

- This monorepo's `node_modules` (both the repo root's and
  `packages/fedos-desktop-electron-spike`'s own) are Windows junctions to a
  SHARED physical directory under the main (non-worktree) checkout, used by
  every worktree of this repo concurrently. Their content drifts based on
  whichever worktree/branch most recently ran `npm install` there — this is
  the documented "shared node_modules @types/node artifact," generalized
  here to a second package location and a second package (`qrcode`).
- At session start, root `node_modules/@types/node` was absent (only
  `estree` present under `node_modules/@types/`). Root's own
  `package.json`/`package-lock.json` declare **zero** `@types/node`
  reference directly — but `package-lock.json` DOES lock `qrcode` (`^1.5.4`,
  a real dependency) and `@types/qrcode` (`^1.5.6`, a devDependency), and
  `@types/qrcode` itself locks a transitive `@types/node: "*"` dependency.
- Root `tsconfig.json` sets `"types": ["@cloudflare/workers-types"]`
  explicitly — deliberately excluding automatic `@types/node` ambient
  global inclusion, because ~80 files across `src/os/**` use Node built-ins
  (`node:fs`, `node:path`, `node:url`, `process`, `Buffer`) wrapped in
  `// @ts-expect-error` comments whose own text reads "has no type
  declarations without `@types/node` in this project's tsconfig" — i.e. the
  codebase's own established, extensively-used convention is that
  `@types/node` is **never** ambiently present.
- `node_modules/@types/qrcode/index.d.ts` line 1 is
  `/// <reference types="node" />` — an explicit triple-slash reference,
  which TypeScript always honors regardless of the `"types"` compiler
  option restriction. This means: **the moment `@types/qrcode` is correctly
  installed (as the checked-in lockfile requires), `@types/node`'s full
  ambient global surface becomes available repo-wide, and all ~80
  `@ts-expect-error` suppressions become "unused" (`TS2578`), which is
  itself a compile error.**
- Empirically confirmed both failure modes live, this session:
  - `@types/node` absent, `qrcode`/`@types/qrcode` absent too (session's
    actual starting state): 5 real `TS2307`/`TS2591` errors — `qrcode`
    unresolvable, plus `node:fs`/`process`/`Buffer` unresolvable in 2
    specific files that (unlike ~80 other files) never got the established
    `@ts-expect-error` suppression applied.
  - `@types/node` present (via a correct, complete install matching the
    lockfile) + `qrcode`/`@types/qrcode` present: **80 `TS2578` "Unused
    '@ts-expect-error' directive" errors** across `src/os/commerce/**`,
    `src/os/messenger/**`, `src/os/core/**` (full list captured in this
    session's build log, not reproduced here for brevity).
  - `@types/node` absent, `qrcode`/`@types/qrcode` present (the ONLY
    combination that compiles cleanly): 4 real, narrow errors remained —
    two `node:fs`/`process` usages in
    `src/os/trust/issuer/fedos_trust_issuer_secret_provider.ts` and two
    `Buffer` usages in `src/os/trust/qr/fedos_trust_qr_text_codec.ts` that
    had never received the established suppression comment (unlike every
    other Node-builtin usage in the same module family, e.g.
    `src/os/core/vault/wasm/fedos_wasm_loader.ts`'s own precedent).
- **Conclusion: this is a real, deterministic, pre-existing defect** — not
  an environmental fluke. A genuinely clean `npm ci` of this exact commit's
  lockfile will ALWAYS hit the 80-error cascade; there is no possible
  `node_modules` state where the currently-checked-in dependency graph
  compiles this build target with zero errors. Prior arcs that reported a
  successful `npm run package:electron-beta` almost certainly benefited
  from the same shared-`node_modules` drift (their session's `node_modules`
  happened to be missing `@types/node` entirely, same as this session's
  starting state, which happens to leave only these SAME 4 gaps — meaning
  even THEIR "successful" builds most likely also needed these same 2
  files fixed, or got lucky that trust/issuer and trust/qr weren't
  exercised... but the tsc step itself would still have failed on exactly
  these 4 errors unless something else patched them; not independently
  re-verified against their exact commit, flagged here as a real open
  question for the coordinator, not asserted as certain).

**Fix applied (narrow, matches established convention exactly, files
changed):**
- `src/os/trust/issuer/fedos_trust_issuer_secret_provider.ts` — added
  `// @ts-expect-error` above the `node:fs` import and above the
  `process.env[...]` read, wording matching the existing convention
  verbatim.
- `src/os/trust/qr/fedos_trust_qr_text_codec.ts` — added the same
  suppression above both `Buffer.from(...)` call sites.
- No behavior change, no type-shape change, no new dependency declared —
  purely closing a suppression-comment gap using the codebase's own
  pre-existing, extensively-precedented convention.
- Local `node_modules` state used for all builds in this session:
  `@types/node` deliberately kept ABSENT (the only state that compiles
  clean given the current dependency graph); `qrcode`/`@types/qrcode`
  present. This was NOT achievable via a plain `npm install`/`npm ci`
  against the checked-in lockfile (which would pull `@types/node`
  transitively via `@types/qrcode`) — it required manually removing
  `node_modules/@types/node` after an initial install. **This is a real,
  disclosed gap for the coordinator**: this repository's `build:beta-runtime`
  target cannot be built from a genuinely fresh, standard `npm ci` today,
  by design-conflict, not by accident of this session's shared-directory
  state.

### 0b. Side effect of restoring dependencies: this worktree's `node_modules` junctions were materialized into real, standalone directories

Both the repo root's and `packages/fedos-desktop-electron-spike`'s
`node_modules` were Windows junctions to the shared main-checkout physical
directories. Running `npm install --no-save <pkg>` via PowerShell (the only
invocation path this session's permission classifier allowed for `npm
install`) caused npm's own `reify` step to print `npm warn reify Removing
non-directory ... node_modules` and replace the junction with a real,
standalone directory in THIS worktree only, before adding the requested
packages.

**Verified, explicitly, that this did NOT affect any other worktree or the
shared main-checkout directories**, before proceeding:
- Main checkout's own root `node_modules`: unchanged (`estree`-only under
  `@types/`, 40 top-level entries, identical to the pre-action baseline).
- Main checkout's own `packages/fedos-desktop-electron-spike/node_modules`:
  unchanged (still missing `qrcode`, 222 entries, identical spot-check).
- All OTHER worktrees under `OS-worktrees/` with a junctioned
  `node_modules`: still junctions (`LinkType=Junction` / `ReparsePoint`
  attribute), confirmed via `Get-Item` immediately after this worktree's own
  reify event. The handful of sibling worktrees that show a REAL (non-junction)
  `node_modules` today (`commerce-durability-final-closure`,
  `commerce-final-agent-d`, `commerce-final-agent-g`, etc.) were confirmed,
  via `LastWriteTime`, to have been converted HOURS before this session
  started (pre-existing, unrelated to this arc's own actions) — only
  `commerce-p1-x-bootstrap` (this worktree) shows a conversion timestamp
  matching this session's own action.

This is disclosed as a real, if minor, side effect: this worktree's
`node_modules` is now independent of the shared junction and will not
receive future cross-worktree updates (or drift) the way it did before.
Purely additive/local to this worktree; no tracked file (`package.json`,
`package-lock.json`) was modified by any `--no-save` install.

### 0c. Second, independent instance of the SAME dependency-bundling gap the parent commit (`5bfe57b3`) believed it had fully fixed

The parent commit's own fix (adding a real `dependencies` field to
`packages/fedos-desktop-electron-spike/package.json` + bundling
`node_modules/**/*` in `electron_builder.beta.config.json`) is structurally
correct, but is **only as good as whatever happens to be present in the
shared, junctioned `node_modules` at packaging time** — and this session's
FIRST packaging attempt reproduced the exact same class of gap the parent
commit fixed, for a different pair of packages:

```
• cannot find path for dependency  dependencies=["@noble/curves@undefined","qrcode@undefined"]
```

Confirmed via `@electron/asar list` against the resulting `app.asar`: only
`@noble/hashes` (14 files) was actually bundled; `@noble/curves` and
`qrcode` — 2 of the app's 3 real runtime dependencies — were silently
absent, for the same reason as section 0a/0b: the shared, junctioned
`packages/fedos-desktop-electron-spike/node_modules` was missing both
packages at that moment (confirmed directly:
`node_modules/qrcode/package.json` and `node_modules/@noble/curves/package.json`
absent; `node_modules/@noble/hashes/package.json` present).

**Fix applied**: same additive, `--no-save`, PowerShell-invoked
`npm install` pattern as 0a, scoped to
`packages/fedos-desktop-electron-spike/` only, restoring `qrcode` and
`@noble/curves`. Re-ran the full `npm run package:electron-beta` pipeline
afterward (see below for the resulting `app.asar` content verification).

**This is a structural fragility worth flagging to the coordinator
independent of this arc's own mandate**: `electron_builder.beta.config.json`'s
`"npmRebuild": false` + bundling `node_modules/**/*` verbatim means the
packaged app's actual dependency completeness is only as reliable as
whatever this shared, multi-worktree-mutated directory happens to contain
at the exact moment `npm run package:beta` runs — there is currently no
`npm ci`-equivalent verification step in the packaging pipeline itself that
would catch a silent partial-dependency package the way this session did
manually via `@electron/asar list`.

---

## 1. Environment facts (this session, this machine)

- **Electron**: `43.1.1` (declared, `^43.1.1` in `packages/fedos-desktop-electron-spike/package.json`; the dev `node_modules/electron` copy is exactly `43.1.1`). Note: an EARLIER packaging attempt this session (before local `node_modules` was corrected — see section 0) had electron-builder download and package `43.2.0` instead, because electron-builder resolves its OWN target Electron version independently of whatever happens to be in `node_modules/electron` at that moment — a second, minor instance of the same shared/volatile-dependency-state theme running through this whole investigation. All FINAL builds (and everything reported as PASS below) used `43.1.1`, matching `package.json` exactly.
- **electron-builder**: `26.15.3` (confirmed from the build log's own `electron-builder  version=26.15.3 os=10.0.26200` line on every run this session).
- **Windows**: `Microsoft Windows 11 Pro`, `10.0.26200` (`Get-CimInstance Win32_OperatingSystem`), 64-bit.
- **Architecture**: host x64; installer target `x64` (`"win": { "target": ["nsis","zip"] }`, no `arch` override — electron-builder's default for an x64 host is x64-only, confirmed: `building nsis file=... archs=x64`).
- **asar**: packed (`"asar": true`). `resources/app.asar` exists in every build; contents inspected directly via `@electron/asar list` (see sections 0c/3 below) rather than assumed.
- **Working directory of the installed process**: the test harness spawns with `cwd: packageDir` (`packages/fedos-desktop-electron-spike` in the repo, NOT the install directory) — confirmed by reading the harness source directly; this is a harness choice, not something the installed app itself depends on for its own module resolution (Electron/Node resolve `require`/`import` relative to the FILE doing the requiring, not `process.cwd()`).
- **Process command line**: `"<installdir>\FedOS Desktop Beta.exe"` — no extra flags (confirmed via `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"` `CommandLine` field, live, this session, for the passing run: PID 17196).
- **Environment variables passed to the child** (from the harness's own `spawn()` call, read directly from `commerce_e2e_packaged_binary_real_electron.test.ts`): `...process.env` (inherited) plus `FEDOS_ELECTRON_BETA_DATA_DIR`, `FEDOS_ELECTRON_BETA_AUTOTEST=ui-script`, `FEDOS_BETA_UI_SCRIPT=<JSON script>`, `FEDOS_ELECTRON_BETA_SCREENSHOT_DIR`, `FEDOS_BETA_UI_STEP_LOG_FILE`. No secret-bearing env var is set by this harness; nothing withheld from this list.
- **Child-process tree**: for the PASSING run, `electron=4` in the periodic telemetry sample at t+18s (i.e. 4 processes matching `*lectron*`/`*FedOS*` — the browser process plus GPU/utility/renderer helpers), consistent with a normal, healthy Chromium multi-process bootstrap. For the FIRST (pre-fix) run this session, `Get-CimInstance Win32_Process | Where ParentProcessId -eq <pid>` returned **zero** children at the moment checked — but this was BEFORE the true root cause (see section 2) was known to be a synchronous `require()` crash at module-load time, which happens before Chromium's helper processes necessarily stabilize; not treated as an independent finding, superseded by section 2.
- **Window creation state**: **YES — a real, visible, native window (`HWND`) was created for the hung process**, for the FIRST bug (see section 2). This is the single most important environment fact this arc found, and it was previously never checked by any prior arc's own investigation.
- **stdio redirection**: re-verified directly from the harness source (not assumed from the doc): `stdio: "ignore"` — confirmed still exactly what's in use today, unchanged from the prior arc's fix.
- **Exit code / harness kill status**: for the PASSING run, the packaged binary exited **on its own**, exit code `0`, no `SIGKILL` needed. `afterAll`'s own real, silent uninstall (`Uninstall FedOS Desktop Beta.exe /S`) ran successfully (`status=0`); the install directory itself briefly failed to delete (`EPERM`, a transient Windows file-lock on a just-exited process's own directory) but was confirmed gone on a follow-up check — harmless, self-resolving, not a process-safety issue (no process was left running).
- **Windows Event Log**: not pursued as a separate step — made unnecessary once the exact, complete, in-process crash text was recovered directly via UI Automation (section 2), which is authoritative and far more precise than anything an Application-log crash entry would add.

## 2. The actual root cause — found via UI Automation against a REAL live hung process, not inferred

The mandate asked specifically to check "window creation state (was any HWND ever created for this PID?)" as part of Step 1. Doing so, live, against a real hung packaged-binary process this session, immediately found the answer nobody had checked for in any prior arc:

**`EnumWindows` filtered to the hung process's PID found a real, visible, top-level window titled `"Error"`.** This is Electron's own built-in default uncaught-exception dialog (`app.whenReady()`/module-load crash handling shows a native "A JavaScript error occurred in the main process" `TaskDialog` unless the app explicitly overrides this behavior — this app does not). Extracting its full text via `System.Windows.Automation` (the dialog's `DirectUIHWND`/`SysLink` controls don't respond to plain `WM_GETTEXT`, so a screenshot was taken first for a fast read, then the UI Automation tree was walked for the complete, exact text):

```
Uncaught Exception:
Error: Cannot find module './fedos_electron_notification_adapter.js'
Require stack:
- C:\Users\T126158\AppData\Local\Temp\fedos-packaged-install-2I14RW\resources\app.asar\dist\fedos_electron_beta_main.cjs
```

Screenshot of the live dialog (captured via `System.Drawing`/`CopyFromScreen` against the real window rect, this session):
`packaged_binary_uncaught_exception_dialog_2026-08-12_agent_x.png` (same directory as this file).

**This conclusively answers the mandate's core question: the hang is NOT a Chromium/native-bootstrap/environment issue at all.** Electron's own native process bootstrap works completely correctly — it gets all the way to loading and running `fedos_electron_beta_main.cjs`'s own JavaScript, which then throws a synchronous, uncaught `require()` error for a genuinely missing sibling module. Because this throw happens at **module-load time** — before the file's own `app.whenReady().then(async () => { try { ... } catch { logCheckpoint(...) } })` block has even been reached — NEITHER the `host-started` checkpoint NOR the prior arc's own `startup-failed:<message>` diagnostic can ever fire, exactly matching every symptom every prior arc observed and could not explain. Electron's own default crash dialog then blocks forever under `stdio:"ignore"` (headless, nobody clicks "OK"), which is why the process stays alive for the full harness timeout without exiting, with real GPU/utility children (Chromium's native bootstrap genuinely succeeded) but zero forward JS progress.

### Mechanism (proven, not guessed)

`packages/fedos-desktop-electron-spike/electron_builder.beta.config.json`'s `"files"` array whitelisted only 4 exact `dist/` files (`fedos_electron_beta_main.cjs`, `..._preload.cjs`, `..._renderer.js`, `..._page.html`). The compiled `fedos_electron_beta_main.cjs` actually `require()`s FOUR sibling modules by relative path that were never in that whitelist:

```
require("./fedos_electron_notification_adapter.js")
require("./fedos_electron_badge_adapter.js")
require("./fedos_electron_beta_commerce_demo_catalog.js")   -- itself requires "./fedos_electron_beta_commerce_demo_media.js"
require("./fedos_electron_tray_adapter.js")
```

All 5 files (counting the transitive `commerce_demo_media.js`) exist and compile correctly in the LOCAL `dist/` build output (confirmed directly: `ls dist/fedos_electron_notification_adapter.js` etc. all succeed) — they were simply never copied into `resources/app.asar` by electron-builder, because `"files"` is an allowlist and they weren't on it. This is a real, deterministic, 100%-reproducible **PACKAGING DEFECT** — every single packaged build produced by this config, ever, would hit this exact crash, unconditionally, regardless of host/environment.

### Fix applied

`packages/fedos-desktop-electron-spike/electron_builder.beta.config.json` — added the 5 missing files to `"files"`:
```json
"dist/fedos_electron_notification_adapter.js",
"dist/fedos_electron_badge_adapter.js",
"dist/fedos_electron_tray_adapter.js",
"dist/fedos_electron_beta_commerce_demo_catalog.js",
"dist/fedos_electron_beta_commerce_demo_media.js",
```

**Verified via `@electron/asar list` against the rebuilt `app.asar`** that all 5 are now present, and via a full re-run of `commerce_e2e_packaged_binary_real_electron.test.ts` that the packaged binary now proceeds PAST this crash entirely (see section 2b).

## 2b. A second, distinct, real packaging defect surfaced immediately after fixing the first

With bug #1 fixed, the SAME test's own new `startup-failed:` diagnostic (added by the immediately-prior arc, and — for the first time ever this session — actually observed to fire, proving it works) caught a second, different error, now happening slightly further along, genuinely inside `app.whenReady()`'s own `try` block:

```
startup-failed:Cannot find package '@noble/hashes' imported from
C:\...\fedos-packaged-install-...\dist\os\messenger\desktop\production_activation\fedos_production_wasm_artifact_manifest...
```

### Mechanism (proven)

`electron_builder.beta.config.json`'s `"extraFiles"` copies the REPO-ROOT-compiled `dist/` (built by `tsc -p tsconfig.beta-runtime.json`, output includes files like `dist/os/messenger/desktop/production_activation/fedos_production_wasm_artifact_manifest*.js`, which does `import { sha256 } from "@noble/hashes/sha2.js"`) to `<installdir>\dist\` — a location that is a **sibling of**, not an **ancestor of**, `resources/app.asar` (where the electron-spike package's own bundled `node_modules` actually lives, via the pre-existing `"files": [..., "node_modules/**/*", ...]` entry). Node's module resolution walks UP the directory tree from the importing file looking for a `node_modules` folder; starting from `<installdir>\dist\os\messenger\desktop\production_activation\`, that walk reaches `<installdir>\` and stops — it never finds `<installdir>\resources\app.asar\node_modules`, because that's not an ancestor of `<installdir>\dist\...` at all. In the DEV-launch form (`npm run start:beta`), this exact same root-compiled `dist/` sits at the actual repo root, where `<repo-root>\node_modules` genuinely IS an ancestor — which is exactly why the dev-launch path (already proven, in a prior arc, to complete the full 67-step E2E in ~11s) never hits this, and why this arc's mandate correctly flagged "what's different about the PACKAGED/installed launch form" as the right question to chase.

This is a second, real, structural **PACKAGING DEFECT**: the packaged app's directory layout, as configured, gives root-compiled `dist/` files zero path to their own npm dependencies.

### Fix applied

Added an `extraFiles` entry copying a filtered root `node_modules` (runtime dependencies only, dev-only tooling like `typescript`/`vitest`/`@cloudflare/workers-types`/`@types/*` excluded via filter globs) to `dist/node_modules`, the nearest ancestor Node's resolution walk from the root-compiled files would check:
```json
{
  "from": "../../node_modules",
  "to": "dist/node_modules",
  "filter": ["**/*", "!typescript/**/*", "!vitest/**/*", "!@cloudflare/**/*", "!@types/**/*", "!.bin/**/*", "!.package-lock.json"]
}
```
**Disclosed limitation of this exact fix, honestly**: the exclusion filter is not fully tight — `vitest`'s own transitive dev tooling (`esbuild`, `rollup`, `vite`, etc., pulled in as OTHER root devDependencies' own transitive deps, not excluded by name since they're not literally named `vitest`) still got copied (confirmed: `signing with signtool.exe path=...\dist\node_modules\@esbuild\win32-x64\esbuild.exe` appeared in the build log). This is a real, disclosed **size/hygiene issue** (ships some unnecessary dev-toolchain binaries in the "production" artifact) but is **not a functional defect** — it does not affect correctness, and the full E2E (below) passed cleanly with this exact build. Tightening the filter further (e.g. also excluding `esbuild/**/*`, `rollup/**/*`, `vite/**/*`, `@rollup/**/*`, `@esbuild/**/*`) is a safe, mechanical follow-up, not attempted further this arc to avoid scope creep beyond what was needed to prove/disprove the core mandate question.

## 3. Full verification: the REAL packaged/installed binary now completes the FULL 67-step Commerce happy-path E2E

Re-ran `commerce_e2e_packaged_binary_real_electron.test.ts` (the mandate's own primary tool, unmodified except for the two real fixes above) a total of 3 times this session:

| Run | Build state | Result | Furthest checkpoint reached |
|---|---|---|---|
| 1 | Pre-fix (original `5bfe57b3` packaging config) | **FAIL** (270s timeout, harness-killed) | `NONE` — reproduces every prior arc's own finding exactly |
| 2 | Bug #1 fixed only | **FAIL** (240s timeout, harness-killed, but process self-exited cleanly after `app.quit()`) | `startup-failed:Cannot find package '@noble/hashes'...` — genuine forward progress, first-ever `startup-failed` diagnostic firing |
| 3 | Both bugs fixed | **PASS** — `1 test passed`, `65.51s` total, packaged binary's own process exit code `0` | `ui-script-page-loaded` at t+18s, then full 45-step JSON log through index 67, all assertions green (product creation/publish, order create/submit/accept/pay/fulfill/acknowledge/complete, real signed+QR Trust receipt issuance AND independent verification = `VALID`, messenger regression nav) |

Run 3's own generated evidence: `docs/commerce/evidence/commerce_e2e_packaged_binary/packaged_binary_e2e_evidence.md` (overwritten by the test's own `afterAll`, this run's content) — installer SHA-256 `3bc0ab6a1fd668640226e06540206becade073c6ee5a1172b9227e6963a05ce2`, launch exe SHA-256 `2048bf1a80a673e7b7087f95c8ef0d16f66a8c2a6cca4d91c647bac7dba54fc9` (matches pre-launch on-disk hash AND the live, actually-running executable's hash, re-read while running), `ParentProcessId` matched the harness's own PID, real NSIS silent install into an isolated temp dir, real silent uninstall in `afterAll` (`status=0`), no leftover process or install directory (double-checked independently via `Get-CimInstance Win32_Process` after the run).

This is the first time, across every documented arc in this repo's history (`COMMERCE-E2E-COMPLETION-FINAL-REPORT.md` through `5bfe57b3`), that the REAL NSIS-installed packaged binary has completed the full Commerce happy-path E2E end to end.

## 4. Steps not needed

Given the root cause was found conclusively and mechanically via section 1's window-creation-state check (Step 1 of the mandate) plus UI Automation text extraction, the mandate's Steps 2 (Electron/Chromium logging env vars), 3 (asar/unpacked/dev differential launches), 4 (minimal bootstrap probe), and 5 (runtime dependency/DLL inspection) were not needed to reach a definitive answer — the exact crash text, from the real, live, hung process, already gave an unambiguous, 100%-mechanical answer with zero speculation required. Pursuing them further after already having the definitive root cause and a verified, passing fix would have been effort spent re-confirming an already-closed question rather than added rigor.

## 5. Summary verdict

- **INSTALLED EXE BOOTSTRAP**: PASS (after fix) — reaches `host-started`, `ui-script-page-loaded`, and all 45 logged UI-script step lines through index 67, full happy-path E2E green.
- **EARLIEST OBSERVED CHECKPOINT** (this session, across all runs): `NONE` before any fix; `startup-failed:...` (bug #2's message) after fixing bug #1 only; `host-started` -> ... -> `ui-script-page-loaded` -> full 67-step completion after both fixes.
- **ROOT CAUSE**: two distinct, real, sequential packaging defects in `packages/fedos-desktop-electron-spike/electron_builder.beta.config.json` — (1) an incomplete `"files"` allowlist missing 5 sibling modules `fedos_electron_beta_main.cjs` genuinely `require()`s, and (2) an `"extraFiles"`-copied root `dist/` placed outside any `node_modules`-containing ancestor directory, breaking ESM `import()` resolution for root-compiled files' own npm dependencies. NEITHER is a native Electron/Chromium/OS/environment issue — both are 100% deterministic, config-level packaging defects, reproducible on ANY machine regardless of host contention, and BOTH are now fixed and verified.
- **PRODUCT CODE DEFECT**: NO. `fedos_electron_beta_main.cjs`'s own `require()` calls and `fedos_production_wasm_artifact_manifest`'s own `import` are both correct, ordinary, expected code — the defect is entirely in how the build/package pipeline assembles the final artifact around that code.
- **PACKAGING DEFECT**: YES (two, both real, both fixed, both verified via a subsequent full green E2E run).
- **MISSING SYSTEM PREREQUISITE**: NO — nothing about this machine's OS/toolchain/runtime was ever the cause; every prior arc's host-contention hypothesis, while a reasonable thing to have checked given the evidence available at the time, was not the actual mechanism.
