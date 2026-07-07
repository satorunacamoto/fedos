# FedOS Provider Initialization Approval — Stage 617

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, the generated JS glue, and
`WebAssembly.instantiate` remain PROHIBITED as well. This stage is
DESIGN ONLY — no real approval is ever granted.**

`docs/runtime_crypto_provider_initialization_request.md` (Stage 609)
fixed PROVIDER-SIDE PLANNING for a request — whether a Provider has
ever issued one (`requested`) and whether the Boundary would currently
accept one (`allowed`). THIS document goes one level deeper still: even
IF a request were someday issued and accepted, it would still need a
dedicated APPROVAL step before anything downstream could act on it —
scoped narrowly to "has THIS specific request been approved," distinct
from the request's own `allowed` flag.

## 1. Why a separate Approval, not just the Request's own `allowed` flag

`FedosCryptoProviderInitializationRequest.allowed` (Stage 610) answers
"would the Boundary currently accept a request." It does NOT answer a
distinct, later question: "has a SPECIFIC, already-issued request
actually been reviewed and approved." Collapsing both into one flag
would hide a real failure mode — a request that is structurally
acceptable to the Boundary (`allowed: true`, in some hypothetical
future state) could still be sitting unreviewed, with no approval
decision recorded anywhere. This document keeps them separate:

| Field | Question it answers |
|---|---|
| `state` | The Approval's own coarse review state. |
| `approved` | Has this specific request actually been approved? |
| `reason` | WHY the request is not currently approved. |

## 2. Position in the chain

```
Provider Initialization Request
        │
        ▼
Provider Initialization Approval
        │
        ▼
Provider Init Facade Contract
```

This is a CONCEPTUAL, target-architecture position — see
`docs/runtime_internal_execution_contract.md` for the exact,
up-to-date real-vs-positional breakdown. The ONE real wire this stage
adds runs the OPPOSITE direction, deeper into the already-parked
chain: `createCryptoProviderInitializationRequest()`
(`fedos_crypto_provider_initialization_request.ts`, Stage 610) CALLS
`createProviderInitializationApproval()`, discarding the result.

`src/runtime/fedos_provider_initialization_approval.ts` (Stage 618) is
the real, fixed-value implementation of this design's collapsed answer
— `createProviderInitializationApproval()` always resolves `{ state:
"PlanningOnly", approved: false, reason:
"ProviderInitializationApprovalPending" }`.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** actually approve any request — no Provider
  implementation issues a request in the first place (Stage 609 §1),
  so there is nothing to approve.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this — no Runtime or Worker connection
  of any kind exists yet.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_crypto_provider_initialization_request.md` (Stage 609)
  — the request this Approval reviews.
- `src/runtime/fedos_provider_initialization_approval.ts` (Stage
  618–619) — the real, fixed-value implementation of this design and
  its wiring from `fedos_crypto_provider_initialization_request.ts`.
- `docs/runtime_provider_init_facade_contract.md` (Stage 625) — the
  next, deeper layer: what an approved request would still need before
  the Boundary could act on it.
- `docs/runtime_internal_execution_contract.md` (updated Stage 621) —
  the diagram naming the Approval's position, and confirming no
  Runtime/Worker connection exists yet.
