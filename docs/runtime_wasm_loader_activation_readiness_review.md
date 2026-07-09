# FedOS WASM Loader Activation Readiness Review (Prototype Phase 014)

**Status: this document is a REVIEW ONLY — it adds no code, no new
`PlanningOnly` layer, no diagnostics field, and no `import()` of any
kind. It does not load anything, real or otherwise. It inventories
the CURRENT real reach chain (Stage 489–841, Prototype Phases 008–013)
now that `FedosWasmLoader.planLoad()` reaches `policy()` and an
internal Load Plan, and names the minimum conditions a future,
separate, explicitly-reviewed stage would need before attempting a
real WASM/Generated-JS-Glue connection. This review does not
authorize that connection — it only prepares the ground for reviewing
it later.**

## 1. Current real reach chain

Every arrow below is a real function call, verified by
`docs/runtime_internal_execution_contract.md`'s own Stage 793/825/833/
841 diagrams and by this repository's own test suite:

```
AppRuntime.initializeCrypto()
        │
        ▼
Crypto Loader Facade                  (fedos_crypto_loader_facade.ts, Stage 594/721)
        │
        ▼
Crypto Loader Backend                 (fedos_crypto_loader_backend.ts, Stage 714/753 — "Backend Abstraction")
        │
        ▼
Crypto Backend Interface              (fedos_crypto_backend_interface.ts, Stage 746/764)
        │
        ▼
Crypto Backend Resolver               (fedos_crypto_backend_resolver.ts, Stage 763 — second leaf of the Interface)
        │
        ▼
WASM Backend                          (fedos_wasm_backend.ts, Stage 730/793 — "WASM Backend Planning")
        │
        ▼
FedosWasmLoader.planLoad()            (fedos_wasm_loader.ts, Stage 489–492, reached for real Stage 793)
        │
        ├──▶ FedosWasmLoaderPlan.planImport()  (fedos_wasm_loader_plan.ts, Stage 503 — result discarded)
        │
        ▼
policy()                              (fedos_wasm_loader.ts, Stage 817 — reached Stage 825, EVALUATED Stage 833)
        │
        ▼
Load Plan                             (FedosWasmLoaderLoadPlan, Stage 841 — internal-only, confirmed then discarded)
        │
        ▼
BlockedByPolicy
        │
        ▼
STOP
```

`FedosWasmLoaderDecision`'s own return value — `{ operation: "load",
state: "BlockedByPolicy", policy: "FailClosed", reason: "..." }`, key
order included — is unaffected by every link past `WASM Backend`: the
Load Plan and the Policy Evaluation are both read-and-discard steps
`planLoad()` performs on ITSELF, never returned to any caller.

## 2. Layers to keep at real-implementation time

These NINE layers are the ones a future real WASM/JS-Glue connection
would still need, unchanged in role even once real bytes flow through
them:

| # | Layer | File | Why it stays |
|---|---|---|---|
| 1 | Runtime `initializeCrypto()` | `src/runtime/create_runtime.ts` | The one public entry point; no auto-load, no implicit load. |
| 2 | Crypto Loader Facade | `fedos_crypto_loader_facade.ts` | The single door Runtime/Provider ever see; backend detail never leaks above it. |
| 3 | Crypto Loader Backend | `fedos_crypto_loader_backend.ts` | Names WHICH backend candidate (`"WasmPlanned"`) is designated, without hard-coding it. |
| 4 | Crypto Backend Interface | `fedos_crypto_backend_interface.ts` | Backend-agnostic contract shape any candidate (WASM/Native/Python) can satisfy. |
| 5 | Crypto Backend Resolver | `fedos_crypto_backend_resolver.ts` | Answers ONLY "which backend is planned" — kept separate from readiness. |
| 6 | WASM Backend | `fedos_wasm_backend.ts` | The WASM candidate's own readiness/loader-attachment state. |
| 7 | `FedosWasmLoader` | `fedos_wasm_loader.ts` | The eventual real Loader entry point — `status()`/`planLoad()`/`planInitialize()`/`planUnload()`/`planningState()`/`policy()` all stay meaningful once real. |
| 8 | `policy()` | `fedos_wasm_loader.ts` (Stage 817) | The single Fail-Closed gate every planned operation is evaluated against — becomes the REAL allow/deny switch once a real policy source exists. |
| 9 | Load Plan | `fedos_wasm_loader.ts` (Stage 841, `FedosWasmLoaderLoadPlan`) | Names WHAT would be loaded (`backend: "Wasm"`) before any load is attempted — the natural place to attach a real artifact path once one exists. |

No layer above this list is proposed for removal by this review — see
§3 for candidates BELOW it.

## 3. Consolidation candidates

**No file is deleted, merged, or modified by this review.** These are
recommendations for FUTURE, separate, explicitly-reviewed stages.

### 3.1 旧 Planning review 系 (prior Planning-review families)

Two whole arcs, already reviewed once each, remain valid and
unchanged by this stage:

- **Chain 2 — Provider/Facade Boundary + initializeCrypto Public API
  arc** (10 files; `docs/runtime_initialize_crypto_planning_review.md`,
  Stage 681, and `docs/runtime_initialize_crypto_simplification_plan.md`,
  Stage 682). Real, reached from the Facade's own second reach, but
  never touches WASM/Rust. 6 of its 10 files are already flagged
  Merge Candidates in that prior review — no new action here.
- **Chain 4 — Rust Execution Readiness arc** (13 files;
  `docs/runtime_architecture_simplification_review.md` §1, Chain 4).
  Still reachable only via direct test instantiation of
  `FedosRuntimeCryptoProvider`, never via `createRuntime()`'s default
  path. Not required for the chain in §1 above to reach
  `BlockedByPolicy`.

### 3.2 Docs-only化できるもの (docs-only candidates)

Already flagged **B — Documentation** by
`docs/runtime_architecture_simplification_review.md` §3, unaffected by
Stage 793–841's real Loader connection:

- `fedos_wasm_loader_contract.ts` (Stage 482) — its `status()`-only
  shape is redundant with `FedosWasmLoader.status()`'s own fields once
  real; a prose contract may suffice.
- `fedos_wasm_toolchain.ts` (Stage 419) — a standalone
  toolchain-readiness display, never wired into any reach chain by
  design.
- `fedos_wasm_artifact.ts` (Stage 393) / `fedos_generated_artifact_distribution.ts`
  (Stage 554) — build-pipeline POLICY already covered by
  `docs/runtime_wasm_generation.md`/`docs/runtime_wasm_build_contract.md`;
  docs alone are sufficient.

### 3.3 Runtime 実装に不要な孤島チェーン (islands not required for the Runtime implementation)

The eleven `fedos_wasm_*`/`fedos_static_import_*`/`fedos_dynamic_loader_*`
files BELOW `fedos_wasm_loader_plan.ts` in the original WASM Loader
Activation arc (`fedos_wasm_loader_import_policy.ts` through
`fedos_explicit_crypto_initialization.ts`, per
`docs/runtime_architecture_simplification_review.md` §1 "Chain 3") are
NOT required for the chain in §1 above to reach `BlockedByPolicy` —
`planLoad()` only reaches as far as `FedosWasmLoaderPlan.planImport()`
(the SECOND link) and its own `policy()`/Load Plan, discarding both.
These eleven remain real, independently tested, internally
self-consistent — but structurally unreached from the Minimum Runtime
Chain even after Stage 841, and out of scope for the next connection
candidates named in §4.

### 3.4 Finding: a prior classification is now partially stale

`docs/runtime_architecture_simplification_review.md` §1 (Stage
777–792, PRECEDING the Stage 793 real Loader connection) still labels
`fedos_wasm_loader.ts` and, by extension, its own Chain 3 as a "fully
DISCONNECTED ISLAND — never reached from Chain 1, Chain 2, or
Runtime." That is no longer accurate for `fedos_wasm_loader.ts`
itself (reached for real since Stage 793) or for
`fedos_wasm_loader_plan.ts` (reached for real since Stage 503,
discarding its result, and now reachable transitively from Runtime
since Stage 793). Similarly, `docs/runtime_minimum_runtime_chain.md`
§1 still marks `(future) WASM Loader` — also stale as of Stage 793.
**This review does not edit either document** (out of scope for a
review-only stage); it names the discrepancy as a candidate for a
future, separate doc-correction stage, the same "found and named, not
fixed" discipline `docs/runtime_internal_execution_contract.md`'s own
Stage 793 update used for its Stage 593–597 historical correction.

## 4. Next real connection candidates

None of the following is implemented, connected, or scheduled by this
review — each is its own future, separate, explicitly-reviewed stage,
in this order:

```
FedosWasmLoader.planLoad()
        │
        ▼
JS Glue access plan            <-- names HOW planLoad() would eventually read
                                    fedos_wasm_loader_contract.ts's own status
                                    contract for the generated JS glue -- NOT
                                    implemented this stage or the next
        │
        ▼
generated artifact check       <-- names HOW planLoad() would eventually consult
                                    fedos_generated_artifact_presence.ts's
                                    present-vs-usable distinction -- NOT
                                    implemented this stage or the next
        │
        ▼
dev-only gate                  <-- names HOW planLoad() would eventually consult
                                    fedos_dynamic_loader_gate.ts /
                                    fedos_dynamic_loader_dev_approval.ts's eight
                                    conditions each -- NOT implemented this
                                    stage or the next
        │
        ▼
import()                       <-- STILL several Stages further out; not the
                                    immediate next Stage even after the three
                                    steps above land
```

Each step above is a SEPARATE future review-and-implement pair (a
readiness doc, then a wiring stage, mirroring how Stage 809/817/825/
833/841 each landed as one narrow addition) — this review does not
collapse them into a single future stage, and does not commit this
repository to any specific ordering beyond the one shown.

## 5. Fail Closed conditions

These conditions apply to EVERY future stage that touches this chain,
not only the next one, and none of them is weakened, negotiated, or
made conditional by this review:

1. **`policy.allowed === false` → never load.** No future stage may
   attempt a real load while `policy()`'s own `allowed` field is
   `false` — the SAME check `planLoad()` already performs today
   (Stage 833), just with a real answer eventually replacing the
   fixed one.
2. **Generated artifact unconfirmed → never load.** No future stage
   may attempt a real load without first confirming
   `fedos_generated_artifact_presence.ts`'s own present-AND-usable
   answer for the exact target `fedos_wasm_loader_plan.ts`'s existing
   Loader Plan already names.
3. **Never load from Worker.** `src/worker.ts` remains explicitly OUT
   OF SCOPE for any real load, exactly as
   `docs/runtime_initialize_crypto_wiring_plan.md`'s
   Runtime/Worker-independence guarantee already requires — a real
   `runtimeWiringAllowed: true` must never imply
   `workerWiringAllowed: true`.
4. **Never load in Production.** Any future dynamic-loader activation
   remains dev-only, per `fedos_dynamic_loader_dev_approval.ts`'s own
   eight conditions — no Production code path may ever reach a real
   `import()` of the generated JS glue.
5. **Import failure → Fail Closed, not Fail Open.** If a future real
   `import()` of the generated JS glue ever throws, times out, or
   returns an unexpected shape, the ONLY acceptable outcome is the
   SAME `BlockedByPolicy`-style denial this repository already
   produces today — never a silent fallback to "proceed anyway."

## 6. Explicit prohibitions for THIS stage

This review changes nothing; the following remain exactly as
prohibited after this stage as before it:

- **No `import()`** — static or dynamic — of the generated JS glue or
  any other module, anywhere in this repository.
- **No `WebAssembly`** — `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`, or any other reference.
- **No `initSync`** and no default-init export call.
- **No Rust call** of any kind — `packages/fedos-core-rust` remains
  completely unreached from this arc.
- **No NIP-17, no NIP-44, no NIP-59** implementation of any kind.
- **No Double Ratchet, no Triple Ratchet, no onion routing**
  implementation of any kind.
- **No cryptographic operation** — `encrypt`/`decrypt` remain
  `"Unsupported"` everywhere they already were.
- **No dependency added** to `Cargo.toml` or `package.json`.
- **No generated artifact committed** to this repository.

## 7. What this review does NOT do

- Does **not** add a new `PlanningOnly` layer or `fedos_*.ts` file.
- Does **not** change `src/runtime/fedos_wasm_loader.ts`, any other
  `src/runtime/*.ts` file, `create_runtime.ts`, or `src/worker.ts`.
- Does **not** add, remove, or rename any diagnostics field in
  `runtime_crypto_diagnostics.ts` or `worker_crypto_diagnostics.ts`.
- Does **not** delete or merge any existing file.
- Does **not** implement, connect, or execute anything — see §6.
- Does **not** authorize the next connection candidates named in §4 —
  each remains its own future, separate, explicitly-reviewed stage.

## See also

- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth §1's chain is verified against (Stage 793/
  825/833/841 updates).
- `docs/runtime_architecture_simplification_review.md` — the prior,
  now partially-stale (§3.4) four-chain classification this review
  builds on.
- `docs/runtime_minimum_runtime_chain.md` — the canonical Minimum
  Runtime Chain definition, whose `(future) WASM Loader` label §3.4
  flags as another stale-but-unedited spot.
- `docs/runtime_initialize_crypto_planning_review.md` /
  `docs/runtime_initialize_crypto_simplification_plan.md` — the prior
  Chain 2 review §3.1 reconciles with.
- `docs/runtime_wasm_loader.md` (Stage 493) — the Loader Skeleton's
  own policy document, still accurate: `NotLoaded`/`PlanningOnly`/
  `FailClosed`.
- `docs/runtime_dynamic_loader_dev_approval.md` / `docs/runtime_dynamic_loader_gate.md`
  — the eight-condition checklists §4/§5 name as future gate
  candidates.
- `docs/runtime_generated_artifact_presence_policy.md` — the
  present-vs-usable distinction §4/§5 name as a future check
  candidate.
