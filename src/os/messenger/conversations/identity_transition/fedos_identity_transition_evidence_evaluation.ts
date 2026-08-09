/**
 * FedOS Identity Transition Foundation Arc — Phase I: pure evidence
 * evaluation.
 *
 * This is the ONLY place in the domain that combines new-key proof,
 * old-identity continuity evidence, Device corroboration, local policy,
 * the transition's own reason category, and history-derived facts
 * (rollback/conflict/staleness/supersession, computed by the durable
 * persistence layer, Phase J) into one closed outcome. A pure, synchronous
 * function — no I/O, no clock read (the caller supplies
 * `timestampCheck`), no crypto (callers supply already-computed
 * per-evidence statuses from Phases F/G/H).
 *
 * Two hard invariants this file enforces (Absolute Prohibitions), both
 * covered by the real vertical slice and failure matrix:
 *   1. "Do not auto-accept transitions merely because all signatures
 *      parse" — `"locally-acceptable"` is returned ONLY when local policy
 *      explicitly allows it (non-compromise + old-key-only, gated by
 *      `localPolicy.autoAcceptOldKeyContinuity`) or when a manual
 *      out-of-band verification fact is already recorded true. A
 *      cryptographically-valid proof alone, under a compromise reason,
 *      NEVER reaches `"locally-acceptable"`.
 *   2. "A compromise-confirmed reason must not treat the old signature as
 *      sufficient" — under `key-compromise-suspected`/`-confirmed`, old-key
 *      continuity evidence alone caps out at `"manual-verification-required"`;
 *      only Device corroboration (still just `"device-corroborated"`, not
 *      auto-`"locally-acceptable"`) or an explicit manual-verification
 *      fact can move it further.
 */
import { isFedosIdentityTransitionCompromiseReason } from "../../../../conversation/identity_transition/fedos_identity_transition_vocabulary.js";
import type {
  FedosIdentityTransitionEvidenceStatus,
  FedosIdentityTransitionReasonCategory,
  FedosIdentityTransitionType,
} from "../../../../conversation/identity_transition/fedos_identity_transition_vocabulary.js";
import type { FedosIdentityTransitionTimestampCheck } from "../../../../conversation/identity_transition/fedos_identity_transition_record.js";

export type FedosIdentityTransitionEvidenceOutcome =
  | "invalid"
  | "new-key-unproven"
  | "continuity-unproven"
  | "continuity-old-key-only"
  | "device-corroborated"
  | "manual-verification-required"
  | "locally-acceptable"
  | "rejected"
  | "stale"
  | "rollback-detected"
  | "conflicting"
  | "superseded"
  | "unsupported"
  | "unavailable";

export const FEDOS_IDENTITY_TRANSITION_KNOWN_EVIDENCE_OUTCOMES: readonly FedosIdentityTransitionEvidenceOutcome[] = Object.freeze([
  "invalid",
  "new-key-unproven",
  "continuity-unproven",
  "continuity-old-key-only",
  "device-corroborated",
  "manual-verification-required",
  "locally-acceptable",
  "rejected",
  "stale",
  "rollback-detected",
  "conflicting",
  "superseded",
  "unsupported",
  "unavailable",
]);

/** History-derived facts, computed by the durable persistence layer (Phase J) — never re-derived here. */
export type FedosIdentityTransitionHistoryOutcome = "none" | "rollback-detected" | "conflicting" | "superseded" | "stale";

export interface FedosIdentityTransitionLocalPolicy {
  /** Whether a non-compromise-reason old-key-only continuity signature is, by itself, treated as `"locally-acceptable"` (the review's own "old-identity-signed" baseline). `false` is the more conservative choice and still leaves the evidence recorded as `"continuity-old-key-only"`. */
  readonly autoAcceptOldKeyContinuity: boolean;
}

export const FEDOS_IDENTITY_TRANSITION_DEFAULT_LOCAL_POLICY: FedosIdentityTransitionLocalPolicy = Object.freeze({
  autoAcceptOldKeyContinuity: true,
});

export interface FedosIdentityTransitionEvidenceEvaluationInput {
  readonly structurallyValid: boolean;
  readonly transitionType: FedosIdentityTransitionType;
  readonly reasonCategory: FedosIdentityTransitionReasonCategory;
  readonly timestampCheck: FedosIdentityTransitionTimestampCheck;
  readonly historyOutcome: FedosIdentityTransitionHistoryOutcome;
  readonly newKeyProofValid: boolean;
  /** `"absent"` when no continuity evidence was ever attached. */
  readonly continuityEvidenceStatus: FedosIdentityTransitionEvidenceStatus | "absent";
  /** One entry per attached Device corroboration proof — deliberately a list, never a single boolean, so callers can see how many (bounded) Devices actually corroborated. */
  readonly deviceCorroborationStatuses: readonly FedosIdentityTransitionEvidenceStatus[];
  /** `true` only once a human has confirmed continuity through an out-of-band channel this domain does not itself implement (Phase K's own `"manual-review-required"`/accepted local acceptance state is the thing that would set this). */
  readonly manualVerificationConfirmed: boolean;
  readonly localPolicy: FedosIdentityTransitionLocalPolicy;
}

function hasCryptographicallyValidDeviceCorroboration(statuses: readonly FedosIdentityTransitionEvidenceStatus[]): boolean {
  return statuses.some((s) => s === "cryptographically-valid" || s === "corroborated");
}

/**
 * Pure decision function. Evaluation order (highest-priority checks
 * first, each one short-circuits): history-derived facts > timestamp
 * window > transitionType support > new-key proof > continuity/Device
 * evidence combination.
 */
export function evaluateFedosIdentityTransitionEvidence(
  input: FedosIdentityTransitionEvidenceEvaluationInput,
): FedosIdentityTransitionEvidenceOutcome {
  if (!input.structurallyValid) return "invalid";
  if (input.transitionType !== "identity-replacement") return "unsupported";

  if (input.historyOutcome === "rollback-detected") return "rollback-detected";
  if (input.historyOutcome === "conflicting") return "conflicting";
  if (input.historyOutcome === "superseded") return "superseded";
  if (input.historyOutcome === "stale") return "stale";

  if (input.timestampCheck === "future-issued-beyond-skew") return "invalid";
  if (input.timestampCheck === "expired") return "stale";

  if (!input.newKeyProofValid) return "new-key-unproven";

  if (input.manualVerificationConfirmed) return "locally-acceptable";

  const compromise = isFedosIdentityTransitionCompromiseReason(input.reasonCategory);
  const deviceCorroborated = hasCryptographicallyValidDeviceCorroboration(input.deviceCorroborationStatuses);
  const continuityValid = input.continuityEvidenceStatus === "cryptographically-valid";

  if (continuityValid) {
    if (compromise) {
      // Phase G/I invariant: old-key signature alone is never sufficient under a compromise reason.
      return deviceCorroborated ? "device-corroborated" : "manual-verification-required";
    }
    if (deviceCorroborated) return "locally-acceptable";
    return input.localPolicy.autoAcceptOldKeyContinuity ? "locally-acceptable" : "continuity-old-key-only";
  }

  // No valid old-key continuity signature at all (e.g. reasonCategory is
  // "identity-lost"/"recovery-unavailable", where one is impossible by
  // definition) — Device corroboration is the only remaining path.
  if (deviceCorroborated) return "device-corroborated";

  if (
    input.continuityEvidenceStatus === "rejected" ||
    input.continuityEvidenceStatus === "unverifiable" ||
    input.continuityEvidenceStatus === "conflicting" ||
    input.continuityEvidenceStatus === "absent"
  ) {
    return "continuity-unproven";
  }
  return "continuity-unproven";
}
