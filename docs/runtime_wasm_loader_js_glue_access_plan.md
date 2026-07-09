# FedOS WASM Loader — JS Glue Access Plan (Prototype Phase 015)

**Status: this document is a DESIGN NOTE for a small, already-landed
addition — `FedosWasmLoaderJsGlueAccessPlan`
(`src/runtime/fedos_wasm_loader.ts`, Stage 865). It changes no
Runtime/Worker wiring and adds no diagnostics field; it records WHY
the new internal Plan exists and WHAT it deliberately still does not
do.**

## 1. What this Phase adds

One more internal-only step past the Load Plan
(`docs/runtime_internal_execution_contract.md`'s Stage 841 update),
inserted INSIDE `planLoad()`'s existing `if (!loadPlan.shouldLoad)`
branch:

```txt
Load Plan
  ↓
JS Glue Access Plan
  ↓
STOP
```

`FedosWasmLoaderJsGlueAccessPlan` is a hand-fixed record:

```ts
interface FedosWasmLoaderJsGlueAccessPlan {
  readonly backend: "Wasm";
  readonly shouldAccess: false;
  readonly reason: "BlockedByLoadPlan" | "PrototypeDisabled" | "GeneratedArtifactUnchecked";
  readonly currentStage: "JsGlueAccessPlanning";
  readonly nextRequiredCheck: "GeneratedArtifactCheck";
}
```

- **`shouldAccess: false`** — the DECISION: access to the generated JS
  glue is not attempted.
- **`reason: "BlockedByLoadPlan"`** — WHY: the Load Plan one level up
  already answered `shouldLoad: false`; this stage's fixed constant
  never produces the other two permitted labels
  (`"PrototypeDisabled"`/`"GeneratedArtifactUnchecked"`), reserved for
  a future stage that might deny access for a different reason.
- **`nextRequiredCheck: "GeneratedArtifactCheck"`** — WHAT to confirm
  next: whether the generated `.wasm`/JS glue pair actually exists on
  disk (`fedos_generated_artifact_presence.ts`'s own present-vs-usable
  distinction) — NAMED, not performed, by this stage.
- **`currentStage: "JsGlueAccessPlanning"`** — WHERE this Plan sits in
  the eventual multi-stage activation sequence
  (`docs/runtime_wasm_loader_activation_readiness_review.md` §4).

## 2. Why this Phase, and why now

`docs/runtime_wasm_loader_activation_readiness_review.md` (Prototype
Phase 014) named the next real connection candidates, in order: `JS
Glue access plan → generated artifact check → dev-only gate →
import()`. Phase 015 lands ONLY the first of those four — a Plan
object naming the intent and the next check, not the check itself.
The remaining three stay explicitly out of scope, per that review's
own "each remains its own future, separate, explicitly-reviewed
stage" rule.

## 3. `planLoad()`'s extended flow

```txt
1. policy() -- exactly one call
2. policy.allowed evaluated       -- ALWAYS false today
3. Load Plan generated
4. Load Plan's own result confirmed (shouldLoad)  -- ALWAYS false today
5. [pre-Stage-865: return BlockedByPolicy here]
6. JS Glue Access Plan generated                  -- NEW, Stage 865
7. JS Glue Access Plan's own result confirmed (shouldAccess) -- ALWAYS false today
8. return BlockedByPolicy -- same fixed answer as every prior stage
```

`planLoad()`'s own return value — `{ operation: "load", state:
"BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key order
included — is byte-for-byte unchanged. The JS Glue Access Plan is
built and read by `planLoad()` on ITSELF; it is never part of the
public `FedosWasmLoader` interface and never returned to any caller.

## 4. What THIS Phase deliberately does not do

**Generated Artifact Check is not performed, not denied — only
named.** This review does not implement it, and does not claim it is
unnecessary; `nextRequiredCheck: "GeneratedArtifactCheck"` exists
precisely to name it as a REQUIRED future step, not to skip it.

Explicitly deferred to Phase 016 and later, each its own future,
separate, explicitly-reviewed stage:

- **Generated Artifact Check** — confirming the generated `.wasm`/JS
  glue pair actually exists (Phase 016+).
- **Generated JS Glue presence/shape confirmation** — Phase 016+ or
  later.
- **`import()`** — static or dynamic, of the generated JS glue —
  several stages further out.
- **`WebAssembly.instantiate`/`WebAssembly.compile`/`initSync`/the
  default init export** — further out still.
- **Any Rust call** — `packages/fedos-core-rust` remains completely
  unreached from this arc.

## 5. Fail Closed, restated

Prototype-wide, and unchanged by this Phase:

```txt
policy.allowed              = false
Load Plan.shouldLoad        = false
JS Glue Access Plan.shouldAccess = false
```

Each Plan cites the PARENT step's own denial as its own `reason` —
Load Plan cites `policy()`'s `"BlockedByPolicy"`-equivalent answer;
JS Glue Access Plan cites the Load Plan's own `shouldLoad: false` as
`"BlockedByLoadPlan"` — so a reader can trace WHY access is denied
without needing to re-derive it from source.

## 6. What this Phase does NOT do

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

- `docs/runtime_wasm_loader_activation_readiness_review.md` (Stage
  857, Prototype Phase 014) — names this Plan as the first of four
  ordered next-connection candidates.
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth, gaining a Stage 865 update alongside this
  doc.
- `docs/runtime_generated_artifact_presence_policy.md` — the
  present-vs-usable distinction `nextRequiredCheck` points at.
- `src/runtime/fedos_wasm_loader.ts` (Stage 865) — the real,
  fixed-value implementation this document describes.
