# Review 05 — Direct Conversation Command

## `direct` is not `memberCount === 2`

The task framing this review must not collapse to is exactly the trap
`src/conversation/membership/fedos_conversation_role.ts`'s own header
warns against for role vocabulary — treating a countable fact as a
substitute for a modeled one. Nothing in `FedosConversationMembership`
or `FedosConversationMembershipAuthority` (`01`) computes or exposes a
member count at all; `listMemberships()` returns an array a caller
COULD count, but no domain type anywhere treats "exactly two active
memberships" as a defining condition of anything. Defining `direct` as
`memberCount === 2` would make a `private-group` that happens to lose a
member down to two people silently indistinguishable from a `direct`
conversation — a real bug class this review closes by definition, not
by convention.

`mode: "direct"` is instead a FIXED, DECLARED property of the
Conversation record itself (same as `"public"`/`"private-group"`
today), chosen once at construction, never inferred from membership
count afterward. Two-person `private-group` conversations remain
legal and distinct from `direct` ones under this definition — a
`private-group` never silently becomes `direct` by losing members, and
a `direct` conversation that somehow admitted a third member (which
this review's own command below prevents structurally, not just by
convention) would be a genuine invariant violation, not a mode
reclassification.

## What differs from private-group, concretely

| Property | `private-group` | `direct` |
|---|---|---|
| Initial participants | creator only; others join via Capability | creator + exactly one named recipient, both admitted at construction |
| Invitation/admission | `inviteAuthority` axis meaningful; a general (any-redeemer) Capability may exist | no general Capability — `intendedRecipient` is REQUIRED, never `null`, on the one Capability construction may issue (`11`) |
| Administrative authority | `"owner"`/`"moderator"`/`"member"` roles all meaningful | both participants are effectively peers; `06`'s creator-Membership sequence still assigns `"owner"` to the constructing caller for consistency, but no `"moderator"` promotion path has any real audience of one other person to moderate — a future Arc's product decision, not resolved here |
| History policy | new members' access to pre-join history is a genuine open product decision (prior review's own §06 finding, still unresolved) | moot in the strict sense — a `direct` conversation's only two participants are both present from construction; there is no "new member" concept at all in V1's own scope, since `direct` participants cannot be added after construction (structural, enforced below) |
| Key strategy | must support future participant admission (`08`'s "future participants can receive keys" sub-check is load-bearing) | never needs post-construction key redistribution for a NEW participant — only the fixed pair; still needs key ready for the two participants at construction, so `08`'s other sub-checks apply identically |
| Leave/revoke semantics | `leave()`/`revoke()` reduce membership, conversation persists | `leave()`/`revoke()` by either participant should be understood as ending the conversation's own USABILITY for future writes (no third party to remain), even though `FedosConversationMembershipAuthority` itself has no "close the conversation" concept — `16` names this precisely as a gap between Membership-level state and Conversation-level lifecycle that this Arc's shipped code does not bridge |

## Command shape

```ts
export interface CreateDirectConversationCommand {
  readonly recipient: {
    readonly authority: FedosConversationParticipantAuthority;
    readonly publicIdentifier: string;
  }; // an already-public identifier only -- never a secret, matching FedosConversationParticipantReference's own guardrail
}
```

Deliberately smaller than the private-group command (`04`) — no
`discoverability` field (a `direct` conversation is never listed; `07`
fixes this, not the caller), no `federationEligibility` choice exposed
at construction for V1 (fixed `"local-only"` — see `07`'s own
reasoning), no `initialCapability` field (a `direct` Capability, if
issued at all, is ALWAYS `intendedRecipient`-bound to the one named
recipient — `11` — so there is nothing for a caller to configure
beyond naming the recipient itself, already present as `recipient`
above).

## Structural enforcement of "exactly two"

Construction admits the creator (`06`) and the named recipient (via a
directly-admitted Membership OR an `intendedRecipient`-bound
Capability the recipient must still redeem — `11` names both options
and recommends one) as the ONLY two participants ever admitted through
the direct-construction path. No `inviteAuthority` value this review
defines for `direct` mode (`07`) permits issuing a SECOND general or
recipient-bound Capability once the pair exists — this is a
CONSTRUCTION-TIME command-handler rule (the handler simply never
exposes a "invite a third person" operation for a `direct`
conversation), not a change to `FedosConversationMembershipAuthority`
itself, which remains mode-agnostic and enforces nothing about
participant count (`01`). The distinction matters: a future Arc that
DID want three-person `direct` conversations could not get there by
relaxing Membership Authority rules (there are none to relax) — it
would require a new command-handler decision, which is exactly the
kind of Conversation-Application-layer responsibility `12` argues
belongs in a dedicated boundary, not scattered validation logic.

## Result vocabulary

Structurally identical to `04`'s, with `ownerMembership` renamed
`creatorMembership` (both participants being formally peers makes
"owner" read misleadingly) and an added `recipientMembership` (present
only if the recipient is admitted directly rather than via Capability
redemption — see `11`'s own recommendation for which path `direct`
mode should actually take).
