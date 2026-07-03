/**
 * Stage 115 — Community moderation policy boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "should this piece of community content stay
 * visible" — a VISIBILITY decision, never a deletion. This mirrors the
 * "hide/mute/filter, never deletion" model already fixed for the future
 * Nostr adapter (`docs/nostr_adapter_planning.md` §7,
 * `../federation/types.js`'s `ModerationAction`) but at the COMMUNITY-POLICY
 * layer: this file is about FedOS's own local rendering choice for a board/
 * space/marketplace/chat target, not about mapping a moderation signal to a
 * Nostr event candidate (that remains `../federation/nostr_mapping.js`'s
 * job).
 *
 * HARD GUARDRAILS:
 *   - NO delete/remove/purge action exists anywhere in this file. The only
 *     requestable actions are `hide_placeholder`/`mute_placeholder`/
 *     `filter_placeholder` — there is no fourth "delete" action to request,
 *     by construction of the type, not by convention alone.
 *   - `reviewCommunityModerationTarget` evaluates a decision ONLY — it never
 *     mutates any stored content, never contacts `StorageBackend`,
 *     `FederationProvider`, `ChatProvider`, or `MarketplaceProvider`, and
 *     never actually hides/mutes/filters anything in a real UI; it only
 *     REPORTS what decision a caller should apply.
 *   - NO `content`/`body`/bytes field of any kind. `targetRef`/`idRef` are
 *     OPAQUE labels a real route would resolve on its own side.
 *   - This boundary makes NO enforcement guarantee. Do not describe an
 *     `hidden_placeholder`/`muted_placeholder`/`filtered_placeholder`
 *     decision as "deleted", "removed", or "purged" — the underlying content
 *     is untouched; only a display choice is being reported.
 */

/**
 * The visibility FedOS's own rendering would apply to a piece of content —
 * never a claim about whether the content still exists elsewhere.
 *   - `visible_placeholder`: shown normally (the default/no-op case).
 *   - `hidden_placeholder`: FedOS would not render it at all.
 *   - `muted_placeholder`: FedOS would render it collapsed/de-emphasized.
 *   - `filtered_placeholder`: FedOS would exclude it from a filtered view
 *     (e.g. a keyword/topic filter) while leaving it visible elsewhere.
 *   - `rejected`: the moderation TARGET itself failed policy review (e.g.
 *     carried a sensitive field) — no visibility decision was reached.
 */
export type ModerationVisibilityDecision =
  | "visible_placeholder"
  | "hidden_placeholder"
  | "muted_placeholder"
  | "filtered_placeholder"
  | "rejected";

/** Which community surface a moderation policy applies to — a label of intent only. */
export type CommunityModerationPolicyKind =
  | "default_placeholder"
  | "creator_space_placeholder"
  | "marketplace_placeholder"
  | "chat_placeholder"
  | "test_placeholder";

/** What KIND of thing is being moderated — a label of intent only. */
export type CommunityModerationTargetKind =
  | "post_placeholder"
  | "reply_placeholder"
  | "listing_placeholder"
  | "profile_placeholder"
  | "chat_placeholder"
  | "test_placeholder";

/**
 * The only requestable moderation actions. Deliberately excludes any
 * delete/remove/purge action — see the hard guardrails above.
 */
export type CommunityModerationRequestedAction =
  | "hide_placeholder"
  | "mute_placeholder"
  | "filter_placeholder";

/**
 * A non-sensitive description of one moderation target + requested action.
 * Carries NO `content`/`body`/bytes field of any kind — only opaque labels,
 * kind/policy labels, and metadata strings.
 */
export interface CommunityModerationTargetInput {
  /** OPAQUE label a real route would resolve to its own moderation-record id. */
  readonly idRef?: string;
  /** OPAQUE label to what is being moderated — never a real pubkey/event id. */
  readonly targetRef?: string;
  readonly targetKind: CommunityModerationTargetKind;
  readonly policyKind: CommunityModerationPolicyKind;
  readonly action: CommunityModerationRequestedAction;
  /** Non-sensitive display reason only — reviewed below. */
  readonly reason?: string;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by `reviewCommunityModerationTarget`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * The result of reviewing a moderation target. `decision` is ALWAYS one of
 * `hidden_placeholder`/`muted_placeholder`/`filtered_placeholder`/
 * `rejected` — this function never reports `visible_placeholder` itself
 * (that label exists on `ModerationVisibilityDecision` for a future full
 * policy engine to report the "no action needed" case; a caller here is
 * always asking about a specific requested hide/mute/filter action).
 */
export interface CommunityModerationReview {
  readonly decision: ModerationVisibilityDecision;
  readonly reason: string;
}

/** Every community-moderation-policy-kind label (for mapping/documentation helpers). */
export const COMMUNITY_MODERATION_POLICY_KINDS: readonly CommunityModerationPolicyKind[] = [
  "default_placeholder",
  "creator_space_placeholder",
  "marketplace_placeholder",
  "chat_placeholder",
  "test_placeholder",
];

/** Every community-moderation-target-kind label (for mapping/documentation helpers). */
export const COMMUNITY_MODERATION_TARGET_KINDS: readonly CommunityModerationTargetKind[] = [
  "post_placeholder",
  "reply_placeholder",
  "listing_placeholder",
  "profile_placeholder",
  "chat_placeholder",
  "test_placeholder",
];

/** Every requestable moderation action (for mapping/documentation helpers). */
export const COMMUNITY_MODERATION_REQUESTED_ACTIONS: readonly CommunityModerationRequestedAction[] = [
  "hide_placeholder",
  "mute_placeholder",
  "filter_placeholder",
];

const ACTION_TO_DECISION: Readonly<
  Record<CommunityModerationRequestedAction, ModerationVisibilityDecision>
> = {
  hide_placeholder: "hidden_placeholder",
  mute_placeholder: "muted_placeholder",
  filter_placeholder: "filtered_placeholder",
};

/**
 * Substrings that mark a metadata key/value/reason as sensitive
 * (case-insensitive). Matches the conservative marker family used across
 * this codebase's other boundaries (see `../social/intent.js`,
 * `../federation/nostr_mapping.js`).
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
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive content. */
export function isSensitiveModerationValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveModerationValue(value)) return true;
  }
  return false;
}

/**
 * Decide the visibility a moderation target's requested action maps to.
 * Rejects (never throws) when the reason or metadata contains a sensitive
 * key/value — in that case `decision` is `rejected`, not a hide/mute/filter
 * label. Otherwise maps the requested action 1:1 to its visibility label.
 * NEVER returns anything that could be read as "deleted"/"removed"/
 * "purged" — those actions do not exist on this type. Never mutates
 * `input`, never contacts storage/federation/chat/marketplace.
 */
export function reviewCommunityModerationTarget(
  input: CommunityModerationTargetInput,
): CommunityModerationReview {
  if (input.reason !== undefined && isSensitiveModerationValue(input.reason)) {
    return {
      decision: "rejected",
      reason: "moderation reason contains a sensitive value",
    };
  }
  if (hasSensitiveMetadata(input.metadata)) {
    return {
      decision: "rejected",
      reason: "moderation target metadata contains a sensitive key or value",
    };
  }
  return {
    decision: ACTION_TO_DECISION[input.action],
    reason: `requested action "${input.action}" maps to a local visibility decision only (nothing deleted, nothing mutated)`,
  };
}
