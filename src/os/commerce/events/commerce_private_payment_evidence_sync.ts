/**
 * Commerce Purchase/Payment Completion mega-arc (Agent P) — the PRIVATE
 * sibling of `commerce_private_order_sync.ts`, carrying an already-verified
 * `PaymentEvidence` (`../payment/types.ts`) across processes so a Payment's
 * settlement can be independently confirmed by BOTH counterparties, not
 * just the one whose process happened to observe it.
 *
 * WHY A SEPARATE WIRE SHAPE, NOT A REUSE OF `PrivateOrderSyncPayload`
 * ----------------------------------------------------------------------
 * `commerce_private_order_sync.ts`'s own header explains why `"paid"` is
 * DELIBERATELY EXCLUDED from that payload's status vocabulary: a remote
 * peer's bare claim of "paid" must never be trusted to advance the local,
 * authoritative Order/Payment state. This file is the *replacement*
 * mechanism that closes that gap honestly — instead of carrying a bare
 * claim, it carries the SAME `PaymentEvidence.verification` provenance the
 * local payment domain already requires before it will ever apply a
 * settlement transition (`payment/state_machine.ts`'s
 * `AUTHORITATIVE_PAYMENT_EVIDENCE_SOURCES`). `verification` here is
 * STRUCTURALLY restricted to exactly the two authoritative provenance
 * shapes (`"provider_verified"` / `"test_simulator"`) — a payload claiming
 * `"customer_claim"` / `"merchant_claim"` / `"provider_unverified"` does
 * not type-check and is also rejected at runtime by
 * `isWellFormedPrivatePaymentEvidenceSyncPayload` (never trust the type
 * alone — the same "recheck both the discriminant type AND the runtime
 * allowlist" discipline `payment/types.ts` already documents).
 *
 * WHAT THIS FILE DOES **NOT** DO
 * ----------------------------------------------------------------------
 * This is a pure wire-shape definition, exactly like `commerce_private_order_sync.ts`.
 * It knows nothing about Nostr/NIP-44 (see
 * `../catalog/adapters/nostr/commerce_private_payment_evidence_bridge.ts`,
 * the transport that encrypts/signs/verifies/decrypts this shape) and
 * nothing about the Payment/Order domain's own state machines (see
 * `../payment/payment_evidence_port.ts`, the receiver-side validation seam
 * that turns a verified inbound payload into a real settlement
 * transition). Carrying `PrivatePaymentEvidenceSyncPayload` around, by
 * itself, proves and changes nothing.
 *
 * FIELD CLASSIFICATION (minimum only, per the arc brief — read before
 * adding a field)
 * ----------------------------------------------------------------------
 * Every field below is ENCRYPTED-NOSTR content (NIP-44 wire ciphertext,
 * same trust model as `commerce_private_order_sync.ts`'s own header
 * explains): payment identity (`paymentId`), order binding (`orderId`),
 * amount/currency, provider/evidence identity (`verification.provider` /
 * `verification.simulator`), verification data (the whole `verification`
 * object), and timestamp/version (`observedAt`/`at`/`formatVersion`).
 * Deliberately EXCLUDED: buyer/seller pubkeys (the transport's own real,
 * verified outer signer plus the receiver's own locally-known Order
 * context supply identity — see `payment_evidence_port.ts`), any
 * credential/secret/raw signing key, and any private Order content beyond
 * the bare `orderId`/`productId` binding needed to apply the evidence.
 */

/** Mirrors `payment/types.ts`'s own `PaymentEvidence["status"]` exactly (a LOCAL, independent declaration — never imported, matching `order_types.ts`'s own established isolation convention for this arc). */
export type PaymentEvidenceSyncStatus = "settled" | "expired" | "refunded" | "error" | "disputed";

const PAYMENT_EVIDENCE_SYNC_STATUSES: readonly PaymentEvidenceSyncStatus[] = [
  "settled",
  "expired",
  "refunded",
  "error",
  "disputed",
];

/**
 * Deliberately ONLY the two AUTHORITATIVE `PaymentEvidenceProvenance` shapes
 * (`payment/types.ts`) — see this file's header. A discriminated union with
 * exactly two members, mirroring `OrderActorKind`'s own "no AI/bot member
 * exists so none can ever be constructed" structural guardrail.
 */
export type PaymentEvidenceSyncVerification =
  | { readonly source: "provider_verified"; readonly provider: string; readonly verifiedAt: number }
  | { readonly source: "test_simulator"; readonly simulator: string };

/** Bound length for `reason` — non-secret, but unbounded free text is its own risk (mirrors the Merchant Passport arc's own removed-free-text-field lesson). */
export const PAYMENT_EVIDENCE_SYNC_MAX_REASON_CHARS = 500;

export interface PrivatePaymentEvidenceSyncPayload {
  readonly category: "private-payment-evidence-sync";
  readonly formatVersion: 1;
  /** Opaque payment identity — the SAME `paymentId` the local `PaymentProvider`/`PaymentEvidence` already uses. */
  readonly paymentId: string;
  /** Order binding — opaque, never validated against `os/commerce/order` here (that happens at the receiver, `payment_evidence_port.ts`). */
  readonly orderId: string;
  readonly productId: string;
  /** Display amount in minor units — metadata the receiver cross-checks against its OWN locally-known expected amount before ever accepting this evidence. */
  readonly amountCents: number;
  readonly currency: string;
  readonly status: PaymentEvidenceSyncStatus;
  readonly verification: PaymentEvidenceSyncVerification;
  /** Unix seconds the SENDER's own provider observed/verified this evidence (mirrors `PaymentEvidence.observedAt`). */
  readonly observedAt: number;
  /** Non-secret explanation, bounded — never echoes secret/card/wallet content (same discipline as `PaymentEvidence.reason`). */
  readonly reason: string;
  /** Unix seconds this sync message itself was constructed. */
  readonly at: number;
}

export const PRIVATE_PAYMENT_EVIDENCE_SYNC_ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "category",
  "formatVersion",
  "paymentId",
  "orderId",
  "productId",
  "amountCents",
  "currency",
  "status",
  "verification",
  "observedAt",
  "reason",
  "at",
]);

const VERIFICATION_ALLOWED_KEYS_PROVIDER: ReadonlySet<string> = new Set(["source", "provider", "verifiedAt"]);
const VERIFICATION_ALLOWED_KEYS_SIMULATOR: ReadonlySet<string> = new Set(["source", "simulator"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isUnixSecondsInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function hasOnlyAllowedKeys(candidate: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(candidate).every((key) => allowed.has(key));
}

/** Structural check for `PaymentEvidenceSyncVerification` — fails closed on anything but the two exact, allowlisted shapes. */
export function isWellFormedPaymentEvidenceSyncVerification(value: unknown): value is PaymentEvidenceSyncVerification {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (c.source === "provider_verified") {
    if (!hasOnlyAllowedKeys(c, VERIFICATION_ALLOWED_KEYS_PROVIDER)) return false;
    return isNonEmptyString(c.provider) && isUnixSecondsInteger(c.verifiedAt);
  }
  if (c.source === "test_simulator") {
    if (!hasOnlyAllowedKeys(c, VERIFICATION_ALLOWED_KEYS_SIMULATOR)) return false;
    return isNonEmptyString(c.simulator);
  }
  return false;
}

/**
 * The single entry point every private-payment-evidence transport
 * implementation MUST call before ever handing a payload to
 * `encryptNip44Wire`, AND every receiver MUST call before trusting a
 * decrypted payload's shape — mirrors
 * `isWellFormedPrivateOrderSyncPayload()`'s own "fail closed, never
 * throws, allowlist-only" discipline exactly.
 */
export function isWellFormedPrivatePaymentEvidenceSyncPayload(value: unknown): value is PrivatePaymentEvidenceSyncPayload {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  if (!hasOnlyAllowedKeys(c, PRIVATE_PAYMENT_EVIDENCE_SYNC_ALLOWED_KEYS)) return false;
  if (c.category !== "private-payment-evidence-sync") return false;
  if (c.formatVersion !== 1) return false;
  if (!isNonEmptyString(c.paymentId)) return false;
  if (!isNonEmptyString(c.orderId)) return false;
  if (!isNonEmptyString(c.productId)) return false;
  if (!isNonNegativeInteger(c.amountCents)) return false;
  if (!isNonEmptyString(c.currency)) return false;
  if (typeof c.status !== "string" || !PAYMENT_EVIDENCE_SYNC_STATUSES.includes(c.status as PaymentEvidenceSyncStatus)) {
    return false;
  }
  if (!isWellFormedPaymentEvidenceSyncVerification(c.verification)) return false;
  if (!isUnixSecondsInteger(c.observedAt)) return false;
  if (typeof c.reason !== "string" || c.reason.length > PAYMENT_EVIDENCE_SYNC_MAX_REASON_CHARS) return false;
  if (!isUnixSecondsInteger(c.at)) return false;
  return true;
}
