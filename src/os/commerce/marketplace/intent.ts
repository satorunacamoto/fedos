/**
 * Stage 114 — Marketplace purchase intent boundary (types + pure policy).
 *
 * A protocol-neutral SHAPE for "a user WOULD like to do something with a
 * listing" (view, express purchase intent, subscribe intent, tip intent,
 * request access) — an INTENT, not a transaction. This file defines the
 * intent shape and a pure review function only; nothing here charges,
 * grants, or moves money. It exists so a future UI/route can express "the
 * user clicked buy" as data, before any payment/entitlement logic is wired
 * up.
 *
 * HARD GUARDRAILS (see `docs/marketplace_boundary.md`):
 *   - NO price, card, payment, checkout, invoice, or download field
 *     anywhere. A `MarketplaceIntentDescriptor` names WHAT the user wants
 *     to do and WITH WHICH listing — never how much it costs, how it is
 *     paid for, or what they would receive.
 *   - NO connection to `PaymentProvider` (`src/payment/`) or
 *     `EntitlementProvider` (`src/creator/entitlement.ts`). Reviewing an
 *     intent never requests or verifies a payment, and never checks or
 *     grants access.
 *   - `reviewMarketplaceIntent` evaluates a decision ONLY — it never
 *     charges, grants, or contacts `MarketplaceProvider`/`StorageBackend`.
 *   - This boundary makes NO availability, pricing, or transaction
 *     guarantee. Do not describe an `accepted_placeholder` decision as
 *     "purchased", "paid", or "granted".
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

/** What the user WOULD like to do with a listing — a label of intent only. */
export type MarketplaceIntentKind =
  | "view_listing_placeholder"
  | "purchase_intent_placeholder"
  | "subscribe_intent_placeholder"
  | "tip_intent_placeholder"
  | "request_access_placeholder"
  | "test_placeholder";

/**
 * A non-sensitive description of one purchase-adjacent intent. Carries NO
 * price/card/payment/checkout/invoice/download field of any kind — only
 * opaque labels, a kind, and metadata strings.
 */
export interface MarketplaceIntentDescriptor {
  /** OPAQUE label a real route would resolve to its own intent/record id. */
  readonly idRef?: string;
  /** OPAQUE label a real route would resolve to its own listing id. */
  readonly listingRef?: string;
  /** OPAQUE label (e.g. a display name) — never a pubkey/DID used for lookup. */
  readonly actorRef?: string;
  /** OPAQUE label (e.g. a display name) — never a pubkey/DID used for lookup. */
  readonly creatorRef?: string;
  readonly kind: MarketplaceIntentKind;
  readonly createdAt?: number;
  /** Non-sensitive key/value labels only — reviewed by `reviewMarketplaceIntent`. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** Coarse observable state of an intent review. No payment data is exposed at any state. */
export type MarketplaceIntentState = "accepted_placeholder" | "rejected";

/**
 * The result of reviewing an intent. `accepted_placeholder` means the
 * intent is policy-clean — NOT that anything was purchased, paid, or
 * granted.
 */
export interface MarketplaceIntentDecision {
  readonly allowed: boolean;
  readonly state: MarketplaceIntentState;
  readonly reason: string;
}

/** Every marketplace-intent-kind label (for mapping/documentation helpers). */
export const MARKETPLACE_INTENT_KINDS: readonly MarketplaceIntentKind[] = [
  "view_listing_placeholder",
  "purchase_intent_placeholder",
  "subscribe_intent_placeholder",
  "tip_intent_placeholder",
  "request_access_placeholder",
  "test_placeholder",
];

/**
 * Substrings that mark a metadata key/value as sensitive (case-insensitive).
 * Includes the marketplace-specific price/card/checkout/invoice/download
 * family (see the hard guardrails above) alongside the conservative marker
 * family used across this codebase's other boundaries.
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

/** True if a string value looks like it carries sensitive content. */
export function isSensitiveMarketplaceIntentValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_MARKERS.some((marker) => v.includes(marker));
}

function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveMarketplaceIntentValue(value)) return true;
  }
  return false;
}

/** Return a NEW metadata object with sensitive entries removed, or `undefined` if none remain. */
export function sanitizeMarketplaceIntentMetadata(
  metadata: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  let kept = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key) || isSensitiveMarketplaceIntentValue(value)) continue;
    out[key] = value;
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

/**
 * Decide whether an intent may be handed to a (future) route. Denies (never
 * throws) when metadata contains a sensitive key/value. A clean intent is
 * `accepted_placeholder` — a PLACEHOLDER acceptance that still charges/
 * grants nothing. Never mutates `intent`, never contacts `PaymentProvider`
 * or `EntitlementProvider`.
 */
export function reviewMarketplaceIntent(
  intent: MarketplaceIntentDescriptor,
): MarketplaceIntentDecision {
  if (hasSensitiveMetadata(intent.metadata)) {
    return {
      allowed: false,
      state: "rejected",
      reason: "intent metadata contains a sensitive key or value",
    };
  }
  return {
    allowed: true,
    state: "accepted_placeholder",
    reason: "intent carries only non-sensitive, opaque labels (nothing charged/granted)",
  };
}
