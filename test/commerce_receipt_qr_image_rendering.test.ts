import { describe, it, expect } from "vitest";
import { renderFedosTrustQrTextToPngDataUrl } from "../src/os/trust/qr/fedos_trust_qr_image.js";
import { encodeCommerceReceiptProofToQrText } from "../src/os/commerce/receipt/commerce_trust_receipt_adapter.js";
import { issueSignedTradeReceiptProof } from "../src/os/commerce/receipt/commerce_trust_receipt_adapter.js";
import { FedosTrustSigningKeypair } from "../src/os/trust/envelope/fedos_trust_signing_keypair.js";
import type { TradeReceiptProofPayload } from "../src/os/commerce/receipt/receipt_types.js";

/**
 * FedOS Commerce "Real Two-Party Commerce + UX P0/P1 Closure" mega-arc
 * (Agent D) — friction-ledger row #11 / arc §34: proves a REAL, decodable
 * PNG image is produced from the already-signed receipt QR text — not
 * merely "the call didn't throw". This is the exact function
 * `handleCommerceReceiptIssue()` (`fedos_electron_beta_main.cts`) calls
 * to populate `qrImageDataUrl`.
 */

function tradePayload(): TradeReceiptProofPayload {
  return {
    kind: "trade_completion",
    orderId: "order-1",
    productRef: "product-1",
    buyerRef: "b".repeat(64),
    sellerRef: "s".repeat(64),
    completedAt: 1_000,
    formatVersion: 1,
  };
}

describe("renderFedosTrustQrTextToPngDataUrl — real image bytes, not just 'didn't throw'", () => {
  it("produces a data: URL with the real PNG magic-byte signature, decodable via base64", async () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const envelope = issueSignedTradeReceiptProof(tradePayload(), { keypair, issuer: "test-issuer" }, { issuedAt: 1_000 });
    const qrText = encodeCommerceReceiptProofToQrText(envelope);

    const dataUrl = await renderFedosTrustQrTextToPngDataUrl(qrText);

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    const base64 = dataUrl.slice("data:image/png;base64,".length);
    expect(base64.length).toBeGreaterThan(0);

    const pngBytes = Buffer.from(base64, "base64");
    // Real PNG magic bytes: 0x89 'P' 'N' 'G' \r \n 0x1A \n — proves this is
    // an actual decoded PNG image, not an arbitrary/placeholder string.
    const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < PNG_SIGNATURE.length; i++) {
      expect(pngBytes[i]).toBe(PNG_SIGNATURE[i]);
    }
    // A real rendered QR PNG at this size is meaningfully larger than a
    // trivial/empty placeholder image.
    expect(pngBytes.length).toBeGreaterThan(200);
  });

  it("two different signed receipts render two DIFFERENT images (the image genuinely encodes the receipt's own text, never a fixed placeholder)", async () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const envelopeA = issueSignedTradeReceiptProof(tradePayload(), { keypair, issuer: "test-issuer" }, { issuedAt: 1_000 });
    const envelopeB = issueSignedTradeReceiptProof({ ...tradePayload(), orderId: "order-2" }, { keypair, issuer: "test-issuer" }, { issuedAt: 2_000 });

    const dataUrlA = await renderFedosTrustQrTextToPngDataUrl(encodeCommerceReceiptProofToQrText(envelopeA));
    const dataUrlB = await renderFedosTrustQrTextToPngDataUrl(encodeCommerceReceiptProofToQrText(envelopeB));

    expect(dataUrlA).not.toBe(dataUrlB);
  });
});
