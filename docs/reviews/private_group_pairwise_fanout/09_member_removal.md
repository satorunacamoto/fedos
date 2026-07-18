# Review 09 — Member Removal

## Removal excludes from future fanout; it does not, and cannot, deactivate an existing synthetic Conversation

Per `07`, removing a member from the group calls only the group's own
`FedosConversationMembershipAuthority.revoke()`/`.leave()` (unmodified).
The synthetic pairwise Conversation between the remover's counterparts
and the removed member (`06`) is left exactly as it was: still
`"completed"` in its own Activation log. This is not an oversight —
it follows directly from a real, already-verified property of the
unmodified Activation Coordinator: **activation is forward-only and
cannot silently revert** (`docs/secure_runtime_alpha_1111_1180_completion_declaration.md`,
§4: "Crash recovery verified... even after a Membership revocation
that would fail a fresh check — the durable fact, not a live re-check,
is authoritative"). That verified behavior is for the synthetic
Conversation's OWN Membership (the two direct parties), which the
Fanout Coordinator never revokes (`07`) — so this reviewed guarantee
is preserved unchanged, not merely assumed to still hold.

## What removal actually achieves, stated precisely

1. **No future group-fanout message is ever sent to the removed
   member again** — enforced at recipient planning (`05`), which reads
   the group's own roster fresh every send.
2. **The removed member's own synthetic Conversations with every other
   remaining member are unaffected** — this is a consequence of
   fanout's own per-pair independence (`04`/`08`), not a design choice
   this review makes lightly: since each pairwise channel is a fully
   independent Direct Conversation, removing someone from the group
   roster has no mechanism to reach into a DIFFERENT member's own
   local Runtime and revoke anything there.
3. **Already-received fanout messages remain exactly as readable as
   before removal**, for whoever already has them — no retroactive
   erasure is invented or claimed (matching the prior review's own
   `17_epochs_membership.md` "no retroactive erasure claims" finding,
   restated here for fanout specifically).

## The pairwise-key implication, restated honestly

Because each synthetic Conversation's pairwise key derives
deterministically from the Master Seed (`docs/reviews/private_protocol_delivery_group_v1/17_epochs_membership.md`'s
own already-established finding, unchanged here), a removed member
retains the mathematical ability to derive the SAME pairwise key with
every OTHER member they had an active synthetic Conversation with —
group removal is a **roster-membership fact**, never a **cryptographic
revocation**. This must be stated in any future user-facing copy
exactly as bluntly as the prior review already required for Direct
mode: removing someone from a group stops FUTURE fanout sends to them;
it does not and cannot revoke key material they already hold.

## See also

- `07_group_membership_evolution.md`, `10_member_addition.md`
- `19_threat_model.md`
