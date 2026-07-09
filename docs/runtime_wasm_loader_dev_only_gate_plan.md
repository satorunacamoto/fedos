# FedOS WASM Loader — Dev-only Gate Plan (Prototype Phase 017)

**Status: this document is a DESIGN NOTE for a small, already-landed
addition — `FedosWasmLoaderDevOnlyGatePlan`
(`src/runtime/fedos_wasm_loader.ts`, Stage 881). It changes no
Runtime/Worker wiring and adds no diagnostics field; it records the
INTENT that a real Loader would only ever evaluate this gate in a
Development Runtime, without performing any such evaluation.**

## 1. What this Phase adds

One more internal-only step past the Generated Artifact Check Plan
(`docs/runtime_wasm_loader_generated_artifact_check_plan.md`'s Stage
873 addition), inserted INSIDE `planLoad()`'s existing
`if (!artifactCheckPlan.shouldCheck)` branch:

```txt
Generated Artifact Check Plan
  ↓
Dev-only Gate Plan
  ↓
STOP
```

`FedosWasmLoaderDevOnlyGatePlan` is a hand-fixed record:

```ts
interface FedosWasmLoaderDevOnlyGatePlan {
  readonly backend: "Wasm";
  readonly shouldEvaluate: false;
  readonly reason: "BlockedByGeneratedArtifactCheckPlan" | "PrototypeDisabled" | "DevelopmentGateUnavailable";
  readonly currentStage: "DevOnlyGatePlanning";
  readonly nextRequiredCheck: "ImportPlanning";
}
```

- **Development-Runtime-only intent** — this Plan NAMES that a real
  Dev-only Gate would only ever evaluate `true` in a Development
  Runtime — never Production, never Worker — matching
  `docs/runtime_dynamic_loader_dev_approval.md`'s own eight dev-only
  conditions. This Phase does not implement that distinction; it only
  records the intent as a fixed constant.
- **`shouldEvaluate: false`** — the DECISION: the gate is not
  evaluated. No `process.env`, `import.meta`, or `NODE_ENV` is ever
  read to compute it — it is a hand-fixed literal, not a live check.
- **`reason: "BlockedByGeneratedArtifactCheckPlan"`** — WHY not yet:
  the Generated Artifact Check Plan one level up already answered
  `shouldCheck: false`; this stage's fixed constant never produces the
  other two permitted labels (`"PrototypeDisabled"`/
  `"DevelopmentGateUnavailable"`), reserved for a future stage that
  might defer evaluation for a different reason.
- **`nextRequiredCheck: "ImportPlanning"`** — WHAT comes next: naming
  the Import Planning step (the eventual `import()` of the generated
  JS glue) as the gate immediately following this one — NAMED, not
  performed, by this stage.
- **`currentStage: "DevOnlyGatePlanning"`** — WHERE this Plan sits in
  the eventual multi-stage activation sequence
  (`docs/runtime_wasm_loader_activation_readiness_review.md` §4).

## 2. Why this Phase, and why now

`docs/runtime_wasm_loader_activation_readiness_review.md` (Prototype
Phase 014) named the next real connection candidates, in order: `JS
Glue access plan → generated artifact check → dev-only gate →
import()`. Phase 015 landed the first, Phase 016 the second. Phase
017 lands ONLY the third — a Plan object naming the Development-only
intent and the next gate, not any real environment evaluation.
`import()`, `WebAssembly`, and Rust remain out of scope, exactly as
before.

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
12. Dev-only Gate Plan generated                      -- NEW, Stage 881
13. Dev-only Gate Plan's own result confirmed (shouldEvaluate) -- ALWAYS false today
14. return BlockedByPolicy -- same fixed answer as every prior stage
```

`planLoad()`'s own return value — `{ operation: "load", state:
"BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key order
included — is byte-for-byte unchanged. The Dev-only Gate Plan is built
and read by `planLoad()` on ITSELF; it is never part of the public
`FedosWasmLoader` interface and never returned to any caller.

## 4. What THIS Phase deliberately does not do

**Naming Development-only intent is not evaluating it.** This Phase
does not determine whether the current Runtime is Development or
Production, and does not claim that distinction is unnecessary;
`shouldEvaluate: false` and `nextRequiredCheck: "ImportPlanning"`
exist precisely to name the step and its successor, without
collapsing either into this stage.

Explicitly deferred to Phase 018 and later, each its own future,
separate, explicitly-reviewed stage:

- **Real Development/Production determination** — reading
  `process.env`/`import.meta`/`NODE_ENV` or any equivalent signal —
  Phase 018+.
- **Real Dev-only Gate evaluation** — consulting
  `fedos_dynamic_loader_gate.ts`/`fedos_dynamic_loader_dev_approval.ts`'s
  own eight conditions for real — Phase 018+ or later.
- **Import Planning** — naming, then performing, a real `import()` of
  the generated JS glue — several stages further out.
- **`WebAssembly.instantiate`/`WebAssembly.compile`/`initSync`/the
  default init export** — further out still.
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
```

Each Plan cites the PARENT step's own denial as its own `reason` —
Generated Artifact Check Plan cited the JS Glue Access Plan's own
`shouldAccess: false` as `"BlockedByJsGlueAccessPlan"`; Dev-only Gate
Plan cites the Generated Artifact Check Plan's own `shouldCheck: false`
as `"BlockedByGeneratedArtifactCheckPlan"` — so a reader can trace WHY
evaluation is deferred without needing to re-derive it from source.
**`shouldEvaluate` is never transitioned to `true` anywhere in this
Prototype** — the type itself pins it to the literal `false`, so no
runtime condition, environment variable, or code path in this file can
ever produce a different value.

## 6. What this Phase does NOT do

- Does **not** implement Development-Runtime determination of any
  kind.
- Does **not** implement Production-Runtime determination of any kind.
- Does **not** read `process.env`, `import.meta`, or `NODE_ENV`.
- Does **not** call `import()` — static or dynamic — of any kind.
- Does **not** reference `WebAssembly.instantiate`/
  `WebAssembly.compile`/`initSync`/the default init export.
- Does **not** load the generated JS glue.
- Does **not** check whether the generated artifact exists.
- Does **not** call any Rust API, and does **not** introduce
  `#[wasm_bindgen]`.
- Does **not** modify `Cargo.toml` or `package.json`.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** implement NIP-17, NIP-44, or NIP-59.
- Does **not** implement Double Ratchet, Triple Ratchet, or onion
  routing.
- Does **not** change `planLoad()`'s own external return value or the
  public `FedosWasmLoader` contract.

## See also

- `docs/runtime_wasm_loader_generated_artifact_check_plan.md` (Stage
  873, Prototype Phase 016) — the immediately preceding Plan this one
  extends.
- `docs/runtime_wasm_loader_activation_readiness_review.md` (Stage
  857, Prototype Phase 014) — names this Plan as the third of four
  ordered next-connection candidates.
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth, gaining a Stage 881 update alongside this
  doc.
- `docs/runtime_dynamic_loader_gate.md` / `docs/runtime_dynamic_loader_dev_approval.md`
  — the eight-condition checklists a future real Dev-only Gate would
  consult.
- `src/runtime/fedos_wasm_loader.ts` (Stage 881) — the real,
  fixed-value implementation this document describes.
