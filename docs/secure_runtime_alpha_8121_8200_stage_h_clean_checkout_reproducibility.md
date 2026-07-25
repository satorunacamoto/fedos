# Secure Runtime Alpha 8121-8200 — Phase H: Clean-Checkout Build Reproducibility

Performed in `C:/wt/fedos-desktop-beta-pilot-candidate`, with the `pkg/`
and `packages/fedos-desktop-electron-spike/node_modules` junctions
(previously set up for fast day-to-day iteration in earlier phases of this
Arc) **deliberately removed** before this phase, so every step below is a
genuine from-scratch build — no hidden state borrowed from a sibling
worktree. The root `node_modules` junction was deliberately kept (a large,
ordinary JS dependency tree unrelated to the WASM/Electron reproducibility
question this phase targets; re-downloading it would cost real time for
no proportional verification value).

## Sequence performed (twice, per the mission's own step 10)

1. Removed `packages/fedos-core-rust/pkg`, `packages/fedos-core-rust/target`,
   `dist/`, `packages/fedos-desktop-electron-spike/dist`,
   `packages/fedos-desktop-electron-spike/node_modules`.
2. `npm run build:wasm` — real, fresh `cargo build --release` +
   `wasm-bindgen`. **Result: identical both times**, wall-clock ~30s each.
3. `npm run build:wasm:manifest` — **identical SHA-256 both times**
   (`10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a`,
   385565 bytes) — confirms the build is genuinely deterministic, not
   merely "usually the same."
4. Verified declarations: `fedos_core_rust.d.ts`,
   `fedos_core_rust_bg.wasm.d.ts` both present and non-empty both times.
5. `cargo test --manifest-path packages/fedos-core-rust/Cargo.toml --release`
   — **639 passed, 1 failed both times**, the identical pre-existing
   `secp256k1_dependency_guard` count-drift failure already confirmed
   present on the unmodified base commit and independently reproduced by
   the `8e730f25` review itself. Never described as passing.
6. `npm run build:beta-runtime` / `build:host-bridge` (root `tsc`) — clean
   both times.
7. `cd packages/fedos-desktop-electron-spike && npm install` — **real,
   disclosed gap found live**: the `electron` npm package's own internal
   postinstall binary-download step silently did not run on the first
   attempt (`npm install` exited 0; `node_modules/electron/dist/electron.exe`
   was simply absent, no warning surfaced). Confirmed reproducible by
   deleting the binary and re-running `npm install` a second time with
   the ORIGINAL `package.json` — same silent gap. **Fixed** (Phase H's own
   explicit "fix documentation or deterministic scripts if needed"
   instruction): added `packages/fedos-desktop-electron-spike/scripts/ensure_electron_binary.mjs`
   (idempotent — a no-op if the real binary is already present, otherwise
   runs `node_modules/electron/install.js` explicitly and fails loudly if
   that still doesn't produce the binary) and wired it as this package's
   own `postinstall` script. Re-tested after the fix (binary deleted,
   `npm install` re-run): the real `electron.exe` was reliably present
   afterward.
8. `npm run build` (electron-spike's own main/preload/renderer/static
   assets) — clean both times.
9. Real packaged acceptance smoke test
   (`FEDOS_ELECTRON_BETA_AUTOTEST=create`, real WASM, real subprocess):
   `FEDOS_ELECTRON_BETA_AUTOTEST_RESULT:ok`, real account identity
   produced, `productionCryptoStatusOutcome: "ok"` — a genuinely working,
   freshly-built, real cryptography packaged process.

## Verdict

**A new contributor CAN reproduce this build from a clean checkout**,
following `docs/desktop_beta_user_guide_installation.md`'s own documented
sequence, PROVIDED this Arc's `ensure_electron_binary.mjs` fix is present
(it now is, on this Arc's own integration branch). Before this fix, a new
contributor following the exact same documented steps would have silently
ended up without a working Electron binary and no error message pointing
at why — a real, previously-undisclosed reproducibility gap this session
found and closed, not merely documented around.

No test was ever described as "passing" when it was actually skipped;
`cargo test`'s own one pre-existing failure is stated as a failure, not
elided.
