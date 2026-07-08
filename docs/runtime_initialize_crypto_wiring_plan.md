# FedOS Runtime initializeCrypto Wiring Plan — Stage 657

**Status: this document records real code's current state — no
`import()` is implemented by this stage, no import (static or dynamic)
happens as a side effect of anything here, and both remain PROHIBITED.
Runtime/Worker connection, `create_runtime.ts`/`src/worker.ts`
modification, the generated JS glue, and `WebAssembly.instantiate`
remain PROHIBITED as well. This stage is DESIGN ONLY — no real wiring
is ever performed.**

`docs/runtime_initialize_crypto_exposure_review.md` (Stage 649) fixed
whether exposing `initializeCrypto()` has ever been reviewed and
approved. THIS document is the LAST layer before any real connection
could ever be attempted: even IF exposure were someday approved, a
Runtime connection and a Worker connection are two SEPARATE decisions,
and this Plan records whether each is currently permitted —
independently of each other, and independently of the Review's own
`approved` flag.

## 1. Why a separate Plan, not just "approved implies wireable"

`FedosInitializeCryptoExposureReview.approved` (Stage 650) answers "has
exposure been reviewed and approved," as ONE combined decision. It
does NOT answer a distinct, later question: "is a Runtime connection
currently allowed, and is a Worker connection currently allowed" — as
this arc has established repeatedly (`docs/runtime_worker_activation_boundary.md`),
Worker approval is NEVER assumed by Runtime approval, and the two must
be evaluated separately. This document keeps them separate:

| Field | Question it answers |
|---|---|
| `state` | The Wiring Plan's own coarse state. |
| `runtimeWiringAllowed` | Is a Runtime (`create_runtime.ts`) connection currently permitted? |
| `workerWiringAllowed` | Is a Worker (`src/worker.ts`) connection currently permitted? |
| `reason` | WHY neither wiring is currently permitted. |

## 2. Position in the chain — the terminus of this Planning arc

```
Runtime initializeCrypto Exposure Review
        │
        ▼
Runtime initializeCrypto Wiring Plan
        │
        ▼
STOP
```

This is a CONCEPTUAL, target-architecture position — see
`docs/runtime_internal_execution_contract.md` for the full, up-to-date
target diagram (Stage 649–661's extension) and its real-vs-positional
breakdown. The ONE real wire this stage adds continues the SAME
direction the previous stages established:
`createInitializeCryptoExposureReview()`
(`fedos_initialize_crypto_exposure_review.ts`, Stage 650) CALLS
`createInitializeCryptoWiringPlan()`, discarding the result.

`src/runtime/fedos_initialize_crypto_wiring_plan.ts` (Stage 658) is the
real, fixed-value implementation of this design's collapsed answer —
`createInitializeCryptoWiringPlan()` always resolves `{ state:
"PlanningOnly", runtimeWiringAllowed: false, workerWiringAllowed:
false, reason: "RuntimeWiringPlanPending" }`.

## 3. What this stage does NOT do

- Does **not** write `import()` of any kind, anywhere in this
  repository's source.
- Does **not** import, reference, or evaluate the generated JS glue in
  any way.
- Does **not** call `WebAssembly.instantiate`/`WebAssembly.compile`/
  `WebAssembly.instantiateStreaming`/`initSync`/the default init
  export.
- Does **not** actually wire `initializeCrypto()` into `AppRuntime` or
  `src/worker.ts` — no field, method, or property is added to either
  file by this stage.
- Does **not** modify `create_runtime.ts` or `src/worker.ts` in any
  way, not even to add a comment.
- Does **not** connect Runtime or Worker to any of this — no
  connection of any kind exists yet.
- Does **not** commit any file under `packages/fedos-core-rust/pkg/`.
- Does **not** touch Rust crypto (`encrypt`/`decrypt` stay
  `"Unsupported"`) or implement NIP-17/NIP-44/NIP-59.
- Does **not** change any Cargo/`package.json` dependency.

## See also

- `docs/runtime_initialize_crypto_exposure_review.md` (Stage 649) —
  the approval layer this Plan sits directly below.
- `src/runtime/fedos_initialize_crypto_wiring_plan.ts` (Stage
  658–659) — the real, fixed-value implementation of this design and
  its wiring from `fedos_initialize_crypto_exposure_review.ts`.
- `docs/runtime_internal_execution_contract.md` (updated Stage 661) —
  the full target-architecture diagram, from Runtime through this
  Wiring Plan, and confirming no Runtime/Worker connection exists yet.
