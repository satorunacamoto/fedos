# FedOS Crypto Loader Backend Abstraction — Stage 713

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, the WASM Loader, the generated JS glue, and
`WebAssembly.instantiate` remain PROHIBITED as well. This stage is
DESIGN ONLY — no real backend load of any kind is implemented.**

`docs/runtime_crypto_loader_facade.md` (Stage 593) fixed WHERE, in the
call graph, requests for crypto route through a single narrow seam —
the Facade — so that Runtime and Provider code never reason about the
WASM Loader or Rust directly. THIS document goes one link further: it
names the seam directly BELOW the Facade that lets the Facade itself
stay a thin entry point, by separating "decide to ask for crypto now"
from "decide which backend would eventually serve that ask."

## 1. The intended shape

```
Runtime
        │
        ▼
initializeCrypto()
        │
        ▼
Crypto Loader Facade
        │
        ▼
Crypto Loader Backend Abstraction
        │
        ▼
STOP
```

This is the real, up-to-date position for this arc as of this stage —
see `docs/runtime_internal_execution_contract.md` (Stage 726 update)
for the full diagram including the pre-existing Facade-and-below
Planning chain. The Backend Abstraction is a deliberate STOP: this
stage does **not** advance to the WASM Loader, the generated JS glue,
or Rust. Reaching those remains a future, separate,
explicitly-reviewed stage's decision.

## 2. Why a separate Abstraction, not just "the Facade names a backend"

`FedosCryptoLoaderFacade.backend` (Stage 594) already carries a
`FedosCryptoLoaderFacadeBackend` label (`"WasmPlanned"` today). That
field answers "which backend does the Facade currently claim" as ONE
flat fact bundled into the Facade's own result. This document names a
SEPARATE, dedicated object for that decision instead, because a real
future backend swap needs more than a label:

| Field | Question it answers |
|---|---|
| `state` | The Backend Abstraction's own coarse state. |
| `backendKind` | WHICH backend candidate is currently designated. |
| `backendReady` | Is that designated backend actually ready to serve a request? |
| `reason` | WHY it is not ready (yet). |

Splitting this out means a future stage that actually swaps backends
touches ONE file (`fedos_crypto_loader_backend.ts`) instead of
reshaping the Facade's own result shape — the Facade keeps asking the
Abstraction the same three questions (`backendKind`/`backendReady`/
`reason`) regardless of which candidate answers them.

`src/runtime/fedos_crypto_loader_backend.ts` (Stage 714) is the real,
fixed-value implementation of this design's collapsed answer —
`createCryptoLoaderBackend()` always resolves `{ state:
"PlanningOnly", backendKind: "WasmPlanned", backendReady: false,
reason: "BackendAbstractionPending" }`.

## 3. Rust vs Runtime vs Facade — the division of responsibility

This stage's design commits to a specific split, which future stages
must respect:

- **Rust** (`packages/fedos-core-rust`) is responsible for
  cryptography, keys, signatures, and safety boundaries ONLY. It does
  not know about "backends," "loaders," or JavaScript at all — that
  has been true since Stage 402
  (`docs/runtime_execution_backend.md`) and remains true here.
- **Runtime** (`create_runtime.ts`/`AppRuntime`) never knows backend
  detail. It calls `initializeCrypto()`, and nothing about `"WasmPlanned"`/
  `"NativePlanned"`/`"PythonPlanned"` is ever visible to Runtime's own
  code — that knowledge stops at the Facade.
- **Facade** (`fedos_crypto_loader_facade.ts`) is a THIN entry point
  for backend selection. It asks the Backend Abstraction which
  candidate is designated and discards the answer — it does not branch
  on `backendKind`, cache it, or expose it beyond its own pre-existing
  `backend` field.

## 4. The three named backend candidates

`FedosCryptoLoaderBackendKind` names three candidates. Naming a
candidate is a label of intent only — none is connected to anything.

| Candidate | Role | Status |
|---|---|---|
| `"WasmPlanned"` | The FIRST implementation candidate — mirrors `fedos_execution_backend.ts`'s own WASM-first selection (Stage 402). | The ONLY value `createCryptoLoaderBackend()` ever produces in this stage. |
| `"NativePlanned"` | A FUTURE candidate for a native/desktop/mobile addon, named in `docs/runtime_execution_backend.md`'s own "Native/Desktop and Mobile backends" future-candidate list. | Named only — no file, dependency, or line of code implements it. |
| `"PythonPlanned"` | A FUTURE candidate for an experimentation/analysis layer (e.g. offline research tooling), distinct from any production backend. | Named only — no file, dependency, or line of code implements it. |

`backendKind` is typed as fixed `"WasmPlanned"` in this stage — the
other two variants exist purely so a later, separate, explicitly-
reviewed stage can select them without a new enum variant needing
review at that point.

## 5. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** connect to `fedos_wasm_loader.ts`/
  `fedos_wasm_loader_plan.ts`/`fedos_wasm_loader_contract.ts` in any
  way — the WASM Loader remains unreachable from this Abstraction.
- Does **not** implement `"NativePlanned"`/`"PythonPlanned"` — neither
  has a file, dependency, or line of code anywhere in this repository.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to this Abstraction directly — ONLY the Facade may
  ever call `createCryptoLoaderBackend()`.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-44/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_crypto_loader_facade.md` (Stage 593) — the Facade
  design this Abstraction sits directly below, and whose
  responsibility #5 ("backend is swappable in the future") this
  document makes concrete.
- `src/runtime/fedos_crypto_loader_backend.ts` (Stage 714) — the real,
  fixed-value implementation of this design.
- `src/runtime/fedos_crypto_loader_facade.ts` (Stage 721) — the ONLY
  caller of `createCryptoLoaderBackend()`, wiring the Facade one link
  deeper while keeping its own return value unchanged.
- `docs/runtime_execution_backend.md` (Stage 401/405) — the pre-existing
  Execution Backend design this Abstraction's candidate list
  deliberately mirrors (WASM first, Native/Mobile as future
  candidates) while remaining a SEPARATE object in a separate part of
  the call graph.
- `docs/runtime_internal_execution_contract.md` (updated Stage 726) —
  the diagram naming this Abstraction's position and confirming no
  Runtime/Worker connection exists yet.
