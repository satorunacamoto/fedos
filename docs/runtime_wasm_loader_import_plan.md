# FedOS WASM Loader — Import Plan (Prototype Phase 018)

**Status: this document is a DESIGN NOTE for a small, already-landed
addition — `FedosWasmLoaderImportPlan`
(`src/runtime/fedos_wasm_loader.ts`, Stage 889). It changes no
Runtime/Worker wiring and adds no diagnostics field; it records the
FUTURE intent to `import()` the generated JS glue, without performing
any such import.**

## 1. What this Phase adds

One more internal-only step past the Dev-only Gate Plan
(`docs/runtime_wasm_loader_dev_only_gate_plan.md`'s Stage 881
addition), inserted INSIDE `planLoad()`'s existing
`if (!devOnlyGatePlan.shouldEvaluate)` branch:

```txt
Dev-only Gate Plan
  ↓
Import Plan
  ↓
STOP
```

`FedosWasmLoaderImportPlan` is a hand-fixed record:

```ts
interface FedosWasmLoaderImportPlan {
  readonly backend: "Wasm";
  readonly shouldImport: false;
  readonly reason: "BlockedByDevOnlyGatePlan" | "PrototypeDisabled" | "ImportUnavailable";
  readonly currentStage: "ImportPlanning";
  readonly nextRequiredCheck: "WebAssemblyPlanning";
}
```

- **Future import intent** — this Plan NAMES that a real Loader would
  eventually `import()` the generated JS glue (`packages/fedos-core-rust/pkg/`)
  — matching `docs/runtime_wasm_loader_import_policy.md`'s own
  six-condition import policy. This Phase does not perform any
  `import()`; it only records the intent as a fixed constant.
- **`shouldImport: false`** — the DECISION: no `import()` (static or
  dynamic) is called, no generated JS glue is loaded, this Phase only
  names the intent.
- **`reason: "BlockedByDevOnlyGatePlan"`** — WHY not yet: the Dev-only
  Gate Plan one level up already answered `shouldEvaluate: false`;
  this stage's fixed constant never produces the other two permitted
  labels (`"PrototypeDisabled"`/`"ImportUnavailable"`), reserved for a
  future stage that might defer the import for a different reason.
- **`nextRequiredCheck: "WebAssemblyPlanning"`** — WHAT comes next:
  naming the WebAssembly Planning step (the eventual
  `WebAssembly.instantiate`/`compile`/`initSync` call) as the gate
  immediately following this one — NAMED, not performed, by this
  stage.
- **`currentStage: "ImportPlanning"`** — WHERE this Plan sits in the
  eventual multi-stage activation sequence
  (`docs/runtime_wasm_loader_activation_readiness_review.md` §4).

## 2. Why this Phase, and why now

`docs/runtime_wasm_loader_activation_readiness_review.md` (Prototype
Phase 014) named the next real connection candidates, in order: `JS
Glue access plan → generated artifact check → dev-only gate →
import()`. Phases 015–017 landed the first three. Phase 018 lands
ONLY the fourth AS A PLAN — a Plan object naming the future intent to
`import()`, not the import call itself. `WebAssembly` and Rust remain
out of scope, exactly as before.

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
15. Import Plan generated                             -- NEW, Stage 889
16. Import Plan's own result confirmed (shouldImport)  -- ALWAYS false today
17. return BlockedByPolicy -- same fixed answer as every prior stage
```

`planLoad()`'s own return value — `{ operation: "load", state:
"BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key order
included — is byte-for-byte unchanged. The Import Plan is built and
read by `planLoad()` on ITSELF; it is never part of the public
`FedosWasmLoader` interface and never returned to any caller.

## 4. What THIS Phase deliberately does not do

**Naming the intent to import is not importing.** This Phase does not
call `import()` in any form, and does not claim it is unnecessary;
`shouldImport: false` and `nextRequiredCheck: "WebAssemblyPlanning"`
exist precisely to name the step and its successor, without
collapsing either into this stage.

Explicitly deferred to Phase 019 and later, each its own future,
separate, explicitly-reviewed stage:

- **Real `import()` of the generated JS glue** — static or dynamic —
  Phase 019+.
- **Loading the generated JS glue** — reading and executing
  `packages/fedos-core-rust/pkg/fedos_core_rust.js` — Phase 019+ or
  later.
- **WebAssembly Planning** — naming, then performing, a real
  `WebAssembly.instantiate`/`WebAssembly.compile`/`initSync` call —
  several stages further out.
- **Any Rust call** — `packages/fedos-core-rust` remains completely
  unreached from this arc.

## 5. Fail Closed, restated

Prototype-wide, and unchanged by this Phase:

```txt
policy.allowed                            = false
Load Plan.shouldLoad                      = false
JS Glue Access Plan.shouldAccess          = false
Generated Artifact Check Plan.shouldCheck = false
Dev-only Gate Plan.shouldEvaluate         = false
Import Plan.shouldImport                  = false
BlockedByPolicy
STOP
```

Each Plan cites the PARENT step's own denial as its own `reason` —
Dev-only Gate Plan cited the Generated Artifact Check Plan's own
`shouldCheck: false` as `"BlockedByGeneratedArtifactCheckPlan"`;
Import Plan cites the Dev-only Gate Plan's own `shouldEvaluate: false`
as `"BlockedByDevOnlyGatePlan"` — so a reader can trace WHY the import
is deferred without needing to re-derive it from source.
**`shouldImport` is never transitioned to `true` anywhere in this
Prototype** — the type itself pins it to the literal `false`, so no
runtime condition or code path in this file can ever produce a
different value.

## 6. What this Phase does NOT do

- Does **not** call `import()` — static or dynamic — of any kind.
- Does **not** load the generated JS glue.
- Does **not** check whether the generated artifact exists.
- Does **not** touch the filesystem in any way.
- Does **not** implement Development-Runtime or Production-Runtime
  determination of any kind.
- Does **not** read `process.env`, `import.meta`, or `NODE_ENV`.
- Does **not** reference `WebAssembly.instantiate`/
  `WebAssembly.compile`/`initSync`/the default init export.
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

## See also

- `docs/runtime_wasm_loader_dev_only_gate_plan.md` (Stage 881,
  Prototype Phase 017) — the immediately preceding Plan this one
  extends.
- `docs/runtime_wasm_loader_activation_readiness_review.md` (Stage
  857, Prototype Phase 014) — names the `import()` step this Plan
  prepares as the fourth of four ordered next-connection candidates.
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth, gaining a Stage 889 update alongside this
  doc.
- `docs/runtime_wasm_loader_import_policy.md` — the six-condition
  import policy a future real Import step would eventually consult.
- `src/runtime/fedos_wasm_loader.ts` (Stage 889) — the real,
  fixed-value implementation this document describes.
