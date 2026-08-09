/**
 * OS Capability Modularization — `NotificationPort`.
 *
 * A minimal, generic seam for surfacing a user-facing notification. Kept
 * platform-neutral — no Electron/OS-notification-API type, no messenger- or
 * commerce-specific event shape.
 *
 * HONEST SIGNATURE WARNING (Factory/Port Completion pass — widened this
 * doc comment per `docs/architecture/FACTORY-PORT-COMPLETION-PLAN.md`,
 * which flagged this Port as "under-shaped, not silently lossy": the
 * ADAPTER already documents the gap, but the Port signature itself did
 * not, so a reader of this file alone would wrongly assume free-text
 * delivery):
 *
 * `title`/`body` LOOK like free-text parameters a caller can put arbitrary
 * content into, and the notification will show that content to the user.
 * **The real Messenger adapter for this Port
 * (`FedosMessengerNotificationPortAdapter`) does NOT forward them.** Its
 * underlying coordinator (`FedosDesktopNotificationCoordinator`) enforces a
 * CLOSED vocabulary of `meta.kind` values, each with a FIXED, non-caller-
 * supplied title/body template — specifically to keep message content or
 * other sensitive text out of the OS notification tray. `title`/`body`
 * exist on this Port's signature for adapters that genuinely support
 * free text (a future in-app toast, for instance), but a caller MUST NOT
 * assume any given `NotificationPort` implementation honors them — only
 * `meta` is guaranteed to matter, and only for keys the concrete adapter
 * itself documents. Read the concrete adapter's own doc comment before
 * relying on this Port to surface caller-supplied text.
 *
 * This file is an INTERFACE ONLY. It must never import from `src/conversation`,
 * `src/os/messenger`, `src/commerce`/`src/os/commerce`, or any other
 * domain-specific module — a future host package provides the adapter that
 * implements this port (e.g. an Electron/OS notification bridge).
 */

/** Free-form, adapter-defined metadata attached to a notification. */
export type NotificationMeta = Readonly<Record<string, unknown>>;

/**
 * The notification seam. An adapter implementing this port owns the actual
 * delivery mechanism (OS notification center, in-app toast, ...); `os/core`
 * and `os/commerce` depend only on this shape. See this file's own header
 * for why `title`/`body` may be silently ignored by a given adapter.
 */
export interface NotificationPort {
  /** Surface a notification. Fire-and-forget; never throws. Whether `title`/`body` reach the user depends entirely on the concrete adapter — see this file's header. */
  notify(title: string, body: string, meta?: NotificationMeta): void;
}
