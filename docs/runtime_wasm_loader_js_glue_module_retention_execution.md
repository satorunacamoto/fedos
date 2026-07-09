# FedOS WASM Loader — Imported JS Glue Module Retention (Prototype EXECUTION Phase 006)

**Status: this document describes an already-landed, narrowly-scoped
addition — `FedosWasmLoaderSkeleton.#jsGlueModule`
(`src/runtime/fedos_wasm_loader.ts`, Stage 961). It changes ONE thing
about `attemptDevOnlyJsGlueImport()` (Stage 945): a successful
import's resolved module is now RETAINED instead of discarded. It
changes no Runtime/Worker wiring, adds no diagnostics field, does not
change `planLoad()`'s own body or external return value, and does not
initialize WebAssembly or call any Rust API.**

## 1. What this Phase adds

```txt
Execution Readiness Summary
        ↓
attemptDevOnlyJsGlueImport()
        ↓
import成功
        ↓
module保持   <- NEW, REAL (Stage 961)
        ↓
STOP
```

Before this stage, a successful import's resolved module was
immediately discarded. Stage 961 changes ONLY that one behavior — the
module is now retained on a new private field, readable via a new
public method — implementing Option B, the responsibility-separation
recommendation `docs/runtime_wasm_loader_js_glue_import_result_review.md`
(Stage 913-equivalent review, Prototype EXECUTION Phase 005) made:
retention is the FIRST half of what a future WASM-init stage would
need; this stage does NOT initialize anything with the retained
module.

## 2. What is retained

**The JavaScript module `import()` resolved — nothing else.** Not the
WASM `Instance`, not the WASM `Module`, not `Memory`, not any Rust
API surface. Held as an opaque value on a new private field:

```ts
#jsGlueModule: object | null = null;
```

Read via:

```ts
jsGlueModule(): object | null
```

## 3. Retention is opaque — never inspected, never executed

**The module is held, not examined.** `attemptDevOnlyJsGlueImport()`
and `jsGlueModule()` NEVER:

- Read any property of the retained module.
- Destructure it.
- Call any function on it.
- Inspect its shape, exports, or prototype in any way.

The module is stored and returned EXACTLY as `import()` resolved it —
a pure hand-off, not an analysis.

## 4. Retention rules

| Outcome of `attemptDevOnlyJsGlueImport()` | `jsGlueModule()` |
|---|---|
| `{ succeeded: true, reason: "Imported" }` | The resolved module object, retained. |
| `{ succeeded: false, reason: "NotReady" }` | `null`. |
| `{ succeeded: false, reason: "PrototypeStillClosed" }` | `null`. |
| `{ succeeded: false, reason: "ImportFailed" }` | `null`. |

**Fail Closed applies to retention too.** A PRIOR successful retention
is CLEARED (set to `null`) by a LATER unsuccessful
`attemptDevOnlyJsGlueImport()` call on the SAME instance — a stale
module from an earlier success is never left behind by a later
failure, `NotReady`, or `PrototypeStillClosed` outcome.

## 5. What this Phase does NOT do

- Does **not** call `__wbg_init`.
- Does **not** call any async default init.
- Does **not** call `initSync()`.
- Does **not** call `WebAssembly.instantiate()`/`WebAssembly.compile()`.
- Does **not** construct `new WebAssembly.Module`/`new WebAssembly.Instance`.
- Does **not** call any Rust API, including `version()`.
- Does **not** read or execute any export of the retained module.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** modify `Cargo.toml` or `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts` or
  `worker_crypto_diagnostics.ts` — no new diagnostics field.
- Does **not** change `planLoad()`'s own body, external return value,
  key order, or the public `FedosWasmLoader` contract — `planLoad()`
  is byte-for-byte unchanged by this stage, exactly as it was by
  Stage 945.

## 6. Fail Closed, restated

Every one of the eight fixed `false` values Stages 841–945 already
established remains exactly as fixed, regardless of whether a module
is currently retained:

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
`jsGlueModule()`'s current value.

## 7. See also

- `docs/runtime_wasm_loader_js_glue_import_result_review.md`
  (Prototype EXECUTION Phase 005) — recommended Option B
  (import/WASM-init separation) and explicitly deferred the
  module-retention question this Phase resolves.
- `docs/runtime_wasm_loader_dev_only_js_glue_import_execution.md`
  (Stage 945, Prototype EXECUTION Phase 004) — the import capability
  this Phase extends with retention.
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth; unchanged by this stage's own diagram
  position (no new step reachable from `planLoad()`'s own body).
- `src/runtime/fedos_wasm_loader.ts` (Stage 961) — the real
  implementation this document describes.
