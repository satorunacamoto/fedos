# Review 06 — Conversation Generation Boundaries

## When a synthetic per-pair direct Conversation is created: lazily, on first need, never eagerly for the whole roster

The Fanout Coordinator creates a synthetic `direct` draft (via the
existing, unmodified `FedosPrivateConversationConstructionCoordinator.createDirectDraft()`)
for a given (group, counterparty) pair **the first time that pair
needs to exchange a fanout message** — never eagerly for every member
at group-construction time. Eager creation would mean constructing
O(N) Direct drafts the instant a group is formed, most of which may
never be used if the group's own message volume is low or membership
churns before a first send — an unnecessary, unbounded-at-scale write
for no observable benefit, inconsistent with this review's own
"minimize ripple" instruction applied to runtime behavior, not just
source diff.

## Deterministic synthetic Conversation identity — never a fresh random id per attempt

The synthetic Conversation id for a (group, pair) is **deterministic**,
mirroring every other deterministic-id precedent already established
in this codebase (`makeFedosBoardOutboxId`, `fedosConversationActivationId`
— `"activation::" + conversationId`, `06`'s own sibling doc
`docs/reviews/private_protocol_delivery_group_v1/10_outbox_intent.md`'s
"never random" discipline): a fixed function of the group Conversation
id and the ordered pair of participant references, e.g. conceptually
`fanout::<groupConversationId>::<sortedParticipantPairKey>` — sorted so
the same two participants always resolve to the same synthetic id
regardless of who initiates. This makes "does a synthetic Conversation
already exist for this pair" a pure lookup, never a search, and makes
a retried fanout-send attempt after a crash naturally idempotent at the
Conversation-generation step (it finds the same draft rather than
creating a duplicate).

## The synthetic Conversation's own Policy is the existing Direct Policy, unmodified

`resolveFedosPrivateConversationPolicy()` (unchanged,
`src/conversation/construction/fedos_private_conversation_policy.ts`)
already fixes Direct mode's policy axes
(`writeAccess: "restricted"`, `readAccess: "members-only"`,
`federationEligibility: "local-only"`) regardless of caller — the
synthetic Conversation needs no new policy variant, and the Direct
Activation Coordinator's own policy-validity check (`03`, step 3)
passes for it exactly as it would for any hand-constructed Direct
Conversation, with zero special-casing.

## Conversation generation boundary: the Fanout Coordinator's own responsibility, stated as a negative constraint

The Fanout Coordinator **never** constructs a synthetic Conversation
whose Membership includes anyone other than exactly the local
participant and exactly one counterparty from the group's own current
active roster (`05`) — this preserves the exactly-one-counterparty
invariant `MembershipFedosConversationParticipantResolver` already
enforces (`03`) for every synthetic Conversation it constructs,
meaning the Fanout Coordinator's own generated Conversations are
indistinguishable, from the Direct-mode pipeline's own point of view,
from any hand-constructed 1:1 Direct Conversation. This is what makes
"zero changes to the Direct-mode pipeline" true in practice, not just
in intent.

## See also

- `04_pairwise_fanout_architecture.md`, `05_recipient_planning.md`
- `09_member_removal.md`, `10_member_addition.md`
