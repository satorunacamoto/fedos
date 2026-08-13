import { describe, expect, it } from "vitest";

import {
  FedosTrustSigningKeypair,
  fixedFedosTrustClock,
  FEDOS_TRUST_QR_TEXT_PREFIX,
  issueFedosTrustContractArtifactProof,
} from "../src/os/trust/index.js";
import {
  decodeCommerceShareProofFromQrText,
  encodeCommerceShareProofToQrText,
  issueSignedProductShareProof,
  issueSignedStoreShareProof,
  verifySelfAssertedProductShareProof,
  verifySelfAssertedStoreShareProof,
  buildSelfAssertedShareTrustPolicy,
  type SignedCommerceShareProofEnvelope,
  type ProductShareProofPayload,
  type StoreShareProofPayload,
} from "../src/os/commerce/share/index.js";

/**
 * FedOS "Buyer Discovery + Digital Content Delivery" mega-arc (Agent D) —
 * tamper/forgery + self-asserted-policy boundary tests for the Product/Store
 * Share Proof seam (arc mandate item 3 + item 6: "forged seller event, wrong
 * signature, tampered product, impersonated display name... must all be
 * rejected/handled correctly"). Mirrors
 * `test/commerce_receipt_tamper_forgery.test.ts`'s own case structure and
 * classification discipline (PASS / documented limitation, never a bare
 * narrative claim).
 */

const NOW = 1_800_000_000;
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function productPayload(overrides: Partial<ProductShareProofPayload> = {}): ProductShareProofPayload {
  return {
    kind: "product_share",
    productId: "product-aurora-study-real",
    title: "Digital Art Print — Aurora Study",
    priceCents: 1800,
    currency: "USD",
    sellerPubkey: "b".repeat(64),
    issuedAt: NOW,
    formatVersion: 1,
    ...overrides,
  };
}

function storePayload(overrides: Partial<StoreShareProofPayload> = {}): StoreShareProofPayload {
  return {
    kind: "store_share",
    sellerPubkey: "b".repeat(64),
    storeLabel: "Bob's Digital Shop",
    issuedAt: NOW,
    formatVersion: 1,
    ...overrides,
  };
}

function flipBase64UrlCharAt(text: string, index: number): string {
  const original = text[index];
  const alternatives = [...BASE64URL_ALPHABET].filter((char) => char !== original);
  const replacement = alternatives[index % alternatives.length];
  return text.slice(0, index) + replacement + text.slice(index + 1);
}

describe("issue -> QR -> decode -> verify: honest roundtrip (PASS)", () => {
  it("1. a genuine product share proof verifies VALID, resolving to the real signer's own public key", () => {
    const sellerKeypair = FedosTrustSigningKeypair.generate();
    const payload = productPayload({ sellerPubkey: sellerKeypair.publicKeyHex });
    const envelope = issueSignedProductShareProof(payload, { keypair: sellerKeypair, issuer: "self" }, { issuedAt: NOW });
    const qrText = encodeCommerceShareProofToQrText(envelope);
    expect(qrText.startsWith(FEDOS_TRUST_QR_TEXT_PREFIX)).toBe(true);

    const decoded = decodeCommerceShareProofFromQrText(qrText);
    expect("error" in decoded).toBe(false);
    const result = verifySelfAssertedProductShareProof(decoded as SignedCommerceShareProofEnvelope, {
      clock: fixedFedosTrustClock(NOW),
    });
    expect(result.status).toBe("VALID");
    if (result.status === "VALID") {
      expect(result.resolvedPublicKeyHex).toBe(sellerKeypair.publicKeyHex);
      expect(result.payload.productId).toBe(payload.productId);
      expect(result.payload.title).toBe(payload.title);
      expect(result.payload.priceCents).toBe(payload.priceCents);
    }
  });

  it("2. a genuine store share proof verifies VALID", () => {
    const sellerKeypair = FedosTrustSigningKeypair.generate();
    const payload = storePayload({ sellerPubkey: sellerKeypair.publicKeyHex });
    const envelope = issueSignedStoreShareProof(payload, { keypair: sellerKeypair, issuer: "self" }, { issuedAt: NOW });
    const result = verifySelfAssertedStoreShareProof(envelope, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("VALID");
    if (result.status === "VALID") {
      expect(result.payload.storeLabel).toBe(payload.storeLabel);
    }
  });
});

describe("Case A: tampered QR text never verifies (PASS)", () => {
  it("3. flipping any of several bytes in the QR text never yields a VALID verification", () => {
    const sellerKeypair = FedosTrustSigningKeypair.generate();
    const payload = productPayload({ sellerPubkey: sellerKeypair.publicKeyHex });
    const envelope = issueSignedProductShareProof(payload, { keypair: sellerKeypair, issuer: "self" }, { issuedAt: NOW });
    const qrText = encodeCommerceShareProofToQrText(envelope);

    const payloadStart = FEDOS_TRUST_QR_TEXT_PREFIX.length;
    const offsetsToTry = [payloadStart, payloadStart + 10, Math.floor(qrText.length / 2), qrText.length - 1];

    let atLeastOneCaught = false;
    for (const offset of offsetsToTry) {
      if (offset < payloadStart || offset >= qrText.length) continue;
      const tamperedText = flipBase64UrlCharAt(qrText, offset);
      const decoded = decodeCommerceShareProofFromQrText(tamperedText);
      if ("error" in decoded) {
        atLeastOneCaught = true;
        continue;
      }
      const result = verifySelfAssertedProductShareProof(decoded, { clock: fixedFedosTrustClock(NOW) });
      expect(result.status).not.toBe("VALID");
      if (result.status === "signature-invalid" || result.status === "malformed-envelope" || result.status === "INVALID_PAYLOAD_SHAPE") {
        atLeastOneCaught = true;
      }
    }
    expect(atLeastOneCaught).toBe(true);
  });
});

describe("Case D: direct metadata tamper without re-signing (PASS)", () => {
  it("4. editing metadata.priceCents directly invalidates the signature", () => {
    const sellerKeypair = FedosTrustSigningKeypair.generate();
    const payload = productPayload({ sellerPubkey: sellerKeypair.publicKeyHex });
    const envelope = issueSignedProductShareProof(payload, { keypair: sellerKeypair, issuer: "self" }, { issuedAt: NOW });

    const tampered: SignedCommerceShareProofEnvelope = {
      ...envelope,
      payload: { ...envelope.payload, metadata: { ...envelope.payload.metadata, priceCents: 1 } },
    };
    const result = verifySelfAssertedProductShareProof(tampered, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("signature-invalid");
  });

  it("5. impersonating a display/title field directly invalidates the signature", () => {
    const sellerKeypair = FedosTrustSigningKeypair.generate();
    const payload = productPayload({ sellerPubkey: sellerKeypair.publicKeyHex });
    const envelope = issueSignedProductShareProof(payload, { keypair: sellerKeypair, issuer: "self" }, { issuedAt: NOW });

    const tampered: SignedCommerceShareProofEnvelope = {
      ...envelope,
      payload: { ...envelope.payload, metadata: { ...envelope.payload.metadata, title: "Totally Different Product" } },
    };
    const result = verifySelfAssertedProductShareProof(tampered, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("signature-invalid");
  });
});

describe("Case E: keyId forged to a value other than the actual signer's public key (PASS)", () => {
  it("6. overriding keyId away from the true signer's publicKeyHex never verifies VALID under self-assertion", () => {
    const sellerKeypair = FedosTrustSigningKeypair.generate();
    const bogusKeyId = "d".repeat(64);
    const payload = productPayload({ sellerPubkey: sellerKeypair.publicKeyHex });
    const envelope = issueSignedProductShareProof(
      payload,
      { keypair: sellerKeypair, issuer: "self", keyId: bogusKeyId },
      { issuedAt: NOW },
    );
    expect(envelope.keyId).toBe(bogusKeyId);
    const result = verifySelfAssertedProductShareProof(envelope, { clock: fixedFedosTrustClock(NOW) });
    // The self-asserted policy resolves `keyId` (the bogus value) AS the
    // trusted public key -- since the signature was actually produced by
    // `sellerKeypair`, not a key matching `bogusKeyId`, this fails Schnorr
    // verification against the wrong key.
    expect(result.status).toBe("signature-invalid");
  });
});

describe("Case F (documented limitation, KNOWN and INTENTIONAL — read this file's own header before treating as a bug): self-assertion alone never proves seller identity", () => {
  it("7. an attacker's own self-consistent forgery, dishonestly CLAIMING a real seller's pubkey/productId inside the payload but signed with the attacker's OWN unrelated key, still verifies VALID under self-assertion alone", () => {
    const realSellerKeypair = FedosTrustSigningKeypair.generate();
    const attackerKeypair = FedosTrustSigningKeypair.generate();
    expect(attackerKeypair.publicKeyHex).not.toBe(realSellerKeypair.publicKeyHex);

    // The attacker signs a payload CLAIMING the real seller's pubkey as
    // `sellerPubkey`, using their OWN, totally unrelated signing key.
    const forgedPayload = productPayload({
      productId: "product-real-sellers-listing",
      sellerPubkey: realSellerKeypair.publicKeyHex,
    });
    const forgedEnvelope = issueSignedProductShareProof(
      forgedPayload,
      { keypair: attackerKeypair, issuer: "self" },
      { issuedAt: NOW },
    );

    const result = verifySelfAssertedProductShareProof(forgedEnvelope, { clock: fixedFedosTrustClock(NOW) });
    // THIS IS EXPECTED AND DOCUMENTED, not a security bug in this file:
    // the self-asserted policy only proves "signed by whoever holds keyId's
    // secret key" -- here that is genuinely the attacker's own key, which
    // IS internally self-consistent. It does NOT and cannot prove the
    // claimed `sellerPubkey` is who really published `productId`; that
    // requires the caller's own SEPARATE cross-check against a real,
    // independently-verified Nostr product-publication record (see this
    // adapter's own header, and
    // `packages/fedos-desktop-electron-spike/src/fedos_electron_beta_main.cts`'s
    // `handleCommerceShareOpen()` for where that check actually lives).
    expect(result.status).toBe("VALID");
    if (result.status === "VALID") {
      // Proves the resolved signer is the ATTACKER, not the claimed seller
      // -- exactly the fact a caller's cross-check step must compare
      // `payload.sellerPubkey` against the REAL, network-verified signer,
      // never against `resolvedPublicKeyHex` from this call alone (they
      // are deliberately allowed to diverge here).
      expect(result.resolvedPublicKeyHex).toBe(attackerKeypair.publicKeyHex);
      expect(result.resolvedPublicKeyHex).not.toBe(realSellerKeypair.publicKeyHex);
      expect(result.payload.sellerPubkey).toBe(realSellerKeypair.publicKeyHex);
    }
  });
});

describe("Case G: digest/metadata self-inconsistency at issuance (PASS)", () => {
  it("8. an envelope whose signed artifactDigestHex does not match its own signed metadata is rejected with DIGEST_MISMATCH, even though the signature itself is genuinely valid", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const payload = productPayload({ sellerPubkey: issuerKeypair.publicKeyHex });
    // Bypasses `issueSignedProductShareProof` (which always computes a
    // CONSISTENT digest) to construct a genuinely, honestly-signed envelope
    // whose declared digest deliberately does not match its own metadata --
    // modeling an issuer bug, never a third-party tamper.
    const envelope = issueFedosTrustContractArtifactProof(
      { artifactDigestHex: "0".repeat(64), metadata: { ...payload } },
      { issuer: "self", issuedAt: NOW, keypair: issuerKeypair },
    ) as SignedCommerceShareProofEnvelope;

    const result = verifySelfAssertedProductShareProof(envelope, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("DIGEST_MISMATCH");
  });
});

describe("Case H: expired share proof is rejected (PASS)", () => {
  it("9. a share proof verified after its expiresAt is rejected with status 'expired'", () => {
    const sellerKeypair = FedosTrustSigningKeypair.generate();
    const payload = productPayload({ sellerPubkey: sellerKeypair.publicKeyHex });
    const expiresAt = NOW + 3600;
    const envelope = issueSignedProductShareProof(payload, { keypair: sellerKeypair, issuer: "self" }, { issuedAt: NOW, expiresAt });

    const stillValid = verifySelfAssertedProductShareProof(envelope, { clock: fixedFedosTrustClock(NOW + 1800) });
    expect(stillValid.status).toBe("VALID");

    const expired = verifySelfAssertedProductShareProof(envelope, { clock: fixedFedosTrustClock(expiresAt + 7200) });
    expect(expired.status).toBe("expired");
  });
});

describe("Case I: malformed/unrecognized payload shape (PASS)", () => {
  it("10. an envelope carrying an unrelated metadata shape (e.g. a receipt's own fields) is rejected as INVALID_PAYLOAD_SHAPE, never misread as a share proof", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const envelope = issueFedosTrustContractArtifactProof(
      {
        artifactDigestHex: "1".repeat(64),
        metadata: { kind: "trade_completion", orderId: "not-a-share-proof", formatVersion: 1 },
      },
      { issuer: "self", issuedAt: NOW, keypair: issuerKeypair },
    ) as SignedCommerceShareProofEnvelope;
    const result = verifySelfAssertedProductShareProof(envelope, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("INVALID_PAYLOAD_SHAPE");
  });

  it("11. issueSignedProductShareProof throws RangeError on a malformed payload rather than silently signing garbage", () => {
    const sellerKeypair = FedosTrustSigningKeypair.generate();
    const malformed = { ...productPayload(), priceCents: -5 } as unknown as ProductShareProofPayload;
    expect(() => issueSignedProductShareProof(malformed, { keypair: sellerKeypair, issuer: "self" }, { issuedAt: NOW })).toThrow(RangeError);
  });
});

describe("buildSelfAssertedShareTrustPolicy -- pure, structural only", () => {
  it("12. resolves exactly the envelope's own (issuer, keyId) to keyId itself as the public key", () => {
    const sellerKeypair = FedosTrustSigningKeypair.generate();
    const payload = productPayload({ sellerPubkey: sellerKeypair.publicKeyHex });
    const envelope = issueSignedProductShareProof(payload, { keypair: sellerKeypair, issuer: "self" }, { issuedAt: NOW });
    const policy = buildSelfAssertedShareTrustPolicy(envelope);
    expect(policy.resolveIssuerKey(envelope.issuer, envelope.keyId, NOW)).toBe(envelope.keyId);
    expect(policy.resolveIssuerKey("someone-else", envelope.keyId, NOW)).toBeNull();
  });
});
