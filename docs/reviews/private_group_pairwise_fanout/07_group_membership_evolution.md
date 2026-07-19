# Review 07 — Group Membership Evolution

## The group container's own Membership is the single source of truth; synthetic pairwise Conversations never get their own independent membership decisions

Admit/revoke/leave (`FedosConversationMembershipTransition`, unchanged:
`"admit" | "revoke" | "leave"`) are applied **only** to the group
container Conversation's own Membership Authority. A synthetic
per-pair direct Conversation (`06`) has its own Membership record too
(required by the existing, unmodified Direct Activation Coordinator's
own step 4b/4c checks, `03`) — but that record is written **once**,
when the synthetic Conversation is first generated (`06`), admitting
exactly the local participant and the one counterparty, and is
**never separately revoked or left** by the Fanout Coordinator. Group
membership evolution is expressed entirely through **recipient
planning** (`05`) reading the group's own roster fresh on every send —
never through mutating a synthetic Conversation's own Membership
state.

## Why this is the correct additive boundary, not a shortcut

Revoking a synthetic Conversation's own Membership the moment a member
leaves the group would require the Fanout Coordinator to call
`FedosConversationMembershipAuthority.revoke()`/`.leave()` against
Direct-mode Membership machinery for a purpose (tracking GROUP
evolution) that machinery was never reviewed for — a state change to a
frozen domain object driven by an event in a different, higher-level
domain. Leaving the synthetic Membership alone and gating exclusively
at the recipient-planning layer (`05`) means the Fanout Coordinator's
own state (the group roster) is the only thing that changes, and the
Direct-mode Membership Authority's own already-reviewed invariants
(exactly one active counterparty, forward-only transitions) are never
asked to represent anything about group semantics they were not
designed to carry.

## Concrete evolution behaviors, each traced to an existing, unmodified mechanism

- **A member is revoked from the group.** The group's own
  `FedosConversationMembershipAuthority.revoke()` call (unmodified) is
  the only state change. The next fanout send's recipient planning
  (`05`) simply omits that member — their synthetic Conversation with
  the sender continues to exist, fully activated, but receives no
  further fanout traffic.
- **A member leaves voluntarily.** Same mechanism (`leave()`,
  unmodified), same effect on future recipient planning.
- **A member's role changes** (`"member"`/`"moderator"`/`"owner"`,
  unchanged vocabulary) — has no bearing on recipient planning at all;
  role governs group administrative actions (invitation issuance,
  `docs/reviews/private_conversation_construction_v1/15_authorization.md`,
  unchanged), never message-fanout eligibility, which depends only on
  `state === "active"`.

## What this review does not invent

No new Membership transition, no new Membership state, no new role.
`09`/`10` cover removal/addition specifically; this document
establishes only where the evolution signal lives (the group's own
roster) and where it does not (any synthetic Conversation's own
Membership record).

## See also

- `05_recipient_planning.md`, `06_conversation_generation_boundaries.md`
- `09_member_removal.md`, `10_member_addition.md`
