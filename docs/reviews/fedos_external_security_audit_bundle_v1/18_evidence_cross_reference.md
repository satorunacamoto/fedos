# Evidence Cross-Reference

**Different from [`04_evidence_index.md`](04_evidence_index.md)**: that
document indexes *source documents* (which prior review produced which
file, at which commit, merged or not). This document indexes *individual
claims* made across this bundle's own new documents (`08`-`19`) to the
*exact evidence* that backs each one — a command, a file, a test name —
so a reader can verify one specific claim without re-reading an entire
document. Organized by claim, not by document, since that is how an
auditor actually works ("is THIS specific thing true" rather than "what
does this whole file say").

| Claim | Evidence | Where verified |
|---|---|---|
| Current commit under audit is `68e7be16` | `git rev-parse HEAD` | [`09_commit_manifest.md`](09_commit_manifest.md) |
| This bundle's own `00`-`07` are one commit stale (`81305b37`) relative to `08`-`19` | `git show --stat 68e7be16` shows docs-only diff, zero `src/`/`packages/*/src/` changes | [`09_commit_manifest.md`](09_commit_manifest.md) |
| 723 total commits, 0 tags, single author, 164 branches | `git rev-list --count HEAD`, `git tag`, `git log --format=%an \| sort -u`, `git branch -a \| wc -l` | [`09_commit_manifest.md`](09_commit_manifest.md) |
| Root npm project resolves to 94 packages, zero copyleft licenses | Direct read of `package-lock.json`'s own `packages`/`license` fields via a local Node script | [`10_dependency_manifest.md`](10_dependency_manifest.md), [`15_license_inventory.md`](15_license_inventory.md) |
| Electron package npm project resolves to 284 packages, zero copyleft licenses | Same method against `packages/fedos-desktop-electron-spike/package-lock.json` | [`10_dependency_manifest.md`](10_dependency_manifest.md), [`15_license_inventory.md`](15_license_inventory.md) |
| `@noble/curves`/`@noble/hashes` are real production dependencies, not test-only | `grep -rl "@noble/curves\|@noble/hashes" src/` (excluding tests) returns 20+ non-test files; `fedos_deletion_request_signing.ts` imports `schnorr`/`sha256` directly | [`10_dependency_manifest.md`](10_dependency_manifest.md), [`17_crypto_inventory.md`](17_crypto_inventory.md) |
| Rust crate has 11 direct production dependencies (not 10) | Direct `Cargo.toml` read at `68e7be16` | [`10_dependency_manifest.md`](10_dependency_manifest.md), [`17_crypto_inventory.md`](17_crypto_inventory.md) |
| Rust transitive graph: 66 unique crates (normal edges, native target), 77 (incl. dev-deps), 82 (all-targets resolved lockfile) | `cargo tree --edges normal --prefix none \| sort -u \| wc -l`; `cargo tree --prefix none \| sort -u \| wc -l`; freshly-generated `Cargo.lock` | [`10_dependency_manifest.md`](10_dependency_manifest.md) |
| `ecdsa` crate appears in the resolved graph despite `Cargo.toml` not selecting the `ecdsa` feature on `k256` | `cargo tree` output; `grep -rn "::ecdsa\|use ecdsa" packages/fedos-core-rust/src/` returns zero | [`10_dependency_manifest.md`](10_dependency_manifest.md), [`17_crypto_inventory.md`](17_crypto_inventory.md) |
| WASM artifact is byte-identical across independent builds (now 5 total) | `sha256sum packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm` → `10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a`, 385565 bytes, produced fresh this pass via `npm run build:wasm` | [`12_hashes.md`](12_hashes.md) |
| Cargo resolved dependency graph is byte-identical to the Alpha 8121-8200 pinned graph | `sha256sum packages/fedos-core-rust/Cargo.lock` → `6bbdadb710b65b517ceb8d671f2bdbf37283d7373a73d0ed8debc1d895368155`, matching `docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md` exactly | [`12_hashes.md`](12_hashes.md) |
| No release artifact (installer/ZIP) exists in this checkout right now | `find packages/fedos-desktop-electron-spike -maxdepth 1 -iname "release*" -o -maxdepth 1 -iname "dist-package*"` → no matches | [`13_release_artifact_inventory.md`](13_release_artifact_inventory.md) |
| Release pipeline refuses to run against a dirty working tree | `resolveFedosBetaReleaseIdentity()`'s own `gitIsClean()`/`requireClean` logic, read directly in `scripts/lib/release_identity.mjs` | [`11_build_manifest.md`](11_build_manifest.md), [`13_release_artifact_inventory.md`](13_release_artifact_inventory.md) |
| No code-signing certificate is configured; the readiness-assessment logic already exists | `scripts/lib/signing_readiness.mjs` read directly; its own `assessFedosSigningReadiness()` returns `unsigned-allowed-for-beta` given no certificate | [`13_release_artifact_inventory.md`](13_release_artifact_inventory.md) |
| Auto-update is a deliberate Absolute Prohibition, not merely unbuilt | `src/desktop/beta/fedos_desktop_beta_release_configuration.ts`'s own header comment and `autoUpdateEnabled: false` field | [`08_version_manifest.md`](08_version_manifest.md), [`13_release_artifact_inventory.md`](13_release_artifact_inventory.md) |
| No repository-level `LICENSE` file or `package.json` `"license"` field exists | Direct filesystem listing at repo root; `grep -n "\"license\""` on both `package.json` files returns zero matches | [`15_license_inventory.md`](15_license_inventory.md) |
| No CI/CD service is configured | `find .github -type f` and a root-level `*.yml`/`*.yaml` scan both return zero matches | [`16_third_party_inventory.md`](16_third_party_inventory.md) |
| All four on-disk schema versions (settings/profile/capabilityManifest/archive) are `1` | Direct read of `fedos_desktop_beta_release_configuration.ts` and `fedos_conversation_archive_schema_version.ts` | [`08_version_manifest.md`](08_version_manifest.md) |
| `wasm-bindgen-cli` in this environment exactly matches the pinned crate version (`0.2.126`) | `wasm-bindgen --version` output compared against `Cargo.toml`'s own `wasm-bindgen = "0.2.126"` line | [`08_version_manifest.md`](08_version_manifest.md) |

## Cross-references to the PRE-existing bundle (`00`-`07`)

For every claim originating in the earlier documents of this bundle
(architecture, threat model, known issues, disclosure policy,
reproduction guide), use [`04_evidence_index.md`](04_evidence_index.md)
directly — it already performs exactly this function for that material,
at a document (not per-claim) granularity, and this document does not
duplicate it. The two together (04 for document provenance, this file
for specific new claims) give full coverage of the bundle as a whole.

## How to use this table

Pick a row. Run the command in the "Evidence" column yourself, from a
checkout at the commit named in [`09_commit_manifest.md`](09_commit_manifest.md).
If your result differs from what is stated, that is either (a) a real
discrepancy worth reporting immediately (do not assume this document is
right by default — it was produced by an AI-assisted review pass, not an
independent auditor), or (b) a sign the commit you are looking at has
moved since this addendum was written — check
[`09_commit_manifest.md`](09_commit_manifest.md)'s own "one-commit
drift" disclosure as a reminder that this is a real, live possibility in
this repository.
