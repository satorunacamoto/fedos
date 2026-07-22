/**
 * Secure Runtime Alpha 5721–5800 — Phase J: the local acceptance policy.
 * A PURE function — no I/O, no signature verification of its own (that
 * already happened in Phase H before this is ever called), no session
 * mutation. Separates local implementation support, peer advertisement,
 * verified peer evidence, Device Trust, and session-readiness/route
 * concerns into one narrow decision.
 *
 * Never a boolean (Phase J's own requirement) — see
 * `./fedos_ratchet_peer_capability_acceptance_outcome.ts` for the full
 * closed outcome vocabulary. No outcome here may cause an already-
 * active STRONGER route to be silently weakened — `"downgrade-detected"`
 * is a terminal, non-accepting outcome specifically so a caller can never
 * mistake it for acceptance.
 */
import type { FedosDeviceTrustState } from "../../../device/fedos_device_binding.js";
import type { FedosRatchetPeerCapabilityEntry, FedosRatchetPeerCapabilityRoute } from "./fedos_ratchet_peer_capability_vocabulary.js";
import { fedosRatchetPeerCapabilityEntryKey } from "./fedos_ratchet_peer_capability_vocabulary.js";
import type { FedosRatchetPeerCapabilityEvidenceLevel } from "./fedos_ratchet_peer_capability_authentication.js";
import type { FedosRatchetPeerCapabilityAcceptanceOutcome } from "./fedos_ratchet_peer_capability_acceptance_outcome.js";

export interface FedosRatchetPeerCapabilityPriorAcceptedSummary {
  readonly revision: number;
  /** The route entries the PRIOR accepted advertisement claimed — used only for downgrade detection. */
  readonly claimedRoutes: readonly FedosRatchetPeerCapabilityRoute[];
}

export interface FedosRatchetPeerCapabilityAcceptanceInput {
  readonly now: number;
  readonly expiresAt: number;
  readonly revision: number;
  readonly evidenceLevel: FedosRatchetPeerCapabilityEvidenceLevel;
  /** `"unknown"` when the claimed peer Device has no local Device Registry binding at all. */
  readonly peerDeviceTrustState: FedosDeviceTrustState | "unknown";
  /** The peer's own claimed entries — `null` when evaluating a lifecycle notification rather than an advertisement (Phase D facts carry no capability list of their own). */
  readonly claimedCapabilities: readonly FedosRatchetPeerCapabilityEntry[] | null;
  /** The local endpoint's own known-supported entries — required whenever `claimedCapabilities !== null`. */
  readonly locallySupportedCapabilities: readonly FedosRatchetPeerCapabilityEntry[] | null;
  /** The most recent prior ACCEPTED fact for the same subject, or `null` if none exists yet. */
  readonly priorAccepted: FedosRatchetPeerCapabilityPriorAcceptedSummary | null;
  /** `true` when a DIFFERENT, already-durably-recorded fact exists at the exact same revision (Phase K: conflicting advertisements/signatures at the same revision). */
  readonly conflictingDuplicateAtSameRevision: boolean;
}

function entriesOfKind<K extends FedosRatchetPeerCapabilityEntry["kind"]>(
  entries: readonly FedosRatchetPeerCapabilityEntry[],
  kind: K,
): readonly Extract<FedosRatchetPeerCapabilityEntry, { kind: K }>[] {
  return entries.filter((e): e is Extract<FedosRatchetPeerCapabilityEntry, { kind: K }> => e.kind === kind);
}

function hasSharedEntry(
  a: readonly FedosRatchetPeerCapabilityEntry[],
  b: readonly FedosRatchetPeerCapabilityEntry[],
  kind: FedosRatchetPeerCapabilityEntry["kind"],
): boolean {
  const aKeys = new Set(entriesOfKind(a, kind).map(fedosRatchetPeerCapabilityEntryKey));
  return entriesOfKind(b, kind).some((e) => aKeys.has(fedosRatchetPeerCapabilityEntryKey(e)));
}

/** `true` when the peer's PRIOR accepted claim included the live ratchet route but the current claim does not — the one downgrade shape this Arc can detect from capability claims alone. */
function isRouteDowngrade(
  priorRoutes: readonly FedosRatchetPeerCapabilityRoute[],
  currentCapabilities: readonly FedosRatchetPeerCapabilityEntry[],
): boolean {
  if (!priorRoutes.includes("nostr-nip17-v1-ratchet")) return false;
  const currentRoutes = new Set(entriesOfKind(currentCapabilities, "private-message-route").map((e) => e.route));
  return !currentRoutes.has("nostr-nip17-v1-ratchet");
}

/**
 * The one pure decision function. Checked in order: Device trust, expiry,
 * conflict, staleness/rollback, downgrade, then (advertisements only)
 * suite/route compatibility. Evidence level never gates acceptance on its
 * own (Phase E: Device proof is best-effort) — it is recorded, never
 * enforced here.
 */
export function evaluateFedosRatchetPeerCapabilityAcceptance(
  input: FedosRatchetPeerCapabilityAcceptanceInput,
): FedosRatchetPeerCapabilityAcceptanceOutcome {
  if (input.peerDeviceTrustState === "revoked") return "revoked-device";
  if (input.peerDeviceTrustState !== "trusted") return "untrusted-device";
  if (input.now > input.expiresAt) return "expired";
  if (input.conflictingDuplicateAtSameRevision) return "conflicting";
  if (input.priorAccepted !== null && input.revision <= input.priorAccepted.revision) return "stale";

  if (input.claimedCapabilities !== null) {
    if (input.priorAccepted !== null && isRouteDowngrade(input.priorAccepted.claimedRoutes, input.claimedCapabilities)) {
      return "downgrade-detected";
    }
    const local = input.locallySupportedCapabilities ?? [];
    if (!hasSharedEntry(local, input.claimedCapabilities, "ratchet-suite")) return "unsupported";
    if (!hasSharedEntry(local, input.claimedCapabilities, "private-message-route")) return "peer-incompatible";
  }

  return "accepted";
}
