# Secure Runtime Alpha 527 — Retry Registry Implementation

Stage 7 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

**Status: this Stage IMPLEMENTS.** One new file:
`src/board/observation/fedos_delivery_retry_registry.ts`.

## What was implemented

`FedosDeliveryRetryRegistry` — `nextAttemptNumber(subjectId)` (starts
at 1, increments by exactly 1 per call for the same subject) and
`currentAttemptCount(subjectId)` (a pure read, `0` if none allocated
yet). Plain in-memory `Map`, independent instances never share state.
See the file's own header for why this is a WRITE-time-only concern
never exposed via `FedosDesktopHost`.

## See also

- `docs/secure_runtime_alpha_522_retry_coordination_scope_decision.md`
