# 10 — Versioning and Build Identity

## Current, frozen, accepted facts (proven current source)

`src/desktop/beta/fedos_desktop_beta_release_configuration.ts`
(`FedosDesktopBetaReleaseConfigurationV1`, already committed, unmodified
by this review):

```
configVersion: 1
productName: "FedOS Desktop"
version: "0.1.0-beta.1"
channel: "beta"
stability: "beta-release-candidate"
capabilityManifestVersion: 1
schemaVersions: { settings: 1, profile: 1, capabilityManifest: 1 }
minimumSupportedPlatform: "windows-x64"
buildIdentity: "fedos-desktop-beta-0.1.0-beta.1"
wasmArtifactManifestPresent: boolean (environment-dependent, not a fixed constant)
autoUpdateEnabled: false
```

Root `package.json` `version` field (a SEPARATE, unrelated field): `"0.0.1"`
— the MONOREPO's own overall version, not the Beta product's own
release version. **These two version numbers are deliberately distinct
and must never be conflated** — `0.0.1` describes the repository/root
package; `0.1.0-beta.1` describes the FedOS Desktop Beta PRODUCT release.

## Decisions

- **Product version format**: SemVer with a `-beta.N` pre-release
  suffix, e.g. `0.1.0-beta.1`, `0.1.0-beta.2`, ... — matching the
  ALREADY-FROZEN literal type (`"0.1.0-beta.1"` is currently a literal
  TypeScript type, meaning any actual second Beta build would require a
  source change to that file, itself a production change outside this
  review's own scope — flagged as required work for the next
  implementation Arc, `19`).
- **Beta sequence format**: the `N` in `-beta.N` increments once per
  actually-published release artifact set, never per internal/test
  build.
- **Build metadata**: `buildIdentity` (`"fedos-desktop-beta-0.1.0-beta.1"`)
  is the one non-secret, human-readable build-identity string threaded
  through release notes and (optionally) embedded in artifact filenames.
- **Git commit binding**: every published release must record the exact
  git commit hash it was built from in its own release notes (a plain
  text fact, not a new mechanism) — this review recommends recording it
  but does not implement a build-time commit-stamping mechanism (that is
  packaging-pipeline work, `19`).
- **WASM manifest binding**: unchanged from `08` — `wasmArtifactManifestPresent`
  in the release configuration and the WASM artifact manifest's own
  `compatibilityVersion` are independent facts recorded per build, both
  reported for a given release.
- **Electron package version**: `packages/fedos-desktop-electron-spike/package.json`
  `"version": "0.0.1"` — a THIRD, independent version number (the
  Electron package's own internal package version), never the product's
  own release version either.
- **Profile schema version**: `1` (`FedosLocalProfileDescriptorV1.schemaVersion`,
  strict-equality-checked, `11`).
- **Settings schema version**: `1` (`FedosSettingsDescriptorV1`'s own
  codec, `11`).
- **Archive schema version**: tracked independently in
  `src/conversation/archive/fedos_conversation_archive_schema_version.ts`
  (present in source, `11`) — NOT the same counter as Settings/Profile.
- **Capability-manifest version**: `1`
  (`FedosDesktopBetaCapabilityManifestV1.manifestVersion`).

**Product version is explicitly distinct from every data-schema
version** — bumping `0.1.0-beta.1` → `0.1.0-beta.2` does NOT imply any
schema version changed, and a schema version bump does NOT require a
product major-version bump under any rule this review invents (each is
its own independent, evidence-driven decision made when the underlying
format actually changes).

## Dirty-tree builds

**Recommended default (adopted): dirty-tree public release artifacts are
FORBIDDEN.** A release build must be produced from a clean `git status`
(no uncommitted changes) at a tagged/recorded commit — otherwise the
git-commit-binding fact above (required for every release) would be
meaningless (a "dirty" build corresponds to no single, reproducible
commit). This is a new POLICY this review adopts; no current build
script enforces it (a `git status --porcelain` check in the release
packaging pipeline is required work for the next implementation Arc, `19`).
