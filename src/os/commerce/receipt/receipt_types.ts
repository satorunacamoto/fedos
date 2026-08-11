/**
 * FedOS Commerce End-to-End Completion arc, Wave B (Agent T) — signed
 * Trade/Delivery Receipt Proof payload shapes (original arc brief §21).
 *
 * PURE DOMAIN TYPES ONLY — this file imports nothing from `src/os/trust`
 * (see `commerce_trust_receipt_adapter.ts` for the one file in this
 * directory allowed to do that) and nothing from `../order/`, `../payment/`,
 * a future `../delivery/`, `../catalog/`, or `../reputation/` either. Every
 * cross-territory reference below is an OPAQUE, caller-supplied string —
 * this arc's established "opaque foreign key across parallel agent
 * territories" convention, already used by `order/order_types.ts`'s
 * `OrderPaymentEvidence.paymentId`/`Order.deliveryId`,
 * `payment/types.ts`'s `PaymentRequest.orderId`, and
 * `reputation/attestation_types.ts`'s `tradeRefDigestHex` — none of those
 * files import each other's modules either; each re-declares only the
 * shape it actually needs.
 *
 * WHAT A TradeReceiptProof / DeliveryReceiptProof IS
 * ----------------------------------------------------------------------
 * `TradeReceiptProofPayload` — the smallest useful signed statement that a
 * specific Order reached a completed trade state: it binds `orderId`, a
 * COARSE product reference (`productRef` — an opaque product id, never
 * product details), the two trading parties (`buyerRef`/`sellerRef`,
 * opaque identifiers — conventionally a pubkey hex, but this file does not
 * assume a format), and OPTIONALLY a payment-evidence reference
 * (`paymentEvidenceRef` — mirrors `Order.paymentId`/`PaymentEvidence.paymentId`,
 * carried as an opaque string so the signed object cryptographically binds
 * to a specific payment without this file ever importing `payment/types.ts`
 * or interpreting what "paid" means).
 *
 * `DeliveryReceiptProofPayload` adds one required field on top of the same
 * base shape: `deliveryConfirmationRef` (mirrors `Order.deliveryId`) — an
 * opaque reference to whatever confirmed delivery, again never imported
 * from a delivery module (Agent D's `delivery/` does not exist in this
 * worktree at the time this file was written — Wave B agents run in
 * parallel, isolated worktrees; see this file's own header on why every
 * cross-territory field is opaque rather than a typed import regardless).
 *
 * WHY "QR is transport, never the security primitive" IS SATISFIED HERE
 * ----------------------------------------------------------------------
 * `commerce_trust_receipt_adapter.ts` signs the ENTIRE payload below
 * (including `paymentEvidenceRef`/`deliveryConfirmationRef`) into the
 * Trust envelope's own `metadata` bag — not just a bare digest sitting
 * beside an unsigned QR image. Any payment/delivery reference this receipt
 * carries is therefore cryptographically bound INTO the signed object
 * before it is ever encoded to QR text (original brief §22 / this arc's
 * "QR never itself the security primitive" rule).
 *
 * WHAT A VALID SIGNATURE OVER EITHER PAYLOAD DOES NOT MEAN
 * ----------------------------------------------------------------------
 * Exactly the same limitation `reputation/attestation_types.ts` documents
 * for its own attestations: a valid signature proves "the key that signed
 * this envelope asserted these opaque references at this time" — it does
 * NOT prove the trade was fair, that `paymentEvidenceRef` names a genuinely
 * settled payment, that `deliveryConfirmationRef` names a genuine delivery,
 * or that the signer is a unique real human. Verifying THOSE claims is the
 * job of whatever system produced the opaque reference in the first place
 * (Order/Payment/Delivery); this receipt only proves the reference was
 * signed, never that the referenced fact is independently true.
 */

/** Bound on every opaque string field below — generous enough for a real
 * order/product/pubkey/delivery/payment id, small enough to keep the
 * canonicalized payload boundable. A local constant, not imported from
 * `src/os/trust/fedos_trust_limits.ts`, per this file's own
 * trust-import-free discipline. */
const COMMERCE_RECEIPT_MAX_FIELD_LENGTH = 512;

export type CommerceReceiptProofKind = "trade_completion" | "delivery_confirmation";

interface CommerceReceiptProofBaseFields {
  /** Opaque Order id — mirrors `Order.id` (`../order/order_types.ts`), never imported. */
  readonly orderId: string;
  /** Coarse product reference — mirrors `Order.productId`, deliberately just
   * an opaque id, never a `Product`'s own kind/title/price. */
  readonly productRef: string;
  /** Opaque identifier of the buying party — mirrors `Order.buyerPubkey`,
   * generically named since this file does not assume any particular key
   * format. */
  readonly buyerRef: string;
  /** Opaque identifier of the selling party — mirrors `Order.sellerPubkey`. */
  readonly sellerRef: string;
  /** OPTIONAL opaque reference into the payment domain's own evidence —
   * mirrors `Order.paymentId`/`PaymentEvidence.paymentId`
   * (`../payment/types.ts`), never imported. Present only when the issuer
   * chooses to bind a specific payment into this receipt. */
  readonly paymentEvidenceRef?: string;
  /** Unix seconds this trade/delivery was recorded as completed. */
  readonly completedAt: number;
  /** This payload's own schema version — mirrors every Trust/Commerce
   * payload's own `formatVersion` convention. */
  readonly formatVersion: 1;
}

/** Payload of a `TradeReceiptProof` — a completed-trade receipt for one Order. */
export interface TradeReceiptProofPayload extends CommerceReceiptProofBaseFields {
  readonly kind: "trade_completion";
}

/** Payload of a `DeliveryReceiptProof` — a completed-trade receipt PLUS a
 * required, opaque delivery-confirmation reference. */
export interface DeliveryReceiptProofPayload extends CommerceReceiptProofBaseFields {
  readonly kind: "delivery_confirmation";
  /** Opaque reference to whatever confirmed delivery — mirrors
   * `Order.deliveryId` (`../order/order_types.ts`), never imported from a
   * delivery module. */
  readonly deliveryConfirmationRef: string;
}

function isNonEmptyBoundedString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= COMMERCE_RECEIPT_MAX_FIELD_LENGTH;
}

function isUnixSecondsInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function hasOnlyAllowedKeys(candidate: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(candidate).every((key) => allowed.has(key));
}

const TRADE_RECEIPT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "kind",
  "orderId",
  "productRef",
  "buyerRef",
  "sellerRef",
  "paymentEvidenceRef",
  "completedAt",
  "formatVersion",
]);

const DELIVERY_RECEIPT_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "kind",
  "orderId",
  "productRef",
  "buyerRef",
  "sellerRef",
  "paymentEvidenceRef",
  "deliveryConfirmationRef",
  "completedAt",
  "formatVersion",
]);

function isWellFormedBaseFields(candidate: Record<string, unknown>): boolean {
  if (!isNonEmptyBoundedString(candidate.orderId)) return false;
  if (!isNonEmptyBoundedString(candidate.productRef)) return false;
  if (!isNonEmptyBoundedString(candidate.buyerRef)) return false;
  if (!isNonEmptyBoundedString(candidate.sellerRef)) return false;
  if (candidate.paymentEvidenceRef !== undefined && !isNonEmptyBoundedString(candidate.paymentEvidenceRef)) {
    return false;
  }
  if (!isUnixSecondsInteger(candidate.completedAt)) return false;
  if (candidate.formatVersion !== 1) return false;
  return true;
}

/** Fails closed to `false` on any malformed input, any missing field, or
 * any UNEXPECTED extra field (mirrors `reputation/attestation_types.ts`'s
 * allowlisted-keys discipline); never throws. */
export function isWellFormedTradeReceiptProofPayload(value: unknown): value is TradeReceiptProofPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(candidate, TRADE_RECEIPT_ALLOWED_KEYS)) return false;
  if (candidate.kind !== "trade_completion") return false;
  return isWellFormedBaseFields(candidate);
}

/** Same discipline as `isWellFormedTradeReceiptProofPayload`, plus the
 * required `deliveryConfirmationRef`. Fails closed to `false`; never throws. */
export function isWellFormedDeliveryReceiptProofPayload(value: unknown): value is DeliveryReceiptProofPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(candidate, DELIVERY_RECEIPT_ALLOWED_KEYS)) return false;
  if (candidate.kind !== "delivery_confirmation") return false;
  if (!isNonEmptyBoundedString(candidate.deliveryConfirmationRef)) return false;
  return isWellFormedBaseFields(candidate);
}

function requiredStringLiteral(fieldName: string, value: string): string {
  if (!isNonEmptyBoundedString(value)) {
    throw new RangeError(`commerce receipt proof: "${fieldName}" must be a non-empty bounded string`);
  }
  return JSON.stringify(value);
}

function optionalStringLiteral(fieldName: string, value: string | undefined): string {
  if (value === undefined) return "null";
  return requiredStringLiteral(fieldName, value);
}

/**
 * Deterministic, hand-written, fixed-field-order canonicalization of a
 * `TradeReceiptProofPayload` — following this repo's own established
 * per-record convention (`src/os/trust/envelope/fedos_trust_canonical_bytes.ts`'s
 * header: "every domain owns its own payload canonicalizer", never a
 * generic JSON canonicalizer). Used by `commerce_trust_receipt_adapter.ts`
 * to compute a self-describing content digest bound into the signed
 * envelope alongside the payload itself.
 */
export function canonicalizeTradeReceiptProofPayloadV1(payload: TradeReceiptProofPayload): string {
  const parts: readonly string[] = [
    `"kind":"trade_completion"`,
    `"orderId":${requiredStringLiteral("orderId", payload.orderId)}`,
    `"productRef":${requiredStringLiteral("productRef", payload.productRef)}`,
    `"buyerRef":${requiredStringLiteral("buyerRef", payload.buyerRef)}`,
    `"sellerRef":${requiredStringLiteral("sellerRef", payload.sellerRef)}`,
    `"paymentEvidenceRef":${optionalStringLiteral("paymentEvidenceRef", payload.paymentEvidenceRef)}`,
    `"completedAt":${String(payload.completedAt)}`,
    `"formatVersion":${String(payload.formatVersion)}`,
  ];
  return `{${parts.join(",")}}`;
}

/** Same convention as `canonicalizeTradeReceiptProofPayloadV1`, plus the
 * required `deliveryConfirmationRef`. */
export function canonicalizeDeliveryReceiptProofPayloadV1(payload: DeliveryReceiptProofPayload): string {
  const parts: readonly string[] = [
    `"kind":"delivery_confirmation"`,
    `"orderId":${requiredStringLiteral("orderId", payload.orderId)}`,
    `"productRef":${requiredStringLiteral("productRef", payload.productRef)}`,
    `"buyerRef":${requiredStringLiteral("buyerRef", payload.buyerRef)}`,
    `"sellerRef":${requiredStringLiteral("sellerRef", payload.sellerRef)}`,
    `"paymentEvidenceRef":${optionalStringLiteral("paymentEvidenceRef", payload.paymentEvidenceRef)}`,
    `"deliveryConfirmationRef":${requiredStringLiteral("deliveryConfirmationRef", payload.deliveryConfirmationRef)}`,
    `"completedAt":${String(payload.completedAt)}`,
    `"formatVersion":${String(payload.formatVersion)}`,
  ];
  return `{${parts.join(",")}}`;
}
