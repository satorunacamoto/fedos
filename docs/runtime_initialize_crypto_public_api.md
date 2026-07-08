# FedOS Runtime initializeCrypto Public API — Stage 665

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, `create_runtime.ts`/`src/worker.ts`
modification, the generated JS glue, and `WebAssembly.instantiate`
remain PROHIBITED as well. This stage is DESIGN ONLY — no real public
API is ever exposed.**

`docs/runtime_initialize_crypto_wiring_plan.md` (Stage 657) fixed
whether a Runtime connection and a Worker connection are each
independently permitted. THIS document goes one level deeper still:
even IF Runtime wiring were someday permitted, the SHAPE of what
Runtime would actually expose to its own callers — a public API
surface, not the internal Facade/Boundary/Contract machinery — is a
SEPARATE design question, answered here without exposing anything.

## 1. Why a separate Public API design, not just "wiring allowed implies visible"

`FedosInitializeCryptoWiringPlan.runtimeWiringAllowed` (Stage 658)
answers "is a Runtime connection currently permitted." It does NOT
answer a distinct, later question: "is `initializeCrypto()` actually
VISIBLE on `AppRuntime` as a public API member, and is it CALLABLE
from that public surface." Permission to wire and actual visibility on
a public surface are different axes — wiring could be permitted in
principle while the public API shape itself remains undesigned. This
document keeps them separate:

| Field | Question it answers |
|---|---|
| `state` | The Public API design's own coarse state. |
| `apiVisible` | Is `initializeCrypto()` currently visible as a public member on `AppRuntime`? |
| `callable` | Is that public-facing member currently callable? |
| `reason` | WHY it is not currently visible. |

`apiVisible` and `callable` are kept separate for the same reason
`FedosInitializeCryptoApiContract.callable`/`.initialized` (Stage 634)
were kept separate one level below the Facade — a member could, in
principle, be visible (present on the type) before it is ever made
callable, and collapsing the two would hide that distinction. This
`callable` field is DISTINCT from `FedosInitializeCryptoApiContract.callable`
(Stage 634) — that one answers whether the INTERNAL Facade-level
`initializeCrypto()` is callable; this one answers whether the
PUBLIC-FACING `AppRuntime` member is callable. Both are permanently
`false` in this stage; nothing conflates them at runtime, and
`runtime_crypto_diagnostics.ts`/`worker_crypto_diagnostics.ts` (Stage
668) expose this file's own answer under the distinct name
`initializeCryptoPublicApiCallable`, never overwriting the existing
`initializeCryptoCallable` field Stage 636 already established.

## 2. Position in the chain

```
Runtime initializeCrypto Wiring Plan
        │
        ▼
Runtime initializeCrypto Public API
        │
        ▼
Runtime initializeCrypto Invocation Contract
```

This is a CONCEPTUAL, target-architecture position — see
`docs/runtime_internal_execution_contract.md` for the exact,
up-to-date real-vs-positional breakdown. The ONE real wire this stage
adds continues the SAME direction the previous two stages established:
`createInitializeCryptoWiringPlan()`
(`fedos_initialize_crypto_wiring_plan.ts`, Stage 658) CALLS
`createInitializeCryptoPublicApi()`, discarding the result.

`src/runtime/fedos_initialize_crypto_public_api.ts` (Stage 666) is the
real, fixed-value implementation of this design's collapsed answer —
`createInitializeCryptoPublicApi()` always resolves `{ state:
"PlanningOnly", apiVisible: false, callable: false, reason:
"PublicApiPending" }`.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** actually add `initializeCrypto()` (or any member) to
  `AppRuntime` — no field, method, or property is added to
  `create_runtime.ts` by this stage.
- Does **not** expose anything to Worker — Worker exposure remains a
  categorically separate, unaddressed question
  (`docs/runtime_initialize_crypto_wiring_plan.md` §1
  `workerWiringAllowed`).
- Does **not** modify `create_runtime.ts` or `src/worker.ts` in any
  way, not even to add a comment.
- Does **not** connect Runtime or Worker to any of this — no
  connection of any kind exists yet.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-44/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_initialize_crypto_wiring_plan.md` (Stage 657) — the
  wiring-permission layer this Public API design sits directly below.
- `src/runtime/fedos_initialize_crypto_public_api.ts` (Stage 666–667)
  — the real, fixed-value implementation of this design and its
  wiring from `fedos_initialize_crypto_wiring_plan.ts`.
- `docs/runtime_initialize_crypto_invocation_contract.md` (Stage 673)
  — the next, deeper layer: what actually invoking this public-facing
  member would require.
- `docs/runtime_internal_execution_contract.md` (updated Stage 677) —
  the diagram naming this design's position, and confirming no
  Runtime/Worker connection exists yet.
