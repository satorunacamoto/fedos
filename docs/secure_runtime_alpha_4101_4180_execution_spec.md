# Secure Runtime Alpha 4101–4180 — Execution Spec

Electron Main/Preload Adapter for FedosDesktopHostBridge Arc.

See `docs/secure_runtime_alpha_4101_4180_phase_a_host_command_inventory.md`
for the full Phase A (Host command inventory) — this document covers the
implementation, Phases B–G, in order.

## Base and reconciliation

Worktree `C:\wt\electron-host-adapter`, branch `arc/electron-host-adapter`,
created from `arc/desktop-device-sync-ui` @ `3f32e6e` (fullest Desktop UI +
Device Sync + Device Management lineage) and merged with
`arc/node-type-isolation` @ `722e6b1` (Electron Build Spike + Node Type
Isolation lineage) via `git merge --no-ff`, merge commit `984c488`.
Merge-base `7b72a3e`; exactly one overlapping file, `README.md` (the
expected status-blurb-stacking conflict, resolved as a union). Zero
source-code overlap between the two lineages.

## The one real gap found and closed

No existing build path compiled `FedosDesktopHostBridge`'s own transitive
dependency graph into runnable JS reachable from the physically-isolated
Electron package (`tsconfig.runtime.json`/`build:runtime` targets a
narrower, different entry point that bypasses Shell/Presentation/
Renderer/HostBridge entirely). This Arc adds ONE new root-level
`tsconfig.host-bridge.json` (mirrors `tsconfig.runtime.json`'s own exact
shape, entry point `fedos_desktop_host_bridge.ts`) and a
`build:host-bridge` npm script — confirmed by direct compilation to emit
the Host Bridge's full transitive graph (432 files) as valid ESM. A
CommonJS Electron main process loads this ESM output via a genuine
dynamic `import()` of its file URL — no new dependency, no bundler.

**Real technical blocker found and fixed during implementation**:
TypeScript, under `module: "CommonJS"` (the electron package's own
original setting), silently downlevels dynamic `import()` expressions
into `Promise.resolve().then(() => require())` — which cannot load an
ESM module and produced a genuine, reproducible "Cannot find module"
failure the FIRST time the real compiled adapter was launched. Fixed by
switching the electron package's own `tsconfig.json` to
`module: "Node16"` / `moduleResolution: "Node16"`, which TypeScript
preserves as a genuine dynamic `import()` even in CommonJS output
(verified directly with an isolated compile comparison). This in turn
changed how TypeScript emits files with no import/export of their own
(the two browser-context `<script src>` files, `fedos_electron_spike_renderer.ts`
and this Arc's own `fedos_electron_host_adapter_selftest.ts`) — under
Node16/NodeNext module resolution, TS always adds a CommonJS module
wrapper (`Object.defineProperty(exports, "__esModule", ...)`) regardless
of whether the file has any import/export, breaking plain `<script>`-tag
loading (`Uncaught ReferenceError: exports is not defined`, also
reproduced directly). Fixed by splitting the package's own build into two
tsconfigs: `tsconfig.json` (Node16, for main/preload/loader/translation
files that need real dynamic import) excludes the two browser-context
scripts; a new `tsconfig.browser-scripts.json` (classic `CommonJS`/
`Node10`, unwrapped plain-script emission) compiles ONLY those two files.
Both emit into the same `dist/`. `package.json`'s own `build` script now
runs both `tsc` invocations before the existing static-asset copy step.

Both fixes are pure build-configuration corrections within the
ALREADY-isolated Electron package (Alpha 4021-4100's own isolation is
fully preserved — root `tsconfig.json`'s own `"exclude"` list, and this
package's own physically separate `node_modules`, are both untouched) —
neither touches the Shell/Presentation/Renderer/Runtime/Host Bridge
themselves, and neither redesigns anything previously accepted.

## Phase B — Main adapter

`packages/fedos-desktop-electron-spike/src/fedos_electron_host_adapter_main.cts`.
Owns EXACTLY: process/window lifecycle, one `ipcMain.handle("fedos:invoke", ...)`
registration, and loading the compiled Host Bridge module.
`start()`/`stop()` are Main-process-OWNED lifecycle calls (never
renderer-invokable — see Phase A's own documented decision: exposing
`start()` to the renderer would mean accepting a renderer-supplied
`FedosDesktopRuntimeConfig` carrying filesystem **paths**, an indirect
"expose filesystem directly" violation). `start()` runs once at
`app.whenReady()` with a FIXED config under `app.getPath("userData")`;
`stop()` runs once at `window-all-closed`, awaited before the process
quits. A startup failure denies/closes the window — `FedosDesktopHostPort`'s
own already-documented Phase F contract, never a half-started Host with a
visible window.

The ONE request → Bridge-call translation lives in a SEPARATE, plain
`.ts` file with NO Electron import of any kind —
`fedos_electron_host_adapter_dispatch_translation.ts` — directly
unit-testable under plain vitest with a hand-written double (13 tests,
`secure_runtime_alpha_4101_4180_dispatch_translation.test.ts`). It
multiplexes exactly `{op:"dispatch",command}|{op:"render"}|{op:"status"}`
onto `bridge.dispatch()`/`bridge.render()`/`bridge.status()` — nothing
else, never re-validating or re-shaping what the Bridge itself already
guarantees.

## Phase C — Preload

`fedos_electron_host_adapter_preload.cts` exposes EXACTLY one frozen
global, `window.fedos.invoke(request)` — a thin forward to
`ipcRenderer.invoke("fedos:invoke", request)`. No other global, no
`ipcRenderer` object itself, no business method. Verified directly
(source-inspection test): exactly one `contextBridge.exposeInMainWorld`
call; the exposed object's own property list is exactly `["invoke"]`.

## Phase D — BrowserWindow

`createSecureWindow()` mirrors the ALREADY-PROVEN-SAFE spike configuration
exactly (`fedos_electron_spike_main.cts`, Alpha 3881-3940, unmodified):
`loadFile()` only (never `loadURL`), `will-navigate` unconditionally
denied, every `window.open`/new-window attempt denied, every permission
request denied by default. This Arc's own static page
(`fedos_electron_host_adapter_page.html`) is a transport-proof harness
only — it renders no Conversation/Device/business UI (that is the
explicitly preferred NEXT Arc).

## Phase E — Security

Verified directly, both by source-inspection tests and by REAL process
behavior: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`, `webSecurity: true`, preload-only (no
`enableRemoteModule`/`@electron/remote`/`nodeIntegrationInWorker`), no
`eval`/`new Function()` anywhere in Main or Preload, the frozen
single-method API, and structured-clone-safe responses (every real
response captured from the live process round-trips through
`JSON.stringify`/`JSON.parse` unchanged, contains no function, and is
never an `Error` instance).

## Phase F — Acceptance (real Electron process)

`packages/fedos-desktop-electron-spike/test/secure_runtime_alpha_4101_4180_electron_host_adapter.test.ts`
(21 tests) spawns the REAL, compiled adapter and proves, against REAL
observable behavior:

- **Launch**: the process starts, stays alive (does not crash-loop).
- **Invoke/response/errors**: the self-test page
  (`fedos_electron_host_adapter_selftest.ts`) drives a REAL round trip —
  `status` → `{outcome:"ok",value:"running"}`; a real `dispatch`
  (`runtime-status`) → the real Shell/Runtime's own live status; an
  unrecognized command → `{outcome:"error",code:"unknown-command"}`; a
  real `render` → the full 8-renderer aggregate model; an unrecognized
  `op` → `{outcome:"error",code:"invalid-input"}`. Main forwards each
  JSON result from the renderer's own console to its own stdout
  (test-support wiring only, documented in `fedos_electron_host_adapter_main.cts`'s
  own header) — the test captures and asserts on these REAL responses,
  never a mocked Bridge.
- **Unavailable paths**: proven at the unit level (`fedosElectronHandleInvoke`
  with `hostBridge === undefined`) AND implicitly by the real process
  never reaching a running state if `bridge.start()` itself fails.
- **stop()**: `window-all-closed` triggers a real `bridge.stop()`,
  awaited, before the process exits — verified by real process exit
  timing.
- **restart()/repeated launch**: two independent, sequential real
  launches both succeed and produce identical self-test results, proving
  no corrupted build output and no leaked cross-launch state.

## Phase G — Regression

`npm run typecheck` (core + electron): clean except the one pre-existing
`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`
error (confirmed present before this Arc touched anything).
`npm run test:electron-spike`: **3 files, 56 passed, 4 skipped
(packaging-artifact tests, unchanged from Alpha 3881-3940's own
established skip-if-absent convention), 0 failed.** Targeted core
regression (Desktop Runtime/Shell/Presentation/Renderer/Host/Device
Sync/Device Management, 12 files): **156/156 passing.** Full `npm test`:
**200 failed / 801 passed (1001 total) files, 257 failed / 12920 passed
(13177 total) tests** — an IMPROVEMENT over the post-merge baseline (204
failed / 797 passed files, 261 failed / 12916 passed tests) by exactly 4
tests/4 files, matching 4 genuinely-stale historical `package.json`
exact-shape tests (Alpha 1051-1110, 1471-1540, 2421-2500, and this
worktree's own Alpha 3941-4020 guard test) this Arc fixed per its own
Phase G "update historical exact-shape tests only when genuinely stale,
do not weaken their original protection" instruction — each asserted an
exact, closed `package.json` scripts list frozen from before ANY Electron
work existed; each is updated to the current, real, closed list (still
rejecting any UNEXPECTED script), never weakened.

## Completion declaration

**Complete.** The full documented architecture is real and proven live:
Electron Renderer → Preload → `ipcRenderer.invoke()` → `ipcMain.handle()`
→ `FedosDesktopHostBridge` → Presentation → Shell → Runtime, and back. No
business logic lives inside Electron — every domain decision is made by
the unmodified Host Bridge/Shell/Presentation/Renderer/Runtime stack;
Electron is a thin transport layer only, exactly as specified.

**Recommended next Arc**: Desktop Conversation Window Renderer and
Navigation Arc.
