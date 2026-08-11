/**
 * FedOS Identity Transition Foundation Arc — Phase L: read-only Ratchet
 * impact plan.
 *
 * A pure, descriptive DTO only. Nothing in this file touches any live
 * Ratchet session, Device Registry, or Outbox state — Absolute
 * Prohibitions: no automatic Ratchet reset, no root/chain key rebinding,
 * this Arc does not wire into `../fedos_direct_ratchet_session_reset_authority.ts`
 * at all. `planFedosIdentityTransitionRatchetImpact()` only reports what
 * a FUTURE Arc (named in this Arc's own completion declaration: "FedOS
 * Identity Transition Peer Notification and Ratchet Reset Integration
 * Arc") would need to apply — it never applies anything itself.
 */
import type { FedosIdentityTransitionAcceptanceState } from "./fedos_identity_transition_acceptance_state.js";

export interface FedosIdentityTransitionRatchetImpactPlanV1 {
  readonly schemaVersion: 1;
  readonly transitionId: string;
  /** `true` only when the transition's local acceptance state is `"accepted"` — a plan is only actionable for an accepted transition. */
  readonly actionable: boolean;
  readonly existingSessionsRequireReset: boolean;
  readonly oldSessionsMustNotRebind: boolean;
  readonly pendingOutboxFactsRequireExplicitHandling: boolean;
  readonly newDevicePairSessionsRequired: boolean;
  readonly skippedKeysMustNotMigrate: boolean;
  readonly oldHistoryRemainsHistorical: boolean;
  readonly notes: readonly string[];
}

export function planFedosIdentityTransitionRatchetImpact(
  transitionId: string,
  acceptanceState: FedosIdentityTransitionAcceptanceState,
): FedosIdentityTransitionRatchetImpactPlanV1 {
  const actionable = acceptanceState === "accepted";
  return Object.freeze({
    schemaVersion: 1,
    transitionId,
    actionable,
    existingSessionsRequireReset: actionable,
    oldSessionsMustNotRebind: true,
    pendingOutboxFactsRequireExplicitHandling: actionable,
    newDevicePairSessionsRequired: actionable,
    skippedKeysMustNotMigrate: true,
    oldHistoryRemainsHistorical: true,
    notes: Object.freeze(
      actionable
        ? [
            "PLAN ONLY — no Ratchet session, Device Registry, or Outbox state is mutated by this Arc.",
            "Apply exclusively through the FedOS Identity Transition Peer Notification and Ratchet Reset Integration Arc.",
          ]
        : ["Transition is not locally accepted; this plan is descriptive only and not yet actionable."],
    ),
  });
}
