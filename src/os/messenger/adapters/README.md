# `src/os/messenger/adapters/` — mixed: real code + a reserved subtree

Two different things live under this one directory, both legitimately named
"adapter" but adapting different boundaries — keep them straight:

## 1. Port adapters (real, working code, present today)

- `messaging_port_adapter.ts` — implements `MessagingPort`
  (`src/os/core/ports/messaging_port.ts`) by delegating to the real, unmoved
  `FedosConversationDirectMessagingCoordinator`
  (`src/conversation/messaging/fedos_conversation_direct_messaging_coordinator.ts`).
- `conversation_port_adapter.ts` — implements `ConversationPort`
  (`src/os/core/ports/conversation_port.ts`) by delegating to the real,
  unmoved `FedosPrivateConversationConstructionCoordinator` +
  `FedosConversationMembershipAuthority`.
- `notification_port_adapter.ts` — implements `NotificationPort`
  (`src/os/core/ports/notification_port.ts`) by delegating to the real,
  unmoved `FedosDesktopNotificationCoordinator`
  (`src/desktop/notification/fedos_desktop_notification_coordinator.ts`).

These are the proof that a consumer (`os/commerce`, in a later arc) can
depend on `os/core/ports/*` today without waiting for the physical file
move — every adapter here imports the real coordinator classes via a
relative path back into their still-current `src/conversation/**` /
`src/desktop/notification/**` locations, exactly as they will keep working
after those files eventually move (only the relative path changes, not the
adapter's own logic).

See `test/architecture_boundary_adapter_port_shapes.test.ts` for the
type-level check that each adapter class satisfies its Port interface.

## 2. `nostr/` — RESERVED, migration target (not a Port adapter)

`adapters/nostr/` is NOT a Port adapter — it is the proposed new home for
this repo's own low-level Nostr protocol code, once physically moved:
`src/nostr/**` + `src/conversation/delivery/nostr/**` +
`src/conversation/transport/**`. See its own README.

RESERVED (for the `nostr/` subtree only) — physical migration deferred to a
follow-up arc; see `docs/architecture/MESSENGER-MIGRATION-MAPPING.md`.
