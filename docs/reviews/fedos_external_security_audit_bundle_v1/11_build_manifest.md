# Build Manifest

The exact, real build steps this bundle's own evidence was produced
with, and their outcome, this pass. This is a structured record of *what
was actually run and what it produced*; for prose "how to do this
yourself" guidance see [`07_reproduction_guide.md`](07_reproduction_guide.md)
(unchanged, inlined from prior review work) and the canonical
`BUILDING.md` (added by the Documentation Consolidation, `68e7be16`).

## Step 1 — WASM cryptography core

```
npm run build:wasm
```

Expands to:

```
cargo build --manifest-path packages/fedos-core-rust/Cargo.toml \
  --target wasm32-unknown-unknown --release
wasm-bindgen --target web --out-dir packages/fedos-core-rust/pkg \
  packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm
```

**Run for real this pass, from this exact working tree, at `68e7be16`.**
Result: `Finished \`release\` profile [optimized] target(s) in 57.08s`,
zero errors, zero warnings surfaced. Output:
`packages/fedos-core-rust/pkg/{fedos_core_rust.js, fedos_core_rust.d.ts,
fedos_core_rust_bg.wasm, fedos_core_rust_bg.wasm.d.ts}`. Full hash
verification in [`12_hashes.md`](12_hashes.md).

## Step 2 — WASM artifact manifest

```
npm run build:wasm:manifest
```

Expands to `node scripts/generate_wasm_artifact_manifest.mjs`. **Run for
real this pass.** Output:
`[manifest] wrote .../packages/fedos-core-rust/pkg/fedos_wasm_artifact_manifest.v1.json`,
`wasm sha256 = 10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a`,
`wasm bytes = 385565` — see [`08_version_manifest.md`](08_version_manifest.md)
for the manifest's own recorded fields.

## Step 3 — Rust native test suite

**NOT run to completion by this specific addendum pass** (a prior bundle
document, [`07_reproduction_guide.md`](07_reproduction_guide.md), and the
original audit-prep base package (`8e730f25`'s own Appendix) already ran
`cargo test --release` to completion from a fresh worktree and recorded
**639 passed / 1 failed / 0 ignored**, the 1 failure being the
already-disclosed, non-security `cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`
count-drift test debt (10 vs the real, current 11 direct production
crates). This pass instead independently re-derived the dependency
count and the resolved-graph hash directly ([`10_dependency_manifest.md`](10_dependency_manifest.md),
[`12_hashes.md`](12_hashes.md)) rather than re-running the full suite —
an auditor with time budget should still re-run `cargo test --release`
themselves rather than rely on a prior pass's cached result, per this
bundle's own general discipline of re-verifying rather than trusting
older numbers.

## Step 4 — TypeScript typecheck

**NOT run by this addendum pass.** `npm run typecheck` requires
`node_modules` in both the root and
`packages/fedos-desktop-electron-spike/` — both are present in this
checkout already (pre-existing from an earlier session), so this was a
real option this pass chose not to exercise given the scope was
dependency/hash/manifest verification specifically. Recorded as an open
item in [`19_reviewer_checklist.md`](19_reviewer_checklist.md).

## Step 5 — Electron package build / packaged release artifacts

**NOT run by this addendum pass — and could not have succeeded even if
attempted.** `packages/fedos-desktop-electron-spike/scripts/lib/release_identity.mjs`'s
`resolveFedosBetaReleaseIdentity()` calls `gitIsClean()` and, by design
(`requireClean` defaults to `true`), **throws rather than proceed** if
`git status --porcelain` is non-empty. This checkout's working tree is
**not clean** at the time of this addendum — this bundle's own new
files (`08`-`19` here, plus a concurrently-in-progress sibling review,
`docs/reviews/fedos_public_beta_go_no_go_validation_v1/`, and this
repository's own separate Public Beta Readiness review,
`docs/reviews/fedos_public_beta_readiness_v1/`) are themselves
uncommitted at this moment. **This is not a defect in the release
pipeline — it is the pipeline's own accepted V1 policy working exactly
as designed** ("dirty-tree public release artifacts are forbidden"),
and it is precisely why this document reports the release
manifest/artifact schema by reading the generator scripts directly
([`08_version_manifest.md`](08_version_manifest.md),
[`13_release_artifact_inventory.md`](13_release_artifact_inventory.md))
rather than by claiming to have produced a fresh signed manifest this
pass. The most recent REAL, independently-verified release build this
bundle can cite is Secure Runtime Alpha 8121-8200's own Phase N rebuild
(`739fb3e8`) — see [`13_release_artifact_inventory.md`](13_release_artifact_inventory.md)
for exactly what that run produced and verified.

## Step 6 — Fresh-worktree `node_modules` provisioning

Not needed this pass (both `node_modules` trees pre-existed in this
checkout). For a genuinely fresh clone, `BUILDING.md`'s own documented
junction technique (link a new worktree's `node_modules` to an
already-provisioned sibling's, after verifying `package-lock.json`
hashes match) avoids a slow, potentially-divergent `npm install` — real,
used across many prior Arcs, not invented for this bundle.

## Summary table

| Step | Command | Run this pass? | Result |
|---|---|---|---|
| WASM core build | `npm run build:wasm` | **Yes** | Success, byte-identical hash (§12) |
| WASM manifest | `npm run build:wasm:manifest` | **Yes** | Success, schema fields recorded (§08) |
| Rust test suite | `cargo test --release` | No (cited from prior pass) | 639/640, 1 known-disclosed failure |
| TS typecheck | `npm run typecheck` | No | Open item, §19 |
| Electron build/package | `npm run package:beta` / `release:beta` | No — blocked by dirty-tree policy | Cited from prior verified run (§13) |
| npm dependency resolution | `npm ci` (both projects) | No (already provisioned) | N/A this pass |

**Honesty note, matching this repository's own established review
convention**: every row above marked "No" is stated as such explicitly,
never silently assumed successful. Rows marked "Yes" are this specific
addendum's own real, freshly-executed, this-session evidence — not
cited from any earlier report.
