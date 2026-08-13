/**
 * FedOS Commerce Product-Media Sync + Truthful Completion mega-arc, Wave A
 * (Agent S) — Task 1: old-key continuity auto-accept VISIBILITY recovery.
 *
 * `FEDOS_IDENTITY_TRANSITION_DEFAULT_LOCAL_POLICY.autoAcceptOldKeyContinuity`
 * is `true` (unchanged by this file — flipping it is a separate, out-of-
 * scope product decision). That means `evaluateFedosIdentityTransitionEvidence()`
 * can return `"locally-acceptable"` for a peer's identity-replacement claim
 * that was signed with nothing but their OLD, possibly-compromised key —
 * with zero user interaction. This is a DETECTION helper only: it changes
 * no policy and no evaluation outcome, it only names, precisely, the one
 * case that happened silently, so a UI layer can choose to disclose it.
 *
 * Why "evidenceOutcome === locally-acceptable" is enough, here specifically:
 * `evaluateFedosIdentityTransitionEvidence()` reaches `"locally-acceptable"`
 * by exactly three routes:
 *   1. `manualVerificationConfirmed` — an explicit, out-of-band human
 *      decision (not silent).
 *   2. continuity valid + non-compromise reason + Device corroboration
 *      present — a second, independent evidence source (arguably not
 *      "old-key-ALONE").
 *   3. continuity valid + non-compromise reason + NO Device corroboration +
 *      `localPolicy.autoAcceptOldKeyContinuity` — the OLD-KEY-ONLY route
 *      this Task exists to surface.
 *
 * `FedosIdentityTransitionPeerObservationV1` records (the ONLY thing this
 * codebase's Safety Center / Identity Transition Inbox ever reads — see
 * `fedos_identity_transition_peer_runtime.ts`) are produced by exactly one
 * writer, `FedosIdentityTransitionInboundNotificationCoordinator`, which
 * hardcodes `deviceCorroborationStatuses: []` and
 * `manualVerificationConfirmed: false` for every evaluation it performs
 * (see that file's own header — Device corroboration embedded in an
 * inbound notification is receiving-side-unverifiable and therefore never
 * fed to the evaluator as `[cryptographically-valid]`). Routes 1 and 2
 * above are therefore UNREACHABLE for a peer observation as this codebase
 * stands today: `evidenceOutcome === "locally-acceptable"` on a peer
 * observation can only mean route 3.
 *
 * If Device corroboration or manual verification is ever wired into the
 * inbound path, this detector's own precision claim above stops holding
 * and it MUST be revisited (e.g. by carrying the underlying evidence flags
 * through to the observation itself, rather than re-deriving from the
 * outcome alone).
 *
 * Separately: `acceptanceState === "accepted"` here means the SILENT base
 * outcome was never overridden by supersession — it is intentionally NOT
 * gated on "no explicit local decision exists", because a
 * `"locally-acceptable"` evidence outcome already reaches `"accepted"` the
 * moment it is evaluated (see `computeFedosIdentityTransitionAcceptanceState()`
 * — the base state for `"locally-acceptable"` is already `"accepted"`
 * regardless of any later decision fact). An explicit LOCAL decision can
 * only ever move this AWAY from `"accepted"` (an explicit reject) — it can
 * never be the REASON acceptance happened, so there is no risk of this
 * flagging a transition the user explicitly, consciously accepted through
 * the Identity Transition screen's own "Accept" button after review of a
 * `"manual-review-required"`/`"corroborated"` item; those reach `"accepted"`
 * only via `decision === "accept"`, with `evidenceOutcome` staying
 * something other than `"locally-acceptable"`.
 */
import type { FedosIdentityTransitionEvidenceOutcome } from "../fedos_identity_transition_evidence_evaluation.js";
import type { FedosIdentityTransitionAcceptanceState } from "../fedos_identity_transition_acceptance_state.js";

export interface FedosIdentityTransitionSilentAcceptanceInput {
  readonly evidenceOutcome: FedosIdentityTransitionEvidenceOutcome;
  readonly acceptanceState: FedosIdentityTransitionAcceptanceState;
  readonly superseded: boolean;
}

/**
 * Pure, total, never throws. `true` iff this transition reached
 * `"accepted"` purely because the pure evidence evaluator itself returned
 * `"locally-acceptable"` for an old-key-only continuity signature — i.e.
 * without ANY explicit local human decision ever being required. See this
 * file's own header for exactly why `evidenceOutcome === "locally-acceptable"`
 * is a precise (not approximate) test for a PEER observation in this
 * codebase today.
 */
export function isFedosIdentityTransitionSilentlyAutoAcceptedOldKeyContinuity(
  input: FedosIdentityTransitionSilentAcceptanceInput,
): boolean {
  if (input.superseded) return false;
  if (input.evidenceOutcome !== "locally-acceptable") return false;
  return input.acceptanceState === "accepted";
}
