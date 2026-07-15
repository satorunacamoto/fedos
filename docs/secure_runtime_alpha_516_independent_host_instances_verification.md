# Secure Runtime Alpha 516 — Independent Host Instances Verification

Stage 16 of the Alpha 501–520 Durable Delivery Observation Wiring &
Host Delivery Lifecycle Arc. Verification only.

## What is verified

Two independently-constructed `FedosDesktopHost` instances — each with
its OWN `outboxPersistence`/`publisher`/`observationRepository` (the
default, zero-override construction path, Alpha 503) — never share
state: an intent submitted and delivered on Host A is invisible to Host
B's own `observationQuery()`, and starting delivery on one instance
never affects the other's own `deliveryStatus()`. Mirrors
`test/secure_runtime_alpha_400...test.ts`'s own pre-existing
independent-instance discipline for `boardPersistence`, extended here
to the three new Alpha 502 dependencies.

## See also

- `docs/secure_runtime_alpha_515_multi_intent_consistency_verification.md`
- `docs/secure_runtime_alpha_503_default_publisher_and_observation_repository_decision.md`
