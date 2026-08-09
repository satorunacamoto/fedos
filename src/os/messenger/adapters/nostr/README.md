# `src/os/messenger/adapters/nostr/` — RESERVED

Maps from three current locations (57 files total):

- `src/nostr/**` (12 files — event/crypto/relay/signature/message types and
  the signing authority; this repo's own low-level protocol primitives, no
  third-party Nostr SDK anywhere) → `protocol/`
- `src/conversation/delivery/nostr/**` (24 files, including its `nip17/`
  subfolder — the NIP-17/NIP-59 gift-wrap/seal private-delivery wire
  adapter) → `conversation_delivery/`
- `src/conversation/transport/**` (21 files, including its `relay/`
  subfolder — publish scheduling, outbox, relay set/dedup) → `transport/`

Three separate subfolders rather than one flat merge, because the three
source trees don't share filenames and have distinct internal purposes
(low-level protocol vs. private-delivery wire format vs. transport/outbox
plumbing) — flattening them would only create accidental naming risk with
no benefit.

Note: `src/commerce/bridge.ts` and `src/commerce/classify.ts` already
import `NostrEvent` from `src/nostr/types.ts` today (2 files, pre-existing,
found during this arc's audit) — a real, currently-live dependency from
commerce code straight into what will become `protocol/`. This is flagged
in `docs/architecture/MESSENGER-ARCHITECTURE.md` as a boundary violation the
physical migration needs to resolve (most likely: `os/core` grows a
protocol-neutral event-shape type commerce depends on instead, or commerce
consumes it through a Port) — it is a pre-existing fact, not something this
scaffolding pass changes or fixes.

RESERVED — physical migration deferred to a follow-up arc; see
`docs/architecture/MESSENGER-MIGRATION-MAPPING.md` for the full mapping.
