/**
 * Stage 116 — Creator membership plan boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "a creator offers a membership tier" — names
 * WHAT tier exists and HOW WIDELY it is meant to be reachable, decoupled
 * from any price, checkout, or access grant. This is the same relationship
 * `src/marketplace/types.ts`'s `MarketplaceListingDescriptor` has to
 * payment: a membership plan is a LABEL a future checkout/entitlement flow
 * would reference, never the flow itself.
 *
 * HARD GUARDRAILS (see `docs/creator_monetization_flow.md`):
 *   - NO price, payment, checkout, invoice, or download field anywhere. A
 *     `MembershipPlanDescriptor` names WHAT tier is offered and BY WHOM —
 *     never how much it costs, how it is paid for, or what unlocks.
 *   - NO connection to `PaymentProvider` (`src/payment/`) or
 *     `EntitlementProvider` (`src/creator/entitlement.ts`). Reviewing a plan
 *     never requests or verifies a payment, and never checks or grants
 *     access.
 *   - `reviewMembershipPlan` evaluates a decision ONLY — it never charges,
 *     grants, or contacts `MarketplaceProvider`/`StorageBackend`.
 *   - This boundary makes NO availability, pricing, or entitlement
 *     guarantee. Do not describe an `accepted_placeholder` decision as
 *     "subscribed", "paid", or "unlocked".
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

/** What kind of membership tier is offered — a label of intent only. */
export type MembershipPlanKind =
  | "free_placeholder"
  | "supporter_placeholder"
  | "premium_placeholder"
  | "community_placeholder"
  | "private_chat_placeholder"
  | "test_placeholder";

/** How widely a plan is meant to be reachable — a label of intent only. */
export type MembershipPlanVisibility = "public" | "unlisted" | "private";

/**
 * A non-sensitive description of one membership plan. Carries NO price/
 * payment/checkout/invoice/download field of any kind — only opaque labels,
 * a kind, a visibility, and metadata strings.
 */
export interface MembershipPlanDescriptor {
  /** OPAQUE label a real route would resolve to its own plan id. */
  readonly idRef?: string;
  /** OPAQUE label (e.g. a display name) — never a pubkey/DID used for lookup. */
  readonly creatorRef?: string;
  readonly kind: MembershipPlanKind;
  readonly visibility: MembershipPlanVisibility;
  /** Non-sensitive key/value labels only — reviewed by `reviewMembershipPlan`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** Coarse observable state of a plan review. No price/payment data is exposed at any state. */
export type MembershipPlanState = "accepted_placeholder" | "rejected";

/**
 * The result of reviewing a plan. `accepted_placeholder` means the plan is
 * policy-clean — NOT that anything was subscribed to, paid for, or
 * unlocked.
 */
export interface MembershipPlanDecision {
  readonly allowed: boolean;
  readonly state: MembershipPlanState;
  readonly reason: string;
}

/** Every membership-plan-kind label (for mapping/documentation helpers). */
export const MEMBERSHIP_PLAN_KINDS: readonly MembershipPlanKind[] = [
  "free_placeholder",
  "supporter_placeholder",
  "premium_placeholder",
  "community_placeholder",
  "private_chat_placeholder",
  "test_placeholder",
];

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Includes the membership-specific price/checkout/entitlement/download
 * family alongside the conservative marker family used across this
 * codebase's other boundaries (see `../marketplace/intent.js`).
 */
const SENSITIVE_MARKERS: readonly string[] = [
  "price",
  "card",
  "payment",
  "checkout",
  "invoice",
  "download",
  "signed",
  "secret",
  "key",
  "seed",
  "token",
  "entitlement",
  "buyer",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_MARKERS.some((marker) => k.includes(marker));
}

/** True if a string value looks like it carries sensitive/price content. */
export function isSensitiveMembershipPlanValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveMembershipPlanValue(value)) return true;
  }
  return false;
}

/** Return a NEW metadata object with sensitive entries removed, or `undefined` if none remain. */
export function sanitizeMembershipPlanMetadata(
  metadata: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  let kept = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveMembershipPlanValue(value)) continue;
    out[key] = value;
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

/**
 * Decide whether a plan may be handed to a (future) route/preview. Denies
 * (never throws) when metadata contains a sensitive key/value. A clean plan
 * is `accepted_placeholder` — a PLACEHOLDER acceptance that still charges/
 * grants nothing. Never mutates `plan`, never contacts `PaymentProvider` or
 * `EntitlementProvider`.
 */
export function reviewMembershipPlan(plan: MembershipPlanDescriptor): MembershipPlanDecision {
  if (hasSensitiveMetadata(plan.metadata)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "plan metadata contains a sensitive key or value",
    };
  }
  return {
    allowed: true,
    state: "accepted_placeholder",
    reason: "plan carries only non-sensitive, opaque labels (nothing charged/granted)",
  };
}
