# Review 16 — Pairwise Fanout as Interim Group Mode

## Can B be an honest, limited V1? Yes, with four explicit constraints

**One separately encrypted payload per active recipient.** Concretely:
`FedosConversationEncryptionCoordinator.encrypt()` called once per
active other-member, each call resolving that specific member's own
`counterpartyPublicKeyHex` via the existing
`resolveFedosConversationCounterpartyPublicKeyHex()`
(`fedos_conversation_counterparty_public_key_resolver.ts:48`) — the
function itself needs no change; only the caller that currently stops
at exactly one counterparty (`MembershipFedosConversationParticipantResolver`,
`14`) needs a sibling that enumerates N. This produces N distinct
Envelopes (distinct `id`, same `conversationId`, same logical message
content) and N distinct ciphertext Payloads — never one Envelope
shared across recipients, because the Envelope's own
`senderMembershipId`/AAD-bound fields (`03`, associated-data header)
are per-recipient-channel-bound by the pairwise key itself.

**No shared group key of any kind.** Explicit, load-bearing constraint:
this mode must not, at any point, generate, store, or transmit a
secret shared by more than two parties (sender + one recipient). This
is what keeps B a zero-new-primitive extension (`15`) rather than a
quiet reintroduction of D's own group-key requirement through the back
door.

**Explicit size/recipient limit, named as a policy decision, not
invented cryptography.** This review does not pick a specific number —
that is a product/performance decision for whoever adopts this
recommendation — but names the requirement explicitly: a
`private-group` Conversation adopting B must have its Membership
Authority (or a new policy check ahead of the fanout call) enforce a
**fixed maximum active-member count**, because every additional
recipient is one more full `encrypt()` call, one more Envelope, one
more Payload, and (per `05`) one more observably-distinct delivery
event to whatever protocol eventually carries it. Unbounded fanout is
not a scalability nice-to-have; past some N it silently reintroduces
the same "unbounded work per message" problem SEC §05 already flagged
for Option B in the abstract.

**No Sender Key claim.** B must never be described, in any README,
completion declaration, or user-facing text, as "Sender Key" or as
providing Sender Key's own real advantage (each sender's messages
verifiable/decryptable via one shared per-sender key, without needing
a distinct ciphertext per recipient). B is strictly N independent
pairwise conversations sharing the same logical message content — an
observer correlating N simultaneous deliveries from the same sender
could infer group membership size directly (a `05`-adjacent metadata
cost, restated here because it is specific to B: **the group's own
member count becomes directly observable as the fanout count**, a cost
D's own single-group-key-distribution shape does not share to the same
degree once initial distribution completes).

**New-participant history policy explicit.** A member added after N
prior fanout messages were sent has **no path to those messages** under
B — each was encrypted only to the pairwise keys of members active at
send time, and re-encrypting historical Envelopes for a new member
would require access to the original plaintext, which by design no
component retains once sealed (Coordinator persists only ciphertext,
`01`/`13`). This must be stated to users as an explicit, permanent
limitation of joining an existing private-group Conversation under
B — never silently implied as "history syncs once you join."

## Scalability and metadata costs, stated plainly

- **Cost**: O(N) `encrypt()` calls, O(N) Envelopes, O(N) Payloads, and
  (once protocol delivery exists) O(N) transport attempts **per single
  logical message** — linear in group size, unlike D's O(1)-per-message
  shape once its own group key is distributed.
- **Metadata**: per `05`'s framing applied to groups specifically — N
  simultaneous outbound deliveries from one sender, observable to any
  relay/server that sees more than one of them, directly reveals a
  lower bound on group size even though each individual payload's
  content remains confidential.

## See also

- `14_group_crypto_inventory.md`, `15_group_strategy.md`, `17_epochs_membership.md`
- `05_nostr_metadata_leakage.md`
