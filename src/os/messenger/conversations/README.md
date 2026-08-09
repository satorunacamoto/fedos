# `src/os/messenger/conversations/` — RESERVED

Maps from: `src/conversation/` (377 of its 422 files; the remaining 45 —
`delivery/nostr/**` and `transport/**` — map to `../adapters/nostr/`
instead, see that directory's README).

Kept as ONE cohesive bucket, matching the real structure: construction,
readiness, membership, encryption, envelope, ratchet (+ persistence,
peer_capability), group (pairwise fanout), payload_storage, persistence,
archive (+ archive_cli), search, retention, deletion, deletion_request,
capability, activation, identity_transition, invitation (+
invitation_bootstrap), messaging. These subtrees import each other
extensively (e.g. `messaging/fedos_conversation_direct_messaging_coordinator.ts`
alone pulls from envelope, construction, membership, encryption/identity,
encryption, retention, payload_storage, activation, transport, ratchet, and
delivery/nostr/nip17) — splitting them into separate top-level buckets would
not reduce coupling, only rename it across a longer relative-import path.

One exception, carved out here rather than left in place: `encryption/identity/**`
(5 files — the participant/identity/counterparty/key resolvers) is
documented as a candidate for a top-level `contacts/` bucket in this arc's
own kickoff prompt, but stays nested here — see `../contacts/README.md` for
the fan-in numbers behind that call.

RESERVED — physical migration deferred to a follow-up arc; see
`docs/architecture/MESSENGER-MIGRATION-MAPPING.md` for the full file-by-file
mapping and `docs/architecture/MESSENGER-MIGRATION-STAGING.md` for the
proposed move order.
