# FedOS Generated JS Glue — `version()` Export Verification (Prototype EXECUTION Phase 011)

**Status: this document records a ONE-TIME, real, local build-and-inspect
verification — no code change of any kind. `target/`, `Cargo.lock`, and
`pkg/` were regenerated, inspected, and immediately deleted; none is
committed. `src/runtime/fedos_wasm_loader.ts` and every other TypeScript
file are byte-for-byte unchanged. This Phase confirms the generated JS
glue export surface only — it does not import, execute, or call any of
it.**

## 1. Build procedure used

```bash
RUSTFLAGS='--cfg getrandom_backend="wasm_js"' npm run build:wasm
```

Which runs (per `package.json`'s own `build:wasm` script):

```bash
cargo build --manifest-path packages/fedos-core-rust/Cargo.toml \
  --target wasm32-unknown-unknown --release
wasm-bindgen --target web --out-dir packages/fedos-core-rust/pkg \
  packages/fedos-core-rust/target/wasm32-unknown-unknown/release/fedos_core_rust.wasm
```

Both steps completed with `Finished` / no error. `wasm-bindgen-cli` was
already installed at `0.2.126`, matching the crate's own direct
`wasm-bindgen` dependency (Stage 985) — no version skew
(`docs/runtime_wasm_bindgen_version_policy.md`).

## 2. Generated files inspected

```txt
packages/fedos-core-rust/pkg/fedos_core_rust.js         (5,611 bytes)
packages/fedos-core-rust/pkg/fedos_core_rust.d.ts        (1,944 bytes)
packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm    (18,629 bytes)
packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm.d.ts  (300 bytes)
```

## 3. JS Glue export list — exactly three, nothing else

```js
export function version() {
    ...
    const ret = wasm.version();
    ...
}
...
export { initSync, __wbg_init as default };
```

Grepping every top-level `export` statement in `fedos_core_rust.js`
confirms EXACTLY two `export` lines, producing EXACTLY three named
exports: **`version`**, **`initSync`**, and **`default`** — no fourth
export, no crate-specific export beyond `version`, and no leaked
internal helper (`__wbg_get_imports`, `getStringFromWasm0`,
`getUint8ArrayMemory0`, `decodeText`, `__wbg_finalize_init`,
`__wbg_load` are all unexported, file-private functions).

## 4. `version` corresponds to the real Rust `#[wasm_bindgen] pub fn version()`

The generated `version()` wrapper's own doc comment is copied verbatim
from `src/lib.rs`'s Stage 986 doc comment (wasm-bindgen propagates Rust
doc comments into the generated JS/TS), and its body calls
`wasm.version()` — the raw WASM export produced by compiling
`#[wasm_bindgen] pub fn version() -> String` — then decodes the
returned `(ptr, len)` pair back into a JS string via
`getStringFromWasm0`. This is the SAME generic string-marshalling
pattern `wasm-bindgen` uses for any `String`-returning export; nothing
crate-specific beyond the function's own name and doc comment.

## 5. Pre-existing exports (`default`/`initSync`) are unchanged

```js
export { initSync, __wbg_init as default };
```

Byte-for-byte the same export statement `docs/runtime_wasm_js_glue_contract.md`
(Stage 481) and `docs/runtime_wasm_loader_dev_only_wasm_initialization_execution.md`
(Stage 969) already recorded — `initSync(module)` (sync) and
`__wbg_init` exported `as default` (async, defaulting to
`fetch(new URL('fedos_core_rust_bg.wasm', import.meta.url))` when
called with no argument). Neither function's own signature or behavior
changed by adding `version()`.

## 6. TypeScript definitions (`fedos_core_rust.d.ts`) — `version(): string` present

```ts
export function version(): string;
```

Present at the top of `fedos_core_rust.d.ts`, alongside the
pre-existing `InitInput`/`InitOutput`/`SyncInitInput` types and the
`initSync`/default-export declarations. `InitOutput` also gained a
matching raw-export field:

```ts
export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly version: () => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}
```

(`readonly version: () => [number, number]` is the RAW WASM export
signature — a pointer/length pair, not yet decoded to a string; this
is internal plumbing `InitOutput` has always exposed for every
`String`-returning export, not a second public API.)

## 7. No extra export — verified

- Exactly 3 named exports total (`version`, `initSync`, `default`).
- No crypto/domain-specific symbol (`encrypt`, `decrypt`, `nip44`,
  `SecretHandle`, `ConversationKey`, etc.) appears anywhere in the
  generated glue — confirmed by the SAME lowercase substring scan
  `docs/runtime_wasm_js_glue_contract.md` §2 already used.
- No OTHER `#[wasm_bindgen]`-annotated function exists in `src/lib.rs`
  (Stage 986 added exactly one) — so no further crate-specific export
  could have appeared even in principle.

## 8. Runtime — still unconnected

`src/runtime/fedos_wasm_loader.ts` and every other TypeScript file are
byte-for-byte unchanged by this Phase. No file imports, `import()`s,
executes, or references the generated JS glue's `version` export. The
JS Glue import process (`attemptDevOnlyJsGlueImport()`, Stage 945) and
the WASM initialization process (`attemptDevOnlyWasmInitialization()`,
Stage 969) are both unmodified — this Phase only inspects the
ALREADY-generated output of a build those two methods do not trigger.

## 9. What this Phase does NOT do

- Does **not** call `version()` from any TypeScript file.
- Does **not** change `src/runtime/fedos_wasm_loader.ts` or any other
  Runtime file.
- Does **not** change the JS Glue import process.
- Does **not** change the WASM initialization process.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** change `Cargo.toml` or `package.json`.
- Does **not** commit `target/`, `Cargo.lock`, or `pkg/`.

## 10. Next Phase (not this one)

A future, separate, explicitly-reviewed stage would call `version()`
from `src/runtime/fedos_wasm_loader.ts` for the FIRST time — the first
genuine Rust-API-call crossing this arc's Fail-Closed boundary has
been building toward since Stage 945. This Phase implements none of
that; it only confirms the export exists and matches expectations.

## 11. See also

- `docs/runtime_wasm_js_glue_contract.md` (Stage 481) — the original
  export-observation record this Phase re-confirms and extends.
- `docs/runtime_wasm_rust_export_bindgen_dependency.md` (Prototype
  EXECUTION Phase 009) — added the `wasm-bindgen` dependency this
  export depends on.
- `docs/runtime_wasm_rust_version_export.md` (Prototype EXECUTION
  Phase 010) — added the Rust `version()` function this Phase
  verifies made it into the generated output.
- `docs/runtime_wasm_bindgen_version_policy.md` — the CLI/crate
  version-alignment policy that kept this build skew-free.
