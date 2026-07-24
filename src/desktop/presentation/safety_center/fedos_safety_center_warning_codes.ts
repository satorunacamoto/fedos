/**
 * Secure Runtime Alpha 6201-6280 (FedOS Desktop Beta Privacy Controls and
 * Safety Center Arc) — Phase G: the ONE centralized, closed warning-code
 * vocabulary this Arc's own screens resolve through — mirrors
 * `fedos_identity_transition_warning_codes.ts` (`6121-6200`)'s own
 * established "closed union + array + one lookup function, never scattered
 * inline strings" convention exactly.
 */

export type FedosSafetyCenterWarningCode =
  | "device-revocation-does-not-erase-copies"
  | "ratchet-reset-does-not-erase-history"
  | "relay-ack-is-not-recipient-delivery"
  | "identity-replacement-evidence-is-not-automatic-trust"
  | "old-key-signature-insufficient-under-compromise"
  | "deletion-acknowledgement-is-a-claim-not-physical-proof"
  | "other-devices-may-retain-copies"
  | "archives-and-backups-may-retain-copies"
  | "relay-ciphertext-may-remain"
  | "external-copies-cannot-be-verified"
  | "secure-memory-zeroization-is-best-effort-or-unavailable"
  | "os-kernel-hypervisor-compromise-is-out-of-scope"
  /**
   * Secure Runtime Alpha 7481-7560 (FedOS Archive Envelope Retention
   * Parity and Metadata Deletion Semantics Arc) — three NEW, narrow,
   * additive codes closing a committed audit's own Section 5 finding
   * (`2eed88d9`): the single, generic `archives-and-backups-may-retain-copies`
   * never distinguished content from metadata, nor an Archive taken
   * before a deletion from one taken after. These three are ADDITIVE to
   * that existing code, never a replacement for it.
   */
  | "archive-metadata-may-survive-content-deletion"
  | "archive-export-after-deletion-applies-retention-parity"
  | "archive-restore-may-be-suppressed-by-local-deletion-facts";

export const FEDOS_SAFETY_CENTER_KNOWN_WARNING_CODES: readonly FedosSafetyCenterWarningCode[] = [
  "device-revocation-does-not-erase-copies",
  "ratchet-reset-does-not-erase-history",
  "relay-ack-is-not-recipient-delivery",
  "identity-replacement-evidence-is-not-automatic-trust",
  "old-key-signature-insufficient-under-compromise",
  "deletion-acknowledgement-is-a-claim-not-physical-proof",
  "other-devices-may-retain-copies",
  "archives-and-backups-may-retain-copies",
  "relay-ciphertext-may-remain",
  "external-copies-cannot-be-verified",
  "secure-memory-zeroization-is-best-effort-or-unavailable",
  "os-kernel-hypervisor-compromise-is-out-of-scope",
  "archive-metadata-may-survive-content-deletion",
  "archive-export-after-deletion-applies-retention-parity",
  "archive-restore-may-be-suppressed-by-local-deletion-facts",
];

export function isFedosSafetyCenterWarningCode(candidate: unknown): candidate is FedosSafetyCenterWarningCode {
  return typeof candidate === "string" && (FEDOS_SAFETY_CENTER_KNOWN_WARNING_CODES as readonly string[]).includes(candidate);
}

const TEXT: Readonly<Record<FedosSafetyCenterWarningCode, string>> = {
  "device-revocation-does-not-erase-copies": "Revoking a Device does not erase secrets that Device already copied before revocation.",
  "ratchet-reset-does-not-erase-history": "Resetting a Ratchet session does not erase historical plaintext already delivered.",
  "relay-ack-is-not-recipient-delivery": "A Relay accepting an event is not proof the recipient received or read it.",
  "identity-replacement-evidence-is-not-automatic-trust": "Identity Replacement evidence is not automatic trust — acceptance is always an explicit local decision.",
  "old-key-signature-insufficient-under-compromise": "A valid old-key signature is insufficient proof of continuity if the old key was compromised.",
  "deletion-acknowledgement-is-a-claim-not-physical-proof": "A deletion acknowledgement is a Device's own signed claim, not proof of physical erasure.",
  "other-devices-may-retain-copies": "Other Devices of the same account may still retain a copy.",
  "archives-and-backups-may-retain-copies": "Archives and backups may still retain a copy.",
  "relay-ciphertext-may-remain": "Encrypted ciphertext may remain stored on Relays this application does not control.",
  "external-copies-cannot-be-verified": "Screenshots, exports, notifications, and other external copies cannot be verified or recalled.",
  "secure-memory-zeroization-is-best-effort-or-unavailable": "Secure-memory zeroization of secrets in this build is currently best-effort, or unavailable, according to real source status.",
  "os-kernel-hypervisor-compromise-is-out-of-scope": "A compromised operating system, kernel, or hypervisor is outside this application's own security guarantee.",
  "archive-metadata-may-survive-content-deletion": "Deleting a message removes its readable content locally, but an Archive taken before that deletion can still show that the message existed, when, and between whom.",
  "archive-export-after-deletion-applies-retention-parity": "A new Archive export made after a deletion excludes that message's content and its metadata together — neither resurfaces in a fresh export.",
  "archive-restore-may-be-suppressed-by-local-deletion-facts": "Restoring an older Archive onto a device that already recorded a deletion will not bring that message back; restoring onto a device that never knew about the deletion may still show it.",
};

/** The ONE place any Safety Center screen resolves warning text — never an inline string in a screen-model builder or Renderer. */
export function fedosSafetyCenterWarningText(code: FedosSafetyCenterWarningCode): string {
  return TEXT[code];
}
