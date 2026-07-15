# 10 — Abuse Defense Separation

## Requirement

None of the following may be mixed into the delivery Host design this
review produces: Lightning stake, NIP-13 PoW, Capability invite, JA4,
CrowdSec, Ontology anomaly detection.

## Finding: none of the six exist anywhere in this repository today, so there is nothing to separate FROM yet — the risk is prospective, not current

A search confirms zero committed implementation of any of the six
(consistent with every recent Arc's own "Still out of scope" list,
e.g. Alpha 450 §6: "Lightning/NIP-13, JA4/CrowdSec, Ontology
integration"). This review's own job is therefore to keep the Host
ownership design (Alpha 01/05) structurally incapable of absorbing them
LATER by accident, not to remove anything that exists now.

## Where each belongs instead (named for future scoping only — none designed by this review)

| Concern | Correct layer (not this Host) | Why it must not live in the delivery Host |
|---|---|---|
| Lightning stake | A payment/anti-spam gate ahead of `submitPost()`/`submitPostWithOutbox()`, or a Board-model-level field checked before intent creation (same layer as Alpha 09's eligibility check) | It answers "should this post be ACCEPTED at all," a Board-write-time question — never "how should an already-accepted post be DELIVERED," which is all the delivery Host answers. |
| NIP-13 PoW | Nostr-protocol-specific INBOUND validation (already has a home: `validateInboundNostrEvent`-shaped code, per the prior review's own dependency audit showing Nostr concerns stay inside `src/nostr/*`) or a per-Publisher OUTBOUND policy internal to a Nostr-specific Publisher implementation, never the generic `FedosBoardOutboxPublisher` interface (Alpha 01) or the Scheduler (protocol-agnostic by design, prior review's own Alpha 486 finding). |
| Capability invite | Board/Board-access layer (who may READ/WRITE a private Board at all) — logically UPSTREAM of Alpha 09's own eligibility check, not part of it: an invite decides "is this actor part of the audience," eligibility (Alpha 09) decides "does this ALREADY-authorized post get sent outbound." Two different questions, two different layers. |
| JA4 | Transport/network fingerprinting — belongs, if anywhere, inside a specific Relay/transport implementation (e.g. `FedosRelay`'s own connection layer), never the Scheduler or the generic Publisher interface, both of which are explicitly transport-unaware by design (prior review's own Alpha 484/486 findings). |
| CrowdSec | Infrastructure-level abuse mitigation (rate-limiting, IP reputation) — belongs at the Relay/transport or Host-process boundary (e.g. a reverse proxy or a Relay-level guard), never inside `FedosPublishScheduler`'s own cadence logic, which owns ONLY "when to retry," never "should this identity be allowed to publish at all." |
| Ontology anomaly detection | A separate, cross-cutting observability/analysis system that would CONSUME Observation data (durable Observations are exactly the kind of signal an anomaly detector reads) but must never be a dependency OF the Observation Repository/Scheduler/Publisher themselves — Observation is a producer of facts, not a consumer of policy decisions. Wiring Ontology as a Repository dependency would invert this and make delivery availability depend on an unrelated analysis system's own health. |

## Structural guard this review's own design already provides

Because Alpha 01 confines Host's new ownership to exactly five things
(Publisher registry, Scheduler, Observation Repository, plus the two
explicitly-NOT-owned retry-policy/clock items) and Alpha 05's facade
exposes only `startDelivery`/`stopDelivery`/`deliveryStatus`, there is
no natural "just add one more field" slot for any of the six concerns
above to attach to without a deliberate, visible API change — the
facade's own minimalism (Option B over Option A, Alpha 05) is itself
part of what keeps abuse-defense concerns out, since Option A's raw
Scheduler/Publisher exposure would have made it easier for a future
caller to bolt a policy check directly onto an exposed Scheduler
instance instead of at the correct, upstream layer.

## See also

- `docs/publish_pipeline_host_ownership_review_01_ownership_matrix.md`
- `docs/publish_pipeline_host_ownership_review_05_ownership_api.md`
- `docs/publish_pipeline_host_ownership_review_09_private_board_dm_eligibility.md`
