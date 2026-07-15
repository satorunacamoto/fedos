# Secure Runtime Alpha 515 — Multi-Intent Consistency Verification

Stage 15 of the Alpha 501–520 Durable Delivery Observation Wiring &
Host Delivery Lifecycle Arc. Verification only.

## What is verified

One delivery cycle processing TWO independent Outbox intents at once —
one whose Publisher attempt succeeds, one whose fails — proves per-
subject isolation: `Host.observationQuery().historyFor(subjectA)` and
`historyFor(subjectB)` never cross-contaminate, `currentStateFor()`
agrees with each subject's own `historyFor()` independently, and
`deliveryStatus()` reflects only the LOOP's own running/not-running
state (never a per-intent outcome — this Arc's own scope names no
per-intent status accessor beyond `observationQuery()`).

## See also

- `docs/secure_runtime_alpha_513_full_pipeline_flow_verification.md`
- `docs/secure_runtime_alpha_514_failure_path_verification.md`
