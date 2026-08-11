# `src/os/messenger/notifications/` — RESERVED

Maps 1:1 from: `src/desktop/notification/` (3 files) — the LIVE desktop
notification coordinator (`fedos_desktop_notification_coordinator.ts`,
`fedos_desktop_notification_port.ts`, `fedos_desktop_notification_types.ts`).

This is explicitly NOT the dormant top-level `src/notification/` directory
— that one is out of this arc's scope and is being quarantined separately
by a different agent in this same arc. Do not confuse the two: this
directory's real, already-working `NotificationPort` adapter
(`../adapters/notification_port_adapter.ts`) delegates specifically to
`src/desktop/notification/fedos_desktop_notification_coordinator.ts`.

RESERVED — physical migration deferred to a follow-up arc; see
`docs/architecture/MESSENGER-MIGRATION-MAPPING.md` for the full mapping.
