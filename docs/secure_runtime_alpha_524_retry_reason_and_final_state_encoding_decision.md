# Secure Runtime Alpha 524 — Retry Reason and Final State Encoding Decision

Stage 4 of the Alpha 521–540 Durable Delivery Retry Coordination Arc.

## 1. Decision: encode into the EXISTING `reason?: string` field, never a new field

Every terminal (`accepted`/`rejected`/`failed`) `FedosDeliveryObservation`
this Arc's own rewired controller writes now ALWAYS supplies a
`reason` string — `"final"` or `"final:<detail>"` when no further
attempt will occur, `"retry"` or `"retry:<detail>"` otherwise —
decoded by `decodeFedosDeliveryRetryReason`. A `"publishing"`
observation's own `reason` remains `undefined`, exactly as before this
Arc — finality/retry-reason is a TERMINAL-only concept.

## 2. Why finality is derived from the Scheduler's OWN unchanged `"abandoned"` signal, not re-decided here

`"delivered"` is always final (success). Otherwise, an attempt is final
if and only if `FedosPublishScheduler#attemptIntent()`'s own unchanged
body appended an `"abandoned"` observation immediately after — which it
already only does when the FINAL merged `retryPolicy` is `"never"`
(Alpha 476, unchanged). This Arc does not re-derive or second-guess
that judgment anywhere — it reads an ALREADY-COMPUTED fact.

## 3. Fail-closed decoding

`decodeFedosDeliveryRetryReason(reason)` on an unrecognized/malformed
string (e.g. hand-written test data, or a future format this Arc did
not anticipate) returns `{ isFinal: false, detail: reason }` — the
CONSERVATIVE reading: assume a retry might still happen rather than
wrongly declare an intent permanently finished. `reason === undefined`
(the pre-Alpha-521 shape, e.g. any Observation recorded before this Arc
landed) decodes to `{ isFinal: false, detail: null }` for the same
reason.

## 4. Options rejected

- **A separate `FedosDeliveryAttemptOutcomeStore` keyed by attempt
  subject id.** Rejected — duplicates state the Repository's own
  `reason` field can already carry; a second store risks drifting out
  of sync with the Repository's own real, validated write path.
- **Prefixing `reason` unconditionally, even when the caller supplies
  no detail.** Adopted in a NARROWER form — the marker alone
  (`"final"`/`"retry"`) when there is no detail, never a trailing empty
  `:` or synthetic placeholder text.

## 5. See also

- `docs/secure_runtime_alpha_522_retry_coordination_scope_decision.md`
- `docs/secure_runtime_alpha_462_delivery_observation_state_model.md`
