/**
 * Stage 44 — Payment / Lightning boundary (types only).
 *
 * A MINIMAL, future-facing seam for the step that would sit BEFORE a
 * `PurchaseGrant` is issued for a `Product` (see `src/commerce/types.ts`):
 * asking "may a payment be requested for this?" and recording the coarse
 * OUTCOME of that ask. It belongs entirely to the commerce layer's payment
 * front door and defines shapes ONLY.
 *
 * NOT IMPLEMENTED, ON PURPOSE: Lightning (BOLT11/LNURL, Breez SDK,
 * Greenlight), Stripe, Apple Pay, Google Pay, any wallet, any invoice, any
 * checkout session, and any settlement/webhook confirmation. This file opens
 * no channel, mints no invoice, builds no checkout URL, moves no funds, and
 * issues no `fetch`. `PaymentRail`/`PaymentCapability` names ending in
 * `_placeholder` are labels of FUTURE intent, not working transports.
 *
 * HARD GUARDRAILS:
 *   - A `PaymentRequest`/`PaymentDecision` NEVER carries a payment secret,
 *     card number, CVV, wallet seed/key, bearer token, or invoice/checkout
 *     URL. `amountCents`/`currency` are display metadata only — nothing here
 *     charges or moves money.
 *   - `accepted_placeholder` means "this request passed the boundary's
 *     policy check", NEVER "a payment was received/settled". Do not describe
 *     it as "paid", "settled", or "confirmed".
 *   - A `PurchaseGrant` built from a decision (see `commerce_bridge.ts`)
 *     records only a placeholder entitlement (`manual`/`promo` source) — it
 *     is never marked `source: "payment"` here, because no payment is ever
 *     actually verified by this boundary.
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

/**
 * FUTURE payment rails — all PLACEHOLDERS in this stage. A name is a label of
 * intent, NOT a working, wired, or safe transport. None is contacted here.
 */
export type PaymentRail =
  | "lightning_placeholder" // future BOLT11/LNURL rail (no invoice minted, no node)
  | "stripe_placeholder" // future Stripe Checkout/PaymentIntent rail (no API called)
  | "apple_pay_placeholder" // future Apple Pay rail (no API called)
  | "google_pay_placeholder" // future Google Pay rail (no API called)
  | "manual_placeholder" // a manual/off-platform grant path (no charge, no transfer)
  | "external_placeholder"; // any other future external rail (no API called)

/**
 * Coarse outcome/state of a payment request or the provider itself. No
 * secret, card, wallet, or invoice/checkout data is exposed at any state.
 */
export type PaymentStatus =
  | "unavailable" // no payment backend is configured (the no-op default)
  | "pending" // recorded as awaiting a future (not-yet-implemented) step
  | "accepted_placeholder" // PLACEHOLDER: passed policy — NOTHING was charged/settled
  | "rejected" // policy denied the request (e.g. bad amount, sensitive metadata)
  | "error"; // an attempt could not be served; recorded as state, never thrown

/**
 * FUTURE capabilities a provider MIGHT advertise — all PLACEHOLDERS. Presence
 * is a label of intent, not a working capability.
 */
export type PaymentCapability =
  | "lightning_placeholder"
  | "invoice_placeholder"
  | "checkout_placeholder"
  | "manual_grant_placeholder"
  | "external_payment_placeholder";

/**
 * A request to (eventually) accept payment for a product. Carries only
 * display amount/currency and a product/buyer ref — NEVER a card, wallet
 * secret, or invoice/checkout detail. `metadata` is non-secret display data
 * only; the bridge/provider strip or reject anything that looks sensitive.
 */
export interface PaymentRequest {
  readonly productId: string;
  /** Opaque public pubkey of the would-be buyer. Not a secret. */
  readonly buyerPubkey?: string;
  /** Display amount in minor units (e.g. cents). Metadata only — no charge. */
  readonly amountCents: number;
  /** ISO-4217-ish currency code, display only (e.g. "USD", "JPY"). */
  readonly currency: string;
  readonly rail: PaymentRail;
  /** Non-secret display metadata. Must contain no secret/card/wallet/token data. */
  readonly metadata?: Readonly<Record<string, string>>;
  /** Unix timestamp (seconds) the request was built, when known. */
  readonly createdAt?: number;
}

/**
 * The result of a payment request / status read. Failures and policy denials
 * are reported here (with a non-sensitive reason) rather than thrown. NEVER
 * carries a card, wallet secret, or invoice/checkout URL — that is the whole
 * point of this boundary staying a placeholder.
 */
export interface PaymentDecision {
  readonly allowed: boolean;
  /** The provider/request state AFTER this decision. */
  readonly status: PaymentStatus;
  readonly rail: PaymentRail;
  /** Non-sensitive explanation. Never echoes secret/card/wallet content. */
  readonly reason: string;
  readonly productId: string;
  /** Opaque public pubkey of the would-be buyer, when known. Not a secret. */
  readonly buyerPubkey?: string;
}

/** Coarse, non-sensitive read of whether a provider is present/ready. */
export interface PaymentProviderStatus {
  readonly available: boolean;
  readonly reason: string;
}

/**
 * The payment seam. Implementations MUST NOT charge a card, open a Lightning
 * channel/invoice, build a checkout session, contact a wallet, or issue a
 * `fetch`. `requestPayment` never throws — it resolves to a `PaymentDecision`
 * (including `rejected`/`error`). An `accepted_placeholder` decision means
 * only "policy-clean", never "paid". Constructing an implementation does
 * nothing.
 */
export interface PaymentProvider {
  /** Current coarse status (pure read). */
  getStatus(): PaymentProviderStatus;
  /** The PLACEHOLDER capabilities this provider advertises (may be empty). */
  getCapabilities(): readonly PaymentCapability[];
  /**
   * Ask to accept payment for a request. Charges NOTHING in this stage.
   * Evaluates the request against the payment policy and returns a decision;
   * never throws and never mutates the request.
   */
  requestPayment(request: PaymentRequest): Promise<PaymentDecision>;
}

/** Every placeholder rail name (for mapping/documentation helpers). */
export const PAYMENT_RAILS: readonly PaymentRail[] = [
  "lightning_placeholder",
  "stripe_placeholder",
  "apple_pay_placeholder",
  "google_pay_placeholder",
  "manual_placeholder",
  "external_placeholder",
];
