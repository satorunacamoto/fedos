/**
 * Stage 123 — Creator appeal boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "a creator disputes a moderation/trust
 * outcome" — an APPEAL RECORD, never an enforcement action, a vote, or a
 * settlement. This is the natural counterpart to
 * `../community/moderation.ts`'s `reviewCommunityModerationTarget`: that
 * function reports what a hide/mute/filter action would visually do; this
 * file reports what a creator's DISPUTE of such an action would look like,
 * strictly as a labeled record — nothing here reverses, applies, or
 * enforces any moderation decision.
 *
 * HARD GUARDRAILS:
 *   - NO DAO, NO vote/voting, NO settlement, NO payment/treasury field of
 *     any kind. An appeal is a labeled dispute record, never a governance
 *     mechanism.
 *   - `reviewCreatorAppeal` evaluates a decision ONLY — it never mutates
 *     any stored moderation record, never contacts `StorageBackend`,
 *     `FederationProvider`, `ChatProvider`, or `MarketplaceProvider`, and
 *     never actually reverses/applies any moderation action.
 *   - NO `content`/`body`/bytes field of any kind. `targetRef`/`idRef` are
 *     OPAQUE labels a real route would resolve on its own side.
 *   - This boundary makes NO outcome guarantee. Do not describe an
 *     `accepted_placeholder` decision as "won", "granted", or "reversed".
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

/** What kind of outcome a creator is disputing — a label of intent only. */
export type CreatorAppealKind =
  | "moderation_action_placeholder"
  | "trust_label_placeholder"
  | "subscription_restriction_placeholder"
  | "test_placeholder";

/**
 * Coarse observable status of an appeal record — a display label only,
 * never a claim that any real review/reversal happened.
 */
export type CreatorAppealStatus =
  | "submitted_placeholder"
  | "under_review_placeholder"
  | "resolved_placeholder"
  | "rejected";

/**
 * A non-sensitive description of one appeal record. Carries NO
 * content/body/bytes field of any kind — only opaque labels, a kind, a
 * status, and metadata strings.
 */
export interface CreatorAppealDescriptor {
  /** OPAQUE label a real route would resolve to its own appeal-record id. */
  readonly idRef?: string;
  /** OPAQUE label (e.g. a display name) — never a pubkey/DID used for lookup. */
  readonly creatorRef?: string;
  /** OPAQUE label to the moderation/trust/subscription outcome being disputed. */
  readonly targetRef?: string;
  readonly kind: CreatorAppealKind;
  readonly status: CreatorAppealStatus;
  /** Non-sensitive display reason only — reviewed below. */
  readonly reason?: string;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by `reviewCreatorAppeal`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** The result of reviewing an appeal record. No enforcement/reversal is exposed at any state. */
export interface CreatorAppealDecision {
  readonly allowed: boolean;
  readonly state: CreatorAppealStatus;
  readonly reason: string;
}

/** Every appeal-kind label (for mapping/documentation helpers). */
export const CREATOR_APPEAL_KINDS: readonly CreatorAppealKind[] = [
  "moderation_action_placeholder",
  "trust_label_placeholder",
  "subscription_restriction_placeholder",
  "test_placeholder",
];

/**
 * Substrings that mark a metadata key/value/reason as sensitive
 * (case-insensitive). Includes a governance-specific family (`vote`/`dao`/
 * `settlement`/`treasury`/`payment`) on top of the conservative marker
 * family used across this codebase's other boundaries.
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
  "vote",
  "dao",
  "settlement",
  "treasury",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive/governance content. */
export function isSensitiveCreatorAppealValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveCreatorAppealValue(value)) return true;
  }
  return false;
}

/**
 * Decide whether an appeal record may be handed to a (future) review
 * route. Rejects (never throws) when `reason`/`metadata` contains a
 * sensitive key/value — in that case the returned `state` is `rejected`,
 * overriding whatever `status` the input carried. Otherwise the input's own
 * `status` passes through unchanged. Never mutates `appeal`, never
 * contacts storage/federation/chat/marketplace, never reverses or applies
 * any moderation action.
 */
export function reviewCreatorAppeal(appeal: CreatorAppealDescriptor): CreatorAppealDecision {
  if (appeal.reason !== undefined && isSensitiveCreatorAppealValue(appeal.reason)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "appeal reason contains a sensitive value",
    };
  }
  if (hasSensitiveMetadata(appeal.metadata)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "appeal metadata contains a sensitive key or value",
    };
  }
  return {
    allowed: true,
    state: appeal.status,
    reason: `appeal carries only non-sensitive, opaque labels (status "${appeal.status}" reported as-is, nothing reversed/applied)`,
  };
}
