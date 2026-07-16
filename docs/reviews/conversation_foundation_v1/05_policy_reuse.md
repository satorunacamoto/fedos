# Review 5 — Policy V1 Reuse

## Subject

The Policy Arc's shipped (unmerged) model, read via
`git show f90ad71:src/board/runtime/policy/fedos_conversation_policy.ts`:

```ts
type FedosConversationDiscoverability = "listed" | "unlisted";
type FedosConversationReadAccess = "public";
type FedosConversationWriteAccess = "public" | "restricted";
type FedosConversationInviteAuthority = "none";
type FedosConversationFederationEligibility = "allowed" | "local-only";

interface FedosConversationPolicy {
  readonly mode: FedosConversationMode;
  readonly discoverability: FedosConversationDiscoverability;
  readonly readAccess: FedosConversationReadAccess;
  readonly writeAccess: FedosConversationWriteAccess;
  readonly inviteAuthority: FedosConversationInviteAuthority;
  readonly federationEligibility: FedosConversationFederationEligibility;
}
```

with `validateFedosConversationPolicy()` rejecting `mode !== "public"`
and `writeAccess === "restricted"`, and a fixed constant
`FEDOS_CONVERSATION_POLICY_PUBLIC_V1`.

## Conclusion: reuse unchanged

This can serve as the canonical Conversation Policy for V1 without
modification. No second policy vocabulary is needed.

### Fields reusable unchanged

All six fields. `mode` already matches `03`'s frozen type exactly.
`discoverability`/`readAccess`/`writeAccess`/`inviteAuthority`/
`federationEligibility` are each closed, small enums that already
express the axes AAR §05 called for, without inventing a new shape.

### Fields needing rename

None. `FedosConversationPolicy` is already named for the Conversation
concept this spec introduces in `03`/`04` — it does not need
retrofitting.

### Fields still inert

- `writeAccess: "restricted"` — syntactically valid, rejected by the
  real validator. Stays inert until `10_membership_boundary.md`'s
  prerequisite (a real membership authority) exists to honor it. This
  spec does not widen the validator.
- `inviteAuthority` — only one legal value, `"none"`, today. Stays
  inert until `12_invitation_capability.md`'s prerequisites are real.
- `mode: "private-group" | "direct"` — inert per `03`; the record and
  policy both accept these values at the type level, neither
  constructs them.

### Persistence authority

The Policy Arc's `StaticFedosConversationPolicyAuthority` returns the
same fixed value for every `(boardId, threadId)` input — there is no
real persistence-backed authority yet, and this spec does not add one.
Per `08_storage_migration.md`, `policyRef` on the V1 Conversation record
is a version tag (`"public-v1"`), not a foreign key into a persisted
policy row, because no per-conversation policy divergence exists to
persist. The Static authority remains the correct implementation for as
long as every conversation legitimately shares one policy value; the
day a second real policy value is needed (e.g. `unlisted` discoverability
actually enforced differently from `listed`), that is the trigger to
replace `StaticFedosConversationPolicyAuthority` with a real persisted
lookup — not before.

### Versioning authority

`policyRef: "public-v1"` is deliberately a string literal tag, not a
number or a foreign key, so that a future second fixed policy value
(e.g. a hypothetical `"public-v2"` if the six-axis shape itself changes)
can be introduced additively — old records keep citing `"public-v1"`
and remain interpretable under the policy the Policy Arc actually
shipped, without a migration rewriting every existing Conversation
record. Ownership of what `"public-v1"` resolves to belongs entirely to
`FedosConversationPolicyAuthority` (today, `StaticFedosConversationPolicyAuthority`)
— the Conversation record itself never embeds policy field values, only
the tag.

### Future private-group/direct migration

When `10`/`11`/`12`'s prerequisites are eventually satisfied, the
migration path is additive, not destructive:

1. `validateFedosConversationPolicy()` gains real acceptance logic for
   `mode !== "public"` once a real membership authority exists to back
   `writeAccess: "restricted"`.
2. `FedosConversationInviteAuthority` gains a second legal value once a
   real capability/redemption authority (`12`) is chosen.
3. A new, real `FedosConversationPolicyAuthority` implementation
   replaces `StaticFedosConversationPolicyAuthority` for conversations
   whose policy actually diverges from the V1 fixed default — existing
   `"public-v1"`-tagged records need no rewrite, since their policy
   never changes underneath them.

No step in this migration requires touching `FedosConversationPolicy`'s
own field names or the V1 Conversation record's shape from `04` — the
reuse is real reuse, not reuse-in-name-only.
