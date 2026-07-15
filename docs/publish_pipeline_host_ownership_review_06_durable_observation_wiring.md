# 06 — Durable Observation Wiring

## Current state (re-verified, not restated from the prior review's memory)

`FedosPublishScheduler` authors `FedosBoardOutboxObservation` values
internally (`#observe()`, `fedos_publish_scheduler.ts:219-230`) and
keeps them ONLY in a private `#observationLog: FedosBoardOutboxObservation[]`
array, returned via `observationLog()` and via each `tick()` call's own
return value. Nothing writes them anywhere durable. Separately, this
repository already has a fully durable, unrelated vocabulary —
`FedosDeliveryObservation` / `FedosDeliveryObservationRepository` /
`FedosDeliveryObservationPersistence` (`src/board/observation/*`,
committed) — that is never invoked by the Scheduler at all (the prior
review's own Alpha 481 §4 / Alpha 482 §1 findings).

## Adapter, not a type merge

Per the prior review's own Alpha 482 finding, `FedosBoardOutboxObservation`
(`{ outboxId, kind, observedAt, reason? }`, kinds
`attempt-started|delivered|rejected|failed|abandoned`) and
`FedosDeliveryObservation` (`{ id, subjectId, state, observedAt, reason? }`,
states `queued|publishing|accepted|rejected|failed`) are structurally
different types with a non-1:1 vocabulary. This review does NOT
recommend merging them (that would be a breaking type change to code
this review is forbidden from touching, and was already reviewed and
rejected implicitly by the prior review's own "no reconciliation
attempted" stance). Instead: a pure, one-directional MAPPING function —
`FedosBoardOutboxObservation -> FedosDeliveryObservation` — translating
kind to state:

| `FedosBoardOutboxObservation.kind` | `FedosDeliveryObservation.state` | Note |
|---|---|---|
| `attempt-started` | `publishing` | Closest semantic match — an attempt is in flight. |
| `delivered` | `accepted` | The counterparty accepted the intent. |
| `rejected` | `rejected` | Name collision is also a semantic match. |
| `failed` | `failed` | Name collision is also a semantic match. |
| `abandoned` | `failed` | No `abandoned` state exists in `FedosDeliveryObservationState` (Alpha 462's own closed five-token union) — `abandoned` is a TERMINAL failure from the Scheduler's own retry-directive application (`retryPolicy === "never"`), which is the closest existing `FedosDeliveryObservation` state to it. This mapping is LOSSY (a future reader cannot distinguish "one more retry would have been tried but wasn't" from "failed on the only attempt") — named honestly as a limitation, not hidden. |

`queued` (a `FedosDeliveryObservationState` with NO
`FedosBoardOutboxObservation` equivalent) is never produced by this
adapter — it belongs to Outbox INTENT creation
(`createFedosBoardOutboxIntent`, Alpha 414), a moment the Scheduler
never witnesses (Alpha 475's own header already names this same gap:
"deliberately OMITS `queued`, since that observation belongs to intent
creation"). A future wiring Arc's own choice: either `FedosDesktopHost.submitPostWithOutbox()`
records a `queued` `FedosDeliveryObservation` itself at the moment an
Outbox intent is durably written (the ONE place in this codebase that
already witnesses intent creation), or `queued` is accepted as
permanently unrepresented in the durable vocabulary. This review
recommends the former — Host already owns both the Outbox write
(`submitPostWithOutbox`) and, per Alpha 01, the Observation Repository,
so recording `queued` there costs one call, not a new dependency.

## Where the adapter runs

**At the Scheduler->Repository boundary, driven by Host, NOT inside
`FedosPublishScheduler` itself.** `FedosPublishScheduler`'s own hard
guardrail already forbids importing anything outside
`src/board/outbox/*` (re-confirmed by the prior review's own Alpha 486)
— adding an import of `src/board/observation/*` would violate that
guardrail and is out of THIS review's own no-src-change scope regardless.
Instead: Host, after each `await this.#scheduler.tick()` call (per
Alpha 03's own shutdown-await design), maps every
`FedosPublishSchedulerTickEntry.observations` entry through the adapter
above and calls `this.#observationRepository.record(...)` for each —
Host is already the one place with a legitimate reference to BOTH
`FedosPublishScheduler`'s output and the `FedosDeliveryObservationRepository`
input, per Alpha 01's own ownership matrix.

## Dual-write — explicitly PROHIBITED, and why it cannot silently happen

"Dual-write" here means: the SAME logical fact ending up recorded in
TWO independently-queryable stores that can drift (the Scheduler's own
`#observationLog` AND the durable Repository) with no single source of
truth. This review's own recommended design does not introduce a
choice here — `FedosPublishScheduler.observationLog()`
(`fedos_publish_scheduler.ts:125-127`) remains available (it is
existing, unmodified public API this review cannot remove) but Host's
OWN facade (Alpha 05) must never expose it, and must document the
durable Repository — reachable only via `deliveryStatus()`/a future
history-query method, never `observationLog()` — as the SOLE
authoritative source once wiring lands. `deliveryStatus()`
(Alpha 05) intentionally excludes anything from `observationLog()`, so
no caller of the Host's own public surface can observe the
soon-to-be-redundant in-memory copy at all.

## Current-state derivation

`FedosDeliveryObservationQuery.currentStateFor(subjectId)`
(Alpha 467, existing, unmodified) already derives "current state" as
the chronologically-last recorded fact for a subject. This review
recommends `subjectId` be set to the SAME string as
`FedosBoardOutboxId` (already a `string`-branded type,
`postId::protocol::destination`) — reusing the Outbox's own
deterministic identity rather than minting a new one, so a caller can
go from an Outbox intent id directly to its Observation history with no
separate lookup table.

## Replay

Not a NEW capability this Arc needs to build: `FedosDeliveryObservationRepository.list()`
already returns every durable record, and `FedosDeliveryObservationQuery.historyFor(subjectId)`
already replays it in `observedAt` order (Alpha 467, existing). "Replay"
in this design means: after a process restart, Host's OWN in-memory
Scheduler state (`#delivered`/`#abandoned` `Set`s) starts EMPTY again —
the Scheduler itself has no persistence of its own delivered/abandoned
bookkeeping (confirmed: those two `Set`s are private, in-memory,
constructor-scoped fields with no load path). A future wiring Arc must
decide whether Host, at `startDelivery()` time, re-seeds those Sets from
`FedosDeliveryObservationQuery.currentStateFor()` for every pending
Outbox intent (recommended — otherwise a restart silently re-attempts
every already-`accepted` intent) or leaves that as a KNOWN, named gap.
This review recommends re-seeding and names it explicitly as required
scope for the "Delivery Attempt Coordinator" Arc candidate (§11), since
it requires the Scheduler itself to accept a pre-seeded state — a
production change out of THIS review's own scope.

## Corruption policy

Reuses, unmodified, the EXISTING fail-closed policies already built:
`FedosDeliveryObservationRepository.list()`'s own per-record fail-closed
skip (a corrupt individual record vanishes from `list()`, never throws)
and `deserializeFedosDeliveryObservation`'s own schema/id-mismatch
rejection (Alpha 463). No NEW corruption-handling code is designed by
this review — the adapter (§ above) only ever calls
`createFedosDeliveryObservation`/`record()` with values IT constructs
from a real, in-process `FedosBoardOutboxObservation`, never
deserializing untrusted external data itself, so it inherits the
existing guarantees without adding a new failure mode.

## See also

- `docs/publish_pipeline_host_ownership_review_01_ownership_matrix.md`
- `docs/publish_pipeline_host_ownership_review_03_shutdown_ordering.md`
- `docs/secure_runtime_alpha_482_publish_pipeline_type_duplication_review.md`
- `docs/secure_runtime_alpha_467_delivery_observation_query.md`
