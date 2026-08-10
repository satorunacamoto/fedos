# Commerce Reachable Catalog Phase 1 — Final Validation Evidence

Recorded after landing `63655bb74ab12f233af5570f3f1e7f3861939cc4` on `arc/fedos-commerce-reachable-catalog-phase1` (base: `d828d387a1c6a94e9f64b7409aeae8466d9ac822`, the merged Commerce Decentralized Architecture Validation arc, itself descended from the merged Commerce E2E audit `db53a64282484c8884417ee5d060030646efb730`).

## Prerequisite build steps performed this session

1. `npm run build:wasm` (with `CARGO_TARGET_DIR` pointed off the OneDrive-synced worktree path — the default in-tree target dir produced a real `mingw` linker failure on this machine; moving it off OneDrive fixed it, unrelated to Commerce) + `npm run build:wasm:manifest`.
2. `npm run build:beta-runtime` (root) — now includes `src/os/commerce/index.ts` and, after the `rootDir` fix below, correctly produces `dist/os/commerce/index.js`.
3. `npm run build` (`packages/fedos-desktop-electron-spike`).

## Targeted tests

```
packages/fedos-desktop-electron-spike/test/commerce_reachable_catalog_phase1_structural_guards.test.ts   22/22 PASS
packages/fedos-desktop-electron-spike/test/commerce_reachable_catalog_phase1_real_vertical_slice.test.ts  1/1  PASS (real packaged process, CDP/ui-script driven)
```

## Full electron-spike suite (`vitest.electron-spike.config.ts`) — A/B baseline comparison

With Commerce changes present: 13 files / 31 tests failed, 181 passed, 4 skipped (216 total).
Root cause investigation: every failure is a real-Electron-subprocess test (badge/tray/notifications/host-adapter/navigation/device-sync/double-submit/acceptance-bridge-isolation, etc.) unrelated to any file this arc touched, showing timing/resource-contention symptoms (`Test timed out in 5000ms`, Windows `Unable to move the cache: アクセスが拒否されました` disk-cache lock errors) consistent with many concurrent real Electron subprocesses on this dev machine. This suite is not CI-gated (`.github/workflows/ci.yml` never references `start:beta`/`package:beta`/this vitest config).

**A/B baseline check:** built a separate, throwaway worktree at the exact pre-Commerce commit (`d828d387`), applied ONLY the same `rootDir`/shim-include prerequisite fix (no Commerce code at all), built the same WASM artifact, and ran the identical 11 previously-failing files: **28 tests failed** — nearly identical to the 29-30 in the Commerce worktree for the same file set. This confirms the failures are pre-existing environmental flakiness, not a Commerce regression. Baseline worktree removed after comparison.

## Root-level tests (`npm run test:current`)

```
1888/1888 executable tests PASS
2 suites failed to LOAD (0 tests each): test/trust_factory_composition.test.ts, test/trust_signed_qr.test.ts
  Cause: "Failed to load url qrcode" -- the `qrcode` npm package (declared in package.json,
  ^1.5.4) is absent from the shared node_modules in this environment. Confirmed pre-existing
  and unrelated: neither failing file, nor any file in src/os/trust/qr/, was touched by this
  arc; `npm run typecheck:core` independently reproduces the same missing-module errors in the
  same two trust/qr files, plus unrelated @types/node resolution errors (matches this session's
  own recorded "Shared node_modules @types/node artifact" environment gotcha).
```

## OSS release verifier

```
node scripts/release/verify_oss_release.mjs -> 8/8 checks PASS
```

## Typecheck

```
npm run typecheck:electron -> clean (0 errors) after fixing one real issue this arc introduced:
  a structural-guard test's literal cross-package import of src/os/commerce/index.ts violated
  tsconfig.test.json's own rootDir -- fixed by using a non-literal specifier (the same technique
  the existing real_user_facing_vertical_slice test already uses for its own cross-package import).
npm run typecheck:core -> pre-existing failures only, all in src/os/trust/**, all node-types/qrcode-shaped,
  none touching any Commerce file.
```

## Real packaged launch (manual, pre-automation, kept as the first live proof)

Launched `node_modules/electron/dist/electron.exe dist/fedos_electron_beta_main.cjs` against an isolated `FEDOS_ELECTRON_BETA_DATA_DIR`, driven via Chrome DevTools Protocol (`--remote-debugging-port`):
- Created a real local profile -> reached the real nav shell with Commerce beside Conversations.
- Commerce catalog: all 3 demo products render (2 merchants, price/merchant/fallback thumbnail correct).
- Product Detail (aurora-study): real `<img>` renders the generated gradient PNG; price/merchant/description/"Ordering not available yet" all correct; no Buy control.
- Product Detail (terra-keycaps, no media): safe `MK` initials fallback, no `<img>` element at all.
- Returned to Commerce, then to Conversations — Messenger unaffected (`No conversations yet` renders normally).
- In-app "Quit" produced a clean shutdown; `Get-CimInstance Win32_Process` confirmed zero orphaned `electron.exe` processes afterward.

Screenshots: `docs/commerce/evidence/`.

## Network contact

Zero. The Commerce IPC handlers never construct a `PaymentProvider`, never call `fetch`/`WebSocket`, and the renderer's CSP (`connect-src 'none'`) blocks any renderer-side network attempt outright.
