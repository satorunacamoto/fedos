/**
 * Secure Runtime Alpha 899 ("Overall Readiness Result") — Stage 9 of
 * Phase A of the Alpha 891–930 Private Conversation Draft Construction
 * and Readiness Runtime Arc.
 *
 * A PURE evaluation over the nine axes (`./fedos_conversation_readiness_axis.ts`,
 * Alpha 898) into ONE closed overall outcome:
 *   - `"draft-ready"`      — every axis a metadata-only draft needs is
 *                            satisfied, but encryption is not yet ready,
 *                            so the Conversation may exist only as a
 *                            `draft` (never active).
 *   - `"activation-ready"` — additionally, the injected encryption
 *                            readiness authority PROVED encryption ready
 *                            (`encryption` axis `"ready"`). This Arc never
 *                            returns this by default (the default
 *                            authority is `"unavailable"`, Alpha 924) and
 *                            never itself performs an activation — a
 *                            future reviewed activation operation owns
 *                            that transition.
 *   - `"blocked"`          — at least one draft-required axis is not
 *                            `"ready"`/`"not-required"`.
 *
 * `evaluateFedosConversationReadiness()` is TOTAL and NEVER throws —
 * mirroring `FedosConversationPolicyAuthority.resolvePolicy()`'s own
 * non-throwing contract. It carries no policy value, no resolved
 * identity, no draft record — a readiness reading is a preview
 * (`previewAdmission()`'s own "pure — never mutates" precedent), never a
 * fresh guarantee folded together with resolved values.
 *
 * DRAFT-REQUIRED axes (must each be `"ready"` for `draft-ready`):
 * identity, conversationPersistence, policy, creatorMembership,
 * payloadStorage, retention. The `capability` axis is draft-OPTIONAL
 * (`"not-required"` when no initial Capability was requested — Alpha
 * 907/11). The `protocolDelivery` axis is NEVER a draft blocker (a draft
 * is honestly local-only, `02`'s own "explicitly not a construction
 * blocker" finding) — it is surfaced for observation only. The
 * `encryption` axis NEVER blocks a draft — its ONLY effect is gating
 * `activation-ready`, per this Arc's own "draft does not imply encrypted"
 * rule (Alpha 893).
 */

import {
  FEDOS_CONVERSATION_READINESS_AXES,
  type FedosConversationReadinessAxis,
  type FedosConversationReadinessAxisResult,
  type FedosConversationReadinessAxisState,
} from "./fedos_conversation_readiness_axis.js";

export type FedosConversationOverallReadinessOutcome = "draft-ready" | "activation-ready" | "blocked";

/** The full multidimensional reading — one coarse state per axis, plus the derived overall outcome. Immutable. */
export interface FedosConversationReadiness {
  readonly axes: readonly FedosConversationReadinessAxisResult[];
  readonly overall: FedosConversationOverallReadinessOutcome;
}

/** The per-axis states a producer supplies; every axis MUST be present (a closed, exhaustive map). */
export type FedosConversationReadinessAxisStates = Readonly<
  Record<FedosConversationReadinessAxis, FedosConversationReadinessAxisState>
>;

/** Axes whose non-`"ready"` state blocks even a draft. `capability` is intentionally excluded (draft-optional). */
const DRAFT_REQUIRED_AXES: readonly FedosConversationReadinessAxis[] = [
  "identity",
  "conversationPersistence",
  "policy",
  "creatorMembership",
  "payloadStorage",
  "retention",
];

function axisSatisfiesDraft(state: FedosConversationReadinessAxisState): boolean {
  // A draft-required axis is satisfied only when genuinely ready. A
  // draft-OPTIONAL axis (capability) additionally counts "not-required".
  return state === "ready";
}

function optionalAxisSatisfiesDraft(state: FedosConversationReadinessAxisState): boolean {
  return state === "ready" || state === "not-required";
}

/**
 * Pure — derives the closed overall outcome and freezes a full
 * axis-by-axis reading. Never throws; a missing axis is treated as
 * `"unavailable"` (fail closed) rather than assumed ready.
 */
export function evaluateFedosConversationReadiness(
  states: FedosConversationReadinessAxisStates,
): FedosConversationReadiness {
  const axes: FedosConversationReadinessAxisResult[] = FEDOS_CONVERSATION_READINESS_AXES.map((axis) =>
    Object.freeze({ axis, state: states[axis] ?? "unavailable" }),
  );

  const draftBlocked = DRAFT_REQUIRED_AXES.some((axis) => !axisSatisfiesDraft(states[axis] ?? "unavailable"));
  const capabilityOk = optionalAxisSatisfiesDraft(states.capability ?? "unavailable");

  let overall: FedosConversationOverallReadinessOutcome;
  if (draftBlocked || !capabilityOk) {
    overall = "blocked";
  } else if (states.encryption === "ready") {
    overall = "activation-ready";
  } else {
    overall = "draft-ready";
  }

  return Object.freeze({ axes: Object.freeze(axes), overall });
}
