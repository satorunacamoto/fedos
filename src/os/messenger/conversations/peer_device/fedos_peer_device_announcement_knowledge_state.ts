/**
 * FedOS Peer Device Discovery Arc — Direct Ratchet P1 arc: the explicit
 * TOFU (trust-on-first-use) knowledge-state vocabulary for a peer's
 * announced Device.
 *
 * `FedosDeviceTrustState` (`"pending" | "trusted" | "revoked" | "unavailable"`)
 * already answers "does the Registry currently hold a cryptographically
 * valid binding for this device." It deliberately does NOT answer a
 * different question this domain's own auto-trust-on-receipt behavior
 * makes real: whether that binding is merely first-seen (one accepted
 * announcement, auto-confirmed with zero human step —
 * `FedosPeerDeviceAnnouncementRegistrationAuthority.registerOrUpdate()`
 * calls `confirmTrust()` unconditionally on any accepted outcome) or has
 * been reconfirmed by continuity (multiple accepted announcements over
 * time, at increasing epochs). Labeling a first-seen device "trusted" with
 * no further qualifier is not false, but it invites reading "trusted" as
 * "human/continuity verified," which it is not — this module exists to
 * make that distinction explicit and queryable rather than implicit.
 *
 * Derived entirely from the append-only, insert-only observation log this
 * arc already writes (`FedosPeerDeviceAnnouncementObservationV1`) plus the
 * live Registry binding — never a new stored flag, never wall-clock, and
 * never a boolean.
 */
import type { FedosDeviceTrustState } from "../../device/fedos_device_binding.js";
import { isFedosPeerDeviceAnnouncementAccepted, type FedosPeerDeviceAnnouncementAcceptanceOutcome } from "./fedos_peer_device_announcement_acceptance_outcome.js";
import type { FedosPeerDeviceAnnouncementObservationV1 } from "./fedos_peer_device_announcement_observation.js";

export type FedosPeerDeviceKnowledgeState =
  /** Exactly one accepted announcement has ever been observed for this device — auto-confirmed, never independently re-confirmed. */
  | "first-seen"
  /** More than one accepted announcement observed over time (an epoch-increasing re-announcement or an idempotent replay of the same one) — the SAME device has been consistently seen, not merely seen once. */
  | "continuity-established"
  /** The most recently observed announcement for this device was rejected as stale (an epoch at or below one already accepted) — the peer's latest attempt is out of date; the earlier accepted binding still stands. */
  | "stale"
  /** The most recently observed announcement for this device was rejected as a conflicting re-key (same `deviceId`, different device public key) — `06_PROTOCOL_CONTRACT_FREEZE.md` §7 item 3's re-keying-conflict protection means this is never silently promoted; the prior accepted binding still stands, and the conflict itself is a fact worth surfacing. */
  | "conflicting-rejected"
  /** No Registry binding exists for this device at all despite an observation record existing, or no accepted observation has ever been recorded for it. */
  | "unknown";

const OUTCOMES_THAT_DO_NOT_OVERRIDE_KNOWLEDGE: readonly FedosPeerDeviceAnnouncementAcceptanceOutcome[] = Object.freeze(["malformed", "wrong-recipient", "bad-account-signature", "bad-device-signature"]);

/**
 * `observations` must already be filtered to the single `(localDeviceRef,
 * peerAccountRef, deviceId)` subject this state is being computed for —
 * this function does no subject filtering of its own. `binding` is the
 * live Registry lookup for that same `deviceId` (`null` if no binding
 * exists).
 */
export function computeFedosPeerDeviceKnowledgeState(observations: readonly FedosPeerDeviceAnnouncementObservationV1[], binding: { readonly trustState: FedosDeviceTrustState } | null): FedosPeerDeviceKnowledgeState {
  if (binding === null) return "unknown";

  const accepted = observations.filter((o) => isFedosPeerDeviceAnnouncementAccepted(o.acceptanceOutcome) || o.acceptanceOutcome === "duplicate");
  if (accepted.length === 0) return "unknown";

  let mostRecentMeaningful: FedosPeerDeviceAnnouncementObservationV1 | null = null;
  for (const o of observations) {
    if (OUTCOMES_THAT_DO_NOT_OVERRIDE_KNOWLEDGE.includes(o.acceptanceOutcome)) continue;
    if (mostRecentMeaningful === null || o.observedAt > mostRecentMeaningful.observedAt) mostRecentMeaningful = o;
  }

  if (mostRecentMeaningful?.acceptanceOutcome === "conflicting") return "conflicting-rejected";
  if (mostRecentMeaningful?.acceptanceOutcome === "stale") return "stale";

  return accepted.length === 1 ? "first-seen" : "continuity-established";
}
