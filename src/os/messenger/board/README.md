# `src/os/messenger/board/` — RESERVED

Maps 1:1 from: `src/board/` (85 files) — public Nostr/ActivityPub/AT-proto
posting: `activitypub/`, `atproto/`, `observation/`, `outbox/`,
`persistence/`, `publish/`, `query/`, `repository/`, `runtime/`, `session/`.

This is federated **social** posting, not direct messaging. Per the
product decision already on record, it stays inside `os/messenger` as
Messenger's own social/federated sub-capability rather than becoming a
separate `os/` top-level capability.

Note for the staging arc: `src/conversation/**` already imports board types
directly today (e.g. `FedosBoardReader`, `FedosBoardId` — measured 45
external files import something under `board/`, most of them inside
`conversation/`). That is an intra-messenger dependency (`conversations/` →
`board/`), not a boundary violation — both stay inside `os/messenger` — but
it affects move order: see
`docs/architecture/MESSENGER-MIGRATION-STAGING.md`.

RESERVED — physical migration deferred to a follow-up arc; see
`docs/architecture/MESSENGER-MIGRATION-MAPPING.md` for the full mapping.
