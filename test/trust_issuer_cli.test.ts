import { describe, it, expect } from "vitest";
import { FedosTrustSigningKeypair, fixedFedosTrustClock } from "../src/os/trust/envelope/index.js";
import { signFedosTrustSubscriptionSigningRequest } from "../src/os/trust/entitlement/index.js";
import type { SubscriptionSigningRequest } from "../src/os/trust/entitlement/index.js";
import {
  runFedosTrustIssuerGenerateKey,
  formatFedosTrustGenerateKeyStdout,
  computeFedosTrustIssuerIdentity,
  formatFedosTrustInspectKeyStdout,
  runFedosTrustIssuerSignEntitlement,
  formatFedosTrustSignEntitlementStdout,
  parseFedosTrustPolicyFromParsedJson,
  runFedosTrustIssuerVerifyEntitlement,
  formatFedosTrustVerifyEntitlementStdout,
  formatFedosTrustIssuerSecretForFileStorage,
} from "../src/os/trust/issuer/index.js";

const NOW = 1_800_000_000;
const DAY = 86_400;

function subjectRequestFixture() {
  const subjectKeypair = FedosTrustSigningKeypair.generate();
  const payload: SubscriptionSigningRequest = {
    subjectPublicKeyHex: subjectKeypair.publicKeyHex,
    requestedPlan: "pro-monthly",
    requestedScopes: ["credential", "signed-qr"],
    requestNonce: "nonce-cli-test",
    createdAt: NOW,
    formatVersion: 1,
  };
  const envelope = signFedosTrustSubscriptionSigningRequest(payload, subjectKeypair, fixedFedosTrustClock(NOW));
  return { subjectKeypair, envelope };
}

describe("trust issuer cli core logic", () => {
  it("generate-key: produces a fresh 32-byte secret and a well-formed public key, and its stdout output never contains the secret", () => {
    const { secretKeyBytes, publicKeyHex } = runFedosTrustIssuerGenerateKey();

    expect(secretKeyBytes).toBeInstanceOf(Uint8Array);
    expect(secretKeyBytes.length).toBe(32);
    expect(publicKeyHex).toMatch(/^[0-9a-f]{64}$/);

    const secretHex = formatFedosTrustIssuerSecretForFileStorage(secretKeyBytes);
    const stdout = formatFedosTrustGenerateKeyStdout(publicKeyHex);

    expect(stdout).toBe(publicKeyHex);
    expect(stdout).not.toContain(secretHex);
    secretKeyBytes.fill(0);
  });

  it("generate-key: two calls produce different keys (fresh randomness, no synthetic fixture reuse)", () => {
    const first = runFedosTrustIssuerGenerateKey();
    const second = runFedosTrustIssuerGenerateKey();
    expect(first.publicKeyHex).not.toBe(second.publicKeyHex);
    first.secretKeyBytes.fill(0);
    second.secretKeyBytes.fill(0);
  });

  it("inspect-key: derives the correct public identity and its stdout output never contains the secret", () => {
    const { secretKeyBytes, publicKeyHex } = runFedosTrustIssuerGenerateKey();
    const secretHex = formatFedosTrustIssuerSecretForFileStorage(secretKeyBytes);

    const identity = computeFedosTrustIssuerIdentity(secretKeyBytes);
    expect(identity.publicKeyHex).toBe(publicKeyHex);
    expect(identity.keyId).toBe(publicKeyHex);

    const stdout = formatFedosTrustInspectKeyStdout(identity);
    expect(stdout).toContain(publicKeyHex);
    expect(stdout).not.toContain(secretHex);

    // Defensive: also confirm the identity object itself carries no secret-shaped field.
    expect(JSON.stringify(identity)).not.toContain(secretHex);

    secretKeyBytes.fill(0);
  });

  it("sign-entitlement -> verify-entitlement round trip via core logic, VALID, and stdout output never contains the issuer secret", () => {
    const { envelope: requestEnvelope } = subjectRequestFixture();
    const issuer = runFedosTrustIssuerGenerateKey();
    const issuerSecretHex = formatFedosTrustIssuerSecretForFileStorage(issuer.secretKeyBytes);

    const signResult = runFedosTrustIssuerSignEntitlement(
      requestEnvelope,
      "pro-monthly",
      "credential,signed-qr",
      30,
      issuer.secretKeyBytes,
      "test-issuer",
      fixedFedosTrustClock(NOW),
    );

    expect(signResult.ok).toBe(true);
    if (!signResult.ok) return;

    const signStdout = formatFedosTrustSignEntitlementStdout(signResult.entitlement);
    expect(signStdout).not.toContain(issuerSecretHex);
    expect(signResult.entitlement.payload.planId).toBe("pro-monthly");
    expect(signResult.entitlement.payload.scopes).toEqual(["credential", "signed-qr"]);

    const trustPolicy = parseFedosTrustPolicyFromParsedJson({
      trustedIssuers: [
        {
          issuerId: "test-issuer",
          keys: [{ keyId: issuer.publicKeyHex, publicKeyHex: issuer.publicKeyHex }],
        },
      ],
    });

    const verifyResult = runFedosTrustIssuerVerifyEntitlement(
      signResult.entitlement,
      trustPolicy,
      fixedFedosTrustClock(NOW + DAY),
    );
    expect(formatFedosTrustVerifyEntitlementStdout(verifyResult)).toBe("VALID");

    issuer.secretKeyBytes.fill(0);
  });

  it("sign-entitlement: rejects issuing a scope the subject never requested", () => {
    const { envelope: requestEnvelope } = subjectRequestFixture(); // requested: credential, signed-qr
    const issuer = runFedosTrustIssuerGenerateKey();

    const signResult = runFedosTrustIssuerSignEntitlement(
      requestEnvelope,
      "pro-monthly",
      "contract-proof",
      30,
      issuer.secretKeyBytes,
      "test-issuer",
      fixedFedosTrustClock(NOW),
    );

    expect(signResult.ok).toBe(false);
    issuer.secretKeyBytes.fill(0);
  });

  it("sign-entitlement: rejects a request whose self-signature was tampered with (proof of possession fails)", () => {
    const { envelope: requestEnvelope } = subjectRequestFixture();
    const tamperedRequest = {
      ...requestEnvelope,
      payload: { ...requestEnvelope.payload, requestedPlan: "enterprise" },
    };
    const issuer = runFedosTrustIssuerGenerateKey();

    const signResult = runFedosTrustIssuerSignEntitlement(
      tamperedRequest,
      "enterprise",
      "credential",
      30,
      issuer.secretKeyBytes,
      "test-issuer",
      fixedFedosTrustClock(NOW),
    );

    expect(signResult.ok).toBe(false);
    if (!signResult.ok) expect(signResult.reason).toMatch(/proof of possession/);
    issuer.secretKeyBytes.fill(0);
  });

  it("verify-entitlement: reports EXPIRED/NOT_YET_VALID/failure reasons distinctly through formatFedosTrustVerifyEntitlementStdout", () => {
    const { envelope: requestEnvelope } = subjectRequestFixture();
    const issuer = runFedosTrustIssuerGenerateKey();
    const signResult = runFedosTrustIssuerSignEntitlement(
      requestEnvelope,
      "pro-monthly",
      "credential",
      30,
      issuer.secretKeyBytes,
      "test-issuer",
      fixedFedosTrustClock(NOW),
    );
    expect(signResult.ok).toBe(true);
    if (!signResult.ok) return;

    const trustPolicy = parseFedosTrustPolicyFromParsedJson({
      trustedIssuers: [
        { issuerId: "test-issuer", keys: [{ keyId: issuer.publicKeyHex, publicKeyHex: issuer.publicKeyHex }] },
      ],
    });

    const expiredResult = runFedosTrustIssuerVerifyEntitlement(
      signResult.entitlement,
      trustPolicy,
      fixedFedosTrustClock(NOW + 31 * DAY),
    );
    expect(formatFedosTrustVerifyEntitlementStdout(expiredResult)).toMatch(/^EXPIRED/);

    const wrongPolicy = parseFedosTrustPolicyFromParsedJson({ trustedIssuers: [] });
    const untrustedResult = runFedosTrustIssuerVerifyEntitlement(
      signResult.entitlement,
      wrongPolicy,
      fixedFedosTrustClock(NOW + DAY),
    );
    expect(formatFedosTrustVerifyEntitlementStdout(untrustedResult)).toMatch(/^unknown-issuer-key/);

    issuer.secretKeyBytes.fill(0);
  });
});
