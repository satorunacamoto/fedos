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
  issueSignedTradeReceiptProof,
  verifySignedTradeReceiptProof,
  type SignedCommerceReceiptProofEnvelope,
  type TradeReceiptProofPayload,
} from "../src/os/commerce/receipt/index.js";

/**
 * FedOS Commerce End-to-End Completion arc, Wave B (Agent T) — tamper/
 * forgery test cases for the receipt QR/Trust seam (original arc brief
 * §16/§31, this agent's lane). Every case below is classified PASS / GAP /
 * EXPECTED LIMITATION in this file's own describe-block comments AND in the
 * final report — read both before assuming a "PASS" here means "production
 * ready" (see each block's own caveat).
 */

const NOW = 1_800_000_000;
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function tradePayload(): TradeReceiptProofPayload {
  return {
    kind: "trade_completion",
    orderId: "order-alice-bob-tamper",
    productRef: "product-digital-art-print",
    buyerRef: "alice-persona-epoch-key-hex",
    sellerRef: "bob-persona-epoch-key-hex",
    paymentEvidenceRef: "local-sim-payment-tamper",
    completedAt: NOW,
    formatVersion: 1,
  };
}

function flipBase64UrlCharAt(text: string, index: number): string {
  const original = text[index];
  const alternatives = [...BASE64URL_ALPHABET].filter((char) => char !== original);
  const replacement = alternatives[index % alternatives.length];
  return text.slice(0, index) + replacement + text.slice(index + 1);
}

/**
 * CASE A — Tampered QR (arc brief §16/§31): flip a single character
 * somewhere inside the QR text's base64url payload (never the
 * `"fedos:trust:v1:"` prefix, which is fixed and not itself signed content),
 * then run the same decode -> verify pipeline a real consumer would.
 *
 * VERDICT: PASS. Every tested offset ends in the tampered QR never
 * cryptographically verifying as VALID: either `decodeCommerceReceiptProofFromQrText`
 * itself rejects the corrupted text (a bit flip can break base64url/JSON
 * syntax), or decode "succeeds" structurally but `verifySignedTradeReceiptProof`
 * rejects it (base64url has 64 valid characters per position, so many single-
 * character flips still parse as *some* other valid envelope shape, but the
 * Schnorr signature -- computed over the ORIGINAL bytes -- no longer matches
 * the tampered ones). This exercises the exact contract
 * `src/os/trust/qr/fedos_trust_qr_text_codec.ts`'s header documents: QR
 * decode never re-derives/checks the signature; the caller's own verify call
 * is what actually catches the tamper.
 */
describe("Case A: tampered QR text never verifies (PASS)", () => {
  it("flipping any of several bytes in the QR text never yields a VALID verification", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const payload = tradePayload();
    const envelope = issueSignedTradeReceiptProof(
      payload,
      { keypair: issuerKeypair, issuer: "merchant-bob" },
      { issuedAt: NOW },
    );
    const qrText = encodeCommerceReceiptProofToQrText(envelope);
    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: issuerKeypair.publicKeyHex, publicKeyHex: issuerKeypair.publicKeyHex }],
    });

    // Sanity: the untampered QR text DOES verify -- proves the harness itself is correct.
    const untamperedDecoded = decodeCommerceReceiptProofFromQrText(qrText);
    expect("error" in untamperedDecoded).toBe(false);
    const untamperedResult = verifySignedTradeReceiptProof(
      untamperedDecoded as SignedCommerceReceiptProofEnvelope,
      trustPolicy,
      { clock: fixedFedosTrustClock(NOW) },
    );
    expect(untamperedResult.status).toBe("VALID");

    const payloadStart = FEDOS_TRUST_QR_TEXT_PREFIX.length;
    const offsetsToTry = [
      payloadStart, // first char of the base64url payload
      payloadStart + 10,
      Math.floor(qrText.length / 2), // middle of the payload
      qrText.length - 1, // last char
    ];

    let atLeastOneCaughtByDecode = false;
    let atLeastOneCaughtByVerify = false;

    for (const offset of offsetsToTry) {
      if (offset < payloadStart || offset >= qrText.length) continue;
      const tamperedText = flipBase64UrlCharAt(qrText, offset);
      expect(tamperedText).not.toBe(qrText);

      const decoded = decodeCommerceReceiptProofFromQrText(tamperedText);
      if ("error" in decoded) {
        atLeastOneCaughtByDecode = true;
        continue;
      }
      const result = verifySignedTradeReceiptProof(decoded, trustPolicy, { clock: fixedFedosTrustClock(NOW) });
      // THE CORE ASSERTION: a tampered QR must never verify as VALID, no
      // matter which offset was flipped or whether decode alone caught it.
      expect(result.status).not.toBe("VALID");
      if (result.status === "signature-invalid" || result.status === "malformed-envelope") {
        atLeastOneCaughtByVerify = true;
      }
    }

    // At least one of the two layers actually exercised its rejection path
    // (not just "every offset happened to hit the fixed prefix").
    expect(atLeastOneCaughtByDecode || atLeastOneCaughtByVerify).toBe(true);
  });
});

/**
 * CASE B — Wrong signer / impersonation (arc brief §16/§31): an attacker
 * signs with a DIFFERENT keypair than the one a verifier's `FedosTrustPolicy`
 * actually trusts for the claimed `(issuer, keyId)`.
 *
 * VERDICT: PASS, with two sub-cases:
 *   B1. Attacker signs honestly under their OWN keyId, which the verifier's
 *       policy never registered -> `"unknown-issuer-key"` (never resolves an
 *       untrusted key at all).
 *   B2. Attacker signs while FORGING the `keyId` field to claim the real
 *       merchant's key id (impersonation) -> the policy resolves that keyId
 *       to the REAL merchant's public key, and the Schnorr signature check
 *       then fails because it was actually produced by the attacker's secret
 *       key -> `"signature-invalid"`. Neither sub-case ever reaches VALID.
 */
describe("Case B: wrong signer never verifies (PASS)", () => {
  it("B1: an unregistered signer's own honest keyId resolves to unknown-issuer-key", () => {
    const legitimateKeypair = FedosTrustSigningKeypair.generate();
    const attackerKeypair = FedosTrustSigningKeypair.generate();
    const payload = tradePayload();

    const forgedEnvelope = issueSignedTradeReceiptProof(
      payload,
      { keypair: attackerKeypair, issuer: "merchant-bob" },
      { issuedAt: NOW },
    );

    // Verifier's policy only trusts the LEGITIMATE key for issuer "merchant-bob".
    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: legitimateKeypair.publicKeyHex, publicKeyHex: legitimateKeypair.publicKeyHex }],
    });

    const result = verifySignedTradeReceiptProof(forgedEnvelope, trustPolicy, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("unknown-issuer-key");
  });

  it("B2: an attacker impersonating the legitimate keyId fails signature verification", () => {
    const legitimateKeypair = FedosTrustSigningKeypair.generate();
    const attackerKeypair = FedosTrustSigningKeypair.generate();
    const payload = tradePayload();

    // Attacker signs with THEIR OWN secret key but forges keyId to claim the
    // legitimate merchant's key id.
    const impersonatingEnvelope = issueSignedTradeReceiptProof(
      payload,
      { keypair: attackerKeypair, issuer: "merchant-bob", keyId: legitimateKeypair.publicKeyHex },
      { issuedAt: NOW },
    );
    expect(impersonatingEnvelope.keyId).toBe(legitimateKeypair.publicKeyHex);

    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: legitimateKeypair.publicKeyHex, publicKeyHex: legitimateKeypair.publicKeyHex }],
    });

    const result = verifySignedTradeReceiptProof(impersonatingEnvelope, trustPolicy, {
      clock: fixedFedosTrustClock(NOW),
    });
    expect(result.status).toBe("signature-invalid");
  });
});

/**
 * CASE C — Expired proof (arc brief §16/§31): this receipt type carries an
 * EXPIRY at the envelope level (`FedosTrustSignedEnvelope.expiresAt`, set at
 * issuance via `IssueCommerceReceiptProofOptions.expiresAt`) rather than a
 * second payload-level validity window (unlike `FedosSubscriptionEntitlement`'s
 * `validFrom`/`validUntil` -- a receipt proves a point-in-time completion
 * event, not an ongoing entitlement, so one freshness window is the right
 * design here, not two).
 *
 * VERDICT: PASS. Verifying with a clock past `expiresAt` (beyond the shared
 * clock-skew tolerance) rejects with `"expired"`; verifying with a clock
 * still inside the window accepts.
 */
describe("Case C: expired receipt is rejected (PASS)", () => {
  it("a receipt verified after its expiresAt is rejected with status 'expired'", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const payload = tradePayload();
    const expiresAt = NOW + 3600; // valid for one hour after issuance

    const envelope = issueSignedTradeReceiptProof(
      payload,
      { keypair: issuerKeypair, issuer: "merchant-bob" },
      { issuedAt: NOW, expiresAt },
    );

    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: issuerKeypair.publicKeyHex, publicKeyHex: issuerKeypair.publicKeyHex }],
    });

    // Still within the window: VALID.
    const stillValid = verifySignedTradeReceiptProof(envelope, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 1800),
    });
    expect(stillValid.status).toBe("VALID");

    // Long past expiresAt (well beyond FEDOS_TRUST_CLOCK_SKEW_TOLERANCE_SECONDS): expired.
    const expired = verifySignedTradeReceiptProof(envelope, trustPolicy, {
      clock: fixedFedosTrustClock(expiresAt + 7200),
    });
    expect(expired.status).toBe("expired");
  });
});

/**
 * CASE D (bonus, beyond the three named cases) — direct metadata tamper
 * without re-signing (no QR layer involved at all): an attacker who somehow
 * gets write access to a stored envelope object (not just its QR encoding)
 * and edits one signed field directly.
 *
 * VERDICT: PASS. Confirms the signature protects the FULL payload
 * (including `metadata`, which is where this receipt's real content lives —
 * see `commerce_trust_receipt_adapter.ts`'s header), not merely the bare
 * `artifactDigestHex` field.
 */
describe("Case D (bonus): direct payload/metadata tamper without re-signing (PASS)", () => {
  it("editing metadata.orderId directly invalidates the signature", () => {
    const issuerKeypair = FedosTrustSigningKeypair.generate();
    const payload = tradePayload();
    const envelope = issueSignedTradeReceiptProof(
      payload,
      { keypair: issuerKeypair, issuer: "merchant-bob" },
      { issuedAt: NOW },
    );

    const tamperedEnvelope: SignedCommerceReceiptProofEnvelope = {
      ...envelope,
      payload: {
        ...envelope.payload,
        metadata: { ...envelope.payload.metadata, orderId: "order-attacker-substituted" },
      },
    };

    const trustPolicy = createSingleIssuerFedosTrustPolicy({
      issuerId: "merchant-bob",
      keys: [{ keyId: issuerKeypair.publicKeyHex, publicKeyHex: issuerKeypair.publicKeyHex }],
    });
    const result = verifySignedTradeReceiptProof(tamperedEnvelope, trustPolicy, { clock: fixedFedosTrustClock(NOW) });
    expect(result.status).toBe("signature-invalid");
  });
});
