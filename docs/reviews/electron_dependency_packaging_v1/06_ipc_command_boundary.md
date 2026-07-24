# 06. IPC Command Boundary

Maps the EXISTING closed Host command vocabulary
(`src/desktop/host_boundary/fedos_desktop_host_command.ts`, 14 commands —
see `01`) onto a secure IPC design. Specification only.

## Design

- **One channel.** `ipcMain.handle("fedos-host:dispatch", (event, command) => hostPort.dispatch(command))`.
  Not one channel per command — a single closed entry point, matching this
  Arc's own already-adopted "one channel or closed channel set" rule
  literally (the single-channel end of that range).
- Preload exposes NAMED, per-command-shaped methods (e.g.
  `fedosHost.sendMessage(conversationId, sender, body)`,
  `fedosHost.searchConversations(query)`) that each construct the
  correctly-typed `FedosDesktopHostCommand` object internally and call the
  ONE channel above — never a raw `fedosHost.invoke(name, payload)`
  generic method exposed to renderer/page code.
- `validateFedosDesktopHostCommand()` (already real, already tested,
  Alpha 3561-3640) runs in the MAIN process, inside `dispatch()`, on
  every call — this is UNCHANGED by adding Electron; the renderer's own
  named preload methods are a convenience/ergonomics layer, never the
  actual trust boundary. A compromised/malicious renderer calling
  `fedosHost.sendMessage(...)` with attacker-controlled arguments still
  passes through the SAME real structural validation before touching any
  ViewModel.

## Explicitly rejected

- **Arbitrary channel names** — a renderer must never be able to invoke
  an `ipcMain` handler by a name it chooses; only the ONE registered
  channel exists.
- **Generic `invoke(command, any)` exposed to page code** — even though
  main-process validation still catches a malformed payload, exposing a
  fully generic method invites callers (including future, careless UI
  code) to bypass the named, intentional API shape and construct raw
  command objects by hand.
- **Raw object exposure** — no ViewModel, Shell, or Presentation Boundary
  object crosses into preload/renderer; only `dispatch()`'s own already-
  serialized `FedosDesktopHostResponse<T>` return value does (`07`).
- **Direct persistence access** — no persistence port is reachable from
  main-process Electron code any more than it is from the existing
  `FedosDesktopHostBridge` today (`14` of Alpha 3561-3640's own
  completion declaration already confirms zero such import).
- **Direct filesystem access from page code** — the renderer NEVER gets
  `fs`/`path`/`electron.remote`; `archive-inspect`'s own path-traversal
  validation (already real) is the ONLY filesystem-adjacent surface, and
  it stays in main process, reached only through the one command channel.
