# 12 — DM and Private Group Separation

## Common ground

- **Non-public.** Both are gated by the read/write axes of the prior
  review's own six-axis Visibility model (§05 there) — neither is ever
  discoverable via `FedosBoardQuery` (§03's own "do not model DM as a
  Board" finding applies equally to private-group).
- **Membership.** Both require SOME `FedosConversationMembership`-shaped
  record (§04) — even DM's fixed two participants are still membership
  facts, not an implicit property of the conversation existing.
- **Encryption.** Both require the same underlying real primitive §01
  found (AEAD + real conversation-key derivation) — §05's own D
  recommendation (pairwise + group distribution) explicitly unifies
  them: DM is D's degenerate one-pairwise-channel case.
- **Capability.** Both use the same `FedosConversationInvitationCapability`
  shape (§09) for adding a participant — though, per below, DM's own
  "invite" is closer to "propose a conversation" than group's own
  "add a member to an existing one."
- **Retention.** Both are subject to the identical §08 eight-meaning
  deletion framework and the identical §07 storage-boundary
  recommendation (Option B) — no retention distinction between the two
  modes is required by anything found in this review.

## Where they genuinely diverge

- **Member count.** DM is fixed at exactly two, permanently, for the
  life of the conversation (adding a third participant is definitionally
  a DIFFERENT conversation, not a DM that grew — mirrors the prior
  review's own §03 "mode is immutable, start a new Conversation, never
  mutate mode in place" finding); private-group is N ≥ 2 (or, per some
  product conventions, N ≥ 3) and its own membership can grow/shrink
  freely over the conversation's own lifetime.
- **Key distribution.** DM needs exactly one pairwise channel (§05's
  own real, already-implemented ECDH primitive, directly usable with no
  further distribution logic); private-group needs the fuller §05
  Option D (pairwise channels FOR EACH member, used to deliver a shared
  group key) or, per §05's own standards-track recommendation, an
  eventual Sender Key/MLS-shaped scheme — DM has no analog to "removal
  requires re-keying" (§06) at all, since DM has no removal concept
  short of ending the conversation entirely.
- **Membership mutation.** DM's only mutation is the conversation
  itself ending (no partial-membership state is meaningful for exactly
  two people); private-group has the FULL §04/§06 join/leave/revoke/
  role/epoch machinery.
- **Administration.** DM has no admin/owner role distinction — both
  participants are structurally equal (neither can "revoke" the other
  without ending the conversation for both); private-group needs
  `role`/`writeAuthority`/invite-authority/rotation-authority (§04),
  none of which has a meaningful DM analog.
- **History.** DM's history question ("does a returning participant see
  messages sent while they were... what, exactly?") is nearly
  degenerate, since DM has no join-after-creation concept in the normal
  case; private-group's own "new member sees past history or not" (§06)
  is a real, live policy question DM structurally cannot even pose in
  the same way.
- **Identity expectations.** A product may reasonably require DM
  participants to have a MORE stable identity than a private-group
  member (e.g. "you must know this specific person's real identity to
  DM them" vs. "you were invited into a group and might remain
  pseudonymous throughout," §13) — this is a product-policy difference,
  not a structural one, and this review does not mandate either
  direction; named only because §04's own participant-ref union (six
  variants after this review's own device-identity addition) makes
  BOTH postures expressible without a structural change.

## Is member-count = 2 sufficient to define DM?

**No — evaluated and found insufficient on its own, though a necessary
condition.** Member count alone cannot distinguish "a private-group
that currently happens to have exactly two members" from "a DM" — the
two have different KEY DISTRIBUTION shapes (§05: DM's pairwise channel
vs. group's key-distributed-over-pairwise-channels, which happen to
coincide in the N=2 case but diverge the moment a group either shrinks
to 2 temporarily or was designed for growth from the start), different
ADMINISTRATION models (a 2-member group still has an owner/admin
distinction DM structurally lacks), and different MEMBERSHIP MUTATION
semantics (a 2-member group can still ADD a third member; a true DM,
per the immutable-mode finding above, cannot become a group without
becoming a NEW conversation). **`FedosConversationMode` (prior review's
own §04, `"direct"` vs. `"private-group"`) is therefore the correct,
independent discriminant — never derived from `participants.length`,
even though `direct`'s own participant count happens to always equal
two.** This mirrors the prior review's own §04 finding almost exactly,
reapplied here with the concrete key-distribution/administration
reasons this review's own §05/§06 investigation adds.

## See also

- `docs/reviews/private_conversation_security/04_membership_authorization.md`
- `docs/reviews/private_conversation_security/05_key_distribution.md`
- `docs/reviews/board_runtime_application_api_04_conversation_mode_model.md`
