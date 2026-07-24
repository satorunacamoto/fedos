# Review 08 — History Semantics

## There is no single "group history" — there are N independent pairwise histories, unioned at read time

`listDirectMessages()` (`src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts:166-188`)
already establishes, for plain Direct mode, that message ordering is
**"deterministic LOCAL ordering only... never implies protocol/global
ordering"** (`createdAt` ascending, Envelope-id tie-break, comment
lines 173-174). Pairwise fanout (`04`) inherits this exactly, once
per synthetic Conversation: what a group member perceives as "the
group's history" is the **local union** of every message the local
Runtime has itself sent or received across every synthetic Conversation
belonging to that group, ordered the same deterministic way — never a
single canonical Envelope stream, and never a claim that any two
members' own local views are identical or synchronized.

## Concrete consequence: two members can observe different "group histories" that never converge automatically

Because each synthetic Conversation is a genuinely separate Direct-mode
pipeline (`04`), member A's own local history for the group is built
from A's own N synthetic Conversations (one per other active member A
has exchanged fanout messages with); member B's own local history is
built from B's own N synthetic Conversations. If A sent a fanout
message to B and C but the send to D failed (`05`), B's and C's own
local histories include it; D's does not, and nothing in this
architecture automatically reconciles that gap later — D would need a
fresh application-level resend, which this review does not design (no
delivery-retry/reconciliation mechanism is invented here; `11`/`19`).

## Read authorization is per-synthetic-Conversation, unchanged

`readDirectMessage()`'s own authorization check (`src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts:137-141`,
unmodified) requires active local Membership **on that specific
synthetic Conversation** — a group member who was never part of a
given pairwise exchange (e.g., joined the group after it happened,
`10`) has no synthetic Conversation with the original participants at
all, and therefore no path to read it, which is the correct, honest
default (matching the prior review's own `17_epochs_membership.md`
"new-member history policy" finding: no retroactive access).

## What this review does not claim

No claim of a single, ordered, cross-member-agreed "group timeline"
exists or is proposed. No claim that history is complete or
tamper-evident across the whole group — only that each individual
synthetic Conversation's own Envelope stream is exactly as
tamper-evident as Direct mode already proves (`03`, restart/tamper
verification). Any future group-history reconciliation UI must present
this honestly as "your own local view," never as "the group's history."

## See also

- `07_group_membership_evolution.md`, `10_member_addition.md`
- `14_local_canonical_history.md`
- `docs/reviews/private_protocol_delivery_group_v1/17_epochs_membership.md`
