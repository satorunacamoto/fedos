# FedOS initializeCrypto Planning Review — Stage 681

**Status: this document is a REVIEW ONLY — it adds no code, no new
`PlanningOnly` layer, no diagnostics field, and no `import()` of any
kind. It inventories the TWELVE existing layers built across Stage
585–680, in the same order as the full target-architecture diagram
(`docs/runtime_internal_execution_contract.md`, Stage 665–677
update). This is a design-review checkpoint before any real
connection is ever attempted — it does not authorize one.**

## Why this review, and why now

Twelve separate `PlanningOnly` layers now sit between "a Provider
exists" and "`initializeCrypto()` could ever be invoked from
Runtime." Each was added for a specific, documented reason, but the
chain has grown long enough that a stocktake is warranted BEFORE any
stage attempts a real connection — not to delete anything (that
remains explicitly out of scope, see
`docs/runtime_initialize_crypto_simplification_plan.md`, Stage 682),
but to make the CURRENT state legible in one place.

## The twelve layers

### 1. Provider Initialization Request

- **File**: `src/runtime/fedos_crypto_provider_initialization_request.ts` (Stage 610)
- **Role**: Provider-side planning for a request a future Provider implementation would hand to the Boundary — has one ever been issued (`requested`), would the Boundary currently accept one (`allowed`).
- **Current fixed value**: `{ state: "PlanningOnly", requested: false, allowed: false, reason: "ProviderInitializationRequestPending" }`
- **Reason to keep**: Names the STRUCTURAL question ("could a request exist") separately from the REVIEW question layer 2 answers.
- **Consolidation candidate?**: Yes — see simplification plan; closely related to layer 2.

### 2. Provider Initialization Approval

- **File**: `src/runtime/fedos_provider_initialization_approval.ts` (Stage 618)
- **Role**: Whether a SPECIFIC, already-issued request has actually been reviewed and approved — distinct from the Boundary's own structural acceptance.
- **Current fixed value**: `{ state: "PlanningOnly", approved: false, reason: "ProviderInitializationApprovalPending" }`
- **Reason to keep**: Separates "could a request exist" from "has THIS request been approved" — a real review step, not just a structural gate.
- **Consolidation candidate?**: Yes — see simplification plan; closely related to layer 1.

### 3. Provider Init Facade Contract

- **File**: `src/runtime/fedos_provider_init_facade_contract.ts` (Stage 626)
- **Role**: Whether the Provider side and the Facade side agree on a shared call/return SHAPE for `initializeCrypto()` — distinct from approval.
- **Current fixed value**: `{ state: "PlanningOnly", contractReady: false, reason: "ProviderInitFacadeContractPending" }`
- **Reason to keep**: A shape-agreement question is genuinely different from an approval decision — approval could hold while shapes still disagree.
- **Consolidation candidate?**: Partial — see simplification plan; the CONCEPT should stay, but as a TypeScript type contract rather than a separate runtime object once real code exists.

### 4. Provider / Facade Boundary

- **File**: `src/runtime/fedos_crypto_provider_facade_boundary.ts` (Stage 602)
- **Role**: Whether ANY Provider implementation and the Facade have ever actually been connected to one another (`providerConnected`/`facadeConnected`) — the seam itself.
- **Current fixed value**: `{ state: "PlanningOnly", providerConnected: false, facadeConnected: false, reason: "ProviderFacadeConnectionPending" }`
- **Reason to keep**: This is the ONE seam `docs/runtime_crypto_loader_facade.md` names as the sole door between Provider and Facade — foundational, not a convenience layer.
- **Consolidation candidate?**: No.

### 5. Crypto Loader Facade

- **File**: `src/runtime/fedos_crypto_loader_facade.ts` (Stage 594)
- **Role**: The single seam Runtime/Provider code would eventually call through; names the currently-designated backend (`"WasmPlanned"`) without hard-coding it as the only possible one.
- **Current fixed value**: `{ state: "PlanningOnly", initialized: false, backend: "WasmPlanned", reason: "FacadeInitializationPending" }`; `initializeCrypto()` returns `{ allowed: false, reason: "FacadeInitializationPending" }`
- **Reason to keep**: Core architectural decision (Facade pattern, backend-swappable) — not a placeholder for convenience.
- **Consolidation candidate?**: No.

### 6. Explicit Crypto Initialization

- **File**: `src/runtime/fedos_explicit_crypto_initialization.ts` (Stage 586)
- **Role**: Fixes the permanent design decision that crypto is NEVER auto-loaded or implicitly loaded — only a future, explicit `initCrypto()`-style call may ever load anything.
- **Current fixed value**: `{ mode: "ExplicitInitialization", initializationAllowed: false, initialized: false, reason: "InitializationApprovalPending" }`
- **Reason to keep**: Encodes a permanent, non-negotiable safety policy (Fail Closed, no implicit load) — this is a standing project decision, not a transient placeholder.
- **Consolidation candidate?**: No.

### 7. InitializeCrypto API Contract

- **File**: `src/runtime/fedos_initialize_crypto_api_contract.ts` (Stage 634)
- **Role**: Whether the INTERNAL Facade-level `initializeCrypto()` is currently callable, and whether it has ever run.
- **Current fixed value**: `{ state: "PlanningOnly", callable: false, initialized: false, reason: "InitializeCryptoApiPending" }`
- **Reason to keep**: Names the API SURFACE question distinctly from the shape-agreement question layer 3 answers.
- **Consolidation candidate?**: Yes — see simplification plan; closely related to layer 8.

### 8. Crypto Initialization Result Contract

- **File**: `src/runtime/fedos_crypto_initialization_result.ts` (Stage 642)
- **Role**: What a completed call would actually REPORT back — success/failure, and which backend (if any) served it.
- **Current fixed value**: `{ state: "PlanningOnly", success: false, backend: "None", reason: "InitializationResultPending" }`
- **Reason to keep**: "Did it complete" (layer 7) and "did it succeed, with what backend" (this layer) are genuinely different questions once real execution exists.
- **Consolidation candidate?**: Yes — see simplification plan; closely related to layer 7.

### 9. Runtime initializeCrypto Exposure Review

- **File**: `src/runtime/fedos_initialize_crypto_exposure_review.ts` (Stage 650)
- **Role**: The FIRST layer that looks outward, toward Runtime: is `initializeCrypto()` currently exposed on `AppRuntime`, and has that exposure been reviewed and approved.
- **Current fixed value**: `{ state: "PlanningOnly", exposed: false, approved: false, reason: "RuntimeExposureReviewPending" }`
- **Reason to keep**: Marks the transition point from "internal machinery" to "Runtime-facing decision" — a real architectural boundary.
- **Consolidation candidate?**: Possibly redundant with layer 10 once real wiring exists — see simplification plan.

### 10. Runtime initializeCrypto Wiring Plan

- **File**: `src/runtime/fedos_initialize_crypto_wiring_plan.ts` (Stage 658)
- **Role**: Whether a Runtime connection and a Worker connection are each INDEPENDENTLY permitted — Worker approval is never assumed by Runtime approval.
- **Current fixed value**: `{ state: "PlanningOnly", runtimeWiringAllowed: false, workerWiringAllowed: false, reason: "RuntimeWiringPlanPending" }`
- **Reason to keep**: The Runtime/Worker independence guarantee is load-bearing for `docs/runtime_worker_activation_boundary.md`'s own discipline — must stay explicit.
- **Consolidation candidate?**: No.

### 11. Runtime initializeCrypto Public API

- **File**: `src/runtime/fedos_initialize_crypto_public_api.ts` (Stage 666)
- **Role**: The SHAPE of what Runtime would expose to its own callers — is `initializeCrypto()` visible as a public `AppRuntime` member, and is that member callable.
- **Current fixed value**: `{ state: "PlanningOnly", apiVisible: false, callable: false, reason: "PublicApiPending" }`
- **Reason to keep**: A public surface question, distinct from the internal wiring-permission question layer 10 answers.
- **Consolidation candidate?**: Yes — see simplification plan; closely related to layer 12.

### 12. Runtime initializeCrypto Invocation Contract

- **File**: `src/runtime/fedos_initialize_crypto_invocation_contract.ts` (Stage 674)
- **Role**: The terminus of this arc — is an actual INVOCATION currently permitted, and has one ever completed. An event-level question, distinct from the structural callability question layer 11 answers.
- **Current fixed value**: `{ state: "PlanningOnly", invocationAllowed: false, completed: false, reason: "InvocationContractPending" }`
- **Reason to keep**: "Callable" and "has been called" are different claims — collapsing them would hide the distinction the moment either becomes real.
- **Consolidation candidate?**: Yes — see simplification plan; closely related to layer 11.

## What this review does NOT do

- Does **not** delete, rename, or modify any of the twelve files above.
- Does **not** add a thirteenth `PlanningOnly` layer.
- Does **not** add or change any diagnostics field.
- Does **not** write `import()` of any kind, anywhere.
- Does **not** connect Runtime or Worker to any of this.
- Does **not** modify `create_runtime.ts` or `src/worker.ts`.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_initialize_crypto_simplification_plan.md` (Stage 682)
  — the classification of each layer above into keep/consolidate/
  docs-only/possibly-unnecessary, without deleting any of them.
- `docs/runtime_initialize_crypto_first_wiring_plan.md` (Stage 683) —
  what the FIRST real connection, whenever it happens, would need to
  look like.
- `docs/runtime_internal_execution_contract.md` — the full target
  architecture diagram this review's ordering follows.
