# 02 — Beta Release Artifact Inventory

Every candidate artifact for a FedOS Desktop Beta 0.1 release, classified
**required** / **optional** / **rejected** / **deferred**, with an
explicit consumer for every non-rejected entry.

| Artifact | Status | Consumer | Rationale |
|---|---|---|---|
| Unpacked directory (`win-unpacked/`) | **required** (as a build intermediate; not itself the public release artifact) | the packaging pipeline itself; developers running `npm run start:beta` | already proven buildable (`01`); every other artifact is derived from it |
| Portable executable (single-file, electron-builder `portable` target) | **deferred** | end users on locked-down machines who cannot run an installer | not yet built or tested anywhere in this repository (`01`); electron-builder supports it as a `win.target` addition, real but unverified cost; `03`/`04` |
| NSIS installer | **required** (primary format, next Arc) | ordinary Windows end users | chosen primary format, `03` |
| MSI | **rejected for V1** | enterprise deployment via Group Policy | no evidence of enterprise/managed-deployment demand for a Beta; real added build complexity (WiX toolchain, a separate electron-builder plugin); `03` |
| MSIX | **rejected for V1** | Microsoft Store / sandboxed installs | requires a Microsoft Store or sideloading trust chain this project has no evidence of; real added complexity; `03` |
| ZIP of the unpacked application | **required** (secondary/developer format) | developers, portable-use testers, and as a stopgap if NSIS packaging is delayed | zero new electron-builder target — the SAME `dir` build already proven, merely archived; `03`/`04` |
| Source archive (repository tarball/zip) | **rejected as a release artifact** | none identified | this is a Git repository already publicly clonable (once a remote exists, `16`) — a duplicate source snapshot artifact adds no value and a second thing to keep in sync |
| Checksums file (`SHA256SUMS`) | **required** | every downloader, verifying artifact integrity before running an installer from an unsigned Beta | `07` |
| Signature metadata (Authenticode signature embedded in the `.exe`) | **deferred** (no certificate available, `05`) | Windows SmartScreen, enterprise policy, antivirus reputation systems | cannot be produced without a real certificate this review has no evidence of; `05`/`06` |
| SBOM (software bill of materials) | **deferred** | security-conscious downstream users/auditors | real value, but no current tooling/process exists in this repository to generate one; not release-blocking for a Beta; candidate for a later Arc |
| WASM artifact manifest (`fedos_wasm_artifact_manifest.v1.json`) | **required** (already exists, bundled inside the packaged app, not published separately) | the packaged application's own production-unlock verification code (`fedos_production_wasm_artifact_manifest.ts`) | already real, already verified at load time (`08`); this is an internal binding artifact, not a public download |
| Release notes | **required** | every downloader | must state version, channel, known limitations, checksum instructions |
| Known-limitations document | **required** | every downloader, before install | the accepted Beta limitations model already exists in source (`src/desktop/beta/fedos_desktop_beta_limitations.ts`) — the release notes must reference/reuse it, never fork a second limitations list |

## Summary of the public Beta 0.1 release artifact set (V1)

1. One NSIS installer `.exe` (primary).
2. One ZIP of the unpacked application (secondary/portable).
3. One `SHA256SUMS` (or equivalent) checksum file covering both of the above.
4. Release notes (referencing the existing capability manifest + limitations model).
5. No signature, no SBOM, no auto-update metadata for V1.
