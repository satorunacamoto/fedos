# FedOS WASM Loader — WebAssembly Plan (Prototype Phase 019)

**Status: this document is a DESIGN NOTE for a small, already-landed
addition — `FedosWasmLoaderWebAssemblyPlan`
(`src/runtime/fedos_wasm_loader.ts`, Stage 897). It changes no
Runtime/Worker wiring and adds no diagnostics field; it records the
FUTURE intent to create and use a real WebAssembly instance, without
performing any such instantiation.**

## 1. What this Phase adds

One more internal-only step past the Import Plan
(`docs/runtime_wasm_loader_import_plan.md`'s Stage 889 addition),
inserted INSIDE `planLoad()`'s existing `if (!importPlan.shouldImport)`
branch:

```txt
Import Plan
  ↓
WebAssembly Plan
  ↓
STOP
```

`FedosWasmLoaderWebAssemblyPlan` is a hand-fixed record:

```ts
interface FedosWasmLoaderWebAssemblyPlan {
  readonly backend: "Wasm";
  readonly shouldInstantiate: false;
  readonly reason: "BlockedByImportPlan" | "PrototypeDisabled" | "WebAssemblyUnavailable";
  readonly currentStage: "WebAssemblyPlanning";
  readonly nextRequiredCheck: "RustApiCallPlanning";
}
```

- **Future WebAssembly intent** — this Plan NAMES that a real Loader
  would eventually create and use a real WebAssembly instance
  (`WebAssembly.instantiate`/`WebAssembly.compile`, or their `new
  WebAssembly.Module`/`new WebAssembly.Instance` equivalents). This
  Phase does not call any such API; it only records the intent as a
  fixed constant.
- **`shouldInstantiate: false`** — the DECISION: no WebAssembly API is
  called, no module is compiled, no instance is created, this Phase
  only names the intent.
- **`reason: "BlockedByImportPlan"`** — WHY not yet: the Import Plan
  one level up already answered `shouldImport: false`; this stage's
  fixed constant never produces the other two permitted labels
  (`"PrototypeDisabled"`/`"WebAssemblyUnavailable"`), reserved for a
  future stage that might defer instantiation for a different reason.
- **`nextRequiredCheck: "RustApiCallPlanning"`** — WHAT comes next:
  naming the Rust API Call Planning step (the eventual call into
  `packages/fedos-core-rust`) as the gate immediately following this
  one — NAMED, not performed, by this stage.
- **`currentStage: "WebAssemblyPlanning"`** — WHERE this Plan sits in
  the eventual multi-stage activation sequence
  (`docs/runtime_wasm_loader_activation_readiness_review.md` §4).

## 2. Why this Phase, and why now

`docs/runtime_wasm_loader_activation_readiness_review.md` (Prototype
Phase 014) named the next real connection candidates, in order: `JS
Glue access plan → generated artifact check → dev-only gate →
import()`. Phases 015–018 landed the first four, the last one only as
a Plan naming the future `import()` intent. Phase 019 extends that
same "name, don't perform" discipline ONE step further, past where
that original four-item list ended — WebAssembly instantiation is the
step a real `import()` would eventually need before it could ever
reach Rust. Rust itself remains out of scope, exactly as before.

## 3. `planLoad()`'s extended flow

```txt
1. policy() -- exactly one call
2. policy.allowed evaluated                          -- ALWAYS false today
3. Load Plan generated
4. Load Plan's own result confirmed (shouldLoad)      -- ALWAYS false today
5. [pre-Stage-865: return BlockedByPolicy here]
6. JS Glue Access Plan generated
7. JS Glue Access Plan's own result confirmed (shouldAccess) -- ALWAYS false today
8. [pre-Stage-873: return BlockedByPolicy here]
9. Generated Artifact Check Plan generated
10. Generated Artifact Check Plan's own result confirmed (shouldCheck) -- ALWAYS false today
11. [pre-Stage-881: return BlockedByPolicy here]
12. Dev-only Gate Plan generated
13. Dev-only Gate Plan's own result confirmed (shouldEvaluate) -- ALWAYS false today
14. [pre-Stage-889: return BlockedByPolicy here]
15. Import Plan generated
16. Import Plan's own result confirmed (shouldImport)  -- ALWAYS false today
17. [pre-Stage-897: return BlockedByPolicy here]
18. WebAssembly Plan generated                         -- NEW, Stage 897
19. WebAssembly Plan's own result confirmed (shouldInstantiate) -- ALWAYS false today
20. return BlockedByPolicy -- same fixed answer as every prior stage
```

`planLoad()`'s own return value — `{ operation: "load", state:
"BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key order
included — is byte-for-byte unchanged. The WebAssembly Plan is built
and read by `planLoad()` on ITSELF; it is never part of the public
`FedosWasmLoader` interface and never returned to any caller.

## 4. What THIS Phase deliberately does not do

**Naming the intent to instantiate is not instantiating.** This Phase
does not call `WebAssembly.instantiate()`, `WebAssembly.compile()`,
`new WebAssembly.Module`, or `new WebAssembly.Instance` in any form,
and does not claim any of them is unnecessary; `shouldInstantiate:
false` and `nextRequiredCheck: "RustApiCallPlanning"` exist precisely
to name the step and its successor, without collapsing either into
this stage.

Explicitly deferred to Phase 020 and later, each its own future,
separate, explicitly-reviewed stage:

- **Real `WebAssembly.instantiate()`/`WebAssembly.compile()`** — or
  their `new WebAssembly.Module`/`new WebAssembly.Instance`
  equivalents — Phase 020+.
- **`initSync`/the generated JS glue's default init export** — Phase
  020+ or later.
- **Rust API Call Planning** — naming, then performing, a real call
  into `packages/fedos-core-rust` — several stages further out.
- **Any actual Rust execution** — `packages/fedos-core-rust` remains
  completely unreached from this arc.

## 5. Fail Closed, restated

Prototype-wide, and unchanged by this Phase:

```txt
policy.allowed                            = false
Load Plan.shouldLoad                      = false
JS Glue Access Plan.shouldAccess          = false
Generated Artifact Check Plan.shouldCheck = false
Dev-only Gate Plan.shouldEvaluate         = false
Import Plan.shouldImport                  = false
WebAssembly Plan.shouldInstantiate        = false
BlockedByPolicy
STOP
```

Each Plan cites the PARENT step's own denial as its own `reason` —
Import Plan cited the Dev-only Gate Plan's own `shouldEvaluate: false`
as `"BlockedByDevOnlyGatePlan"`; WebAssembly Plan cites the Import
Plan's own `shouldImport: false` as `"BlockedByImportPlan"` — so a
reader can trace WHY instantiation is deferred without needing to
re-derive it from source. **`shouldInstantiate` is never transitioned
to `true` anywhere in this Prototype** — the type itself pins it to
the literal `false`, so no runtime condition or code path in this
file can ever produce a different value.

## 6. What this Phase does NOT do

- Does **not** call `WebAssembly.instantiate()`.
- Does **not** call `WebAssembly.compile()`.
- Does **not** construct `new WebAssembly.Module`.
- Does **not** construct `new WebAssembly.Instance`.
- Does **not** call `import()` — static or dynamic — of any kind.
- Does **not** load the generated JS glue.
- Does **not** check whether the generated artifact exists.
- Does **not** touch the filesystem in any way.
- Does **not** implement Development-Runtime or Production-Runtime
  determination of any kind.
- Does **not** read `process.env`, `import.meta`, or `NODE_ENV`.
- Does **not** call `initSync`.
- Does **not** call any Rust API, and does **not** introduce
  `#[wasm_bindgen]`.
- Does **not** modify `Cargo.toml` or `package.json`.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** implement NIP-17, NIP-44, or NIP-59.
- Does **not** implement Double Ratchet, Triple Ratchet, or onion
  routing.
- Does **not** change `planLoad()`'s own external return value, key
  order, or the public `FedosWasmLoader` contract.
- Does **not** change `runtime_crypto_diagnostics.ts` or
  `worker_crypto_diagnostics.ts` — no new diagnostics field.

## Note on the `"WebAssemblyPlanning"` naming literal

`FedosWasmLoaderImportPlan.nextRequiredCheck` (Stage 889) and
`FedosWasmLoaderWebAssemblyPlan.currentStage` (this stage) both
legitimately contain the substring `"WebAssembly"` as PROSE naming a
future gate — this is intentional and permitted. Guard tests in this
arc check for real API usage (`WebAssembly.`, `new WebAssembly.Module`,
`new WebAssembly.Instance`) rather than the bare word, exactly as
`docs/runtime_wasm_loader_import_plan.md`'s own Stage 889 precedent
already established for `"WebAssemblyPlanning"` itself.

## See also

- `docs/runtime_wasm_loader_import_plan.md` (Stage 889, Prototype
  Phase 018) — the immediately preceding Plan this one extends.
- `docs/runtime_wasm_loader_activation_readiness_review.md` (Stage
  857, Prototype Phase 014) — the original four-item next-connection
  list this Phase's WebAssembly step extends one link past.
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth, gaining a Stage 897 update alongside this
  doc.
- `docs/runtime_wasm_js_glue_contract.md` — the direct observation of
  what the real, locally-generated `wasm-bindgen` JS glue actually
  exports, a future real WebAssembly step would eventually consult.
- `src/runtime/fedos_wasm_loader.ts` (Stage 897) — the real,
  fixed-value implementation this document describes.
