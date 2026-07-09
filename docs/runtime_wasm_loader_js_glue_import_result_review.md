# FedOS WASM Loader — JS Glue Import Result Review & WASM Init Strategy (Prototype EXECUTION Phase 005)

**Status: this document is a REVIEW ONLY — it adds no code, no new
execution logic, no diagnostics field, and no `WebAssembly`/Rust
reference of any kind to `src/runtime/fedos_wasm_loader.ts`. It
reviews what Stage 945 (Prototype EXECUTION Phase 004) actually built,
confirms the current sync/async architecture is sound, and compares
WASM initialization strategies for a FUTURE, separate,
explicitly-reviewed stage to choose from. It does not initialize
WebAssembly and does not call any Rust API.**

## 1. `planLoad()` stays synchronous

`FedosWasmLoaderSkeleton.planLoad()` (`src/runtime/fedos_wasm_loader.ts`)
remains, and this review reaffirms it MUST remain, a fully
SYNCHRONOUS method returning `FedosWasmLoaderDecision` directly — not
a `Promise`. Every stage since Stage 489 has been verified by test
files that call `planLoad()` and assert on its return value
immediately, synchronously, dozens of times over. Stage 945 (Prototype
EXECUTION Phase 004) explicitly chose NOT to add any call inside
`planLoad()`'s own body for exactly this reason — `planLoad()` remains
byte-for-byte unchanged since that stage, and this review confirms
that decision was correct and should continue to guide every future
stage: **no future stage should make `planLoad()` asynchronous.**

## 2. `attemptDevOnlyJsGlueImport()` is the async boundary

`attemptDevOnlyJsGlueImport(): Promise<FedosWasmLoaderImportExecution>`
(Stage 945) is — and this review confirms it should remain — the ONE
async boundary in this file. It is:

- Separate from `planLoad()` — called by nothing inside `planLoad()`'s
  own body, and by nothing in `create_runtime.ts`/`src/worker.ts`.
- Gated exclusively by `this.#importReadiness.ready === true`
  (populated by the most recent `planLoad()` call).
- The ONLY place in this file that has ever called real `import()`.

Any FUTURE stage that adds WASM initialization should follow this SAME
pattern: a new, separate, async method, gated by the PRIOR stage's own
recorded result, never folded into `planLoad()`'s synchronous body.

## 3. Current spec, reconfirmed: the imported module is discarded

As of Stage 945, `attemptDevOnlyJsGlueImport()` discards the imported
module's own return value immediately — never assigned to a field,
never inspected, never called. This review CONFIRMS that is still the
current, correct spec: `FedosWasmLoaderImportExecution`
(`attempted`/`succeeded`/`reason`) only ever names whether the
`import()` itself resolved — never anything about what the imported
module contains or exports. `WebAssembly.instantiate`/`compile`,
`new WebAssembly.Module`/`new WebAssembly.Instance`, `initSync`,
`__wbg_init`, and any Rust API call (including `version()`) remain
entirely unreached by this Prototype, exactly as every prior stage's
own guard tests already verify.

## 4. Should a future stage retain the module?

**Deferred — not decided by this review.** Retaining the imported
module object (rather than discarding it) is a PRECONDITION for any
future stage that would actually call `initSync`/`__wbg_init` on it,
so SOME future stage will need to revisit Stage 945's "discard
immediately" behavior. This review does not make that change — it
only names the question as something the NEXT stage that attempts real
WASM initialization would need to resolve, likely by extending
`FedosWasmLoaderImportExecution` (or a sibling type) with an optional
module reference, gated the SAME way `attemptDevOnlyJsGlueImport()`
itself is gated.

## 5. WASM Init Strategy — `initSync` vs. async default init / `__wbg_init`

Rust `wasm-bindgen`-generated JS glue (matching
`docs/runtime_wasm_js_glue_contract.md`'s own observed shape of
`fedos_core_rust.js`) conventionally exposes two initialization paths:

| Strategy | Shape | Trade-offs |
|---|---|---|
| **`initSync(module)`** | Synchronous; takes an already-compiled `WebAssembly.Module` (or raw bytes) and instantiates it in one call. | Keeps the init step itself synchronous once the bytes are available — but STILL requires the bytes to have been fetched/read asynchronously beforehand (via `import()`/`fetch`/`readFile`), so the overall pipeline is still async end-to-end. Simpler control flow once the module is in hand; no separate `.then()` chain for instantiation itself. |
| **async default init `__wbg_init(...)`** | Asynchronous; wraps `WebAssembly.instantiateStreaming`/`instantiate` internally, returns a `Promise` that resolves once both fetch AND instantiation complete. | Matches the browser-first `wasm-bindgen` convention most closely (handles streaming compilation where available) — but adds a SECOND async boundary inside what `attemptDevOnlyJsGlueImport()` already made async, and hides the instantiation step's own error surface behind one more `await`. |

**This review does not recommend one over the other yet** — that
choice belongs to whichever future, separate, explicitly-reviewed
stage actually implements WASM initialization, once §4's
module-retention question is resolved (the choice of `initSync` vs.
`__wbg_init` depends on WHAT shape the retained module reference takes
— raw bytes/`ArrayBuffer` favor `initSync`, a `Response`/stream favors
`__wbg_init`). This review's only conclusion here is that BOTH options
remain viable, BOTH are equally unreached today, and the decision is
explicitly deferred, not implicitly settled by omission.

## 6. Prototype's own first real API target: `version()`

When a future stage eventually reaches the point of calling ANY real
Rust public function, this review recommends (matching
`docs/runtime_wasm_loader_rust_api_call_plan.md`'s own Stage 905
naming) that the FIRST real call target should be `version()` — the
smallest, side-effect-free function among the 27 `pub fn` in
`packages/fedos-core-rust/src/lib.rs`. `version()` reads no state,
mutates nothing, and returns a simple diagnostic value, making it the
lowest-risk possible first real Rust boundary crossing. This review
does NOT call `version()` — it only names it as the recommended future
target, exactly as `nextRequiredCheck` fields throughout this arc name
future steps without performing them.

## 7. Production and Worker — still unconnected

Unchanged from every prior stage in this arc:

- **Production stays Fail Closed.** No code path in
  `src/runtime/fedos_wasm_loader.ts` distinguishes Production from any
  other runtime differently than Stage 929's own `NODE_ENV` evaluation
  already does; Production never reaches a different answer.
- **Worker stays unconnected.** `src/worker.ts` continues to never
  reference `fedos_wasm_loader.ts`, `attemptDevOnlyJsGlueImport()`,
  `importExecution()`, `policy()`, or `planLoad()`, directly or
  indirectly.

## 8. Fail Closed — restated, unchanged

This review changes none of the fixed values Stages 841–945 already
established:

```txt
policy.allowed                            = false
Load Plan.shouldLoad                      = false
JS Glue Access Plan.shouldAccess          = false
Generated Artifact Check Plan.shouldCheck = false
Dev-only Gate Plan.shouldEvaluate         = false
Import Plan.shouldImport                  = false
WebAssembly Plan.shouldInstantiate        = false
Rust API Call Plan.shouldCall             = false
```

`planLoad()` still ALWAYS returns `BlockedByPolicy`, regardless of
whether `attemptDevOnlyJsGlueImport()` has ever been called, or with
what result — this review does not touch that invariant.

## 9. Recommended path forward: Option B (separation of concerns)

Three options were considered for how a future stage would eventually
initialize WebAssembly:

```txt
Option A: retain the imported module, initialize it in the SAME next Phase
Option B: record import success/failure only; initialization is a SEPARATE, later API
Option C: a single combined attemptDevOnlyJsGlueImportAndInit()-style API
```

**Recommendation: Option B.**

Reasons:

1. **Separates import and WASM-init responsibilities.** Exactly as
   Stage 945 itself separated "does the file exist" (Stage 921) from
   "is it ready to import" (Stage 937) from "was it imported" (Stage
   945) — each stage owning ONE decision, never bundling two.
2. **Keeps the Fail Closed boundary explicit at each step.** A
   combined API (Option C) would blur WHICH failure belongs to WHICH
   step; Option B keeps `attemptDevOnlyJsGlueImport()`'s own
   `ImportFailed` meaningfully distinct from whatever a future
   `attemptDevOnlyWasmInit()`-style method's own failure reasons would
   be.
3. **Easier to test.** Each method can be exercised (and its own
   Fail-Closed paths verified) independently, exactly as this arc's
   own test suite already does for every prior stage — a combined API
   would force every WASM-init test to also route through a real or
   mocked import.
4. **Does not disturb `planLoad()`'s synchronous contract.** Option B
   adds ONE more small, separate, gated async method, following the
   SAME pattern §2 names — never folding more work into an existing
   method's own signature.
5. **Does not rush toward the Rust API boundary.** Bundling import AND
   init into one call (Option C) would make it easy to accidentally
   bundle a THIRD step (an actual Rust call) into the same API later;
   Option B's separation keeps each future stage narrowly scoped to
   ONE new capability, matching this entire arc's own discipline since
   Stage 841.

## 10. What this Phase does NOT do

- Does **not** call `WebAssembly.instantiate()`/`WebAssembly.compile()`.
- Does **not** construct `new WebAssembly.Module`/`new WebAssembly.Instance`.
- Does **not** call `initSync()`.
- Does **not** call `__wbg_init()` or any async default init.
- Does **not** call any Rust API, including `version()`.
- Does **not** modify `src/runtime/fedos_wasm_loader.ts` in any way —
  no execution logic added, no type added, no method added.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** modify `Cargo.toml` or `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts` or
  `worker_crypto_diagnostics.ts` — no new diagnostics field.
- Does **not** decide §4's module-retention question — only names it.
- Does **not** decide §5's `initSync` vs. `__wbg_init` question — only
  compares the two.

## 11. See also

- `docs/runtime_wasm_loader_dev_only_js_glue_import_execution.md`
  (Stage 945, Prototype EXECUTION Phase 004) — the import capability
  this review inspects and confirms.
- `docs/runtime_wasm_loader_import_readiness_execution.md` (Stage 937,
  Prototype EXECUTION Phase 003) — the readiness gate `attemptDevOnlyJsGlueImport()`
  depends on.
- `docs/runtime_wasm_loader_rust_api_call_plan.md` (Stage 905,
  Prototype Phase 020) — names `version()` as the eventual first real
  Rust API call target, which this review reaffirms.
- `docs/runtime_wasm_js_glue_contract.md` — the observed
  `wasm-bindgen`-generated JS glue shape (`initSync`/default init
  export) this review's §5 comparison is based on.
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth; unchanged by this review (no diagram
  update, since no code changed).
- `src/runtime/fedos_wasm_loader.ts` (Stage 945) — the real
  implementation this review inspects, unchanged.
