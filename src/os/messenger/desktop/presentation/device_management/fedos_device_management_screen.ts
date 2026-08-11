/**
 * Secure Runtime Alpha 3941–4020 ("Desktop Device Management and Sync
 * Operations UI Renderer Arc") — Phase B: closed screen vocabulary.
 *
 * `FedosDeviceManagementScreen` is the ONE closed set of screen ids the
 * navigation state (`fedos_device_management_navigation_state.ts`) and the
 * screen model (`fedos_device_management_controller.ts`) ever recognize —
 * mirrors `FedosDesktopShellOutcomeKind`/`FedosDeviceSyncConflictResolutionAction`'s
 * own "closed literal union, never an arbitrary string" discipline one
 * layer up. `isFedosDeviceManagementScreen()` is the ONE gate every
 * caller-supplied screen id passes through before navigation accepts it —
 * an unrecognized id is refused, never silently coerced or routed.
 */

export type FedosDeviceManagementScreen =
  | "overview"
  | "device-list"
  | "device-detail"
  | "registration"
  | "revocation-confirmation"
  | "sync-status"
  | "schedule-list"
  | "transfer-list"
  | "transfer-detail"
  | "conflict-list"
  | "conflict-detail"
  | "confirmation"
  | "unavailable"
  | "error";

export const FEDOS_DEVICE_MANAGEMENT_SCREENS: readonly FedosDeviceManagementScreen[] = [
  "overview",
  "device-list",
  "device-detail",
  "registration",
  "revocation-confirmation",
  "sync-status",
  "schedule-list",
  "transfer-list",
  "transfer-detail",
  "conflict-list",
  "conflict-detail",
  "confirmation",
  "unavailable",
  "error",
];

/** Structural gate — the ONLY function permitted to decide whether a caller-supplied string is a real screen id. Never throws. */
export function isFedosDeviceManagementScreen(candidate: unknown): candidate is FedosDeviceManagementScreen {
  return typeof candidate === "string" && (FEDOS_DEVICE_MANAGEMENT_SCREENS as readonly string[]).includes(candidate);
}

/**
 * Closed confirmation-action vocabulary (Phase C's own "pending confirmation
 * action" concept) — every action a `"confirmation"` screen may represent.
 * `revoke-device` and `trigger-sync-now` are the two actions this Arc's own
 * target screens (Device Revocation Confirmation, Sync Trigger Confirmation)
 * name; closed so navigation state can never carry an arbitrary callback
 * (Phase J's own "no arbitrary callback/function values" guarantee starts
 * here, one layer up from render output).
 */
export type FedosDeviceManagementConfirmationAction = "revoke-device" | "trigger-sync-now" | "stop-sync";

export const FEDOS_DEVICE_MANAGEMENT_CONFIRMATION_ACTIONS: readonly FedosDeviceManagementConfirmationAction[] = ["revoke-device", "trigger-sync-now", "stop-sync"];

export function isFedosDeviceManagementConfirmationAction(candidate: unknown): candidate is FedosDeviceManagementConfirmationAction {
  return typeof candidate === "string" && (FEDOS_DEVICE_MANAGEMENT_CONFIRMATION_ACTIONS as readonly string[]).includes(candidate);
}
