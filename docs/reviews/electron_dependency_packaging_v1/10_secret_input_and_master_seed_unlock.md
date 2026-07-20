# 10. Secret Input and Master Seed Unlock

## The known gap, restated honestly

`FedosMasterSeedAuthority` (`src/runtime/master_seed/fedos_master_seed_authority.ts`)
already defines `isAvailable()`/`isCleared()`/`generate()`/
`restoreSealed(envelope, passphrase)`/`seal(passphrase)`/`clear()`/
`resolveConversationKey()` — a real, complete API for unlocking/sealing a
Master Seed given a passphrase as raw bytes. **No layer above it —
Runtime, Shell, ViewModel, Renderer, or Host — has ever implemented a way
for a human to actually TYPE that passphrase in.** Every test across every
Arc in this lineage injects an already-unlocked or already-configured
`FedosMasterSeedAuthority` (real or fake) — none of them exercises a real
passphrase-entry flow, because none exists. This review confirms, rather
than works around, this gap.

## What Electron can and cannot provide

- **Native secure prompt** — Electron's own `dialog` module provides
  message boxes and file pickers, **not** a secure/masked text-entry
  dialog. There is no Electron-built-in equivalent of a native OS
  password prompt. This option is **not actually available** the way it
  might be assumed to be.
- **Renderer form through preload** — realistic and available: a
  `<input type="password">` in the (not-yet-built) renderer page,
  submitted via one dedicated IPC command (e.g. a NEW `"unlock"` command
  this review does NOT add to the existing 14 — see `06`) to main
  process, which passes the raw bytes directly to
  `resolveSealed()`/`resolveConversationKey()` and never logs, echoes, or
  persists them. The passphrase transits the IPC boundary in memory only,
  once, for the duration of one call — acceptable PROVIDED it is never
  serialized to disk/log (already this stack's own standing rule, `16`).
- **OS credential store** — Windows Credential Manager/DPAPI. This
  repository ALREADY has a real, adjacent capability:
  `src/runtime/fedos_runtime_storage_backend_windows_dpapi.ts`/
  `fedos_windows_dpapi_helper.ts` (a genuine, existing DPAPI-backed
  storage backend, confirmed present). This does not eliminate the need
  for an initial passphrase (DPAPI protects a WRAPPED secret at rest
  under the current OS user account, it does not replace "the user must
  authenticate somehow") but is a real, already-present building block a
  future unlock design could reuse — this review does not design that
  integration, only names that the primitive already exists.
- **Environment/stdin fallback** — viable for the existing CLI
  (`run_fedos_desktop_runtime.ts`), which already reads no secret today
  (`deliveryEnabled` is always `false` there) — not appropriate for a
  windowed GUI application, where a user expects an in-app prompt, not a
  terminal.

## This review does not invent a secure keychain integration

No new cryptographic design, key-wrapping scheme, or OS-keychain adapter
is specified here. This document's only job is naming the real, current
gap and the realistic (not assumed) shape of Electron's own contribution
to closing it.

## The blocker, named honestly

**No secure passphrase-input boundary exists anywhere in this stack
today**, in ANY layer, under ANY host technology. This is independent of
the Electron-vs-Tauri-vs-other decision (`20`) — whichever technology is
chosen, a NEW, dedicated ViewModel + Renderer + Host command for
unlock/passphrase entry must be designed and built before Archive
export/import or interactive production-crypto activation can be used by
a real human, not merely by a test injecting an already-configured
Authority. This is a real, separate, unresolved piece of future work,
named here rather than silently assumed solved by "just add Electron."
