# Reproduction Guide

How to get a working build from a clean checkout, run the real test suite,
and reproduce the evidence this bundle cites. Every command below is a
real script confirmed present in this repository's own `package.json` at
`master` `81305b37` — none are invented.

## 1. Prerequisites

- Node.js + npm (root `package.json` scripts).
- Rust toolchain + `wasm-bindgen` CLI (for `build:wasm`).
- The compiled WASM artifact (`packages/fedos-core-rust/pkg/`) is
  **deliberately not committed to this repository** — this is disclosed
  directly (`docs/desktop_beta_known_limitations.md` item 4): cloning and
  running the test suite without first building it will show the affected
  crypto suites as skipped or fail-closed, **never a silent placeholder
  success**. Build it yourself before trusting any "real crypto passes"
  claim:
  ```
  npm run build:wasm
  npm run build:wasm:manifest
  ```

## 2. TypeScript / core test suite

```
npm run typecheck:core
npm test              # vitest run, root suite
```

A large fraction of failures in a **freshly cloned worktree** (not this
primary checkout) are known, pre-existing artifacts of this repository's
own git-worktree-based workflow, not real regressions — documented across
many prior sessions:
- ~150-290+ `Cargo.toml`/`lib.rs` "raw import" tests fail in a fresh linked
  worktree with no WASM artifact built yet (grows over time; confirmed as
  high as ~292 files/386 tests in one prior session).
- `test/reviews/*` "structural lock" tests fail by construction for any
  later Arc that legitimately changed scope — this is expected, not a
  regression.
- A vitest/esbuild parse artifact can occasionally make a fresh worktree
  fail to parse **every** file with a garbage-located `SyntaxError`, even
  files nobody touched.
**Before treating any failure as a real regression, A/B-test it**: compare
against a sibling worktree or `git stash`/`git stash pop` your own change
and re-run, rather than assuming a failing test in a fresh checkout is
caused by whatever you were just reviewing.

## 3. Rust crypto core

```
cd packages/fedos-core-rust
cargo test --release
```

A real, fresh run at a recent commit produced **639 passed, 1 known
pre-existing failure** — `secp256k1_dependency_guard::cargo_toml_has_exactly_ten_production_dependencies_after_k256_adoption`,
a hardcoded dependency-count assertion (asserts 10, real count is 11+)
that has reproduced identically across multiple Arcs. This is disclosed,
stable test debt, not a new regression — do not report it as a new
finding without checking this guide first.

If working from a fresh **git worktree** rather than this primary
checkout, note two environment-specific gotchas from prior sessions:
- If your worktree lives under a path OneDrive syncs, override
  `CARGO_TARGET_DIR` to a location outside that sync scope, OR use a
  worktree rooted under a plain local path (e.g. `C:\wt\...`) to avoid it
  entirely.
- A fresh worktree has no `node_modules`; a `mklink /J` (Windows junction)
  from a sibling worktree's own `node_modules` lets `tsc --noEmit`/vitest
  run without a full `npm install`.

## 4. Electron package (the canonical packaged app)

The Electron package (`packages/fedos-desktop-electron-spike/`) needs its
own full rebuild after ANY change — a common, previously-real bug came
from forgetting the third of these three steps:

```
npm run typecheck:electron
```

and, from within `packages/fedos-desktop-electron-spike/`, all three `tsc`
passes its own `build`/`package` scripts chain together: the test-types
pass, the main/preload CommonJS pass, AND the browser-scripts pass
(`tsconfig.browser-scripts.json`) that compiles the renderer for
unwrapped `<script>`-tag loading. **Skipping the third pass silently
leaves a stale renderer.js that throws `Uncaught ReferenceError: exports
is not defined` on load** — this exact defect shipped once for real
(fixed at Alpha 8201-8280) and cost a prior session real debugging time
before being root-caused by inspecting the compiled `dist/` output
byte-for-byte rather than assuming environmental flakiness.

To run/package the real canonical Beta app:
```
npm run start:electron-beta          # dev-mode launch of the real entry point
npm run package:electron-beta        # real packaged build
npm run release:electron-beta        # real NSIS installer + portable ZIP + manifest + checksums
```

Use the `:beta` scripts specifically — several `start:electron-*` dev
scripts (navigation, badge, unlock, settings, host-adapter) launch
cosmetically-similar but disconnected spike entry points that are never
loaded by the canonical `fedos_electron_beta_main.cts` in a real release;
they are useful for isolated component development, not for reproducing
the shipped product.

A nested package needs its **own** `npm install` inside
`packages/fedos-desktop-electron-spike/` (not covered by a root
`node_modules` junction trick) to get a real `electron.exe` binary — and
even after install, its postinstall download can silently no-op; if
`node_modules/electron/dist/electron.exe` is missing, run
`node node_modules/electron/install.js` manually.

## 5. Electron acceptance test suite

```
npm run test:electron-spike
```

Running the FULL suite with default parallel vitest concurrency spawns
many real Electron subprocesses concurrently and can cause genuine
resource contention in a sandboxed environment (`GPU Cache Creation
failed`, cache-move access-denied errors), manifesting as several random
failures per run that reproducibly pass when re-run in isolation or with
serialized execution (`--pool=forks --poolOptions.forks.singleFork=true`).
Always re-run a failure in isolation before concluding it is real.

## 6. Release-artifact verification (if reproducing a signed/checksummed build)

The release pipeline
(`packages/fedos-desktop-electron-spike/scripts/build_release.mjs`)
requires a clean git tree and a pre-built WASM artifact as its own stated
preconditions. It independently re-derives every release-artifact
checksum (`scripts/verify_release_checksums.mjs`) rather than merely
re-reading the manifest — a real prior run produced an NSIS installer,
portable ZIP, manifest, and checksums (~470MB total output, not committed,
gitignored) with an independent re-verification pass and a zero-finding
secret scan.

## 7. What "real" means throughout this bundle

Every claim in this bundle that cites a test result or a build outcome
was, at the time its source review was written, either (a) a real,
executed `cargo test`/`vitest`/Electron-subprocess run, with actual
pass/fail counts, or (b) explicitly labeled BLOCKED with the exact
environment/artifact precondition that would need to be met to run it —
never a hand-fabricated result. Reproduce the specific command cited next
to any claim you intend to rely on before treating it as still true of
the commit you are auditing.
