import { describe, it, expect } from "vitest";
import { FedosTrustSigningKeypair, fixedFedosTrustClock } from "../src/os/trust/envelope/index.js";
import { createSingleIssuerFedosTrustPolicy } from "../src/os/trust/policy/index.js";
import {
  issueFedosTrustPseudonymousCredentialV1,
  verifyFedosTrustPseudonymousCredentialV1,
} from "../src/os/trust/credentials/index.js";

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
  return issueFedosTrustPseudonymousCredentialV1({
    issuer: "test-issuer",
    keyId: "k1",
    subject: keypair.publicKeyHex,
    expiresAt: NOW + 3600,
    payload: {
      subjectPublicKeyHex: keypair.publicKeyHex,
      label: "anon-handle-42",
      issuerStatement: "no real-world identity claimed",
    },
    keypair,
    clock: fixedFedosTrustClock(NOW),
  });
}

describe("trust pseudonymous credential", () => {
  it("valid round-trip: sign -> verify -> ok", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);

    const result = verifyFedosTrustPseudonymousCredentialV1(envelope, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolvedPublicKeyHex).toBe(keypair.publicKeyHex);
      expect(result.payload.label).toBe("anon-handle-42");
    }
  });

  it("tampered payload byte -> FAIL", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);
    const tampered = { ...envelope, payload: { ...envelope.payload, label: "anon-handle-43" } };

    const result = verifyFedosTrustPseudonymousCredentialV1(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(false);
  });

  it("changed envelope type -> FAIL (wrong-domain-type)", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);
    const tampered = { ...envelope, type: "fedos.capability.v1" as const };

    const result = verifyFedosTrustPseudonymousCredentialV1(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong-domain-type");
  });

  it("changed issuer -> FAIL", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);
    const tampered = { ...envelope, issuer: "someone-else" };

    const result = verifyFedosTrustPseudonymousCredentialV1(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(false);
  });

  it("changed subject -> FAIL", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);
    const otherKeypair = FedosTrustSigningKeypair.generate();
    const tampered = { ...envelope, subject: otherKeypair.publicKeyHex };

    const result = verifyFedosTrustPseudonymousCredentialV1(tampered, trustPolicy, {
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

    const result = verifyFedosTrustPseudonymousCredentialV1(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(false);
  });

  it("changed expiresAt -> FAIL", () => {
    const { keypair, trustPolicy } = issuerFixture();
    const envelope = issueValid(keypair);
    const tampered = { ...envelope, expiresAt: (envelope.expiresAt ?? 0) + 1 };

    const result = verifyFedosTrustPseudonymousCredentialV1(tampered, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 10),
    });

    expect(result.ok).toBe(false);
  });
});
