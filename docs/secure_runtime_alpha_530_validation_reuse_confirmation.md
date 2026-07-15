# Secure Runtime Alpha 530 — Validation Reuse Confirmation

Stage 10 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.
Verification only.

## What is confirmed

`isAllowedFedosDeliveryObservationTransition` (Alpha 494) and
`FedosValidatingDeliveryObservationRepository` (Alpha 495) are
byte-for-byte UNCHANGED — `git diff --stat` for both files is empty
for this entire Arc. Alpha 529's own test suite already proves, by
REAL execution against the REAL unchanged validator, that:

- A single successful delivery records ONE attempt, terminal, final.
- A fail-then-retry-then-succeed chain records TWO attempts, neither
  rejected as `"invalid-transition"` — the exact collision Alpha 514
  demonstrated is GONE.
- A three-failure-then-success chain records FOUR attempts, in order,
  none rejected.
- A permanently-abandoned intent records exactly ONE final, terminal
  attempt, never re-attempted.

Every one of these passes through the SAME, unmodified
`validateFedosDeliveryObservationTransition`/`FedosValidatingDeliveryObservationRepository.record()`
call path — the fix lives entirely in WHICH subject id each write
targets (Alpha 525/529), never in what the validator itself permits.

## What remains correctly REJECTED (the validator's own job, unchanged)

Within ONE attempt's own scope, every prior guarantee still holds
exactly: `accepted → publishing` still `"invalid-transition"`,
`rejected → accepted` still `"invalid-transition"`, a stale terminal
observation is still `"stale"` — none of this Arc's own new code ever
bypasses the validator; it only ever calls it with correctly-scoped
subject ids.

## See also

- `docs/secure_runtime_alpha_529_controller_retry_rewiring.md`
- `docs/secure_runtime_alpha_495_observation_write_validator.md`
- `docs/secure_runtime_alpha_514_failure_path_verification.md`
