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
  PaymentProvider,
  PaymentProviderStatus,
  PaymentRequest,
} from "./types.js";

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
}

/**
 * A dev/test provider that models the decision flow WITHOUT charging. It
 * rejects a negative amount or metadata that looks like a card/wallet/secret;
 * otherwise it resolves `accepted_placeholder`. It opens no rail, mints no
 * invoice, builds no checkout URL, and issues no `fetch`. An
 * `accepted_placeholder` result means the request is policy-clean, NOT that
 * a payment was received.
 */
export class PlaceholderPaymentProvider implements PaymentProvider {
  constructor() {
    // Does nothing: no rail, wallet, or checkout session is contacted.
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
    return decision(
      request,
      "accepted_placeholder",
      true,
      "request is policy-clean (placeholder acceptance — nothing was charged)",
    );
  }
}
