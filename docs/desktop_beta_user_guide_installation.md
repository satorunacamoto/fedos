# FedOS Desktop Beta — Installation Guide

## From a pre-built release artifact

If you were given a release ZIP or NSIS installer, run/extract it as you
would any other Windows application. **These artifacts are unsigned unless
independently verified otherwise for the specific copy you received** —
Windows SmartScreen may warn you; this is expected for an unsigned Beta
build, not itself proof of tampering, but you should only run a build you
obtained from a source you trust.

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
