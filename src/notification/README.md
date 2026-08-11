# `src/notification/` — generic, forward-looking notification seam (Stage 39)

## Status: live, not yet capability-classified

This directory was almost quarantined into `src/os/_legacy_prototype/` during
the OS Capability Modularization arc, on the assumption it was leftover
pre-pivot "nostr-window" scaffolding like `chat/`, `community/`, etc. That
assumption was wrong and was corrected mid-arc — see
`src/os/_legacy_prototype/README.md` for the full story.

What this directory actually is: a generic, desktop-agnostic seam for a
**future external push transport** (Telegram/LINE/APNs/FCM/Email), built as
FedOS-native "Stage 39" infrastructure — not inherited from the dead
Cloudflare Workers product. It sends nothing today; every channel in
`NotificationChannel` is an explicit `*_placeholder`.

## Contents

- `types.ts`, `policy.ts`, `noop_notification.ts` — pure, no dead-prototype
  coupling. `policy.ts`'s `isSensitiveNotificationField` has a real, live
  consumer: `src/desktop/notification/fedos_desktop_notification_types.ts`
  reuses it for its own `detail`-field validation (a deliberate, narrow,
  `eslint-disable`-marked exception — see that file's header).
- `bridge.ts` is **not** here — it composes this seam's payload shape with
  domain event types (`ChatRoom`, `SpaceBase`, `Product`) from the dead
  prototype and the commerce scaffolding, and has no live consumer itself,
  so it was quarantined to `src/os/_legacy_prototype/notification/bridge.ts`
  along with the rest of that dead product.

## Not yet assigned to a capability

This arc did not physically move this directory into `os/core`,
`os/messenger`, or `os/commerce` — it stayed at its original location to
avoid a second unplanned move mid-arc. It is a reasonable candidate for
`os/core` (a generic transport/notification contract, conceptually close to
`os/core/ports/notification_port.ts`) in a follow-up arc, once a decision is
made about whether `bridge.ts`'s domain-event-to-notification mapping
belongs with it or stays owned by whichever capability produces those
events.
