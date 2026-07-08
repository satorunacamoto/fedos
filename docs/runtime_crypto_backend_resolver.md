# FedOS Crypto Backend Resolver — Stage 762

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, the real WASM Loader, the generated JS
glue, and `WebAssembly.instantiate` remain PROHIBITED as well. This
stage is DESIGN ONLY — no real backend is ever created, loaded, or
made available.**

`docs/runtime_crypto_backend_interface.md` (Stage 745) named a common,
backend-agnostic CONTRACT directly below the Crypto Loader Backend
Abstraction. THIS document names a seam directly below that Interface
that answers ONE narrow question only: **which backend does this
repository currently plan to use** — nothing about readiness to load,
nothing about an attached loader, nothing about activation. Answering
"which backend is planned" and answering "is that backend ready/
loadable" are kept as TWO separate concerns, exactly as the Backend
Interface itself already kept "which candidate" (Backend Abstraction)
separate from "is the Interface ready to route" (Backend Interface).

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
Backend Interface
        │
        ▼
Backend Resolver
        │
        ▼
STOP
```

This is the real, up-to-date position for this arc as of this stage —
see `docs/runtime_internal_execution_contract.md` (Stage 774 update)
for the full diagram including the pre-existing Facade-and-below
Planning chain. Backend Resolver is a deliberate STOP: this stage does
**not** advance to the real WASM Loader, the generated JS glue, or
Rust. Reaching those remains a future, separate, explicitly-reviewed
stage's decision.

**This diagram names the Interface's SECOND, separate reach — it does
NOT replace or remove the Interface's pre-existing reach into WASM
Backend Planning (`fedos_wasm_backend.ts`, Stage 730/746), which stays
byte-for-byte unchanged.** The Backend Interface now reaches TWO
independent leaves — WASM Backend Planning (candidate-specific
readiness/loader planning) and Backend Resolver (which candidate is
planned, repository-wide) — mirroring the SAME "a second, separate
reach" pattern `fedos_crypto_loader_facade.ts` already established for
`reachProviderFacadeBoundary()`/`reachCryptoLoaderBackend()` (Stage
594/721).

## 2. Why a separate Resolver, not just "read `backendSelected` again"

`FedosCryptoBackendInterface.backendSelected` (Stage 746) already
names `"WasmPlanned"`. This document does not duplicate that field for
its own sake — it names a SEPARATE object because a future real
resolution step needs more than an echoed label:

| Field | Question it answers |
|---|---|
| `state` | The Resolver's own coarse state. |
| `selectedBackend` | WHICH backend this repository currently plans to use. |
| `backendResolved` | Has resolution (picking a concrete candidate to attempt) ever actually completed? |
| `backendAvailable` | Is the resolved backend actually available to load, right now? |
| `reason` | WHY resolution/availability is not settled (yet). |

Splitting `backendResolved` (has a decision been made) from
`backendAvailable` (could that decision's target actually be loaded)
mirrors the same "decision vs. readiness" separation
`docs/runtime_crypto_loader_backend_abstraction.md` §2 and
`docs/runtime_crypto_backend_interface.md` §2 already used one and two
levels up.

`src/runtime/fedos_crypto_backend_resolver.ts` (Stage 763) is the
real, fixed-value implementation of this design's collapsed answer —
`createCryptoBackendResolver()` always resolves `{ state:
"PlanningOnly", selectedBackend: "WasmPlanned", backendResolved:
false, backendAvailable: false, reason: "BackendResolutionPending" }`.

## 3. Rust vs Runtime vs Facade vs Backend Abstraction vs Backend Interface vs Backend Resolver — the division of responsibility

This stage's design extends the SAME split
`docs/runtime_crypto_backend_interface.md` §3 already fixed:

- **Rust** (`packages/fedos-core-rust`) is responsible for
  cryptography, keys, signatures, and safety boundaries ONLY.
- **Runtime** (`create_runtime.ts`/`AppRuntime`) never knows backend,
  interface, or resolver detail — that knowledge stops at the Facade,
  unchanged.
- **Facade** (`fedos_crypto_loader_facade.ts`) is unchanged by this
  stage.
- **Backend Abstraction** (`fedos_crypto_loader_backend.ts`) is
  unchanged by this stage — it still reaches only the Backend
  Interface.
- **Backend Interface** (`fedos_crypto_backend_interface.ts`) now
  reaches the Backend Resolver as a SECOND, separate leaf, alongside
  its pre-existing reach into WASM Backend Planning. It discards the
  Resolver's answer exactly as it discards the Planning layer's
  answer.
- **Backend Resolver** (`fedos_crypto_backend_resolver.ts`) is a pure
  leaf. It answers "which backend is planned" only — it does not
  create a backend, select a backend for real, attach a loader, or
  make anything available.

## 4. What this stage does NOT do

- Does **not** create a backend of any kind.
- Does **not** resolve a backend for real — `backendResolved` is fixed
  `false`; `selectedBackend` is a fixed echo, not a live resolution.
- Does **not** make any backend available — `backendAvailable` is
  fixed `false`.
- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** connect to `fedos_wasm_loader.ts`/
  `fedos_wasm_loader_plan.ts`/`fedos_wasm_loader_contract.ts` in any
  way — the real WASM Loader remains unreachable from this Resolver.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to this Resolver directly — ONLY the Backend
  Interface may ever call `createCryptoBackendResolver()`.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-44/NIP-59, Double Ratchet,
  or Triple Ratchet.
- Does **not** change any Cargo/`package.json` dependency.
- Does **not** change the Backend Interface's OWN return value, the
  Backend Abstraction's own return value, the Facade's own return
  value, or Runtime's own `initializeCrypto()` return value — all stay
  byte-for-byte unchanged.
- Does **not** change `fedos_wasm_backend.ts`'s own fixed return value
  — that reach and its answer are entirely untouched by this stage.

## See also

- `docs/runtime_crypto_backend_interface.md` (Stage 745) — the
  Backend Interface this Resolver sits directly below, and whose
  pre-existing reach into WASM Backend Planning stays unchanged
  alongside this new, second reach.
- `src/runtime/fedos_crypto_backend_resolver.ts` (Stage 763) — the
  real, fixed-value implementation of this design.
- `src/runtime/fedos_crypto_backend_interface.ts` (Stage 764) — the
  ONLY caller of `createCryptoBackendResolver()`, wiring the Interface
  one link deeper (a second, separate reach) while keeping its own
  return value unchanged.
- `docs/runtime_crypto_loader_backend_abstraction.md` (Stage 713) —
  the Backend Abstraction two links above this Resolver.
- `docs/fedos_runtime_positioning.md` — the repository-wide scope
  statement this Resolver's candidate list echoes: Secure Runtime
  Platform, desktop-first, Rust owns crypto only.
- `docs/runtime_internal_execution_contract.md` (updated Stage 774) —
  the diagram naming this Resolver's position and confirming no
  Runtime/Worker connection exists yet.
