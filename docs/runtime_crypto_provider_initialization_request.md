# FedOS Crypto Provider Initialization Request Planning — Stage 609

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, the generated JS glue, and
`WebAssembly.instantiate` remain PROHIBITED as well. This stage is
DESIGN ONLY — no real request is ever issued.**

`docs/runtime_crypto_provider_facade_boundary.md` (Stage 601) fixed
the seam BETWEEN a Provider and the Facade — whether the two sides
have ever been connected. THIS document goes one level ABOVE that
seam, on the Provider's own side: what would a Provider actually HAND
to the Boundary once connected? This is PROVIDER-SIDE PLANNING for
that future request — never issued, never sent, never routed anywhere
by this stage's code.

## 1. The target position, one level above the Boundary

```
Crypto Provider
        │
        ▼
Provider Initialization Request
        │
        ▼
Provider/Facade Boundary
        │
        ▼
Crypto Loader Facade
        │
        ▼
STOP
```

This is a CONCEPTUAL, target-architecture diagram — same discipline as
`docs/runtime_crypto_loader_facade.md` §1. A future
`FedosRuntimeCryptoProvider` implementation would eventually construct
a Provider Initialization Request and hand it to the Provider/Facade
Boundary, which would forward it to the Facade's `initializeCrypto()`.
No code in this stage does any of that — the ONE real wire this stage
adds runs the OPPOSITE direction, deeper into the already-parked
chain: `FedosCryptoProviderFacadeBoundary.createCryptoProviderFacadeBoundary()`
(`fedos_crypto_provider_facade_boundary.ts`, Stage 602) CALLS
`createCryptoProviderInitializationRequest()`, discarding the result —
see `docs/runtime_internal_execution_contract.md` for the exact,
up-to-date real-vs-positional breakdown.

## 2. What a request would need to carry, and why none of it exists yet

| Field | Question it answers |
|---|---|
| `state` | The request's own coarse planning state. |
| `requested` | Has a Provider ever actually constructed and issued a request? |
| `allowed` | Would the Boundary currently accept such a request if one were issued? |
| `reason` | WHY a request is not currently allowed. |

`requested` and `allowed` are kept SEPARATE deliberately: a Provider
could, in principle, construct a request object (`requested: true`)
that the Boundary still refuses (`allowed: false`) because
`providerConnected`/`facadeConnected` are not both `true` yet
(`docs/runtime_crypto_provider_facade_boundary.md` §1). Collapsing the
two into one flag would hide that distinction. In THIS stage, no
Provider ever constructs a request at all, so both stay `false`
together — but the fields exist separately so a future stage can move
one without silently implying the other.

`src/runtime/fedos_crypto_provider_initialization_request.ts` (Stage
610) is the real, fixed-value implementation of this design's
collapsed answer — `createCryptoProviderInitializationRequest()`
always resolves `{ state: "PlanningOnly", requested: false, allowed:
false, reason: "ProviderInitializationRequestPending" }`.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** actually construct or issue a request from
  `FedosRuntimeCryptoProvider` (or any other provider implementation)
  — that rewiring, if it ever happens, is a future, separate,
  explicitly-reviewed stage's decision.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this — no Runtime or Worker connection
  of any kind exists yet.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_crypto_provider_facade_boundary.md` (Stage 601) — the
  seam this planned request would eventually be handed to.
- `src/runtime/fedos_crypto_provider_initialization_request.ts` (Stage
  610–611) — the real, fixed-value implementation of this design and
  its wiring from `fedos_crypto_provider_facade_boundary.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 613) —
  the diagram naming this request's position both in the target
  architecture (above the Boundary) and in the parked implementation
  chain (below the Boundary), and confirming no Runtime/Worker
  connection exists yet.
