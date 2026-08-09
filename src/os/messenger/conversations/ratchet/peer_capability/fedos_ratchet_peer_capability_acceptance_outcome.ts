/**
 * Secure Runtime Alpha 5721–5800 — Phase J's closed acceptance-outcome
 * vocabulary, factored into its own file so both the durable Observation
 * schema (Phase I) and the pure acceptance-policy evaluator (Phase J) can
 * depend on it without a circular import.
 *
 * Never a boolean — Phase J's own explicit requirement. No acceptance
 * outcome here may be produced by a caller silently "upgrading" a weaker
 * one; every value is produced ONLY by
 * `evaluateFedosRatchetPeerCapabilityAcceptance()` itself.
 */
export type FedosRatchetPeerCapabilityAcceptanceOutcome =
  | "accepted"
  | "observed-not-accepted"
  | "unsupported"
  | "expired"
  | "stale"
  | "conflicting"
  | "untrusted-device"
  | "revoked-device"
  | "peer-incompatible"
  | "downgrade-detected"
  | "session-initialization-required"
  | "session-reset-required"
  | "unavailable";

export const FEDOS_RATCHET_PEER_CAPABILITY_KNOWN_ACCEPTANCE_OUTCOMES: readonly FedosRatchetPeerCapabilityAcceptanceOutcome[] = Object.freeze([
  "accepted",
  "observed-not-accepted",
  "unsupported",
  "expired",
  "stale",
  "conflicting",
  "untrusted-device",
  "revoked-device",
  "peer-incompatible",
  "downgrade-detected",
  "session-initialization-required",
  "session-reset-required",
  "unavailable",
]);
