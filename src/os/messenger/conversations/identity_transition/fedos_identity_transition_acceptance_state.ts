/**
 * FedOS Identity Transition Foundation Arc — Phase K: local peer
 * acceptance/observation state.
 *
 * This is LOCAL evidence-and-policy state only. It never touches
 * contacts, the Device Registry, Conversation Membership, Ratchet
 * session state, or the account profile (Absolute Prohibitions — this
 * Arc must not modify any of those) — it is a pure, standalone
 * projection of a `FedosIdentityTransitionEvidenceOutcome` plus at most
 * one EXPLICIT local decision, computed fresh every time from durable
 * facts (Phase J), never itself durably stored as a separate mutable
 * "current state" field (that would risk drifting from the facts it is
 * derived from).
 *
 * `"accepted"`/`"rejected"` are reachable only through an EXPLICIT local
 * decision (`recordLocalDecision()`, Phase N) layered on top of a
 * non-final evaluation outcome — Absolute Prohibitions: "no automatic
 * peer acceptance". A hard-fail outcome (`"rejected"`, `"conflicting"`,
 * `"stale"`, `"superseded"`, `"rollback-detected"`) can never be
 * overridden into acceptance by an explicit decision — fail closed.
 */
import type { FedosIdentityTransitionEvidenceOutcome } from "./fedos_identity_transition_evidence_evaluation.js";

export type FedosIdentityTransitionAcceptanceState =
  | "observed"
  | "structurally-valid"
  | "proof-verified"
  | "corroborated"
  | "manual-review-required"
  | "accepted"
  | "rejected"
  | "conflicting"
  | "stale"
  | "superseded"
  | "rollback-detected";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_ACCEPTANCE_STATES: readonly FedosIdentityTransitionAcceptanceState[] = Object.freeze([
  "observed",
  "structurally-valid",
  "proof-verified",
  "corroborated",
  "manual-review-required",
  "accepted",
  "rejected",
  "conflicting",
  "stale",
  "superseded",
  "rollback-detected",
]);

/** States a caller's explicit decision can never override (fail closed). */
const FINAL_ACCEPTANCE_STATES: ReadonlySet<FedosIdentityTransitionAcceptanceState> = new Set([
  "rejected",
  "conflicting",
  "stale",
  "superseded",
  "rollback-detected",
]);

export type FedosIdentityTransitionExplicitLocalDecision = "none" | "accept" | "reject";

function baseAcceptanceStateFor(outcome: FedosIdentityTransitionEvidenceOutcome): FedosIdentityTransitionAcceptanceState {
  switch (outcome) {
    case "invalid":
      return "rejected";
    case "new-key-unproven":
      return "rejected";
    case "continuity-unproven":
      return "manual-review-required";
    case "continuity-old-key-only":
      return "manual-review-required";
    case "device-corroborated":
      return "corroborated";
    case "manual-verification-required":
      return "manual-review-required";
    case "locally-acceptable":
      return "accepted";
    case "rejected":
      return "rejected";
    case "stale":
      return "stale";
    case "rollback-detected":
      return "rollback-detected";
    case "conflicting":
      return "conflicting";
    case "superseded":
      return "superseded";
    case "unsupported":
      return "rejected";
    case "unavailable":
      return "manual-review-required";
  }
}

/**
 * Pure. `explicitLocalDecision` is ignored entirely once the base state
 * is one of `FINAL_ACCEPTANCE_STATES` — no explicit decision can promote
 * a detected conflict/rollback/staleness/supersession into acceptance.
 */
export function computeFedosIdentityTransitionAcceptanceState(
  outcome: FedosIdentityTransitionEvidenceOutcome,
  explicitLocalDecision: FedosIdentityTransitionExplicitLocalDecision = "none",
): FedosIdentityTransitionAcceptanceState {
  const base = baseAcceptanceStateFor(outcome);
  if (FINAL_ACCEPTANCE_STATES.has(base)) return base;
  if (explicitLocalDecision === "accept") return "accepted";
  if (explicitLocalDecision === "reject") return "rejected";
  return base;
}
