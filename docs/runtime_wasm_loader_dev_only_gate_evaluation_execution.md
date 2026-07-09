# FedOS WASM Loader — Dev-only Gate Evaluation (Prototype EXECUTION Phase 002)

**Status: this document describes an already-landed, narrowly-scoped
addition — `FedosWasmLoaderSkeleton.#evaluateDevOnlyGate()`
(`src/runtime/fedos_wasm_loader.ts`, Stage 929). It is the SECOND
real execution this Planning Chain arc performs: a live, read-only
evaluation of `process.env.NODE_ENV` (and ONLY that key) to classify
the current runtime. It changes no Runtime/Worker wiring, adds no
diagnostics field, and does not change `planLoad()`'s own external
return value in any way.**

## 1. What this Phase adds

One step past Stage 921's Generated Artifact Check, immediately
following the existing `Dev-only Gate Plan`:

```txt
Dev-only Gate Plan
  ↓
Dev-only Gate Evaluation   <- NEW, REAL (Stage 929)
  ↓
Import Plan
  ↓
BlockedByPolicy
  ↓
STOP
```

`import()` is still NOT executed this Phase. Every one of the seven
Planning-Chain Plans (`Load Plan` through `Rust API Call Plan`) is
UNCHANGED and still runs, in the SAME order — this Phase does not
remove, reorder, or bypass any of them. Only ONE new, real step is
added, immediately after `Dev-only Gate Plan` is confirmed.

## 2. What is evaluated

```ts
interface FedosWasmLoaderDevOnlyGateEvaluation {
  readonly evaluated: true;
  readonly developmentAllowed: boolean;
  readonly reason: "DevelopmentRuntime" | "ProductionRuntime" | "UnknownRuntime" | "PrototypeStillClosed";
}
```

`#evaluateDevOnlyGate()` reads `process.env.NODE_ENV` — the ONLY
environment key this method ever reads — and classifies:

| `NODE_ENV` | `reason` | `developmentAllowed` |
|---|---|---|
| `"development"` | `"DevelopmentRuntime"` | `true` |
| `"production"` | `"ProductionRuntime"` | `false` |
| anything else (including unset) | `"UnknownRuntime"` | `false` |
| the read itself throws/fails | `"PrototypeStillClosed"` | `false` |

`loaderDevOnlyGateEvaluationEnvKey()` (a pure, standalone function)
names the ONE key read (`"NODE_ENV"`) without performing the read
itself.

## 3. What is permitted this Phase

**Development Runtime evaluation only.** Nothing else. The result is
held as internal state on the `FedosWasmLoaderSkeleton` instance
(`#devOnlyGateEvaluation`), recorded by `planLoad()` and readable via
the new `devOnlyGateEvaluation()` method — which NEVER triggers a new
evaluation itself, only reads what `planLoad()` last recorded.

**Fail Closed, even on failure to evaluate.** `#evaluateDevOnlyGate()`
wraps its own `process.env` read in a `try`/`catch`: any inability to
evaluate at all — including `process`/`process.env` being unavailable
— resolves as `"PrototypeStillClosed"`/`developmentAllowed: false`,
never as a thrown exception.

## 4. Development Runtime evaluation is NOT import permission

**This is the single most important invariant of this Phase.** Even
when `#evaluateDevOnlyGate()` classifies the runtime as
`"DevelopmentRuntime"` (`developmentAllowed: true`), EVERY Plan below
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

`developmentAllowed: true` NAMES the evaluation's own finding — it is
NEVER read by any `if` condition in `planLoad()`, and it does NOT flip
`Import Plan.shouldImport`, `WebAssembly Plan.shouldInstantiate`, or
`Rust API Call Plan.shouldCall` anywhere in this file. Evaluating is
**Execution**; the decision to import remains **Planning**, and the
two are completely decoupled. `planLoad()`'s own return value — `{
operation: "load", state: "BlockedByPolicy", policy: "FailClosed",
reason: "..." }`, key order included — is byte-for-byte unchanged,
verified across the Development, Production, and Unknown cases alike.

## 5. Production and Worker

- **Production stays Fail Closed.** Whether the evaluation classifies
  the runtime as `"ProductionRuntime"` or anything else, `planLoad()`
  reaches the identical `BlockedByPolicy` answer — Production never
  gets a different code path.
- **Worker stays unconnected.** `src/worker.ts` continues to never
  reference `#evaluateDevOnlyGate()`, `devOnlyGateEvaluation()`,
  `policy()`, or `planLoad()`, directly or indirectly.

## 6. No new Node dependency

Stage 921 already extended this file's ambient `process` declaration
with `cwd()`; Stage 929 extends that SAME single declaration with an
optional `env` property — no NEW `@ts-expect-error` suppression was
added, and `package.json`/`Cargo.toml` remain untouched. The two
`@ts-expect-error`-suppressed imports (`node:fs`'s `existsSync`,
`node:path`'s `join`) from Stage 921 are unchanged in count.

## 7. What this Phase does NOT do

- Does **not** call `import()` — static or dynamic — of any kind.
- Does **not** call `require()`.
- Does **not** load or execute the Generated JS Glue's own bytes.
- Does **not** call `WebAssembly.instantiate()`/`WebAssembly.compile()`,
  and does not construct `new WebAssembly.Module`/`new WebAssembly.Instance`.
- Does **not** call `initSync()` or reference `__wbg_init`.
- Does **not** call any Rust API, including `version()`.
- Does **not** introduce `#[wasm_bindgen]`.
- Does **not** read any `process.env` key other than `NODE_ENV`.
- Does **not** read `import.meta`.
- Does **not** flip `shouldEvaluate`/`shouldImport`/`shouldInstantiate`/
  `shouldCall` on any Plan, regardless of what the evaluation finds.
- Does **not** connect to Worker or to any Production runtime path.
- Does **not** modify `Cargo.toml` or `package.json`.
- Does **not** change `runtime_crypto_diagnostics.ts` or
  `worker_crypto_diagnostics.ts` — no new diagnostics field.
- Does **not** change `planLoad()`'s own external return value, key
  order, or the public `FedosWasmLoader` contract.

## 8. See also

- `docs/runtime_wasm_loader_generated_artifact_check_execution.md`
  (Stage 921, Prototype EXECUTION Phase 001) — the first real
  execution step this Phase extends.
- `docs/runtime_wasm_loader_execution_readiness_review.md` (Stage 913,
  Prototype Phase 021) — named `Dev-only Gate Evaluation` as the
  second step in its own six-step conversion order (§2).
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth, gaining a Stage 929 update alongside this
  doc.
- `src/runtime/fedos_wasm_loader.ts` (Stage 929) — the real
  implementation this document describes.
