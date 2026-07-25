# Release Artifact Inventory

What the real release pipeline produces, where it lands, and what each
artifact is for. Schema read directly from
`packages/fedos-desktop-electron-spike/scripts/generate_release_manifest.mjs`
and `scripts/lib/release_identity.mjs` this pass (see
[`08_version_manifest.md`](08_version_manifest.md)); this pass did not
re-run the pipeline itself (see [`11_build_manifest.md`](11_build_manifest.md)
§5 for why).

## The pipeline (`npm run release:beta`, from `packages/fedos-desktop-electron-spike/`)

Single script, `scripts/build_release.mjs`, real sequential steps
(per `BUILDING.md`'s own documented order, cross-checked against the
individual scripts' own filenames present in `scripts/`):

1. Verify a clean working tree (`release_identity.mjs`'s own
   `requireClean` check) — refuses to proceed otherwise.
2. Verify the `electron-builder` package allowlist config
   (`verify_release_package_allowlist.mjs`).
3. Build the root `beta-runtime` `dist/` graph (`npm run build:beta-runtime`).
4. Build the Electron package itself (main/preload/renderer/static
   assets — the two-sequential-`tsc`-pass build described in
   `BUILDING.md`, with the Alpha 8201-8280 `tsconfig.json` exclude-list
   fix now in place).
5. Run `electron-builder`, producing `dist-package-beta/` (raw,
   unpublished output — includes a `win-unpacked/` intermediate never
   copied further).
6. `generate_release_manifest.mjs` — locates the ONE `.exe` and ONE
   `.zip` under `dist-package-beta/` (fails closed/throws if zero or
   more than one match — never guesses which file is the real
   artifact), copies both into `release/`, writes
   `release/release-manifest.v1.json`.
7. `generate_release_checksums.mjs` — writes `release/SHA256SUMS.txt`.
8. `verify_release_checksums.mjs` — re-derives every checksum
   independently and diffs against step 7's own output (catches a
   corrupted-in-transit or partially-written file, not merely trusts the
   generator's own claim).
9. `scan_release_artifacts_for_secrets.mjs` — scans the **staging
   inputs** (not the compiled NSIS/ZIP containers themselves — a real,
   disclosed scope limit) for prohibited content.

## Artifacts produced

| Artifact | Location | Purpose | Contains |
|---|---|---|---|
| NSIS installer (`.exe`) | `release/` (curated copy; raw electron-builder output also briefly exists under `dist-package-beta/`) | Primary, `primary: true` in the manifest — normal Windows install flow | Full Electron app + real, byte-identical WASM crypto core embedded (confirmed by Alpha 8121-8200's own extraction check) |
| Portable ZIP | `release/` | Secondary (`primary: false`) — run-without-installing option | Same app contents, different container |
| `release-manifest.v1.json` | `release/` | Machine-readable release identity — see [`08_version_manifest.md`](08_version_manifest.md) for full schema | `productName`, `productVersion`, `channel`, `releaseSequence`, `gitCommit`, `gitTreeClean`, `buildIdentity`, `electronPackageVersion`, `wasmArtifactManifest`, `schemaVersions`, `minimumSupportedPlatform`, `platform`, `architecture`, `unsigned`, `createdAt`, per-artifact `{filename, type, primary, sizeBytes, sha256Hex}` |
| `SHA256SUMS.txt` | `release/` | Independently-verifiable integrity list, covers the installer, ZIP, AND the manifest file itself | Plain `sha256  filename` lines |

**Both `dist-package-beta/` (electron-builder's raw output, including the
`win-unpacked/` intermediate) and `release/` (the curated, ready-to-publish
copy) are gitignored** — neither is ever committed; both are regenerated
on demand by the pipeline above. This means **no release artifact
currently exists in this checkout** — verified directly this pass
(`find packages/fedos-desktop-electron-spike -maxdepth 1 -iname
"release*" -o -maxdepth 1 -iname "dist-package*"` → no matches). An
auditor must run the pipeline themselves (from a clean tree) to obtain a
real artifact to inspect.

## What is NOT produced

- **No code-signing artifact of any kind is produced today** —
  `unsigned: true` is written into the manifest unconditionally. This is
  not for lack of infrastructure: `scripts/lib/signing_readiness.mjs`
  (Secure Runtime Alpha 5321-5400) is a real, already-built, non-secret
  signing-readiness *inventory and assessment* module — it checks
  whether `signtool.exe` is available, whether the electron-builder
  config references any signing hook, and whether
  `CSC_LINK`/`CSC_KEY_PASSWORD`/`WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` are
  *present* (existence only, values never read/logged), then classifies
  the result into a closed outcome vocabulary (`unsigned-allowed-for-beta`,
  `signing-ready`, `certificate-expired`, `identity-mismatch`,
  `timestamp-service-unconfigured`, etc.). **Confirmed this pass: no
  certificate is configured anywhere in this checkout today**, so the
  real, current outcome is `unsigned-allowed-for-beta` — explicitly
  documented in that module's own code as "a POSITIVE, actionable
  result... never reported as a blocker or an error" for a Beta release.
  **The practical implication for Public Beta**: the readiness-assessment
  *logic* already exists and is tested (Phase R); what is actually
  missing is a real certificate plus the human decision to acquire and
  configure one — a procurement/business decision, not an engineering
  gap. Wiring a real cert into `assessFedosSigningReadiness()`'s existing
  contract, once one exists, should be comparatively small, mechanical
  work.
- **No auto-updater artifact** (e.g. no `latest.yml`/`app-update.yml`
  electron-builder auto-update feed) — consistent with
  `autoUpdateEnabled: false` being an Absolute Prohibition in the
  product's own release configuration (see
  [`08_version_manifest.md`](08_version_manifest.md)).
- **No macOS or Linux artifact** — `minimumSupportedPlatform:
  "windows-x64"` is the only packaging target in the accepted lineage;
  this pipeline has never produced a `.dmg`/`.AppImage`/`.deb`.
- **No source tarball / SBOM file emitted by the pipeline itself** — see
  [`14_sbom.md`](14_sbom.md), which this bundle produces separately since
  the release pipeline does not generate one on its own.

## Known, disclosed gap in this pipeline (carried from `BUILDING.md`)

The release script does **not** itself verify that
`packages/fedos-core-rust/pkg/` (the compiled WASM artifact) already
exists before running — there is no pre-flight check. Running the
pipeline without first running `npm run build:wasm` produces a build
missing real cryptography (or fails at a later, less clear step,
depending on how the missing artifact manifests downstream) rather than
failing immediately with a clear message. Build WASM first, always — see
[`11_build_manifest.md`](11_build_manifest.md) step 1.
