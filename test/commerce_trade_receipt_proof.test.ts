import { describe, expect, it } from "vitest";

import {
  FedosTrustSigningKeypair,
  createSingleIssuerFedosTrustPolicy,
  fixedFedosTrustClock,
} from "../src/os/trust/index.js";
import {
  canonicalizeDeliveryReceiptProofPayloadV1,
  canonicalizeTradeReceiptProofPayloadV1,
  isWellFormedDeliveryReceiptProofPayload,
  isWellFormedTradeReceiptProofPayload,
  issueSignedDeliveryReceiptProof,
  issueSignedTradeReceiptProof,
  verifySignedDeliveryReceiptProof,
  verifySignedTradeReceiptProof,
  type DeliveryReceiptProofPayload,
  type TradeReceiptProofPayload,
} from "../src/os/commerce/receipt/index.js";

/**
 * FedOS Commerce End-to-End Completion arc, Wave B (Agent T) — real,
 * self-signed round-trip coverage for `TradeReceiptProof`/
 * `DeliveryReceiptProof` (original arc brief §21). Every signature below is
 * genuine Schnorr/secp256k1 via `@noble/curves` (through
 * `src/os/trust/envelope/fedos_trust_envelope_sign.ts` /
 * `..._verify.ts`) — nothing in this file, or in the code under test, is
 * mocked or stubbed.
 */

const NOW = 1_800_000_000;

function tradePayload(overrides: Partial<TradeReceiptProofPayload> = {}): TradeReceiptProofPayload {
  return {
    kind: "trade_completion",
    orderId: "order-alice-bob-001",
    productRef: "product-digital-art-print",
    buyerRef: "alice-persona-epoch-key-hex",
    sellerRef: "bob-persona-epoch-key-hex",
    paymentEvidenceRef: "local-sim-payment-1",
    completedAt: NOW,
    formatVersion: 1,
    ...overrides,
  };
}

function deliveryPayload(overrides: Partial<DeliveryReceiptProofPayload> = {}): DeliveryReceiptProofPayload {
  return {
    kind: "delivery_confirmation",
    orderId: "order-alice-bob-001",
    productRef: "product-digital-art-print",
    buyerRef: "alice-persona-epoch-key-hex",
    sellerRef: "bob-persona-epoch-key-hex",
    paymentEvidenceRef: "local-sim-payment-1",
    deliveryConfirmationRef: "delivery-evidence-ref-001",
    completedAt: NOW,
    formatVersion: 1,
    ...overrides,
  };
}

describe("commerce receipt proof: payload well-formedness", () => {
  it("accepts a well-formed TradeReceiptProofPayload", () => {
    expect(isWellFormedTradeReceiptProofPayload(tradePayload())).toBe(true);
  });

  it("accepts a TradeReceiptProofPayload with no paymentEvidenceRef (optional field genuinely optional)", () => {
    const { paymentEvidenceRef: _drop, ...rest } = tradePayload();
    expect(isWellFormedTradeReceiptProofPayload(rest)).toBe(true);
  });

  it("rejects a TradeReceiptProofPayload with an unknown extra key", () => {
    expect(isWellFormedTradeReceiptProofPayload({ ...tradePayload(), extra: "nope" })).toBe(false);
  });

  it("rejects a TradeReceiptProofPayload missing a required field", () => {
    const { orderId: _drop, ...rest } = tradePayload();
    expect(isWellFormedTradeReceiptProofPayload(rest)).toBe(false);
  });

  it("rejects a TradeReceiptProofPayload with the wrong kind literal", () => {
    expect(isWellFormedTradeReceiptProofPayload({ ...tradePayload(), kind: "delivery_confirmation" })).toBe(false);
  });

  it("accepts a well-formed DeliveryReceiptProofPayload", () => {
    expect(isWellFormedDeliveryReceiptProofPayload(deliveryPayload())).toBe(true);
  });

  it("rejects a DeliveryReceiptProofPayload missing deliveryConfirmationRef", () => {
    const { deliveryConfirmationRef: _drop, ...rest } = deliveryPayload();
    expect(isWellFormedDeliveryReceiptProofPayload(rest)).toBe(false);
  });

  it("a TradeReceiptProofPayload is never accepted as a DeliveryReceiptProofPayload and vice versa", () => {
    expect(isWellFormedDeliveryReceiptProofPayload(tradePayload())).toBe(false);
    expect(isWellFormedTradeReceiptProofPayload(deliveryPayload())).toBe(false);
  });
});

describe("commerce receipt proof: canonicalization determinism", () => {
  it("canonicalizeTradeReceiptProofPayloadV1 is deterministic for the same payload", () => {
    const payload = tradePayload();
    expect(canonicalizeTradeReceiptProofPayloadV1(payload)).toBe(canonicalizeTradeReceiptProofPayloadV1({ ...payload }));
  });

  it("canonicalizeTradeReceiptProofPayloadV1 differs when any field differs", () => {
    const base = canonicalizeTradeReceiptProofPayloadV1(tradePayload());
    expect(canonicalizeTradeReceiptProofPayloadV1(tradePayload({ orderId: "order-different" }))).not.toBe(base);
    expect(canonicalizeTradeReceiptProofPayloadV1(tradePayload({ completedAt: NOW + 1 }))).not.toBe(base);
  });

  it("canonicalizeDeliveryReceiptProofPayloadV1 is deterministic and field-sensitive", () => {
    const payload = deliveryPayload();
    expect(canonicalizeDeliveryReceiptProofPayloadV1(payload)).toBe(canonicalizeDeliveryReceiptProofPayloadV1({ ...payload }));
    expect(canonicalizeDeliveryReceiptProofPayloadV1(deliveryPayload({ deliveryConfirmationRef: "other" }))).not.toBe(
      canonicalizeDeliveryReceiptProofPayloadV1(payload),
    );
  });
});

describe("commerce receipt proof: real sign + verify round trip", () => {
  it("issues and verifies a TradeReceiptProof end to end", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const payload = tradePayload();

    const envelope = issueSignedTradeReceiptProof(
      payload,
      { keypair: issuerKeypair, issuer: "merchant-bob" },
      { issuedAt: NOW, subject: payload.buyerRef },
    );

    expect(envelope.type).toBe("fedos.contract-artifact.v1");
    expect(envelope.issuer).toBe("merchant-bob");
    expect(envelope.subject).toBe(payload.buyerRef);
    expect(envelope.keyId).toBe(issuerKeypair.publicKeyHex);

    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: issuerKeypair.publicKeyHex, publicKeyHex: issuerKeypair.publicKeyHex }],
    });

    const result = verifySignedTradeReceiptProof(envelope, trustPolicy, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("VALID");
    if (result.status === "VALID") {
      expect(result.resolvedPublicKeyHex).toBe(issuerKeypair.publicKeyHex);
      expect(result.payload).toEqual(payload);
    }
  });

  it("issues and verifies a DeliveryReceiptProof end to end", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const payload = deliveryPayload();

    const envelope = issueSignedDeliveryReceiptProof(
      payload,
      { keypair: issuerKeypair, issuer: "merchant-bob" },
      { issuedAt: NOW },
    );

    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: issuerKeypair.publicKeyHex, publicKeyHex: issuerKeypair.publicKeyHex }],
    });

    const result = verifySignedDeliveryReceiptProof(envelope, trustPolicy, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("VALID");
    if (result.status === "VALID") {
      expect(result.payload.deliveryConfirmationRef).toBe(payload.deliveryConfirmationRef);
      expect(result.payload).toEqual(payload);
    }
  });

  it("issuing throws RangeError on a malformed payload (fail-fast, matching every Trust issue* function)", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const malformed = { ...tradePayload(), orderId: "" } as TradeReceiptProofPayload;
    expect(() =>
      issueSignedTradeReceiptProof(malformed, { keypair: issuerKeypair, issuer: "merchant-bob" }, { issuedAt: NOW }),
    ).toThrow(RangeError);
  });

  it("verification against a policy that trusts nobody fails with unknown-issuer-key, never VALID", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const payload = tradePayload();
    const envelope = issueSignedTradeReceiptProof(
      payload,
      { keypair: issuerKeypair, issuer: "merchant-bob" },
      { issuedAt: NOW },
    );

    const emptyPolicy = createSingleIssuerFedosTrustPolicy({ issuerId: "someone-else", keys: [] });
    const result = verifySignedTradeReceiptProof(envelope, emptyPolicy, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("unknown-issuer-key");
  });
});
