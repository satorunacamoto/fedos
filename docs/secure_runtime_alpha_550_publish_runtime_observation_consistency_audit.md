# Secure Runtime Alpha 550 — Observation Consistency Audit

Stage 10 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only. Re-confirms, against the CURRENT source (unchanged since
the prior review), the three-vocabulary finding, then adds one new
angle: consistency WITHIN a single vocabulary, not just BETWEEN them.

## Recap: three vocabularies, still unreconciled

1. Alpha 415's own six-candidate list — still unrealized in any
   committed code.
2. `FedosBoardOutboxObservation` (Alpha 475) — five kinds, in-memory
   only, authored exclusively by the Scheduler.
3. `FedosDeliveryObservation` (Alpha 462) — five states, durable,
   authored by nobody in production (Alpha 543).

No new duplication found this Arc — re-confirmed, not re-litigated.

## New: within-vocabulary consistency risk, found this Arc

`FedosBoardOutboxObservation`'s own `#observationLog` is a **flat
array**, append-only, with no per-subject grouping or ordering
guarantee beyond insertion order — `observationLog()` returns
`[...this.#observationLog]`, a shallow copy in the SAME order entries
were pushed. Given Alpha 549's own double-publish finding (two
overlapping `tick()` calls attempting the SAME intent concurrently),
the resulting Observation LOG for that one intent can interleave:
`attempt-started` (call A) → `attempt-started` (call B) →
`delivered` (call B) → `delivered` (call A) — TWO `"delivered"`
entries for a SINGLE logical delivery, in an order that does not
correspond to either call's own internal sequence. Nothing reading
`observationLog()` can distinguish "delivered twice because of two
independent retries" from "delivered twice because of the Alpha 549
race" — the log carries no correlation id linking the TWO
`attempt-started`/outcome pairs from the SAME overlapping `tick()`
window to each other.

`FedosDeliveryObservationQuery.currentStateFor()` (the durable
vocabulary) is NOT vulnerable to the SAME race in the SAME way, since
nothing feeds it yet (Alpha 543/545) — but Alpha 483 (prior review)
already independently found it has NO transition-order enforcement of
its own, so once wired, it would inherit an EQUIVALENT risk: two
concurrent writers racing `record()` calls with the same `subjectId`
and no coordination.

## Consistency, once durable wiring lands (design-level note, not implemented by this review)

Any future Arc wiring `FedosBoardOutboxObservation` →
`FedosDeliveryObservation` (per the (unmerged) Host Ownership Review's
own Alpha 06 adapter design) inherits Alpha 549's race UNLESS the
Scheduler's own reentrancy gap is closed FIRST — an adapter cannot
retroactively add correlation the source data never had. This is a
concrete, Arc-ordering-relevant finding: **fixing the Scheduler's
reentrancy gap (Alpha 549) is a PREREQUISITE for trustworthy Observation
consistency, not an independent, lower-priority cleanup item.**

## See also

- `docs/secure_runtime_alpha_482_publish_pipeline_type_duplication_review.md`
- `docs/secure_runtime_alpha_549_publish_runtime_thread_safety_audit.md`
- `docs/secure_runtime_alpha_483_delivery_state_transition_closure_review.md`
