/**
 * Stage 125 — Creator subscription policy boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "should this subscription-gated piece of
 * content be visible to this viewer" — a VISIBILITY decision, mirroring
 * `../community/moderation.ts`'s "visibility, never deletion" model one
 * layer over to subscription tiers instead of moderation actions. This is
 * STRICTLY a naming/policy layer over `../creator/membership.ts`'s
 * `MembershipPlanDescriptor` (WHAT tier exists) — it never checks, grants,
 * or verifies a real entitlement.
 *
 * HARD GUARDRAILS (see `docs/creator_governance.md`):
 *   - NO connection to `PaymentProvider` (`src/payment/`) or
 *     `EntitlementProvider` (`src/creator/entitlement.ts`). Reviewing a
 *     target never requests or verifies a payment, and never checks or
 *     grants access.
 *   - `reviewSubscriptionPolicyTarget` is STRUCTURALLY conservative: only
 *     `public_placeholder` policy targets can ever resolve to
 *     `visible_placeholder`. Every gated policy kind
 *     (`supporter_only_placeholder`/`premium_only_placeholder`) ALWAYS
 *     resolves to `restricted_placeholder` — by construction, never by a
 *     real entitlement check this stage does not (and structurally cannot)
 *     perform.
 *   - NO `content`/`body`/bytes field of any kind. `targetRef`/`idRef` are
 *     OPAQUE labels a real route would resolve on its own side.
 *   - This boundary makes NO access guarantee. Do not describe a
 *     `visible_placeholder` decision as "unlocked", "granted", or
 *     "subscribed".
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

/** Which subscription tier a piece of content is gated behind — a label of intent only. */
export type SubscriptionPolicyKind =
  | "public_placeholder"
  | "supporter_only_placeholder"
  | "premium_only_placeholder"
  | "test_placeholder";

/**
 * The visibility FedOS's own rendering would apply — never a claim that a
 * real entitlement was checked or granted.
 *   - `visible_placeholder`: shown normally — ONLY ever reached for
 *     `public_placeholder` policy targets.
 *   - `restricted_placeholder`: FedOS would not render the gated content —
 *     the STRUCTURAL default for every non-public policy kind, regardless
 *     of any viewer label supplied.
 *   - `rejected`: the policy TARGET itself failed review (e.g. carried a
 *     sensitive field) — no visibility decision was reached.
 */
export type SubscriptionAccessDecision = "visible_placeholder" | "restricted_placeholder" | "rejected";

/**
 * A non-sensitive description of one subscription-gated target. Carries NO
 * price/payment/checkout/entitlement field of any kind — only opaque
 * labels, a policy kind, an optional viewer-tier label, and metadata
 * strings.
 */
export interface SubscriptionPolicyTargetInput {
  /** OPAQUE label a real route would resolve to its own target-record id. */
  readonly idRef?: string;
  /** OPAQUE label to the content being gated — never a real listing/plan id. */
  readonly targetRef?: string;
  readonly policyKind: SubscriptionPolicyKind;
  /**
   * OPAQUE label only, e.g. "supporter" — NEVER treated as proof of a real
   * subscription; `reviewSubscriptionPolicyTarget` never branches on this
   * value except to note it in `reason`.
   */
  readonly viewerTierRef?: string;
  /** Non-sensitive key/value labels only — reviewed by `reviewSubscriptionPolicyTarget`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** The result of reviewing a subscription-gated target. No entitlement/payment data is exposed. */
export interface SubscriptionPolicyReview {
  readonly decision: SubscriptionAccessDecision;
  readonly reason: string;
}

/** Every subscription-policy-kind label (for mapping/documentation helpers). */
export const SUBSCRIPTION_POLICY_KINDS: readonly SubscriptionPolicyKind[] = [
  "public_placeholder",
  "supporter_only_placeholder",
  "premium_only_placeholder",
  "test_placeholder",
];

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Mirrors `../creator/membership.ts`'s price/checkout/entitlement family.
 */
const SENSITIVE_MARKERS: readonly string[] = [
  "price",
  "card",
  "payment",
  "checkout",
  "invoice",
  "download",
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
export function isSensitiveSubscriptionPolicyValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveSubscriptionPolicyValue(value)) return true;
  }
  return false;
}

/**
 * Decide the visibility a subscription-gated target resolves to. Rejects
 * (never throws) when `metadata` contains a sensitive key/value — in that
 * case `decision` is `rejected`. Otherwise: `public_placeholder` resolves
 * to `visible_placeholder`; every other policy kind resolves to
 * `restricted_placeholder` UNCONDITIONALLY, regardless of `viewerTierRef` —
 * this function never checks, requests, or grants a real entitlement.
 * Never mutates `input`, never contacts `PaymentProvider` or
 * `EntitlementProvider`.
 */
export function reviewSubscriptionPolicyTarget(
  input: SubscriptionPolicyTargetInput,
): SubscriptionPolicyReview {
  if (hasSensitiveMetadata(input.metadata)) {
    return {
      decision: "rejected",
      reason: "subscription policy target metadata contains a sensitive key or value",
    };
  }
  if (input.policyKind === "public_placeholder") {
    return {
      decision: "visible_placeholder",
      reason: "public_placeholder targets are always visible (no gating to check)",
    };
  }
  return {
    decision: "restricted_placeholder",
    reason: `"${input.policyKind}" is gated — restricted by construction, no real entitlement was checked`,
  };
}
