# FedOS WASM Loader — Generated Artifact Check Plan (Prototype Phase 016)

**Status: this document is a DESIGN NOTE for a small, already-landed
addition — `FedosWasmLoaderGeneratedArtifactCheckPlan`
(`src/runtime/fedos_wasm_loader.ts`, Stage 873). It changes no
Runtime/Worker wiring and adds no diagnostics field; it records WHAT
would need to be confirmed, WHY it is not confirmed yet, and WHAT
comes after it.**

## 1. What this Phase adds

One more internal-only step past the JS Glue Access Plan
(`docs/runtime_wasm_loader_js_glue_access_plan.md`'s Stage 865
addition), inserted INSIDE `planLoad()`'s existing
`if (!jsGlueAccessPlan.shouldAccess)` branch:

```txt
JS Glue Access Plan
  ↓
Generated Artifact Check Plan
  ↓
STOP
```

`FedosWasmLoaderGeneratedArtifactCheckPlan` is a hand-fixed record:

```ts
interface FedosWasmLoaderGeneratedArtifactCheckPlan {
  readonly backend: "Wasm";
  readonly shouldCheck: false;
  readonly reason: "BlockedByJsGlueAccessPlan" | "PrototypeDisabled" | "FilesystemAccessUnavailable";
  readonly currentStage: "GeneratedArtifactCheckPlanning";
  readonly nextRequiredCheck: "DevOnlyGate";
}
```

- **WHAT to confirm** — WHETHER the generated `.wasm`/JS glue pair
  actually exists on disk at `packages/fedos-core-rust/pkg/`, per
  `fedos_generated_artifact_presence.ts`'s own present-vs-usable
  distinction (`docs/runtime_generated_artifact_presence_policy.md`).
- **`shouldCheck: false`** — the DECISION: the filesystem is not
  touched, the check is not performed, this Phase only names it.
- **`reason: "BlockedByJsGlueAccessPlan"`** — WHY not yet: the JS Glue
  Access Plan one level up already answered `shouldAccess: false`;
  this stage's fixed constant never produces the other two permitted
  labels (`"PrototypeDisabled"`/`"FilesystemAccessUnavailable"`),
  reserved for a future stage that might defer the check for a
  different reason.
- **`nextRequiredCheck: "DevOnlyGate"`** — WHAT comes next: the
  eight-condition dev-only activation checklist
  (`fedos_dynamic_loader_gate.ts`/`fedos_dynamic_loader_dev_approval.ts`,
  `docs/runtime_dynamic_loader_gate.md`/
  `docs/runtime_dynamic_loader_dev_approval.md`) — NAMED, not
  performed, by this stage.
- **`currentStage: "GeneratedArtifactCheckPlanning"`** — WHERE this
  Plan sits in the eventual multi-stage activation sequence
  (`docs/runtime_wasm_loader_activation_readiness_review.md` §4).

## 2. Why this Phase, and why now

`docs/runtime_wasm_loader_activation_readiness_review.md` (Prototype
Phase 014) named the next real connection candidates, in order: `JS
Glue access plan → generated artifact check → dev-only gate →
import()`. Phase 015 landed the first (the JS Glue Access Plan).
Phase 016 lands ONLY the second — a Plan object naming WHAT would need
checking and WHAT comes after, not the check itself. `import()`,
`WebAssembly`, and Rust remain out of scope, exactly as before.

## 3. `planLoad()`'s extended flow

```txt
1. policy() -- exactly one call
2. policy.allowed evaluated                        -- ALWAYS false today
3. Load Plan generated
4. Load Plan's own result confirmed (shouldLoad)    -- ALWAYS false today
5. [pre-Stage-865: return BlockedByPolicy here]
6. JS Glue Access Plan generated
7. JS Glue Access Plan's own result confirmed (shouldAccess) -- ALWAYS false today
8. [pre-Stage-873: return BlockedByPolicy here]
9. Generated Artifact Check Plan generated          -- NEW, Stage 873
10. Generated Artifact Check Plan's own result confirmed (shouldCheck) -- ALWAYS false today
11. return BlockedByPolicy -- same fixed answer as every prior stage
```

`planLoad()`'s own return value — `{ operation: "load", state:
"BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key order
included — is byte-for-byte unchanged. The Generated Artifact Check
Plan is built and read by `planLoad()` on ITSELF; it is never part of
the public `FedosWasmLoader` interface and never returned to any
caller.

## 4. What THIS Phase deliberately does not do

**The Generated Artifact Check is not performed, not denied — only
named.** This Phase does not implement it, and does not claim it is
unnecessary; `nextRequiredCheck: "DevOnlyGate"` exists precisely to
name the step AFTER it, without collapsing the check itself into this
stage.

Explicitly deferred to Phase 017 and later, each its own future,
separate, explicitly-reviewed stage:

- **Actually confirming the generated artifact's presence** —
  touching the filesystem (`existsSync`/`readFileSync` or equivalent)
  to check `packages/fedos-core-rust/pkg/` — Phase 017+.
- **Dev-only Gate evaluation** — consulting
  `fedos_dynamic_loader_gate.ts`/`fedos_dynamic_loader_dev_approval.ts`'s
  own conditions for real — Phase 017+ or later.
- **`import()`** — static or dynamic, of the generated JS glue —
  several stages further out.
- **`WebAssembly.instantiate`/`WebAssembly.compile`/`initSync`/the
  default init export** — further out still.
- **Any Rust call** — `packages/fedos-core-rust` remains completely
  unreached from this arc.

## 5. Fail Closed, restated

Prototype-wide, and unchanged by this Phase:

```txt
policy.allowed                       = false
Load Plan.shouldLoad                 = false
JS Glue Access Plan.shouldAccess     = false
Generated Artifact Check Plan.shouldCheck = false
```

Each Plan cites the PARENT step's own denial as its own `reason` — JS
Glue Access Plan cited the Load Plan's `shouldLoad: false` as
`"BlockedByLoadPlan"`; Generated Artifact Check Plan cites the JS Glue
Access Plan's own `shouldAccess: false` as
`"BlockedByJsGlueAccessPlan"` — so a reader can trace WHY the check is
deferred without needing to re-derive it from source.

## 6. What this Phase does NOT do

- Does **not** call `import()` — static or dynamic — of any kind.
- Does **not** reference `WebAssembly.instantiate`/
  `WebAssembly.compile`/`initSync`/the default init export.
- Does **not** check whether the generated artifact exists.
- Does **not** touch the filesystem in any way (no `existsSync`/
  `readFileSync`/`fs.*` call of any kind).
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

- `docs/runtime_wasm_loader_js_glue_access_plan.md` (Stage 865,
  Prototype Phase 015) — the immediately preceding Plan this one
  extends.
- `docs/runtime_wasm_loader_activation_readiness_review.md` (Stage
  857, Prototype Phase 014) — names this Plan as the second of four
  ordered next-connection candidates.
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth, gaining a Stage 873 update alongside this
  doc.
- `docs/runtime_generated_artifact_presence_policy.md` — the
  present-vs-usable distinction this Plan's `shouldCheck` step would
  eventually consult.
- `docs/runtime_dynamic_loader_gate.md` / `docs/runtime_dynamic_loader_dev_approval.md`
  — the eight-condition checklists `nextRequiredCheck: "DevOnlyGate"`
  points at.
- `src/runtime/fedos_wasm_loader.ts` (Stage 873) — the real,
  fixed-value implementation this document describes.
