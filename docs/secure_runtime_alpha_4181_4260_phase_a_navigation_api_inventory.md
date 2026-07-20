# Secure Runtime Alpha 4181–4260: Desktop Conversation Window and Navigation Arc — Phase A: Navigation API Inventory

Verified against actual checked-out source, not documentation. Base: `arc/node-type-isolation` (722e6b1), the only branch in this repository where the full desktop stack is integrated in one place — **not** `master` (3eb9ead), whose `src/desktop/` contains only `host/`+`runtime/` and has no Shell, Presentation, Renderer, Host Boundary, or Electron package at all. This worktree (`arc/desktop-conversation-window-navigation`) branches from `arc/node-type-isolation`.

## Preconditions — verified against source

| Layer | Exists? | Where |
| --- | --- | --- |
| Desktop Runtime | Yes | `src/desktop/runtime/fedos_desktop_runtime.ts` (`startFedosDesktopRuntime`) |
| Desktop Shell | Yes | `src/desktop/shell/fedos_desktop_application_shell.ts` |
| Presentation Boundary | Yes | `src/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.ts` |
| Renderer Boundary | Yes | `src/desktop/renderer/fedos_desktop_renderer.ts` |
| Desktop UI Renderer | Yes | `src/desktop/renderer/*` (8 content renderers + shared render-model helpers) |
| Desktop Conversation UI | Yes | `src/desktop/presentation/*` (10 ViewModels) + `src/desktop/renderer/*` |
| **Electron Host Adapter** | **Honest partial** | `packages/fedos-desktop-electron-spike/` exists and is real (Electron 43.1.1 installed, real `BrowserWindow`, secure config, 26/26 tests passing) — but it is explicitly **Package A only**: no `ipcMain`/`FedosDesktopHostBridge` wiring exists anywhere (test #13 in its own suite asserts "no business IPC channel exists"). Alpha 4021-4100's own Completion Declaration recommends "Electron Main/Preload Adapter for `FedosDesktopHostBridge` Arc" as the very next arc — that arc has not happened. `FedosDesktopHostPort`/`FedosDesktopHostBridge` (`src/desktop/host_boundary/`) are real and ready to be adapted, but no concrete Electron implementation of that port exists yet. |

This arc closes that gap itself in Phase E (below), as a **new, additive** sibling implementation of `FedosDesktopHostPort` — never modifying the existing Package A spike files, per that package's own documented boundary.

## Reusable APIs

- `FedosDesktopHostPort` / `FedosDesktopHostBridge` (`src/desktop/host_boundary/`) — `status()/start()/stop()/dispatch()/render()`, already serializes concurrent commands through one queue. The natural seam for an Electron main-process adapter.
- `FedosDesktopConversationUiPresentationBoundary` (`src/desktop/presentation/`) — owns one Shell, exposes 10 ViewModels (`conversationList`, `conversationDetail`, `messageList`, `composeMessage`, `reply`, `search`, `archive`, `membership`, `unreadCounter`, `runtimeStatus`). `create()` factory; `.shell` getter present (documented as test-only, but exported and usable — see Multi-Window Finding below).
- `FedosDesktopRenderer` (`src/desktop/renderer/`) — one content renderer per ViewModel, each a thin `fedosRenderModel(vm.state, mapFn)` projection. `fedosRenderModel`/`fedosRenderList` (`fedos_desktop_render_model.ts`) are pure, stateless, independently reusable.
- `FedosDesktopConversationListViewModel` / `FedosDesktopConversationDetailViewModel` classes themselves are exported and independently constructible over any `FedosDesktopApplicationShell` instance — not just the one instance the Presentation Boundary already owns.
- `FedosConversationSummaryView` / `FedosConversationDetailView` / `FedosConversationMembership` (shell view-model types) carry everything needed for a title (`mode`, `memberships[].participant.publicIdentifier`).
- Electron: `packages/fedos-desktop-electron-spike/` — Electron 43.1.1 + electron-builder, real binary already installed and verified launchable in this environment; secure `BrowserWindow` baseline (contextIsolation/nodeIntegration/sandbox/webSecurity, `will-navigate` denied, window-open denied, permissions denied) to replicate for a second window/adapter, not redesign.
- Persistence convention: every domain in this repository (Board/Outbox/Conversation/Envelope/Membership/...) owns its own single-purpose `AppendOnlyFedos*Persistence` NDJSON log class (own file, own record shape, insert-only, replay-on-read, fail-closed on corruption) — no shared generic engine exists to reuse structurally, but the *pattern* is the established, repeated "persistence engine" this repository already uses for every new feature. Navigation state persistence (Phase C/G "Navigation state persistence") follows this exact pattern rather than introducing a new kind of engine.

## Missing APIs (this arc must add, narrowly)

- No Conversation Window Controller / navigation orchestration of any kind exists.
- No navigation state vocabulary (open/close/switch/history) exists.
- No multi-window state model exists — `FedosDesktopApplicationShell`/`FedosDesktopConversationUiPresentationBoundary` are explicitly single-Shell-instance-per-process; their existing ViewModels hold one shared `#state` each, which is safe for one caller but **not** safe for two windows viewing two different conversations simultaneously if they read the shared ViewModel's `.state` getter after the fact.
- No window title generation, pin state, recent-conversation list, or navigation-state persistence exists.
- No Electron `ipcMain`/preload wiring to `FedosDesktopHostBridge` exists (see Electron Host Adapter row above).

## Honest blocker and its resolution — multi-window vs. single-shared-ViewModel state

`FedosDesktopConversationDetailViewModel.load(id)` is `async` but has no internal `await` — its body runs to completion synchronously before the returned Promise settles, and (independently) `FedosDesktopHostBridge.dispatch()` already serializes every command through one queue. So two windows calling `load()` back-to-back never interleave mid-call. The unsafe part is only ever reading the ViewModel's own `.state`/`.conversationId` getters *later*, after a different window has since called `load()` again — that is genuinely last-write-wins and unsafe for simultaneous multi-window use.

Resolution adopted (Phase B): each `FedosDesktopConversationWindowController` owns its **own** `FedosDesktopConversationDetailViewModel` / `FedosDesktopConversationListViewModel` / matching `FedosDesktopRenderer`-family renderer instances, all constructed over the Presentation Boundary's own single `.shell` — never a second Shell, never a second Runtime, never a Shell method bypassed. This is the one deliberate, narrow use of `.shell` outside the Boundary's own constructor in this codebase; it constructs *more instances of the exact same already-reviewed ViewModel/Renderer classes*, adding no business logic and duplicating no rendering logic (Phase D). Each window's controller then only ever reads state it captured from its **own** `load()`/`render()` calls — never the shared Boundary-owned ViewModel instances, which remain reserved for single-window/back-compat callers exactly as before.

## Recommended next Arc (stated up front, per this arc's own instructions)

**Desktop Notifications, Tray, and Background Operation Arc** (as this arc's own brief already names) — once real Window/Navigation lifecycle exists, unread/notification-worthy events have somewhere to route to (raise/focus a specific window on a specific conversation) and a tray icon has real windows to show/hide.
