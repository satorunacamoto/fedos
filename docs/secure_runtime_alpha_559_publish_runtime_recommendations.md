# Secure Runtime Alpha 559 — Recommendations for Future Arcs

Stage 19 of the Alpha 541–560 Publish Runtime Operational Review Arc.
Review only — every item below is a NAMED candidate, not authorized or
started by this Arc.

## Recommended sequencing, incorporating this Arc's own new findings

Prior reviews already named: Publisher/Observation Reconciliation,
Durable Observation Wiring, Publish Pipeline Host Ownership, Delivery
Attempt Coordinator, Nostr Publisher → Generic Publisher Adapter,
Private Board/DM Eligibility Boundary. This Arc adds TWO new candidates
that this Stage places FIRST in the sequence, per Alpha 558's own
"fix before wiring is cheaper than after" finding:

1. **Scheduler Concurrency Safety Arc** (NEW, this Arc's own
   recommendation) — adds a reentrancy guard to
   `FedosPublishScheduler.tick()` (e.g. a `#ticking` boolean, or an
   in-flight-tick `Promise` the timer callback awaits before firing a
   new one — which ALSO closes the Alpha 03 shutdown-await gap the
   (unmerged) Host Ownership Review already named, making this a
   two-birds fix). Small, self-contained, touches one file, zero
   dependency on any other candidate.
2. **Scheduler Abandonment Policy Arc** (NEW, this Arc's own
   recommendation) — decides and implements a bound on "how many times
   a crashing/malformed-response Publisher gets retried before a
   Scheduler-level (not Publisher-level) abandonment" — Alpha 551's own
   finding that a crashing Publisher retries forever today. Also
   small, self-contained, one file.
3. **Publisher/Observation Reconciliation** (prior review) — now
   additionally informed by Alpha 553/555's own Board-layer duplication
   findings; recommend broadening this Arc's own scope slightly to
   decide `PersistedFedosBoardRepository`'s own fate (Alpha 555's own
   two options: retire or wire-with-fixed-semantics) at the same time,
   since both are "pick one of two competing implementations" decisions
   with the same shape.
4. **Durable Observation Wiring** (prior review, unchanged scope).
5. **Publish Pipeline Host Ownership** (prior review) — now with an
   ADDED acceptance criterion this Arc supplies: the wiring must call
   `scheduler.stop()` (and, transitively, any `WebSocketRelay.disconnect()`
   reachable through the wired Publisher registry) from
   `Host.stop()`/`stopDelivery()`, closing Alpha 546/548's own
   resource-leak findings as PART of this Arc rather than a follow-up.
6. **Delivery Attempt Coordinator** / **Nostr Publisher Adapter** /
   **Private Board/DM Eligibility** (prior reviews, unchanged scope,
   dependency-ordered as those reviews already specified).

## Why 1 and 2 come first

Both are the ONLY candidates in this entire list reproducible with a
`FedosPublishScheduler` in complete isolation — no Host, no durable
backend, no wiring decision required first (Alpha 558's own "smallest
wiring distance" ranking). Every other candidate either depends on one
of these being resolved first (Host Ownership now explicitly
depends on 1, transitively, since a Host-driven shutdown that awaits a
racy, unguarded `tick()` inherits the race) or is independent of them
but strictly lower urgency per Alpha 558's own severity ranking.

## What this Arc explicitly does NOT recommend

Building a THIRD Publisher family, a FOURTH Observation vocabulary, or
any new protocol adapter before candidates 3–5 above reconcile the
TWO/TWO that already exist — restates the prior review's own Alpha 490
§4 conclusion, re-confirmed still correct by this Arc's own broader
scope.

## See also

- `docs/secure_runtime_alpha_558_publish_runtime_risk_synthesis.md`
- `docs/secure_runtime_alpha_490_publish_pipeline_integration_review_completion.md`
