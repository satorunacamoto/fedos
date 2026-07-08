# FedOS WASM Backend Planning Layer — Stage 729

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, the WASM Loader, the generated JS glue, and
`WebAssembly.instantiate` remain PROHIBITED as well. This stage is
DESIGN ONLY — no real WASM backend of any kind is implemented or
attached.**

`docs/runtime_crypto_loader_backend_abstraction.md` (Stage 713) named
the seam directly below the Crypto Loader Facade that lets the Facade
stay a thin entry point for backend selection. THIS document goes one
link further: it names the seam directly BELOW that Backend
Abstraction that would eventually let the designated `"WasmPlanned"`
candidate (`fedos_crypto_loader_backend.ts`) describe its own
readiness and loader-attachment state — without the Abstraction, the
Facade, the Provider, or Runtime ever reasoning about a real WASM
Loader directly.

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
WASM Backend Planning
        │
        ▼
STOP
```

This is the real, up-to-date position for this arc as of this stage —
see `docs/runtime_internal_execution_contract.md` (Stage 742 update)
for the full diagram including the pre-existing Facade-and-below
Planning chain. WASM Backend Planning is a deliberate STOP: this stage
does **not** advance to the real WASM Loader (`fedos_wasm_loader.ts`),
the generated JS glue, or Rust. Reaching those remains a future,
separate, explicitly-reviewed stage's decision.

## 2. Why a separate planning layer, not just "the Backend Abstraction names WASM"

`FedosCryptoLoaderBackend.backendKind` (Stage 714) already names
`"WasmPlanned"` as the designated candidate. That field answers "WHICH
backend is designated" as one flat fact. This document names a
SEPARATE, dedicated object for the NEXT question a real WASM backend
would eventually need answered — not just "is WASM designated" but "is
a WASM backend, once designated, actually ready, and has it attached a
loader":

| Field | Question it answers |
|---|---|
| `state` | The WASM Backend Planning layer's own coarse state. |
| `backendReady` | Is a real WASM backend actually ready to serve a request? |
| `loaderAttached` | Has a real WASM Loader ever actually been attached to this backend? |
| `loaderKind` | WHICH loader kind this backend currently plans to attach. |
| `reason` | WHY the backend is not ready (yet). |

Splitting this out means a future stage that actually attaches a real
WASM Loader touches ONE file (`fedos_wasm_backend.ts`) instead of
reshaping the Backend Abstraction's own result shape — the Abstraction
keeps reaching this layer and discarding its answer regardless of how
that layer's own internals eventually change.

`src/runtime/fedos_wasm_backend.ts` (Stage 730) is the real,
fixed-value implementation of this design's collapsed answer —
`createWasmBackend()` always resolves `{ state: "PlanningOnly",
backendReady: false, loaderAttached: false, loaderKind:
"WasmLoaderPlanned", reason: "WasmBackendPlanningPending" }`.

## 3. Rust vs Runtime vs Facade vs Backend Abstraction — the division of responsibility

This stage's design extends the SAME split
`docs/runtime_crypto_loader_backend_abstraction.md` §3 already fixed:

- **Rust** (`packages/fedos-core-rust`) is responsible for
  cryptography, keys, signatures, and safety boundaries ONLY. It does
  not know about "backends," "loaders," or JavaScript at all.
- **Runtime** (`create_runtime.ts`/`AppRuntime`) never knows backend or
  loader detail. It calls `initializeCrypto()`, and nothing about
  `loaderAttached`/`loaderKind` is ever visible to Runtime's own code —
  that knowledge stops at the Facade, exactly as before.
- **Facade** (`fedos_crypto_loader_facade.ts`) is unchanged by this
  stage — it still asks the Backend Abstraction which candidate is
  designated and discards the answer.
- **Backend Abstraction** (`fedos_crypto_loader_backend.ts`) is a THIN
  layer for its own designated candidate's readiness. It asks the WASM
  Backend Planning layer whether that candidate is ready and discards
  the answer — it does not branch on `loaderAttached`/`loaderKind`,
  cache them, or expose them beyond its own pre-existing fields.

## 4. What "loaderKind" names, and what it does not

`FedosWasmBackendLoaderKind` names the loader kind a WASM backend would
eventually attach. Naming a kind here is a label of intent only — no
loader is attached.

| Value | Meaning | Status |
|---|---|---|
| `"WasmLoaderPlanned"` | The loader this backend now actually reaches (`fedos_wasm_loader.ts`'s `FedosWasmLoader.planLoad()`, Stage 793 — see §6) — but `loaderKind` itself remains a fixed label, never a live read of the Loader's own state. | The ONLY value `createWasmBackend()` ever produces in this stage. |
| `"WasmLoaderActive"` | A FUTURE value naming a real, attached loader. | RESERVED, unreachable from this file. |

## 5. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** connect to `fedos_wasm_loader_plan.ts`/
  `fedos_wasm_loader_contract.ts` — only `fedos_wasm_loader.ts` itself
  is reached (Stage 793, see §6), and only its `planLoad()`.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to this layer directly — ONLY the Backend
  Abstraction may ever call `createWasmBackend()`.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-44/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.
- Does **not** change the Backend Abstraction's OWN return value —
  `createCryptoLoaderBackend()` stays byte-for-byte `{ state:
  "PlanningOnly", backendKind: "WasmPlanned", backendReady: false,
  reason: "BackendAbstractionPending" }`.

## 6. Update — Stage 793: Loader reached, still blocked

Stage 793 (Prototype Phase 008) ends this layer's own "STOP" as a
literal absence of any further call: `createWasmBackend()` now
constructs a `FedosWasmLoader` (`fedos_wasm_loader.ts`, Stage 489–492)
and calls its `planLoad()` — the FIRST time anything in this
repository reaches that previously-"unwired" file besides tests. The
revised diagram:

```
Crypto Loader Backend Abstraction
        │
        ▼
WASM Backend Planning
        │
        ▼
FedosWasmLoader.planLoad()          <-- REAL call (Stage 793), result DISCARDED
        │
        ▼
BlockedByPolicy                     <-- fixed answer; STOP still holds past this point
        │
        ▼
STOP
```

`planLoad()` resolves `{ operation: "load", state: "BlockedByPolicy",
policy: "FailClosed", reason: "..." }` — discarded in full.
`createWasmBackend()`'s own return value stays byte-for-byte
`{ state: "PlanningOnly", backendReady: false, loaderAttached: false,
loaderKind: "WasmLoaderPlanned", reason:
"WasmBackendPlanningPending" }`. The generated JS glue,
`WebAssembly.instantiate`/`compile`, `initSync`/the default init
export, and Rust remain completely unreached — `planLoad()` itself
only reaches its own internal Loader Plan
(`fedos_wasm_loader_plan.ts`), never further, exactly as it did before
this stage.

`runtime_crypto_diagnostics.ts` (Stage 793) adds
`wasmBackendLoaderReached`/`wasmBackendLoaderLoaded`/
`wasmBackendLoaderDecision` (fixed `true`/`false`/`"BlockedByPolicy"`)
for DISPLAY only — `worker_crypto_diagnostics.ts` is intentionally NOT
touched.

**Still true after Stage 793**: no Runtime/Worker connection of any
kind; `create_runtime.ts`/`src/worker.ts` reference neither
`fedos_wasm_backend.ts` nor `fedos_wasm_loader.ts`; no generated JS
glue reference; no `import()` of any kind (static or dynamic); no
`WebAssembly.instantiate`/`compile`/`initSync`/default-init reference;
no Rust call; `encrypt`/`decrypt` unchanged; `"Allowed"`/`"Loaded"`/
`"Active"` never reached; Rust public API unchanged (27 `pub fn`); no
`Cargo.toml`/`package.json` dependency added.

## See also

- `src/runtime/fedos_wasm_loader.ts` (Stage 489–492, reached for real
  Stage 793) — the Loader Skeleton this planning layer now actually
  calls `planLoad()` on.
- `docs/runtime_crypto_loader_backend_abstraction.md` (Stage 713) —
  the Backend Abstraction this planning layer sits directly below.
- `src/runtime/fedos_wasm_backend.ts` (Stage 730, extended Stage 793) —
  the real, fixed-value implementation of this design.
- `src/runtime/fedos_crypto_loader_backend.ts` (Stage 737) — the ONLY
  caller of `createWasmBackend()`, wiring the Backend Abstraction one
  link deeper while keeping its own return value unchanged.
- `docs/runtime_internal_execution_contract.md` (updated Stage 742,
  extended Stage 806) — the diagram naming this layer's position and
  confirming no Runtime/Worker connection exists yet.
