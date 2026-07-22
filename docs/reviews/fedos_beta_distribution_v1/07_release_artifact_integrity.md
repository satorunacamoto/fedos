# 07 — Release Artifact Integrity

## Policy

- **SHA-256 checksums are published for every release artifact** (the
  NSIS installer and the ZIP, `02`/`03`) in a single, plain-text
  `SHA256SUMS` file (the same de facto format countless open-source
  projects already use: one line per file, `<hex-digest>  <filename>`,
  sorted by filename).
- **Checksum file naming**: `FedOS-Desktop-Beta-<version>-SHA256SUMS.txt`
  (e.g. `FedOS-Desktop-Beta-0.1.0-beta.1-SHA256SUMS.txt`), matching the
  version string already frozen in
  `fedos_desktop_beta_release_configuration.ts` (`10`).
- **Artifact naming**: `FedOS-Desktop-Beta-Setup-<version>.exe` (NSIS
  installer) and `FedOS-Desktop-Beta-<version>-win-x64.zip` (portable
  ZIP) — both stating product, channel, version, and (for the ZIP)
  architecture explicitly, never a bare `latest.exe`.
- **Manifest naming**: the release's own `SHA256SUMS` file is distinct
  from, and never conflated with, the WASM artifact manifest
  (`fedos_wasm_artifact_manifest.v1.json`, `08`) — the former covers the
  DISTRIBUTED release artifacts; the latter covers the INTERNAL, bundled
  WASM binary already verified at application load time. Two different
  integrity concerns, two different files, never merged into one.
- **Release metadata binding**: the release notes for a given version
  must quote (or link to) that exact version's own `SHA256SUMS` file —
  never a generic "see checksums" pointer disconnected from the specific
  release.
- **Verification instructions** (given to every downloader, in the
  release notes): on Windows, `Get-FileHash <path> -Algorithm SHA256`
  (PowerShell, built-in, no new tool) or `certutil -hashfile <path>
  SHA256` (also built-in) and compare against the published value.
- **What must be checked before publishing**: the checksum file must be
  generated from the EXACT bytes being uploaded (never a checksum of an
  intermediate/staging build), and the release notes' own stated version
  string must match `fedosDesktopBetaReleaseConfigurationV1().version`
  exactly (`10`).
- **Are checksums alone sufficient?** No — a checksum proves the
  downloaded bytes match what was PUBLISHED under that filename; it does
  NOT prove who published them or that the publishing channel itself was
  not compromised (`17`). Checksums answer "did the download complete
  correctly / was it tampered with in transit or on a mirror," not "is
  this really from FedOS." Publisher identity is what code signing (when
  eventually adopted, `05`) or a trusted distribution channel (`16`)
  would add — checksums are a necessary, not sufficient, integrity
  control for Beta 0.1's unsigned artifacts.
- **Signing/checksum relationship**: independent, complementary
  controls. An unsigned artifact can still be checksum-verified; a signed
  artifact should still be checksum-verified, since a signature covers
  the SIGNED file, not the download channel a user actually pulled it
  from.
- **Mirror verification**: any future mirror (`16`) must publish the
  IDENTICAL `SHA256SUMS` file the canonical host publishes — a mirror
  that cannot reproduce the canonical checksum for its own copy is
  presumed compromised or stale and must not be linked from official
  release notes.

## Reuse, not duplication

This is a distinct, additive integrity system from the WASM artifact
manifest (`08`) — the two serve different layers (public release
artifact vs. internal bundled binary) and this review does not create a
generic third mechanism. No new checksum/signing library or dependency
is required: `SHA256SUMS` generation is a single `sha256sum`
(Linux/macOS) or `Get-FileHash`/`certutil` (Windows) command, or the
SAME `node:crypto` `createHash("sha256")` pattern
`scripts/generate_wasm_artifact_manifest.mjs` already uses (`01`) —
reused conceptually, implemented (not by this review) as a small,
analogous release-packaging script in the next Arc (`19`).
