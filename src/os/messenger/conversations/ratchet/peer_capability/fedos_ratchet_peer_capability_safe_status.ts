/**
 * Secure Runtime Alpha 5721–5800 — Phase O: user-safe status. Framework-
 * neutral; no UI. Mirrors `fedos_direct_ratchet_conversation_runtime.ts`'s
 * own `FedosDirectRatchetSafeStatus` discipline exactly: a closed,
 * pre-computed status string only, never counters/keys/signatures/
 * revisions/raw evidence. `"trusted"` is deliberately never a value here —
 * Phase O's own requirement that self-advertisement alone never displays
 * as trust; the closest available value is `"compatible"`.
 */
import type { FedosRatchetPeerCapabilityAcceptanceOutcome } from "../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_outcome.js";
import type { FedosRatchetPeerSessionActionRecommendation } from "../../../../../conversation/ratchet/peer_capability/fedos_ratchet_peer_capability_session_action_recommendation.js";

export type FedosRatchetPeerCapabilitySafeStatus =
  | "unknown"
  | "observed"
  | "compatible"
  | "initialization-required"
  | "reset-required"
  | "stale"
  | "conflicting"
  | "revoked"
  | "unsupported"
  | "unavailable";

/**
 * `acceptanceOutcome === null` means no observation exists yet for the
 * subject at all -- `"unknown"`, never any other value. The
 * recommendation (Phase L), when it names a specific action, always
 * takes priority over the generic outcome mapping below it.
 */
export function computeFedosRatchetPeerCapabilitySafeStatus(
  acceptanceOutcome: FedosRatchetPeerCapabilityAcceptanceOutcome | null,
  recommendation: FedosRatchetPeerSessionActionRecommendation,
): FedosRatchetPeerCapabilitySafeStatus {
  if (acceptanceOutcome === null) return "unknown";

  switch (recommendation) {
    case "initialize-new-device-session":
      return "initialization-required";
    case "reset-required":
      return "reset-required";
    case "peer-device-revoked":
      return "revoked";
    case "manual-review-required":
      return "conflicting";
    case "peer-capability-refresh-required":
      return "stale";
    case "none":
      break;
  }

  switch (acceptanceOutcome) {
    case "accepted":
      return "compatible";
    case "observed-not-accepted":
      return "observed";
    case "unsupported":
    case "peer-incompatible":
      return "unsupported";
    case "expired":
    case "stale":
      return "stale";
    case "conflicting":
    case "downgrade-detected":
      return "conflicting";
    case "revoked-device":
      return "revoked";
    case "untrusted-device":
    case "unavailable":
      return "unavailable";
    case "session-initialization-required":
      return "initialization-required";
    case "session-reset-required":
      return "reset-required";
    default:
      return "unknown";
  }
}
