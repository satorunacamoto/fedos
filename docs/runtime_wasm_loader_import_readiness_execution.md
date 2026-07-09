# FedOS WASM Loader — Import Readiness & Execution Readiness (Prototype EXECUTION Phase 003)

**Status: this document describes an already-landed, narrowly-scoped
addition — `FedosWasmLoaderSkeleton.#evaluateImportReadiness()`
(`src/runtime/fedos_wasm_loader.ts`, Stage 937). It is the THIRD real
execution this Planning Chain arc performs — though, unlike Stage
921/929, it reads NO new live external state of its own: it is a PURE
combination of the two prior real results. It changes no
Runtime/Worker wiring, adds no diagnostics field, and does not change
`planLoad()`'s own external return value in any way.**

## 1. What this Phase adds

One step past Stage 929's Dev-only Gate Evaluation, immediately
following the existing `Import Plan`:

```txt
Import Plan
  ↓
Import Readiness Evaluation   <- NEW, REAL (Stage 937)
  ↓
BlockedByPolicy
  ↓
STOP
```

`import()` is still NOT executed this Phase. Every one of the seven
Planning-Chain Plans, plus the two prior real steps (Generated
Artifact Check, Dev-only Gate Evaluation), are UNCHANGED and still run
in the SAME order — this Phase does not remove, reorder, or bypass any
of them. Only ONE new, real step is added, immediately after `Import
Plan` is confirmed.

## 2. Import Readiness Evaluation

```ts
interface FedosWasmLoaderImportReadiness {
  readonly evaluated: true;
  readonly ready: boolean;
  readonly reason: "ReadyForImport" | "MissingArtifacts" | "NotDevelopmentRuntime" | "PrototypeStillClosed";
}
```

`#evaluateImportReadiness()` takes exactly two inputs — both already
recorded earlier in the SAME `planLoad()` call, reading no new
filesystem or environment state of its own:

1. **Generated Artifact Check result** (Stage 921) —
   `this.#generatedArtifactCheckResult.artifactsExist`.
2. **Dev-only Gate Evaluation result** (Stage 929) —
   `this.#devOnlyGateEvaluation.developmentAllowed`.

| `artifactsExist` | `developmentAllowed` | `reason` | `ready` |
|---|---|---|---|
| `false` | (either) | `"MissingArtifacts"` | `false` |
| `true` | `false` | `"NotDevelopmentRuntime"` | `false` |
| `true` | `true` | `"ReadyForImport"` | `true` |
| either input somehow missing (`null`) | | `"PrototypeStillClosed"` | `false` |

The `"PrototypeStillClosed"` branch is a defensive Fail Closed
fallback — `planLoad()`'s own fixed call order guarantees both inputs
are always populated before this evaluation runs, so this branch never
actually executes today; it exists only to keep the method total
(never throw) if that invariant were ever violated.

## 3. What is permitted this Phase

**Readiness evaluation only.** The result is held as internal state on
the `FedosWasmLoaderSkeleton` instance (`#importReadiness`), recorded
by `planLoad()` and readable via the new `importReadiness()` method —
which NEVER triggers a new evaluation itself, only reads what
`planLoad()` last recorded.

## 4. Import Readiness is not import permission

**This is the single most important invariant of this Phase**, exactly
mirroring Stage 929's own "evaluating is not granting" principle. Even
when `#evaluateImportReadiness()` finds `ready: true` (BOTH the
artifact and the runtime condition satisfied), EVERY Plan below stays
exactly as fixed as it has been since its own stage:

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

`ready: true` NAMES that the two conditions this Prototype knows how
to evaluate are satisfied — it is NEVER read by any `if` condition in
`planLoad()`, and it does NOT flip `Import Plan.shouldImport`,
`WebAssembly Plan.shouldInstantiate`, or `Rust API Call Plan.shouldCall`
anywhere in this file. `planLoad()`'s own return value — `{ operation:
"load", state: "BlockedByPolicy", policy: "FailClosed", reason: "..." }`,
key order included — is byte-for-byte unchanged, verified across every
combination of artifact presence and runtime classification.

## 5. Execution Readiness Summary

```ts
interface FedosWasmLoaderExecutionReadinessSummary {
  readonly artifactsOk: boolean;
  readonly runtimeOk: boolean;
  readonly importReady: boolean;
  readonly importExecuted: false;
  readonly webAssemblyExecuted: false;
  readonly rustExecuted: false;
}
```

`executionReadinessSummary()` (a new PUBLIC method) combines the three
real results this instance has recorded so far into one readable
snapshot — `artifactsOk`/`runtimeOk`/`importReady` read directly from
`#generatedArtifactCheckResult`/`#devOnlyGateEvaluation`/
`#importReadiness`, while `importExecuted`/`webAssemblyExecuted`/
`rustExecuted` are permanently fixed `false`, naming that this
Prototype has never performed any of the three. The method performs no
check of its own — purely reading already-recorded state — and returns
`null` if `planLoad()` has never been called on the instance.

## 6. See also

- `docs/runtime_wasm_loader_dev_only_gate_evaluation_execution.md`
  (Stage 929, Prototype EXECUTION Phase 002) — the second real
  execution step this Phase extends.
- `docs/runtime_wasm_loader_generated_artifact_check_execution.md`
  (Stage 921, Prototype EXECUTION Phase 001) — the first real
  execution step, and one of this Phase's two inputs.
- `docs/runtime_wasm_loader_execution_readiness_review.md` (Stage 913,
  Prototype Phase 021) — named `Import Readiness` as the third step in
  its own six-step conversion order (§2).
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth, gaining a Stage 937 update alongside this
  doc.
- `src/runtime/fedos_wasm_loader.ts` (Stage 937) — the real
  implementation this document describes.

## 7. What this Phase does NOT do

- Does **not** call `import()` — static or dynamic — of any kind.
- Does **not** call `require()`.
- Does **not** load or execute the Generated JS Glue's own bytes.
- Does **not** call `WebAssembly.instantiate()`/`WebAssembly.compile()`,
  and does not construct `new WebAssembly.Module`/`new WebAssembly.Instance`.
- Does **not** call `initSync()` or reference `__wbg_init`.
- Does **not** call any Rust API, including `version()`.
- Does **not** introduce `#[wasm_bindgen]`.
- Does **not** read any new filesystem or environment state — it is
  purely a combination of the two already-recorded prior results.
- Does **not** flip `shouldEvaluate`/`shouldImport`/`shouldInstantiate`/
  `shouldCall` on any Plan, regardless of `ready`'s value.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** modify `Cargo.toml` or `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts` or
  `worker_crypto_diagnostics.ts` — no new diagnostics field.
- Does **not** change `planLoad()`'s own external return value, key
  order, or the public `FedosWasmLoader` contract.
