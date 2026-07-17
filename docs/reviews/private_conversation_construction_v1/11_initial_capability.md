# Review 11 — Initial Capability

## Should private-group construction automatically issue one join Capability?

**Recommendation: yes, optionally, caller-controlled by presence of
`initialCapability` on `04`'s command — never unconditional.**

Reasoning: `FedosConversationCapabilityIssuerAuthority.issueJoinCapability()`
(`src/conversation/capability/fedos_conversation_capability_issuer_authority.ts`)
already exists, is real, and already supports `intendedRecipient: null`
("a general (any redeemer) capability") — exactly the shape a
private-group creator would want for "anyone I share this bearer secret
with may join." Making issuance UNCONDITIONAL would violate this
Arc's own documented constraint that the Issuer Authority's
`FedosConversationCapabilityIssuanceAuthorizationCheck` "carries NO
default production implementation... an always-true injected check is
an honestly-labeled TEST convenience, never a default this file itself
supplies" — construction auto-issuing a Capability with no real
authorization check wired would silently manufacture exactly that
forbidden default. Making it caller-OPTIONAL keeps the decision, and
the responsibility for wiring a real authorization check, in the
caller's hands.

## Direct Conversation requires intended-recipient binding — always

`05`'s own structural analysis ("exactly two initial participants")
means a `direct` Conversation, if it issues a Capability at all, MUST
set `intendedRecipient` to the named recipient — `null` (a general,
any-redeemer Capability) would let a THIRD, uninvited party redeem it,
directly contradicting `05`'s own enforced "exactly two" invariant.
This review recommends `direct` construction NOT go through Capability
issuance at all for the common case — see below.

## Two admission paths for the direct recipient — compared

**Path A — Capability-mediated.** Construction issues one
`intendedRecipient`-bound Capability; the named recipient later
redeems it via `FedosConversationCapabilityRedemptionAuthority.redeem()`
(or the Durable Redemption Coordinator, `10`), which itself calls
`FedosConversationMembershipAuthority.admit()` on success. Matches the
EXISTING, ALREADY-SHIPPED redemption flow exactly — no new admission
code needed, only a new caller of the existing Capability Issuer.

**Path B — direct admission.** Construction calls
`FedosConversationMembershipAuthority.admit()` for the recipient
DIRECTLY, at construction time, with no Capability involved at all —
the same call pattern `06` already establishes for the creator.

**Recommendation: Path B for `direct`, Path A remains the (optional)
mechanism for `private-group`.** A `direct` conversation's recipient
is NAMED by the creator at construction time (`05`'s own command
shape: `recipient` is a required field, not an invitation target) —
there is no "share a link with whoever" use case for exactly two named
people the way there is for a group. Requiring a redemption round-trip
for a recipient the creator already identified by public identifier
would be unnecessary indirection with no security benefit: the
`intendedRecipient` check inside `redeem()` (`fedos_conversation_capability_redemption_authority.ts`'s
own responsibility list) exists to verify "the redeemer IS who the
issuer intended" — but for `direct` mode, construction is already
supplied that exact identity directly, with no untrusted redemption
step in between to protect against. Path B is simpler, has fewer
durable writes, and reaches the identical end state (two active
Memberships, `06`'s deterministic idempotency intact).

`05` is updated by this finding: `CreateDirectConversationCommand`'s
recipient is admitted via a SECOND `admit()` call (role: recommend
`"owner"` for symmetry, since `05` already found neither role
distinction is materially meaningful for a two-person conversation —
a future Arc may instead choose `"member"`, a product decision this
review does not force), not via Capability at all in the common case.

## No bearer in Conversation metadata — restated as an enforced structural fact, not a promise

`FedosConversationCapabilityBearerSecret` is a SEPARATE opaque type
(`src/conversation/capability/fedos_conversation_capability_bearer_secret.ts`),
never a field on `FedosConversationCapabilityDescriptor`
(confirmed by that file's own header: "never stored on
`FedosConversationCapabilityDescriptor`... never on
`FedosConversationRecord`") and, by direct inspection, `FedosConversationRecord`
(`src/conversation/fedos_conversation_record.ts`) has no field capable
of holding a string secret of any kind — its full field set (`id`,
`mode`, `boardId`, `rootThreadId`, `rootPostId`, `policyReference`,
`createdAt`) is closed and none is secret-shaped. A future
construction implementation inherits this guarantee for free — there
is no field to accidentally misuse.

## Capability issuance result surfaced, never hidden

`10`'s own coordination-fact recommendation records the issued
`capabilityId` on the fact itself for idempotency; the CALLER-FACING
result (`04`'s `CreatePrivateGroupConversationResult.capability`)
carries the descriptor plus the bearer secret through the SAME
one-time channel `FedosConversationCapabilityIssuanceResult`'s own
`"issued"` case already establishes — the bearer secret is returned
exactly once, at issuance time, never re-derivable from
`inspectDescriptor()` afterward (that method's own contract, confirmed
in `01`, returns only the non-secret descriptor).
