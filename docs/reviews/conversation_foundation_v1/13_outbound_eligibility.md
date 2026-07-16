# Review 13 — Outbound Eligibility Integration

## The full chain

```
Conversation Policy (04/05)
    -> Mode readiness            (is this Conversation's mode constructible at all — V1: "public" only)
    -> Encryption readiness       (private modes only — BLOCKED, 07/11; no-op for "public")
    -> Protocol capability        (existing: isEligibleForPublicOutboundTarget / evaluateFedosOutboundEligibility)
    -> Outbox
```

**V1 reality: the first two stages are trivial, not absent.** Every
Conversation constructible in V1 already has `mode: "public"`
(`03`/`04`), so "Mode readiness" always passes by construction — this
spec does not add a runtime check for it, because there is no other
value it could ever see. "Encryption readiness" is a strict no-op for
public mode (nothing to check) and remains fully blocking for any
future private mode until `07`'s prerequisites resolve — this spec adds
no code for this stage either, since introducing an always-true stub
would misrepresent it as evaluated when it is really just inapplicable.

**Protocol capability stage is unchanged.** Both the real `master`
implementation (`isEligibleForPublicOutboundTarget()`) and the Policy
Arc's richer `evaluateFedosOutboundEligibility()` already implement
this stage correctly and fail-closed, per `01`. This spec does not
modify either.

## Required invariants, restated because they must survive future Arcs unchanged

**No Publisher-side privacy decision.** `FedosRelayNostrBoardPublisher.publishOne()`
(and any future ActivityPub/AT Protocol/Session publisher) must never
gain audience/mode/policy-inspection logic. The eligibility decision
must be complete and final before any Outbox intent reaches a
Publisher — this is already true today (confirmed: `#assembleAndSubmit()`
runs the eligibility loop before `Host.submitPostWithOutbox()`, and the
Publisher layer takes no `FedosConversationPolicy`/mode parameter of any
kind). A future private-mode Arc extending this chain must preserve this
invariant exactly — the encryption-readiness stage belongs upstream of
Outbox intent creation, never inside a Publisher.

**No automatic fanout.** A future private-group message must never be
silently expanded by the Eligibility or Outbox layer into N
per-recipient deliveries without N explicit, individually-tracked
intents. `FedosBoardOutboxIntent` today is deliberately one intent per
`(postId, target)` pair (`makeFedosBoardOutboxId`'s own construction) —
any future per-recipient private delivery must produce one real intent
per recipient, visible and auditable the same way, not a hidden loop
inside the eligibility gate or the Scheduler. This spec adds no fanout
logic, since no private mode is constructible in V1 for it to apply to;
the invariant is recorded here so a future Arc inherits it rather than
re-deriving it.

## What changes vs. what doesn't, confirmed against real source

Nothing changes. This spec adds no new field to
`FedosOutboundEligibilityInput`/`FedosOutboundEligibilityResult`
(Policy Arc) and no new check to
`isEligibleForPublicOutboundTarget()`/`evaluateFedosOutboundEligibility()`
(`master`/Policy Arc, respectively). The chain above documents where a
future private-mode extension must insert itself — between Conversation
Policy resolution and the existing protocol-capability check — without
implementing that extension now.
