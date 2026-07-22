/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — Phase I: pure screen-content builders over the
 * Controller's own already-gathered facts. No Shell/Runtime call lives
 * here — mirrors every other `*_screen_model.ts` file in this codebase.
 */
import type { FedosSafetyCenterSummaryV1 } from "./fedos_safety_center_summary.js";
import { fedosSafetyCenterWarningText, FEDOS_SAFETY_CENTER_KNOWN_WARNING_CODES, type FedosSafetyCenterWarningCode } from "./fedos_safety_center_warning_codes.js";
import type { FedosSafetyCenterConfirmableAction } from "./fedos_safety_center_navigation_state.js";

export interface FedosSafetyCenterOverviewContent {
  readonly summary: FedosSafetyCenterSummaryV1;
  /** Every standing, always-shown non-guarantee — Phase G's own full list, resolved through the one centralized lookup, never inline text. */
  readonly standingWarnings: readonly { readonly code: FedosSafetyCenterWarningCode; readonly text: string }[];
}

export function fedosSafetyCenterBuildOverviewContent(summary: FedosSafetyCenterSummaryV1): FedosSafetyCenterOverviewContent {
  return {
    summary,
    standingWarnings: FEDOS_SAFETY_CENTER_KNOWN_WARNING_CODES.map((code) => ({ code, text: fedosSafetyCenterWarningText(code) })),
  };
}

export interface FedosSafetyCenterConfirmationContent {
  readonly action: FedosSafetyCenterConfirmableAction;
  readonly warnings: readonly string[];
}

/** Phase F/G's own "every dangerous action requires explicit confirmation state" — the fixed, honest warning set shown for each of the two confirmable actions this domain has. Never invents a third. */
export function fedosSafetyCenterBuildConfirmationContent(action: FedosSafetyCenterConfirmableAction): FedosSafetyCenterConfirmationContent {
  if (action.kind === "revoke-device") {
    return {
      action,
      warnings: [fedosSafetyCenterWarningText("device-revocation-does-not-erase-copies"), fedosSafetyCenterWarningText("other-devices-may-retain-copies")],
    };
  }
  return {
    action,
    warnings: [fedosSafetyCenterWarningText("ratchet-reset-does-not-erase-history"), fedosSafetyCenterWarningText("identity-replacement-evidence-is-not-automatic-trust")],
  };
}
