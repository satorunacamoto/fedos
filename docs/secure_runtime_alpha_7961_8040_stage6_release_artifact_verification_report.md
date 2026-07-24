# Secure Runtime Alpha 7961–8040 — Stage 6: Release Artifact Verification Report

Ran the real, existing release pipeline (`node scripts/build_release.mjs`,
Alpha 5241-5320's own deterministic sequential pipeline, unmodified) from
the clean, fully-landed integration branch, at commit `096459b6`.

## Sequence executed (all 9 steps, all real, none skipped)

1. Clean working tree verified (`git status --porcelain` empty).
2. Package allowlist verified — no forbidden path in
   `electron_builder.beta.config.json`'s own `files`/`extraFiles`/`extraResources`.
3. Root `build:beta-runtime` `dist/` graph built.
4. Electron package built (main/preload/renderer/static assets).
5. `electron-builder` produced BOTH real artifacts: NSIS installer + portable
   ZIP, Electron 43.1.1, win32/x64.
6. Release manifest generated (`release-manifest.v1.json`).
7. Release checksums generated (`SHA256SUMS.txt`, 3 files).
8. Release checksums independently re-verified (re-derived, not merely
   re-read) — OK.
9. Staging inputs scanned for prohibited content — **0 findings across 752
   staging files**.

## Artifacts produced (real, this session)

| Artifact | Type | Size | SHA-256 |
|---|---|---|---|
| `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` | NSIS installer (primary) | 101,805,947 bytes | `03e308188cfcf7dd70b8b59f4916804dcfc8aa21514b46ecb609fa06725be8f8` |
| `FedOS Desktop Beta-0.1.0-beta.1-win.zip` | Portable ZIP | 368,379,324 bytes | `1f27bbdbb3aba0aed1bd3fa1f7ad9753371cc543f90c6bb9c0582258810ba5f4` |
| `release-manifest.v1.json` | Manifest | — | `12858790ea677195bb4b3604601f6577eafc9ccc3f3e520791c32355fe1bd2da` |

## Verification checklist

- **Canonical Beta entry point**: `fedos_electron_beta_main.cjs`, confirmed
  (the SAME entry point every real vertical slice this session used).
- **Real WASM included**: confirmed — `wasmArtifactManifest.wasmSha256Hex`
  (`10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a`) in
  the release manifest MATCHES the real, freshly-built
  `packages/fedos-core-rust/pkg/fedos_wasm_artifact_manifest.v1.json`'s own
  hash exactly.
- **Version consistent across installer/ZIP/manifest**: `0.1.0-beta.1`
  everywhere (filenames, `productVersion`, `buildIdentity`).
- **No development seed double**: `electron_builder.beta.config.json`
  contains zero references to `AUTOTEST`; the one `AUTOTEST_MODE` mention
  remaining in `fedos_electron_beta_main.cts` is a comment documenting that
  `requireShell()` no longer requires it (Alpha 7321-7400's own fix).
- **No AUTOTEST-only product dependency**: confirmed by the same check —
  no packaging config reference.
- **No fixture credentials / absolute worktree path / signing material
  leak**: confirmed by the pipeline's own real secret scan (0 findings,
  752 files) AND by direct inspection of `release-manifest.v1.json`
  (every path recorded is a bare filename, no `C:\wt\...` or any absolute
  path appears anywhere in the manifest).
- **Checksums independently recompute**: confirmed by the pipeline's own
  Step 8 (`verify_release_checksums.mjs` re-derives every hash from the
  actual file bytes, does not merely echo Step 7's own output).
- **`package.json`/config restored after packaging**: confirmed —
  `git status --porcelain` is empty immediately after the full pipeline
  run (the snapshot/restore wrapper `run_electron_builder_package_beta.mjs`
  worked correctly).
- **Generated binaries remain uncommitted**: confirmed — `dist-package-beta/`
  (802 MB) and `release/` (449 MB) were both cleaned after this
  verification, per this Arc's own commit policy; neither was ever staged.
- **Unsigned Beta disclosure**: `unsigned: true` in the manifest, matching
  the existing, already-accepted distribution policy for this pre-release
  channel (no production signing certificate evidence exists in this
  environment) — never claimed as signed.

## Conclusion

The real release pipeline runs cleanly end to end from the landed
integration branch, produces two real, checksummed, correctly-versioned
artifacts with the real WASM artifact embedded and verified, and leaves
zero secret/path/credential leakage across 752 scanned staging files.
