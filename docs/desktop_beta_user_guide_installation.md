# FedOS Desktop Beta — Installation Guide

## From a pre-built release artifact

If you were given a release ZIP or NSIS installer, run/extract it as you
would any other Windows application. **These artifacts are unsigned unless
independently verified otherwise for the specific copy you received** —
Windows SmartScreen may warn you; this is expected for an unsigned Beta
build, not itself proof of tampering, but you should only run a build you
obtained from a source you trust.

### Verifying your download

A checksum match tells you the file you have is byte-identical to what
the release pipeline produced from a known, clean source commit — it does
**not** substitute for code signing and does **not** prove the person
who gave you the file is trustworthy. Only treat a checksum as meaningful
if it came to you through a channel independent of the artifact itself
(never trust a checksum posted next to the download link on the same
untrusted page).

Every release ships two artifacts plus one manifest, named exactly:

- `FedOS-Desktop-Beta-Setup-<version>.exe` — the NSIS installer (primary).
- `FedOS Desktop Beta-<version>-win.zip` — the portable ZIP.
- `release-manifest.v1.json` — records the exact source `gitCommit`,
  product version, and per-artifact SHA-256/size this specific build was
  produced from.

Alongside them, `SHA256SUMS.txt` lists one `<64-hex-lowercase>  <filename>`
line per artifact (including the manifest itself). To verify a downloaded
file on Windows:

```powershell
Get-FileHash "FedOS-Desktop-Beta-Setup-<version>.exe" -Algorithm SHA256
```

Compare the printed hash (case-insensitively) against the matching line
in `SHA256SUMS.txt`. A mismatch means the file was altered or corrupted
in transit — do not run it.

## From source (for developers/testers)

This build requires a real, locally-compiled WASM cryptography artifact —
it is never bundled pre-built in the source checkout, and the app fails
closed (never falls back to a placeholder) if it is missing:

```
npm install
npm run build:wasm
npm run build:wasm:manifest
cd packages/fedos-desktop-electron-spike
npm install
npm run package:beta
```

The packaged app appears under
`packages/fedos-desktop-electron-spike/release/`.

## First launch

See the First-Run Guide (`docs/desktop_beta_user_guide_first_run.md`) for
what happens the first time you open the app.
