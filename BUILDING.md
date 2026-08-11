# FedOS Desktop — Building

This document consolidates real, verified build/release process facts
from this repository's own scripts and from the Release Review
(`d760c95f`, `72598a6e`) and Security Review (`8e730f25`, `6873d24f`)
findings, re-checked against the actual pipeline this Arc ran end-to-end
(a real `npm run release:beta` producing a checksummed, unsigned NSIS
installer + portable ZIP for `release/fedos-desktop-beta-0.1`).

## Exact toolchain versions

This repository pins its toolchain via standard version files rather
than prose alone — read these, don't just trust this document's own
text, since the files are the actual enforced/checked source of truth:

- **Node.js**: `.nvmrc` (major version `24`) + `package.json`'s
  `"engines"` field (`>=24.0.0 <25.0.0`). Verified working with Node
  `v24.15.0` and npm `11.12.1` (also pinned via `package.json`'s
  `"packageManager"` field) as of Secure Runtime Alpha 8441-8520.
- **Rust**: `rust-toolchain.toml` at the repository root, pinning
  `channel = "1.95.0"` and pre-declaring the `wasm32-unknown-unknown`
  target — `rustup` will fetch and use this automatically inside this
  repository's own directory tree; you do not need to `rustup target
  add` it manually if you have `rustup` installed (only needed with a
  non-rustup Rust installation).
- **`wasm-bindgen-cli`**: must match `packages/fedos-core-rust/Cargo.toml`'s
  own `wasm-bindgen` dependency version exactly (verified `0.2.126` as
  of this writing — re-check that file, don't assume this number stays
  current). Install with:
  `cargo install wasm-bindgen-cli --version <exact version> --locked`.
- **Electron**: version pinned in `packages/fedos-desktop-electron-spike/package.json`'s
  own `devDependencies` (`^43.1.1` as of this writing) — installed via
  the ordinary `npm install`/junction-node_modules process below, not a
  separate step, except for binary provisioning (see below).

## A known, harmless fresh-worktree/junction artifact

If you set up a new `git worktree` and link its `node_modules` via a
directory junction from a sibling worktree (see below) rather than a
full `npm install`, you may see `npx tsc --noEmit` report a spurious
`Cannot find module 'node:fs'` (or similar `node:*`) error on brand-new
files specifically, while identical imports in pre-existing files
resolve fine. Verified in this session: this is a `tsc`-only resolution
quirk tied to the junction — the affected file's real tests still run
and pass correctly under `vitest` (which uses its own esbuild-based
transform, not `tsc`, to execute tests). A genuine `npm install` (not a
junction) does not reproduce this. Don't chase it as a code bug; a full
`npm install` in that worktree resolves it if it matters for your own
`tsc --noEmit` run.

## The single most common false "regression" a fresh contributor hits

**The compiled Rust/WASM crypto core (`packages/fedos-core-rust/pkg/`) is
not committed to this repository.** Without it, real-crypto test suites
do not FAIL — they **skip closed** (a `REAL_ARTIFACT_PRESENT`-style gate
checks for the artifact and short-circuits to `describe.skip`). A fresh
clone will therefore show large swaths of tests "passing" only because
they were never run. Before trusting any test result, build the real
artifact:

```
npm run build:wasm            # cargo build --release --target wasm32-unknown-unknown
                               #   + wasm-bindgen --target web --out-dir packages/fedos-core-rust/pkg
npm run build:wasm:manifest   # records the WASM artifact's sha256 for provenance
```

On Windows, avoid overriding `CARGO_TARGET_DIR` inside a `OneDrive`-backed
checkout — long/synced paths there have caused real build failures in
past sessions; worktrees under `C:\wt\` do not have this problem and
don't need the override.

## Building the Electron app for development

```
npm run build:beta-runtime --prefix packages/fedos-desktop-electron-spike   # or: npm run build:beta-runtime (root)
npm run build --prefix packages/fedos-desktop-electron-spike
```

The package's own `build` script runs **two sequential `tsc` passes**
against the same `dist/` output directory:

```
tsc -p tsconfig.json               # Node16 module target, main/preload/loader files
tsc -p tsconfig.browser-scripts.json  # classic CommonJS/Node10, unwrapped plain-<script> emission
```

**Known footgun, fixed at Secure Runtime Alpha 8201-8280, worth knowing
even after the fix:** every browser-context renderer file (loaded via a
plain `<script src="...">` tag, not a module) MUST be listed in
`tsconfig.json`'s own `exclude` array, even though it's also correctly
included in `tsconfig.browser-scripts.json`. If a browser-context file is
missing from that exclude list, both `tsc` passes try to compile it to
the same output path, and TypeScript's own incremental-output caching
does not reliably guarantee the second (correct, unwrapped) pass
re-emits it — the result can non-deterministically ship as the WRONG,
Node16-wrapped compile (`Object.defineProperty(exports, "__esModule", ...)`
at the top), which throws `Uncaught ReferenceError: exports is not
defined` in the real browser page and hangs it on the loading screen
forever. If you add a new browser-context renderer file, add it to BOTH
tsconfig files' relevant list. If you ever see this exact
`ReferenceError` from a real launch, this is the first thing to check —
grep the compiled `dist/<file>.js` for `Object.defineProperty(exports`
near the top; if present, the file is missing from `tsconfig.json`'s
exclude list.

Electron's own binary is not guaranteed to be pulled in by a plain
`npm ci` — if `node_modules/electron/dist/electron.exe` is missing, run:

```
npm run ensure-electron-binary --prefix packages/fedos-desktop-electron-spike
```

## Fresh-worktree node_modules without a full `npm install`

Real, established technique used across many Arcs in this repository: a
new `git worktree` doesn't get its own `node_modules`. Rather than
running a full `npm install` (slow, and risks a different resolved graph
than the sibling worktree you're comparing against), create a directory
junction from an existing, already-installed sibling worktree with a
matching `package-lock.json`:

```powershell
# verify the lockfiles actually match first
Get-FileHash new-worktree/package-lock.json, sibling-worktree/package-lock.json

New-Item -ItemType Junction -Path "new-worktree/node_modules" -Target "sibling-worktree/node_modules"
# packages/fedos-desktop-electron-spike/ has its OWN nested node_modules -- junction that too
New-Item -ItemType Junction -Path "new-worktree/packages/fedos-desktop-electron-spike/node_modules" -Target "sibling-worktree/packages/fedos-desktop-electron-spike/node_modules"
```

**This technique is FORBIDDEN for release/package validation** (`npm run
release:beta`, `npm run package:beta`, `npm run package:electron-spike`, or
any manual `electron-builder` invocation you intend to treat as a real
signal). A junctioned `node_modules` is a directory some OTHER worktree
owns and can mutate at any moment; its content is whatever that sibling
last happened to install, not what THIS worktree's own
`package.json`/`package-lock.json` declare. This is not a hypothetical
risk — it is exactly the mechanism a real investigation traced two silent
packaging defects to (missing `qrcode`, `@noble/curves`, `dijkstrajs`,
`pngjs` from a shipped `app.asar`, both caused by the shared/junctioned
`node_modules` drifting out from under the packaging run — see
`docs/commerce/evidence/commerce_e2e_packaged_binary/packaged_binary_bootstrap_investigation_2026-08-12_agent_x_p1.md`,
section "0. Two real, disclosed, PRE-EXISTING environmental defects").
**Release/package validation must run from a worktree whose
`node_modules` (root and `packages/fedos-desktop-electron-spike/`) were
produced by that worktree's own `npm ci`.** A cheap, mechanical guard
enforces this: `node scripts/release/guard_no_junctioned_node_modules.mjs`
runs automatically as the first step of `npm run release:beta` (inside
`build_release.mjs`) and as an npm `pre`-hook on `npm run package` /
`npm run package:beta`, and refuses to proceed (non-zero exit) if either
`node_modules` is missing or is a junction/symlink. It deliberately does
NOT hash-verify every installed package against the lockfile — that would
be a much larger integrity-checking system; the cheap identity check
(real vs. junctioned) closes the specific, real failure mode above without
that scope.

## Running tests

```
npm run typecheck                          # root src/ + electron-spike package
cargo test --release --manifest-path packages/fedos-core-rust/Cargo.toml
npm test                                   # root vitest run (large; ~1168 files historically)
npm run test:electron-spike                # packages/fedos-desktop-electron-spike's own suite
```

The real, packaged-process Electron acceptance tests spawn actual
`electron.exe` subprocesses. Running many of them with default vitest
file-parallelism produces confirmed, repeatable resource-contention flake
(Windows disk-cache lock errors, occasional Chromium network-service
crashes) — **run them serialized** when you need a trustworthy signal:

```
npx vitest run --config vitest.electron-spike.config.ts --no-file-parallelism
```

A single test failing after a `git pull`/rebase that also passes cleanly
on an immediate re-run, with no code change in between, is almost always
this contention class, not a regression — confirm via `git stash` A/B
against the unmodified base before concluding otherwise.

## Release pipeline

The real, single, deterministic sequence
(`packages/fedos-desktop-electron-spike/scripts/build_release.mjs`, run
via `npm run release:beta --prefix packages/fedos-desktop-electron-spike`):

1. Verify `node_modules` integrity — real, standalone directories this
   worktree's own `npm ci` produced, never a junction/symlink shared with
   another worktree (see "Fresh-worktree node_modules without a full `npm
   install`" above for why this matters specifically for a release build).
2. Verify a clean working tree (dirty-tree public artifacts are refused).
3. Verify the electron-builder package allowlist config.
4. Build the root `beta-runtime` `dist/` graph.
5. Build the Electron package (main/preload/renderer/static assets — the
   two-pass `tsc` sequence above).
6. Run `electron-builder` (NSIS installer + portable ZIP), via the
   existing package.json-snapshot/restore-protected wrapper script.
7. Generate the release manifest (`release-manifest.v1.json` — records
   git commit, WASM artifact sha256, per-artifact sha256/size, unsigned
   status, supported schema versions).
8. Generate release checksums (`SHA256SUMS.txt`).
9. Verify the release checksums (re-derived independently, not merely
   re-read from step 7/8's own output).
10. Scan the staging inputs for prohibited content (secrets, unexpected
    paths) — note: this scans staging INPUTS, not the compressed NSIS/ZIP
    containers themselves; it cannot prove total secret absence inside
    the compressed artifacts.

**Precondition this script does not itself check:** `packages/fedos-core-rust/pkg/`
must already exist (built per the section above) before running this
pipeline — there is no pre-flight check for it (a real, still-open gap
named by the Release Review, `3a4dd0bf`-adjacent review `72598a6e`,
item R-5). Build WASM first, always.

**Signing status:** every artifact this pipeline produces is genuinely
**unsigned** (`unsigned:true`, recorded honestly in the manifest, not a
placeholder). No production code-signing certificate is configured
anywhere in this build environment.

**Native tool flakiness:** the ZIP-building step shells out to a cached
`7za.exe`. A crash here (observed in this session: exit code
`3221225794` / `0xC0000005`, an access violation) has been transient and
resolved on immediate retry, consistent with the same resource-contention
class as the test flake above — retry once before treating it as a real
blocker.

## Where release artifacts land

`packages/fedos-desktop-electron-spike/dist-package-beta/` (electron-
builder's raw output) and `packages/fedos-desktop-electron-spike/release/`
(this pipeline's curated copy: the two artifacts + manifest + checksums)
are both gitignored — never committed, always regenerated on demand.
`Cargo.lock` is also deliberately not committed (a recorded policy
decision, not an oversight) — the exact resolved dependency graph that
produced a given release's WASM artifact is recorded in that release's
own provenance docs instead. One real, current consequence: **rolling
back a pilot install to an older version has no tested path** — there is
no committed `Cargo.lock` to reproduce an older build exactly, and no
schema-migration code for the on-disk profile/settings/archive formats.
Back up a profile directory before upgrading during a pilot.
