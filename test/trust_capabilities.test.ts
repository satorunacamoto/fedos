import { describe, it, expect } from "vitest";
import { FedosTrustSigningKeypair, fixedFedosTrustClock } from "../src/os/trust/envelope/index.js";
import { createSingleIssuerFedosTrustPolicy } from "../src/os/trust/policy/index.js";
import {
  issueFedosTrustCapabilityGrantV1,
  verifyFedosTrustCapabilityGrantV1,
} from "../src/os/trust/capabilities/index.js";

const NOW = 1_800_000_000;

function issuerFixture() {
  const keypair = FedosTrustSigningKeypair.generate();
  const trustPolicy = createSingleIssuerFedosTrustPolicy({
    issuerId: "test-issuer",
    keys: [{ keyId: "k1", publicKeyHex: keypair.publicKeyHex }],
  });
  return { keypair, trustPolicy };
}

function issueValid(keypair: FedosTrustSigningKeypair) {
  return issueFedosTrustCapabilityGrantV1({
    issuer: "test-issuer",
    keyId: "k1",
    subject: keypair.publicKeyHex,
    expiresAt: NOW + 3600,
    payload: {
      subjectPublicKeyHex: keypair.publicKeyHex,
      resource: "board:general",
      permissions: ["post", "moderate"],
      delegationPolicy: "none",
    },
    keypair,
    clock: fixedFedosTrustClock(NOW),
  });
}

describe("trust capability grant", () => {
  it("valid round-trip: sign -> verify -> ok", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);

    const result = verifyFedosTrustCapabilityGrantV1(envelope, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolvedPublicKeyHex).toBe(keypair.publicKeyHex);
      expect(result.payload.permissions).toEqual(["post", "moderate"]);
    }
  });

  it("tampered payload byte -> FAIL", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);
    const tampered = { ...envelope, payload: { ...envelope.payload, resource: "board:secret" } };

    const result = verifyFedosTrustCapabilityGrantV1(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(false);
  });

  it("changed envelope type -> FAIL (wrong-domain-type)", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);
    const tampered = { ...envelope, type: "fedos.credential.v1" as const };

    const result = verifyFedosTrustCapabilityGrantV1(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong-domain-type");
  });

  it("changed issuer -> FAIL", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);
    const tampered = { ...envelope, issuer: "someone-else" };

    const result = verifyFedosTrustCapabilityGrantV1(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(false);
  });

  it("changed subject -> FAIL", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);
    const otherKeypair = FedosTrustSigningKeypair.generate();
    const tampered = { ...envelope, subject: otherKeypair.publicKeyHex };

    const result = verifyFedosTrustCapabilityGrantV1(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(false);
  });

  it("changed payload subjectPublicKeyHex -> FAIL", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);
    const otherKeypair = FedosTrustSigningKeypair.generate();
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, subjectPublicKeyHex: otherKeypair.publicKeyHex },
    };

    const result = verifyFedosTrustCapabilityGrantV1(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(false);
  });

  it("changed expiresAt -> FAIL", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);
    const tampered = { ...envelope, expiresAt: (envelope.expiresAt ?? 0) + 1 };

    const result = verifyFedosTrustCapabilityGrantV1(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(false);
  });
});
