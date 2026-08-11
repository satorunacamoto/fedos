import { describe, it, expect } from "vitest";
import { FedosTrustSigningKeypair, fixedFedosTrustClock } from "../src/os/trust/envelope/index.js";
import { createSingleIssuerFedosTrustPolicy } from "../src/os/trust/policy/index.js";
import {
  issueFedosSubscriptionEntitlement,
  verifyFedosSubscriptionEntitlement,
  signFedosTrustSubscriptionSigningRequest,
} from "../src/os/trust/entitlement/index.js";
import type { SubscriptionSigningRequest } from "../src/os/trust/entitlement/index.js";

const NOW = 1_800_000_000;
const DAY = 86_400;

function issuerFixture() {
  const issuerKeypair = FedosTrustSigningKeypair.generate();
  const trustPolicy = createSingleIssuerFedosTrustPolicy({
    issuerId: "test-issuer",
    keys: [{ keyId: issuerKeypair.publicKeyHex, publicKeyHex: issuerKeypair.publicKeyHex }],
  });
  return { issuerKeypair, trustPolicy };
}

function subjectRequestFixture(subjectKeypair: FedosTrustSigningKeypair) {
  const payload: SubscriptionSigningRequest = {
    subjectPublicKeyHex: subjectKeypair.publicKeyHex,
    requestedPlan: "pro-monthly",
    requestedScopes: ["credential", "signed-qr"],
    requestNonce: "nonce-xyz",
    createdAt: NOW,
    formatVersion: 1,
  };
  return signFedosTrustSubscriptionSigningRequest(payload, subjectKeypair, fixedFedosTrustClock(NOW));
}

function issueValid(issuerKeypair: FedosTrustSigningKeypair, subjectKeypair: FedosTrustSigningKeypair) {
  const requestEnvelope = subjectRequestFixture(subjectKeypair);
  return issueFedosSubscriptionEntitlement(
    requestEnvelope.payload,
    "pro-monthly",
    ["credential", "signed-qr"],
    NOW,
    NOW + 30 * DAY,
    issuerKeypair,
    "test-issuer",
    issuerKeypair.publicKeyHex,
    fixedFedosTrustClock(NOW),
  );
}

describe("trust subscription entitlement", () => {
  it("valid issuance -> verify -> VALID", () => {
    const { issuerKeypair, trustPolicy } = issuerFixture();
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const envelope = issueValid(issuerKeypair, subjectKeypair);

    const result = verifyFedosSubscriptionEntitlement(envelope, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + DAY),
    });

    expect(result.status).toBe("VALID");
    if (result.status === "VALID") {
      expect(result.resolvedPublicKeyHex).toBe(issuerKeypair.publicKeyHex);
      expect(result.payload.planId).toBe("pro-monthly");
      expect(result.payload.scopes).toEqual(["credential", "signed-qr"]);
      expect(result.payload.subjectPublicKeyHex).toBe(subjectKeypair.publicKeyHex);
    }
  });

  it("tamper payload byte (planId) -> FAIL (not VALID)", () => {
    const { issuerKeypair, trustPolicy } = issuerFixture();
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const envelope = issueValid(issuerKeypair, subjectKeypair);
    const tampered = { ...envelope, payload: { ...envelope.payload, planId: "enterprise" } };

    const result = verifyFedosSubscriptionEntitlement(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + DAY),
    });

    expect(result.status).not.toBe("VALID");
  });

  it("wrong issuer (not in trust policy) -> FAIL unknown-issuer-key", () => {
    const { issuerKeypair, trustPolicy } = issuerFixture();
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const envelope = issueValid(issuerKeypair, subjectKeypair);
    const tampered = { ...envelope, issuer: "some-other-issuer" };

    const result = verifyFedosSubscriptionEntitlement(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + DAY),
    });

    expect(result.status).toBe("unknown-issuer-key");
  });

  it("wrong scope requested vs granted -> FAIL SCOPE_NOT_GRANTED", () => {
    const { issuerKeypair, trustPolicy } = issuerFixture();
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const envelope = issueValid(issuerKeypair, subjectKeypair); // granted: credential, signed-qr

    const result = verifyFedosSubscriptionEntitlement(envelope, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + DAY),
      requiredScopes: ["contract-proof"],
    });

    expect(result.status).toBe("SCOPE_NOT_GRANTED");
  });

  it("expired (validUntil passed) -> FAIL EXPIRED", () => {
    const { issuerKeypair, trustPolicy } = issuerFixture();
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const envelope = issueValid(issuerKeypair, subjectKeypair); // validUntil = NOW + 30 days

    const result = verifyFedosSubscriptionEntitlement(envelope, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 31 * DAY),
    });

    expect(result.status).toBe("EXPIRED");
  });

  it("not yet valid (validFrom future) -> FAIL NOT_YET_VALID", () => {
    const { issuerKeypair, trustPolicy } = issuerFixture();
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const requestEnvelope = subjectRequestFixture(subjectKeypair);
    const futureStart = NOW + 10 * DAY;
    const envelope = issueFedosSubscriptionEntitlement(
      requestEnvelope.payload,
      "pro-monthly",
      ["credential"],
      futureStart,
      futureStart + 30 * DAY,
      issuerKeypair,
      "test-issuer",
      issuerKeypair.publicKeyHex,
      fixedFedosTrustClock(NOW),
    );

    const result = verifyFedosSubscriptionEntitlement(envelope, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + DAY),
    });

    expect(result.status).toBe("NOT_YET_VALID");
  });

  it("renewal produces an independently-verifiable NEW entitlement while the old one remains verifiable at its own original terms", () => {
    const { issuerKeypair, trustPolicy } = issuerFixture();
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const requestEnvelope = subjectRequestFixture(subjectKeypair);

    const original = issueFedosSubscriptionEntitlement(
      requestEnvelope.payload,
      "pro-monthly",
      ["credential"],
      NOW,
      NOW + 30 * DAY,
      issuerKeypair,
      "test-issuer",
      issuerKeypair.publicKeyHex,
      fixedFedosTrustClock(NOW),
    );

    // Renewal: a fresh call, fresh window, well after the original was signed.
    const renewalTime = NOW + 29 * DAY;
    const renewed = issueFedosSubscriptionEntitlement(
      requestEnvelope.payload,
      "pro-monthly",
      ["credential"],
      renewalTime,
      renewalTime + 30 * DAY,
      issuerKeypair,
      "test-issuer",
      issuerKeypair.publicKeyHex,
      fixedFedosTrustClock(renewalTime),
    );

    expect(renewed.payload.serial).not.toBe(original.payload.serial);
    expect(renewed.signature).not.toBe(original.signature);

    // Original still verifies fine at a time within ITS OWN original window.
    const originalResult = verifyFedosSubscriptionEntitlement(original, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 5 * DAY),
    });
    expect(originalResult.status).toBe("VALID");

    // Renewed entitlement verifies fine at a time within ITS OWN window.
    const renewedResult = verifyFedosSubscriptionEntitlement(renewed, trustPolicy, {
      clock: fixedFedosTrustClock(renewalTime + 5 * DAY),
    });
    expect(renewedResult.status).toBe("VALID");

    // The original, checked at a time past ITS OWN validUntil, is independently EXPIRED —
    // proving the two entitlements' validity windows are tracked independently.
    const originalExpiredResult = verifyFedosSubscriptionEntitlement(original, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 31 * DAY),
    });
    expect(originalExpiredResult.status).toBe("EXPIRED");
  });

  it("rejects a scope that is not in the recognized allowlist at issuance time", () => {
    const { issuerKeypair } = issuerFixture();
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const requestEnvelope = subjectRequestFixture(subjectKeypair);

    expect(() =>
      issueFedosSubscriptionEntitlement(
        requestEnvelope.payload,
        "pro-monthly",
        ["not-a-real-scope"],
        NOW,
        NOW + DAY,
        issuerKeypair,
        "test-issuer",
        issuerKeypair.publicKeyHex,
        fixedFedosTrustClock(NOW),
      ),
    ).toThrow();
  });
});
