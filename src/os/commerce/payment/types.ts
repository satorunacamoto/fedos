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
 *
 * `expired`/`refunded` were added for BTCPay-readiness (Compatibility
 * Facade Reduction + Package Extraction Readiness arc) — a real
 * invoice-based rail can genuinely expire before payment, or a settled
 * payment can be refunded after the fact. Neither implies THIS boundary
 * ever verified a settlement; see `PaymentEvidence` below for the
 * separate, explicit "was this actually settled" concept a real provider
 * would report via `observePayment`/`ingestCallback`.
 */
export type PaymentStatus =
  | "unavailable" // no payment backend is configured (the no-op default)
  | "pending" // recorded as awaiting a future (not-yet-implemented) step
  | "accepted_placeholder" // PLACEHOLDER: passed policy — NOTHING was charged/settled
  | "rejected" // policy denied the request (e.g. bad amount, sensitive metadata)
  | "expired" // the request/invoice's validity window elapsed before settlement
  | "refunded" // a previously-settled payment was reversed
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
  /**
   * Opaque Order identifier (Order↔Payment binding seam, Commerce E2E
   * Completion arc). `os/commerce/payment` never imports from
   * `os/commerce/order` — this is treated as a plain opaque string
   * end-to-end, never inspected or validated here. OPTIONAL: a caller that
   * hasn't adopted Order yet may omit it, exactly as before this field
   * existed.
   */
  readonly orderId?: string;
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
  /**
   * Caller-supplied dedup key (BTCPay-readiness). A provider MUST treat two
   * requests with the same `idempotencyKey` as the same logical request —
   * e.g. return the existing decision/payment rather than minting a second
   * invoice. Opaque, non-secret; the caller mints it (a UUID, a purchase
   * attempt id), never the provider.
   */
  readonly idempotencyKey?: string;
  /**
   * Unix timestamp (seconds) after which the request/invoice is no longer
   * payable (BTCPay-readiness). Optional — a provider without an expiry
   * concept (e.g. `manual_placeholder`) may ignore it.
   */
  readonly expiresAt?: number;
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
  /** Echoed back from the request, when the caller supplied one. See `PaymentRequest.orderId`. */
  readonly orderId?: string;
  /** Opaque public pubkey of the would-be buyer, when known. Not a secret. */
  readonly buyerPubkey?: string;
  /**
   * Opaque provider-assigned identity for this payment/invoice
   * (BTCPay-readiness). Nothing to key a later `observePayment` call
   * against existed before this field — without it, a real invoice-based
   * rail has nowhere to put its invoice id. `undefined` when the decision
   * carries no addressable payment (e.g. `rejected`/`unavailable`).
   */
  readonly paymentId?: string;
  /** Echoed back from the request, when the caller supplied one. */
  readonly idempotencyKey?: string;
  /** Carried through from the request, or set by the provider if it owns expiry. */
  readonly expiresAt?: number;
}

/** Coarse, non-sensitive read of whether a provider is present/ready. */
export interface PaymentProviderStatus {
  readonly available: boolean;
  readonly reason: string;
}

/**
 * The settled/terminal-state read of a payment, distinct from
 * `PaymentDecision` (BTCPay-readiness). A `PaymentDecision` is the answer to
 * "may/did this request go through the policy gate" at REQUEST time;
 * `PaymentEvidence` is the answer to "what is the current real-world state
 * of a specific, already-identified payment" at OBSERVATION time — the
 * concept a real rail's status-poll or webhook ultimately produces. Kept as
 * a separate type deliberately: conflating the two would force every
 * `PaymentDecision` consumer to also handle terminal/webhook-only states,
 * and would blur "policy said yes" with "money actually moved" — the exact
 * conflation this boundary's own guardrails have always forbidden.
 */
export interface PaymentEvidence {
  readonly paymentId: string;
  readonly productId: string;
  /** Unix timestamp (seconds) this evidence was observed/ingested. */
  readonly observedAt: number;
  /**
   * Deliberately NOT the same union as `PaymentStatus` — evidence only ever
   * reports a TERMINAL or settlement-adjacent state, never `pending`/
   * `accepted_placeholder` (those are request-time-only concepts).
   *
   * `"disputed"` was added for Payment Hardening (Commerce E2E Completion
   * arc, Agent P) — a real webhook-based rail can report a chargeback/
   * dispute on an already-settled payment; `payment/state_machine.ts`
   * models it as reachable only from `"paid"`, transitioning to
   * `"disputed"`, from which only `"refunded"` is a further legal edge.
   */
  readonly status: "settled" | "expired" | "refunded" | "error" | "disputed";
  /** Non-sensitive explanation. Never echoes secret/card/wallet content. */
  readonly reason: string;
  /**
   * WHO/WHAT produced this evidence and whether it may EVER be trusted to
   * cause a real settlement transition (Payment Hardening, Commerce E2E
   * Completion arc, Agent P — closes
   * `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md` Gap #5).
   *
   * OPTIONAL for backward compatibility with call sites/tests that predate
   * this field — but `payment/state_machine.ts` treats a MISSING
   * `verification` exactly like a non-authoritative one: it can never cause
   * a transition. Any provider that wants its evidence to be usable by the
   * state machine MUST set this explicitly. See `PaymentEvidenceProvenance`
   * below for the full guardrail.
   */
  readonly verification?: PaymentEvidenceProvenance;
}

/**
 * WHO/WHAT produced a `PaymentEvidence`, and whether it may ever be trusted
 * to cause a real settlement transition (see `payment/state_machine.ts`).
 * This is the explicit distinction the Commerce E2E Completion brief's §16
 * asks for: a raw customer or merchant CLAIM, and an unverified provider
 * callback, must never be confused with genuinely verified evidence.
 *
 * Discriminated on `source` so `authoritative` is a LITERAL per member, not
 * a caller-settable boolean — `{ source: "customer_claim", authoritative:
 * true }` simply does not type-check. `payment/state_machine.ts`
 * independently re-checks BOTH `source` (against an explicit allowlist) AND
 * `authoritative` at runtime before ever acting on evidence — it never
 * trusts the literal type alone, since a caller could still force one
 * through with an unsafe cast (`as PaymentEvidenceProvenance`).
 *
 * Exactly five kinds exist, matching the brief's own enumeration:
 *   - `customer_claim` / `merchant_claim` — a raw, unverified assertion by
 *     a party to the trade. NEVER authoritative, by construction.
 *   - `provider_unverified` — came from something calling itself a payment
 *     provider (e.g. an inbound webhook payload), but no signature/HMAC (or
 *     equivalent) was checked. NEVER authoritative — this is exactly the
 *     shape of evidence Gap #5 warns about.
 *   - `provider_verified` — a real provider's callback/poll whose
 *     signature/HMAC (or equivalent authenticity check) was actually
 *     verified. Authoritative.
 *   - `test_simulator` — an explicit, unmistakably-labeled local/test
 *     double (`DeterministicLocalPaymentProvider`) standing in for a real
 *     rail during local acceptance testing. Authoritative, but never to be
 *     confused with `provider_verified` — the `simulator` field always
 *     names the simulator, never a real rail.
 */
export type PaymentEvidenceProvenance =
  | {
      readonly source: "customer_claim";
      readonly authoritative: false;
      /** Non-secret, informational only — e.g. a chat message, a UI form field. Never proof of anything. */
      readonly claimedBy?: string;
    }
  | {
      readonly source: "merchant_claim";
      readonly authoritative: false;
      readonly claimedBy?: string;
    }
  | {
      readonly source: "provider_unverified";
      readonly authoritative: false;
      /** Name of the provider/rail this callback/poll claims to be from. Not cryptographically confirmed. */
      readonly provider: string;
    }
  | {
      readonly source: "provider_verified";
      readonly authoritative: true;
      readonly provider: string;
      /** Unix seconds the signature/HMAC (or equivalent) check passed. */
      readonly verifiedAt: number;
    }
  | {
      readonly source: "test_simulator";
      readonly authoritative: true;
      /** Name of the local/test simulator, e.g. `"DeterministicLocalPaymentProvider"`. Never a real rail name. */
      readonly simulator: string;
    };

/**
 * Every `PaymentEvidenceProvenance["source"]` value that MAY authorize a
 * settlement transition (`payment/state_machine.ts`). Nothing else may —
 * this is the runtime allowlist that backs the core invariant: a raw
 * customer/merchant claim, or an unverified provider callback, can never
 * cause a PAID-equivalent transition, no matter what its `authoritative`
 * field claims.
 */
export const AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES: ReadonlySet<PaymentEvidenceProvenance["source"]> = new Set([
  "provider_verified",
  "test_simulator",
]);

/**
 * The payment seam. Implementations MUST NOT charge a card, open a Lightning
 * channel/invoice, build a checkout session, contact a wallet, or issue a
 * `fetch`. Every method is total and non-throwing — outcomes (including
 * `rejected`/`error`/a malformed callback) are reported as data, never
 * thrown. An `accepted_placeholder` decision means only "policy-clean",
 * never "paid". Constructing an implementation does nothing.
 *
 * BTCPay-readiness (Compatibility Facade Reduction + Package Extraction
 * Readiness arc): widened from a single-call request/decision seam to cover
 * the full lifecycle a real invoice-based rail needs — status observation,
 * webhook/callback ingestion, and optional cancel/refund. No BTCPay-specific
 * type (`BTCPayInvoice`/`BTCPayStore`/`BTCPayWebhook` or similar) appears
 * here or anywhere in `os/commerce/payment/` — a future BTCPay adapter
 * normalizes BTCPay's own wire shapes into this domain-neutral contract
 * from inside its own reserved `payment/adapters/btcpay/` directory,
 * exactly the same pattern already enforced for Nostr in `os/commerce/catalog/adapters/nostr/`.
 */
export interface PaymentProvider {
  /** Current coarse status (pure read). */
  getStatus(): PaymentProviderStatus;
  /** The PLACEHOLDER capabilities this provider advertises (may be empty). */
  getCapabilities(): readonly PaymentCapability[];
  /**
   * Ask to accept payment for a request. Charges NOTHING in this stage.
   * Evaluates the request against the payment policy and returns a decision;
   * never throws and never mutates the request. Idempotent when
   * `request.idempotencyKey` is supplied and reused — a provider MUST
   * return the existing decision rather than minting a second payment.
   */
  requestPayment(request: PaymentRequest): Promise<PaymentDecision>;
  /**
   * Poll the current real-world state of a previously-identified payment
   * (BTCPay-readiness — the status-polling gap a single-call `requestPayment`
   * cannot cover). Never throws; an unknown `paymentId` resolves to a
   * `PaymentEvidence` with `status: "error"`, not a rejected promise.
   */
  observePayment(paymentId: string): Promise<PaymentEvidence>;
  /**
   * Normalize an inbound provider callback/webhook payload into
   * `PaymentEvidence` (BTCPay-readiness). Returns `null` for a payload the
   * provider does not recognize or cannot parse — a malformed/foreign
   * callback is data, never a thrown error. Implementations MUST verify any
   * callback signature/HMAC themselves before returning non-null evidence;
   * this contract does not model the verification step itself (rail-specific).
   *
   * Payment Hardening (Commerce E2E Completion arc, Agent P — closes
   * `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md` Gap #5): every
   * `PaymentEvidence` this method returns MUST set `verification`
   * (`PaymentEvidence.verification`) honestly — `"provider_verified"` only
   * once a real signature/HMAC check actually passed, `"provider_unverified"`
   * otherwise. Omitting `verification` is treated identically to
   * `"provider_unverified"` by `payment/state_machine.ts` (fail-closed), so
   * it is never sufficient to reach a real settlement transition either way
   * — but implementations SHOULD still set it explicitly for observability.
   */
  ingestCallback(payload: unknown): Promise<PaymentEvidence | null>;
  /**
   * Cancel a payment BEFORE settlement (BTCPay-readiness, optional — not
   * every rail has a cancellable pre-settlement window, e.g.
   * `manual_placeholder`). Deliberately a DIFFERENT method from any future
   * refund concept: cancellation prevents a payment that hasn't happened
   * yet; refund reverses one that has. Never throws.
   */
  cancelPayment?(paymentId: string): Promise<PaymentDecision>;
  /**
   * Refund a previously-settled payment (BTCPay-readiness, optional, kept
   * semantically separate from `cancelPayment` per the guardrail above).
   * Resolves to the resulting `PaymentEvidence` (`status: "refunded"` on
   * success). Never throws.
   */
  refundPayment?(paymentId: string): Promise<PaymentEvidence>;
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
