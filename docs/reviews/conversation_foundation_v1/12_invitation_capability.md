# Review 12 — Invitation Capability Boundary

Not implemented; `FedosConversationInviteAuthority` has exactly one
legal value (`"none"`) in the real, shipped Policy Arc code (`01`,
`05`). This document specifies the boundary the type will need to widen
into, and states plainly what it cannot yet guarantee.

## Shape

```ts
interface FedosConversationInvitationCapability {
  readonly capabilityId: FedosConversationCapabilityId;   // opaque, unguessable, Authority-assigned — a PUBLIC identifier, not the secret itself
  readonly conversationId: FedosConversationId;
  readonly allowedAction: "join-as-member" | "join-and-write";
  readonly issuer: FedosConversationParticipantRef;        // out of V1
  readonly maxUses: number;
  readonly expiresAt: number | null;
  readonly redemptionAuthority: FedosConversationParticipantRef | "any-current-member" | null;
}
```

**Capability public identifier vs. secret bearer material — kept
structurally separate.** `capabilityId` above is a reference the
Authority can log, look up, and reason about; it is never the bearer
secret a recipient redeems with. Both prior reviews are explicit and in
full agreement on this: the URL/token a recipient holds must never
itself be the authority record (AAR §08), and a `capabilitySecret` must
never be stored inside a `FedosConversationMessage` or any Board-domain
record (SEC §09) — doing so would let the secret leak through the exact
public channel `13_outbound_eligibility.md`'s gate exists to prevent.
This spec does not define a `capabilitySecret` field anywhere, and any
future implementation must keep it out of every type this spec does
define.

**Redemption authority — single-authority for private modes.** SEC §10
compares five options and rejects bearer-token-alone (Option E)
explicitly: *"cryptography alone cannot make a value 'self-destruct'
after first use without SOME external state... recording that the use
happened."* For private-group/direct, `redemptionAuthority` must name a
single, reachable Authority (SEC's Option A) — not `"any-current-member"`,
which is the looser option SEC reserves for **public**-mode invitations
only, where over-redemption is not a confidentiality failure.

**`maxUses`/expiry.** `maxUses` is satisfied by counting durable
redemption records, never a mutated counter (AAR §08) — this spec
defines no `FedosConversationInvitationRedemption` record, since
redemption itself is out of V1, but the counting discipline is recorded
here so a future Arc does not reintroduce a mutable-counter design.
`expiresAt` is a nullable timestamp, matching the existing
`FedosBoardOutboxTarget`/`FedosConversationPolicy` convention of
`| null` for "no constraint" rather than a sentinel value.

**Conversation/policy scope.** A capability is always scoped to exactly
one `conversationId`, and its existence is only meaningful once that
Conversation's own `inviteAuthority` policy axis has a second legal
value — i.e., this shape cannot be constructed at all until `05`'s
policy widening happens, which itself cannot happen until
`10_membership_boundary.md`'s authority is real. The dependency order is
strict: membership authority → policy widening → capability
construction.

## One-time limitation, stated without hedging

**Distributed exactly-once redemption is not available without a
chosen single authority**, and no claim beyond that authority's own
reachable state is possible. Quoting SEC §10 verbatim, because this is
exactly the kind of claim this spec must not soften: *"No claim of
'disappears from every Node in the world instantly' is made anywhere in
this review... at the single Authority that holds redemption state, a
`maxUses: 1` capability is redeemed by at most one requester — full
stop, no claim beyond that boundary."* If a future Arc ever splits
redemption authority across multiple independent nodes, the identical
distributed-exactly-once problem reapplies at that layer and is not
pre-solved by anything in this document.
