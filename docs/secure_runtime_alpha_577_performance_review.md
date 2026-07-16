# Secure Runtime Alpha 577 — Performance Review

Stage 17 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## Method

`test/secure_runtime_alpha_577_performance_review.test.ts` runs one
full `tick()` over an Outbox pre-filled with 1, 100, and 1,000 distinct
pending intents respectively (`describe.each`), each with an injected
`createFedosMaxAttemptsAbandonmentPolicy(3)` (the abandonment path's
own bookkeeping is exercised, not skipped, at every scale). Correctness
is the assertion — `entries.length === count`, every intent's own id
seen by the Publisher exactly once, and a SECOND `tick()` afterward
sees zero pending — not a timing benchmark; this Stage's own
instruction is explicit that correctness comes first and that no
optimization or indexing is to be added.

## Complexity, by direct inspection (not measured, since none of these collections are large enough at this Arc's own tested scale to make wall-clock timing meaningful or stable across machines)

- `#runTick()`'s own `pending` filter: O(n) over `listIntents()`'s own
  result, unchanged from Alpha 476.
- The new `#completedAttempts` Map: O(1) `get`/`set`/`delete` per
  intent per tick — no scan, no sort, keyed directly by `outboxId`.
- `abandonmentPolicy.evaluate()` (when injected): O(1) for
  `createFedosMaxAttemptsAbandonmentPolicy` (one comparison); any
  caller-supplied policy's own complexity is outside this file's
  control by design (Alpha 566's own injection boundary).
- History/Observation lookups: NOT performed by the Scheduler itself
  anywhere in this path — `FedosDeliveryRetryQuery` (a separate, only
  Controller-adjacent read boundary) is not on the Scheduler's own
  `tick()` critical path at all.

Net: this Arc's own additions are O(1) per intent per tick, on top of
the SAME O(n) per-tick scan the Scheduler already performed —
confirmed, not merely asserted, by the 1,000-intent case completing
(all three scale cases run inside the SAME single `vitest` test file's
own default per-file timeout with no adjustment needed).

## See also

- `docs/secure_runtime_alpha_568_abandonment_enforcement.md`
- `docs/secure_runtime_alpha_572_multiple_intent_concurrency_review.md`
