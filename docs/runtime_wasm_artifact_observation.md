# FedOS WASM artifact generation observation — Stage 457–459 (observation only, no code fix)

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

## See also

- `docs/runtime_wasm_generation.md` (Stage 449) — the planning
  document naming the script/output-directory this stage actually ran
  for the first time.
- `docs/runtime_wasm_build_observation.md` §7–8 (Stage 445) — the
  prior `.rlib`-only, no-`cdylib` finding this document's Cause A
  confirms still holds.
- `docs/runtime_wasm_build_contract.md` §6 (Stage 434) — the
  still-standing decision to defer `cdylib` adoption to its own,
  separately-reviewed future stage.
- `src/runtime/fedos_wasm_artifact.ts` (Stage 394, updated 452, 460)
  — where this observation's fixed result is exposed as diagnostic
  labels, still never performing a real filesystem check.
