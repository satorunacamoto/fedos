# Secure Runtime Alpha 534 — Case Verification: Failed → Retry → Accepted

Stage 14 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

**Status: this Stage VERIFIES only.** Second of the three named
Verification case groups from the Alpha 521–540 spec. This Stage
covers **failed → retry → accepted**: one attempt fails, the SAME
intent is retried, the retry succeeds.

## 1. What is being verified

This is the EXACT scenario the spec calls out by name as the concrete
motivation for the whole Arc ("現在の invalid-transition を解消する"):
before Alpha 521–540, a second `publishing` observation for the same
subject after a `failed` terminal observation was rejected by the
Alpha 495 validator as `invalid-transition`, because
`isAllowedFedosDeliveryObservationTransition` (Alpha 494, unchanged)
never permitted `failed → publishing` on ONE subject. Attempt-scoped
subject identity (Alpha 525) sidesteps this entirely: attempt 1's
subject reaches `failed` and STAYS closed; attempt 2 gets its OWN
fresh subject, for which `queued/unset → publishing` is the FIRST
transition, always allowed.

## 2. Two levels of evidence

1. **Deterministic (unit) evidence**: `docs/secure_runtime_alpha_529_controller_retry_rewiring.md`'s
   own second scenario proves this exactly, with an injected clock —
   `attemptNumber: 1, state: "failed", isFinal: false` followed by
   `attemptNumber: 2, state: "accepted", isFinal: true`, zero
   `invalid-transition` errors thrown anywhere.
2. **Real-pipeline (behavioral) evidence**, added by THIS Stage's own
   test: the full `FedosDesktopHost`, a Publisher that fails exactly
   once then always succeeds, real interval timer, real wall clock.
   Exactly two attempts are recorded, attempt numbers `[1, 2]` in
   order, attempt 1 never `accepted`, attempt 2 never `failed`.

## 3. See also

- `docs/secure_runtime_alpha_529_controller_retry_rewiring.md`
- `docs/secure_runtime_alpha_533_case_verification_single_success.md`
- `docs/secure_runtime_alpha_535_case_verification_longer_retry_chain.md`
