/**
 * Secure Runtime Alpha 6121–6200 — Phase H: read-only Ratchet impact
 * view over the ALREADY-PUBLIC `FedosDirectRatchetConversationRuntime.getDirectRatchetStatus()`
 * safe status (8 closed values) — see the reconciliation report's own
 * "Ratchet impact identification without a new session-listing query"
 * decision. Never reaches into raw session records; never mutates
 * anything.
 */
export type FedosDirectRatchetSafeStatusLike =
  | "unsupported"
  | "initialization-required"
  | "pending"
  | "active"
  | "reset-required"
  | "peer-incompatible"
  | "revoked"
  | "unavailable";

export interface FedosIdentityTransitionSessionPairToAssess {
  readonly conversationId: string;
  readonly remoteDeviceRef: string;
}

export interface FedosIdentityTransitionSessionImpactRowV1 {
  readonly conversationId: string;
  readonly remoteDeviceRef: string;
  readonly currentStatus: FedosDirectRatchetSafeStatusLike;
  /** `true` only for a session genuinely live enough to need an explicit reset trigger — mirrors the Foundation's own `planFedosIdentityTransitionAffectedSessions()` "still resettable" filter, applied to the SAFE STATUS surface instead of raw lifecycle state. */
  readonly resetRecommended: boolean;
}

const RESETTABLE_STATUSES: ReadonlySet<FedosDirectRatchetSafeStatusLike> = new Set(["pending", "active"]);

/** Pure. Never throws. */
export function fedosIdentityTransitionBuildSessionImpactRow(
  pair: FedosIdentityTransitionSessionPairToAssess,
  currentStatus: FedosDirectRatchetSafeStatusLike,
): FedosIdentityTransitionSessionImpactRowV1 {
  return Object.freeze({
    conversationId: pair.conversationId,
    remoteDeviceRef: pair.remoteDeviceRef,
    currentStatus,
    resetRecommended: RESETTABLE_STATUSES.has(currentStatus),
  });
}
