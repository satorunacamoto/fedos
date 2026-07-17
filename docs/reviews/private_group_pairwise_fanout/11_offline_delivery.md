# Review 11 — Offline Delivery

## Confirmed: no offline delivery, queuing, or store-and-forward exists anywhere in the Conversation domain

A direct grep of `src/conversation/` for offline/queue/store-and-forward
concepts returns zero matches. `sendDirectMessage()`'s own result
vocabulary confirms this structurally: its success outcome is literally
named `"sent-locally"`, not `"sent"` or `"delivered"` — the send
result type's own header states this naming is deliberate, "to never
imply network/protocol delivery; this Arc ships no delivery of any
kind" (`src/conversation/messaging/fedos_conversation_direct_message_send_result.ts:6-9`).
Direct-mode messaging today is a **fully local** capability: encrypt,
persist, and — on the SAME device/Runtime instance — read back. There
is no mechanism by which a message reaches a counterparty's own,
different Runtime instance at all.

## What this means for pairwise fanout specifically

Fanout (`04`) inherits this exact limitation, multiplied by N: sending
a group message today means N local `sendDirectMessage()` calls, each
producing a durably-persisted, "sent-locally" Envelope on the
**sender's own machine** — none of which reaches any other
participant's own Runtime without a protocol delivery mechanism this
repository does not have (confirmed unchanged from the prior review's
own exhaustive finding across Nostr/ActivityPub/AT Protocol/Session,
`docs/reviews/private_protocol_delivery_group_v1/02`–`13`). Nothing
about fanout closes this gap or makes it any smaller — if anything, it
makes the eventual transport problem N times larger per logical
message (`docs/reviews/private_protocol_delivery_group_v1/16_pairwise_fanout.md`'s
own already-established "O(N) transport attempts per message" finding).

## Offline delivery is therefore entirely a future Arc's own responsibility, not designed here

Consistent with this review's own instruction not to redesign the
Conversation Runtime, and with the prior review's own delivery-pipeline
specification (`docs/reviews/private_protocol_delivery_group_v1/02_delivery_responsibility.md`
through `13_delivery_storage.md`), this document does not propose an
offline-delivery/queuing mechanism for fanout. Whatever protocol-
delivery Arc eventually builds an Outbox/Publisher/Observation path
for Direct messages (the prior review's own recommended next step,
`docs/reviews/private_protocol_delivery_group_v1/20_normative_next_arc.md`)
would need to run once per synthetic Conversation for a fanout send —
this review names that dependency (`19`'s own dependency graph is
extended by this fact) without designing the mechanism itself.

## See also

- `13_relay_trust_assumptions.md`
- `docs/reviews/private_protocol_delivery_group_v1/09_delivery_eligibility.md`
  through `13_delivery_storage.md`
