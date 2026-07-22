# 05. Main/Preload/Renderer Process Model

The minimum accepted split, IF Electron is adopted (`20`) — specification
only, nothing implemented.

## Main process

Owns: window lifecycle (`BrowserWindow` create/close/quit-coordination),
exactly one `FedosDesktopHostPort` implementation (either
`FedosDesktopHostBridge` reused as-is, or a thin Electron-specific
sibling implementing the SAME interface — no redesign either way),
`ipcMain.handle` registration for the ONE closed channel (`06`).

## Preload

A single script, run in an isolated context
(`contextIsolation: true`, `08`), exposing via `contextBridge.exposeInMainWorld`
an allowlisted, NAMED-method object mirroring `FedosDesktopHostPort`'s own
public surface (`status`/`start`/`dispatch`/`render` — never `stop`
exposed to a renderer directly; window-close should map to the SAME
lifecycle main process already coordinates, `07`). No `require`, no raw
`ipcRenderer`, no generic `invoke(channel, payload)` passthrough (`06`).

## Renderer page

Pure presentation, consuming the allowlisted preload API and rendering
`FedosDesktopRenderModel<T>` output. NOT designed or implemented by this
review (`19`'s own Package C) — a UI-design decision explicitly out of
this review's scope.

## Runtime ownership location

Main process ONLY — unchanged from today (`FedosRunningDesktopRuntime` is
already never reachable from outside `FedosDesktopApplicationShell`,
Alpha 2841-2920's own guardrail, unmodified).

## Host ownership location

Main process ONLY.

## Shell/ViewModel/Renderer location

ALL remain in the main process, unchanged. None of the three touches a
DOM/browser API (confirmed, `01`) — there is no reason to move them into
the renderer process, and doing so would cross persistence/Shell state
across the process boundary unnecessarily, the opposite of this stack's
own "narrow boundary" design. Only the FINAL, already-serialized
`FedosDesktopHostResponse<T>` output crosses into the renderer.

## Serialization boundary

Exactly at the preload/`ipcMain.handle` seam — using the EXISTING
`FedosDesktopHostResponse<T>`/command vocabulary verbatim (`06`/`07`),
already JSON-safe, already tested. No new serialization format is
invented by this review.
