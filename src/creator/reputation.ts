/**
 * Stage 124 — Creator reputation boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "a reputation SIGNAL exists about a
 * creator" — a labeled input to a future scoring system, never a computed
 * score itself. This file performs NO aggregation, NO scoring algorithm,
 * and NO real trust computation of any kind: `reviewReputationSignal` only
 * decides whether a single signal's LABEL is policy-clean, exactly as
 * `../creator/profile.ts`'s `reviewCreatorProfile` never performs real
 * identity verification.
 *
 * HARD GUARDRAILS:
 *   - NO numeric score, weight, or aggregation field of any kind. A
 *     `CreatorReputationLabel` is a FIXED, named category — never a
 *     computed number a future algorithm might disagree about.
 *   - `reviewReputationSignal` evaluates a decision ONLY — it never
 *     mutates any stored reputation record, never contacts
 *     `StorageBackend`, and never combines multiple signals into anything.
 *   - NO `content`/`body`/bytes field of any kind. `targetRef`/`idRef` are
 *     OPAQUE labels a real route would resolve on its own side.
 *   - This boundary makes NO trust guarantee. Do not describe an
 *     `accepted_placeholder` decision as "trusted", "verified", or
 *     "scored".
 */

/**
 * A fixed reputation category label — NEVER a computed score. Mirrors
 * `../creator/profile.ts`'s `CreatorTrustLabel` naming convention, one
 * level narrower in scope (a single signal, not an aggregate profile
 * label).
 */
export type CreatorReputationLabel =
  | "new_placeholder"
  | "steady_placeholder"
  | "notable_placeholder"
  | "flagged_placeholder"
  | "test_placeholder";

/**
 * A non-sensitive description of one reputation signal. Carries NO
 * numeric score/weight field and NO content/body/bytes field of any kind —
 * only opaque labels, a fixed category label, and metadata strings.
 */
export interface ReputationSignalDescriptor {
  /** OPAQUE label a real route would resolve to its own signal-record id. */
  readonly idRef?: string;
  /** OPAQUE label (e.g. a display name) — never a pubkey/DID used for lookup. */
  readonly creatorRef?: string;
  readonly label: CreatorReputationLabel;
  /** Non-sensitive display reason only — reviewed below. */
  readonly reason?: string;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by `reviewReputationSignal`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** Coarse observable state of a signal review. No score/aggregation is exposed at any state. */
export type ReputationSignalState = "accepted_placeholder" | "rejected";

/**
 * The result of reviewing a signal. `accepted_placeholder` means the
 * signal is policy-clean — NOT that it was combined into any score, and
 * NOT that the creator IS the label named.
 */
export interface ReputationSignalDecision {
  readonly allowed: boolean;
  readonly state: ReputationSignalState;
  readonly reason: string;
}

/** Every reputation-label value (for mapping/documentation helpers). */
export const CREATOR_REPUTATION_LABELS: readonly CreatorReputationLabel[] = [
  "new_placeholder",
  "steady_placeholder",
  "notable_placeholder",
  "flagged_placeholder",
  "test_placeholder",
];

/**
 * Substrings that mark a metadata key/value/reason as sensitive
 * (case-insensitive). Includes a scoring-specific family (`score`/`weight`/
 * `rank`) on top of the conservative marker family used across this
 * codebase's other boundaries.
 */
const SENSITIVE_MARKERS: readonly string[] = [
  "secret",
  "key",
  "seed",
  "token",
  "payment",
  "entitlement",
  "dm",
  "body",
  "content",
  "message",
  "score",
  "weight",
  "rank",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive/scoring content. */
export function isSensitiveReputationValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveReputationValue(value)) return true;
  }
  return false;
}

/**
 * Decide whether a reputation signal may be handed to a (future) display
 * route. Rejects (never throws) when `reason`/`metadata` contains a
 * sensitive key/value (including a score/weight/rank field — this boundary
 * carries LABELS only, never a number). Never mutates `signal`, never
 * aggregates it with any other signal, never contacts `StorageBackend`.
 */
export function reviewReputationSignal(
  signal: ReputationSignalDescriptor,
): ReputationSignalDecision {
  if (signal.reason !== undefined && isSensitiveReputationValue(signal.reason)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "signal reason contains a sensitive value",
    };
  }
  if (hasSensitiveMetadata(signal.metadata)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "signal metadata contains a sensitive key or value",
    };
  }
  return {
    allowed: true,
    state: "accepted_placeholder",
    reason: "signal carries only a non-sensitive, opaque label (no score computed, no aggregation performed)",
  };
}
