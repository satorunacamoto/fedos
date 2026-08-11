# `src/os/messenger` — the real, live Messenger capability

**This is the canonical, current location of the Messenger capability's
source.** The physical migration this README used to describe as pending
is complete: every messenger file the repo ships lives here today. The
older locations (`src/conversation/`, `src/board/`, `src/desktop/**`
messenger-related files, `src/device/`, `src/nostr/`) are now thin
**compatibility shims** — each old file is a one-line `export * from
"../../os/messenger/<new-path>.js"` re-export (most marked
`@deprecated`), kept only so any not-yet-repointed importer keeps working.
New code should import from this tree directly, never from an old shim
path. See `docs/architecture/COMPATIBILITY-FACADE-LIFECYCLE.md` for the
shim-retirement policy and `docs/architecture/MESSENGER-MIGRATION-MAPPING.md`
for the historical old-path → new-path record of how this move happened.

(Corrected from this file's own prior text, which — stale since the
physical migration landed — claimed "no production code has been
physically moved here yet." That was true when originally written; it is
not true today. If you find another doc making the same stale claim about
this tree, it needs the same correction.)

## Subdirectories

- `conversations/` — Direct/Group conversation domain: activation,
  encryption/ratchet, delivery, archive, outbox, deletion requests, and
  more. The largest subtree here.
- `contacts/` — the "who is this counterparty" seam; the actual identity
  resolution logic is nested inside `conversations/encryption/identity/**`
  (see that directory's own README for why).
- `device/` — device pairing/trust/registration.
- `board/` — the federated/social sub-capability (not a DM feature; lives
  inside `os/messenger` by design, not `os/commerce`).
- `adapters/` — Port adapters (`messaging_port_adapter.ts`,
  `conversation_port_adapter.ts`, `notification_port_adapter.ts`) that let
  other capabilities (e.g. `os/commerce`) depend on `os/core/ports/*`
  without reaching into Messenger internals, plus `adapters/nostr/` (the
  Nostr protocol/event/relay layer).
- `notifications/` — the live desktop notification coordinator.
- `desktop/` — the Electron-facing composition/runtime layer.
- `sync/` — cross-device sync.
- `onion/` — reserved seam, still empty. No Tor/onion implementation
  exists anywhere in this repo today (design-notes docs only) — see its
  own README.

## Dependency rule

Messenger must never import `src/commerce`, `src/payment`, `src/marketplace`,
`src/creator`, or `src/os/commerce`. It may be *consumed* by commerce code
only through the neutral seams in `src/os/core/ports/*`
(`MessagingPort`, `ConversationPort`, `NotificationPort`) — never by a
commerce file importing a messenger-internal type directly. See
`docs/architecture/MESSENGER-ARCHITECTURE.md` for the full picture.

`test/architecture_boundary_messenger.test.ts` enforces the "messenger
never imports commerce" half of this rule mechanically.
