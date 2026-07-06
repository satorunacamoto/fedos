# FedOS Rust → WASM build plan (Stage 393–400)

**Status: this document is PLANNING ONLY.** It records the intended
build pipeline shape — it does NOT build anything, generate any
`.wasm` file, invoke `wasm-bindgen`/`wasm-pack`, or add any tooling
dependency. Every stage below is explicitly a future, separate,
explicitly-reviewed decision.

## The intended build pipeline

```
packages/fedos-core-rust (crate)     <-- exists today, real, tested
     |
     v
wasm32 target                        <-- PLANNING ONLY. Not built.
     |   (e.g. `cargo build --target wasm32-unknown-unknown`)
     v
bindgen                               <-- PLANNING ONLY. Not run.
     |   (e.g. `wasm-bindgen` generating a JS/TS glue module)
     v
loader                                <-- PLANNING ONLY. Not connected.
     |   (`packages/fedos-core-rust/src/wasm_loader.ts`, Stage 63 —
     |    already exists as an inert, disabled-by-default placeholder)
     v
Runtime Provider                      <-- PLANNING ONLY. Not connected.
     (`src/runtime/fedos_wasm_boundary.ts`, Stage 386 — placeholder,
      never loads anything; `src/runtime/fedos_wasm_artifact.ts`,
      Stage 394 — placeholder, never builds anything)
```

Each arrow above names a REAL step a genuine WASM build would need —
but naming the step is not performing it. Every step in this pipeline
is, today, either (a) nonexistent, or (b) an inert placeholder that
structurally represents the step without ever executing it.

## Step-by-step: what exists vs. what is planned

| Step | What exists today | What is planned (NOT done) |
|---|---|---|
| Crate | ✅ Real: `packages/fedos-core-rust/src/lib.rs`, 27 `pub fn`s, fully tested via `cargo test`. | — |
| WASM target | ❌ Nothing. No `wasm32-unknown-unknown`/`wasm32-wasip1` target is ever built. | A future stage would run `cargo build --target wasm32-unknown-unknown` (or similar) against the EXISTING crate, unmodified. |
| Bindgen | ❌ Nothing. No `wasm-bindgen` dependency exists in `Cargo.toml`. | A future stage would add `wasm-bindgen` as a build-time tool (likely a `dev-dependency` or a separate build script), generating JS/TS glue code from the crate's (still to be reviewed) public WASM-facing surface. |
| Loader | ✅ Exists as an INERT placeholder: `packages/fedos-core-rust/src/wasm_loader.ts` (Stage 63) — `PlaceholderFedosCoreWasmLoader`/`NoopFedosCoreWasmLoader`, both permanently disabled, neither calls `fetch`/`WebAssembly.instantiate`/dynamic `import()`. | A future stage would replace the placeholder's `load()` body with a real `WebAssembly.instantiate` call against the bindgen output — an explicit, reviewed change to an ALREADY-EXISTING file. |
| Runtime Provider | ✅ Exists as an INERT placeholder chain: `FedosWasmBoundary` (Stage 386, `planLoad()`/`planEncrypt()`/`planDecrypt()` all `"BlockedByImplementation"`) and `FedosWasmArtifact` (Stage 394, `planBuild()`/`planLoad()` all `"BlockedByImplementation"`). | A future stage would connect these placeholders' methods to the real loader above, replacing the fixed `"BlockedByImplementation"` answer with a real one — ONLY after `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` is genuinely flipped by its own, separate, explicitly-reviewed stage. |

## Why this order

Building the WASM target and running bindgen BEFORE wiring the
Runtime Provider chain would leave a compiled artifact with no
consumer, and no test coverage proving it is ever gated correctly.
Wiring the Runtime Provider chain (already substantially done, Stages
305–392) BEFORE ever producing a real `.wasm` file means every
fail-closed guarantee (Dual Lock, `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED`,
Execution Review, per-layer guard tests) is proven FIRST, against a
harmless placeholder, before there is anything real to gate. This
mirrors `docs/runtime_rust_boundary_decision.md`'s (Stage 385) own
reasoning: prove the harmless path works before there is anything
dangerous to prove it against.

## Still true after this stage

- No `.wasm` file is generated, committed, or loaded.
- No `wasm-bindgen`/`wasm-pack` dependency is added to `Cargo.toml`/
  `package.json`.
- No `cargo build --target wasm32-*` is ever invoked by any script,
  test, or CI step in this repository.
- No `WebAssembly.instantiate`/`WebAssembly.compile` call anywhere.
- No Rust cryptographic operation is ever executed.
- No Runtime activation, no Worker activation.
- `FEDOS_RUNTIME_PROVIDER_IMPLEMENTED` stays permanently `false`;
  `FEDOS_CRYPTO_ENABLED` handling is unchanged.
- No `Cargo.toml`/`package.json` change, no new Rust public API, no
  new `pub fn`.

## See also

- `docs/runtime_rust_boundary_decision.md` (Stage 385) — the formal
  decision that WebAssembly, not Native Addon/CLI/FFI, is the sole
  official MVP boundary this plan builds toward.
- `docs/runtime_wasm_boundary.md` (Stage 386–390) — the `FedosWasmBoundary`
  placeholder this plan's "Runtime Provider" row references.
- `docs/runtime_wasm_artifact.md` (Stage 394–398) — the `FedosWasmArtifact`
  placeholder modeling the "build" step of this pipeline.
- `test/fedos_core_wasm_loader.test.ts` (Stage 63) — the pre-existing,
  permanently-disabled loader this plan's "Loader" row references.
