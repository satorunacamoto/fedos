# Review 10 — Member Addition

## Addition creates new synthetic Conversations lazily, one per existing active member, on the new member's first fanout interaction

A newly-admitted group member (via the group's own existing, unmodified
`FedosConversationMembershipAuthority.admit()`, reached through the
existing Invitation/Capability redemption path, Alpha 776–1050,
unmodified) does not retroactively create N synthetic Conversations
with every existing member immediately — per `06`'s own "lazily, on
first need" discipline, each sender's own local Runtime constructs and
activates its own synthetic Conversation with the new member the first
time it sends (or the new member's own Runtime does, symmetrically, the
first time it sends to any existing member). There is no "group join
handshake" that eagerly wires every pair — this review does not invent
one, matching "recommend only additive evolution," not "additive
infrastructure work with no corresponding message ever sent."

## No historical access for a newly-added member — restated as an explicit, permanent limitation

Exactly as `docs/reviews/private_protocol_delivery_group_v1/16_pairwise_fanout.md`
already specified in the abstract, and as `08` restates concretely: a
new member's synthetic Conversation with any existing member begins
with **zero prior Envelopes** — there is no re-encryption, no backfill,
no historical key delivery mechanism of any kind. This is not a gap to
be closed by a future Arc casually; per the prior review's own
`17_epochs_membership.md` finding, closing it would require a
materially different scheme (a real shared/rotatable group key with a
backfill story, i.e. Option D or a standards-track scheme, `16`/`17`)
that this review does not authorize building.

## Symmetry requirement, stated as a constraint on any future Fanout Coordinator implementation

Because fanout has no central authority mediating who talks to whom
(`04`, purely peer-to-peer over pairwise channels), a new member only
gains synthetic Conversations with members who have themselves sent
(or been sent to) at least once since the new member joined — a group
with N members where only 2 have ever exchanged fanout messages with
the new member leaves N-3 pairs entirely unestablished until each of
those pairs independently sends. This is an honest consequence of the
lazy-generation discipline (`06`), not a defect this review proposes
fixing by eager fanout at admission time (rejected in `06` for cost
reasons, and here again for the same reason: the majority of those
pairs may never need to exchange a message at all).

## What member addition does not touch

Nothing about admission changes any EXISTING synthetic Conversation's
own Membership, key material, or Envelope history (`07`) — addition is
purely additive at the group roster level, and purely lazy-generative
at the synthetic-Conversation level.

## See also

- `06_conversation_generation_boundaries.md`, `08_history_semantics.md`
- `09_member_removal.md`, `18_migration_path.md`
