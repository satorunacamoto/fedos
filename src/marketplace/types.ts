/**
 * Stage 111 — Marketplace provider boundary (types only).
 *
 * A protocol-neutral seam for "a creator lists something for sale/support"
 * (a digital product, a membership, a subscription, a tip jar, a service),
 * decoupled from any specific payment rail or storefront protocol. This is
 * a DIFFERENT, more abstract layer than the existing `src/commerce/`
 * (`Product`/`PurchaseGrant`, already Nostr-event-shaped) — the same
 * relationship `src/social/` has to the Nostr-specific `src/chat/`/
 * `src/community/` models. This file defines shapes ONLY.
 *
 * HARD GUARDRAILS (see `docs/marketplace_boundary.md`):
 *   - NO price, payment, checkout, download, or bytes field anywhere.
 *     `MarketplaceListingDescriptor` names WHAT is listed and WHO listed
 *     it — never how much it costs, how it is paid for, or what a buyer
 *     receives.
 *   - NO connection to `PaymentProvider` (`src/payment/`) and NO
 *     `PurchaseGrant` (`src/commerce/`) is ever issued from this boundary.
 *   - `listPlaceholder`/`purchasePlaceholder` evaluate a decision ONLY —
 *     `listPlaceholder` always returns an empty list, and
 *     `purchasePlaceholder` never grants access or moves money.
 *   - This boundary makes NO availability, pricing, or transaction
 *     guarantee. Do not describe it as "for sale", "purchasable", or
 *     "in stock".
 */

/** What kind of thing is listed — a label of intent only. */
export type MarketplaceItemKind =
  | "digital_product_placeholder"
  | "membership_placeholder"
  | "subscription_placeholder"
  | "tip_placeholder"
  | "service_placeholder"
  | "test_placeholder";

/** How widely a listing is meant to be reachable — a label of intent only. */
export type MarketplaceVisibility = "public" | "unlisted" | "private";

/** Coarse observable state of a marketplace operation. No price/payment data is exposed at any state. */
export type MarketplaceState =
  | "unavailable" // no marketplace provider is present (the no-op default)
  | "accepted_placeholder" // passed placeholder review; nothing was listed/purchased
  | "rejected" // failed placeholder review
  | "error"; // an operation could not be served; recorded, never thrown

/**
 * A non-sensitive description of one listing. Carries NO price/payment/
 * checkout/download/bytes field of any kind — only opaque labels, a kind, a
 * visibility, and metadata strings.
 */
export interface MarketplaceListingDescriptor {
  /** OPAQUE label a real provider would resolve to its own listing id. */
  readonly idRef?: string;
  /** OPAQUE label (e.g. a display name) — never a pubkey/DID used for lookup. */
  readonly creatorRef?: string;
  readonly kind: MarketplaceItemKind;
  readonly visibility: MarketplaceVisibility;
  /** Non-sensitive key/value labels only. */
  readonly metadata?: Readonly<Record<string, string>>;
}

/** The current, non-sensitive status of a marketplace provider. */
export interface MarketplaceStatus {
  readonly allowed: boolean;
  readonly state: MarketplaceState;
  readonly reason?: string;
}

/** The result of a `listPlaceholder` call. `items` is ALWAYS empty in this stage. */
export interface MarketplaceListDecision {
  readonly allowed: boolean;
  readonly state: MarketplaceState;
  readonly reason?: string;
  readonly items: readonly MarketplaceListingDescriptor[];
}

/**
 * How a caller asks to (eventually) purchase. `listingRef` is an OPAQUE
 * label — NEVER a price, payment method, or checkout/session reference.
 */
export interface MarketplacePurchaseRequest {
  readonly listingRef?: string;
}

/**
 * The result of a `purchasePlaceholder` attempt. NEVER grants access and
 * NEVER carries a checkout/download URL, receipt, or entitlement.
 */
export interface MarketplacePurchaseDecision {
  readonly allowed: boolean;
  readonly state: MarketplaceState;
  readonly reason?: string;
}

/**
 * The marketplace-provider seam. Implementations MUST NOT connect to a
 * `PaymentProvider`, issue a `PurchaseGrant`, build a checkout/download URL,
 * or issue a `fetch`. Every method is total and never throws. Constructing
 * an implementation does nothing.
 */
export interface MarketplaceProvider {
  /** Current coarse status (pure read). */
  status(): MarketplaceStatus;
  /** Ask to (eventually) list. Lists NOTHING in this stage; `items` is always empty. */
  listPlaceholder(): Promise<MarketplaceListDecision>;
  /** Ask to (eventually) purchase. Charges/grants NOTHING in this stage. */
  purchasePlaceholder(request: MarketplacePurchaseRequest): Promise<MarketplacePurchaseDecision>;
}

/** Every marketplace-item-kind label (for mapping/documentation helpers). */
export const MARKETPLACE_ITEM_KINDS: readonly MarketplaceItemKind[] = [
  "digital_product_placeholder",
  "membership_placeholder",
  "subscription_placeholder",
  "tip_placeholder",
  "service_placeholder",
  "test_placeholder",
];
