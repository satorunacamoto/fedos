/**
 * Secure Runtime Alpha 5721–5800 — Phase L: Session Reset Integration.
 * A PURE, narrow function connecting a verified lifecycle/capability fact
 * to a safe RECOMMENDATION only. It never itself generates new root/chain
 * state, resets a session, copies a session to a new Device, or revives a
 * revoked session — every one of those remains an explicit, separately-
 * authorized call into the Foundation Arc's own unchanged
 * `FedosDirectRatchetConversationRuntime.initializeDirectRatchetSession()`/
 * `resetDirectRatchetSession()`/`applyDeviceRevocationToSessions()` (Alpha
 * 5401–5480/`f80889d`), reusing THAT Arc's own nonce/replay/audit
 * foundation rather than building a second one.
 */
import type { FedosRatchetPeerCapabilityAcceptanceOutcome } from "./fedos_ratchet_peer_capability_acceptance_outcome.js";
import type { FedosRatchetPeerLifecycleFact } from "./fedos_ratchet_peer_lifecycle_notification.js";

export type FedosRatchetPeerSessionActionRecommendation =
  | "none"
  | "initialize-new-device-session"
  | "reset-required"
  | "peer-capability-refresh-required"
  | "peer-device-revoked"
  | "manual-review-required";

/**
 * `acceptanceOutcome` is Phase J's already-decided result;
 * `factKind` is `null` when evaluating a capability advertisement (no
 * lifecycle fact attached). A non-`"accepted"` outcome other than
 * `"revoked-device"`/`"downgrade-detected"`/`"conflicting"` recommends
 * `"none"` — this function never recommends action on evidence the local
 * policy did not itself accept.
 */
export function recommendFedosRatchetPeerSessionAction(
  acceptanceOutcome: FedosRatchetPeerCapabilityAcceptanceOutcome,
  factKind: FedosRatchetPeerLifecycleFact["kind"] | null,
): FedosRatchetPeerSessionActionRecommendation {
  if (acceptanceOutcome === "revoked-device") return "peer-device-revoked";
  if (acceptanceOutcome === "downgrade-detected" || acceptanceOutcome === "conflicting") return "manual-review-required";
  if (acceptanceOutcome !== "accepted") return "none";

  switch (factKind) {
    case null:
      return "none";
    case "device-added":
      return "initialize-new-device-session";
    case "device-revoked":
      return "peer-device-revoked";
    case "device-replaced":
      // A brand-new Device identity per the Foundation Arc's own register-
      // then-revoke discipline — never an automatic session copy/inherit.
      return "manual-review-required";
    case "ratchet-session-reset-required":
      return "reset-required";
    case "ratchet-session-generation-advanced":
    case "capability-superseded":
      return "peer-capability-refresh-required";
    default:
      return "none";
  }
}
