# FedOS Crypto Provider / Facade Boundary — Stage 601

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, the generated JS glue, and
`WebAssembly.instantiate` remain PROHIBITED as well. This stage is
DESIGN ONLY — no real connection of any kind is implemented.**

`docs/runtime_crypto_loader_facade.md` (Stage 593) named the Facade as
the ONE seam Provider code would eventually call through. THIS
document fixes what sits exactly AT that seam — a dedicated BOUNDARY
object recording whether the Provider side and the Facade side have
ever actually been connected, kept deliberately separate from the
Facade's own `state`/`initialized` so that "Provider knows how to
reach the Facade" and "the Facade itself is ready" can be reasoned
about, and reviewed, independently.

## 1. Why a separate Boundary, not just the Facade's own state

`FedosCryptoLoaderFacade.state`/`.initialized` (Stage 594) answer
"is the Facade itself operational." They do NOT answer a distinct,
earlier question: "does ANY `RuntimeCryptoProvider` implementation
currently hold a reference to the Facade at all." Collapsing both
questions into one field would hide a real failure mode — a
correctly-implemented, ready Facade that no Provider has ever been
wired to would look identical, in a single boolean, to a Facade that
is not ready yet. This document keeps them separate:

| Field | Question it answers |
|---|---|
| `providerConnected` | Does any `RuntimeCryptoProvider` implementation hold a reference to this Boundary? |
| `facadeConnected` | Does this Boundary hold a reference to `FedosCryptoLoaderFacade`? |
| `state` | The Boundary's own coarse connection state, derived from the two flags above. |
| `reason` | WHY the Boundary is not yet fully connected. |

## 2. The Facade's responsibility this Boundary enforces

`docs/runtime_crypto_loader_facade.md` §2 responsibilities #1/#2
("Runtime sees only the Facade"/"Provider sees only the Facade") name
a RULE without a place to record whether it is currently satisfied.
This Boundary is that place: as long as `providerConnected` is
`false`, NO `RuntimeCryptoProvider` implementation has actually been
wired to call through the Facade, regardless of whether the Facade
itself is ready — and as long as `facadeConnected` is `false`, the
Boundary itself has nothing to forward to even if a Provider called
it. Both must be `true` simultaneously before the Boundary's own
`state` could ever report anything other than `"PlanningOnly"`.

`src/runtime/fedos_crypto_provider_facade_boundary.ts` (Stage 602) is
the real, fixed-value implementation of this design's collapsed
answer — `createCryptoProviderFacadeBoundary()` always resolves `{
state: "PlanningOnly", providerConnected: false, facadeConnected:
false, reason: "ProviderFacadeConnectionPending" }`.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** actually connect `FedosRuntimeCryptoProvider` (or any
  other provider implementation) to `fedos_crypto_loader_facade.ts` —
  that rewiring, if it ever happens, is a future, separate,
  explicitly-reviewed stage's decision.
- Does **not** connect Runtime (`create_runtime.ts`) or Worker
  (`src/worker.ts`) to any of this — no Runtime or Worker connection
  of any kind exists yet.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_crypto_loader_facade.md` (Stage 593) — the Facade this
  Boundary sits directly below, and the two responsibilities
  (`providerConnected`/`facadeConnected`) this document tracks.
- `src/runtime/fedos_crypto_provider_facade_boundary.ts` (Stage
  602–603) — the real, fixed-value implementation of this design and
  its wiring from `fedos_crypto_loader_facade.ts`.
- `docs/runtime_crypto_provider_initialization_request.md` (Stage 609)
  — the next, deeper layer: what a Provider would eventually hand to
  this Boundary.
- `docs/runtime_internal_execution_contract.md` (updated Stage 605) —
  the diagram naming the Boundary's position between Crypto Loader
  Facade and the still-positional Dynamic Import box, and confirming
  no Runtime/Worker connection exists yet.
