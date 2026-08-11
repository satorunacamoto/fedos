import { describe, expect, it } from "vitest";

import {
  FedosTrustSigningKeypair,
  createSingleIssuerFedosTrustPolicy,
  fixedFedosTrustClock,
  FEDOS_TRUST_QR_TEXT_PREFIX,
} from "../src/os/trust/index.js";
import {
  decodeCommerceReceiptProofFromQrText,
  encodeCommerceReceiptProofToQrText,
  issueSignedDeliveryReceiptProof,
  issueSignedTradeReceiptProof,
  verifySignedDeliveryReceiptProof,
  verifySignedTradeReceiptProof,
  type DeliveryReceiptProofPayload,
  type SignedCommerceReceiptProofEnvelope,
  type TradeReceiptProofPayload,
} from "../src/os/commerce/receipt/index.js";

/**
 * FedOS Commerce End-to-End Completion arc, Wave B (Agent T) — real QR
 * round-trip coverage (original arc brief §22): build a receipt, sign it,
 * encode to QR text, decode, verify — assert the decoded+verified content
 * matches the original. Reuses `src/os/trust/qr/`'s existing real
 * encode/decode functions via `commerce_trust_receipt_adapter.ts`'s thin
 * pass-throughs — nothing here reimplements QR encoding.
 */

const NOW = 1_800_000_000;

const TRADE_PAYLOAD: TradeReceiptProofPayload = {
  kind: "trade_completion",
  orderId: "order-alice-bob-002",
  productRef: "product-digital-art-print",
  buyerRef: "alice-persona-epoch-key-hex",
  sellerRef: "bob-persona-epoch-key-hex",
  paymentEvidenceRef: "local-sim-payment-2",
  completedAt: NOW,
  formatVersion: 1,
};

const DELIVERY_PAYLOAD: DeliveryReceiptProofPayload = {
  kind: "delivery_confirmation",
  orderId: "order-alice-bob-002",
  productRef: "product-digital-art-print",
  buyerRef: "alice-persona-epoch-key-hex",
  sellerRef: "bob-persona-epoch-key-hex",
  paymentEvidenceRef: "local-sim-payment-2",
  deliveryConfirmationRef: "delivery-evidence-ref-002",
  completedAt: NOW,
  formatVersion: 1,
};

describe("commerce receipt QR round trip", () => {
  it("trade receipt: sign -> encode to QR text -> decode -> verify -> matches original", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const envelope = issueSignedTradeReceiptProof(
      TRADE_PAYLOAD,
      { keypair: issuerKeypair, issuer: "merchant-bob" },
      { issuedAt: NOW },
    );

    const qrText = encodeCommerceReceiptProofToQrText(envelope);
    expect(qrText.startsWith(FEDOS_TRUST_QR_TEXT_PREFIX)).toBe(true);

    const decoded = decodeCommerceReceiptProofFromQrText(qrText);
    expect("error" in decoded).toBe(false);
    const decodedEnvelope = decoded as SignedCommerceReceiptProofEnvelope;
    expect(decodedEnvelope).toEqual(envelope);

    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: issuerKeypair.publicKeyHex, publicKeyHex: issuerKeypair.publicKeyHex }],
    });
    const result = verifySignedTradeReceiptProof(decodedEnvelope, trustPolicy, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("VALID");
    if (result.status === "VALID") {
      expect(result.payload).toEqual(TRADE_PAYLOAD);
    }
  });

  it("delivery receipt: sign -> encode to QR text -> decode -> verify -> matches original", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const envelope = issueSignedDeliveryReceiptProof(
      DELIVERY_PAYLOAD,
      { keypair: issuerKeypair, issuer: "merchant-bob" },
      { issuedAt: NOW },
    );

    const qrText = encodeCommerceReceiptProofToQrText(envelope);
    const decoded = decodeCommerceReceiptProofFromQrText(qrText);
    expect("error" in decoded).toBe(false);
    const decodedEnvelope = decoded as SignedCommerceReceiptProofEnvelope;

    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: issuerKeypair.publicKeyHex, publicKeyHex: issuerKeypair.publicKeyHex }],
    });
    const result = verifySignedDeliveryReceiptProof(decodedEnvelope, trustPolicy, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("VALID");
    if (result.status === "VALID") {
      expect(result.payload).toEqual(DELIVERY_PAYLOAD);
    }
  });

  it("decoding never re-derives/checks the signature by itself (decode of a hand-tampered-but-structurally-valid envelope still 'succeeds' at decode; VALID only comes from a separate verify call)", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const envelope = issueSignedTradeReceiptProof(
      TRADE_PAYLOAD,
      { keypair: issuerKeypair, issuer: "merchant-bob" },
      { issuedAt: NOW },
    );
    // Tamper the payload's digest field directly (still structurally valid
    // JSON/shape) without re-signing -- decode must not itself reject this;
    // only a subsequent verify() call may.
    const tamperedEnvelope: SignedCommerceReceiptProofEnvelope = {
      ...envelope,
      payload: { ...envelope.payload, artifactDigestHex: "00".repeat(32) },
    };
    const qrText = encodeCommerceReceiptProofToQrText(tamperedEnvelope);
    const decoded = decodeCommerceReceiptProofFromQrText(qrText);
    expect("error" in decoded).toBe(false); // decode is structural-only, per this codec's documented contract

    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: issuerKeypair.publicKeyHex, publicKeyHex: issuerKeypair.publicKeyHex }],
    });
    const result = verifySignedTradeReceiptProof(decoded as SignedCommerceReceiptProofEnvelope, trustPolicy, {
      clock: fixedFedosTrustClock(NOW),
    });
    expect(result.status).not.toBe("VALID"); // the signature no longer matches the tampered payload
  });
});
