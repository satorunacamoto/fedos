# FedOS Runtime initializeCrypto Exposure Review — Stage 649

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, `create_runtime.ts`/`src/worker.ts`
modification, the generated JS glue, and `WebAssembly.instantiate`
remain PROHIBITED as well. This stage is DESIGN ONLY — no real
exposure or approval is ever granted.**

`docs/runtime_crypto_initialization_result.md` (Stage 641) fixed what
a completed `initializeCrypto()` call would report back. THIS document
is the FIRST layer that looks OUTWARD, toward Runtime, rather than
downward into the parked chain: before `initializeCrypto()` could ever
be exposed on `AppRuntime` at all, a dedicated REVIEW must record
whether exposing it is even under consideration, and whether that
exposure has been approved — both independent of everything the
parked chain has built so far, which only concerns what happens
BELOW the Facade, never whether Runtime should ever see it.

## 1. Why a separate Review, not just "result contract ready implies exposable"

`FedosCryptoInitializationResult` (Stage 642) answers what a call
would report. It does NOT answer a distinct, later, Runtime-facing
question: "should `initializeCrypto()` ever be reachable from
`AppRuntime` at all, and has that decision been reviewed and
approved." A fully-specified, internally-consistent call/result
contract could exist for years without anyone ever approving its
exposure to Runtime — these are independent axes. This document keeps
them separate:

| Field | Question it answers |
|---|---|
| `state` | The Review's own coarse state. |
| `exposed` | Is `initializeCrypto()` currently exposed on `AppRuntime` in any way? |
| `approved` | Has exposing it ever been reviewed and approved? |
| `reason` | WHY it is not currently exposed. |

`exposed` and `approved` are kept separate for the same reason
`requested`/`allowed` were kept separate in
`docs/runtime_crypto_provider_initialization_request.md` (Stage 609)
§2 — approval could, in principle, precede actual exposure by a
separate implementation stage, and collapsing the two would hide that
distinction.

## 2. Position in the chain

```
Crypto Initialization Result Contract
        │
        ▼
Runtime initializeCrypto Exposure Review
        │
        ▼
Runtime initializeCrypto Wiring Plan
```

This is a CONCEPTUAL, target-architecture position — see
`docs/runtime_internal_execution_contract.md` for the exact,
up-to-date real-vs-positional breakdown. The ONE real wire this stage
adds continues the SAME direction the previous two stages established:
`createCryptoInitializationResult()`
(`fedos_crypto_initialization_result.ts`, Stage 642) CALLS
`createInitializeCryptoExposureReview()`, discarding the result.

`src/runtime/fedos_initialize_crypto_exposure_review.ts` (Stage 650)
is the real, fixed-value implementation of this design's collapsed
answer — `createInitializeCryptoExposureReview()` always resolves `{
state: "PlanningOnly", exposed: false, approved: false, reason:
"RuntimeExposureReviewPending" }`.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** actually expose `initializeCrypto()` on `AppRuntime` or
  anywhere else — no field, method, or property is added to
  `create_runtime.ts` by this stage.
- Does **not** modify `create_runtime.ts` or `src/worker.ts` in any
  way, not even to add a comment.
- Does **not** connect Runtime or Worker to any of this — no
  connection of any kind exists yet.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-44/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_crypto_initialization_result.md` (Stage 641) — the
  result contract this Review sits directly below.
- `src/runtime/fedos_initialize_crypto_exposure_review.ts` (Stage
  650–651) — the real, fixed-value implementation of this design and
  its wiring from `fedos_crypto_initialization_result.ts`.
- `docs/runtime_initialize_crypto_wiring_plan.md` (Stage 657) — the
  next, deeper layer: what an approved exposure would still need
  before Runtime or Worker could ever actually be wired.
- `docs/runtime_internal_execution_contract.md` (updated Stage 661) —
  the diagram naming this Review's position, and confirming no
  Runtime/Worker connection exists yet.
