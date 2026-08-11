/**
 * Secure Runtime Alpha 6121–6200 — Phase B: the closed, user-safe
 * transition display model.
 *
 * Contains ONLY safe facts already durably recorded elsewhere in this
 * Arc's own lineage — never raw signatures, private keys, Master Seed,
 * root/chain/message/skipped keys, sealed-state references, local
 * paths, raw protocol payload, or arbitrary executable content. Built
 * exclusively from a `FedosIdentityTransitionPeerObservationV1` plus
 * optionally a manual-verification fact — never re-derives evidence
 * from raw proofs (those are gone by the time a Peer Observation is
 * durable; see the prior Arc's own Phase F).
 *
 * `verified` is never displayed as equivalent to `trusted` — this file's
 * own DTO exposes `evidenceOutcome` and `acceptanceState` as two
 * genuinely distinct closed fields, exactly like the Foundation's own
 * safe status (`fedos_identity_transition_safe_status.ts`), never
 * collapsed into one boolean.
 */
import type { FedosDeviceBindingAccountRef } from "../../../device/fedos_device_binding.js";
import type { FedosIdentityTransitionEvidenceOutcome } from "../fedos_identity_transition_evidence_evaluation.js";
import type { FedosIdentityTransitionAcceptanceState } from "../fedos_identity_transition_acceptance_state.js";
import type { FedosIdentityTransitionPeerObservationV1 } from "./fedos_identity_transition_peer_observation.js";
import type { FedosIdentityTransitionManualVerificationFactV1 } from "./fedos_identity_transition_manual_verification.js";
import { fedosIdentityTransitionBuildDeviceEvidenceRows, type FedosIdentityTransitionDeviceEvidenceRowV1 } from "./fedos_identity_transition_device_evidence_display.js";
import { type FedosIdentityTransitionWarningCode } from "./fedos_identity_transition_warning_codes.js";

export interface FedosIdentityTransitionSafeViewV1 {
  readonly transitionId: string;
  readonly oldAccountIdentity: FedosDeviceBindingAccountRef;
  readonly newAccountIdentity: FedosDeviceBindingAccountRef;
  readonly revision: number;
  readonly previousTransitionId: string | null;
  readonly evidenceOutcome: FedosIdentityTransitionEvidenceOutcome;
  readonly acceptanceState: FedosIdentityTransitionAcceptanceState;
  readonly superseded: boolean;
  /** `true` iff the evaluator specifically capped this transition at `"manual-verification-required"` — the one outcome that, by construction, means an old-key-only signature was judged insufficient. Never inferred any other way. */
  readonly oldKeyOnlyInsufficientWarning: boolean;
  readonly deviceEvidence: readonly FedosIdentityTransitionDeviceEvidenceRowV1[];
  readonly manualVerification: {
    readonly method: FedosIdentityTransitionManualVerificationFactV1["method"];
    readonly verifiedAt: number;
    readonly noteCode: FedosIdentityTransitionManualVerificationFactV1["noteCode"];
  } | null;
  readonly observedAt: number;
  readonly expiresAt: number;
  readonly warnings: readonly FedosIdentityTransitionWarningCode[];
}

/**
 * Pure. Derives the closed warning-code list for one transition's
 * current state — this is the ONE place that decides which warnings
 * apply, so every screen shows the identical set for the identical
 * state.
 */
export function fedosIdentityTransitionWarningsFor(
  evidenceOutcome: FedosIdentityTransitionEvidenceOutcome,
  acceptanceState: FedosIdentityTransitionAcceptanceState,
  superseded: boolean,
): readonly FedosIdentityTransitionWarningCode[] {
  const warnings: FedosIdentityTransitionWarningCode[] = ["replacement-not-rotation"];
  if (evidenceOutcome === "manual-verification-required" || evidenceOutcome === "continuity-old-key-only") {
    warnings.push("old-key-signature-may-be-forged");
  }
  if (evidenceOutcome === "device-corroborated") {
    warnings.push("device-corroboration-not-proof");
  }
  if (acceptanceState === "conflicting") warnings.push("conflicting-claims-require-manual-review");
  if (superseded || acceptanceState === "superseded") warnings.push("conflicting-claims-require-manual-review");
  if (acceptanceState === "accepted") {
    warnings.push(
      "continuity-acceptance-is-local-decision",
      "historical-messages-remain-attributed-to-old-identity",
      "existing-ratchet-keys-will-not-move",
      "new-secure-session-required",
      "other-devices-may-decide-independently",
    );
  }
  return Object.freeze(warnings);
}

/** Pure builder — combines an observation, its full lineage/device rows, and an optional manual-verification fact into one safe DTO. Never touches persistence itself. */
export function fedosIdentityTransitionBuildSafeView(params: {
  readonly observation: FedosIdentityTransitionPeerObservationV1;
  readonly superseded: boolean;
  readonly acceptanceState: FedosIdentityTransitionAcceptanceState;
  readonly sameTransitionObservations: readonly FedosIdentityTransitionPeerObservationV1[];
  readonly supersededTransitionIds: ReadonlySet<string>;
  readonly manualVerification: FedosIdentityTransitionManualVerificationFactV1 | null;
}): FedosIdentityTransitionSafeViewV1 {
  const { observation, superseded, acceptanceState, sameTransitionObservations, supersededTransitionIds, manualVerification } = params;
  return Object.freeze({
    transitionId: observation.transitionId,
    oldAccountIdentity: observation.oldAccountIdentity,
    newAccountIdentity: observation.newAccountIdentity,
    revision: observation.revision,
    previousTransitionId: observation.previousTransitionId,
    evidenceOutcome: observation.evidenceOutcome,
    acceptanceState,
    superseded,
    oldKeyOnlyInsufficientWarning: observation.evidenceOutcome === "manual-verification-required",
    deviceEvidence: fedosIdentityTransitionBuildDeviceEvidenceRows(sameTransitionObservations, supersededTransitionIds),
    manualVerification:
      manualVerification === null
        ? null
        : Object.freeze({ method: manualVerification.method, verifiedAt: manualVerification.verifiedAt, noteCode: manualVerification.noteCode }),
    observedAt: observation.observedAt,
    expiresAt: observation.expiresAt,
    warnings: fedosIdentityTransitionWarningsFor(observation.evidenceOutcome, acceptanceState, superseded),
  });
}
