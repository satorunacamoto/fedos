# FedOS Crypto Loader Facade — Stage 593

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, the generated JS glue, and
`WebAssembly.instantiate` remain PROHIBITED as well. This stage is
DESIGN ONLY — no real load of any kind is implemented.**

Every prior stage in this arc named WHETHER (`docs/runtime_dynamic_loader_gate.md`),
UNDER WHAT CONDITIONS (`docs/runtime_dynamic_loader_dev_approval.md`),
and WHEN (`docs/runtime_explicit_crypto_initialization.md`) a load of
the generated JS glue could ever happen. THIS document names WHERE, in
the call graph, that eventual load would be reached FROM — a single,
narrow seam separating "things that ask for crypto" from "things that
know how crypto gets loaded."

## 1. The intended shape

```
Crypto Runtime
        │
        ▼
Crypto Provider
        │
        ▼
Crypto Loader Facade
        │
        ▼
WASM Loader
        │
        ▼
Rust
```

This is a CONCEPTUAL, target-architecture diagram — it names where each
box would eventually sit relative to the others, not a claim that every
arrow is a real function call today. The one arrow this stage's code
actually implements is Explicit Crypto Initialization → Crypto Loader
Facade (`src/runtime/fedos_explicit_crypto_initialization.ts`, Stage
595) — see `docs/runtime_internal_execution_contract.md` for the exact,
up-to-date real-vs-positional breakdown.

## 2. The Facade's responsibilities

| # | Responsibility | Meaning |
|---|---|---|
| 1 | **Runtime sees only the Facade** | Whatever Runtime-side code eventually requests crypto never reasons about `FedosWasmLoader`/`FedosWasmLoaderPlan`/the generated JS glue/Rust directly — it calls the Facade, and only the Facade. |
| 2 | **Provider sees only the Facade** | `FedosRuntimeCryptoProvider` (or any future provider implementation) never imports or reasons about the WASM Loader, `WebAssembly.instantiate`, or Rust directly either — the Facade is its ONLY door into the loading machinery. |
| 3 | **WASM Loader is never known directly** | Neither Runtime nor Provider ever import `fedos_wasm_loader.ts`/`fedos_wasm_loader_plan.ts` — only the Facade may. |
| 4 | **Rust is never known directly** | Neither Runtime nor Provider ever import `packages/fedos-core-rust` in any form — only the chain below the Facade may eventually reach it. |
| 5 | **Backend is swappable in the future** | The Facade's `backend` field names WHICH loading strategy is currently designated (`"WasmPlanned"` today) without hard-coding WASM as the only possible answer — a future Native/Mobile backend could replace it without Runtime or Provider code changing, because neither ever saw the backend directly in the first place. |
| 6 | **Fail Closed is maintained** | Every Facade operation denies by default. `createCryptoLoaderFacade()` always resolves `initialized: false`; `initializeCrypto()` always resolves `{ allowed: false, reason: "FacadeInitializationPending" }`. Nothing in this stage's code can flip either answer. |

## 3. Why a Facade, and why now

Every layer below this one (`FedosRustBoundary`, `FedosRustApi`,
`FedosRustExecutionReview`, `FedosInternalRustCall`,
`FedosRustInvocationAdapter`, `FedosExecutionBackend`,
`FedosWasmBoundary`, `FedosWasmArtifact`, `FedosWasmLoader`,
`FedosWasmLoaderPlan`, and the entire Dynamic Loader/Explicit
Initialization arc) grew one link at a time, each one reachable only
from the link immediately above it. That depth is valuable for
review, but it is NOT the shape Runtime or Provider code should ever
see directly — a caller asking "give me crypto" should not need to
know whether the answer eventually comes from WASM, a native addon, or
a mobile bridge. The Facade is the single, narrow seam that makes that
true: everything above it talks to ONE interface; everything below it
is free to change shape (Stage 593 responsibility #5) without touching
Runtime or Provider code, precisely because neither ever imported
anything below the Facade to begin with.

`src/runtime/fedos_crypto_loader_facade.ts` (Stage 594) is the real,
fixed-value implementation of this design's collapsed answer —
`createCryptoLoaderFacade()` always resolves `{ state: "PlanningOnly",
initialized: false, backend: "WasmPlanned", reason:
"FacadeInitializationPending" }`, and `initializeCrypto()` always
resolves `{ allowed: false, reason: "FacadeInitializationPending" }`.

## 4. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** write the static `import` statement named by
  `docs/runtime_wasm_static_import_plan.md`.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** actually route `FedosRuntimeCryptoProvider` or any
  other provider through this Facade — that rewiring, if it ever
  happens, is a future, separate, explicitly-reviewed stage's
  decision.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this — no Runtime or Worker connection
  of any kind exists yet.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_explicit_crypto_initialization.md` (Stage 585) — the
  six permanent rules for WHEN a load may ever happen; the Facade is
  what that document's rule #5 ("everything routes through
  Loader/Backend") names as the target of that routing.
- `src/runtime/fedos_crypto_loader_facade.ts` (Stage 594–595) — the
  real, fixed-value implementation of this design and its wiring from
  `fedos_explicit_crypto_initialization.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 597) —
  the diagram naming the Facade's position in both the parked
  Dynamic-Loader arc and the target Runtime→Rust architecture, and
  confirming no Runtime/Worker connection exists yet.
