# Secure Runtime Alpha 569 — Failure Classification Boundary

Stage 9 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc. Review only — no code changed this Stage
beyond what Alpha 568 already added.

## The three separate vocabularies, restated, and confirmed still separate after this Arc's own changes

- **Publisher outcome** (`FedosBoardOutboxPublishOutcome`, Alpha 473,
  unchanged): `"delivered" | "rejected" | "failed"` — describes ONE
  attempt's own result, decided entirely inside the injected
  `Publisher`.
- **Retry policy** (`FedosBoardOutboxRetryPolicy`, Alpha 474,
  unchanged): `"immediate" | "later" | "never"` — the Publisher's own
  DIRECTIVE for that same one attempt, never a multi-attempt judgment.
- **Abandonment decision** (`FedosDeliveryAbandonmentDecision`, new
  this Arc, Alpha 566): `"retry" | "abandon"` — a judgment over the
  intent's WHOLE attempt HISTORY (`completedAttempts`), computed by a
  boundary that never sees a single attempt's own raw result, only the
  aggregated `latestOutcome` and a count.

## Confirmed: no mixing was introduced

`FedosDeliveryAbandonmentPolicyInput` carries exactly THREE fields —
`outboxId`, `completedAttempts`, `latestOutcome` — and `latestOutcome`
is typed `FedosBoardOutboxPublishOutcome`, the SAME three-value
Publisher vocabulary, never a free-form string, error object, or Relay
message. `evaluate()` is synchronous and pure (Alpha 566's own
guardrail); nothing in `fedos_board_outbox_abandonment_policy.ts`
imports `Error`, a stack trace, or any Relay/NOTICE-shaped type. Alpha
576's own structural guard test (#8) checks this by regex
(`NOTICE|stack|\.message`) against the policy file's own source, not
merely by design intent.

## Relay-text-as-policy-input — confirmed absent, one layer further down too

`FedosPublishScheduler` itself never sees raw Relay/wire text at all —
that boundary is `FedosNostrBoardPublisherAdapter`'s own job (Alpha
496, unchanged), which already translates a Relay-specific result into
the generic `FedosBoardOutboxPublishResult` BEFORE the Scheduler (or,
now, the abandonment policy) ever sees it. This Arc adds no new
listener on that boundary.

## See also

- `docs/secure_runtime_alpha_566_abandonment_policy_decision.md`
- `docs/secure_runtime_alpha_568_abandonment_enforcement.md`
- `docs/secure_runtime_alpha_576_structural_guards.md`
