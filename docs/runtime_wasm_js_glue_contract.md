# FedOS generated `wasm-bindgen` JS glue — observed contract — Stage 481

**Status: this document records a direct OBSERVATION of the real,
locally-generated `wasm-bindgen` JS glue — nothing here is inferred,
guessed, or extrapolated.** Every fact below was read directly off
the files `RUSTFLAGS='--cfg getrandom_backend="wasm_js"' npm run
build:wasm` (`package.json`, Stage 450/467) produced under
`packages/fedos-core-rust/pkg/` after Stage 475's version-alignment
fix (`docs/runtime_wasm_bindgen_version_policy.md`). This document
does not load, import, execute, or wire this output to anything — it
is a written record of what exists on disk, for a future,
separate, explicitly-reviewed stage to design against.

## 1. That JS glue is generated

Running the command above produces exactly four files under
`packages/fedos-core-rust/pkg/`:

| File | Role |
|---|---|
| `fedos_core_rust.js` | The JS glue module itself |
| `fedos_core_rust.d.ts` | TypeScript declarations for the JS glue |
| `fedos_core_rust_bg.wasm` | The `wasm-bindgen`-post-processed compiled WASM binary |
| `fedos_core_rust_bg.wasm.d.ts` | TypeScript declarations for the raw WASM module's own exports |

This confirms `docs/runtime_wasm_generation.md` §1's diagram
(`cargo build` → `wasm-bindgen` → Generated JS Glue → Generated
`.wasm`) completes end-to-end, per
`docs/runtime_wasm_artifact_observation.md` §10 (Stage 476).

## 2. Export list — `fedos_core_rust.js`

The JS glue's ONLY export statement, verbatim:

```js
export { initSync, __wbg_init as default };
```

Two exports total:

1. **`initSync`** — a named export, a SYNCHRONOUS initializer taking
   an already-fetched module (bytes or a precompiled
   `WebAssembly.Module`).
2. **`default`** (the function is internally named `__wbg_init`) —
   the DEFAULT export, an ASYNCHRONOUS initializer that accepts a
   URL/`Request`/`Response`/module and internally calls `fetch()` and
   `WebAssembly.instantiateStreaming()`/`WebAssembly.instantiate()`.

**No other export exists.** In particular: no function corresponding
to any of this crate's 27 `pub fn`s (`src/lib.rs`) is exported —
because none of them carries a `#[wasm_bindgen]` attribute, `cargo
build --target wasm32-unknown-unknown` compiles the crate's public
Rust API as plain (non-JS-visible) Rust, and `wasm-bindgen` has
NOTHING crypto/domain-specific to bind. The generated JS glue exposes
ONLY the generic module-loading machinery `wasm-bindgen` itself
provides for every crate, regardless of that crate's own contents.

## 3. Default export — PRESENT

Confirmed directly (§2): `export { initSync, __wbg_init as default };`
includes a `default` export. Its type signature
(`fedos_core_rust.d.ts`):

```ts
export default function __wbg_init(module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
```

## 4. Init function(s) — PRESENT, TWO forms

Both an async and a sync initializer exist:

- **`initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput`**
  — synchronous, named export.
- **`default(module_or_path?: ...): Promise<InitOutput>`** — the
  asynchronous default export described in §3.

Both return an `InitOutput` (§5). Neither is called, referenced, or
imported anywhere else in this repository as a result of this
document.

## 5. Memory export — PRESENT

`fedos_core_rust_bg.wasm.d.ts` (the raw WASM module's own declared
exports) contains, verbatim:

```ts
export const memory: WebAssembly.Memory;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_start: () => void;
```

`memory` (a `WebAssembly.Memory`) IS exported by the compiled WASM
module. It surfaces through the JS glue's `InitOutput` interface
(`fedos_core_rust.d.ts`):

```ts
export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}
```

## 6. Full structure of the generated `wasm-bindgen` output

- **`fedos_core_rust.js`** (3,720 bytes) — defines `__wbg_get_imports`
  (the WASM import object — a single import,
  `__wbindgen_init_externref_table`, used to seed the externref
  table with `undefined`/`null`/`true`/`false`), `__wbg_finalize_init`
  (stores the instantiated module/instance, calls
  `wasm.__wbindgen_start()`), `__wbg_load` (handles
  `Response`-vs-raw-module instantiation, preferring
  `WebAssembly.instantiateStreaming`), `initSync`, and the default
  `__wbg_init`. This `wasm-bindgen` version (`0.2.126`) consolidates
  what older versions split into a separate `*_bg.js` shim into this
  single file — no separate `_bg.js` file exists, and none is
  expected.
- **`fedos_core_rust.d.ts`** (1,166 bytes) — `InitInput`,
  `InitOutput`, `SyncInitInput` types plus `initSync`/`default`
  declarations (§3–4).
- **`fedos_core_rust_bg.wasm`** (18,377 bytes) — the compiled,
  `wasm-bindgen`-processed WASM binary. Its own exports (per
  `fedos_core_rust_bg.wasm.d.ts`, §5) are exactly `memory`,
  `__wbindgen_externrefs`, `__wbindgen_start` — no other WASM export
  exists, confirming §2's finding that no crate-specific function was
  ever bound.
- **`fedos_core_rust_bg.wasm.d.ts`** (181 bytes) — declares the three
  raw WASM exports (§5).

## 7. What this document does NOT do

- Does not import, `require()`, or dynamically `import()`
  `fedos_core_rust.js` from anywhere in this repository's source.
- Does not call `initSync`/the default export, `WebAssembly.instantiate`,
  `WebAssembly.compile`, or `fetch` against any of these files.
- Does not wire this output to `FedosWasmBoundary`/`FedosWasmArtifact`/
  `ExecutionBackend`/`create_runtime.ts`/`src/worker.ts`.
- Does not edit any generated file under `packages/fedos-core-rust/pkg/`.
- Does not commit any generated file — `pkg/` remains gitignored
  (Stage 451); this document only describes what Stage 475 already
  produced and observed once.
- Does not speculate about future function exports, a future loader
  design, or what would happen if `#[wasm_bindgen]` were added to any
  `pub fn` — none of that is decided or implied here.

## See also

- `docs/runtime_wasm_artifact_observation.md` §10–11 (Stage 476) — the
  first successful generation run this document's observations were
  read from.
- `docs/runtime_wasm_bindgen_version_policy.md` (Stage 473–474) — the
  CLI/crate version alignment that made generation succeed at all.
- `src/runtime/fedos_wasm_loader_contract.ts` (Stage 482) — the pure,
  fixed-value, UNWIRED contract model this observation informs.
- `docs/runtime_internal_execution_contract.md` (Stage 484) — the
  updated architecture diagram naming Generated JS Glue/Generated
  WASM as distinct boxes, still both unreachable from Runtime/Worker.
