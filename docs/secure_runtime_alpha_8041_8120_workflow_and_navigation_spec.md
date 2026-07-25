# Secure Runtime Alpha 8041-8120 — Workflow and Navigation Specification

## Canonical shell

One `<section id="screen-ready">` hosts the primary navigation bar
(`#app-nav`) and one content area (`#app-content`) containing 7
`.app-screen` panels, switched by `showAppScreen(name)`
(`fedos_electron_beta_renderer.ts`). Exactly one BrowserWindow, one preload,
one Desktop Runtime generation — unchanged from before this Arc.

```
screen-ready
├── app-nav: Conversations | Search | Archive | Devices | Safety Center | Settings | Lock | Quit
└── app-content
    ├── app-screen-conversations  (list + invite form)
    ├── app-screen-chat           (message list + composer)
    ├── app-screen-search
    ├── app-screen-archive        (export + restore)
    ├── app-screen-devices
    ├── app-screen-safety         (sections + Identity Replacement inbox + Signed Deletion inbox)
    └── app-screen-settings       (Relay list + preferences)
```

Identity Replacement and Signed Deletion live as inboxes nested inside
Safety Center (mission's own recommended placement), not as separate
top-level nav items.

## Navigation rules

- `showAppScreen()` clears `aria-current` on every nav button, sets it on
  the active one, and stops the chat background poll whenever the target
  screen is not `chat` (Phase G "no hidden background polling" beyond one
  open screen).
- Opening a conversation always: loads detail → activates the Direct
  session (a real, per-Runtime-lifetime precondition, not fabricated) →
  loads messages → starts the 2-second poll.
- Locking (`onLock()`) stops the poll before locking, so no request fires
  against a nulled Runtime.

## Per-workflow command map (`window.fedosApp`)

| Screen | Real command(s) | Real Shell/Boundary target |
|---|---|---|
| Conversations list | `conversationsList()` | `boundary.conversationList.load()` |
| Invite | `createInvitation()` | `shell.createConversationInvitation()` |
| Chat open | `conversationOpen()`, `conversationActivate()`, `messagesList()` | `boundary.conversationDetail`, `shell.activateDirectConversation()`, `boundary.messageList` |
| Chat reveal | `messageReveal()` | `boundary.messageList.reveal()` → `shell.readMessage()` |
| Chat send | `messageSend()` | `boundary.composeMessage.send()` → `shell.sendMessage()` |
| Search | `search()` | `shell.search()` |
| Archive export | `archiveChooseExportDestination()`, `archiveExport()` | native `dialog.showSaveDialog`, `shell.archive({operation:"export"})` |
| Archive restore | `archiveChooseSource()`, `archiveInspect()`, `archiveRestore()` | native `dialog.showOpenDialog`, `shell.archive({operation:"inspect"|"restore"})` |
| Devices | `devicesList()`, `deviceRevoke()` | `shell.devicesList()`, `shell.deviceRevoke()` |
| Identity Replacement | `identityTransitionList()`, `identityTransitionOpen()`, `identityTransitionAccept/Reject/Defer()` | `boundary.identityTransitions.*` |
| Signed Deletion | `deletionRequestListReceived()`, `deletionRequestOpen()`, `deletionRequestApprove/Reject()` | `boundary.deletionRequests.*` |
| Safety Center | `safetyCenterOverview()` | `boundary.safetyCenter.refreshOverview()` |
| Settings | `settingsLoad()` (new), `fedosBeta.settingsApply()` (existing) | `FedosDesktopSettingsController`, `FedosDesktopSettingsApplicationCoordinator` |

Every one of these is registered unconditionally in `registerIpcHandlers()`;
the security boundary is each handler's own `requireShell()`/
`requireBoundary()`/`activeAssembly === null` runtime check, matching every
pre-existing channel's own discipline.
