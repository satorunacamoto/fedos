# FedOS initializeCrypto API Contract — Stage 633

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, the generated JS glue, and
`WebAssembly.instantiate` remain PROHIBITED as well. This stage is
DESIGN ONLY — no real call is ever made.**

`docs/runtime_provider_init_facade_contract.md` (Stage 625) fixed
whether the Provider side and the Facade side agree on a shared
call/return SHAPE. THIS document goes one level deeper: it names the
API SURFACE of `initializeCrypto()` itself — is it even CALLABLE right
now, and has it ever actually run — kept separate from the shape
agreement question, because a shape can be agreed upon long before the
function backing it is safe to call.

## 1. Why a separate API Contract, not just "shape agreed implies callable"

`FedosProviderInitFacadeContract.contractReady` (Stage 626) answers
"do the two sides agree on a shape." It does NOT answer a distinct,
later question: "is `initializeCrypto()` itself currently callable,
and has it ever been called." A shape could, in principle, be agreed
upon while the function itself remains deliberately uncallable — e.g.
pending a Runtime activation review that has nothing to do with shape
agreement. This document keeps them separate:

| Field | Question it answers |
|---|---|
| `state` | The API Contract's own coarse readiness state. |
| `callable` | Is `initializeCrypto()` currently callable at all? |
| `initialized` | Has `initializeCrypto()` ever actually been called and completed? |
| `reason` | WHY `initializeCrypto()` is not currently callable. |

`callable` and `initialized` are kept separate for the same reason
`requested`/`allowed` were kept separate in
`docs/runtime_crypto_provider_initialization_request.md` (Stage 609)
§2: a function could become callable before it is ever actually
called, and collapsing the two would hide that distinction.

## 2. Position in the chain

```
Provider Init Facade Contract
        │
        ▼
InitializeCrypto API Contract
        │
        ▼
Crypto Initialization Result Contract
```

This is a CONCEPTUAL, target-architecture position — see
`docs/runtime_internal_execution_contract.md` for the exact,
up-to-date real-vs-positional breakdown. The ONE real wire this stage
adds runs the SAME direction as the target diagram this time (unlike
several earlier layers in this arc): `createProviderInitFacadeContract()`
(`fedos_provider_init_facade_contract.ts`, Stage 626) CALLS
`createInitializeCryptoApiContract()`, discarding the result — this is
simply the next, deepest link the parked implementation chain has
reached; it does not mean the underlying `FedosCryptoLoaderFacade.initializeCrypto()`
(Stage 594) is invoked by anything in this file.

`src/runtime/fedos_initialize_crypto_api_contract.ts` (Stage 634) is
the real, fixed-value implementation of this design's collapsed answer
— `createInitializeCryptoApiContract()` always resolves `{ state:
"PlanningOnly", callable: false, initialized: false, reason:
"InitializeCryptoApiPending" }`.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** actually call `FedosCryptoLoaderFacade.initializeCrypto()`
  (`fedos_crypto_loader_facade.ts`, Stage 594) — this file records
  whether that call is currently permitted; it never performs one.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this — no Runtime or Worker connection
  of any kind exists yet.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-44/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_provider_init_facade_contract.md` (Stage 625) — the
  shape-agreement layer this API Contract sits directly below.
- `src/runtime/fedos_initialize_crypto_api_contract.ts` (Stage
  634–635) — the real, fixed-value implementation of this design and
  its wiring from `fedos_provider_init_facade_contract.ts`.
- `docs/runtime_crypto_initialization_result.md` (Stage 641) — the
  next, deeper layer: what a completed call would eventually report.
- `docs/runtime_internal_execution_contract.md` (updated Stage 637) —
  the diagram naming this Contract's position, and confirming no
  Runtime/Worker connection exists yet.
