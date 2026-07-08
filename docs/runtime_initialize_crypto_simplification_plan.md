# FedOS initializeCrypto Simplification Plan — Stage 682

**Status: this document is ANALYSIS ONLY — it classifies the twelve
layers named in `docs/runtime_initialize_crypto_planning_review.md`
(Stage 681) into four categories. It deletes, removes, or modifies
NO code, and authorizes no such action either. Code deletion remains
explicitly OUT OF SCOPE for this stage and for any stage that has not
separately, explicitly reviewed and approved a specific removal.**

## The four categories

| Category | Meaning |
|---|---|
| **絶対残す (Must keep)** | Encodes a standing architectural or safety decision; collapsing it would hide a real distinction or remove a load-bearing guarantee. |
| **将来統合可能 (Future consolidation candidate)** | Answers a question closely related to a neighboring layer; once real implementation exists, the two may reasonably become one object/type. |
| **docs上だけ残せばよい (Docs-only candidate)** | The CONCEPT is worth keeping, but as a TypeScript type/interface contract or a documentation section rather than a separate runtime object with its own `createXxx()` function. |
| **実配線時に不要になる可能性あり (May become unnecessary at real-wiring time)** | Exists today to mark a conceptual transition point; a real implementation might fold its question into an adjacent layer's own real logic, making the standalone file redundant. |

**No layer is placed in an immediate-removal category.** This plan's
job is to name likely FUTURE outcomes, not to act on them.

## Classification

| # | Layer | Category | Why |
|---|---|---|---|
| 1 | Provider Initialization Request | 将来統合可能 | Tightly coupled to layer 2 (Approval) — a real Provider implementation would likely construct-and-approve in one step. |
| 2 | Provider Initialization Approval | 将来統合可能 | Same pairing as layer 1 — kept conceptually distinct today (`docs/runtime_provider_initialization_approval.md` §1), but likely to merge with layer 1 once a real request/approval flow exists. |
| 3 | Provider Init Facade Contract | docs上だけ残せばよい | The shape-agreement concept is exactly what a TypeScript interface between Provider and Facade already expresses structurally once real code exists — a runtime `createXxx()` object may be unnecessary duplication of what the type system already guarantees. |
| 4 | Provider / Facade Boundary | 絶対残す | The ONE seam `docs/runtime_crypto_loader_facade.md` names as the sole door between Provider and Facade — this is architecture, not bookkeeping. |
| 5 | Crypto Loader Facade | 絶対残す | Core Facade-pattern decision; backend-swappability depends on this exact seam existing. |
| 6 | Explicit Crypto Initialization | 絶対残す | Encodes the permanent "no auto-load, no implicit load" safety policy — a standing project decision, never a placeholder. |
| 7 | InitializeCrypto API Contract | 将来統合可能 | Tightly coupled to layer 8 (Result Contract) — a real `initializeCrypto()` implementation would likely return `{ callable, initialized, success, backend }` as ONE shape, not two separately-tracked objects. |
| 8 | Crypto Initialization Result Contract | 将来統合可能 | Same pairing as layer 7. |
| 9 | Runtime initializeCrypto Exposure Review | 実配線時に不要になる可能性あり | Marks the "internal machinery" -> "Runtime-facing" transition conceptually; once `docs/runtime_initialize_crypto_wiring_plan.md`'s own Runtime/Worker permission logic is real, this Review's `exposed`/`approved` pair may fold into that Plan's own review step rather than remaining a separate file. |
| 10 | Runtime initializeCrypto Wiring Plan | 絶対残す | The Runtime/Worker independence guarantee (`workerWiringAllowed` never implied by `runtimeWiringAllowed`) is load-bearing for `docs/runtime_worker_activation_boundary.md` — must stay explicit and separately named. |
| 11 | Runtime initializeCrypto Public API | 将来統合可能 | Tightly coupled to layer 12 (Invocation Contract) — "is it visible/callable" and "is invocation allowed/has it completed" both describe the SAME public member from adjacent angles; a real `AppRuntime.initializeCrypto` implementation would likely track both in one place. |
| 12 | Runtime initializeCrypto Invocation Contract | 将来統合可能 | Same pairing as layer 11. |

## Summary by category

- **絶対残す (4)**: Provider/Facade Boundary, Crypto Loader Facade, Explicit Crypto Initialization, Runtime initializeCrypto Wiring Plan.
- **将来統合可能 (6)**: Provider Initialization Request + Approval (pair), InitializeCrypto API Contract + Crypto Initialization Result Contract (pair), Runtime initializeCrypto Public API + Invocation Contract (pair).
- **docs上だけ残せばよい (1)**: Provider Init Facade Contract.
- **実配線時に不要になる可能性あり (1)**: Runtime initializeCrypto Exposure Review.

## What this stage does NOT do

- Does **not** delete, merge, or modify any of the twelve files.
- Does **not** schedule a future stage to perform any consolidation —
  each classification is descriptive, not a commitment.
- Does **not** add a thirteenth `PlanningOnly` layer.
- Does **not** add or change any diagnostics field.
- Does **not** write `import()` of any kind, anywhere.
- Does **not** connect Runtime or Worker to any of this.
- Does **not** modify `create_runtime.ts` or `src/worker.ts`.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_initialize_crypto_planning_review.md` (Stage 681) —
  the full inventory this plan classifies.
- `docs/runtime_initialize_crypto_first_wiring_plan.md` (Stage 683) —
  what the FIRST real connection would need to look like, independent
  of whether any consolidation named above ever happens.
