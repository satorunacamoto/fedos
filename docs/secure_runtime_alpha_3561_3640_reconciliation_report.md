# Secure Runtime Alpha 3561–3640 — Phase A: Host and Dependency Inventory

Written before any production edit, per this Arc's own instruction.

## 1. package.json dependencies

```
dependencies:    @noble/curves, @noble/hashes
devDependencies: @cloudflare/workers-types, typescript, vitest
```

No Electron, no React/Vue/Svelte/Tauri, no HTTP framework, no IPC library.
Confirmed by direct `grep -ri electron package.json package-lock.json` —
zero matches.

## 2. Whether Electron already exists

**No.** Neither `package.json`/`package-lock.json` nor `node_modules`
(fresh `npm install` in this worktree) contains any Electron reference.
Per this Arc's own instruction: "If Electron is not currently installed:
do not add it automatically... implement the complete host abstraction
and an in-process reference host... use an honest partial completion
title." This Arc therefore implements the full host abstraction plus
`FedosDesktopHostBridge` (the in-process reference host named in this
Arc's own Phase E) and stops exactly at the Electron dependency boundary.

## 3. Existing desktop executable entry points

`src/desktop/runtime/run_fedos_desktop_runtime.ts` (Alpha 613) — the ONE
existing process-boundary precedent in this codebase. Owns `process`
directly: CLI-flag config, `startFedosDesktopRuntime()`, SIGINT/SIGTERM
listeners, graceful `runtime.stop()` wait, `process.exit(1)` only on
startup failure. Operates on the RAW `FedosRunningDesktopRuntime` handle —
predates the Shell/Presentation/Renderer stack entirely, and its own
header states it is "never imported by any other `src/` file." This Arc's
new Host is a SEPARATE, parallel, higher-level concern (Runtime → Shell →
ViewModels → Renderer, not Runtime alone) — it does not import, modify, or
get imported by this file.

**Naming collision check** (required before introducing "Host"-named
types): `src/desktop/host/fedos_desktop_host.ts` already exports a class
literally named `FedosDesktopHost` — a Board-domain concept entirely
unrelated to this Arc's own "Desktop Process Host." This Arc's own new
types therefore live under a NEW directory, `src/desktop/host_boundary/`,
and are named `FedosDesktopHostPort` (the abstract port) and
`FedosDesktopHostBridge` (the in-process reference implementation, using
this Arc's own explicitly-named term) — never reusing the bare
`FedosDesktopHost` name.

## 4. Existing Runtime build configuration

`tsconfig.runtime.json` (`npm run build:runtime`) compiles the Runtime
entry point to `dist/`. No build config exists for a "desktop host" of any
kind (Electron main/preload/renderer bundles, etc.) — none is added by
this Arc (Absolute Prohibitions: no Electron dependency without explicit
authorization).

## 5. Shell lifecycle (unchanged, reused)

`FedosDesktopApplicationShell.create()` (no side effect) →
`start(config)` (constructs one `FedosRunningDesktopRuntime`) → real
methods while running → `stop()` (idempotency: a second `stop()` returns
`{outcome:"unavailable"}`, never throws). Every method before `start()`/
after `stop()` fails closed to `{outcome:"unavailable"}`.

## 6. ViewModel lifecycle (unchanged, reused)

Each of the ten ViewModels under `src/desktop/presentation/` is
constructed with (and holds) exactly one `FedosDesktopApplicationShell`
reference; starts `"idle"`; each action method sets `"loading"`
synchronously, then resolves to `"loaded"`/`"error"` from the Shell's own
result. `FedosDesktopConversationUiPresentationBoundary` owns exactly one
Shell and one of each ViewModel.

## 7. Renderer inputs and outputs (unchanged, reused)

`FedosDesktopRenderer` is constructed from one
`FedosDesktopConversationUiPresentationBoundary`; each of its eight
content renderers' `render()` method reads ONLY a ViewModel's already-
public getters (`.state`, `.query`, `.body`, ...) and returns a closed,
frozen, JSON-serializable `FedosDesktopRenderModel<T>` — `{kind:"idle"} |
{kind:"loading"} | {kind:"error",outcome,message} |
{kind:"content",content}`. Confirmed side-effect-free (calls no ViewModel
action method).

## 8. Safe versus sensitive render fields

Every `FedosMessageView`/`FedosConversationDetailView`/etc. field already
excludes secret material (see Alpha 2841-2920/3081-3160's own "no read
receipt, no crypto handle" guardrails) — the Renderer's own output is
therefore ALREADY safe to cross a process boundary unmodified. The ONE
additional Host-layer concern: `FedosContentAccessorArchiveCommand`'s
`export`/`restore` request shapes carry `localAccountIndex`/
`counterpartyPublicKeyHex` (public key material, not secret, but still a
raw parameter this Arc's own Phase H flags for caution) — addressed by
this Arc's own command vocabulary deliberately EXCLUDING archive
export/restore/list/verify (see Phase H below).

## 9. Existing process-boundary or IPC precedent

None beyond `run_fedos_desktop_runtime.ts` (item 3), which carries no
command/response vocabulary of any kind (it is a bare CLI, not an
interactive host). This Arc introduces the FIRST closed command/response
vocabulary in this codebase.

## 10. Filesystem path/config ownership

`FedosDesktopRuntimeConfig` requires every log path as an explicit,
caller-supplied string — no default, no `cwd`-relative path (Alpha 604,
unchanged). The Host inherits this discipline unmodified: it accepts a
caller-supplied `FedosDesktopRuntimeConfig` to `start()`, never invents or
defaults a path itself, and (Phase H) never accepts a raw filesystem path
from a `dispatch()` command payload without going through the SAME
`FedosDesktopArchiveViewModel`/Shell `archive()` validation Alpha 3081-3160
already established.

## 11. Current shutdown behavior

`FedosRunningDesktopRuntime.stop()` already stops in reverse construction
order (delivery → transport → production-crypto clear → Host, Alpha 606's
own documented sequence). `FedosDesktopApplicationShell.stop()` calls it
once. This Arc's own Host mirrors the identical discipline one layer out:
stop Renderer-adjacent state (none owned) → Presentation Boundary (no
explicit stop needed, it owns no resource of its own beyond the ViewModels'
in-memory fields) → Shell.stop() (which stops the Runtime) — i.e. exactly
ONE real stop call, `shell.stop()`, since the Presentation Boundary and
Renderer own no independent resource to release.

## 12. Expected production files

New directory `src/desktop/host_boundary/`:
- `fedos_desktop_host_port.ts` — the abstract port + lifecycle state type.
- `fedos_desktop_host_command.ts` — closed command union + validation.
- `fedos_desktop_host_response.ts` — closed response vocabulary.
- `fedos_desktop_host_bridge.ts` — `FedosDesktopHostBridge`, the in-process
  reference implementation.

New test file `test/secure_runtime_alpha_3561_3640_host_bridge.test.ts`.

No existing file is modified.

## 13. Baseline failures in this worktree

`npm run typecheck` — clean except the one pre-existing, unrelated,
already-documented failure (`secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts`).
Full `npm test` baseline matches Alpha 3401-3480's own final count/file set
exactly (confirmed before any production edit this Arc — see §Verification
in the completion declaration).

## 14. Execution plan

**Full completion of the in-process host boundary** (Phases B–D, F–I),
**honest partial completion of Phase E** (no Electron IPC — the repository
has no accepted Electron dependency, confirmed above). Commit title uses
this Arc's own prescribed partial-completion form.
