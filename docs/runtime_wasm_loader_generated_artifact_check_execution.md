# FedOS WASM Loader — Generated Artifact Check (Prototype EXECUTION Phase 001)

**Status: this document describes an already-landed, narrowly-scoped
addition — `FedosWasmLoaderSkeleton.#checkGeneratedArtifacts()`
(`src/runtime/fedos_wasm_loader.ts`, Stage 921). It is the FIRST time
this Planning Chain arc performs REAL execution: a live, read-only
existence check of the two Generated Artifact files. It changes no
Runtime/Worker wiring, adds no diagnostics field, and does not change
`planLoad()`'s own external return value in any way.**

## 1. Planning ends, Execution begins

`docs/runtime_wasm_loader_execution_readiness_review.md` (Stage 913,
Prototype Phase 021) confirmed the eight-stage Planning Chain —
`policy()`/Policy Evaluation plus the seven Plan objects `Load Plan`
through `Rust API Call Plan` — was COMPLETE, and named **Generated
Artifact Check** as the recommended first candidate for real
implementation, for five reasons (§3 of that review): safely checkable
before `import()`, no WebAssembly execution, no Rust call, a
precondition for Dev-only Gate, and Fail Closed expressible without a
real load.

This Phase — **Prototype EXECUTION Phase 001** — implements EXACTLY
that one candidate:

```txt
Generated Artifact Check Plan
        ↓
Generated Artifact Check   <- NEW, REAL (Stage 921)
        ↓
BlockedByPolicy
        ↓
STOP
```

**Planning ends here; Execution begins here.** Every one of the seven
Planning-Chain Plans (`Load Plan` through `Rust API Call Plan`) is
UNCHANGED and still runs, in the SAME order, inside `planLoad()` —
this Phase does not remove, reorder, or bypass any of them. Only ONE
new, real step is added, immediately after `Generated Artifact Check
Plan` is confirmed.

## 2. What is checked

The two Generated Artifact files named by
`docs/runtime_wasm_js_glue_contract.md`'s own observed
`packages/fedos-core-rust/pkg/` shape:

```txt
fedos_core_rust.js        (Generated JS Glue)
fedos_core_rust_bg.wasm   (Generated WASM)
```

`FedosWasmLoaderGeneratedArtifactName` is a fixed, closed union of
exactly these two filenames — no other filename is ever checked, and
`loaderGeneratedArtifactCheckTargets()` (a pure, standalone function)
names them without performing the check itself.

## 3. What is permitted this Phase

**Existence confirmation only.** `#checkGeneratedArtifacts()` calls a
single, read-only `existsSync` (`node:fs`) per target file, under
`process.cwd()`, and returns:

```ts
interface FedosWasmLoaderGeneratedArtifactCheckResult {
  readonly checkedArtifacts: readonly FedosWasmLoaderGeneratedArtifactName[];
  readonly missingArtifacts: readonly FedosWasmLoaderGeneratedArtifactName[];
  readonly artifactsExist: boolean;
}
```

Unlike every Plan type in this arc, this result is NOT a hand-fixed
constant — `missingArtifacts`/`artifactsExist` genuinely reflect the
filesystem's own state at the moment the check ran. The result is held
as internal state on the `FedosWasmLoaderSkeleton` instance
(`#generatedArtifactCheckResult`), recorded by `planLoad()` and
readable via the new `generatedArtifactCheckResult()` method — which
NEVER triggers a new check itself, only reads what `planLoad()` last
recorded.

**Fail Closed, even on failure to check.** `#artifactFileExists()`
wraps its own `existsSync` call in a `try`/`catch`: any inability to
check at all — including `existsSync`/`process` being unavailable —
resolves as "not present," never as a thrown exception.

## 4. Fail Closed, restated

**The check's result NEVER changes any Plan's own fixed `false`
field.** Whether the artifacts are found or missing, EVERY value below
stays exactly as fixed as it has been since its own stage:

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

Concretely:

```txt
Generated Artifact exists (simulated in tests; false on this repo today)
        ↓
recorded (generatedArtifactCheckResult())
        ↓
BlockedByPolicy
        ↓
STOP
```

The existence check is **Execution** — a real, live computation. The
decision to `import()` remains **Planning** — `Import Plan.shouldImport`
is still permanently pinned to the literal `false`, completely
decoupled from what this check finds. `planLoad()`'s own return value
— `{ operation: "load", state: "BlockedByPolicy", policy: "FailClosed",
reason: "..." }`, key order included — is byte-for-byte unchanged,
verified in both the "missing" and "simulated present" cases.

## 5. What this Phase does NOT do

- Does **not** call `import()` — static or dynamic — of any kind.
- Does **not** call `require()`.
- Does **not** load or execute the Generated JS Glue's own bytes.
- Does **not** call `WebAssembly.instantiate()`/`WebAssembly.compile()`,
  and does not construct `new WebAssembly.Module`/`new WebAssembly.Instance`.
- Does **not** call `initSync()` or reference `__wbg_init`.
- Does **not** call any Rust API, including `version()`.
- Does **not** introduce `#[wasm_bindgen]`.
- Does **not** read the artifact files' own bytes — no `readFileSync`/
  `statSync`, only a boolean existence check.
- Does **not** flip `shouldCheck`/`shouldEvaluate`/`shouldImport`/
  `shouldInstantiate`/`shouldCall` on any Plan, regardless of what the
  check finds.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** modify `Cargo.toml` or `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts` or
  `worker_crypto_diagnostics.ts` — no new diagnostics field.
- Does **not** change `planLoad()`'s own external return value, key
  order, or the public `FedosWasmLoader` contract.

## 6. まとめ（日本語）

- **Planning終了**: `docs/runtime_wasm_loader_execution_readiness_review.md`
  (Stage 913) をもって、8段のPlanning Chainは完成として扱う。
- **Execution開始**: 本Phase (Prototype EXECUTION Phase 001) より、
  Planning ChainをREAL EXECUTIONへ段階的に置き換えていく。
- **Generated Artifact Checkのみ実装**: 今回実装したのはGenerated
  Artifact（`fedos_core_rust.js`/`fedos_core_rust_bg.wasm`）の存在確認
  (`existsSync`) のみ。
- **importはまだ禁止**: `import()`（static/dynamic）は一切呼び出さない。
  `Import Plan.shouldImport` は `false` のまま。
- **WebAssemblyはまだ禁止**: `WebAssembly.instantiate()`/`compile()`/
  `new WebAssembly.Module`/`Instance`/`initSync()`/`__wbg_init` は一切
  呼び出さない。
- **Rustはまだ禁止**: Rust公開API（`version()` 含む）は一切呼び出さない。
  `#[wasm_bindgen]` も導入しない。
- **Fail Closed維持**: Generated Artifactが存在しても
  `shouldImport = false` のまま。存在確認結果は記録されるだけで、
  `planLoad()` は常に `BlockedByPolicy` を返す。

## 7. See also

- `docs/runtime_wasm_loader_execution_readiness_review.md` (Stage 913,
  Prototype Phase 021) — named this exact check as the recommended
  first Execution candidate, with its own future-conditions list (§4)
  this Phase satisfies.
- `docs/runtime_wasm_loader_rust_api_call_plan.md` (Stage 905,
  Prototype Phase 020) — records the Planning Chain's own completion,
  which this Phase leaves fully intact.
- `docs/runtime_wasm_js_glue_contract.md` — the observed
  `packages/fedos-core-rust/pkg/` shape naming the two checked
  filenames.
- `docs/runtime_generated_artifact_presence_policy.md` — the
  present-vs-usable distinction: this Phase confirms PRESENCE only,
  never USAGE permission.
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth, gaining a Stage 921 update alongside this
  doc.
- `src/runtime/fedos_wasm_loader.ts` (Stage 921) — the real
  implementation this document describes.
