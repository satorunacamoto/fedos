# Closed Pilot Release Candidate — Manifest

Everything here was **measured**, not copied from a prior report. The
generated machine-readable manifest is
`packages/fedos-desktop-electron-spike/release/release-manifest.v1.json`
(not committed — the repository's release policy keeps build output
untracked, and `.gitignore` enforces it).

---

## 1. Source

| | |
| --- | --- |
| **Source commit** | `06765ab37d76e9e96f08deff7cf1cdcad7cbac6a` |
| Branch | `release-prep/fedos-oss-closed-pilot` |
| Base | `4bd79d11` (`master`) |
| Working tree at build | **clean** — enforced by the pipeline's own step 1/9, which refuses to build from a dirty tree |
| Product version | `0.1.0-beta.1` |
| Channel | `beta` |
| Platform / arch | `win32` / `x64` |

## 2. Toolchain — verified against the repository's pins

| Tool | Required | Actual | |
| --- | --- | --- | --- |
| Node.js | `>=24.0.0 <25.0.0` (`engines`) | **24.15.0** | ✅ |
| npm | `11.12.1` (`packageManager`) | **11.12.1** | ✅ |
| Rust | `1.95.0` (`rust-toolchain.toml`) | **1.95.0** (`59807616e`, 2026-04-14) | ✅ |
| Cargo | — | **1.95.0** (`f2d3ce0bd`, 2026-03-21) | ✅ |
| wasm-bindgen | `0.2.126` (`Cargo.toml`) | **0.2.126** | ✅ |
| electron | `^43.1.1` | 43.x from lockfile | ✅ |
| electron-builder | `^26.15.3` | 26.x from lockfile | ✅ |

## 3. Dependency provenance

Both npm installs used **`npm ci`** — lockfile-exact, not `npm install`:

- root `package-lock.json` — committed ✅
- `packages/fedos-desktop-electron-spike/package-lock.json` — committed ✅
- **`Cargo.lock` — NOT committed** (git-ignored). Rust dependency
  resolution at build time is therefore **not pinned**, and this build is
  not reproducible with respect to crate versions. See
  [`00_publication_reconciliation.md`](00_publication_reconciliation.md)
  Finding 4.

**Advisories:** `npm audit` → 5 (1 critical, 1 high, 3 moderate), all in
`vitest`/`vite`/`esbuild`. **`npm audit --omit=dev` → 0
vulnerabilities.** Nothing in the shipped tree is affected.

## 4. WASM core

| | |
| --- | --- |
| Path | `packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm` |
| Size | 385,565 bytes |
| **SHA-256** | `10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a` |

**Provenance verified end-to-end:** the hash of the WASM as built from
Rust source is byte-identical to the copy inside the packaged
application at
`resources/fedos-core-rust/pkg/fedos_core_rust_bg.wasm` — checked
directly, not inferred from the build log.

> The generated manifest records `"wasmArtifactManifest": null`. The
> WASM *is* built and packaged (hash above); this field refers to the
> separate `build:wasm:manifest` provenance file, which this build did
> not produce. Noted so the null is not mistaken for a missing artifact.

## 5. Artifacts

Both **UNSIGNED**.

### NSIS installer (primary)

| | |
| --- | --- |
| Filename | `FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe` |
| Size | 101,848,774 bytes |
| **SHA-256** | `b4e9f48f8c9410094ca7d72258cd1ce65328435f4b9f7519bef9c26e489f4770` |
| Authenticode | **`NotSigned`** — measured, no signer certificate |

### Portable ZIP

| | |
| --- | --- |
| Filename | `FedOS Desktop Beta-0.1.0-beta.1-win.zip` |
| Size | 368,564,879 bytes |
| **SHA-256** | `475b00a13757a8e3c3099cb380002ca44a8ab9aaabda1c8d3398b567bf5c5178` |

Build timestamp: **2026-07-25T18:40:20Z** — **non-reproducible
metadata**, recorded for traceability only. It is embedded in the
artifacts and is one reason §8 makes no reproducibility claim.

## 6. Verification performed

| Check | Result |
| --- | --- |
| Clean-tree gate (step 1/9) | ✅ enforced — an earlier attempt was correctly **refused** from a dirty tree |
| Package allowlist (2/9) | ✅ no forbidden path; re-run after the license-packaging change |
| Checksums generated + verified (7–8/9) | ✅ 3 files |
| **Checksums independently recomputed** | ✅ `sha256sum` run separately against both artifacts — **match** |
| Authenticode | ✅ `NotSigned` on both the installer and the inner `FedOS Desktop Beta.exe` |
| Secret scan of staging inputs (9/9) | ✅ 751 files, **0 findings** |
| WASM hash source → package | ✅ identical |
| Packaged `LICENSE.txt` vs repo `LICENSE` | ✅ **byte-identical** |
| `cargo test --release` | 639 passed, **1 known pre-existing failure** (§7) |
| `npm run typecheck:core` | 4 pre-existing errors, all under `test/` — **identical count** with changes reverted |

### Package contents

`app.asar` contains exactly **6 entries**: four compiled `dist/` files
and `package.json`. **No acceptance fixtures, test profiles, source, or
review documents are packaged** — verified by listing the real archive,
not by reading the config.

The shipped `package.json` carries `"license": "MPL-2.0"`.

Licenses beside the executable:

- `LICENSE.txt` — FedOS's own MPL-2.0, byte-identical to the repository copy
- `THIRD_PARTY_NOTICES.md` — dependency inventory
- `LICENSE.electron.txt`, `LICENSES.chromium.html` — Electron/Chromium

> The first two were **missing** from the initial build. Found by
> inspecting the real artifact rather than trusting the config, and
> fixed in commit `06765ab3`. A bare SPDX identifier in `package.json`
> is not the license text, and MPL-2.0 requires telling recipients of
> the Executable Form how to obtain the source.

## 7. Known limitations of this build

- **Unsigned.** No Authenticode signature; SmartScreen will warn.
  Measured, not assumed.
- **One pre-existing `cargo test` failure**: a dependency-count guard
  asserting exactly 10 production dependencies when the crate has 11
  (`wasm-bindgen`, adopted later; the guard was never updated).
  **Confirmed pre-existing by A/B** — it fails identically with this
  branch's `Cargo.toml` change reverted, and the guard only reads the
  `[dependencies]` section, which was not touched.
- **`Cargo.lock` not committed**, so Rust dependencies are unpinned.
- **The secret scan covers staging inputs, not the compressed NSIS/ZIP
  containers.** It cannot prove total secret absence — the script says
  so itself.
- **Windows x64 only.**
- **10 `test/reviews/` scope-lock tests fail** because this branch
  modifies `README.md`/`package.json`/`Cargo.toml`. All 10 are
  git-working-tree assertions from past reviews, not behavioural tests.
  See [`02_github_repository_setup.md`](02_github_repository_setup.md) §7.

## 8. No reproducibility claim

**Bit-for-bit reproducibility is NOT claimed and was NOT demonstrated.**

Only one successful build exists per commit, so no rebuild comparison
was made. Independent reasons to expect non-reproducibility: an embedded
build timestamp, uncommitted `Cargo.lock`, and no evidence electron-builder's
NSIS/ZIP output is deterministic here.

**What *is* proven** is integrity of *these* artifacts: the checksums
were independently recomputed, and the WASM hash was traced from source
build through to the packaged copy.

## 9. Reproduce this build

```sh
git clone <repository-url>
cd <repository>
git checkout 06765ab37d76e9e96f08deff7cf1cdcad7cbac6a

node --version   # v24.15.0
npm --version    # 11.12.1
rustc --version  # 1.95.0
wasm-bindgen --version  # 0.2.126

npm ci
npm ci --prefix packages/fedos-desktop-electron-spike
npm run build:wasm
sha256sum packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm
#   10f7fdb2e1f2e656013f68f591e452e49cfdbcf9f5822906054b02619730ff6a

npm run typecheck:core
npm run typecheck:electron          # run separately -- see note below
cargo test --release --manifest-path packages/fedos-core-rust/Cargo.toml

# Requires a CLEAN working tree, including untracked files.
npm run release:electron-beta

cd packages/fedos-desktop-electron-spike/release
sha256sum *.exe *.zip
node ../scripts/verify_release_checksums.mjs
powershell -c "Get-AuthenticodeSignature '.\FedOS-Desktop-Beta-Setup-0.1.0-beta.1.exe' | Select Status"
```

> **Run the two typechecks separately.** `npm run typecheck` is
> `typecheck:core && typecheck:electron`, and `typecheck:core` currently
> exits non-zero on pre-existing errors, so `typecheck:electron` never
> runs under the combined script.

Your artifact hashes **will differ** from §5 — see §8. The WASM hash is
expected to match.

## 10. Not committed, deliberately

The installer, ZIP, `SHA256SUMS.txt`, and `release-manifest.v1.json`
are **not** committed. The repository's established policy keeps build
output untracked and `.gitignore` enforces it; a ~470 MB binary in git
history would be irreversible. Distribute artifacts and checksums out of
band, and publish the checksums somewhere reachable **independently of
the download**.
