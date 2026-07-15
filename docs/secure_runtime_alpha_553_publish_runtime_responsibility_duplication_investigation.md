# Secure Runtime Alpha 553 — Responsibility Duplication Investigation (責務重複)

Stage 13 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only. Distinct from the prior review's own Alpha 482 (which
compared TYPE shapes) — this Stage asks, for each responsibility a
system in this stack must discharge, whether MORE THAN ONE component
currently claims to discharge it.

## Responsibility: "construct a Board post container that enforces thread integrity"

**Claimed by exactly one component in the reachable graph** —
`FedosBoardService`. `PersistedFedosBoardRepository` implements the
SAME `FedosBoardRepository` contract but enforces NONE of
`FedosBoardService`'s own thread-integrity/source-provenance rules
(it is a direct, unconditional pass-through to
`FedosBoardPersistence.putPost()`, confirmed by direct inspection —
`register()` calls `#persistence.putPost(record)` with no precheck of
any kind). This is not currently duplicated responsibility in
PRACTICE, because `PersistedFedosBoardRepository` is never wired
(Alpha 542/555) — but it IS a duplicated CONTRACT-implementation with
divergent semantics, a latent trap for whoever wires it later expecting
it to behave like `FedosBoardService` does.

## Responsibility: "decide whether a delivery attempt should be retried"

**Claimed by exactly one component**: the Publisher's own returned
`retryPolicy` (Alpha 551). Not duplicated — the Scheduler applies the
directive, never invents its own.

## Responsibility: "report the outcome of a publish attempt"

**Claimed by TWO components with no coordination**: the generic
`FedosBoardOutboxPublisher.publish()` return value (rich object) and
the Nostr-specific `FedosNostrBoardPublisher.publishOne()` return value
(bare boolean) — re-confirmed from the prior review, unchanged.

## Responsibility: "record that a delivery attempt happened"

**Claimed by TWO components**: the Scheduler's own inline `#observe()`
calls (writing `FedosBoardOutboxObservation`) and, if ever wired, a
caller writing `FedosDeliveryObservation` via the Repository — today
only the FIRST is actually exercised (Alpha 543), so this is a LATENT
duplication, matching the Publisher-result case above in shape.

## Responsibility: "know whether a Board post has been durably written"

**Claimed by TWO components, with an ordering dependency between
them, not a true duplication**: `FedosBoardPersistence` (the actual
durable answer) and `FedosBoardService`/`FedosBoardRepository` (the
in-memory answer, always downstream of and derived from the durable
one via hydration or `submitPost()`'s own two-step write). This is
NOT flagged as a problem — Host's own `submitPost()` design
(Persistence-then-Repository ordering, Alpha 395) already reconciles
it deliberately, and Alpha 545 already reviewed this specific
recovery path as CORRECT. Named here only to confirm it was
considered and is not a duplication finding.

## Responsibility: "decide if an Outbox intent is still pending"

**Claimed by exactly one component TODAY** (Scheduler's own
`#delivered`/`#abandoned` Sets), but per Alpha 07 of the (unmerged)
Host Ownership Review, a durable-history-based answer
(`FedosDeliveryObservationQuery.currentStateFor()`) is the RECOMMENDED
second source once wired — this Stage flags that the wiring design
must pick ONE as authoritative (the Host Ownership Review's own
recommendation: durable history re-seeds the Scheduler's Sets at
startup, never the reverse) to avoid this becoming a real, not merely
latent, duplication.

## Summary

Four responsibilities reviewed carry genuine, real (if currently
latent) duplication: Board Repository construction semantics,
Publisher outcome reporting, delivery-attempt recording, and (once
wired) pending-intent determination. Two responsibilities reviewed and
found NOT duplicated: retry decision-making, durable-vs-in-memory Board
write ordering.

## See also

- `docs/secure_runtime_alpha_482_publish_pipeline_type_duplication_review.md`
- `docs/secure_runtime_alpha_555_publish_runtime_unnecessary_repository_review.md`
