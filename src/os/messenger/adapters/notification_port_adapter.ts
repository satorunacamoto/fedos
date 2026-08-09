/**
 * OS Capability Modularization — `NotificationPort` adapter.
 *
 * Implements `NotificationPort` (`../../core/ports/notification_port.js`,
 * owned by a concurrent agent in this same arc) by delegating to the real,
 * unmoved `FedosDesktopNotificationCoordinator`
 * (`../../../desktop/notification/fedos_desktop_notification_coordinator.js`
 * — the LIVE notification coordinator; NOT the dormant top-level
 * `src/notification/`, which is unrelated and out of this arc's scope).
 *
 * IMPORTANT SHAPE MISMATCH, handled deliberately rather than papered over:
 * `NotificationPort.notify(title, body, meta?)` accepts arbitrary caller
 * text. `FedosDesktopNotificationCoordinator` explicitly does NOT — its own
 * header ("Phase B: Desktop Notification Boundary") documents a CLOSED
 * vocabulary of `kind`s, each with a FIXED, non-caller-supplied title/body
 * template, and fails the WHOLE request closed for anything else
 * (`fedos_desktop_notification_types.ts`'s own "No custom notification
 * payloads" guardrail — this exists to stop message content or other
 * sensitive text from ever reaching the OS notification tray).
 *
 * This adapter honors that guardrail rather than defeating it: the
 * caller-supplied `title`/`body` strings are NEVER forwarded to the real
 * notification surface. Routing happens through `meta.kind`, which MUST be
 * one of the coordinator's own closed `FedosDesktopNotificationKind`
 * values; `meta.targetConversationId`/`meta.detail` pass through as the
 * coordinator's own optional, policy-checked extras. Anything else
 * (`meta` missing, `meta.kind` missing/unrecognized) fails closed — no
 * notification is raised, exactly mirroring the coordinator's own "fail
 * closed on the whole request" behavior one layer up, and matching
 * `NotificationPort.notify`'s own "fire-and-forget; never throws" contract
 * (a caller that wants to know the outcome should read
 * `coordinator.lastOutcome` directly, not through this narrow Port).
 */

import type { NotificationMeta, NotificationPort } from "../../core/ports/notification_port.js";
import type { FedosDesktopNotificationCoordinator } from "../../../desktop/notification/fedos_desktop_notification_coordinator.js";
import { FEDOS_DESKTOP_NOTIFICATION_KINDS, type FedosDesktopNotificationKind } from "../../../desktop/notification/fedos_desktop_notification_types.js";

const KNOWN_KINDS: ReadonlySet<string> = new Set(FEDOS_DESKTOP_NOTIFICATION_KINDS);

export class FedosMessengerNotificationPortAdapter implements NotificationPort {
  readonly #coordinator: FedosDesktopNotificationCoordinator;

  constructor(coordinator: FedosDesktopNotificationCoordinator) {
    this.#coordinator = coordinator;
  }

  /** Fire-and-forget, matching `NotificationPort`'s own contract. See this file's own header for why `title`/`body` are never forwarded as-is. */
  notify(title: string, body: string, meta?: NotificationMeta): void {
    void title;
    void body;
    const kind = this.#resolveKind(meta);
    if (kind === null) return; // Fail closed -- unrecognized/missing routing, no fixed template to raise.

    const candidate: Record<string, unknown> = { kind };
    const targetConversationId = this.#resolveOptionalString(meta, "targetConversationId");
    if (targetConversationId !== undefined) candidate.targetConversationId = targetConversationId;
    const detail = this.#resolveOptionalString(meta, "detail");
    if (detail !== undefined) candidate.detail = detail;

    // The coordinator itself never throws (its own header's own guarantee);
    // the `.catch` below is defense-in-depth only, matching this Port
    // method's own "never throws" contract.
    void this.#coordinator.notify(candidate).catch(() => {});
  }

  #resolveKind(meta: NotificationMeta | undefined): FedosDesktopNotificationKind | null {
    const kind = meta?.kind;
    if (typeof kind !== "string" || !KNOWN_KINDS.has(kind)) return null;
    return kind as FedosDesktopNotificationKind;
  }

  #resolveOptionalString(meta: NotificationMeta | undefined, key: string): string | undefined {
    const value = meta?.[key];
    return typeof value === "string" ? value : undefined;
  }
}
