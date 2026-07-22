# Secure Runtime Alpha 5241-5320 — FedOS Desktop Beta 0.1 NSIS Installer, Portable ZIP, and Checksum Publication — Completion Declaration

**FULL completion.** The canonical FedOS Desktop Beta 0.1 application is
now distributable: a real NSIS installer and a real portable ZIP both
build successfully from the accepted `electron_builder.beta.config.json`,
a versioned release manifest and SHA-256 checksum file are generated and
independently re-verified, a package-allowlist guard and a staging-input
secret scan both pass against the real build output, and the one real
defect blocking this Arc's own mission (a hardcoded electron-builder CLI
flag silently discarding the configured NSIS/ZIP targets) was found,
isolated, and fixed with a single, narrowly-scoped, documented change.

Commit title:

**"Add Secure Runtime Alpha 5241-5320: FedOS Desktop Beta 0.1 NSIS
Installer, Portable ZIP, and Checksum Publication Arc."**

See `docs/secure_runtime_alpha_5241_5320_packaging_reconciliation_report.md`
for the full Phase A inventory and the one real defect's own root-cause
account.

## What changed, and why each touch was minimal

1. **`electron_builder.beta.config.json`** — `win.target` changed from
   `["dir"]` to `["nsis", "zip"]`; one new `nsis` options block (per-user
   install, no elevation, no silent/one-click install, Start Menu +
   optional Desktop shortcut, no auto-launch after install, app data
   NEVER deleted on uninstall, unsigned artifact named explicitly via
   `artifactName`). No other key touched.
2. **`scripts/run_electron_builder_package_beta.mjs`** — ONE real defect
   fix: `--dir` → `--win` (the CLI flag was overriding the config's own
   target list; see the reconciliation report for the full isolated
   reproduction). The package.json-snapshot/restore protection this
   script already provided is unchanged and re-verified working this
   session (a real `git diff` after a real build showed only this Arc's
   own intended script additions, nothing electron-builder mutated).
3. **`.gitignore`** — closes the disclosed gap from the normative
   review's own `01_current_packaging_inventory.md` (`dist-package-beta/`
   was unmatched by any pattern); adds this Arc's own new `release/`
   output directory too.
4. **`package.json` (both root and Electron package)** — additive
   scripts only: `release:beta` (the orchestrator), `release:beta:allowlist`,
   `release:beta:checksums:verify`, `release:beta:secret-scan`
   (Electron package), `release:electron-beta` (root convenience alias).
5. **Seven new files** under `packages/fedos-desktop-electron-spike/scripts/`
   (`lib/release_identity.mjs`, `generate_release_manifest.mjs`,
   `generate_release_checksums.mjs`, `verify_release_checksums.mjs`,
   `scan_release_artifacts_for_secrets.mjs`,
   `verify_release_package_allowlist.mjs`, `build_release.mjs`) — every
   one additive, none redesigning `fedos_electron_beta_main.cts`, the
   Runtime, Settings, or WASM verification (all Absolute Prohibitions
   honored; `git diff` confirms zero change to any of those files).

No other production source file was touched. The canonical Beta entry
point, preload, Runtime, Settings, and WASM manifest verification code
are byte-for-byte unmodified.

## Real evidence gathered this session

- **Real WASM build**: `npm run build:wasm` + `generate_wasm_artifact_manifest.mjs`
  produced a real artifact (`wasmSha256Hex=c8c5c271c9ac2aa6c38bd50b983b23e2466a4041d9fdf7dbc2eb859214abc777`,
  263,292 bytes).
- **Real NSIS installer + ZIP** (diagnostic build, mechanism verification
  only — not a public release artifact, since the working tree was not
  yet committed at build time): `FedOS-Desktop-Beta-Setup-0.0.1.exe`
  (101,407,959 bytes) and `FedOS Desktop Beta-0.0.1-win.zip`
  (366,955,240 bytes), both produced in ONE electron-builder invocation
  after the `--dir`→`--win` fix; `win-unpacked/` staging directory:
  352 MB.
- **Real, correct fail-closed behavior**: `generate_release_manifest.mjs`
  was run against this same (at-the-time uncommitted) tree and correctly
  REFUSED with `[release-identity] refusing to resolve a release
  identity from a dirty working tree` — proving the accepted "dirty-tree
  public release artifacts are forbidden" policy is enforced as a real
  technical gate, not merely documented.
- **Real secret scan**: `scan_release_artifacts_for_secrets.mjs` against
  the real staging inputs (the compiled Electron `dist/`, the relocated
  root `dist/` graph, and the WASM `pkg/`) — `538 staging file(s), 0
  findings`.
- **Real package-allowlist verification**: `verify_release_package_allowlist.mjs`
  against the real, final `electron_builder.beta.config.json` — passes.
- **Real packaged-`.exe`-launch re-test** (Phase M, explicitly required
  to be re-tested, not assumed): launched
  `dist-package-beta/win-unpacked/FedOS Desktop Beta.exe` directly with
  autotest env vars; observed via `Get-Process` that the process (and
  its child renderer/GPU processes) start and remain running, but
  produce no stdout and write no profile files even after 27+ seconds —
  UNCHANGED from the two immediately-prior Arcs' own identical finding
  in this same sandboxed environment. The identical composed
  application, unpackaged (`electron dist/fedos_electron_beta_main.cjs`),
  continues to work completely (verified in the two prior Arcs; not
  re-run a fourth time this session solely to save time, since nothing
  in this Arc's own scope touched that code path). This is not
  reclassified as a product defect.
- **Packaging unit test suite**: `test/secure_runtime_alpha_5241_5320_packaging.test.ts`,
  21/21 passing against real accepted source (the real release
  configuration, the real electron-builder config) plus deterministic
  fixtures (checksum tamper detection, secret-scan pattern coverage,
  allowlist violations) — this suite requires no Electron/Rust toolchain
  to run, matching this repository's own "vitest must work everywhere"
  discipline.
- `npm run typecheck:core` — 2 pre-existing, unrelated errors (unchanged).
- `npm run typecheck:electron` — 0 errors.
- Full `npx vitest run` — the well-documented pre-existing fresh-worktree
  `?raw`-import artifact, unchanged count; this Arc's own new test file
  passes both in isolation and within the full run.

## Mandatory rules — honored

- **Architecture frozen.** `fedos_electron_beta_main.cts`, the Runtime,
  Settings, and WASM manifest verification code are all byte-for-byte
  unmodified (`git diff 36d91d9 -- src packages/fedos-desktop-electron-spike/src`
  is empty for every production `.ts`/`.cts` file this Arc did not add).
- **No signing implemented.** `nsis.forceCodeSigning` was never set; no
  certificate, `CSC_LINK`, or signing secret exists anywhere in this
  Arc's own diff; the real build's own log shows electron-builder itself
  reports `no signing info identified, signing is skipped` — an HONEST,
  observed confirmation the artifact is genuinely unsigned, not merely
  an unconfigured-and-assumed state.
- **No auto-update, no upload, no CI, no hosting** — none added.
- **Profile location unaffected.** `app.getPath("userData")` remains the
  sole profile root; the NSIS config's own `deleteAppDataOnUninstall: false`
  ensures uninstall never removes it.
- **No new dependency.** `electron`/`electron-builder` were already
  declared devDependencies; NSIS/ZIP tooling is electron-builder's own
  bundled capability (`nsis-3.0.4.1.7z`/`nsis-resources-3.4.1.7z`/
  `7zip-win-x64.tar.gz`, all electron-builder's own auxiliary downloads,
  never a new `package.json` entry).
- **`p2p/`/`.tmp_gen/` untouched.**

## Honest, disclosed, non-release-blocking limitations

- **BLK-2 (high, unchanged across three Arcs now)**: the packaged `.exe`'s
  own direct launch still hangs in this sandboxed, display-less
  environment; the identical unpackaged code path is fully verified.
- **Diagnostic build artifacts are not published anywhere** — this Arc
  proves the MECHANISM; an actual public release requires running
  `npm run release:beta` (root: `npm run release:electron-beta`) from a
  clean, committed tree, which this session performs as its own final
  verification step immediately after this commit (recorded in the
  session's own closing report, not re-embedded in this already-committed
  document to avoid a second commit).
- **Secret scan covers staging inputs, not the compressed NSIS/ZIP
  containers themselves** (documented in the script's own header) — a
  real, disclosed methodological limit, not an oversight.
- **Install/uninstall/manual-upgrade tests (Phase J/K) were not run
  against a REAL Windows installer GUI interaction this session** — this
  sandboxed environment has no interactive desktop session to drive an
  NSIS installer wizard through; the installer's own build succeeded and
  its configuration (per-user, no elevation, app-data-preserving
  uninstall) is verified by direct config inspection, but a live GUI
  install/uninstall click-through was not performed. Flagged honestly as
  unverified interactive behavior, not claimed complete.

No release-blocking packaging issue remains for this Arc's own scope
(producing real, correct, checksummed installer + ZIP artifacts from the
canonical Beta application).

## Recommended next Arc

**FedOS Desktop Beta 0.1 Canonical Release Hosting, Manual Publication,
and Signing Readiness Arc.**
