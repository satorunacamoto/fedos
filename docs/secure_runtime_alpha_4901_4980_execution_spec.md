# Secure Runtime Alpha 4901-4980 — Execution Spec (Phase-by-Phase)

Base commit `2f591cb`. Branch
`arc/desktop-settings-relay-configuration-user-preferences`. See
`secure_runtime_alpha_4901_4980_completion_declaration.md` for the honest
completion/blocker statement and verification.

**Architecture frozen / additive only.** No Runtime, Persistence-mechanism,
Crypto, Search, Archive, Device-Sync, or Conversation-Runtime source was
modified. Zero existing production source file was changed. The only edits to
existing files are additive registrations: root `package.json` (one new build
+ one new start script), the electron-spike `package.json` (one start
script), its `tsconfig.json` / `tsconfig.browser-scripts.json` (new browser
script + ambient d.ts registered), its `copy_static_assets.mjs` (one page
copied), plus `README.md`. Everything else is NEW files.

## Phase A — Inventory (real source, not docs)

Read the real `.ts`/`.cts` sources of Desktop Shell, Renderer, Host Boundary
(`fedos_desktop_host_command.ts` / `_response.ts` / `_port.ts` / `_bridge.ts`),
Navigation, Notification, Badge, Device-Sync presentation, Production Unlock
(`fedos_electron_unlock_*`), and the Electron adapters. **Finding: no settings
mechanism exists.** No `src/settings/`, no settings ViewModel/renderer/
controller, zero `settings` in the host command union, no settings Electron
adapter. The two incidental `settings` string hits in `src/community/policy.ts`
and `src/nearby/types.ts` are unrelated domains. The file-backed persistence
pattern to reuse is `FileFedosLocalProfilePersistence`
(`src/desktop/onboarding/`): one JSON file, synchronous `fs`, fail-closed
`read()` that throws on corruption, `mkdirSync(dirname,{recursive:true})`
before write, deterministic canonical codec, deep-frozen values.

## Phase B — `src/settings/` (framework-neutral domain core)

- `fedos_settings_descriptor.ts` — `FedosSettingsDescriptorV1` (the closed
  11-key shape), the closed vocabularies (`FedosSettingsTheme` /
  `FedosSettingsLanguage` / `FedosSettingsWindowLayout`), structural bounds,
  the canonical `defaultFedosSettingsDescriptorV1()`, and pure `withFedosSettings`
  patch application. Deep-frozen; no secret field.
- `fedos_settings_validator.ts` — `isWellFormedFedosSettingsDescriptorV1` +
  `fedosSettingsValidationErrors` (closed error-code vocabulary). Exact
  key-count check rejects any free-form/unknown key; every field checked
  against its closed vocabulary/bound; cross-field invariants (`defaultRelay`
  ∈ `relays` or empty, no duplicate relays, every relay a bounded `ws(s)://`
  URL). Never throws.
- `fedos_settings_codec.ts` — deterministic `encode` (fixed key order) +
  fail-closed `decode` (`null` on any malformed input). Mirrors the profile
  codec exactly.
- `fedos_settings_persistence.ts` — `FedosSettingsPersistence` port +
  `InMemoryFedosSettingsPersistence` (tests) + `FileFedosSettingsPersistence`
  (one JSON file, REUSING the profile file-backed pattern). The ONE
  intentional difference from the write-once profile port: settings are
  user-editable, so this port exposes an overwriting `write()` (upsert); a
  corrupt file throws `FedosSettingsCorruptError`; there is NO delete method.
- `fedos_settings_authority.ts` — `FedosSettingsAuthority`: `load` (default on
  first run, `corrupt` on tampered file — never a silent default), `save`
  (validate-then-write, invalid writes nothing), `reset`, `validate`,
  `export`, `import`. Closed `FedosSettingsResult<T>` outcomes; never throws.

## Phase C — Closed vocabulary only

Exactly the Phase C fields: Theme, Language, Relay List, Default Relay,
Notification Enabled, Background Sync Enabled, Archive Directory, Auto Start,
Auto Lock Timeout (minutes; `0` = never), Window Layout — plus `schemaVersion`.
No free-form key/value anywhere; the validator's exact-key-count check rejects
extras.

## Phase D — `FedosDesktopSettingsController`

`src/desktop/settings/fedos_desktop_settings_controller.ts` — the desktop-facing
controller over the authority, exactly the six operations Phase D names
(`load`/`save`/`reset`/`validate`/`export`/`import`), one-for-one delegation,
no business rule of its own. `createFileBackedFedosDesktopSettingsController`
(real durable) / `createInMemoryFedosDesktopSettingsController` (transient).
`fedosDesktopSettingsFilePath(root)` derives a deterministic `settings.json`
leaf (additive; does not modify `fedos_local_profile_paths.ts`).

## Phase E — Presentation

- `src/desktop/presentation/fedos_desktop_settings_view_model.ts` —
  `FedosDesktopSettingsViewModel`: delegates to the controller, holds the
  shared `FedosDesktopViewModelState<T>`, tracks the local (non-durable)
  active screen. The eight closed screens (General / Appearance / Relay /
  Notification / Privacy / Archive / Advanced / About).
- `src/desktop/renderer/fedos_desktop_settings_renderer.ts` —
  `FedosDesktopSettingsRenderer`: pure projection of the ViewModel state onto
  the shared `FedosDesktopRenderModel<T>`, one per-screen field group each.

## Phase F — Closed Host Bridge command set

- `src/desktop/settings/fedos_desktop_settings_host_command.ts` — the CLOSED
  five-command vocabulary: `settings-load` / `settings-save` /
  `settings-reset` / `settings-export` / `settings-import`, structural
  validation only, fail-closed to `null`. Nothing else.
- `src/desktop/settings/fedos_desktop_settings_host_bridge.ts` —
  `FedosDesktopSettingsHostBridge`: REUSES the unmodified `FedosDesktopHostResponse`
  vocabulary; a SEPARATE bridge from the conversation `FedosDesktopHostBridge`
  (settings are independent of the running conversation Runtime). Never throws.

## Phase G — Electron Adapter (preload-only)

New sibling files in `packages/fedos-desktop-electron-spike/src/`:
`fedos_electron_settings_preload.cts` (one frozen `window.fedosSettings.invoke`,
no `ipcRenderer`/`require`/fs), `fedos_electron_settings_dispatch_translation.ts`
(no Electron import; unit-testable), `fedos_electron_settings_host_bridge_loader.ts`,
`fedos_electron_settings_main.cts` (secure defaults: `contextIsolation:true`,
`nodeIntegration:false`, `sandbox:true`, `webSecurity:true`, `loadFile` only,
new-window/navigation/permission denied; FIXED settings path under
`userData`), `fedos_electron_settings_page.html` (strict CSP),
`fedos_electron_settings_selftest.ts`, `fedos_electron_settings_window.d.ts`.
`tsconfig.settings-host-bridge.json` + `build:settings-host-bridge` compile the
controller + bridge to `dist/desktop/settings/`, the exact paths the loader
imports. The renderer never touches a Node API directly.

## Phase H — Acceptance (real runtime, no mocks)

`test/secure_runtime_alpha_4901_4980_desktop_settings.test.ts` (31 tests) drives
the REAL file-backed stack against REAL temp-directory JSON files: first load,
save, restart (fresh controller on the same file), restore, relay change, theme
change, notification change, reset, export, import, corrupted file, unknown
key, version mismatch, validation error, fail-closed, tampered JSON — plus the
closed host command vocabulary, the ViewModel/Renderer projection, and the
Electron dispatch translation. No mocks; the "runtime" is the real
authority/controller/persistence.

## Phase I — Regression

Full root `vitest run` re-run and A/B-compared against the pre-change baseline
(identical pre-existing fresh-worktree failure set). Electron adapter typecheck
(`typecheck:electron`) green. See the completion declaration for the numbers
and the honest Electron-binary environment note.

## Phase J — Documentation

This spec, the completion declaration, and the README entry (prepended,
newest-first).
