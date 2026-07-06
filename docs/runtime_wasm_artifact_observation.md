# FedOS WASM artifact generation observation — Stage 457–459 (observation only, no code fix); updated Stage 465–469 with the fixed-cause re-run result; updated Stage 473–476 with the FIRST real JS glue generation

**Status: this document records an OBSERVATION, not a fix.** Stage 458
ran the real `npm run build:wasm` script (`package.json`, Stage 450)
for the first time, against `packages/fedos-core-rust` EXACTLY AS IT
EXISTS TODAY — `crate-type = ["rlib"]`, no `cdylib`, no `Cargo.toml`
edit of any kind. The run FAILED at the `wasm-bindgen` step. This
document classifies that failure and stops — it does not patch
`Cargo.toml`, does not add `cdylib`, does not edit `package.json`'s
script text, and does not attempt any other code-level fix.

## 1. Command run

```
RUSTFLAGS='--cfg getrandom_backend="wasm_js"' npm run build:wasm
```

which expands to `package.json`'s existing `build:wasm` entry (Stage
450, unedited):

```
cargo build --manifest-path packages/fedos-core-rust/Cargo.toml --target wasm32-unknown-unknown --release && wasm-bindgen --target web --out-dir packages/fedos-core-rust/pkg target/wasm32-unknown-unknown/release/fedos_core_rust.wasm
```

Run from this repository's root, with `git status` clean before and
after, `wasm32-unknown-unknown` and `wasm-bindgen-cli` 0.2.100 already
installed as environment capabilities (Stage 425).

## 2. Result: PARTIAL SUCCESS then FAILURE — `cargo build` succeeded, `wasm-bindgen` failed

**`cargo build --manifest-path packages/fedos-core-rust/Cargo.toml
--target wasm32-unknown-unknown --release` SUCCEEDED** — exit code
`0`, ending in `Finished \`release\` profile [optimized] target(s) in
14.37s`, compiling all 10 production dependencies (including
`getrandom` v0.3.4 with its `wasm_js` feature, and `k256`) plus
`fedos-core-rust` itself for `wasm32-unknown-unknown`.

**`wasm-bindgen --target web --out-dir packages/fedos-core-rust/pkg
target/wasm32-unknown-unknown/release/fedos_core_rust.wasm` FAILED**:

```
error: failed reading 'target/wasm32-unknown-unknown/release/fedos_core_rust.wasm'

Caused by:
    指定されたパスが見つかりません。 (os error 3)
```

(Japanese OS error text for "the specified path could not be found" —
Windows `ERROR_PATH_NOT_FOUND`.)

## 3. Classification

**→ Two independent, compounding causes — neither is a `wasm-bindgen`-itself problem.**

**Cause A — no `.wasm` file is ever produced, because `[lib]` declares
`crate-type = ["rlib"]` only, no `cdylib`.** Inspecting the actual
build output confirms this directly: the only artifact `cargo`
produced for this crate at any target-dir location is
`libfedos_core_rust.rlib` (plus its `.d` dep-info file) — no `.wasm`
file exists anywhere under any `target/` directory after the build.
This matches `docs/runtime_wasm_build_observation.md` §7's own prior
finding (Stage 443–444: `.rlib` only, no `.wasm`, "a `.wasm` artifact
requires a `cdylib` target, deliberately not added") — still true
today; `crate-type` has not changed.

**Cause B — even if a `.wasm` existed, the script's fixed input path
is wrong for this crate's actual target-dir location.** Because
`packages/fedos-core-rust/Cargo.toml` is a standalone manifest (not
part of a Cargo workspace with the repo root), `cargo build
--manifest-path packages/fedos-core-rust/Cargo.toml` resolves its
`target-dir` RELATIVE TO THE MANIFEST, not the current working
directory — confirmed directly: the build actually wrote to
`packages/fedos-core-rust/target/wasm32-unknown-unknown/release/`, not
the repo-root `target/wasm32-unknown-unknown/release/` the
`build:wasm` script's `wasm-bindgen` argument names. The
`wasm-bindgen` invocation was therefore looking in the wrong place
regardless of Cause A.

**Ruled out, explicitly, by direct evidence:**

- **NOT a `getrandom`/toolchain regression** — `cargo build` itself
  succeeded end-to-end, including `getrandom` v0.3.4 with its
  `wasm_js` feature; `docs/runtime_wasm_getrandom_policy.md`'s Stage
  441–444 fix still holds.
- **NOT a `wasm-bindgen-cli` installation/version problem** —
  `wasm-bindgen --version` reports `0.2.100` and the binary ran; it
  failed on a plain file-not-found for its INPUT, not a crash or
  version mismatch.
- **NOT a permissions/OneDrive-path problem** — the error is a
  standard "path not found" for a file that, per Cause A, was never
  written by `cargo` in the first place; it is not a Windows/OneDrive
  file-locking symptom.
- **NOT a `Cargo.lock`/dependency-resolution problem** — dependency
  resolution and compilation both completed cleanly; the failure is
  entirely in the second (`wasm-bindgen`) half of the `&&` command.

## 4. What was generated, and what was not

- **Generated:** `packages/fedos-core-rust/target/wasm32-unknown-unknown/release/libfedos_core_rust.rlib`
  (plus the ordinary `cargo` bookkeeping under that same `target/`
  tree — `.fingerprint`, `deps`, `build`, `incremental`, `examples`,
  `.cargo-lock`) and a freshly resolved
  `packages/fedos-core-rust/Cargo.lock`. Both are gitignored
  (`packages/fedos-core-rust/.gitignore`'s `/target/` and
  `Cargo.lock` patterns) and were never staged.
- **NOT generated:** no `.wasm` file, no `wasm-bindgen` JS glue
  (`*_bg.js`, `*.js`, `*.d.ts`), no `packages/fedos-core-rust/pkg/`
  directory at all — `wasm-bindgen` failed before writing any output,
  so its `--out-dir` was never created.
- **JS glue: absent.** No JS glue exists to describe — the CLI never
  reached the point of generating bindings.
- `git status --short` showed no diff at any point during or after
  this run — every artifact produced is gitignored.

## 5. Why nothing generated here is committed

Per this batch's fixed policy (`packages/fedos-core-rust/.gitignore`'s
`/pkg/` entry, Stage 451; this document's own Stage 457–464 scope):
a locally-generated build artifact is a MACHINE-LOCAL, reproducible
byproduct of running a script against source already in the
repository — committing it would (1) duplicate what `Cargo.toml`/
`src/lib.rs` + this exact toolchain version already fully determine,
(2) risk committing a stale artifact that silently diverges from a
future source change, and (3) is explicitly out of scope for this
batch regardless of whether generation succeeds or fails. No `.wasm`/
`.rlib`/`Cargo.lock`/`target/` file has ever been committed by any
prior WASM-arc stage, and this stage does not change that.

## 6. What was NOT done

- `Cargo.toml` was NOT edited — `crate-type` is still `["rlib"]` only,
  no `cdylib` added.
- `package.json`'s `build:wasm` script text was NOT edited, even
  though §3 Cause B identifies its input path as wrong for this
  crate's actual (non-workspace) `target-dir` — per Stage 458's
  instruction, a failure is classified, not fixed.
- No dependency was added to either `Cargo.toml` or `package.json`.
- No Rust `pub fn` was added or changed.
- Runtime/Worker were not touched; `WebAssembly.instantiate`/
  `WebAssembly.compile` were never called; no `encrypt`/`decrypt` code
  path was executed.
- `packages/fedos-core-rust/target/` and `Cargo.lock` were removed
  after this observation was recorded (Stage 463 cleanup policy,
  confirmed gitignored/untracked via `git status --ignored` before
  removal) — this document's §4 record stands regardless.

## 7. Update — Stage 465–469: both original causes RESOLVED; re-run reaches a NEW, third failure

`docs/runtime_wasm_artifact_generation_fix.md` (Stage 465) fixed both
causes §3 classified: Stage 466 added `cdylib` to `[lib]`'s
`crate-type` (now `["rlib", "cdylib"]`, `rlib` kept); Stage 467
corrected `build:wasm`'s `wasm-bindgen` input path to
`packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm`
(the crate-manifest-relative location `cargo` actually writes to,
matching §3 Cause B's finding). Stage 468 re-ran the exact same
command:

```
RUSTFLAGS='--cfg getrandom_backend="wasm_js"' npm run build:wasm
```

**Cause A (no `cdylib`) — CONFIRMED RESOLVED.** `cargo build` produced
a REAL standalone `.wasm` file for the first time in this repository's
history:
`packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm`
(35,744 bytes) — alongside the pre-existing `libfedos_core_rust.rlib`
(1,229,950 bytes), confirming BOTH crate-types were built from the
same source, exactly as `docs/runtime_wasm_artifact_generation_fix.md`
§2 described.

**Cause B (wrong input path) — CONFIRMED RESOLVED.** `wasm-bindgen`
no longer reports "path not found" — it successfully located and read
`fedos_core_rust.wasm` at the corrected path, proceeding past the file
I/O step it failed at in §2, into its own internal version-compatibility
check (see below). If Cause B were still present, this next error
could never have been reached.

**A NEW, THIRD failure was reached — `wasm-bindgen` CLI / crate schema
version mismatch:**

```
error:

it looks like the Rust project used to create this Wasm file was linked against
version of wasm-bindgen that uses a different bindgen format than this binary:

  rust Wasm file schema version: 0.2.126
     this binary schema version: 0.2.100
```

**Classification: `wasm-bindgen-cli`/crate VERSION MISMATCH, not a
repeat of either original cause.** The `wasm-bindgen` CLI binary
installed on this machine (Stage 425) is `0.2.100`. The
`wasm-bindgen` LIBRARY crate actually compiled into
`fedos_core_rust.wasm` is `0.2.126` — pulled in transitively as
`getrandom`'s own internal `wasm_js`-feature dependency (per
`Cargo.toml`'s existing comment: "the `wasm-bindgen`-based JS-interop
shim it uses is entirely internal to `getrandom`'s own `Cargo.toml`,
not a dependency this crate adds"), resolved to whatever the latest
compatible version is because `Cargo.lock` is never committed
(`docs/rust_dependency_adoption.md` §7) — so every fresh
`cargo build` can silently resolve a newer `wasm-bindgen` than the
locally-installed CLI. `wasm-bindgen`'s own bindgen format is NOT
forward/backward compatible across schema versions — the CLI and the
compiled Wasm's embedded schema must match exactly.

**Ruled out, explicitly:**

- **NOT Cause A recurring** — a real, correctly-shaped `.wasm` file
  exists; `cdylib` is confirmed working.
- **NOT Cause B recurring** — the path was found and read; this error
  only occurs AFTER successful file I/O, during
  `wasm-bindgen`'s internal schema-version check.
- **NOT a `getrandom`/`k256`/toolchain compile regression** — `cargo
  build` itself succeeded end-to-end, identically to the prior run.

**Per Stage 468's own instruction ("失敗したら修正せず原因分類" —
on failure, classify, do not fix), NO further action was taken**: no
`cargo update -p wasm-bindgen --precise 0.2.100` was run, no
`cargo install -f wasm-bindgen-cli --version 0.2.126` was run, and no
`Cargo.toml`/`package.json` edit was made to address this new cause —
it is left for a future, separate, explicitly-reviewed stage to
decide whether to pin the crate version (a `Cargo.lock` — never
committed — or `Cargo.toml` decision) or upgrade the local CLI (a
machine-local environment-capability change, same category as Stage
425's original install).

## 8. What was generated, and what was not — Stage 468 re-run

- **Generated:** `packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm`
  (35,744 bytes, `cdylib` output — NEW, the first real `.wasm` binary
  ever produced in this repository) AND
  `libfedos_core_rust.rlib` (1,229,950 bytes, `rlib` output,
  unchanged in kind from every prior run) plus the usual `cargo`
  bookkeeping and a freshly resolved `Cargo.lock`. All gitignored,
  never staged.
- **NOT generated:** no `wasm-bindgen` JS glue (`*_bg.js`, `*.js`,
  `*.d.ts`), no `packages/fedos-core-rust/pkg/` directory —
  `wasm-bindgen` failed its own version check before writing any
  output file, so `--out-dir` was never created.
- `git status --short` showed no diff at any point during or after
  this run.

## 9. Commit policy — unchanged

Per §5's reasoning (still standing): no `.wasm`/`.rlib`/`Cargo.lock`/
`target/`/`pkg/` file is committed. The NEW `.wasm` file this run
produced is exactly the same kind of machine-local, reproducible
build byproduct §5 already covers — nothing about Stage 465–469
changes that policy. `packages/fedos-core-rust/target/`/`Cargo.lock`
were confirmed gitignored/untracked (`git status --ignored`) then
deleted after this update was recorded (Stage 472's own cleanup step,
same discipline as Stage 463).

## 10. Update — Stage 473–476: `wasm-bindgen` version aligned, FIRST real JS glue generated

`docs/runtime_wasm_bindgen_version_policy.md` (Stage 473) fixed the
policy: the LOCAL `wasm-bindgen-cli` binary moves to match whatever
`wasm-bindgen` version the crate's dependency graph resolves to,
never the reverse. Stage 474 applied it once:

```
cargo install wasm-bindgen-cli --version 0.2.126 --force
```

`wasm-bindgen --version` now reports `wasm-bindgen 0.2.126` (was
`0.2.100`). This is a MACHINE-LOCAL environment-capability change,
same category as the original Stage 425 install — no
`Cargo.toml`/`package.json`/`Cargo.lock` file changed as a result.

Stage 475 re-ran the exact same command:

```
RUSTFLAGS='--cfg getrandom_backend="wasm_js"' npm run build:wasm
```

**RESULT: FULL SUCCESS — the FIRST real `.wasm` + JS glue pair ever
produced in this repository's history.** Exit code `0`, no error
output. `cargo build` reproduced the identical, previously-observed
`fedos_core_rust.wasm` (35,744 bytes, unchanged from Stage 468's
build — confirming the crate's own compiled output was never the
problem). `wasm-bindgen --target web --out-dir
packages/fedos-core-rust/pkg` this time completed end-to-end,
producing `packages/fedos-core-rust/pkg/`:

| File | Size (bytes) |
|---|---|
| `fedos_core_rust_bg.wasm` | 18,377 |
| `fedos_core_rust.js` | 3,720 |
| `fedos_core_rust.d.ts` | 1,166 |
| `fedos_core_rust_bg.wasm.d.ts` | 181 |

**JS glue: `fedos_core_rust.js` (3,720 bytes)** — this `wasm-bindgen`
version's `--target web` output consolidates what older versions
split into a separate `*_bg.js` file into this single glue module
(referencing `./fedos_core_rust_bg.wasm` as its WASM import); no
separate `_bg.js` file exists, and none is expected — this IS the
complete JS glue for this `wasm-bindgen` version/target combination.
**`.d.ts`: present, both `fedos_core_rust.d.ts` (the JS glue's own
type declarations) and `fedos_core_rust_bg.wasm.d.ts` (the raw WASM
module's type declarations).** `fedos_core_rust_bg.wasm` (18,377
bytes) is `wasm-bindgen`'s own post-processed WASM module — smaller
than the raw `cargo`-produced `fedos_core_rust.wasm` (35,744 bytes)
because `wasm-bindgen` strips/rewrites custom sections and import
plumbing during processing; this size difference is expected,
internal `wasm-bindgen` behavior, not a discrepancy to investigate.

**Classification: the THIRD cause (§7) is RESOLVED.** No further
failure was reached — this is the first time in this repository's
history that every step of `docs/runtime_wasm_generation.md` §1's
diagram (`cargo build` → `wasm-bindgen` → Generated JS Glue →
Generated `.wasm`) has actually completed.

**Still true after Stage 473–476:**

- No `Cargo.toml` dependency VERSION was changed — the version
  alignment happened entirely in the local `wasm-bindgen-cli`
  binary, per `docs/runtime_wasm_bindgen_version_policy.md` §2's
  reasoning (pinning the crate side down would not have been durable
  across a freshly-resolved `Cargo.lock` anyway).
- No `package.json` dependency was added.
- `wasm-pack` was not installed or invoked.
- `build:wasm`'s script text is UNCHANGED since Stage 467 — no
  further script edit was needed once the CLI version matched.
- Runtime/Worker are untouched; `WebAssembly.instantiate`/`compile`
  were never called against this or any other artifact;
  `encrypt`/`decrypt` are unchanged; `"Allowed"` remains unreachable.

## 11. Commit policy — unchanged, now covering the FIRST real JS glue too

Per §5/§9's reasoning (still standing): no `.wasm`/`.rlib`/
`Cargo.lock`/`target/`/`pkg/` file is committed. `git status --short`
showed no diff at any point during or after Stage 474–475 — every
artifact produced (including this stage's NEW `fedos_core_rust.js`/
`.d.ts`/`_bg.wasm`/`_bg.wasm.d.ts`) lives under
`packages/fedos-core-rust/pkg/`, already gitignored since Stage 451,
confirmed via `git status --ignored` before Stage 480's cleanup.
Nothing about successfully generating real JS glue for the first
time changes this policy — it is exactly the same kind of
machine-local, reproducible build byproduct every prior artifact in
this arc already was.

## See also

- `docs/runtime_wasm_generation.md` (Stage 449) — the planning
  document naming the script/output-directory this stage actually ran
  for the first time.
- `docs/runtime_wasm_build_observation.md` §7–8 (Stage 445) — the
  prior `.rlib`-only, no-`cdylib` finding §3 Cause A described, now
  resolved per §7.
- `docs/runtime_wasm_build_contract.md` §6 (Stage 434) — the
  original decision to defer `cdylib` adoption, resolved by
  `docs/runtime_wasm_artifact_generation_fix.md` (Stage 465–466).
- `docs/runtime_wasm_artifact_generation_fix.md` (Stage 465–467) — the
  fix this document's §7–9 records the (partial) result of; §10–11
  record the FULL result once §7's third cause was also resolved.
- `docs/runtime_wasm_bindgen_version_policy.md` (Stage 473–474) — the
  version-alignment policy §10 applies, and its own reasoning for why
  the CLI moves, never the crate side.
- `src/runtime/fedos_wasm_artifact.ts` (Stage 394, updated 452, 460)
  — where this observation's fixed result is exposed as diagnostic
  labels, still never performing a real filesystem check.
- `src/runtime/fedos_wasm_toolchain.ts` (updated Stage 477) — where
  this stage's `wasmBindgenCliExpectedVersion`/
  `wasmBindgenVersionAligned`/`wasmGlueGenerationObserved` fixed
  labels are exposed as diagnostics.
