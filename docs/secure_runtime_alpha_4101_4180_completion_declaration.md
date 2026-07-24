# Secure Runtime Alpha 4101–4180: Electron Main/Preload Adapter for FedosDesktopHostBridge Arc — Completion Declaration

## What this Arc proves

- The full, previously-only-documented target architecture is now REAL and
  proven live end to end, against a real, spawned Electron process:
  `Electron Renderer → Preload → ipcRenderer.invoke() → ipcMain.handle() →
  FedosDesktopHostBridge → Presentation → Shell → Runtime`, and the
  response travels back the same path. Proven with 5 real requests in one
  process lifetime: a real `status` query, a real `dispatch("runtime-status")`
  reaching the live Runtime/Shell, a real malformed command rejected
  `"unknown-command"`, a real `render()` producing the full 8-renderer
  aggregate model, and a real unrecognized transport-level `op` rejected
  `"invalid-input"`.
- Zero business logic lives inside Electron: the ONE translation function
  (`fedosElectronHandleInvoke`) is a plain, Electron-free `.ts` file that
  does nothing but forward a closed `{op}` discriminator to
  `FedosDesktopHostBridge`'s own `dispatch()`/`render()`/`status()` —
  proven both by 13 direct unit tests (a hand-written Bridge double) and
  by source inspection confirming this file contains zero `throw new
  Error`, zero business validation beyond the 3-value `op` check.
- `start()`/`stop()` are deliberately NOT exposed to the renderer — Main
  owns the Host's lifecycle directly, using a fixed,
  `app.getPath("userData")`-derived config, never a renderer-supplied
  path — proven by source inspection (the translation layer's own closed
  `KNOWN_OPS` list contains no `"start"`) and by the real process itself
  (the self-test page never calls anything but `dispatch`/`render`/`status`,
  and the Host is already running by the time the page loads).
- Every mandatory security default is real and independently proven, not
  merely asserted: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`, `loadFile()`-only (never
  `loadURL`), unconditional `will-navigate`/new-window/permission-request
  denial (structural, mirrors the already-proven-safe Electron Build
  Spike's own configuration verbatim), zero `eval`/`new Function()`
  anywhere in Main or Preload.
- The preload's own exposed surface is proven minimal by source
  inspection: exactly one `contextBridge.exposeInMainWorld` call, exactly
  one property (`invoke`) on the frozen exposed object — no `ipcRenderer`
  object itself ever crosses the context-isolation boundary.
- Structured-clone safety is proven against REAL captured responses (not
  merely hypothetical): every one of the 5 real round-trip responses
  survives an unchanged `JSON.stringify`/`JSON.parse` cycle, contains no
  function-typed value, and is never an `Error` instance.
- Real process lifecycle is proven directly: the compiled adapter starts,
  stays alive (no crash-loop), and a `window-all-closed` event triggers a
  REAL `bridge.stop()` (awaited) before the process exits cleanly on
  `SIGTERM`. Two independent, sequential real launches both succeed and
  produce IDENTICAL real self-test results — proving no corrupted build
  output and no state leaking across process restarts.
- The pre-existing Electron Build Spike (Alpha 3881-3940) is proven
  completely untouched and still holds its own original guarantee (no
  business IPC channel of any kind in its own two files) — this Arc adds
  entirely new, separate files alongside it, never modifying it.
- Root/Electron graph isolation (Alpha 4021-4100's own achievement) is
  proven still intact: ordinary root `test/` (`npm test`) still contains
  zero Electron references and cannot discover or launch anything
  Electron-related; the electron package's own physically separate
  `node_modules`/type graph is unchanged.

## What this Arc explicitly does NOT claim

- **No Device Sync/Device Management command was added to the Host
  vocabulary.** `FedosDesktopHostCommand` remains exactly the 14 commands
  Alpha 3561-3640 closed it at — this Arc transports whatever the Host
  already supports, and does not redesign or extend that boundary (an
  Absolute Prohibition: "do NOT redesign the Host").
- **No real Conversation/Device UI is rendered.** The self-test page is a
  transport-proof harness only, explicitly out of this Arc's own stated
  scope — the real UI is the explicitly preferred NEXT Arc.
- **No new production dependency was added.** `electron`/`electron-builder`
  were already present as devDependencies of the already-isolated
  package (Alpha 3881-3940/4021-4100); this Arc adds no dependency of any
  kind, anywhere.
- **The two build-configuration fixes this Arc made (`module: Node16` for
  the Node-context files; a second, separate `tsconfig.browser-scripts.json`
  for the two browser-context `<script>` files) are scoped ENTIRELY within
  the already-isolated Electron package** — the root project's own
  `tsconfig.json`/build graph is untouched beyond one new, narrow
  `tsconfig.host-bridge.json` (mirroring the pre-existing
  `tsconfig.runtime.json`'s own exact shape) and one new `build:host-bridge`
  script.

## Baseline vs. final

| | Before this Arc | After this Arc |
| --- | --- | --- |
| Electron ↔ Host Bridge connection | none (Host Bridge is in-process-only; Electron spike shows a blank window with no business IPC) | real, proven, end-to-end |
| `window.fedos` global | does not exist | exactly one frozen method, `invoke()` |
| Main process business logic | n/a | zero — one thin translation file, Electron-free |
| Real Electron process test coverage | build/launch/lifecycle only (Alpha 3881-3940's own 26 tests, unchanged) | ADDITIONALLY: real IPC round trip, real dispatch/render/error paths, real stop/restart |
| `npm run typecheck` | clean except pre-existing `alpha_477` failure | unchanged — same one pre-existing failure, nothing new |
| Stale historical `package.json` exact-shape tests | 4 tests across 4 files failing (broken by earlier, unrelated Electron-lineage arcs, independent of this Arc) | fixed — updated to the current real script list, original protection preserved unweakened |
| New test files | — | 3 files (13+21+... — 34 new tests in the isolated electron-spike suite), plus 4 historical tests repaired |

## Verification run (this worktree, `C:\wt\electron-host-adapter`)

- `npm run typecheck:core` / `typecheck:electron` — both clean except the
  one pre-existing failure named above.
- `npm run test:electron-spike` — **3 files, 56 passed, 4 skipped
  (packaging-artifact tests, skip-if-absent, unchanged convention), 0
  failed.**
- Targeted core regression (Desktop Runtime/Shell/Presentation/Renderer/
  Host/Device Sync/Device Management/historical structural guards, 12
  files): **156/156 passing.**
- Full `npm test`: **200 failed / 801 passed (1001 total) files, 257
  failed / 12920 passed (13177 total) tests** — an IMPROVEMENT of exactly
  4 tests/4 files over the post-merge baseline (204 failed / 261 failed
  tests), matching the 4 genuinely-stale historical tests this Arc fixed.
  Zero regression traceable to this Arc's own new work.

## Declaration

**Complete.** Electron is connected to the existing, unmodified Host
Bridge as a thin transport layer only — no business logic inside
Electron, no redesign of Shell/Presentation/Renderer/Runtime/Host Bridge,
every mandatory security default real and proven, every Phase F
acceptance scenario (launch/invoke/response/errors/unavailable
paths/stop/restart/repeated launch) proven against a real process.

**Recommended next Arc**: Desktop Conversation Window Renderer and
Navigation Arc.
