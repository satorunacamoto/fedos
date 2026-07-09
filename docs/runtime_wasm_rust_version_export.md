# FedOS Rust — Minimal `version()` Export (Prototype EXECUTION Phase 010)

**Status: this document records a SINGLE, narrowly-scoped `src/lib.rs`
change — adding the crate's FIRST `#[wasm_bindgen]`-annotated function,
`version()` (Stage 986) — the minimal candidate
`docs/runtime_wasm_rust_export_readiness_review.md` (Prototype EXECUTION
Phase 008) named and `docs/runtime_wasm_rust_export_bindgen_dependency.md`
(Prototype EXECUTION Phase 009) prepared for. Adds ONLY the function. No
TypeScript call, no Cargo.toml change, no other Rust API change, and no
generated JS glue committed.**

## 1. What this Phase adds

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn version() -> String {
    "fedos-core-rust/0.0.0".to_string()
}
```

Added to `packages/fedos-core-rust/src/lib.rs`, immediately after the
crate-private `fedos_runtime_ping_internal()` (Stage 369) and before the
file's first `#[cfg(test)]` module — the same production-code region every
other `pub fn` in this crate already lives in.

## 2. Why this function, and why now

Phase 008's review recommended a NEW, minimal, `String`-returning function
as the first `#[wasm_bindgen]` candidate — explicitly never retrofitting
any of the 27 pre-existing functions, since every one of them returns a
custom struct/enum/slice that would need its own additional ABI-crossing
annotation, whereas `String` is natively supported by `wasm-bindgen`.
Phase 009 made the `#[wasm_bindgen]` attribute usable at all by adding
`wasm-bindgen` as a direct dependency. This Phase is the natural next,
minimal step: apply the attribute to exactly the function Phase 008 named,
and nothing else.

## 3. Zero side effects — verified

- Returns a fixed string literal (`"fedos-core-rust/0.0.0"`), the crate's
  `Cargo.toml` `version = "0.0.0"` plus its own package name.
- No parameter, no allocation beyond the `String` return value itself, no
  I/O, no randomness, no key/seed/plaintext/ciphertext byte touched.
- `#![forbid(unsafe_code)]` (crate-level, unchanged) still holds — `cargo
  check` and a real `cargo build --target wasm32-unknown-unknown` (with
  `RUSTFLAGS='--cfg getrandom_backend="wasm_js"'`) both compile cleanly
  with this function present; the `#[wasm_bindgen]` macro's own expansion
  does not require `unsafe` in the annotated function's own body.

## 4. Rust public API — now 28 `pub fn`

The pre-existing 27 `pub fn`s (`fedos_core_status` through `fedos_decrypt`)
are byte-for-byte unchanged — same signatures, same bodies, same doc
comments. `version()` is the 28th, and the ONLY one carrying
`#[wasm_bindgen]`. `fedos_runtime_ping_internal()` remains `pub(crate)`,
not `pub`, and is unaffected.

## 5. Generated JS glue — inspected once, not committed

A one-time, local `npm run build:wasm` run (immediately deleted along with
`target/`/`Cargo.lock`/`pkg/`) confirmed the regenerated JS glue now
exports `version()` alongside the pre-existing `initSync`/`default`:

```js
export function version() {
    ...
    const ret = wasm.version();
    ...
}
...
export { initSync, __wbg_init as default };
```

This Phase does not commit that output — `target/`, `Cargo.lock`, and
`pkg/` remain gitignored, exactly as every prior Stage in this arc has
kept them (`docs/runtime_wasm_js_glue_contract.md` §7).

## 6. What this Phase does NOT do

- Does **not** call `version()` from any TypeScript file.
- Does **not** change `src/runtime/fedos_wasm_loader.ts` or any other
  TypeScript file.
- Does **not** change the JS Glue import process
  (`attemptDevOnlyJsGlueImport()`, Stage 945).
- Does **not** change the WASM initialization process
  (`attemptDevOnlyWasmInitialization()`, Stage 969).
- Does **not** apply `#[wasm_bindgen]` to any of the 27 pre-existing
  functions.
- Does **not** implement any cryptographic operation.
- Does **not** change `Cargo.toml` from its Phase 009 (Stage 985) state.
- Does **not** change `package.json`.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** commit `target/`, `Cargo.lock`, or `pkg/`.

## 7. Next Phase (not this one)

A future, separate, explicitly-reviewed stage would regenerate the JS
glue and confirm — from the TypeScript side, without yet calling it —
that `version()` is present in the generated export list (a "Generated
JS Glue export confirmation" step). Calling `version()` from
`fedos_wasm_loader.ts` is a further, later stage still. This Phase
implements neither.

## 8. See also

- `docs/runtime_wasm_rust_export_readiness_review.md` (Prototype
  EXECUTION Phase 008) — named `version() -> String` as the minimal
  first candidate this Phase implements.
- `docs/runtime_wasm_rust_export_bindgen_dependency.md` (Prototype
  EXECUTION Phase 009) — added the `wasm-bindgen` dependency this
  Phase's `#[wasm_bindgen]` attribute requires.
- `docs/runtime_wasm_js_glue_contract.md` — the generated-artifact,
  never-committed convention this Phase continues to follow.
- `packages/fedos-core-rust/src/lib.rs` (Stage 986) — the real
  function this document describes.
