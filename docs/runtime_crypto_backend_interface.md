# FedOS Crypto Backend Interface — Stage 745

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, the real WASM Loader, the generated JS
glue, and `WebAssembly.instantiate` remain PROHIBITED as well. This
stage is DESIGN ONLY — no real backend is ever created, selected, or
activated.**

`docs/runtime_crypto_loader_backend_abstraction.md` (Stage 713) named
the Backend Abstraction directly below the Crypto Loader Facade;
`docs/runtime_wasm_backend_planning.md` (Stage 729) named the WASM
Backend Planning layer directly below that. THIS document inserts a
seam BETWEEN those two: a common, backend-agnostic CONTRACT that would
let the Backend Abstraction eventually talk to WASM, Native, or Python
backend candidates through the SAME shape, instead of the Abstraction
(or anything above it) ever branching on which candidate is currently
designated.

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
WASM Backend Planning
        │
        ▼
STOP
```

This is the real, up-to-date position for this arc as of this stage —
see `docs/runtime_internal_execution_contract.md` (Stage 758 update)
for the full diagram including the pre-existing Facade-and-below
Planning chain. The Backend Interface sits directly BETWEEN the
Backend Abstraction and WASM Backend Planning — it does not replace
either, and does not advance past WASM Backend Planning. Reaching the
real WASM Loader, the generated JS glue, or Rust remains a future,
separate, explicitly-reviewed stage's decision.

## 2. Why a separate interface, not just "the Abstraction calls WASM Backend Planning directly"

Before this stage, `fedos_crypto_loader_backend.ts` called
`fedos_wasm_backend.ts` directly (Stage 737) — a hard-coded reach to
ONE specific candidate's planning layer. That direct wire does not
scale: a future Native or Python candidate would force the Abstraction
itself to branch on `backendKind`. This document names a common
CONTRACT instead, so the Abstraction only ever talks to ONE seam
regardless of which candidate is behind it:

| Field | Question it answers |
|---|---|
| `state` | The Backend Interface's own coarse state. |
| `backendSelected` | WHICH backend candidate this Interface currently talks to. |
| `backendActivated` | Has any backend actually been activated through this Interface? |
| `interfaceReady` | Is the Interface itself ready to route a real call? |
| `reason` | WHY the Interface is not ready (yet). |

Splitting this out means a future stage that adds a Native or Python
backend touches this ONE file (`fedos_crypto_backend_interface.ts`)
rather than reshaping the Backend Abstraction itself — the Abstraction
keeps asking the Interface the same questions regardless of which
concrete planning layer answers them underneath.

`src/runtime/fedos_crypto_backend_interface.ts` (Stage 746) is the
real, fixed-value implementation of this design's collapsed answer —
`createCryptoBackendInterface()` always resolves `{ state:
"PlanningOnly", backendSelected: "WasmPlanned", backendActivated:
false, interfaceReady: false, reason: "BackendInterfacePending" }`.

## 3. Rust vs Runtime vs Facade vs Backend Abstraction vs Backend Interface — the division of responsibility

This stage's design extends the SAME split
`docs/runtime_wasm_backend_planning.md` §3 already fixed:

- **Rust** (`packages/fedos-core-rust`) is responsible for
  cryptography, keys, signatures, and safety boundaries ONLY.
- **Runtime** (`create_runtime.ts`/`AppRuntime`) never knows backend,
  loader, or interface detail — that knowledge stops at the Facade,
  unchanged.
- **Facade** (`fedos_crypto_loader_facade.ts`) is unchanged by this
  stage.
- **Backend Abstraction** (`fedos_crypto_loader_backend.ts`) no longer
  reaches WASM Backend Planning directly — it now reaches the Backend
  Interface instead, and discards the answer exactly as before.
- **Backend Interface** (`fedos_crypto_backend_interface.ts`) is a
  THIN, backend-agnostic seam. It asks WASM Backend Planning (today's
  only real candidate) whether it is ready and discards the answer —
  it does not branch on `backendActivated`/`interfaceReady`, cache
  them, or expose them beyond its own pre-existing fields.

## 4. What "backendSelected" names, and what it does not

`backendSelected` reuses `FedosCryptoLoaderBackendKind`'s own value
set (`"WasmPlanned"`/`"NativePlanned"`/`"PythonPlanned"`) — it is the
SAME label the Backend Abstraction already carries, echoed one level
down so the Interface can eventually route by it. Naming the candidate
here is still a label of intent only — the Interface neither creates,
selects, nor activates any backend.

## 5. What this stage does NOT do

- Does **not** create a backend of any kind.
- Does **not** select a backend of any kind — `backendSelected` is a
  fixed echo, not a live selection.
- Does **not** activate a backend of any kind — `backendActivated` is
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
  way — the real WASM Loader remains unreachable from this Interface.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to this Interface directly — ONLY the Backend
  Abstraction may ever call `createCryptoBackendInterface()`.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-44/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.
- Does **not** change the Backend Abstraction's OWN return value, the
  Facade's own return value, or Runtime's own `initializeCrypto()`
  return value — all stay byte-for-byte unchanged.
- Does **not** change `fedos_wasm_backend.ts`'s own fixed return value
  — WASM Backend Planning still resolves `{ state: "PlanningOnly",
  backendReady: false, loaderAttached: false, loaderKind:
  "WasmLoaderPlanned", reason: "WasmBackendPlanningPending" }`, now
  reached one link further down.

## See also

- `docs/runtime_wasm_backend_planning.md` (Stage 729) — the planning
  layer this Interface now sits directly above, whose fixed answer is
  unchanged.
- `src/runtime/fedos_crypto_backend_interface.ts` (Stage 746) — the
  real, fixed-value implementation of this design.
- `src/runtime/fedos_crypto_loader_backend.ts` (Stage 753) — the ONLY
  caller of `createCryptoBackendInterface()`, wiring the Backend
  Abstraction one link deeper while keeping its own return value
  unchanged.
- `docs/runtime_crypto_loader_backend_abstraction.md` (Stage 713) —
  the Backend Abstraction this Interface sits directly below.
- `docs/runtime_internal_execution_contract.md` (updated Stage 758) —
  the diagram naming this Interface's position and confirming no
  Runtime/Worker connection exists yet.
