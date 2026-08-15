/**
 * FedOS Peer Device Discovery Arc — closed acceptance-outcome vocabulary,
 * factored into its own file mirroring
 * `../ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_outcome.ts`'s
 * own "shared by both the Observation schema and the pure evaluator without
 * a circular import" discipline. Never a boolean.
 */
export type FedosPeerDeviceAnnouncementAcceptanceOutcome =
  | "accepted-new-device"
  | "accepted-superseding"
  | "duplicate"
  | "conflicting"
  | "stale"
  | "malformed"
  | "wrong-recipient"
  | "bad-account-signature"
  | "bad-device-signature";

export const FEDOS_PEER_DEVICE_ANNOUNCEMENT_KNOWN_ACCEPTANCE_OUTCOMES: readonly FedosPeerDeviceAnnouncementAcceptanceOutcome[] = Object.freeze([
  "accepted-new-device",
  "accepted-superseding",
  "duplicate",
  "conflicting",
  "stale",
  "malformed",
  "wrong-recipient",
  "bad-account-signature",
  "bad-device-signature",
]);

/** `true` for either accepted outcome — the one place this domain treats "new" and "superseding" as equivalent for downstream Registry-write purposes. */
export function isFedosPeerDeviceAnnouncementAccepted(outcome: FedosPeerDeviceAnnouncementAcceptanceOutcome): boolean {
  return outcome === "accepted-new-device" || outcome === "accepted-superseding";
}
