# 06 — Key Epoch and Membership Change

## The misconception this review must name and correct explicitly

**"Member removal wipes access to past ciphertext" is FALSE by default
and must never be assumed.** Removing a member revokes their
`FedosConversationMembership` (§04: `revokedAt` becomes non-null) and
stops future key material from reaching them — it does **not**, by
itself, alter any ciphertext already durably written (§07/§08: the
append-only persistence discipline this codebase already applies
everywhere makes retroactive re-encryption of historical messages a
separate, expensive, explicitly-opt-in operation, never a side effect
of a membership change). A removed member who retained a copy of the
group key valid at the time they had access can still decrypt every
message sent under that key, forever, unless the conversation
additionally performs a full history re-encryption — which this review
does not recommend as a default (§08's own retention-honesty principle
applies here too: promising "removal = the past is now unreadable to
them" without actually re-encrypting would be a false security claim).

## Required rules

### New members and past history

**A new member's own key epoch begins at their `joinedAt` time (§04) —
they do not automatically receive keys for epochs before their own
join**, by default. Whether a conversation additionally grants a new
member RETROACTIVE access to pre-join history is a distinct,
explicit policy decision (mirrors chat products' own real "show history
to new members" toggle) — a future Arc must decide this as a named
option, never an implicit default either way, since both directions are
defensible product choices with different security postures.

### Removed members and future messages

**A removed member must not receive the NEXT key epoch.** This is the
one guarantee epoch rotation genuinely provides: rotating to a new
epoch and distributing it only to currently-non-revoked members (§04's
own `revokedAt` field is exactly the gate a rotation-distribution step
checks) ensures a removed member cannot decrypt anything sent AFTER
their removal, given honest rotation. This is a real, meaningful
security property — it is the "removal wipes FUTURE access" half of the
misconception above, and it IS true, distinct from the "removal wipes
PAST access" half, which is not.

### Key rotation authority

Who may trigger a rotation is a role/policy question (§04's own
`role`/`writeAuthority` axis, extended) — not designed in full by this
review, but constrained: rotation authority should be narrower than, or
equal to, invite authority (prior review's own §05 axis) — a member who
can rotate keys but cannot invite would be a strange, likely-unintended
combination (rotation is a stronger action than invitation in most
threat models, since it can lock out an existing member's future
access). Recommended default: rotation authority tracks the SAME role
tier `revoke`(removal) authority already requires, since rotation is
typically triggered BY a removal.

### Epoch persistence

`FedosConversationKeyEpoch` (§03, a monotonic `number`) must itself be
a durable, append-only-logged fact — mirrors §02's own
`FedosConversationMessage.keyEpoch` field design: every message
references the epoch it was sealed under, and epoch TRANSITIONS
(`epoch N → N+1`, at what time, triggered by which membership change)
should be their own append-only record, following the SAME "history
preserved, never mutated in place" discipline the prior review's own
§02 (Conversation Lifecycle) already established for lifecycle
transitions — applied here a second time, for epoch transitions
specifically.

### Lost-device recovery

A member who loses a device loses whatever pairwise key material (§05
Option D) lived only on that device. Recovery has exactly two honest
options, named without inventing new cryptography: (a) the member
re-joins via a fresh invitation/key-delivery cycle, receiving only the
CURRENT epoch going forward (equivalent, from the conversation's
perspective, to a new member with no automatic history grant — see
above); or (b) the member recovers via a backup mechanism (§17) that
independently preserved the lost device's own key material. This review
does not pick between (a)/(b) as a mandatory default — both are
legitimate, product-level tradeoffs a future Arc must decide
explicitly, not silently assume.

### Re-encryption — when it IS required, stated plainly

Re-encryption of historical ciphertext under a new key is required only
if a conversation's own policy explicitly promises "removed members
lose access to past history too" (the stronger, opt-in guarantee named
above, not the default). This is genuinely expensive — it means reading
back every historical `FedosConversationMessage`, decrypting under the
old epoch key, and re-encrypting under a fresh key for every still-
current member — and is out of scope for this review to design in
full; named here only so a future Arc does not silently assume it is
free or automatic.

### Invitation redemption and key delivery ordering

**Key delivery must happen strictly AFTER membership is durably
recorded, never before, and the two must not race.** A capability
redemption (§09/§10) that grants membership but fails to also deliver
the current epoch's key would leave a "member" who cannot read
anything — a real, nameable failure mode a future Arc's redemption flow
must handle explicitly (e.g. by making membership-grant and
key-delivery a single, retriable operation keyed by the same redemption
record, never two independently-failable steps with no reconciliation
path).

## See also

- `docs/reviews/private_conversation_security/04_membership_authorization.md`
- `docs/reviews/private_conversation_security/05_key_distribution.md`
- `docs/reviews/private_conversation_security/09_capability_invitation.md`
