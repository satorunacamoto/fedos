/**
 * OS Capability Modularization — `NotificationPort`.
 *
 * A minimal, generic seam for surfacing a user-facing notification. Kept
 * platform-neutral — no Electron/OS-notification-API type, no messenger- or
 * commerce-specific event shape.
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
 * and `os/commerce` depend only on this shape.
 */
export interface NotificationPort {
  /** Surface a notification. Fire-and-forget; never throws. */
  notify(title: string, body: string, meta?: NotificationMeta): void;
}
