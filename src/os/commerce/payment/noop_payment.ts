/**
 * Stage 44 — Payment provider implementations.
 *
 * Two safe defaults for the `PaymentProvider` seam. NEITHER charges a card,
 * opens a Lightning channel/invoice, builds a checkout session, contacts a
 * wallet, or issues a `fetch`. Every method is total and never throws.
 *
 *   - `NoopPaymentProvider` is the permanently `unavailable` default: it
 *     advertises nothing and rejects every request.
 *   - `PlaceholderPaymentProvider` (dev/test) evaluates a plain policy check
 *     (a sane amount, no sensitive-looking metadata) and returns
 *     `accepted_placeholder` or `rejected` — but it still charges/settles
 *     NOTHING. `accepted_placeholder` is a placeholder decision, not a paid
 *     confirmation.
 *
 * These exist so callers can depend on the seam without a real payment rail,
 * exactly as the app depends on mock/no-op defaults elsewhere. NEITHER is
 * wired into the runtime or Worker.
 *
 * STATUS: inert scaffolding, not reachable from the shipped Electron app.
 */

import type {
  PaymentCapability,
  PaymentDecision,
  PaymentEvidence,
  PaymentEvidenceProvenance,
  PaymentProvider,
  PaymentProviderStatus,
  PaymentRequest,
} from "./types.js";
import { verifyHmacSha256Hex } from "./callback_verification.js";

/**
 * Substrings that mark a metadata VALUE as sensitive (case-insensitive).
 * Deliberately conservative: matching one denies the request rather than
 * silently stripping it, since payment-adjacent metadata is higher-risk than
 * a generic notification body.
 */
const SENSITIVE_VALUE_MARKERS: readonly string[] = [
  "secret",
  "seed",
  "passphrase",
  "password",
  "private key",
  "privatekey",
  "nsec", // bech32 private key prefix
  "credential",
  "bearer ",
  "api key",
  "apikey",
  "card",
  "cvv",
  "cvc",
  "pan:", // primary account number marker
  "iban",
  "wallet",
  "mnemonic",
  "token",
];

/** Sensitive metadata KEY markers (matched against the key with non-alphanumerics stripped). */
const SENSITIVE_KEY_MARKERS: readonly string[] = [
  "secret",
  "seed",
  "password",
  "passphrase",
  "card",
  "cvv",
  "cvc",
  "pan",
  "iban",
  "wallet",
  "mnemonic",
  "token",
  "credential",
];

/** True if a string value looks like it carries card/wallet/secret content. */
function isSensitivePaymentValue(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return SENSITIVE_VALUE_MARKERS.some((marker) => v.includes(marker));
}

/** True if a metadata key names a sensitive field. */
function isSensitivePaymentKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_MARKERS.some((marker) => k.includes(marker));
}

/** True if any metadata entry looks like a card/wallet/secret value. */
function hasSensitiveMetadata(metadata: Readonly<Record<string, string>> | undefined): boolean {
  if (!metadata) return false;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitivePaymentKey(key) || isSensitivePaymentValue(value)) return true;
  }
  return false;
}

/**
 * Return a NEW metadata object with sensitive (card/wallet/secret-looking)
 * entries removed, or `undefined` if none remain. Pure: never mutates the
 * input. Used by the commerce bridge so a `PaymentRequest` never carries a
 * card/wallet/secret value, even if the caller supplied one by mistake.
 */
export function sanitizePaymentMetadata(
  metadata: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  let kept = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitivePaymentKey(key) || isSensitivePaymentValue(value)) continue;
    out[key] = value;
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

function decision(
  request: PaymentRequest,
  status: PaymentDecision["status"],
  allowed: boolean,
  reason: string,
): PaymentDecision {
  return {
    allowed,
    status,
    rail: request.rail,
    reason,
    productId: request.productId,
    ...(request.buyerPubkey !== undefined ? { buyerPubkey: request.buyerPubkey } : {}),
    ...(request.orderId !== undefined ? { orderId: request.orderId } : {}),
  };
}

export class NoopPaymentProvider implements PaymentProvider {
  constructor() {
    // Does nothing: no rail, wallet, or checkout session is opened.
  }

  getStatus(): PaymentProviderStatus {
    return { available: false, reason: "no payment backend is configured" };
  }

  getCapabilities(): readonly PaymentCapability[] {
    // No backend present -> advertises nothing.
    return [];
  }

  async requestPayment(request: PaymentRequest): Promise<PaymentDecision> {
    // Reads nothing sensitive from the request; charges nothing; contacts no rail.
    return decision(
      request,
      "unavailable",
      false,
      "no payment backend is configured (nothing charged)",
    );
  }

  async observePayment(paymentId: string): Promise<PaymentEvidence> {
    return {
      paymentId,
      productId: "",
      observedAt: Math.floor(Date.now() / 1000),
      status: "error",
      reason: "no payment backend is configured",
    };
  }

  async ingestCallback(): Promise<PaymentEvidence | null> {
    // No backend present -> never recognizes a callback.
    return null;
  }
}

/** Constructor options for `PlaceholderPaymentProvider` (Payment Hardening, Gap #5). */
export interface PlaceholderPaymentProviderOptions {
  /**
   * OPTIONAL HMAC-SHA256 shared secret. When supplied, `ingestCallback()`
   * REQUIRES a valid signature (see this class's own header for the exact
   * scheme) and rejects (`null`) anything unsigned or forged. When omitted
   * (the default), `ingestCallback()` keeps its original unauthenticated
   * dev/test behavior, but tags every evidence it returns
   * `verification: { source: "provider_unverified" }` so it can never be
   * mistaken for real settlement proof downstream. Never a real secret —
   * this class contacts no rail and stores nothing outside this instance's
   * memory.
   */
  readonly callbackSecret?: string;
}

/**
 * A dev/test provider that models the decision flow WITHOUT charging. It
 * rejects a negative amount or metadata that looks like a card/wallet/secret;
 * otherwise it resolves `accepted_placeholder`. It opens no rail, mints no
 * invoice, builds no checkout URL, and issues no `fetch`. An
 * `accepted_placeholder` result means the request is policy-clean, NOT that
 * a payment was received.
 *
 * BTCPay-readiness (Compatibility Facade Reduction + Package Extraction
 * Readiness arc): also models `observePayment`/`ingestCallback`/
 * `cancelPayment`/`refundPayment` against a purely in-memory ledger — proof
 * the widened `PaymentProvider` contract is genuinely implementable end to
 * end, not just typed. Nothing here ever contacts a network or a rail; the
 * "ledger" is a `Map` that exists only for the lifetime of this instance.
 *
 * Payment Hardening (Commerce E2E Completion arc, Agent P — closes
 * `docs/commerce/COMMERCE-GAP-CLASSIFICATION.md` Gap #5):
 * `ingestCallback()` used to accept ANY `{paymentId, event}` payload with
 * zero authentication and flip the ledger accordingly — a raw forged
 * callback could reach `"accepted_placeholder"`. It now:
 *
 *   1. Optionally supports REAL HMAC-SHA256 verification: construct with
 *      `{ callbackSecret }` and `ingestCallback()` will REQUIRE a valid
 *      lowercase-hex `signature` field (HMAC-SHA256 over
 *      `${paymentId}:${event}`, keyed by `callbackSecret`,
 *      `./callback_verification.ts`) — an unsigned or forged callback is
 *      rejected (`null`), the ledger is left untouched, and accepted
 *      evidence is tagged `verification: { source: "provider_verified" }`.
 *   2. When constructed with NO `callbackSecret` (the default — matches
 *      this class's original, pre-hardening behavior exactly, so existing
 *      callers/tests are unaffected), `ingestCallback()` still accepts an
 *      unsigned payload, but every piece of evidence it returns is now
 *      explicitly tagged `verification: { source: "provider_unverified",
 *      authoritative: false }`. `payment/state_machine.ts` allowlists ONLY
 *      `"provider_verified"`/`"test_simulator"` evidence for a real
 *      settlement transition — so even in this default, unauthenticated
 *      mode, calling `ingestCallback()` can mutate THIS instance's own
 *      internal ledger (as it always could, and as
 *      `test/architecture_payment_provider_btcpay_readiness.test.ts` still
 *      exercises directly), but it is now structurally UNABLE to cause a
 *      real PAID-equivalent transition anywhere downstream — see
 *      `test/commerce_payment_callback_hardening.test.ts`.
 */
export class PlaceholderPaymentProvider implements PaymentProvider {
  #ledger = new Map<string, { productId: string; status: PaymentDecision["status"]; expiresAt?: number }>();
  #nextId = 0;
  #idempotency = new Map<string, string>(); // idempotencyKey -> paymentId
  #callbackSecret: string | undefined;

  constructor(options: PlaceholderPaymentProviderOptions = {}) {
    // Does nothing: no rail, wallet, or checkout session is contacted.
    this.#callbackSecret = options.callbackSecret;
  }

  getStatus(): PaymentProviderStatus {
    return { available: true, reason: "placeholder provider is ready (nothing is charged)" };
  }

  getCapabilities(): readonly PaymentCapability[] {
    // Advertises the placeholder capabilities it WOULD route to — none is contacted.
    return [
      "lightning_placeholder",
      "invoice_placeholder",
      "checkout_placeholder",
      "manual_grant_placeholder",
      "external_payment_placeholder",
    ];
  }

  async requestPayment(request: PaymentRequest): Promise<PaymentDecision> {
    if (!Number.isFinite(request.amountCents) || request.amountCents < 0) {
      return decision(request, "rejected", false, "amount must be a non-negative number");
    }
    if (hasSensitiveMetadata(request.metadata)) {
      return decision(
        request,
        "rejected",
        false,
        "request metadata contains a sensitive key or value",
      );
    }

    // Idempotency: a repeated key returns the SAME paymentId's current decision,
    // never mints a second placeholder payment.
    if (request.idempotencyKey !== undefined) {
      const existingId = this.#idempotency.get(request.idempotencyKey);
      if (existingId !== undefined) {
        const existing = this.#ledger.get(existingId);
        return {
          ...decision(request, existing?.status ?? "accepted_placeholder", true, "idempotent replay — same payment as the original request"),
          paymentId: existingId,
          idempotencyKey: request.idempotencyKey,
          ...(existing?.expiresAt !== undefined ? { expiresAt: existing.expiresAt } : {}),
        };
      }
    }

    const now = Math.floor(Date.now() / 1000);
    if (request.expiresAt !== undefined && request.expiresAt <= now) {
      return decision(request, "expired", false, "request's expiresAt is already in the past");
    }

    const paymentId = `placeholder-payment-${(this.#nextId += 1)}`;
    this.#ledger.set(paymentId, {
      productId: request.productId,
      status: "accepted_placeholder",
      ...(request.expiresAt !== undefined ? { expiresAt: request.expiresAt } : {}),
    });
    if (request.idempotencyKey !== undefined) {
      this.#idempotency.set(request.idempotencyKey, paymentId);
    }

    return {
      ...decision(
        request,
        "accepted_placeholder",
        true,
        "request is policy-clean (placeholder acceptance — nothing was charged)",
      ),
      paymentId,
      ...(request.idempotencyKey !== undefined ? { idempotencyKey: request.idempotencyKey } : {}),
      ...(request.expiresAt !== undefined ? { expiresAt: request.expiresAt } : {}),
    };
  }

  async observePayment(paymentId: string): Promise<PaymentEvidence> {
    const now = Math.floor(Date.now() / 1000);
    const entry = this.#ledger.get(paymentId);
    if (entry === undefined) {
      return { paymentId, productId: "", observedAt: now, status: "error", reason: "unknown paymentId" };
    }
    if (entry.expiresAt !== undefined && entry.expiresAt <= now && entry.status === "accepted_placeholder") {
      entry.status = "expired";
    }
    const evidenceStatus: PaymentEvidence["status"] =
      entry.status === "accepted_placeholder" ? "settled" : entry.status === "rejected" || entry.status === "unavailable" ? "error" : entry.status === "expired" ? "expired" : entry.status === "refunded" ? "refunded" : "error";
    return {
      paymentId,
      productId: entry.productId,
      observedAt: now,
      status: evidenceStatus,
      reason: `placeholder ledger state: ${entry.status}`,
      // A poll of this in-memory ledger is never itself an authenticated
      // read of a real rail (there is no real rail behind it) — always tag
      // "provider_unverified", regardless of how the ledger got here. Only
      // the specific `ingestCallback()` invocation that verified a
      // signature is allowed to hand out `"provider_verified"` evidence —
      // see this class's own header (Payment Hardening, Gap #5).
      verification: { source: "provider_unverified", authoritative: false, provider: "placeholder" },
    };
  }

  /**
   * Recognizes exactly one payload shape:
   * `{ paymentId: string; event: "settled"|"expired"|"refunded"; signature?: string }`.
   * Anything else (wrong shape, unknown paymentId, unrecognized event)
   * returns `null` rather than throwing — a malformed/foreign callback is
   * data, not an error.
   *
   * Payment Hardening (Gap #5): when this instance was constructed with a
   * `callbackSecret`, `signature` MUST be a valid lowercase-hex
   * HMAC-SHA256 over `${paymentId}:${event}` keyed by that secret — an
   * unsigned or forged callback is rejected (`null`), and the ledger is
   * left completely untouched. When no `callbackSecret` was configured
   * (the default), behavior is unchanged from before this hardening pass
   * — but the returned evidence is tagged `"provider_unverified"`, never
   * `"provider_verified"`.
   */
  async ingestCallback(payload: unknown): Promise<PaymentEvidence | null> {
    if (typeof payload !== "object" || payload === null) return null;
    const candidate = payload as { paymentId?: unknown; event?: unknown; signature?: unknown };
    if (typeof candidate.paymentId !== "string" || typeof candidate.event !== "string") return null;
    if (!["settled", "expired", "refunded"].includes(candidate.event)) return null;

    let provenance: PaymentEvidenceProvenance;
    if (this.#callbackSecret !== undefined) {
      // Hardened mode: a signature is REQUIRED and MUST verify. Reject
      // BEFORE touching the ledger — a forged/unsigned callback must never
      // be able to mutate state, even transiently.
      if (typeof candidate.signature !== "string") return null;
      const message = `${candidate.paymentId}:${candidate.event}`;
      const valid = await verifyHmacSha256Hex(this.#callbackSecret, message, candidate.signature);
      if (!valid) return null;
      provenance = {
        source: "provider_verified",
        authoritative: true,
        provider: "placeholder",
        verifiedAt: Math.floor(Date.now() / 1000),
      };
    } else {
      provenance = { source: "provider_unverified", authoritative: false, provider: "placeholder" };
    }

    const entry = this.#ledger.get(candidate.paymentId);
    if (entry === undefined) return null;

    if (candidate.event === "settled") entry.status = "accepted_placeholder";
    if (candidate.event === "expired") entry.status = "expired";
    if (candidate.event === "refunded") entry.status = "refunded";

    const evidence = await this.observePayment(candidate.paymentId);
    return { ...evidence, verification: provenance };
  }

  async cancelPayment(paymentId: string): Promise<PaymentDecision> {
    const entry = this.#ledger.get(paymentId);
    if (entry === undefined) {
      return {
        allowed: false,
        status: "error",
        rail: "manual_placeholder",
        reason: "unknown paymentId",
        productId: "",
        paymentId,
      };
    }
    entry.status = "rejected";
    return {
      allowed: true,
      status: "rejected",
      rail: "manual_placeholder",
      reason: "cancelled before settlement (placeholder — nothing was ever charged)",
      productId: entry.productId,
      paymentId,
    };
  }

  async refundPayment(paymentId: string): Promise<PaymentEvidence> {
    const now = Math.floor(Date.now() / 1000);
    const entry = this.#ledger.get(paymentId);
    if (entry === undefined) {
      return { paymentId, productId: "", observedAt: now, status: "error", reason: "unknown paymentId" };
    }
    entry.status = "refunded";
    return {
      paymentId,
      productId: entry.productId,
      observedAt: now,
      status: "refunded",
      reason: "placeholder refund (nothing was ever actually charged, so nothing is actually reversed)",
      verification: { source: "provider_unverified", authoritative: false, provider: "placeholder" },
    };
  }
}
