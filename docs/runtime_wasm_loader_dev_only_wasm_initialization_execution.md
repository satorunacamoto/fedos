# FedOS WASM Loader — Dev-only WASM Initialization (Prototype EXECUTION Phase 007)

**Status: this document describes an already-landed, narrowly-scoped
addition — `FedosWasmLoaderSkeleton.attemptDevOnlyWasmInitialization()`
(`src/runtime/fedos_wasm_loader.ts`, Stage 969). It is the FIRST time
this arc ever initializes WebAssembly. It changes no Runtime/Worker
wiring, adds no diagnostics field, does not change `planLoad()`'s own
body or external return value, and never calls any Rust API.**

## 1. Pre-check: what the generated JS glue actually is

Before writing any code, the real artifact was built once (`npm run
build:wasm`), inspected, and deleted (`target/`/`Cargo.lock`/`pkg/`
removed; `git status --short` confirmed clean). Findings:

- **Target: `web`.** Confirmed by `package.json`'s own `build:wasm`
  script (`wasm-bindgen --target web ...`) and by the generated code
  itself.
- **Exactly two exports, verbatim:** `export { initSync, __wbg_init as
  default };` — matching `docs/runtime_wasm_js_glue_contract.md`'s own
  Stage 481 historical observation exactly (byte-identical file
  sizes).
- **No crate-specific export of any kind.** No `version`, no function
  corresponding to any of the crate's 27 `pub fn`s — because none
  carries `#[wasm_bindgen]`. `wasm-bindgen`'s own generic
  module-loading machinery is ALL that is exported, regardless of
  outcome.
- **`default()`'s own no-argument fallback is a real risk** under this
  project's Node/Vitest runtime: with no argument, it builds `new
  URL('fedos_core_rust_bg.wasm', import.meta.url)` and calls `fetch()`
  on the resulting `file://` URL — not universally supported across
  Node versions without extra configuration.

This confirms: **initializing WASM here can never reach a Rust `pub
fn`, regardless of which init path is used or whether it succeeds.**

## 2. Why the init API is never hand-picked in source

The generated JS glue exposes BOTH `initSync` (sync, named) and
`default`/`__wbg_init` (async, default export) — there is no single
canonical choice, and a future regeneration of the artifact (a
different `wasm-bindgen` version, a different `--target`) could change
which functions exist. `attemptDevOnlyWasmInitialization()` therefore
checks, AT RUNTIME, which of EXACTLY two named functions the retained
module (`jsGlueModule()`, Stage 961) actually exposes:

```txt
1. typeof module.initSync === "function"  -> use initSync
2. else typeof module.default === "function" -> use default
3. else -> InitializationUnavailable
```

**This is existence-checking, not export analysis or Rust-function
discovery.** Nothing beyond these two names is ever inspected.

## 3. Why `initSync` is preferred when present

Per §1, `default()`'s own no-argument fallback risks a `fetch(file://...)`
call under Node. `initSync` avoids `fetch` entirely — it takes bytes
or a `WebAssembly.Module` directly. Preferring `initSync` when
available sidesteps the highest-risk path identified in the pre-check.

**Either way, `default()` is NEVER called with no argument.** This
stage always reads the SAME `fedos_core_rust_bg.wasm` bytes Stage 921
already names (`packages/fedos-core-rust/pkg/fedos_core_rust_bg.wasm`
— no new artifact discovery) and passes them EXPLICITLY:

- To `initSync`: `{ module: wasmBytes }`.
- To `default`: `{ module_or_path: wasmBytes }`.

`WebAssembly.instantiateStreaming`'s own `Response`-with-`Content-Type`
expectation inside `default()`'s internal `__wbg_load` is never
exercised either, since raw bytes take the non-streaming branch.

## 4. Initialization conditions — all four required

```ts
attemptDevOnlyWasmInitialization(): Promise<FedosWasmLoaderWasmInitialization>
```

Gated on ALL FOUR of, every one populated by an EARLIER call, never
re-evaluated here:

1. `this.#importReadiness.ready === true` (Stage 937).
2. `this.#devOnlyGateEvaluation.developmentAllowed === true` (Stage 929).
3. `this.#importExecution.succeeded === true` (Stage 945).
4. `this.#jsGlueModule !== null` (Stage 961).

Any of the four missing/`false`/`null`: initialization is NEVER
attempted.

## 5. Result — recorded, never retained

```ts
interface FedosWasmLoaderWasmInitialization {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly reason: "Initialized" | "NotReady" | "InitializationUnavailable" | "InitializationFailed" | "PrototypeStillClosed";
}
```

The init function's own return value (`InitOutput` — `memory`,
`__wbindgen_externrefs`, `__wbindgen_start`) is **NEVER retained,
NEVER inspected, and NEVER read anywhere in this file.** Only the
boolean outcome is recorded, on `#wasmInitialization`, readable via
`wasmInitialization()`.

## 6. Rust API remains entirely unreached

Even on a successful initialization, NO Rust API call of any kind is
ever made — not because of any additional guard, but because the
generated JS glue exposes none to call (§1). `version()` and every
other `pub fn` remain structurally unreachable regardless of outcome.

## 7. Fail Closed

ALL of the following resolve `succeeded: false`, NEVER a thrown
exception out of `attemptDevOnlyWasmInitialization()`:

- No retained module.
- The most recent import did not succeed.
- `importReady` is `false`.
- Production or Unknown runtime.
- Neither `initSync` nor `default` is present on the module.
- Reading `fedos_core_rust_bg.wasm`'s bytes fails.
- The init function itself throws or rejects.

`planLoad()` still ALWAYS returns `BlockedByPolicy`, regardless of
whether initialization was ever attempted or what its outcome was —
`planLoad()`'s own body is BYTE-FOR-BYTE UNCHANGED by this stage.

## 8. A testable seam, not a real-artifact dependency

`FedosWasmLoaderSkeletonOptions.readGeneratedWasmBytes` (mirroring
Stage 945's `importGeneratedJsGlue`) lets tests observe every path
without depending on a real `fedos_core_rust_bg.wasm` on disk, or
writing one into the shared `packages/fedos-core-rust/pkg/` directory.
`createFedosWasmLoader()` never supplies it — real callers always get
real `node:fs` `readFileSync`.

## 9. What this Phase does NOT do

- Does **not** call any Rust API, including `version()`.
- Does **not** search for or bind any crate-specific function.
- Does **not** retain the WASM `Instance`, `Module`, or `memory`.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** modify `Cargo.toml` or `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts` or
  `worker_crypto_diagnostics.ts` — no new diagnostics field.
- Does **not** change `planLoad()`'s own body, external return value,
  key order, or the public `FedosWasmLoader` contract.

## 10. See also

- `docs/runtime_wasm_loader_js_glue_import_result_review.md`
  (Prototype EXECUTION Phase 005) — named the `initSync` vs. `default`
  comparison this Phase resolves, and named `version()` as the future
  first Rust API target this Phase deliberately still does not reach.
- `docs/runtime_wasm_loader_js_glue_module_retention_execution.md`
  (Stage 961, Prototype EXECUTION Phase 006) — the retained module
  this Phase inspects for its init functions.
- `docs/runtime_wasm_js_glue_contract.md` — the original Stage 481
  observation this Phase's own Pre-check reconfirmed byte-for-byte.
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth, gaining a Stage 969 update alongside this
  doc.
- `src/runtime/fedos_wasm_loader.ts` (Stage 969) — the real
  implementation this document describes.
