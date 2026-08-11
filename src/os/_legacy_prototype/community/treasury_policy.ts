/**
 * Stage 126 — Community treasury policy boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "would this CATEGORY of community-held
 * resource information be disclosable" — a DISCLOSURE-POLICY decision,
 * never an accounting system. This file computes NO balance, NO amount, NO
 * settlement of any kind: it only decides whether a named CATEGORY label
 * is policy-clean to disclose, exactly as
 * `../community/moderation.ts` decides a VISIBILITY label without ever
 * touching real content.
 *
 * HARD GUARDRAILS (see `docs/creator_governance.md`):
 *   - NO DAO, NO vote/voting, NO payment, NO settlement, NO balance/amount/
 *     fund field of any kind, anywhere in this file. A
 *     `CommunityTreasuryDisclosureRequest` names a CATEGORY only — it
 *     never carries a number.
 *   - `reviewCommunityTreasuryDisclosure` evaluates a decision ONLY — it
 *     never contacts `PaymentProvider`, `StorageBackend`, or any ledger of
 *     any kind (none exists in this codebase).
 *   - NO `content`/`body`/bytes field of any kind. `communityRef`/`idRef`
 *     are OPAQUE labels a real route would resolve on its own side.
 *   - This boundary makes NO financial, custody, or governance guarantee.
 *     Do not describe an `allowed_disclosure_placeholder` decision as
 *     "funded", "spent", or "voted".
 */

/** Which CATEGORY of community-held resource a disclosure request names — a label only. */
export type CommunityTreasuryCategoryKind =
  | "operating_placeholder"
  | "grants_placeholder"
  | "reserve_placeholder"
  | "test_placeholder";

/**
 * Coarse observable decision for a disclosure request. NEVER a real
 * balance/amount — a policy label only.
 *   - `allowed_disclosure_placeholder`: this category's EXISTENCE (never
 *     an amount) would be nameable in a future disclosure surface.
 *   - `restricted_placeholder`: this category is not (yet) named as
 *     disclosable.
 *   - `rejected`: the request itself failed policy review (e.g. carried a
 *     sensitive field).
 */
export type CommunityTreasuryPolicyDecision =
  | "allowed_disclosure_placeholder"
  | "restricted_placeholder"
  | "rejected";

/**
 * A non-sensitive description of one disclosure request. Carries NO
 * balance/amount/fund field of any kind — only opaque labels, a category
 * kind, and metadata strings.
 */
export interface CommunityTreasuryDisclosureRequest {
  /** OPAQUE label a real route would resolve to its own request-record id. */
  readonly idRef?: string;
  /** OPAQUE label to the community this request concerns. */
  readonly communityRef?: string;
  readonly categoryKind: CommunityTreasuryCategoryKind;
  /** Non-sensitive key/value labels only — reviewed by `reviewCommunityTreasuryDisclosure`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** The result of reviewing a disclosure request. No balance/amount/fund data is exposed at any state. */
export interface CommunityTreasuryPolicyReview {
  readonly decision: CommunityTreasuryPolicyDecision;
  readonly reason: string;
}

/** Every treasury-category-kind label (for mapping/documentation helpers). */
export const COMMUNITY_TREASURY_CATEGORY_KINDS: readonly CommunityTreasuryCategoryKind[] = [
  "operating_placeholder",
  "grants_placeholder",
  "reserve_placeholder",
  "test_placeholder",
];

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Includes a treasury-specific family (`balance`/`amount`/`fund`/`settlement`/
 * `vote`/`dao`) on top of the conservative marker family used across this
 * codebase's other boundaries.
 */
const SENSITIVE_MARKERS: readonly string[] = [
  "secret",
  "key",
  "seed",
  "token",
  "payment",
  "entitlement",
  "balance",
  "amount",
  "fund",
  "settlement",
  "vote",
  "dao",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive/financial content. */
export function isSensitiveTreasuryPolicyValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveTreasuryPolicyValue(value)) return true;
  }
  return false;
}

/**
 * Decide whether a treasury-category disclosure request is policy-clean.
 * Rejects (never throws) when `metadata` contains a sensitive key/value
 * (including any balance/amount/fund/settlement/vote/dao field — this
 * boundary carries CATEGORY LABELS only, never a number or a governance
 * action). A clean request is `allowed_disclosure_placeholder` — a
 * PLACEHOLDER acceptance that names no amount and settles nothing. Never
 * mutates `request`, never contacts any ledger or `PaymentProvider`.
 */
export function reviewCommunityTreasuryDisclosure(
  request: CommunityTreasuryDisclosureRequest,
): CommunityTreasuryPolicyReview {
  if (hasSensitiveMetadata(request.metadata)) {
    return {
      decision: "rejected",
      reason: "disclosure request metadata contains a sensitive key or value",
    };
  }
  return {
    decision: "allowed_disclosure_placeholder",
    reason: `category "${request.categoryKind}" name is disclosable (no amount named, no settlement performed)`,
  };
}
