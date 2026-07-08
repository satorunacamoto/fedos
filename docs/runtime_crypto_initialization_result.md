# FedOS Crypto Initialization Result Contract — Stage 641

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, the generated JS glue, and
`WebAssembly.instantiate` remain PROHIBITED as well. This stage is
DESIGN ONLY — no real initialization ever runs or completes.**

`docs/runtime_initialize_crypto_api_contract.md` (Stage 633) fixed
whether `initializeCrypto()` is currently callable and whether it has
ever run. THIS document fixes the LAST layer in this Planning arc:
what a completed call would actually REPORT back — success/failure,
and which backend (if any) ultimately served the request. This is the
terminus of the Provider-side Planning arc begun at
`docs/runtime_crypto_provider_initialization_request.md` (Stage 609).

## 1. Why a separate Result Contract, not just "initialized implies success"

`FedosInitializeCryptoApiContract.initialized` (Stage 634) answers
"has `initializeCrypto()` ever been called and completed." It does NOT
answer a distinct, later question: "did that call actually SUCCEED,
and which backend served it." A call could complete without
succeeding — e.g. failing fast because no backend was ever selected —
and collapsing "completed" and "succeeded" into one flag would hide
that distinction. This document keeps them separate:

| Field | Question it answers |
|---|---|
| `state` | The Result Contract's own coarse completion state. |
| `success` | Did initialization actually succeed? |
| `backend` | Which backend (if any) ultimately served the request? |
| `reason` | WHY no result is currently available. |

`backend` is fixed `"None"` in this stage — mirroring
`FedosCryptoLoaderFacade.backend`'s own `"WasmPlanned"` DESIGNATION
(Stage 594) without claiming any backend has ever actually been
selected or connected for a real call; `"None"` and `"WasmPlanned"`
answer different questions ("who actually served this specific
result" vs. "who is currently designated as the future candidate").

## 2. Position in the chain — the terminus of Provider-side Planning

```
InitializeCrypto API Contract
        │
        ▼
Crypto Initialization Result Contract
        │
        ▼
STOP
```

This is a CONCEPTUAL, target-architecture position — see
`docs/runtime_internal_execution_contract.md` for the full, up-to-date
target diagram (Stage 633–637's extension) and its real-vs-positional
breakdown. The ONE real wire this stage adds continues the SAME
direction the previous stage established:
`createInitializeCryptoApiContract()`
(`fedos_initialize_crypto_api_contract.ts`, Stage 634) CALLS
`createCryptoInitializationResult()`, discarding the result.

`src/runtime/fedos_crypto_initialization_result.ts` (Stage 642) is the
real, fixed-value implementation of this design's collapsed answer —
`createCryptoInitializationResult()` always resolves `{ state:
"PlanningOnly", success: false, backend: "None", reason:
"InitializationResultPending" }`.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** actually run or complete any initialization — no
  backend of any kind is ever selected, connected, or executed by this
  file.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this — no Runtime or Worker connection
  of any kind exists yet.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-44/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_initialize_crypto_api_contract.md` (Stage 633) — the
  callability layer this Result Contract sits directly below.
- `src/runtime/fedos_crypto_initialization_result.ts` (Stage 642–643)
  — the real, fixed-value implementation of this design and its
  wiring from `fedos_initialize_crypto_api_contract.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 645) —
  the full target-architecture diagram, from Runtime through this
  Result Contract, and confirming no Runtime/Worker connection exists
  yet.
