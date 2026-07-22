# Review 05 — Recipient Planning

## Enumeration reuses the group's own real Membership Authority — never a new roster

The Fanout Coordinator (`04`) determines recipients for one send by
reading the **group container Conversation's own** `FedosConversationMembershipAuthority.listMemberships(groupConversationId)`
— the exact same real, persisted Membership port every other
Coordinator in this codebase already uses (`FedosConversationMembershipAuthority`,
unmodified). It filters to `state === "active"` and excludes the local
participant, mirroring `MembershipFedosConversationParticipantResolver`'s
own filter logic (`src/conversation/encryption/identity/fedos_conversation_participant_resolver.ts:69-71`)
almost verbatim — the one difference being this filter does **not**
reject a count other than one; it returns the **full list** of active
others, which is exactly the input the per-pair fanout loop (`04`)
needs. This is a new, sibling enumeration function, never a
modification of `MembershipFedosConversationParticipantResolver`
itself (`04`'s own "widening a frozen resolver is rejected" finding) —
Direct-mode's own exactly-one-counterparty resolver continues to be
used, unmodified, once per synthetic pairwise Conversation.

## What recipient planning explicitly does NOT do

**No automatic fanout beyond the group's own current roster.**
Mirroring the public-post precedent this review's own predecessor
already established (`docs/reviews/private_protocol_delivery_group_v1/09_delivery_eligibility.md`'s
own "no automatic fanout, no inbound-provenance target inference"),
recipient planning reads the group Membership fresh on every send — it
never caches a stale recipient list, never infers additional
recipients from a reply's own provenance, and never sends to a member
whose `state` is not `"active"` at send time (a `"revoked"`/`"left"`
member is silently excluded, not erred on — group sends must not fail
merely because membership has changed since the last send).

**No partial-failure ambiguity left unresolved.** Because each
recipient's own send is an independent call to the existing, unmodified
`sendDirectMessage()` (`04`), recipient planning's own output is a
plain list, and the Fanout Coordinator (not this document) is
responsible for reporting a per-recipient result set rather than a
single collapsed outcome — one recipient's `"conversation-not-active"`
(its own synthetic Conversation not yet activated, `06`) must never
mask another recipient's successful `"sent-locally"`.

## Recipient planning is local-only, matching every other read in this Arc

Exactly like `listDirectMessages()`'s own "deterministic LOCAL
ordering only... never implies protocol/global ordering" discipline
(`14`), recipient planning reflects only the sender's own local
Membership Authority state — it cannot and does not claim that every
other member's own Runtime instance agrees about who is currently
active in the group. A member removed by an owner is only excluded
from a given sender's own future fanout once that sender's own local
Membership Authority has itself durably recorded the removal (`07`).

## See also

- `04_pairwise_fanout_architecture.md`, `06_conversation_generation_boundaries.md`
- `07_group_membership_evolution.md`, `14_local_canonical_history.md`
