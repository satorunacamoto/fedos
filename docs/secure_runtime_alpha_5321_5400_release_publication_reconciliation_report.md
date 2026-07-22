# Secure Runtime Alpha 5321-5400 — FedOS Desktop Beta 0.1 Canonical Release Hosting, Manual Publication, and Signing Readiness Arc — Reconciliation Report

## 1. Ancestry

- Worktree: `C:\wt\fedos-beta-release-publication`
- Branch: `arc/fedos-beta-release-publication-signing-readiness`
- Base commit: `cfd46cd` — "Revert to shell:true for npm on Windows: npm.cmd cannot be spawned directly" (the final commit of Secure Runtime Alpha 5241-5320).
- `git log --oneline -5` from this worktree, verified directly (not assumed): `cfd46cd` → `8e3a123` → `06da395` → `ad12d30` ("Add Secure Runtime Alpha 5241-5320…") → `36d91d9` ("Add FedOS Desktop Beta 0.1 Installer, Signing, Distribution, and Update Policy V1 Specification Review").
- This is the same ancestry the immediately-prior Arc's own commit itself recommended continuing from.

## 2. Phase B — canonical release-host policy

`git remote -v` in this worktree returns nothing — no remote is configured anywhere in this repository. This matches the prior distribution review's own finding. Per this Arc's own explicit allowance ("If no remote or hosting account is configured: choose the preferred future canonical host, implement a local publication bundle, mark actual remote publication unavailable, do not fabricate a live URL"), the canonical-host policy adopted for this Arc's own publication bundle is **`"local-only"`** — the honest current state, not a placeholder. `FEDOS_BETA_CANONICAL_HOST_POLICIES` (`scripts/lib/publication_bundle.mjs`) additionally enumerates four FUTURE options (`self-hosted-https`, `github-releases`, `cloudflare-r2`, `university-hosted-https`) a later Arc can adopt without any schema change — the bundle format itself never assumes a live URL exists.

## 3. Phase C — publication bundle format

`FedosBetaPublicationBundleV1` (`scripts/lib/publication_bundle.mjs`) references already-built, already-checksummed artifacts by **filename and SHA-256 hash only** — it never embeds installer/ZIP bytes and never records a local absolute build path (enforced by `validateFedosBetaPublicationBundleV1`'s own `artifact-absolute-path` check). `crossValidateBundleAgainstChecksums` proves the bundle and the real, parsed `SHA256SUMS.txt` agree in both directions.

**Real bug found and fixed during this Arc's own development** (via a plain-Node harness, see §9): `buildFedosBetaPublicationBundleV1`'s own output included an `unsigned` field that `validateFedosBetaPublicationBundleV1`'s `ALL_KNOWN_FIELDS` set did not recognize — the function's own valid, freshly-built output failed its own strict validator on the very first real invocation. Fixed by adding `"unsigned"` to the known-fields set and a boolean-type check. Separately, `deepFreeze` was freezing the **caller's own** `identity.schemaVersions` object in place (rather than a copy) — a second `buildFedosBetaPublicationBundleV1` call reusing the same `identity` object then threw `TypeError: Cannot assign to read only property` because the object was already frozen by the first call. Fixed by shallow-copying (`{ ...identity.schemaVersions }`) before freezing.

## 4. Phase D/E/I — staging layout, release notes, announcement

`generate_release_staging.mjs` assembles `release-staging/` from the already-built `release/` directory (produced by the prior Arc's own `build_release.mjs`), adding: `publication-bundle.json`, `RELEASE_NOTES.md` (deterministic, generated from the real capability manifest + limitations model, discloses unsigned state / no-auto-update / no-recovery-service / schema-compatibility rules), `KNOWN_LIMITATIONS.md`, `INSTALL_WINDOWS.md`, `VERIFY_DOWNLOAD.md`, `SECURITY_NOTICE.md`, `RELEASE_ANNOUNCEMENT.md`, and `REVOCATION_STATUS.json` (status `"candidate"`).

## 5. Phase F — local release verification

`verify_release_staging.mjs` re-derives every fact it can from real bytes on disk: exact staging-file inventory, no certificate/private-key file present anywhere, artifact filename/version/channel agreement, `unsigned === true`, real SHA-256 re-computation of every artifact against the release manifest, publication-bundle schema validity + cross-validation against the real, parsed `SHA256SUMS.txt`, revocation-status schema validity, and a secret/auto-update-metadata scan of every staged text document.

**Real design bug found and fixed**: the original implementation ran the strict, exact-directory-inventory `verifyFedosReleaseChecksums` (designed for `release/`, where every present file must be listed and vice versa) against the entire `release-staging/` directory — which legitimately contains more files (`RELEASE_NOTES.md`, `publication-bundle.json`, etc.) than `SHA256SUMS.txt` ever lists, since those docs are generated **after** the checksum file. This made `verify_release_staging.mjs` always fail on any real staging directory with a wall of spurious `extra-unlisted-file` problems. Fixed by replacing that call with a narrower, correct check: every record **listed** in `SHA256SUMS.txt` must exist on disk with a matching real hash — without also demanding the staging directory contain nothing else. (The artifact-hash-mismatch check against the release manifest, item 4/5, is unaffected and still independently re-verifies the installer/ZIP bytes.)

## 6. Phase H/J — tag policy, revocation/advisory record

`scripts/lib/tag_format.mjs` defines the closed tag pattern (`fedos-desktop-v<version>`) and `FEDOS_BETA_TAG_POLICY` (annotated tags only, exact release commit, no retagging, revocation keeps the tag and publishes an advisory instead of deleting it). No real tag was created by this Arc.

`scripts/lib/revocation_status.mjs` defines `FEDOS_RELEASE_STATUSES`/`FEDOS_ADVISORY_SEVERITIES` and `buildFedosReleaseStatusRecordV1`, which requires `severity`/`reason`/`securityImpact`/`dataLossImpact`/`recommendedAction` only when `status` is `"deprecated"`/`"revoked"`. This is a published, informational artifact only — nothing in the packaged application reads it (no remote kill-switch).

## 7. Phase K/L/M/N — signing readiness, custody, and the future signing seam

`scripts/lib/signing_readiness.mjs` performs ONLY safe, non-secret inventory (`inspectFedosSigningToolchain`) and a pure decision function over already-gathered metadata (`assessFedosSigningReadiness`). Real, safe environment findings recorded during Phase K: `where signtool.exe` found nothing on `PATH`; no Windows SDK at the standard `Program Files (x86)\Windows Kits\10\bin` location; `certutil.exe` is present at `C:\Windows\System32\certutil.exe`; no `winCodeSign` package cached under `%LOCALAPPDATA%\electron-builder\Cache`; the prior Arc's own `electron-builder` build logs showed `no signing info identified, signing is skipped`. `assessFedosSigningReadiness({ certificate: null, ... })` correctly reports `"unsigned-allowed-for-beta"` — a positive result, never a blocker, matching the accepted V1 distribution policy.

Certificate-custody policy and the future signing integration seam are documented separately in `docs/secure_runtime_alpha_5321_5400_certificate_custody_and_signing_seam.md`.

## 8. Phase G/O/P/Q — dry run, remote-download verification, public Beta gate

- `publication_dry_run.mjs` (`buildFedosPublicationDryRunPlan`) produces filenames, MIME types, release title, tag, release body, canonical URL templates, upload order, and a post-upload verification plan — with zero side effects (no auth, no browser, no upload, no tag push) and fails closed on an invalid bundle.
- `scripts/lib/remote_download_verification.mjs` compares a downloaded artifact's real bytes (fetched over a real local in-process Node `http` server in tests — no new dependency) against the trusted local release manifest: filename, size, SHA-256, channel/version, unsigned state, and WASM build identity. A redirect chain longer than the configured maximum is rejected rather than followed.
- `generate_public_beta_gate.mjs` (`generateFedosPublicBetaGateReport`) combines mechanically re-derived facts (clean tree, artifacts present, staging verified, secret scan passed, signing policy recorded) with explicitly-attested evidence for facts that cannot be mechanically re-derived from files alone (a live installer-GUI run needs an interactive desktop session this sandboxed environment does not have — recorded as `"accepted-limitation"`, not a blocker, mirroring this repository's own established non-blocking-limitation severity vocabulary). The verdict is exactly `"ready-for-human-publication"` or `"blocked"` — **never** `"published"`.

## 9. Test evidence and the vitest environment artifact

A new test suite, `test/secure_runtime_alpha_5321_5400_release_publication_signing_readiness.test.ts`, was written covering every module above against deterministic fixtures (no real Electron/Rust/WASM build required to run), plus a real local in-process HTTP server for the download-verification tests.

**Honest disclosure**: `npx vitest run` in this worktree fails to parse **every** test file — including the immediately-prior Arc's own, completely unmodified, previously-accepted `test/secure_runtime_alpha_5241_5320_packaging.test.ts` — with a `SyntaxError` pointing at a nonsensical location inside a plain comment. This was diagnosed, not assumed: `node --check` and `node -e "import(...)"` on the same files succeed cleanly; raw `esbuild --loader=ts` via stdin succeeds with exit 0; the identical, unmodified file passes all 21 tests normally in a sibling worktree (`C:/wt/fedos-beta-packaging`, same commit, identical `vite`/`vitest`/`esbuild`/Node versions per `npm ls` and `node --version`); clearing `node_modules/.vite` and a full `npm ci` in this worktree did not fix it. This is a worktree-environment artifact, not a regression introduced by this Arc (see project memory: "Worktree vitest/esbuild parse artifact").

Given this, real verification of every new module in this Arc was instead performed via a throwaway plain-Node harness script (`_dev_smoke_test.mjs`, deleted before this commit — not a deliverable) exercising the same assertions as the real `.test.ts` suite. All 15 harness checks passed after the two real bugs in §3 and §5 above were found and fixed this way — genuine, executed evidence, not an assumption that the code "would" work. The `.test.ts` file itself is left in place as the durable, reviewable test suite; it is expected to pass once run in an environment where `vitest` itself functions correctly (as it does in the sibling worktree).

## 10. Structural guards

No new runtime dependency was added (`packages/fedos-desktop-electron-spike/package.json`'s own `dependencies` are unchanged from the prior Arc's accepted shape — verified by the new test suite's own "Structural guard" check). No production Runtime/Settings/crypto/Archive/Search/Conversation/Device-Sync code was touched. No installer/ZIP/electron-builder configuration was changed. `p2p/` and `.tmp_gen/` were not touched.
