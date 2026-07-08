# FedOS Runtime Architecture — Simplification Review (Prototype Phase 007)

**Status: this document is a REVIEW ONLY.** It changes no code, no
fixed value, no diagnostics field, and no wiring. It does not delete
any file and does not merge any file. Every classification below is a
recommendation for FUTURE, separate, explicitly-reviewed stages to act
on (or not) — nothing here is actioned by this stage.

This review covers all 42 `src/runtime/fedos_*.ts` files built across
the pure-Planning arc (Stage 1–688) and the Prototype Phase arc (Stage
689–776), and asks, for each: what is its role, what is its current
state, is it actually reachable from `AppRuntime` today, should it stay
real runtime code, would documentation alone suffice, and could it
someday merge with a neighbor.

## 1. Four architectural chains, not one

Tracing every real `import`/constructor call between these 42 files
(not the conceptual "target diagram" arrows in earlier docs, which are
often positional-only) shows FOUR separate, real call graphs — not one
single chain. Only TWO of them are actually reachable, today, from
`createRuntime()`'s default construction path.

### Chain 1 — the Minimum Runtime Chain (REAL, reached from `AppRuntime.initializeCrypto()` today)

```
AppRuntime.initializeCrypto()
  -> fedos_crypto_loader_facade.ts        (Crypto Loader Facade)
  -> fedos_crypto_loader_backend.ts       (Crypto Loader Backend Abstraction)
  -> fedos_crypto_backend_interface.ts    (Crypto Backend Interface)
       -> fedos_crypto_backend_resolver.ts  (Backend Resolver)
       -> fedos_wasm_backend.ts             (WASM Backend Planning)
  -> STOP
```

This is the ONLY chain a real call from `createRuntime().initializeCrypto()`
actually walks today. See `docs/runtime_minimum_runtime_chain.md` for
the full definition. **5 files.**

### Chain 2 — Provider/Facade Boundary + initializeCrypto Public API arc (REAL, reached from the Facade's OTHER reach, terminates without touching Rust/WASM)

```
Crypto Loader Facade
  -> fedos_crypto_provider_facade_boundary.ts
  -> fedos_crypto_provider_initialization_request.ts
  -> fedos_provider_initialization_approval.ts
  -> fedos_provider_init_facade_contract.ts
  -> fedos_initialize_crypto_api_contract.ts
  -> fedos_crypto_initialization_result.ts
  -> fedos_initialize_crypto_exposure_review.ts
  -> fedos_initialize_crypto_wiring_plan.ts
  -> fedos_initialize_crypto_public_api.ts
  -> fedos_initialize_crypto_invocation_contract.ts
  -> STOP
```

The Facade calls this chain via its own, SEPARATE
`reachProviderFacadeBoundary()` (alongside `reachCryptoLoaderBackend()`,
which starts Chain 1). This chain IS real and IS reached from
`AppRuntime.initializeCrypto()` — but it is a purely internal "design
record" arc: ten successive single-question gates, none of which ever
reaches WASM or Rust. This exact arc already received a dedicated
review in Stage 681–688
(`docs/runtime_initialize_crypto_planning_review.md`,
`docs/runtime_initialize_crypto_simplification_plan.md`) — §4 below
reconciles with, rather than re-derives, that prior classification.
**10 files.**

### Chain 3 — WASM Loader Activation arc (REAL internal wiring, but a DISCONNECTED ISLAND — never reached from Chain 1, Chain 2, or Runtime)

```
fedos_wasm_loader.ts (Loader Skeleton, planLoad())
  -> fedos_wasm_loader_plan.ts
  -> fedos_wasm_loader_import_policy.ts
  -> fedos_wasm_static_import_plan.ts
  -> fedos_wasm_static_import_review.ts
  -> fedos_wasm_static_import_readiness.ts
  -> fedos_generated_artifact_presence.ts
  -> fedos_static_import_activation_review.ts
  -> fedos_generated_artifact_distribution.ts
  -> fedos_build_time_loader_strategy.ts
  -> fedos_dynamic_loader_gate.ts
  -> fedos_dynamic_loader_dev_approval.ts
  -> fedos_explicit_crypto_initialization.ts
  -> STOP
```

`fedos_wasm_loader.ts`'s `planLoad()` — the entry point that walks this
entire chain — is called from NOTHING else in `src/runtime/`; only
`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` read its
STANDALONE state accessors (`loaderState()`/`loaderMode()`/
`loaderPolicy()`), never `planLoad()` itself. This chain is real,
independently tested, and internally self-consistent — but structurally
disconnected from both Chain 1 and Chain 2 today. Plus
`fedos_wasm_loader_contract.ts` (Stage 482), a separate "Loader
Contract" object deliberately never wired to the WASM Artifact chain
either, read only by diagnostics. **14 files** (13 in the chain +
`fedos_wasm_loader_contract.ts`).

### Chain 4 — Rust Execution Readiness arc (REAL internal wiring, the ORIGINAL pre-Prototype-Phase architecture, a DISCONNECTED ISLAND reachable only via direct test instantiation)

```
FedosRuntimeCryptoProvider.planExecution()   (fedos_runtime_crypto_provider.ts)
  -> fedos_opaque_api.ts
  -> fedos_rust_boundary.ts
  -> fedos_rust_api.ts
  -> fedos_rust_execution_review.ts
  -> fedos_internal_rust_call.ts
  -> fedos_rust_invocation_adapter.ts
  -> fedos_execution_backend.ts
  -> fedos_wasm_boundary.ts
  -> fedos_wasm_artifact.ts
  -> STOP (link 12, Rust itself, remains disconnected)
```

`FedosRuntimeCryptoProvider` is a REAL, instantiable class with a
public `planExecution()` method that walks this whole chain — but
`AppRuntime.crypto` never actually constructs it by default: `runtime_crypto_bridge.ts`'s
`buildRuntimeCryptoProvider()` resolves the SAFE PLACEHOLDER provider
unconditionally, because `runtimeCryptoEnabled` is permanently `false`
(`runtime_crypto_config.ts`) — the `"fedos"` registry branch is dead
code, unreachable by any `env` value in this repository today. This
chain is exercised only by tests that directly `new
FedosRuntimeCryptoProvider()` and call `.planExecution(...)` — never by
`createRuntime()`'s own default path. Plus three standalone support
files: `fedos_runtime_opaque_request.ts`/`fedos_runtime_operation.ts`
(request/operation builder types feeding the chain) and
`fedos_wasm_toolchain.ts` (Stage 419, explicitly NOT wired into any
reach chain — a standalone toolchain-readiness display model). **13
files** (10 in the chain + 3 standalone support files).

**5 + 10 + 14 + 13 = 42 — every known `fedos_*.ts` file is accounted
for in exactly one of these four chains, with no overlap.**

## 2. Classification legend

| Label | Meaning |
|---|---|
| **A — Core Runtime** | Stays real TypeScript code with its own `createXxx()` function; encodes a load-bearing architectural or safety decision, or is part of the Minimum Runtime Chain. |
| **B — Documentation** | The CONCEPT is worth keeping, but as a doc/type-contract rather than a standalone runtime object; a future stage MAY fold it into prose without losing meaning. |
| **C — Merge Candidate** | Answers a question closely related to a neighboring layer in the SAME chain; a future, separate, explicitly-reviewed stage may reasonably consolidate the two. |
| **D — Historical Review** | The chain this layer belongs to is conceptually superseded by a newer, cleaner chain elsewhere in this repository; its own doc is worth keeping as a historical design record (via README's roadmap + its own `docs/*.md`), not as forward-looking guidance. |

**No file is deleted or merged by this review.** These labels are
recommendations only.

## 3. Full classification — all 42 layers

### Chain 1 — Minimum Runtime Chain (all A)

| # | File | Role | Current fixed value | Reachable from Runtime today? | Class |
|---|---|---|---|---|---|
| 1 | `fedos_crypto_loader_facade.ts` | Thin entry point Runtime calls via `initializeCrypto()` | `{ state: "PlanningOnly", initialized: false, backend: "WasmPlanned", reason: "FacadeInitializationPending" }` | **Yes** | **A** |
| 2 | `fedos_crypto_loader_backend.ts` | Names which backend candidate is designated | `{ state: "PlanningOnly", backendKind: "WasmPlanned", backendReady: false, reason: "BackendAbstractionPending" }` | **Yes** | **A** |
| 3 | `fedos_crypto_backend_interface.ts` | Backend-agnostic contract shape for any candidate | `{ state: "PlanningOnly", backendSelected: "WasmPlanned", backendActivated: false, interfaceReady: false, reason: "BackendInterfacePending" }` | **Yes** | **A** |
| 4 | `fedos_crypto_backend_resolver.ts` | Answers ONLY "which backend is planned" | `{ state: "PlanningOnly", selectedBackend: "WasmPlanned", backendResolved: false, backendAvailable: false, reason: "BackendResolutionPending" }` | **Yes** | **A** |
| 5 | `fedos_wasm_backend.ts` | WASM candidate's own readiness/loader-attachment state | `{ state: "PlanningOnly", backendReady: false, loaderAttached: false, loaderKind: "WasmLoaderPlanned", reason: "WasmBackendPlanningPending" }` | **Yes** | **A** |

### Chain 2 — Provider/Facade Boundary + initializeCrypto Public API arc

| # | File | Role | Reachable today? | Class | Rationale |
|---|---|---|---|---|---|
| 6 | `fedos_crypto_provider_facade_boundary.ts` | The ONE seam between Provider and Facade | Yes | **A** | Load-bearing architecture, not bookkeeping (Stage 682). |
| 7 | `fedos_crypto_provider_initialization_request.ts` | Names a future Provider init request | Yes | **C** | Pairs with #8 — a real flow would likely construct-and-approve in one step. |
| 8 | `fedos_provider_initialization_approval.ts` | Names approval of that request | Yes | **C** | Same pair as #7. |
| 9 | `fedos_provider_init_facade_contract.ts` | Shape-agreement between Provider and Facade | Yes | **B** | Already what a TS interface expresses structurally; runtime object likely unnecessary. |
| 10 | `fedos_initialize_crypto_api_contract.ts` | Internal Facade-level callability | Yes | **C** | Pairs with #11 — one real `initializeCrypto()` would return one shape, not two. |
| 11 | `fedos_crypto_initialization_result.ts` | Completed-invocation result shape | Yes | **C** | Same pair as #10. |
| 12 | `fedos_initialize_crypto_exposure_review.ts` | "Internal machinery" → "Runtime-facing" transition marker | Yes | **C** | May fold into #13's own review step once real. |
| 13 | `fedos_initialize_crypto_wiring_plan.ts` | Runtime/Worker independence guarantee | Yes | **A** | Load-bearing: `workerWiringAllowed` never implied by `runtimeWiringAllowed` (`docs/runtime_worker_activation_boundary.md`). |
| 14 | `fedos_initialize_crypto_public_api.ts` | Public visibility/callability shape | Yes | **C** | Pairs with #15 — same public member from adjacent angles. |
| 15 | `fedos_initialize_crypto_invocation_contract.ts` | Invocation allowed/completed shape | Yes | **C** | Same pair as #14. |

### Chain 3 — WASM Loader Activation arc (disconnected island)

| # | File | Role | Reachable today? | Class | Rationale |
|---|---|---|---|---|---|
| 16 | `fedos_wasm_loader.ts` | Loader Skeleton — the future real WASM Loader entry point | No (island) | **A** | This IS the "(future) WASM Loader" link named in the Minimum Runtime Chain — keep as the eventual real connection point. |
| 17 | `fedos_wasm_loader_contract.ts` | Reports generated-JS-glue loader status | No (island, unwired even within Chain 3) | **B** | Deliberately never wired to the WASM Artifact; redundant with #16's own fields once real. |
| 18 | `fedos_wasm_loader_plan.ts` | Five-phase loader permission ordering | No (island) | **C** | One of many single-phase gates; consolidation candidate. |
| 19 | `fedos_wasm_loader_import_policy.ts` | Six-condition import policy | No (island) | **C** | Same. |
| 20 | `fedos_wasm_static_import_plan.ts` | Names the exact static import target | No (island) | **C** | Same. |
| 21 | `fedos_wasm_static_import_review.ts` | Safety review of writing that import | No (island) | **C** | Same. |
| 22 | `fedos_wasm_static_import_readiness.ts` | Eight-condition readiness checklist | No (island) | **C** | Same. |
| 23 | `fedos_generated_artifact_presence.ts` | "Present" vs "usable" distinction | No (island) | **C** | Same. |
| 24 | `fedos_static_import_activation_review.ts` | Final gate before static import | No (island) | **C** | Same. |
| 25 | `fedos_generated_artifact_distribution.ts` | Standing Option A/B distribution POLICY | No (island) | **B** | A project policy decision — better recorded as docs/policy than as a "reach one link deeper" object. |
| 26 | `fedos_build_time_loader_strategy.ts` | Names three candidate loading strategies | No (island) | **C** | Consolidation candidate with neighbors. |
| 27 | `fedos_dynamic_loader_gate.ts` | Eight minimum conditions for dynamic `import()` | No (island) | **C** | Same. |
| 28 | `fedos_dynamic_loader_dev_approval.ts` | Eight dev-only activation conditions | No (island) | **C** | Same. |
| 29 | `fedos_explicit_crypto_initialization.ts` | "No auto-load, explicit init only" permanent policy | No (island) | **A** | Load-bearing safety policy (Stage 682) — keep as real code despite structural isolation. |

### Chain 4 — Rust Execution Readiness arc (disconnected island, pre-Prototype-Phase architecture)

| # | File | Role | Reachable today? | Class | Rationale |
|---|---|---|---|---|---|
| 30 | `fedos_runtime_crypto_provider.ts` | The concrete `RuntimeCryptoProvider` (`encrypt`/`decrypt`/`planExecution`) | No (never constructed as `AppRuntime.crypto` by default) | **A** | The eventual real target if `runtimeCryptoEnabled` ever flips true — foundational, not bookkeeping. |
| 31 | `fedos_opaque_api.ts` | Opaque request/response boundary | No (island) | **C** | One of nine granular single-question gates in this chain. |
| 32 | `fedos_rust_boundary.ts` | Names the Rust boundary | No (island) | **C** | Same. |
| 33 | `fedos_rust_api.ts` | Names the Rust API surface | No (island) | **C** | Same. |
| 34 | `fedos_rust_execution_review.ts` | Execution approval gate | No (island) | **C** | Same. |
| 35 | `fedos_internal_rust_call.ts` | Plans (never executes) the internal Rust call | No (island) | **C** | Same. |
| 36 | `fedos_rust_invocation_adapter.ts` | Adapts a planned call to Rust's own contract | No (island) | **C** | Same. |
| 37 | `fedos_execution_backend.ts` | Names WASM as the first backend candidate | No (island) | **C** | **Conceptually duplicates Chain 1's `fedos_crypto_loader_backend.ts`/`fedos_crypto_backend_resolver.ts`** — both answer "which backend candidate." Prime future-merge candidate once Chain 1 fully matures. |
| 38 | `fedos_wasm_boundary.ts` | "WASM Backend" (old name), loaded/not-loaded state | No (island) | **C** | **Conceptually duplicates Chain 1's `fedos_wasm_backend.ts`** (same "WASM Backend" naming, same question). Prime future-merge candidate. |
| 39 | `fedos_wasm_artifact.ts` | WASM build/generation pipeline state | No (island) | **B** | Build-pipeline policy already covered by `docs/runtime_wasm_generation.md`/`docs/runtime_wasm_build_contract.md`; docs sufficient. |
| 40 | `fedos_runtime_opaque_request.ts` | Opaque request builder type | No (island, support type) | **C** | Could fold into `fedos_opaque_api.ts` on eventual consolidation. |
| 41 | `fedos_runtime_operation.ts` | Operation status builder type | No (island, support type) | **C** | Could fold into `fedos_runtime_crypto_provider.ts` on eventual consolidation. |
| 42 | `fedos_wasm_toolchain.ts` | WASM toolchain (`wasm32`/`wasm-bindgen`/`wasm-pack`) readiness display | Never wired to anything (standalone by design since Stage 419) | **B** | Purely a display model; docs-only is sufficient. |

**Totals: A = 10, B = 5, C = 27, D = 0** (10 + 5 + 27 = 42, covering
every known file; no `fedos_*.ts` FILE itself is classified D — see §5
for which existing DOCS this review flags as historical instead).

## 4. Reconciliation with the existing Stage 681–688 review (Chain 2)

Chain 2 already received its own dedicated simplification review —
`docs/runtime_initialize_crypto_planning_review.md` (Stage 681) and
`docs/runtime_initialize_crypto_simplification_plan.md` (Stage 682).
This review's Chain 2 classification is a DIRECT reuse of that prior
work's four categories, mapped onto this review's A/B/C/D:

| Stage 682 category | This review's label | Files |
|---|---|---|
| 絶対残す (Must-keep) | A | Provider/Facade Boundary, Crypto Loader Facade *(Chain 1)*, Explicit Crypto Initialization *(Chain 3)*, Runtime initializeCrypto Wiring Plan |
| 将来統合可能 (Future-consolidation) | C | Request+Approval (pair), API Contract+Result Contract (pair), Public API+Invocation Contract (pair) |
| docs上だけ残せばよい (Docs-only) | B | Provider Init Facade Contract |
| 実配線時に不要になる可能性あり (May-become-unnecessary) | C | Runtime initializeCrypto Exposure Review |

No re-derivation, no contradiction — this review CONFIRMS Stage 682's
conclusions still hold and extends the same discipline to Chains 1, 3,
and 4, which had not previously been reviewed together.

## 5. Historical-record candidates (existing DOCS, not code files)

No `fedos_*.ts` file is classified **D** — every file still has an
active role (real, reachable code; a real-but-isolated island; or a
named future connection point). However, this review flags that
Chain 4's OWN docs — `docs/runtime_execution_backend.md`,
`docs/runtime_wasm_boundary.md`, `docs/runtime_wasm_artifact.md`,
`docs/runtime_rust_boundary_decision.md`, and the per-link
`docs/runtime_fedos_*.md`/`docs/runtime_first_rust_*.md` set — describe
an architecture direction (Execution Backend → WASM Boundary → WASM
Artifact) that Chain 1's NEWER, cleaner design (Backend Abstraction →
Backend Interface → Backend Resolver → WASM Backend Planning) has
effectively superseded in practice, even though neither chain has been
touched. **Recommendation for a future stage:** once Chain 1 fully
matures to a real connection, re-classify these specific Chain 4 docs
as **D — Historical Review** (kept as README-linked historical record
of "how we got here," not as forward-looking design guidance). This
review does **not** perform that reclassification now — it only names
the candidate.

## 6. Key findings

1. **Chain 1 (5 files) is the true minimum** — see
   `docs/runtime_minimum_runtime_chain.md`.
2. **Chain 2 (10 files) is real but never touches Rust/WASM** — a pure
   internal design-record arc, already reviewed once, ripe for future
   consolidation (6 of 10 are Merge Candidates).
3. **Chain 3 (14 files) is a fully disconnected island** — internally
   consistent, independently tested, but not reached by Chain 1, Chain
   2, or Runtime today. Only `fedos_wasm_loader.ts` (the future real
   Loader entry point) and `fedos_explicit_crypto_initialization.ts`
   (a load-bearing safety policy) are Core Runtime; the other 12 are
   Merge or Documentation candidates.
4. **Chain 4 (13 files) is the ORIGINAL, pre-Prototype-Phase
   architecture** — also a disconnected island (reachable only via
   direct test instantiation of `FedosRuntimeCryptoProvider`), and
   PARTIALLY CONCEPTUALLY DUPLICATES Chain 1 (`fedos_execution_backend.ts`
   ≈ `fedos_crypto_loader_backend.ts`; `fedos_wasm_boundary.ts` ≈
   `fedos_wasm_backend.ts`).
5. **No contradiction with Fail Closed.** Every one of the 42 files,
   in every chain, still resolves its own permanently-denied fixed
   value; this review does not change, weaken, or question that in any
   file.

## 7. What this review does NOT do

- Does **not** delete any file.
- Does **not** merge any file.
- Does **not** change `create_runtime.ts`, `src/worker.ts`,
  `runtime_crypto_diagnostics.ts`, or `worker_crypto_diagnostics.ts`.
- Does **not** change any fixed value, reason string, or state enum in
  any of the 42 files.
- Does **not** add, remove, or rename any diagnostics field.
- Does **not** implement, connect, or execute anything — no
  `WebAssembly.instantiate`/`compile`, no `import()` of any kind, no
  cryptographic operation, no NIP-17/NIP-44/NIP-59, no Double Ratchet,
  no Triple Ratchet, no onion routing.
- Does **not** add a Cargo or `package.json` dependency, or commit a
  generated artifact.

## See also

- `docs/runtime_minimum_runtime_chain.md` — the canonical Minimum
  Runtime Chain this review's Chain 1 defines in full, plus the
  Architecture Principles.
- `docs/runtime_initialize_crypto_planning_review.md` /
  `docs/runtime_initialize_crypto_simplification_plan.md` — the prior
  Chain 2 review this document reconciles with (§4).
- `docs/fedos_runtime_positioning.md` — the repository-wide scope
  statement (Secure Runtime Platform, desktop-first, Rust owns crypto
  only) this review's classifications are consistent with.
- `docs/fedos_onion_like_routing.md` — a docs-only design review,
  unaffected by and unrelated to this architecture simplification
  review, still fully unimplemented.
- `docs/runtime_internal_execution_contract.md` — the full, real
  call-graph ground truth this review's reachability claims (§1) are
  verified against.
