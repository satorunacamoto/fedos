/**
 * FedOS Peer Device Discovery Arc — the local acceptance policy. A PURE
 * function — no I/O, no signature verification of its own (already
 * happened before this is ever called), no Registry mutation. Mirrors
 * `../ratchet/peer_capability/fedos_ratchet_peer_capability_acceptance_policy.ts`'s
 * own shape (closed outcome union, never boolean, short-circuiting order),
 * but with acceptance semantics appropriate for DISCOVERY, not for an
 * already-trusted-peer capability update: this policy is NOT gated on
 * pre-existing Device Registry trust (that would be circular — the whole
 * point of this protocol is populating that Registry for a genuinely
 * unknown device). See `06_PROTOCOL_CONTRACT_FREEZE.md` §4 for the frozen
 * order this mirrors exactly.
 */
import type { FedosPeerDeviceAnnouncementAcceptanceOutcome } from "./fedos_peer_device_announcement_acceptance_outcome.js";

export interface FedosPeerDeviceAnnouncementPriorAcceptedSummary {
  readonly epoch: number;
  readonly devicePublicKeyHex: string;
}

export interface FedosPeerDeviceAnnouncementAcceptanceInput {
  readonly epoch: number;
  readonly devicePublicKeyHex: string;
  /** The most recent prior ACCEPTED fact for the same `(senderAccountRef, deviceId)` subject, or `null` if none exists yet. */
  readonly priorAccepted: FedosPeerDeviceAnnouncementPriorAcceptedSummary | null;
  /** `true` when a DIFFERENT, already-durably-recorded fact exists at the exact same epoch for the same subject. */
  readonly conflictingDuplicateAtSameEpoch: boolean;
}

/**
 * The one pure decision function. Checked in order: conflict, staleness/
 * rollback (numeric-only, never arrival-order-based), re-keying conflict,
 * then accept (new vs. superseding). Structural/recipient/signature
 * rejections are decided one layer up (the Inbound Coordinator), BEFORE
 * this function is ever called — this function only ever sees content that
 * already passed those checks.
 */
export function evaluateFedosPeerDeviceAnnouncementAcceptance(input: FedosPeerDeviceAnnouncementAcceptanceInput): FedosPeerDeviceAnnouncementAcceptanceOutcome {
  if (input.conflictingDuplicateAtSameEpoch) return "conflicting";
  if (input.priorAccepted !== null && input.epoch <= input.priorAccepted.epoch) return "stale";

  if (input.priorAccepted === null) return "accepted-new-device";

  // A higher epoch claiming a DIFFERENT device public key than the prior
  // accepted fact for the SAME (senderAccountRef, deviceId) subject is a
  // re-keying conflict, never a silent re-trust (06 §7 item 3 /
  // 07_MULTI_DEVICE_AND_CONFLICT_MODEL.md's conflict-resolution table) --
  // a genuinely new physical device must announce under a fresh `deviceId`.
  if (input.priorAccepted.devicePublicKeyHex !== input.devicePublicKeyHex) return "conflicting";

  return "accepted-superseding";
}
