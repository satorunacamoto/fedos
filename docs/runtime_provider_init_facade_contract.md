# FedOS Provider Init Facade Contract — Stage 625

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, the generated JS glue, and
`WebAssembly.instantiate` remain PROHIBITED as well. This stage is
DESIGN ONLY — no real contract is ever established.**

`docs/runtime_provider_initialization_approval.md` (Stage 617) fixed
whether a specific request has been approved. THIS document fixes the
LAST layer before the already-real Provider/Facade Boundary
(`docs/runtime_crypto_provider_facade_boundary.md`, Stage 601): even
IF a request were approved, the Boundary and a future Provider
implementation would still need to agree on a shared CONTRACT —
the exact shape `initializeCrypto()` expects, and what it promises
back — before the Boundary could ever forward anything to the Facade.

## 1. Why a separate Contract, not just "approved implies ready"

An approval (Stage 617) answers "should this request proceed." It
does NOT answer a distinct, structural question: "do the Provider side
and the Facade side actually agree on the SHAPE of what gets
exchanged." A request could, in principle, be approved while the
Provider and Facade sides still disagree on argument shape, return
shape, or error semantics — that mismatch is exactly what a CONTRACT
exists to catch, independently of approval. This document keeps them
separate:

| Field | Question it answers |
|---|---|
| `state` | The Contract's own coarse readiness state. |
| `contractReady` | Do the Provider side and the Facade side currently agree on a shared call/return shape? |
| `reason` | WHY the contract is not currently ready. |

## 2. Position in the chain

```
Provider Initialization Approval
        │
        ▼
Provider Init Facade Contract
        │
        ▼
Provider / Facade Boundary
```

This is a CONCEPTUAL, target-architecture position — see
`docs/runtime_internal_execution_contract.md` for the exact,
up-to-date real-vs-positional breakdown. The ONE real wire this stage
adds runs the OPPOSITE direction, deeper into the already-parked
chain: `createProviderInitializationApproval()`
(`fedos_provider_initialization_approval.ts`, Stage 618) CALLS
`createProviderInitFacadeContract()`, discarding the result.

`src/runtime/fedos_provider_init_facade_contract.ts` (Stage 626) is
the real, fixed-value implementation of this design's collapsed answer
— `createProviderInitFacadeContract()` always resolves `{ state:
"PlanningOnly", contractReady: false, reason:
"ProviderInitFacadeContractPending" }`.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** actually define or enforce a call/return shape between
  any Provider implementation and `fedos_crypto_loader_facade.ts` —
  that rewiring, if it ever happens, is a future, separate,
  explicitly-reviewed stage's decision.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this — no Runtime or Worker connection
  of any kind exists yet.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_provider_initialization_approval.md` (Stage 617) — the
  approval this Contract's readiness is layered beneath.
- `src/runtime/fedos_provider_init_facade_contract.ts` (Stage
  626–627) — the real, fixed-value implementation of this design and
  its wiring from `fedos_provider_initialization_approval.ts`.
- `docs/runtime_crypto_provider_facade_boundary.md` (Stage 601) — the
  already-real Boundary this Contract sits directly above.
- `docs/runtime_internal_execution_contract.md` (updated Stage 629) —
  the full diagram naming every box from Crypto Provider through
  Crypto Loader Facade, and confirming no Runtime/Worker connection
  exists yet.
