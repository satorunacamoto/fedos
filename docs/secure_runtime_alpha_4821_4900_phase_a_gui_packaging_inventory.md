# Secure Runtime Alpha 4821-4900 — Phase A: GUI and Packaging Inventory

Phase A gate. This report was produced by direct inspection of real,
checked-out source and by REAL execution probes in THIS worktree
(`C:\wt\electron-real-unlock-gui`, branch
`arc/electron-real-unlock-gui-passphrase-boundary`, based at `68545db`),
BEFORE any production edit — per the spec's "Do not trust completion
declarations alone."

## Source reconciliation and ancestry (verified directly)

- `git log` confirms the ancestor chain `bda2c1f` (Alpha 4661-4740, First-Run
  Profile and Unlock Boundary) → `68545db` (Alpha 4741-4820, Production
  Desktop WASM Artifact and Unlock Activation Boundary). The worktree tip is
  `68545db`; the working tree was clean before the first edit.
- All named preconditions are REAL source, verified by reading them, not by
  trusting titles:
  - Real Rust/WASM Master Seed authority (`packages/fedos-core-rust`,
    `FedosMasterSeedAuthority` WASM class exposing `generate`/`seal`/
    `restore_sealed`/`clear`/`sign_nostr_event`/`public_key_hex_for_account`/
    `resolve_conversation_key`).
  - Production activation layer under `src/desktop/production_activation/`
    (activation authority, host attestation, pinned artifact manifest +
    verifier, capability-limited facade, production Master Seed authority,
    no-fallback profile-activation assembler).
  - Onboarding layer under `src/desktop/onboarding/` (profile lifecycle state
    machine, local profile descriptor/persistence/paths, profile
    initialization coordinator, redacting `FedosProfileUnlockSecret`).
  - Electron isolated package `packages/fedos-desktop-electron-spike` with
    five prior main/preload/renderer trios (spike, host-adapter, navigation,
    notifications-tray, badge) and packaged build scripts
    (`run_electron_builder_package.mjs`, `copy_static_assets.mjs`,
    `electron_builder.config.json`).

## The ONE finding this Arc turns on (corrects the prior Arc's environment claim)

Alpha 4741-4820 declared packaged-GUI acceptance "honestly blocked by
environment" (headless, no Electron installed) — but that was measured in a
DIFFERENT worktree (`C:\wt\production-master-seed-unlock`). The spec ordered a
firsthand re-verification here. Result:

- **`npm ping` succeeds** — the npm registry is reachable from this session.
- **Electron installs here.** `npm install` in
  `packages/fedos-desktop-electron-spike` plus `node node_modules/electron/install.js`
  downloaded a real `node_modules/electron/dist/electron.exe` (225 MB,
  Electron 43).
- **A BrowserWindow renders here.** A probe (`show:false`,
  `webPreferences.offscreen:true`, `contextIsolation:true`,
  `nodeIntegration:false`, `sandbox:true`) loaded a local page, executed
  renderer JS via `webContents.executeJavaScript`, and returned a value — a
  real renderer process ran.
- **The full renderer → preload → main → renderer path works offscreen.** A
  second probe exposed a frozen `contextBridge` API in a sandboxed preload,
  typed a value into a `type=password` input, clicked a button, and observed
  the value cross `ipcRenderer.invoke` → `ipcMain.handle` and return — with
  the input value NOT serialized into `outerHTML`.

Conclusion: the prior Arc's blocker does NOT hold in this worktree. Offscreen
rendering makes real packaged renderer/preload/main acceptance achievable, so
this Arc pursues FULL completion rather than the honest-partial stop.

## Inventory (as the spec enumerates)

- **Electron package layout / main / preload / static-page files:**
  `packages/fedos-desktop-electron-spike/src/*.cts` (main+preload pairs),
  `*_renderer.ts` (browser scripts), `*_page.html`, `*_window.d.ts`. Compiled
  by `tsconfig.json` (main graph, `.cts`→`.cjs` CommonJS) +
  `tsconfig.browser-scripts.json` (renderers) + `copy_static_assets.mjs`
  (HTML), into `dist/`.
- **Current Host command vocabulary:** each prior package owns a closed,
  named `fedos-<name>:*` IPC channel set; preload exposes one frozen object of
  thin `ipcRenderer.invoke` wrappers; no generic `invoke(channel, any)`.
- **Production activation construction point:** none yet reachable from any
  Electron main — the prior Arc proved the chain only at the Node/source
  level. `activateFedosProductionProfileMasterSeed()` is the assembler entry.
- **WASM artifact + manifest inclusion:** `packages/fedos-core-rust/pkg/`
  (gitignored, per-build) holds `fedos_core_rust_bg.wasm`,
  `fedos_core_rust.js`, `fedos_wasm_artifact_manifest.v1.json`. The activation
  authority resolves them from `cwd`-relative `packages/fedos-core-rust/pkg`
  by default, or an explicit `artifactDir`.
- **BrowserWindow security settings:** every prior main uses
  `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`,
  `webSecurity:true`, `loadFile` only, denied window-open/navigation/permission.
- **Current Electron subprocess tests:** each prior Arc has a real
  process-spawning acceptance suite (e.g.
  `secure_runtime_alpha_4341_4420_badge_electron_acceptance.test.ts`) driven
  by `test:electron-spike` (`vitest.electron-spike.config.ts`), gated OUT of
  ordinary `npm test`. Precedent is a MAIN-process self-test over marked
  stdout — NOT a renderer-driven one; this Arc extends that convention to
  drive the real renderer.
- **Packaging tool/config:** `electron-builder` via
  `run_electron_builder_package.mjs` + `electron_builder.config.json`
  (portable). The primary real-process acceptance path here — matching every
  prior Electron Arc — spawns `electron dist/<main>.cjs` directly.
- **Current secret input route / redaction:** `FedosProfileUnlockSecret`
  (one-shot, redacted, zeroed on consume) exists; NO GUI passphrase input and
  NO closed unlock IPC command existed anywhere (the exact gap this Arc closes).
- **Baseline failures:** `npx tsc --noEmit` reports TWO pre-existing errors at
  the clean `68545db` base (`test/secure_runtime_alpha_477_scheduler_lifecycle_model.test.ts:121`
  AND `test/secure_runtime_alpha_4741_4820_production_master_seed_activation.test.ts:189`
  — the prior Arc's declaration under-reported the latter). The
  `build:production-wasm` pipeline aborts on a pre-existing native
  `cargo test` failure (`secp256k1_dependency_guard`: 11 vs expected 10
  production deps in the committed `Cargo.toml`) — unrelated to this Arc; the
  raw `cargo build --target wasm32 && wasm-bindgen` steps succeed and produce
  a real `pkg/`. Full `vitest run` fails the documented environmental
  `?raw`-import / `source_alignment` classes.
- **Test plan:** structural source-inspection guards (always run) + real
  packaged-process create/unlock acceptance + on-disk & stdout secret leak
  scan + a missing-artifact failure-matrix case, all in
  `secure_runtime_alpha_4821_4900_unlock_electron_acceptance.test.ts`.

## Files this Arc changes (all additive)

New: `src/desktop/production_activation/fedos_production_nostr_signing_authority.ts`;
`tsconfig.unlock-runtime.json`; six
`packages/fedos-desktop-electron-spike/src/fedos_electron_unlock_*` files
(main/preload/page/renderer/selftest/window.d.ts); the acceptance test.
Additive edits only: root `package.json` (+2 scripts), spike `package.json`
(+1 script), spike `tsconfig.json` / `tsconfig.browser-scripts.json`
(renderer include/exclude), `copy_static_assets.mjs` (+1 copy). NO existing
production source file is modified; the prior Arc's activation authority,
facade, master-seed authority, coordinator, and every prior `*_main.cts` are
untouched.
