# 09. Filesystem Authority

## Current state (real, already implemented)

`archive-inspect`'s own `sourcePath` is validated by
`isSafeArchivePath()` (`fedos_desktop_host_command.ts`): non-empty,
bounded length (4096 chars), and no `".."` path segment on either
separator — rejected BEFORE the real
`FedosConversationArchiveFileAuthority`'s own (separate, already-real)
filesystem checks are ever reached. This is a **validated caller path**
model: the caller (today, a test; eventually, a renderer via IPC) supplies
an arbitrary string, and the Host rejects an unsafe SHAPE of string — it
does not verify the string was ever genuinely chosen by the user via any
OS-mediated mechanism.

## Options compared

- **Validated caller path (current)** — narrow (rejects traversal/
  oversized input), but the string itself could still be anything the
  caller/renderer composes (e.g. a plausible-looking but wrong absolute
  path); no OS-level proof a human actually picked it.
- **Native file picker result** — `dialog.showOpenDialog()`/
  `showSaveDialog()`, invoked ONLY in the main process (never exposed to
  the renderer as a callable-with-arbitrary-defaults API), returning a
  path the OS itself already mediated the user's selection of. This is
  strictly stronger than the current model: the renderer never supplies
  or even sees a raw path string it invented itself — it only ever
  receives back what `dialog.showOpenDialog()` returned.
- **Capability-style selected path** — main process maps an opaque token
  to a path (never exposing the path itself to the renderer at all,
  only the token, for a subsequent "use this file" command). Strongest
  model; also the most implementation work (a token registry, and every
  Archive command has to accept a token instead of a path).
- **Unrestricted path string** — rejected outright; strictly weaker than
  the CURRENT (already-implemented) model, never acceptable.

## Recommendation

**Native file picker result** is the narrowest safe model that is also
proportionate to this stack's own actual needs (`02`'s "filesystem
access" requirement is real but narrow — Archive inspect/export/restore
only, never a general file browser). The capability-token model is more
restrictive than this need calls for and would add complexity (a token
registry, token lifecycle/expiry) this review does not see evidence for.

Until Electron (or any window/dialog-capable host) exists, the CURRENT
validated-path-string-with-traversal-check model remains the best
available interim and should NOT be weakened — it is already real,
already tested, and already strictly safer than accepting an unrestricted
string.
