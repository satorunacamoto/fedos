# `src/os/messenger` — RESERVED (scaffolding only)

This tree is the target layout for the FedOS Messenger capability under the
`os/` modularization. **No production code has been physically moved here
yet.** Every messenger file the repo actually ships still lives at its
original location under `src/conversation/`, `src/board/`, `src/desktop/`,
`src/device/`, `src/nostr/` — see
`docs/architecture/MESSENGER-MIGRATION-MAPPING.md` for the complete,
mechanical old-path → new-path mapping and
`docs/architecture/MESSENGER-MIGRATION-STAGING.md` for the order a future
arc should execute that move in.

What exists here today, real and working:

- `adapters/messaging_port_adapter.ts`, `adapters/conversation_port_adapter.ts`,
  `adapters/notification_port_adapter.ts` — real `Port` adapters that
  delegate to the actual, unmoved messenger coordinators via relative
  imports back into their current `src/conversation/**` /
  `src/desktop/notification/**` locations. These are the proof that a
  consumer (e.g. `os/commerce`) can depend on `os/core/ports/*` today
  without waiting for the physical file move.
- One `README.md` per subdirectory below, each naming exactly what old path
  maps there.

Everything else under this tree is an empty, reserved directory.

## Subdirectories

- `conversations/` — from `src/conversation/**` (see its own README for the
  two carved-out exceptions: `delivery/nostr/**` and `transport/**`, which
  map to `adapters/nostr/` instead).
- `contacts/` — reserved pointer only; the real "who is this counterparty"
  code stays nested at `conversations/encryption/identity/**`. See that
  directory's README for the fan-in analysis behind this call.
- `device/` — from `src/device/**`.
- `board/` — from `src/board/**` (federated/social sub-capability; stays
  inside `os/messenger`, is not a DM feature).
- `adapters/nostr/` — from `src/nostr/**` + `src/conversation/delivery/nostr/**`
  + `src/conversation/transport/**`.
- `notifications/` — from `src/desktop/notification/**` (the live
  notification coordinator — not the dormant top-level `src/notification/`,
  which a different agent is quarantining separately).
- `desktop/` — from the rest of `src/desktop/**` (the Electron-facing
  composition layer).
- `onion/` — empty, reserved seam. No Tor/onion implementation exists
  anywhere in this repo today (design-notes docs only) — see its own
  README.

## Dependency rule

Messenger must never import `src/commerce`, `src/payment`, `src/marketplace`,
`src/creator`, or `src/os/commerce`. It may be *consumed* by commerce code
only through the neutral seams in `src/os/core/ports/*`
(`MessagingPort`, `ConversationPort`, `NotificationPort`) — never by a
commerce file importing a messenger-internal type directly. See
`docs/architecture/MESSENGER-ARCHITECTURE.md` for the full picture,
including one already-existing pre-migration violation of this rule that the
physical move needs to resolve (`src/commerce/bridge.ts` and
`src/commerce/classify.ts` currently import `NostrEvent` straight from
`src/nostr/types.ts`).

`test/architecture_boundary_messenger.test.ts` enforces the "messenger never
imports commerce" half of this rule mechanically today, against both the
current live locations and this new `src/os/messenger/**` tree.
