/**
 * Stage 17 — creator / EC (digital-content) model boundary (types only).
 *
 * Models the shapes needed to route from a board / space / chat toward a
 * creator's digital goods (PDF, ZIP, template, software, link, …). As with the
 * Stage 9 space and Stage 16 chat layers, everything here is data; the decisions
 * live in `policy.ts` as pure functions over these shapes.
 *
 * Explicitly OUT OF SCOPE for this stage: payment processing, checkout, download
 * delivery, inventory, and any real Stripe / crypto / R2 / D1 integration. A
 * `PurchaseGrant` records the RESULT of an external entitlement decision (a
 * manual gift, a settled payment, a promo) — this layer neither charges money
 * nor verifies that a payment happened. `priceCents` is display metadata only;
 * nothing here moves funds. There is no DRM and no "purchase guarantee".
 */

/** What kind of digital good a product is. */
export type ProductKind = "pdf" | "zip" | "template" | "software" | "link" | "other";

/** Lifecycle of a product listing. */
export type ProductStatus = "draft" | "active" | "archived";

/**
 * - public:   discoverable and viewable by anyone (guests included).
 * - unlisted: viewable by anyone who knows the id (not discoverable).
 * - private:  viewable by the creator and valid grant holders only.
 */
export type ProductVisibility = "public" | "unlisted" | "private";

/** A sellable digital product listing. */
export interface Product {
  readonly id: string;
  readonly kind: ProductKind;
  readonly title: string;
  readonly description?: string;
  /** The creator who owns/controls this listing. */
  readonly creatorPubkey: string;
  /** Display price in minor units (e.g. cents). Metadata only — no charging. */
  readonly priceCents: number;
  /** ISO-4217-ish currency code, display only (e.g. "USD", "JPY"). */
  readonly currency: string;
  readonly status: ProductStatus;
  readonly visibility: ProductVisibility;
  /** Stage 9 spaces this product is surfaced in. */
  readonly linkedSpaceIds: readonly string[];
  /** Nostr events this product is referenced from. */
  readonly linkedEventIds: readonly string[];
  /** Ids of the `DigitalAsset`s that back this product. */
  readonly assetIds: readonly string[];
}

/**
 * A downloadable artifact backing a product. `storageRef` is an opaque pointer
 * (e.g. a future R2 key) — this layer stores no bytes and serves no downloads.
 */
export interface DigitalAsset {
  readonly id: string;
  readonly productId: string;
  readonly kind: ProductKind;
  /** Opaque storage pointer; not resolved or fetched in this stage. */
  readonly storageRef: string;
  readonly filename?: string;
  readonly sizeBytes?: number;
  /** Optional integrity hash (display/verification metadata only). */
  readonly checksum?: string;
}

/** Where an entitlement came from. `payment` does NOT imply this layer charged. */
export type PurchaseGrantSource = "manual" | "payment" | "promo";

/**
 * A record that some buyer is entitled to a product. Represents an EXTERNAL
 * result only — granting one does not move money, and revoking it does not
 * refund. `revokedAt` (when set) invalidates the grant.
 */
export interface PurchaseGrant {
  readonly productId: string;
  readonly buyerPubkey: string;
  /** Unix timestamp (seconds) the grant was issued. */
  readonly grantedAt: number;
  readonly source: PurchaseGrantSource;
  /** Unix timestamp (seconds) the grant was revoked, if it has been. */
  readonly revokedAt?: number;
}

/** Result of an access check: the answer plus a human-readable reason. */
export interface AccessDecision {
  readonly allowed: boolean;
  readonly reason: string;
}
