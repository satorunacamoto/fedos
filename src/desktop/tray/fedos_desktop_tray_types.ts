/**
 * Secure Runtime Alpha 4261-4340 — Phase C: System Tray Boundary, closed
 * action vocabulary.
 *
 * `FedosDesktopTrayAction` is a CLOSED, exhaustive vocabulary of every menu
 * action a tray icon may raise — exactly the six named in this Arc's own
 * brief, no more. No platform-specific business logic lives here — this
 * file is pure data/validation, consumed by `./fedos_desktop_tray_coordinator.ts`
 * (decision logic) and rendered by a concrete `FedosDesktopTrayPort`
 * (`./fedos_desktop_tray_port.ts`, an Electron adapter in Phase E).
 */

export type FedosDesktopTrayAction = "open-window" | "recent-conversations" | "device-sync-status" | "pause-sync" | "resume-sync" | "exit";

export const FEDOS_DESKTOP_TRAY_ACTIONS: readonly FedosDesktopTrayAction[] = [
  "open-window",
  "recent-conversations",
  "device-sync-status",
  "pause-sync",
  "resume-sync",
  "exit",
];

/** Mirrors `FEDOS_DESKTOP_NOTIFICATION_MAX_ID_LENGTH`'s own bound (`../notification/fedos_desktop_notification_types.ts`) — restated here since this boundary sits beside, not under, that one. */
export const FEDOS_DESKTOP_TRAY_MAX_ID_LENGTH = 512;

/** What a tray click (or the Electron adapter's own IPC/menu-click forwarding) asks this boundary to do. `conversationId` is meaningful only for `"open-window"` (open a SPECIFIC conversation's window instead of just the last-opened one). */
export interface FedosDesktopTrayActionRequest {
  readonly action: FedosDesktopTrayAction;
  readonly conversationId?: string;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

/** Fails closed to `null` for anything not a genuinely well-formed, in-vocabulary request. Never throws. */
export function validateFedosDesktopTrayActionRequest(candidate: unknown): FedosDesktopTrayActionRequest | null {
  if (candidate === null || typeof candidate !== "object") return null;
  const c = candidate as Record<string, unknown>;
  if (typeof c.action !== "string" || !FEDOS_DESKTOP_TRAY_ACTIONS.includes(c.action as FedosDesktopTrayAction)) return null;
  const action = c.action as FedosDesktopTrayAction;

  if (c.conversationId === undefined) return Object.freeze({ action });
  if (!isBoundedString(c.conversationId, FEDOS_DESKTOP_TRAY_MAX_ID_LENGTH)) return null;
  return Object.freeze({ action, conversationId: c.conversationId });
}

/** The closed, human-readable label for each action — a pure lookup, never derived from live state. A concrete `FedosDesktopTrayPort` uses this (plus caller-supplied `enabled` flags) to render its own real menu. */
const FEDOS_DESKTOP_TRAY_ACTION_LABELS: Readonly<Record<FedosDesktopTrayAction, string>> = Object.freeze({
  "open-window": "Open Window",
  "recent-conversations": "Recent Conversations",
  "device-sync-status": "Device Sync Status",
  "pause-sync": "Pause Sync",
  "resume-sync": "Resume Sync",
  exit: "Exit",
});

export interface FedosDesktopTrayMenuItemView {
  readonly action: FedosDesktopTrayAction;
  readonly label: string;
  readonly enabled: boolean;
}

/** Builds the FULL, closed six-item menu in a fixed order. `disabledActions` lets a caller grey out e.g. `"pause-sync"` while sync is already stopped — never adds/removes/renames an item. */
export function fedosDesktopTrayMenuItems(disabledActions: ReadonlySet<FedosDesktopTrayAction> = new Set()): readonly FedosDesktopTrayMenuItemView[] {
  return Object.freeze(
    FEDOS_DESKTOP_TRAY_ACTIONS.map((action) =>
      Object.freeze({ action, label: FEDOS_DESKTOP_TRAY_ACTION_LABELS[action], enabled: !disabledActions.has(action) }),
    ),
  );
}
