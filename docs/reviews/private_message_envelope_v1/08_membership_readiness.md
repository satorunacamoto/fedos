# 08 — Membership Readiness

## Reconciling SEC §04 and CFv1 §10

Neither review is superseded here. SEC §04 designed the full
`FedosConversationMembership` shape (role, `writeAuthority`,
`joinedAt`/`revokedAt`, `currentKeyEpoch` reference, the six-variant
`FedosConversationParticipantRef` union including the device-identity
addition). CFv1 §10 confirmed **nothing** of this exists in `src/` even
as a type, and drew the single hardest line this review inherits
unmodified:

> "**The concrete trap named explicitly: no fake allow-all membership.**" — CFv1 §10

CFv1 §10's own worked example is directly relevant to encryption
activation specifically: a hypothetical `AllowAllMembershipAuthority`
would let `writeAccess: "restricted"` validate while silently meaning
"unrestricted" underneath. **The same trap applies one layer deeper to
encryption**: a `06_encryption_authority.md`/`07_decryption_authority.md`
implementation that resolves a conversation key for *any* caller,
without a real membership check upstream, would make the Envelope
*look* access-controlled (it requires resolving a key) while actually
enforcing nothing — an even more dangerous version of CFv1 §10's own
warning, because a caller might reasonably assume "requires a key" is
equivalent to "requires membership," when without a real
`FedosConversationMembershipAuthority` behind it, it is not.

## What must exist before Direct-mode encryption activates

Per CFv1 §07's own readiness table (`FedosPrivateConversationReadiness`,
conceptual only, not implemented), the membership-adjacent row remains
unresolved at this commit:

| Prerequisite | State at this review's own commit (re-confirmed) |
|---|---|
| `FedosConversationId` exists | **No** — CFv1's own Package A, not yet built |
| `FedosConversationMembershipAuthority` (real, not a sketch) | **No** — CFv1 §10 is a documented interface only, zero implementations, by design |
| `FedosConversationParticipantRef` variant set chosen | **No** — SEC §04's 6-variant union, out of V1 per CFv1 §03 |

## Is Direct mode's membership check genuinely simpler?

**Structurally simpler, not exempt.** SEC §12's own finding (reconfirmed,
not re-derived): Direct has no role/admin distinction, no partial
membership, and no removal short of ending the conversation entirely —
"membership" for Direct degenerates to "is the caller one of the fixed
two participants." This review's own addition: **even that degenerate
check must still be real**, not hard-coded to `true`. A
`FedosConversationMembershipAuthority` implementation for Direct mode
specifically could be considerably smaller than the general N-member
case (SEC §12: no role, no epoch-rotation-on-removal trigger, see
`11_key_epochs.md`) — but "smaller" is not "absent," and this review
does not recommend skipping it for Direct mode as a shortcut to reach
encryption activation sooner. `13_runtime_activation_gate.md`'s
checklist includes a real membership check as a hard line item for
Direct specifically, not only for Private Group.

## See also

- `docs/reviews/private_conversation_security/04_membership_authorization.md`
- `docs/reviews/conversation_foundation_v1/10_membership_boundary.md`
- `06_encryption_authority.md`, `13_runtime_activation_gate.md`
