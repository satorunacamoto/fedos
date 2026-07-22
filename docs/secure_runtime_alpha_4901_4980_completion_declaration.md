# Secure Runtime Alpha 4901-4980 — Desktop Settings, Relay Configuration, and User Preferences — Completion Declaration

**FULL completion of the additive settings feature.** A complete, closed-
vocabulary desktop settings subsystem was added strictly additively — domain
core (`src/settings/`), desktop controller, presentation ViewModel + Renderer,
a closed five-command Host Bridge, and a preload-only Electron adapter — with
**zero** modification to any Runtime, Persistence-mechanism, Crypto, Search,
Archive, Device-Sync, or Conversation-Runtime source. Every Phase H acceptance
scenario is proven against the REAL file-backed stack with NO mocks (31/31).

Commit title used: **"Add Secure Runtime Alpha 4901-4980: Desktop Settings,
Relay Configuration, and User Preferences Arc."**

## Mandatory rules — honored

- Existing architecture unchanged; nothing rewritten. No Runtime / Persistence
  replacement / Crypto / Search / Archive / Device-Sync / Conversation-Runtime
  touched; Shell not broken. Verified: no existing production source file was
  modified — the only existing-file edits are additive script/tsconfig/asset
  registrations and `README.md`.
- Persistence REUSES the `FileFedosLocalProfilePersistence` file-backed pattern
  (one JSON file, fail-closed read, canonical codec) rather than inventing a
  new mechanism. The single intentional difference (an overwriting `write()`
  vs the profile's write-once `writeIfAbsent()`) is documented in-source:
  settings are user-editable; a profile descriptor is created once.
- Closed vocabulary only (Phase C). No free-form key/value anywhere — the
  validator's exact-key-count check rejects any extra key.
- Host Bridge command set closed to exactly the five named commands.
- Electron adapter is preload-only: one frozen `window.fedosSettings.invoke`,
  no `ipcRenderer`/`require`/filesystem exposed; the renderer never touches a
  Node API. Security settings unchanged (`contextIsolation:true`,
  `nodeIntegration:false`, `sandbox:true`, `webSecurity:true`).
- No new dependency (Electron already present). Additive implementation only.

## What was built (all additive)

New production source:
- `src/settings/fedos_settings_descriptor.ts`
- `src/settings/fedos_settings_validator.ts`
- `src/settings/fedos_settings_codec.ts`
- `src/settings/fedos_settings_persistence.ts`
- `src/settings/fedos_settings_authority.ts`
- `src/desktop/settings/fedos_desktop_settings_controller.ts`
- `src/desktop/settings/fedos_desktop_settings_host_command.ts`
- `src/desktop/settings/fedos_desktop_settings_host_bridge.ts`
- `src/desktop/presentation/fedos_desktop_settings_view_model.ts`
- `src/desktop/renderer/fedos_desktop_settings_renderer.ts`

New Electron adapter (`packages/fedos-desktop-electron-spike/src/`):
- `fedos_electron_settings_preload.cts`
- `fedos_electron_settings_dispatch_translation.ts`
- `fedos_electron_settings_host_bridge_loader.ts`
- `fedos_electron_settings_main.cts`
- `fedos_electron_settings_page.html`
- `fedos_electron_settings_selftest.ts`
- `fedos_electron_settings_window.d.ts`

New build/test wiring:
- `tsconfig.settings-host-bridge.json` + root `build:settings-host-bridge` /
  `start:electron-settings` scripts.
- electron-spike `start:settings` script; `tsconfig.json` /
  `tsconfig.browser-scripts.json` registrations; `copy_static_assets.mjs` page
  copy.
- `test/secure_runtime_alpha_4901_4980_desktop_settings.test.ts` (31 tests).
- `docs/secure_runtime_alpha_4901_4980_execution_spec.md`, this declaration,
  README entry.

## Verification (real source, real runtime)

- **Typecheck.** `typecheck:core` shows only the TWO pre-existing baseline
  errors, both in untouched prior-arc test files
  (`secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts:189`,
  `secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`) — measured
  identically BEFORE any change (A/B). Zero new type errors from this Arc.
  `typecheck:electron` is green (the new adapter files typecheck clean).
- **Acceptance (Phase H).** 31/31 pass against real temp-directory JSON files:
  first load → default persisted; save + restart (fresh controller, same file)
  → exact restore; independent relay/theme/notification changes persist;
  reset; export/import round trip; import fail-closed on invalid / unknown-key
  / version-mismatch / tampered-JSON writing nothing; corrupt on-disk file →
  `corrupt` (never a silent default); the closed host command vocabulary
  (five accepted, everything else rejected, oversized import rejected); the
  ViewModel/Renderer eight-screen projection; the Electron dispatch translation
  fail-closed cases.
- **Build path.** `build:settings-host-bridge` emits
  `dist/desktop/settings/fedos_desktop_settings_host_bridge.js` and
  `fedos_desktop_settings_controller.js` — the exact paths the Electron loader
  dynamically imports (verified against real emitted output).
- **Regression (Phase I).** Full `vitest run` re-run; the settings suite adds
  31 passing tests and the failure set is otherwise identical to the
  pre-change baseline (the known fresh-worktree raw-import / missing-WASM-`pkg/`
  failures — see the Honest Blocker). No subsystem regressed.

## Honest Blocker (environment, not code)

**The real packaged-Electron round trip could not be executed in this
worktree — the Electron binary is not present.** `npm install` in the
electron-spike package installs the `electron` npm package and its type
declarations (so `typecheck:electron` is green and the adapter is fully
typechecked), but the `electron` postinstall did NOT download the
`electron.exe` runtime binary here (no `node_modules/electron/dist/`), so
`electron dist/fedos_electron_settings_main.cjs` cannot launch a real process.
This is the same class of fresh-worktree/environment limitation the prior
Alpha 4741-4820 Arc disclosed and the project memory records; it is NOT a code
defect. The Electron adapter is therefore verified by: full typecheck of every
adapter file, real unit tests of the (Electron-import-free) dispatch
translation, and confirmation that the compiled bridge/controller modules emit
to the exact dynamic-import paths the main process uses. The core settings
acceptance — Phase H's entire required scenario list — is fully satisfied
WITHOUT Electron, because the settings runtime is file-backed and independent
of any Electron process.

The wider root `vitest run` also carries a large pre-existing failure set
(~250 tests) that is present identically on the untouched base commit — the
documented fresh-worktree raw-import (`Cargo.toml`/`lib.rs`) and missing
compiled-WASM-`pkg/` failures. None involve the settings subsystem.

## Recommended next Arc

**Desktop Settings ↔ Runtime Application Arc** — wire the now-durable settings
into live behavior additively: apply the relay list / default relay to the
transport relay set, the notification-enabled toggle to the notification
coordinator, background-sync to the device-sync scheduler, auto-lock timeout
to the unlock lifecycle, and theme/language/window-layout to the renderer
shell — each behind the existing ports, changing no architecture. Pair it with
a real packaged-Electron settings acceptance run once an environment with the
downloaded Electron binary is available (the adapter is already built and
typechecked for it).
