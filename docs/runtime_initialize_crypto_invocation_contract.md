# FedOS Runtime initializeCrypto Invocation Contract — Stage 673

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, `create_runtime.ts`/`src/worker.ts`
modification, the generated JS glue, and `WebAssembly.instantiate`
remain PROHIBITED as well. This stage is DESIGN ONLY — no real
invocation is ever attempted or completed.**

`docs/runtime_initialize_crypto_public_api.md` (Stage 665) fixed
whether `initializeCrypto()` is visible and callable as a public
member on `AppRuntime`. THIS document is the LAST layer in this arc:
even IF that public member were someday visible and callable, an
actual INVOCATION — a real caller actually invoking it — is a further,
separate event, and this Contract records whether such an invocation
is currently permitted, and whether one has ever actually completed.

## 1. Why a separate Invocation Contract, not just "callable implies invoked"

`FedosInitializeCryptoPublicApi.callable` (Stage 666) answers "is the
public-facing member currently callable," a STRUCTURAL property of the
API surface. It does NOT answer a distinct, later, EVENT-level
question: "has a caller ever actually invoked it, and did that
invocation complete." A member can be callable for a long time before
anyone ever calls it — these are independent axes, mirroring the
same "structural vs. event" distinction
`docs/runtime_crypto_provider_initialization_request.md` (Stage 609)
§2 drew between `requested` and `allowed`. This document keeps them
separate:

| Field | Question it answers |
|---|---|
| `state` | The Invocation Contract's own coarse state. |
| `invocationAllowed` | Is an actual invocation currently permitted? |
| `completed` | Has an invocation ever actually completed? |
| `reason` | WHY an invocation is not currently allowed. |

## 2. Position in the chain — the terminus of this Public API arc

```
Runtime initializeCrypto Public API
        │
        ▼
Runtime initializeCrypto Invocation Contract
        │
        ▼
STOP
```

This is a CONCEPTUAL, target-architecture position — see
`docs/runtime_internal_execution_contract.md` for the full, up-to-date
target diagram (Stage 665–677's extension) and its real-vs-positional
breakdown. The ONE real wire this stage adds continues the SAME
direction the previous stages established:
`createInitializeCryptoPublicApi()`
(`fedos_initialize_crypto_public_api.ts`, Stage 666) CALLS
`createInitializeCryptoInvocationContract()`, discarding the result.

`src/runtime/fedos_initialize_crypto_invocation_contract.ts` (Stage
674) is the real, fixed-value implementation of this design's
collapsed answer — `createInitializeCryptoInvocationContract()`
always resolves `{ state: "PlanningOnly", invocationAllowed: false,
completed: false, reason: "InvocationContractPending" }`.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** actually invoke `initializeCrypto()` from any caller —
  no invocation of any kind is ever attempted or completed by this
  file.
- Does **not** modify `create_runtime.ts` or `src/worker.ts` in any
  way, not even to add a comment.
- Does **not** connect Runtime or Worker to any of this — no
  connection of any kind exists yet.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-44/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_initialize_crypto_public_api.md` (Stage 665) — the
  visibility/callability layer this Contract sits directly below.
- `src/runtime/fedos_initialize_crypto_invocation_contract.ts` (Stage
  674–675) — the real, fixed-value implementation of this design and
  its wiring from `fedos_initialize_crypto_public_api.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 677) —
  the full target-architecture diagram, from Runtime through this
  Invocation Contract, and confirming no Runtime/Worker connection
  exists yet.
