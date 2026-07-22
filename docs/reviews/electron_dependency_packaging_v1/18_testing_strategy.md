# 18. Testing Strategy

## Already done (unit-level, no Electron, real stack)

- **Pure Host tests** — `test/secure_runtime_alpha_3561_3640_host_bridge.test.ts`,
  17 tests, real `FedosDesktopHostBridge` over the real Runtime/Shell/
  ViewModel/Renderer stack. This review's own `security_boundary_invariants.test.ts`
  re-confirms the invariants these tests depend on still hold.
- **Startup/shutdown test** — already covered at the Host Bridge level
  (start/stop lifecycle, idempotent stop, no-orphan-state-on-failure).
- **Secret-leak tests** — already covered at the Host Bridge level (full-
  session JSON round-trip, no `Error`/stack/bearer-secret/ciphertext
  check).

## Future (Electron-specific, NOT built by this review)

- **Preload allowlist tests** — once a real preload script exists: assert
  the object exposed via `contextBridge` has EXACTLY the allowlisted
  method names, nothing else (no `require`, no raw `ipcRenderer`, no
  extra method).
- **Main-process IPC tests** — real `ipcMain.handle` wired to a real Host
  Bridge/Port implementation, exercised via Electron's own test-mode
  launch or a UI-automation tool with Electron support (e.g. Playwright's
  Electron integration) — neither exists in this repository today (`04`).
- **Renderer serialization tests** — assert every value crossing
  `contextBridge` is structured-clone-safe; can REUSE the existing
  `FedosDesktopHostResponse` JSON-safety test technique directly, no new
  design needed (`07`).
- **Packaging smoke test** — launch the actually-packaged app (portable
  build, `12`), confirm a window opens, confirm one real IPC round-trip
  succeeds, confirm a clean quit.
- **Filesystem sandbox test** — confirm the renderer process genuinely
  cannot read an arbitrary file (no `fs` exposed via preload).
- **A dedicated Electron-specific secret-leak/no-raw-Error sniff** — same
  assertions as the existing unit-level tests, but observing REAL IPC
  traffic rather than direct method calls.

## Unit tests vs. real packaged-app tests

**Unit** = everything already built and passing today: real Runtime, no
Electron, run under plain `vitest`. **Real packaged-app tests** require an
actual BUILT Electron binary plus a UI-automation tool — neither exists
in this repository; standing this up is real, additional tooling/CI cost
(`04`), separate from and in addition to the unit-level cost already
absorbed by this stack's existing test suite.
