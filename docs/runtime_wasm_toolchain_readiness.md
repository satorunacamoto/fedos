# FedOS WASM toolchain readiness — Stage 417 (docs only, no code)

**Status: this document adds no code.** It is a plain inventory of
what the eventual real WASM build (`docs/runtime_wasm_build_plan.md`,
Stage 393) would require, and confirms — by direct inspection of this
repository, not by assumption — that NONE of it exists yet. Writing
this inventory down does not install, generate, run, or download
anything.

## 1. The six missing pieces

| # | Item | State |
|---|---|---|
| 1 | `wasm32` target (`wasm32-unknown-unknown` or equivalent) | **Not Installed** |
| 2 | `wasm-bindgen-cli` | **Not Installed** |
| 3 | `wasm-pack` | **Not Installed** |
| 4 | Build script (a script driving crate → target → bindgen) | **Not Generated** |
| 5 | Generated `.wasm` artifact | **Not Generated** |
| 6 | Generated JS bindings (bindgen glue code) | **Not Generated** |

Every row above is fixed **"Not Installed / Not Generated"**. This
document does not change any of them — confirming a gap is not
closing it.

## 2. How each row was confirmed, not assumed

- **`wasm32` target** — no `rustup target list --installed` output,
  Cargo config, or CI step anywhere in this repository requests or
  configures a `wasm32-*` target. `packages/fedos-core-rust/Cargo.toml`'s
  `[lib]` section declares `crate-type = ["rlib"]` only — no `cdylib`
  target, which a WASM build would require.
- **`wasm-bindgen-cli`** — no `wasm-bindgen` entry exists in
  `Cargo.toml` (`[dependencies]` or `[dev-dependencies]`), no
  `wasm-bindgen-cli` binary is referenced by any script or npm command
  in `package.json`.
- **`wasm-pack`** — no `wasm-pack` reference anywhere in this
  repository (no config file, no npm script, no CI step).
- **Build script** — no script (shell, PowerShell, npm script, or
  otherwise) anywhere in this repository invokes `cargo build --target
  wasm32-*`, `wasm-bindgen`, or `wasm-pack`. `docs/runtime_wasm_build_plan.md`
  (Stage 393) describes the INTENDED pipeline shape; it is a design
  document, not a script.
- **Generated `.wasm` artifact** — no `.wasm` file exists anywhere in
  this repository (confirmed by the existing filesystem-scan guard
  tests, e.g. `test/runtime_wasm_artifact.test.ts` item 15,
  `test/runtime_execution_backend.test.ts` item 15).
- **Generated JS bindings** — no bindgen-produced `.js`/`.d.ts` glue
  module exists anywhere in this repository.
  `packages/fedos-core-rust/src/wasm_loader.ts` (Stage 63) is a
  HAND-WRITTEN, permanently-disabled placeholder loader — it is not,
  and does not wrap, generated bindgen output.

## 3. What this readiness check is not

- It does not install `wasm32`, `wasm-bindgen-cli`, or `wasm-pack`.
- It does not write a build script.
- It does not run `cargo build --target wasm32-*`, `wasm-bindgen`, or
  `wasm-pack`.
- It does not produce a `.wasm` file or any generated JS bindings.
- It does not change `Cargo.toml`, `package.json`, or any Rust public
  API — `packages/fedos-core-rust`'s 27 `pub fn`s are untouched.
- It does not activate Runtime or Worker, and does not execute
  `encrypt`/`decrypt` in any form.

## 4. Why this inventory, and why now

`docs/runtime_backend_implementation_sequence.md` (Stage 410) names
"WASM build toolchain planning final check" as sequence item 1 — the
first step before any tooling is actually introduced (item 2). This
document IS that final check: a concrete, itemized confirmation of
what is missing, so that whichever future stage picks up item 2 has an
exact, current list to work from rather than a general impression.

## See also

- `docs/runtime_wasm_build_plan.md` (Stage 393) — the intended pipeline
  shape this readiness check inventories against.
- `docs/runtime_wasm_build_contract.md` (Stage 418) — the fixed,
  end-to-end diagram from Rust Source through to Runtime, built on top
  of this inventory.
- `docs/runtime_backend_implementation_sequence.md` (Stage 410) — item
  1, the sequence step this document satisfies.
- `docs/runtime_backend_risk_register.md` (Stage 411) — Risks 2/3/4,
  which this readiness check's future item 2 (toolchain introduction)
  must review before proceeding.
- `packages/fedos-core-rust/src/wasm_loader.ts` (Stage 63) — the
  existing, permanently-disabled, hand-written loader placeholder
  referenced in §2.
