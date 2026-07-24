/**
 * Secure Runtime Alpha 7481-7560 (FedOS Archive Envelope Retention
 * Parity and Metadata Deletion Semantics Arc) — Phase H.
 *
 * A committed audit (`2eed88d9`, Section 5) found the Archive export/
 * restore workflow itself surfaces NO warning of any kind — every
 * relevant disclosure lives only on the generic Safety Center overview
 * screen, never at the actual moment of risk. This file is the ONE
 * narrow, additive place that maps a real Archive operation/outcome to
 * the SPECIFIC warning codes relevant to it, reusing the SAME canonical
 * `FEDOS_SAFETY_CENTER_KNOWN_WARNING_CODES`/`fedosSafetyCenterWarningText()`
 * lookup every other Safety Center surface already uses — never a
 * second, drifted copy of any warning's own text (the audit's own
 * Section 5 item 3 finding).
 *
 * Read-only, pure, never mutates anything, never a second Safety Center.
 */
import { fedosSafetyCenterWarningText, type FedosSafetyCenterWarningCode } from "./fedos_safety_center_warning_codes.js";

export interface FedosArchiveWorkflowWarning {
  readonly code: FedosSafetyCenterWarningCode;
  readonly text: string;
}

function warning(code: FedosSafetyCenterWarningCode): FedosArchiveWorkflowWarning {
  return { code, text: fedosSafetyCenterWarningText(code) };
}

/** Shown BEFORE an export is initiated, and alongside its own result — an export always MAY carry forward whatever local content/metadata currently exists (whether or not any of it was ever deleted). */
export function fedosArchiveExportWorkflowWarnings(): readonly FedosArchiveWorkflowWarning[] {
  return [warning("archive-metadata-may-survive-content-deletion"), warning("archive-export-after-deletion-applies-retention-parity")];
}

/** Shown BEFORE a restore is initiated, and alongside its own result — restore may reintroduce content from an OLDER archive, subject to this Arc's own restore-time retention re-check. */
export function fedosArchiveRestoreWorkflowWarnings(): readonly FedosArchiveWorkflowWarning[] {
  return [
    warning("archive-restore-may-be-suppressed-by-local-deletion-facts"),
    warning("archives-and-backups-may-retain-copies"),
    warning("external-copies-cannot-be-verified"),
  ];
}

/** Shown alongside an `"inspect"` result (a cleartext Manifest preview, never decrypted) — the archive's own contents cannot be verified as authentic or complete without a full preflight/restore attempt. */
export function fedosArchiveInspectWorkflowWarnings(): readonly FedosArchiveWorkflowWarning[] {
  return [warning("external-copies-cannot-be-verified")];
}
