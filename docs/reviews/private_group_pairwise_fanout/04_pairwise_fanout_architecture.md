# Review 04 — Pairwise Fanout Architecture

## The shape this review recommends: a group container, plus N managed pairwise channels

A `private-group` Conversation continues to exist exactly as
constructed today (Alpha 891–930, unmodified) — it durably holds the
group's own Membership roster, Capability/Invitation state, and
Policy. It **never activates itself** (`03`) and never directly owns
an Envelope. Sitting above it, a new, additive **Fanout Coordinator**
(not designed by any existing file, named here for the first time)
owns the mapping from that one group container to N **real,
independently-activated `direct` Conversations** — one per (local
participant, one other active group member) pair — each constructed,
activated, sent to, and read from using **100% of the existing
Direct-mode pipeline, completely unmodified**:

```
private-group Conversation G (Membership: {A, B, C, D})
    |
    +--> synthetic direct Conversation G::A<->B  (real, activates via
    |    the EXISTING FedosConversationDirectActivationCoordinator,
    |    unmodified; A's Runtime owns this relationship)
    +--> synthetic direct Conversation G::A<->C  (same, unmodified)
    +--> synthetic direct Conversation G::A<->D  (same, unmodified)
```

Sending one logical group message from A means the Fanout Coordinator
calls the existing `sendDirectMessage()` three times — once per
synthetic Conversation — producing three independent Envelopes, three
independent Payloads, exactly as `docs/reviews/private_protocol_delivery_group_v1/16_pairwise_fanout.md`
already specified in the abstract. This document makes that
specification concrete against the now-real Activation/Messaging
layer.

## Why this is the only shape compatible with "do not redesign Conversation Runtime"

Every alternative this review considered and rejected required editing
a frozen file:

- **Widen `FedosConversationDirectActivationCoordinator`'s own mode
  check** to accept `"private-group"` — rejected: this is precisely
  the "Private-Group Gate" `03` confirms is a deliberate, reviewed
  boundary, and widening it would require inventing what "active"
  means for N>2 participants (a shared epoch? A single Envelope
  readable by all?) — exactly the group-key design question this
  review's own rules forbid inventing.
- **Widen `MembershipFedosConversationParticipantResolver`** to
  enumerate N counterparties instead of exactly one — rejected for the
  same reason `docs/reviews/private_protocol_delivery_group_v1/19_dependency_graph.md`
  already named: this is a real Identity-domain code change to a
  frozen file, not an additive layer.
- **Give the Fanout Coordinator its own Envelope/Payload/Encryption
  logic** — rejected: this would duplicate the Encryption/Decryption
  Coordinators' own crash-recovery, retention, and readiness logic
  wholesale, the definition of "redesign" this review's own rules
  forbid.

The synthetic-per-pair-Conversation shape needs **zero changes** to
any of the above — it only needs a new, additive piece of bookkeeping
(`06`) mapping a group id + participant pair to a deterministic
synthetic Conversation id, and a new, additive orchestration loop
(`05`) that calls the existing `create*Draft()` → `activateDirectConversation()`
→ `sendDirectMessage()`/`readDirectMessage()`/`listDirectMessages()`
chain once per active other member.

## What this buys, concretely

Every property the existing Direct-mode pipeline already proves
end-to-end (`03`) — restart survival, tamper evidence, retention
enforcement, revocation denying send/read — is inherited **for free,
per pairwise channel**, with zero new crypto and zero new persistence
format. The Fanout Coordinator's own state is exactly one new mapping
table (`06`) plus orchestration logic; every byte of Envelope/Payload/
Activation data continues to live in the exact same, already-reviewed
persistence backends.

## See also

- `03_runtime_compatibility.md`, `05_recipient_planning.md`,
  `06_conversation_generation_boundaries.md`
- `docs/reviews/private_protocol_delivery_group_v1/16_pairwise_fanout.md`
