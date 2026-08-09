/**
 * Secure Runtime Alpha 4341-4420 ("Desktop Unread Badge and Menu Bar Count
 * Integration Arc") — Phase B: Desktop Badge Boundary, closed state
 * vocabulary.
 *
 * `FedosDesktopBadgeState` is a CLOSED, exhaustive vocabulary of the only
 * badge states a Desktop Host may ever display — exactly the five named in
 * this Arc's own brief, no more. There is no free-form badge text and no
 * caller-suppliable payload: `count` is the ONLY number this boundary ever
 * surfaces, and it is ALWAYS the sum of real per-conversation counts the
 * existing, frozen `FedosDesktopUnreadCounterViewModel`
 * (`../presentation/fedos_desktop_unread_counter_view_model.ts`, Alpha
 * 3241-3320, UNMODIFIED) itself already computed — this file and
 * `./fedos_desktop_badge_coordinator.ts` NEVER re-derive an unread fact from
 * `listMessages()`/any Shell call directly (this Arc's own hard
 * requirement: "Reuse the existing FedosDesktopUnreadCounterViewModel
 * without redesign... Never compute unread independently").
 *
 * MEANING OF EACH STATE (owned here, restated by the Coordinator's own
 * header):
 *   - "none"          -> total unread count is 0. No badge should be shown.
 *   - "count"          -> total unread count > 0. Show `count` as a plain
 *                         numeric badge.
 *   - "attention"      -> total unread count > 0 AND at least one
 *                         conversation's own count increased since the LAST
 *                         time THIS Coordinator instance observed it (a
 *                         purely local, in-memory, non-persisted fact --
 *                         never a cross-session/cross-process claim) --
 *                         lets a caller (the Electron adapter) bounce a
 *                         Dock icon / flash a taskbar entry once, instead of
 *                         a plain, steady count.
 *   - "synchronizing"  -> an explicit, caller-driven signal (never inferred
 *                         by this boundary itself) that a device sync is
 *                         currently in progress -- `count` is still the
 *                         real, current total, but the caller may choose to
 *                         render a distinct "syncing" glyph instead of the
 *                         bare number.
 *   - "error"          -> the underlying refresh (conversation list or one
 *                         or more per-conversation unread reads) failed.
 *                         `count` is always 0 here -- never a stale or
 *                         partially-summed number presented as real.
 *
 * HARD GUARDRAILS (mirrors `fedos_desktop_notification_types.ts`'s own
 * "Fail Closed" section, restated for this boundary):
 *   - No field here ever carries message content, a title, or a body --
 *     `reason` is always a fixed/derived, non-sensitive, short explanation.
 *   - `FedosDesktopBadgeView` is the ONLY shape a `FedosDesktopBadgePort`
 *     (`./fedos_desktop_badge_port.ts`) ever receives.
 */

export type FedosDesktopBadgeState = "none" | "count" | "attention" | "synchronizing" | "error";

export const FEDOS_DESKTOP_BADGE_STATES: readonly FedosDesktopBadgeState[] = ["none", "count", "attention", "synchronizing", "error"];

export interface FedosDesktopBadgeView {
  readonly state: FedosDesktopBadgeState;
  /** The total unread count this view is about -- summed across every conversation the Coordinator's own last refresh saw. Always 0 for "none"/"error" (an in-flight failure never fabricates a stale count); real and current for "count"/"attention"/"synchronizing". */
  readonly count: number;
  /** Non-sensitive explanation -- never echoes message content (mirrors every other Coordinator's own "reason" field in this codebase). */
  readonly reason: string;
}

function badgeView(state: FedosDesktopBadgeState, count: number, reason: string): FedosDesktopBadgeView {
  return Object.freeze({ state, count, reason });
}

export function fedosDesktopBadgeNone(reason = "no unread messages"): FedosDesktopBadgeView {
  return badgeView("none", 0, reason);
}

export function fedosDesktopBadgeCount(count: number, reason?: string): FedosDesktopBadgeView {
  return badgeView("count", count, reason ?? `${count} unread message${count === 1 ? "" : "s"}`);
}

export function fedosDesktopBadgeAttention(count: number, reason = "new unread messages arrived since the last refresh"): FedosDesktopBadgeView {
  return badgeView("attention", count, reason);
}

export function fedosDesktopBadgeSynchronizing(count: number, reason = "device sync is in progress"): FedosDesktopBadgeView {
  return badgeView("synchronizing", count, reason);
}

export function fedosDesktopBadgeError(reason: string): FedosDesktopBadgeView {
  return badgeView("error", 0, reason);
}

/** Structural equality -- used by the Coordinator's own "no duplicate badge updates" guarantee (Phase G). Never a reference/identity comparison. */
export function fedosDesktopBadgeViewsEqual(a: FedosDesktopBadgeView, b: FedosDesktopBadgeView): boolean {
  return a.state === b.state && a.count === b.count && a.reason === b.reason;
}
