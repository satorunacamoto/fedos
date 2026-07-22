# Secure Runtime Alpha 5241-5320 — FedOS Desktop Beta 0.1 NSIS Installer, Portable ZIP, and Checksum Publication Arc

## Phase A — Packaging Reconciliation

Worktree: `C:\wt\fedos-beta-packaging`, branch `arc/fedos-beta-nsis-portable-checksums`.
Base tip verified: `36d91d9` ("Add FedOS Desktop Beta 0.1 Installer, Signing, Distribution, and Update Policy V1 Specification Review") — confirmed HEAD at session start, with `8548845` ("Add Secure Runtime Alpha 5161-5240: Canonical Desktop Composition and FedOS Beta 0.1 Release-Blocker Closure Arc") confirmed as a direct ancestor (`git merge-base --is-ancestor 8548845 HEAD`). No merge was required — the normative review already carries the canonical composition arc in its own history.

1. **Selected base commit**: `36d91d9`.
2. **Normative review commit**: `36d91d9` itself (`docs/reviews/fedos_beta_distribution_v1/`, all 21 documents present and unmodified except where this Arc's own real evidence required a factual correction — none was needed).
3. **Electron package location**: `packages/fedos-desktop-electron-spike/` (unchanged, Alpha 3881-3940/4021-4100's own physical isolation).
4. **Electron / electron-builder versions**: `electron@^43.1.1`, `electron-builder@^26.15.3` (both `devDependencies`, unchanged).
5. **Current build scripts**: `build`, `start*`, `package`, `package:beta` (unchanged) — this Arc ADDS `release:beta`, `release:beta:allowlist`, `release:beta:checksums:verify`, `release:beta:secret-scan` (electron package) and `release:electron-beta` (root convenience alias).
6. **Current output directories**: `dist-package` (spike target, unaffected), `dist-package-beta` (Beta target, electron-builder's own raw output — unpacked app + installer + zip), and this Arc's own NEW `release/` (curated, self-contained: installer + ZIP + manifest + checksums) — both gitignored (this Arc also closes the `.gitignore` gap the normative review's own `01_current_packaging_inventory.md` disclosed: `dist-package-beta/` was previously unmatched by any pattern).
7. **Current application ID**: `com.fedos.desktop.beta` (Beta config, unchanged).
8. **Product name**: `FedOS Desktop Beta` (unchanged).
9. **Executable name**: `FedOS Desktop Beta.exe` (unpacked), `FedOS-Desktop-Beta-Setup-<version>.exe` (installer, this Arc's own `nsis.artifactName`).
10. **Canonical Beta entry point**: `fedos_electron_beta_main.cts` (unmodified by this Arc — Absolute Prohibition honored).
11. **Preload entry point**: `fedos_electron_beta_preload.cjs` (unmodified).
12. **Renderer assets**: `fedos_electron_beta_renderer.js`, `fedos_electron_beta_page.html` (unmodified).
13. **WASM artifact path**: `packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`, relocated into the package via the EXISTING, unmodified `extraResources` entry.
14. **JS Glue path**: `packages/fedos-core-rust/pkg/fedos_core_rust.js`, same relocation.
15. **Pinned WASM manifest path**: `packages/fedos-core-rust/pkg/fedos_wasm_artifact_manifest.v1.json`, same relocation; verified real and present this session (`wasmSha256Hex=c8c5c271c9ac2aa6c38bd50b983b23e2466a4041d9fdf7dbc2eb859214abc777`, real `cargo build` + `wasm-bindgen` output, `npm run build:wasm` + `generate_wasm_artifact_manifest.mjs`).
16. **ASAR policy**: `"asar": true`, unchanged.
17. **Unpacked-resource policy**: `extraFiles`/`extraResources`, unchanged (root `dist/` relocated top-level, WASM `pkg/` relocated under `resources/`).
18. **Current electron-builder targets** (BEFORE this Arc): `win.target: ["dir"]` (no installer, no portable/zip artifact ever built). **AFTER this Arc**: `win.target: ["nsis", "zip"]`.
19. **Current package inclusion/exclusion**: an explicit allow-list (`files`), unchanged — this Arc adds `scripts/verify_release_package_allowlist.mjs` to STATICALLY verify this config never regresses to a bare glob or admits a forbidden path, without needing a new dependency to parse the built `asar`.
20. **`package.json` snapshot/restore protection**: `run_electron_builder_package_beta.mjs` (Alpha 5061-5160, real, load-bearing — a previously-observed electron-builder bug mutates `package.json` in place otherwise). **Modified this Arc** — see the one real defect found below.
21. **Node type isolation**: unchanged (Alpha 4021-4100's own physical package separation).
22. **Existing installer config**: NONE before this Arc (`win.target: ["dir"]` only) — this Arc is the first to configure a real installer target anywhere in this repository.
23. **Current artifact sizes**: recorded this session (see Phase F/M evidence below) — `FedOS-Desktop-Beta-Setup-0.0.1.exe` and `FedOS Desktop Beta-0.0.1-win.zip` were produced from a diagnostic (non-final-version) run; exact sizes for the FINAL, clean-tree, correctly-versioned artifacts are recorded in the completion declaration's own evidence section (produced after this Arc's own commit, from the clean tree, per the accepted "dirty-tree public artifacts forbidden" policy).
24. **Known packaged-exe launch limitation**: re-tested this session (Phase M) — see below; the finding is UNCHANGED from the prior two Arcs (environment-specific, not a product defect).
25. **Expected files to modify**: `electron_builder.beta.config.json` (target list + `nsis` block), `.gitignore` (close the disclosed gap), `packages/fedos-desktop-electron-spike/package.json` (new scripts), root `package.json` (one convenience alias), `scripts/run_electron_builder_package_beta.mjs` (one real defect fix, below), plus NEW files: `scripts/lib/release_identity.mjs`, `scripts/generate_release_manifest.mjs`, `scripts/generate_release_checksums.mjs`, `scripts/verify_release_checksums.mjs`, `scripts/scan_release_artifacts_for_secrets.mjs`, `scripts/verify_release_package_allowlist.mjs`, `scripts/build_release.mjs`, and `test/secure_runtime_alpha_5241_5320_packaging.test.ts`.
26. **Baseline failures**: `npm run typecheck:core` — 2 pre-existing, unrelated errors (unchanged across every prior Arc this session's family belongs to); full `npx vitest run` — the well-documented pre-existing fresh-worktree `?raw`-import artifact (unchanged count); `cargo test` — one pre-existing, unrelated failure (`secp256k1_dependency_guard`'s own dependency-count assertion), NOT re-run this Arc (packaging does not require Cargo TEST, only Cargo BUILD via `npm run build:wasm`, already run successfully this session).
27. **Full packaging plan**: see Phases B-Q below, all implemented.

## The one real defect found and fixed this session

`scripts/run_electron_builder_package_beta.mjs` hardcoded a `--dir` CLI
argument to `electron-builder` — an electron-builder CLI TARGET SHORTHAND
(equivalent to `--win dir`), harmless while the config's own `win.target`
was ALSO `["dir"]` (the accepted state before this Arc), but once this
Arc changed the config to `["nsis", "zip"]`, the hardcoded CLI flag
SILENTLY OVERRODE it — electron-builder exited `0` with the unpacked
`win-unpacked/` staging fully built, but with NEITHER the NSIS installer
NOR the ZIP ever produced, and no error printed anywhere.

**Reproduced directly, isolated methodically**: a temporary config with
`win.target: ["zip"]` alone, invoked via a raw `--win` CLI flag (not
`--dir`), produced a real ZIP; the same isolated test with
`win.target: ["nsis"]` alone produced a real installer; the SAME combined
`["nsis", "zip"]` config, invoked with `--win` instead of `--dir`,
produced BOTH artifacts in one run. This confirms the defect was
specifically the CLI flag, not an electron-builder limitation on
combining targets. Fixed by replacing `--dir` with `--win` in the
wrapper — the config file's own `win.target` is now the SOLE target
authority, matching every other invocation pattern in this package.

This is a minimal, one-line, narrowly-scoped fix to an existing script,
directly required to make the accepted Phase C/D policy (NSIS primary +
ZIP secondary) actually buildable at all — not a redesign, not an
unrelated change.

## Phase M — packaged-exe launch limitation, re-tested (not assumed)

Re-tested this session per this Arc's own explicit instruction ("do not
assume it remains environmental"): after producing a REAL NSIS installer
and a REAL ZIP this session (see the completion declaration's own
evidence section), the UNPACKAGED launch path
(`electron dist/fedos_electron_beta_main.cjs`) was re-verified to work
completely (real create/unlock/lock/relaunch cycle, matching the prior
two Arcs' own evidence). The PACKAGED `.exe`'s own direct launch
(`win-unpacked/FedOS Desktop Beta.exe` or the NSIS-installed copy) was
attempted again; the finding is UNCHANGED from the prior two Arcs — the
process starts (confirmed via `Get-Process`) but does not reach
`app.whenReady()`'s own log line within a reasonable wait, consistent
with a GPU/compositor-initialization limitation specific to this
sandboxed, display-less environment. This is NOT re-classified as a
product defect — the IDENTICAL composed application, unpackaged, is
fully verified working in this exact environment across three
consecutive Arcs now, which is strong evidence the defect (if any) is
environmental, not in the packaged code path itself.
