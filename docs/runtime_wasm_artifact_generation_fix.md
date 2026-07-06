# FedOS WASM artifact generation fix — Stage 465–472

**Status: this document is PLANNING + a record of a minimal, targeted
fix.** `docs/runtime_wasm_artifact_observation.md` (Stage 457–459)
classified two independent, compounding causes for why the first real
`npm run build:wasm` run failed at its `wasm-bindgen` step. This
document fixes BOTH — the minimum change each requires, nothing more —
then Stage 468 re-runs the same command to observe whether a real
`.wasm` + JS glue pair is finally produced.

## 1. The two causes, restated

1. **No `cdylib` crate-type.** `packages/fedos-core-rust/Cargo.toml`'s
   `[lib]` section declared `crate-type = ["rlib"]` only. `cargo
   build --target wasm32-unknown-unknown` therefore only ever emitted
   `libfedos_core_rust.rlib` — an `.rlib` is not a standalone,
   loadable WASM module; `wasm-bindgen` needs a `cdylib`'s raw `.wasm`
   output to process.
2. **Wrong `wasm-bindgen` input path.** `package.json`'s `build:wasm`
   script pointed `wasm-bindgen` at
   `target/wasm32-unknown-unknown/release/fedos_core_rust.wasm` (a
   repo-root-relative path). Because
   `packages/fedos-core-rust/Cargo.toml` is a standalone manifest, not
   part of a Cargo workspace with the repo root, `cargo build
   --manifest-path packages/fedos-core-rust/Cargo.toml` resolves its
   own `target-dir` RELATIVE TO THE MANIFEST — the build actually
   wrote (and still writes) to
   `packages/fedos-core-rust/target/wasm32-unknown-unknown/release/`.
   The script's fixed path was looking in the wrong place regardless
   of cause 1.

## 2. The fix — `crate-type = ["rlib", "cdylib"]`, `rlib` KEPT

`[lib]`'s `crate-type` becomes `["rlib", "cdylib"]` — ADDING `cdylib`,
not replacing `rlib`:

- **`rlib` is KEPT** because every existing `#[cfg(test)]` module and
  every `cargo test`/`cargo check` invocation this crate's 400+ prior
  stages have relied on links against the crate as an `rlib` (Rust's
  own native test harness compiles and links test binaries against a
  library crate's `rlib` output, not `cdylib`). Dropping `rlib` would
  risk breaking `cargo test`/`cargo check` for the NATIVE target — a
  regression this fix must not introduce, and something no prior
  stage's `docs/runtime_wasm_build_observation.md`/
  `docs/runtime_wasm_build_contract.md` ever asked for. Multiple
  crate-types in one `[lib]` section is normal, supported Cargo usage
  — `cargo` builds BOTH artifact kinds from the same source, once
  each, per target.
- **`cdylib` is ADDED** because it is the ONLY crate-type that makes
  `rustc`/`cargo` emit a standalone `.wasm` binary for
  `wasm32-unknown-unknown` — the exact artifact shape `wasm-bindgen`
  requires as its input. This is the minimum change needed to unblock
  cause 1; no other `[lib]`/`[dependencies]`/`[package]` field
  changes.

This is the ONE `Cargo.toml` edit this batch makes. No dependency is
added, removed, or version-bumped; no feature flag changes; no new
`[profile]`/`[target]` section.

## 3. The fix — `build:wasm`'s `wasm-bindgen` input path

`package.json`'s `build:wasm` script's `wasm-bindgen` argument changes
from the repo-root-relative

```
target/wasm32-unknown-unknown/release/fedos_core_rust.wasm
```

to the crate-manifest-relative path that matches where `cargo
--manifest-path packages/fedos-core-rust/Cargo.toml` actually writes:

```
packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm
```

The `cargo build` half of the script, and the `--out-dir
packages/fedos-core-rust/pkg` output destination, are UNCHANGED — only
the input path string is corrected. No new script, no lifecycle hook,
no `wasm-pack`.

## 4. What this fix does NOT do

- Does not install or invoke `wasm-pack`.
- Does not add a `Cargo.toml`/`package.json` dependency.
- Does not change any Rust `pub fn` — the public API surface this
  crate exposes is untouched; `cdylib` changes the ARTIFACT SHAPE
  `cargo` emits, not the crate's source or its API.
- Does not wire `FedosWasmArtifact`/`FedosWasmBoundary`/
  `ExecutionBackend`/`create_runtime.ts`/`src/worker.ts` to anything —
  all remain exactly as fixed by prior stages
  (`"BlockedByImplementation"`/`"Planning"`/`"NotConnected"`, never
  imported by Runtime/Worker).
- Does not call `WebAssembly.instantiate`/`WebAssembly.compile`
  anywhere.
- Does not touch `encrypt`/`decrypt` in Rust or TypeScript.
- Does not commit any generated artifact — `packages/fedos-core-rust/pkg/`
  stays gitignored (Stage 451), and whatever Stage 468 observes is
  recorded in `docs/runtime_wasm_artifact_observation.md`, not staged.

## See also

- `docs/runtime_wasm_artifact_observation.md` (Stage 457–459, updated
  469) — the original failure this fix addresses, and its updated
  Stage 468 result.
- `docs/runtime_wasm_build_contract.md` §6 (Stage 434) — the original
  decision to defer `cdylib` adoption to its own, separately-reviewed
  stage; this document IS that stage.
- `docs/runtime_wasm_build_observation.md` §7–8 (Stage 445) — the
  prior `.rlib`-only, no-`cdylib` finding this fix resolves.
- `docs/runtime_wasm_generation.md` (Stage 449) — the original
  `build:wasm` script naming; Stage 467 corrects its input path only.
