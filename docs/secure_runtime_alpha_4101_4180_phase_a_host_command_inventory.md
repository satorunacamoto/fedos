# Secure Runtime Alpha 4101–4180 — Phase A: Host Command Inventory

Electron Main/Preload Adapter for FedosDesktopHostBridge Arc. Written
BEFORE any production edit in this worktree, per this Arc's own
instruction to verify source, not documentation alone.

## Base and reconciliation

Worktree `C:\wt\electron-host-adapter`, branch `arc/electron-host-adapter`,
created from `arc/desktop-device-sync-ui` @ `3f32e6e` (the fullest
existing Desktop UI + Device Sync + Device Management lineage) and merged
with `arc/node-type-isolation` @ `722e6b1` (the Electron Build Spike +
Node Type Isolation lineage) via `git merge --no-ff`. Merge-base: `7b72a3e`.
`git diff --name-only` from that merge-base on each side showed exactly
ONE overlapping file, `README.md` (the expected, purely mechanical
status-blurb-stacking conflict) — zero source-code overlap. Resolved as a
literal union (Electron lineage's newer blurb, Alpha 4021–4100, placed
above this branch's own newer blurb, Alpha 3941–4020, per
[[project-secure-runtime-arc-conventions]]'s "newest pushed to top" rule
applied to the one point of ambiguity a two-lineage merge introduces).

**Verified by source, not commit title alone** (per this Arc's own
Preconditions instruction):

- Desktop Runtime: `src/desktop/runtime/fedos_desktop_runtime.ts` — present, compiles.
- Desktop Shell: `src/desktop/shell/fedos_desktop_application_shell.ts` — present.
- Presentation Boundary: `src/desktop/presentation/fedos_desktop_conversation_ui_presentation_boundary.ts` — present, including the `deviceManagement` property (Alpha 3941-4020).
- Renderer Boundary: `src/desktop/renderer/fedos_desktop_renderer.ts` — present, including `.deviceManagement`.
- Desktop Host Bridge: `src/desktop/host_boundary/fedos_desktop_host_bridge.ts` — present (Alpha 3561-3640).
- Electron Build Spike: `packages/fedos-desktop-electron-spike/src/fedos_electron_spike_main.cts` + `_preload.cts` — present (Alpha 3881-3940), a REAL Electron binary installs and a REAL subprocess launches (confirmed directly, see Phase F below).
- Node Type Isolation package: `packages/fedos-desktop-electron-spike/package.json`/`tsconfig.json`, physically isolated `node_modules`, root `tsconfig.json`'s own `"exclude": ["packages/fedos-desktop-electron-spike"]` — present (Alpha 4021-4100).

**Real gap found and closed by direct experimentation** (not present before
this Arc): there was no existing build path compiling
`FedosDesktopHostBridge`'s own transitive dependency graph (Presentation/
Renderer/Shell/Runtime/Device Sync/Conversation/etc.) into runnable JS
reachable from the physically-isolated Electron package. The existing
`tsconfig.runtime.json`/`build:runtime` targets a DIFFERENT, narrower
entry point (`run_fedos_desktop_runtime.ts`) that calls
`startFedosDesktopRuntime()` directly, bypassing Shell/Presentation/
Renderer/HostBridge entirely — confirmed by inspection, its own compiled
output contains no `host_boundary/` files. This Arc adds ONE new,
narrow root-level `tsconfig.host-bridge.json` (mirrors
`tsconfig.runtime.json`'s own exact shape, entry point
`fedos_desktop_host_bridge.ts` instead), confirmed by direct compilation
to emit the Host Bridge's full transitive graph (432 files) as valid ESM
(matching root `package.json`'s `"type": "module"`). A plain Node smoke
script (`pathToFileURL(...)` + dynamic `import()`) proved the compiled
Host Bridge runs correctly end to end (`start` → `dispatch` →
`render` → `stop`) BEFORE any Electron code was written against it — the
SAME dynamic-import technique the Electron main process (CommonJS `.cts`)
uses to load this ESM output at runtime, since a CommonJS module can
`await import(esmFileUrl)` natively in Node without any new dependency.

## Every Host command (`FedosDesktopHostCommand`, `fedos_desktop_host_command.ts`)

14 closed command types. For each: request shape, structural validation,
and the response `FedosDesktopHostBridge#dispatch()` produces.

| Command | Request fields | Validation | Real Shell/ViewModel call | Success value | Failure codes possible |
|---|---|---|---|---|---|
| `runtime-status` | `requestId?` | none beyond shape | `boundary.runtimeStatus.refresh()` | `{runtimeStatus, deviceStatus}` | `unavailable` |
| `device-status` | `requestId?` | none beyond shape | `boundary.runtimeStatus.refresh()` (device slice) | `FedosDeviceStatusView` (always `{state:"unavailable",reason}` on this base) | `unavailable` |
| `conversations-list` | `filter?`, `requestId?` | `filter` type-shape only, semantics owned by Shell | `boundary.conversationList.load(filter)` | `readonly FedosConversationSummaryView[]` | `unavailable` |
| `conversation-open` | `conversationId`, `requestId?` | id non-empty, ≤512 | `boundary.conversationDetail.load(id)` | `FedosConversationDetailView` | `unavailable`, `not-found` |
| `conversation-create-direct` | `command:{recipient,idempotencyKey?}`, `requestId?` | recipient authority in closed list, id bounded | `boundary.shell.createDirectConversation()` | `FedosConversationDetailView` | `conflict`, `invalid-input`, `unauthorized`, `failed`, `unavailable` |
| `conversation-create-group` | `command`, `requestId?` | object-shape only (Shell owns semantics) | `boundary.shell.createPrivateGroup()` | `FedosConversationDetailView` | same as above |
| `messages-list` | `conversationId`, `requestId?` | id bounded | `boundary.messageList.load(id)` | `readonly FedosMessageView[]` | `unavailable`, `not-found` |
| `message-reveal` | `conversationId`, `messageId`, `requestId?` | both ids bounded | `boundary.messageList.reveal(messageId)` | `FedosMessageView` | `unavailable`, `not-found` |
| `message-send` | `conversationId`, `sender`, `body`, `requestId?` | id bounded, sender authority closed, body ≤ `FEDOS_CONVERSATION_DIRECT_MESSAGE_MAX_BODY_LENGTH` | `boundary.composeMessage.setBody()`+`.send()` | `FedosMessageSendResultView` | `unavailable`, `invalid-input`, `requires-activation` |
| `message-reply` | `conversationId`, `sender`, `replyToMessageId`, `body`, `requestId?` | same as above + replyToMessageId bounded | `boundary.reply.startReplyTo()`+`.setBody()`+`.send()` | `FedosMessageSendResultView` | same |
| `membership-list` | `conversationId`, `requestId?` | id bounded | `boundary.membership.load(id)` | membership list view | `unavailable`, `not-found` |
| `invitation-descriptor` | `conversationId`, `issuer`, `requestId?` | id bounded, issuer authority closed | `boundary.membership.loadInvitations()` | invitation descriptor view | `unavailable`, `unauthorized` |
| `search` | `query` (≤500 chars), `requestId?` | length only | `boundary.search.setQuery()`+`.search()` | `readonly FedosContentAccessorSearchHit[]` | `unavailable` |
| `archive-inspect` | `sourcePath` (≤4096 chars, no `..` segment), `requestId?` | path-traversal-safe, bounded | `boundary.archive.inspect(sourcePath)` | archive inspection view | `unavailable`, `not-found`, `failed` |

**Device Sync / Device Management commands are DELIBERATELY ABSENT from
this vocabulary** — `FedosDesktopHostCommand` was closed at Alpha
3561-3640, before Alpha 3801-3880/3941-4020 existed, and no later Arc
extended it. Per this Arc's own explicit "Do NOT redesign the Host" /
"Only build the Electron adapter layer" instruction, this Arc does NOT
add Device Sync commands to the Host vocabulary — that would be
redesigning an accepted boundary, out of scope for a pure transport Arc.
The Electron adapter therefore only ever transports the 14 commands
above; Device Management remains reachable only through direct
TypeScript use of the Presentation/Renderer boundary (e.g. a future test
harness or a future Arc that explicitly extends the Host vocabulary).

## Closed failure vocabulary (`FedosDesktopHostDiagnosticCode`)

`"unavailable" | "unauthorized" | "not-found" | "invalid-input" |
"conflict" | "requires-activation" | "requires-unlock" | "unsupported" |
"failed" | "unknown-command"` — the LAST one, `"unknown-command"`, is
returned by `dispatch()` itself when `validateFedosDesktopHostCommand()`
returns `null` (malformed/unrecognized `type`, wrong-shaped/oversized
field, non-object candidate) — never a raw parse exception.

## `FedosDesktopHostPort` surface (the ONE interface this Arc adapts)

`status(): "stopped"|"running"`, `start(config): Promise<Response<null>>`,
`stop(): Promise<Response<null>>`, `dispatch(command: unknown):
Promise<Response<unknown>>`, `render(): Response<FullRenderModel>`. All
five already fail closed, never throw, already serialize
`Object.freeze`d, JSON-safe data (Alpha 3561-3640's own guarantee,
verified again directly in this Arc's own Phase E tests).

## Design decision: what the Electron adapter actually exposes

`start()`/`stop()` are Main-process-OWNED lifecycle calls only — invoked
once at `app.whenReady()` (with a fixed, main-process-determined config
under `app.getPath("userData")`, never renderer-supplied) and once at
`before-quit`/`window-all-closed` — NEVER reachable from the renderer.
Exposing `start()` to the renderer would mean accepting an arbitrary
`FedosDesktopRuntimeConfig` (board/outbox log **paths**) from untrusted
renderer content — an indirect filesystem-path exposure this Arc's own
Absolute Prohibitions forbid ("expose filesystem directly"). `dispatch()`
and `render()` (both read/mutate ONLY through the existing, already-
validated Shell/ViewModel graph, never a raw path) are the two operations
the single frozen `window.fedos.invoke(request)` API exposes, multiplexed
by one closed `{op:"dispatch",command}|{op:"render"}|{op:"status"}`
request shape — still "one frozen API," per Phase C's own instruction,
since the discriminator is DATA passed to the one exposed function, not a
second global.
