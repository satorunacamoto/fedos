# Version Manifest

Non-secret, versioned identity facts for the exact build this bundle
describes. Every value below was read directly from its own single
source-of-truth file in this checkout (not hand-copied from a prior
report) at the time this document was written; the source path is given
for each so a future reader can re-derive it rather than trust this
table blindly.

## Product identity

Source: `src/desktop/beta/fedos_desktop_beta_release_configuration.ts`
(`FedosDesktopBetaReleaseConfigurationV1`, `configVersion: 1`).

| Field | Value |
|---|---|
| `productName` | `FedOS Desktop` |
| `version` | `0.1.0-beta.1` |
| `channel` | `beta` |
| `stability` | `beta-release-candidate` (an explicit, honest release-candidate marker — this source file's own header states it is NOT a shipped stable release) |
| `buildIdentity` | `fedos-desktop-beta-0.1.0-beta.1` |
| `minimumSupportedPlatform` | `windows-x64` (the only packaging target in the accepted lineage) |
| `capabilityManifestVersion` | `1` |
| `autoUpdateEnabled` | `false` — this source file's own header names this an **Absolute Prohibition**, not merely an unbuilt feature: the product deliberately does not self-update. An auditor should treat "no auto-update mechanism" as an intentional security/trust boundary (no auto-update code path to compromise), not a gap to recommend closing without a separate product decision. |

## On-disk schema versions

Source: `schemaVersions` block of the same file, plus
`src/conversation/archive/fedos_conversation_archive_schema_version.ts`
(`FEDOS_CONVERSATION_ARCHIVE_SCHEMA_VERSION`).

| Schema | Version |
|---|---|
| Settings | `1` |
| Profile | `1` |
| Capability manifest | `1` |
| Archive bundle | `1` |

All four are `1` — this repository has never shipped a schema migration.
This is consistent with `BUILDING.md`'s own disclosed limitation: no
schema-migration code exists, so a future schema bump has no tested
upgrade path yet.

## WASM artifact manifest identity

Source: `packages/fedos-core-rust/pkg/fedos_wasm_artifact_manifest.v1.json`,
generated fresh by this bundle's own reproduction (see
[`12_hashes.md`](12_hashes.md) for the full hash and build details).

| Field | Value |
|---|---|
| `schemaVersion` | `1` |
| `crateName` | `fedos-core-rust` |
| `crateVersion` | `0.0.0` |
| `capabilityProfile` | `desktop-master-seed-v1` |
| `allowedExports` | `["FedosMasterSeedAuthority", "initSync"]` |
| `compatibilityVersion` | `1` |

## Release manifest schema

Source: `packages/fedos-desktop-electron-spike/scripts/generate_release_manifest.mjs`
and `scripts/lib/release_identity.mjs` (read directly, not executed this
pass — executing it requires a clean working tree, and this bundle's own
new files leave the tree intentionally not clean; see
[`11_build_manifest.md`](11_build_manifest.md)).

`release-manifest.v1.json` (`schemaVersion: 1`) records, at real
release-build time: `productName`, `productVersion`, `channel`,
`releaseSequence` (parsed from the `-beta.N` version suffix — currently
`1`), `gitCommit`, `gitTreeClean`, `buildIdentity`,
`electronPackageVersion`, `wasmArtifactManifest` (the block above, if
present), `schemaVersions`, `minimumSupportedPlatform`, `platform`
(`win32`), `architecture` (`x64`), `unsigned` (always `true` today — no
code-signing certificate is configured anywhere in this build
environment), `createdAt`, and the two curated release artifacts (NSIS
installer + portable ZIP) with per-file `sizeBytes`/`sha256Hex`.
`resolveFedosBetaReleaseIdentity()` **refuses to run against a dirty
working tree by design** (`requireClean` defaults to `true`) — a real,
structural guarantee that a published release manifest was generated
from a fully-committed source state, never from uncommitted local
changes.

## Toolchain versions used to produce this bundle's own evidence

Captured directly from this review's own environment, not assumed from a
prior report (all independently confirmed working — see
[`12_hashes.md`](12_hashes.md) for what was actually built with them):

| Tool | Version |
|---|---|
| Node.js | `v24.15.0` |
| npm | `11.12.1` |
| Rust (`rustc`) | `1.95.0` (`59807616e`, 2026-04-14) |
| Cargo | `1.95.0` (`f2d3ce0bd`, 2026-03-21) |
| `wasm-bindgen-cli` | `0.2.126` — **exact match** to the pinned `wasm-bindgen = "0.2.126"` direct dependency in `packages/fedos-core-rust/Cargo.toml`, which `docs/runtime_wasm_bindgen_version_policy.md` documents as a real, historical failure mode when mismatched. |
| Electron | `43.1.1` (`packages/fedos-desktop-electron-spike/package.json` devDependency, `^43.1.1`) |
| electron-builder | `26.15.3` (same file, `^26.15.3`) |

No `package.json` in this repository declares an `engines` field for
Node/npm — the versions above are what this review's own environment
happened to provide, not a pinned, enforced requirement. An external
auditor should not assume a different Node/npm version is unsupported,
only that it is unverified by this repository's own tooling.
