/**
 * Secure Runtime Alpha 6121–6200 — Phase E: honest Peer Device evidence
 * display.
 *
 * One Device is never a quorum, and multiple Devices are never
 * automatically treated as one either (Absolute Prohibitions: no
 * multi-Device quorum) — this file only classifies EACH row
 * independently; nothing here aggregates multiple Devices into a single
 * account-wide verdict.
 *
 * Several vocabulary values (`"signature-valid"`, `"authorized-at-proof-time"`,
 * `"revoked"`) are reserved for a future Arc that threads raw per-Device
 * signature/trust detail through to this display layer — today's durable
 * `FedosIdentityTransitionPeerObservationV1` intentionally does not carry
 * that detail (Phase F of the prior Arc records only the AGGREGATE
 * evidence outcome), so this file's own mapping function only ever
 * produces the subset those durable facts can honestly support.
 */
import type { FedosIdentityTransitionPeerObservationV1 } from "./fedos_identity_transition_peer_observation.js";

export type FedosIdentityTransitionDeviceEvidenceStatus =
  | "unknown"
  | "observed"
  | "signature-valid"
  | "authorized-at-proof-time"
  | "revoked"
  | "stale"
  | "conflicting"
  | "corroborating"
  | "not-corroborating"
  | "unavailable";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_DEVICE_EVIDENCE_STATUSES: readonly FedosIdentityTransitionDeviceEvidenceStatus[] = Object.freeze([
  "unknown",
  "observed",
  "signature-valid",
  "authorized-at-proof-time",
  "revoked",
  "stale",
  "conflicting",
  "corroborating",
  "not-corroborating",
  "unavailable",
]);

export interface FedosIdentityTransitionDeviceEvidenceRowV1 {
  readonly peerDeviceRef: string;
  readonly status: FedosIdentityTransitionDeviceEvidenceStatus;
  readonly revision: number;
  readonly observedAt: number;
}

/** Pure. Never throws. */
export function fedosIdentityTransitionDeviceEvidenceStatusFor(
  observation: FedosIdentityTransitionPeerObservationV1,
  superseded: boolean,
): FedosIdentityTransitionDeviceEvidenceStatus {
  if (observation.conflictState === "conflicting" || observation.conflictState === "rollback-detected") return "conflicting";
  if (superseded) return "stale";
  switch (observation.evidenceOutcome) {
    case "device-corroborated":
      return "corroborating";
    case "invalid":
    case "new-key-unproven":
    case "rejected":
    case "unsupported":
      return "not-corroborating";
    case "unavailable":
      return "unavailable";
    default:
      return "observed";
  }
}

/**
 * Builds one row PER REPORTING PEER DEVICE for a transitionId — never
 * merged into a single verdict. `supersededTransitionIds` names any
 * transitionId in the same lineage this Arc has already determined is
 * superseded (computed once by the caller, not re-derived per row).
 */
export function fedosIdentityTransitionBuildDeviceEvidenceRows(
  observations: readonly FedosIdentityTransitionPeerObservationV1[],
  supersededTransitionIds: ReadonlySet<string>,
): readonly FedosIdentityTransitionDeviceEvidenceRowV1[] {
  return observations
    .map((o) =>
      Object.freeze({
        peerDeviceRef: o.peerDeviceRef,
        status: fedosIdentityTransitionDeviceEvidenceStatusFor(o, supersededTransitionIds.has(o.transitionId)),
        revision: o.revision,
        observedAt: o.observedAt,
      }),
    )
    .sort((a, b) => a.peerDeviceRef.localeCompare(b.peerDeviceRef));
}
