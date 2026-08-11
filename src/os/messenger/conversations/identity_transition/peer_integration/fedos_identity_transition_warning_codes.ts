/**
 * Secure Runtime Alpha 6121–6200 — Phase Q: centralized safe warning
 * codes and their user-facing meaning. Every screen/renderer in this
 * Arc looks up wording from HERE — never an inline string scattered per
 * screen, so security wording can never drift or contradict itself
 * between the Inbox, Detail, Evidence, and Reset Confirmation screens.
 */
export type FedosIdentityTransitionWarningCode =
  | "replacement-not-rotation"
  | "old-key-signature-may-be-forged"
  | "device-corroboration-not-proof"
  | "continuity-acceptance-is-local-decision"
  | "historical-messages-remain-attributed-to-old-identity"
  | "existing-ratchet-keys-will-not-move"
  | "new-secure-session-required"
  | "other-devices-may-decide-independently"
  | "conflicting-claims-require-manual-review"
  | "archive-restore-does-not-establish-trust";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_WARNING_CODES: readonly FedosIdentityTransitionWarningCode[] = Object.freeze([
  "replacement-not-rotation",
  "old-key-signature-may-be-forged",
  "device-corroboration-not-proof",
  "continuity-acceptance-is-local-decision",
  "historical-messages-remain-attributed-to-old-identity",
  "existing-ratchet-keys-will-not-move",
  "new-secure-session-required",
  "other-devices-may-decide-independently",
  "conflicting-claims-require-manual-review",
  "archive-restore-does-not-establish-trust",
]);

export function isKnownFedosIdentityTransitionWarningCode(value: unknown): value is FedosIdentityTransitionWarningCode {
  return typeof value === "string" && (FEDOS_IDENTITY_TRANSITION_KNOWN_WARNING_CODES as readonly string[]).includes(value);
}

const WARNING_TEXT: Readonly<Record<FedosIdentityTransitionWarningCode, string>> = Object.freeze({
  "replacement-not-rotation": "This is a replacement claim, not an in-place key rotation. The old identity is not being changed — a brand-new identity is claiming continuity with it.",
  "old-key-signature-may-be-forged": "A valid signature from the old identity's key is not proof by itself: if that key was compromised, the same signature could have been forged by whoever compromised it.",
  "device-corroboration-not-proof": "A Device corroborating this claim is additional evidence, not universal proof. One Device is never a quorum.",
  "continuity-acceptance-is-local-decision": "Accepting this replacement's continuity is a decision made only on this Device — it does not notify or bind any other Device or person.",
  "historical-messages-remain-attributed-to-old-identity": "Every message already in this conversation stays attributed to the old identity. Nothing already sent or received is rewritten.",
  "existing-ratchet-keys-will-not-move": "Existing encryption keys for this conversation will not be moved or reused for the new identity.",
  "new-secure-session-required": "A brand-new secure session must be established before messages can be exchanged with the new identity.",
  "other-devices-may-decide-independently": "Other Devices belonging to either party may reach a different decision about this claim than this Device does.",
  "conflicting-claims-require-manual-review": "More than one competing replacement claim was seen for this identity. It cannot be accepted until this is manually reviewed.",
  "archive-restore-does-not-establish-trust": "Restoring an Archive does not, by itself, establish trust in any identity referenced inside it.",
});

/** Total function — returns the exact registered text for a known code. Unknown codes fail closed to a generic, still-honest fallback rather than throwing. */
export function fedosIdentityTransitionWarningText(code: FedosIdentityTransitionWarningCode): string {
  return WARNING_TEXT[code];
}
