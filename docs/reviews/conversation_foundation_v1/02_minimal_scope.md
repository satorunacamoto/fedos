# Review 2 — Minimal V1 Scope

## Options compared

**Option A — Public Conversation Policy only.**
Ship nothing beyond what the Policy Arc already built: reuse
`FedosConversationPolicy`/`FedosConversationMode` as-is, add no new
identity or record type. Leaves Review 3/4's own questions (Conversation
ID, Conversation Record) unanswered — policy resolution stays keyed by
a raw `(boardId, threadId)` tuple indefinitely, which is the very gap
`01_decision_reconciliation.md` flags as a contradiction against both
prior design reviews. Smallest possible diff, but does not advance
anything; the next Arc after this one would face the identical
"introduce a Conversation identity" decision with no more information
than exists today.

**Option B — Public + inert private/direct vocabulary.**
Add no persisted Conversation record at all; only extend type-level
vocabulary (mode/policy enums already do this — `"private-group"` and
`"direct"` already exist as unconstructable string literals in POL's
`fedos_conversation_mode.ts`). This option is close to already
satisfied by the current state and does not create the one thing
Review 4 asks this spec to specify: an actual immutable Conversation
record with a real `id` and `createdAt`. Choosing B would mean this
review answers Review 3/4 with "no record, not yet" — defensible, but
it leaves every future Arc (membership, invitation, private envelope)
with nothing to hold a foreign key against.

**Option C — Conversation records for all modes, but messages public
only.**
Introduce a real, persisted `FedosConversationRecord` (id, mode,
`createdAt`, root Board/Thread reference, policy reference — see
`04_conversation_record_v1.md`) whose `mode` field is typed to accept
any of the three `FedosConversationMode` values, but whose only
**constructible** value in V1 is `"public"` — mirroring the exact
discipline already used for `FedosConversationMode`/
`FEDOS_CONVERSATION_POLICY_PUBLIC_V1` itself (the type says three
things are possible; the validator says only one is real). Messages
remain ordinary `FedosBoardPost` values; no ciphertext, no envelope, no
membership, no invitation. This gives every later Arc (membership,
capability, private envelope) a stable, already-existing identity to
attach to, with zero schema migration required when private modes
become real — the record shape does not change, only which mode values
a future validator accepts.

**Option D — Private message envelope immediately.**
Build `11_private_message_envelope.md`'s shape as real, working code
now. Rejected outright: this is precisely the "pretending private
encryption... already exists" the task's own objective forbids. Every
prerequisite in `07_private_readiness_gate.md` (membership authority,
encryption authority, key distribution, private storage) is currently
absent or blocked; building the envelope first would produce a type
that "looks encrypted" while carrying no real ciphertext guarantee —
exactly the risk SEC §19 names explicitly: *"an unencrypted
`FedosConversationMessage` sitting in Storage looks identical in TYPE
to an encrypted one unless the crypto wiring is also complete."*

## Recommendation: Option C

Option C is the smallest scope that gives Review 3 and Review 4 a real
answer without faking anything private:

- It does not implement membership, invitation, encryption, or a
  private message — none of those become constructible in V1, and
  nothing in the public code path changes shape to accommodate them
  later.
- It resolves the Conversation ID contradiction from
  `01_decision_reconciliation.md` by giving policy resolution (and
  everything downstream of it) a real identity to be keyed by, instead
  of a raw tuple.
- It reuses the Policy Arc's `FedosConversationPolicy` unchanged (per
  `05_policy_reuse.md`) rather than inventing a second policy
  vocabulary.
- It matches AAR §15's own "largest safe single-Arc unit" reasoning
  (Command Foundation + Conversation Identity + Visibility Policy
  together) for exactly the same reason AAR gave: Conversation Identity
  alone, with no record to persist it in, would leave the identity
  concept implicit and un-referenceable by any future membership or
  capability record.

Option A is rejected as leaving Review 3/4 unanswered. Option B is
rejected as materially indistinguishable from the status quo. Option D
is rejected as the exact failure mode this review exists to prevent.
