# 07 — Outbox Processing

## Pending intent determination

`FedosBoardOutboxPersistence.listIntents()` (Alpha 417, existing)
returns EVERY intent ever written — it has no `"pending"` filter of its
own (re-confirmed: its three-method surface is exactly
`putIntent`/`getIntent`/`listIntents`). "Pending" is therefore always a
DERIVED concept, computed at read time, never a stored field — and
today it is derived TWICE, inconsistently:

- `FedosPublishScheduler.tick()` derives it from its OWN private
  `#delivered`/`#abandoned` `Set`s (in-memory, lost on restart — Alpha
  06 already names this gap).
- Per this review's Alpha 06 recommendation, the durable
  `FedosDeliveryObservationQuery.currentStateFor(subjectId)` COULD
  derive it too: an intent with no recorded Observation, or whose
  latest Observation is `queued`/`publishing`, is pending; `accepted`
  or a terminal `failed` (post-retry-exhaustion) is not.

**Recommendation: the Scheduler's own in-memory Sets remain the
per-process cache (unchanged — this review does not touch
`fedos_publish_scheduler.ts`), re-seeded from the durable Observation
history at `startDelivery()` time (Alpha 06's own "replay" design) so
the two derivations agree after every restart.** No third, Host-owned
pending-determination code is designed — Host defers entirely to the
Scheduler's own existing filter logic once seeded correctly.

## Reprocessing an `accepted` intent

**Must not happen automatically.** Once `FedosDeliveryObservationQuery.currentStateFor()`
reports `accepted` for a subject, the Scheduler's own re-seeded
`#delivered` `Set` (per the replay design, Alpha 06) already excludes it
from every future `listIntents()` filter pass — this is the EXISTING
mechanism (`fedos_publish_scheduler.ts:161-163`), not a new one. An
intent, once genuinely `accepted`, is retried again ONLY by an explicit,
caller-driven action (see next item), never by ordinary `tick()` cadence.

## Manual retry of `rejected`/`failed`

**Not supported by any current API, and this review does not design a
new one that mutates the Outbox to enable it.** Per Alpha 414's own
"never a mutation method, no setter" permanent guardrail on
`FedosBoardOutboxIntent`, and per this review's own §12 prohibition on
changing Publisher/Observation/Scheduler TYPES, a manual retry cannot
be "flip a stored flag back to pending." The only faithful design
consistent with existing invariants: manual retry means the CALLER
constructs a brand-new, logically-identical intent submission (same
`postId`/`target`) through the EXISTING `submitPostWithOutbox()` path —
`createFedosBoardOutboxIntent`'s own deterministic id (Alpha 413) means
this either (a) collides with the original intent's id and
`putIntent()` reports `"already-present"` (a genuine no-op, since the
STORED intent record itself never encoded any outcome to begin with —
outcome lives only in Observation), or (b) if the Scheduler's own
`#delivered`/`#abandoned` Sets (correctly re-seeded, per Alpha 06) still
mark that id as terminal, the caller-facing manual-retry action must
ALSO clear that specific id from the Scheduler's own tracking — a
capability the Scheduler does not expose today (`#delivered`/
`#abandoned` are private with no eviction method). **Named as required
scope for a future Arc**: `FedosPublishScheduler` needs an explicit
`retryIntent(outboxId): void` (or equivalent) escape hatch, out of this
review's own no-src-change scope to add.

## Intent deletion — confirmed prohibited, unchanged

`FedosBoardOutboxPersistence` has no delete method (Alpha 417's own
permanent guardrail, re-confirmed unchanged in the currently-committed
file) — this review's own design assumes and preserves this: nothing
in the Host ownership design calls for, or would require, an Outbox
delete capability. An intent, once written, is permanent; only its
DERIVED current state (via Observation) changes.

## Current-state derivation from Observation — the canonical read path

Per Alpha 06, `FedosDeliveryObservationQuery.currentStateFor(subjectId)`
(with `subjectId` set to the Outbox's own `FedosBoardOutboxId`) is the
ONE recommended read path for "what happened to this Outbox intent" —
never the Outbox persistence layer itself (which was never designed to
carry outcome, per Alpha 412's own original "delivery intent ONLY"
decision), and never the Scheduler's own private, non-durable,
process-lifetime-scoped Sets directly.

## See also

- `docs/publish_pipeline_host_ownership_review_06_durable_observation_wiring.md`
- `docs/publish_pipeline_host_ownership_review_11_deliverables_and_dependency_order.md`
- `docs/secure_runtime_alpha_414_immutable_outbox_intent_model.md`
