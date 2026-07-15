# Secure Runtime Alpha 535 — Case Verification: Longer Retry Chain

Stage 15 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

**Status: this Stage VERIFIES only.** Third of the three named
Verification case groups from the Alpha 521–540 spec — the multi-retry
chain the spec lists as `retry / failed / retry / retry / accepted`:
several retries occur, one of them still failing, before the delivery
finally succeeds. This Stage interprets that list as: three consecutive
failed attempts (each individually retried), then a fourth, final,
successful attempt — the SAME multi-attempt shape as Alpha 529's own
third scenario, verified here again through the FULL real pipeline
rather than the Controller in isolation.

## 1. What is being verified

That attempt-scoped subject identity (Alpha 525) scales past a SINGLE
retry to an ARBITRARY chain length — nothing in the design (Alpha 527's
monotonically-incrementing counter, Alpha 528's unbounded `for`-loop
scan) assumes a maximum retry count. Every attempt in the chain gets
its own subject, its own transition-graph walk starting fresh from
"first write", and NONE of the earlier, now-closed attempt subjects are
ever touched again.

## 2. Two levels of evidence

1. **Deterministic (unit) evidence**: `docs/secure_runtime_alpha_529_controller_retry_rewiring.md`'s
   own third scenario (three failures, then success, four attempts
   total) proves this exactly, with an injected clock —
   `attemptNumber` sequence `[1, 2, 3, 4]`, state sequence
   `["failed", "failed", "failed", "accepted"]`, `isFinal` sequence
   `[false, false, false, true]`.
2. **Real-pipeline (behavioral) evidence**, added by THIS Stage's own
   test: the full `FedosDesktopHost`, a Publisher that fails exactly
   three times then always succeeds, real interval timer, real wall
   clock, run long enough for at least four delivery ticks. Attempt
   numbers strictly increase `1, 2, 3, ...` with no gaps and no
   repeats; only the LAST attempt is ever final; only the FIRST three
   are ever recorded as failed (never accepted before the fourth).

## 3. See also

- `docs/secure_runtime_alpha_529_controller_retry_rewiring.md`
- `docs/secure_runtime_alpha_534_case_verification_failure_then_retry_then_success.md`
- `docs/secure_runtime_alpha_536_full_pipeline_verification.md`
