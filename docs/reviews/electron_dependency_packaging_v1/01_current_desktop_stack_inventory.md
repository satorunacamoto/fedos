# 01. Current Desktop Stack Inventory

Review only — no production edit. Every fact below is verified directly
against this worktree's own checked-out `src/`/`package.json`
(`review/electron-dependency-packaging-v1`, branched from
`arc/desktop-electron-host-boundary` @ `7b72a3e`), not inferred from a
commit title.

## Runtime entry points

- `src/desktop/runtime/run_fedos_desktop_runtime.ts` (Alpha 613) — the
  ONE existing process-boundary precedent. A bare Node CLI: parses
  `--board-log=`/`--outbox-log=` flags, calls `startFedosDesktopRuntime()`,
  registers `SIGINT`/`SIGTERM`, awaits graceful `runtime.stop()`. No
  window, no UI, no IPC of any kind. Its own header states it is "never
  imported by any other `src/` file" — confirmed still true (`grep -rl
  "run_fedos_desktop_runtime" src/` matches only itself).
- `src/desktop/runtime/fedos_desktop_runtime.ts` — `startFedosDesktopRuntime()`,
  the real factory every layer above ultimately calls. Framework-agnostic;
  imports no Electron/browser API of any kind.

## Shell

`src/desktop/shell/` — three files:
`fedos_desktop_application_shell.ts` (`FedosDesktopApplicationShell`),
`fedos_desktop_shell_result.ts` (closed result vocabulary),
`fedos_desktop_shell_view_models.ts` (closed view types). Owns exactly one
`FedosRunningDesktopRuntime` per instance; `create()` → `start(config)` →
real methods → `stop()`. No Electron/browser reference anywhere
(confirmed by grep).

## Presentation / ViewModel boundary

`src/desktop/presentation/` — 12 files: ten ViewModels (Conversation List,
Conversation Detail, Message List, Compose Message, Reply, Search,
Archive, Membership, Unread Counter, Runtime Status), one shared state
shape (`fedos_desktop_view_model_state.ts`), one aggregator
(`fedos_desktop_conversation_ui_presentation_boundary.ts`). Every
ViewModel's only dependency is `FedosDesktopApplicationShell`.

## Renderer

`src/desktop/renderer/` — 11 files: eight content renderers, two shared
cross-cutting ones (Error, Loading), one aggregator
(`fedos_desktop_renderer.ts`, `FedosDesktopRenderer`). Every `render()`
method reads ONLY a ViewModel's already-public getters and returns a
closed, frozen, JSON-serializable `FedosDesktopRenderModel<T>`. No HTML,
CSS, DOM, or rendering-framework import anywhere (confirmed by grep for
`window`, `document`, `React`, `electron`, and for any `.tsx`/`.jsx` file
under this directory — zero matches).

## Host Port/Bridge

`src/desktop/host_boundary/` — four files:
`fedos_desktop_host_port.ts` (`FedosDesktopHostPort`, the framework-neutral
interface — no `BrowserWindow`/`ipcMain`/`ipcRenderer` reference
anywhere), `fedos_desktop_host_command.ts` (closed, structurally-validated
14-command union), `fedos_desktop_host_response.ts` (closed JSON-safe
response vocabulary), `fedos_desktop_host_bridge.ts`
(`FedosDesktopHostBridge`, the in-process reference implementation — owns
one Presentation Boundary + one Renderer per `start()`, serializes
`dispatch()` through one internal queue). 17 real tests
(`test/secure_runtime_alpha_3561_3640_host_bridge.test.ts`) exercise this
against the real Runtime/Shell/ViewModel/Renderer stack. No Electron
import anywhere (confirmed by grep, and by this review's own
`source_alignment.test.ts`).

## Build scripts (`package.json`, verbatim)

```
"build:wasm":    "cargo build ... --target wasm32-unknown-unknown --release && wasm-bindgen ..."
"build:runtime": "tsc -p tsconfig.runtime.json"
"start:runtime": "npm run build:runtime && node dist/desktop/runtime/run_fedos_desktop_runtime.js"
"typecheck":     "tsc --noEmit"
"test":          "vitest run"
```

No packaging script of any kind exists — no `electron-builder`, no
`electron-forge`, no `electron-packager`, no bundler (webpack/esbuild/vite
build config) anywhere in this repository.

## Current dependencies

```
dependencies:    @noble/curves ^2.2.0, @noble/hashes ^2.2.0
devDependencies: @cloudflare/workers-types ^4.0.0, typescript ^5.6.0, vitest ^2.1.0
```

Two production dependencies, three dev dependencies, total. No Electron,
React, Vue, Svelte, Tauri, or any bundler/IPC library anywhere in
`package.json` or `package-lock.json` (confirmed by direct
case-insensitive grep for `electron` across both files — zero matches).

## Current Node runtime requirements

`"type": "module"` (pure ESM). No `engines` field in `package.json` — no
explicit minimum Node version is pinned anywhere in this repository.
`tsconfig.json`'s own `target`/`lib` is `ES2022`/`["ES2022","WebWorker"]`.
No CI configuration exists (`.github/workflows/` absent) — there is
currently no automated cross-platform verification of ANY kind for this
repository, on Node or otherwise.

## Whether Electron exists anywhere

**No.** Confirmed by: `package.json`/`package-lock.json` grep (zero
matches), `node_modules` after a fresh `npm install` in this exact
worktree (zero `electron*` package present), and a repository-wide
`grep -ril electron src/ packages/` (zero matches outside this review's
own new files, which reference the word only in prose/comments, never in
an import).

## Device Runtime (named as an optional neighboring capability)

`src/sync/` — nine files (`fedos_sync_device_registry.ts`,
`fedos_sync_journal.ts`, `fedos_sync_queue.ts`, etc.) — real source, but
confirmed (via `grep -rl "src/sync" src/desktop src/conversation`, zero
matches, mirroring Alpha 2841-2920's own original finding, unchanged
across every Arc since) wired into NOTHING reachable from the Desktop
Host stack. `deviceStatus()` on the Shell is honestly `"unavailable"` for
exactly this reason. This review treats `src/sync/` as present-but-inert
— relevant only in that a future Electron adapter must not accidentally
imply device-sync capability exists by exposing a `deviceStatus` IPC
command that returns anything other than the current honest
`"unavailable"`.
