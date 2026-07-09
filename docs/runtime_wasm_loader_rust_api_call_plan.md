# FedOS WASM Loader — Rust API Call Plan (Prototype Phase 020)

**Status: this document is a DESIGN NOTE for a small, already-landed
addition — `FedosWasmLoaderRustApiCallPlan`
(`src/runtime/fedos_wasm_loader.ts`, Stage 905). It changes no
Runtime/Worker wiring and adds no diagnostics field; it records the
FUTURE intent to call a real Rust public function, without performing
any such call. This is also the LAST link in the Planning Chain this
whole `runtime_wasm_loader.ts` arc has been building since Phase 013.**

## 1. What this Phase adds

One more internal-only step past the WebAssembly Plan
(`docs/runtime_wasm_loader_webassembly_plan.md`'s Stage 897 addition),
inserted INSIDE `planLoad()`'s existing
`if (!webAssemblyPlan.shouldInstantiate)` branch:

```txt
WebAssembly Plan
  ↓
Rust API Call Plan
  ↓
STOP
```

`FedosWasmLoaderRustApiCallPlan` is a hand-fixed record:

```ts
interface FedosWasmLoaderRustApiCallPlan {
  readonly backend: "Wasm";
  readonly shouldCall: false;
  readonly reason: "BlockedByWebAssemblyPlan" | "PrototypeDisabled" | "RustApiUnavailable";
  readonly currentStage: "RustApiCallPlanning";
  readonly nextRequiredCheck: "PrototypeExecutionReadiness";
}
```

- **Future Rust API intent** — this Plan NAMES that a real Loader would
  eventually call a real Rust public function (one of the 27 `pub fn`
  in `packages/fedos-core-rust/src/lib.rs`, e.g. `version()`). This
  Phase does not call any such function; it only records the intent as
  a fixed constant.
- **`shouldCall: false`** — the DECISION: no Rust API is called, no
  `#[wasm_bindgen]` is introduced, this Phase only names the intent.
- **`reason: "BlockedByWebAssemblyPlan"`** — WHY not yet: the
  WebAssembly Plan one level up already answered `shouldInstantiate:
  false`; this stage's fixed constant never produces the other two
  permitted labels (`"PrototypeDisabled"`/`"RustApiUnavailable"`),
  reserved for a future stage that might defer the call for a
  different reason.
- **`nextRequiredCheck: "PrototypeExecutionReadiness"`** — WHAT comes
  next: naming a REVIEW of the now-COMPLETE Planning Chain, not an
  eighth internal Plan. See §7 below.
- **`currentStage: "RustApiCallPlanning"`** — WHERE this Plan sits in
  the eventual multi-stage activation sequence
  (`docs/runtime_wasm_loader_activation_readiness_review.md` §4).

## 2. Why this Phase, and why now

`docs/runtime_wasm_loader_activation_readiness_review.md` (Prototype
Phase 014) named four next-connection candidates ending at `import()`.
Phases 015–019 extended that chain, one named-but-unperformed step at
a time, all the way to WebAssembly instantiation. Phase 020 lands the
final step: naming the intent to call Rust, without calling it. With
this stage, every layer between `planLoad()` and the real Rust crate
now has a named Plan — the chain is complete, and what remains is
REVIEWING it, not extending it further.

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
18. WebAssembly Plan generated
19. WebAssembly Plan's own result confirmed (shouldInstantiate) -- ALWAYS false today
20. [pre-Stage-905: return BlockedByPolicy here]
21. Rust API Call Plan generated                       -- NEW, Stage 905
22. Rust API Call Plan's own result confirmed (shouldCall) -- ALWAYS false today
23. return BlockedByPolicy -- same fixed answer as every prior stage
```

`planLoad()`'s own return value — `{ operation: "load", state:
"BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key order
included — is byte-for-byte unchanged. The Rust API Call Plan is built
and read by `planLoad()` on ITSELF; it is never part of the public
`FedosWasmLoader` interface and never returned to any caller.

## 4. What THIS Phase deliberately does not do

**Naming the intent to call Rust is not calling it.** This Phase does
not call any Rust public function in any form, and does not claim it
is unnecessary; `shouldCall: false` and `nextRequiredCheck:
"PrototypeExecutionReadiness"` exist precisely to name the step and
its successor, without collapsing either into this stage.

Explicitly deferred to Phase 021 and later, each its own future,
separate, explicitly-reviewed stage:

- **Any real Rust API call** — including `version()` or any of the
  other 26 `pub fn` in `packages/fedos-core-rust/src/lib.rs` — Phase
  021+.
- **`#[wasm_bindgen]`** — introducing WASM bindings to any Rust
  function — Phase 021+ or later.
- **`__wbg_init`/`initSync`** — the generated JS glue's own init
  entry points — Phase 021+ or later.
- **Prototype Execution Readiness review** — a REVIEW of the complete
  Planning Chain (§7), not an implementation stage by itself.

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
Rust API Call Plan.shouldCall             = false
BlockedByPolicy
STOP
```

Each Plan cites the PARENT step's own denial as its own `reason` —
WebAssembly Plan cited the Import Plan's own `shouldImport: false` as
`"BlockedByImportPlan"`; Rust API Call Plan cites the WebAssembly
Plan's own `shouldInstantiate: false` as
`"BlockedByWebAssemblyPlan"` — so a reader can trace WHY the call is
deferred without needing to re-derive it from source.
**`shouldCall` is never transitioned to `true` anywhere in this
Prototype** — the type itself pins it to the literal `false`, so no
runtime condition or code path in this file can ever produce a
different value.

## 6. What this Phase does NOT do

- Does **not** call any Rust API of any kind.
- Does **not** call `version()` or any other Rust public function.
- Does **not** introduce `#[wasm_bindgen]`.
- Does **not** reference `__wbg_init`.
- Does **not** call `initSync()`.
- Does **not** call `import()` — static or dynamic — of any kind.
- Does **not** load the generated JS glue.
- Does **not** check whether the generated artifact exists.
- Does **not** touch the filesystem in any way.
- Does **not** reference `WebAssembly.instantiate()`,
  `WebAssembly.compile()`, `WebAssembly.Module`, or
  `WebAssembly.Instance`.
- Does **not** implement Development-Runtime or Production-Runtime
  determination of any kind.
- Does **not** read `process.env`, `import.meta`, or `NODE_ENV`.
- Does **not** modify `Cargo.toml` or `package.json`.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** change `planLoad()`'s own external return value, key
  order, or the public `FedosWasmLoader` contract.
- Does **not** change `runtime_crypto_diagnostics.ts` or
  `worker_crypto_diagnostics.ts` — no new diagnostics field.

## 7. Planning Chain: complete

The internal Planning Chain `runtime_wasm_loader.ts`'s `planLoad()`
now walks, in full, is:

```txt
policy()
  ↓
Policy Evaluation
  ↓
Load Plan
  ↓
JS Glue Access Plan
  ↓
Generated Artifact Check Plan
  ↓
Dev-only Gate Plan
  ↓
Import Plan
  ↓
WebAssembly Plan
  ↓
Rust API Call Plan
  ↓
BlockedByPolicy
  ↓
STOP
```

Eight independent, hand-fixed Plan objects (`FedosWasmLoaderLoadPlan`
through `FedosWasmLoaderRustApiCallPlan`), each confirmed by its own
independent `if` check, each citing its own parent's denial as its
`reason`, and each falling through to the SAME `#blocked("load")`
answer `planLoad()` has produced since Stage 489. **No further Plan is
added by this stage or named for the next one.**
`nextRequiredCheck: "PrototypeExecutionReadiness"` deliberately does
NOT name a ninth Plan — it names a REVIEW: a future, separate stage
that looks back across all eight Plans as a whole and decides what
"Execution Readiness" would require before any of them could ever be
allowed to answer `true`. That review is Phase 021's own
responsibility, not this stage's.

## See also

- `docs/runtime_wasm_loader_webassembly_plan.md` (Stage 897, Prototype
  Phase 019) — the immediately preceding Plan this one extends.
- `docs/runtime_wasm_loader_activation_readiness_review.md` (Stage
  857, Prototype Phase 014) — the original readiness review this
  eight-Plan chain fully answers.
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth, gaining a Stage 905 update alongside this
  doc.
- `packages/fedos-core-rust/src/lib.rs` — the 27 `pub fn` a future,
  real Rust API call would eventually choose from.
- `src/runtime/fedos_wasm_loader.ts` (Stage 905) — the real,
  fixed-value implementation this document describes.
