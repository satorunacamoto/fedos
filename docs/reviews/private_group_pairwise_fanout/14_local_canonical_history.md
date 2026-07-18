# Review 14 — Local Canonical History

## There is no canonical history — "canonical" is explicitly disclaimed by the one existing precedent this rests on

`listDirectMessages()` (`src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts:165-176`)
already carries this exact disclaimer in its own comment: **"deterministic
LOCAL ordering only... never implies protocol/global ordering"** —
sorted `createdAt` ascending with Envelope-id as a stable tie-break,
computed fresh from whatever this one Runtime instance's own
`FedosConversationMessageEnvelopePersistence` currently contains. There
is no consensus mechanism, no vector clock, no logical clock
reconciling multiple devices' or multiple participants' own views —
"canonical" in this document's own title means **"the one deterministic
ordering a single local Runtime instance produces from its own
persisted state,"** not "the one true order all participants agree
on."

## For fanout specifically: local history is a union across synthetic Conversations, deterministically merged the same way

Per `08`, a group member's perceived "group history" is the union of
Envelopes across all of that member's own synthetic per-pair
Conversations (`06`). This document specifies the merge: apply the
exact same `createdAt`-ascending, Envelope-id-tie-break ordering
`listDirectMessages()` already uses, across the UNION of Envelopes from
every synthetic Conversation belonging to the group, rather than
inventing a second ordering rule. This keeps the merge a pure,
stateless recombination of already-real per-Conversation orderings —
no new sort key, no new tie-break rule, no new persistence format.

## Why "local" must stay in every user-facing description of this feature

Because `createdAt` is caller/sender-supplied (via each Coordinator's
own `clock`, not a receiver-verified timestamp) and no cross-device
clock synchronization exists anywhere in this codebase, two different
members' own local histories for the identical set of fanout messages
can legitimately disagree on relative order for near-simultaneous sends
from different senders — this is not a bug to fix; it is the honest
consequence of "local ordering only" applied across multiple
independent senders. Any future UI surfacing a "group timeline" must
describe it as this Runtime's own reconstruction, never as an
authoritative, agreed-upon sequence.

## Relationship to backup (`15`)

A "local canonical history" is exactly the thing a future backup
mechanism (`15`) would need to preserve per device — since it is
locally computed from durable Envelope/Payload/Activation state already
persisted, backing up the underlying persistence files (or their
append-only logs) is sufficient to reconstruct the identical local
history on restore; no separate "history snapshot" format needs
inventing.

## See also

- `05_recipient_planning.md`, `08_history_semantics.md`
- `15_backup_model.md`
