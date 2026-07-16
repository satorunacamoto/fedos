# Review 10 — Membership Boundary Placeholder

## Candidate interface

```ts
interface FedosConversationMembershipAuthority {
  /** Does `participantRef` currently hold write authority in `conversationId`? */
  isMember(conversationId: FedosConversationId, participantRef: FedosConversationParticipantRef): Promise<FedosMembershipCheckResult>;
}

type FedosMembershipCheckResult =
  | { readonly outcome: "member"; readonly role: FedosConversationRole }
  | { readonly outcome: "not-member" }
  | { readonly outcome: "authority-unavailable" };
```

Required inputs: a `FedosConversationId` (from `03`) and a
`FedosConversationParticipantRef` (AAR §06's 5-variant union, extended
by SEC §04's device variant — neither implemented, referenced here only
as the shape a real membership check would need). Required output: a
closed, fail-closed-shaped result — `"authority-unavailable"` is
distinct from `"not-member"` so a caller never conflates "the check
could not run" with "the check ran and said no," matching this
codebase's own established convention (`FedosBoardPersistence`'s
`"failed"` vs `"conflict"` distinction; `FedosPublicAuthorResolution`'s
`"unavailable"` vs `"anonymous-local"` distinction).

## Why this must remain absent or inert in V1

**Not implemented, not even as a type in `src/`.** Unlike
`FedosConversationMembership` (a data shape, out of V1 per `01`), this
is an *authority* — something a real command path would call and
trust. Sketching its interface in a doc, as above, carries no
production risk. Adding even the interface (with zero implementations)
to `src/` would be the first step toward a caller eventually being
tempted to construct a stub for it — and a stub is exactly the trap
this review must not fall into.

**The concrete trap named explicitly: no fake allow-all membership.**
`writeAccess: "restricted"` already exists as a syntactically valid
`FedosConversationPolicy` value (`05`) that the real validator rejects
specifically because no membership authority exists. If a future
change introduced `class AllowAllMembershipAuthority implements
FedosConversationMembershipAuthority { isMember() { return
{outcome:"member", role: "owner"}; } }` and wired it as a default so
that `writeAccess: "restricted"` could be accepted, this would silently
convert "membership-restricted" into "membership-unrestricted" while
the type system continues to claim the opposite — a materially worse
outcome than today's honest rejection. This spec's `05_policy_reuse.md`
explicitly declines to widen the validator until a real authority
exists; this document is the reason why.

## What "real" would require, before this stops being inert

A real implementation needs, at minimum, a persisted
`FedosConversationMembership` record (out of V1, `01`), a chosen
`FedosConversationParticipantRef` variant set (out of V1), and an
answer to the read/write-authority-are-different-axes question SEC §04
raises (`writeAuthority` as its own field, not derived from `role`
alone). None of these are decided by this spec. The interface above is
documentation of a future boundary, not a commitment to its eventual
exact shape.
