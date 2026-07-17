# Review 12 — Expiration Strategy

## Confirmed: `expiresAt` exists only on Capability and Invitation — never on a Message or Envelope

A direct search of `src/conversation/` for `expiresAt`/`expiry`/`TTL`
finds it in exactly two places, both unrelated to message content:

- `FedosConversationCapabilityDescriptor.expiresAt: number | null`
  (`src/conversation/capability/fedos_conversation_capability_descriptor.ts:47`),
  enforced at redemption time
  (`fedos_conversation_capability_redemption_authority.ts`,
  `coordination/fedos_conversation_durable_redemption_coordinator.ts:135`:
  `if (record.expiresAt !== null && now > record.expiresAt) return { outcome: "expired" }`).
- Invitation's own `expiresAt` (`src/conversation/invitation/fedos_conversation_invitation_transport.ts:69,111`,
  present on the `50082bc` sibling branch, inspected via `git show`,
  not this worktree's own checked-out `src/`) — the transport's own
  header explicitly states it adds no NEW expiry logic, only surfaces
  the Capability redemption authority's own pre-existing `"expired"`
  outcome.

A dedicated search of `src/conversation/envelope/` finds **zero**
`expiresAt`/`expiry`/`TTL` references. The Envelope/Payload domain has
only **retention** (tombstone-based deletion, `src/conversation/retention/`,
Alpha 796–811) — a fundamentally different, decision-triggered
mechanism, not a time-based one.

## Recommendation: fanout invents no new expiration concept for messages

A fanout-sent Envelope should carry **no expiration of its own** —
it should be governed by exactly the same retention model every
Direct-mode Envelope already uses (`fedos_payload_retention_authority.ts`,
unmodified): a payload is `"active"` until an explicit retention
decision (`"tombstoned"`, then optionally `"payload-removed"`) is
recorded against it, never a passive time-based expiry. Inventing a
per-message TTL for fanout specifically would introduce a second,
parallel deletion semantics alongside the existing retention model this
review's own rules (do not redesign, minimize ripple) argue against.

## Where expiration DOES matter for fanout, unchanged from existing mechanisms

**Invitations to join the group** already expire via the existing,
unmodified Capability/Invitation `expiresAt` mechanism — this applies
to a private-group Conversation's own invitations exactly as it does
today, with zero change. **Synthetic per-pair Conversations themselves
(`06`) have no expiration** — once activated, a synthetic Conversation
remains active indefinitely, exactly like any hand-constructed Direct
Conversation, matching the Activation Coordinator's own forward-only,
non-revertible design (`09`).

## Explicit refusal to invent

This review does not design a message-level expiration/disappearing-
message feature — doing so would require new retention-decision
semantics (e.g. an automatic, time-triggered tombstone) this
repository's own retention model does not currently support (every
existing retention decision is explicit and caller-triggered,
`fedos_payload_retention_decision.ts`'s own `reasonCode` vocabulary has
no "expired" value). Naming this as a possible future extension,
without designing it, is the correct scope for this document.

## See also

- `08_history_semantics.md`, `15_backup_model.md`
- `docs/reviews/private_conversation_security/08_deletion_retention.md`
