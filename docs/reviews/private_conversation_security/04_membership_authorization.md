# 04 — Membership and Authorization Model

## Minimum required concepts

Participant, membership, role, join, revoke, leave, invite authority,
message write authority, history read authority, key epoch — ten
concepts, evaluated for whether each needs its own field/mechanism or
collapses into another.

## Not all ten are independent axes

- **Join and invite authority are different questions.** "May X become
  a participant" (join) is a yes/no outcome; "who may EXTEND that
  offer" (invite authority) is a separate, prior question about WHO can
  cause a join to become possible at all — this is the identical
  separation the prior review's own §05 already established for public
  Conversations (discoverability/read/write/invite-authority/membership
  as independent axes), reapplied here without modification.
- **Revoke and leave are the same underlying mechanism, different
  actor.** Both are `revokedAt: number | null` becoming non-null on a
  `FedosConversationMembership`-shaped record (prior review's own §06
  design, re-affirmed) — the only difference is whether the acting
  participant is the member themselves (leave) or someone else with
  sufficient role (revoke, i.e. removal). No separate mechanism needed
  for each.
- **Message write authority and history read authority are NOT the
  same axis**, and collapsing them would be a real design error: a
  newly-joined member's read authority over PAST history is governed
  entirely by §06's key-epoch rules (their own key epoch may not cover
  messages sent before they joined, regardless of any role they hold),
  while their write authority is a role/policy question independent of
  key epochs entirely (a member can be write-authorized the instant
  they join, even though they cannot decrypt anything sent before their
  own epoch began).
- **Key epoch is not itself a Membership field** — it's a property of
  the CONVERSATION'S encryption state that a Membership record
  REFERENCES (which epoch a given member's own access currently spans),
  not something each membership record independently owns. See §06 for
  the full epoch model.

## Recommended shape (design-level only, not implemented by this review)

Directly extends the prior review's own §06 `FedosConversationMembership`
design (re-verified: `FedosBoardRuntime` and the entire
`src/board/runtime/` tree still carry no Conversation/Membership
concept as of this pass — confirmed by fresh source inspection, §638-style
structural check reused for this review's own §boundary_guards.test.ts):

```ts
// Design shape only. Not implemented by this review.
interface FedosConversationMembership {
  readonly conversationId: FedosConversationId;
  readonly memberId: FedosConversationMemberId;
  readonly participantRef: FedosConversationParticipantRef; // prior review's own §06.1 union, unchanged
  readonly role: FedosConversationRole;      // e.g. owner | admin | member -- narrower set than SpaceRole's five, TBD by a future Arc
  readonly writeAuthority: boolean;           // or a small enum, mirroring PostPolicy's own established shape
  readonly joinedAt: number;
  readonly revokedAt: number | null;          // leave AND removal both land here -- never deleted
  readonly currentKeyEpoch: FedosConversationKeyEpoch; // REFERENCE only -- epoch state itself lives elsewhere, §06
}
```

## No permanent account id required — evaluated, reused unmodified

The prior review's own §06.1 `FedosConversationParticipantRef` union
(`local-account | nostr | temporary-capability | thread-local-pseudonym |
anonymous-local`) already satisfies this requirement in full — this
review re-confirms it as still correct and does not redesign it. One
addition this review's own instruction names that the prior review did
not: **device identity**.

### Device identity — the one genuinely new participant-authority option

A participant authenticated by a specific DEVICE's own key material
(distinct from an account-level identity that could span multiple
devices) is a real, separate concept from every option the prior
review's own union already names — none of `local-account`/`nostr`/
`temporary-capability`/`anonymous-local` is device-scoped. This matters
specifically for Private Conversation because §17 (Backup and
Multi-Device) requires distinguishing "this account, on any device" from
"this specific device's own key material" — a distinction public Board
posts never needed (a public post's author identity is protocol-scoped,
never device-scoped). Recommended: extend the union with a sixth
variant, `{ kind: "device"; deviceId: string; accountRef: string | null }`,
where `accountRef` links to a `local-account`/`nostr` ref when the
device is known to belong to a recognized account, or stays `null` for
a not-yet-linked device — not designed in full here, named as a real
gap this review's own instruction surfaces that the prior review's
union did not anticipate.

## Display pseudonym never used for authorization — reconfirmed

Per the prior review's own §07 (unchanged, re-affirmed): a
`FedosConversationMembership`'s `role`/`writeAuthority`/`revokedAt`
fields are keyed by `memberId`/`participantRef`, never by whatever
pseudonym (§13) is currently displayed for that member in a given
conversation. A moderator revoking a member acts on the `memberId`, not
on "Quiet Badger" — the pseudonym has no field anywhere in this
Membership shape and must never gain one.

## See also

- `docs/reviews/private_conversation_security/03_conversation_identity.md`
- `docs/reviews/private_conversation_security/06_key_epochs.md`
- `docs/reviews/board_runtime_application_api_06_membership_model.md`
