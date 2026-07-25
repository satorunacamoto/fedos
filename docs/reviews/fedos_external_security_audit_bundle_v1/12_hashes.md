# Hashes

Every hash in this document was **independently, freshly reproduced by
this addendum pass**, in this session, from this exact checkout at
`68e7be16` — not copied from a prior report. Where a hash matches a
previously-recorded value, that match is stated as an independent
confirmation (real reproducibility evidence), not assumed.

## WASM cryptography core artifact

```
sha256sum packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm
10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a
  *packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm

size: 385565 bytes
```

**This is a byte-identical match** to the hash `pilot_release_matrix.md`
(Secure Runtime Alpha 8121-8200) already recorded as confirmed across
"4 independent builds now (2 prior sessions/worktrees + this Arc's own
integration worktree build + a genuinely fresh `C:/wt/fedos-desktop-beta-0.1-release`
worktree build)." **This addendum's own build is now a 5th independent,
byte-identical confirmation**, produced fresh via `npm run build:wasm`
(real `cargo build --release --target wasm32-unknown-unknown` +
`wasm-bindgen --target web`), in a checkout that had never previously
built this artifact this session. This is strong, real evidence the WASM
build is genuinely deterministic across machines/sessions for the
current source, not merely claimed.

## Cargo resolved dependency graph (`Cargo.lock`)

`packages/fedos-core-rust/Cargo.lock` is deliberately gitignored/never
committed (see [`10_dependency_manifest.md`](10_dependency_manifest.md)).
This addendum generated one fresh (via the `cargo build`/`cargo tree`
invocations in [`11_build_manifest.md`](11_build_manifest.md)) and
hashed it:

```
sha256sum packages/fedos-core-rust/Cargo.lock
6bbdadb710b65b517ceb8d671f2bdbf37283d7373a73d0ed8debc1d895368155
  *packages/fedos-core-rust/Cargo.lock
```

**Exact match** to the graph pinned by
`docs/secure_runtime_alpha_8121_8200_cargo_lock_policy_decision.md`
(Reproducibility Finding 4, Secure Runtime Alpha 8121-8200) — the same
SHA-256, the same 82 resolved `package@version` entries. Reproduced here
as an **independent, later, different-session confirmation** that Rust
dependency resolution for this crate remains deterministic against the
same `Cargo.toml`, months (in this project's own internal timeline)
after that graph was first pinned. Full 82-entry list is not repeated
here — see that document directly, or re-run
`cargo tree --prefix none | sort` yourself against the hash above to
verify byte-for-byte before trusting either source.

## WASM artifact manifest

```
packages/fedos-core-rust/pkg/fedos_wasm_artifact_manifest.v1.json
wasmSha256Hex: 10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a
```

Generated fresh this pass by `npm run build:wasm:manifest`; its own
`wasmSha256Hex` field matches the independently-computed `sha256sum`
above exactly (the manifest generator and this review's own hash command
agree, as expected — both hash the same file, this is a consistency
check on the generator script itself, not a second independent build).

## Release artifacts (installer, ZIP, release manifest)

**Not reproduced by this addendum pass** — see
[`11_build_manifest.md`](11_build_manifest.md) §5 for exactly why (the
release-identity resolver refuses to run against this checkout's own
currently-dirty working tree, by design). The most recent real,
independently-verified figures this bundle can cite are from Secure
Runtime Alpha 8121-8200's own Phase N rebuild
(`docs/secure_runtime_alpha_8121_8200_pilot_release_matrix.md`,
already cited by `05_known_issues.md`/`07_reproduction_guide.md`):
real NSIS installer + portable ZIP, independently re-derived checksums
(`sha256sum`, matching the release script's own `SHA256SUMS.txt`
output), confirmed genuinely unsigned, zero secret-scan findings. This
document does not restate those specific artifact hashes verbatim since
they are tied to a specific historical build's own file bytes (installer
contents change with every rebuild, unlike the WASM artifact which is
reproducibly deterministic for unchanged source) — **an external auditor
commissioning a build for the actual audited release should rebuild the
installer/ZIP themselves from a clean tree and record fresh hashes
here**, not reuse Alpha 8121-8200's own figures for a different build.

## Root npm lockfile

```
sha256sum package-lock.json
```
Not computed as a security-relevant artifact hash — `package-lock.json`
is tracked/committed to git, so its own git blob hash
(`git rev-parse HEAD:package-lock.json`) is the more meaningful
integrity reference (ties it to a specific commit, not a loose file).
Recorded here as guidance only: an auditor should diff a fresh `npm ci`
output against the tracked lockfile's own declared versions to confirm
no local drift, rather than hash the file in isolation.

## Summary table

| Artifact | SHA-256 | Reproduced this pass? | Independent confirmations to date |
|---|---|---|---|
| `fedos_core_rust_bg.wasm` | `10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a` | **Yes** | 5 (4 prior + this pass) |
| `packages/fedos-core-rust/Cargo.lock` (82-entry resolved graph) | `6bbdadb710b65b517ceb8d671f2bdbf37283d7373a73d0ed8debc1d895368155` | **Yes** | 2 (Alpha 8121-8200's own pin + this pass) |
| NSIS installer / portable ZIP | (build-specific, not restated here) | No | 1 (Alpha 8121-8200's own Phase N rebuild) — needs a fresh rebuild for the actual audited release |
| Root `package-lock.json` | tracked git blob, not independently hashed | N/A (git-tracked) | Continuous (every `npm ci` against the tracked file) |
