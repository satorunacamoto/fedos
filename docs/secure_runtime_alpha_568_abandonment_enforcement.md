# Secure Runtime Alpha 568 — Abandonment Enforcement

Stage 8 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## What changed, exactly

`src/board/outbox/fedos_publish_scheduler.ts`:

- One new private field: `#completedAttempts = new Map<string, number>()`,
  tracking, per pending `outboxId`, how many LOGICAL attempts (one per
  `#attemptIntent()` call — i.e. one per `tick()` pass that intent was
  processed in, collapsing the existing same-tick `"immediate"`
  re-attempt per Alpha 476, unchanged) have completed without delivery.
- `#attemptIntent()`'s own post-attempt branch is restructured: on a
  non-`"delivered"` result, the attempt counter is incremented, then —
  ONLY if the Publisher's own `retryPolicy` was NOT already `"never"` —
  the injected `abandonmentPolicy` (if any) is consulted with
  `{ outboxId, completedAttempts, latestOutcome: result.outcome }`.
  `"abandon"` from the policy is treated identically to the
  pre-existing Publisher-declared `"never"` path (see Alpha 567).
- The counter is deleted from `#completedAttempts` the moment an intent
  becomes `delivered` OR `abandoned` — it never grows for a terminal
  intent (mirrors, at Map-entry granularity, the same "stop tracking
  once terminal" discipline `#delivered`/`#abandoned` themselves
  already apply at Set-entry granularity).

## Publisher `"never"` and policy `"abandon"` are additive, never a replacement — verified

`test/secure_runtime_alpha_568_...test.ts` §3: a Publisher declaring
`"never"` still abandons on the FIRST attempt even with a
`maxAttempts: 100` policy injected — the policy is consulted only when
the Publisher did NOT already say `"never"`, confirmed by direct
inspection of the `abandonedByPublisher || abandonedByPolicy` branch
and by this test's own real execution.

## Verification summary

`test/secure_runtime_alpha_568_abandonment_enforcement.test.ts` — 4
cases: (1) no policy injected reproduces the pre-Arc unbounded-retry
behavior exactly; (2) an injected max-attempts policy stops the
Publisher being called once the bound is reached, with the abandoning
tick's own entry carrying the `"abandoned"` observation; (3) Publisher-
declared `"never"` is unaffected by a generous policy; (4) a delivered
intent's own attempt counter does not leak into any later accounting.

## See also

- `docs/secure_runtime_alpha_566_abandonment_policy_decision.md`
- `docs/secure_runtime_alpha_567_abandoned_state_decision.md`
- `docs/secure_runtime_alpha_569_failure_classification_boundary.md`
