# Secure Runtime Alpha 570 — Double-Publish Reproduction Closure

Stage 10 of the Alpha 561–580 Publish Scheduler Concurrency Safety &
Abandonment Policy Arc.

## What this Stage re-ran, and where

Alpha 549's own reproduction (`test/secure_runtime_alpha_549_...test.ts`
§1, pre-Arc) drove the race directly against a raw
`FedosPublishScheduler`. This Stage re-runs the SAME triggering
condition — `Publisher.publish()` gated open, an interval firing while
it is still pending — through the FULL real `FedosDesktopHost` ->
`FedosHostDeliveryController` -> `FedosPublishScheduler` pipeline
instead, the layer any real caller would actually be exposed to.

## Result

`test/secure_runtime_alpha_570_double_publish_reproduction_closure.test.ts`:
`publisher.calls` stays at exactly `1` across the entire window,
including after the interval has had multiple opportunities (at its
own configured 5ms cadence) to fire again while the gated call was
still open; `FedosDeliveryRetryQuery.historyFor()` reports exactly one
recorded attempt for the intent. Both the ORIGINAL raw-Scheduler
reproduction (`test/secure_runtime_alpha_549_...test.ts` §1, updated
this Arc — see
`docs/secure_runtime_alpha_578_publish_runtime_compatibility_review.md`)
and this Stage's own Host-level reproduction now demonstrate the CLOSED
behavior, at both layers the defect could have been observed from.

## Relationship to Alpha 564's own manual-tick closure

This Stage covers the interval-overlap trigger only (Alpha 549's own
original scenario). The SEPARATE manual-tick/interval-tick interleaving
trigger Alpha 561's own inventory named (a manual `tick()` call made
while an interval-triggered pass is in flight) is covered directly by
`test/secure_runtime_alpha_564_scheduler_stop_barrier.test.ts` §1,
since `FedosDesktopHost` itself exposes no public manual-tick surface
to reproduce that specific interleaving through the Host layer.

## See also

- `docs/secure_runtime_alpha_549_publish_runtime_thread_safety_audit.md`
- `docs/secure_runtime_alpha_563_single_flight_implementation.md`
- `docs/secure_runtime_alpha_564_scheduler_stop_barrier.md`
