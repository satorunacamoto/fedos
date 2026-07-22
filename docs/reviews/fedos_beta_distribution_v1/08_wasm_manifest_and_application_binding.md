# 08 — WASM Manifest and Application Binding

## The existing mechanism (proven current source — reused verbatim, not redesigned)

`src/desktop/production_activation/fedos_production_wasm_artifact_manifest.ts`
already defines and enforces the complete binding between the packaged
application, the compiled WASM artifact, its generated JS glue, and a
pinned manifest:

- **Build identity**: `FEDOS_PRODUCTION_MASTER_SEED_CAPABILITY_PROFILE =
  "desktop-master-seed-v1"` — the one reviewed capability profile the
  production Desktop path accepts.
- **Manifest version**: `FEDOS_PRODUCTION_WASM_MANIFEST_SCHEMA_VERSION = 1`
  and `FEDOS_PRODUCTION_WASM_COMPATIBILITY_VERSION = 1`, both checked by
  strict equality (`verifyFedosProductionWasmArtifactManifest`) —
  anything else is `"schema-unsupported"`/`"version-incompatible"`.
- **Expected filenames**: `fedos_core_rust_bg.wasm` /
  `fedos_core_rust.js` (from `scripts/generate_wasm_artifact_manifest.mjs`,
  `01`), recorded in the manifest itself as `wasmFilename`/`jsGlueFilename`.
- **Hashes**: `wasmSha256Hex` — a lowercase-hex SHA-256 of the exact
  `.wasm` bytes, generated at build time and RE-COMPUTED (never merely
  read) at verify time via `fedosWasmArtifactSha256Hex()`. Filenames are
  explicitly documented as "never trusted alone" — the hash is the
  binding authority.
- **Allowed exports**: `FEDOS_PRODUCTION_MASTER_SEED_ALLOWED_EXPORTS =
  ["FedosMasterSeedAuthority", "initSync"]` — the exact, closed set of
  module-level exports the production facade is permitted to touch;
  verification fails `"export-missing"` if any expected export is absent
  from the loaded glue module, and the facade never reads any OTHER
  export or the module namespace itself.
- **Package layout**: the manifest lives alongside the `.wasm`/`.js` in
  `packages/fedos-core-rust/pkg/` in a dev checkout, and (via
  `electron_builder.beta.config.json`'s `extraResources`) at
  `resources/fedos-core-rust/pkg/` in a packaged build (`01`) — verified
  by direct inspection of a real packaged tree in a prior session.
- **Verification timing**: at production-unlock time (inside
  `activateFedosProductionProfileMasterSeed()`/the production activation
  chain the Coordinator calls) — before any Master Seed operation is
  permitted, never deferred or skipped.
- **Failure behavior**: any of `manifest-malformed` /
  `schema-unsupported` / `version-incompatible` / `capability-not-allowed`
  / `hash-mismatch` / `export-missing` fails CLOSED — production
  activation reports `"blocked"` (never falls back to a dev/fake
  authority; prior execution evidence across multiple sessions confirms
  this exact behavior when the artifact is absent, e.g.
  `activation blocked (artifact-missing)`).
- **Stale artifact behavior**: a stale/mismatched `.wasm` (wrong hash for
  its own recorded manifest) is rejected the same way as a missing one —
  `hash-mismatch`, fails closed.
- **Upgrade compatibility**: a NEW release with a rebuilt WASM artifact
  gets a freshly regenerated manifest (new hash, same schema/compat
  version if the crate's own public export surface is unchanged) — the
  verification code re-checks on every load, so an upgraded package
  naturally re-verifies its own newly-bundled pair; no separate "upgrade
  the manifest" step exists or is needed.
- **Downgrade behavior**: a downgrade to an OLDER package still carries
  ITS OWN matching manifest/artifact pair (both are built and packaged
  together, `01`) — verification would still pass for that older pair on
  its own terms. Whether the OLDER package's own resulting Master Seed
  data is compatible with a profile last touched by a NEWER package is a
  separate question, governed by `11`/`13` (schema/rollback policy), not
  by this manifest mechanism.

## No second competing integrity system

This review does not invent a new WASM-binding mechanism. `07`'s release
artifact checksum policy is explicitly a SEPARATE, complementary layer
(public release-artifact integrity) from this INTERNAL, already-built,
already-verified binding (application-to-WASM integrity) — the two are
never merged, and no new manifest format, hash algorithm, or verification
code path is proposed here.
