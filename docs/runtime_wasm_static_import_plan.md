# FedOS WASM Static Import Plan — Stage 517

**Status: this document records real code's current state — the
static import described below has NOT happened, does NOT happen as a
side effect of anything in this stage, and remains PROHIBITED.**

`docs/runtime_wasm_loader_import_policy.md` (Stage 509) fixed the six
conditions phase #2 ("Import Permission") requires before the
generated JS glue may ever be `import`ed — all still unmet. THIS
document goes one level deeper still: it names the EXACT static
`import` statement a future, separate, explicitly-reviewed stage
would eventually write, and the EXACT exports it expects to find,
without ever writing that statement here.

## 1. Import target

```
packages/fedos-core-rust/pkg/fedos_core_rust.js
```

This is the SAME file `docs/runtime_wasm_js_glue_contract.md` (Stage
481) directly observed on disk after `RUSTFLAGS='--cfg
getrandom_backend="wasm_js"' npm run build:wasm` — a generated,
gitignored artifact (Stage 451), never committed to this repository.

## 2. Expected exports

Per Stage 481's direct observation, the generated JS glue's ONLY
export statement is:

```js
export { initSync, __wbg_init as default };
```

A future static import would therefore be expected to bind exactly
two names:

| Export | Kind | Role |
|---|---|---|
| `initSync` | named | synchronous initializer, takes an already-fetched module |
| `default` (`__wbg_init`) | default | asynchronous initializer, internally `fetch`+`WebAssembly.instantiateStreaming`/`instantiate` |

No crate-specific export exists to expect — none of this crate's 27
`pub fn`s carries a `#[wasm_bindgen]` attribute (Stage 481 §2).

## 3. What this stage does NOT do

- Does **not** write `import { initSync, default as init } from
  "packages/fedos-core-rust/pkg/fedos_core_rust.js"` (or any dynamic
  `import()` equivalent) anywhere in this repository's source.
- Does **not** call `initSync`/the default export.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`.
- Does **not** call `fetch`.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this.
- Does **not** edit or commit any generated file under
  `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`).

`src/runtime/fedos_wasm_static_import_plan.ts` (Stage 518) is the
real, fixed-value implementation of this plan —
`planStaticImport()` is fixed `"BlockedByPolicy"`, and the target
string above is recorded as a plain, non-resolved LABEL (never
`import()`-ed, never `require()`-ed, never read from the filesystem
to confirm it exists).

## See also

- `docs/runtime_wasm_js_glue_contract.md` (Stage 481) — the direct
  observation this plan's target path and expected export list are
  read from.
- `docs/runtime_wasm_loader_import_policy.md` (Stage 509) — the six
  conditions that must ALL hold before the plan named here could ever
  be carried out.
- `src/runtime/fedos_wasm_static_import_plan.ts` (Stage 518–519) —
  the real, fixed-value implementation and its wiring from
  `fedos_wasm_loader_import_policy.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 521) —
  the diagram naming Static Import Plan's position between Import
  Policy and Generated JS Glue.
