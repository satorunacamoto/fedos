# Secure Runtime Alpha 729 — Abandonment Interaction

Stage 9.

## Clarifications

- **`rejected` is already terminal, not "abandoned."** `FedosPublishScheduler.#attemptIntent()`
  adds an intent to `#abandoned` only via its own `abandonedByPublisher`
  (`result.retryPolicy === "never"`) or `abandonedByPolicy` branches
  (unchanged) — a `"rejected"` result's own `retryPolicy: "never"`
  triggers `abandonedByPublisher`, so it DOES join the internal
  `#abandoned` set (preventing future scheduling), but the OBSERVATION
  kind recorded for it is `"rejected"`, never `"abandoned"` — the two are
  related (both stop future attempts) but semantically distinct records:
  `"rejected"` names WHY (a real counterparty refusal), `"abandoned"`
  would name a policy decision after repeated transient failures.
- **Failed attempts may eventually become auto-abandoned by policy.**
  Unchanged — `FedosDeliveryAbandonmentPolicy.evaluate()` (existing,
  untouched) still governs this for `"failed"` outcomes only.
- **Accepted/rejected do not consume future retry attempts.** Both are
  added to a terminal set (`#delivered` for accepted, `#abandoned` for
  rejected) the very first time they occur — `FedosPublishScheduler.#runTick()`
  filters both sets out of `pending` on every subsequent tick.
- **Manual override/resume remains out of scope.** No method to
  "un-reject" or manually resume a terminal intent was added — matches
  the task's own explicit exclusion.

No `abandoned` Delivery Observation was added merely for this Arc — the
existing `"rejected"` Observation kind is the correct, sufficient
terminal record for a genuine Relay rejection.
