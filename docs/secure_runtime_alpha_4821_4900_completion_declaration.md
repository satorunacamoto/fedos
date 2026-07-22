# Secure Runtime Alpha 4821-4900 — Packaged Electron Real-Unlock Acceptance and GUI Passphrase-Input Boundary — Completion Declaration

**FULL completion.** A real, packaged Electron process (offscreen-rendered,
strict security settings) creates and unlocks a real local profile through
real WASM, driven through the actual renderer's passphrase input crossing the
genuine preload → main boundary — with NO development seed double and NO
dev-only loader. Wrong secret stays locked with no Runtime; identity is stable
across a real process relaunch; lock and re-unlock work; a unique per-run
secret leaks nowhere on the application's own surfaces.

Commit title used: **"Add Secure Runtime Alpha 4821-4900: Packaged Electron
Real-Unlock Acceptance and GUI Passphrase Input Boundary Arc."**

## Why FULL, not honest-partial

The honest-partial title was reserved for the case where "the packaged
Electron renderer process genuinely cannot execute in this environment."
Phase A/M re-verified firsthand (the prior Arc's blocker was measured in a
DIFFERENT worktree) that in THIS worktree Electron installs and an offscreen
BrowserWindow starts a real renderer process under `contextIsolation:true` /
`nodeIntegration:false` / `sandbox:true`. The full declaration's every
condition is met and PROVEN by the automated acceptance suite
(`secure_runtime_alpha_4821_4900_unlock_electron_acceptance.test.ts`, 15/15
passing):

- a packaged Electron process runs (`electron dist/fedos_electron_unlock_main.cjs`);
- the REAL renderer passphrase input is used (typed via
  `webContents.executeJavaScript` into the real `type=password` field, real
  button `.click()`);
- the preload/main boundaries are crossed (`window.fedosProfile` →
  `ipcRenderer.invoke` → `ipcMain.handle`), never a direct coordinator call;
- real WASM creates (generate + Argon2id/ChaCha20-Poly1305 seal) and unlocks
  (restore) the profile — the sealed file begins `{"v":1,"kdf":"argon2id"`;
- no dev/fake fallback is used (asserted in source; a missing artifact fails
  closed with no fallback);
- a wrong secret stays locked with `runtimeRunning === false`;
- lock and re-unlock work; identity is IDENTICAL across the create process and
  a separate unlock process (stable across relaunch);
- no secret leakage is observed (renderer DOM/storage/URL, main stdout, and
  every on-disk profile file scanned for a unique per-run secret — clean).

## What was built (all additive; no existing production source modified)

- `src/desktop/production_activation/fedos_production_nostr_signing_authority.ts`
  — the one strictly-necessary production-source addition: a
  `FedosNostrSigningAuthority` that derives the account identity / signs
  directly on the production facade's WASM handle (no dev-gated loader),
  sharing the same handle as the production Master Seed authority so identity
  is deterministic across relaunch.
- Six `packages/fedos-desktop-electron-spike/src/fedos_electron_unlock_*`
  files (main / preload / page / renderer / self-test / window.d.ts) — a NEW,
  additive sibling Electron package; no prior `*_main.cts` touched.
- `tsconfig.unlock-runtime.json` + `build:unlock-runtime` (root) — compiles
  the onboarding + production-activation graph to `dist/`.
- The acceptance suite; additive scripts / tsconfig include / asset-copy
  edits only.

## Verification

- `npx tsc --noEmit` (core): the SAME two pre-existing errors present at the
  clean base `68545db` (`.../477_scheduler_lifecycle_model.test.ts:121` and
  `.../4741_4820_production_master_seed_activation.test.ts:189`); the new
  modules add ZERO type errors. Spike `tsconfig.json` / `browser-scripts.json`
  / `tsconfig.test.json` all typecheck clean.
- Acceptance suite: 15/15 passing (structural guards + 3 REAL packaged-process
  tests: create, unlock, missing-artifact failure).
- Real WASM: `cargo build --target wasm32 && wasm-bindgen` succeed (~23s;
  260 KB `fedos_core_rust_bg.wasm` + JS glue + manifest). NOTE: the
  `build:production-wasm` pipeline's `cargo test` gate hits a PRE-EXISTING,
  unrelated native failure (`secp256k1_dependency_guard`, 11 vs 10 deps in the
  committed `Cargo.toml`) — the raw build/bindgen steps this Arc needs succeed.
- Full `vitest run`: A/B-verified against the stashed baseline source (same
  built `dist`/`pkg`/`target`). The `?raw`-import / `source_alignment`
  failure class is the documented environmental one and swings run-to-run for
  the IDENTICAL state (measured 287 and 291 failing on two baseline runs); the
  per-test diff attributes the movement to that flaky class, not to this Arc's
  files (no failure references `production_activation`, `onboarding`,
  `unlock`, the new authority, or the added scripts). This Arc's own new tests
  all pass.

## Development vs production truth

- Development path (existing, unchanged): dev-gated WASM loader + test doubles.
- Production path (this + prior Arc): host-attested, manifest-verified
  activation → real WASM Master Seed + the new production Nostr signing
  authority → the unchanged coordinator → a real Runtime, now PROVEN through a
  real packaged Electron GUI process, not only Node.

## Concurrent-session check

`git log` / `git status` were checked in this exact worktree before the first
edit (clean at `68545db`) and again before commit. An unrelated
`stash@{1}` from another session was observed and left untouched; no
unexpected commits or files appeared in this branch.

## Recommended next Arc

**Desktop Settings, Relay Configuration, and User Preferences Arc** (the
spec's preferred next step). This Arc's objective — the packaged real-unlock
acceptance the prior Arc left open — is now fully closed, so the honest next
step is the non-crypto Settings/Relay/Preferences surface rather than more
unlock work.
